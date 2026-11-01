"""Verified local projection and failure recovery, using tiny complete ZIPs."""

import hashlib
import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from historical_generator import bounds, digest, file_sha
from parquet_profile import PROFILE_ID
from refresh_sources import prepare_local_sources, prepare_source


def archive(root, *, missing=False):
    first, last = bounds("2024-Q1")
    path = root / "fictional.zip"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as stream:
        for day in range((last - first).days + 1):
            date = first + timedelta(days=day)
            if missing and day == 10:
                continue
            stream.writestr(
                f"{date}.csv",
                "date,serial_number,model,capacity_bytes,failure,datacenter\n"
                f"{date},fictional-private-identity,ST100TEST,8000000000000,0,LAB\n",
            )
        # A valid annual member outside the selected quarter must never be read.
        stream.writestr("2024-04-01.csv", "not a valid selected-quarter CSV body")
    return dict(
        quarter="2024-Q1",
        path=str(path),
        sha256=file_sha(path),
        sizeBytes=path.stat().st_size,
        url="https://example.org/fictional.zip",
    )


class RefreshSourceTests(unittest.TestCase):
    def test_existing_attempts_junction_is_rejected_before_any_projection_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            work = (root / "work").resolve()
            identity = {k: source[k] for k in ("quarter", "sha256", "sizeBytes", "url")} | {
                "parquetProfile": PROFILE_ID
            }
            attempt_parent = work / "projections" / source["quarter"] / digest(identity)
            attempt_parent.mkdir(parents=True)
            outside = root / "outside"
            outside.mkdir()
            link = attempt_parent / "attempts"
            if os.name == "nt":
                created = subprocess.run(
                    ["cmd", "/c", "mklink", "/J", str(link), str(outside)],
                    capture_output=True,
                    check=False,
                )
                if created.returncode:
                    self.skipTest("Junction creation unavailable")
            else:
                link.symlink_to(outside, target_is_directory=True)
            with (
                patch(
                    "refresh_sources.prepare",
                    side_effect=AssertionError("must not project through link"),
                ),
                self.assertRaises(ValueError),
            ):
                prepare_source(source, work, allow_projection=True)
            self.assertEqual(list(outside.iterdir()), [])
            self.assertFalse((attempt_parent / "projection.json").exists())

    def test_verified_projection_reuses_exact_bytes_without_projection(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            item = prepare_source(source, root / "work", allow_projection=True)
            assert item.receipt is not None
            receipt = json.loads(item.receipt.read_text())
            self.assertEqual(receipt["fileCount"], 91)
            self.assertEqual(receipt["selectedQuarter"], "2024-Q1")
            self.assertEqual(len(list(item.directory.glob("*.csv"))), 0)
            before = {
                p: (file_sha(p), p.stat().st_mtime_ns)
                for p in (root / "work").rglob("*")
                if p.is_file()
            }
            with patch(
                "refresh_sources.prepare", side_effect=AssertionError("unexpected projection")
            ):
                reused = prepare_source(source, root / "work", day_workers=4, polars_threads=3)
            self.assertEqual(item.directory, reused.directory)
            self.assertEqual(before, {p: (file_sha(p), p.stat().st_mtime_ns) for p in before})

    def test_execution_options_are_top_level_and_forwarded_to_projection(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            for options, expected in (
                ({}, (1, 2)),
                ({"dayWorkers": 4, "polarsThreads": 3}, (4, 3)),
                ({"dayWorkers": 5, "polarsThreads": 4}, (5, 4)),
            ):
                with self.subTest(options=options):
                    work = root / f"work-{expected[0]}"
                    with (
                        patch("refresh_sources.prepare", side_effect=RuntimeError) as project,
                        self.assertRaises(ValueError),
                    ):
                        prepare_local_sources(
                            dict(
                                sources=[source],
                                workRoot=str(work),
                                allowProjection=True,
                                **options,
                            ),
                            "2024-Q1",
                        )
                    project.assert_called_once()
                    args, kwargs = project.call_args
                    self.assertEqual(args[0], Path(source["path"]))
                    self.assertEqual(kwargs["day_workers"], expected[0])
                    self.assertEqual(kwargs["polars_threads"], expected[1])
                    self.assertEqual(kwargs["quarter"], source["quarter"])
                    self.assertEqual(kwargs["source_url"], source["url"])

    def test_invalid_execution_options_fail_before_source_read_or_private_write(self):
        invalid = [
            (True, 2),
            (1, False),
            (0, 2),
            (-1, 2),
            (1, 0),
            (1, -1),
            (1.5, 2),
            (1, "2"),
            (None, 2),
            (11, 2),
            (1, 21),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary) / "work"
            for workers, threads in invalid:
                with (
                    self.subTest(workers=workers, threads=threads),
                    patch("refresh_sources._source_identity", side_effect=AssertionError),
                    patch("refresh_sources.prepare_source", side_effect=AssertionError),
                ):
                    config = dict(
                        sources=[dict(quarter="2024-Q1", path="absent")],
                        workRoot=str(work),
                        dayWorkers=workers,
                        polarsThreads=threads,
                    )
                    with self.assertRaises(ValueError):
                        prepare_local_sources(config, "2024-Q1")
                    with self.assertRaises(ValueError):
                        prepare_local_sources(dict(config, sources=[]), "2024-Q1")
                with (
                    patch(
                        "refresh_sources._source_identity", side_effect=AssertionError
                    ) as identity,
                    self.assertRaises(ValueError),
                ):
                    prepare_source({}, work, day_workers=workers, polars_threads=threads)
                identity.assert_not_called()
                self.assertFalse(work.exists())

    def test_execution_options_are_not_accepted_as_source_identity_fields(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            with self.assertRaises(ValueError):
                prepare_source(
                    dict(source, dayWorkers=2, polarsThreads=2),
                    root / "work",
                    allow_projection=True,
                )
            self.assertFalse((root / "work").exists())

    def test_pins_permission_and_public_url_fail_before_outputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            invalid = [
                dict(source, sha256="0" * 64),
                dict(source, sizeBytes=1),
                dict(source, url="https://secret:credential@example.org/source.zip"),
                dict(source, quarter="2024/escape-Q1"),
            ]
            for candidate in invalid:
                with self.assertRaisesRegex(
                    ValueError, "Local source verification/projection failed"
                ):
                    prepare_source(candidate, root / "work", allow_projection=True)
                self.assertFalse((root / "work").exists())
            with self.assertRaises(ValueError):
                prepare_source(source, root / "work")
            self.assertFalse((root / "work").exists())

    def test_interrupted_attempt_is_preserved_and_retry_uses_fresh_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)

            def interrupted(_zip, directory, **_kwargs):
                (directory / "2024-01-01.parquet").write_bytes(b"interrupted private attempt")
                raise RuntimeError("do not echo private configuration")

            with (
                patch("refresh_sources.prepare", side_effect=interrupted),
                self.assertRaises(ValueError),
            ):
                prepare_source(source, root / "work", allow_projection=True)
            failed = next((root / "work").rglob("2024-01-01.parquet"))
            pin = file_sha(failed)
            item = prepare_source(source, root / "work", allow_projection=True)
            self.assertEqual(item.directory.name, "000002")
            self.assertEqual(file_sha(failed), pin)
            self.assertNotEqual(item.directory, failed.parent)
            self.assertEqual(
                hashlib.sha256(Path(source["path"]).read_bytes()).hexdigest(), source["sha256"]
            )

    def test_corrupted_completed_projection_refuses_silent_rebuild(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root)
            item = prepare_source(source, root / "work", allow_projection=True)
            target = item.directory / "2024-01-01.parquet"
            target.write_bytes(b"changed")
            with (
                patch("refresh_sources.prepare", side_effect=AssertionError("must fail closed")),
                self.assertRaises(ValueError),
            ):
                prepare_source(source, root / "work", allow_projection=True)
            self.assertEqual(target.read_bytes(), b"changed")

    def test_missing_calendar_has_no_success_marker(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = archive(root, missing=True)
            with self.assertRaises(ValueError):
                prepare_source(source, root / "work", allow_projection=True)
            self.assertFalse(list((root / "work").rglob("projection.json")))

    def test_future_sources_are_not_opened_and_duplicate_quarters_fail(self):
        config = dict(sources=[dict(quarter="2025-Q1", path="absent")], workRoot="unused")
        with patch("refresh_sources.prepare_source", side_effect=AssertionError("future read")):
            self.assertEqual(prepare_local_sources(config, "2024-Q4"), [])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            prepare_local_sources(dict(config, sources=config["sources"] * 2), "2024-Q4")
