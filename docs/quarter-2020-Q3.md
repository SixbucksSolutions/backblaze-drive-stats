# Backward quarter audit: 2020 Q3

Localswim #0049 processed 2020 Q3 in the owner-approved workset of the
2026 Q2 repack plus nine historical quarters (#0041–#0049). Source data comes
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2020 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2020.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 809,739,697 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2020-07-01 through 2020-09-30 |
| Observations / drive-days | 13,553,809 |
| All-source inventory | 49 normalized models from 49 raw names |
| Model/serial identities observed during quarter | 160,165 |
| Daily failure flags | 368 |
| Daily Parquet | 83,634,533 bytes |
| Import receipt | 375,805 bytes |
| Summary frames and manifest | 1,319,880 bytes |
| Retained source, projection, receipt and summary | 895,069,915 bytes; staging evidence excluded |
| First summary pass | 8.53 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.19 seconds; cache hit |

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

- Local SHA-1: `81b767e93d9f4eb2093787d326f32015e668cc63`.
- Local SHA-256: `7e9f7d0e4944cc560b83b0d4252384b7427bae9ddbf9187af531476f5aa23519`.
- Summary input identity: `c339a80d5a3c95a5d17f0fed3eb6ef75f2727f7dbeb58c8d26c46ea6e815d330`.

The inventory retains all 49 normalized source models, including
15 evidenced HDD models and 34 unclassified
models. The full private inventory preserves every raw alias, count, exposure,
failure total and classification, including populations below 2,000. Population
alone does not establish media class. These unclassified models meet the
2,000-observed-identity threshold in this quarter and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,023 | 274,923 | 0 |
| ST4000DM000 | 19,123 | 1,753,271 | 69 |
| HMS5C4040BLE640 | 12,744 | 1,171,895 | 7 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not establish
an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604** has 10,849 observed identities,
997,546 drive-days and 10 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2020-07-01 through 2020-09-30.
Quarter-only AFR is 0.365898%, calculated as failure flags /
drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

This complete quarter exceeds the 2,000-identity threshold. It establishes
neither the first observed nor the first qualifying quarter. No zero-observation
boundary, true origin, cumulative exposure, complete cumulative history or
original production anchor is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0004 | 37.76 | 0.017 |
| Projection | 0.0009 | 23.59 | 0.269 |
| Audit | 0.0020 | 11.96 | 1.701 |

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
footprint (895,155,094 bytes) also included staging
evidence and is distinct from the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0049/`: `audit.json` and
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
