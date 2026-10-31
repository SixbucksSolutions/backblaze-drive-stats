"""Numerical and recovery checks using invented daily partitions, never downloads."""

import json
import tempfile
import unittest
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from typing import TypedDict, Unpack
from unittest.mock import patch

import polars as pl

from historical_generator import QuarterInput, bounds, generate, public_evidence
from matrix_types import RegistryDefinition, RegistryEntry
from parquet_profile import PROFILE_ID

PATTERNS = [r"^Seagate ST100TEST$"]
REGISTRY: RegistryDefinition = RegistryDefinition(
    version="test-media-v1",
    models=[
        {
            "vendor": "Seagate",
            "modelNumber": "ST100TEST",
            "mediaClass": "hdd",
            "evidence": "Fictional test HDD",
            "aliases": ["ST100TEST", "alias A"],
        },
        {
            "vendor": "XYZ",
            "modelNumber": "XYZ26TB-01",
            "mediaClass": "hdd",
            "evidence": "Fictional vendor specification",
            "aliases": ["XYZ26TB-01"],
        },
        {
            "vendor": "Example",
            "modelNumber": "SSD",
            "mediaClass": "non_hdd",
            "evidence": "Fictional SSD",
            "aliases": ["SSD"],
        },
    ],
)
SCHEMA = dict(
    date=pl.String,
    serial_number=pl.String,
    model=pl.String,
    failure=pl.Float64,
    capacity_bytes=pl.Float64,
    datacenter=pl.String,
)


def rows(
    day,
    count,
    model="ST100TEST",
    failure=0,
    capacity=16e12,
    prefix="s",
    location: str | None = " iad1 ",
):
    return [
        dict(
            date=str(day),
            serial_number=f"{prefix}{i}",
            model=model,
            failure=float(failure if i == 0 else 0),
            capacity_bytes=capacity,
            datacenter=location,
        )
        for i in range(count)
    ]


def make_input(root, q, observations, missing=()):
    directory = root / q
    directory.mkdir()
    start, end = bounds(q)
    records = []
    for number in range((end - start).days + 1):
        day = start + timedelta(days=number)
        if number in missing:
            continue
        frame = pl.DataFrame(observations.get(number, []), schema=SCHEMA)
        path = directory / f"{day}.parquet"
        frame.write_parquet(path)
        records.append(dict(date=str(day), rowCount=frame.height, outputFile=path.name))
    (directory / "import-metadata.json").write_text(
        json.dumps(dict(schemaVersion=1, sourceZipSha256="1" * 64, files=records))
    )
    return QuarterInput(q, directory)


class GenerateArguments(TypedDict, total=False):
    inputs: list[QuarterInput]
    cache_root: Path
    as_of: str
    history_start: str
    registry: RegistryDefinition
    patterns: list[str]
    generator_revision: str
    kind: str
    output_root: Path


class HistoricalGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.inputs = []
        cls.inputs.append(
            make_input(cls.root, "2023-Q4", {0: rows(bounds("2023-Q4")[0], 100, failure=1)})
        )
        first = bounds("2024-Q1")[0]
        cls.inputs.append(
            make_input(
                cls.root,
                "2024-Q1",
                {
                    0: rows(first, 2000, failure=1)
                    + rows(first, 2200, "SSD", prefix="ssd")
                    + rows(first, 2300, "MYSTERY", prefix="u"),
                    1: rows(first + timedelta(days=1), 1, "alias A", capacity=18e12, location=""),
                    2: rows(
                        first + timedelta(days=2), 1, "alias A", capacity=18e12, location="phx1"
                    ),
                },
            )
        )
        cls.inputs.append(make_input(cls.root, "2024-Q2", {0: rows(bounds("2024-Q2")[0], 1999)}))
        cls.inputs.append(
            make_input(
                cls.root,
                "2024-Q3",
                {
                    0: rows(bounds("2024-Q3")[0], 2100, failure=1)
                    + rows(
                        bounds("2024-Q3")[0],
                        5000,
                        "XYZ26TB-01",
                        capacity=26e12,
                        prefix="x",
                        location=None,
                    )
                },
            )
        )
        cls.matrix, cls.supporting, cls.report = cls.run_generate()

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    @classmethod
    def run_generate(cls, **kwargs: Unpack[GenerateArguments]):
        values: GenerateArguments = GenerateArguments(
            inputs=cls.inputs,
            cache_root=cls.root / "cache",
            as_of="2024-Q3",
            history_start="2023-Q4",
            registry=REGISTRY,
            patterns=PATTERNS,
            generator_revision="test-revision",
            kind="sample",
        )
        values.update(kwargs)
        return generate(**values)

    def test_inventory_before_selection_new_vendor_and_exact_rates(self):
        inventory = {i["modelNumber"]: i for i in self.matrix["selection"]["inventory"]}
        self.assertEqual(inventory["SSD"]["maxQuarterCount"], 2200)
        self.assertEqual(inventory["MYSTERY"]["mediaClass"], "unclassified")
        self.assertEqual(len(self.report["pendingClassification"]), 1)
        self.assertEqual([m["vendor"] for m in self.matrix["models"]], ["Seagate", "XYZ"])
        model = self.matrix["models"][0]
        self.assertEqual(
            model["preEligibilityComponents"], dict(failures=1, driveDays=100, complete=True)
        )
        initial = model["cells"][0]
        self.assertEqual(initial["metrics"]["count"], 2000)
        self.assertEqual(initial["quarterComponents"]["driveDays"], 2002)
        self.assertAlmostEqual(initial["metrics"]["afr"], 2 * 36500 / 2102, places=11)
        self.assertEqual(initial["metrics"]["new"], 1900)
        self.assertEqual(model["cells"][1]["state"], "below_threshold")
        returned = model["cells"][2]
        self.assertEqual(returned["relativeQuarter"], 3)
        self.assertEqual(returned["deltaBaseline"]["elapsedQuarters"], 2)
        self.assertEqual(returned["metrics"]["populationDelta"], 100)
        self.assertEqual(
            returned["cumulativeComponents"], dict(failures=3, driveDays=6201, complete=True)
        )
        self.assertEqual(returned["metrics"]["retired"], 1)
        self.assertEqual(model["cells"][3]["state"], "snapshot_end")

    def test_all_alias_capacity_mode_and_latest_location(self):
        quarter = self.supporting["quarters"][1]
        selected, all_supplied = quarter["scopes"]
        self.assertEqual(selected["totals"]["driveCount"], 2000)
        self.assertEqual(selected["totals"]["capacityTb"], 32000)
        locations = {r["datacenter"]: r for r in all_supplied["datacenters"]}
        self.assertEqual(locations["PHX1"]["driveCount"], 1)
        self.assertEqual(sum(r["driveCount"] for r in locations.values()), 6500)
        latest = self.supporting["quarters"][-1]["scopes"][1]
        self.assertEqual(
            next(r for r in latest["datacenters"] if r["datacenter"] == "Unknown")["driveCount"],
            5000,
        )

    def test_capacity_tie_smallest_unavailable_capacity_and_repeated_failure_flags(self):
        root = self.root / "capacity"
        root.mkdir(exist_ok=True)
        q = "2024-Q1"
        day = bounds(q)[0]
        item = make_input(
            root,
            q,
            {
                0: rows(day, 2000, failure=1) + rows(day, 5, "ST200TEST", capacity=0, prefix="low"),
                1: rows(day + timedelta(days=1), 2000, "alias A", failure=1, capacity=18e12),
            },
        )
        matrix, supporting, _ = self.run_generate(
            inputs=[item],
            history_start=q,
            as_of=q,
            patterns=PATTERNS + [r"^Seagate ST200TEST$"],
            cache_root=root / "cache",
        )
        metrics = matrix["models"][0]["cells"][0]["metrics"]
        self.assertEqual(metrics["failed"], 2)
        self.assertEqual(metrics["retired"], 2)
        scope = supporting["quarters"][0]["scopes"][0]
        self.assertEqual(scope["totals"]["driveCount"], 2005)
        self.assertIsNone(scope["totals"]["capacityTb"])
        self.assertEqual(
            next(r for r in scope["models"] if r["model"] == "ST100TEST")["measures"]["capacityTb"],
            32000,
        )

    def test_cache_reuse_avoids_daily_parquet_queries(self):
        with patch(
            "historical_generator.pl.scan_parquet",
            side_effect=AssertionError("daily source parsed on cache hit"),
        ):
            matrix, _, report = self.run_generate()
        self.assertEqual(report["reusedQuarters"], ["2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3"])
        self.assertEqual(matrix["models"], self.matrix["models"])

    def test_source_correction_only_recomputes_changed_quarter(self):
        path = self.inputs[2].directory / "2024-04-01.parquet"
        old = path.read_bytes()
        try:
            frame = pl.read_parquet(path).with_columns(
                pl.when(pl.col("serial_number") == "s0")
                .then(1.0)
                .otherwise(pl.col("failure"))
                .alias("failure")
            )
            frame.write_parquet(path)
            matrix, _, report = self.run_generate()
            self.assertEqual(report["computedQuarters"], ["2024-Q2"])
            self.assertEqual(matrix["models"][0]["cells"][2]["cumulativeComponents"]["failures"], 4)
            self.assertNotEqual(matrix["snapshot"]["id"], self.matrix["snapshot"]["id"])
        finally:
            path.write_bytes(old)

    def test_new_quarter_uses_summaries_and_revises_retirement(self):
        root = self.root / "new-quarter"
        root.mkdir(exist_ok=True)
        q = "2024-Q4"
        day = bounds(q)[0]
        item = make_input(root, q, {0: rows(day, 2000) + rows(day, 5000, "XYZ26TB-01", prefix="x")})
        original = pl.scan_parquet

        def only_new(path, *args, **kwargs):
            self.assertIn("2024-Q4", str(path))
            return original(path, *args, **kwargs)

        with patch("historical_generator.pl.scan_parquet", side_effect=only_new):
            matrix, _, report = self.run_generate(inputs=self.inputs + [item], as_of=q)
        self.assertEqual(report["computedQuarters"], [q])
        self.assertEqual(report["reusedQuarters"], ["2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3"])
        self.assertEqual(self.matrix["models"][0]["cells"][2]["metrics"]["retired"], 1)
        self.assertEqual(matrix["models"][0]["cells"][2]["metrics"]["retired"], 100)

    def test_later_return_revises_earlier_last_seen_and_keeps_old_snapshot(self):
        earlier, _, _ = self.run_generate(as_of="2024-Q2")
        self.assertEqual(earlier["models"][0]["cells"][0]["metrics"]["retired"], 1)
        self.assertEqual(self.matrix["models"][0]["cells"][0]["metrics"]["retired"], 0)
        self.assertEqual(earlier["models"][0]["cells"][2]["state"], "snapshot_end")

    def test_identical_generation_republishes_identical_bytes(self):
        from history_storage import publish_generation

        output = self.root / "published"
        first = publish_generation(output, self.matrix, self.supporting)
        matrix, supporting, _ = self.run_generate()
        self.assertEqual(matrix, self.matrix)
        second = publish_generation(output, matrix, supporting)
        self.assertEqual(first, second)

    def test_missing_quarter_preserves_elapsed_time_and_invalidates_rate(self):
        registry = deepcopy(REGISTRY)
        registry["models"][1]["mediaClass"] = "unclassified"
        matrix, supporting, _ = self.run_generate(
            inputs=[i for i in self.inputs if i.quarter != "2024-Q2"], registry=registry
        )
        cells = matrix["models"][0]["cells"]
        self.assertEqual(cells[1]["state"], "source_missing")
        self.assertIsNone(cells[2]["metrics"]["afr"])
        self.assertIsNone(cells[0]["metrics"]["retired"])
        self.assertEqual(cells[2]["metrics"]["populationDelta"], 100)
        self.assertEqual(
            supporting["quarters"][-1]["scopes"][0]["capacityDeltaReason"], "coverage_gap"
        )

    def test_pre_anchor_gap_blocks_new_discovery_publication(self):
        with self.assertRaisesRegex(ValueError, "pre-anchor history"):
            self.run_generate(inputs=[i for i in self.inputs if i.quarter != "2024-Q2"])

    def test_damaged_cache_object_rebuilds_only_affected_quarter(self):
        directory = next((self.root / "cache" / "quarters" / "2023-Q4").iterdir())
        (directory / "drives.parquet").write_bytes(b"interrupted or corrupted object")
        _, _, report = self.run_generate()
        self.assertEqual(report["computedQuarters"], ["2023-Q4"])

    def test_malformed_cache_manifest_shapes_recompute(self):
        directory = next((self.root / "cache" / "quarters" / "2023-Q4").iterdir())
        for value in ([], None, {"objects": []}):
            with self.subTest(shape=type(value).__name__):
                (directory / "manifest.json").write_text(json.dumps(value))
                _, _, report = self.run_generate()
                self.assertEqual(report["computedQuarters"], ["2023-Q4"])

    def test_private_evidence_rejected_without_echoing_secrets(self):
        for evidence in (
            "C:\\private\\spec.pdf",
            "/private/spec.pdf",
            "https://example.com/spec?token=DO-NOT-ECHO",
            "https://user:DO-NOT-ECHO@example.com/spec",
            "https://127.0.0.1/spec",
            "https://example.com/spec#DO-NOT-ECHO",
            "file:///private/spec.pdf",
        ):
            with self.subTest(kind="private evidence"):
                registry = deepcopy(REGISTRY)
                registry["models"][1]["evidence"] = evidence
                with self.assertRaisesRegex(ValueError, "public-safe") as caught:
                    self.run_generate(registry=registry)
                self.assertNotIn("DO-NOT-ECHO", str(caught.exception))
        self.assertEqual(
            public_evidence("Manufacturer specification: https://example.com/specifications/model"),
            "Manufacturer specification: https://example.com/specifications/model",
        )

    def test_damaged_stamp_recovers_only_from_validated_immutable_artifact(self):
        from history_storage import publish_generation

        output = self.root / "stamp-recovery-published"
        publish_generation(output, self.matrix, self.supporting)
        stamp = self.root / "cache" / "generations" / (self.matrix["snapshot"]["id"] + ".json")
        for content in ("{", "{}", "[]", '{"generatedAt":"invalid"}'):
            stamp.write_text(content)
            with self.assertRaisesRegex(ValueError, "Damaged generation stamp"):
                self.run_generate()
            matrix, supporting, _ = self.run_generate(output_root=output)
            self.assertEqual(matrix, self.matrix)
            publish_generation(output, matrix, supporting)

    def test_incomplete_partitions_do_not_measure_population_decline(self):
        root = self.root / "incomplete"
        root.mkdir(exist_ok=True)
        q = "2024-Q2"
        item = make_input(root, q, {0: rows(bounds(q)[0], 1999)}, missing=[15])
        registry = deepcopy(REGISTRY)
        registry["models"][1]["mediaClass"] = "unclassified"
        matrix, supporting, _ = self.run_generate(
            inputs=[self.inputs[0], self.inputs[1], item, self.inputs[3]], registry=registry
        )
        self.assertEqual(matrix["models"][0]["cells"][1]["state"], "source_incomplete")
        self.assertIsNone(supporting["quarters"][2]["scopes"][0]["totals"]["driveCount"])

    def test_receipt_dates_and_rows_are_verified_not_assumed(self):
        root = self.root / "misdated"
        root.mkdir(exist_ok=True)
        q = "2024-Q1"
        item = make_input(root, q, {0: rows(bounds(q)[0] + timedelta(days=1), 2000)})
        with self.assertRaisesRegex(ValueError, "partition date"):
            self.run_generate(inputs=[item], history_start=q, as_of=q, cache_root=root / "cache")

    def test_registry_changes_media_without_daily_rescan(self):
        registry = deepcopy(REGISTRY)
        registry["version"] = "test-media-v2"
        registry["models"][2]["mediaClass"] = "unclassified"
        with patch(
            "historical_generator.pl.scan_parquet",
            side_effect=AssertionError("classification should use cached summaries"),
        ):
            matrix, _, _ = self.run_generate(registry=registry)
        self.assertEqual(
            next(i for i in matrix["selection"]["inventory"] if i["modelNumber"] == "SSD")[
                "mediaClass"
            ],
            "unclassified",
        )

    def legacy_layout_copy(self, destination):
        """Independent legacy layout: same verified data, reverse physical order."""
        from historical_generator import digest, file_sha

        original = {}
        for item in self.inputs:
            source_manifest = next(
                (self.root / "cache" / "quarters" / item.quarter).glob("*/manifest.json")
            )
            manifest = json.loads(source_manifest.read_text())
            target = destination / "quarters" / item.quarter / manifest["inputSha256"]
            target.mkdir(parents=True)
            for name in manifest["objects"]:
                pl.read_parquet(source_manifest.parent / name).reverse().write_parquet(
                    target / name, compression="zstd"
                )
                manifest["objects"][name] = file_sha(target / name)
                original[target / name] = file_sha(target / name)
            manifest.pop("parquetProfile", None)
            manifest.pop("manifestContentSha256")
            manifest["manifestContentSha256"] = digest(manifest)
            (target / "manifest.json").write_text(json.dumps(manifest))
            original[target / "manifest.json"] = file_sha(target / "manifest.json")
        return original

    def test_legacy_metadata_upgrades_from_verified_summaries_without_daily_scans(self):
        import pyarrow.parquet as pq

        from historical_generator import file_sha

        cache = self.root / "physical-upgrade-cache"
        original = self.legacy_layout_copy(cache)
        with patch(
            "historical_generator.pl.scan_parquet",
            side_effect=AssertionError("Layout upgrade cannot rescan daily observations"),
        ):
            matrix, supporting, report = self.run_generate(cache_root=cache)
            again, again_supporting, again_report = self.run_generate(cache_root=cache)
        self.assertEqual(report["computedQuarters"], [])
        self.assertEqual(len(report["reusedQuarters"]), 4)
        self.assertEqual(matrix, again)
        self.assertEqual(supporting, again_supporting)
        self.assertEqual(supporting, self.supporting)
        self.assertEqual(
            matrix["provenance"]["sourceManifestSha256"],
            self.matrix["provenance"]["sourceManifestSha256"],
        )
        self.assertEqual(again_report["computedQuarters"], [])
        for path, checksum in original.items():
            self.assertEqual(file_sha(path), checksum)
        manifests = list(cache.glob(f"quarters/*/*.{PROFILE_ID}/manifest.json"))
        self.assertEqual(len(manifests), 4)
        for path in manifests:
            manifest = json.loads(path.read_text())
            self.assertEqual(manifest["parquetProfile"], PROFILE_ID)
            for name in manifest["objects"]:
                self.assertEqual(
                    pq.read_metadata(path.parent / name)
                    .metadata[b"backblaze.parquet_profile"]
                    .decode(),
                    PROFILE_ID,
                )

    def test_failed_physical_upgrade_does_not_fall_back_to_daily_recomputation(self):
        cache = self.root / "failed-physical-upgrade-cache"
        self.legacy_layout_copy(cache)
        with (
            patch(
                "historical_generator.persist_summary_layout",
                side_effect=OSError("simulated write failure"),
            ),
            patch(
                "historical_generator.pl.scan_parquet",
                side_effect=AssertionError("Unexpected daily rescan"),
            ),
            self.assertRaisesRegex(OSError, "simulated write failure"),
        ):
            self.run_generate(cache_root=cache)

    def test_new_vendor_registry_entry_and_quarter_preserve_old_cache(self):
        cache = self.root / "new-registry-cache"
        old_registry = deepcopy(REGISTRY)
        old_registry["models"] = [r for r in old_registry["models"] if r["vendor"] != "XYZ"]
        self.run_generate(
            inputs=self.inputs[:3], as_of="2024-Q2", registry=old_registry, cache_root=cache
        )
        original = pl.scan_parquet

        def only_new(path, *args, **kwargs):
            self.assertIn("2024-Q3", str(path))
            return original(path, *args, **kwargs)

        with patch("historical_generator.pl.scan_parquet", side_effect=only_new):
            matrix, _, report = self.run_generate(cache_root=cache)
        self.assertEqual(report["computedQuarters"], ["2024-Q3"])
        self.assertEqual(report["reusedQuarters"], ["2023-Q4", "2024-Q1", "2024-Q2"])
        self.assertIn("XYZ", [m["vendor"] for m in matrix["models"]])

    def test_actual_alias_remap_rebuilds_only_quarters_using_that_name(self):
        cache = self.root / "remap-cache"
        self.run_generate(cache_root=cache)
        registry = deepcopy(REGISTRY)
        registry["models"][0]["aliases"].remove("alias A")
        registry["models"].append(
            RegistryEntry(
                vendor="NewVendor",
                modelNumber="ALIAS-OTHER",
                aliases=["alias A"],
                mediaClass="unclassified",
                evidence="Fictional revised identity evidence",
            )
        )
        original = pl.scan_parquet

        def only_affected(path, *args, **kwargs):
            self.assertIn("2024-Q1", str(path))
            return original(path, *args, **kwargs)

        with patch("historical_generator.pl.scan_parquet", side_effect=only_affected):
            matrix, _, report = self.run_generate(registry=registry, cache_root=cache)
        self.assertEqual(report["computedQuarters"], ["2024-Q1"])
        self.assertEqual(report["reusedQuarters"], ["2023-Q4", "2024-Q2", "2024-Q3"])
        self.assertEqual(matrix["models"][0]["cells"][0]["quarterComponents"]["driveDays"], 2000)

    def test_duplicate_alias_identity_rejected(self):
        root = self.root / "duplicate"
        root.mkdir(exist_ok=True)
        q = "2024-Q1"
        first = bounds(q)[0]
        item = make_input(root, q, {0: rows(first, 2000) + rows(first, 1, "alias A")})
        with self.assertRaisesRegex(ValueError, "Duplicate normalized"):
            self.run_generate(inputs=[item], history_start=q, as_of=q, cache_root=root / "cache")

    def test_cutoff_before_invalid_future_fields(self):
        root = self.root / "future"
        root.mkdir(exist_ok=True)
        q = "2024-Q1"
        first = bounds(q)[0]
        item = make_input(
            root,
            q,
            {
                0: rows(first, 2000)
                + [
                    dict(
                        date="2024-04-01",
                        serial_number=None,
                        model=None,
                        failure=9.0,
                        capacity_bytes=None,
                        datacenter=None,
                    )
                ]
            },
        )
        path = item.directory / f"{first}.parquet"
        pl.read_parquet(path).with_columns(
            pl.when(pl.col("date") == "2024-04-01")
            .then(pl.lit("not-a-number"))
            .otherwise(pl.col("failure").cast(pl.String))
            .alias("failure")
        ).write_parquet(path)
        matrix, _, _ = self.run_generate(
            inputs=[item], history_start=q, as_of=q, cache_root=root / "cache"
        )
        self.assertEqual(matrix["models"][0]["cells"][0]["quarterComponents"]["driveDays"], 2000)


if __name__ == "__main__":
    unittest.main()
