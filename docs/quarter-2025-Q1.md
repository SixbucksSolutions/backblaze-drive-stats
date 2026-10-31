# Backward quarter audit: 2025 Q1

Localswim #0031 privately audited 2025 Q1 within the owner-authorized four-quarter
benchmark (#0029–#0032), following acceptance of the pilot and 2025 Q4. Source data
comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2025 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2025.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,020,483,699 bytes; publisher SHA-1 and local SHA-256 verified |
| Calendar | All 90 days, 2025-01-01 through 2025-03-31 |
| Observations / drive-days | 27,799,986 |
| All-source inventory | 75 normalized models from 76 raw names |
| Model/serial identities observed during quarter | 318,426 |
| Daily failure flags | 1,067 |
| Media evidence | 32 seed matches plus two evidence-backed HDDs; 41 models remain unclassified |
| Projected daily Parquet | 161,718,524 bytes |
| Summary frames and manifest | 2,305,660 bytes |
| Original download | 22.41 seconds |
| Original successful projection | 37.06 seconds; sampled process-tree peak 0.51 GiB |
| Final first summary pass | 15.19 seconds; summary-cache miss |
| Final guarded summary reuse | 0.40 seconds; cache hit |
| Final whole audit | 18.08 seconds; sampled process-tree peak 3.41 GiB |
| Retained quarter footprint | 1,185,048,415 bytes, plus small private evidence |

Each quarter worker used four Polars threads. The source stayed below 2 GiB and
this quarter's retained data plus private evidence stayed below 10 GiB. The first
summary pass was cold only for the summary cache; the operating-system cache was
not flushed. Process-tree memory was sampled and can miss short peaks. These
measurements do not establish full-history aggregation limits. Unclassified models
remain in the inventory and totals; population alone is not media evidence.

The publisher large-file SHA-1 is
`d0a15237d5f3636b4e89b8ffa07cc6e3937211b0`. Local ZIP SHA-256 is
`7a230565f72fdb3882c05fdcfab361c801e9a545ba18543899fc7618174171ec`.
No raw CSV was extracted to disk. No data file is committed to Git.

## Interrupted benchmark and recovery

The initial coordinator stopped all workers after about 62 seconds when it
encountered a Windows `PermissionError`. Its exact cause was not proven. Q1's
projection had already completed successfully. Its committed daily partitions were preserved;
recovery verified the complete receipt and reused that projection without
reprojecting it. The ZIP was also reverified and reused, with zero recovery
download bytes. Original phase evidence remains under `attempt-1/`.

The recovered four-quarter run took 75.38 seconds, including source revalidation,
three rebuilt projections and four aligned audits. The four audit command
envelopes overlapped for 18.08 seconds. That is a recovery measurement using
retained inputs,
not a clean download-through-audit throughput benchmark. The phase times above
identify the original acquisition/projection and final successful audit rather
than combining them into an uninterrupted end-to-end timing.

## Acceptance evidence

The production projector and `tools/verify_quarter.py` completed successfully.
The final audit verifies full calendar coverage, ZIP/receipt and partition hashes,
Parquet profile/footer lineage, numerical budgets and summary parity. Its guarded
second pass forbids daily DataFrame reads/scans while permitting byte hashing and
small summary reads; it returned a current-profile cache hit. Existing baseline
preservation is recorded at batch level.

Private evidence lives under ignored `data/staging/0031/`: `audit.json` and `.txt`,
`audit-resources.json`, `download.json`, `download-resources.json`, `envelope.json`,
`projection-reuse.json`, `source-reuse.json`, `results-summary.json` and
`attempt-1/projection-resources.json`. Batch recovery measurements and baseline
preservation evidence live under `data/staging/batch-0029-0032-recovery/`.
Independent review is a separate acceptance step; the production audit is not a
second independent full-quarter CSV parse.

## Exact reference model and search boundary

**HUH721212ALN604** has 10,195 observed identities, 911,546 drive-days and 124 daily
failure flags. Its observed bounds are January 1 through March 31, and its sole
observed raw alias is `HGST HUH721212ALN604`. Quarter-only AFR is about 4.965%.
ALN remains separate from ALE variants. Count means identities observed anywhere
in the quarter, not quarter-end installed population.

Backblaze's [2025 Q1 report](https://www.backblaze.com/blog/backblaze-drive-stats-for-q1-2025/)
publishes 4.97% quarterly AFR for this exact model. Our approximately 4.965%
rounds to the same value. This checks the quarterly result, not the workbook's
cumulative AFR or completeness of earlier source history.

The exact model is present above the 2,000-identity threshold in this fully
covered quarter, so backward search continues. This quarter does not establish
first deployment, first observed quarter or first qualifying quarter. No complete
zero quarter has been reached here. No cumulative-history, production-anchor or
production-matrix claim follows from this audit. Workbook retained positions
without calendar dates do not independently establish a Q1 row mapping.
