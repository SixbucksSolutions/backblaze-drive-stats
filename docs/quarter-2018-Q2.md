# Backward quarter audit: 2018 Q2

Localswim #0061 processed 2018 Q2 in the owner-approved 2018 four-quarter
workset (#0059–#0062). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2018 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2018.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 527,461,011 bytes; exact official HEAD size matched |
| Valid observation calendar | 91/91 days, 2018-04-01 through 2018-06-30 |
| Observations / drive-days | 9,144,206 |
| All-source inventory | 47 normalized models from 47 raw names |
| Model/serial identities observed during quarter | 105,634 |
| Daily failure flags | 292 |
| Daily Parquet | 57,893,341 bytes |
| Import receipt | 312,662 bytes |
| Summary frames and manifest | 966,652 bytes |
| Retained source, projection, receipt and summary | 586,633,666 bytes; staging evidence excluded |
| First summary pass | 5.27 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.09 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The completed native audit reconciles source,
receipt and partition hashes, footer/profile lineage, numerical budgets and
summary parity. The profile is `private-parquet-rich-v1-903ee87c89e5`.
No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `30fe450514399f9f12a6afd82986702501ddbebf`.
- Local SHA-256: `4933a4363f79d4b9ee18a827613ced04571bb3b674f07738f420bd1f64f0cd55`.
- Summary input identity: `7b1a0eb6fa39d32e8a59f11160719255fc5ac733400eabdd17f57783092b9756`.

The inventory retains all 47 normalized source models, including 4
evidenced HDD models and 43 unclassified models. The full private inventory
preserves every raw alias, count, exposure, failure total and classification,
including populations below 2,000. Population alone does not establish media
class. These unclassified models meet the 2,000-observed-identity threshold
and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 5,710 | 441,707 | 5 |
| ST4000DM000 | 31,195 | 2,645,254 | 134 |
| HMS5C4040BLE640 | 15,342 | 1,384,015 | 10 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not by itself
establish an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604**: 0 identities; 0 drive-days; 0 failure flags; no raw aliases; AFR undefined because exposure is zero.
Quarter AFR, when defined, is failure flags / drive-days × 365 × 100.

The complete 2018 Q2 all-source inventory has zero exact-model observations.
The adjacent complete 2018 Q3 has 79 identities, first observed on 2018-07-12.
Complete 2018 Q4 has 1,279 identities. These establish a candidate observed
birth boundary between complete zero and positive quarters, not global inception
or uninterrupted service. Q3 and Q4 remain below 2,000 identities. Later retained
2019 Q1 has 4,876 identities and is the first retained qualifying quarter in this
comparison. No true origin, original production anchor, cumulative exposure or
complete cumulative history is established. Similar ALE variants remain separate
SKUs and are not merged with ALN604. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0004 | 13.47 | 0.017 |
| Projection | 0.0007 | 17.35 | 0.202 |
| Audit | 0.0023 | 8.40 | 1.304 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. First/warm timings are internal
portions of the audit envelope, not extra phases. Each quarter used one native
worker and two Polars threads.

The original four-quarter command envelope was 56.28693 seconds:
three complete audits succeeded, while 2018 Q1 failed on source evidence for
2018-02-25. It subsequently received a separately reviewed 89/90-day partial
recovery; that does not change the original failure outcome. At most four workers
and four source CPU/heavy phases were admitted. Sampled batch peak owned
working set was 4.50 GiB, minimum available system memory was
30.59 GiB, and whole-machine average CPU was 60.59%.
These measurements include the failed quarter and do not establish four
simultaneous successful heavy audits or a controlled serial/parallel speedup.
The preservation check covered 5,263 existing files across 30 earlier quarters,
including partial 2019 Q2, plus preferred/repacked state; all were unchanged.

Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. These measurements do not bound full-history
aggregation memory. The archive is below 2 GiB and retained artifacts are below
the 10 GiB additional-disk envelope. The worker's contemporaneous footprint
(586,697,991 bytes) includes staging and differs from the receipt-inclusive
retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0061/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
sanitized `source-head.headers`, calendar records and phase resource records.
Final reconciliation read metadata and the small retained drive summary,
without another logical daily scan. Guarded warm reuse forbade daily DataFrame
reads and scans while allowing byte hashes and small summary reads.

Fresh independent artifact review passed. Parent-coordinated B2 transfer,
actual encrypted SHA-256 readback, separate-root restore, guarded summary reuse
and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-origin-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
