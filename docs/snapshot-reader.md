# Shared snapshot reader and model context

#0088 implements the browser reader for the owner-accepted
[production v2 contracts](production-data-v2.md). Real artifacts and individual
report integrations retain their own tickets. #0087 now makes the real matrix the
landing view. #0089 deployments and #0090 distribution use this shared shell;
the remaining capacity/manufacturer/datacenter integrations stay queued.

## Local review

Use the locked frontend environment in [code quality](code-quality.md). Open
`?view=explore&example=1` to review the shared model-context shell. Every bundled
value is explicitly fictional. Examples cover a context-only seed, a new vendor,
partial coverage, missing/unpublished periods and the datacenter-field boundary.
Exact fixture bytes remain unchanged.

The non-example route, `?view=explore`, reads `data/production/index.json` beneath
the application base. #0086 supplies the [real aggregate release](production-release.md)
for 2026 Q2 and the two workbook cutoffs. A missing index produces an error/retry
state and an explicit example link; the
reader never substitutes fictional values for a missing real dataset. Navigation
links connect the real matrix, deployments, distribution and shared context.
Other quarterly report links retain their existing implementations.

## Reader API and boundaries

`SnapshotLoader` in `web/src/snapshot-loader.ts` reads one immutable index per
instance. `loadIndex` returns advertised snapshots; `loadDescriptor` (also named
`loadSnapshot`) loads a context. `loadQuarter` fetches only the selected quarter
and returns null for an explicitly unavailable period. `loadMatrix` loads the
separately bound matrix. Recreate the reader to discover a newly published index.
The shell does not eagerly fetch every quarter or matrix.

Readers check strict v2 structures, supported semantic versions, exact byte
hashes/lengths, immutable relative paths, snapshot/source/context bindings,
membership, coverage/null rules and aggregate arithmetic. Duplicate decoded JSON
keys, unsupported versions, unknown public fields and malformed values fail.
Producer/source validation remains responsible for upstream authenticity.

Only completed validated objects enter caches, keyed by generation and content
identity. Cached objects are frozen. Abort signals are checked after network,
byte verification and parsing work, before cache writes. The shell also uses a
monotonic selection token, clears stale rows while loading, and suppresses old
request completions. Cancellation does not poison retry or another reader.

## Interaction and export

Snapshot as-of and Explore calendar-quarter selectors are independent, with
year-first labels. Switching snapshots resets filters; a requested quarter
survives only when included in the new descriptor. Initial context includes every
supporting HDD, including seeds below the flagship threshold. Purchase and
historical presets are explicit subsets on the overview only. Deployments and
distribution always start from the whole context, independent of those presets.
Model checkboxes, vendor/model search and nullable sorting
do not change the whole-context or all-supplied denominators shown alongside.

The accessible numeric table preserves zero separately from unavailable values
and labels capacity as aggregate decimal capacity. Partial totals stay unknown;
missing/unpublished periods have no fabricated rows. Source credit, coverage,
cutoff, publication boundary and location-field availability remain visible.
Shared helpers can be reused by later report views.

CSV uses the visible rows and carries data kind, report, filters, snapshot, as-of,
reporting quarter, coverage, scope, whole-context Count/New and attribution.
Empty selections disable export. Unavailable values
remain explicit. Formula-like text, including formulas after leading whitespace,
is neutralized. Numeric negative values remain numeric. No serial field or
individual-drive selector is introduced.

DOM reconciliation preserves controls and the methodology disclosure. Search
caret/focus and sort-button focus survive rerenders. Loading and error states
have status/alert semantics; the report exposes `aria-busy`.

## Verification

Focused tests cover valid fixture graphs, invalid bytes/bindings/references,
duplicate keys, versions, nullable scopes, cancellation, retries and caches.
Selection tests cover small context populations, unknown vendors, presets,
nullable sums/sorting, URLs and safe attributed CSV. Standard web quality, tests
and production build remain required. Browser checks and independent review are
retained privately in `data/staging/0088/`; fictional examples do not certify real
production artifacts or the later specialized visualizations.
