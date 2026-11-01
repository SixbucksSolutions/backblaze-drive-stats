"""Build tiny fictional contract examples, without reading any source observations.

Payloads bind the canonical context hash; the descriptor binds payload bytes; the
index binds descriptor bytes. This directed construction has no hash cycle.
"""

from __future__ import annotations

import calendar
import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = "2.0.0"
EVIDENCE = [
    {
        "id": "sample-fictional-evidence",
        "sha256": hashlib.sha256(b"fictional evidence, no source data").hexdigest(),
        "url": "https://example.org/sample-evidence",
    }
]
METRICS = (
    "observedRecordedAfr",
    "observedRecordedAfrDelta",
    "count",
    "populationDelta",
    "new",
    "retired",
    "failed",
)


@dataclass(frozen=True)
class Model:
    model_id: str
    vendor: str
    media: str
    seed: bool
    capacity: float
    counts: tuple[int, ...]


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def write_artifact(stem: str, value: object) -> dict[str, object]:
    content = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode("utf-8")
    sha256 = digest(content)
    name = f"{stem}.{sha256}.json"
    (ROOT / name).write_bytes(content)
    return {"path": name, "sha256": sha256, "sizeBytes": len(content)}


def quarter_dates(quarter: str) -> tuple[date, date, int]:
    year, number = int(quarter[:4]), int(quarter[-1])
    month = 3 * number
    first = date(year, month - 2, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    return first, last, (last - first).days + 1


def shift_quarter(quarter: str, distance: int) -> str:
    absolute = int(quarter[:4]) * 4 + int(quarter[-1]) - 1 + distance
    return f"{absolute // 4:04d}-Q{absolute % 4 + 1}"


def build_snapshot(modern: bool) -> tuple[str, dict[str, object]]:
    quarters = (
        ["2023-Q2", "2023-Q3", "2023-Q4"]
        if modern
        else ["2013-Q1", "2013-Q2", "2013-Q3", "2013-Q4", "2014-Q1", "2014-Q2"]
    )
    statuses = (
        ["complete"] * 3
        if modern
        else ["unpublished", "partial", "complete", "missing", "complete", "complete"]
    )
    models = [
        Model(
            "sample-seed-hdd",
            "Sample Established",
            "hdd",
            True,
            8.0,
            (2200, 2300, 2400) if modern else (0, 2100, 2200, 0, 1000, 2300),
        ),
        Model(
            "sample-context-only-hdd",
            "Sample Established",
            "hdd",
            True,
            4.0,
            (100, 100, 100) if modern else (0, 100, 100, 0, 100, 100),
        ),
        Model(
            "sample-new-vendor-hdd",
            "Sample New Vendor",
            "hdd",
            False,
            12.0,
            (2100, 2200, 2300) if modern else (0, 50, 2100, 0, 500, 2200),
        ),
        Model(
            "sample-ssd",
            "Sample Solid",
            "ssd",
            False,
            1.0,
            (3000,) * 3 if modern else (0, 3000, 3000, 0, 3000, 3000),
        ),
        Model(
            "sample-unclassified",
            "Unknown",
            "unclassified",
            False,
            2.0,
            (2500,) * 3 if modern else (0, 2500, 2500, 0, 2500, 2500),
        ),
    ]
    selected = models[:3]
    analysis = [models[0], models[2]]
    observed_days = [
        (0 if status in {"missing", "unpublished"} else 82)
        if status != "complete"
        else quarter_dates(quarter)[2]
        for quarter, status in zip(quarters, statuses, strict=True)
    ]
    coverage: list[dict[str, object]] = []
    for i, (quarter, status) in enumerate(zip(quarters, statuses, strict=True)):
        first, last, days = quarter_dates(quarter)
        available = status in {"complete", "partial"}
        coverage.append(
            {
                "quarter": quarter,
                "status": status,
                "expectedDays": days,
                "observedDays": observed_days[i],
                "firstObservedDate": ("2013-04-10" if status == "partial" else first.isoformat())
                if available
                else None,
                "lastObservedDate": last.isoformat() if available else None,
                "knownObservationRows": sum(m.counts[i] for m in models) * observed_days[i]
                if available
                else None,
                "reason": {
                    "complete": "Sample: every calendar date represented",
                    "partial": "Sample: pre-publication prefix absent; only 82 of 91 dates",
                    "missing": "Sample: source capture absent, population unknown",
                    "unpublished": "Sample: quarter predates publication domain",
                }[status],
                "datacenterFieldAvailable": quarter >= "2023-Q3",
                "evidence": EVIDENCE,
            }
        )
    inventory: list[dict[str, object]] = []
    anchors: dict[str, int] = {}
    for model in models:
        first_observed = next((i for i, count in enumerate(model.counts) if count), None)
        proof = next((i for i, count in enumerate(model.counts) if count >= 2000), None)
        complete = next(
            (
                i
                for i, count in enumerate(model.counts)
                if count >= 2000 and statuses[i] == "complete"
            ),
            None,
        )
        if proof is not None:
            anchors[model.model_id] = proof
        history = []
        for i, quarter in enumerate(quarters):
            status, count = statuses[i], model.counts[i]
            available = status in {"complete", "partial"}
            history.append(
                {
                    "quarter": quarter,
                    "quarterCount": count if status == "complete" else None,
                    "knownIdentityLowerBound": count if available else None,
                    "knownFailures": 1 if count else 0,
                    "knownDriveDays": count * observed_days[i],
                    "thresholdProof": (
                        "complete_exact_count"
                        if status == "complete"
                        else "partial_identity_lower_bound"
                    )
                    if count >= 2000
                    else None,
                    "evidence": EVIDENCE,
                }
            )
        inventory.append(
            {
                "modelId": model.model_id,
                "vendor": model.vendor,
                "modelNumber": model.model_id.upper(),
                "rawAliases": [model.model_id.upper()],
                "mediaClass": model.media,
                "classificationEvidence": EVIDENCE,
                "seedMatch": model.seed,
                "capacityTB": model.capacity,
                "history": history,
                "firstObservedInDeclaredHistory": quarters[first_observed]
                if first_observed is not None
                else None,
                "firstProvenThresholdInDeclaredHistory": quarters[proof]
                if proof is not None
                else None,
                "firstCompleteQualifyingInDeclaredHistory": quarters[complete]
                if complete is not None
                else None,
                "reportingAnchorQuarter": quarters[proof] if proof is not None else None,
                "earlierQualificationNotExcluded": not modern,
                "anchorSearchComplete": modern,
                "recordedHistoryComplete": modern,
                "lifetimeExposureComplete": False,
            }
        )
    snapshot_id = "sample-modern-locations" if modern else "sample-prefix-gap-reentry"
    cutoff = quarter_dates(quarters[-1])[1].isoformat()
    manifest_sha = digest(snapshot_id.encode())
    context = {
        "snapshotId": snapshot_id,
        "asOfQuarter": quarters[-1],
        "cutoffDate": cutoff,
        "generatedAt": "2026-10-31T00:00:00Z",
        "kind": "sample",
        "generatorRevision": "sample-v2-fixture-1",
        "sourceManifestSha256": manifest_sha,
        "versions": dict.fromkeys(
            ["normalization", "classification", "selection", "cohort", "rate", "capacity"],
            VERSION,
        ),
        "sourceDomain": {
            "historyStartQuarter": quarters[0],
            "firstPublishedDate": "2013-04-10",
            "throughDate": cutoff,
            "evidence": EVIDENCE,
        },
        "provenance": {
            "label": "SAMPLE: wholly fictional aggregate values; no actual drive records",
            "credit": "Contract design acknowledges Backblaze Drive Stats; these values are fictional",
            "url": "https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data",
        },
        "selection": {
            "contextModelIds": [m.model_id for m in selected],
            "analysisModelIds": [m.model_id for m in analysis],
            "purchaseDefaultModelIds": [analysis[1].model_id],
            "historicalReferenceModelIds": [analysis[0].model_id],
            "positiveSeed": {
                "version": VERSION,
                "asOfQuarter": quarters[-1],
                "patternsSha256": digest(b"sample retained seed patterns"),
                "modelIds": [m.model_id for m in models if m.seed],
                "evidence": EVIDENCE,
            },
        },
        "coverage": coverage,
        "inventory": inventory,
    }
    context_sha = digest(canonical(context))
    common = {
        "contractVersion": VERSION,
        "contextSha256": context_sha,
        "snapshotId": snapshot_id,
        "asOfQuarter": quarters[-1],
    }
    matrix_models = []
    for model in analysis:
        anchor = anchors[model.model_id]
        cumulative_failures = 0
        cumulative_days = 0
        baseline: tuple[int, float, int] | None = None
        cells = []
        for i, quarter in enumerate(quarters):
            count, status = model.counts[i], statuses[i]
            cumulative_failures += 1 if count else 0
            cumulative_days += count * observed_days[i]
            if i < anchor:
                continue
            eligible = status == "complete" and count >= 2000
            rate = cumulative_failures / cumulative_days * 36500 if cumulative_days else None
            metrics: dict[str, object] = dict[str, object]((name, None) for name in METRICS)
            retired_reason = "unavailable"
            if eligible and rate is not None:
                retirement_obstructed = any(s != "complete" for s in statuses[i:])
                retired = 1 if i == len(quarters) - 1 else None if retirement_obstructed else 0
                retired_reason = (
                    "cutoff_failed_proxy"
                    if i == len(quarters) - 1
                    else "gap_obstructed"
                    if retirement_obstructed
                    else "inferred"
                )
                metrics = {
                    "observedRecordedAfr": rate,
                    "observedRecordedAfrDelta": rate - baseline[1] if baseline else 0,
                    "count": count,
                    "populationDelta": count - baseline[2] if baseline else 0,
                    "new": count if i == 0 else max(0, count - max(model.counts[:i])),
                    "retired": retired,
                    "failed": 1,
                }
            cell = {
                "quarter": quarter,
                "relativeQuarter": i - anchor + 1,
                "status": "eligible"
                if eligible
                else {
                    "complete": "below_threshold",
                    "partial": "source_incomplete",
                    "missing": "missing",
                    "unpublished": "unpublished",
                }[status],
                "metrics": metrics,
                "quarterAfr": 36500 / (count * observed_days[i]) if eligible else None,
                "completeHistoryAfr": rate if eligible and modern else None,
                "sourceHistoryComplete": all(s == "complete" for s in statuses[: i + 1]),
                "cumulativeKnownFailures": cumulative_failures,
                "cumulativeKnownDriveDays": cumulative_days,
                "baselineQuarter": quarters[baseline[0]] if eligible and baseline else None,
                "baselineQuarterDistance": i - baseline[0] if eligible and baseline else None,
                "deltaReason": "prior_eligible"
                if eligible and baseline
                else "initialized"
                if eligible
                else "unavailable",
                "retiredReason": retired_reason,
            }
            cells.append(cell)
            if eligible and rate is not None:
                baseline = (i, rate, count)
        for relative in range(len(cells) + 1, 25):
            cells.append(
                {
                    "quarter": shift_quarter(quarters[anchor], relative - 1),
                    "relativeQuarter": relative,
                    "status": "snapshot_end",
                    "metrics": dict.fromkeys(METRICS),
                    "quarterAfr": None,
                    "completeHistoryAfr": None,
                    "sourceHistoryComplete": False,
                    "cumulativeKnownFailures": None,
                    "cumulativeKnownDriveDays": None,
                    "baselineQuarter": None,
                    "baselineQuarterDistance": None,
                    "deltaReason": "unavailable",
                    "retiredReason": "unavailable",
                }
            )
        matrix_models.append(
            {
                "modelId": model.model_id,
                "reportingAnchorQuarter": quarters[anchor],
                "sourceHistoryComplete": modern,
                "lifetimeExposureComplete": False,
                "cells": cells,
            }
        )
    matrix_ref = write_artifact(
        f"{snapshot_id}-matrix",
        {
            "artifactType": "matrix",
            **common,
            "rateBasis": "observed-recorded-exposure-v2",
            "rateLabel": "Observed-history AFR",
            "relativeQuarterCount": 24,
            "guideAfterRelativeYear": 6,
            "models": matrix_models,
        },
    )
    quarter_refs = []
    for i, quarter in enumerate(quarters):
        status = statuses[i]
        payload = None
        if status in {"complete", "partial"}:
            scopes = {
                "selected_hdd": make_scope(selected, i, statuses),
                "all_supplied": make_scope(models, i, statuses),
            }
            full = status == "complete"
            population = sum(m.counts[i] for m in models)
            capacity = sum(m.counts[i] * m.capacity for m in models)
            available = quarter >= "2023-Q3"
            # A fictional one-location distribution keeps the reconciliation visible.
            locations = [
                {
                    "name": "Unknown",
                    "count": 0 if full and available else population if full else None,
                    "capacityTB": 0.0 if full and available else capacity if full else None,
                }
            ]
            if available:
                locations.append(
                    {
                        "name": "Sample DC",
                        "count": population if full else None,
                        "capacityTB": capacity if full else None,
                    }
                )
            payload = write_artifact(
                f"{snapshot_id}-{quarter}",
                {
                    "artifactType": "supporting_quarter",
                    **common,
                    "quarter": quarter,
                    "status": status,
                    "capacityBasis": "observed-identity-capacity-mode-v2",
                    "scopes": scopes,
                    "datacenters": {
                        "fieldAvailable": available,
                        "knownLocationPopulationShare": float(available) if full else None,
                        "locations": locations,
                    },
                },
            )
        quarter_refs.append({"quarter": quarter, "status": status, "payload": payload})
    descriptor = {
        "artifactType": "snapshot_descriptor",
        "contractVersion": VERSION,
        "context": context,
        "contextSha256": context_sha,
        "matrix": matrix_ref,
        "quarters": quarter_refs,
    }
    descriptor_ref = write_artifact(f"{snapshot_id}-descriptor", descriptor)
    return snapshot_id, {
        "snapshotId": snapshot_id,
        "asOfQuarter": quarters[-1],
        "sourceManifestSha256": manifest_sha,
        "descriptor": descriptor_ref,
    }


def make_scope(models: list[Model], i: int, statuses: list[str]) -> dict[str, object]:
    complete = statuses[i] == "complete"
    counts = sum(m.counts[i] for m in models)
    new_counts = {
        m.model_id: m.counts[i] if i == 0 else max(0, m.counts[i] - max(m.counts[:i]))
        for m in models
    }
    new = sum(new_counts.values())
    capacity = sum(m.counts[i] * m.capacity for m in models)
    rows = [
        {
            "modelId": m.model_id,
            "count": m.counts[i] if complete else None,
            "new": new_counts[m.model_id] if complete else None,
            "capacityTB": m.counts[i] * m.capacity if complete else None,
        }
        for m in models
    ]
    manufacturers = []
    for vendor in sorted({m.vendor for m in models}):
        vendor_models = [m for m in models if m.vendor == vendor]
        vendor_count = sum(m.counts[i] for m in vendor_models)
        vendor_new = sum(new_counts[m.model_id] for m in vendor_models)
        vendor_capacity = sum(m.counts[i] * m.capacity for m in vendor_models)
        manufacturers.append(
            {
                "vendor": vendor,
                "count": vendor_count if complete else None,
                "new": vendor_new if complete else None,
                "capacityTB": vendor_capacity if complete else None,
                "populationShare": vendor_count / counts if complete and counts else None,
                "newShare": vendor_new / new if complete and new else None,
                "capacityShare": vendor_capacity / capacity if complete and capacity else None,
            }
        )
    previous_complete = i > 0 and statuses[i - 1] == "complete"
    return {
        "models": rows,
        "totals": {
            "count": counts if complete else None,
            "new": new if complete else None,
            "capacityTB": capacity if complete else None,
        },
        "manufacturers": manufacturers,
        "capacityDeltaTB": capacity - sum(m.counts[i - 1] * m.capacity for m in models)
        if complete and previous_complete
        else None,
        "capacityDeltaReason": "current_incomplete"
        if not complete
        else "first_quarter"
        if i == 0
        else "previous_complete"
        if previous_complete
        else "previous_unavailable",
    }


def main() -> None:
    # Only fixture artifacts created by this builder are replaced; no data/cache reads.
    for old in ROOT.glob("sample-*.json"):
        old.unlink()
    old_id, old = build_snapshot(False)
    modern_id, modern = build_snapshot(True)
    index = {
        "artifactType": "generation_index",
        "contractVersion": VERSION,
        "latestSnapshotId": modern_id,
        "snapshots": [old, modern],
    }
    write_artifact("sample-index", index)
    print(f"Built fictional v2 fixtures: {old_id}, {modern_id}")


if __name__ == "__main__":
    main()
