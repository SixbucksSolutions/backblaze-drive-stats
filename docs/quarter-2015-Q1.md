# Backward quarter audit: 2015 Q1

Localswim #0075 processed 2015 Q1 in the owner-approved historical
workset (#0074–#0083). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2015 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2015.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Shared annual source ZIP | 843,026,671 bytes; exact official HEAD size matched |
| Valid selected observation calendar | 90/90 days, 2015-01-01 through 2015-03-31 |
| Selected CSV member bytes (uncompressed) | 988,989,911; no extracted CSV retained |
| Observations / drive-days | 3,877,265 |
| All-source inventory | 78 normalized models from 78 raw names |
| Model/serial identities observed during quarter | 45,824 |
| Daily failure flags | 354 |
| Quarter-specific daily Parquet | 27,532,665 bytes |
| Quarter-specific import receipt | 272,066 bytes |
| Quarter-specific summary frames and manifest | 563,916 bytes |
| Source, projection, receipt and summary footprint | 871,395,318 bytes; staging excluded; shared ZIP non-additive |
| First summary pass | 2.26 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.05 seconds; cache hit |

Actual member and internal row dates establish coverage; catalog file counts
alone do not prove the calendar. The receipt's `selectedQuarter` is `2015-Q1`.
The completed native audit reconciles source, receipt and partition hashes,
footer/profile lineage, numerical budgets and summary parity. The profile is
`private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local whole-archive SHA-1: `90a18923c110bc3c3ed4e28bd47f296a36888802`.
- Local whole-archive SHA-256: `141fdec3c8bce5523ce652a775ddcfead7066a403596fc1113a07319f0054c9a`.
- Summary input identity: `1f1b4c7bc989bfb6b8717127ca8caec1747e6fa06a53536291e76cb5d9aabd6f`.

The previously pinned 2015 annual archive was reused; no 2015 source download
occurred this turn. One physical 843,026,671-byte ZIP supplies multiple selected
quarters. Quarter-inclusive footprints are non-additive. The separate 2014/2013
bootstrap downloads are outside the native benchmark below.

The inventory retains all 78 normalized source models, including
0 evidenced HDD models and 78 unclassified models.
The full private inventory preserves every raw alias, count, exposure, failure
total and classification, including populations below 2,000. Population alone
does not establish media class. These unclassified models meet the
2,000-observed-identity threshold and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 7,129 | 634,952 | 14 |
| Hitachi HDS722020ALA330 | 4,683 | 416,941 | 20 |
| ST4000DM000 | 14,909 | 1,253,426 | 105 |
| Hitachi HDS5C4040ALE630 | 2,660 | 237,941 | 7 |
| HMS5C4040BLE640 | 3,103 | 279,124 | 3 |
| Hitachi HDS5C3030ALA630 | 4,604 | 413,602 | 9 |

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
| Projection | 0.0005 | 7.32 | 0.156 |
| Audit | 0.0010 | 5.07 | 0.872 |

Source reuse has no quarter download phase. Admission waits are separate from
admitted phase elapsed time, which includes process launch/import and cleanup.
First/warm timings are internal portions of the audit envelope, not extra phases.
Each data worker used two Polars threads. The sampled guard stops when global
available RAM falls below 8 GiB; it is not a per-worker operating-system cap.

The original native command envelope was **14.6101304 seconds**,
including actual ZIP reuse, nine data workers and one metadata-only worker.
Seven complete audits succeeded; #0082 succeeded for its boundary partial
published domain; #0083 recorded source unavailable without ETL; #0076 failed
projection. The separate #0076 recovery later passed at 91/92 days and does not alter the
original outcome. This is not ten complete successful ETLs.
Peak concurrent workers were ten. Sampled batch peak owned working set was
**2.474 GiB**, minimum available system memory
**34.317 GiB**, and whole-machine average CPU
**46.98%**. Source bootstrap, preservation checks,
independent review and cloud retention are excluded. These measurements include
failure and metadata-only outcomes; they do not establish an apples-to-apples
serial/parallel speedup or a capacity ceiling.

The preservation baseline covered **12,528 files across 44 prior quarters**,
including preferred/repacked state and private immutable evidence; all were unchanged.
Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. They do not bound full-history aggregation memory.
The source ZIP is below the **2,147,483,648-byte archive cap**;
retained artifacts are below the **10,737,418,240-byte additional-disk
envelope**. Initial recorded free disk was 2,561,931,739,136 bytes.
Staging is excluded from the receipt-inclusive retained footprint above. The
runner's contemporaneous stage-inclusive footprint was 871,531,561
bytes. Shared annual source bytes count once in physical batch accounting.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0075/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
`archive-inventory.json`, calendar and phase resource records. Batch benchmark,
annual source records and preservation manifests remain in
`data/staging/batch-0074-0083/`.

This reconciliation read metadata and the small retained drive summary,
without another logical daily scan or cache generation. Guarded warm reuse
forbade daily DataFrame reads and scans while allowing byte hashes and small
summary reads. Earlier #0063 research evidence remains immutable.

Fresh independent artifact review passed. B2 transfer, encrypted SHA-256
readback, zero-write reuse, separate-root restore and guarded cache reuse passed
for the nine new datasets. Source availability/domain metadata and the preferred
53-dataset catalog were published after independent acceptance. See the
[full-source handoff](source-history-completion.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
