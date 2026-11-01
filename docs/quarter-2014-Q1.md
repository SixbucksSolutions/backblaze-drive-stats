# Backward quarter audit: 2014 Q1

Localswim #0079 processed 2014 Q1 in the owner-approved ten-quarter
workset (#0074–#0083). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2014 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2014.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Shared annual source ZIP | 587,751,755 bytes; exact official HEAD size matched |
| Whole annual source calendar | 365 member dates, 2014-01-01 through 2014-12-31 |
| Valid selected observation calendar | 90/90 days, 2014-01-01 through 2014-03-31 |
| Selected CSV member bytes (uncompressed) | 541,386,336; no extracted CSV retained |
| Observations / drive-days | 2,617,973 |
| All-source inventory | 73 normalized models from 73 raw names |
| Model/serial identities observed during quarter | 32,797 |
| Daily failure flags | 434 |
| Quarter-specific daily Parquet | 18,024,140 bytes |
| Quarter-specific import receipt | 245,353 bytes |
| Quarter-specific summary frames and manifest | 442,135 bytes |
| Source, projection, receipt and summary footprint | 606,463,383 bytes; staging excluded; shared ZIP non-additive |
| First summary pass | 1.63 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.04 seconds; cache hit |

Actual member and internal row dates establish selected-quarter coverage; catalog file counts
alone do not prove the calendar. The receipt's `selectedQuarter` is `2014-Q1`.
The completed native audit reconciles source, receipt and partition hashes,
footer/profile lineage, numerical budgets and summary parity. The profile is
`private-parquet-rich-v1-903ee87c89e5`. No CSV was extracted.

The whole annual ZIP is shared by four 2014 quarters through one primary download.
Each quarter selects its own CSV members and rows. Physical batch storage counts
the ZIP once; per-quarter footprints include it and are non-additive. The native
worker stage-inclusive footprint was 606,595,830 bytes, a different scope
from the retained footprint above.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and completed calendar validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `bd1ba79db8ec5d6743363300acb8e55e857357ef`.
- Local SHA-256: `a16ae31ab9b5ac73fcd64554e4d4d49cdbcd2a22bcae73bcebcf0426ce859ef5`.
- Summary input identity: `b42b38bd8656d4bb1fbd9503668c8b98723d81e93913542adbde19b59eeb51c2`.

The inventory retains all 73 normalized source models, including
0 evidenced HDD models and 73 unclassified models.
The full private inventory preserves every raw alias, count, exposure, failure
total and classification, including populations below 2,000. Population alone
does not establish media class. These unclassified models meet the
2,000-observed-identity threshold and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| Hitachi HDS722020ALA330 | 4,728 | 424,297 | 14 |
| ST4000DM000 | 9,093 | 629,493 | 61 |
| ST3000DM001 | 4,311 | 375,058 | 235 |
| Hitachi HDS5C4040ALE630 | 2,586 | 232,611 | 4 |
| Hitachi HDS5C3030ALA630 | 4,598 | 413,313 | 6 |

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
| Projection | 2.5146 | 4.91 | 0.151 |
| Audit | 0.0009 | 4.21 | 0.612 |

Admission waits are separate from admitted phase elapsed time. Admitted elapsed
includes process launch/import and cleanup. First/warm timings are internal
portions of the audit envelope, not extra phases. Each quarter used one native
worker and two Polars threads.

The shared annual source bootstrap took 14.1363647 seconds. The selected
quarter's download record reports verified reuse and zero download elapsed;
bootstrap is separate from the native batch envelope.

The original native ten-quarter command envelope was **14.6101304 seconds**,
reusing pre-downloaded annual ZIPs. Seven complete audits succeeded; #0082
completed a partial published-domain audit, #0083 was unpublished with no ETL,
and #0076 failed projection. Its separately reviewed recovery later
retained 91/92 days; this does not change the original failure. Peak concurrent worker count
was ten. Sampled batch peak owned working set was **2.474 GiB**,
minimum available system memory **34.317 GiB**, and whole-machine
average CPU **46.98%**. Bootstrap, preservation checks, review and
cloud work are excluded. These measurements include failure and non-complete
dispositions; they do not establish ten successful heavy audits, controlled
serial/parallel speedup or a capacity ceiling.

The expanded preservation check covered **12,528 files**, spanning **44 prior
accepted quarters**, preferred/repacked state and private immutable evidence;
all checked files were unchanged. There are 43 standard history-cache quarter
keys plus the accepted isolated-root 2017 Q2 cache. Cold refers to the summary
cache; the operating-system cache was not flushed. Working sets were sampled
approximately every 0.25 seconds and may miss brief peaks or count shared pages.
They do not bound full-history aggregation memory.

The source ZIP is below the **2,147,483,648-byte archive cap**; retained artifacts
are below the **10,737,418,240-byte additional-disk envelope**. Initial recorded
free disk was 2,561,931,739,136 bytes. Staging is excluded from the
receipt-inclusive retained footprint above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0079/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
sanitized `source-head.headers`, calendar records and phase resource records.
Final reconciliation read metadata and the small retained drive summary,
without another logical daily scan. Guarded warm reuse forbade daily DataFrame
reads and scans while allowing byte hashes and small summary reads.

Fresh independent artifact review passed. B2 transfer, encrypted SHA-256
readback, zero-write reuse, separate-root restore and guarded cache reuse passed
for the nine new datasets. Source availability/domain metadata and the preferred
53-dataset catalog were published after independent acceptance. See the
[full-source handoff](source-history-completion.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
