"""Bounded, read-only LSP queries using the project's locked language servers.

Run with `uv run python tools/code_intel.py --help`. Positions at the CLI are
one-based Unicode code points; the wire protocol uses zero-based UTF-16 units.
This is a local CLI bridge, not a registered Codex/MCP tool.
"""

from __future__ import annotations

import argparse
import contextlib
import ctypes
import glob
import importlib.util
import json
import math
import os
import platform
import queue
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, BinaryIO, cast

ROOT = Path(__file__).resolve().parents[1]
MAX_MESSAGE = 8 * 1024 * 1024
MAX_SOURCE = 1024 * 1024
MAX_OUTPUT = 1024 * 1024


class LspError(RuntimeError):
    """A bounded language-server operation failed."""


def windows_job(pid: int) -> tuple[Any, Any]:
    """Own the server tree even if its root exits before an unresponsive child."""
    from ctypes import wintypes

    class Basic(ctypes.Structure):
        _fields_ = [
            ("process_time", ctypes.c_int64),
            ("job_time", ctypes.c_int64),
            ("flags", wintypes.DWORD),
            ("min_working", ctypes.c_size_t),
            ("max_working", ctypes.c_size_t),
            ("process_count", wintypes.DWORD),
            ("affinity", ctypes.c_size_t),
            ("priority", wintypes.DWORD),
            ("scheduling", wintypes.DWORD),
        ]

    class Extended(ctypes.Structure):
        _fields_ = [
            ("basic", Basic),
            ("io_counters", ctypes.c_uint64 * 6),
            ("process_memory", ctypes.c_size_t),
            ("job_memory", ctypes.c_size_t),
            ("peak_process", ctypes.c_size_t),
            ("peak_job", ctypes.c_size_t),
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
    ]
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    job = kernel.CreateJobObjectW(None, None)
    process = kernel.OpenProcess(0x0101, False, pid)  # SET_QUOTA | TERMINATE
    limits = Extended()
    limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    try:
        if (
            not job
            or not process
            or not kernel.SetInformationJobObject(
                job, 9, ctypes.byref(limits), ctypes.sizeof(limits)
            )
            or not kernel.AssignProcessToJobObject(job, process)
        ):
            raise OSError(ctypes.get_last_error(), "Cannot contain the language server process")
    except BaseException:
        if job:
            kernel.CloseHandle(job)
        raise
    finally:
        if process:
            kernel.CloseHandle(process)
    return kernel, job


def resume_windows_process(pid: int) -> None:
    """Resume the sole initial thread only after suspended-process containment.

    Popen closes CreateProcess's thread handle. Documented Toolhelp32 APIs find
    that thread; OpenThread plus GetProcessIdOfThread verify its ownership before
    ResumeThread. CREATE_SUSPENDED prevents server code running in this interval.
    """
    from ctypes import wintypes

    class ThreadEntry(ctypes.Structure):
        _fields_ = [
            ("size", wintypes.DWORD),
            ("usage", wintypes.DWORD),
            ("thread_id", wintypes.DWORD),
            ("process_id", wintypes.DWORD),
            ("base_priority", wintypes.LONG),
            ("delta_priority", wintypes.LONG),
            ("flags", wintypes.DWORD),
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Thread32First.argtypes = [wintypes.HANDLE, ctypes.POINTER(ThreadEntry)]
    kernel.Thread32Next.argtypes = [wintypes.HANDLE, ctypes.POINTER(ThreadEntry)]
    kernel.OpenThread.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenThread.restype = wintypes.HANDLE
    kernel.GetProcessIdOfThread.argtypes = [wintypes.HANDLE]
    kernel.GetProcessIdOfThread.restype = wintypes.DWORD
    kernel.ResumeThread.argtypes = [wintypes.HANDLE]
    kernel.ResumeThread.restype = wintypes.DWORD
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    snapshot = kernel.CreateToolhelp32Snapshot(0x4, 0)  # TH32CS_SNAPTHREAD
    if snapshot == ctypes.c_void_p(-1).value:
        raise OSError(ctypes.get_last_error(), "Cannot enumerate suspended server thread")
    try:
        entry = ThreadEntry()
        entry.size = ctypes.sizeof(entry)
        found: list[int] = []
        available = kernel.Thread32First(snapshot, ctypes.byref(entry))
        while available:
            if entry.process_id == pid:
                found.append(entry.thread_id)
            entry.size = ctypes.sizeof(entry)
            available = kernel.Thread32Next(snapshot, ctypes.byref(entry))
        if ctypes.get_last_error() != 18:  # ERROR_NO_MORE_FILES: complete snapshot
            raise OSError(ctypes.get_last_error(), "Cannot enumerate suspended server thread")
        if len(found) != 1:
            raise LspError("Suspended server must have exactly one initial thread")
        thread = kernel.OpenThread(
            0x0802, False, found[0]
        )  # QUERY_LIMITED_INFORMATION | SUSPEND_RESUME
        if not thread:
            raise OSError(ctypes.get_last_error(), "Cannot open suspended server thread")
        try:
            if kernel.GetProcessIdOfThread(thread) != pid:
                raise LspError("Suspended server thread ownership changed")
            if kernel.ResumeThread(thread) != 1:
                raise LspError("Cannot resume the suspended server initial thread")
        finally:
            kernel.CloseHandle(thread)
    finally:
        kernel.CloseHandle(snapshot)


def read_message(stream: BinaryIO) -> dict[str, Any]:
    """Read one bounded Content-Length frame, including fragmented bodies."""
    length = None
    header_bytes = 0
    while True:
        line = stream.readline(8193)
        if not line:
            raise LspError("Language server closed its output")
        header_bytes += len(line)
        if header_bytes > 8192:
            raise LspError("Oversized LSP headers")
        if line == b"\r\n":
            break
        key, separator, value = line.partition(b":")
        if not separator:
            raise LspError("Malformed LSP header")
        if key.lower() == b"content-length":
            if length is not None:
                raise LspError("Duplicate Content-Length")
            try:
                length = int(value.strip())
            except ValueError as exc:
                raise LspError("Invalid Content-Length") from exc
    if length is None or not 0 < length <= MAX_MESSAGE:
        raise LspError("Missing or oversized LSP body")
    body = bytearray()
    while len(body) < length:
        chunk = stream.read(length - len(body))
        if not chunk:
            raise LspError("Truncated LSP body")
        body.extend(chunk)
    try:
        result = json.loads(body)
    except (ValueError, UnicodeError) as exc:
        raise LspError("Invalid LSP JSON") from exc
    if not isinstance(result, dict):
        raise LspError("LSP message must be an object")
    return result


class LspClient:
    """One sequential session; drains stderr without retaining source or logs."""

    def __init__(self, command: list[str], cwd: Path, timeout: float = 20):
        if not math.isfinite(timeout) or not 0 < timeout <= 120:
            raise ValueError("Timeout must be greater than zero and at most 120 seconds")
        self.timeout = timeout
        self.messages: queue.Queue[dict[str, Any] | Exception] = queue.Queue(maxsize=64)
        self.serial = 0
        self.closed = False
        self.write_failed = False
        self.writers: list[threading.Thread] = []
        self.job: tuple[Any, Any] | None = None
        self.process = subprocess.Popen(
            command,
            cwd=cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
            start_new_session=os.name != "nt",
            # No server instruction may run before the Job Object owns its tree.
            creationflags=(subprocess.CREATE_NO_WINDOW | 0x4) if os.name == "nt" else 0,
        )
        if os.name == "nt":
            try:
                self.job = windows_job(self.process.pid)
                resume_windows_process(self.process.pid)
            except BaseException:
                try:
                    if self.job is not None:
                        kernel, handle = self.job
                        kernel.CloseHandle(handle)
                        self.job = None
                    if self.process.poll() is None:
                        self.process.kill()
                    self.process.wait(timeout=5)
                finally:
                    for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
                        if stream is not None:
                            stream.close()
                raise
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.drainer = threading.Thread(target=self._drain, daemon=True)
        self.reader.start()
        self.drainer.start()

    def _read(self) -> None:
        assert self.process.stdout is not None
        try:
            while True:
                self.messages.put_nowait(read_message(cast(BinaryIO, self.process.stdout)))
        except queue.Full:
            # A full queue itself becomes a bounded protocol failure at request time.
            return
        except Exception as exc:
            with contextlib.suppress(queue.Full):
                self.messages.put_nowait(exc)

    def _drain(self) -> None:
        assert self.process.stderr is not None
        while self.process.stderr.read(4096):
            pass

    def send(self, message: dict[str, Any]) -> None:
        assert self.process.stdin is not None
        body = json.dumps({"jsonrpc": "2.0", **message}).encode("utf-8")
        frame = f"Content-Length: {len(body)}\r\n\r\n".encode() + body
        errors: list[OSError] = []

        def write() -> None:
            assert self.process.stdin is not None
            try:
                remaining = memoryview(frame)
                while remaining:
                    written = self.process.stdin.write(remaining)
                    if not written:
                        raise OSError("Closed server input")
                    remaining = remaining[written:]
            except OSError as exc:
                errors.append(exc)

        writer = threading.Thread(target=write, daemon=True)
        self.writers.append(writer)
        writer.start()
        writer.join(timeout=self.timeout)
        if writer.is_alive():
            self.write_failed = True
            raise LspError("Language server timed out receiving input")
        if errors:
            raise LspError("Language server closed its input") from errors[0]

    def notify(self, method: str, params: dict[str, Any]) -> None:
        self.send({"method": method, "params": params})

    def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self.serial += 1
        request_id = self.serial
        self.send({"id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + self.timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise LspError(f"Language server timed out during {method}")
            try:
                message = self.messages.get(timeout=remaining)
            except queue.Empty as exc:
                raise LspError(f"Language server timed out during {method}") from exc
            if isinstance(message, Exception):
                raise LspError(str(message)) from message
            if "method" in message and "id" in message:
                # Only configuration/progress requests are supported. Never apply edits.
                if message["method"] == "workspace/configuration":
                    items = message.get("params", {}).get("items", [])
                    self.send({"id": message["id"], "result": [{} for _ in items]})
                elif message["method"] == "window/workDoneProgress/create":
                    self.send({"id": message["id"], "result": None})
                else:
                    self.send(
                        {
                            "id": message["id"],
                            "error": {
                                "code": -32601,
                                "message": "Read-only client: unsupported request",
                            },
                        }
                    )
            elif message.get("id") == request_id:
                if "error" in message:
                    raise LspError(f"Language server rejected {method}: {message['error']}")
                return message.get("result")

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            if self.process.poll() is None:
                original_timeout = self.timeout
                self.timeout = min(self.timeout, 1)
                try:
                    if not self.write_failed:
                        self.request("shutdown")
                        self.notify("exit", {})
                except LspError, OSError:
                    pass
                finally:
                    self.timeout = original_timeout
                try:
                    self.process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    if os.name == "nt":
                        self.process.kill()
                    else:
                        with contextlib.suppress(ProcessLookupError):
                            os.killpg(self.process.pid, signal.SIGKILL)
                    self.process.wait(timeout=5)
        finally:
            if self.job is not None:
                kernel, handle = self.job
                kernel.CloseHandle(handle)
                self.job = None
            elif os.name != "nt":
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(self.process.pid, signal.SIGKILL)
            for writer in self.writers:
                writer.join(timeout=1)
            for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
                if stream is not None:
                    stream.close()
            self.reader.join(timeout=1)
            self.drainer.join(timeout=1)

    def __enter__(self) -> LspClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def source_file(root: Path, relative: str) -> tuple[Path, str, str]:
    """Accept only included source files, never cache/data/dependency paths."""
    argument = Path(relative)
    if argument.is_absolute() or ".." in argument.parts:
        raise ValueError("File must be a repository-relative source path without '..'")
    path = (root / argument).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("File resolves outside the repository")
    rel = path.relative_to(root.resolve()).as_posix()
    forbidden = {"data", "node_modules", "dist", "__pycache__", ".venv", ".git"}
    if forbidden.intersection(path.relative_to(root.resolve()).parts):
        raise ValueError("Data, cache and dependency files are outside query scope")
    if path.suffix == ".py":
        config = json.loads((root / "pyrightconfig.json").read_text(encoding="utf-8"))

        def matches(pattern: str) -> bool:
            return (
                rel == pattern
                or rel.startswith(pattern.rstrip("/") + "/")
                or bool(re.fullmatch(glob.translate(pattern, recursive=True, seps="/"), rel))
            )

        if not any(matches(item) for item in config["include"]) or any(
            matches(item) for item in config.get("exclude", [])
        ):
            raise ValueError("File is outside pyrightconfig.json query scope")
        language = "python"
    elif path.suffix in {".ts", ".tsx"} and rel.startswith("web/src/"):
        config = json.loads((root / "web/tsconfig.json").read_text(encoding="utf-8"))
        if config.get("include") != ["src"] or config.get("exclude"):
            raise ValueError("Update the query allowlist for the changed web/tsconfig.json scope")
        language = "typescriptreact" if path.suffix == ".tsx" else "typescript"
    else:
        raise ValueError("Only configured Python and web/src TypeScript sources are supported")
    if path.stat().st_size > MAX_SOURCE:
        raise ValueError("Source exceeds the 1 MiB query limit")
    return path, language, path.read_text(encoding="utf-8")


def utf16_position(text: str, line: int, column: int) -> dict[str, int]:
    lines = text.split("\n")
    if not 1 <= line <= len(lines):
        raise ValueError("Line is outside the source")
    content = lines[line - 1].rstrip("\r")
    if not 1 <= column <= len(content) + 1:
        raise ValueError("Column is outside the source")
    return {"line": line - 1, "character": len(content[: column - 1].encode("utf-16-le")) // 2}


def server_command(root: Path, language: str) -> list[str]:
    if language == "python":
        spec = importlib.util.find_spec("pyright")
        node = shutil.which("node")
        if spec is None or spec.origin is None or node is None:
            raise LspError("Run uv sync --frozen and install the project's Node runtime first")
        # Invoke the locked bundled JS directly, avoiding Python launcher children/downloads.
        server = Path(spec.origin).parent / "dist" / "langserver.index.js"
        if not server.resolve().is_relative_to((root / ".venv").resolve()):
            raise LspError("Use uv run python so queries use this project's locked Pyright")
        if not server.is_file():
            raise LspError("Pyright's bundled language server is missing; run uv sync --frozen")
        return [node, str(server), "--stdio"]
    system = {"Windows": "win32", "Linux": "linux", "Darwin": "darwin"}.get(platform.system())
    arch = {
        "amd64": "x64",
        "x86_64": "x64",
        "arm64": "arm64",
        "aarch64": "arm64",
        "armv7l": "arm",
    }.get(platform.machine().lower())
    executable = (
        root
        / "web/node_modules/@typescript"
        / f"typescript-{system}-{arch}"
        / "lib"
        / ("tsc.exe" if os.name == "nt" else "tsc")
    )
    if not executable.is_file():
        raise LspError("Native TypeScript server missing for this platform; run npm ci in web")
    return [str(executable), "--lsp", "-stdio"]


def query(root: Path, file: str, operation: str, line: int, column: int, timeout: float) -> Any:
    path, language, text = source_file(root, file)
    position = utf16_position(text, line, column)
    workspace = root if language == "python" else root / "web"
    with LspClient(server_command(root, language), workspace, timeout) as client:
        initialized = client.request(
            "initialize",
            {
                "processId": os.getpid(),
                "rootUri": workspace.as_uri(),
                "workspaceFolders": [{"uri": workspace.as_uri(), "name": workspace.name}],
                "capabilities": {
                    "general": {"positionEncodings": ["utf-16"]},
                    "workspace": {"workspaceFolders": True},
                },
            },
        )
        encoding = initialized.get("capabilities", {}).get("positionEncoding", "utf-16")
        if encoding != "utf-16":
            raise LspError(f"Unsupported server position encoding: {encoding}")
        client.notify("initialized", {})
        client.notify(
            "textDocument/didOpen",
            {
                "textDocument": {
                    "uri": path.as_uri(),
                    "languageId": language,
                    "version": 1,
                    "text": text,
                }
            },
        )
        params: dict[str, Any] = {"textDocument": {"uri": path.as_uri()}}
        methods = {
            "symbols": "documentSymbol",
            "hover": "hover",
            "definition": "definition",
            "references": "references",
        }
        if operation != "symbols":
            params["position"] = position
        if operation == "references":
            params["context"] = {"includeDeclaration": True}
        result = client.request("textDocument/" + methods[operation], params)
        if len(json.dumps(result).encode("utf-8")) > MAX_OUTPUT:
            raise LspError("Result exceeds 1 MiB; use a narrower source query")
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["symbols", "hover", "definition", "references"])
    parser.add_argument("file", help="Repository-relative configured source file")
    parser.add_argument("--line", type=int, default=1, help="One-based line (default 1)")
    parser.add_argument(
        "--column", type=int, default=1, help="One-based Unicode column (default 1)"
    )
    parser.add_argument(
        "--timeout", type=float, default=20, help="Seconds per request, maximum 120"
    )
    args = parser.parse_args()
    try:
        result = query(ROOT, args.file, args.operation, args.line, args.column, args.timeout)
        print(json.dumps(result, indent=2, ensure_ascii=True))
    except (LspError, ValueError, OSError, KeyError) as exc:
        print(f"code-intel: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
