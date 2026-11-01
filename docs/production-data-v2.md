# Shared production data contracts, version 2

#0084's **2.0.0** family was reviewed and accepted by Terry on 2026-10-31.
#0085 adopts it in the offline producer and #0088 supplies the browser reader;
#0086 retains the real-artifact generation gate. Published data and v1 fixtures
keep their existing behavior. This is a public aggregate contract;
its version is independent of the private processing store named `cache-v2`.

The [remaining delivery plan](remaining-delivery-plan.md) assigns implementation,
real-artifact generation and each visualization separately. The normative schema
is [production-v2.schema.json](../contracts/production-v2.schema.json); its small
fictional examples live in [fixtures/production-v2](../fixtures/production-v2/).
Neither schema conformance nor a synthetic example certifies source truth.

## Accepted decisions

The accepted v2 family makes three explicit changes:

1. Keep the supporting HDD context separate from the narrower flagship analysis
   cohort. Purchase defaults never remove supporting context or change its
   denominators silently.
2. Align a model at its **earliest proven >=2,000 quarter**, including a proven
   partial-quarter lower bound. Preserve uncertainty about an earlier crossing;
   do not label this physical drive age or first-ever deployment.
3. Add **Observed-history AFR**, explicitly calculated from recorded failure
   flags and recorded exposure. It remains useful after a past source gap without
   claiming complete history or lifetime exposure. Current partial-quarter rates
   and full-quarter population stay unavailable.

The strict [v1 matrix contract](flagship-matrix-contract.md) remains intact: its
`afr` becomes unavailable after a source gap. V2 uses different metric names and
a different rate basis. A consumer must reject an unsupported version rather
than reinterpret a v2 payload as a v1 matrix or legacy calendar-quarter bundle.

## Model populations and selection

Users select vendors and models. Serial numbers are private identities used by
the offline producer; public contracts contain no serial field, per-drive dates
or individual-drive selector.

The shared inventory records every supplied canonical model, its exact variant,
aliases, vendor, media classification and evidence. Unknown vendors and
unclassified devices stay visible in the inventory. A high population alone is
not evidence that a model is an HDD; a regex nonmatch never excludes a new vendor.

| Selection set | Meaning |
| --- | --- |
| `contextModelIds` | Every confirmed HDD with a positive seed match or an evidenced >=2,000 threshold proof in supplied history |
| `analysisModelIds` | Explicit versioned subset of context used for flagship blocks; every member needs threshold proof |
| `purchaseDefaultModelIds` | Initial visible purchase-comparison subset of analysis |
| `historicalReferenceModelIds` | Separate historical-reference subset of analysis |

The two default subsets are disjoint. Both stay within analysis, which stays
within context. A seeded HDD that never qualifies still belongs to supporting
context. Its absence from the matrix is not permission to drop its supporting
observations. Confirmed SSDs and unresolved media cannot enter the HDD comparison.

The current analysis decision preserves the 22-model research accepted in #0063.
That number is not a permanent schema constraint. A later quarterly refresh must
discover fully evidenced new qualifying HDDs, including new vendors, and admit
them through a new versioned generation; it cannot silently retain a closed
regex-only list. Earlier generations remain immutable. Changes to explicit
analysis/default/reference decisions are recorded, rather than inferred from
filter state. Deployment does not establish current manufacturing, retail stock,
NAS compatibility or a purchase recommendation.

The positive seed's as-of date describes the interest list's provenance. A later
interest list may be used for an explicitly retrospective cohort; it does not
authorize including later source observations, capacities, exposure or threshold
proof in an older as-of snapshot. Cohort context and source cutoff are distinct.

For supporting reports, `selected_hdd` means the entire context. `all_supplied`
means all valid supplied source models, including boot SSDs and unresolved media.
Those scopes may have different denominators. Matrix blocks equal analysis IDs;
supporting rows are not required to equal that narrower set. Snapshot binding
preserves the relationship explicitly.

## Source coverage and threshold evidence

Coverage enumerates calendar quarters through the as-of cutoff, including
unavailable periods. Expected days are calendar days; observed days and row
counts describe validated source partitions before model filtering.

- **Complete:** all calendar partitions validated; an exact quarterly Count,
  including zero, can be reported.
- **Partial:** some source observations are available, but the full-quarter
  Count and quarter AFR are unknown.
- **Missing:** no usable capture for a period in the declared source domain.
- **Unpublished:** the requested period precedes the published source domain;
  this is not a zero-drive observation or an empty processing dataset.

Backblaze's published observations begin on 2013-04-10. Consequently, 2013 Q1 is
unpublished and 2013 Q2 remains an 82/91-day partial calendar quarter even though
all published days were read. Seven further partial quarters contain 13
problematic in-domain capture dates: **eight partial quarters in total**. See
the [source completion report](source-history-completion.md).

Each model's ledger distinguishes `quarterCount` from
`knownIdentityLowerBound`. The latter is the exact number of distinct identities
in retained observations and a lower bound on the unknown full-calendar Count.
On complete quarters they agree. On partial quarters Count remains null.

A lower bound of 2,000 proves the threshold was met, even if a day is missing.
A lower bound of 1,999 proves neither subthreshold status nor absence. Zero known
components for missing/unpublished periods mean no recorded components to add;
they do not imply zero actual drives, failures or exposure.

The ledger separately derives first recorded observation, first proven threshold
and first complete qualifying quarter. `reportingAnchorQuarter` uses the first
proof. Earlier unavailable coverage leaves `earlierQualificationNotExcluded`
true; a preceding known-zero quarter alone is not a global-inception certificate.
Completeness and search claims must be derived from the ledger, never set to
true unconditionally. Lifetime exposure is not established by this source.

Relative quarter is the calendar-quarter ordinal minus the reporting anchor's
ordinal plus one. Gaps, below-threshold periods and reentry consume positions.
A partial anchor can therefore be a null first row followed by an eligible
complete row at relative quarter 2. Reentry never resets the clock.

## Rates, deltas and lifecycle meaning

The seven display metrics are `observedRecordedAfr`,
`observedRecordedAfrDelta`, Count, population Delta, New, Retired and Failed.

`observedRecordedAfr = cumulative knownFailures / cumulative knownDriveDays * 36500`

The percent is annualized using 365 days. One validated identity/date record
contributes one recorded drive-day. Include all recorded pre-anchor and
subthreshold exposure through the cell's cutoff; do not reset components after
gaps or reentry. A zero denominator yields null. Six numerator units over 100,000
recorded drive-days yield 2.19% in a fictional example: those units are flags in
`2.0.0` or quarterly distinct failing-identity counts in `2.1.0`.

The public label and rate basis identify the declared calculation convention
(specified below). It is a ratio over recorded observations, not
an estimate of individual-drive survival or an assertion that missing days are
representative. Source-completeness limitations travel with the value.
`completeHistoryAfr` is null unless required source history through that cell is
complete. A later gap cannot change the completeness of an earlier cell.
Lifetime completeness stays false for these contracts.

On a current partial/missing/unpublished cell, all seven displayed metrics and
quarter AFR are null. Known components and threshold proof remain inspectable.
Complete below-threshold cells also have null display metrics while preserving
their known observations. Future padding is `snapshot_end`, with no invented
observations or components. The grid still reaches relative quarter 24 and any
longer observed history.

Both deltas use the previous eligible complete row at the same rate basis, with
its actual calendar quarter and elapsed distance. The structural
`contractVersion` remains `2.0.0`. `context.versions.rate` identifies the matrix
calculation convention for **both** Count and AFR deltas:

- `2.0.0` preserves the established policy of initializing both first eligible
  deltas to zero. Existing immutable artifacts keep that meaning.
- `2.1.0` follows the original Python XLSX: first Count Delta equals Count and
  first AFR Delta equals AFR, subtracting a synthetic zero baseline. This zero
  is not an earlier observed quarter; baseline quarter/distance remain null.
  Terry's explicit 2026-11-01 exception to the original flag-summing calculation
  also deduplicates Failed **per model/serial/quarter** and uses those same
  quarterly distinct counts for the AFR numerator. Multiple failure days count
  once in a quarter. A serial flagged in two different quarters counts once in
  each; cumulative AFR sums quarterly counts, not lifetime-unique serials.

`knownFailures` and `cumulativeKnownFailures` carry the versioned numerator:
daily flags in `2.0.0`, quarterly distinct failed-identity counts in `2.1.0`.
The new version bounds each quarter's `knownFailures` by its
`knownIdentityLowerBound` (and exact Count on complete coverage). Both complete
and partial recorded components use this basis. The recorded drive-day
denominator, threshold, cohort, anchor and gap/null policies are unchanged.
Terry's additional 2026-11-01 Retired refinement applies to `2.1.0`: count unique
model/serials observed in the quarter whose final recorded observation is in
that quarter, provided it is before the selected snapshot quarter. There is no
global latest-observed-date exclusion. Failed identities are included, so
Retired and Failed can overlap. This describes last recorded observations,
not a confirmed physical exit or its cause.

For eligible terminal cells, Retired is null with `retiredReason: right_censored`;
there is no terminal zero or Failed proxy. Explicit gap-obstructed inference
remains null on earlier cells. Version `2.0.0` preserves its global latest-date
exclusion and selected-cutoff Retired = Failed flag proxy exactly.

The `2.0.0` matrix keeps `rateBasis: observed-recorded-exposure-v2` and label
`Observed-history AFR`. The `2.1.0` matrix requires
`rateBasis: observed-quarter-distinct-failed-identities-recorded-exposure-v2.1`
and label `Observed-history AFR (quarterly unique failures)`. Validators reject
a basis/label that disagrees with the context calculation version. Inspector
components and help use the same versioned units.
`deltaReason: initialized` means apply the convention declared by `versions.rate`.
Readers and validators accept these two versions explicitly and reject others.
An unavailable baseline rate is not skipped to find a convenient older value.
A multi-quarter difference is not labeled quarter-over-quarter.

`production_history.generate` and its direct JSON configuration default new
output to calculation version `2.1.0` (`matrix_calculation_version` in Python,
`matrixCalculationVersion` in JSON). New snapshot identity includes that chosen
version. Explicit `2.0.0` retains the original identity recipe and arithmetic.
The refresh workflow preserves the baseline convention unless the refresh
configuration explicitly requests a supported change; see
[quarterly refresh](quarterly-refresh.md).

New means first **recorded** observation in supplied history, including the
initial observed fleet. Gaps and the publication start limit its interpretation
as an installation date. Retired uses the versioned last-observed rules above;
source gaps that obstruct inference make it unavailable. Retired includes failed
identities; it does not establish a non-failure retirement cause. Failed and the
AFR numerator follow the shared versioned basis above. No conservation identity equates
population Delta with New minus Retired.

The accepted single display guide defaults to **after relative year 6**, after
that year's Q4, with choices 1–6. Numeric text, accessible colors, shared metric
color domains and reference-preview behavior are preserved by the UI tasks;
vendor color remains a category cue rather than a reliability judgment.

## Supporting quarter payloads

Model, manufacturer and scope totals reconcile under the selected context and
all-supplied populations. Full-quarter totals and shares stay null on partial
source coverage; missing/unpublished periods have descriptor metadata and no
synthetic supporting dataset. Complete zero observations remain distinct.

Nominal capacity uses each model's positive finite daily-observation capacity
mode through the snapshot cutoff, with ties choosing the smaller byte capacity.
Capacity is that nominal value times quarterly observed identities, in decimal
TB; presentation may convert to PB/EB. No future observation can affect an older
as-of generation. A positive population with unavailable nominal capacity makes
the affected capacity total unavailable, while known counts remain available.

Capacity Delta compares only the immediately preceding comparable complete
calendar quarter. First, missing, partial or invalid-capacity predecessors yield
null plus a reason. Never bridge gaps or call this new-drive capacity, utilized
space or customer uploads.

Manufacturer population, New and capacity shares each use their own whole-context
denominator. Zero/unavailable denominators yield null. UI filters disclose their
effect and cannot silently relabel a subset share as the whole context.

Datacenters use all supplied identities, assigning each once to its last
observed location in the quarter. Unknown stays in totals and denominators.
Before 2023 Q3 the source field is unreported, so location remains Unknown;
the chart explains unreported locations instead of zero capacity or flat growth.

New generations also mark modern captures unavailable when the checksum-bound
import receipt proves the datacenter field absent. Present all-null fields remain
available. Per-file header evidence resolves mixed captures: any captured presence
makes the field available while missing observations remain Unknown. The receipt's
top-level flag means all files supplied the header and is not copied blindly.
A false top-level flag proves absence for a single captured file; for multiple
files it can describe mixed headers and requires further evidence to prove absence.
Contradictory or incomplete evidence rejects generation, as does unavailable
metadata paired with known locations. For legacy receipts without header metadata,
known retained locations prove presence; modern all-Unknown summaries require
captured header evidence before a new generation can proceed. They cannot prove
absence rather than present nulls. Cold and retained generation use the same
evidence; summary cache identities and existing immutable releases remain unchanged.
Known-location population share is zero for positive all-Unknown population and
null for zero/unavailable population. This does not measure customer demand.

## Transport, privacy and validation

A generation index binds an immutable descriptor by exact byte hash and length.
The descriptor binds a shared snapshot context, one full matrix file and ordered
calendar-quarter supporting files. Matrix and quarter files carry the same
context digest and snapshot/cutoff identity. The context excludes payload
references, avoiding a circular descriptor/payload hash dependency.

Readers validate the index, descriptor, referenced bytes and binding tuple before
switching generation. Content hashes apply to exact file bytes; reserializing
JSON is not file verification. Context digest serialization is fixed by the
validator and schema examples: sorted keys, compact separators, ASCII-escaped
strings, finite JSON numbers and UTF-8 bytes. This is the producer's versioned
serialization rule; it is not a claim of RFC 8785 canonicalization. A client
compares that binding token after verifying the descriptor's exact bytes, without
reserializing its parsed JSON to verify a file hash. Mixed snapshot, source, selection or semantic
versions fail validation. Quarter selection uses cached immutable metadata and
fetches the selected supporting payload; it is separate from matrix as-of
selection. Only validated available snapshots are advertised.

References are relative immutable JSON paths with hash/size metadata. Reject
traversal, absolute/private paths, credential URLs, duplicate keys, nonfinite
numbers and unknown public object fields. Carry Backblaze credit and public
dataset links with the generation and its exports. Source data and branding
retain their own rights; project MIT licensing does not replace them.

Schema and semantic checks verify membership, ledger ordering, proofs, arithmetic,
coverage, elapsed positions, unavailable values, scope sums, shares, deltas and
exact byte bindings. They cannot authenticate upstream evidence or classify a
drive from its model spelling. The producer and independent source/data review
remain responsible for source authenticity, canonical aliases, capacity modes,
duplicate identity/date rejection and lifecycle evidence. No serial or private
path may be embedded in a free-text field to evade structural validation.

## Migration and handoff

V1 fixtures and validators remain available for their original meanings. V2
fictional fixtures demonstrate a context-only seed model, off-seed/new-vendor
HDD admission, partial threshold proof, gaps/reentry, observed rate arithmetic,
explicit location availability and byte-bound generation pairing. They are
samples, not the accepted real 22-model cohort or a published production matrix.

#0085 applies the accepted rules to the generator and retained summaries. #0086
produces and independently validates the real 2026 Q2 artifacts and available
calendar-quarter payloads. #0088 implements the reader; the flagship and each
Explore ticket implement their own reviewed data presentation. Existing live
data, legacy readers and the private B2 processing catalog change only under
those later scoped tickets.

Validate the fictional graph and its contract regressions with the locked environment:

```console
uv run --frozen --no-sync python tools/validate_production_v2.py fixtures/production-v2
uv run --frozen --no-sync python -m unittest discover -s tests -p test_production_v2.py
```
