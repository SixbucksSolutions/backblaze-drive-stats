"""Adversarial graph probes use fresh hashes to reach semantic checks."""

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from jsonschema import ValidationError

from tools.validate_production_v2 import load_json, validate_artifact, validate_generation

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures/production-v2"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


class Bundle:
    def __init__(self):
        self.index = load_json(next(FIXTURES.glob("sample-index.*.json")))
        self.snapshots = []
        for entry in self.index["snapshots"]:
            descriptor = load_json(FIXTURES / entry["descriptor"]["path"])
            matrix = load_json(FIXTURES / descriptor["matrix"]["path"])
            supporting = {
                row["quarter"]: load_json(FIXTURES / row["payload"]["path"])
                for row in descriptor["quarters"]
                if row["payload"] is not None
            }
            self.snapshots.append((descriptor, matrix, supporting))

    def pack(self):
        index = copy.deepcopy(self.index)
        artifacts = {}

        def put(value):
            raw = canonical(value)
            digest = hashlib.sha256(raw).hexdigest()
            path = f"artifact.{digest}.json"
            artifacts[path] = raw
            return {"path": path, "sha256": digest, "sizeBytes": len(raw)}

        for entry, (source, original_matrix, original_supporting) in zip(
            index["snapshots"], self.snapshots, strict=True
        ):
            descriptor = copy.deepcopy(source)
            context = descriptor["context"]
            context_hash = hashlib.sha256(canonical(context)).hexdigest()
            descriptor["contextSha256"] = context_hash
            matrix = copy.deepcopy(original_matrix)
            matrix["contextSha256"] = context_hash
            descriptor["matrix"] = put(matrix)
            for row in descriptor["quarters"]:
                if row["payload"] is not None:
                    payload = copy.deepcopy(original_supporting[row["quarter"]])
                    payload["contextSha256"] = context_hash
                    row["payload"] = put(payload)
            entry["descriptor"] = put(descriptor)
        return index, artifacts


class ProductionV2Tests(unittest.TestCase):
    def setUp(self):
        self.bundle = Bundle()
        self.descriptor, self.matrix, self.supporting = self.bundle.snapshots[0]
        self.context = self.descriptor["context"]

    def reject(self, pattern):
        with self.assertRaisesRegex((ValueError, ValidationError), pattern):
            validate_generation(*self.bundle.pack())

    def test_fictional_graph_and_exact_recorded_exposure(self):
        validate_generation(*self.bundle.pack())
        model = self.matrix["models"][0]
        self.assertEqual(model["reportingAnchorQuarter"], "2013-Q2")
        self.assertEqual(model["cells"][0]["status"], "source_incomplete")
        reentry = model["cells"][4]
        self.assertEqual(reentry["baselineQuarterDistance"], 3)
        self.assertGreater(reentry["metrics"]["observedRecordedAfr"], 0)
        self.assertIsNone(reentry["completeHistoryAfr"])
        self.assertFalse(reentry["sourceHistoryComplete"])
        self.assertEqual(len(model["cells"]), 24)

    def test_shipped_exact_bytes(self):
        path = next(FIXTURES.glob("sample-index.*.json"))
        validate_generation(
            load_json(path), {p.name: p.read_bytes() for p in FIXTURES.glob("*.json") if p != path}
        )

    def test_duplicate_and_nonfinite_json_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            for content in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}'):
                path.write_text(content)
                with self.assertRaises(ValueError):
                    load_json(path)

    def test_nonfinite_numeric_overflow_rejected(self):
        self.matrix["models"][0]["cells"][1]["metrics"]["observedRecordedAfr"] = float("inf")
        with self.assertRaises(ValueError):
            validate_artifact(self.matrix)

    def test_private_field_rejected(self):
        self.context["inventory"][0]["serialNumber"] = "fictional"
        self.reject("not valid|Additional properties")

    def test_seed_context_cannot_follow_purchase_filter(self):
        self.context["selection"]["contextModelIds"].remove("sample-context-only-hdd")
        self.reject("context must retain")

    def test_new_vendor_qualifier_cannot_be_dropped(self):
        self.context["selection"]["contextModelIds"].remove("sample-new-vendor-hdd")
        self.reject("context must retain")

    def test_unclassified_cannot_enter_analysis(self):
        self.context["selection"]["analysisModelIds"].append("sample-unclassified")
        self.reject("analysis lacks")

    def test_defaults_must_be_disjoint(self):
        self.context["selection"]["purchaseDefaultModelIds"] = self.context["selection"][
            "historicalReferenceModelIds"
        ][:]
        self.reject("default subsets")

    def test_ordered_ledger_cannot_drop_missing_quarter(self):
        self.context["inventory"][0]["history"].pop(3)
        self.reject("ledger not aligned")

    def test_partial_proof_requires_identity_budget(self):
        row = self.context["inventory"][0]["history"][1]
        row["knownDriveDays"] = row["knownIdentityLowerBound"] - 1
        self.reject("identity/exposure budget")

    def test_partial_threshold_proof_is_derived(self):
        self.context["inventory"][0]["history"][1]["thresholdProof"] = None
        self.reject("threshold proof")

    def test_first_complete_qualifier_is_distinct_from_proof(self):
        self.context["inventory"][0]["firstCompleteQualifyingInDeclaredHistory"] = "2013-Q2"
        self.reject("first complete qualifier")

    def test_uncertainty_cannot_be_hidden_by_known_zero(self):
        self.context["inventory"][0]["earlierQualificationNotExcluded"] = False
        self.reject("qualification uncertainty")

    def test_partial_cells_never_expose_count(self):
        self.matrix["models"][0]["cells"][0]["metrics"]["count"] = 2100
        self.reject("partial cell exposes")

    def test_preanchor_exposure_cannot_be_omitted(self):
        self.matrix["models"][1]["cells"][0]["cumulativeKnownDriveDays"] -= 4100
        self.reject("cumulative components")

    def test_cumulative_rate_arithmetic(self):
        self.matrix["models"][0]["cells"][1]["metrics"]["observedRecordedAfr"] += 1
        self.reject("AFR arithmetic")

    def test_complete_history_claim_cannot_cross_gap(self):
        self.matrix["models"][0]["cells"][4]["completeHistoryAfr"] = 1
        self.reject("complete-history AFR")

    def test_baseline_counts_calendar_gaps(self):
        self.matrix["models"][0]["cells"][4]["baselineQuarterDistance"] = 1
        self.reject("calendar baseline")

    def test_padded_positions_have_no_future_observations(self):
        self.matrix["models"][0]["cells"][-1]["cumulativeKnownDriveDays"] = 0
        self.reject("future padding has observations")

    def test_all_supplied_inventory_includes_unknown_media(self):
        self.supporting["2013-Q3"]["scopes"]["all_supplied"]["models"].pop()
        self.reject("scope must include")

    def test_capacity_mode_multiplication(self):
        self.supporting["2013-Q3"]["scopes"]["selected_hdd"]["models"][0]["capacityTB"] += 8
        self.reject("capacity mode multiplication")

    def test_share_cannot_use_filtered_denominator(self):
        self.supporting["2013-Q3"]["scopes"]["selected_hdd"]["manufacturers"][0][
            "populationShare"
        ] = 1
        self.reject("whole-scope denominator")

    def test_partial_totals_are_not_zero(self):
        self.supporting["2013-Q2"]["scopes"]["selected_hdd"]["totals"]["count"] = 0
        self.reject("scope sum")

    def test_capacity_delta_cannot_bridge_missing_quarter(self):
        self.supporting["2014-Q1"]["scopes"]["selected_hdd"]["capacityDeltaTB"] = 1
        self.reject("adjacent capacity delta")

    def test_unreported_locations_stay_unknown(self):
        self.supporting["2013-Q3"]["datacenters"]["knownLocationPopulationShare"] = 1
        self.reject("known-location coverage")

    def test_wrong_context_with_rehashed_transport(self):
        self.matrix["snapshotId"] = "mixed"
        self.reject("mixed generation")

    def test_matrix_and_supporting_new_must_match(self):
        self.matrix["models"][0]["cells"][1]["metrics"]["new"] += 1
        self.reject("matrix/supporting New")

    def test_later_seed_hint_does_not_imply_future_observations(self):
        self.context["selection"]["positiveSeed"]["asOfQuarter"] = "2025-Q1"
        validate_generation(*self.bundle.pack())
        self.context["coverage"][-1]["lastObservedDate"] = "2025-01-01"
        self.reject("observed dates outside")

    def test_large_counts_and_integer_valued_json_floats_are_exact(self):
        self.bundle.index["snapshots"] = self.bundle.index["snapshots"][1:]
        self.bundle.snapshots = self.bundle.snapshots[1:]
        descriptor, matrix, supporting = self.bundle.snapshots[0]
        context = descriptor["context"]
        factor = 1_000_000_000
        for coverage in context["coverage"]:
            coverage["knownObservationRows"] *= factor
        for model in context["inventory"]:
            for row in model["history"]:
                for key in (
                    "quarterCount",
                    "knownIdentityLowerBound",
                    "knownFailures",
                    "knownDriveDays",
                ):
                    row[key] *= factor
                row["thresholdProof"] = "complete_exact_count"
            for key in (
                "firstProvenThresholdInDeclaredHistory",
                "firstCompleteQualifyingInDeclaredHistory",
                "reportingAnchorQuarter",
            ):
                model[key] = context["coverage"][0]["quarter"]
        for block in matrix["models"]:
            for cell in block["cells"]:
                if cell["status"] == "snapshot_end":
                    continue
                for key in ("cumulativeKnownFailures", "cumulativeKnownDriveDays"):
                    cell[key] *= factor
                for key in ("count", "populationDelta", "new", "retired", "failed"):
                    if cell["metrics"][key] is not None:
                        cell["metrics"][key] *= factor
        for payload in supporting.values():
            for scope in payload["scopes"].values():
                for row in [scope["totals"], *scope["models"], *scope["manufacturers"]]:
                    for key in ("count", "new", "capacityTB"):
                        row[key] *= factor
                if scope["capacityDeltaTB"] is not None:
                    scope["capacityDeltaTB"] *= factor
            for row in payload["datacenters"]["locations"]:
                row["count"] *= factor
                row["capacityTB"] *= factor
        validate_generation(*self.bundle.pack())
        scope = supporting["2023-Q2"]["scopes"]["all_supplied"]
        for row, key, message in (
            (scope["totals"], "count", "scope sum reconciliation"),
            (scope["totals"], "new", "scope sum reconciliation"),
            (scope["manufacturers"][0], "count", "manufacturer sum"),
            (
                matrix["models"][0]["cells"][1]["metrics"],
                "populationDelta",
                "population delta arithmetic",
            ),
            (
                supporting["2023-Q2"]["datacenters"]["locations"][0],
                "count",
                "datacenter/all-source sum",
            ),
        ):
            with self.subTest(field=key, check=message):
                original = row[key]
                row[key] = float(original) + 1
                self.reject(message)
                row[key] = original

    def test_zero_observed_population_has_zero_capacity_with_unknown_mode(self):
        descriptor, _, supporting = self.bundle.snapshots[1]
        context = descriptor["context"]
        model = copy.deepcopy(context["inventory"][1])
        model.update(
            modelId="sample-zero-hdd", modelNumber="ZERO", rawAliases=["ZERO"], capacityTB=None
        )
        for key in (
            "firstObservedInDeclaredHistory",
            "firstProvenThresholdInDeclaredHistory",
            "firstCompleteQualifyingInDeclaredHistory",
            "reportingAnchorQuarter",
        ):
            model[key] = None
        for row in model["history"]:
            for key in (
                "quarterCount",
                "knownIdentityLowerBound",
                "knownFailures",
                "knownDriveDays",
            ):
                row[key] = 0
        context["inventory"].append(model)
        context["selection"]["contextModelIds"].append(model["modelId"])
        context["selection"]["positiveSeed"]["modelIds"].append(model["modelId"])
        for payload in supporting.values():
            for scope in payload["scopes"].values():
                scope["models"].append(
                    {"modelId": model["modelId"], "count": 0, "new": 0, "capacityTB": 0}
                )
        validate_generation(*self.bundle.pack())
        supporting["2023-Q2"]["scopes"]["all_supplied"]["models"][-1]["capacityTB"] = None
        self.reject("capacity mode multiplication")

    def test_private_evidence_addresses_rejected(self):
        for host in (
            "192.168.1.1",
            "169.254.169.254",
            "[::1]",
            "localhost",
            "localhost.",
            "127.1",
            "2130706433",
            "127.0.0.0x1",
            "0x7f.0.0.0x1",
            "metadata.google.internal",
            "METAdata.Google.Internal.",
            "privatehost",
            "bad_label.example.org",
        ):
            self.context["provenance"]["url"] = f"https://{host}/evidence"
            with self.subTest(host=host):
                self.reject("private evidence|not valid")

    def test_public_syntax_urls_without_dns_queries(self):
        for host in ("example.org", "EXAMPLE.ORG.", "xn--bcher-kva.example.org", "8.8.8.8"):
            self.context["provenance"]["url"] = f"https://{host}/evidence"
            with self.subTest(host=host):
                validate_generation(*self.bundle.pack())

    def test_prepublication_status_is_derived(self):
        self.context["coverage"][0]["status"] = "missing"
        self.descriptor["quarters"][0]["status"] = "missing"
        self.reject("unpublished status")

    def test_all_inventory_exposure_exactly_reconciles_source(self):
        self.context["coverage"][2]["knownObservationRows"] += 1
        self.reject("row budget must reconcile exactly")

    def test_zero_location_population_cannot_receive_capacity(self):
        locations = self.bundle.snapshots[1][2]["2023-Q3"]["datacenters"]["locations"]
        locations[0]["capacityTB"] = 1
        locations[1]["capacityTB"] -= 1
        self.reject("zero-population location capacity")

    def test_positive_location_population_requires_positive_known_capacity(self):
        locations = self.bundle.snapshots[1][2]["2023-Q3"]["datacenters"]["locations"]
        locations[0]["count"] = 1
        locations[1]["count"] -= 1
        self.reject("positive-population location capacity")

    def test_context_hash_binding_without_repair(self):
        self.context["generatorRevision"] = "changed"
        with self.assertRaisesRegex(ValueError, "context hash"):
            validate_artifact(self.descriptor)

    def test_rehashed_wrong_quarter_payload_rejected(self):
        self.supporting["2013-Q3"]["quarter"] = "2014-Q2"
        self.reject("quarter reference")

    def test_false_source_completeness_rejected(self):
        self.matrix["models"][0]["cells"][4]["sourceHistoryComplete"] = True
        self.reject("cell source completeness")

    def test_failed_flags_exceeding_known_days_rejected(self):
        row = self.context["inventory"][0]["history"][1]
        row["knownFailures"] = row["knownDriveDays"] + 1
        self.reject("failure/exposure budget")

    def test_raw_bytes_size_and_path_closure(self):
        index, artifacts = self.bundle.pack()
        path = next(iter(artifacts))
        with self.assertRaisesRegex(ValueError, "byte hash/size"):
            validate_generation(index, {**artifacts, path: artifacts[path] + b" "})
        with self.assertRaisesRegex(ValueError, "unreachable"):
            validate_generation(index, {**artifacts, "unused.json": b"{}"})
        with self.assertRaisesRegex(ValueError, "missing"):
            validate_generation(index, {})

    def test_unsafe_reference_and_duplicate_snapshot(self):
        index, _ = self.bundle.pack()
        index["snapshots"][0]["descriptor"]["path"] = "../unsafe.json"
        with self.assertRaises((ValueError, ValidationError)):
            validate_artifact(index)
        index = self.bundle.index
        index["snapshots"].append(copy.deepcopy(index["snapshots"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate snapshot"):
            validate_artifact(index)


if __name__ == "__main__":
    unittest.main()
