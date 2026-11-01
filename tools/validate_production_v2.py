"""Offline internal-consistency checks for the proposed v2 aggregate contract.

This proves bindings and arithmetic, not upstream identities/classification truth.
No source downloads or implicit filesystem resolution occur in validate_generation.
"""

import argparse
import calendar
import hashlib
import ipaddress
import json
import math
import re
from collections.abc import Mapping
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "contracts/production-v2.schema.json"


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        _require(key not in result, f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _constant(value):
    raise ValueError(f"nonfinite JSON number: {value}")


def _decode(raw):
    return json.loads(raw, object_pairs_hook=_pairs, parse_constant=_constant)


def load_json(path):
    """Read only the explicit caller-selected JSON file, rejecting duplicate keys."""
    return _decode(Path(path).read_bytes())


def _hash(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def _ordinal(quarter):
    return int(quarter[:4]) * 4 + int(quarter[-1]) - 1


def _quarter(number):
    return f"{number // 4:04d}-Q{number % 4 + 1}"


def _dates(quarter):
    year, month = int(quarter[:4]), (int(quarter[-1]) - 1) * 3 + 1
    end_month = month + 2
    return date(year, month, 1), date(year, end_month, calendar.monthrange(year, end_month)[1])


def _same(actual, expected, label, *, exact=False):
    if actual is None or expected is None:
        _require(actual is expected, label)
    elif exact:
        _require(actual == expected, label)
    else:
        _require(math.isclose(actual, expected, rel_tol=1e-11, abs_tol=1e-11), label)


def _rate(failures, days):
    return failures * 36500 / days if days else None


def _sum(values):
    return None if any(value is None for value in values) else sum(values)


def _path(reference):
    path = reference["path"]
    parts = path.split("/")
    _require(
        path.endswith(".json")
        and not any(part in {"", ".", ".."} for part in parts)
        and not re.search(r"[\\:%?#\x00-\x20]", path)
        and reference["sha256"] in parts[-1],
        "unsafe or non-content-hashed artifact path",
    )
    return path


def _walk(value):
    if isinstance(value, dict):
        if {"path", "sha256", "sizeBytes"} <= value.keys():
            _path(value)
        for key, item in value.items():
            if key == "url":
                url = urlsplit(item)
                _require(
                    url.scheme == "https"
                    and url.hostname
                    and not url.username
                    and not url.password,
                    "evidence/provenance URL must be public HTTPS without credentials",
                )
                host = url.hostname.lower().rstrip(".")
                try:
                    address = ipaddress.ip_address(host)
                except ValueError:
                    address = None
                labels = host.split(".")
                public_dns = (
                    len(labels) >= 2
                    and len(host) <= 253
                    and all(
                        re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                        for label in labels
                    )
                    and labels[-1][0].isalpha()
                    and not host.endswith(
                        (
                            ".localhost",
                            ".local",
                            ".internal",
                            ".localdomain",
                            ".lan",
                            ".home",
                            ".corp",
                            ".home.arpa",
                            ".onion",
                            ".invalid",
                            ".test",
                        )
                    )
                )
                _require(
                    address.is_global if address is not None else public_dns,
                    "private evidence URL",
                )
            _walk(item)
    elif isinstance(value, list):
        for item in value:
            _walk(item)
    elif isinstance(value, float):
        _require(math.isfinite(value), "nonfinite number")


def validate_artifact(value):
    """Validate a standalone artifact; cross-artifact claims require the graph API."""
    Draft202012Validator(load_json(SCHEMA), format_checker=FormatChecker()).validate(value)
    _walk(value)
    kind = value["artifactType"]
    if kind == "snapshot_descriptor":
        _require(value["contextSha256"] == _hash(value["context"]), "context hash mismatch")
        _context(value["context"])
        coverage = value["context"]["coverage"]
        _require(
            [(row["quarter"], row["status"]) for row in value["quarters"]]
            == [(row["quarter"], row["status"]) for row in coverage],
            "descriptor quarter ledger differs from coverage",
        )
        for row in value["quarters"]:
            _require(
                (row["payload"] is not None) == (row["status"] in {"complete", "partial"}),
                "payload availability differs from coverage",
            )
    elif kind == "generation_index":
        ids = [entry["snapshotId"] for entry in value["snapshots"]]
        _require(len(ids) == len(set(ids)), "duplicate snapshot IDs")
        _require(value["latestSnapshotId"] in ids, "latest snapshot is not advertised")


def _context(context):
    versions = context["versions"]
    _require(
        versions["normalization"] in {"1.0.0", "2.0.0"}
        and versions["classification"] in {"1.0.0", "2.0.0"}
        and versions["rate"] in {"2.0.0", "2.1.0"}
        and all(versions[key] == "2.0.0" for key in ("selection", "cohort", "capacity")),
        "unsupported semantic version",
    )
    coverage = context["coverage"]
    domain = context["sourceDomain"]
    start, end = _ordinal(domain["historyStartQuarter"]), _ordinal(context["asOfQuarter"])
    _require(start <= end, "reversed history domain")
    quarters = [_quarter(number) for number in range(start, end + 1)]
    _require(
        [row["quarter"] for row in coverage] == quarters, "coverage must be full ordered ledger"
    )
    first_published = date.fromisoformat(domain["firstPublishedDate"])
    through = date.fromisoformat(domain["throughDate"])
    cutoff = date.fromisoformat(context["cutoffDate"])
    _require(
        first_published <= through <= cutoff <= _dates(context["asOfQuarter"])[1],
        "source dates exceed cutoff",
    )
    _require(cutoff >= _dates(context["asOfQuarter"])[0], "cutoff outside as-of quarter")
    for row in coverage:
        first, last = _dates(row["quarter"])
        days = (last - first).days + 1
        _require(row["expectedDays"] == days, "incorrect calendar day count")
        observed = row["observedDays"]
        _require(observed <= days, "observed days exceed calendar")
        status = row["status"]
        _require((status == "complete") == (observed == days), "false complete coverage")
        _require(row["evidence"], "coverage requires evidence")
        if status in {"missing", "unpublished"}:
            _require(
                observed == 0 and row["knownObservationRows"] is None,
                "missing source is not zero population",
            )
            _require(
                row["firstObservedDate"] is None and row["lastObservedDate"] is None,
                "absent source has dates",
            )
        else:
            _require(
                observed > 0 and row["knownObservationRows"] is not None,
                "available coverage lacks observations",
            )
            lo, hi = (
                date.fromisoformat(row["firstObservedDate"]),
                date.fromisoformat(row["lastObservedDate"]),
            )
            _require(
                first <= lo <= hi <= min(last, through, cutoff),
                "observed dates outside source domain",
            )
            _require(
                lo >= first_published and observed <= (hi - lo).days + 1, "observed date budget"
            )
        _require(
            (status == "unpublished") == (last < first_published),
            "unpublished status must match pre-publication domain",
        )
        if _ordinal(row["quarter"]) < _ordinal("2023-Q3"):
            _require(not row["datacenterFieldAvailable"], "pre-2023Q3 datacenter field unavailable")
    models = context["inventory"]
    ids = [model["modelId"] for model in models]
    _require(len(set(ids)) == len(ids), "duplicate inventory model")
    canonical = [(model["vendor"], model["modelNumber"]) for model in models]
    _require(len(set(canonical)) == len(canonical), "duplicate canonical model")
    aliases = [(model["vendor"], alias) for model in models for alias in model["rawAliases"]]
    _require(len(aliases) == len(set(aliases)), "ambiguous alias")
    selection = context["selection"]
    seed = set(selection["positiveSeed"]["modelIds"])
    _require(seed <= set(ids), "seed missing inventory")
    expected_context = set()
    qualified = set()
    for model in models:
        label = model["modelId"]
        _require(model["seedMatch"] == (label in seed), "seed match differs from positive seed")
        if model["mediaClass"] != "unclassified":
            _require(model["classificationEvidence"], "classified model lacks evidence")
        history = model["history"]
        _require([row["quarter"] for row in history] == quarters, "model ledger not aligned")
        observed_first = proven_first = complete_first = None
        for row, source in zip(history, coverage, strict=True):
            available = source["status"] in {"complete", "partial"}
            complete = source["status"] == "complete"
            count, lower = row["quarterCount"], row["knownIdentityLowerBound"]
            failures, days = row["knownFailures"], row["knownDriveDays"]
            _require(failures <= days, "failure/exposure budget")
            if versions["rate"] == "2.1.0":
                _require(failures <= (lower or 0), "distinct failure/identity budget")
            _require((count is not None) == complete, "Count only exact on complete coverage")
            _require((lower is not None) == available, "identity lower bound requires source")
            proof = None
            if available:
                _require(row["evidence"], "model observations need evidence")
                _require(
                    lower <= days <= lower * source["observedDays"], "identity/exposure budget"
                )
                _require(
                    days <= source["knownObservationRows"], "model exposure exceeds source rows"
                )
                if complete:
                    _require(
                        count == lower, "complete Count differs from exact observed identities"
                    )
                if lower > 0 and observed_first is None:
                    observed_first = row["quarter"]
                if lower >= 2000:
                    proof = "complete_exact_count" if complete else "partial_identity_lower_bound"
                    if proven_first is None:
                        proven_first = row["quarter"]
                    if complete and complete_first is None:
                        complete_first = row["quarter"]
            else:
                _require(days == failures == 0, "missing bookkeeping must be zero known components")
            _require(row["thresholdProof"] == proof, "threshold proof mismatch")
        _require(
            model["firstObservedInDeclaredHistory"] == observed_first, "first observation mismatch"
        )
        _require(
            model["firstProvenThresholdInDeclaredHistory"] == proven_first,
            "first proven threshold mismatch",
        )
        _require(
            model["firstCompleteQualifyingInDeclaredHistory"] == complete_first,
            "first complete qualifier mismatch",
        )
        _require(
            model["reportingAnchorQuarter"] == proven_first,
            "reporting anchor must use earliest proof",
        )
        earlier = [
            row
            for row in coverage
            if proven_first is None or _ordinal(row["quarter"]) < _ordinal(proven_first)
        ]
        uncertain = any(row["status"] != "complete" for row in earlier)
        _require(
            model["earlierQualificationNotExcluded"] == uncertain,
            "earlier qualification uncertainty mismatch",
        )
        _require(
            model["anchorSearchComplete"] == (not uncertain), "anchor search completeness mismatch"
        )
        _require(
            model["recordedHistoryComplete"]
            == all(row["status"] == "complete" for row in coverage),
            "recorded completeness mismatch",
        )
        if model["mediaClass"] == "hdd":
            if proven_first:
                qualified.add(label)
            if model["seedMatch"] or proven_first:
                expected_context.add(label)
    for row_index, source in enumerate(coverage):
        if source["knownObservationRows"] is not None:
            _require(
                sum(model["history"][row_index]["knownDriveDays"] for model in models)
                == source["knownObservationRows"],
                "inventory/source row budget must reconcile exactly",
            )
    context_ids = set(selection["contextModelIds"])
    analysis = set(selection["analysisModelIds"])
    _require(
        context_ids == expected_context,
        "context must retain all seed HDD and qualifying HDD models",
    )
    _require(analysis <= context_ids & qualified, "analysis lacks HDD threshold proof")
    purchase, historical = (
        set(selection["purchaseDefaultModelIds"]),
        set(selection["historicalReferenceModelIds"]),
    )
    _require(
        purchase <= analysis and historical <= analysis and not purchase & historical,
        "default subsets overlap or exceed analysis",
    )


def _matrix(matrix, context):
    unique_failures = context["versions"]["rate"] == "2.1.0"
    _require(
        matrix["rateBasis"]
        == (
            "observed-quarter-distinct-failed-identities-recorded-exposure-v2.1"
            if unique_failures
            else "observed-recorded-exposure-v2"
        )
        and matrix["rateLabel"]
        == (
            "Observed-history AFR (quarterly unique failures)"
            if unique_failures
            else "Observed-history AFR"
        ),
        "rate basis/label differs from calculation version",
    )
    models = {model["modelId"]: model for model in context["inventory"]}
    blocks = matrix["models"]
    _require(len(blocks) == len({block["modelId"] for block in blocks}), "duplicate matrix block")
    _require(
        {block["modelId"] for block in blocks} == set(context["selection"]["analysisModelIds"]),
        "matrix analysis mismatch",
    )
    end = _ordinal(context["asOfQuarter"])
    longest = max(
        (
            end - _ordinal(models[block["modelId"]]["reportingAnchorQuarter"]) + 1
            for block in blocks
        ),
        default=0,
    )
    length = matrix["relativeQuarterCount"]
    _require(length == max(24, longest), "matrix shared padding length mismatch")
    for block in blocks:
        model = models[block["modelId"]]
        anchor = model["reportingAnchorQuarter"]
        _require(block["reportingAnchorQuarter"] == anchor, "matrix anchor mismatch")
        _require(
            block["sourceHistoryComplete"] == model["recordedHistoryComplete"],
            "block source completeness mismatch",
        )
        _require(len(block["cells"]) == length, "matrix cells omit shared padding")
        history = {row["quarter"]: row for row in model["history"]}
        coverage = {row["quarter"]: row for row in context["coverage"]}
        prior = None
        for index, cell in enumerate(block["cells"]):
            quarter = _quarter(_ordinal(anchor) + index)
            _require(
                cell["quarter"] == quarter and cell["relativeQuarter"] == index + 1,
                "matrix relative calendar position",
            )
            if _ordinal(quarter) > end:
                _require(cell["status"] == "snapshot_end", "future padding status")
                _require(
                    all(value is None for value in cell["metrics"].values()),
                    "future padding has metrics",
                )
                _require(
                    all(
                        cell[key] is None
                        for key in (
                            "quarterAfr",
                            "completeHistoryAfr",
                            "cumulativeKnownFailures",
                            "cumulativeKnownDriveDays",
                            "baselineQuarter",
                            "baselineQuarterDistance",
                        )
                    ),
                    "future padding has observations",
                )
                _require(not cell["sourceHistoryComplete"], "future padding source completeness")
                continue
            row, source = history[quarter], coverage[quarter]
            prefix = [
                item for item in model["history"] if _ordinal(item["quarter"]) <= _ordinal(quarter)
            ]
            failures = sum(item["knownFailures"] for item in prefix)
            days = sum(item["knownDriveDays"] for item in prefix)
            _require(
                cell["cumulativeKnownFailures"] == failures
                and cell["cumulativeKnownDriveDays"] == days,
                "cumulative components omit pre-anchor or gap observations",
            )
            complete_history = all(
                item["status"] == "complete"
                for item in context["coverage"]
                if _ordinal(item["quarter"]) <= _ordinal(quarter)
            )
            _require(
                cell["sourceHistoryComplete"] == complete_history,
                "cell source completeness mismatch",
            )
            status = source["status"]
            expected = (
                ("eligible" if row["quarterCount"] >= 2000 else "below_threshold")
                if status == "complete"
                else ("source_incomplete" if status == "partial" else status)
            )
            _require(cell["status"] == expected, "matrix eligibility/source status mismatch")
            metrics = cell["metrics"]
            if expected != "eligible":
                _require(
                    all(value is None for value in metrics.values()),
                    "ineligible/partial cell exposes full-quarter metrics",
                )
                _require(
                    cell["quarterAfr"] is None and cell["completeHistoryAfr"] is None,
                    "ineligible cell exposes rate",
                )
                _require(
                    cell["baselineQuarter"] is None
                    and cell["baselineQuarterDistance"] is None
                    and cell["deltaReason"] == "unavailable",
                    "ineligible baseline",
                )
                continue
            observed_rate = _rate(failures, days)
            _same(metrics["observedRecordedAfr"], observed_rate, "observed recorded AFR arithmetic")
            _same(
                cell["quarterAfr"],
                _rate(row["knownFailures"], row["knownDriveDays"]),
                "quarter AFR arithmetic",
            )
            _same(
                cell["completeHistoryAfr"],
                observed_rate if complete_history else None,
                "complete-history AFR unavailable across source gaps",
            )
            _require(
                metrics["count"] == row["quarterCount"]
                and metrics["failed"] == row["knownFailures"],
                "matrix Count/failed differs from ledger",
            )
            if prior is None:
                _require(
                    cell["baselineQuarter"] is None
                    and cell["baselineQuarterDistance"] is None
                    and cell["deltaReason"] == "initialized",
                    "first eligible initialization",
                )
                subtract_zero = context["versions"]["rate"] == "2.1.0"
                _same(
                    metrics["populationDelta"],
                    metrics["count"] if subtract_zero else 0,
                    "initial population delta",
                    exact=True,
                )
                _same(
                    metrics["observedRecordedAfrDelta"],
                    metrics["observedRecordedAfr"] if subtract_zero else 0,
                    "initial rate delta",
                )
            else:
                _require(
                    cell["baselineQuarter"] == prior["quarter"]
                    and cell["baselineQuarterDistance"]
                    == _ordinal(quarter) - _ordinal(prior["quarter"])
                    and cell["deltaReason"] == "prior_eligible",
                    "prior eligible calendar baseline",
                )
                _same(
                    metrics["populationDelta"],
                    metrics["count"] - prior["metrics"]["count"],
                    "population delta arithmetic",
                    exact=True,
                )
                baseline_rate = prior["metrics"]["observedRecordedAfr"]
                _same(
                    metrics["observedRecordedAfrDelta"],
                    observed_rate - baseline_rate
                    if observed_rate is not None and baseline_rate is not None
                    else None,
                    "rate delta arithmetic",
                )
            _require(
                metrics["new"] is None or metrics["new"] <= metrics["count"],
                "new population budget",
            )
            obstructed = any(
                source_row["status"] != "complete"
                for source_quarter, source_row in coverage.items()
                if _ordinal(source_quarter) >= _ordinal(quarter)
            )
            if quarter == context["asOfQuarter"]:
                _require(
                    (cell["retiredReason"] == "right_censored" and metrics["retired"] is None)
                    if unique_failures
                    else (
                        cell["retiredReason"] == "cutoff_failed_proxy"
                        and metrics["retired"] == metrics["failed"]
                    ),
                    "terminal retirement right-censoring"
                    if unique_failures
                    else "cutoff retirement proxy",
                )
            elif obstructed:
                _require(
                    metrics["retired"] is None and cell["retiredReason"] == "gap_obstructed",
                    "gap-obstructed retirement must be null",
                )
            else:
                _require(
                    cell["retiredReason"] == "inferred" and metrics["retired"] is not None,
                    "retirement inference reason",
                )
                _require(
                    metrics["retired"] <= metrics["count"],
                    "retirement population budget",
                )
            prior = cell


def _supporting(payload, context, previous):
    quarter = payload["quarter"]
    source = next(row for row in context["coverage"] if row["quarter"] == quarter)
    _require(payload["status"] == source["status"], "supporting status differs from source")
    inventory = {model["modelId"]: model for model in context["inventory"]}
    complete = source["status"] == "complete"
    selected_rows = {}
    for name, scope in payload["scopes"].items():
        expected_ids = (
            set(inventory)
            if name == "all_supplied"
            else set(context["selection"]["contextModelIds"])
        )
        rows = {row["modelId"]: row for row in scope["models"]}
        _require(
            len(rows) == len(scope["models"]) and set(rows) == expected_ids,
            "supporting scope must include every model, including zero rows",
        )
        selected_rows[name] = rows
        for label, row in rows.items():
            ledger = next(
                item for item in inventory[label]["history"] if item["quarter"] == quarter
            )
            if complete:
                _require(
                    row["count"] == ledger["quarterCount"],
                    "supporting Count differs from model ledger",
                )
                _require(row["new"] <= row["count"], "supporting new population budget")
                if inventory[label]["firstObservedInDeclaredHistory"] == quarter:
                    _require(
                        row["new"] == row["count"], "first observed population must all be new"
                    )
                _same(
                    row["capacityTB"],
                    0
                    if row["count"] == 0
                    else row["count"] * inventory[label]["capacityTB"]
                    if inventory[label]["capacityTB"] is not None
                    else None,
                    "capacity mode multiplication",
                )
            else:
                _require(
                    all(row[key] is None for key in ("count", "new", "capacityTB")),
                    "partial supporting model exposes totals",
                )
        totals = scope["totals"]
        for key in ("count", "new", "capacityTB"):
            _same(
                totals[key],
                _sum([row[key] for row in rows.values()]),
                "scope sum reconciliation",
                exact=key != "capacityTB",
            )
        manufacturers = scope["manufacturers"]
        vendors = {inventory[label]["vendor"] for label in expected_ids}
        _require(
            {row["vendor"] for row in manufacturers} == vendors
            and len(manufacturers) == len(vendors),
            "manufacturer closure",
        )
        for manufacturer in manufacturers:
            vendor_rows = [
                row
                for label, row in rows.items()
                if inventory[label]["vendor"] == manufacturer["vendor"]
            ]
            for key, share in (
                ("count", "populationShare"),
                ("new", "newShare"),
                ("capacityTB", "capacityShare"),
            ):
                _same(
                    manufacturer[key],
                    _sum([row[key] for row in vendor_rows]),
                    "manufacturer sum",
                    exact=key != "capacityTB",
                )
                denominator = totals[key]
                _same(
                    manufacturer[share],
                    manufacturer[key] / denominator
                    if denominator and manufacturer[key] is not None
                    else None,
                    "manufacturer whole-scope denominator",
                )
        prior_scope = previous["scopes"][name] if previous else {}
        if not complete:
            reason, delta = "current_incomplete", None
        elif totals["capacityTB"] is None:
            reason, delta = "invalid_capacity", None
        elif _ordinal(quarter) == _ordinal(context["sourceDomain"]["historyStartQuarter"]):
            reason, delta = "first_quarter", None
        elif (
            previous is None
            or previous["status"] != "complete"
            or prior_scope["totals"]["capacityTB"] is None
        ):
            reason, delta = "previous_unavailable", None
        else:
            reason, delta = (
                "previous_complete",
                totals["capacityTB"] - prior_scope["totals"]["capacityTB"],
            )
        _require(scope["capacityDeltaReason"] == reason, "capacity delta reason")
        _same(scope["capacityDeltaTB"], delta, "adjacent capacity delta")
    for label, row in selected_rows["selected_hdd"].items():
        _require(
            row == selected_rows["all_supplied"][label], "selected/all-source model disagreement"
        )
    locations = payload["datacenters"]
    _require(
        locations["fieldAvailable"] == source["datacenterFieldAvailable"],
        "location field availability mismatch",
    )
    names = [row["name"] for row in locations["locations"]]
    _require(
        "Unknown" in names and len(names) == len(set(names)),
        "Unknown location required and locations unique",
    )
    total = payload["scopes"]["all_supplied"]["totals"]
    for key in ("count", "capacityTB"):
        _same(
            _sum([row[key] for row in locations["locations"]]),
            total[key],
            "datacenter/all-source sum",
            exact=key == "count",
        )
    unknown = next(row for row in locations["locations"] if row["name"] == "Unknown")
    if not complete:
        _require(
            all(
                row["count"] is None and row["capacityTB"] is None for row in locations["locations"]
            ),
            "partial location exposes totals",
        )
        share = None
    else:
        for location in locations["locations"]:
            if location["count"] == 0:
                _require(
                    location["capacityTB"] == 0, "zero-population location capacity must be zero"
                )
            elif location["capacityTB"] is not None:
                _require(
                    location["capacityTB"] > 0,
                    "positive-population location capacity must be positive",
                )
        share = (total["count"] - unknown["count"]) / total["count"] if total["count"] else None
        if not locations["fieldAvailable"]:
            _require(
                unknown["count"] == total["count"] and unknown["capacityTB"] == total["capacityTB"],
                "unreported locations must be Unknown",
            )
    _same(locations["knownLocationPopulationShare"], share, "known-location coverage denominator")


def validate_generation(index: dict, artifacts: Mapping[str, bytes]):
    """Validate exactly the explicit immutable graph; never fetch/read referenced paths."""
    validate_artifact(index)
    _require(index["artifactType"] == "generation_index", "generation requires index")
    used = set()

    def resolve(reference):
        path = _path(reference)
        _require(path in artifacts, "referenced artifact missing")
        raw = artifacts[path]
        _require(isinstance(raw, bytes), "artifact map must contain exact bytes")
        _require(
            len(raw) == reference["sizeBytes"]
            and hashlib.sha256(raw).hexdigest() == reference["sha256"],
            "artifact byte hash/size mismatch",
        )
        used.add(path)
        result = _decode(raw)
        validate_artifact(result)
        return result

    for entry in index["snapshots"]:
        descriptor = resolve(entry["descriptor"])
        _require(
            descriptor["artifactType"] == "snapshot_descriptor",
            "descriptor reference has wrong type",
        )
        context = descriptor["context"]
        _require(
            all(
                entry[key] == context[key]
                for key in ("snapshotId", "asOfQuarter", "sourceManifestSha256")
            ),
            "index descriptor identity mismatch",
        )
        matrix = resolve(descriptor["matrix"])
        _require(matrix["artifactType"] == "matrix", "matrix reference has wrong type")
        payloads = [matrix]
        supporting = {}
        for row in descriptor["quarters"]:
            if row["payload"] is not None:
                payload = resolve(row["payload"])
                _require(
                    payload["artifactType"] == "supporting_quarter"
                    and payload["quarter"] == row["quarter"],
                    "quarter reference/type mismatch",
                )
                supporting[row["quarter"]] = payload
                payloads.append(payload)
        for payload in payloads:
            _require(
                payload["contextSha256"] == descriptor["contextSha256"]
                and payload["snapshotId"] == context["snapshotId"]
                and payload["asOfQuarter"] == context["asOfQuarter"],
                "mixed generation context/identity",
            )
        _matrix(matrix, context)
        for quarter, payload in supporting.items():
            _supporting(payload, context, supporting.get(_quarter(_ordinal(quarter) - 1)))
        for block in matrix["models"]:
            for cell in block["cells"]:
                if cell["status"] == "eligible":
                    row = next(
                        row
                        for row in supporting[cell["quarter"]]["scopes"]["selected_hdd"]["models"]
                        if row["modelId"] == block["modelId"]
                    )
                    _require(
                        cell["metrics"]["new"] == row["new"],
                        "matrix/supporting New differs",
                    )
    _require(used == set(artifacts), "artifact map has unreachable/unadvertised paths")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "directory", type=Path, help="explicit fixture directory containing index.json"
    )
    args = parser.parse_args()
    directory = args.directory.resolve()
    candidates = (
        [directory / "index.json"]
        if (directory / "index.json").exists()
        else list(directory.glob("sample-index.*.json"))
    )
    _require(len(candidates) == 1, "directory requires exactly one generation index")
    index_path = candidates[0]
    index = load_json(index_path)
    artifacts = {
        path.relative_to(directory).as_posix(): path.read_bytes()
        for path in directory.rglob("*.json")
        if path != index_path
    }
    validate_generation(index, artifacts)
    print("v2 generation graph validated")


if __name__ == "__main__":
    main()
