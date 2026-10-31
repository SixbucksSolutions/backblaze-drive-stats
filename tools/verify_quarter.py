"""Private, offline one-quarter acceptance audit; never generates a public matrix."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import polars as pl
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from historical_generator import (  # noqa: E402 -- standalone script bootstrap
    QuarterInput,
    Registry,
    bounds,
    digest,
    file_sha,
    rate,
    summarize_partitioned_input,
)
from parquet_profile import PROFILE_ID, SPEC, inspect_profile  # noqa: E402


@contextmanager
def forbid_daily_reads(directory: Path):
    """Allow summary reads and byte hashing, reject daily DataFrame reads/scans."""
    original_read, original_scan = pl.read_parquet, pl.scan_parquet

    def checked(operation, source, *args, **kwargs):
        if not isinstance(source, str | Path) or Path(source).resolve().is_relative_to(
            directory.resolve()
        ):
            raise RuntimeError("Warm verification forbids daily DataFrame reads/scans")
        return operation(source, *args, **kwargs)

    with (
        patch.object(
            pl, "read_parquet", lambda source, *a, **k: checked(original_read, source, *a, **k)
        ),
        patch.object(
            pl, "scan_parquet", lambda source, *a, **k: checked(original_scan, source, *a, **k)
        ),
    ):
        yield


def check_receipt(item: QuarterInput, source_zip: Path) -> dict:
    """Check full calendar coverage and footers before any logical daily scan."""
    if not re.fullmatch(r"[0-9]{4}-Q[1-4]", item.quarter):
        raise ValueError("Expected quarter YYYY-QN")
    start, end = bounds(item.quarter)
    expected = [str(start + timedelta(days=i)) for i in range((end - start).days + 1)]
    receipt_path = item.receipt or item.directory / "import-metadata.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if not isinstance(receipt, dict) or not isinstance(receipt.get("files"), list):
        raise ValueError("Invalid import receipt")
    records = receipt["files"]
    if any(not isinstance(r, dict) for r in records):
        raise ValueError("Invalid partition record")
    if sorted(r.get("date", "") for r in records) != expected:
        raise ValueError("Quarter date coverage is incomplete, duplicated, or outside quarter")
    if (
        receipt.get("schemaVersion") != 1
        or receipt.get("parquetProfile") != PROFILE_ID
        or receipt.get("fileCount") != len(records)
        or sorted(receipt.get("dates", [])) != expected
    ):
        raise ValueError("Receipt metadata disagrees with calendar/profile")
    source_hash = file_sha(source_zip)
    if receipt.get("sourceZipSha256") != source_hash:
        raise ValueError("Source ZIP hash differs from receipt")
    partitions = []
    for record in records:
        name = record.get("outputFile")
        count = record.get("rowCount")
        if name != record["date"] + ".parquet" or type(count) is not int or count < 0:
            raise ValueError("Invalid partition filename or row count")
        path = item.directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Partition must be an ordinary local file")
        footer = pq.read_metadata(path)
        metadata = footer.metadata or {}
        if (
            footer.num_rows != count
            or metadata.get(b"backblaze.parquet_profile", b"").decode() != PROFILE_ID
            or metadata.get(b"backblaze.layout_kind") != b"daily_projection"
            or digest(json.loads(metadata.get(b"backblaze.writer_spec", b"null"))) != digest(SPEC)
            or json.loads(metadata.get(b"backblaze.lineage", b"null"))
            != {"sourceZipSha256": source_hash, "partition": record["date"]}
        ):
            raise ValueError("Partition footer/profile/source lineage mismatch")
        partitions.append(
            dict(date=record["date"], rows=count, bytes=path.stat().st_size, sha256=file_sha(path))
        )
    if {p.name for p in item.directory.glob("*.parquet")} != {r["outputFile"] for r in records}:
        raise ValueError("Unreceipted daily Parquet files")
    if type(receipt.get("rowCount")) is not int or receipt["rowCount"] != sum(
        p["rows"] for p in partitions
    ):
        raise ValueError("Receipt total row count mismatch")
    return dict(
        expectedDays=len(expected),
        observedDays=len(records),
        rowCount=receipt["rowCount"],
        projectedBytes=sum(p["bytes"] for p in partitions),
        sourceZipSha256=source_hash,
        sourceZipBytes=source_zip.stat().st_size,
        receiptSha256=file_sha(receipt_path),
        partitions=partitions,
    )


def audit(item: QuarterInput, cache_root: Path, registry: Registry, source_zip: Path) -> dict:
    started = time.perf_counter()
    checks = check_receipt(item, source_zip)
    receipt_seconds = time.perf_counter() - started
    _, end = bounds(item.quarter)
    existing = (cache_root / "quarters" / item.quarter).exists()
    started = time.perf_counter()
    if existing:
        # Existing objects may be reused but this audit must never replace them.
        for candidate in (cache_root / "quarters" / item.quarter).glob("*/manifest.json"):
            if (
                json.loads(candidate.read_text(encoding="utf-8")).get("parquetProfile")
                != PROFILE_ID
            ):
                raise ValueError("Audit cannot repack an existing legacy summary")
        with forbid_daily_reads(item.directory):
            manifest, drives, capacities, hit = summarize_partitioned_input(
                item, cache_root, registry, end
            )
        if not hit or manifest.get("parquetProfile") != PROFILE_ID:
            raise ValueError("Existing quarter cache must be a verified current-profile hit")
    else:
        manifest, drives, capacities, hit = summarize_partitioned_input(
            item, cache_root, registry, end
        )
    first_seconds = time.perf_counter() - started
    started = time.perf_counter()
    with forbid_daily_reads(item.directory):
        warm_manifest, warm_drives, warm_capacities, warm_hit = summarize_partitioned_input(
            item, cache_root, registry, end
        )
    warm_seconds = time.perf_counter() - started
    if (
        not warm_hit
        or manifest != warm_manifest
        or not drives.equals(warm_drives)
        or not capacities.equals(warm_capacities)
    ):
        raise ValueError("Warm cache reuse/parity failed")
    if (
        manifest["coverage"]["status"] != "complete"
        or manifest["coverage"]["rowCount"] != checks["rowCount"]
    ):
        raise ValueError("Summary coverage/rows disagree with receipt")
    inventory = []
    exposure_total = 0
    for model_id in sorted(set(manifest["canonicalModels"].values())):
        raw_names = sorted(
            raw for raw, model in manifest["canonicalModels"].items() if model == model_id
        )
        model = registry.resolve(raw_names[0])
        subset = drives.filter(pl.col("id") == model_id)
        count = subset.height
        exposure = int(subset["driveDays"].sum())
        failures = int(subset["failures"].sum())
        if subset.filter(
            (pl.col("driveDays") < 1)
            | (pl.col("driveDays") > checks["expectedDays"])
            | (pl.col("failures") < 0)
            | (pl.col("failures") > pl.col("driveDays"))
        ).height:
            raise ValueError("Per-drive quarter numerical budget failed")
        if not count <= exposure <= count * checks["expectedDays"] or not 0 <= failures <= exposure:
            raise ValueError("Quarter numerical budget failed")
        exposure_total += exposure
        inventory.append(
            dict(
                **model,
                rawNames=raw_names,
                count=count,
                driveDays=exposure,
                failures=failures,
                quarterAfr=rate(dict(complete=True, driveDays=exposure, failures=failures)),
            )
        )
    if exposure_total != checks["rowCount"] or int(capacities["len"].sum()) > exposure_total:
        raise ValueError("Summary exposure/capacity budget differs from source")
    target = cache_root / "quarters" / item.quarter / (manifest["inputSha256"] + "." + PROFILE_ID)
    profiles = {
        name: inspect_profile(target / name) for name in ("drives.parquet", "capacities.parquet")
    }
    return dict(
        schemaVersion=1,
        quarter=item.quarter,
        scope="private single-quarter audit",
        historyAnchor="unverified",
        cumulativeHistory="unverified",
        productionMatrixGenerated=False,
        **checks,
        coverage=manifest["coverage"],
        inventory=inventory,
        summaryInputSha256=manifest["inputSha256"],
        summaryObjects=manifest["objects"],
        summaryManifestSha256=file_sha(target / "manifest.json"),
        summaryProfiles=profiles,
        registrySha256=digest(registry.value),
        patternsSha256=digest(registry.patterns),
        timingSeconds=dict(
            receiptVerification=receipt_seconds, firstPass=first_seconds, warmPass=warm_seconds
        ),
        firstPassCacheHit=hit,
        warmCacheHit=warm_hit,
        warmDailyDataframeReadsForbidden=True,
        byteHashReadsAreLogicalDailyScans=False,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quarter", required=True)
    for name in (
        "input-dir",
        "cache-root",
        "source-zip",
        "registry",
        "patterns",
        "report-json",
        "report-txt",
    ):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    if args.report_json.resolve() == args.report_txt.resolve():
        parser.error("Report paths must differ")
    for path in (args.report_json, args.report_txt):
        if path.exists() or path.is_symlink():
            parser.error("Report paths must be new")
    registry = Registry(
        json.loads(args.registry.read_text(encoding="utf-8")),
        json.loads(args.patterns.read_text(encoding="utf-8")),
    )
    report = audit(
        QuarterInput(args.quarter, args.input_dir, args.receipt),
        args.cache_root,
        registry,
        args.source_zip,
    )
    text = (
        f"Private quarter audit: {args.quarter}\n"
        f"Coverage: {report['observedDays']}/{report['expectedDays']} days\n"
        f"Rows: {report['rowCount']}; projected bytes: {report['projectedBytes']}\n"
        f"Source ZIP SHA-256: {report['sourceZipSha256']}\n"
        f"Summary identity: {report['summaryInputSha256']}\n"
        f"All-source canonical models: {len(report['inventory'])}\n"
        f"First pass cache hit: {report['firstPassCacheHit']}; guarded warm hit: {report['warmCacheHit']}\n"
        f"Seconds: {json.dumps(report['timingSeconds'], sort_keys=True)}\n"
        "History anchor and cumulative history: UNVERIFIED. No production matrix generated.\n"
        "Warm verification allows byte hashes and summary reads; daily DataFrame reads/scans forbidden.\n"
    )
    for path, content in (
        (args.report_json, json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n"),
        (args.report_txt, text),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
    print(f"Verified {args.quarter}; private reports written.")


if __name__ == "__main__":
    main()
