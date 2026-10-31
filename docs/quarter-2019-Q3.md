# Backward quarter audit: 2019 Q3

Localswim #0053 processed 2019 Q3 in the owner-approved six-quarter
backward workset (#0050–#0055). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2019 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2019.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 600,893,581 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2019-07-01 through 2019-09-30 |
| Observations / drive-days | 10,338,153 |
| All-source inventory | 43 normalized models from 43 raw names |
| Model/serial identities observed during quarter | 116,270 |
| Daily failure flags | 622 |
| Daily Parquet | 66,631,690 bytes |
| Import receipt | 370,512 bytes |
| Summary frames and manifest | 1,044,269 bytes |
| Retained source, projection, receipt and summary | 668,940,052 bytes; staging evidence excluded |
| First summary pass | 6.98 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.25 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The completed audit reconciles source, receipt
and partition hashes, footer/profile lineage, numerical budgets and summary parity.
The profile is `private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `1252fa15ffd3069a53b6ef3951d9d623b68fee3f`.
- Local SHA-256: `53de1c8d32da5dfb0f6de3317b01af4b72630ff618d10a3781c322cc433ebd1d`.
- Summary input identity: `afdac98b95bd33e359b1f62f71a5b01e3e6a568efa8dde69b99d9f9e359ef73a`.

The inventory retains all 43 normalized source models, including
8 evidenced HDD models and 35 unclassified models. The full private
inventory preserves every raw alias, count, exposure, failure total and
classification, including populations below 2,000. Population alone does not
establish media class. These unclassified models meet the 2,000-observed-identity
threshold in this quarter and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 2,725 | 245,904 | 6 |
| ST4000DM000 | 19,705 | 1,796,728 | 72 |
| HMS5C4040BLE640 | 12,769 | 1,173,136 | 18 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not establish
an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604** has 10,864 observed identities,
946,724 drive-days and 15 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2019-07-01 through 2019-09-30. Quarter-only AFR is 0.578310%, calculated as
failure flags / drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

This complete quarter exceeds the 2,000-identity threshold. It establishes
neither the first observed nor the first qualifying quarter.
No true origin, complete cumulative history, cumulative exposure or original
production anchor is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0006 | 16.00 | 0.017 |
| Projection | 0.0009 | 19.69 | 0.246 |
| Audit | 0.0020 | 10.06 | 1.432 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. First/warm pass timings are internal
portions of the audit command envelope, not extra phases to add to it.
Each quarter used one native worker and two Polars threads.

The original six-quarter command envelope was 69.07947 seconds: five quarters
completed full audits; 2019 Q2 stopped on a source-calendar failure. This is not
six completed quarters or a controlled serial-versus-parallel speedup. The
parent's preservation check found all 24 protected earlier quarter caches plus
the preferred and repack artifacts unchanged.

Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. These measurements do not bound full-history
aggregation memory. The archive is below 2 GiB and the retained footprint is
below the 10 GiB additional-disk envelope. The worker's contemporaneous footprint
(669,005,753 bytes) also included staging evidence and is distinct
from the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0053/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
sanitized `source-head.headers`, calendar records and phase resource records.
Final packet reconciliation read metadata and the small retained drive summary,
without another logical daily scan. Guarded warm reuse forbade daily DataFrame
reads and scans while allowing byte hashes and small summary reads.

Fresh independent artifact review passed. Parent-coordinated B2 transfer,
actual encrypted SHA-256 readback, separate-root restore, guarded summary reuse
and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-origin-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
