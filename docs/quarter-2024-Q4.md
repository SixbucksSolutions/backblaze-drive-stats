# Backward quarter audit: 2024 Q4

Localswim #0032 processed this quarter in the owner-approved four-quarter
benchmark (#0029–#0032), following acceptance of the pilot and 2025 Q4 audit.
Source data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2024 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2024.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,066,033,183 bytes; exact official HEAD size matched |
| Calendar | All 92 days, 2024-10-01 through 2024-12-31 |
| Observations / drive-days | 27,345,292 |
| All-source inventory | 75 normalized models from 76 raw names |
| Model/serial identities observed during quarter | 308,180 |
| Daily failure flags | 1,032 |
| Projected daily Parquet | 157,293,987 bytes |
| Summary frames and manifest | 2,254,010 bytes |
| Initial download | 47.35 seconds; archive reused during recovery |
| Final projection | 50.92 seconds; sampled own-process-tree peak 0.50 GiB |
| First summary pass | 14.92 seconds; summary-cache miss |
| Guarded summary reuse | 0.22 seconds; cache hit |
| Final whole audit | 18.40 seconds; sampled own-process-tree peak 3.25 GiB |
| Current ZIP, committed daily Parquet/receipt and summary | 1,226,133,606 bytes; excludes preserved partial outputs and private evidence |

Counts describe identities observed anywhere in the quarter, not quarter-end
installed populations. The inventory retains every source model: 32 match the
known-HDD seed, two have explicit HDD evidence, and 41 remain unclassified. Population alone
does not establish media class; unclassified models are not silently omitted.

## Source identity and acceptance evidence

The official HTTPS source advertises `x-bz-content-sha1=none` and provides no
large-file SHA-1. **Publisher checksum verification was unavailable.** The
limitation was recorded before processing. The exact official content length,
local hashes, full ZIP/calendar validation and importer daily-member CRC checks
provide the retained integrity evidence; local hashes do not constitute a
publisher checksum comparison.

- Local SHA-1: `7a911b4785e7059b95c6696b5cc588ae59ee9a31`.
- Local SHA-256: `5bbaab6be27a49b0edef76300fbbd0f1fdf58cec932cc797840976a8c7daaab4`.
- All 92 expected daily members were present, with no duplicate, missing or
  unexpected calendar days.

The production projector and `tools/verify_quarter.py` completed successfully.
The audit reconciles source/receipt and partition hashes, complete calendar
coverage, footer/profile lineage, numerical budgets and summary parity. Its
guarded warm pass was a cache hit with daily DataFrame reads/scans forbidden;
byte hashes and small summary reads remain permitted. No CSV was extracted to
disk. The archive stayed below the 2 GiB acquisition cap.

Private evidence is retained under ignored `data/staging/0032/`: `envelope.json`,
`source-head.headers`, `download.json`, `source-reuse.json`,
`calendar-preflight.json`, `audit.json` and `.txt`, phase resource samples and
`results-summary.json`. The reconciliation reads the audit and small quarter
summary, without another daily logical scan. Fresh independent artifact review
is a separate handoff gate; this report does not claim that review is complete.

## Exact reference model and backward-search boundary

**HUH721212ALN604** has 10,333 observed identities, 943,534 drive-days and 133
daily failure flags. Its sole observed raw alias is `HGST HUH721212ALN604`, with
observations spanning October 1 through December 31. Quarter-only AFR is about
5.145%. It is classified as HDD through the retained positive seed evidence.
ALE variants remain separate SKUs.

The exact model is present above the 2,000-identity threshold in this complete
quarter. Backward search therefore continues. Neither its first observed quarter
nor its first qualifying quarter is established; those remain separate findings.
No complete zero quarter has been reached here. This audit establishes neither
global inception nor cumulative exposure, and generates no production matrix or
production-anchor claim.

## Recovery and measurement limits

The initial batch coordinator encountered a `PermissionError` at about 62 seconds
and stopped all workers safely. Original phase evidence remains in
`data/staging/0032/attempt-1/`; uncommitted partial projections were preserved in
the original batch's `attempt-1-projections/` evidence. Recovery reused all four
downloaded ZIPs and the already committed 2025 Q1 projection, rebuilt the other
three projections, and aligned all four audits.

The successful recovery coordinator measured 75.38 seconds in
`data/staging/batch-0029-0032-recovery/benchmark.json`. That is recovery elapsed
time, not a clean four-quarter download-to-audit benchmark. This quarter used
one worker and four Polars threads alongside the other quarter workers. The
table combines the initial download with final recovery projection/audit
measurements; adding those times would not establish batch throughput.

The first summary pass was cold only for the summary cache; the operating-system
cache was not flushed. Process-tree working-set samples were taken approximately
every 0.25 seconds and can miss short peaks. These measurements do not establish
full-history aggregation limits. Data and private evidence remain outside Git;
any private B2 retention is coordinated separately by the primary after review.
