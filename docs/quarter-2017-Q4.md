# Backward quarter audit: 2017 Q4

Localswim #0064 processed 2017 Q4 in the owner-approved backward
workset (#0064–#0073). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2017 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2017.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 455,636,340 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2017-10-01 through 2017-12-31 |
| Observations / drive-days | 8,266,213 |
| All-source inventory | 51 normalized models from 51 raw names |
| Model/serial identities observed during quarter | 96,086 |
| Daily failure flags | 382 |
| Daily Parquet | 53,853,895 bytes |
| Import receipt | 278,052 bytes |
| Summary frames and manifest | 878,351 bytes |
| Retained source, projection, receipt and summary | 510,646,638 bytes; staging evidence excluded |
| First summary pass | 2.87236 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.06778 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The native audit reconciles source,
receipt and partition hashes, footer/profile lineage, numerical budgets and
summary parity. The profile is `private-parquet-rich-v1-903ee87c89e5`.
No CSV was extracted. Native processing used the reviewed quarter-selector CLI;
the retained receipt explicitly records `selectedQuarter: 2017-Q4`.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `9b5daddea53fe756e22816ebc648111a87654fa3`.
- Local SHA-256: `de2ebb7b69e2b5f7bf441056210cb02058b7c1b06c907e627f2335800402eb1d`.
- Summary input identity: `edf2da06901a876d51af81420fa678cfb7324c071aab5b5891dcad873b46f449`.

The inventory retains all 51 normalized source models, including 3
evidenced HDD models and 48 unclassified models. The full private inventory
preserves every raw alias, count, exposure, failure total and classification,
including populations below 2,000. Population alone does not establish media
class. These unclassified models meet the 2,000-observed-identity threshold
and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 6,846 | 587,667 | 3 |
| ST4000DM000 | 33,341 | 2,969,705 | 233 |
| Hitachi HDS5C4040ALE630 | 2,412 | 218,666 | 2 |
| HMS5C4040BLE640 | 15,059 | 1,369,721 | 17 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. Quarter AFR, when defined, is failure
flags / drive-days × 365 × 100. Inventory totals reconcile to 96,086
identities, 8,266,213 drive-days and 382 failure flags.

## Exact reference model and historical boundary

**HUH721212ALN604**: zero exact-model identities, zero drive-days and zero
failure flags in the complete all-source inventory. AFR is undefined with zero
exposure. Similar ALE variants remain separate SKUs and are not merged with
ALN604. This zero quarter alone does not establish a birth boundary.

The three epoch-frontier models have these quarter observations:

| Model | Observed identities | Drive-days | Failure flags | Observed interval |
| --- | --- | --- | --- | --- |
| ST12000NM0007 | 7,242 | 308,864 | 17 | 2017-10-01 through 2017-12-31 |
| ST8000DM002 | 9,915 | 901,785 | 28 | 2017-10-01 through 2017-12-31 |
| ST8000NM0055 | 14,464 | 1,313,506 | 44 | 2017-10-01 through 2017-12-31 |

These dates are within-quarter observations, not first-ever observations.
Neither first appearance nor the first qualifying quarter is proved by a single
quarter. A threshold crossing does not establish an original eligibility anchor.
No true origin, original production anchor, cumulative exposure or complete
cumulative history is established. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.000392 | 21.41709 | 0.017 |
| Projection | 0.000441 | 14.21818 | 0.192 |
| Audit | 0.000882 | 5.13448 | 1.297 |

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
(510,721,401 bytes) includes staging and differs from the
receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0064/`: `audit.json` and
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
