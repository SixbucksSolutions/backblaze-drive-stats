"""Production v2 numerical and exact-byte publication checks, using fictional rows."""

import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

import polars as pl
from test_historical_generator import PATTERNS, REGISTRY, make_input, rows

from historical_generator import QuarterInput, Registry, bounds, digest, file_sha
from matrix_types import RegistryEntry
from production_history import (
    _captured_datacenter_available,
    catalog_summary_manifests,
    generate,
    publish_generation,
)


class ProductionHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.inputs = [
            make_input(cls.root, "2023-Q4", {0: rows(bounds("2023-Q4")[0], 100, failure=1)}),
            make_input(
                cls.root, "2024-Q1", {0: rows(bounds("2024-Q1")[0], 2100, failure=1)}, missing=(1,)
            ),
            make_input(cls.root, "2024-Q2", {0: rows(bounds("2024-Q2")[0], 2200, failure=1)}),
            make_input(cls.root, "2024-Q4", {0: rows(bounds("2024-Q4")[0], 1999, failure=1)}),
            make_input(
                cls.root,
                "2025-Q1",
                {
                    0: rows(bounds("2025-Q1")[0], 2300, failure=1)
                    + rows(bounds("2025-Q1")[0], 2100, "XYZ26TB-01", prefix="x")
                },
            ),
        ]
        cls.mid = Registry(REGISTRY, PATTERNS).resolve("ST100TEST")["modelId"]
        cls.xyz = Registry(REGISTRY, PATTERNS).resolve("XYZ26TB-01")["modelId"]
        cls.args: dict = dict(
            cache_root=cls.root / "cache",
            as_of="2025-Q1",
            history_start="2023-Q4",
            registry=REGISTRY,
            patterns=PATTERNS,
            generator_revision="test-v2",
            kind="sample",
            generated_at="2026-10-31T00:00:00Z",
            selection=dict(
                version="2.0.0",
                purchaseDefaultModelIds=[cls.xyz],
                historicalReferenceModelIds=[cls.mid],
            ),
        )
        cls.index, cls.artifacts, cls.diagnostics = generate(cls.inputs, **cls.args)
        cls.descriptor = json.loads(cls.artifacts[cls.index["snapshots"][0]["descriptor"]["path"]])
        cls.matrix = json.loads(cls.artifacts[cls.descriptor["matrix"]["path"]])

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_partial_anchor_gap_reentry_and_components(self):
        block = next(row for row in self.matrix["models"] if row["modelId"] == self.mid)
        self.assertEqual(block["reportingAnchorQuarter"], "2024-Q1")
        first, eligible, gap, below, reentry = block["cells"][:5]
        self.assertEqual(first["status"], "source_incomplete")
        self.assertTrue(all(value is None for value in first["metrics"].values()))
        self.assertAlmostEqual(eligible["metrics"]["observedRecordedAfr"], 3 / 4400 * 36500)
        self.assertIsNone(eligible["completeHistoryAfr"])
        self.assertEqual(
            eligible["metrics"]["observedRecordedAfrDelta"],
            eligible["metrics"]["observedRecordedAfr"],
        )
        self.assertEqual(eligible["metrics"]["populationDelta"], 2200)
        self.assertEqual(gap["status"], "missing")
        self.assertEqual(below["status"], "below_threshold")
        self.assertEqual(reentry["relativeQuarter"], 5)
        self.assertEqual(reentry["baselineQuarterDistance"], 3)
        self.assertEqual(reentry["metrics"]["populationDelta"], 100)
        self.assertAlmostEqual(reentry["metrics"]["observedRecordedAfr"], 5 / 8699 * 36500)
        self.assertIsNone(eligible["metrics"]["retired"])
        self.assertIsNone(reentry["metrics"]["retired"])
        self.assertEqual(reentry["retiredReason"], "right_censored")
        self.assertEqual(reentry["metrics"]["new"], 100)
        self.assertEqual(block["cells"][-1]["relativeQuarter"], 24)

    def test_warm_summary_route_never_reads_daily_partitions(self):
        manifests = sorted((self.root / "cache/quarters").glob("*/*/manifest.json"))
        with patch(
            "production_history.summarize_partitioned_input",
            side_effect=AssertionError("daily read"),
        ):
            index, artifacts, diagnostics = generate(summary_manifests=manifests, **self.args)
        self.assertEqual(index, self.index)
        self.assertEqual(artifacts, self.artifacts)
        self.assertEqual(diagnostics["computedQuarters"], [])
        self.assertEqual(len(diagnostics["reusedQuarters"]), 5)

    def test_versioned_first_baselines_preserve_legacy_identity_and_components(self):
        manifests = sorted((self.root / "cache/quarters").glob("*/*/manifest.json"))
        index, artifacts, _ = generate(
            summary_manifests=manifests,
            matrix_calculation_version="2.0.0",
            **self.args,
        )
        descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
        legacy = json.loads(artifacts[descriptor["matrix"]["path"]])
        self.assertNotEqual(index["latestSnapshotId"], self.index["latestSnapshotId"])
        self.assertEqual(descriptor["context"]["versions"]["rate"], "2.0.0")
        self.assertEqual(self.descriptor["context"]["versions"]["rate"], "2.1.0")
        expected_identity = digest(
            dict(
                asOf=self.args["as_of"],
                historyStart=self.args["history_start"],
                source=descriptor["context"]["sourceManifestSha256"],
                registry=REGISTRY,
                patterns=PATTERNS,
                selection=self.args["selection"],
                generator=self.args["generator_revision"],
                kind="sample",
                firstPublished="2013-04-10",
                generatedAt=self.args["generated_at"],
            )
        )
        self.assertEqual(
            index["latestSnapshotId"], self.args["as_of"] + "-v2-" + expected_identity[:24]
        )
        for old_model, new_model in zip(legacy["models"], self.matrix["models"], strict=True):
            first = True
            for old, new in zip(old_model["cells"], new_model["cells"], strict=True):
                if first and old["status"] == "eligible":
                    self.assertEqual(old["metrics"]["populationDelta"], 0)
                    self.assertEqual(old["metrics"]["observedRecordedAfrDelta"], 0)
                    old["metrics"]["populationDelta"] = new["metrics"]["count"]
                    old["metrics"]["observedRecordedAfrDelta"] = new["metrics"][
                        "observedRecordedAfr"
                    ]
                    first = False
                if new["retiredReason"] == "right_censored":
                    self.assertEqual(old["retiredReason"], "cutoff_failed_proxy")
                    self.assertEqual(old["metrics"]["retired"], old["metrics"]["failed"])
                    old["retiredReason"] = "right_censored"
                    old["metrics"]["retired"] = None
                self.assertEqual(old, new)

    def test_unsupported_matrix_calculation_version_rejected_before_input(self):
        with self.assertRaisesRegex(ValueError, "Unsupported matrix calculation version"):
            generate(matrix_calculation_version="2.2.0", **self.args)

    def test_retired_nonterminal_last_seen_includes_failed_and_ignores_global_latest_date(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = bounds("2023-Q1")[0]
            supplied = [
                make_input(root, "2023-Q1", {0: rows(first, 2000, failure=1)}),
                make_input(root, "2023-Q2", {}),
            ]
            arguments: dict = dict(
                self.args,
                cache_root=root / "cache",
                as_of="2023-Q2",
                history_start="2023-Q1",
                selection=dict(
                    version="2.0.0",
                    analysisModelIds=[self.mid],
                    purchaseDefaultModelIds=[],
                    historicalReferenceModelIds=[],
                ),
            )
            output = {}
            for version in ("2.0.0", "2.1.0"):
                index, artifacts, _ = generate(
                    supplied, matrix_calculation_version=version, **arguments
                )
                descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
                output[version] = json.loads(artifacts[descriptor["matrix"]["path"]])["models"][0][
                    "cells"
                ][0]
            self.assertEqual(output["2.0.0"]["metrics"]["retired"], 0)
            self.assertEqual(output["2.1.0"]["metrics"]["retired"], 2000)
            self.assertEqual(output["2.1.0"]["metrics"]["failed"], 1)
            self.assertEqual(output["2.1.0"]["retiredReason"], "inferred")
            index, artifacts, _ = generate(supplied, **dict(arguments, as_of="2023-Q1"))
            descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
            terminal = json.loads(artifacts[descriptor["matrix"]["path"]])["models"][0]["cells"][0]
            self.assertIsNone(terminal["metrics"]["retired"])
            self.assertEqual(terminal["retiredReason"], "right_censored")

    def test_captured_datacenter_headers_preserve_cold_retained_parity(self):
        from datetime import timedelta

        for mode, available in (
            ("absent", False),
            ("null", True),
            ("mixed", True),
            ("legacy", True),
            ("legacy_null", None),
        ):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = root / "source"
                source.mkdir()
                start, end = bounds("2024-Q1")
                records = []
                for offset in range((end - start).days + 1):
                    day = start + timedelta(days=offset)
                    present = mode != "absent" and (mode != "mixed" or offset != 0)
                    frame = pl.DataFrame(
                        rows(day, 2000, location=None if mode in {"null", "legacy_null"} else "A")
                    )
                    if not present:
                        frame = frame.drop("datacenter")
                    name = f"{day}.parquet"
                    frame.write_parquet(source / name)
                    record: dict = dict(date=str(day), rowCount=2000, outputFile=name)
                    if not mode.startswith("legacy"):
                        record.update(datacenterAvailable=present, sourceColumns=frame.columns)
                    records.append(record)
                receipt = dict(schemaVersion=1, sourceZipSha256="1" * 64, files=records)
                if not mode.startswith("legacy"):
                    receipt.update(
                        datacenterAvailable=all(r["datacenterAvailable"] for r in records),
                        sourceColumns=sorted({c for r in records for c in r["sourceColumns"]}),
                    )
                (source / "import-metadata.json").write_text(json.dumps(receipt))
                args: dict = dict(
                    self.args,
                    history_start="2024-Q1",
                    as_of="2024-Q1",
                    cache_root=root / "cache",
                    selection=dict(
                        version="2.0.0",
                        purchaseDefaultModelIds=[self.mid],
                        historicalReferenceModelIds=[],
                    ),
                )
                if available is None:
                    with self.assertRaisesRegex(ValueError, "header evidence required"):
                        generate([QuarterInput("2024-Q1", source)], **args)
                    manifests = sorted((root / "cache/quarters").glob("*/*/manifest.json"))
                    with self.assertRaisesRegex(ValueError, "header evidence required"):
                        generate(summary_manifests=manifests, **args)
                    continue
                index, artifacts, _ = generate([QuarterInput("2024-Q1", source)], **args)
                descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
                payload = json.loads(artifacts[descriptor["quarters"][0]["payload"]["path"]])
                self.assertEqual(
                    descriptor["context"]["coverage"][0]["datacenterFieldAvailable"], available
                )
                self.assertEqual(payload["datacenters"]["fieldAvailable"], available)
                self.assertEqual(payload["scopes"]["all_supplied"]["totals"]["count"], 2000)
                self.assertEqual(payload["scopes"]["all_supplied"]["totals"]["capacityTB"], 32000)
                self.assertEqual(
                    payload["datacenters"]["knownLocationPopulationShare"],
                    0 if mode in {"absent", "null"} else 1,
                )
                manifests = sorted((root / "cache/quarters").glob("*/*/manifest.json"))
                before = {path: path.read_bytes() for path in manifests}
                with patch(
                    "production_history.summarize_partitioned_input",
                    side_effect=AssertionError("daily read"),
                ):
                    retained_index, retained_artifacts, _ = generate(
                        summary_manifests=manifests, **args
                    )
                self.assertEqual((retained_index, retained_artifacts), (index, artifacts))
                self.assertEqual(before, {path: path.read_bytes() for path in manifests})

    def test_captured_datacenter_evidence_rejects_ambiguity_and_preserves_legacy(self):
        def available(receipt, location="Unknown", q="2024-Q1"):
            return _captured_datacenter_available(
                dict(
                    coverage=dict(quarter=q),
                    lineage=dict(
                        receipt=receipt,
                        partitions=[dict(date=row["date"]) for row in receipt["files"]],
                    ),
                ),
                pl.DataFrame(dict(datacenter=[location])),
            )

        legacy = dict(files=[dict(date="2024-01-01")])
        self.assertTrue(available(legacy, location="A"))
        self.assertFalse(available(legacy, location="A", q="2023-Q2"))
        self.assertFalse(available(dict(legacy, datacenterAvailable=False, sourceColumns=[])))
        self.assertFalse(available(dict(legacy, datacenterAvailable=False)))
        mixed_legacy = dict(files=[dict(date="2024-01-01"), dict(date="2024-01-02")])
        self.assertTrue(
            available(dict(mixed_legacy, datacenterAvailable=False, sourceColumns=["datacenter"]))
        )
        self.assertTrue(available(dict(mixed_legacy, datacenterAvailable=False), location="A"))
        future_receipt = dict(
            files=[
                dict(date="2024-01-01", datacenterAvailable=False, sourceColumns=[]),
                dict(date="2024-04-01", datacenterAvailable=True, sourceColumns=["datacenter"]),
            ],
            datacenterAvailable=False,
            sourceColumns=["datacenter"],
        )
        self.assertFalse(
            _captured_datacenter_available(
                dict(
                    coverage=dict(quarter="2024-Q1"),
                    lineage=dict(receipt=future_receipt, partitions=[dict(date="2024-01-01")]),
                ),
                pl.DataFrame(dict(datacenter=["Unknown"])),
            )
        )
        for receipt, location in (
            (legacy, "Unknown"),
            (dict(mixed_legacy, datacenterAvailable=False), "Unknown"),
            (dict(legacy, datacenterAvailable=False), "A"),
            (dict(legacy, datacenterAvailable=False, sourceColumns=["datacenter"]), "Unknown"),
            (dict(legacy, datacenterAvailable=False, sourceColumns=["datacenter"]), "A"),
            (dict(legacy, datacenterAvailable=False, sourceColumns=[]), "A"),
            (dict(legacy, datacenterAvailable="false"), "Unknown"),
            (
                dict(files=[dict(date="2024-01-01", datacenterAvailable=True)], sourceColumns=[]),
                "Unknown",
            ),
            (
                dict(
                    files=[
                        dict(date="2024-01-01", datacenterAvailable=True),
                        dict(date="2024-01-02"),
                    ]
                ),
                "Unknown",
            ),
            (
                dict(
                    files=[
                        dict(
                            date="2024-01-01",
                            datacenterAvailable=False,
                            sourceColumns=["datacenter"],
                        )
                    ]
                ),
                "Unknown",
            ),
            (
                dict(
                    files=[dict(date="2024-01-01", datacenterAvailable=False)],
                    datacenterAvailable=True,
                ),
                "Unknown",
            ),
        ):
            with self.subTest(receipt=receipt), self.assertRaises(ValueError):
                available(receipt, location)

    def test_as_of_excludes_future_models_exposure_capacity_and_inputs(self):
        args: dict = dict(
            self.args,
            as_of="2024-Q2",
            selection=dict(
                version="2.0.0", purchaseDefaultModelIds=[self.mid], historicalReferenceModelIds=[]
            ),
        )
        index, artifacts, _ = generate(self.inputs, **args)
        descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
        self.assertNotIn(self.xyz, descriptor["context"]["selection"]["contextModelIds"])
        self.assertNotIn(self.xyz, [row["modelId"] for row in descriptor["context"]["inventory"]])
        self.assertEqual(len(descriptor["context"]["coverage"]), 3)

    def test_context_discovery_unpublished_and_whole_scope_denominators(self):
        registry = deepcopy(REGISTRY)
        registry["models"][2]["mediaClass"] = "ssd"
        registry["models"].append(
            RegistryEntry(
                vendor="Seagate",
                modelNumber="CONTEXT",
                mediaClass="hdd",
                evidence="Fictional HDD",
                aliases=["CONTEXT"],
            )
        )
        patterns = [*PATTERNS, r"^Seagate CONTEXT$"]
        context_id = digest(["Seagate", "CONTEXT"])[:24]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            q2 = bounds("2013-Q2")[0]
            q3 = bounds("2013-Q3")[0]
            inputs = [
                make_input(
                    root,
                    "2013-Q2",
                    {
                        9: rows(q2.replace(day=10), 2000)
                        + rows(q2.replace(day=10), 2100, "XYZ26TB-01", prefix="x")
                        + rows(q2.replace(day=10), 100, "CONTEXT", prefix="c", capacity=0)
                        + rows(q2.replace(day=10), 3000, "SSD", prefix="ssd")
                        + rows(q2.replace(day=10), 2500, "MYSTERY", prefix="u")
                    },
                    missing=range(9),
                ),
                make_input(
                    root,
                    "2013-Q3",
                    {
                        0: rows(q3, 2200)
                        + rows(q3, 2200, "XYZ26TB-01", prefix="x")
                        + rows(q3, 100, "CONTEXT", prefix="c", capacity=0)
                    },
                ),
            ]
            args: dict = dict(
                self.args,
                history_start="2013-Q1",
                as_of="2013-Q3",
                registry=registry,
                patterns=patterns,
                cache_root=root / "cache",
            )
            index, artifacts, diagnostics = generate(inputs, **args)
            descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
            context = descriptor["context"]
            self.assertEqual(context["coverage"][0]["status"], "unpublished")
            self.assertIsNone(descriptor["quarters"][0]["payload"])
            self.assertIn(context_id, context["selection"]["contextModelIds"])
            self.assertNotIn(context_id, context["selection"]["analysisModelIds"])
            self.assertEqual(len(context["selection"]["analysisModelIds"]), 2)
            self.assertEqual(len(diagnostics["pendingClassification"]), 1)
            self.assertIn("ssd", {row["mediaClass"] for row in context["inventory"]})
            inventory = {row["modelId"]: row for row in context["inventory"]}
            self.assertTrue(inventory[self.mid]["earlierQualificationNotExcluded"])
            self.assertEqual(inventory[self.xyz]["reportingAnchorQuarter"], "2013-Q2")
            payload = json.loads(artifacts[descriptor["quarters"][-1]["payload"]["path"]])
            selected = payload["scopes"]["selected_hdd"]
            self.assertEqual(selected["totals"]["count"], 4500)
            self.assertIsNone(selected["totals"]["capacityTB"])
            self.assertEqual(selected["capacityDeltaReason"], "invalid_capacity")
            self.assertEqual(payload["datacenters"]["knownLocationPopulationShare"], 0)
            self.assertEqual(len(payload["datacenters"]["locations"]), 1)

    def test_partial_1999_does_not_prove_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = bounds("2024-Q1")[0]
            item = make_input(
                root,
                "2024-Q1",
                {0: rows(first, 2000) + rows(first, 1999, "XYZ26TB-01", prefix="x")},
                missing=(1,),
            )
            args: dict = dict(
                self.args,
                history_start="2024-Q1",
                as_of="2024-Q1",
                cache_root=root / "cache",
                selection=dict(
                    version="2.0.0",
                    purchaseDefaultModelIds=[],
                    historicalReferenceModelIds=[self.mid],
                ),
            )
            index, artifacts, _ = generate([item], **args)
            descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
            self.assertNotIn(self.xyz, descriptor["context"]["selection"]["contextModelIds"])
            xyz = next(
                row for row in descriptor["context"]["inventory"] if row["modelId"] == self.xyz
            )
            self.assertIsNone(xyz["reportingAnchorQuarter"])
            self.assertEqual(xyz["history"][0]["knownIdentityLowerBound"], 1999)
            matrix = json.loads(artifacts[descriptor["matrix"]["path"]])
            self.assertEqual(matrix["models"][0]["cells"][0]["status"], "source_incomplete")

    def test_pinned_catalog_selects_partial_summaries_without_daily_reads(self):
        cache = self.root / "cache"
        manifests = sorted(cache.glob("quarters/*/*/manifest.json"))
        entries = []
        for path in manifests:
            manifest = json.loads(path.read_bytes())
            entries.append(
                dict(
                    quarter=manifest["coverage"]["quarter"],
                    coverage=manifest["coverage"],
                    summaryManifestPath=path.relative_to(cache).as_posix(),
                    summaryManifestSha256=file_sha(path),
                    summaryInputSha256=manifest["inputSha256"],
                )
            )
        path = self.root / "catalog.json"
        path.write_text(json.dumps(dict(quarters=entries)))
        selected = catalog_summary_manifests(
            cache, path, file_sha(path), history_start="2024-Q1", as_of="2024-Q2"
        )
        self.assertEqual(len(selected), 2)
        self.assertEqual(json.loads(selected[0].read_bytes())["coverage"]["observedDays"], 90)
        with self.assertRaisesRegex(ValueError, "catalog byte"):
            catalog_summary_manifests(
                cache, path, "0" * 64, history_start="2024-Q1", as_of="2024-Q2"
            )

    def test_capacity_mode_tie_and_future_capacity_exclusion(self):
        from datetime import timedelta

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = bounds("2024-Q1")[0]
            second = first + timedelta(days=1)
            future = bounds("2024-Q2")[0]
            inputs = [
                make_input(
                    root,
                    "2024-Q1",
                    {0: rows(first, 2000, capacity=8e12), 1: rows(second, 2000, capacity=16e12)},
                ),
                make_input(root, "2024-Q2", {0: rows(future, 3000, capacity=32e12)}),
            ]
            args: dict = dict(
                self.args,
                history_start="2024-Q1",
                as_of="2024-Q1",
                cache_root=root / "cache",
                selection=dict(
                    version="2.0.0",
                    purchaseDefaultModelIds=[self.mid],
                    historicalReferenceModelIds=[],
                ),
            )
            index, artifacts, _ = generate(inputs, **args)
            descriptor = json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])
            self.assertEqual(descriptor["context"]["inventory"][0]["capacityTB"], 8)
            payload = json.loads(artifacts[descriptor["quarters"][0]["payload"]["path"]])
            self.assertEqual(payload["scopes"]["selected_hdd"]["totals"]["capacityTB"], 16000)
            self.assertEqual(payload["scopes"]["selected_hdd"]["totals"]["new"], 2000)

    def test_private_paths_and_credentials_fail_before_public_output(self):
        manifests = sorted((self.root / "cache/quarters").glob("*/*/manifest.json"))
        for revision in (
            "C:/private/source.py",
            r"C:\private\source.py",
            "token=secret",
            "https://build.internal/revision",
        ):
            with self.subTest(revision=revision), self.assertRaises(ValueError):
                generate(
                    summary_manifests=manifests, **dict(self.args, generator_revision=revision)
                )
        for raw in ("C:/private/device", r"C:\private\device"):
            with self.subTest(raw=raw), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                first = bounds("2024-Q1")[0]
                item = make_input(
                    root,
                    "2024-Q1",
                    {0: rows(first, 2000) + rows(first, 1, model=raw, prefix="private")},
                )
                args: dict = dict(
                    self.args,
                    history_start="2024-Q1",
                    as_of="2024-Q1",
                    cache_root=root / "cache",
                    selection=dict(
                        version="2.0.0",
                        purchaseDefaultModelIds=[self.mid],
                        historicalReferenceModelIds=[],
                    ),
                )
                with self.assertRaises(ValueError):
                    generate([item], **args)
        # Valid model variants and revision names may contain an internal slash.
        from production_history import _public_strings

        _public_strings(
            dict(vendor="WDC/HGST", model="ST-TEST/VARIANT", revision="codex/0085-working")
        )

    def test_direct_publisher_rejects_rebound_private_text_before_writes(self):
        from test_production_v2 import Bundle

        bundle = Bundle()
        bundle.snapshots[0][0]["context"]["generatorRevision"] = "C:/private/revision"
        index, artifacts = bundle.pack()
        root = self.root / "rejected-private-publication"
        with self.assertRaises(ValueError):
            publish_generation(root, index, artifacts)
        self.assertFalse(root.exists())

    def test_pairing_and_immutable_local_publication(self):
        root = self.root / "public"
        publish_generation(root, self.index, self.artifacts)
        publish_generation(root, self.index, self.artifacts)
        before = (root / "index.json").read_bytes()
        damaged = dict(self.artifacts)
        path = next(iter(damaged))
        damaged[path] += b" "
        with self.assertRaises(ValueError):
            publish_generation(root, self.index, damaged)
        self.assertEqual((root / "index.json").read_bytes(), before)

    def test_retained_damage_fails_without_rescan(self):
        manifests = sorted((self.root / "cache/quarters").glob("*/*/manifest.json"))
        path = manifests[0]
        original = path.read_bytes()
        try:
            path.write_bytes(original.replace(b'"rowCount":100', b'"rowCount":101'))
            with self.assertRaises(ValueError):
                generate(summary_manifests=manifests, **self.args)
        finally:
            path.write_bytes(original)


if __name__ == "__main__":
    unittest.main()
