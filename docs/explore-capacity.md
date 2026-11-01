# Explore total capacity

The capacity report (#0091) reads only the accepted public v2 snapshot descriptor
and supporting quarter artifacts through `SnapshotLoader`. It loads the complete
chronological series through the as-of cutoff, including descriptor-only missing
and unpublished quarters. Calendar-quarter selection highlights the corresponding
point and row without changing the historical scope. Model and vendor filters do
not narrow this report: it uses `all_supplied`, including HDD, SSD and unclassified
identities.

`CapacityHistoryReader` fetches at most four supporting quarters concurrently per
load. It caches only a completed immutable history under its descriptor context,
source manifest and referenced quarter graph. Abort checks guard both cache hits
and late responses. Failed or canceled loads cannot publish a partial history;
accepted individual artifacts remain reusable through the shared loader.

The chart plots complete quarters with available capacity, breaking lines at
missing, unpublished, partial or invalid-capacity quarters and calendar gaps.
Complete zero observations remain zero. The full chronological table and CSV
retain coverage, drive count, decimal TB capacity, delta, delta reason and coverage
reason. Nulls are explicitly `Unavailable` in the table and CSV; known
counts remain available when nominal capacity is unknown.

Nominal capacity follows the [accepted v2 contract](production-data-v2.md): each
model's positive finite daily-observation capacity mode through the snapshot
cutoff, ties choosing the smaller byte capacity, multiplied by quarterly observed
identities. Display uses decimal TB/PB/EB: 1 PB = 1,000 TB and 1 EB = 1,000,000 TB.
It does not measure utilized capacity, customer storage or quarter-end installed
stock. No event or causal overlays are inferred.

Capacity Delta comes from the accepted supporting payload and is shown only for
an immediately preceding comparable complete calendar quarter. It is never
recomputed against an earlier available point across a gap. First quarters,
incomplete coverage and invalid-capacity predecessors retain null with the
producer's reason.

Focused tests in `web/src/capacity-report.test.ts` exercise zero and unavailable
values, line gaps, selected-quarter emphasis, payload deltas, CSV parity,
cancellation, completed caching and bounded concurrency. They also validate all
three committed real snapshot histories through the shared loader, without raw
data access or cache generation.
