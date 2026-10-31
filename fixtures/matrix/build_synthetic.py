"""Rebuild fictional aggregate examples; no observed Backblaze measurements."""

import hashlib
import json
import sys
from copy import deepcopy
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from matrix_types import Baseline, Cell, Components, Inventory, Metrics, Model, Observations  # noqa: E402 -- standalone repository-root bootstrap.
from tools.validate_matrix_contract import (  # noqa: E402 -- standalone CLI adds repository root.  # noqa: E402 -- standalone repository-root bootstrap.
    METRICS,
    bounds,
    color_domains,
    ordinal,
    quarter,
    rate,
    validate_matrix,
)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def build(later=False, corrected=False, new_manufacturer=False):
    asof = "2025-Q3" if later else "2024-Q4"
    sid = "synthetic-later-v1" if later else "synthetic-earlier-v1"
    if corrected:
        sid = "synthetic-correction-v1"
    if new_manufacturer:
        sid = "synthetic-new-manufacturer-v1"
    quarters = []
    for n in range(ordinal("2023-Q4"), ordinal(asof) + 1):
        q = quarter(n)
        start, end = bounds(q)
        status = {"2025-Q1": "missing", "2025-Q2": "incomplete"}.get(q, "complete")
        observed = (
            (end - start).days + 1 if status == "complete" else (0 if status == "missing" else 10)
        )
        # Q1 also has enough unfiltered rows for the non-displayed inventory
        # candidates; keep the earlier pre-anchor source budget unchanged.
        quarters.append(
            dict(
                quarter=q,
                status=status,
                expectedDays=(end - start).days + 1,
                observedDays=observed,
                observedStart=str(start) if observed else None,
                observedEnd=str(
                    end if status == "complete" else start + timedelta(days=observed - 1)
                )
                if observed
                else None,
                rowCount=observed * (6000 if later else (4100 if q == "2024-Q1" else 4000)),
                sourceIds=["synthetic-input"] if observed else [],
            )
        )
    models: list[Model] = []
    for variant in [0, 1, 3] if new_manufacturer else range(3 if later else 2):
        discovered = variant >= 2
        newest_vendor = variant == 3
        number = (
            "XYZ26TB-01"
            if newest_vendor
            else ("FUTURE-HDD-01" if discovered else f"ST12000NM000{7 + variant}")
        )
        anchor = asof if newest_vendor else ("2024-Q4" if discovered else "2024-Q1")
        model: Model = Model(
            modelId=number,
            modelNumber=number,
            vendor="XYZ" if newest_vendor else ("FutureVendor" if discovered else "Seagate"),
            rawModelAliases=[number],
            admissionReason="discovered" if discovered else "seed",
            anchorQuarter=anchor,
            finalEligibleQuarter=anchor if discovered else asof,
            asOfStatus="below_threshold" if variant == 2 else "eligible",
            historyStart=str(bounds(asof)[0]) if newest_vendor else "2023-10-01",
            preEligibilityComponents=Components(
                failures=0 if newest_vendor else 1 + variant,
                driveDays=0 if newest_vendor else (1000 if discovered else 100000),
                complete=True,
            ),
            cells=[],
        )
        cumulative = deepcopy(model["preEligibilityComponents"])
        prior = None
        for relative in range(1, 25):
            q = quarter(ordinal(anchor) + relative - 1)
            blank: Metrics = {
                "afr": None,
                "afrDelta": None,
                "count": None,
                "populationDelta": None,
                "new": None,
                "retired": None,
                "failed": None,
            }
            obs: Observations = Observations(count=None, new=None, retired=None, failed=None)
            if ordinal(q) > ordinal(asof):
                model["cells"].append(
                    Cell(
                        quarter=q,
                        relativeQuarter=relative,
                        state="snapshot_end",
                        eligibility="not_yet_observed",
                        coverage="outside_snapshot",
                        metrics=blank,
                        observations=obs,
                        quarterComponents=None,
                        cumulativeComponents=None,
                        quarterAfr=None,
                        deltaBaseline=None,
                        retirementInference="not_applicable",
                        rateUnavailableReason="not_displayed",
                    )
                )
                continue
            coverage = next(c for c in quarters if c["quarter"] == q)["status"]
            count = (1999 if relative == 2 else 2000 + 100 * (relative - 1)) + variant * 10
            if relative == 2:
                count = 1999 - variant
            if discovered:
                count = 1999 if q == asof else 2000
            if newest_vendor:
                count = 5000
            failed = (0 if relative == 1 else relative % 3) + variant
            if newest_vendor:
                failed = 0
            # Later evidence revises an earlier last-seen inference. The source
            # gap also makes that inference unavailable in the later snapshot.
            retired = 6 - variant if relative == 1 else 10 + variant
            if corrected and relative == 1:
                retired -= 2
            if q == asof:
                retired = failed
            elif later and ordinal(q) < ordinal("2025-Q3"):
                retired = None
            if coverage == "missing":
                state, eligibility = "source_missing", "unknown"
                qc = Components(failures=0, driveDays=0, complete=False)
            else:
                obs = Observations(
                    count=count,
                    new=5000 if newest_vendor else 20 + relative + variant,
                    retired=retired,
                    failed=failed,
                )
                state = (
                    "source_incomplete"
                    if coverage == "incomplete"
                    else ("eligible" if count >= 2000 else "below_threshold")
                )
                eligibility = "unknown" if coverage == "incomplete" else state
                qc = Components(
                    failures=failed,
                    driveDays=(10000 if coverage == "incomplete" else 180000) + variant * 1000,
                    complete=coverage == "complete",
                )
                if newest_vendor:
                    qc["driveDays"] = 5000
            cumulative: Components = Components(
                failures=cumulative["failures"] + qc["failures"],
                driveDays=cumulative["driveDays"] + qc["driveDays"],
                complete=cumulative["complete"] and qc["complete"],
            )
            baseline: Baseline | None = None
            qafr, inference, reason = None, "not_applicable", "not_displayed"
            if state == "eligible":
                prior_count = 0 if prior is None else prior["metrics"]["count"]
                assert prior_count is not None
                baseline = (
                    Baseline(
                        kind="initial_zero", priorQuarter=None, elapsedQuarters=None, afr=0, count=0
                    )
                    if prior is None
                    else Baseline(
                        kind="prior_eligible",
                        priorQuarter=prior["quarter"],
                        elapsedQuarters=ordinal(q) - ordinal(prior["quarter"]),
                        afr=prior["metrics"]["afr"],
                        count=prior_count,
                    )
                )
                afr = rate(cumulative)
                blank = Metrics(
                    afr=afr,
                    afrDelta=None
                    if afr is None or baseline["afr"] is None
                    else afr - baseline["afr"],
                    count=count,
                    populationDelta=count - baseline["count"],
                    new=obs["new"],
                    retired=retired,
                    failed=failed,
                )
                qafr = rate(qc)
                reason = None if afr is not None else "incomplete_cumulative_coverage"
                inference = (
                    "newest_quarter_failed_proxy"
                    if q == asof
                    else ("unavailable" if later else "last_seen_before_boundary")
                )
            cell: Cell = Cell(
                quarter=q,
                relativeQuarter=relative,
                state=state,
                eligibility=eligibility,
                coverage=coverage,
                metrics=blank,
                observations=obs,
                quarterComponents=qc,
                cumulativeComponents=deepcopy(cumulative),
                quarterAfr=qafr,
                deltaBaseline=baseline,
                retirementInference=inference,
                rateUnavailableReason=reason,
            )
            model["cells"].append(cell)
            if state == "eligible":
                prior = cell
        models.append(model)
    inventory: list[Inventory] = [
        Inventory(
            modelId=m["modelId"],
            modelNumber=m["modelNumber"],
            vendor=m["vendor"],
            mediaClass="hdd",
            classificationEvidence="Synthetic proof for contract testing only: fictional XYZ 26 TB HDD."
            if m["vendor"] == "XYZ"
            else "Fictional confirmed HDD classification for contract testing.",
            seedMatch=m["admissionReason"] == "seed",
            maxQuarterCount=max(
                c["observations"]["count"]
                for c in m["cells"]
                if c["coverage"] == "complete" and c["observations"]["count"] is not None
            ),
            firstQualifyingQuarter=m["anchorQuarter"],
        )
        for m in models
    ]
    inventory.extend(
        [
            Inventory(
                modelId="ST6000SYNTH",
                modelNumber="ST6000SYNTH",
                vendor="Seagate",
                mediaClass="hdd",
                classificationEvidence="Fictional seed HDD that never reaches the threshold.",
                seedMatch=True,
                maxQuarterCount=1999,
                firstQualifyingQuarter=None,
            ),
            Inventory(
                modelId="SYNTH-SSD",
                modelNumber="SYNTH-SSD",
                vendor="ExampleVendor",
                mediaClass="non_hdd",
                classificationEvidence="Fictional confirmed solid-state device.",
                seedMatch=False,
                maxQuarterCount=3000,
                firstQualifyingQuarter="2024-Q1",
            ),
            Inventory(
                modelId="SYNTH-UNKNOWN",
                modelNumber="SYNTH-UNKNOWN",
                vendor="UnknownVendor",
                mediaClass="unclassified",
                classificationEvidence="Pending media classification; threshold alone does not establish HDD status.",
                seedMatch=False,
                maxQuarterCount=2500,
                firstQualifyingQuarter="2024-Q1",
            ),
        ]
    )
    patterns = [r"^Seagate ST(?:12000NM000[78]|6000SYNTH)$"]
    result = dict(
        artifactType="flagship_matrix",
        contractVersion="1.0.0",
        snapshot=dict(
            id=sid,
            asOfQuarter=asof,
            cutoffDate=str(bounds(asof)[1]),
            generatedAt="2026-10-30T12:00:00Z",
            revisionOf="synthetic-earlier-v1" if later or corrected or new_manufacturer else None,
            immutablePath=f"synthetic/{sid}/matrix.json",
        ),
        versions=dict(
            metrics="flagship-metrics-v1",
            time="calendar-offset-v1",
            delta="prior-eligible-v1",
            colors="shared-scales-v1",
            selection="synthetic-seed-discovery-v2",
            normalization="synthetic-normalization-v1",
            generator="synthetic-fixture-v1",
        ),
        selection=dict(
            id="synthetic-selection",
            patternsSha256=digest(patterns[0]),
            normalizationSha256=digest("synthetic exact identity"),
            seedMatchRule="regex_search_canonical_model",
            seedAsOfQuarter="2025-Q4",
            discoveryRule="all_source_hdd_complete_quarter_ge_2000",
            classificationVersion="synthetic-classification-v1",
            classificationSha256=digest("fictional media classification v1"),
            patterns=patterns,
            resolvedModelIds=[
                m["modelId"]
                for m in inventory
                if m["mediaClass"] == "hdd"
                and (m["seedMatch"] or m["firstQualifyingQuarter"] is not None)
            ],
            inventory=inventory,
            identityRule="normalized_model_and_serial",
            population="seed_plus_discovered_hdd",
            minimumPopulation=2000,
        ),
        coverage=dict(
            historyStart="2023-Q4",
            throughQuarter=asof,
            anchorSearchComplete=True,
            quarters=quarters,
            newestObservationDate=str(bounds(asof)[1]),
        ),
        provenance=dict(
            sources=[
                dict(
                    id="synthetic-input",
                    kind="derived_manifest",
                    publicUrl=None,
                    sha256=digest(
                        "fictional XYZ aggregate input v1"
                        if new_manufacturer
                        else (
                            "fictional corrected aggregate input v1"
                            if corrected
                            else "fictional aggregate input v1"
                        )
                    ),
                    revision=sid if new_manufacturer or corrected else "synthetic-v1",
                )
            ],
            sourceManifestSha256=digest(
                "fictional XYZ aggregate manifest v1"
                if new_manufacturer
                else (
                    "fictional corrected aggregate manifest v1"
                    if corrected
                    else "fictional aggregate manifest v1"
                )
            ),
            dataSourceNotice="SYNTHETIC TEST DATA. All values are invented; no observed Backblaze figures.",
            projectAttribution="Independent Backblaze Drive Stats analysis project; synthetic contract example.",
            datasetAttribution="No Backblaze dataset records are included in this synthetic example.",
        ),
        display=dict(
            quarterLabel="YYYY Qn",
            maxRelativeQuarter=24,
            defaultGuideAfterQuarter=20,
            referenceGuidesAfterQuarters=[20, 24],
            metricOrder=list(METRICS),
            units=dict(
                afr="percent",
                afrDelta="percentage_points",
                count="drives",
                populationDelta="drives",
                new="drives",
                retired="drives",
                failed="daily_failure_flags",
                exposure="recorded_drive_days",
            ),
        ),
        colorScales=dict(
            scope="all_numeric_eligible_cells_in_snapshot",
            percentile="inclusive_linear_n_minus_1",
            interpolation="srgb_piecewise_linear_round_half_up",
            domains=color_domains(models),
        ),
        models=models,
    )
    validate_matrix(result)
    return result


if __name__ == "__main__":
    for later in (False, True):
        data = build(later)
        (
            Path(__file__).parent / ("synthetic-later.json" if later else "synthetic-earlier.json")
        ).write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    (Path(__file__).parent / "synthetic-correction.json").write_text(
        json.dumps(build(corrected=True), indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    (Path(__file__).parent / "synthetic-new-manufacturer.json").write_text(
        json.dumps(build(new_manufacturer=True), indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
