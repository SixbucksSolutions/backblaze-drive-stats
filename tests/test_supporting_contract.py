"""Tiny aggregate golden cases for the proposed supporting-history contract."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
import tempfile

from jsonschema import ValidationError

from tools.validate_supporting_contract import load_supporting, validate_supporting

ROOT = Path(__file__).resolve().parents[1]


class SupportingContractTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((ROOT / "fixtures/supporting/synthetic-history.json").read_text(encoding="utf-8"))

    def test_golden_scopes_counts_units_and_coverage(self):
        validate_supporting(self.fixture)
        first, second, missing, incomplete, zero, unknown_capacity = self.fixture["quarters"]
        selected, full = first["scopes"]
        self.assertEqual(selected["totals"], {"driveCount": 2500, "newDrives": 2500, "capacityTb": 38000})
        self.assertEqual(selected["models"][1]["measures"]["driveCount"], 500)
        self.assertEqual(full["totals"]["capacityTb"], 38040)
        self.assertEqual(second["scopes"][0]["capacityDeltaTb"], 16000)
        self.assertEqual(second["scopes"][1]["capacityDeltaTb"], 16010)
        self.assertAlmostEqual(second["scopes"][1]["knownLocationShare"], 3500 / 3550)
        self.assertEqual([missing["coverage"], incomplete["coverage"]], ["missing", "incomplete"])
        self.assertEqual(zero["scopes"][0]["totals"]["driveCount"], 0)
        self.assertIsNone(zero["scopes"][0]["capacityDeltaTb"])
        self.assertEqual(unknown_capacity["scopes"][0]["totals"]["driveCount"], 2000)
        self.assertIsNone(unknown_capacity["scopes"][0]["totals"]["capacityTb"])

    def test_rejects_wrong_totals_shares_locations_and_gap_delta(self):
        mutations = [
            lambda f: f["quarters"][0]["scopes"][0]["totals"].update(driveCount=2000),
            lambda f: f["quarters"][0]["scopes"][0]["manufacturers"][0].update(populationShare=0.5),
            lambda f: f["quarters"][1]["scopes"][1].update(knownLocationShare=1),
            lambda f: f["quarters"][4]["scopes"][0].update(capacityDeltaTb=-54000, capacityDeltaReason=None),
            lambda f: f["quarters"].pop(2),
            lambda f: f["quarters"][2]["scopes"][0]["totals"].update(driveCount=0),
            lambda f: f["quarters"][0]["scopes"][0]["models"].append(deepcopy(f["quarters"][0]["scopes"][0]["models"][0])),
            lambda f: f["provenance"].update(historyStart="2024-04-01"),
            lambda f: f["provenance"].update(historyStart="2023-10-01"),
            lambda f: f["provenance"].update(historyStart="2024-01-02"),
            lambda f: f["provenance"].update(sourceUrl="https://user:secret@example.com/data?token=secret"),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutations.index(mutate)):
                malformed = deepcopy(self.fixture)
                mutate(malformed)
                with self.assertRaises(ValueError):
                    validate_supporting(malformed)

    def test_integer_reconciliation_is_exact_at_large_counts(self):
        malformed = deepcopy(self.fixture)
        full = malformed["quarters"][0]["scopes"][1]
        # This discrepancy is well inside a relative float tolerance at this scale.
        full["models"][0]["measures"]["driveCount"] = 8_000_000_000_000_000
        full["totals"]["driveCount"] = 8_000_000_000_000_541
        with self.assertRaisesRegex(ValueError, "model total mismatch"):
            validate_supporting(malformed)

    def test_integer_valued_float_counts_also_reconcile_exactly(self):
        malformed = deepcopy(self.fixture)
        def scale(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key in ("driveCount", "newDrives") and item is not None:
                        value[key] = float(item * 10**9)
                    else:
                        scale(item)
            elif isinstance(value, list):
                for item in value:
                    scale(item)
        scale(malformed)
        malformed["quarters"][0]["scopes"][0]["totals"]["driveCount"] += 1
        with self.assertRaisesRegex(ValueError, "model total mismatch"):
            validate_supporting(malformed)

    def test_rejects_private_fields_and_invalid_numbers(self):
        malformed = deepcopy(self.fixture)
        malformed["quarters"][0]["scopes"][0]["models"][0]["serial_number"] = "not-public"
        with self.assertRaises(ValidationError):
            validate_supporting(malformed)
        malformed = deepcopy(self.fixture)
        malformed["quarters"][0]["scopes"][0]["totals"]["capacityTb"] = float("inf")
        with self.assertRaises(ValueError):
            validate_supporting(malformed)

    def test_strict_loader_rejects_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"schemaVersion": 1, "schemaVersion": 2}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
                load_supporting(path)

    def test_seed_plus_discovery_cohort_is_explicit_and_not_silently_filtered(self):
        self.assertEqual(self.fixture["provenance"]["seedAsOfQuarter"], "2025-Q4")
        self.assertEqual(self.fixture["provenance"]["discoveryRule"], "all_source_hdd_complete_quarter_ge_2000")
        malformed = deepcopy(self.fixture)
        malformed["provenance"]["selectedModelIds"].remove("SAMPLE-HDD-B")
        with self.assertRaisesRegex(ValueError, "outside resolved discovery cohort"):
            validate_supporting(malformed)
        malformed = deepcopy(self.fixture)
        # A resolved model present in all-source data cannot be omitted by a
        # seed-only view while its locally adjusted totals still reconcile.
        malformed["provenance"]["selectedModelIds"].append("SAMPLE-SSD")
        with self.assertRaisesRegex(ValueError, "silently omitted"):
            validate_supporting(malformed)

    def test_selected_cohort_retains_all_canonical_alias_observations(self):
        malformed = deepcopy(self.fixture)
        selected = malformed["quarters"][0]["scopes"][0]
        selected["models"][0]["measures"]["newDrives"] -= 1
        selected["totals"]["newDrives"] -= 1
        selected["manufacturers"][0]["measures"]["newDrives"] -= 1
        with self.assertRaisesRegex(ValueError, "all canonical alias observations"):
            validate_supporting(malformed)


if __name__ == "__main__":
    unittest.main()
