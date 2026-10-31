"""Offline, aggregate-only quarterly JSON export for a static web client."""
from __future__ import annotations

import argparse
import calendar
from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

import polars as pl

from drive_model_names import normalize_drive_model_name

SOURCE_URL = "https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data"


def quarter_bounds(value: str) -> tuple[date, date]:
    if not re.fullmatch(r"[0-9]{4}-Q[1-4]", value):
        raise ValueError("Quarter must be YYYY-QN, for example 2026-Q2")
    year, quarter = int(value[:4]), int(value[-1])
    month = quarter * 3
    return date(year, month - 2, 1), date(year, month, calendar.monthrange(year, month)[1])


def quarter_for(day: date) -> str:
    return f"{day.year:04d}-Q{(day.month - 1) // 3 + 1}"


def normalize_model(raw: str) -> tuple[str, str]:
    """Use the analysis identity rules, retaining unsupported all-model names."""
    try:
        normalized = normalize_drive_model_name(raw)
    except ValueError:
        return "Unknown", raw
    manufacturer, model = normalized.split(" ", 1)
    return manufacturer, model


def prepare_source(source: pl.LazyFrame, patterns: list[str] | None = None, *, through: date | None = None) -> pl.LazyFrame:
    schema = source.collect_schema()
    required = {"date", "serial_number", "model", "capacity_bytes", "failure"}
    if required - set(schema):
        raise ValueError("Source is missing required columns: " + ", ".join(sorted(required - set(schema))))
    raw_date = pl.col("date")
    parsed_date = raw_date.str.to_date("%Y-%m-%d", strict=True) if schema["date"] == pl.String else raw_date.cast(pl.Date, strict=True)
    # Parse dates first, then exclude future rows before validating or casting other fields.
    # Malformed dates remain an error because they cannot be assigned to either side of the cutoff.
    source = source.with_columns(parsed_date.alias("date"))
    if through is not None:
        source = source.filter(pl.col("date").is_null() | (pl.col("date") <= through))
    source = source.select(
        "date", pl.col("serial_number").cast(pl.String),
        pl.col("model").cast(pl.String).str.strip_chars(),
        pl.col("capacity_bytes").cast(pl.Float64), pl.col("failure").cast(pl.Float64),
        (pl.col("datacenter").cast(pl.String) if "datacenter" in schema else pl.lit(None, dtype=pl.String)).alias("datacenter"),
    )
    if patterns:
        source = source.filter(pl.col("model").str.contains("|".join(patterns)))
    invalid = source.filter(
        pl.col("date").is_null() | pl.col("serial_number").is_null() |
        (pl.col("serial_number").str.strip_chars() == "") | pl.col("model").is_null() |
        (pl.col("model") == "") | pl.col("failure").is_null() | ~pl.col("failure").is_in([0, 1])
    ).select(pl.len()).collect().item()
    if invalid:
        raise ValueError(f"Source has {invalid} invalid required observations")
    names = source.select("model").unique().collect().get_column("model").to_list()
    if not names:
        raise ValueError("Filtered source is empty")
    mappings = []
    for raw in names:
        manufacturer, model = normalize_model(raw)
        identity = hashlib.sha256(f"{manufacturer}\0{model}".encode()).hexdigest()[:20]
        mappings.append({"model": raw, "manufacturer": manufacturer, "normalizedModel": model, "id": identity})
    source = source.join(pl.DataFrame(mappings).lazy(), on="model").drop("model").rename({"normalizedModel": "model"})
    duplicates = source.group_by("date", "id", "serial_number").len().filter(pl.col("len") > 1).select(pl.len()).collect().item()
    if duplicates:
        raise ValueError("Duplicate drive/date observations would inflate drive-days")
    return source.with_columns(
        pl.col("failure").cast(pl.Int64),
        pl.col("datacenter").str.strip_chars().str.to_uppercase().fill_null("Unknown").replace("", "Unknown"),
        pl.concat_str(pl.col("date").dt.year(), pl.lit("-Q"), pl.col("date").dt.quarter()).alias("quarter"),
    )


def afr(failures: int, days: int) -> float:
    return failures * 36500.0 / days


@dataclass
class SourceSummary:
    dates: list[date]
    capacity_frequencies: pl.DataFrame
    drives: pl.DataFrame


def summarize_source(source: pl.LazyFrame) -> SourceSummary:
    """Collect fixed-size query plans once, never once per emitted quarter.

    Retained rows scale with observed drive-quarters and distinct model capacities,
    rather than daily drive observations. Serial numbers remain private in memory.
    """
    dates = source.select("date").unique().collect().get_column("date").to_list()
    frequencies = source.filter(
        pl.col("capacity_bytes").is_finite() & (pl.col("capacity_bytes") > 0)
    ).group_by("quarter", "id", "capacity_bytes").len().collect()
    drives = source.group_by("quarter", "id", "serial_number").agg(
        pl.col("manufacturer").first(), pl.col("model").first(),
        pl.len().alias("driveDays"), pl.col("failure").sum().alias("failures"),
        pl.col("date").min().alias("first"), pl.col("date").max().alias("last"),
        pl.col("datacenter").sort_by("date").last().alias("datacenter"),
    ).collect()
    return SourceSummary(dates, frequencies, drives)


def build_bundle(source: pl.LazyFrame | SourceSummary, quarter: str, *, kind: str = "backblaze", metadata_uri: str | None = None) -> dict:
    if kind not in {"backblaze", "sample"}:
        raise ValueError("kind must be backblaze or sample")
    start, end = quarter_bounds(quarter)
    if isinstance(source, pl.LazyFrame):
        source = summarize_source(source.filter(pl.col("date") <= end))
    dates = [day for day in source.dates if day <= end]
    if not dates or min(dates) > start or max(dates) < end:
        raise ValueError(f"Source does not cover complete requested quarter {quarter}")
    observed = set(dates)
    if any(date.fromordinal(ordinal) not in observed for ordinal in range(start.toordinal(), end.toordinal() + 1)):
        raise ValueError(f"Source has missing calendar days in {quarter}")
    # One mode per normalized model, using only positive, finite capacities. Ties choose the smaller capacity.
    capacities = source.capacity_frequencies.filter(pl.col("quarter") <= quarter).group_by("id", "capacity_bytes").agg(pl.col("len").sum()).sort(
        ["id", "len", "capacity_bytes"], descending=[False, True, False]
    ).group_by("id", maintain_order=True).first().select("id", (pl.col("capacity_bytes") / 1e12).alias("capacityTb"))
    drives = source.drives.filter(pl.col("quarter") <= quarter)
    identities = drives.select("id", "manufacturer", "model").unique()
    if capacities.height != identities.height:
        raise ValueError("A model has no positive finite capacity; cannot normalize the common population")
    drives = drives.drop("manufacturer", "model")
    lifecycle = drives.group_by("id", "serial_number").agg(pl.col("first").min(), pl.col("last").max())
    enriched = drives.join(lifecycle, on=["id", "serial_number"], suffix="Full").join(capacities, on="id").with_columns(
        (pl.col("first") == pl.col("firstFull")).cast(pl.Int64).alias("newDrives"),
        ((pl.col("last") == pl.col("lastFull")) & (pl.col("lastFull") < end)).cast(pl.Int64).alias("lastObservedDrives"),
    )
    history = enriched.group_by("quarter").agg(
        pl.len().alias("driveCount"), pl.col("driveDays").sum(), pl.col("failures").sum(),
        pl.col("capacityTb").sum(), pl.col("newDrives").sum(),
    ).sort("quarter").to_dicts()
    for row in history:
        row["quarterlyAfr"] = afr(row["failures"], row["driveDays"])
    current = enriched.filter(pl.col("quarter") == quarter)
    cumulative = drives.group_by("id").agg(pl.col("driveDays").sum().alias("cumulativeDays"), pl.col("failures").sum().alias("cumulativeFailures"))
    models = current.group_by("id").agg(
        pl.len().alias("driveCount"), pl.col("driveDays").sum(), pl.col("failures").sum(),
        pl.col("capacityTb").first(), pl.col("newDrives").sum(), pl.col("lastObservedDrives").sum(),
    ).join(identities, on="id").join(cumulative, on="id").sort(["manufacturer", "model"]).to_dicts()
    for row in models:
        row["quarterlyAfr"] = afr(row["failures"], row["driveDays"])
        row["cumulativeAfr"] = afr(row.pop("cumulativeFailures"), row.pop("cumulativeDays"))
    datacenters = current.group_by("datacenter").agg(pl.col("capacityTb").sum(), pl.len().alias("driveCount")).sort("datacenter").to_dicts()
    provenance = {
        "kind": kind, "sourceUrl": SOURCE_URL, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "coverageStart": min(dates).isoformat(), "coverageEnd": max(dates).isoformat(),
        "notes": [
            "All metrics use the same filtered observed-drive population; drive identity is normalized model plus serial number.",
            "Counts and capacity include every unique drive observed in a quarter, not an end-of-quarter snapshot. Moving drives use their latest datacenter that quarter; missing datacenters are Unknown.",
            "Capacity is decimal TB, normalized to each model's most frequent positive finite byte capacity through this quarter; ties choose the smaller capacity.",
            "AFR is annualized percent: failures / observed drive-days * 365 * 100. Cumulative AFR starts at coverageStart, not necessarily drive installation.",
            "New drives means first observed within supplied history, not confirmed deployment. Last-observed drives means last seen before coverageEnd in this as-of-quarter input: provisional inferred disappearance, including failures, not confirmed retirement.",
            "History may start with a partial quarter. Daily coverage checks establish observed dates, not completeness of every source drive.",
        ],
    }
    if kind == "sample":
        provenance["notes"].insert(0, "Synthetic demonstration data; not official Backblaze published figures.")
    if metadata_uri:
        provenance["metadataUri"] = metadata_uri
    return {"schemaVersion": 1, "quarter": quarter, "period": {"start": start.isoformat(), "end": end.isoformat()}, "provenance": provenance, "models": models, "capacityByDatacenter": datacenters, "history": history}


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp") as handle:
            temporary = Path(handle.name)
            json.dump(value, handle, separators=(",", ":"), allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def export(source: pl.LazyFrame, through_quarter: str, output_dir: Path, *, from_quarter: str | None = None, kind: str = "backblaze", metadata_uri: str | None = None, patterns: list[str] | None = None) -> list[str]:
    if kind not in {"backblaze", "sample"}:
        raise ValueError("kind must be backblaze or sample")
    _, end = quarter_bounds(through_quarter)
    if end >= datetime.now(timezone.utc).date():
        raise ValueError("Requested cutoff must be a completed calendar quarter")
    summary = summarize_source(prepare_source(source, patterns, through=end))
    first_date = min(summary.dates)
    first = from_quarter or quarter_for(first_date)
    start, _ = quarter_bounds(first)
    if start > end:
        raise ValueError("--from-quarter is after --through-quarter")
    # Skip the leading partial quarter by default, while retaining it for cumulative history.
    if from_quarter is None and start < first_date:
        month = start.month + 3
        start = date(start.year + (month > 12), (month - 1) % 12 + 1, 1)
    bundles = []
    cursor = start
    while cursor <= end:
        quarter = quarter_for(cursor)
        bundle = build_bundle(summary, quarter, kind=kind, metadata_uri=metadata_uri)
        bundle["provenance"]["notes"].append(
            "Model-selection regex filters applied to source model names: " + json.dumps(patterns) +
            ". This population is not asserted to match the eligibility criteria in a Backblaze quarterly report."
            if patterns else
            "No model-selection filters were applied: all supplied source models are included, including boot drives if present. This population is not asserted to match the eligibility criteria in a Backblaze quarterly report."
        )
        if quarter_for(first_date) == quarter:
            bundle["provenance"]["notes"].append(
                "Supplied history starts in this reporting quarter: newDrives includes the initial observed fleet, not only confirmed deployments."
            )
        bundles.append(bundle)
        month = cursor.month + 3
        cursor = date(cursor.year + (month > 12), (month - 1) % 12 + 1, 1)
    if not bundles:
        raise ValueError("No complete quarters are available")
    for bundle in bundles:
        atomic_json(output_dir / f"{bundle['quarter']}.json", bundle)
    atomic_json(output_dir / "index.json", {"schemaVersion": 1, "quarters": [{"quarter": b["quarter"], "label": b["quarter"].replace("-", " "), "url": f"{b['quarter']}.json", "kind": kind} for b in reversed(bundles)]})
    return [b["quarter"] for b in bundles]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--through-quarter", required=True)
    parser.add_argument("--from-quarter")
    parser.add_argument("--output-dir", type=Path, default=Path("web/public/data"))
    parser.add_argument("--input-parquet", help="Local Parquet file or glob; omit to scan public Backblaze Iceberg")
    parser.add_argument("--kind", choices=["backblaze", "sample"], default="backblaze")
    parser.add_argument("--drive-patterns-json", type=Path, help="Optional JSON list of model regexes, applied consistently to all metrics")
    parser.add_argument("--s3-endpoint", default="https://s3.us-west-004.backblazeb2.com")
    parser.add_argument("--b2-region", default="us-west-004")
    parser.add_argument("--bucket-name", default="drivestats-iceberg")
    parser.add_argument("--table-path", default="drivestats")
    args = parser.parse_args()
    try:
        quarter_bounds(args.through_quarter)
        metadata_uri = None
        if args.input_parquet:
            source = pl.scan_parquet(args.input_parquet)
        else:
            import iceberg_table
            access = os.environ.get("B2_ACCESS_KEY_ID")
            secret = os.environ.get("B2_SECRET_ACCESS_KEY")
            if not access or not secret:
                raise ValueError("Iceberg requires B2_ACCESS_KEY_ID and B2_SECRET_ACCESS_KEY environment variables")
            metadata_uri = iceberg_table.current_metadata_file_s3_uri(access, secret, args.s3_endpoint, args.bucket_name, args.table_path)
            source = pl.scan_iceberg(metadata_uri, storage_options={"s3.endpoint": args.s3_endpoint, "s3.region": args.b2_region, "s3.access-key-id": access, "s3.secret-access-key": secret})
        patterns = json.loads(args.drive_patterns_json.read_text(encoding="utf-8")) if args.drive_patterns_json else None
        if patterns is not None and (not isinstance(patterns, list) or not patterns or any(not isinstance(p, str) or not p for p in patterns)):
            raise ValueError("Drive patterns must be a nonempty JSON list of nonempty regex strings")
        quarters = export(source, args.through_quarter, args.output_dir, from_quarter=args.from_quarter, kind=args.kind, metadata_uri=metadata_uri, patterns=patterns)
    except (ValueError, pl.exceptions.PolarsError) as exc:
        parser.exit(2, f"Export failed: {exc}\n")
    print(f"Exported {len(quarters)} quarters; manifest: {args.output_dir / 'index.json'}")


if __name__ == "__main__":
    main()
