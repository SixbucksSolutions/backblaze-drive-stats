"""Validate the proposed supporting aggregate contract; no dataset processing."""

from __future__ import annotations

import json
import math
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "contracts/supporting-history-v1.schema.json"


def load_supporting(path: Path) -> dict:
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def _require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def _equal(actual, expected) -> bool:
    if actual is None or expected is None:
        return actual is expected
    if isinstance(actual, int) and isinstance(expected, int):
        return actual == expected
    return math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10)


def _ordinal(quarter: str) -> int:
    return int(quarter[:4]) * 4 + int(quarter[-1]) - 1


def validate_supporting(value: dict) -> None:
    """Schema plus arithmetic/coverage checks used by small golden fixtures."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)
    # JSON accepts NaN/Infinity in Python by default; public JSON must not.
    json.dumps(value, allow_nan=False)
    url = urlsplit(value["provenance"]["sourceUrl"])
    _require(
        url.scheme == "https"
        and bool(url.hostname)
        and url.username is None
        and url.password is None
        and not url.query
        and not url.fragment,
        "source URL must be a public HTTPS link without credentials, query or fragment",
    )
    periods = value["quarters"]
    keys = [period["quarter"] for period in periods]
    _require(keys == sorted(set(keys)), "quarters must be unique and chronological")
    _require(keys[-1] == value["asOfQuarter"], "history must end at as-of quarter")
    _require(
        all(_ordinal(b) == _ordinal(a) + 1 for a, b in zip(keys, keys[1:], strict=False)),
        "missing quarters need explicit records",
    )
    history_start = value["provenance"]["historyStart"]
    history_quarter = f"{history_start[:4]}-Q{(int(history_start[5:7]) - 1) // 3 + 1}"
    _require(history_quarter == keys[0], "history start quarter must be included")
    first_month = (int(keys[0][-1]) - 1) * 3 + 1
    if periods[0]["coverage"] == "complete":
        _require(
            history_start == f"{keys[0][:4]}-{first_month:02d}-01",
            "partial leading quarter cannot be complete",
        )
    previous: dict[str, tuple[dict, dict]] = {}
    for period in periods:
        complete = period["coverage"] == "complete"
        _require((period["coverageReason"] is None) == complete, "coverage needs explicit reason")
        scopes = period["scopes"]
        _require(
            {s["scopeId"] for s in scopes} == {"selected_hdd", "all_supplied"},
            "scope IDs must be unique",
        )
        for scope in scopes:
            selected = scope["scopeId"] == "selected_hdd"
            totals = scope["totals"]
            if not complete:
                _require(
                    all(v is None for v in totals.values()),
                    "partial coverage cannot publish measured totals",
                )
                _require(
                    not scope["models"] and not scope["manufacturers"] and not scope["datacenters"],
                    "partial coverage rows must be unavailable",
                )
                _require(
                    scope["knownLocationShare"] is None
                    and scope["capacityDeltaTb"] is None
                    and scope["capacityDeltaReason"] == "coverage_gap",
                    "partial coverage cannot imply location or capacity change",
                )
                previous[scope["scopeId"]] = (period, scope)
                continue
            _require(
                all(totals[k] is not None for k in ("driveCount", "newDrives")),
                "complete coverage needs counts",
            )
            _require(totals["newDrives"] <= totals["driveCount"], "additions exceed population")
            models = scope["models"]
            _require(len({m["id"] for m in models}) == len(models), "duplicate model ID")
            _require(
                len({(m["manufacturer"], m["model"]) for m in models}) == len(models),
                "duplicate canonical model",
            )
            for model in models:
                measures = model["measures"]
                _require(
                    measures["driveCount"] is not None and measures["newDrives"] is not None,
                    "complete model counts missing",
                )
                _require(
                    measures["newDrives"] <= measures["driveCount"],
                    "model additions exceed population",
                )
            for metric in totals:
                values = [m["measures"][metric] for m in models]
                expected = None if any(v is None for v in values) else sum(values)
                _require(
                    totals[metric] == expected
                    if metric != "capacityTb"
                    else _equal(totals[metric], expected),
                    f"model total mismatch: {metric}",
                )
            if selected:
                _require(
                    {m["id"] for m in models} <= set(value["provenance"]["selectedModelIds"]),
                    "model outside resolved discovery cohort",
                )
                _require(
                    not scope["datacenters"] and scope["knownLocationShare"] is None,
                    "selected scope has no datacenter rollup",
                )
                names = {m["manufacturer"] for m in models}
                _require(
                    {m["manufacturer"] for m in scope["manufacturers"]} == names
                    and len(scope["manufacturers"]) == len(names),
                    "manufacturer set mismatch",
                )
                for manufacturer in scope["manufacturers"]:
                    members = [
                        m["measures"]
                        for m in models
                        if m["manufacturer"] == manufacturer["manufacturer"]
                    ]
                    for metric, share in (
                        ("driveCount", "populationShare"),
                        ("newDrives", "newShare"),
                        ("capacityTb", "capacityShare"),
                    ):
                        values = [m[metric] for m in members]
                        amount = None if any(v is None for v in values) else sum(values)
                        _require(
                            manufacturer["measures"][metric] == amount
                            if metric != "capacityTb"
                            else _equal(manufacturer["measures"][metric], amount),
                            "manufacturer sum mismatch",
                        )
                        denominator = totals[metric]
                        fraction = (
                            amount / denominator if amount is not None and denominator else None
                        )
                        _require(
                            _equal(manufacturer[share], fraction), "share denominator mismatch"
                        )
            else:
                _require(not scope["manufacturers"], "manufacturer report uses selected HDD scope")
                locations = scope["datacenters"]
                _require(
                    len({d["datacenter"] for d in locations}) == len(locations),
                    "duplicate location",
                )
                _require(
                    all(
                        d["datacenter"] == "Unknown"
                        or d["datacenter"] == d["datacenter"].strip().upper()
                        for d in locations
                    ),
                    "location not normalized",
                )
                for metric in ("driveCount", "capacityTb"):
                    values = [d[metric] for d in locations]
                    amount = None if any(v is None for v in values) else sum(values)
                    _require(
                        totals[metric] == amount
                        if metric == "driveCount"
                        else _equal(totals[metric], amount),
                        "datacenter total mismatch",
                    )
                unknown = sum(d["driveCount"] for d in locations if d["datacenter"] == "Unknown")
                fraction = (
                    (totals["driveCount"] - unknown) / totals["driveCount"]
                    if totals["driveCount"]
                    else None
                )
                _require(
                    _equal(scope["knownLocationShare"], fraction),
                    "location coverage denominator mismatch",
                )
            prior = previous.get(scope["scopeId"])
            if prior is None:
                delta, reason = None, "no_previous_quarter"
            elif prior[0]["coverage"] != "complete":
                delta, reason = None, "coverage_gap"
            elif totals["capacityTb"] is None or prior[1]["totals"]["capacityTb"] is None:
                delta, reason = None, "capacity_unavailable"
            else:
                delta, reason = totals["capacityTb"] - prior[1]["totals"]["capacityTb"], None
            _require(
                _equal(scope["capacityDeltaTb"], delta) and scope["capacityDeltaReason"] == reason,
                "capacity delta baseline mismatch",
            )
            previous[scope["scopeId"]] = (period, scope)
        if complete:
            chosen = next(s for s in scopes if s["scopeId"] == "selected_hdd")
            all_rows = {
                m["id"]: m
                for m in next(s for s in scopes if s["scopeId"] == "all_supplied")["models"]
            }
            for model in chosen["models"]:
                full = all_rows.get(model["id"])
                _require(
                    full is not None
                    and full["manufacturer"] == model["manufacturer"]
                    and full["model"] == model["model"],
                    "selected population is not a subset of all supplied",
                )
                assert full is not None  # _require above rejects a missing full-scope model.
                for metric in ("driveCount", "newDrives", "capacityTb"):
                    _require(
                        model["measures"][metric] == full["measures"][metric]
                        if metric != "capacityTb"
                        else _equal(model["measures"][metric], full["measures"][metric]),
                        "selected model must retain all canonical alias observations",
                    )
            expected = set(value["provenance"]["selectedModelIds"]) & set(all_rows)
            _require(
                {m["id"] for m in chosen["models"]} == expected,
                "selected cohort model silently omitted",
            )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    validate_supporting(load_supporting(args.path))
    print("Supporting contract valid")
