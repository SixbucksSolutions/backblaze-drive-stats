"""Small synthetic tests; never fetch or process the public dataset."""
from datetime import date, timedelta
import json
from pathlib import Path
import tempfile
import unittest

import polars as pl

from export_quarterly_web_data import build_bundle, export, prepare_source, quarter_bounds


def fixture() -> pl.DataFrame:
    rows = []
    day = date(2024, 1, 1)
    while day <= date(2024, 6, 30):
        rows.append({"date": day, "serial_number": "private-A", "model": "ST1000", "capacity_bytes": 10**12, "failure": 0, "datacenter": "iad1"})
        day += timedelta(days=1)
    rows.extend([
        {"date": date(2024, 3, 30), "serial_number": "private-B", "model": "Seagate ST1000", "capacity_bytes": -1, "failure": 0, "datacenter": "ams1"},
        {"date": date(2024, 3, 31), "serial_number": "private-B", "model": "ST1000", "capacity_bytes": 10**12, "failure": 1, "datacenter": "iad1"},
        {"date": date(2024, 4, 1), "serial_number": "private-C", "model": "TOSHIBA MG01", "capacity_bytes": 2*10**12, "failure": 1, "datacenter": None},
    ])
    # Future observations must not alter Q1/Q2 capacity or last-seen metrics.
    for offset in range(200):
        rows.append({"date": date(2024, 7, 1) + timedelta(days=offset), "serial_number": "private-A", "model": "ST1000", "capacity_bytes": 9*10**12, "failure": 0, "datacenter": "iad1"})
    return pl.DataFrame(rows)


class ExportTests(unittest.TestCase):
    def test_reconciles_population_and_cutoff(self):
        source = prepare_source(fixture().lazy())
        q1 = build_bundle(source, "2024-Q1", kind="sample")
        model = q1["models"][0]
        self.assertEqual((model["driveCount"], model["driveDays"], model["failures"]), (2, 93, 1))
        self.assertEqual((model["capacityTb"], model["newDrives"], model["lastObservedDrives"]), (1, 2, 0))
        self.assertAlmostEqual(model["quarterlyAfr"], 36500 / 93)
        self.assertEqual(q1["provenance"]["coverageEnd"], "2024-03-31")
        self.assertEqual(q1["capacityByDatacenter"], [{"datacenter": "IAD1", "capacityTb": 2.0, "driveCount": 2}])
        q2 = build_bundle(source, "2024-Q2")
        self.assertEqual(sum(m["driveCount"] for m in q2["models"]), 2)
        self.assertEqual(sum(d["driveCount"] for d in q2["capacityByDatacenter"]), 2)
        self.assertEqual(sum(d["capacityTb"] for d in q2["capacityByDatacenter"]), 3)
        self.assertEqual(sum(m["lastObservedDrives"] for m in q2["models"]), 1)
        seagate = next(m for m in q2["models"] if m["manufacturer"] == "Seagate")
        self.assertAlmostEqual(seagate["cumulativeAfr"], 36500 / 184)
        self.assertEqual(q2["history"][0]["driveCount"], 2)
        self.assertEqual(q2["history"][1]["newDrives"], 1)

    def test_parquet_export_manifest_and_privacy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            parquet = root / "source.parquet"
            fixture().write_parquet(parquet)
            self.assertEqual(export(pl.scan_parquet(parquet), "2024-Q2", root / "out", kind="sample"), ["2024-Q1", "2024-Q2"])
            manifest = json.loads((root / "out/index.json").read_text())
            self.assertEqual(manifest["schemaVersion"], 1)
            self.assertEqual(manifest["quarters"][0], {"quarter": "2024-Q2", "label": "2024 Q2", "url": "2024-Q2.json", "kind": "sample"})
            q1 = json.loads((root / "out/2024-Q1.json").read_text())
            notes = " ".join(q1["provenance"]["notes"])
            self.assertIn("all supplied source models are included, including boot drives if present", notes)
            self.assertIn("not asserted to match the eligibility criteria", notes)
            self.assertIn("newDrives includes the initial observed fleet", notes)
            for path in (root / "out").glob("*.json"):
                content = path.read_text()
                self.assertNotIn("private-", content)
                self.assertNotIn("serial_number", content)
                self.assertNotIn("NaN", content)

    def test_rejects_incomplete_missing_day_and_invalid_quarter(self):
        with self.assertRaises(ValueError):
            quarter_bounds("2024-Q5")
        with self.assertRaisesRegex(ValueError, "kind must"):
            build_bundle(fixture().lazy(), "2024-Q1", kind="invalid")
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "kind must"):
                export(fixture().lazy(), "2024-Q1", Path(folder), kind="invalid")
        source = fixture().filter(pl.col("date") != date(2024, 2, 2))
        with self.assertRaisesRegex(ValueError, "missing calendar"):
            build_bundle(prepare_source(source.lazy()), "2024-Q1")
        with self.assertRaisesRegex(ValueError, "complete requested"):
            build_bundle(prepare_source(fixture().lazy()), "2025-Q1")

    def test_rejects_duplicate_invalid_failure_and_unknown_capacity(self):
        frame = fixture()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            prepare_source(pl.concat([frame, frame.head(1)]).lazy())
        with self.assertRaisesRegex(ValueError, "invalid required"):
            prepare_source(frame.with_columns(pl.lit(0.5).alias("failure")).lazy())
        source = prepare_source(frame.with_columns(pl.lit(-1).alias("capacity_bytes")).lazy())
        with self.assertRaisesRegex(ValueError, "no positive finite capacity"):
            build_bundle(source, "2024-Q1")

    def test_failed_export_preserves_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.json").write_text("previous")
            frame = fixture().filter(pl.col("date") != date(2024, 5, 1))
            with self.assertRaises(ValueError):
                export(frame.lazy(), "2024-Q2", root)
            self.assertEqual((root / "index.json").read_text(), "previous")
            self.assertFalse((root / "2024-Q1.json").exists())

    def test_consistent_filter_and_from_quarter(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            export(fixture().lazy(), "2024-Q2", root, from_quarter="2024-Q2", patterns=["ST1000"])
            bundle = json.loads((root / "2024-Q2.json").read_text())
            notes = " ".join(bundle["provenance"]["notes"])
            self.assertIn('Model-selection regex filters applied to source model names: ["ST1000"]', notes)
            self.assertNotIn("No model-selection filters", notes)
            self.assertNotIn("Supplied history starts in this reporting quarter", notes)
            self.assertFalse((root / "2024-Q1.json").exists())
            self.assertEqual(len(bundle["models"]), 1)
            self.assertEqual(bundle["history"][0]["driveDays"], 93)
            self.assertEqual(bundle["history"][1]["driveDays"], 91)
            self.assertEqual(sum(d["driveCount"] for d in bundle["capacityByDatacenter"]), 1)

    def test_capacity_tie_missing_datacenter_and_string_dates(self):
        rows = []
        for offset in range(91):
            for serial, capacity in [("a", 10**12), ("b", 2*10**12)]:
                rows.append({"date": (date(2024, 1, 1) + timedelta(days=offset)).isoformat(), "model": "ST1000", "serial_number": serial, "capacity_bytes": capacity, "failure": 0})
        bundle = build_bundle(prepare_source(pl.DataFrame(rows).lazy()), "2024-Q1")
        self.assertEqual(bundle["models"][0]["capacityTb"], 1)
        self.assertEqual(bundle["capacityByDatacenter"], [{"datacenter": "Unknown", "capacityTb": 2.0, "driveCount": 2}])

    def test_future_invalid_records_do_not_block_prior_cutoff(self):
        frame = fixture().with_columns(pl.col("failure").cast(pl.String))
        bad = frame.filter(pl.col("date") == date(2024, 7, 1)).with_columns(
            pl.lit("not-a-number").alias("failure"), pl.lit(None, dtype=pl.String).alias("model")
        )
        frame = pl.concat([frame, bad, frame.filter(pl.col("date") == date(2024, 7, 1))])
        with tempfile.TemporaryDirectory() as folder:
            export(frame.lazy(), "2024-Q2", Path(folder))
            bundle = json.loads((Path(folder) / "2024-Q1.json").read_text())
            self.assertEqual(bundle["models"][0]["driveDays"], 93)
            self.assertEqual(bundle["models"][0]["capacityTb"], 1)

    def test_raw_source_passes_do_not_grow_with_quarter_count(self):
        counts = []
        for cutoff in ["2024-Q1", "2024-Q2"]:
            calls = []

            def record_batch(batch):
                calls.append(1)
                return batch

            frame = fixture()
            source = frame.lazy().map_batches(record_batch, schema=frame.schema,
                predicate_pushdown=False, projection_pushdown=False, slice_pushdown=False)
            with tempfile.TemporaryDirectory() as folder:
                export(source, cutoff, Path(folder))
            counts.append(len(calls))
        self.assertEqual(counts[0], counts[1])
        self.assertLessEqual(counts[1], 6)


if __name__ == "__main__":
    unittest.main()
