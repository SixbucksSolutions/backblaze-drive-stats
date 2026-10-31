"""Offline historical matrix generation from verified local daily Parquet partitions.

Private cache objects contain serials. Only the returned matrix/supporting objects
may be published. No network operations are performed by this module.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit

import polars as pl

from drive_model_names import normalize_drive_model_name
from tools.validate_matrix_contract import METRICS, bounds, color_domains, ordinal, quarter, rate, validate_matrix
from tools.validate_supporting_contract import validate_supporting

SOURCE_URL = "https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data"
SUMMARY_VERSION = "private-drive-quarter-v2"
NORMALIZATION_VERSION = "canonical-exact-alias-v1"
SELECTION_VERSION = "positive-seed-discovery-v1"


def public_evidence(value):
    """Evidence is public prose/citations; private evidence may stay in config only."""
    reason = "Classification evidence must be public-safe text without local paths or private/credential-bearing URLs"
    if not isinstance(value, str) or not value.strip():
        raise ValueError(reason)
    url_pattern = r"[A-Za-z][A-Za-z0-9+.-]*://[^\s<>]+"
    prose = re.sub(url_pattern, "", value)
    if "\\" in prose or re.search(r"[A-Za-z]:[\\/]|\bfile:|(?<![\w:/])/[^\s/]+", prose) or re.search(r"\b(?:token|password|secret|access_key|authorization)\s*[:=]", prose, re.I):
        raise ValueError(reason)
    # Remove public URLs before checking path-shaped prose so normal HTTPS paths
    # remain valid citations. Query strings and fragments may hold access tokens.
    for token in re.findall(url_pattern, value):
        parsed = urlsplit(token.rstrip(".,);]"))
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError(reason)
        host = parsed.hostname.lower()
        if host == "localhost" or host.endswith((".local", ".internal")):
            raise ValueError(reason)
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ValueError(reason)
    return value.strip()


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def file_sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def normalization_hash(registry):
    return digest(dict(version=NORMALIZATION_VERSION, implementation=file_sha(Path(__file__).with_name("drive_model_names.py")), aliases=registry.aliases))


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".pending-")
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(encoded(value))
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def generation_time(cache_root, snapshot_id, source_hash, output_root=None):
    """Recover creation time only from a valid stamp or verified public artifact."""
    stamp = Path(cache_root)/"generations"/(snapshot_id+".json")
    def checked(value):
        if not isinstance(value, dict) or not isinstance(value.get("generatedAt"), str):
            raise ValueError("Invalid generation stamp")
        datetime.strptime(value["generatedAt"], "%Y-%m-%dT%H:%M:%SZ")
        return value["generatedAt"]
    if stamp.exists():
        try:
            return checked(json.loads(stamp.read_text()))
        except (ValueError, OSError, TypeError):
            pass
    if output_root is not None:
        artifact = Path(output_root)/"snapshots"/snapshot_id/"matrix.json"
        if artifact.exists():
            published = json.loads(artifact.read_text())
            validate_matrix(published)
            if published["snapshot"]["id"] != snapshot_id or published["provenance"]["sourceManifestSha256"] != source_hash:
                raise ValueError("Published generation does not match recovery identity")
            result = checked(published["snapshot"])
            atomic_json(stamp, dict(generatedAt=result))
            return result
    if stamp.exists():
        raise ValueError("Damaged generation stamp: supply output_root with the validated published generation to recover its immutable timestamp")
    result = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    atomic_json(stamp, dict(generatedAt=result))
    return result


@dataclass
class QuarterInput:
    quarter: str
    directory: Path
    receipt: Path | None = None


class Registry:
    """Exact aliases only; unknown names survive inventory with pending media status."""

    def __init__(self, value, patterns):
        if not isinstance(value, dict) or not isinstance(value.get("version"), str) or not value["version"].strip() or not isinstance(value.get("models", []), list):
            raise ValueError("Registry needs a version")
        self.value, self.patterns = value, patterns
        self.aliases = {}
        self.media = {}
        for entry in value.get("models", []):
            if not isinstance(entry, dict) or not all(isinstance(entry.get(k), str) and entry[k].strip() for k in ("vendor", "modelNumber", "mediaClass")) or not isinstance(entry.get("aliases", []), list) or not all(isinstance(a, str) and a.strip() for a in entry.get("aliases", [])):
                raise ValueError("Invalid registry model definition")
            public_evidence(entry.get("evidence"))
            key = (entry["vendor"], entry["modelNumber"])
            if key in self.media or entry["mediaClass"] not in {"hdd", "non_hdd", "unclassified"} or not entry.get("evidence"):
                raise ValueError("Duplicate or invalid registry model")
            self.media[key] = entry
            for alias in entry.get("aliases", []) + [" ".join(key)]:
                alias = " ".join(alias.split())
                if alias in self.aliases and self.aliases[alias] != key:
                    raise ValueError("Conflicting exact alias")
                self.aliases[alias] = key
        for pattern in patterns:
            re.compile(pattern)

    def resolve(self, raw):
        raw = " ".join(raw.split())
        if raw in self.aliases:
            vendor, number = self.aliases[raw]
        else:
            try:
                vendor, number = normalize_drive_model_name(raw).split(" ", 1)
            except ValueError:
                vendor, number = "Unknown", raw
        seed = any(re.search(p, f"{vendor} {number}") for p in self.patterns)
        entry = self.media.get((vendor, number))
        if seed and entry and entry["mediaClass"] != "hdd":
            raise ValueError("Registry contradicts positive known-HDD seed")
        return dict(modelId=digest([vendor, number])[:24], vendor=vendor, modelNumber=number,
                    mediaClass="hdd" if seed else (entry["mediaClass"] if entry else "unclassified"),
                    classificationEvidence="Positive 2025 Q4 known-HDD seed" if seed else (entry["evidence"] if entry else "Pending explicit media classification; population is not media evidence."),
                        seedMatch=seed)


def summarize_partitioned_input(item, cache_root, registry, cutoff):
    """Check byte identities before cache lookup; parse each changed quarter only.

    Receipt dates describe partitions including valid empty days. Every nonempty
    partition is checked independently, so wrong dates cannot fake complete coverage.
    """
    directory = Path(item.directory)
    receipt = json.loads(Path(item.receipt or directory / "import-metadata.json").read_text())
    if not isinstance(receipt, dict) or not isinstance(receipt.get("files"), list):
        raise ValueError("Invalid import receipt shape")
    for record in receipt["files"]:
        if not isinstance(record, dict) or not isinstance(record.get("date"), str) or not isinstance(record.get("outputFile"), str) or type(record.get("rowCount")) is not int or record["rowCount"] < 0:
            raise ValueError("Invalid import receipt partition record")
    records = [r for r in receipt["files"] if date.fromisoformat(r["date"]) <= cutoff]
    if len({r["date"] for r in records}) != len(records) or len({r["outputFile"] for r in records}) != len(records):
        raise ValueError("Duplicate receipt partitions")
    start, end = bounds(item.quarter)
    for record in records:
        if not start <= date.fromisoformat(record["date"]) <= end:
            raise ValueError("Receipt date outside declared quarter")
        if Path(record["outputFile"]).name != record["outputFile"]:
            raise ValueError("Unsafe receipt partition path")
    lineage = dict(quarter=item.quarter, receipt=receipt,
                   partitions=[dict(date=r["date"], sha256=file_sha(directory / r["outputFile"])) for r in records],
                   summaryVersion=SUMMARY_VERSION, normalization=NORMALIZATION_VERSION,
                   normalizationSha256=digest(dict(version=NORMALIZATION_VERSION, implementation=file_sha(Path(__file__).with_name("drive_model_names.py")))))
    quarter_root = Path(cache_root) / "quarters" / item.quarter
    # Discover verified candidates by source bytes and implementation first. Only
    # mappings actually used by this quarter participate in its semantic identity.
    # A new registry entry for a future raw name must not reparse old quarters.
    for manifest_path in sorted(quarter_root.glob("*/manifest.json")):
        target = manifest_path.parent
        try:
            manifest = json.loads(manifest_path.read_text())
            if not isinstance(manifest, dict) or not all(isinstance(manifest.get(name), dict) for name in ("lineage", "objects", "names", "canonicalModels", "coverage")):
                continue
            content_hash = manifest.pop("manifestContentSha256", None)
            valid_manifest = content_hash == digest(manifest)
            manifest["manifestContentSha256"] = content_hash
            if not valid_manifest or manifest.get("lineage") != lineage or set(manifest.get("objects", {})) != {"drives.parquet", "capacities.parquet"}:
                continue
            if not all((target / n).is_file() and file_sha(target / n) == h for n, h in manifest["objects"].items()):
                continue
            # Inspect cached source names only after both manifest and object
            # checksums have been verified. Reclassify using current evidence.
            effective = {raw: registry.resolve(raw)["modelId"] for raw in manifest["names"]}
            key = digest(dict(lineage=lineage, canonicalModels=effective))
            if manifest.get("canonicalModels") != effective or manifest.get("inputSha256") != key or target.name != key:
                continue
            return manifest, pl.read_parquet(target / "drives.parquet"), pl.read_parquet(target / "capacities.parquet"), True
        except (ValueError, TypeError, KeyError, AttributeError, OSError, pl.exceptions.PolarsError):
            pass  # An incomplete commit marker is a cache miss, never evidence.
    frames, dates, row_count, names = [], [], 0, {}
    for record in records:
        source = pl.scan_parquet(directory / record["outputFile"])
        schema = source.collect_schema()
        if not {"date", "serial_number", "model", "failure", "capacity_bytes"} <= set(schema):
            raise ValueError("Missing required source fields")
        parsed = pl.col("date").str.to_date("%Y-%m-%d", strict=True) if schema["date"] == pl.String else pl.col("date").cast(pl.Date)
        if source.select(pl.len()).collect().item() != record["rowCount"]:
            raise ValueError("Receipt row count differs from source partition")
        source = source.with_columns(parsed.alias("date")).filter(pl.col("date").is_null() | (pl.col("date") <= cutoff))
        # Future observations are removed before all non-date conversions/validation.
        source = source.select("date",
            pl.col("serial_number").cast(pl.String),
            pl.col("model").cast(pl.String).str.strip_chars(),
            pl.col("failure").cast(pl.Float64),
            pl.col("capacity_bytes").cast(pl.Float64,
                strict=False),

                               (pl.col("datacenter").cast(pl.String) if "datacenter" in schema else pl.lit(None, dtype=pl.String)).alias("datacenter"))
        count = source.select(pl.len()).collect().item()
        invalid = source.filter(pl.col("date").is_null() | (pl.col("date") != date.fromisoformat(record["date"])) | pl.col("serial_number").is_null() | (pl.col("serial_number").str.strip_chars() == "") | pl.col("model").is_null() | (pl.col("model") == "") | pl.col("failure").is_null() | ~pl.col("failure").is_in([0.,
                    1.])).select(pl.len()).collect().item()
        if invalid:
            raise ValueError("Invalid required observation or partition date")
        daily_names = source.select("model").unique().collect().get_column("model").to_list()
        for raw in daily_names:
            names[raw] = registry.resolve(raw)
        mapping = pl.DataFrame([dict(raw=raw, id=names[raw]["modelId"]) for raw in daily_names], schema={"raw": pl.String, "id": pl.String})
        source = source.join(mapping.lazy(), left_on="model", right_on="raw")
        # Receipt dates are unique and all retained rows have their partition's
        # date. Check aliases per day to bound duplicate state by one daily fleet.
        if source.group_by("id", "serial_number").len().filter(pl.col("len") > 1).select(pl.len()).collect().item():
            raise ValueError("Duplicate normalized identity/date")
        frames.append(source)
        dates.append(record["date"])
        row_count += count
    if not frames:
        raise ValueError("Supplied quarter has no validated partitions")
    source = pl.concat(frames).with_columns(pl.col("failure").cast(pl.Int64),
        pl.col("datacenter").str.strip_chars().str.to_uppercase().fill_null("Unknown").replace("",
            "Unknown"))
    drives = source.group_by("id",
        "serial_number").agg(pl.col("date").min().alias("first"),
        pl.col("date").max().alias("last"),
        pl.len().alias("driveDays"),
        pl.col("failure").sum().alias("failures"),
        pl.col("datacenter").sort_by("date").last().alias("datacenter")).collect(engine="streaming")
    capacities = source.filter(pl.col("capacity_bytes").is_finite() & (pl.col("capacity_bytes") > 0)).group_by("id", "capacity_bytes").len().collect(engine="streaming")
    effective = {raw: item["modelId"] for raw,item in names.items()}
    key = digest(dict(lineage=lineage, canonicalModels=effective))
    target = quarter_root / key
    manifest_path = target / "manifest.json"
    expected = (end - start).days + 1
    coverage = dict(quarter=item.quarter,
        status="complete" if len(dates) == expected else "incomplete",
        expectedDays=expected,
        observedDays=len(dates),
        observedStart=min(dates),
        observedEnd=max(dates),
        rowCount=row_count,
        sourceIds=["source-" + key])
    target.mkdir(parents=True, exist_ok=True)
    objects = {}
    for name, frame in (("drives.parquet", drives), ("capacities.parquet", capacities)):
        fd, temporary = tempfile.mkstemp(dir=target, prefix=".pending-")
        os.close(fd)
        try:
            frame.write_parquet(temporary, compression="zstd")
            os.replace(temporary, target / name)
        finally:
            Path(temporary).unlink(missing_ok=True)
        objects[name] = file_sha(target / name)
    manifest = dict(inputSha256=key, lineage=lineage, canonicalModels=effective, objects=objects, coverage=coverage, names=names)
    manifest["manifestContentSha256"] = digest(manifest)
    atomic_json(manifest_path, manifest)  # commit marker written last
    return manifest, drives, capacities, False


def generate(inputs, *, cache_root, as_of, history_start, registry, patterns, generator_revision, kind="backblaze", revision_of=None, output_root=None):
    if not generator_revision.strip() or kind not in {"backblaze", "sample"}:
        raise ValueError("Explicit code revision and source kind required")
    cutoff = bounds(as_of)[1]
    periods = [quarter(n) for n in range(ordinal(history_start), ordinal(as_of) + 1)]
    if not periods:
        raise ValueError("Invalid history window")
    reg = Registry(registry, patterns)
    by_input = {i.quarter: i for i in inputs}
    if len(by_input) != len(inputs):
        raise ValueError("Duplicate input quarter")
    coverage, sources, all_drives, frequencies, metadata, aliases, keys = [], [], [], defaultdict(lambda: defaultdict(int)), {}, defaultdict(set), []
    reused, computed = [], []
    for q in periods:
        if q not in by_input:
            s, e = bounds(q)
            coverage.append(dict(quarter=q, status="missing", expectedDays=(e-s).days+1, observedDays=0, observedStart=None, observedEnd=None, rowCount=0, sourceIds=[]))
            continue
        manifest, drives, capacities, hit = summarize_partitioned_input(by_input[q], cache_root, reg, cutoff)
        (reused if hit else computed).append(q)
        keys.append(manifest["inputSha256"])
        coverage.append(manifest["coverage"])
        sources.append(dict(id="source-"+manifest["inputSha256"], kind="derived_manifest", publicUrl=None, sha256=manifest["inputSha256"], revision=manifest["inputSha256"]))
        for raw in manifest["names"]:
            item = reg.resolve(raw)
            metadata[item["modelId"]] = item
            aliases[item["modelId"]].add(raw)
        all_drives.extend(dict(r, quarter=q) for r in drives.to_dicts())
        for row in capacities.to_dicts():
            frequencies[row["id"]][row["capacity_bytes"]] += row["len"]
    byq = {q["quarter"]: q for q in coverage}
    lifecycle = {}
    for r in all_drives:
        key = r["id"], r["serial_number"]
        old = lifecycle.get(key)
        lifecycle[key] = (min(r["first"], old[0]) if old else r["first"], max(r["last"], old[1]) if old else r["last"])
    modelq = defaultdict(list)
    for r in all_drives:
        modelq[r["id"], r["quarter"]].append(r)
    inventory = []
    for mid, info in sorted(metadata.items()):
        counts = [(q, len(modelq[mid, q])) for q in periods if byq[q]["status"] == "complete"]
        inventory.append(dict(info, maxQuarterCount=max([n for _, n in counts] or [0]), firstQualifyingQuarter=next((q for q,n in counts if n>=2000), None)))
    cohort = sorted(i["modelId"] for i in inventory if i["mediaClass"] == "hdd" and (i["seedMatch"] or i["firstQualifyingQuarter"]))
    selected = [r for r in all_drives if r["id"] in cohort]
    if not selected:
        raise ValueError("No selected HDD observations; classification/coverage action required")
    newest = max(r["last"] for r in selected)
    models = []
    qualifying = [i for i in inventory if i["modelId"] in cohort and i["firstQualifyingQuarter"]]
    extent = max([24] + [ordinal(as_of)-ordinal(i["firstQualifyingQuarter"])+1 for i in qualifying])
    for info in qualifying:
        mid, anchor = info["modelId"], info["firstQualifyingQuarter"]
        if any(byq[q]["status"] != "complete" for q in periods if q < anchor):
            raise ValueError("Unresolved pre-anchor history prevents publication")
        def components(q):
            rows = modelq[mid, q]
            return dict(failures=sum(r["failures"] for r in rows), driveDays=sum(r["driveDays"] for r in rows), complete=byq[q]["status"] == "complete")
        pre = dict(failures=0, driveDays=0, complete=True)
        for q in periods:
            if q < anchor:
                for k in ("failures", "driveDays"):
                    pre[k] += components(q)[k]
        cumulative, cells, prior = deepcopy(pre), [], None
        for relative in range(1, extent+1):
            q = quarter(ordinal(anchor)+relative-1)
            metrics = {m: None for m in METRICS}
            obs = dict(count=None, new=None, retired=None, failed=None)
            cell = dict(quarter=q,
                relativeQuarter=relative,
                state="snapshot_end",
                eligibility="not_yet_observed",
                coverage="outside_snapshot",
                metrics=metrics,
                observations=obs,
                quarterComponents=None,
                cumulativeComponents=None,
                quarterAfr=None,
                deltaBaseline=None,
                retirementInference="not_applicable",
                rateUnavailableReason="not_displayed")
            if q <= as_of:
                status = byq[q]["status"]
                rows, qc = modelq[mid,q], components(q)
                for k in ("failures", "driveDays"):
                    cumulative[k] += qc[k]
                cumulative["complete"] &= qc["complete"]
                count = len(rows)
                retired = qc["failures"] if q == as_of else (sum(lifecycle[mid,
                            r["serial_number"]][1] == r["last"] and r["last"] < newest for r in rows) if all(byq[t]["status"] == "complete" for t in periods if t >= q) else None)
                if status != "missing":
                    obs.update(count=count, new=sum(lifecycle[mid,r["serial_number"]][0] == r["first"] for r in rows), retired=retired, failed=qc["failures"])
                state = "source_"+status if status != "complete" else ("eligible" if count>=2000 else "below_threshold")
                cell.update(state=state,
                    eligibility="unknown" if status != "complete" else state,
                    coverage=status,
                    quarterComponents=qc,
                    cumulativeComponents=deepcopy(cumulative))
                if state == "eligible":
                    baseline = dict(kind="initial_zero",
                        priorQuarter=None,
                        elapsedQuarters=None,
                        afr=0,
                        count=0) if prior is None else dict(kind="prior_eligible",
                        priorQuarter=prior["quarter"],
                        elapsedQuarters=ordinal(q)-ordinal(prior["quarter"]),
                        afr=prior["metrics"]["afr"],
                        count=prior["metrics"]["count"])
                    afr = rate(cumulative)
                    metrics.update(afr=afr,
                        afrDelta=None if afr is None or baseline["afr"] is None else afr-baseline["afr"],
                        count=count,
                        populationDelta=count-baseline["count"],
                        new=obs["new"],
                        retired=retired,
                        failed=qc["failures"])
                    cell.update(deltaBaseline=baseline,
                        quarterAfr=rate(qc),
                        retirementInference="newest_quarter_failed_proxy" if q == as_of else ("last_seen_before_boundary" if retired is not None else "unavailable"),
                        rateUnavailableReason=None if afr is not None else ("zero_exposure" if cumulative["complete"] else "incomplete_cumulative_coverage"))
                    prior = cell
            cells.append(cell)
        models.append(dict(modelId=mid,
                modelNumber=info["modelNumber"],
                vendor=info["vendor"],
                rawModelAliases=sorted(aliases[mid]),
                admissionReason="seed" if info["seedMatch"] else "discovered",
                anchorQuarter=anchor,
                finalEligibleQuarter=max(c["quarter"] for c in cells if c["state"] == "eligible"),
                asOfStatus=next(c["state"] for c in cells if c["quarter"] == as_of),
                historyStart=str(bounds(history_start)[0]),
                preEligibilityComponents=pre,
                cells=cells))
    models.sort(key=lambda m: ({"Seagate":0,"Toshiba":1,"WDC/HGST":2}.get(m["vendor"],3),m["vendor"],m["modelNumber"]))
    source_hash = digest(keys)
    identity = digest(dict(asOf=as_of,
            sources=source_hash,
            registry=registry,
            patterns=patterns,
            generator=generator_revision,
            historyStart=history_start,
            kind=kind,
            revisionOf=revision_of))
    sid = as_of+"-"+identity[:24]
    generated_at = generation_time(cache_root, sid, source_hash, output_root)
    matrix = dict(artifactType="flagship_matrix",
        contractVersion="1.0.0",
        snapshot=dict(id=sid,
            asOfQuarter=as_of,
            cutoffDate=str(cutoff),
            generatedAt=generated_at,
            revisionOf=revision_of,
            immutablePath=f"snapshots/{sid}/matrix.json"),
        versions=dict(metrics="flagship-metrics-v1",
            time="calendar-offset-v1",
            delta="prior-eligible-v1",
            colors="shared-scales-v1",
            selection=SELECTION_VERSION,
            normalization=NORMALIZATION_VERSION,
            generator=generator_revision),
        selection=dict(id="positive-seed-discovery",
            patternsSha256=digest(patterns),
            normalizationSha256=normalization_hash(reg),
            seedMatchRule="regex_search_canonical_model",
            seedAsOfQuarter="2025-Q4",
            discoveryRule="all_source_hdd_complete_quarter_ge_2000",
            classificationVersion=registry["version"],
            classificationSha256=digest(registry),
            patterns=patterns,
            resolvedModelIds=cohort,
            inventory=inventory,
            identityRule="normalized_model_and_serial",
            population="seed_plus_discovered_hdd",
            minimumPopulation=2000),
        coverage=dict(historyStart=history_start,
            throughQuarter=as_of,
            anchorSearchComplete=True,
            quarters=coverage,
            newestObservationDate=str(newest)),
        provenance=dict(sources=sources,
            sourceManifestSha256=source_hash,
            dataSourceNotice="Backblaze dataset rights and usage terms apply; see DATA_SOURCES.md.",
            projectAttribution="Independent SixbucksSolutions analysis; no Backblaze endorsement.",
            datasetAttribution="Drive statistics source: Backblaze."),
        display=dict(quarterLabel="YYYY Qn",
            maxRelativeQuarter=extent,
            defaultGuideAfterQuarter=20,
            referenceGuidesAfterQuarters=[20,
                24],
            metricOrder=list(METRICS),
            units=dict(afr="percent",
                afrDelta="percentage_points",
                count="drives",
                populationDelta="drives",
                new="drives",
                retired="drives",
                failed="daily_failure_flags",
                exposure="recorded_drive_days")),
        colorScales=dict(scope="all_numeric_eligible_cells_in_snapshot",
            percentile="inclusive_linear_n_minus_1",
            interpolation="srgb_piecewise_linear_round_half_up",
            domains=color_domains(models)),
        models=models)
    supporting = build_supporting(matrix, metadata, modelq, lifecycle, frequencies, kind)
    validate_matrix(matrix)
    validate_supporting(supporting)
    return matrix, supporting, dict(reusedQuarters=reused,
        computedQuarters=computed,
        pendingClassification=[i for i in inventory if i["mediaClass"] == "unclassified" and i["firstQualifyingQuarter"]],
        privateDriveQuarterRows=len(all_drives))


def build_supporting(matrix, metadata, modelq, lifecycle, frequencies, kind):
    cohort = set(matrix["selection"]["resolvedModelIds"])
    capacity = {mid: min(values, key=lambda c: (-values[c], c))/1e12 for mid, values in frequencies.items() if values}
    def total(rows):
        return {k: None if any(r[k] is None for r in rows) else sum(r[k] for r in rows) for k in ("driveCount","newDrives","capacityTb")}
    periods, previous = [], {}
    for cov in matrix["coverage"]["quarters"]:
        q, complete = cov["quarter"], cov["status"] == "complete"
        scopes=[]
        for selected in (True,False):
            scopeid = "selected_hdd" if selected else "all_supplied"
            modelrows, dcrows = [], defaultdict(list)
            if complete:
                for mid in sorted(metadata):
                    if selected and mid not in cohort:
                        continue
                    rows = modelq[mid,q]
                    if not rows:
                        continue
                    measures=dict(driveCount=len(rows),
                        newDrives=sum(lifecycle[mid,
                                r["serial_number"]][0] == r["first"] for r in rows),
                        capacityTb=None if mid not in capacity else len(rows)*capacity[mid])
                    modelrows.append(dict(id=mid,manufacturer=metadata[mid]["vendor"],model=metadata[mid]["modelNumber"],measures=measures))
                    for r in rows:
                        dcrows[r["datacenter"]].append(dict(driveCount=1,newDrives=0,capacityTb=capacity.get(mid)))
            totals=total([r["measures"] for r in modelrows]) if complete else dict(driveCount=None,newDrives=None,capacityTb=None)
            manufacturers=[]
            if selected:
                for vendor in sorted({r["manufacturer"] for r in modelrows}):
                    measures=total([r["measures"] for r in modelrows if r["manufacturer"]==vendor])
                    shares={share: measures[k]/totals[k] if measures[k] is not None and totals[k] else None for k,
                        share in (("driveCount",
                                "populationShare"),
                            ("newDrives",
                                "newShare"),
                            ("capacityTb",
                                "capacityShare"))}
                    manufacturers.append(dict(manufacturer=vendor,measures=measures,**shares))
            datacenters=[] if selected else [dict(datacenter=loc,driveCount=total(rows)["driveCount"],capacityTb=total(rows)["capacityTb"]) for loc,rows in sorted(dcrows.items())]
            prior=previous.get(scopeid)
            reason="coverage_gap" if not complete or (prior and prior[0] != "complete") else ("no_previous_quarter" if not prior else ("capacity_unavailable" if totals["capacityTb"] is None or prior[1] is None else None))
            delta=totals["capacityTb"]-prior[1] if reason is None else None
            known=None if selected or not totals["driveCount"] else (totals["driveCount"]-sum(r["driveCount"] for r in datacenters if r["datacenter"]=="Unknown"))/totals["driveCount"]
            scopes.append(dict(scopeId=scopeid,
                    totals=totals,
                    capacityDeltaTb=delta,
                    capacityDeltaReason=reason,
                    models=modelrows,
                    manufacturers=manufacturers,
                    datacenters=datacenters,
                    knownLocationShare=known))
            previous[scopeid]=(cov["status"],totals["capacityTb"])
        periods.append(dict(quarter=q,coverage=cov["status"],coverageReason=None if complete else "Validated source partitions do not cover the complete quarter.",scopes=scopes))
    return dict(artifactType="supporting-history",
        schemaVersion=1,
        snapshotId=matrix["snapshot"]["id"],
        asOfQuarter=matrix["snapshot"]["asOfQuarter"],
        sourceManifestSha256=matrix["provenance"]["sourceManifestSha256"],
        versions=dict(selection=SELECTION_VERSION,
            normalization=NORMALIZATION_VERSION,
            metrics="supporting-v1",
            capacity="positive-observation-mode-tie-smallest-v1"),
        provenance=dict(kind=kind,
            sourceUrl=SOURCE_URL,
            attribution="Backblaze source data; independent SixbucksSolutions analysis.",
            historyStart=str(bounds(matrix["coverage"]["historyStart"])[0]),
            selectionPatterns=matrix["selection"]["patterns"],
            selectionSha256=matrix["selection"]["patternsSha256"],
            seedAsOfQuarter="2025-Q4",
            discoveryRule="all_source_hdd_complete_quarter_ge_2000",
            classificationVersion=matrix["selection"]["classificationVersion"],
            selectedModelIds=sorted(cohort),
            notes=["Observed-quarter populations; decimal TB. New means first observed in supplied history.",
                "Capacity uses positive daily-observation mode through cutoff; ties choose smallest. Unknown locations remain in totals."]),
        quarters=periods)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config",
        type=Path,
        required=True,
        help="Private JSON with inputs, registry, patterns, cacheRoot, asOfQuarter, historyStart, generatorRevision, outputDirectory")
    args=parser.parse_args()
    config=json.loads(args.config.read_text())
    inputs=[QuarterInput(i["quarter"],Path(i["directory"]),Path(i["receipt"]) if i.get("receipt") else None) for i in config["inputs"]]
    matrix,supporting,diagnostics=generate(inputs,
        cache_root=config["cacheRoot"],
        as_of=config["asOfQuarter"],
        history_start=config["historyStart"],
        registry=config["registry"],
        patterns=config["patterns"],
        generator_revision=config["generatorRevision"],
        kind=config.get("kind",
            "backblaze"),
        revision_of=config.get("revisionOf"),
        output_root=config["outputDirectory"])
    from history_storage import publish_generation
    # Parent helper verifies the pair and switches its index only after both
    # immutable content-hashed objects are present.
    publish_generation(Path(config["outputDirectory"]),matrix,supporting)
    print(json.dumps(dict(snapshotId=matrix["snapshot"]["id"],**diagnostics)))


if __name__ == "__main__":
    main()
