# Real production v2 aggregate release

#0086 prepares real, source-backed aggregate JSON under
`web/public/data/production/`. It uses the accepted retained summaries through
2026 Q2 and the [accepted v2 contracts](production-data-v2.md). It does not
deploy the site or complete the individual report integrations. The existing
quarterly explorer and immutable workbook references remain available.

## Advertised snapshots

| As of | Retained quarter datasets | Inventory models | Supporting HDD context | Matrix analysis | Shared relative-quarter extent |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2025 Q3 | 50 | 170 | 36 | 21 | 38 |
| 2025 Q4 | 51 | 171 | 37 | 21 | 39 |
| **2026 Q2 (latest)** | **53** | **176** | **40** | **22** | **41** |

The discovery index advertises only these three validated as-of snapshots. Each
descriptor binds one matrix and an ordered calendar-quarter ledger. The combined
package contains **154 supporting quarter payloads**, three matrices, three
descriptors and one index: **161 files / 14,845,031 bytes**. A historical quarter
can have distinct payloads in different snapshots because its nominal capacity
mode and source/cohort context are bounded by that snapshot's cutoff. The five
Explore views share those scoped payloads; they do not each invent a different
population or denominator.

Every snapshot explicitly represents unpublished 2013 Q1 with no payload. The
latest spans 54 requested periods: 45 complete datasets, eight partial datasets
and that unpublished period. It retains **4,817 valid dates / 743,490,518 known
observations**. Full-quarter Count and rates remain unknown on partial quarters.
Observed-history AFR uses recorded exposure and does not establish lifetime
reliability. The [source completion record](source-history-completion.md) retains
the publication boundary and exact problematic captures.

The latest 22-model analysis follows accepted #0063 research. The earlier
snapshots contain 21: `WUH722626ALE6L4` first proves the threshold in 2026 Q1, so
that later proof cannot qualify it at an earlier cutoff. Seeded and smaller
supporting HDD models remain in context. Eight historically qualifying unresolved
media models remain flagged in inventory, outside HDD analysis; population or
model spelling is not classification evidence.

Purchase-default and historical-reference subsets are explicitly empty because
those presentation choices were not supplied by the research. They are not
inferred purchase recommendations. The shared context shell initially shows the
whole supporting HDD context; the later flagship integration retains the
presentation decision. All-supplied totals also include unresolved media.

## Generation and resource evidence

The offline producer is revision `e4940e579eeca27ec433a53dd1d7c13d99ef26df`.
The private configuration pins the accepted preferred catalog, exact summary
manifests, public evidence registry, positive seed, explicit cohort decision and
generation timestamp. It uses the preferred catalog's accepted recovery variants,
including 84/91 dates for 2017 Q2, rather than scanning legacy working folders.

All runs forbid the daily summarizer and allow Parquet reads only for the
preferred `drives.parquet` and `capacities.parquet` summaries. Each cutoff's
second run reproduces the exact index and every artifact byte. Source manifest
pins remain unchanged. No raw source download, historical daily scan, cloud
operation or private-cache write is part of this generation.

| As of | First retained-summary run | Repeat run |
| --- | ---: | ---: |
| 2026 Q2 | 6.04 s | 6.68 s |
| 2025 Q3 | 5.34 s | 5.55 s |
| 2025 Q4 | 5.83 s | 5.54 s |

These are local wall times, not cold daily ingestion or a controlled speedup
benchmark. A separate read-only latest-cutoff resource probe with two Polars
threads took **6.00 s wall / 8.19 s process CPU**, with **1.92 GiB process peak
working set**. It read 106 small summary objects, zero daily partitions and
matched all staged bytes. The peak is a process high-water measurement, not a
hard memory limit or a sum of simultaneous workers. Detailed pins, configurations,
timings and probe evidence remain private under `data/staging/0086/`.

## Verification and workbook differences

The normative Python validator checks the complete public graph. A maintained
browser-reader gate fetches every advertised artifact through `SnapshotLoader`,
checks exact hashes/lengths and generation binding, requires Backblaze data and
the exact advertised cutoff set, and rejects missing, corrupt, unadvertised or
recognizably private/synthetic files. `npm run build` runs this gate alongside
the existing legacy-data and font checks.

Fresh independent audits derive populations, failures, exposure, New, capacity
modes, thresholds, matrix arithmetic, nullable values, scopes, shares, locations
and adjacent capacity deltas from retained summaries. They cover early history
and recent cutoffs separately. No source-authenticity claim is inferred merely
from schema conformance or internal sums.

The [workbook reconciliation](production-workbook-reconciliation.md) conditionally
maps all 307 Q3 and 325 Q4 reference rows by exact Count and chronological order.
No unexplained integer-metric differences remain under that mapping. **402 Q3
and 430 Q4 AFR/AFR-delta cells remain numerically unexplained.** The references
lack source invocation and exposure metadata, so these are explicitly not
workbook-equivalence passes. The real aggregates stand on independently verified
retained source components; the unchanged workbook previews retain their own
historical values.

## Local review and reproduction

Run the locked environment and gates in [code quality](code-quality.md). The
maintained producer accepts the private, pinned config shape documented in
[historical generator](historical-generator.md). This release does not make
those private cache paths or credentials public.

```console
uv run --frozen --no-sync python tools/validate_production_v2.py web/public/data/production
cd web
npm run check:production-data
npm run build
npm run dev
```

Open `?view=explore` for the real shared model context. Snapshot as-of and Explore
calendar quarter are independent selections. Explicit fictional examples remain
at `?view=explore&example=1`. The production matrix and five specialized Explore
views still require their separately accepted integration tickets; the current
default site is preserved until that work is completed.
