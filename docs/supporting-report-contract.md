# Supporting calendar-quarter reports, version 1

Proposed under #0014, 2026-10-30. This accompanies the
[flagship matrix contract](flagship-matrix-contract.md); it does not change the
existing website's version-1 bundles or implement the historical exporter.

Keep the six existing report families. The flagship is cumulative reliability;
the other five are calendar-quarter aggregations. This specification reconciles
their populations explicitly rather than claiming their legacy totals match.

The [v2 proposal](production-data-v2.md) under #0084 separates the supporting HDD
context from the flagship analysis subset and adds explicit generation binding.
The v1 schema and examples below retain their original semantics until the
separate proposal is accepted and implemented by its consumer tickets.

## Legacy behavior and declared corrections

| Script | Existing scope and aggregation | Future contract decision |
| --- | --- | --- |
| `quarterly_afr_xlsx_from_iceberg.py` | Personal regex selection, canonical model aliases, cumulative AFR; qualifying model quarters only | Separate matrix contract; its 2,000 cutoff does not filter supporting totals |
| `quarterly_drive_model_deployments.py` | Personal regex selection; first observation grouped by raw model/serial **before** simplified normalization; hides additions below 500 per model/quarter by default | Canonicalize before identity/lifecycle aggregation to avoid counting one aliased disk twice; retain all additions, with an optional explicit display filter |
| `quarterly_drive_model_distributions.py` | Personal selection, canonical normalized model/serial quarterly distinct count; optional minimum defaults to zero | Retain all selected models, including those never reaching 2,000; optional display filters must state their effect on totals |
| `quarterly_raw_storage_capacity.py` | All supplied raw models; per raw-model/quarter capacity **mode**, despite the variable name `median_capacity_tb`; distinct serial count multiplied by that mode | Normalize aliases and use deterministic positive finite capacity mode through the snapshot for an explicitly labeled all-supplied population |
| `quarterly_raw_storage_capacity_by_mfr.py` | Personal selection; per normalized model capacity mode over supplied history, then unique model/serial/quarter count | Same deterministic capacity policy as the selected model/population rollup; no 2,000 minimum |
| `quarterly_raw_storage_capacity_by_datacenter.py` | All supplied raw models; location string at least four characters; median of daily capacity observations per location/model/quarter; movers can count at multiple locations | Assign each normalized model/serial once per quarter to its last observed location, include `Unknown`, and use the common all-supplied capacity policy |

These corrections intentionally affect totals when aliases, mode ties, invalid
capacities, moves or excluded locations occur. Preserve the legacy XLSX numbers
in reference fixtures. Do not rewrite the old scripts or advertise numerical
parity across differently scoped capacity reports. The current web exporter
already uses canonical identities, last-location assignment and the deterministic
mode policy; this contract carries those choices forward with explicit scope.

## Artifact and populations

`contracts/supporting-history-v1.schema.json` defines a separate aggregate artifact
with `artifactType: "supporting-history"`, `schemaVersion: 1`, immutable snapshot
identity, source attribution, semantic versions and chronological quarter records.
It is paired with a matrix snapshot by snapshot ID, **not** inferred from its
visible cells. Its source manifest hash identifies the same immutable generation.
Public paths and manifests contain no credentials or drive serials. The source
link is public HTTPS without credentials, query parameters or fragments; never
publish signed source URLs. Parse JSON with duplicate-key rejection.

Two fixed scope IDs are supported:

- `selected_hdd`: the snapshot's **seed-plus-discovery cohort**. Preserve the
  2025 Q4 positive regex seed, match it against canonical normalized model names,
  and add every confirmed HDD that qualifies at 2,000 in any complete supplied
  quarter. The seed is not an exhaustive allowlist. Publish its patterns/hash,
  seed date, classification version, discovery rule and `selectedModelIds`; these
  match the matrix's `resolvedModelIds` for a paired generation. Seed models that
  never reach 2,000 and historically admitted models now below it remain in
  supporting context. Confirmed non-HDDs remain outside this cohort. Unclassified
  qualifying candidates are explicit in the matrix inventory/generation report.
  Discovery must see all-source inventory before filtering. The same versioned
  canonical identities govern both contracts, with no three-vendor restriction.
  Include **all aliases and pre-eligibility observations** for cohort models,
  rather than discarding records that do not match the old seed patterns.
- `all_supplied`: all valid source models, including boot/SSD models when present.
  Known aliases normalize; unsupported raw names remain distinct under `Unknown`
  manufacturer. This is all supplied source, not proof that Backblaze reported
  every physical drive. Overall raw capacity and datacenter reports use this scope.

A drive identity is canonical model plus serial number. Reject duplicate
identity/date observations after alias normalization before exposure or lifecycle
aggregation. Publish only stable model IDs, manufacturer/model names and aggregates.
Exact model variants stay separate. Family metadata never changes identity.

## Measures and denominators

- `driveCount`: distinct identities observed anywhere in that calendar quarter.
  It is not quarter-end installed population.
- `newDrives`: identities whose first observation **in supplied history** is in
  that quarter. The initial observed fleet is included; label the history start.
  Historical coverage gaps weaken deployment interpretation and must be disclosed.
- `capacityTb`: `sum(model nominal capacity bytes × quarterly observed identities)
  / 10^12`. Nominal capacity is the mode of positive finite byte capacities among
  all supplied daily source observations for that canonical model
  **through this as-of cutoff**;
  a tie chooses the smaller byte capacity. Frequency weighting is by observation,
  not unique drive. No future observations may alter an older snapshot. A model
  with no valid capacity makes the affected capacity total unavailable, while known
  counts remain available; do not silently drop it. A newer snapshot may revise
  earlier capacities under this documented as-of policy.

  Cohort selection follows canonical source aggregation, so each selected model's
  counts, New and nominal capacity agree with its all-supplied row. A new as-of
  cohort can add an off-seed model's earlier history and change historical totals
  or shares; this is a declared cohort expansion, not necessarily fleet growth.
  Preserve the earlier snapshot and expose cohort/version context when comparing
  generations. Within one artifact, the as-of cohort stays fixed across quarters.
- `capacityDeltaTb`: current minus **immediately previous calendar quarter** with
  complete, valid capacity and identical scope/semantic versions. First quarter,
  a missing predecessor, incomplete coverage or unavailable capacity yields null
  plus an explicit reason. Never bridge a missing quarter, subtract zero initially,
  or call this new-drive capacity, usable capacity or customer uploads.
- Manufacturer `populationShare`, `newShare`, `capacityShare`: fractions in [0,1]
  using their respective **selected_hdd** quarter totals. A zero or unavailable
  denominator gives null, not zero. No mixed-population shares. Model rows supply
  deployment/distribution detail; manufacturer rows sum those rows exactly.
- Datacenter counts/capacity: each all-supplied identity goes to its last observed
  location within that quarter. Trim and uppercase locations; blank/missing is
  `Unknown`. Reject identity/date duplicates rather than arbitrarily break a
  same-date location tie. Include `Unknown` in the denominator so the location
  totals reconcile to all-supplied totals. Report known-location coverage as
  `(total driveCount − Unknown driveCount) / total driveCount`, null if zero.

Storage units are decimal: 1 TB = 10^12 bytes, 1 PB = 1,000 TB,
1 EB = 1,000,000 TB. Only presentation converts units. Integer counts must be
nonnegative safe integers; floating values finite. Level capacity may be zero;
zero observed identities is measured only with complete source coverage.

## Coverage, versioning and publication

Quarter records are unique, sorted, year-first `YYYY-QN`, through the cutoff;
include explicit missing/incomplete quarters. A complete quarter requires verified
source daily partitions and validation, not merely one surviving selected record
on each day. Coverage describes supplied source, not physical fleet census.
For missing/incomplete coverage, publish null counts/capacity/shares/deltas and an
explanation; do not mistake partial observations for a measured decline. The
matrix has finer rate availability rules; these supporting totals are complete
calendar-quarter comparisons only.

Semantic checks in addition to JSON Schema must verify dates/order/cutoff,
snapshot/source identity, scope consistency, model-to-manufacturer-to-total sums,
datacenter-to-all-supplied sums, fractions, delta comparability and absence of
private identity material. Use exact integers and float tolerance max(1e-10,
abs(expected) × 1e-10). Schema describes structure, not those arithmetic guarantees.

Publish immutable content-hashed files before switching a small generation index.
The index pairs this artifact and the matrix with their hashes and versions;
readers reject mismatches. Updating filters, normalization, metric/capacity policy
or source inputs requires a new generation and relevant version/cache invalidation.
Local D: storage and future B2 locations do not change semantic identities.
Backblaze attribution and coverage travel with JSON/CSV/shared outputs; see
[DATA_SOURCES.md](../DATA_SOURCES.md). No new dashboard, causal event overlay or
financial data source is introduced.

## Golden validation

`fixtures/supporting/synthetic-history.json` contains invented figures, explicitly
labeled `sample`. It covers a 500-drive selected model retained below the matrix
cutoff, separate all-supplied SSD capacity, unknown locations, missing/incomplete
quarters, a measured zero population and unavailable capacity with known counts.
It is a standalone supporting contract example, not a published paired generation.

```powershell
uv run --frozen python tools/validate_supporting_contract.py fixtures/supporting/synthetic-history.json
uv run --frozen python -m unittest discover -s tests -p test_supporting_contract.py
```

Tests check exact integer sums (including integer-valued floats at large scales),
shares/denominators, source-window completeness, duplicate keys, invalid/private
fields, credential-bearing URLs and coverage-aware deltas. These aggregate checks
do not prove the raw source was complete, that capacity modes were computed
correctly, or that a last-location assignment was justified. The historical
generator must verify those from its retained private input and manifests.
