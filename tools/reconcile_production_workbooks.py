"""Bounded aggregate-only comparison; never assigns calendar dates by row ordinal.

Workbook calendar dates are unknown. Count matches constrained by chronological
order are inference anchors, not proof of the workbook source lineage.
All other metric comparisons remain independent of that anchor. Count matches
must not be presented as independent validation of Count.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from decimal import Decimal
from pathlib import Path

METRICS = (
    "observedRecordedAfr",
    "observedRecordedAfrDelta",
    "count",
    "populationDelta",
    "new",
    "retired",
    "failed",
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def equal(reference: str, actual: float | int | None, metric: str) -> bool:
    if actual is None:
        return False
    expected, observed = Decimal(reference), Decimal(str(actual))
    if metric in METRICS[:2]:
        return abs(expected - observed) <= max(Decimal("1e-12"), abs(expected) * Decimal("1e-12"))
    return expected == observed


def comparison(reference: str, actual: float | int | None, metric: str, cell: dict) -> str:
    if equal(reference, actual, metric):
        return "anchor_equal" if metric == "count" else "equal"
    if cell["status"] == "source_incomplete" and actual is None:
        return "declared_partial_unavailable"
    if (
        metric in ("observedRecordedAfrDelta", "populationDelta")
        and cell["deltaReason"] == "initialized"
        and actual == 0
    ):
        return "declared_first_delta_zero"
    if metric == "retired" and actual is None and cell["retiredReason"] == "gap_obstructed":
        return "declared_gap_retirement_unavailable"
    return "unexplained_difference"


def chronological_candidates(candidates: list[list[str]]) -> list[list[str]]:
    """Keep dates that participate in a full strictly increasing Count match."""
    forward: list[list[str]] = []
    for index, dates in enumerate(candidates):
        forward.append([q for q in dates if index == 0 or any(prior < q for prior in forward[-1])])
    backward: list[list[str]] = [[] for _ in candidates]
    for index in range(len(candidates) - 1, -1, -1):
        backward[index] = [
            q
            for q in forward[index]
            if index == len(candidates) - 1 or any(q < later for later in backward[index + 1])
        ]
    return backward


def reconcile(reference: dict, descriptor: dict, matrix: dict) -> dict:
    if reference["snapshot"] != matrix["asOfQuarter"]:
        raise ValueError("Compare a reference only against its matching as-of snapshot")
    inventory = descriptor["context"]["inventory"]
    blocks = {block["modelId"]: block for block in matrix["models"]}
    results = []
    totals: Counter[str] = Counter()
    for model in reference["models"]:
        exact = [item for item in inventory if item["modelNumber"] == model["model"]]
        if len(exact) != 1 or exact[0]["modelId"] not in blocks:
            raise ValueError(f"No unique exact model block: {model['model']}")
        item = exact[0]
        cells = {cell["quarter"]: cell for cell in blocks[item["modelId"]]["cells"]}
        retained = [row for row in model["rows"] if row["status"] == "retained"]
        raw_candidates = [
            [
                entry["quarter"]
                for entry in item["history"]
                if entry["knownIdentityLowerBound"] == int(row["cells"][2][1])
            ]
            for row in retained
        ]
        feasible = chronological_candidates(raw_candidates)
        rows = []
        for index, (row, candidates) in enumerate(zip(retained, feasible, strict=True)):
            detail: dict = dict(
                sheetRow=row["sheet_row"],
                countCandidateQuarters=raw_candidates[index],
                candidateQuarters=candidates,
            )
            if len(candidates) != 1:
                detail["mapping"] = "unresolved"
                totals["unresolved_rows"] += 1
                rows.append(detail)
                continue
            q = candidates[0]
            detail.update(mapping="unique_count_inference", quarter=q)
            cell = cells.get(q)
            if cell is None:
                detail["mapping"] = "outside_matrix"
                totals["unresolved_rows"] += 1
                rows.append(detail)
                continue
            detail.update(
                status=cell["status"],
                workbookRetainedOrdinal=row["retained_ordinal"],
                v2RelativeQuarter=cell["relativeQuarter"],
                baselineQuarter=cell["baselineQuarter"],
                baselineQuarterDistance=cell["baselineQuarterDistance"],
                cumulativeKnownFailures=cell["cumulativeKnownFailures"],
                cumulativeKnownDriveDays=cell["cumulativeKnownDriveDays"],
            )
            totals["mapped_rows"] += 1
            if row["retained_ordinal"] != cell["relativeQuarter"]:
                totals["elapsed_axis_changed_rows"] += 1
            values = []
            for metric, (address, raw) in zip(METRICS, row["cells"], strict=True):
                actual = cell["metrics"][metric]
                result = comparison(raw, actual, metric, cell)
                if (
                    result == "unexplained_difference"
                    and metric == "populationDelta"
                    and index > 0
                    and len(feasible[index - 1]) == 1
                    and cells[feasible[index - 1][0]]["status"] == "source_incomplete"
                    and int(raw)
                    == int(row["cells"][2][1]) - int(retained[index - 1]["cells"][2][1])
                ):
                    result = "declared_partial_baseline_change"
                totals[result] += 1
                values.append(
                    dict(metric=metric, cell=address, reference=raw, actual=actual, result=result)
                )
            detail["values"] = values
            rows.append(detail)
        results.append(dict(model=model["model"], modelId=item["modelId"], rows=rows))
    return dict(
        schema="production-workbook-reconciliation/v1",
        snapshot=reference["snapshot"],
        workbookSource=reference["source"],
        workbookModelCount=len(reference["models"]),
        productionMatrixModelCount=len(blocks),
        productionModelsOutsideWorkbook=[
            item["modelNumber"]
            for item in inventory
            if item["modelId"] in blocks
            and item["modelNumber"] not in {model["model"] for model in reference["models"]}
        ],
        mappingBasis="Exact modelNumber; Count equals ledger knownIdentityLowerBound; retain dates participating in full strictly chronological matches; require unique remaining date per row",
        limitations=[
            "Workbook calendar mapping and source invocation are unknown; these are conditional inferences, not source-proven dates.",
            "Count is used to select candidate dates, so anchor_equal is not independent Count validation.",
            "Unresolved rows and unexplained differences remain visible; equal rows do not authenticate workbook source history.",
            "Observed-history AFR uses the same cumulative recorded formula as the audited workbook generator; its label alone cannot explain numerical differences.",
        ],
        totals=dict(sorted(totals.items())),
        models=results,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("generation", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    index = load(args.generation / "index.json")
    snapshots = [
        snapshot
        for snapshot in index["snapshots"]
        if snapshot["asOfQuarter"] == load(args.reference)["snapshot"]
    ]
    if len(snapshots) != 1:
        raise ValueError("Expected one matching snapshot in generation index")
    descriptor_path = args.generation / snapshots[0]["descriptor"]["path"]
    descriptor = load(descriptor_path)
    matrix_path = args.generation / descriptor["matrix"]["path"]
    report = reconcile(load(args.reference), descriptor, load(matrix_path))
    report["inputSha256"] = {
        "fixture": hashlib.sha256(args.reference.read_bytes()).hexdigest(),
        "descriptor": hashlib.sha256(descriptor_path.read_bytes()).hexdigest(),
        "matrix": hashlib.sha256(matrix_path.read_bytes()).hexdigest(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = [
        f"{report['snapshot']} workbook / production v2 reconciliation",
        "",
        *report["limitations"],
        "",
        "Totals (metric cells unless named rows):",
        *(f"  {name}: {value}" for name, value in report["totals"].items()),
        "",
        "Per-model unexplained differences (see JSON for exact values and inferred dates):",
    ]
    for model in report["models"]:
        differences = Counter(
            value["metric"]
            for row in model["rows"]
            for value in row.get("values", [])
            if value["result"] == "unexplained_difference"
        )
        lines.append(f"  {model['model']}: {dict(differences)}")
    lines.extend(["", "Exact input SHA-256:"])
    lines.extend(f"  {name}: {value}" for name, value in report["inputSha256"].items())
    args.output.with_suffix(".txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report["totals"], sort_keys=True))


if __name__ == "__main__":
    main()
