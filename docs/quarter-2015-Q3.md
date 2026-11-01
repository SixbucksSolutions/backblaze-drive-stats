# Backward quarter audit: 2015 Q3

Localswim #0073 processed 2015 Q3 in the owner-approved ten-quarter
workset (#0064–#0073). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2015 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2015.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

The source is the **whole shared annual `data/raw/data_2015.zip` physical
copy**. The parent downloaded it once for #0072 and #0073. Its central directory
contains 365 daily members; only the 92 selected 2015 Q3 members were projected
here. The whole-annual ZIP length and hashes below preserve source identity.
Per-quarter footprints include that same whole ZIP and are **non-additive** with
#0072; sum quarter-specific projections, receipts and summaries independently.

| Item | Result |
| --- | --- |
| Source ZIP (whole annual, shared) | 843,026,671 bytes; exact official HEAD size matched |
| Valid selected observation calendar | 92/92 days, 2015-07-01 through 2015-09-30 |
| Selected CSV member bytes (uncompressed) | 1,157,938,996; no extracted CSV retained |
| Observations / drive-days | 4,497,107 |
| All-source inventory | 71 normalized models from 71 raw names |
| Model/serial identities observed during quarter | 51,415 |
| Daily failure flags | 327 |
| Quarter-specific daily Parquet | 30,921,780 bytes |
| Quarter-specific import receipt | 278,050 bytes |
| Quarter-specific summary frames and manifest | 590,860 bytes |
| Source, projection, receipt and summary footprint | 874,817,361 bytes; staging excluded; includes whole shared annual ZIP, non-additive |
| First summary pass | 3.47 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.06 seconds; cache hit |

Actual member and internal row dates establish coverage; catalog file counts
alone do not prove the calendar. The receipt's `selectedQuarter` is `2015-Q3`.
The completed native audit reconciles source, receipt and partition hashes,
footer/profile lineage, numerical budgets and summary parity. The profile is
`private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `90a18923c110bc3c3ed4e28bd47f296a36888802`.
- Local SHA-256: `141fdec3c8bce5523ce652a775ddcfead7066a403596fc1113a07319f0054c9a`.
- Summary input identity: `d2297edf514771de5eea2d1475c012437a97ffb3a3f341fd73767ac89412513c`.

The inventory retains all 71 normalized source models, including
0 evidenced HDD models and 71 unclassified models.
The full private inventory preserves every raw alias, count, exposure, failure
total and classification, including populations below 2,000. Population alone
does not establish media class. These unclassified models meet the
2,000-observed-identity threshold and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 7,096 | 652,604 | 4 |
| Hitachi HDS722020ALA330 | 4,609 | 423,138 | 22 |
| ST4000DM000 | 21,064 | 1,777,791 | 143 |
| Hitachi HDS5C4040ALE630 | 2,648 | 243,401 | 5 |
| HMS5C4040BLE640 | 3,096 | 284,529 | 4 |
| Hitachi HDS5C3030ALA630 | 4,577 | 420,410 | 17 |

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
| ST8000DM002 | 0 | 0 | 0 | none | none |
| ST8000NM0055 | 0 | 0 | 0 | none | none |

Quarter AFR, when defined, is failure flags / drive-days × 365 × 100.
These are quarter-local observations. No true origin, original production or
eligibility epoch, cumulative exposure or complete cumulative history is
established without broader reconciled history. No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Shared Annual Download | 0.0003 | 20.74 | 0.017 |
| Projection | 0.0004 | 7.40 | 0.182 |
| Audit | 0.0022 | 6.79 | 0.883 |

The shared annual download is recorded once under #0072; it is not a
separate #0073 download.

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

Private evidence remains in ignored `data/staging/0073/`: `audit.json` and
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
