"""Exercise inference limits rather than assuming workbook ordinals are dates."""

import unittest

from tools.reconcile_production_workbooks import (
    chronological_candidates,
    comparison,
    equal,
    reconcile,
)


class WorkbookReconciliationTests(unittest.TestCase):
    def test_chronology_resolves_repeated_counts_without_using_other_metrics(self):
        self.assertEqual(
            chronological_candidates([["2025-Q2", "2025-Q3"], ["2025-Q2", "2025-Q3"]]),
            [["2025-Q2"], ["2025-Q3"]],
        )

    def test_impossible_chronology_does_not_partially_certify_dates(self):
        self.assertEqual(chronological_candidates([["2025-Q3"], ["2025-Q2"]]), [[], []])

    def test_numeric_comparison_keeps_integer_differences(self):
        self.assertTrue(equal("1.23456789012345", 1.2345678901234502, "observedRecordedAfr"))
        self.assertFalse(equal("2000", 2001, "count"))
        self.assertFalse(equal("0", None, "new"))

    def test_semantic_rate_label_does_not_explain_numerical_difference(self):
        cell = {"status": "eligible"}
        self.assertEqual(
            comparison("1.5", 1.6, "observedRecordedAfr", cell), "unexplained_difference"
        )

    def test_only_explicit_unavailable_and_initialization_cases_are_explained(self):
        cell = {"status": "eligible", "deltaReason": "initialized"}
        self.assertEqual(
            comparison("2000", 0, "populationDelta", cell), "declared_first_delta_zero"
        )
        cell = {"status": "source_incomplete"}
        self.assertEqual(comparison("2000", None, "count", cell), "declared_partial_unavailable")
        cell = {"status": "eligible", "retiredReason": "gap_obstructed"}
        self.assertEqual(
            comparison("12", None, "retired", cell), "declared_gap_retirement_unavailable"
        )

    def test_repeated_count_does_not_receive_an_invented_calendar_mapping(self):
        reference = dict(
            snapshot="2025-Q3",
            source={},
            models=[
                dict(
                    model="EXACT",
                    rows=[
                        dict(
                            status="retained",
                            sheet_row=6,
                            cells=[["A6", "0"]] * 2 + [["C6", "2000"]],
                        )
                    ],
                )
            ],
        )
        descriptor = dict(
            context=dict(
                inventory=[
                    dict(
                        modelNumber="EXACT",
                        modelId="exact",
                        history=[
                            dict(quarter="2025-Q2", knownIdentityLowerBound=2000),
                            dict(quarter="2025-Q3", knownIdentityLowerBound=2000),
                        ],
                    )
                ]
            )
        )
        matrix = dict(asOfQuarter="2025-Q3", models=[dict(modelId="exact", cells=[])])
        report = reconcile(reference, descriptor, matrix)
        self.assertEqual(report["totals"], {"unresolved_rows": 1})
        self.assertEqual(report["models"][0]["rows"][0]["mapping"], "unresolved")
        self.assertNotIn("quarter", report["models"][0]["rows"][0])


if __name__ == "__main__":
    unittest.main()
