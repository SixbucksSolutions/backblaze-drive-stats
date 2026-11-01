# Backward quarter audit: 2016 Q4

Localswim #0068 processed 2016 Q4 in the owner-approved ten-quarter
workset (#0064–#0073). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2016 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2016.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 337,175,346 bytes; exact official HEAD size matched |
| Valid selected observation calendar | 92/92 days, 2016-10-01 through 2016-12-31 |
| Selected CSV member bytes (uncompressed) | 1,732,012,161; no extracted CSV retained |
| Observations / drive-days | 6,589,448 |
| All-source inventory | 59 normalized models from 59 raw names |
| Model/serial identities observed during quarter | 74,453 |
| Daily failure flags | 349 |
| Quarter-specific daily Parquet | 42,931,367 bytes |
| Quarter-specific import receipt | 278,053 bytes |
| Quarter-specific summary frames and manifest | 715,832 bytes |
| Source, projection, receipt and summary footprint | 381,100,598 bytes; staging excluded |
| First summary pass | 4.18 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.07 seconds; cache hit |

Actual member and internal row dates establish coverage; catalog file counts
alone do not prove the calendar. The receipt's `selectedQuarter` is `2016-Q4`.
The completed native audit reconciles source, receipt and partition hashes,
footer/profile lineage, numerical budgets and summary parity. The profile is
`private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `91e26cf50e4e759f0c4339c6829003a4d7a3a218`.
- Local SHA-256: `46de02b23ab6f93e30c8651582961cced35a304180b5b321c043c78eff6f3044`.
- Summary input identity: `a4fe9ded861a12bff07ecf33c1342b6a0167a2bbd6db4b0f838cc2fb38ad273d`.

The inventory retains all 59 normalized source models, including
2 evidenced HDD models and 57 unclassified models.
The full private inventory preserves every raw alias, count, exposure, failure
total and classification, including populations below 2,000. Population alone
does not establish media class. These unclassified models meet the
2,000-observed-identity threshold and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 7,066 | 648,393 | 9 |
| ST4000DM000 | 34,970 | 3,196,552 | 234 |
| Hitachi HDS5C4040ALE630 | 2,629 | 241,665 | 4 |
| HMS5C4040BLE640 | 9,421 | 809,119 | 14 |
| Hitachi HDS5C3030ALA630 | 4,492 | 412,752 | 13 |

Counts describe model/serial identities observed anywhere in the quarter,
not quarter-end installed populations. A threshold crossing does not by itself
establish an original eligibility anchor.

## Exact reference model and historical frontier

**HUH721212ALN604** has 0 exact-model identities,
0 drive-days and 0 failure flags in this complete quarter.
There is no first/last observation or defined quarter AFR when exposure is zero.
Similar ALE variants remain separate SKUs and are not merged with ALN604.

| Frontier model | Observed identities | Drive-days | Failure flags | First observed | Last observed |
| --- | --- | --- | --- | --- | --- |
| ST12000NM0007 | 0 | 0 | 0 | none | none |
| ST8000DM002 | 8,689 | 663,697 | 29 | 2016-10-01 | 2016-12-31 |
| ST8000NM0055 | 60 | 1,560 | 0 | 2016-12-06 | 2016-12-31 |

Quarter AFR, when defined, is failure flags / drive-days × 365 × 100.
These are quarter-local observations. No true origin, original production or
eligibility epoch, cumulative exposure or complete cumulative history is
established without broader reconciled history. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0004 | 9.84 | 0.017 |
| Projection | 0.0007 | 12.62 | 0.193 |
| Audit | 0.0017 | 7.10 | 1.027 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. First/warm timings are internal
portions of the audit envelope, not extra phases. Each quarter used one native
worker and two Polars threads.

The original ten-quarter command envelope was **64.3766447 seconds**, including
the single shared annual-download prelude and ten worker subprocesses, excluding
the final preservation check. Seven complete audits succeeded; #0066, #0067 and
#0072 failed in that original run. Later partial recoveries were separately reviewed; they do not change
those original outcomes. Peak concurrent worker
count was ten. Sampled batch peak owned working set was **2.571 GiB**, minimum
available system memory **32.166 GiB**, and whole-machine average CPU **43.83%**.
These measurements include failures and do not establish ten successful heavy
audits, controlled serial/parallel speedup or a capacity ceiling.

The expanded preservation check covered **9,896 files across 34 prior quarters**,
plus preferred/repacked state and private immutable evidence; all were unchanged.
Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. They do not bound full-history aggregation memory.
The source ZIP is below the **2,147,483,648-byte archive cap**; retained artifacts
are below the **10,737,418,240-byte additional-disk envelope**. Initial recorded
free disk was 2,567,026,581,504 bytes. Staging is excluded from the
receipt-inclusive retained footprint above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0068/`: `audit.json` and
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
