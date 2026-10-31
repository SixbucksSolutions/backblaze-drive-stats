# Backward quarter audit: 2020 Q4

Localswim #0048 processed 2020 Q4 in the owner-approved workset of the
2026 Q2 repack plus nine historical quarters (#0041–#0049). Source data comes
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2020 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2020.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 866,123,519 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2020-10-01 through 2020-12-31 |
| Observations / drive-days | 14,631,135 |
| All-source inventory | 58 normalized models from 59 raw names |
| Model/serial identities observed during quarter | 171,895 |
| Daily failure flags | 404 |
| Daily Parquet | 88,726,028 bytes |
| Import receipt | 425,116 bytes |
| Summary frames and manifest | 1,437,299 bytes |
| Retained source, projection, receipt and summary | 956,711,962 bytes; staging evidence excluded |
| First summary pass | 9.79 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.14 seconds; cache hit |

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

- Local SHA-1: `be10ddef5c8c369d4ce6cd1ae1d0c7ad5768e9ed`.
- Local SHA-256: `7822c824c600ea403a9b79e05824bb55b8bb547ddb27e9b368aeed3d0b7ffbb9`.
- Summary input identity: `0d812634beb78dfacd83f9b0a96494f35580a13e07809967753f9d5fa57ec377`.

The inventory retains all 58 normalized source models, including
21 evidenced HDD models and 37 unclassified
models. The full private inventory preserves every raw alias, count, exposure,
failure total and classification, including populations below 2,000. Population
alone does not establish media class. These unclassified models meet the
2,000-observed-identity threshold in this quarter and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,104 | 281,844 | 3 |
| ST4000DM000 | 19,022 | 1,746,025 | 83 |
| HMS5C4040BLE640 | 12,753 | 1,171,990 | 9 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not establish
an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604** has 10,838 observed identities,
996,625 drive-days and 7 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2020-10-01 through 2020-12-31.
Quarter-only AFR is 0.256365%, calculated as failure flags /
drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

This complete quarter exceeds the 2,000-identity threshold. It establishes
neither the first observed nor the first qualifying quarter. No zero-observation
boundary, true origin, cumulative exposure, complete cumulative history or
original production anchor is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0005 | 41.14 | 0.017 |
| Projection | 0.0008 | 26.55 | 0.305 |
| Audit | 0.0026 | 13.09 | 1.963 |

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
footprint (956,803,561 bytes) also included staging
evidence and is distinct from the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0048/`: `audit.json` and
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
