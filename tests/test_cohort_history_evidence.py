"""Proposed evidence contract tests use fictional sources and populations only."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from jsonschema import ValidationError

from tools.validate_cohort_history_evidence import load_evidence, validate_evidence

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures/cohort-history-evidence"


def load(name="complete"):
    return load_evidence(FIXTURES / f"synthetic-{name}.json")


class CohortHistoryEvidenceTests(unittest.TestCase):
    def test_golden_examples_and_off_seed_purchase_default(self):
        for name in ("complete", "bounded"):
            data = load(name)
            self.assertEqual(validate_evidence(data), data)
        data = load()
        self.assertFalse(data["models"][0]["seedMatch"])
        self.assertEqual(data["models"][0]["history"]["verifiedAnchor"], "2024-Q2")
        self.assertEqual(data["models"][0]["history"]["knownExposure"]["driveDays"], 36000)
        # Below-threshold exit/reentry retains the original anchor and exposure.
        self.assertEqual(data["models"][1]["history"]["verifiedAnchor"], "2024-Q1")
        bounded = load("bounded")["models"][0]["history"]
        self.assertEqual(bounded["verifiedWindowAnchor"], "2024-Q2")
        self.assertTrue(bounded["windowHistoryComplete"])
        self.assertIsNone(bounded["verifiedAnchor"])

    def test_bounded_zero_and_unresolved_boundary_cannot_certify_history(self):
        for index in (0, 1):
            for claim in ("anchorSearchComplete", "cumulativeHistoryComplete"):
                data = load("bounded")
                data["models"][index]["history"][claim] = True
                with self.subTest(index=index, claim=claim), self.assertRaises(ValueError):
                    validate_evidence(data)
        data = load("bounded")
        data["models"][0]["history"]["verifiedAnchor"] = "2024-Q2"
        with self.assertRaisesRegex(ValueError, "not a verified anchor"):
            validate_evidence(data)

    def test_missing_and_incomplete_are_unknown_not_zero(self):
        for coverage in ("missing", "incomplete"):
            data = load()
            row = data["models"][0]["history"]["quarters"][0]
            row.update(coverage=coverage, count=0, driveDays=0, failures=0)
            with self.subTest(coverage=coverage), self.assertRaisesRegex(ValueError, "Count"):
                validate_evidence(data)

    def test_pre_anchor_gap_blocks_anchor_and_post_anchor_gap_blocks_cumulative(self):
        for index in (0, 2):
            data = load()
            history = data["models"][0]["history"]
            history["quarters"][index].update(coverage="missing", count=None, driveDays=0)
            history["firstObservedInLoadedHistory"] = "2024-Q2" if index == 0 else "2024-Q1"
            history["knownExposure"]["driveDays"] = sum(
                row["driveDays"] for row in history["quarters"]
            )
            with self.subTest(index=index), self.assertRaises(ValueError):
                validate_evidence(data)
            history["anchorSearchComplete"] = index != 0
            history["verifiedWindowAnchor"] = "2024-Q2" if index != 0 else None
            history["windowHistoryComplete"] = False
            history["verifiedAnchor"] = "2024-Q2" if index != 0 else None
            history["cumulativeHistoryComplete"] = False
            history["limitations"] = ["A missing source quarter remains unresolved."]
            validate_evidence(data)

    def test_partial_observation_and_exposure_are_retained_without_eligibility(self):
        data = load()
        history = data["models"][0]["history"]
        history["quarters"][0].update(coverage="incomplete", count=None)
        history.update(
            verifiedAnchor=None,
            verifiedWindowAnchor=None,
            windowHistoryComplete=False,
            anchorSearchComplete=False,
            cumulativeHistoryComplete=False,
            limitations=["Partial opening coverage, known sums only."],
        )
        validate_evidence(data)
        self.assertEqual(history["firstObservedInLoadedHistory"], "2024-Q1")

    def test_bounded_stop_requires_exact_complete_zero(self):
        for change in ({"count": 1, "driveDays": 10}, {"coverage": "missing", "count": None}):
            data = load("bounded")
            data["models"][0]["history"]["quarters"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_evidence(data)

    def test_ssd_unknown_and_unqualified_models_cannot_enter_analysis(self):
        for index in (2, 3):
            data = load()
            data["scope"]["analysisModelIds"].append(data["models"][index]["modelId"])
            with self.subTest(index=index), self.assertRaisesRegex(ValueError, "confirmed HDD"):
                validate_evidence(data)
        data = load()
        data["models"][0]["history"]["quarters"][1]["count"] = 1999
        with self.assertRaises(ValueError):
            validate_evidence(data)

    def test_cohort_membership_and_quarter_ledger_are_fixed_and_explicit(self):
        data = load()
        data["scope"]["purchaseDefaultModelIds"].append("EXCLUDED-SSD")
        with self.assertRaisesRegex(ValueError, "subsets"):
            validate_evidence(data)
        data = load()
        del data["models"][0]["history"]["quarters"][0]
        with self.assertRaisesRegex(ValueError, "enumerate every"):
            validate_evidence(data)
        data = load()
        data["models"].append(data["models"][0])
        with self.assertRaisesRegex(ValueError, "duplicate model IDs"):
            validate_evidence(data)

    def test_rejects_unreconciled_exposure_and_missing_evidence(self):
        for field in ("knownExposure", "boundary"):
            data = load()
            history = data["models"][0]["history"]
            if field == "knownExposure":
                history[field]["driveDays"] += 1
            else:
                history[field]["evidenceRefs"] = []
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_evidence(data)

    def test_complete_exposure_budget_uses_actual_quarter_days_including_leap_year(self):
        for year, index, days in ((2024, 0, 91), (2023, 0, 90), (2024, 2, 92)):
            data = load()
            if year != 2024:
                # Shift all ledger dates and derived claims together, retaining counts.
                for key in ("historyStart", "throughQuarter"):
                    data["scope"][key] = data["scope"][key].replace("2024", str(year))
                for model in data["models"]:
                    history = model["history"]
                    history["boundary"]["quarter"] = history["boundary"]["quarter"].replace(
                        "2024", str(year)
                    )
                    for row in history["quarters"]:
                        row["quarter"] = row["quarter"].replace("2024", str(year))
                    for key in (
                        "firstObservedInLoadedHistory",
                        "firstQualifyingInLoadedHistory",
                        "verifiedAnchor",
                        "verifiedWindowAnchor",
                    ):
                        if history[key] is not None:
                            history[key] = history[key].replace("2024", str(year))
            history = data["models"][0]["history"]
            row = history["quarters"][index]
            row["driveDays"] = row["count"] * days
            history["knownExposure"]["driveDays"] = sum(
                entry["driveDays"] for entry in history["quarters"]
            )
            with self.subTest(year=year, quarter=index + 1, boundary="allowed"):
                validate_evidence(data)
            row["driveDays"] += 1
            history["knownExposure"]["driveDays"] += 1
            with (
                self.subTest(year=year, quarter=index + 1, boundary="exceeded"),
                self.assertRaisesRegex(ValueError, "actual calendar days"),
            ):
                validate_evidence(data)

    def test_alias_ownership_is_unambiguous_within_vendor(self):
        data = load()
        data["models"][1]["rawAliases"].append(data["models"][0]["rawAliases"][0])
        with self.assertRaisesRegex(ValueError, "raw alias maps to multiple"):
            validate_evidence(data)
        # Identical raw text belonging to a different vendor is a different key.
        data["models"][1]["vendor"] = "Another Fictional Vendor"
        validate_evidence(data)

    def test_schema_rejects_unsupported_claims_and_boolean_counts(self):
        for change in ({"count": True}, {"globalInceptionProved": True}):
            data = load()
            data["models"][0]["history"]["quarters"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValidationError):
                validate_evidence(data)

    def test_strict_json_rejects_duplicate_keys_and_nonfinite_constants(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.json"
            for content in ('{"x": 1, "x": 2}', '{"x": NaN}', '{"x": Infinity}'):
                path.write_text(content, encoding="utf-8")
                with self.subTest(content=content), self.assertRaises(ValueError):
                    load_evidence(path)


if __name__ == "__main__":
    unittest.main()
