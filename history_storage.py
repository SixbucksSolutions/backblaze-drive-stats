"""Verified private cache copies and immutable, paired public snapshot publication."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from threading import Event

from jsonschema import FormatChecker

MAX_OBJECT_BYTES = 128 * 1024 * 1024


def object_key(value: str) -> str:
    if (
        not isinstance(value, str)
        or not value
        or value.startswith("/")
        or any(character in value for character in "\\:\x00\r\n")
        or any(part in {"", ".", ".."} for part in value.split("/"))
    ):
        raise ValueError("Object paths must be safe relative POSIX paths")
    reserved = {"CON", "PRN", "AUX", "NUL"} | {
        f"{prefix}{n}" for prefix in ("COM", "LPT") for n in range(1, 10)
    }
    if not re.fullmatch(r"[A-Za-z0-9._/-]+", value) or any(
        part.endswith((".", " ")) or part.split(".")[0].upper() in reserved
        for part in value.split("/")
    ):
        raise ValueError("Object keys must use portable ASCII names without Windows aliases")
    return value


def timestamp(value: str) -> datetime:
    if not isinstance(value, str) or not FormatChecker().conforms(value, "date-time"):
        raise ValueError("Invalid generation timestamp")
    try:
        return datetime.fromisoformat(value.upper().replace("Z", "+00:00")).astimezone(UTC)
    except TypeError, ValueError:
        raise ValueError("Invalid generation timestamp") from None


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: dict) -> bytes:
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    ).encode()


def atomic_write(path: Path, data: bytes, *, immutable: bool = False) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if immutable:
            try:
                os.link(temporary, path)
            except FileExistsError:
                if path.is_symlink() or path.read_bytes() != data:
                    raise ValueError(
                        "Immutable object already exists with different content"
                    ) from None
        else:
            os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


class LocalObjectStore:
    def __init__(self, root: Path, *, max_object_bytes: int = MAX_OBJECT_BYTES):
        self.root = Path(root).resolve()
        self.max_object_bytes = max_object_bytes

    def path(self, key: str) -> Path:
        path = self.root.joinpath(*PurePosixPath(object_key(key)).parts)
        if not path.resolve().is_relative_to(self.root):
            raise ValueError("Object path escapes its configured cache root")
        return path

    def read(self, key: str) -> bytes:
        path = self.path(key)
        if path.stat().st_size > self.max_object_bytes:
            raise ValueError("Cache object exceeds the configured transfer limit")
        return path.read_bytes()

    def write(self, key: str, data: bytes) -> None:
        if len(data) > self.max_object_bytes:
            raise ValueError("Cache object exceeds the configured transfer limit")
        atomic_write(self.path(key), data)


class B2ObjectStore:
    """S3-compatible adapter. Callers supply a dedicated owner-cache client.

    Never uses ETags as checksums. Transfers have one writer per target prefix;
    this adapter does not claim a cross-host lock or B2 conditional-write support.
    """

    def __init__(
        self, client, bucket: str, prefix: str, *, max_object_bytes: int = MAX_OBJECT_BYTES
    ):
        if not bucket or bucket.casefold() in {"drivestats-iceberg", "backblaze-hard-drive-data"}:
            raise ValueError("A separate owner cache bucket is required")
        self.client, self.bucket = client, bucket
        self.prefix = object_key(prefix)
        self.max_object_bytes = max_object_bytes

    def read(self, key: str) -> bytes:
        remote = f"{self.prefix}/{object_key(key)}"
        try:
            result = self.client.get_object(Bucket=self.bucket, Key=remote)
            with result["Body"] as body:
                data = body.read(self.max_object_bytes + 1)
        except Exception as error:
            if getattr(error, "response", {}).get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                raise FileNotFoundError("B2 cache object is absent") from None
            raise ValueError(
                "B2 cache read failed; inspect access/configuration privately"
            ) from None
        if len(data) > self.max_object_bytes or len(data) != result["ContentLength"]:
            raise ValueError("B2 cache object length mismatch or transfer limit exceeded")
        return data

    def write(self, key: str, data: bytes) -> None:
        remote = f"{self.prefix}/{object_key(key)}"
        if len(data) > self.max_object_bytes:
            raise ValueError("Cache object exceeds the configured transfer limit")
        try:
            self.client.put_object(
                Bucket=self.bucket, Key=remote, Body=data, Metadata={"sha256": digest(data)}
            )
        except Exception:
            raise ValueError(
                "B2 cache write failed; inspect access/configuration privately"
            ) from None


def build_transfer_manifest(root: Path, relative_paths: list[str]) -> dict:
    store = LocalObjectStore(root)
    if len(set(relative_paths)) != len(relative_paths):
        raise ValueError("Duplicate transfer object")
    files = []
    for key in sorted(relative_paths):
        data = store.read(key)
        files.append({"path": key, "sizeBytes": len(data), "sha256": digest(data)})
    return {"schemaVersion": 1, "kind": "private-history-cache", "files": files}


def transfer_verified(source, target, manifest: dict, *, max_workers: int = 1) -> dict:
    """Resume at verified object boundaries, never regenerate source partitions.

    Failed in-flight objects are retried in full. Explicit manifests, not remote
    listings or write counts, define completion. Returns counts without prose or
    private paths. A failure does not return a successful receipt.
    """
    if type(max_workers) is not int or not 1 <= max_workers <= 16:
        raise ValueError("Transfer workers must be an integer from 1 through 16")
    if manifest.get("schemaVersion") != 1 or manifest.get("kind") != "private-history-cache":
        raise ValueError("Unsupported cache transfer manifest")
    files = manifest.get("files")
    if not isinstance(files, list):
        raise ValueError("Transfer manifest needs explicit object records")
    seen = set()
    for row in files:
        if not isinstance(row, dict) or not isinstance(row.get("path"), str):
            raise ValueError("Invalid transfer object record")
        key = object_key(row["path"])
        if (
            key.casefold() in seen
            or type(row.get("sizeBytes")) is not int
            or row["sizeBytes"] < 0
            or not isinstance(row.get("sha256"), str)
            or not re.fullmatch(r"[0-9a-f]{64}", row.get("sha256", ""))
        ):
            raise ValueError("Invalid transfer object record")
        seen.add(key.casefold())
    if any(
        "/".join(key.split("/")[:index]) in seen
        for key in seen
        for index in range(1, len(key.split("/")))
    ):
        raise ValueError("Transfer object paths must be independent")
    manifest_sha256 = digest(json_bytes(manifest))
    copied = reused = 0
    stopped = Event()

    def transfer_object(row):
        if stopped.is_set():
            return None
        try:
            return copy_object(row)
        except BaseException:
            stopped.set()
            raise

    def copy_object(row):
        data = source.read(row["path"])
        if len(data) != row["sizeBytes"] or digest(data) != row["sha256"]:
            raise ValueError("Source cache object does not match the transfer manifest")
        try:
            existing = target.read(row["path"])
        except FileNotFoundError:
            existing = None
        if (
            existing is not None
            and len(existing) == row["sizeBytes"]
            and digest(existing) == row["sha256"]
        ):
            return False
        del existing
        target.write(row["path"], data)
        del data
        verified = target.read(row["path"])
        if len(verified) != row["sizeBytes"] or digest(verified) != row["sha256"]:
            raise ValueError("Transferred cache object failed content verification")
        return True

    # Keep only one submitted object per worker; never queue the entire manifest.
    # The context waits for started workers even when a peer fails or is cancelled.
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        rows = iter(files)
        pending = {
            executor.submit(transfer_object, row)
            for row in (next(rows, None) for _ in range(max_workers))
            if row is not None
        }
        try:
            while pending:
                completed, pending = wait(pending, return_when=FIRST_COMPLETED)
                for future in completed:
                    result = future.result()
                    copied += result is True
                    reused += result is False
                if not stopped.is_set():
                    for _ in completed:
                        row = next(rows, None)
                        if row is not None:
                            pending.add(executor.submit(transfer_object, row))
        finally:
            stopped.set()
            for future in pending:
                future.cancel()
    return {
        "copied": copied,
        "reused": reused,
        "verified": len(files),
        "manifestSha256": manifest_sha256,
    }


@contextmanager
def publication_lock(root: Path):
    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".publication.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise ValueError(
            "Publication is locked; verify the earlier writer stopped before manual recovery"
        ) from None
    try:
        with os.fdopen(descriptor, "w") as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink()


def publish_generation(output_root: Path, matrix: dict, supporting: dict) -> dict:
    from tools.validate_matrix_contract import load_matrix, validate_matrix
    from tools.validate_supporting_contract import validate_supporting

    validate_matrix(matrix)
    validate_supporting(supporting)
    snapshot = matrix["snapshot"]
    timestamp(snapshot["generatedAt"])  # Parse before any immutable write.
    snapshot_id = object_key(snapshot["id"])
    if (
        "/" in snapshot_id
        or supporting["snapshotId"] != snapshot_id
        or supporting["asOfQuarter"] != snapshot["asOfQuarter"]
    ):
        raise ValueError("Generation snapshot identities do not match")
    if (
        supporting["sourceManifestSha256"] != matrix["provenance"]["sourceManifestSha256"]
        or set(supporting["provenance"]["selectedModelIds"])
        != set(matrix["selection"]["resolvedModelIds"])
        or supporting["versions"]["normalization"] != matrix["versions"]["normalization"]
        or supporting["versions"]["selection"] != matrix["versions"]["selection"]
    ):
        raise ValueError("Paired generation source, cohort or semantic versions differ")
    selection = matrix["selection"]
    for left, right in (
        ("selectionPatterns", "patterns"),
        ("selectionSha256", "patternsSha256"),
        ("seedAsOfQuarter", "seedAsOfQuarter"),
        ("discoveryRule", "discoveryRule"),
        ("classificationVersion", "classificationVersion"),
    ):
        if supporting["provenance"][left] != selection[right]:
            raise ValueError("Paired generation selection definitions differ")
    supporting_periods = {row["quarter"]: row for row in supporting["quarters"]}
    coverage_periods = {row["quarter"]: row for row in matrix["coverage"]["quarters"]}
    if set(supporting_periods) != set(coverage_periods):
        raise ValueError("Paired generation reporting quarters differ")
    for quarter, period in supporting_periods.items():
        if period["coverage"] != coverage_periods[quarter]["status"]:
            raise ValueError("Paired generation coverage differs")
        if period["coverage"] != "complete":
            continue
        rows = {
            row["id"]: row
            for scope in period["scopes"]
            if scope["scopeId"] == "selected_hdd"
            for row in scope["models"]
        }
        for model in matrix["models"]:
            cell = next((cell for cell in model["cells"] if cell["quarter"] == quarter), None)
            if cell is None:
                continue
            observed = rows.get(model["modelId"], {}).get(
                "measures", {"driveCount": 0, "newDrives": 0}
            )
            if (
                observed["driveCount"] != cell["observations"]["count"]
                or observed["newDrives"] != cell["observations"]["new"]
            ):
                raise ValueError("Paired generation model observations differ")
    prefix = f"snapshots/{snapshot_id}"
    if snapshot["immutablePath"] != f"{prefix}/matrix.json":
        raise ValueError("Matrix immutable path must match its published generation")
    root = Path(output_root)
    store = LocalObjectStore(root)
    artifacts = {"matrix": json_bytes(matrix), "supporting": json_bytes(supporting)}
    entry = {
        "id": snapshot_id,
        "asOfQuarter": snapshot["asOfQuarter"],
        "generatedAt": snapshot["generatedAt"],
    }
    for name, data in artifacts.items():
        entry[name] = {
            "url": f"{prefix}/{name}.json",
            "sha256": digest(data),
            "sizeBytes": len(data),
        }
    entry["generationSha256"] = digest(json_bytes(entry))
    with publication_lock(root):
        index_path = store.path("index.json")
        index = (
            load_matrix(index_path)
            if index_path.exists()
            else {
                "schemaVersion": 1,
                "artifactType": "flagship-index",
                "latest": snapshot_id,
                "snapshots": [],
            }
        )
        if index.get("schemaVersion") != 1 or index.get("artifactType") != "flagship-index":
            raise ValueError("Existing index has an unsupported contract")
        _verify_index(index, store)
        previous = next((row for row in index["snapshots"] if row["id"] == snapshot_id), None)
        if previous is not None and previous != entry:
            raise ValueError("Published snapshot ID already has different content")
        # Immutable files are completed first. Failed partial generations remain
        # unreferenced and can be retried with identical content; no files deleted.
        for name, data in artifacts.items():
            atomic_write(store.path(f"{prefix}/{name}.json"), data, immutable=True)
        if previous is None:
            index["snapshots"].append(entry)
        index["snapshots"].sort(
            key=lambda row: (row["asOfQuarter"], timestamp(row["generatedAt"]), row["id"]),
            reverse=True,
        )
        index["latest"] = index["snapshots"][0]["id"]
        atomic_write(index_path, json_bytes(index))
    return entry


def _verify_index(index: dict, store: LocalObjectStore) -> None:
    """Refuse to extend a corrupt index or retain broken old generation links."""
    if set(index) != {"schemaVersion", "artifactType", "latest", "snapshots"}:
        raise ValueError("Existing index contains unsupported fields")
    rows = index.get("snapshots")
    if not isinstance(rows, list):
        raise ValueError("Existing index needs explicit snapshot records")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {
            "id",
            "asOfQuarter",
            "generatedAt",
            "matrix",
            "supporting",
            "generationSha256",
        }:
            raise ValueError("Malformed generation index record")
        snapshot_id = object_key(row["id"])
        if (
            "/" in snapshot_id
            or snapshot_id in seen
            or not re.fullmatch(r"[0-9]{4}-Q[1-4]", row["asOfQuarter"])
        ):
            raise ValueError("Duplicate or invalid generation index identity")
        seen.add(snapshot_id)
        timestamp(row["generatedAt"])
        if (
            digest(
                json_bytes({key: value for key, value in row.items() if key != "generationSha256"})
            )
            != row["generationSha256"]
        ):
            raise ValueError("Generation index checksum differs")
        for name in ("matrix", "supporting"):
            artifact = row[name]
            if (
                not isinstance(artifact, dict)
                or set(artifact) != {"url", "sha256", "sizeBytes"}
                or artifact["url"] != f"snapshots/{snapshot_id}/{name}.json"
                or type(artifact["sizeBytes"]) is not int
                or artifact["sizeBytes"] < 0
                or not isinstance(artifact["sha256"], str)
                or not re.fullmatch(r"[0-9a-f]{64}", artifact["sha256"])
            ):
                raise ValueError("Invalid indexed artifact path")
            data = store.read(artifact["url"])
            if digest(data) != artifact["sha256"] or len(data) != artifact["sizeBytes"]:
                raise ValueError("Indexed generation content changed or is incomplete")
    if rows and index.get("latest") not in seen:
        raise ValueError("Latest generation is absent from the index")
