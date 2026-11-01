# Explore model deployments

The model deployments report (#0089) reads the accepted immutable v2 supporting
quarter selected by the shared Explore snapshot reader. Snapshot and reporting
quarter remain separate selections. It uses `selected_hdd`, the entire supporting
HDD context, rather than the flagship analysis or purchase-default subset.

`new` is presented as **first recorded additions**: canonical drive identities
first observed in supplied history during that quarter. The initial observed
fleet is included. Backblaze's publication start, 10 April 2013, left-censors
earlier installation history; source gaps may delay a first recorded observation.
The measure does not prove a physical installation date, procurement motive,
current availability or purchase recommendation.

The report retains seeded HDDs that never reach 2,000, historical models,
subthreshold observations and evidenced new vendors. It imposes no legacy
500-addition display minimum. Explicit vendor/model filters narrow the rows;
whole-context and filtered totals remain distinguished by the shared shell.

The chart previews up to eight models ordered by additions descending, then
stable model ID. A visible disclosure identifies this limit and directs readers
to the full sortable table and same-row CSV. Numeric labels accompany the bars;
the decorative tracks are hidden from assistive technology. Chart ranking never
changes table membership, exports or totals. Zero values remain measured zero;
null values remain unavailable and never contribute a synthetic zero to totals.
Unavailable quarter coverage suppresses the chart, even if stale numeric input
were accidentally supplied. Complete empty filters and complete zero additions
have explicit, distinct messages.

## Resolving the legacy lifecycle request

The accepted [v2 contract](production-data-v2.md) supplies model Count, New and
nominal capacity in supporting quarter rows. It does **not** supply a
last-observed or Retired column for this report. The implementation explains this
absence rather than deriving retirements from differences in quarterly Count,
using the flagship matrix's narrower cohort, or inventing a supporting metric.
Count is quarterly observed population, not a quarter-end installation census;
population change cannot establish New minus Retired.

## Verification

`web/src/deployment-report.test.ts` checks independent arithmetic, top-eight
ordering, null/zero/empty coverage, retained context/filter behavior and safe
vendor/model markup. It also reads and validates the committed accepted real
2026 Q2 generation graph, reconciles selected additions against its scope total,
and renders that selected supporting payload. No source download, regeneration,
private cache scan or public artifact modification is needed.

The shared Explore integration owns URL selection, controls, coverage/source
context, full table sorting, CSV attribution and responsive styling. Independent
integrated release validation remains #0094's separate gate.
