# Flagship production matrix contract

Contract #0014, version **1.0.0**, proposed for owner acceptance under
[approved plan r004](flagship-afr-plan.md). This defines the separate production
matrix and its validation obligations. It does not authorize UI/generator work,
historical downloads, backfill, paid compute or cloud changes. The schema is
[`contracts/flagship-matrix-v1.schema.json`](../contracts/flagship-matrix-v1.schema.json).
Structural schema validation and the semantic invariants below are both required.

Legacy code and workbook agreement establish reference fidelity, not statistical
correctness. The owner explicitly expects errors may exist. Independently check
production formulas, units, exposure and source aggregation; record a discovered
error and its correction/version instead of copying it to preserve apparent
parity. Keep the unchanged legacy fixture as evidence of the original behavior.
The 2,000 threshold is a comparison convention, not a statistical-significance
test. These aggregate trajectories do not estimate individual-drive survival or
prove procurement causes.

## Production and reference artifacts

The production artifact has `artifactType: flagship_matrix`, `contractVersion:
1.0.0`, a calendar cutoff, exposure, coverage and lineage. It is separate from the
existing calendar-quarter web bundle; neither format may be silently substituted
for the other. Supporting calendar reports retain their own populations and
[supporting-report contract](supporting-report-contract.md).

The two supplied XLSX files are immutable **legacy visual/golden fixtures**. Their
extraction records the exact numeric cells, retained-row positions, formatting
and shared conditional-format rules described in the
[reference audit](workbook-reference-analysis.md). Fixture rows enumerate retained
qualifying quarters; workbook blanks have unknown causes. XLSX alone does not
establish actual calendar anchors, coverage, exposure or a confirmed threshold
exit. Never manufacture those fields or call an XLSX extraction a production
snapshot. First-row deltas subtract zero; later fixture deltas subtract the prior
retained row exactly. Normalize only New's malformed low-color token to valid
`#FFFFFF` for intended rendering, recording the original token; preserve originals.

Production intentionally changes elapsed-time handling and defines previously
ambiguous color edge cases. These choices require owner acceptance with #0014;
the production versions are `flagship-metrics-v1`, `calendar-offset-v1`,
`prior-eligible-v1` and `shared-scales-v1`. Golden numeric parity does not imply
that unencoded workbook calendar/coverage facts have been proved.

## Selection, identity and provenance

- Match the versioned personal HDD regular expressions against raw SMART model
  strings before canonical normalization, preserving the current selection rule.
  Record the patterns, their content SHA-256, normalization implementation/content
  SHA-256, selection and normalization versions, and resolved exact model IDs.
- An identity is `(canonical normalized model, serial)`, private to processing.
  Canonical aliases may merge spelling/prefix variants of the same model. Distinct
  model numbers, including suffix variants, must remain separate. A serial moving
  between datacenters does not create another identity. Public JSON contains no
  serial numbers, per-drive dates, credentials or private object locations.
- Each model carries stable `modelId`, exact `modelNumber`, raw model aliases and
  a Seagate, Toshiba or WDC/HGST grouping label. Grouping does not merge histories.
  Sort vendor blocks in that order, models lexically by exact model number.
- Keep every selected model that ever has a complete qualifying quarter through
  the cutoff, even if currently below threshold. Models never known to qualify
  remain in the declared selection/context population, outside matrix blocks.
- `provenance.sources` carries stable IDs, source revision identities and explicit
  content SHA-256 values. Hash the exact source bytes or a defined derived
  manifest, never an ETag assumed to be a content hash. `sourceManifestSha256`
  identifies the complete retained input manifest. Quarter coverage links source
  IDs; version identifiers must resolve to retained definitions and source/code
  revisions. `generator` identifies its code revision, not just a package name.
- Preserve Backblaze attribution, source links and [DATA_SOURCES.md](../DATA_SOURCES.md)
  context with downloads and shared outputs. Software/original-analysis MIT
  licensing does not replace dataset rights or imply Backblaze endorsement.

## Calendar, eligibility and unavailable states

Quarter keys are `YYYY-Qn`; displayed labels are year-first, e.g. **2025 Q4**.
`snapshot.cutoffDate` is the selected calendar quarter's last date, inclusive.
`coverage.throughQuarter` equals `snapshot.asOfQuarter`. An as-of snapshot contains
only observations on or before that cutoff; an input file containing later rows
must be filtered before all population, exposure and lifecycle calculations.

Coverage enumerates every calendar quarter from `historyStart` through the cutoff,
including absent quarters. Complete means all expected daily source partitions
were validated, not that the model appears every day. The coverage fields
`observedDays`, `observedStart`, `observedEnd` and `rowCount` describe validated
**source partitions before personal model selection**, including valid empty
partitions. They do not describe dates on which selected models had observations.
Store calendar-day counts, partition date bounds, validated row counts and source
IDs. A valid empty partition
is different from a missing file. Completeness requires partition/date validation;
matching counts alone is insufficient. A model absent from a complete quarter has
known Count zero; an absent model in missing/incomplete coverage has unknown Count.

The anchor is the **earliest complete calendar quarter with Count >= 2,000** in
the declared supplied history. Confirm the preceding required history and record
`anchorSearchComplete: true` before publishing production: a possibly earlier
qualifying quarter in unresolved pre-anchor coverage is a publication failure.
The anchor is first eligibility within supplied history, not first physical use.
Discovering the required historical start is part of the separately gated backfill.

For quarter `q`, define ordinal `4 * year + quarter - 1` and
`relativeQuarter = ordinal(q) - ordinal(anchor) + 1`. Relative Year is
`floor((relativeQuarter - 1) / 4) + 1`, within-year Quarter is
`((relativeQuarter - 1) mod 4) + 1`. Never enumerate only the retained rows.

Every model has exactly one cell for each relative index from 1 through the common
`display.maxRelativeQuarter`, ordered and without duplicates. Each cell's actual
quarter follows the formula, even outside the selected snapshot. The common end
is at least `max(24, longest anchor-to-cutoff span)`. Guides sit **after** quarters
20 and 24, labeled deployment-history references; the default adjustable guide is
after 20. Short histories still expose the distance to both guides. This is model
deployment history, not each disk's physical age or a conditional survival curve.

| `state` | Eligibility / coverage | Display and inspector meaning |
| --- | --- | --- |
| `eligible` | eligible / complete | Count >= 2,000; display known metrics; an individually unavailable AFR stays null with reason |
| `below_threshold` | below_threshold / complete | Known Count < 2,000, including zero; seven display metrics null; inspector may expose known quarterly observations/components |
| `source_missing` | unknown / missing | No usable quarter coverage; null display metrics, no inferred exit |
| `source_incomplete` | unknown / incomplete | Partial source coverage cannot establish eligibility; null display metrics, partial inspector components explicitly incomplete |
| `snapshot_end` | not_yet_observed / outside_snapshot | Quarter is after cutoff; null observations, metrics and components; never an exit |

Below-threshold cells say **Below comparison threshold; some drives may remain**.
Missing/incomplete cells and snapshot-ended cells require distinct labels or
patterns and keyboard-accessible explanations. Neither a null nor a workbook
blank is numeric zero. Known absence under complete coverage may produce real zero
observations; it remains below-threshold rather than an eligible zero metric row.

Eligibility is reevaluated every complete quarter. A qualifying model can exit
and reenter any number of times; reentry uses its original anchor. `finalEligibleQuarter`
is the latest qualifying complete quarter through the cutoff, not a permanent
retirement date. `asOfStatus` describes the cutoff quarter, independently of the
last eligible row. Coverage gaps do not restart the clock or remove the model.

## Metrics and inspector components

All public numbers are finite JSON numbers; null means unavailable or not
displayed. Counts, flags and drive-days are exact nonnegative integers, signed
population Delta is an integer, and fractional failures are invalid input.
Validate no duplicate normalized identity/date observations before aggregation;
duplicates or conflicting records fail generation rather than inflating exposure.
One validated identity/date record contributes one recorded drive-day. Exposure
is observed drive-days, not Count times calendar days or an imputed full quarter.

The seven adjacent columns remain:

| Field | Meaning and unit |
| --- | --- |
| `afr` | Cumulative failures / cumulative recorded drive-days * 365 * 100; percent (1 means 1%) |
| `afrDelta` | Current cumulative AFR minus baseline cumulative AFR; percentage points |
| `count` | Distinct normalized-model/serial identities observed at any time in the calendar quarter; drives |
| `populationDelta` | Current Count minus baseline Count; signed drives |
| `new` | Identities whose first recorded observation in supplied history is in this quarter; drives |
| `retired` | Inferred last-observed identities, including failed identities, subject to boundary rule below; drives |
| `failed` | Sum of validated daily failure flags in this quarter; flags, not deduplicated lifetime failed identities |

Count is not the installed population at quarter end; New is not a purchase count.
Delta is not `New - Retired`, and no conservation identity between these measures
is required. Report no purchase-price, availability, procurement-motive or defect
claim from these observations alone.

`quarterComponents` and `cumulativeComponents` each carry `failures`, `driveDays`
and `complete`. The model's `preEligibilityComponents` covers all supplied
observations strictly before the anchor. Cumulative components include those,
the current quarter, complete sub-threshold quarters and subsequent reentry gaps.
They never reset at eligibility. For complete coverage, cumulative totals equal
pre-anchor totals plus every subsequent quarter's totals through the current cell.
The inspector shows those components, actual calendar/relative quarter, exact
values and source/as-of context. `quarterAfr` uses only complete current-quarter
components; it supplements the main cumulative AFR.

After unresolved missing/incomplete source coverage, cumulative known sums may be
reported as partial (`complete: false`), but cumulative AFR and its Delta are null
with `incomplete_cumulative_coverage`; a sum of available quarters is not a complete
denominator. This persists until corrected coverage is rebuilt in a new snapshot.
Current complete eligible Count/New/Failed and quarter-only AFR remain visible.
Zero exposure produces null rate with `zero_exposure`, never zero, NaN or infinity.
Non-displayed metric rows use `not_displayed`. A numeric cumulative AFR has null
`rateUnavailableReason`.

## Delta baseline decision

**Proposed production choice: retain the previous eligible complete row as both
delta baselines**, matching reference values while keeping real calendar offsets.
The alternative of a previous-calendar-quarter baseline would create unavailable
deltas after exits and change retained-row values; it is not this version's rule.

First eligible row subtracts explicit zero for AFR and Count. Its baseline is
`initial_zero`, prior quarter and elapsed span null, baseline AFR/Count zero. Label
its Delta **Initialization from zero**, not deterioration or new deployments.
Later eligible rows use `prior_eligible`, the actual prior eligible calendar
quarter, the calendar-quarter distance, and that row's AFR/Count. Even if the prior
AFR is null, the prior Count remains the Count baseline; do not search farther back
for a convenient available rate. If either rate is unavailable, AFR Delta is null.
The `unavailable` baseline kind is reserved for validation/diagnostic artifacts;
it is not valid on a publishable eligible production row.

For adjacent rows, label Delta **Change since 2025 Q1 (1 quarter)**, for example.
After a gap, label it **Change since 2025 Q1 (3 quarters)**. Never present a
multi-quarter change as quarter-over-quarter, divide it into an invented quarterly
rate, or treat a hidden sub-threshold Count as the retained-row baseline.
Unavailable rows have null `deltaBaseline`.

Acceptance examples (synthetic, not historical fleet assertions):

- 2024 Q1 Count 2,100 / AFR 1.0 anchors relative 1; 2024 Q2 Count 2,200 / AFR
  1.2 is relative 2, with deltas +100 and +0.2, prior 2024 Q1, span 1.
- Then 2024 Q3 Count 1,900 is below threshold at relative 3, with null display
  metrics. 2024 Q4 Count 2,300 / AFR 1.3 reenters at relative 4, with deltas
  +100 and +0.1 against 2024 Q2, span 2. Include Q3 exposure/failures in Q4 AFR.
- If Q3 is instead source-missing, Q4 Count and its +100 Delta remain known;
  cumulative AFR/Delta are null, and partial cumulative components declare the gap.
- MG08ACA16TA's reference first row has cumulative AFR about 3.570% and current
  Failed zero. Production must expose the pre-eligibility failures/exposure; it
  must never attribute the entire cumulative rate to that displayed quarter.

## As-of retirement inference

Compute lifecycle first/last observations only from the selected normalized source
population at or before cutoff, across all supplied quarters, including those
below threshold. `coverage.newestObservationDate` is that population's global
maximum observation date and is the legacy **observation boundary**, distinct from
the calendar cutoff. It must fall within validated source coverage and cannot
precede any selected model's known positive-population quarter. It can be earlier
than coverage `observedEnd`: a validated last-day partition may contain no selected
models. The generator verifies this maximum against private selected observations;
aggregate coverage dates alone cannot prove it.

For a non-newest calendar quarter, Retired counts identities whose as-of `last_seen`
is in that quarter and strictly before that global observation boundary. Include
failed identities; do not add Failed again. Use `last_seen_before_boundary`.
The selected as-of calendar quarter uses **Retired = Failed**, with
`newest_quarter_failed_proxy`, rather than claiming confirmed departures. It is
provisional even when source coverage is complete. A globally absent cutoff
quarter is a source gap, not a substitution of the latest older quarter.

This proxy counts daily failure flags, so it can exceed the quarter's unique
Count when one identity has failure flags on multiple days. Retain that reference
rule and label it a failure-flag proxy; do not claim that many distinct drives
retired. The Count bound applies to historical inferred last-seen identities,
while failure flags and the cutoff proxy are bounded by recorded drive-days.

If unresolved source coverage between a candidate last observation and the
boundary prevents trustworthy last-seen inference, Retired is null with
`unavailable`; Count/New/Failed can remain known. Missing coverage is not evidence
of retirement. Below-threshold inspector observations may retain a known inferred
Retired value, but the seven display metrics stay null and inference status is
`not_applicable` to that displayed row.

Later observations can revise earlier inferred Retired counts in a later snapshot.
Preserve the old values in the old snapshot. Last-seen inference is an investigation
signal, not proof of voluntary retirement, manufacturer action or a causal defect.

## Shared color domain and deterministic rendering

Use all numeric **eligible display cells**, across every historically qualifying
model in the selected as-of snapshot, for each metric's separate domain. Include
initialization deltas and known zeros. Ignore nulls, unavailable cells, future
cells and sub-threshold inspector numbers. A missing AFR does not exclude that
row's known Count from Count's domain. Filtering/pinning/neutral-color mode never
recomputes the domain. Different snapshots may produce different colors for an
unchanged number; the selected snapshot and legend explain the scope.

Store sample count, observed minimum, median and maximum, plus effective numeric
knots/colors for all seven metrics in `colorScales.domains`. The inclusive 50th
percentile sorts values ascending and interpolates at `(n - 1) * 0.5` (zero-based);
an even sample's median is the mean of its two middle values, not midrange.
Use unrounded values to form scales and interpolate. Green `#00FF00`, yellow
`#FFFF00`, red `#FF0000`, white `#FFFFFF` preserve the reference palette.

| Metric | Ordinary effective knots |
| --- | --- |
| AFR | observed min green, fixed 1 yellow, fixed 2 red; clamp at 2 |
| AFR Delta | minimum green, fixed 0 white, maximum red |
| Count | minimum red, median yellow, maximum green |
| Population Delta | minimum red, fixed 0 white, maximum green |
| New | fixed 0 white, maximum green |
| Retired | fixed 0 green, median yellow, maximum red |
| Failed | minimum green, median yellow, maximum red |

The following **production** edge rules remove unordered/duplicate-knot ambiguity.
Golden fixtures retain the source rule definitions; they do not pretend Excel's
unspecified edge rendering is evidence for these new policies.

1. No numeric samples: extrema/median null, no knots, neutral `#F2F2F2`; no-data
   cells retain state labels/patterns, never a low-value metric color.
2. AFR: retain the fixed 1/2 yellow/red knots. Add the observed minimum green only
   when it is strictly below 1. If every AFR is >=1, no green endpoint is invented.
   Values at/above 2 are red. A singleton 0 remains green; singleton >=1 follows
   the fixed scale.
3. Signed deltas: extend observed endpoints to include zero. Keep only a negative
   minimum and/or a positive maximum, around fixed zero white. An all-positive
   population has white-to-high only, all-negative low-to-white only; all-zero
   is white. Initialization remains visibly labeled despite its color.
4. Count/Failed: with distinct min/median/max, use the ordinary rule. If min=median
   or median=max, merge the duplicate at its median color yellow. If all values
   are equal, use one yellow knot; all-zero Failed is instead one green knot.
5. Retired: zero is always green. When median=0, omit the duplicate yellow knot
   and interpolate zero-green to positive-max-red. If median=max>0, merge that
   duplicate at yellow. All-zero Retired is green. New all-zero is white.
6. Piecewise interpolate linearly in encoded sRGB channel values between ordered
   distinct knots; round each final channel to nearest integer, exact half upward.
   Exact knots use their stored colors. Values outside the knot range clamp to
   the nearest endpoint. A single knot assigns its color to all numeric samples.

Store the resulting ordered, distinct knots, not an invalid zero-length interval.
Show numeric values and units, a legend, accessible focus/detail text and a neutral
color option. Vendor header colors (Seagate `#6EBE49`, Toshiba `#CC0000`, WDC/HGST
`#00529F`) are category labels, never reliability scores. No composite score,
automatic ranking, cliff detector or replacement prediction is defined.

## Immutable publication and validation

Each snapshot ID and immutable path identify one complete validated generation.
Record generation time, as-of cutoff, selection/normalization/metric/color versions,
coverage, source lineage and a revision predecessor where applicable. Identical
cutoff with corrected sources or semantic versions creates a new ID/path; never
overwrite a published snapshot. Build and verify all artifacts and checksums under
new immutable paths before switching the small latest/index reference atomically.
Index default selects the newest fully validated generation, not partially written
files. Switching snapshots switches data and color domains together.

Public source links use HTTPS without credentials, query parameters or fragments;
never expose signed URLs. Immutable delivery paths are relative public paths,
without absolute local paths or parent-directory traversal.

The schema rejects unknown fields and constrains shapes, finite number types,
allowed state labels and noneligible null display metrics. JSON Schema does not
prove cross-field arithmetic, dates, uniqueness by ID, source completeness or
privacy. The generator's separate semantic validation must also verify:

- Validated complete source history for anchors, complete/absent partition claims,
  no post-cutoff input, unique model/source IDs and defined source-ID references.
- All historically qualifying models retained; first/final qualifying quarters,
  Count threshold/state consistency, as-of status and original-anchor reentry.
- Exact common row extent, calendar offsets, ordered quarter coverage and dates,
  real quarter day counts, cutoff boundary and accessible 20/24 guide metadata.
- Integer component reconciliation, cumulative pre-eligibility retention, rate
  formulas, null propagation, prior eligible baselines/spans and lifecycle boundary
  inference/proxy status. Reject NaN/infinity and raw identity/credential leakage.
- Shared domains/percentile/effective knots recomputed from numeric eligible cells;
  filters do not enter this calculation. Verify empty, singleton, all-equal,
  zero-only, tied medians, all-positive/all-negative deltas, AFR minimum >=1 and
  values >=2 explicitly.
- Exact integer parity for legacy fixtures, floating-point parity with relative
  and absolute tolerance `1e-10`, and no substitution of rounded display strings
  into calculations. Synthetic gap-free/gap/reentry cases validate the production
  time and delta decisions separately from legacy retained-row fidelity.

Use strict JSON parsing with duplicate-key rejection and JSON Schema Draft 2020-12
with date/date-time format checking. Passing structural validation alone is not
permission to publish. Owner acceptance of this contract precedes dependent #0015
and #0016 implementation; #0017 retains its separate resource/backfill gate.

The reproducible [synthetic fixture cases](../fixtures/matrix/README.md) exercise
these rules separately from the [legacy workbook evidence](flagship-workbook-fixtures.md).
Run the locked Python suite from the repository root:

```powershell
uv run --frozen python -m unittest discover -s tests
```

The aggregate validator checks internal consistency, including source-row exposure
budgets per quarter, at anchor prefixes and across the snapshot. It cannot prove
daily inputs, source hashes, earliest qualification or private lifecycle inference.
Those remain generator acceptance checks, even when every golden fixture passes.
