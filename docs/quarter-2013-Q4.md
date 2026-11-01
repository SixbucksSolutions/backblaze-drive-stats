# Backward quarter audit: 2013 Q4

Localswim #0080 records 2013-Q4 in the owner-approved #0074–#0083 workset.
Source: [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using the official [2013 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2013.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Selected observation calendar | 92/92 days; 2013-10-01 through 2013-12-31 |
| Selected uncompressed CSV member bytes | 312,908,789; no extracted CSV retained |
| Observed rows / known drive-days | 2,062,043 |
| Observed model/serial identities | 27,974 |
| Known daily failure flags | 324 |
| All-source inventory | 40 normalized models; 40 raw names |
| Quarter-specific daily Parquet bytes | 14,534,070 |
| Quarter-specific import receipt bytes | 250,707 |
| Summary frames and manifest bytes | 401,730 |
| Source-inclusive retained bytes | 96,170,027; staging excluded; shared ZIP non-additive |
| First / guarded warm pass seconds | 1.5429 / 0.0488; miss / hit |

The receipt explicitly selects `2013-Q4`. Retained native evidence reconciles
source, receipt and partition hashes, footer/profile lineage and summary parity.
Numerical budgets reconcile: inventory drive-days and small-summary drive-days
equal audit rows; inventory identity totals equal summary rows; failure totals
agree. The profile is `private-parquet-rich-v1-903ee87c89e5`.

## All-source inventory

Private result JSON preserves every source model, raw alias and numerical budget,
including populations below 2,000. All models remain unclassified: population
alone is not media-class evidence. Identities are quarter-local model/serial
identities, not the installed population at quarter end. Models reaching 2,000:

| Model | Identities | Known drive-days | Known failures | First observed | Last observed |
| --- | --- | --- | --- | --- | --- |
| Hitachi HDS722020ALA330 | 4,728 | 368,472 | 12 | 2013-10-01 | 2013-12-31 |
| ST4000DM000 | 5,452 | 333,080 | 27 | 2013-10-01 | 2013-12-31 |
| ST3000DM001 | 4,409 | 339,151 | 161 | 2013-10-01 | 2013-12-31 |
| Hitachi HDS5C4040ALE630 | 2,593 | 201,669 | 7 | 2013-10-01 | 2013-12-31 |
| Hitachi HDS5C3030ALA630 | 4,603 | 358,858 | 11 | 2013-10-01 | 2013-12-31 |

## Exact reference and frontier

| Model | Known identities | Known drive-days | Known failures | First / last |
| --- | --- | --- | --- | --- |
| HUH721212ALN604 | 0 | 0 | 0 | none / none |
| ST12000NM0007 | 0 | 0 | 0 | none / none |
| ST8000DM002 | 0 | 0 | 0 | none / none |
| ST8000NM0055 | 0 | 0 | 0 | none / none |

The exact models have no exposure in this complete quarter; their AFR is
undefined (`null`), never an asserted zero AFR.
Similar ALE variants remain separate from ALN604. Defined quarter AFR uses
failure flags / drive-days × 365 × 100. No true origin, original production or
eligibility epoch, complete cumulative exposure or production matrix is established.

## Timing and resource limits

| Phase | Admission wait (s) | Admitted elapsed (s) | Sampled process-tree peak bytes |
| --- | --- | --- | --- |
| projection | 0.000424 | 3.6612 | 145,424,384 |
| audit | 0.002301 | 3.7459 | 633,692,160 |

Admission wait is separate from admitted elapsed, which includes launch/import
and cleanup. First/warm timings are internal portions, not additional phases.

The original native ten-worker envelope was **14.6101304 seconds**: seven
complete audits, one partial boundary audit (#0082), one source-unavailable
result (#0083) and one failed worker (#0076). Later #0076 recovery is separate.
This does not establish ten complete audits, a controlled serial/parallel
speedup or a full-history capacity ceiling. Sampled batch peak owned working set
was 2,656,165,888 bytes, minimum available memory 36,847,452,160 bytes and
whole-machine average CPU 46.98%. Sampling was approximately every 0.25 seconds
and may miss peaks or count shared pages. Cold means summary-cache miss; OS
caches were not flushed. Each actual quarter used one worker and two Polars threads.

## Source identity and coverage

The 80,983,520-byte annual archive contains 266 continuous daily members from
2013-04-10 through 2013-12-31, with no internal calendar gaps. Primary and fresh
independent source-domain review checked member and internal dates; the first
and last validated bodies have 21,195 and 27,223 rows respectively. No earlier
history is imputed. Unavailable dates outside this domain are distinct from
corrupt captures within a published domain.

**Publisher SHA-1 verification passed.** Official HEAD and local SHA-1 both equal
`acdc6720df96ff47eed203e7d7aad15087b645b8`. Local SHA-256 is
`7f5a53e79b16e695b4b034955806bb3bb194534b169f6eca460dfd3dc48096fe`.
Selected CRC metadata is retained and completed selected-body processing checks ZIP CRCs.
The annual ZIP is shared across Q2–Q4 and Q1 negative availability evidence.
Count that physical source once; quarter source-inclusive footprints are non-additive.
Compare selected uncompressed CSV bytes separately from the shared annual ZIP.

The archive cap is 2,147,483,648 bytes; additional-disk envelope is
10,737,418,240 bytes. Initial recorded free disk was 2,561,931,739,136 bytes.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0080/`:
`results-summary.json` and `.txt`, `download.json`, `envelope.json`,
`archive-inventory.json`, calendar preflight and sanitized `source-head.headers`.
Actual quarter evidence also includes `audit.json` and `.txt`.
Annual domain and independent review evidence is in `data/staging/batch-0074-0083/`.
Final reconciliation used metadata and small summaries only, without another
logical daily scan or cache generation.

Fresh independent artifact review passed. B2 transfer, encrypted SHA-256
readback, zero-write reuse, separate-root restore and guarded cache reuse passed
for the nine new datasets. Source availability/domain metadata and the preferred
53-dataset catalog were published after independent acceptance. See the
[full-source handoff](source-history-completion.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
