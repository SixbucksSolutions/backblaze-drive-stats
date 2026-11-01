# Backward quarter audit: 2017 Q3

Localswim #0065 processed 2017 Q3 in the owner-approved backward
workset (#0064–#0073). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2017 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2017.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 426,033,491 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2017-07-01 through 2017-09-30 |
| Observations / drive-days | 8,004,840 |
| All-source inventory | 52 normalized models from 52 raw names |
| Model/serial identities observed during quarter | 95,188 |
| Daily failure flags | 392 |
| Daily Parquet | 51,847,560 bytes |
| Import receipt | 278,053 bytes |
| Summary frames and manifest | 866,769 bytes |
| Retained source, projection, receipt and summary | 479,025,873 bytes; staging evidence excluded |
| First summary pass | 4.04033 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.10886 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The native audit reconciles source,
receipt and partition hashes, footer/profile lineage, numerical budgets and
summary parity. The profile is `private-parquet-rich-v1-903ee87c89e5`.
No CSV was extracted. Native processing used the reviewed quarter-selector CLI;
the retained receipt explicitly records `selectedQuarter: 2017-Q3`.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `ea35806e923f17420e579aec2f929d5443784529`.
- Local SHA-256: `943e7349684fc6daddc1e089ea8d6d5a75b220e1903fedc0190d5ee64af568f6`.
- Summary input identity: `3a7f0f9a0ffeb0ab5c4af867168d60658386cde4e4d49758273a49e65315935e`.

The inventory retains all 52 normalized source models, including 3
evidenced HDD models and 49 unclassified models. The full private inventory
preserves every raw alias, count, exposure, failure total and classification,
including populations below 2,000. Population alone does not establish media
class. These unclassified models meet the 2,000-observed-identity threshold
and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 8,572 | 720,083 | 9 |
| ST4000DM000 | 34,597 | 3,152,542 | 282 |
| Hitachi HDS5C4040ALE630 | 2,623 | 239,498 | 3 |
| HMS5C4040BLE640 | 16,191 | 1,419,590 | 14 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. Quarter AFR, when defined, is failure
flags / drive-days × 365 × 100. Inventory totals reconcile to 95,188
identities, 8,004,840 drive-days and 392 failure flags.

## Exact reference model and historical boundary

**HUH721212ALN604**: zero exact-model identities, zero drive-days and zero
failure flags in the complete all-source inventory. AFR is undefined with zero
exposure. Similar ALE variants remain separate SKUs and are not merged with
ALN604. This zero quarter alone does not establish a birth boundary.

The three epoch-frontier models have these quarter observations:

| Model | Observed identities | Drive-days | Failure flags | Observed interval |
| --- | --- | --- | --- | --- |
| ST12000NM0007 | 20 | 500 | 0 | 2017-09-06 through 2017-09-30 |
| ST8000DM002 | 9,897 | 908,298 | 18 | 2017-07-01 through 2017-09-30 |
| ST8000NM0055 | 14,433 | 982,738 | 28 | 2017-07-01 through 2017-09-30 |

These dates are within-quarter observations, not first-ever observations.
Neither first appearance nor the first qualifying quarter is proved by a single
quarter. A threshold crossing does not establish an original eligibility anchor.
No true origin, original production anchor, cumulative exposure or complete
cumulative history is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.000385 | 11.91379 | 0.017 |
| Projection | 0.000773 | 14.70045 | 0.207 |
| Audit | 0.002231 | 7.12553 | 1.240 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. First/warm timings are internal
portions of the audit envelope, not extra phases. This quarter used one native
worker and two Polars threads.

The original ten-worker batch envelope was 64.37664 seconds,
including one parent annual-2015 download prelude and all ten workers. Final
preservation hashing was outside that elapsed interval. Seven complete audits
succeeded; strict failures remained at #0066 (audit), #0067 (projection) and
#0072 (projection). This is not a clean ten-success run or a capacity result.
At most ten workers were observed. Sampled batch peak owned working set was
2.571 GiB (2,760,732,672 bytes), minimum available system memory was
32.166 GiB (34,538,422,272 bytes), and whole-machine average CPU was
43.83%. These measurements include failed work and do not establish
ten simultaneous successful heavy audits or controlled serial/parallel speedup.

The expanded preservation check covered 9,896 existing files across 34 prior
quarter roots, including partial quarters, plus preferred/repacked state and
private immutable evidence; all were unchanged. The benchmark's global physical
disk delta was 4,053,307,392 bytes, counting the shared annual-2015
ZIP once. Per-quarter worker footprints are non-additive for shared sources.

Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. These measurements do not bound full-history
aggregation memory. The archive is below the 2,147,483,648-byte (2 GiB)
cap and retained artifacts are below the 10,737,418,240-byte
(10 GiB) additional-disk envelope. Initial disk free space was
2,567,026,581,504 bytes. The worker's contemporaneous footprint
(479,097,511 bytes) includes staging and differs from the
receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0065/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
sanitized `source-head.headers`, calendar records and phase resource records.
Final reconciliation read metadata and the small retained drive summary,
without another logical daily scan. Guarded warm reuse forbade daily DataFrame
reads and scans while allowing byte hashes and small summary reads.

Fresh independent artifact review passed. B2 transfer, actual encrypted
SHA-256 readback, zero-write repeat, separate-root restore, guarded restored
summary reuse and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-epoch-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
