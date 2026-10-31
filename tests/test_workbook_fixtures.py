"""Offline golden checks; optional byte parity when ignored XLSXs are present."""
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import statistics
import tempfile
import unittest

from tools.extract_workbook_fixtures import (
    METRICS, SOURCES, build, extract, percentile, range_cells, revisions, serialized,
)

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures/workbooks"


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def cells(snapshot):
    return {address: raw for model in snapshot["models"] for row in model["rows"]
            for address, raw in row["cells"]}


class WorkbookFixturesTests(unittest.TestCase):
    def setUp(self):
        self.snapshots = [load(f"{snapshot}.json") for snapshot in SOURCES]

    def test_complete_model_values_and_unknown_blanks(self):
        for snapshot, retained_count, height in zip(self.snapshots, (307, 325), (27, 28)):
            self.assertEqual(snapshot["metrics"], METRICS)
            self.assertEqual(len(snapshot["models"]), 19)
            self.assertEqual(snapshot["source"]["sha256"], SOURCES[snapshot["snapshot"]])
            self.assertEqual(snapshot["purpose"], "reference_only_not_production_matrix")
            self.assertEqual(snapshot["pane"]["topLeftCell"], "C6")
            self.assertEqual(snapshot["calendar_mapping"], "unknown")
            observed = 0
            for model in snapshot["models"]:
                self.assertEqual(len(model["rows"]), height)
                has_blank = False
                for ordinal, row in enumerate(model["rows"], 1):
                    self.assertEqual(row["sheet_row"], ordinal + 5)
                    self.assertEqual(row["display_ordinal"], ordinal)
                    self.assertEqual(row["display_year"], (ordinal - 1) // 4 + 1)
                    self.assertEqual(row["display_quarter"], (ordinal - 1) % 4 + 1)
                    self.assertIsNone(row["calendar_quarter"])
                    self.assertIsNone(row["exposure_drive_days"])
                    self.assertEqual(len(row["cells"]), 7)
                    if row["status"] == "retained":
                        self.assertFalse(has_blank)
                        self.assertEqual(row["retained_ordinal"], ordinal)
                        observed += 1
                        for index, (address, raw) in enumerate(row["cells"]):
                            self.assertTrue(address.endswith(str(ordinal + 5)))
                            self.assertTrue(Decimal(raw).is_finite())
                            if index >= 2:
                                self.assertEqual(Decimal(raw), int(raw))
                        self.assertGreaterEqual(int(row["cells"][2][1]), 2000)
                    else:
                        has_blank = True
                        self.assertEqual(row["status"], "trailing_blank_unknown")
                        self.assertIsNone(row["retained_ordinal"])
                        self.assertTrue(all(raw is None for _, raw in row["cells"]))
            self.assertEqual(observed, retained_count)

    def test_reference_deltas_and_first_row_initialization(self):
        for snapshot in self.snapshots:
            for model in snapshot["models"]:
                prior_afr = Decimal(0)
                prior_count = 0
                for row in model["rows"]:
                    if row["status"] != "retained":
                        continue
                    afr, delta, count, count_delta, *_ = [raw for _, raw in row["cells"]]
                    self.assertLessEqual(abs(Decimal(afr) - prior_afr - Decimal(delta)), Decimal("1e-14"))
                    self.assertEqual(int(count) - prior_count, int(count_delta))
                    prior_afr, prior_count = Decimal(afr), int(count)

    def test_all_shared_domains_and_raw_thresholds(self):
        expected_rules = [
            (["min", "num", "num"], ["#00FF00", "#FFFF00", "#FF0000"]),
            (["min", "num", "max"], ["#00FF00", "#FFFFFF", "#FF0000"]),
            (["min", "percentile", "max"], ["#FF0000", "#FFFF00", "#00FF00"]),
            (["min", "num", "max"], ["#FF0000", "#FFFFFF", "#00FF00"]),
            (["num", "max"], ["#FFFFFF", "#00FF00"]),
            (["num", "percentile", "max"], ["#00FF00", "#FFFF00", "#FF0000"]),
            (["min", "percentile", "max"], ["#00FF00", "#FFFF00", "#FF0000"]),
        ]
        for snapshot in self.snapshots:
            values = cells(snapshot)
            self.assertEqual(len(snapshot["color_rules"]), 7)
            for metric_index, (rule, (types, colors)) in enumerate(zip(snapshot["color_rules"], expected_rules)):
                self.assertEqual(rule["metric"], METRICS[metric_index])
                self.assertEqual(len(rule["scope"]), 19)
                addresses = [a for ref in rule["scope"] for a in range_cells(ref)]
                expected_addresses = [row["cells"][metric_index][0] for model in snapshot["models"] for row in model["rows"]]
                self.assertEqual(addresses, expected_addresses)
                numeric = [Decimal(values[a]) for a in addresses if values[a] is not None]
                self.assertEqual(Decimal(rule["minimum"]), min(numeric))
                self.assertEqual(Decimal(rule["median"]), statistics.median(numeric))
                self.assertEqual(Decimal(rule["maximum"]), max(numeric))
                self.assertEqual(rule["numeric_count"], len(numeric))
                self.assertEqual(rule["blank_count"], len(addresses) - len(numeric))
                self.assertEqual([s["type"] for s in rule["stops"]], types)
                self.assertEqual([s["css_color"] for s in rule["stops"]], colors)
                for stop in rule["stops"]:
                    expected = {"min": min(numeric), "max": max(numeric),
                                "percentile": statistics.median(numeric)}.get(stop["type"], Decimal(stop["raw_value"]))
                    self.assertEqual(Decimal(stop["resolved_value"]), expected)
            new_low = snapshot["color_rules"][4]["stops"][0]
            self.assertEqual(new_low["raw_argb"], "FFFFFFFFF")
            self.assertEqual(new_low["normalization"], "owner_screenshot_intended_white")
        self.assertEqual(self.snapshots[0]["color_rules"][2]["maximum"], "40322")
        self.assertEqual(self.snapshots[1]["color_rules"][2]["maximum"], "44425")

    def test_percentile_interpolation_not_midrange(self):
        values = list(map(Decimal, [0, 2, 10, 100]))
        self.assertEqual(percentile(values, Decimal(50)), 6)
        self.assertEqual(percentile(values, Decimal(25)), Decimal("1.5"))
        self.assertEqual(percentile([Decimal(7)], Decimal(50)), 7)
        with self.assertRaises(ValueError):
            percentile([], Decimal(50))

    def test_all_twenty_two_existing_revisions(self):
        expected = load("revisions.json")
        self.assertEqual(revisions(*self.snapshots), expected)
        self.assertEqual(len(expected["changes"]), 22)
        self.assertEqual({r["metric"] for r in expected["changes"]}, {"retired"})
        lookup = {r["cell"]: (r["before"], r["after"]) for r in expected["changes"]}
        self.assertEqual(lookup["CN6"], ("4", "3"))
        self.assertEqual(lookup["BL21"], ("16", "30"))
        old_lengths = {m["model"]: sum(r["status"] == "retained" for r in m["rows"]) for m in self.snapshots[0]["models"]}
        for model in self.snapshots[1]["models"]:
            expected_growth = 0 if model["model"] == "ST12000NM0007" else 1
            self.assertEqual(sum(r["status"] == "retained" for r in model["rows"]), old_lengths[model["model"]] + expected_growth)

    def test_eight_owner_stories_nine_models_and_critical_cells(self):
        stories = load("owner-stories.json")["stories"]
        self.assertEqual(len(stories), 8)
        self.assertEqual(len({model for story in stories for model in story["models"]}), 9)
        for story in stories:
            self.assertEqual(len(story["evidence"]), len(story["models"]) * 2)
            for evidence in story["evidence"]:
                snapshot = next(s for s in self.snapshots if s["snapshot"] == evidence["snapshot"])
                model = next(m for m in snapshot["models"] if m["model"] == evidence["model"])
                self.assertEqual(evidence["retained_rows"], sum(r["status"] == "retained" for r in model["rows"]))
        q3, q4 = map(cells, self.snapshots)
        self.assertEqual(q3["C6"], "2.005727880425647")
        self.assertEqual(q3["AZ6"], "3.570438723771948")
        self.assertEqual(q3["BF6"], "0")
        self.assertEqual(q3["CB6"], "0")
        self.assertIsNone(q3["CB7"])
        self.assertGreater(Decimal(q4["CB7"]), 0)
        self.assertGreater(Decimal(q4["AL9"]), Decimal(q4["AL6"]))
        self.assertGreater(int(q4["AN9"]), int(q4["AN6"]))
        self.assertEqual((q4["H19"], q4["H20"]), ("9514", "10039"))
        self.assertEqual(q4["EA14"], "44425")

    def test_deterministic_canonical_serialization(self):
        for path in FIXTURES.glob("*.json"):
            self.assertEqual(path.read_bytes(), serialized(load(path.name)).encode("utf-8"))

    def test_changed_source_cannot_replace_golden_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2025-Q3_quarterly_afr.xlsx"
            path.write_bytes(b"different source bytes")
            with self.assertRaisesRegex(ValueError, "Source hash mismatch"):
                extract(path, "2025-Q3")

    def test_optional_local_source_parity_and_unchanged_hashes(self):
        source_dir = ROOT / "data/references"
        if not all((source_dir / f"{snapshot}_quarterly_afr.xlsx").exists() for snapshot in SOURCES):
            self.skipTest("Ignored owner XLSXs absent; offline fixture checks still run")
        for filename, value in build(source_dir).items():
            self.assertEqual(serialized(value).encode("utf-8"), (FIXTURES / filename).read_bytes())
        for snapshot, expected in SOURCES.items():
            self.assertEqual(hashlib.sha256((source_dir / f"{snapshot}_quarterly_afr.xlsx").read_bytes()).hexdigest(), expected)


if __name__ == "__main__":
    unittest.main()
