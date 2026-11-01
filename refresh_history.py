"""Repeatable offline quarterly refresh over pinned retained evidence.

The public index is extended under a single-writer lock only after every old and
new byte binding passes validation. Source projection is explicit and private.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from historical_generator import (
    QuarterInput,
    Registry,
    bounds,
    digest,
    file_sha,
    ordinal,
    public_evidence,
    summarize_partitioned_input,
    summary_directory,
)
from history_storage import atomic_write, json_bytes, object_key, publication_lock, timestamp
from production_history import catalog_summary_manifests, generate
from tools.validate_production_v2 import load_json, validate_generation


def _check_public_tree(root: Path, *, expected_paths=None, allow_lock=False) -> None:
    """Inspect metadata without following links or reading unadvertised file bodies."""
    from refresh_sources import check_private_path

    if not root.exists():
        return
    pending = [root]
    found = set()
    while pending:
        directory = pending.pop()
        check_private_path(root, directory)
        for path in directory.iterdir():
            check_private_path(root, path)
            if path.is_dir():
                pending.append(path)
                continue
            if not path.is_file():
                raise ValueError("Public output contains a nonregular object")
            key = path.relative_to(root).as_posix()
            if allow_lock and key == ".publication.lock":
                continue
            if path.suffix != ".json":
                raise ValueError(
                    "Public output contains a non-JSON object; preserve and inspect it"
                )
            found.add(key)
    if expected_paths is not None and found - set(expected_paths):
        raise ValueError("Public output contains unadvertised JSON; preserve and inspect it")


def _validation_worker_count(value):
    if type(value) is not int or value not in {1, 2, 4, 8}:
        raise ValueError("validationWorkers must be one of 1, 2, 4, or 8")
    return value


def load_generation(root, *, validation_workers=1):
    """Read only the indexed graph; reject unsafe links and verify exact bytes."""
    validation_workers = _validation_worker_count(validation_workers)
    root = Path(root).resolve()
    index = load_json(root / "index.json")
    artifacts = {}

    def read(reference):
        key = object_key(reference["path"])
        path = root / key
        if not path.resolve().is_relative_to(root) or path.is_symlink():
            raise ValueError("Public graph link escapes its root")
        raw = path.read_bytes()
        if key in artifacts and artifacts[key] != raw:
            raise ValueError("Conflicting public graph references")
        artifacts[key] = raw
        return json.loads(raw)

    for entry in index["snapshots"]:
        descriptor = read(entry["descriptor"])
        read(descriptor["matrix"])
        for row in descriptor["quarters"]:
            if row["payload"] is not None:
                read(row["payload"])
    validate_generation(index, artifacts, workers=validation_workers)
    return index, artifacts


def _context(index, artifacts):
    entry = next(
        row for row in index["snapshots"] if row["snapshotId"] == index["latestSnapshotId"]
    )
    return json.loads(artifacts[entry["descriptor"]["path"]])["context"]


def _configuration(config):
    validation_workers = _validation_worker_count(config.get("validationWorkers", 1))
    for name in (
        "baselineDirectory",
        "outputDirectory",
        "receiptPath",
        "historyStart",
        "registry",
        "patterns",
        "generatorRevision",
        "generatedAt",
        "selection",
    ):
        if name not in config:
            raise ValueError("Missing required refresh configuration field: " + name)
    ordinal(config["historyStart"])
    timestamp(config["generatedAt"])
    if not config["generatorRevision"].strip():
        raise ValueError("Explicit generator revision required")
    if config.get("matrixCalculationVersion", "2.0.0") not in {"2.0.0", "2.1.0"}:
        raise ValueError("Unsupported matrix calculation version")
    if (
        "analysisModelIds" not in config["selection"]
        and config["selection"].get("version") != "2.1.0"
    ):
        raise ValueError("Refresh requires an explicit analysis cohort decision")
    if config["selection"].get("version") not in {"2.0.0", "2.1.0"} or config["selection"].get(
        "classificationVersion", "1.0.0"
    ) not in {"1.0.0", "2.0.0"}:
        raise ValueError("Refresh requires supported selection and classification semantics")
    for field in ("decisionVersion", "reason"):
        value = config["selection"].get("update", {}).get(field)
        if value is not None:
            if not isinstance(value, str):
                raise ValueError("Selection decision metadata must be public text")
            public_evidence(value)
    baseline = Path(config["baselineDirectory"]).resolve()
    output = Path(config["outputDirectory"]).resolve()
    for name in ("receiptPath", "cacheRoot", "workRoot"):
        if name not in config:
            continue
        private = Path(config[name]).resolve()
        if any(
            private.is_relative_to(root) or root.is_relative_to(private)
            for root in (baseline, output)
        ):
            raise ValueError("Private retention and receipts must be separate from public output")
    receipt = Path(config["receiptPath"]).resolve()
    retained_roots = [Path(raw).resolve().parent for raw in config.get("summaryManifests", [])]
    if config.get("catalog"):
        retained_roots.append(Path(config["catalog"]["localRoot"]).resolve())
        if receipt == Path(config["catalog"]["path"]).resolve():
            raise ValueError("Receipt must not replace retained evidence")
    retained_roots.extend(Path(row["directory"]).resolve() for row in config.get("inputs", []))
    if any(
        root.is_relative_to(public) or public.is_relative_to(root)
        for root in retained_roots
        for public in (baseline, output)
    ) or any(
        Path(row["path"]).resolve().is_relative_to(public)
        for row in config.get("sources", [])
        for public in (baseline, output)
    ):
        raise ValueError("Private source evidence must be separate from public output")
    if any(receipt.is_relative_to(root) for root in retained_roots) or any(
        receipt == Path(row["path"]).resolve() for row in config.get("sources", [])
    ):
        raise ValueError("Receipt must not replace retained evidence")
    if config.get("sources") and config.get("inputs"):
        raise ValueError("Choose local ZIPs or explicit projected inputs")
    if config.get("catalog") and config.get("summaryManifests"):
        raise ValueError("Choose a pinned catalog or explicit summary manifests")
    if (config.get("sources") or config.get("inputs")) and not config.get("cacheRoot"):
        raise ValueError("Explicit private cacheRoot required for cold source summarization")
    if config.get("sources") and not config.get("workRoot"):
        raise ValueError("Local sources require an explicit private workRoot")
    index, artifacts = load_generation(baseline, validation_workers=validation_workers)
    if ordinal(config["historyStart"]) > ordinal(
        _context(index, artifacts)["sourceDomain"]["historyStartQuarter"]
    ):
        raise ValueError("Refresh cannot truncate the baseline's declared source history")
    return index, artifacts


def _inventory(config):
    """Pin source inventory before choosing the default cutoff, without projection."""
    quarters = []
    catalog = config.get("catalog")
    if catalog:
        if file_sha(Path(catalog["path"])) != catalog["sha256"]:
            raise ValueError("Preferred catalog byte checksum mismatch")
        entries = load_json(Path(catalog["path"]))["quarters"]
        quarters.extend(row["quarter"] for row in entries)
    else:
        for raw in config.get("summaryManifests", []):
            path = Path(raw)
            q = path.parent.parent.name
            ordinal(q)
            if ordinal(q) < ordinal(config["historyStart"]) or (
                config.get("asOfQuarter") and ordinal(q) > ordinal(config["asOfQuarter"])
            ):
                continue
            manifest = load_json(path)
            if manifest["coverage"]["quarter"] != q:
                raise ValueError("Retained summary path and coverage quarter differ")
            quarters.append(q)
    for row in config.get("sources", []):
        quarters.append(row["quarter"])
    for row in config.get("inputs", []):
        quarters.append(row["quarter"])
    if not quarters:
        raise ValueError("No explicitly supplied source inventory")
    for q in quarters:
        ordinal(q)
    as_of = config.get("asOfQuarter", max(quarters, key=ordinal))
    if ordinal(as_of) < ordinal(config["historyStart"]):
        raise ValueError("Cutoff precedes declared history")
    if as_of not in quarters:
        raise ValueError("Cutoff has no supplied published source evidence")
    manifests = config.get("summaryManifests", [])
    if catalog:
        manifests = catalog_summary_manifests(
            catalog["localRoot"],
            catalog["path"],
            catalog["sha256"],
            history_start=config["historyStart"],
            as_of=as_of,
        )
    selected = []
    seen = set()
    for raw in manifests:
        path = Path(raw)
        q = path.parent.parent.name
        if ordinal(config["historyStart"]) <= ordinal(q) <= ordinal(as_of):
            if q in seen:
                raise ValueError("Duplicate retained source quarter")
            seen.add(q)
            selected.append(path)
    for row in config.get("sources", []) + config.get("inputs", []):
        q = row["quarter"]
        if not ordinal(config["historyStart"]) <= ordinal(q) <= ordinal(as_of):
            continue
        if q in seen:
            raise ValueError("Conflicting source modes for a quarter")
        seen.add(q)
        if "path" in row:
            path = Path(row["path"])
            if path.stat().st_size != row["sizeBytes"] or file_sha(path) != row["sha256"]:
                raise ValueError("Local ZIP does not match pinned source inventory")
    return as_of, selected


def _candidate(config, as_of, manifests, baseline_index, baseline_artifacts):
    baseline_context = _context(baseline_index, baseline_artifacts)
    baseline_version = baseline_context["versions"]["rate"]
    desired_version = config.get("matrixCalculationVersion", baseline_version)
    args = dict(
        summary_manifests=manifests,
        as_of=as_of,
        history_start=config["historyStart"],
        registry=config["registry"],
        patterns=config["patterns"],
        generator_revision=config["generatorRevision"],
        selection=config["selection"],
        kind=config.get("kind", "backblaze"),
        generated_at=config["generatedAt"],
        first_published_date=config.get("firstPublishedDate", "2013-04-10"),
        matrix_calculation_version=desired_version,
    )
    # Reproduce an unchanged baseline with its established timestamp/revision.
    # A changed input still uses the explicitly supplied new generation metadata.
    if (
        as_of == baseline_context["asOfQuarter"]
        and config["generatorRevision"] == baseline_context["generatorRevision"]
        and desired_version == baseline_version
    ):
        old_args = dict(
            args,
            generated_at=baseline_context["generatedAt"],
            generator_revision=baseline_context["generatorRevision"],
            matrix_calculation_version=baseline_version,
        )
        old_index, old_artifacts, diagnostics = generate(**old_args)
        if desired_version == baseline_version and all(
            row in baseline_index["snapshots"] for row in old_index["snapshots"]
        ):
            return old_index, old_artifacts, diagnostics
    return generate(**args)


def _policy(config, baseline_context, context, diagnostics):
    known_pending = {
        row["modelId"]
        for row in baseline_context["inventory"]
        if row["mediaClass"] == "unclassified" and row["reportingAnchorQuarter"]
    }
    pending = set(diagnostics["pendingClassification"])
    new_pending = sorted(pending - known_pending)
    previous = baseline_context["selection"]
    current = context["selection"]
    excluded = set(current.get("excludedModelIds", []))
    old_excluded = set(previous.get("excludedModelIds", []))
    qualified = {
        row["modelId"]
        for row in context["inventory"]
        if row["mediaClass"] == "hdd"
        and row["reportingAnchorQuarter"]
        and (
            "minimumCapacityTB" not in current
            or (row["capacityTB"] is not None and row["capacityTB"] >= current["minimumCapacityTB"])
        )
    }
    old_qualified = {
        row["modelId"]
        for row in baseline_context["inventory"]
        if row["mediaClass"] == "hdd"
        and row["reportingAnchorQuarter"]
        and (
            "minimumCapacityTB" not in previous
            or (
                row["capacityTB"] is not None and row["capacityTB"] >= previous["minimumCapacityTB"]
            )
        )
    }
    new_hdds = sorted((qualified - excluded) - (old_qualified - old_excluded))
    added = sorted(set(current["analysisModelIds"]) - set(previous["analysisModelIds"]))
    removed = sorted(set(previous["analysisModelIds"]) - set(current["analysisModelIds"]))
    changed = (
        previous.get("minimumCapacityTB") != current.get("minimumCapacityTB")
        or previous.get("excludedModelIds", []) != current.get("excludedModelIds", [])
        or any(
            previous[key] != current[key]
            for key in (
                "analysisModelIds",
                "purchaseDefaultModelIds",
                "historicalReferenceModelIds",
            )
        )
    )
    gates = []
    if new_pending:
        gates.append("new_qualifying_unclassified_models")
    if new_hdds and not set(new_hdds) <= set(current["analysisModelIds"]):
        gates.append("new_qualifying_hdds_require_explicit_admission")
    if changed or new_hdds:
        selection = config["selection"]
        update = selection.get("update", {})
        valid = (
            isinstance(update.get("decisionVersion"), str)
            and bool(update["decisionVersion"].strip())
            and update.get("previousSelectionSha256") == digest(previous)
            and update.get("admittedModelIds") == added
            and update.get("removedModelIds") == removed
            and bool(update.get("reason"))
        )
        if valid:
            public_evidence(update["reason"])
            public_evidence(update["decisionVersion"])
        else:
            gates.append("versioned_selection_update_required")
    return dict(
        pendingClassification=sorted(pending),
        newPendingClassification=new_pending,
        newQualifyingHdds=new_hdds,
        admittedModelIds=added,
        removedModelIds=removed,
        publicationGates=gates,
        baselineSelectionSha256=digest(previous),
        selectionSha256=digest(current),
        selectionDecisionVersion=config["selection"].get("update", {}).get("decisionVersion"),
    )


def _report(config, as_of, index, artifacts, diagnostics, baseline_index, baseline_artifacts):
    context = _context(index, artifacts)
    return dict(
        schemaVersion=1,
        workflow="offline-quarterly-refresh",
        asOfQuarter=as_of,
        snapshotId=index["latestSnapshotId"],
        sourceManifestSha256=context["sourceManifestSha256"],
        configurationSha256=digest(config),
        generatedAt=context["generatedAt"],
        generatorRevision=context["generatorRevision"],
        matrixCalculationVersion=context["versions"]["rate"],
        reusedQuarters=diagnostics["reusedQuarters"],
        computedQuarters=diagnostics["computedQuarters"],
        **_policy(config, _context(baseline_index, baseline_artifacts), context, diagnostics),
    )


def _check_resume(config):
    receipt_path = Path(config["receiptPath"])
    if receipt_path.exists():
        previous = load_json(receipt_path)
        if previous.get("status") in {"prepared", "preparing_sources"} and previous.get(
            "configurationSha256"
        ) != digest(config):
            raise ValueError(
                "Interrupted refresh requires its original configuration or explicit private recovery"
            )


def plan_refresh(config) -> dict:
    """Verify retained evidence and report publication gates without any writes."""
    baseline_index, baseline_artifacts = _configuration(config)
    as_of, manifests = _inventory(config)
    _check_resume(config)
    projected = [
        row["quarter"]
        for row in config.get("sources", []) + config.get("inputs", [])
        if ordinal(config["historyStart"]) <= ordinal(row["quarter"]) <= ordinal(as_of)
    ]
    if projected:
        # Discovery from new daily observations requires the explicit run step.
        return dict(
            schemaVersion=1,
            workflow="offline-quarterly-refresh",
            asOfQuarter=as_of,
            configurationSha256=digest(config),
            projectionRequired=projected,
            publicationGates=["source_projection_and_discovery_required"],
        )
    index, artifacts, diagnostics = _candidate(
        config, as_of, manifests, baseline_index, baseline_artifacts
    )
    return _report(config, as_of, index, artifacts, diagnostics, baseline_index, baseline_artifacts)


def _extend(root, baseline_index, baseline_artifacts, index, artifacts, *, validation_workers=1):
    validation_workers = _validation_worker_count(validation_workers)
    root = Path(root).resolve()
    with publication_lock(root):
        _check_public_tree(root, allow_lock=True)
        index_path = root / "index.json"
        current_index_raw = None
        if index_path.exists():
            current_index_raw = index_path.read_bytes()
            current, existing = load_generation(root, validation_workers=validation_workers)
            if index_path.read_bytes() != current_index_raw:
                raise ValueError("Output index changed during publication validation")
        else:
            current, existing = baseline_index, dict(baseline_artifacts)
        for entry in baseline_index["snapshots"]:
            if entry not in current["snapshots"]:
                raise ValueError("Output index dropped or altered a baseline snapshot")
        combined = dict(existing)
        for path, raw in {**baseline_artifacts, **artifacts}.items():
            if path in combined and combined[path] != raw:
                raise ValueError("Immutable generation content conflict")
            combined[path] = raw
        snapshots = {row["snapshotId"]: row for row in current["snapshots"]}
        for row in index["snapshots"]:
            sid = row["snapshotId"]
            if sid in snapshots and snapshots[sid] != row:
                raise ValueError("Immutable snapshot identity conflict")
            snapshots[sid] = row
        entries = sorted(
            snapshots.values(),
            key=lambda row: (
                ordinal(row["asOfQuarter"]),
                timestamp(
                    json.loads(combined[row["descriptor"]["path"]])["context"]["generatedAt"]
                ),
                row["snapshotId"],
            ),
        )
        merged = dict(current, snapshots=entries, latestSnapshotId=entries[-1]["snapshotId"])
        # Retain the original ordering/latest pointer when no new entry is added.
        if all(row in current["snapshots"] for row in index["snapshots"]):
            merged = current
        validate_generation(merged, combined, workers=validation_workers)
        _check_public_tree(root, expected_paths={"index.json", *combined}, allow_lock=True)
        writes = 0
        for key, raw in combined.items():
            target = root / object_key(key)
            if not target.resolve().is_relative_to(root) or target.is_symlink():
                raise ValueError("Unsafe immutable publication path")
            if target.exists():
                if target.read_bytes() != raw:
                    raise ValueError("Immutable publication bytes changed")
                continue
            atomic_write(target, raw, immutable=True)
            if target.read_bytes() != raw:
                raise ValueError("Immutable publication readback mismatch")
            writes += 1
        index_raw = json_bytes(merged)
        if not index_path.exists() or (merged != current and index_path.read_bytes() != index_raw):
            atomic_write(index_path, index_raw)
            writes += 1
        elif merged == current:
            # A verified no-op preserves the existing index's exact formatting.
            index_raw = current_index_raw
        # The complete merged graph was normatively validated before publication.
        # Bind readback to those exact validated bytes rather than redoing semantic
        # calculations on a potentially different graph read from disk.
        _check_public_tree(root, expected_paths={"index.json", *combined}, allow_lock=True)
        if index_path.read_bytes() != index_raw:
            raise ValueError("Publication index readback mismatch")
        for key, raw in combined.items():
            target = root / object_key(key)
            if not target.resolve().is_relative_to(root) or target.is_symlink():
                raise ValueError("Unsafe immutable publication path")
            if target.read_bytes() != raw:
                raise ValueError("Immutable publication readback mismatch")
        return writes


def _check_cache_tree(cache_root: Path, quarters: list[str]) -> None:
    """Check each existing component before descending into a cold cache tree."""
    from refresh_sources import check_private_path

    for q in quarters:
        quarter_root = cache_root / "quarters" / q
        check_private_path(cache_root, quarter_root)
        pending = [quarter_root] if quarter_root.exists() else []
        while pending:
            directory = pending.pop()
            check_private_path(cache_root, directory)
            for child in directory.iterdir():
                check_private_path(cache_root, child)
                if child.is_dir():
                    pending.append(child)


def run_refresh(config):
    """Resume immutable publication; write a sanitized private receipt at each gate."""
    baseline_index, baseline_artifacts = _configuration(config)
    as_of, manifests = _inventory(config)
    _check_resume(config)
    if config.get("sources") or config.get("inputs"):
        atomic_write(
            Path(config["receiptPath"]),
            json_bytes(
                dict(
                    schemaVersion=1,
                    workflow="offline-quarterly-refresh",
                    status="preparing_sources",
                    asOfQuarter=as_of,
                    configurationSha256=digest(config),
                )
            ),
        )
    inputs = [
        QuarterInput(
            row["quarter"],
            Path(row["directory"]),
            Path(row["receipt"]) if row.get("receipt") else None,
        )
        for row in config.get("inputs", [])
        if ordinal(config["historyStart"]) <= ordinal(row["quarter"]) <= ordinal(as_of)
    ]
    if config.get("sources"):
        from refresh_sources import prepare_local_sources

        bounded_config = dict(
            config,
            sources=[
                row
                for row in config["sources"]
                if ordinal(config["historyStart"]) <= ordinal(row["quarter"]) <= ordinal(as_of)
            ],
        )
        inputs.extend(prepare_local_sources(bounded_config, as_of))
    computed = []
    if inputs:
        if not config.get("cacheRoot"):
            raise ValueError("Explicit private cacheRoot required for cold source summarization")
        registry = dict(
            config["registry"],
            models=[
                dict(row, mediaClass="non_hdd" if row["mediaClass"] == "ssd" else row["mediaClass"])
                for row in config["registry"]["models"]
            ],
        )
        reg = Registry(registry, config["patterns"])
        cache_root = Path(config["cacheRoot"]).resolve()
        cache_quarters = [item.quarter for item in inputs]
        _check_cache_tree(cache_root, cache_quarters)
        with publication_lock(cache_root):
            _check_cache_tree(cache_root, cache_quarters)
            for item in inputs:
                manifest, _, _, hit = summarize_partitioned_input(
                    item, cache_root, reg, bounds(as_of)[1]
                )
                if not hit:
                    computed.append(item.quarter)
                manifests.append(
                    cache_root
                    / "quarters"
                    / item.quarter
                    / summary_directory(manifest["inputSha256"], manifest.get("parquetProfile"))
                    / "manifest.json"
                )
    index, artifacts, diagnostics = _candidate(
        config, as_of, manifests, baseline_index, baseline_artifacts
    )
    if inputs:
        diagnostics["computedQuarters"] = computed
        diagnostics["reusedQuarters"] = [
            q for q in diagnostics["reusedQuarters"] if q not in computed
        ]
    report = _report(
        config, as_of, index, artifacts, diagnostics, baseline_index, baseline_artifacts
    )
    receipt_path = Path(config["receiptPath"])
    atomic_write(
        receipt_path,
        json_bytes(dict(report, status="gated" if report["publicationGates"] else "prepared")),
    )
    if report["publicationGates"]:
        raise ValueError("Refresh publication is gated; inspect the sanitized receipt")
    writes = _extend(
        config["outputDirectory"],
        baseline_index,
        baseline_artifacts,
        index,
        artifacts,
        validation_workers=config.get("validationWorkers", 1),
    )
    report.update(status="published" if writes else "unchanged", publicWrites=writes)
    atomic_write(receipt_path, json_bytes(report))
    return report


def verify_refresh(config):
    """Verify exact output bytes and the successful private receipt, without writes."""
    baseline_index, _ = _configuration(config)
    root = Path(config["outputDirectory"]).resolve()
    _check_public_tree(root)
    validation_workers = _validation_worker_count(config.get("validationWorkers", 1))
    index, artifacts = load_generation(
        config["outputDirectory"], validation_workers=validation_workers
    )
    _check_public_tree(root, expected_paths={"index.json", *artifacts})
    receipt = load_json(Path(config["receiptPath"]))
    if receipt.get("status") not in {"published", "unchanged"} or receipt.get(
        "configurationSha256"
    ) != digest(config):
        raise ValueError("No matching successful refresh receipt")
    if not all(row in index["snapshots"] for row in baseline_index["snapshots"]):
        raise ValueError("Output dropped a baseline snapshot")
    entry = next(
        (row for row in index["snapshots"] if row["snapshotId"] == receipt["snapshotId"]), None
    )
    if entry is None or entry["sourceManifestSha256"] != receipt["sourceManifestSha256"]:
        raise ValueError("Receipt snapshot is absent or differs")
    validate_generation(index, artifacts, workers=validation_workers)
    return dict(receipt, status="verified")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("plan", "run", "verify"))
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    operation = {"plan": plan_refresh, "run": run_refresh, "verify": verify_refresh}[args.operation]
    try:
        result = operation(load_json(args.config))
    except Exception:
        # Native parser/filesystem errors often retain rejected paths or values.
        # Keep details in private inputs; CLI output has a fixed, safe failure.
        print(
            "Refresh failed; inspect private configuration, evidence and receipt state",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
