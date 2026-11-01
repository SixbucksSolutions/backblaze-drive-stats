"""Verify pinned local source ZIPs and prepare private, recoverable projections.

No network or raw CSV extraction. Existing successful outputs are read-only;
failed attempts stay preserved and an explicit retry uses a fresh directory.
"""

from __future__ import annotations

import re
from datetime import timedelta
from pathlib import Path

from historical_generator import QuarterInput, bounds, digest, file_sha, public_evidence
from history_storage import atomic_write, json_bytes, object_key, publication_lock
from parquet_profile import PROFILE_ID
from prepare_quarter_zip import prepare, validate_execution_options
from tools.validate_production_v2 import load_json


def check_private_path(work_root: Path, path: Path) -> None:
    """Reject existing reparse links before creating or reading private objects."""
    if not path.is_relative_to(work_root):
        raise ValueError("Private projection path escapes its configured root")
    current = work_root
    for part in path.relative_to(work_root).parts:
        current /= part
        if (
            current.is_symlink()
            or current.is_junction()
            or not current.resolve().is_relative_to(work_root)
        ):
            raise ValueError("Private projection paths must not traverse reparse links")


def _source_identity(source: dict) -> tuple[Path, dict]:
    if set(source) != {"quarter", "path", "sha256", "sizeBytes", "url"}:
        raise ValueError("Source requires quarter, local path, exact hash/size and public URL")
    if not isinstance(source["quarter"], str) or not re.fullmatch(
        r"[0-9]{4}-Q[1-4]", source["quarter"]
    ):
        raise ValueError("Source quarter is malformed")
    bounds(source["quarter"])
    if not re.fullmatch(r"[0-9a-f]{64}", source["sha256"]):
        raise ValueError("Source SHA-256 pin is malformed")
    if type(source["sizeBytes"]) is not int or source["sizeBytes"] <= 0:
        raise ValueError("Source byte-length pin is malformed")
    public_evidence(source["url"])
    if not source["url"].startswith("https://"):
        raise ValueError("Source URL must be public HTTPS")
    path = Path(source["path"])
    if path.is_symlink() or not path.is_file():
        raise ValueError("Pinned source must be a regular local file")
    if path.stat().st_size != source["sizeBytes"] or file_sha(path) != source["sha256"]:
        raise ValueError("Local source bytes differ from the reviewed pins")
    return path, {key: source[key] for key in ("quarter", "sha256", "sizeBytes", "url")} | {
        "parquetProfile": PROFILE_ID,
    }


def _projection_record(directory: Path, identity: dict, work_root: Path) -> dict:
    check_private_path(work_root, directory)
    receipt_path = directory / "import-metadata.json"
    check_private_path(work_root, receipt_path)
    receipt = load_json(receipt_path)
    first, last = bounds(identity["quarter"])
    expected_days = (last - first).days + 1
    expected_dates = {str(first + timedelta(days=i)) for i in range(expected_days)}
    records = receipt["files"]
    dates = [record["date"] for record in records]
    if (
        receipt["sourceZipSha256"] != identity["sha256"]
        or receipt.get("sourceUrl") != identity["url"]
        or receipt.get("selectedQuarter") != identity["quarter"]
        or receipt.get("parquetProfile") != PROFILE_ID
        or receipt.get("fileCount") != expected_days
        or len(records) != expected_days
        or set(dates) != expected_dates
        or sorted(receipt["dates"]) != sorted(dates)
        or receipt["rowCount"] != sum(record["rowCount"] for record in records)
    ):
        raise ValueError("Projection receipt disagrees with the pinned source calendar/profile")
    if any(record["outputFile"] != f"{record['date']}.parquet" for record in records):
        raise ValueError("Projection partition name does not match its date")
    files = []
    for name in ["import-metadata.json", *[r["outputFile"] for r in records]]:
        object_key(name)
        target = directory / name
        check_private_path(work_root, target)
        if (
            target.parent != directory
            or target.is_symlink()
            or not target.is_file()
            or not target.resolve().is_relative_to(directory.resolve())
        ):
            raise ValueError("Projection references an unsafe or absent object")
        files.append(dict(path=name, sizeBytes=target.stat().st_size, sha256=file_sha(target)))
    if {p.name for p in directory.iterdir()} != {row["path"] for row in files}:
        raise ValueError("Projection contains unrelated or temporary objects")
    return dict(schemaVersion=1, source=identity, files=files)


def _reuse(root: Path, identity: dict, work_root: Path) -> QuarterInput:
    check_private_path(work_root, root / "projection.json")
    if (root / "projection.json").is_symlink():
        raise ValueError("Projection marker must not be a symlink")
    marker = load_json(root / "projection.json")
    if set(marker) != {"schemaVersion", "source", "files", "attempt"}:
        raise ValueError("Invalid completed source projection marker")
    if not re.fullmatch(r"attempts/[0-9]{6}", marker["attempt"]):
        raise ValueError("Invalid source projection attempt reference")
    directory = root / marker["attempt"]
    check_private_path(work_root, directory)
    if directory.is_symlink() or not directory.resolve().is_relative_to(root.resolve()):
        raise ValueError("Projection attempt escapes its private root")
    expected = _projection_record(directory, identity, work_root) | {"attempt": marker["attempt"]}
    if marker != expected:
        raise ValueError("Completed source projection changed; preserve and inspect it")
    return QuarterInput(identity["quarter"], directory, directory / "import-metadata.json")


def _prepare_source(
    source: dict,
    work_root: Path,
    allow_projection: bool,
    day_workers: int,
    polars_threads: int,
) -> QuarterInput:
    source_path, identity = _source_identity(source)
    work_root = Path(work_root).resolve()
    root = work_root / "projections" / identity["quarter"] / digest(identity)
    check_private_path(work_root, root)
    if (root / "projection.json").exists():
        return _reuse(root, identity, work_root)
    if not allow_projection:
        raise ValueError("Local projection requires explicit allowProjection")
    with publication_lock(root):
        check_private_path(work_root, root)
        if (root / "projection.json").exists():
            return _reuse(root, identity, work_root)
        attempts = root / "attempts"
        check_private_path(work_root, attempts)
        attempts.mkdir(exist_ok=True)
        existing = list(attempts.iterdir())
        if any(
            p.is_symlink() or not p.is_dir() or not re.fullmatch(r"[0-9]{6}", p.name)
            for p in existing
        ):
            raise ValueError("Unrecognized private projection attempt; inspect before retry")
        number = max([0, *[int(p.name) for p in existing]]) + 1
        if number > 999999:
            raise ValueError("Projection attempt limit reached")
        directory = attempts / f"{number:06d}"
        check_private_path(work_root, directory)
        directory.mkdir()
        check_private_path(work_root, directory)
        prepare(
            source_path,
            directory,
            source_url=identity["url"],
            quarter=identity["quarter"],
            day_workers=day_workers,
            polars_threads=polars_threads,
        )
        marker = _projection_record(directory, identity, work_root) | {
            "attempt": directory.relative_to(root).as_posix(),
        }
        check_private_path(work_root, root / "projection.json")
        atomic_write(root / "projection.json", json_bytes(marker), immutable=True)
        return _reuse(root, identity, work_root)


def prepare_source(
    source: dict,
    work_root: Path,
    *,
    allow_projection: bool = False,
    day_workers: int = 1,
    polars_threads: int = 2,
) -> QuarterInput:
    """Reuse verified output or explicitly project a pinned, complete local quarter.

    Errors deliberately exclude input values/paths. Retained-summary refreshes do
    not call this adapter. Publication-domain exceptions stay in accepted catalogs.
    """
    try:
        validate_execution_options(day_workers, polars_threads)
        return _prepare_source(source, work_root, allow_projection, day_workers, polars_threads)
    except Exception:
        raise ValueError(
            "Local source verification/projection failed; preserve evidence and check pins, calendar and explicit projection permission"
        ) from None


def prepare_local_sources(config: dict, as_of: str) -> list[QuarterInput]:
    day_workers = config.get("dayWorkers", 1)
    polars_threads = config.get("polarsThreads", 2)
    validate_execution_options(day_workers, polars_threads)
    sources = config.get("sources", [])
    if not isinstance(sources, list):
        raise ValueError("Sources must be an explicit bounded list")
    if sources and not config.get("workRoot"):
        raise ValueError("Sources require a private workRoot")
    seen = set()
    selected = []
    for source in sources:
        quarter = source["quarter"]
        bounds(quarter)
        if quarter in seen:
            raise ValueError("Duplicate pinned source quarter")
        seen.add(quarter)
        if quarter <= as_of:
            selected.append(
                prepare_source(
                    source,
                    Path(config["workRoot"]),
                    allow_projection=config.get("allowProjection") is True,
                    day_workers=day_workers,
                    polars_threads=polars_threads,
                )
            )
    return selected
