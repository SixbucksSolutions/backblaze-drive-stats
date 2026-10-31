"""Validate a public v1 matrix: schema, arithmetic, coverage and shared domains.

This validates aggregate artifacts, not the correctness of an upstream daily scan.
Run: python tools/validate_matrix_contract.py fixtures/matrix/*.json
"""

import argparse
import calendar
import json
import math
import re
import statistics
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
METRICS = ("afr", "afrDelta", "count", "populationDelta", "new", "retired", "failed")
GREEN, YELLOW, RED, WHITE = "#00FF00", "#FFFF00", "#FF0000", "#FFFFFF"


def ordinal(q):
    return int(q[:4]) * 4 + int(q[-1]) - 1


def quarter(n):
    return f"{n // 4:04d}-Q{n % 4 + 1}"


def bounds(q):
    year, month = int(q[:4]), (int(q[-1]) - 1) * 3 + 1
    start = date(year, month, 1)
    end = date(year, month + 2, calendar.monthrange(year, month + 2)[1])
    return start, end


def rate(components):
    if components and components["complete"] and components["driveDays"]:
        return components["failures"] * 36500 / components["driveDays"]
    return None


def color_domains(models):
    result = {}
    for metric in METRICS:
        values = [
            c["metrics"][metric]
            for m in models
            for c in m["cells"]
            if c["state"] == "eligible" and c["metrics"][metric] is not None
        ]
        lo, mid, hi = (
            (min(values), statistics.median(values), max(values)) if values else (None,) * 3
        )
        knots = []
        if values:
            assert lo is not None and mid is not None and hi is not None
            if metric == "afr":
                knots = ([(lo, GREEN)] if lo < 1 else []) + [(1, YELLOW), (2, RED)]
            elif metric in ("afrDelta", "populationDelta"):
                low_color, high_color = (GREEN, RED) if metric == "afrDelta" else (RED, GREEN)
                knots = (
                    ([(lo, low_color)] if lo < 0 else [])
                    + [(0, WHITE)]
                    + ([(hi, high_color)] if hi > 0 else [])
                )
            elif metric == "new":
                knots = [(0, WHITE)] + ([(hi, GREEN)] if hi else [])
            elif metric == "retired":
                knots = [(0, GREEN)]
                if mid > 0:
                    knots.append((mid, YELLOW))
                if hi > mid:
                    knots.append((hi, RED))
            else:
                low_color, high_color = (RED, GREEN) if metric == "count" else (GREEN, RED)
                if lo == hi:
                    knots = [(lo, GREEN if metric == "failed" and hi == 0 else YELLOW)]
                else:
                    knots = (
                        ([(lo, low_color)] if lo < mid else [])
                        + [(mid, YELLOW)]
                        + ([(hi, high_color)] if hi > mid else [])
                    )
        result[metric] = dict(
            sampleCount=len(values),
            observedMinimum=lo,
            observedMedian=mid,
            observedMaximum=hi,
            knots=[dict(value=v, color=c) for v, c in knots],
            emptyColor="#F2F2F2",
        )
    return result


def color_for(domain, value):
    """Normative encoded-sRGB interpolation, with exact half-up channel rounding."""
    knots = domain["knots"]
    if value is None or not knots:
        return domain["emptyColor"]
    if value <= knots[0]["value"]:
        return knots[0]["color"]
    if value >= knots[-1]["value"]:
        return knots[-1]["color"]
    for left, right in zip(knots, knots[1:], strict=False):
        if value <= right["value"]:
            ratio = (Decimal(str(value)) - Decimal(str(left["value"]))) / (
                Decimal(str(right["value"])) - Decimal(str(left["value"]))
            )
            channels = []
            for offset in (1, 3, 5):
                a, b = (
                    int(left["color"][offset : offset + 2], 16),
                    int(right["color"][offset : offset + 2], 16),
                )
                channels.append(
                    int((a + ratio * (b - a)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
                )
            return "#" + "".join(f"{c:02X}" for c in channels)
    raise ValueError("unordered color knots")


def load_matrix(path):
    """Strict JSON file reader: reject duplicate keys and non-JSON constants."""

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON key: " + key)
            result[key] = value
        return result

    def invalid(value):
        raise ValueError("nonfinite JSON constant: " + value)

    return json.loads(
        Path(path).read_text(encoding="utf-8"), object_pairs_hook=pairs, parse_constant=invalid
    )


def validate_matrix(data):
    """Raise ValueError for invalid JSON-compatible aggregate data; return data."""

    def check(condition, message):
        if not condition:
            raise ValueError(message)

    def equal(actual, expected, message):
        check(actual == expected, message)

    def rate_equal(actual, expected, message):
        if isinstance(actual, (float, int)) and isinstance(expected, (float, int)):
            check(math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10), message)
        else:
            check(actual == expected, message)

    def finite(value):
        if isinstance(value, float):
            check(math.isfinite(value), "nonfinite number")
        elif isinstance(value, dict):
            for item in value.values():
                finite(item)
        elif isinstance(value, list):
            for item in value:
                finite(item)

    finite(data)
    schema = json.loads((ROOT / "contracts/flagship-matrix-v1.schema.json").read_text())
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(data))
    check(not errors, "schema: " + "; ".join(e.message for e in errors[:3]))
    snap, coverage = data["snapshot"], data["coverage"]
    cutoff = ordinal(snap["asOfQuarter"])
    check(snap["cutoffDate"] == str(bounds(snap["asOfQuarter"])[1]), "snapshot cutoff")
    check(snap["id"] in snap["immutablePath"], "immutable path must identify snapshot")
    check(
        not urlsplit(snap["immutablePath"]).scheme
        and not snap["immutablePath"].startswith(("/", "\\"))
        and ".." not in snap["immutablePath"].split("/"),
        "private or unsafe publication path",
    )
    check(snap["revisionOf"] != snap["id"], "self revision")
    check(coverage["throughQuarter"] == snap["asOfQuarter"], "coverage cutoff")
    qs = coverage["quarters"]
    check(
        [ordinal(q["quarter"]) for q in qs]
        == list(range(ordinal(coverage["historyStart"]), cutoff + 1)),
        "coverage contiguous unique quarters",
    )
    source_ids = [s["id"] for s in data["provenance"]["sources"]]
    check(len(source_ids) == len(set(source_ids)), "duplicate source id")
    for source in data["provenance"]["sources"]:
        if source["publicUrl"] is not None:
            url = urlsplit(source["publicUrl"])
            check(
                url.scheme == "https"
                and url.hostname
                and not url.username
                and not url.password
                and not url.query
                and not url.fragment,
                "private or credential-bearing source URL",
            )
    for q in qs:
        start, end = bounds(q["quarter"])
        check(q["expectedDays"] == (end - start).days + 1, "expected quarter days")
        check(q["observedDays"] <= q["expectedDays"], "observed quarter days")
        check(set(q["sourceIds"]) <= set(source_ids), "unknown source id")
        if q["status"] == "missing":
            check(
                q["observedDays"] == q["rowCount"] == 0
                and q["observedStart"] is None
                and q["observedEnd"] is None
                and not q["sourceIds"],
                "missing coverage evidence",
            )
        else:
            check(q["sourceIds"] and q["observedDays"] > 0, "observed coverage evidence")
            check(
                str(start) <= q["observedStart"] <= q["observedEnd"] <= str(end),
                "coverage date range",
            )
            check(
                q["observedDays"]
                <= (
                    date.fromisoformat(q["observedEnd"]) - date.fromisoformat(q["observedStart"])
                ).days
                + 1,
                "observed day span",
            )
            if q["status"] == "complete":
                check(
                    q["observedDays"] == q["expectedDays"]
                    and q["observedStart"] == str(start)
                    and q["observedEnd"] == str(end),
                    "complete coverage days",
                )
            else:
                check(q["observedDays"] < q["expectedDays"], "incomplete coverage days")
    newest = coverage["newestObservationDate"]
    check(
        any(
            q["observedStart"] is not None and q["observedStart"] <= newest <= q["observedEnd"]
            for q in qs
        ),
        "newest selected observation outside coverage",
    )
    by_q = {q["quarter"]: q for q in qs}
    ids = [m["modelId"] for m in data["models"]]
    identities = [(m["vendor"], m["modelNumber"]) for m in data["models"]]
    check(
        len(ids) == len(set(ids)) and len(identities) == len(set(identities)),
        "duplicate model identity",
    )
    vendor_order = {"Seagate": 0, "Toshiba": 1, "WDC/HGST": 2}
    check(
        data["models"]
        == sorted(
            data["models"],
            key=lambda m: (vendor_order.get(m["vendor"], 3), m["vendor"], m["modelNumber"]),
        ),
        "model block ordering",
    )
    selection = data["selection"]
    inventory = selection["inventory"]
    inventory_ids = [m["modelId"] for m in inventory]
    check(len(inventory_ids) == len(set(inventory_ids)), "duplicate inventory model ID")
    inventory_names = [(m["vendor"], m["modelNumber"]) for m in inventory]
    check(
        len(inventory_names) == len(set(inventory_names)), "duplicate inventory canonical identity"
    )
    try:
        patterns = [re.compile(pattern) for pattern in selection["patterns"]]
    except re.error as error:
        raise ValueError("invalid seed regex") from error
    resolved, qualifying = set(), {}
    for item in inventory:
        match = any(
            pattern.search(f"{item['vendor']} {item['modelNumber']}") for pattern in patterns
        )
        equal(item["seedMatch"], match, "seed positive match")
        check(
            not match or item["mediaClass"] == "hdd",
            "positive seed must retain known HDD classification",
        )
        first = item["firstQualifyingQuarter"]
        check(
            (first is not None) == (item["maxQuarterCount"] >= 2000),
            "inventory qualification threshold",
        )
        if first is not None:
            check(
                coverage["historyStart"] <= first <= snap["asOfQuarter"]
                and by_q[first]["status"] == "complete",
                "inventory qualifying coverage",
            )
        if item["mediaClass"] == "hdd":
            if match or first is not None:
                resolved.add(item["modelId"])
            if first is not None:
                qualifying[item["modelId"]] = item
    equal(set(selection["resolvedModelIds"]), resolved, "resolved seed-plus-discovery inventory")
    equal(set(ids), set(qualifying), "all qualifying HDDs must have model blocks")
    check(
        data["display"]["maxRelativeQuarter"]
        >= max([24] + [cutoff - ordinal(m["anchorQuarter"]) + 1 for m in data["models"]]),
        "display horizon before cutoff",
    )
    known_drive_days = {q["quarter"]: 0 for q in qs}
    preanchor_drive_days = 0
    for model in data["models"]:
        item = qualifying[model["modelId"]]
        equal(
            (model["vendor"], model["modelNumber"]),
            (item["vendor"], item["modelNumber"]),
            "inventory canonical identity",
        )
        equal(
            model["admissionReason"],
            "seed" if item["seedMatch"] else "discovered",
            "model admission reason",
        )
        equal(model["anchorQuarter"], item["firstQualifyingQuarter"], "inventory anchor")
        anchor = ordinal(model["anchorQuarter"])
        check(anchor >= ordinal(coverage["historyStart"]) and anchor <= cutoff, "anchor coverage")
        cells = model["cells"]
        check(len(cells) == data["display"]["maxRelativeQuarter"], "display extent")
        cumulative = dict(model["preEligibilityComponents"])
        check(
            cumulative["failures"] <= cumulative["driveDays"],
            "preanchor failure flags exceed exposure",
        )
        check(
            model["historyStart"] >= str(bounds(coverage["historyStart"])[0])
            and model["historyStart"] <= str(bounds(model["anchorQuarter"])[0]),
            "model history bounds",
        )
        check(
            all(q["status"] == "complete" for q in qs if ordinal(q["quarter"]) < anchor),
            "unresolved preanchor history",
        )
        check(cumulative["complete"], "incomplete preanchor components")
        check(
            cumulative["driveDays"]
            <= sum(q["rowCount"] for q in qs if ordinal(q["quarter"]) < anchor),
            "preanchor exposure exceeds source rows",
        )
        preanchor_drive_days += cumulative["driveDays"]
        prior = None
        eligible = []
        for index, cell in enumerate(cells, 1):
            label = f"{model['modelNumber']} {cell['quarter']}"
            equal(cell["relativeQuarter"], index, "relative index " + label)
            equal(ordinal(cell["quarter"]), anchor + index - 1, "calendar offset " + label)
            state = cell["state"]
            obs, metrics = cell["observations"], cell["metrics"]
            if ordinal(cell["quarter"]) > cutoff:
                check(state == "snapshot_end", "snapshot end " + label)
                check(
                    cell["rateUnavailableReason"] == "not_displayed"
                    and cell["retirementInference"] == "not_applicable",
                    "future inference " + label,
                )
                continue
            cq = by_q[cell["quarter"]]
            equal(cell["coverage"], cq["status"], "cell coverage " + label)
            expected_state = {"missing": "source_missing", "incomplete": "source_incomplete"}.get(
                cq["status"]
            )
            if expected_state:
                equal(state, expected_state, "source gap state " + label)
            else:
                check(obs["count"] is not None, "complete population " + label)
                check(
                    obs["new"] is not None and obs["failed"] is not None,
                    "complete observations " + label,
                )
                equal(
                    state,
                    "eligible" if obs["count"] >= 2000 else "below_threshold",
                    "threshold " + label,
                )
            qc = cell["quarterComponents"]
            check(qc is not None, "quarter components " + label)
            known_drive_days[cell["quarter"]] += qc["driveDays"]
            equal(qc["complete"], cq["status"] == "complete", "component coverage " + label)
            if cq["status"] == "missing":
                check(
                    all(v is None for v in obs.values()) and qc["failures"] == qc["driveDays"] == 0,
                    "missing observations " + label,
                )
            elif obs["failed"] is not None:
                equal(qc["failures"], obs["failed"], "failure components " + label)
            check(qc["failures"] <= qc["driveDays"], "failure flags exceed exposure " + label)
            if obs["count"] is not None:
                if obs["count"] > 0:
                    check(
                        newest >= cq["observedStart"],
                        "newest selected observation before known population " + label,
                    )
                selected_days = max(
                    0,
                    (
                        min(date.fromisoformat(cq["observedEnd"]), date.fromisoformat(newest))
                        - date.fromisoformat(cq["observedStart"])
                    ).days
                    + 1,
                )
                exposure_days = min(cq["observedDays"], selected_days)
                check(
                    obs["count"] <= qc["driveDays"] <= obs["count"] * exposure_days,
                    "population exposure bounds " + label,
                )
                identity_counts = (
                    ("new", "retired") if ordinal(cell["quarter"]) < cutoff else ("new",)
                )
                for field in identity_counts:
                    check(
                        obs[field] is None or obs[field] <= obs["count"],
                        "lifecycle count bound " + label,
                    )
            cumulative = dict(
                failures=cumulative["failures"] + qc["failures"],
                driveDays=cumulative["driveDays"] + qc["driveDays"],
                complete=cumulative["complete"] and qc["complete"],
            )
            equal(cell["cumulativeComponents"], cumulative, "cumulative arithmetic " + label)
            if state != "eligible":
                check(
                    cell["deltaBaseline"] is None
                    and cell["rateUnavailableReason"] == "not_displayed",
                    "hidden baseline " + label,
                )
                equal(
                    cell["retirementInference"],
                    "not_applicable",
                    "hidden retirement inference " + label,
                )
                continue
            eligible.append(cell["quarter"])
            for field in ("count", "new", "retired", "failed"):
                equal(metrics[field], obs[field], "observed metric " + label)
            rate_equal(metrics["afr"], rate(cumulative), "cumulative AFR " + label)
            rate_equal(cell["quarterAfr"], rate(qc), "quarter AFR " + label)
            reason = (
                None
                if rate(cumulative) is not None
                else (
                    "incomplete_cumulative_coverage"
                    if not cumulative["complete"]
                    else "zero_exposure"
                )
            )
            equal(cell["rateUnavailableReason"], reason, "rate reason " + label)
            baseline = (
                dict(kind="initial_zero", priorQuarter=None, elapsedQuarters=None, afr=0, count=0)
                if prior is None
                else dict(
                    kind="prior_eligible",
                    priorQuarter=prior["quarter"],
                    elapsedQuarters=ordinal(cell["quarter"]) - ordinal(prior["quarter"]),
                    afr=prior["metrics"]["afr"],
                    count=prior["metrics"]["count"],
                )
            )
            equal(
                {k: v for k, v in cell["deltaBaseline"].items() if k != "afr"},
                {k: v for k, v in baseline.items() if k != "afr"},
                "prior eligible baseline " + label,
            )
            rate_equal(
                cell["deltaBaseline"]["afr"],
                baseline["afr"],
                "prior eligible AFR baseline " + label,
            )
            equal(
                metrics["populationDelta"],
                metrics["count"] - baseline["count"],
                "population delta " + label,
            )
            expected_delta = (
                None
                if metrics["afr"] is None or baseline["afr"] is None
                else metrics["afr"] - baseline["afr"]
            )
            rate_equal(metrics["afrDelta"], expected_delta, "AFR delta " + label)
            inference = (
                "newest_quarter_failed_proxy"
                if ordinal(cell["quarter"]) == cutoff
                else (
                    "last_seen_before_boundary"
                    if all(
                        q["status"] == "complete"
                        for q in qs
                        if ordinal(q["quarter"]) >= ordinal(cell["quarter"])
                    )
                    else "unavailable"
                )
            )
            equal(cell["retirementInference"], inference, "retirement boundary " + label)
            if inference == "newest_quarter_failed_proxy":
                equal(metrics["retired"], metrics["failed"], "newest retirement proxy " + label)
                check(
                    metrics["retired"] <= qc["driveDays"],
                    "newest retirement proxy exceeds exposure " + label,
                )
            elif inference == "last_seen_before_boundary":
                check(
                    metrics["retired"] is not None,
                    "known retirement inference requires count " + label,
                )
            if inference == "unavailable":
                check(metrics["retired"] is None, "unknown retirement " + label)
            prior = cell
        check(eligible and eligible[0] == model["anchorQuarter"], "first qualifying anchor")
        equal(model["finalEligibleQuarter"], eligible[-1], "final eligible quarter")
        equal(model["asOfStatus"], cells[cutoff - anchor]["state"], "asof status")
        equal(
            item["maxQuarterCount"],
            max(c["observations"]["count"] for c in cells if c["coverage"] == "complete"),
            "inventory maximum complete-quarter population",
        )
    for q in qs:
        check(
            known_drive_days[q["quarter"]] <= q["rowCount"],
            "selected exposure exceeds source rows " + q["quarter"],
        )
    for boundary in sorted({ordinal(m["anchorQuarter"]) for m in data["models"]}):
        anchored = [m for m in data["models"] if ordinal(m["anchorQuarter"]) <= boundary]
        known_prefix = sum(m["preEligibilityComponents"]["driveDays"] for m in anchored)
        known_prefix += sum(
            c["quarterComponents"]["driveDays"]
            for m in anchored
            for c in m["cells"]
            if ordinal(c["quarter"]) < boundary and c["quarterComponents"] is not None
        )
        source_prefix = sum(q["rowCount"] for q in qs if ordinal(q["quarter"]) < boundary)
        check(
            known_prefix <= source_prefix,
            "selected preanchor prefix exposure exceeds source rows " + quarter(boundary),
        )
    check(
        preanchor_drive_days + sum(known_drive_days.values()) <= sum(q["rowCount"] for q in qs),
        "total selected exposure exceeds source rows",
    )
    expected_domains = color_domains(data["models"])
    for metric in METRICS:
        equal(
            data["colorScales"]["domains"][metric],
            expected_domains[metric],
            "shared color domain " + metric,
        )
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", type=Path, nargs="+")
    args = parser.parse_args()
    for path in args.paths:
        validate_matrix(load_matrix(path))
        print(f"Valid: {path}")


if __name__ == "__main__":
    main()
