"""Offline production v2 generation from verified private quarter summaries.

No network operations. Retained-summary mode never opens daily partitions or
changes private cache objects. Public output contains aggregates only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

import polars as pl

from historical_generator import (
    NORMALIZATION_VERSION,
    SOURCE_URL,
    SUMMARY_VERSION,
    QuarterInput,
    Registry,
    bounds,
    digest,
    file_sha,
    ordinal,
    public_evidence,
    quarter,
    summarize_partitioned_input,
    summary_directory,
)
from history_storage import atomic_write, json_bytes, object_key
from tools.validate_production_v2 import _walk, load_json, validate_generation

VERSION = "2.0.0"
MATRIX_CALCULATION_VERSION = "2.1.0"
METRICS = (
    "observedRecordedAfr",
    "observedRecordedAfrDelta",
    "count",
    "populationDelta",
    "new",
    "retired",
    "failed",
)


def retained_summary(path, registry):
    """Fail closed on damaged/stale retained evidence; never fall back to a rescan."""
    path = Path(path)
    manifest = load_json(path)
    content_hash = manifest.pop("manifestContentSha256", None)
    if content_hash != digest(manifest):
        raise ValueError("Retained summary manifest checksum mismatch")
    manifest["manifestContentSha256"] = content_hash
    lineage = manifest["lineage"]
    effective = {raw: registry.resolve(raw)["modelId"] for raw in manifest["names"]}
    key = digest(dict(lineage=lineage, canonicalModels=effective))
    if (
        lineage["summaryVersion"] != SUMMARY_VERSION
        or lineage["normalization"] != NORMALIZATION_VERSION
        or lineage["normalizationSha256"]
        != digest(
            dict(
                version=NORMALIZATION_VERSION,
                implementation=file_sha(Path(__file__).with_name("drive_model_names.py")),
            )
        )
        or manifest["canonicalModels"] != effective
        or manifest["inputSha256"] != key
        or path.parent.name != summary_directory(key, manifest.get("parquetProfile"))
        or set(manifest["objects"]) != {"drives.parquet", "capacities.parquet"}
    ):
        raise ValueError("Retained summary semantic identity mismatch")
    for name, checksum in manifest["objects"].items():
        if file_sha(path.parent / name) != checksum:
            raise ValueError("Retained summary object checksum mismatch")
    return (
        manifest,
        pl.read_parquet(path.parent / "drives.parquet"),
        pl.read_parquet(path.parent / "capacities.parquet"),
    )


def catalog_summary_manifests(local_root, catalog_path, catalog_sha256, *, history_start, as_of):
    """Map an explicitly pinned preferred catalog to verified local summary paths.

    The catalog may be a retained local copy outside the cache. No pointer is
    followed implicitly, and no cloud fetch, daily scan, or cache write occurs.
    """
    root = Path(local_root).resolve()
    path = Path(catalog_path)
    if file_sha(path) != catalog_sha256:
        raise ValueError("Preferred catalog byte checksum mismatch")
    catalog = load_json(path)
    result, seen = [], set()
    for entry in catalog["quarters"]:
        q = entry["quarter"]
        if q in seen:
            raise ValueError("Duplicate catalog quarter")
        seen.add(q)
        if not ordinal(history_start) <= ordinal(q) <= ordinal(as_of):
            continue
        target = root / object_key(entry["summaryManifestPath"])
        if not target.resolve().is_relative_to(root):
            raise ValueError("Catalog summary escapes local root")
        if file_sha(target) != entry["summaryManifestSha256"]:
            raise ValueError("Catalog summary byte checksum mismatch")
        manifest = load_json(target)
        if (
            manifest["coverage"] != entry["coverage"]
            or manifest["inputSha256"] != entry["summaryInputSha256"]
        ):
            raise ValueError("Catalog summary lineage/coverage mismatch")
        result.append(target)
    return result


def _evidence(identifier, checksum, url=SOURCE_URL):
    return [dict(id=identifier, sha256=checksum, url=url)]


def _public_strings(value):
    """Validate every public free-text string, including caller/raw model values."""
    if isinstance(value, str):
        public_evidence(value)
        for url in re.findall(r"https://[^\s<>]+", value):
            _walk(dict(url=url.rstrip(".,);]")))
    elif isinstance(value, dict):
        for item in value.values():
            _public_strings(item)
    elif isinstance(value, list):
        for item in value:
            _public_strings(item)


def _sum(rows: list[dict], key: str) -> float | int | None:
    values = [row[key] for row in rows]
    return None if any(value is None for value in values) else sum(values)


def _rate(failures, days):
    return failures * 36500 / days if days else None


def _captured_datacenter_available(manifest, drives):
    """Read captured header evidence without changing retained summary identity.

    The receipt's aggregate boolean means *all* files contain the field. Mixed
    captures remain usable when per-file evidence proves at least one presence.
    """
    if manifest["coverage"]["quarter"] < "2023-Q3":
        return False
    receipt = manifest["lineage"]["receipt"]

    def signal(record):
        available = record.get("datacenterAvailable")
        if "datacenterAvailable" in record and type(available) is not bool:
            raise ValueError("Invalid captured datacenter availability")
        if "sourceColumns" in record:
            columns = record["sourceColumns"]
            if not isinstance(columns, list) or not all(isinstance(c, str) for c in columns):
                raise ValueError("Invalid captured datacenter columns")
            present = "datacenter" in columns
            if available is not None and available != present:
                raise ValueError("Conflicting captured datacenter evidence")
            available = present
        return available

    # Use only partitions admitted to this summary, rather than later receipt days.
    dates = {row["date"] for row in manifest["lineage"]["partitions"]}
    records = [row for row in receipt["files"] if row["date"] in dates]
    if not dates or len(records) != len(dates):
        raise ValueError("Captured datacenter evidence does not match summary partitions")
    states = [signal(row) for row in records]
    aggregate = receipt.get("datacenterAvailable")
    if "datacenterAvailable" in receipt and type(aggregate) is not bool:
        raise ValueError("Invalid captured datacenter availability")
    if states and all(state is not None for state in states):
        # Validate the all-days flag only when all receipt files were admitted.
        if (
            len(records) == len(receipt["files"])
            and aggregate is not None
            and aggregate != all(states)
        ):
            raise ValueError("Conflicting captured datacenter aggregate")
        available = any(states)
        if "sourceColumns" in receipt:
            union_available = signal(dict(sourceColumns=receipt["sourceColumns"]))
            if len(records) == len(receipt["files"]) and union_available != available:
                raise ValueError("Conflicting captured datacenter column union")
    elif any(state is not None for state in states):
        raise ValueError("Incomplete captured datacenter evidence")
    elif len(records) == len(receipt["files"]) and "sourceColumns" in receipt:
        union_available = signal(dict(sourceColumns=receipt["sourceColumns"]))
        if (aggregate is True and not union_available) or (
            aggregate is False and len(records) == 1 and union_available
        ):
            raise ValueError("Conflicting captured datacenter evidence")
        # The column union proves absence when empty, and presence otherwise;
        # unlike the all-days flag it also resolves mixed captures.
        available = union_available
    elif len(records) == len(receipt["files"]) and aggregate is True:
        available = True
    elif len(records) == len(receipt["files"]) == 1 and aggregate is False:
        available = False
    else:
        # A multi-file false all-days flag cannot prove all days absent. Legacy known
        # locations prove presence, but all-Unknown cannot distinguish nulls.
        available = bool(drives.filter(pl.col("datacenter") != "Unknown").height)
        if not available:
            raise ValueError("Captured datacenter header evidence required for all-Unknown summary")
    if not available and drives.filter(pl.col("datacenter") != "Unknown").height:
        raise ValueError("Absent captured datacenter field has known locations")
    return available


def generate(
    inputs=(),
    *,
    summary_manifests=(),
    cache_root=None,
    as_of,
    history_start,
    registry,
    patterns,
    generator_revision,
    selection,
    kind="backblaze",
    generated_at,
    first_published_date="2013-04-10",
    matrix_calculation_version=MATRIX_CALCULATION_VERSION,
):
    """Return (index, exact-byte artifact map, diagnostics), without publication.

    selection requires version, purchaseDefaultModelIds and
    historicalReferenceModelIds. analysisModelIds may explicitly select a cohort;
    omitting it admits every evidenced qualifying HDD in this versioned generation.
    Inputs and summary_manifests are mutually exclusive. Future summaries/inputs
    are excluded before reading their bytes. The as-of cutoff is quarter end.
    Matrix calculation 2.0.0 preserves daily flags and zero-initialized deltas;
    2.1.0 counts failing identities once per quarter for Failed/AFR and subtracts
    synthetic zero for the first eligible Count/AFR deltas. Its Retired counts
    final-observed identities only in nonterminal quarters; terminal Retired is
    right-censored. No summary rewrite
    is required; the selected convention is bound into new snapshot identity.
    """
    if kind not in {"backblaze", "sample"} or not generator_revision.strip():
        raise ValueError("Explicit code revision and source kind required")
    if matrix_calculation_version not in {"2.0.0", "2.1.0"}:
        raise ValueError("Unsupported matrix calculation version")
    if not selection.get("version"):
        raise ValueError("Explicit versioned cohort selection required")
    for name in ("purchaseDefaultModelIds", "historicalReferenceModelIds"):
        if name not in selection:
            raise ValueError("Explicit purchase/default reference decisions required")
    periods = [quarter(n) for n in range(ordinal(history_start), ordinal(as_of) + 1)]
    if not periods or (inputs and summary_manifests):
        raise ValueError("Invalid history window or conflicting input modes")
    cutoff = bounds(as_of)[1]
    published = date.fromisoformat(first_published_date)
    # V1's non_hdd classification does not prove SSD. V2 accepts an explicit
    # SSD declaration while retaining the old summarizer's canonical alias API.
    ssd_models = {
        (entry["vendor"], entry["modelNumber"])
        for entry in registry["models"]
        if entry["mediaClass"] == "ssd"
    }
    legacy_registry = dict(
        registry,
        models=[
            dict(
                entry, mediaClass="non_hdd" if entry["mediaClass"] == "ssd" else entry["mediaClass"]
            )
            for entry in registry["models"]
        ],
    )
    reg = Registry(legacy_registry, patterns)
    summaries = {}
    reused, computed = [], []
    for raw in summary_manifests:
        path = Path(raw)
        # The quarter directory is inspected before opening future manifests.
        q = path.parent.parent.name
        if q not in periods:
            continue
        if q in summaries:
            raise ValueError("Duplicate summary quarter")
        summaries[q] = retained_summary(path, reg)
        reused.append(q)
    seen = set()
    for item in inputs:
        if item.quarter in seen:
            raise ValueError("Duplicate input quarter")
        seen.add(item.quarter)
        if item.quarter not in periods:
            continue
        if cache_root is None:
            raise ValueError("Local partition mode requires cache_root")
        manifest, drives, capacities, hit = summarize_partitioned_input(
            item, cache_root, reg, cutoff
        )
        summaries[item.quarter] = (manifest, drives, capacities)
        (reused if hit else computed).append(item.quarter)
    metadata, aliases, frequencies = {}, defaultdict(set), defaultdict(lambda: defaultdict(int))
    coverage, frames = [], {}
    keys = []
    for q in periods:
        start, end = bounds(q)
        expected = (end - start).days + 1
        if q not in summaries:
            status = "unpublished" if end < published else "missing"
            coverage.append(
                dict(
                    quarter=q,
                    status=status,
                    expectedDays=expected,
                    observedDays=0,
                    firstObservedDate=None,
                    lastObservedDate=None,
                    knownObservationRows=None,
                    reason="Period predates source publication"
                    if status == "unpublished"
                    else "No validated supplied capture",
                    datacenterFieldAvailable=q >= "2023-Q3",
                    evidence=_evidence(
                        "source-availability-" + q, digest(dict(quarter=q, status=status))
                    ),
                )
            )
            continue
        manifest, drives, capacities = summaries[q]
        cov = manifest["coverage"]
        if cov["quarter"] != q or manifest["lineage"]["quarter"] != q:
            raise ValueError("Summary quarter mismatch")
        if cov["observedDays"] <= 0 or date.fromisoformat(cov["observedEnd"]) > cutoff:
            raise ValueError("Invalid retained observation window")
        if (
            drives.height != drives.unique(subset=["id", "serial_number"]).height
            or drives.select(pl.col("driveDays").sum()).item() != cov["rowCount"]
        ):
            raise ValueError("Summary identity/exposure mismatch")
        if drives.height and (drives["first"].min() < start or drives["last"].max() > end):
            raise ValueError("Summary identity dates outside quarter")
        keys.append(manifest["inputSha256"])
        evidence = _evidence("source-" + manifest["inputSha256"], manifest["inputSha256"])
        complete = cov["observedDays"] == expected
        coverage.append(
            dict(
                quarter=q,
                status="complete" if complete else "partial",
                expectedDays=expected,
                observedDays=cov["observedDays"],
                firstObservedDate=str(cov["observedStart"]),
                lastObservedDate=str(cov["observedEnd"]),
                knownObservationRows=cov["rowCount"],
                reason="All calendar partitions validated"
                if complete
                else "Calendar partitions unavailable; known observations retained",
                datacenterFieldAvailable=_captured_datacenter_available(manifest, drives),
                evidence=evidence,
            )
        )
        for raw in manifest["names"]:
            info = reg.resolve(raw)
            metadata[info["modelId"]] = info
            aliases[info["modelId"]].add(raw)
        if set(drives["id"].unique()) - set(metadata):
            raise ValueError("Summary contains unmapped canonical identities")
        for row in capacities.to_dicts():
            frequencies[row["id"]][row["capacity_bytes"]] += row["len"]
        frames[q] = drives
    if not frames or not metadata:
        raise ValueError("No validated supplied observations")
    byq = {row["quarter"]: row for row in coverage}
    lifecycle = (
        pl.concat(
            [frame.select("id", "serial_number", "first", "last") for frame in frames.values()]
        )
        .group_by("id", "serial_number")
        .agg(
            pl.col("first").min().alias("inception"),
            pl.col("last").max().alias("final"),
        )
    )
    qualifying_ids = set()
    for frame in frames.values():
        qualifying_ids.update(frame.group_by("id").len().filter(pl.col("len") >= 2000)["id"])
    context_candidates = [
        mid
        for mid, info in metadata.items()
        if info["mediaClass"] == "hdd" and (info["seedMatch"] or mid in qualifying_ids)
    ]
    if not context_candidates:
        raise ValueError("No selected HDD observations; classification action required")
    newest = lifecycle.filter(pl.col("id").is_in(context_candidates))["final"].max()
    aggregates, locations = {}, {}
    for q, frame in frames.items():
        enriched = frame.join(lifecycle, on=["id", "serial_number"], how="left")
        aggregates[q] = {
            row["id"]: row
            for row in enriched.group_by("id")
            .agg(
                pl.len().alias("count"),
                (
                    (pl.col("failures") > 0).sum()
                    if matrix_calculation_version == "2.1.0"
                    else pl.col("failures").sum()
                ).alias("failures"),
                pl.col("driveDays").sum(),
                (pl.col("first") == pl.col("inception")).sum().alias("new"),
                (
                    (pl.col("last") == pl.col("final"))
                    if matrix_calculation_version == "2.1.0"
                    else ((pl.col("last") == pl.col("final")) & (pl.col("last") < newest))
                )
                .sum()
                .alias("retired"),
            )
            .to_dicts()
        }
        locations[q] = (
            enriched.with_columns(
                (pl.col("datacenter") if q >= "2023-Q3" else pl.lit("Unknown")).alias("location"),
            )
            .group_by("id", "location")
            .len()
            .to_dicts()
        )
    capacity = {
        mid: min(values, key=lambda c: (-values[c], c)) / 1e12
        for mid, values in frequencies.items()
        if values
    }
    inventory = []
    for mid, info in sorted(metadata.items()):
        history = []
        for q in periods:
            source = byq[q]
            available = source["status"] in {"complete", "partial"}
            row = aggregates.get(q, {}).get(mid, {})
            count = row.get("count", 0)
            history.append(
                dict(
                    quarter=q,
                    quarterCount=count if source["status"] == "complete" else None,
                    knownIdentityLowerBound=count if available else None,
                    knownFailures=row.get("failures", 0),
                    knownDriveDays=row.get("driveDays", 0),
                    thresholdProof=(
                        "complete_exact_count"
                        if source["status"] == "complete"
                        else "partial_identity_lower_bound"
                    )
                    if available and count >= 2000
                    else None,
                    evidence=source["evidence"],
                )
            )
        first = next((row["quarter"] for row in history if row["knownIdentityLowerBound"]), None)
        anchor = next((row["quarter"] for row in history if row["thresholdProof"]), None)
        first_complete = next(
            (
                row["quarter"]
                for row in history
                if row["quarterCount"] is not None and row["quarterCount"] >= 2000
            ),
            None,
        )
        uncertain = any(
            row["status"] != "complete"
            for row in coverage
            if anchor is None or row["quarter"] < anchor
        )
        inventory.append(
            dict(
                modelId=mid,
                vendor=info["vendor"],
                modelNumber=info["modelNumber"],
                rawAliases=sorted(aliases[mid]),
                mediaClass=(
                    "ssd" if (info["vendor"], info["modelNumber"]) in ssd_models else "unclassified"
                )
                if info["mediaClass"] == "non_hdd"
                else info["mediaClass"],
                classificationEvidence=_evidence(
                    "classification-" + digest(info["classificationEvidence"])[:24],
                    digest(info["classificationEvidence"]),
                    (
                        match.group(0).rstrip(".,);]")
                        if (match := re.search(r"https://[^\s<>]+", info["classificationEvidence"]))
                        else SOURCE_URL
                    ),
                ),
                seedMatch=info["seedMatch"],
                capacityTB=capacity.get(mid),
                history=history,
                firstObservedInDeclaredHistory=first,
                firstProvenThresholdInDeclaredHistory=anchor,
                firstCompleteQualifyingInDeclaredHistory=first_complete,
                reportingAnchorQuarter=anchor,
                earlierQualificationNotExcluded=uncertain,
                anchorSearchComplete=not uncertain,
                recordedHistoryComplete=all(row["status"] == "complete" for row in coverage),
                lifetimeExposureComplete=False,
            )
        )
    context_ids = [
        row["modelId"]
        for row in inventory
        if row["mediaClass"] == "hdd" and (row["seedMatch"] or row["reportingAnchorQuarter"])
    ]
    qualified = [
        row["modelId"]
        for row in inventory
        if row["mediaClass"] == "hdd" and row["reportingAnchorQuarter"]
    ]
    analysis_ids = selection.get("analysisModelIds", qualified)
    for name, ids, allowed in (
        ("analysis", analysis_ids, qualified),
        ("purchase defaults", selection["purchaseDefaultModelIds"], analysis_ids),
        ("historical references", selection["historicalReferenceModelIds"], analysis_ids),
    ):
        if len(ids) != len(set(ids)) or not set(ids) <= set(allowed):
            raise ValueError(f"Invalid {name} membership")
    if set(selection["purchaseDefaultModelIds"]) & set(selection["historicalReferenceModelIds"]):
        raise ValueError("Purchase defaults and historical references must be disjoint")
    selected = dict(
        contextModelIds=context_ids,
        analysisModelIds=analysis_ids,
        purchaseDefaultModelIds=selection["purchaseDefaultModelIds"],
        historicalReferenceModelIds=selection["historicalReferenceModelIds"],
        positiveSeed=dict(
            version=selection.get("seedVersion", "1.0.0"),
            asOfQuarter=selection.get("seedAsOfQuarter", "2025-Q4"),
            patternsSha256=digest(patterns),
            modelIds=[row["modelId"] for row in inventory if row["seedMatch"]],
            evidence=_evidence("positive-seed", digest(patterns)),
        ),
    )
    source_hash = digest(keys)
    identity = digest(
        dict(
            asOf=as_of,
            historyStart=history_start,
            source=source_hash,
            registry=registry,
            patterns=patterns,
            selection=selection,
            generator=generator_revision,
            kind=kind,
            firstPublished=first_published_date,
            generatedAt=generated_at,
            **(
                {"matrixCalculationVersion": matrix_calculation_version}
                if matrix_calculation_version != "2.0.0"
                else {}
            ),
        )
    )
    sid = as_of + "-v2-" + identity[:24]
    context = dict(
        snapshotId=sid,
        asOfQuarter=as_of,
        cutoffDate=str(cutoff),
        generatedAt=generated_at,
        kind=kind,
        generatorRevision=generator_revision,
        sourceManifestSha256=source_hash,
        versions=dict(
            normalization="1.0.0",
            classification=selection.get("classificationVersion", "1.0.0"),
            selection=selection["version"],
            cohort=selection["version"],
            rate=matrix_calculation_version,
            capacity=VERSION,
        ),
        sourceDomain=dict(
            historyStartQuarter=history_start,
            firstPublishedDate=first_published_date,
            throughDate=str(cutoff),
            evidence=_evidence("source-domain", digest(first_published_date)),
        ),
        provenance=dict(
            label="Backblaze supplied recorded history"
            if kind == "backblaze"
            else "SAMPLE: fictional observations",
            credit="Drive statistics source: Backblaze; independent Sixbucks Solutions analysis.",
            url=SOURCE_URL,
        ),
        selection=selected,
        coverage=coverage,
        inventory=inventory,
    )
    _public_strings(context)
    common = dict(
        contractVersion=VERSION, contextSha256=digest(context), snapshotId=sid, asOfQuarter=as_of
    )
    artifacts = {}

    def artifact(stem, value):
        raw = json_bytes(value)
        checksum = hashlib.sha256(raw).hexdigest()
        path = f"{sid}/{stem}.{checksum}.json"
        artifacts[path] = raw
        return dict(path=path, sha256=checksum, sizeBytes=len(raw))

    extent = max(
        [24]
        + [
            ordinal(as_of) - ordinal(row["reportingAnchorQuarter"]) + 1
            for row in inventory
            if row["modelId"] in analysis_ids
        ]
    )
    blocks = []
    for info in inventory:
        mid, anchor = info["modelId"], info["reportingAnchorQuarter"]
        if mid not in analysis_ids:
            continue
        cumulative_failures, cumulative_days = 0, 0
        prior: dict | None = None
        cells: list[dict] = []
        for row in info["history"]:
            cumulative_failures += row["knownFailures"]
            cumulative_days += row["knownDriveDays"]
            q = row["quarter"]
            if q < anchor:
                continue
            status = byq[q]["status"]
            eligible = status == "complete" and row["quarterCount"] >= 2000
            complete_history = all(
                cov["status"] == "complete" for cov in coverage if cov["quarter"] <= q
            )
            metrics: dict[str, float | int | None] = dict.fromkeys(METRICS)
            retired_reason = "unavailable"
            rate = _rate(cumulative_failures, cumulative_days)
            if eligible:
                agg = aggregates.get(q, {}).get(mid, {})
                obstructed = any(
                    cov["status"] != "complete" for cov in coverage if cov["quarter"] >= q
                )
                retired_reason = (
                    (
                        "right_censored"
                        if matrix_calculation_version == "2.1.0"
                        else "cutoff_failed_proxy"
                    )
                    if q == as_of
                    else "gap_obstructed"
                    if obstructed
                    else "inferred"
                )
                baseline_rate = prior["metrics"]["observedRecordedAfr"] if prior else None
                metrics.update(
                    observedRecordedAfr=rate,
                    observedRecordedAfrDelta=(
                        rate - baseline_rate
                        if rate is not None and baseline_rate is not None
                        else None
                    )
                    if prior
                    else rate
                    if matrix_calculation_version == "2.1.0"
                    else 0,
                    count=row["quarterCount"],
                    populationDelta=row["quarterCount"] - prior["metrics"]["count"]
                    if prior
                    else row["quarterCount"]
                    if matrix_calculation_version == "2.1.0"
                    else 0,
                    new=agg.get("new", 0),
                    retired=(
                        None if matrix_calculation_version == "2.1.0" else row["knownFailures"]
                    )
                    if q == as_of
                    else None
                    if obstructed
                    else agg.get("retired", 0),
                    failed=row["knownFailures"],
                )
            cell = dict(
                quarter=q,
                relativeQuarter=ordinal(q) - ordinal(anchor) + 1,
                status="eligible"
                if eligible
                else {
                    "complete": "below_threshold",
                    "partial": "source_incomplete",
                    "missing": "missing",
                    "unpublished": "unpublished",
                }[status],
                metrics=metrics,
                quarterAfr=_rate(row["knownFailures"], row["knownDriveDays"]) if eligible else None,
                completeHistoryAfr=rate if eligible and complete_history else None,
                sourceHistoryComplete=complete_history,
                cumulativeKnownFailures=cumulative_failures,
                cumulativeKnownDriveDays=cumulative_days,
                baselineQuarter=prior["quarter"] if eligible and prior else None,
                baselineQuarterDistance=ordinal(q) - ordinal(prior["quarter"])
                if eligible and prior
                else None,
                deltaReason="prior_eligible"
                if eligible and prior
                else "initialized"
                if eligible
                else "unavailable",
                retiredReason=retired_reason,
            )
            cells.append(cell)
            if eligible:
                prior = cell
        for relative in range(len(cells) + 1, extent + 1):
            cells.append(
                dict(
                    quarter=quarter(ordinal(anchor) + relative - 1),
                    relativeQuarter=relative,
                    status="snapshot_end",
                    metrics=dict.fromkeys(METRICS),
                    quarterAfr=None,
                    completeHistoryAfr=None,
                    sourceHistoryComplete=False,
                    cumulativeKnownFailures=None,
                    cumulativeKnownDriveDays=None,
                    baselineQuarter=None,
                    baselineQuarterDistance=None,
                    deltaReason="unavailable",
                    retiredReason="unavailable",
                )
            )
        blocks.append(
            dict(
                modelId=mid,
                reportingAnchorQuarter=anchor,
                sourceHistoryComplete=info["recordedHistoryComplete"],
                lifetimeExposureComplete=False,
                cells=cells,
            )
        )
    matrix = dict(
        artifactType="matrix",
        **common,
        rateBasis="observed-quarter-distinct-failed-identities-recorded-exposure-v2.1"
        if matrix_calculation_version == "2.1.0"
        else "observed-recorded-exposure-v2",
        rateLabel="Observed-history AFR (quarterly unique failures)"
        if matrix_calculation_version == "2.1.0"
        else "Observed-history AFR",
        relativeQuarterCount=extent,
        guideAfterRelativeYear=6,
        models=blocks,
    )
    matrix_ref = artifact("matrix", matrix)
    quarter_refs = []
    previous: dict | None = None
    for q in periods:
        status = byq[q]["status"]
        payload = None
        if status in {"complete", "partial"}:
            full = status == "complete"
            scopes = {}
            for name, ids in (("selected_hdd", context_ids), ("all_supplied", list(metadata))):
                rows: list[dict] = []
                for mid in sorted(ids):
                    agg = aggregates.get(q, {}).get(mid, {})
                    count = agg.get("count", 0)
                    rows.append(
                        dict(
                            modelId=mid,
                            count=count if full else None,
                            new=agg.get("new", 0) if full else None,
                            capacityTB=(count * capacity[mid] if mid in capacity else None)
                            if full and count
                            else 0
                            if full
                            else None,
                        )
                    )
                totals = {key: _sum(rows, key) for key in ("count", "new", "capacityTB")}
                manufacturers = []
                for vendor in sorted({metadata[mid]["vendor"] for mid in ids}):
                    vendor_rows = [
                        row for row in rows if metadata[row["modelId"]]["vendor"] == vendor
                    ]
                    values = {key: _sum(vendor_rows, key) for key in ("count", "new", "capacityTB")}
                    shares = {
                        share: numerator / denominator
                        if (denominator := totals[key]) and (numerator := values[key]) is not None
                        else None
                        for key, share in (
                            ("count", "populationShare"),
                            ("new", "newShare"),
                            ("capacityTB", "capacityShare"),
                        )
                    }
                    manufacturers.append(dict(vendor=vendor, **values, **shares))
                prior_scope = previous["scopes"][name] if previous else {}
                reason = (
                    "current_incomplete"
                    if not full
                    else "invalid_capacity"
                    if totals["capacityTB"] is None
                    else "first_quarter"
                    if q == history_start
                    else "previous_unavailable"
                    if previous is None
                    or previous["status"] != "complete"
                    or prior_scope["totals"]["capacityTB"] is None
                    else "previous_complete"
                )
                scopes[name] = dict(
                    models=rows,
                    totals=totals,
                    manufacturers=manufacturers,
                    capacityDeltaTB=totals["capacityTB"] - prior_scope["totals"]["capacityTB"]
                    if reason == "previous_complete"
                    else None,
                    capacityDeltaReason=reason,
                )
            dcs: defaultdict[str, list[dict]] = defaultdict(list)
            dcs["Unknown"] = []
            for row in locations[q]:
                count, mid = row["len"], row["id"]
                dcs[row["location"] or "Unknown"].append(
                    dict(count=count, capacityTB=count * capacity[mid] if mid in capacity else None)
                )
            dcrows: list[dict] = [
                dict(
                    name=name,
                    count=_sum(rows, "count") if full else None,
                    capacityTB=_sum(rows, "capacityTB") if full else None,
                )
                for name, rows in sorted(dcs.items())
            ]
            population = scopes["all_supplied"]["totals"]["count"]
            unknown = next(row["count"] for row in dcrows if row["name"] == "Unknown")
            payload = dict(
                artifactType="supporting_quarter",
                **common,
                quarter=q,
                status=status,
                capacityBasis="observed-identity-capacity-mode-v2",
                scopes=scopes,
                datacenters=dict(
                    fieldAvailable=byq[q]["datacenterFieldAvailable"],
                    knownLocationPopulationShare=(population - unknown) / population
                    if population
                    else None,
                    locations=dcrows,
                ),
            )
        quarter_refs.append(
            dict(quarter=q, status=status, payload=artifact(q, payload) if payload else None)
        )
        previous = payload
    descriptor = dict(
        artifactType="snapshot_descriptor",
        contractVersion=VERSION,
        context=context,
        contextSha256=common["contextSha256"],
        matrix=matrix_ref,
        quarters=quarter_refs,
    )
    entry = dict(
        snapshotId=sid,
        asOfQuarter=as_of,
        sourceManifestSha256=source_hash,
        descriptor=artifact("descriptor", descriptor),
    )
    index = dict(
        artifactType="generation_index",
        contractVersion=VERSION,
        latestSnapshotId=sid,
        snapshots=[entry],
    )
    validate_generation(index, artifacts)
    return (
        index,
        artifacts,
        dict(
            reusedQuarters=reused,
            computedQuarters=computed,
            pendingClassification=[
                row["modelId"]
                for row in inventory
                if row["mediaClass"] == "unclassified" and row["reportingAnchorQuarter"]
            ],
        ),
    )


def publish_generation(root, index, artifacts):
    """Verify all exact bytes, persist immutable objects, then atomically switch index.

    One writer per publication root is required. Earlier generation files remain
    immutable. The caller explicitly chooses which validated snapshots to advertise.
    """
    validate_generation(index, artifacts)
    _public_strings(index)
    for raw in artifacts.values():
        _public_strings(json.loads(raw))
    root = Path(root).resolve()
    for path, raw in artifacts.items():
        target = root / path
        if not target.resolve().is_relative_to(root):
            raise ValueError("Publication path escapes root")
        atomic_write(target, raw, immutable=True)
        if target.read_bytes() != raw:
            raise ValueError("Immutable publication readback mismatch")
    atomic_write(root / "index.json", json_bytes(index))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    config = load_json(args.config)
    inputs = [
        QuarterInput(
            row["quarter"],
            Path(row["directory"]),
            Path(row["receipt"]) if row.get("receipt") else None,
        )
        for row in config.get("inputs", [])
    ]
    summary_manifests = config.get("summaryManifests", [])
    if "catalog" in config:
        if summary_manifests or inputs:
            raise ValueError("Catalog mode cannot be combined with other input modes")
        catalog = config["catalog"]
        summary_manifests = catalog_summary_manifests(
            catalog["localRoot"],
            catalog["path"],
            catalog["sha256"],
            history_start=config["historyStart"],
            as_of=config["asOfQuarter"],
        )
    index, artifacts, diagnostics = generate(
        inputs,
        summary_manifests=summary_manifests,
        cache_root=config.get("cacheRoot"),
        as_of=config["asOfQuarter"],
        history_start=config["historyStart"],
        registry=config["registry"],
        patterns=config["patterns"],
        generator_revision=config["generatorRevision"],
        selection=config["selection"],
        kind=config.get("kind", "backblaze"),
        generated_at=config["generatedAt"],
        first_published_date=config.get("firstPublishedDate", "2013-04-10"),
        matrix_calculation_version=config.get(
            "matrixCalculationVersion", MATRIX_CALCULATION_VERSION
        ),
    )
    publish_generation(config["outputDirectory"], index, artifacts)
    print(json.dumps(dict(snapshotId=index["latestSnapshotId"], **diagnostics)))


if __name__ == "__main__":
    main()
