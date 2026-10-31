# Backward quarter audit: 2018 Q4

Localswim #0059 processed 2018 Q4 in the owner-approved 2018 four-quarter
workset (#0059–#0062). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2018 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2018.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 547,622,458 bytes; exact official HEAD size matched |
| Valid observation calendar | 92/92 days, 2018-10-01 through 2018-12-31 |
| Observations / drive-days | 9,357,609 |
| All-source inventory | 48 normalized models from 48 raw names |
| Model/serial identities observed during quarter | 108,718 |
| Daily failure flags | 389 |
| Daily Parquet | 59,415,934 bytes |
| Import receipt | 370,505 bytes |
| Summary frames and manifest | 1,023,130 bytes |
| Retained source, projection, receipt and summary | 608,432,027 bytes; staging evidence excluded |
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

- Local SHA-1: `c5e1391ad7b6454ac87ddedc9213310a51ffde3f`.
- Local SHA-256: `f8321945117e52f104bef61021a32e00c55d7c18757e22e2a0cee4361685948f`.
- Summary input identity: `376d8ea6bb84061d87c45d22435133c2b94cb2d27d6f834b6379ede4a1e8af89`.

The inventory retains all 48 normalized source models, including 6
evidenced HDD models and 42 unclassified models. The full private inventory
preserves every raw alias, count, exposure, failure total and classification,
including populations below 2,000. Population alone does not establish media
class. These unclassified models meet the 2,000-observed-identity threshold
and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 4,843 | 426,449 | 6 |
| ST4000DM000 | 24,395 | 2,156,756 | 120 |
| HMS5C4040BLE640 | 14,667 | 1,335,577 | 18 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not by itself
establish an original eligibility anchor.

## Exact reference model and historical boundary

**HUH721212ALN604**: 1,279 identities; 64,759 drive-days; 1 failure flags; quarter AFR 0.563628222%; 2018-10-01 through 2018-12-31.
The raw alias is `HGST HUH721212ALN604`.
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
| Download | 0.0007 | 22.41 | 0.017 |
| Projection | 0.0007 | 18.28 | 0.252 |
| Audit | 0.0012 | 8.44 | 1.317 |

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
(608,501,291 bytes) includes staging and differs from the receipt-inclusive
retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0059/`: `audit.json` and
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
