# Backward quarter audit: 2024 Q2

Localswim #0034 successfully processed this quarter in the owner-approved
eight-quarter batch (#0033–#0040). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2024 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2024.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,020,665,037 bytes; exact official HEAD size matched |
| Calendar | All 91 days, 2024-04-01 through 2024-06-30 |
| Observations / drive-days | 26,022,269 |
| All-source inventory | 80 normalized models from 81 raw names |
| Model/serial identities observed during quarter | 295,996 |
| Daily failure flags | 1,230 |
| Projected daily Parquet | 150,454,691 bytes |
| Summary frames and manifest | 2,170,324 bytes |
| Download | 46.80 seconds |
| Projection | 44.69 seconds; sampled process-tree peak 0.37 GiB |
| First summary pass | 10.05 seconds; summary-cache miss |
| Guarded summary reuse | 0.15 seconds; cache hit |
| Whole audit | 13.16 seconds; sampled process-tree peak 3.13 GiB |
| ZIP, committed daily Parquet/receipt and summary frames/manifest | 1,173,836,531 bytes; excludes private evidence |

Counts describe identities observed anywhere in the quarter, not quarter-end
installed populations. All source models remain in inventory: 29 match the
known-HDD seed, 2 have explicit HDD evidence, and 49 remain
unclassified. Population alone does not establish media class.

## Qualifying unclassified candidates

Both candidates below meet the 2,000 observed-identity threshold. They remain
visible for explicit historical classification work; the frozen ingestion
registry and cache bytes were not rewritten.

| Model | Observed identities | Drive-days | Failure flags | Quarter-only AFR |
| --- | --- | --- | --- | --- |
| ST4000DM000 | 5,805 | 292,534 | 58 | 7.237% |
| HMS5C4040BLE640 | 10,226 | 898,707 | 7 | 0.284% |

## Source identity and acceptance evidence

The official HTTPS HEAD advertises `x-bz-content-sha1=none` and supplies no
large-file SHA-1. **Publisher checksum verification was unavailable.** The
exact advertised size, local hashes, ZIP calendar validation and importer
member CRC checks provide retained integrity evidence. Local hashes do not
constitute a publisher checksum comparison.

- Local SHA-1: `0a7d77367d00a5b739a3b722774330d5199b983c`.
- Local SHA-256: `3fb91aeb4f6e19ea5be53ba87d1e077a250f4fc476c3b42a4973432cd4d54155`.
- All 91 expected daily members were present, with no duplicate, missing
  or unexpected calendar days.

The unchanged source ingestion, projection and quarter audit pipeline completed
successfully. The audit reconciled source/receipt and partition hashes, calendar,
footer/profile lineage, numerical budgets and summary parity. Its guarded warm
pass was a cache hit with daily DataFrame reads/scans forbidden; byte hashes and
small summary reads remained permitted. No CSV was extracted to disk. The archive
remained below the 2 GiB acquisition cap.

Private evidence is retained under ignored `data/staging/0034/`: `envelope.json`,
`source-head.headers`, `download.json`, `calendar-preflight.json`, `audit.json`
and `.txt`, phase resource samples and `results-summary.json`. Report
reconciliation reads receipts and the retained small quarter summary, without
another logical daily scan. Fresh independent artifact review is a separate
handoff gate; this report does not claim that review is complete.

## Exact reference model and backward-search boundary

**HUH721212ALN604** has 10,698 observed identities,
957,573 drive-days and 188 daily failure flags. Its sole observed
raw alias is `HGST HUH721212ALN604`, with observations spanning
2024-04-01 through 2024-06-30. Quarter-only AFR is
about 7.166%, calculated as failures / drive-days × 365 × 100. It is
classified as HDD through the retained positive seed evidence. ALE variants
remain separate SKUs.

The exact model exceeds the 2,000-identity threshold in this complete quarter,
so backward search continues. Neither its first observed quarter nor its first
qualifying quarter is established. This is not a complete zero quarter. The
audit establishes neither global inception nor cumulative exposure, and makes
no original-anchor or production-matrix claim.

## Batch and measurement limits

The batch launched eight pipelines and completed seven quarters. The 2022 Q4
pipeline failed validation because its December 10 member contained December 11
row dates. Other workers continued after early barrier release. The measured
107.60-second batch envelope includes that failure and seven successes; it is
not an eight-quarter completion benchmark and establishes neither eight-audit
overlap nor eight-quarter capacity. Previously retained local baselines remained
unchanged under the parent-coordinated preservation check.

This quarter used one worker and two Polars threads. Phase command envelopes
include launch/import/cleanup overhead. The first summary pass was cold only
for the summary cache; the operating-system cache was not flushed. Process-tree
working-set samples, taken approximately every 0.25 seconds, can miss brief
peaks. These observations establish no controlled serial speedup or full-history
aggregation limit. Data and private evidence remain outside Git; private B2
retention is a separate parent-coordinated step after artifact review.

## Final verification

Fresh non-author review passed all daily partition hashes/footer/lineage checks,
three complete independently parsed CSV-day multisets, summary budgets and
guarded warm reuse. All 679 previously accepted baseline files remained
unchanged. Evidence is retained in this card's ignored `independent-review*` files.

The processing files and recovery manifest are retained in B2; readback,
zero-write reuse and a separate restore were verified. Independent local
source/restore hashes and guarded restored-summary hits passed. See the
[eight-quarter retention report](eight-quarter-benchmark.md) for the first
packet's failed restore and successful explicit resume, the second packet
and the separately qualified capacity probe. No new production matrix or
original-anchor claim follows from this audit.
