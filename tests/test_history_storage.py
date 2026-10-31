"""No cloud calls: corruption/retry, isolation and immutable snapshot tests."""

import io
import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from history_storage import (
    B2ObjectStore,
    LocalObjectStore,
    atomic_write,
    build_transfer_manifest,
    digest,
    object_key,
    publication_lock,
    publish_generation,
    transfer_verified,
)
from sync_history_cache import owner_cache_client

ROOT = Path(__file__).resolve().parents[1]


def paired_fixtures():
    matrix = json.loads((ROOT / "fixtures/matrix/synthetic-earlier.json").read_text())
    snapshot = matrix["snapshot"]
    snapshot["immutablePath"] = f"snapshots/{snapshot['id']}/matrix.json"
    selected = set(matrix["selection"]["resolvedModelIds"])
    periods = []
    for coverage in matrix["coverage"]["quarters"]:
        quarter = coverage["quarter"]
        all_rows = []
        for item in matrix["selection"]["inventory"]:
            block = next((m for m in matrix["models"] if m["modelId"] == item["modelId"]), None)
            cell = (
                next((c for c in block["cells"] if c["quarter"] == quarter), None)
                if block
                else None
            )
            if cell:
                count, new = cell["observations"]["count"], cell["observations"]["new"]
            elif block:
                count, new = 1999, 1999
            else:
                count = (
                    min(item["maxQuarterCount"], 500)
                    if item["firstQualifyingQuarter"] is None
                    else (
                        item["maxQuarterCount"] if quarter >= item["firstQualifyingQuarter"] else 0
                    )
                )
                new = count if quarter == (item["firstQualifyingQuarter"] or "2023-Q4") else 0
            measures = {"driveCount": count, "newDrives": new, "capacityTb": count * 12}
            all_rows.append(
                {
                    "id": item["modelId"],
                    "manufacturer": item["vendor"],
                    "model": item["modelNumber"],
                    "measures": measures,
                }
            )
        scopes = []
        for scope_id in ("selected_hdd", "all_supplied"):
            rows = [
                deepcopy(r) for r in all_rows if scope_id == "all_supplied" or r["id"] in selected
            ]
            totals = {
                key: sum(r["measures"][key] for r in rows)
                for key in ("driveCount", "newDrives", "capacityTb")
            }
            manufacturers = []
            if scope_id == "selected_hdd":
                for name in sorted({r["manufacturer"] for r in rows}):
                    amounts = {
                        key: sum(r["measures"][key] for r in rows if r["manufacturer"] == name)
                        for key in totals
                    }
                    manufacturers.append(
                        {
                            "manufacturer": name,
                            "measures": amounts,
                            **{
                                share: amounts[key] / totals[key] if totals[key] else None
                                for key, share in (
                                    ("driveCount", "populationShare"),
                                    ("newDrives", "newShare"),
                                    ("capacityTb", "capacityShare"),
                                )
                            },
                        }
                    )
            previous = (
                next((s for s in periods[-1]["scopes"] if s["scopeId"] == scope_id), None)
                if periods
                else None
            )
            scopes.append(
                {
                    "scopeId": scope_id,
                    "totals": totals,
                    "capacityDeltaTb": totals["capacityTb"] - previous["totals"]["capacityTb"]
                    if previous
                    else None,
                    "capacityDeltaReason": None if previous else "no_previous_quarter",
                    "models": rows,
                    "manufacturers": manufacturers,
                    "datacenters": [
                        {
                            "datacenter": "IAD1",
                            "driveCount": totals["driveCount"],
                            "capacityTb": totals["capacityTb"],
                        }
                    ]
                    if scope_id == "all_supplied"
                    else [],
                    "knownLocationShare": 1
                    if scope_id == "all_supplied" and totals["driveCount"]
                    else None,
                }
            )
        periods.append(
            {"quarter": quarter, "coverage": "complete", "coverageReason": None, "scopes": scopes}
        )
    supporting = {
        "artifactType": "supporting-history",
        "schemaVersion": 1,
        "snapshotId": snapshot["id"],
        "asOfQuarter": snapshot["asOfQuarter"],
        "sourceManifestSha256": matrix["provenance"]["sourceManifestSha256"],
        "versions": {
            "selection": matrix["versions"]["selection"],
            "normalization": matrix["versions"]["normalization"],
            "metrics": "supporting-v1",
            "capacity": "positive-observation-mode-tie-smallest-v1",
        },
        "provenance": {
            "kind": "sample",
            "sourceUrl": "https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data",
            "attribution": "Synthetic test only, no Backblaze measurements.",
            "historyStart": "2023-10-01",
            "selectionPatterns": matrix["selection"]["patterns"],
            "selectionSha256": matrix["selection"]["patternsSha256"],
            "seedAsOfQuarter": matrix["selection"]["seedAsOfQuarter"],
            "discoveryRule": matrix["selection"]["discoveryRule"],
            "classificationVersion": matrix["selection"]["classificationVersion"],
            "selectedModelIds": sorted(selected),
            "notes": ["Invented supporting aggregates for publication/recovery tests."],
        },
        "quarters": periods,
    }
    return matrix, supporting


class MissingObjectError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.response = {"Error": {"Code": "NoSuchKey"}}


class FakeB2:
    def __init__(self):
        self.objects = {}

    def get_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise MissingObjectError("not exposed")
        data = self.objects[Bucket, Key]
        return {"Body": io.BytesIO(data), "ContentLength": len(data), "ETag": "not-a-content-hash"}

    def put_object(self, *, Bucket, Key, Body, Metadata):
        assert Metadata["sha256"] == digest(Body)
        self.objects[Bucket, Key] = Body


class HistoryStorageTests(unittest.TestCase):
    def test_round_trip_resume_corruption_and_relative_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, recovered = LocalObjectStore(root / "a"), LocalObjectStore(root / "b")
            source.write("quarters/2026-Q2/drives.parquet", b"private-summary")
            source.write("quarters/2026-Q2/manifest.json", b"manifest")
            manifest = build_transfer_manifest(
                source.root, ["quarters/2026-Q2/drives.parquet", "quarters/2026-Q2/manifest.json"]
            )
            client = FakeB2()
            remote = B2ObjectStore(client, "owner-test-cache", "cache-v1")
            self.assertEqual(transfer_verified(source, remote, manifest)["copied"], 2)
            self.assertEqual(transfer_verified(source, remote, manifest)["reused"], 2)
            client.objects["owner-test-cache", "cache-v1/quarters/2026-Q2/drives.parquet"] = (
                b"corrupt"
            )
            self.assertEqual(transfer_verified(source, remote, manifest)["copied"], 1)
            transfer_verified(remote, recovered, manifest)
            self.assertEqual(
                build_transfer_manifest(recovered.root, [r["path"] for r in manifest["files"]]),
                manifest,
            )
            source.write("quarters/2026-Q2/drives.parquet", b"changed")
            with self.assertRaisesRegex(ValueError, "Source cache object"):
                transfer_verified(source, remote, manifest)

    def test_failed_transfer_has_no_success_and_retry_reuses_completed_objects(self):
        with tempfile.TemporaryDirectory() as directory:
            source = LocalObjectStore(Path(directory) / "source")
            target = LocalObjectStore(Path(directory) / "target")
            source.write("a", b"a")
            source.write("b", b"b")
            manifest = build_transfer_manifest(source.root, ["a", "b"])
            real_write = target.write

            def fail_second(key, data):
                if key == "b":
                    raise OSError("simulated interruption")
                real_write(key, data)

            with patch.object(target, "write", side_effect=fail_second):
                with self.assertRaises(OSError):
                    transfer_verified(source, target, manifest)
            self.assertEqual(transfer_verified(source, target, manifest)["reused"], 1)
            with patch.object(
                target, "write", side_effect=lambda key, data: real_write(key, b"corrupt")
            ):
                target.path("b").unlink()
                with self.assertRaisesRegex(ValueError, "failed content verification"):
                    transfer_verified(source, target, manifest)

    def test_paths_source_bucket_credentials_and_limits(self):
        for bad in (
            "../secret",
            "/absolute",
            "C:/private",
            "a\\b",
            "a//b",
            "a/./b",
            "a/a.",
            "a/a ",
            "CON",
            "a/LPT1.parquet",
        ):
            with self.subTest(key=bad), self.assertRaises(ValueError):
                object_key(bad)
        for bucket in ("drivestats-iceberg", "Backblaze-Hard-Drive-Data"):
            with self.assertRaises(ValueError):
                B2ObjectStore(None, bucket, "cache")
        with self.assertRaises(ValueError):
            owner_cache_client("https://example.com", "us-west-004")
        with (
            patch.dict("os.environ", {}, clear=True),
            self.assertRaisesRegex(ValueError, "Dedicated"),
        ):
            owner_cache_client("https://s3.us-west-004.backblazeb2.com", "us-west-004")
        with tempfile.TemporaryDirectory() as directory:
            store = LocalObjectStore(Path(directory), max_object_bytes=1)
            with self.assertRaises(ValueError):
                store.write("file", b"too big")

    def test_pair_publication_retry_conflict_and_writer_lock(self):
        matrix, supporting = paired_fixtures()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = publish_generation(root, matrix, supporting)
            self.assertEqual(publish_generation(root, matrix, supporting), entry)
            index_before = (root / "index.json").read_bytes()
            changed = deepcopy(matrix)
            changed["provenance"]["projectAttribution"] += " corrected"
            with self.assertRaisesRegex(ValueError, "different content"):
                publish_generation(root, changed, supporting)
            self.assertEqual((root / "index.json").read_bytes(), index_before)
            with publication_lock(root), self.assertRaisesRegex(ValueError, "locked"):
                publish_generation(root, matrix, supporting)
            self.assertFalse((root / ".publication.lock").exists())
            for field in ("snapshotId", "sourceManifestSha256"):
                bad = deepcopy(supporting)
                bad[field] = "a" * 64
                with self.assertRaises(ValueError):
                    publish_generation(root, matrix, bad)

    def test_immutable_creation_cannot_overwrite_a_racing_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "immutable.json"

            def attempt(value):
                try:
                    atomic_write(path, value, immutable=True)
                    return True
                except ValueError:
                    return False

            with ThreadPoolExecutor(2) as executor:
                outcomes = list(executor.map(attempt, [b"one", b"two"]))
            self.assertEqual(sum(outcomes), 1)
            self.assertIn(path.read_bytes(), [b"one", b"two"])

    def test_incomplete_generation_retries_without_switching_index(self):
        matrix, supporting = paired_fixtures()
        real_write = atomic_write

        def interrupt(path, data, *, immutable=False):
            if path.name == "supporting.json":
                raise OSError("simulated interruption")
            real_write(path, data, immutable=immutable)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("history_storage.atomic_write", side_effect=interrupt):
                with self.assertRaises(OSError):
                    publish_generation(root, matrix, supporting)
            self.assertFalse((root / "index.json").exists())
            self.assertFalse((root / ".publication.lock").exists())
            entry = publish_generation(root, matrix, supporting)
            self.assertEqual(json.loads((root / "index.json").read_text())["latest"], entry["id"])

    def test_damaged_index_and_old_object_are_not_retained_as_valid(self):
        matrix, supporting = paired_fixtures()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = publish_generation(root, matrix, supporting)
            index_path = root / "index.json"
            original_index = index_path.read_bytes()
            index_path.write_text('{"schemaVersion":1,"schemaVersion":2}')
            with self.assertRaisesRegex(ValueError, "duplicate|Duplicate"):
                publish_generation(root, matrix, supporting)
            index_path.write_bytes(original_index)
            (root / entry["matrix"]["url"]).write_text("corrupt")
            with self.assertRaisesRegex(ValueError, "Indexed generation content"):
                publish_generation(root, matrix, supporting)
            self.assertEqual(index_path.read_bytes(), original_index)

    def test_valid_artifacts_with_disagreeing_model_measures_cannot_be_paired(self):
        matrix, supporting = paired_fixtures()
        period = supporting["quarters"][1]
        for scope in period["scopes"]:
            scope["models"][0]["measures"]["newDrives"] -= 1
            scope["totals"]["newDrives"] -= 1
            if scope["manufacturers"]:
                scope["manufacturers"][0]["measures"]["newDrives"] -= 1
        with (
            tempfile.TemporaryDirectory() as directory,
            self.assertRaisesRegex(ValueError, "model observations differ"),
        ):
            publish_generation(Path(directory), matrix, supporting)

    def test_windows_case_aliases_reject_before_any_copy(self):
        rows = [
            {"path": key, "sizeBytes": 1, "sha256": digest(data)}
            for key, data in (("A", b"a"), ("a", b"b"))
        ]
        source = FakeB2()
        remote = B2ObjectStore(source, "owner-test-cache", "prefix")
        with (
            tempfile.TemporaryDirectory() as directory,
            self.assertRaisesRegex(ValueError, "Invalid transfer"),
        ):
            transfer_verified(
                remote,
                LocalObjectStore(Path(directory)),
                {"schemaVersion": 1, "kind": "private-history-cache", "files": rows},
            )
        self.assertEqual(source.objects, {})

    def test_external_client_and_body_value_errors_are_sanitized(self):
        remote = B2ObjectStore(FakeB2(), "owner-test-cache", "prefix")
        marker = "private-url-secret"
        for method in ("get_object", "put_object"):
            with patch.object(remote.client, method, side_effect=ValueError(marker)):
                with self.assertRaises(ValueError) as failure:
                    remote.read("a") if method == "get_object" else remote.write("a", b"data")
                self.assertNotIn(marker, str(failure.exception))

        class BadBody(io.BytesIO):
            def read(self, *_):
                raise ValueError(marker)

        with patch.object(
            remote.client, "get_object", return_value={"Body": BadBody(), "ContentLength": 1}
        ):
            with self.assertRaises(ValueError) as failure:
                remote.read("a")
            self.assertNotIn(marker, str(failure.exception))

    def test_lowercase_rfc3339_timestamp_publishes_and_retries(self):
        matrix, supporting = paired_fixtures()
        matrix["snapshot"]["generatedAt"] = "2026-10-30t12:00:00z"
        with tempfile.TemporaryDirectory() as directory:
            first = publish_generation(Path(directory), matrix, supporting)
            self.assertEqual(publish_generation(Path(directory), matrix, supporting), first)


if __name__ == "__main__":
    unittest.main()
