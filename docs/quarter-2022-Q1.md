# Backward quarter audit: 2022 Q1

Localswim #0043 processed this complete quarter in the owner-authorized
next workset, alongside eight other historical quarters and the separate
2026 Q2 repack. Source data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2022 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2022.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,064,968,390 bytes; official HEAD size matched |
| Verified observation calendar | 90/90 days, 2022-01-01 through 2022-03-31 |
| Observations / drive-days | 18,845,260 |
| All-source inventory | 65 canonical models from 69 raw names |
| Model/serial identities observed during quarter | 212,404 |
| Daily failure flags | 664 |
| Daily projected Parquet | 109,514,579 bytes |
| Committed import receipt | 496,379 bytes |
| Summary frames and manifest | 1,623,556 bytes |
| ZIP, daily Parquet, import receipt and summaries | **1,176,602,904 bytes**; excludes private staging evidence |
| First summary pass | 5.99 seconds; cache miss |
| Guarded warm pass | 0.19 seconds; cache hit |

The receipt-inclusive footprint counts retained processing artifacts, including
`import-metadata.json`. Worker completion recorded 1,176,704,675
bytes across its broader quarter/staging envelope at that time; staging evidence
can grow after completion. Counts represent identities observed anywhere in the
quarter, rather than an installed population at quarter end.

All source models remain inventoried: 22 match the known-HDD seed,
2 additional models have explicit HDD evidence, and
41 remain unclassified. Neither population nor a model-name
pattern supplies positive media evidence.

## Qualifying unclassified candidates

Every unclassified canonical model with at least 2,000 observed identities is
listed below, without a name-pattern filter. These remain candidates for explicit
classification; the frozen registry and accepted cache bytes are unchanged.
Smaller unclassified models remain in the private all-source inventory.

| Model | Observed identities | Drive-days | Failure flags | Quarter-only AFR |
| --- | --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,552 | 312,911 | 21 | 2.450% |
| ST4000DM000 | 18,614 | 1,670,395 | 117 | 2.557% |
| HMS5C4040BLE640 | 12,743 | 1,145,719 | 15 | 0.478% |

## Source and acceptance evidence

The official HEAD returned `x-bz-content-sha1=none`; no valid publisher SHA-1 was
advertised. **Publisher checksum verification was unavailable.** Exact byte size,
local hashes, ZIP member CRC checks and internal observation-date validation
provide retained integrity evidence; local hashes are not a publisher comparison.

- Local SHA-1: `284e47c9be8511053d701d6f6177683e1c28cf22`.
- Local SHA-256: `ec32f53fe86e5d03abf1b719e4cd258cba709eed0f0b552e96bf0da31bcfe0e2`.
- All 90 expected daily members and internal observation dates passed;
  no duplicate, missing or unexpected calendar days were accepted.

Catalog file counts were used only for source discovery. The separate 2022 Q4
December 10 defect was not assumed to affect this quarter; this quarter passed its
own strict validation. No date relabeling, source reconstruction or CSV extraction
was performed. The ZIP remained within the 2 GiB acquisition cap.

The native audit reconciled source/receipt and partition hashes, footer/profile
lineage, calendar, numerical budgets and summary parity. Guarded warm reuse hit
the summary cache while daily DataFrame reads/scans were forbidden; byte hashes
and small summary reads remained permitted. Report reconciliation reread only
small receipts and the retained quarter summary, with matching exact-reference
identity, exposure and failure totals. Fresh independent artifact review passed
before handoff.

## Exact reference model and search boundary

**HUH721212ALN604** has **10,827 observed identities**,
973,429 drive-days and 14 daily failure flags.
Observed raw aliases: `HGST HUH721212ALN604`. Retained observations span
2022-01-01 through 2022-03-31.
Quarter-only AFR is **0.525%**, calculated as failures /
drive-days × 365 × 100. Positive seed evidence classifies this exact model as HDD;
ALE variants remain separate SKUs.

This exact population exceeds the 2,000-identity threshold; backward search
continues. Exact-reference counts would remain reportable below that threshold.
This quarter is not a zero-observation boundary. First appearance, first qualifying
quarter, original eligibility anchor and cumulative-history completeness remain
unverified. No production matrix or full cumulative AFR is established here.

## Phase measurements and batch limits

| Phase | Admitted command envelope | Admission wait | Sampled process-tree peak |
| --- | --- | --- | --- |
| Download | 49.68 s | 0.00 s | 0.02 GiB |
| Projection | 28.32 s | 0.00 s | 0.31 GiB |
| Audit | 9.93 s | 11.94 s | 2.39 GiB |

Each phase's elapsed measurement includes process launch/import and cleanup.
Admission waiting is separate, rather than work execution time. This quarter used
one native worker with two Polars threads. The first pass was cold for the summary
cache; the operating-system cache was not flushed. Approximately 0.25-second
working-set sampling can miss short peaks or count shared pages more than once.

All nine historical-quarter workers succeeded in the **105.7669-second** ETL
batch envelope. The maximum simultaneous admitted source CPU phases was eight;
heavy summary phases peaked at seven. Nine active workers do not establish nine
simultaneous heavy audits. The concurrent 2026 Q2 repack contributed to whole-machine
CPU and available-RAM observations, so these are not isolated controlled speedup
measurements or full-history aggregation bounds. Parent-coordinated preservation
checked all **1,449** recorded files across the 15 previously retained quarters
and generation artifacts; they remained byte-identical.

Private evidence remains under ignored `data/staging/0043/`, including source
HEAD/envelope, `download.json`, `calendar-preflight.json`, `audit.json` and `.txt`,
phase resources and `results-summary.json`. Shared batch evidence is under
`data/staging/batch-0041-0049/`. Data and private evidence stay outside Git.
Fresh independent artifact review passed. Parent-coordinated B2 retention,
full isolated restore, guarded warm reuse and preferred `cache-v2` publication
also passed; see the [batch handoff](ten-item-backfill-and-repack.md). Data and
private evidence remain outside Git. Owner acceptance remains separate from
technical verification.
