# Backward quarter audit: 2013 Q1

Localswim #0083 records 2013-Q1 in the owner-approved #0074–#0083 workset.
Source: [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using the official [2013 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2013.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

**No published 2013 Q1 data in the inspected official source.**
The quarter has 90 expected calendar days and zero selected-quarter members.
This is source unavailability, not Count 0. Full-quarter Count, AFR, row count,
exposure, failures and model inventory are unknown (`null`), including the
exact HUH721212ALN604 reference and ST12000NM0007, ST8000DM002 and ST8000NM0055.
First/last observation and eligibility anchor are unknown.

No Q1 daily bodies were read. No dataset, Parquet, import receipt, summary cache
or production matrix was created. No fabricated zero-valued data is supplied.

## Timing and resource limits


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
No Q1 member exists to CRC-check; annual boundary body validation is separate.
The annual ZIP is shared across Q2–Q4 and Q1 negative availability evidence.
Count that physical source once; quarter source-inclusive footprints are non-additive.
Compare selected uncompressed CSV bytes separately from the shared annual ZIP.

The archive cap is 2,147,483,648 bytes; additional-disk envelope is
10,737,418,240 bytes. Initial recorded free disk was 2,561,931,739,136 bytes.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0083/`:
`results-summary.json` and `.txt`, `download.json`, `envelope.json`,
`archive-inventory.json`, calendar preflight and sanitized `source-head.headers`.
The negative disposition is `availability-disposition.json` and `worker-result.json`.
Annual domain and independent review evidence is in `data/staging/batch-0074-0083/`.
Final reconciliation used metadata and small summaries only, without another
logical daily scan or cache generation.

Fresh independent negative-evidence review passed. The immutable availability
and domain metadata were retained and referenced by the preferred catalog after
independent acceptance. This quarter has no payload dataset or warm-hit count;
Count, AFR and row count remain unknown. See the
[full-source handoff](source-history-completion.md). Owner acceptance remains
separate from technical verification.
