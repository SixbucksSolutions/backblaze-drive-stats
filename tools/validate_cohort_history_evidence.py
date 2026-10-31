"""Validate the proposed additive ledger; never scan sources or alter production."""

import argparse
import calendar
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "contracts/cohort-history-evidence-v1.schema.json"


def ordinal(quarter):
    return int(quarter[:4]) * 4 + int(quarter[-1]) - 1


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError(f"nonfinite JSON number: {value}")


def load_evidence(path):
    return json.loads(
        Path(path).read_text(encoding="utf-8"),
        object_pairs_hook=_unique_pairs,
        parse_constant=_reject_constant,
    )


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_evidence(data):
    """Check internal claims only; evidence references require independent audit."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(data)
    scope = data["scope"]
    start, end = ordinal(scope["historyStart"]), ordinal(scope["throughQuarter"])
    _require(start <= end, "history window is reversed")
    models = data["models"]
    by_id = {model["modelId"]: model for model in models}
    _require(len(by_id) == len(models), "duplicate model IDs")
    exact = {(model["vendor"], model["modelNumber"]) for model in models}
    _require(len(exact) == len(models), "duplicate canonical model")
    aliases = set()
    for model in models:
        for alias in model["rawAliases"]:
            key = (model["vendor"], alias)
            _require(
                key not in aliases, "raw alias maps to multiple canonical models within vendor"
            )
            aliases.add(key)
    analysis = set(scope["analysisModelIds"])
    purchase = set(scope["purchaseDefaultModelIds"])
    reference = set(scope["historicalReferenceModelIds"])
    _require(analysis <= by_id.keys(), "analysis cohort contains unknown IDs")
    _require(purchase <= analysis and reference <= analysis, "view subsets exceed analysis cohort")
    _require(not purchase & reference, "purchase and historical defaults overlap")
    for model in models:
        label = model["modelId"]
        history = model["history"]
        quarters = history["quarters"]
        _require(
            [ordinal(row["quarter"]) for row in quarters] == list(range(start, end + 1)),
            f"{label}: ledger must enumerate every ordered quarter including gaps",
        )
        if model["mediaClass"] != "unclassified":
            _require(model["classificationEvidenceRefs"], f"{label}: classification needs evidence")
        if label in analysis:
            _require(model["mediaClass"] == "hdd", f"{label}: analysis requires confirmed HDD")
        first_observed = None
        first_qualifying = None
        for row in quarters:
            complete = row["coverage"] == "complete"
            count = row["count"]
            _require(
                (count is not None) == complete,
                f"{label}: only complete coverage establishes Count, including zero",
            )
            _require(row["failures"] <= row["driveDays"], f"{label}: failure/exposure budget")
            if row["driveDays"] > 0 and first_observed is None:
                first_observed = row["quarter"]
            if complete:
                _require(row["evidenceRefs"], f"{label}: complete coverage needs receipt evidence")
                _require(count <= row["driveDays"], f"{label}: Count exceeds drive-days")
                year = int(row["quarter"][:4])
                first_month = (int(row["quarter"][-1]) - 1) * 3 + 1
                days = sum(
                    calendar.monthrange(year, month)[1]
                    for month in range(first_month, first_month + 3)
                )
                _require(
                    row["driveDays"] <= count * days,
                    f"{label}: drive-days exceed Count times actual calendar days",
                )
                if count == 0:
                    _require(row["driveDays"] == 0, f"{label}: absent model has exposure")
                if count >= 2000 and first_qualifying is None:
                    first_qualifying = row["quarter"]
            if row["coverage"] == "missing":
                _require(
                    row["failures"] == row["driveDays"] == 0,
                    f"{label}: missing quarter cannot contribute known components",
                )
        _require(
            history["firstObservedInLoadedHistory"] == first_observed,
            f"{label}: first observed loaded quarter mismatch",
        )
        _require(
            history["firstQualifyingInLoadedHistory"] == first_qualifying,
            f"{label}: first loaded qualifier mismatch",
        )
        if label in analysis:
            _require(first_qualifying is not None, f"{label}: analysis lacks qualifying quarter")
        boundary = history["boundary"]
        _require(boundary["quarter"] == scope["historyStart"], f"{label}: boundary/start mismatch")
        if boundary["kind"] != "unresolved":
            _require(boundary["evidenceRefs"], f"{label}: boundary needs evidence")
        if boundary["kind"] == "bounded_zero":
            _require(
                quarters[0]["coverage"] == "complete" and quarters[0]["count"] == 0,
                f"{label}: bounded stop requires complete exact-model zero",
            )
        dataset_start = boundary["kind"] == "dataset_start"
        prefix = [
            row for row in quarters if first_qualifying and row["quarter"] <= first_qualifying
        ]
        window_anchor = (
            first_qualifying
            if prefix and all(row["coverage"] == "complete" for row in prefix)
            else None
        )
        _require(
            history["verifiedWindowAnchor"] == window_anchor,
            f"{label}: window anchor requires complete search within the declared window",
        )
        window_complete = all(row["coverage"] == "complete" for row in quarters)
        _require(
            history["windowHistoryComplete"] == window_complete,
            f"{label}: window completeness requires every loaded quarter",
        )
        anchor_complete = bool(
            dataset_start
            and first_qualifying
            and all(row["coverage"] == "complete" for row in prefix)
        )
        _require(
            history["anchorSearchComplete"] == anchor_complete,
            f"{label}: anchor requires evidenced dataset start and complete pre-anchor search",
        )
        _require(
            history["verifiedAnchor"] == (first_qualifying if anchor_complete else None),
            f"{label}: first loaded qualifier is not a verified anchor",
        )
        cumulative_complete = dataset_start and window_complete
        _require(
            history["cumulativeHistoryComplete"] == cumulative_complete,
            f"{label}: cumulative completeness requires the entire evidenced source domain",
        )
        expected = {key: sum(row[key] for row in quarters) for key in ("failures", "driveDays")}
        _require(history["knownExposure"] == expected, f"{label}: known exposure reconciliation")
        if not anchor_complete or not cumulative_complete:
            _require(
                history["limitations"], f"{label}: unresolved history needs explicit limitations"
            )
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    for name in args.paths:
        validate_evidence(load_evidence(name))
        print(f"Valid additive evidence ledger: {name}")


if __name__ == "__main__":
    main()
