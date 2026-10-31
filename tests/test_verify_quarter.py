"""One-quarter audit probes with tiny invented, private local partitions."""

import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import polars as pl

from historical_generator import QuarterInput, Registry, bounds, file_sha
from parquet_profile import PROFILE_ID, write_enriched_parquet
from tools.verify_quarter import audit, check_receipt, forbid_daily_reads


class QuarterAuditTests(unittest.TestCase):
    def fixture(self, root):
        directory = root / "daily"
        directory.mkdir()
        archive = root / "source.zip"
        archive.write_bytes(b"invented source archive identity")
        source_hash = file_sha(archive)
        records = []
        first, last = bounds("2026-Q1")
        schema = {
            "date": pl.Date,
            "serial_number": pl.String,
            "model": pl.String,
            "capacity_bytes": pl.Int64,
            "failure": pl.Int64,
            "datacenter": pl.String,
        }
        for number in range((last - first).days + 1):
            day = first + timedelta(days=number)
            observations = (
                [(day, "private-test-serial", "MYSTERY", 1000, int(number == 1), None)]
                if number < 2
                else []
            )
            frame = pl.DataFrame(observations, schema=schema, orient="row")
            name = str(day) + ".parquet"
            write_enriched_parquet(
                frame,
                directory / name,
                kind="daily_projection",
                lineage={"sourceZipSha256": source_hash, "partition": str(day)},
            )
            records.append(dict(date=str(day), outputFile=name, rowCount=frame.height))
        receipt: dict = dict(
            schemaVersion=1,
            parquetProfile=PROFILE_ID,
            sourceZipSha256=source_hash,
            fileCount=len(records),
            rowCount=2,
            dates=[r["date"] for r in records],
            files=records,
        )
        (directory / "import-metadata.json").write_text(json.dumps(receipt), encoding="utf-8")
        return QuarterInput("2026-Q1", directory), archive, receipt

    def test_calendar_numerics_inventory_and_guarded_reuse(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            item, archive, _ = self.fixture(root)
            registry = Registry(dict(version="test", models=[]), [])
            report = audit(item, root / "cache", registry, archive)
            self.assertEqual((report["expectedDays"], report["observedDays"]), (90, 90))
            self.assertFalse(report["firstPassCacheHit"])
            self.assertTrue(report["warmCacheHit"])
            model = report["inventory"][0]
            self.assertEqual((model["count"], model["driveDays"], model["failures"]), (1, 2, 1))
            self.assertEqual(model["quarterAfr"], 18250)
            self.assertEqual(
                (model["rawNames"], model["mediaClass"], model["seedMatch"]),
                (["MYSTERY"], "unclassified", False),
            )
            self.assertNotIn("private-test-serial", json.dumps(report))
            # Any fallback to logical daily reads during an existing-cache audit fails.
            with patch.object(pl, "scan_parquet", side_effect=AssertionError("daily scan")):
                reused = audit(item, root / "cache", registry, archive)
            self.assertTrue(reused["firstPassCacheHit"])

    def test_missing_day_wrong_quarter_receipt_and_source_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            item, archive, receipt = self.fixture(root)
            path = item.directory / "import-metadata.json"
            with self.assertRaisesRegex(ValueError, "coverage"):
                check_receipt(QuarterInput("2026-Q2", item.directory), archive)
            removed = receipt["files"].pop()
            path.write_text(json.dumps(receipt), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "coverage"):
                check_receipt(item, archive)
            receipt["files"].append(removed)
            receipt["rowCount"] = 3
            path.write_text(json.dumps(receipt), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "total row count"):
                check_receipt(item, archive)
            archive.write_bytes(b"changed source")
            with self.assertRaisesRegex(ValueError, "ZIP hash"):
                check_receipt(item, archive)

    def test_warm_guard_rejects_both_daily_dataframe_apis(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            with forbid_daily_reads(directory):
                for operation in (pl.read_parquet, pl.scan_parquet):
                    with self.assertRaisesRegex(RuntimeError, "forbids daily"):
                        operation(directory / "day.parquet")

    def test_partition_observation_date_cannot_fake_full_calendar(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            item, archive, _ = self.fixture(root)
            path = item.directory / "2026-01-01.parquet"
            frame = pl.read_parquet(path).with_columns(
                pl.lit(bounds("2026-Q1")[0] + timedelta(days=1)).alias("date")
            )
            write_enriched_parquet(
                frame,
                path,
                kind="daily_projection",
                lineage={"sourceZipSha256": file_sha(archive), "partition": "2026-01-01"},
            )
            with self.assertRaisesRegex(
                ValueError, "Receipt row count|Invalid required observation"
            ):
                audit(item, root / "cache", Registry(dict(version="test", models=[]), []), archive)


if __name__ == "__main__":
    unittest.main()
