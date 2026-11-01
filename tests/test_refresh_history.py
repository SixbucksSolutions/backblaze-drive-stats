"""Fictional refresh integration, immutable publication and recovery regression tests."""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from test_historical_generator import PATTERNS, REGISTRY, make_input, rows

from historical_generator import Registry, bounds, digest
from history_storage import atomic_write
from production_history import generate, publish_generation
from refresh_history import load_generation, plan_refresh, run_refresh, verify_refresh


class RefreshHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.registry = deepcopy(REGISTRY)
        cls.mid = Registry(REGISTRY, PATTERNS).resolve("ST100TEST")["modelId"]
        cls.xyz = Registry(REGISTRY, PATTERNS).resolve("XYZ26TB-01")["modelId"]
        cls.selection: dict = dict(
            version="2.0.0",
            analysisModelIds=[cls.mid],
            purchaseDefaultModelIds=[],
            historicalReferenceModelIds=[],
        )
        cls.args: dict = dict(
            cache_root=cls.root / "cache",
            as_of="2024-Q1",
            history_start="2024-Q1",
            registry=cls.registry,
            patterns=PATTERNS,
            generator_revision="baseline-revision",
            kind="sample",
            generated_at="2026-10-30T00:00:00Z",
            selection=cls.selection,
            matrix_calculation_version="2.0.0",
        )
        first = bounds("2024-Q1")[0]
        q1 = make_input(
            cls.root,
            "2024-Q1",
            {0: rows(first, 2100, failure=1) + rows(first, 2100, "MYSTERY", prefix="u")},
        )
        index, artifacts, _ = generate([q1], **cls.args)
        cls.baseline = cls.root / "baseline"
        publish_generation(cls.baseline, index, artifacts)
        cls.baseline_index = index
        cls.baseline_selection_sha256 = digest(
            json.loads(artifacts[index["snapshots"][0]["descriptor"]["path"]])["context"][
                "selection"
            ]
        )
        second = bounds("2024-Q2")[0]
        q2 = make_input(
            cls.root,
            "2024-Q2",
            {
                0: rows(second, 2200, "alias A")
                + rows(second, 2200, "XYZ26TB-01", prefix="x")
                + rows(second, 2200, "MYSTERY", prefix="u")
            },
        )
        generate([q1, q2], **dict(cls.args, as_of="2024-Q2"))
        third = bounds("2024-Q3")[0]
        q3 = make_input(
            cls.root,
            "2024-Q3",
            {0: rows(third, 2300) + rows(third, 2100, "NEW MYSTERY", prefix="n")},
        )
        generate([q1, q2, q3], **dict(cls.args, as_of="2024-Q3"))
        cls.manifests = sorted((cls.root / "cache/quarters").glob("*/*/manifest.json"))

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.case = tempfile.TemporaryDirectory(dir=self.root)
        self.addCleanup(self.case.cleanup)
        root = Path(self.case.name)
        self.config: dict = dict(
            baselineDirectory=str(self.baseline),
            outputDirectory=str(root / "public"),
            receiptPath=str(root / "private/refresh-receipt.json"),
            historyStart="2024-Q1",
            registry=deepcopy(self.registry),
            patterns=PATTERNS,
            generatorRevision="baseline-revision",
            generatedAt="2026-10-31T00:00:00Z",
            kind="sample",
            selection=deepcopy(self.selection),
            summaryManifests=[
                str(path) for path in self.manifests if path.parent.parent.name == "2024-Q1"
            ],
        )

    def add_quarter(self, quarter):
        self.config["summaryManifests"] += [
            str(path) for path in self.manifests if path.parent.parent.name == quarter
        ]

    def admit_xyz(self):
        self.config["selection"].update(
            analysisModelIds=[self.mid, self.xyz],
            update=dict(
                decisionVersion="fictional-decision-2",
                previousSelectionSha256=self.baseline_selection_sha256,
                reason="Fictional reviewed new vendor HDD admission",
                admittedModelIds=[self.xyz],
                removedModelIds=[],
            ),
        )

    def test_unchanged_reuses_baseline_time_revision_and_zero_public_writes(self):
        with patch(
            "production_history.summarize_partitioned_input",
            side_effect=AssertionError("daily read"),
        ):
            plan = plan_refresh(self.config)
            self.assertEqual(plan["snapshotId"], self.baseline_index["latestSnapshotId"])
            self.assertEqual(plan["generatorRevision"], "baseline-revision")
            self.assertEqual(plan["generatedAt"], "2026-10-30T00:00:00Z")
            self.assertEqual(len(plan["pendingClassification"]), 1)
            self.assertEqual(plan["newPendingClassification"], [])
            self.assertFalse(Path(self.config["outputDirectory"]).exists())
            first = run_refresh(self.config)
            self.assertGreater(first["publicWrites"], 0)
            root = Path(self.config["outputDirectory"]).resolve()
            calls = []

            def checked_write(path, data, **kwargs):
                if Path(path).resolve().is_relative_to(root):
                    calls.append(path)
                return atomic_write(path, data, **kwargs)

            with patch("refresh_history.atomic_write", side_effect=checked_write):
                receipt = run_refresh(self.config)
            self.assertEqual(calls, [])
            self.assertEqual(receipt["status"], "unchanged")
            self.assertEqual(receipt["publicWrites"], 0)
            self.assertEqual(verify_refresh(self.config)["status"], "verified")
            self.assertNotIn(str(self.root), Path(self.config["receiptPath"]).read_text())

    def test_explicit_calculation_migration_cannot_reuse_legacy_zero_delta_graph(self):
        self.config["matrixCalculationVersion"] = "2.1.0"
        with patch(
            "production_history.summarize_partitioned_input",
            side_effect=AssertionError("daily read"),
        ):
            plan = plan_refresh(self.config)
            self.assertEqual(plan["matrixCalculationVersion"], "2.1.0")
            self.assertNotEqual(plan["snapshotId"], self.baseline_index["latestSnapshotId"])
            self.assertEqual(plan["generatedAt"], self.config["generatedAt"])
            receipt = run_refresh(self.config)
        self.assertGreater(receipt["publicWrites"], 0)
        index, artifacts = load_generation(self.config["outputDirectory"])
        self.assertEqual(len(index["snapshots"]), 2)
        old_index, old_artifacts = load_generation(self.baseline)
        for path, raw in old_artifacts.items():
            self.assertEqual(artifacts[path], raw)
        self.assertIn(old_index["snapshots"][0], index["snapshots"])
        latest = next(
            row for row in index["snapshots"] if row["snapshotId"] == index["latestSnapshotId"]
        )
        descriptor = json.loads(artifacts[latest["descriptor"]["path"]])
        matrix = json.loads(artifacts[descriptor["matrix"]["path"]])
        first = matrix["models"][0]["cells"][0]["metrics"]
        self.assertGreater(first["observedRecordedAfr"], 0)
        self.assertEqual(first["observedRecordedAfrDelta"], first["observedRecordedAfr"])
        self.assertEqual(first["populationDelta"], first["count"])
        self.assertEqual(verify_refresh(self.config)["status"], "verified")

    def test_unsupported_calculation_version_rejected_without_writes(self):
        self.config["matrixCalculationVersion"] = "2.2.0"
        with self.assertRaisesRegex(ValueError, "Unsupported matrix calculation version"):
            plan_refresh(self.config)
        self.assertFalse(Path(self.config["outputDirectory"]).exists())

    def test_new_quarter_alias_and_new_vendor_require_versioned_explicit_admission(self):
        self.add_quarter("2024-Q2")
        plan = plan_refresh(self.config)
        self.assertEqual(plan["asOfQuarter"], "2024-Q2")
        self.assertEqual(plan["newQualifyingHdds"], [self.xyz])
        self.assertIn("new_qualifying_hdds_require_explicit_admission", plan["publicationGates"])
        with self.assertRaises(ValueError):
            run_refresh(self.config)
        self.assertFalse(Path(self.config["outputDirectory"]).exists())
        self.admit_xyz()
        receipt = run_refresh(self.config)
        self.assertEqual(receipt["publicationGates"], [])
        index, artifacts = load_generation(self.config["outputDirectory"])
        self.assertEqual(len(index["snapshots"]), 2)
        self.assertIn(self.baseline_index["snapshots"][0], index["snapshots"])
        entry = next(
            row for row in index["snapshots"] if row["snapshotId"] == receipt["snapshotId"]
        )
        context = json.loads(artifacts[entry["descriptor"]["path"]])["context"]
        model = next(row for row in context["inventory"] if row["modelId"] == self.mid)
        self.assertEqual(model["rawAliases"], ["ST100TEST", "alias A"])
        self.assertIn(self.xyz, context["selection"]["analysisModelIds"])
        self.assertEqual(len(receipt["pendingClassification"]), 1)

    def test_new_unclassified_qualification_gates_without_name_classification(self):
        self.add_quarter("2024-Q2")
        self.add_quarter("2024-Q3")
        self.admit_xyz()
        plan = plan_refresh(self.config)
        self.assertEqual(len(plan["pendingClassification"]), 2)
        self.assertEqual(len(plan["newPendingClassification"]), 1)
        self.assertIn("new_qualifying_unclassified_models", plan["publicationGates"])
        with self.assertRaises(ValueError):
            run_refresh(self.config)
        self.assertEqual(
            json.loads(Path(self.config["receiptPath"]).read_bytes())["status"], "gated"
        )
        self.assertFalse(Path(self.config["outputDirectory"]).exists())

    def test_failed_partial_publication_resumes_same_generation(self):
        self.add_quarter("2024-Q2")
        self.admit_xyz()
        expected = plan_refresh(self.config)["snapshotId"]
        original = atomic_write
        count = 0

        def interrupt(path, data, **kwargs):
            nonlocal count
            if kwargs.get("immutable"):
                count += 1
                if count == 3:
                    raise OSError("Fictional disk interruption")
            return original(path, data, **kwargs)

        with (
            patch("refresh_history.atomic_write", side_effect=interrupt),
            self.assertRaises(OSError),
        ):
            run_refresh(self.config)
        self.assertFalse((Path(self.config["outputDirectory"]) / "index.json").exists())
        partial = {p: p.read_bytes() for p in Path(self.config["outputDirectory"]).rglob("*.json")}
        self.assertTrue(partial)
        changed = dict(self.config, generatorRevision="different-revision")
        with self.assertRaisesRegex(ValueError, "original configuration"):
            run_refresh(changed)
        receipt = run_refresh(self.config)
        self.assertEqual(receipt["snapshotId"], expected)
        self.assertTrue(all(p.read_bytes() == raw for p, raw in partial.items()))
        verify_refresh(self.config)

    def test_explicit_new_generator_revision_creates_distinct_generation(self):
        self.config["generatorRevision"] = "reviewed-new-generator"
        receipt = run_refresh(self.config)
        self.assertEqual(receipt["generatorRevision"], "reviewed-new-generator")
        self.assertEqual(receipt["generatedAt"], self.config["generatedAt"])
        self.assertNotEqual(receipt["snapshotId"], self.baseline_index["latestSnapshotId"])

    def test_cold_bounded_input_combines_with_retained_history_then_reuses(self):
        self.admit_xyz()
        self.config["inputs"] = [dict(quarter="2024-Q2", directory=str(self.root / "2024-Q2"))]
        self.config["cacheRoot"] = str(Path(self.case.name) / "private-cache")
        self.assertEqual(plan_refresh(self.config)["projectionRequired"], ["2024-Q2"])
        receipt = run_refresh(self.config)
        self.assertEqual(receipt["computedQuarters"], ["2024-Q2"])
        self.assertEqual(receipt["reusedQuarters"], ["2024-Q1"])
        again = run_refresh(self.config)
        self.assertEqual(again["computedQuarters"], [])
        self.assertEqual(again["publicWrites"], 0)
        self.assertEqual(again["snapshotId"], receipt["snapshotId"])

    def test_unchanged_preserves_valid_noncanonical_index_bytes(self):
        run_refresh(self.config)
        path = Path(self.config["outputDirectory"]) / "index.json"
        raw = json.dumps(json.loads(path.read_bytes()), indent=2).encode()
        path.write_bytes(raw)
        self.assertEqual(run_refresh(self.config)["publicWrites"], 0)
        self.assertEqual(path.read_bytes(), raw)

    def test_cold_cache_junctions_are_rejected_before_private_writes(self):
        self.admit_xyz()
        self.config["inputs"] = [dict(quarter="2024-Q2", directory=str(self.root / "2024-Q2"))]
        for number, suffix in enumerate(
            ("quarters", "quarters/2024-Q2", "quarters/2024-Q2/existing-summary")
        ):
            with self.subTest(suffix=suffix):
                case_root = Path(self.case.name) / str(number)
                output = case_root / "public"
                output.mkdir(parents=True)
                cache_root = case_root / "private-cache"
                link = cache_root / suffix
                link.parent.mkdir(parents=True)
                if os.name == "nt":
                    result = subprocess.run(
                        ["cmd", "/c", "mklink", "/J", str(link), str(output)],
                        capture_output=True,
                        check=False,
                    )
                    if result.returncode:
                        self.skipTest("Windows junction creation unavailable")
                else:
                    link.symlink_to(output, target_is_directory=True)
                config = dict(
                    self.config,
                    cacheRoot=str(cache_root),
                    outputDirectory=str(output),
                    receiptPath=str(case_root / "private-receipt.json"),
                )
                try:
                    with (
                        patch(
                            "refresh_history.summarize_partitioned_input",
                            side_effect=AssertionError("must not summarize through a junction"),
                        ),
                        self.assertRaisesRegex(ValueError, "reparse"),
                    ):
                        run_refresh(config)
                    self.assertEqual(list(output.iterdir()), [])
                    self.assertFalse((output / "index.json").exists())
                finally:
                    if os.name == "nt":
                        link.rmdir()
                    else:
                        link.unlink()

    def test_cold_cache_writer_lock_is_preserved_and_prevents_summarization(self):
        self.admit_xyz()
        self.config["inputs"] = [dict(quarter="2024-Q2", directory=str(self.root / "2024-Q2"))]
        cache_root = Path(self.case.name) / "private-cache"
        cache_root.mkdir()
        lock = cache_root / ".publication.lock"
        lock.write_text("existing cooperative writer")
        self.config["cacheRoot"] = str(cache_root)
        with (
            patch(
                "refresh_history.summarize_partitioned_input",
                side_effect=AssertionError("must respect cache lock"),
            ),
            self.assertRaisesRegex(ValueError, "locked"),
        ):
            run_refresh(self.config)
        self.assertEqual(lock.read_text(), "existing cooperative writer")
        self.assertFalse(Path(self.config["outputDirectory"]).exists())

    def test_explicit_cutoff_does_not_open_future_retained_manifests(self):
        future = Path(self.case.name) / "cache/quarters/2025-Q1/not-present/manifest.json"
        self.config["summaryManifests"].append(str(future))
        self.config["asOfQuarter"] = "2024-Q1"
        plan = plan_refresh(self.config)
        self.assertEqual(plan["asOfQuarter"], "2024-Q1")
        self.assertEqual(plan["snapshotId"], self.baseline_index["latestSnapshotId"])
        self.assertFalse(future.exists())

    def test_corrupt_old_bytes_and_writer_lock_fail_closed(self):
        run_refresh(self.config)
        root = Path(self.config["outputDirectory"])
        (root / ".publication.lock").write_text("existing writer")
        with self.assertRaisesRegex(ValueError, "locked"):
            run_refresh(self.config)
        (root / ".publication.lock").unlink()
        index_raw = (root / "index.json").read_bytes()
        old = root / self.baseline_index["snapshots"][0]["descriptor"]["path"]
        old.write_bytes(old.read_bytes() + b" ")
        with self.assertRaises(ValueError):
            run_refresh(self.config)
        self.assertEqual((root / "index.json").read_bytes(), index_raw)

    def test_preexisting_private_or_unadvertised_files_block_publication_and_verify(self):
        for name in ("private.parquet", "unadvertised-receipt.json"):
            with self.subTest(name=name):
                root = Path(self.case.name) / name.replace(".", "-")
                config = dict(
                    self.config,
                    outputDirectory=str(root),
                    receiptPath=str(root.parent / (root.name + "-receipt.json")),
                )
                run_refresh(config)
                before = {path: path.read_bytes() for path in root.rglob("*.json")}
                unexpected = root / name
                unexpected_raw = (
                    b"private retained bytes"
                    if name.endswith("parquet")
                    else b'{"private":"receipt"}'
                )
                unexpected.write_bytes(unexpected_raw)
                with (
                    patch("refresh_history.atomic_write", wraps=atomic_write) as writer,
                    self.assertRaisesRegex(ValueError, "Public output contains"),
                ):
                    run_refresh(config)
                self.assertTrue(
                    all(
                        not Path(call.args[0]).resolve().is_relative_to(root)
                        for call in writer.call_args_list
                    )
                )
                self.assertTrue(all(path.read_bytes() == raw for path, raw in before.items()))
                self.assertEqual(unexpected.read_bytes(), unexpected_raw)
                with self.assertRaisesRegex(ValueError, "Public output contains"):
                    verify_refresh(config)

    def test_preexisting_unadvertised_json_blocks_new_generation_before_any_payload_write(self):
        run_refresh(self.config)
        root = Path(self.config["outputDirectory"])
        index_raw = (root / "index.json").read_bytes()
        extra = root / "unadvertised-receipt.json"
        extra.write_bytes(b'{"private":"receipt"}')
        self.add_quarter("2024-Q2")
        self.admit_xyz()
        before_names = {path.relative_to(root) for path in root.rglob("*")}
        with self.assertRaisesRegex(ValueError, "unadvertised JSON"):
            run_refresh(self.config)
        self.assertEqual((root / "index.json").read_bytes(), index_raw)
        self.assertEqual({path.relative_to(root) for path in root.rglob("*")}, before_names)
        self.assertEqual(extra.read_bytes(), b'{"private":"receipt"}')

    def test_explicit_pins_cutoff_and_private_public_boundaries(self):
        self.config["receiptPath"] = str(Path(self.config["outputDirectory"]) / "receipt.json")
        with self.assertRaisesRegex(ValueError, "separate"):
            plan_refresh(self.config)
        self.config["receiptPath"] = str(Path(self.case.name) / "receipt.json")
        self.config["asOfQuarter"] = "2024-Q4"
        with self.assertRaisesRegex(ValueError, "no supplied"):
            plan_refresh(self.config)
        self.config.pop("asOfQuarter")
        path = Path(self.case.name) / "catalog.json"
        path.write_text(json.dumps(dict(quarters=[])))
        self.config.pop("summaryManifests")
        self.config["catalog"] = dict(
            localRoot=str(self.root / "cache"), path=str(path), sha256="0" * 64
        )
        with self.assertRaisesRegex(ValueError, "checksum"):
            plan_refresh(self.config)

    def test_pinned_catalog_default_cutoff_and_warm_verification(self):
        self.add_quarter("2024-Q2")
        self.admit_xyz()
        entries = []
        for raw in self.config.pop("summaryManifests"):
            path = Path(raw)
            manifest = json.loads(path.read_bytes())
            entries.append(
                dict(
                    quarter=manifest["coverage"]["quarter"],
                    summaryManifestPath=path.relative_to(self.root / "cache").as_posix(),
                    summaryManifestSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    summaryInputSha256=manifest["inputSha256"],
                    coverage=manifest["coverage"],
                )
            )
        catalog = Path(self.case.name) / "catalog.json"
        catalog.write_text(json.dumps(dict(quarters=entries)))
        self.config["catalog"] = dict(
            localRoot=str(self.root / "cache"),
            path=str(catalog),
            sha256=hashlib.sha256(catalog.read_bytes()).hexdigest(),
        )
        with patch(
            "production_history.summarize_partitioned_input",
            side_effect=AssertionError("daily read"),
        ):
            receipt = run_refresh(self.config)
        self.assertEqual(receipt["asOfQuarter"], "2024-Q2")
        self.assertEqual(receipt["computedQuarters"], [])
        self.assertEqual(len(receipt["reusedQuarters"]), 2)

    def test_selection_change_requires_update_and_preserves_old_exclusions(self):
        self.config["selection"]["historicalReferenceModelIds"] = [self.mid]
        self.assertIn(
            "versioned_selection_update_required", plan_refresh(self.config)["publicationGates"]
        )
        self.config["selection"].update(
            update=dict(
                decisionVersion="fictional-reference-decision-2",
                previousSelectionSha256=self.baseline_selection_sha256,
                reason="Reviewed reference choice",
                admittedModelIds=[],
                removedModelIds=[],
            ),
        )
        self.assertEqual(plan_refresh(self.config)["publicationGates"], [])
        receipt = run_refresh(self.config)
        self.assertNotEqual(receipt["snapshotId"], self.baseline_index["latestSnapshotId"])
        self.assertEqual(digest(self.config), receipt["configurationSha256"])

    def test_new_vendor_generation_loads_through_unchanged_browser_reader(self):
        node = shutil.which("node")
        if node is None:
            self.skipTest("Node is required for the browser-reader integration gate")
        self.add_quarter("2024-Q2")
        self.admit_xyz()
        receipt = run_refresh(self.config)
        script = """
            import assert from 'node:assert/strict';
            import {readFile} from 'node:fs/promises';
            import {resolve} from 'node:path';
            import {pathToFileURL} from 'node:url';
            const {SnapshotLoader} = await import(pathToFileURL(resolve(process.argv[1], 'web/src/snapshot-loader.ts')));
            const root = process.argv[2];
            const base = 'https://publication.example/production/';
            const loader = new SnapshotLoader(base + 'index.json', async url => {
                const key = new URL(url).pathname.slice('/production/'.length);
                return new Response(new Uint8Array(await readFile(resolve(root, key))));
            });
            const index = await loader.loadIndex();
            const descriptor = await loader.loadSnapshot(index.latestSnapshotId);
            const matrix = await loader.loadMatrix(descriptor);
            assert.equal(descriptor.context.asOfQuarter, '2024-Q2');
            assert.equal(descriptor.context.versions.selection, '2.0.0');
            assert.equal(matrix.models.length, 2);
            for (const quarter of descriptor.quarters) {
                if (quarter.payload) await loader.loadQuarter(descriptor, quarter.quarter);
            }
        """
        result = subprocess.run(
            [
                node,
                "--experimental-strip-types",
                "--input-type=module",
                "-e",
                script,
                str(Path(__file__).resolve().parents[1]),
                self.config["outputDirectory"],
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(receipt["selectionDecisionVersion"], "fictional-decision-2")

    def test_excluded_new_qualified_hdd_requires_decision_without_admission(self):
        self.add_quarter("2024-Q2")
        self.config["selection"].update(
            version="2.1.0", minimumCapacityTB=1.0, excludedModelIds=[self.xyz]
        )
        plan = plan_refresh(self.config)
        self.assertEqual(plan["newQualifyingHdds"], [])
        self.assertEqual(plan["publicationGates"], ["versioned_selection_update_required"])
        self.config["selection"]["update"] = dict(
            decisionVersion="fictional-exclusion",
            previousSelectionSha256=self.baseline_selection_sha256,
            admittedModelIds=[],
            removedModelIds=[],
            reason="Owner excludes fictional model",
        )
        receipt = run_refresh(self.config)
        self.assertEqual(receipt["publicationGates"], [])

    def test_capacity_policy_change_requires_versioned_decision_without_membership_delta(self):
        self.config["selection"].update(version="2.1.0", minimumCapacityTB=1.0, excludedModelIds=[])
        plan = plan_refresh(self.config)
        self.assertEqual(plan["publicationGates"], ["versioned_selection_update_required"])
        self.config["selection"]["update"] = dict(
            decisionVersion="fictional-floor",
            previousSelectionSha256=self.baseline_selection_sha256,
            admittedModelIds=[],
            removedModelIds=[],
            reason="Owner capacity floor",
        )
        self.assertEqual(plan_refresh(self.config)["publicationGates"], [])

    def test_historical_selection_derives_qualified_cohort(self):
        self.config["selection"]["version"] = "2.1.0"
        self.config["selection"]["excludedModelIds"] = []
        self.config["selection"]["minimumCapacityTB"] = 1.0
        del self.config["selection"]["analysisModelIds"]
        self.config["selection"]["update"] = dict(
            decisionVersion="fictional-floor",
            previousSelectionSha256=self.baseline_selection_sha256,
            admittedModelIds=[],
            removedModelIds=[],
            reason="Owner historical fleet floor",
        )
        run_refresh(self.config)
        index, artifacts = load_generation(self.config["outputDirectory"])
        descriptor = json.loads(artifacts[index["snapshots"][-1]["descriptor"]["path"]])
        self.assertEqual(descriptor["context"]["versions"]["selection"], "2.1.0")
        self.assertEqual(descriptor["context"]["selection"]["analysisModelIds"], [self.mid])

    def test_unsupported_semantic_version_requires_consumer_migration(self):
        self.config["selection"]["version"] = "2.2.0"
        with self.assertRaisesRegex(ValueError, "supported"):
            run_refresh(self.config)
        self.assertFalse(Path(self.config["outputDirectory"]).exists())

    def test_cli_errors_do_not_print_rejected_private_paths(self):
        root = Path(__file__).resolve().parents[1]
        secret_path = str(Path(self.case.name) / "private-secret-config.json")
        result = subprocess.run(
            [sys.executable, str(root / "refresh_history.py"), "run", "--config", secret_path],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(secret_path, result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
