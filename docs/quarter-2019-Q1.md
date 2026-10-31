# Backward quarter audit: 2019 Q1

Localswim #0055 processed 2019 Q1 in the owner-approved six-quarter
backward workset (#0050–#0055). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2019 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2019.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 567,789,964 bytes; exact official HEAD size matched |
| Valid observation calendar | 90/90 days, 2019-01-01 through 2019-03-31 |
| Observations / drive-days | 9,577,046 |
| All-source inventory | 49 normalized models from 49 raw names |
| Model/serial identities observed during quarter | 115,231 |
| Daily failure flags | 428 |
| Daily Parquet | 62,537,038 bytes |
| Import receipt | 362,535 bytes |
| Summary frames and manifest | 1,054,083 bytes |
| Retained source, projection, receipt and summary | 631,743,620 bytes; staging evidence excluded |
| First summary pass | 6.71 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.17 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The completed audit reconciles source, receipt
and partition hashes, footer/profile lineage, numerical budgets and summary parity.
The profile is `private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `b45b28ce44533fbad26af3d097de344bf290fac2`.
- Local SHA-256: `8155007cd36b3ce7e836a7e1a52c80f74fb53b436d7380bf2ff95d3c05a5c8f8`.
- Summary input identity: `0376513752d28de8c94911d614711e68b1fe04c9277992ed9716156921f899e5`.

The inventory retains all 49 normalized source models, including
7 evidenced HDD models and 42 unclassified models. The full private
inventory preserves every raw alias, count, exposure, failure total and
classification, including populations below 2,000. Population alone does not
establish media class. These unclassified models meet the 2,000-observed-identity
threshold in this quarter and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 4,798 | 313,383 | 2 |
| ST4000DM000 | 23,236 | 1,989,429 | 106 |
| HMS5C4040BLE640 | 14,558 | 1,172,824 | 11 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not establish
an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604** has 4,876 observed identities,
259,749 drive-days and 4 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2019-01-01 through 2019-03-31. Quarter-only AFR is 0.562081%, calculated as
failure flags / drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

The 4,876 identities exceed the 2,000-identity threshold. January 1 is the
start of this loaded window, not the model's original birth or eligibility anchor.
The subsequent [2018 search](ten-quarter-origin-backfill.md) independently
verified complete 2018 Q2 absence and first observation on 2018-07-12, followed
by 79 identities in 2018 Q3 and 1,279 in 2018 Q4. Within that searched window,
2019 Q1 is the first qualifying quarter; this packet alone does not prove it.
No true origin, complete cumulative history, cumulative exposure or original
production anchor is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0004 | 14.24 | 0.017 |
| Projection | 0.0005 | 18.21 | 0.274 |
| Audit | 0.0011 | 9.77 | 1.345 |

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
(631,810,217 bytes) also included staging evidence and is distinct
from the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0055/`: `audit.json` and
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
