# Explore model distribution

The production Explore **Drive mix** view reads the selected immutable snapshot's
supporting calendar-quarter payload. It shows distinct drive identities observed
anywhere in that quarter, rather than quarter-end installed stock. It does not
estimate market share, shipments, current retail availability or reliability.

The initial selection retains the entire selected-HDD context: seeded models,
models below 2,000, historical models and evidenced discovered vendors. AFR matrix
eligibility does not filter this report. Vendor/model filters apply to the chart,
summary, complete model table and CSV together. Whole-context and all-supplied
totals retain their separately labeled scope in the shared explorer.

The chart ranks the largest eight filtered models by exact observed count, using
stable model IDs to break ties. It discloses the model limit and keeps every
filtered model in the table and CSV. Exact numeric labels accompany the bars;
bar lengths use the largest displayed count, not a population-share denominator.
There is no subset percentage presented as a whole-context share.

Complete-quarter zero counts remain measured zero. Null counts remain
unavailable, rank after measured counts and do not produce zero-length bars.
Incomplete-quarter coverage does not produce a full-quarter population chart.
Missing/unpublished quarters retain the shared explorer's coverage explanation
without fabricating rows. Empty filters show an explicit no-match state.

`web/src/distribution-report.test.ts` checks independently calculated counts,
vendor reconciliation, ranking, truncation, null/zero cases, filter consistency,
escaping and the immutable real production payloads. Integration uses the shared
snapshot reader, filter controls, all-model table and attributed CSV export; the
report does not regenerate or alter source artifacts.
