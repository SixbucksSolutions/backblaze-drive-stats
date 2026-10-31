# Backward quarter audit: 2021 Q1

Localswim #0047 processed 2021 Q1 in the owner-approved workset of the
2026 Q2 repack plus nine historical quarters (#0041–#0049). Source data comes
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2021 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2021.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 889,786,067 bytes; exact official HEAD size matched |
| Valid observation calendar | 90/90 days, 2021-01-01 through 2021-03-31 |
| Observations / drive-days | 15,287,372 |
| All-source inventory | 61 normalized models from 63 raw names |
| Model/serial identities observed during quarter | 185,140 |
| Daily failure flags | 399 |
| Daily Parquet | 92,574,450 bytes |
| Import receipt | 415,964 bytes |
| Summary frames and manifest | 1,487,868 bytes |
| Retained source, projection, receipt and summary | 984,264,349 bytes; staging evidence excluded |
| First summary pass | 9.18 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.22 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The completed audit reconciles the source,
receipt and partition hashes, footer/profile lineage, numerical budgets and
summary parity. The profile is `private-parquet-rich-v1-903ee87c89e5`.
No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `e873b369e7daf05426a93101e9a35322864bfdde`.
- Local SHA-256: `4a45e454f503a9fa1d06ccb7a6dbd5ce071bf7b39e5915d2effb179c9a65a6c2`.
- Summary input identity: `0da7eaf9c897a72d37daead57f6beca5bf241b7c1fd73c6bfdd8967428445dd7`.

The inventory retains all 61 normalized source models, including
22 evidenced HDD models and 39 unclassified
models. The full private inventory preserves every raw alias, count, exposure,
failure total and classification, including populations below 2,000. Population
alone does not establish media class. These unclassified models meet the
2,000-observed-identity threshold in this quarter and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,168 | 281,692 | 5 |
| ST4000DM000 | 18,941 | 1,701,967 | 59 |
| HMS5C4040BLE640 | 12,748 | 1,146,496 | 10 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not establish
an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604** has 10,834 observed identities,
974,310 drive-days and 9 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2021-01-01 through 2021-03-31.
Quarter-only AFR is 0.337162%, calculated as failure flags /
drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

This complete quarter exceeds the 2,000-identity threshold. It establishes
neither the first observed nor the first qualifying quarter. No zero-observation
boundary, true origin, cumulative exposure, complete cumulative history or
original production anchor is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0005 | 40.61 | 0.017 |
| Projection | 0.0006 | 27.09 | 0.291 |
| Audit | 0.0010 | 12.48 | 1.991 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. The audit's first/warm pass timings
are internal portions of its command envelope, not extra phases to add to it.
Each quarter used one native worker and two Polars threads.

All nine historical audits succeeded in the coordinated 105.7669-second command
envelope. At most eight source CPU phases and seven heavy audits were admitted
simultaneously. The 2026 Q2 repack ran concurrently; global CPU/RAM measurements
include that work. This does not establish nine simultaneous heavy-audit capacity
or a controlled serial-versus-parallel speedup. All 15 protected earlier quarter
caches remained unchanged in the parent's preservation check.

Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. These measurements do not bound full-history
aggregation memory. The archive is below 2 GiB and the actual retained footprint
is below the 10 GiB additional-disk envelope. The worker's contemporaneous
footprint (984,359,901 bytes) also included staging
evidence and is distinct from the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0047/`: `audit.json` and
`.txt`, `results-summary.json`, `download.json`, `envelope.json`, sanitized
`source-head.headers`, calendar records and phase resource records. Final
reconciliation read metadata and the small retained drive summary, without
another logical daily scan. Guarded warm reuse forbade daily DataFrame reads
and scans while allowing byte hashes and small summary reads.

Fresh independent artifact review passed. Parent-coordinated B2 retention,
full isolated restore, guarded warm reuse and preferred `cache-v2` publication
also passed; see the [batch handoff](ten-item-backfill-and-repack.md). Data and
private evidence remain outside Git. Owner acceptance remains separate from
technical verification.
