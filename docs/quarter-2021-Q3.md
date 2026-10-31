# Backward quarter audit: 2021 Q3

Localswim #0045 processed this complete quarter in the owner-approved
10-card workset: the 2026 Q2 repack (#0058) and nine historical quarters
(#0041–#0049). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2021 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2021.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 972,603,644 bytes; exact official HEAD size matched |
| Calendar | 92/92 days, 2021-07-01 through 2021-09-30 |
| Observations / drive-days | 17,395,221 |
| All-source inventory | 63 normalized models from 65 raw names |
| Model/serial identities observed during quarter | 197,385 |
| Daily failure flags | 580 |
| Projected daily Parquet | 102,271,130 bytes |
| Import receipt | 479,906 bytes |
| Summary frames and manifest | 1,546,007 bytes |
| ZIP, daily Parquet, import receipt and summary files | 1,076,900,687 bytes; excludes private staging evidence |
| First summary pass | 10.48 seconds; summary-cache miss |
| Guarded summary reuse | 0.14 seconds; cache hit |

Counts describe identities observed anywhere in the quarter, rather than
quarter-end installed populations. All source models remain in inventory:
21 match the known-HDD seed, 2 have explicit HDD evidence,
and 40 remain unclassified. Population alone does not establish
media class. The full inventory and raw-name mappings remain in private `audit.json`.

## Qualifying unclassified candidates

These 3 candidates meet the 2,000 observed-identity threshold and remain
visible for explicit historical classification. The frozen ingestion registry
and cache bytes were not rewritten.

| Model | Observed identities | Drive-days | Failure flags | Quarter-only AFR |
| --- | --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,345 | 303,035 | 4 | 0.482% |
| ST4000DM000 | 18,792 | 1,724,626 | 87 | 1.841% |
| HMS5C4040BLE640 | 12,741 | 1,170,611 | 6 | 0.187% |

## Source identity and acceptance evidence

The official HTTPS HEAD supplied `x-bz-content-sha1=none` and no large-file
SHA-1. **Publisher checksum verification was unavailable.** Exact advertised
size, local hashes, ZIP calendar validation and importer member CRC checks
provide retained integrity evidence. Local hashes are not publisher checksums.

- Local SHA-1: `bc30538fa2d77db6b26800fd76752c923973b5bb`.
- Local SHA-256: `01670ff560a2d3a50de9b74075f2d73ac4796735df9239f4eb92678c2b20f2fb`.
- All 92 expected daily members were present, with no duplicate, missing
  or unexpected calendar days. Strict ingestion verified actual row dates.

The maintained ingestion, projection and quarter audit completed successfully.
The audit reconciled source/receipt and partition hashes, calendar, footer/profile
lineage, numerical budgets and summary parity. Guarded warm reuse forbade daily
DataFrame reads/scans while allowing byte hashes and small summary reads. No CSV
was extracted to disk, no bad row dates were corrected, and no observations were
imputed. The archive stayed below the 2 GiB acquisition cap and the retained
quarter stayed below its 10 GiB additional-disk envelope.

Private evidence is retained under ignored `data/staging/0045/`: `envelope.json`,
`source-head.headers`, calendar expectations/preflight, `download.json`, `audit.json`
and `.txt`, phase resource files and `results-summary.json`. Report reconciliation
read receipts and the retained small quarter summary without another logical
daily scan. Fresh independent artifact review passed before handoff.

## Exact reference model and backward-search boundary

**HUH721212ALN604** has 10,843 observed identities,
996,553 drive-days and 14 daily failure flags. Its observed raw
alias is `HGST HUH721212ALN604`, spanning 2021-07-01
through 2021-09-30. Quarter-only AFR is 0.513%, calculated
as failures / drive-days × 365 × 100. The retained positive seed classifies it
as HDD; ALE variants remain separate SKUs.

The exact model exceeds 2,000 identities, so backward search continues. This
complete quarter is not a zero-observation boundary. Neither the first observed
quarter nor the first qualifying quarter is established. No original eligibility
anchor, cumulative-history completeness or production-matrix claim follows.

## Phase measurements and limits

| Phase | Admitted envelope | Admission wait | Sampled process-tree peak |
| --- | --- | --- | --- |
| Download command | 22.15 s | 0.0005 s | 0.02 GiB |
| Projection command | 30.24 s | 0.0004 s | 0.33 GiB |
| Audit command | 13.79 s | 0.0012 s | 2.16 GiB |

This quarter used one worker with two Polars threads. Admission waits are separate
from elapsed phase envelopes; those envelopes include process launch/import and
cleanup. The first summary pass was cold for the summary cache only; the operating
system cache was not flushed. Working-set samples can miss brief peaks and sums
can count shared pages.

All nine historical pipelines succeeded in a parent-measured 105.7669-second
envelope. The coordinator allowed up to eight source CPU phases and seven heavy
summary phases. This does not establish nine simultaneous heavy summaries. The
concurrent 2026 Q2 repack shared system resources, so global CPU/RAM measurements
do not constitute a dedicated, controlled nine-source benchmark or a controlled
serial speedup. The parent preservation check found all 15 protected older
quarter baselines unchanged.

Fresh independent artifact review passed. Parent-coordinated B2 retention,
full isolated restore, guarded warm reuse and preferred `cache-v2` publication
also passed; see the [batch handoff](ten-item-backfill-and-repack.md). Data and
private evidence remain outside Git. Owner acceptance remains separate from
technical verification.
