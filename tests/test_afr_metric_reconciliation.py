"""Small fictional observations exercise the unchanged owner XLSX oracle."""

import argparse
import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from copy import deepcopy
from datetime import date
from pathlib import Path

import polars as pl
from test_historical_generator import make_input

from historical_generator import Registry, bounds, quarter
from production_history import generate
from quarterly_afr_xlsx_from_iceberg import (
    _add_drives_deployed_removed_each_qtr,
    _do_quarterly_afr_calculations,
    _generate_output_xlsx,
    _get_smart_drive_model_mappings,
)


class XlsxMetricOracleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # A fails twice then disappears; B departs without failure; R reappears;
        # T only occupies the below-threshold quarter; S crosses boundaries.
        observations = [
            ("2024-01-01", "A", 1),
            ("2024-01-02", "A", 1),
            ("2024-03-31", "B", 0),
            ("2024-03-31", "R", 0),
            ("2024-03-31", "S", 0),
            ("2024-04-01", "T", 0),
            ("2024-07-01", "R", 0),
            ("2024-09-30", "S", 0),
            ("2024-10-01", "S", 0),
            ("2024-12-31", "N", 0),
        ]
        cls.source = pl.DataFrame(
            {
                "date": [date.fromisoformat(row[0]) for row in observations],
                "serial_number": [row[1] for row in observations],
                "failure": [row[2] for row in observations],
                "model": ["ST16000NM001G"] * len(observations),
            }
        ).lazy()
        mapping = _get_smart_drive_model_mappings(
            pl.Series("drive_model_name_smart", ["ST16000NM001G"])
        )
        cls.aggregate = _do_quarterly_afr_calculations(cls.source, mapping)
        cls.display = _add_drives_deployed_removed_each_qtr(
            argparse.Namespace(min_drives=2), cls.source, mapping, cls.aggregate
        )
        cls.rows = cls.display["Seagate"]["ST16000NM001G"]

    def test_repeated_failure_flags_and_observed_quarter_counts(self):
        first = self.aggregate.row(0, named=True)
        self.assertEqual(first["qtr_unique_drives_deployed"], 4)
        self.assertEqual(first["qtr_drive_days"], 5)
        self.assertEqual(first["qtr_failure_count"], 2)

    def test_failed_and_nonfailure_departures_both_retire(self):
        first, returned, newest = self.rows
        self.assertEqual(first["qtr_removed_drives"], 2)
        self.assertEqual(first["failure_count"], 2)
        self.assertEqual(first["qtr_new_drives"], 4)
        self.assertEqual(returned["qtr_new_drives"], 0)
        self.assertEqual(returned["qtr_removed_drives"], 1)
        # S's final observation precedes the latest date, but the newest source
        # quarter overwrites all inferred removals with its zero failure flags.
        self.assertEqual(newest["qtr_removed_drives"], 0)
        self.assertEqual(newest["qtr_new_drives"], 1)

    def test_threshold_filters_display_after_cumulative_accumulation(self):
        self.assertEqual(
            [row["year_quarter"] for row in self.rows], ["2024 Q1", "2024 Q3", "2024 Q4"]
        )
        self.assertAlmostEqual(self.rows[0]["afr"], 2 / 5 * 36500)
        self.assertAlmostEqual(self.rows[1]["afr"], 2 / 8 * 36500)
        self.assertAlmostEqual(self.rows[2]["afr"], 2 / 10 * 36500)

    def test_workbook_literal_cells_subtract_zero_then_prior_retained_row(self):
        output = io.BytesIO()
        _generate_output_xlsx(output, deepcopy(self.display))
        with zipfile.ZipFile(output) as archive:
            sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        cells = {cell.attrib["r"]: cell for cell in sheet.findall(".//s:c", ns)}
        for address, expected in {
            "D6": self.rows[0]["afr"],
            "F6": 4,
            "D7": self.rows[1]["afr"] - self.rows[0]["afr"],
            "F7": -2,
            "F8": 0,
        }.items():
            self.assertIsNone(cells[address].find("s:f", ns))
            value = cells[address].find("s:v", ns)
            self.assertIsNotNone(value)
            assert value is not None and value.text is not None
            self.assertAlmostEqual(float(value.text), expected)

    def test_unqualified_mapped_model_still_controls_global_latest_date(self):
        source = pl.DataFrame(
            {
                "date": [date(2024, 3, 31), date(2024, 3, 31), date(2024, 6, 30)],
                "serial_number": ["A", "B", "C"],
                "failure": [0, 0, 0],
                "model": ["ST16000NM001G", "ST16000NM001G", "ST24000NM002H"],
            }
        ).lazy()
        mapping = _get_smart_drive_model_mappings(
            pl.Series("drive_model_name_smart", ["ST16000NM001G", "ST24000NM002H"])
        )
        aggregate = _do_quarterly_afr_calculations(source, mapping)
        display = _add_drives_deployed_removed_each_qtr(
            argparse.Namespace(min_drives=2), source, mapping, aggregate
        )
        # The one-drive model never displays, but establishes a newer source
        # quarter/date. The earlier qualifying model has two inferred removals
        # rather than receiving the newest-quarter zero-Failed overwrite.
        self.assertNotIn("ST24000NM002H", display["Seagate"])
        self.assertEqual(display["Seagate"]["ST16000NM001G"][0]["qtr_removed_drives"], 2)

    def test_complete_fixture_original_comparison_and_owner_quarterly_dedup_exception(self):
        records = self.source.collect().to_dicts()
        # Raise the same lifecycle example to the production threshold while
        # preserving the failed/departing/reappearing serials and sparse Q2.
        for day in (date(2024, 3, 31), date(2024, 9, 30), date(2024, 12, 31)):
            records.extend(
                dict(date=day, serial_number=f"filler-{number}", failure=0, model="ST16000NM001G")
                for number in range(1998)
            )
        records.extend(
            dict(date=day, serial_number="A", failure=1, model="ST16000NM001G")
            for day in (date(2024, 10, 1), date(2024, 10, 2))
        )
        source = pl.DataFrame(records).lazy()
        mapping = _get_smart_drive_model_mappings(
            pl.Series("drive_model_name_smart", ["ST16000NM001G"])
        )
        oracle = _add_drives_deployed_removed_each_qtr(
            argparse.Namespace(min_drives=2000),
            source,
            mapping,
            _do_quarterly_afr_calculations(source, mapping),
        )["Seagate"]["ST16000NM001G"]
        registry = {
            "version": "fictional-oracle",
            "models": [
                {
                    "vendor": "Seagate",
                    "modelNumber": "ST16000NM001G",
                    "mediaClass": "hdd",
                    "evidence": "Fictional lifecycle example",
                    "aliases": ["ST16000NM001G"],
                }
            ],
        }
        patterns = [r"^Seagate ST16000NM001G$"]
        mid = Registry(registry, patterns).resolve("ST16000NM001G")["modelId"]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = []
            for q in ("2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"):
                daily = {}
                for row in records:
                    day = row["date"]
                    if quarter(day.year * 4 + (day.month - 1) // 3) == q:
                        daily.setdefault((day - bounds(q)[0]).days, []).append(
                            {
                                **row,
                                "date": str(day),
                                "failure": float(row["failure"]),
                                "capacity_bytes": 16e12,
                                "datacenter": "A",
                            }
                        )
                inputs.append(make_input(root, q, daily))

            def produce(version: str, cutoff: str = "2024-Q4"):
                return generate(
                    inputs,
                    cache_root=root / "cache",
                    as_of=cutoff,
                    history_start="2024-Q1",
                    registry=registry,
                    patterns=patterns,
                    generator_revision="fictional-oracle",
                    selection=dict(
                        version="2.0.0",
                        analysisModelIds=[mid],
                        purchaseDefaultModelIds=[],
                        historicalReferenceModelIds=[],
                    ),
                    kind="sample",
                    generated_at="2026-11-01T00:00:00Z",
                    matrix_calculation_version=version,
                )

            index, artifacts, _ = produce("2.1.0")
            legacy_index, legacy_artifacts, _ = produce("2.0.0")
            prefix_index, prefix_artifacts, _ = produce("2.1.0", "2024-Q3")
        descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
        matrix = json.loads(artifacts[descriptor["matrix"]["path"]])
        cells = [cell for cell in matrix["models"][0]["cells"] if cell["status"] == "eligible"]
        self.assertEqual([cell["metrics"]["failed"] for cell in cells], [1, 0, 1])
        # A contributes once in Q1 and once again in Q4: quarter dedup is not
        # lifetime dedup. Terminal Retired remains unknown even with Failed=1.
        self.assertEqual(cells[-1]["cumulativeKnownFailures"], 2)
        self.assertIsNone(cells[-1]["metrics"]["retired"])
        self.assertEqual(cells[-1]["retiredReason"], "right_censored")
        prefix_descriptor = json.loads(
            prefix_artifacts[prefix_index["snapshots"][0]["descriptor"]["path"]]
        )
        prefix = json.loads(prefix_artifacts[prefix_descriptor["matrix"]["path"]])
        prefix_cells = [
            cell for cell in prefix["models"][0]["cells"] if cell["status"] == "eligible"
        ]
        # A and B last appear in Q1 at the earlier cutoff. Later A reentry
        # removes A from that quarter's Retired; B's nonfailure departure remains.
        self.assertEqual(prefix_cells[0]["metrics"]["retired"], 2)
        self.assertEqual(cells[0]["metrics"]["retired"], 1)
        self.assertEqual(cells[1]["metrics"]["retired"], 1)
        self.assertIsNone(prefix_cells[-1]["metrics"]["retired"])
        legacy_descriptor = json.loads(
            legacy_artifacts[legacy_index["snapshots"][0]["descriptor"]["path"]]
        )
        legacy = json.loads(legacy_artifacts[legacy_descriptor["matrix"]["path"]])
        legacy_cells = [
            cell for cell in legacy["models"][0]["cells"] if cell["status"] == "eligible"
        ]
        self.assertEqual([cell["metrics"]["failed"] for cell in legacy_cells], [2, 0, 2])
        self.assertEqual(legacy_cells[-1]["cumulativeKnownFailures"], 4)
        self.assertEqual(legacy_cells[-1]["metrics"]["retired"], 2)
        for expected, old in zip(oracle, legacy_cells, strict=True):
            self.assertAlmostEqual(old["metrics"]["observedRecordedAfr"], expected["afr"])
        self.assertEqual(legacy_cells[0]["metrics"]["populationDelta"], 0)
        self.assertEqual(legacy_cells[0]["metrics"]["observedRecordedAfrDelta"], 0)
        previous_afr, previous_count = 0.0, 0
        for expected, actual in zip(oracle, cells, strict=True):
            metrics = actual["metrics"]
            self.assertAlmostEqual(metrics["observedRecordedAfr"], expected["afr"] / 2)
            self.assertAlmostEqual(
                metrics["observedRecordedAfrDelta"], expected["afr"] / 2 - previous_afr
            )
            self.assertEqual(metrics["count"], expected["unique_drives_deployed"])
            self.assertEqual(
                metrics["populationDelta"], expected["unique_drives_deployed"] - previous_count
            )
            self.assertEqual(metrics["new"], expected["qtr_new_drives"])
            self.assertEqual(
                metrics["retired"],
                None if expected["year_quarter"] == "2024 Q4" else expected["qtr_removed_drives"],
            )
            self.assertEqual(metrics["failed"], expected["failure_count"] // 2)
            previous_afr, previous_count = expected["afr"] / 2, expected["unique_drives_deployed"]


if __name__ == "__main__":
    unittest.main()
