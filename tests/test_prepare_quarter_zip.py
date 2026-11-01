"""Tiny archive tests; no public downloads or retained raw CSV files."""

import hashlib
import json
import os
import stat
import tempfile
import unittest
import warnings
import zipfile
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import polars as pl
import pyarrow.parquet as pq

from parquet_profile import PROFILE_ID, inspect_profile
from prepare_quarter_zip import prepare

HEADER = "date,serial_number,model,capacity_bytes,failure,smart_1_raw\n"
ROW = "2026-04-01,private-serial,ST1000,1000000000000,0,999\n"


class ZipImportTests(unittest.TestCase):
    def make_zip(self, root, entries):
        path = root / "source.zip"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
                for name, content in entries:
                    if isinstance(name, str) and "\\" in name:
                        # ZipInfo's Windows constructor normalizes separators; preserve this unsafe fixture literally.
                        literal = zipfile.ZipInfo()
                        literal.filename = literal.orig_filename = name
                        name = literal
                    archive.writestr(name, content)
        return path

    def test_parallel_matches_serial_bytes_and_exact_selected_members(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            link = zipfile.ZipInfo("2026-04-01.csv")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive = self.make_zip(
                root,
                [
                    ("2026-04-02.csv", HEADER + ROW.replace("2026-04-01", "2026-04-02")),
                    ("2026-04-01.csv", HEADER + ROW),
                    (link, "ignored invalid body; duplicate spelling must not select this member"),
                ],
            )
            serial = prepare(archive, root / "serial")
            environment = dict(os.environ)
            original_digest = hashlib.file_digest
            with patch("prepare_quarter_zip.hashlib.file_digest", wraps=original_digest) as digest:
                parallel = prepare(archive, root / "parallel", day_workers=2, polars_threads=2)
            self.assertEqual(digest.call_count, 1)
            self.assertEqual(dict(os.environ), environment)
            self.assertEqual(parallel, serial)
            self.assertEqual(parallel["dates"], ["2026-04-01", "2026-04-02"])
            for name in ["import-metadata.json", "2026-04-01.parquet", "2026-04-02.parquet"]:
                self.assertEqual(
                    (root / "serial" / name).read_bytes(), (root / "parallel" / name).read_bytes()
                )
            for name in ["2026-04-01.parquet", "2026-04-02.parquet"]:
                self.assertEqual(
                    inspect_profile(root / "serial" / name),
                    inspect_profile(root / "parallel" / name),
                )
            self.assertFalse(list((root / "parallel").glob(".day-workers-*")))

    def test_parallel_failure_invalidates_receipt_and_joins_without_temporary_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW)])
            prepare(archive, root / "out")
            archive = self.make_zip(
                root,
                [
                    ("2026-04-01.csv", HEADER + ROW.replace("2026-04-01", "2026-04-03")),
                    ("2026-04-02.csv", HEADER + ROW.replace("2026-04-01", "2026-04-02")),
                ],
            )
            with self.assertRaisesRegex(ValueError, "could not be read or verified") as caught:
                prepare(archive, root / "out", overwrite=True, day_workers=2)
            self.assertNotIn("private-", str(caught.exception))
            self.assertFalse((root / "out/import-metadata.json").exists())
            self.assertFalse(list((root / "out").glob(".day-workers-*")))
            self.assertFalse(list((root / "out").rglob("*.tmp")))

    def test_parallel_interrupt_stops_and_joins_started_workers(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(
                root,
                [
                    ("2026-04-01.csv", HEADER + ROW),
                    ("2026-04-02.csv", HEADER + ROW.replace("2026-04-01", "2026-04-02")),
                ],
            )
            process = Mock()
            process.poll.return_value = None
            with patch(
                "prepare_quarter_zip.subprocess.Popen", side_effect=[process, KeyboardInterrupt]
            ):
                with self.assertRaises(KeyboardInterrupt):
                    prepare(archive, root / "out", day_workers=2)
            process.terminate.assert_called_once()
            process.wait.assert_called_once_with(timeout=3)
            self.assertFalse((root / "out/import-metadata.json").exists())
            self.assertFalse(list((root / "out").iterdir()))

    def test_invalid_parallel_budget_fails_before_source_or_output_access(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for workers, threads in [
                (True, 2),
                (2, False),
                (0, 2),
                (-1, 2),
                (2, 0),
                (11, 2),
                (2, 1.5),
            ]:
                with self.subTest(workers=workers, threads=threads), self.assertRaises(ValueError):
                    prepare(
                        root / "missing.zip",
                        root / "out",
                        day_workers=workers,
                        polars_threads=threads,
                    )
                self.assertFalse((root / "out").exists())

    def test_projection_private_outputs_and_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(
                root, [("quarter/2026-04-01.csv", HEADER + ROW), ("README.txt", "ignore")]
            )
            metadata = prepare(archive, root / "out", source_url="https://example.org/data.zip")
            frame = pl.read_parquet(root / "out/2026-04-01.parquet")
            self.assertEqual(
                frame.columns,
                ["date", "serial_number", "model", "capacity_bytes", "failure", "datacenter"],
            )
            self.assertEqual(frame.schema["date"], pl.Date)
            self.assertEqual(frame["serial_number"].to_list(), ["private-serial"])
            self.assertEqual(frame["datacenter"].to_list(), [None])
            self.assertEqual(
                metadata["sourceZipSha256"], hashlib.sha256(archive.read_bytes()).hexdigest()
            )
            self.assertEqual(
                (metadata["fileCount"], metadata["rowCount"], metadata["datacenterAvailable"]),
                (1, 1, False),
            )
            self.assertEqual(metadata["dates"], ["2026-04-01"])
            self.assertEqual(metadata["parquetProfile"], PROFILE_ID)
            self.assertNotIn("selectedQuarter", metadata)
            self.assertEqual(
                pq.read_metadata(root / "out/2026-04-01.parquet")
                .metadata[b"backblaze.parquet_profile"]
                .decode(),
                PROFILE_ID,
            )
            receipt = (root / "out/import-metadata.json").read_text()
            self.assertEqual(json.loads(receipt), metadata)
            self.assertNotIn("private-serial", receipt)
            self.assertFalse(list((root / "out").rglob("*.csv")))

    def quarter_entries(self, year=2015, quarter=3):
        start = date(year, (quarter - 1) * 3 + 1, 1)
        end = date(year + (quarter == 4), quarter * 3 % 12 + 1, 1)
        return [
            (f"annual/{day.isoformat()}.csv", HEADER + ROW.replace("2026-04-01", str(day)))
            for offset in range((end - start).days)
            for day in [start + timedelta(days=offset)]
        ]

    def test_annual_selection_reads_only_selected_bodies_and_preserves_source_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            selected = self.quarter_entries()
            selected_names = {name for name, _ in selected}
            start = date(2015, 1, 1)
            outside = [
                (f"annual/{day.isoformat()}.csv", b"\xffpoison CSV body")
                for offset in range(365)
                for day in [start + timedelta(days=offset)]
                if f"annual/{day.isoformat()}.csv" not in selected_names
            ]
            outside.append(("2014-07-01.csv", b"\xffother-year poison"))
            archive = self.make_zip(root, selected + outside)
            original_open = zipfile.ZipFile.open

            def selected_only(archive, member, *args, **kwargs):
                self.assertIn(member.filename, selected_names)
                return original_open(archive, member, *args, **kwargs)

            with patch.object(zipfile.ZipFile, "open", autospec=True, side_effect=selected_only):
                metadata = prepare(
                    archive,
                    root / "out",
                    quarter="2015-Q3",
                    source_url="https://example.org/annual.zip",
                )
            self.assertEqual(metadata["selectedQuarter"], "2015-Q3")
            self.assertEqual(metadata["dates"], [Path(name).stem for name, _ in selected])
            self.assertEqual(metadata["fileCount"], 92)
            self.assertEqual(len(list((root / "out").glob("*.parquet"))), 92)
            self.assertEqual(metadata["sourceUrl"], "https://example.org/annual.zip")
            self.assertEqual(
                metadata["sourceZipSha256"], hashlib.sha256(archive.read_bytes()).hexdigest()
            )
            with zipfile.ZipFile(archive) as source:
                self.assertEqual(
                    [record["memberCrc32"] for record in metadata["files"]],
                    [f"{source.getinfo(name).CRC:08x}" for name, _ in selected],
                )
            self.assertEqual(json.loads((root / "out/import-metadata.json").read_text()), metadata)

    def test_invalid_quarter_and_incomplete_calendar_never_mutate_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output = root / "out"
            output.mkdir()
            receipt = output / "import-metadata.json"
            receipt.write_bytes(b"existing receipt")
            for quarter in ["2015-Q0", "2015-Q5", "15-Q3", "2015-q3", "0000-Q1", "2015-Q3\n"]:
                with self.subTest(quarter=quarter), self.assertRaisesRegex(ValueError, "quarter"):
                    prepare(root / "missing.zip", output, quarter=quarter, overwrite=True)
                self.assertEqual(receipt.read_bytes(), b"existing receipt")
            for entries in [self.quarter_entries()[:-1], [("2015-01-01.csv", "poison")]]:
                archive = self.make_zip(root, entries)
                with (
                    patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("body read")),
                    self.assertRaisesRegex(ValueError, "complete selected quarter"),
                ):
                    prepare(archive, output, quarter="2015-Q3", overwrite=True)
                self.assertEqual(receipt.read_bytes(), b"existing receipt")
                self.assertEqual(list(output.iterdir()), [receipt])
                with self.assertRaises(ValueError):
                    prepare(archive, root / "new", quarter="2015-Q3")
                self.assertFalse((root / "new").exists())

    def test_quarter_selection_does_not_bypass_archive_name_validation(self):
        invalid = [
            [("../2015-01-01.csv", "poison")],
            [("2015-01-01.csv", "poison"), ("other/2015-01-01.csv", "poison")],
            [("2015-07-01.csv", "poison")],
            [("2015-02-30.csv", "poison")],
        ]
        for extra in invalid:
            with self.subTest(extra=extra), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                archive = self.make_zip(root, self.quarter_entries() + extra)
                with (
                    patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("body read")),
                    self.assertRaises(ValueError),
                ):
                    prepare(archive, root / "out", quarter="2015-Q3")
                self.assertFalse((root / "out").exists())

    def test_default_and_explicit_none_keep_output_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW)])
            prepare(archive, root / "out")
            before = {path.name: path.read_bytes() for path in (root / "out").iterdir()}
            prepare(archive, root / "out", quarter=None, overwrite=True)
            self.assertEqual(
                before, {path.name: path.read_bytes() for path in (root / "out").iterdir()}
            )

    def test_selected_members_still_require_schema_dates_and_crc(self):
        for failure in ["schema", "date", "crc"]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                entries = self.quarter_entries()
                name, content = entries[0]
                if failure == "schema":
                    entries[0] = (name, "date\n2015-07-01\n")
                elif failure == "date":
                    entries[0] = (name, content.replace("2015-07-01", "2015-07-02"))
                archive = self.make_zip(root, entries)
                if failure == "crc":
                    archive.write_bytes(
                        archive.read_bytes().replace(b"private-serial", b"damaged-serial", 1)
                    )
                with self.assertRaises(ValueError):
                    prepare(archive, root / "out", quarter="2015-Q3")
                self.assertFalse((root / "out/import-metadata.json").exists())
                self.assertFalse(list((root / "out").glob("*.parquet")))

    def test_selected_leap_quarter_requires_february_29(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(
                root,
                [entry for entry in self.quarter_entries(2016, 1) if "2016-02-29" not in entry[0]],
            )
            with (
                patch.object(zipfile.ZipFile, "open", side_effect=AssertionError("body read")),
                self.assertRaisesRegex(ValueError, "complete selected quarter"),
            ):
                prepare(archive, root / "out", quarter="2016-Q1")
            self.assertFalse((root / "out").exists())

    def test_datacenter_only_when_explicitly_present(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(
                root,
                [
                    (
                        "2026-04-01.csv",
                        HEADER.rstrip() + ",datacenter,vault_id\n" + ROW.rstrip() + ",iad1,17\n",
                    )
                ],
            )
            metadata = prepare(archive, root / "out")
            self.assertTrue(metadata["datacenterAvailable"])
            self.assertEqual(
                pl.read_parquet(root / "out/2026-04-01.parquet")["datacenter"].to_list(), ["iad1"]
            )
            archive = self.make_zip(
                root, [("2026-04-01.csv", HEADER.rstrip() + ",vault_id\n" + ROW.rstrip() + ",17\n")]
            )
            prepare(archive, root / "out", overwrite=True)
            self.assertEqual(
                pl.read_parquet(root / "out/2026-04-01.parquet")["datacenter"].to_list(), [None]
            )

    def test_rejects_unsafe_and_duplicate_daily_members(self):
        for names in [
            ("../2026-04-01.csv",),
            ("/2026-04-01.csv",),
            ("x\\2026-04-01.csv",),
            ("2026-04-01.csv", "other/2026-04-01.csv"),
            ("2026-04-01.csv", "2026-04-01.csv"),
        ]:
            with self.subTest(names=names), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                archive = self.make_zip(root, [(name, HEADER + ROW) for name in names])
                with self.assertRaises(ValueError):
                    prepare(archive, root / "out")
                self.assertFalse((root / "out").exists())

    def test_ignores_hidden_metadata_and_symlinks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            link = zipfile.ZipInfo("link/2026-04-01.csv")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive = self.make_zip(
                root,
                [
                    ("2026-04-01.csv", HEADER + ROW),
                    ("__MACOSX/2026-04-01.csv", "bad"),
                    (".hidden/2026-04-01.csv", "bad"),
                    (link, "target"),
                ],
            )
            self.assertEqual(prepare(archive, root / "out")["fileCount"], 1)

    def test_rejects_required_headers_wrong_dates_and_invalid_values_privately(self):
        contents = [
            "date,serial_number\n2026-04-01,private-serial\n",
            HEADER + ROW.replace("2026-04-01", "2026-04-02"),
            HEADER + ROW.replace("1000000000000", "private-invalid-number"),
        ]
        for content in contents:
            with self.subTest(content=content[:10]), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                archive = self.make_zip(root, [("2026-04-01.csv", content)])
                with self.assertRaises(ValueError) as caught:
                    prepare(archive, root / "out")
                self.assertNotIn("private-", str(caught.exception))
                self.assertFalse((root / "out/import-metadata.json").exists())
                self.assertFalse(list((root / "out").glob("*.tmp")))

    def test_rerun_requires_overwrite_and_failed_overwrite_invalidates_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW)])
            prepare(archive, root / "out")
            with self.assertRaisesRegex(ValueError, "already exists"):
                prepare(archive, root / "out")
            prepare(archive, root / "out", overwrite=True)
            archive = self.make_zip(root, [("2026-04-01.csv", "date\ninvalid\n")])
            with self.assertRaises(ValueError):
                prepare(archive, root / "out", overwrite=True)
            self.assertFalse((root / "out/import-metadata.json").exists())

    def test_crc_failure_never_publishes_success(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW)])
            data = archive.read_bytes()
            archive.write_bytes(data.replace(b"private-serial", b"damaged-serial", 1))
            with self.assertRaisesRegex(ValueError, "could not be read or verified"):
                prepare(archive, root / "out")
            self.assertFalse((root / "out/import-metadata.json").exists())
            self.assertFalse((root / "out/2026-04-01.parquet").exists())

    def test_rejects_unrelated_outputs_and_invalid_source_url(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW)])
            for url in [
                "http://example.org/file",
                "https://user:pass@example.org/file",
                "file:///source.zip",
            ]:
                with self.assertRaisesRegex(ValueError, "HTTPS"):
                    prepare(archive, root / "out", source_url=url)
            (root / "out").mkdir()
            (root / "out/unrelated.parquet").write_bytes(b"keep")
            with self.assertRaisesRegex(ValueError, "unrelated"):
                prepare(archive, root / "out", overwrite=True)
            self.assertEqual((root / "out/unrelated.parquet").read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
