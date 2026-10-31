# 2026 Q2 lossless repack

The #0058 repack is verified and published as the preferred private cache.
Independent local review checked **all 91 days and 31,968,003 observations**.
Daily Parquet shrank from **221,850,393 to 183,750,684 bytes**, saving
**38,099,709 bytes (17.17%)**. These are measured whole-quarter daily-object
sizes, separate from receipts, summaries and retained legacy copies. The earlier
16.8% figure concerned one day only.

The new isolated cache uses `private-parquet-rich-v1-903ee87c89e5`, including
model/serial/date clustering, bounded row groups, Zstandard, statistics, page
indexes/checksums, field descriptions and exact custom row-group NDV metadata.
The procedure preserved every original partition, receipt and summary variant.
It compared every typed logical row across all six columns, including nulls,
duplicates and raw model names. Original-file before/after SHA-256 inventories match.

Only this quarter's summary was rebuilt from the repacked Parquet. Both drive
and capacity summaries have exact typed multiset parity with the old enriched
summary: **359,101 model/serial identities**, **1,522 failure flags**, and
**31,968,003 drive-days**. Capacity-frequency observations and per-model
identity/failure/exposure aggregates match. Guarded warm reuse succeeded while
daily DataFrame reads and scans were forbidden; byte hashing remained allowed.
No CSV/ZIP reparsing, historical rescan, normalization change or public matrix
generation was performed.

The first attempt completed all daily rewrites and the new summary, then stopped
on an overly broad equality check of model metadata snapshots. Exactly two raw
models, `ST8000DM002` and `ST8000NM0055`, had newer HDD classification evidence
in the current registry: only `mediaClass` and `classificationEvidence` changed.
Raw names, vendor/model numbers, canonical IDs and seed
flags were unchanged. A separately reviewed read-only resume validated that
bounded metadata drift against the registry, repeated all 91 full daily parity
checks, compared both summary frames, checked original-object hashes and proved
the guarded warm hit. The failed attempt and its evidence remain preserved.
This was an interrupted attempt plus validation resume, not one uninterrupted
end-to-end timing measurement. Execution used two Polars threads and a sampled
6 GiB working-set guard; sampling is not an operating-system memory quota.

The preferred processing view is **`drive-stats/cache-v2`**, discoverable through
**`drive-stats/current-cache.json`**. Its immutable catalog and SHA-256 manifests
identify one current enriched summary per quarter. For 2026 Q2, daily data plus
receipt occupy **184,278,429 bytes** and its single summary variant occupies
**2,553,233 bytes**. The preferred view omits the legacy Q2 summary duplicates;
the original **`drive-stats/cache-v1`** data, summary variants and recovery
manifest references remain intact. Publication made no writes to the old prefix
and performed no deletes.

The verified catalog covers **24 quarters, 2020 Q3 through 2026 Q2**:
**2,286 processing objects totaling 3,282,681,671 bytes**, excluding the catalog
and transfer manifests. Fourteen previously retained quarters used server-side
copies; nine newly ingested quarters and repacked Q2 used local uploads. Actual
object readback, a complete separate-root restore to `data/preferred-cache-v2/`
and **24 guarded restored-summary hits** succeeded before the preferred pointer
was published. The execution envelope took **363.50 seconds**; it is a cache
transfer/restore check, not an uninterrupted repack benchmark. Independent review
validated the publication candidate before the separately reviewed publisher ran.

Coverage remains **23 complete quarters and one explicit partial quarter**.
The 2022 Q4 receipt still records 91/92 days, with December 10 unavailable and
the wrong-date source member excluded. Publication neither fills that gap nor
turns known-observation totals into complete-quarter metrics. No full-history
matrix, complete lifetime anchor or public delivery generation is established
by this cache publication.

Private helper, inventories and acceptance evidence belong in ignored
`data/staging/0058/`; repacked processing objects belong in ignored
`data/repacked-2026-Q2/`. Per-drive identities and private cache files stay out
of Git. `before.json`, `after-preservation.json`, `resume-validation-start.json`
and `repack-result.json` retain hashes, exact parity checks and metadata-drift
evidence. `preferred-plan.json`, `preferred-catalog.json`,
`preferred-transfer-manifest.json`, `preferred-execution.json`,
`independent-publication-candidate.json` and `preferred-published.json` retain
the reviewed publication closure, restore checks and pointer receipt. Remote
readback is evidenced by execution; local independent review did not separately
access cloud credentials or repeat every remote read.
