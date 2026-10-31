"""Protocol, scope and process-lifecycle checks without project execution."""

import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from tools import code_intel
from tools.code_intel import LspClient, LspError, read_message, source_file, utf16_position

ROOT = Path(__file__).resolve().parents[1]
FAKE_SERVER = r"""
import json, subprocess, sys, time
from pathlib import Path
from tools.code_intel import read_message
mode = sys.argv[1]
if mode == 'blocked':
    time.sleep(60)
if mode == 'eof':
    sys.exit(0)
def spawn_child(marker):
    subprocess.Popen([sys.executable, '-c',
        "import sys,time; from pathlib import Path\n"
        "for i in range(1200):\n Path(sys.argv[1]).write_text(str(i)); time.sleep(.05)", marker],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    while not Path(marker).exists():
        time.sleep(.01)
if mode == 'startup-child':
    spawn_child(sys.argv[2])
def send(message):
    body = json.dumps(message).encode()
    sys.stdout.buffer.write(('Content-Length: %d\r\n\r\n' % len(body)).encode())
    sys.stdout.buffer.flush()
    for part in (body[:3], body[3:]):
        sys.stdout.buffer.write(part)
        sys.stdout.buffer.flush()
while True:
    request = read_message(sys.stdin.buffer)
    method = request.get('method')
    if method == 'shutdown':
        if mode == 'hang':
            time.sleep(60)
        send({'id': request['id'], 'result': None})
    elif method == 'exit':
        break
    elif method == 'test':
        if mode == 'hang':
            time.sleep(60)
        if mode == 'error':
            send({'id': request['id'], 'error': {'code': -1, 'message': 'test rejection'}})
            continue
        if mode == 'stderr':
            sys.stderr.buffer.write(b'x' * 200000)
            sys.stderr.buffer.flush()
        if mode == 'child':
            spawn_child(sys.argv[2])
        send({'method': 'window/logMessage', 'params': {'message': 'ignored'}})
        send({'id': 1001, 'method': 'workspace/configuration', 'params': {'items': [{}, {}]}})
        config = read_message(sys.stdin.buffer)
        send({'id': 1002, 'method': 'workspace/applyEdit', 'params': {}})
        edit = read_message(sys.stdin.buffer)
        send({'id': request['id'], 'result': {'config': config['result'], 'edit': edit['error']['code']}})
"""


class FrameTests(unittest.TestCase):
    def test_valid_utf8_frame(self):
        body = json.dumps({"result": "😀"}, ensure_ascii=False).encode()
        stream = io.BytesIO(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        self.assertEqual(read_message(stream), {"result": "😀"})

    def test_rejects_invalid_or_unbounded_frames(self):
        cases = [
            b"",
            b"invalid\r\n",
            b"Content-Length: nope\r\n\r\n",
            b"Content-Length: 999999999\r\n\r\n",
            b"Content-Length: 2\r\n\r\n{",
            b"Content-Length: 2\r\n\r\n[]",
            b"Content-Length: 2\r\n\r\nxx",
            b"Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}",
            b"x" * 8193,
        ]
        for case in cases:
            with self.subTest(case=case[:50]), self.assertRaises(LspError):
                read_message(io.BytesIO(case))


class ScopeTests(unittest.TestCase):
    def test_utf16_position_and_bounds(self):
        self.assertEqual(utf16_position("a😀b\r\nlast", 1, 3), {"line": 0, "character": 3})
        self.assertEqual(utf16_position("a😀b", 1, 4), {"line": 0, "character": 4})
        for line, column in [(0, 1), (3, 1), (1, 0), (1, 5)]:
            with self.assertRaises(ValueError):
                utf16_position("abc", line, column)

    def test_scope_acceptance_and_rejection(self):
        for file in ["drive_model_names.py", "tools/code_intel.py", "web/src/matrix-data.ts"]:
            self.assertTrue(source_file(ROOT, file)[0].is_file())
        for file in [
            "../secret.py",
            str(ROOT / "drive_model_names.py"),
            "data/a.py",
            ".venv/a.py",
            "web/node_modules/a.ts",
            "web/dist/a.ts",
            "unknown/a.py",
            "web/scripts/a.ts",
            "README.md",
        ]:
            with self.subTest(file=file), self.assertRaises(ValueError):
                source_file(ROOT, file)

    def test_symlink_escape(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            external = Path(temporary) / "external.py"
            external.write_text("x = 1", encoding="utf-8")
            try:
                (root / "escaped.py").symlink_to(external)
            except OSError:
                self.skipTest("Symlink creation is unavailable")
            with self.assertRaisesRegex(ValueError, "outside"):
                source_file(root, "escaped.py")


class LifecycleTests(unittest.TestCase):
    def client(self, mode: str, *args: str, timeout: float = 2) -> LspClient:
        return LspClient([sys.executable, "-c", FAKE_SERVER, mode, *args], ROOT, timeout)

    def assert_clean(self, client: LspClient):
        self.assertIsNotNone(client.process.poll())
        self.assertFalse(client.reader.is_alive())
        self.assertFalse(client.drainer.is_alive())
        self.assertTrue(all(not writer.is_alive() for writer in client.writers))

    def test_fragmented_response_requests_stderr_and_graceful_exit(self):
        with self.client("stderr") as client:
            self.assertEqual(client.request("test"), {"config": [{}, {}], "edit": -32601})
        self.assertEqual(client.process.returncode, 0)
        self.assert_clean(client)
        client.close()  # Idempotent cleanup.

    def test_rejection_and_timeout_cleanup(self):
        for mode in ["error", "hang"]:
            with self.subTest(mode=mode):
                client = self.client(mode, timeout=0.15)
                with self.assertRaises(LspError), client:
                    client.request("test")
                self.assert_clean(client)

    def test_blocked_server_input_is_bounded(self):
        client = self.client("blocked", timeout=0.15)
        start = time.monotonic()
        with self.assertRaisesRegex(LspError, "receiving input"), client:
            client.notify("large", {"text": "x" * 1000000})
        self.assertLess(time.monotonic() - start, 4)
        self.assert_clean(client)

    def test_child_tree_cleanup_even_after_graceful_parent_exit(self):
        with tempfile.TemporaryDirectory() as temporary:
            marker = Path(temporary) / "child.txt"
            with self.client("child", str(marker)) as client:
                client.request("test")
            self.assert_clean(client)
            time.sleep(0.1)
            after = marker.read_text()
            time.sleep(0.15)
            self.assertEqual(marker.read_text(), after, "Server child survived cleanup")

    @unittest.skipUnless(os.name == "nt", "Windows suspended creation regression")
    def test_startup_child_cannot_run_before_job_assignment(self):
        original_job = code_intel.windows_job
        with tempfile.TemporaryDirectory() as temporary:
            marker = Path(temporary) / "startup-child.txt"

            def delayed_job(pid: int):
                time.sleep(0.3)
                self.assertFalse(marker.exists(), "Server executed before containment")
                return original_job(pid)

            with mock.patch("tools.code_intel.windows_job", side_effect=delayed_job):
                with self.client("startup-child", str(marker)) as client:
                    client.request("test")
                    self.assertTrue(marker.exists(), "Startup child did not exercise containment")
            self.assert_clean(client)
            time.sleep(0.1)
            after = marker.read_text()
            time.sleep(0.15)
            self.assertEqual(marker.read_text(), after, "Startup child survived cleanup")

    @unittest.skipUnless(os.name == "nt", "Windows suspended creation failure cleanup")
    def test_containment_and_resume_failures_clean_suspended_process(self):
        original_popen = subprocess.Popen
        original_job = code_intel.windows_job
        for failure in ["windows_job", "resume_windows_process"]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                marker = Path(temporary) / "must-not-start.txt"
                processes = []
                jobs = []

                def capture_process(*args, _processes=processes, **kwargs):
                    process = original_popen(*args, **kwargs)
                    _processes.append(process)
                    return process

                def capture_job(pid: int, _jobs=jobs):
                    job = original_job(pid)
                    _jobs.append(job)
                    return job

                with mock.patch("tools.code_intel.subprocess.Popen", side_effect=capture_process):
                    with mock.patch("tools.code_intel.windows_job", side_effect=capture_job):
                        with mock.patch("tools.code_intel." + failure, side_effect=OSError("test")):
                            with self.assertRaisesRegex(OSError, "test"):
                                self.client("startup-child", str(marker))
                self.assertEqual(len(processes), 1)
                self.assertIsNotNone(processes[0].poll())
                for stream in (processes[0].stdin, processes[0].stdout, processes[0].stderr):
                    self.assertTrue(stream.closed)
                self.assertFalse(marker.exists(), "Failed startup executed server code")
                # The handle is closed in the resume-failure path, not retained until GC.
                for kernel, handle in jobs:
                    import ctypes

                    kernel.GetHandleInformation.argtypes = [
                        ctypes.c_void_p,
                        ctypes.POINTER(ctypes.c_ulong),
                    ]
                    flags = ctypes.c_ulong()
                    self.assertFalse(kernel.GetHandleInformation(handle, ctypes.byref(flags)))

    def test_invalid_timeouts_do_not_start_a_process(self):
        for timeout in [0, -1, 121, float("nan"), float("inf")]:
            with self.assertRaises(ValueError):
                self.client("normal", timeout=timeout)

    def test_missing_executable(self):
        with self.assertRaises(OSError):
            LspClient(["nonexistent-code-intel-test-executable"], ROOT)

    def test_unexpected_eof_cleans_up(self):
        client = self.client("eof")
        with self.assertRaisesRegex(LspError, "closed"), client:
            client.request("test")
        self.assert_clean(client)


if __name__ == "__main__":
    unittest.main()
