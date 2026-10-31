# Backward quarter audit: 2025 Q4

Localswim #0028 acquired and privately audited one quarter after owner acceptance
of the 2026 Q1 pilot. Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official
[2025 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2025.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,157,851,346 bytes; publisher SHA-1 and local SHA-256 verified before promotion |
| Calendar | All 92 days, 2025-10-01 through 2025-12-31 |
| Observations / drive-days | 30,941,708 |
| All-source inventory | 77 normalized models from 78 raw names |
| Model/serial identities observed during quarter | 341,664 |
| Daily failure flags | 945 |
| Projected daily Parquet | 177,706,587 bytes |
| Summary frames and manifest | 2,447,092 bytes |
| Download | 26.94 seconds |
| Projection | 30.78 seconds; sampled own-process-tree peak 0.49 GiB |
| First summary pass | 6.39 seconds; summary-cache miss |
| Guarded summary reuse | 0.23 seconds; cache hit |
| Whole audit | 9.88 seconds; sampled own-process-tree peak 3.82 GiB |
| Retained quarter footprint | 1,338,557,451 bytes, plus small private audit/review evidence |

One quarter worker used four Polars threads. Download, projection and audit ran
sequentially because each consumes the preceding output. The measured first
summary pass was cold only for the summary cache; the operating-system cache was
not flushed. Memory was sampled approximately every 0.25 seconds and can miss
short peaks. These measurements do not establish full-history aggregation limits.
The source stayed below 2 GiB and additional disk use stayed below 10 GiB.

The download used a resumable `.part` file. The exact content length and publisher
large-file SHA-1 `33406034541a209357b62807ad5d99bb0c73c871` were checked before
renaming it to the final ZIP. Local SHA-256 is
`57d0667cc03f23f16ded693e1e83e1ed28b7ea42d54b88d221734f5926030cb5`.
No CSV was extracted to disk. The production projector verified daily ZIP CRCs.

## Acceptance evidence

The production `prepare_quarter_zip.py` and `tools/verify_quarter.py` completed
successfully using the retained Q2 registry and pattern configuration. The audit
checks complete calendar coverage, ZIP/receipt and partition hashes, Parquet
profile/footer lineage, numerical budgets and summary parity. The guarded second
pass forbids daily DataFrame reads/scans while allowing byte hashing and summary
reads. All-source model inventory, exact raw aliases and media classification
remain in the private audit report; unclassified models are not silently omitted.

Evidence lives under ignored `data/staging/0028/`: `q4-audit.json` and `.txt`,
`download.json`, `source-head.headers`, `envelope.json`, phase resource samples,
`results-summary.json`, and `workbook-quarter-comparison.json`. Preservation
before/after evidence verifies 194 existing files byte-identical, including Q1/Q2
ZIPs, daily partitions, quarter summaries and existing snapshot objects.

Fresh independent review reconciled all 92 daily partitions and 552 row groups,
source/receipt and summary hashes, exact-SKU numerical budgets and the 194-file
preservation proof. Three independently streamed CSV days matched complete
projected row multisets. A separate guarded summary check confirmed a warm hit
with zero daily logical reads/scans. This is bounded independent CSV parity, not
a second full-quarter CSV parse. Evidence: `independent-review.json` and `.txt`.

## Exact reference model and search boundary

**HUH721212ALN604** has 9,877 observed identities, 900,963 drive-days and 76 daily
failure flags, with observations spanning October 1 through December 31. Its sole
observed raw alias is `HGST HUH721212ALN604`. Quarter-only AFR is about 3.079%.
Count means identities seen anywhere in the quarter, not quarter-end population.
ALE variants remain separate SKUs.

The model is present above the 2,000-identity threshold in this fully covered
quarter. Backward search therefore continues; neither first deployment nor its
first qualifying quarter is established. The first observed and first qualifying
quarters must be recorded separately after earlier evidence exists. No zero
quarter has been reached by this audit.

## Workbook comparison limits

The committed Q4 reference fixture adds one terminal retained row to 18 models
relative to Q3. Under the explicitly conditional inference that these appended
rows represent calendar Q4, all 18 Count values and all 18 Failed values agree
exactly with this audit. Those columns have matching quarter-only meanings:
distinct observed model/serial identities and summed daily failure flags.

The workbook encodes relative retained positions without calendar dates, so this
agreement does not independently prove the calendar mapping. ST12000NM0007 has
no appended row and is excluded from the terminal-row comparison. New requires
earlier first-appearance evidence; Retired requires last-seen history and has a
special newest-boundary rule. Count Delta requires the preceding retained row.
Cumulative AFR and AFR Delta are not comparable to quarter-only AFR without older
history and cumulative exposure. No production matrix or cumulative-history or
production-anchor claim was generated, and no 2025 Q4 cache was uploaded to B2.

## Staffing observation

This execution used one authoring agent, one active ETL process tree and four
Polars threads. More agents would not parallelize the dependent phase chain.
Useful separate work includes independent source/receipt reconciliation,
independent selected-day CSV parity and documentation review after artifacts
exist. Those are review tasks, not additional ETL workers. Independent review is
assigned separately by the primary; cross-quarter parallel throughput was not
measured here.

The [staffing and fanout recommendation](backfill-throughput.md) distinguishes
agent operators, ETL processes, Polars threads and independent review. The owner
approved a four-quarter benchmark for the next batch after this turn's handoff.
