"""Tiny archive tests; no public downloads or retained raw CSV files."""
import hashlib
import json
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
import zipfile

import polars as pl

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

    def test_projection_private_outputs_and_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("quarter/2026-04-01.csv", HEADER + ROW), ("README.txt", "ignore")])
            metadata = prepare(archive, root / "out", source_url="https://example.org/data.zip")
            frame = pl.read_parquet(root / "out/2026-04-01.parquet")
            self.assertEqual(frame.columns, ["date", "serial_number", "model", "capacity_bytes", "failure", "datacenter"])
            self.assertEqual(frame.schema["date"], pl.Date)
            self.assertEqual(frame["serial_number"].to_list(), ["private-serial"])
            self.assertEqual(frame["datacenter"].to_list(), [None])
            self.assertEqual(metadata["sourceZipSha256"], hashlib.sha256(archive.read_bytes()).hexdigest())
            self.assertEqual((metadata["fileCount"], metadata["rowCount"], metadata["datacenterAvailable"]), (1, 1, False))
            self.assertEqual(metadata["dates"], ["2026-04-01"])
            receipt = (root / "out/import-metadata.json").read_text()
            self.assertEqual(json.loads(receipt), metadata)
            self.assertNotIn("private-serial", receipt)
            self.assertFalse(list((root / "out").rglob("*.csv")))

    def test_datacenter_only_when_explicitly_present(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER.rstrip() + ",datacenter,vault_id\n" + ROW.rstrip() + ",iad1,17\n")])
            metadata = prepare(archive, root / "out")
            self.assertTrue(metadata["datacenterAvailable"])
            self.assertEqual(pl.read_parquet(root / "out/2026-04-01.parquet")["datacenter"].to_list(), ["iad1"])
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER.rstrip() + ",vault_id\n" + ROW.rstrip() + ",17\n")])
            prepare(archive, root / "out", overwrite=True)
            self.assertEqual(pl.read_parquet(root / "out/2026-04-01.parquet")["datacenter"].to_list(), [None])

    def test_rejects_unsafe_and_duplicate_daily_members(self):
        for names in [("../2026-04-01.csv",), ("/2026-04-01.csv",), ("x\\2026-04-01.csv",),
                      ("2026-04-01.csv", "other/2026-04-01.csv"), ("2026-04-01.csv", "2026-04-01.csv")]:
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
            archive = self.make_zip(root, [("2026-04-01.csv", HEADER + ROW),
                ("__MACOSX/2026-04-01.csv", "bad"), (".hidden/2026-04-01.csv", "bad"), (link, "target")])
            self.assertEqual(prepare(archive, root / "out")["fileCount"], 1)

    def test_rejects_required_headers_wrong_dates_and_invalid_values_privately(self):
        contents = ["date,serial_number\n2026-04-01,private-serial\n", HEADER + ROW.replace("2026-04-01", "2026-04-02"),
                    HEADER + ROW.replace("1000000000000", "private-invalid-number")]
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
            for url in ["http://example.org/file", "https://user:pass@example.org/file", "file:///source.zip"]:
                with self.assertRaisesRegex(ValueError, "HTTPS"):
                    prepare(archive, root / "out", source_url=url)
            (root / "out").mkdir()
            (root / "out/unrelated.parquet").write_bytes(b"keep")
            with self.assertRaisesRegex(ValueError, "unrelated"):
                prepare(archive, root / "out", overwrite=True)
            self.assertEqual((root / "out/unrelated.parquet").read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
