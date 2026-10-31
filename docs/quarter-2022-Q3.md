# Backward quarter audit: 2022 Q3

Localswim #0041 processed this complete quarter in the owner-authorized
next workset, alongside eight other historical quarters and the separate
2026 Q2 repack. Source data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2022 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2022.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 792,884,358 bytes; official HEAD size matched |
| Verified observation calendar | 92/92 days, 2022-07-01 through 2022-09-30 |
| Observations / drive-days | 20,591,757 |
| All-source inventory | 70 canonical models from 74 raw names |
| Model/serial identities observed during quarter | 232,016 |
| Daily failure flags | 963 |
| Daily projected Parquet | 119,863,715 bytes |
| Committed import receipt | 507,301 bytes |
| Summary frames and manifest | 1,766,184 bytes |
| ZIP, daily Parquet, import receipt and summaries | **915,021,558 bytes**; excludes private staging evidence |
| First summary pass | 6.59 seconds; cache miss |
| Guarded warm pass | 0.13 seconds; cache hit |

The receipt-inclusive footprint counts retained processing artifacts, including
`import-metadata.json`. Worker completion recorded 915,118,256
bytes across its broader quarter/staging envelope at that time; staging evidence
can grow after completion. Counts represent identities observed anywhere in the
quarter, rather than an installed population at quarter end.

All source models remain inventoried: 23 match the known-HDD seed,
2 additional models have explicit HDD evidence, and
45 remain unclassified. Neither population nor a model-name
pattern supplies positive media evidence.

## Qualifying unclassified candidates

Every unclassified canonical model with at least 2,000 observed identities is
listed below, without a name-pattern filter. These remain candidates for explicit
classification; the frozen registry and accepted cache bytes are unchanged.
Smaller unclassified models remain in the private all-source inventory.

| Model | Observed identities | Drive-days | Failure flags | Quarter-only AFR |
| --- | --- | --- | --- | --- |
| HMS5C4040ALE640 | 3,735 | 341,509 | 3 | 0.321% |
| ST4000DM000 | 18,523 | 1,683,920 | 202 | 4.378% |
| HMS5C4040BLE640 | 12,744 | 1,170,925 | 14 | 0.436% |

## Source and acceptance evidence

The official HEAD returned `x-bz-content-sha1=none`; no valid publisher SHA-1 was
advertised. **Publisher checksum verification was unavailable.** Exact byte size,
local hashes, ZIP member CRC checks and internal observation-date validation
provide retained integrity evidence; local hashes are not a publisher comparison.

- Local SHA-1: `4cdad249cfab07a55b31fa7ec37d309dfebfd13b`.
- Local SHA-256: `2fc497f65a95b76777fb6680cf88a8c261116b30e70aa25eef45e81208293888`.
- All 92 expected daily members and internal observation dates passed;
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

**HUH721212ALN604** has **10,811 observed identities**,
992,989 drive-days and 27 daily failure flags.
Observed raw aliases: `HGST HUH721212ALN604`. Retained observations span
2022-07-01 through 2022-09-30.
Quarter-only AFR is **0.992%**, calculated as failures /
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
| Download | 22.09 s | 0.00 s | 0.02 GiB |
| Projection | 29.99 s | 0.00 s | 0.35 GiB |
| Audit | 10.20 s | 12.41 s | 2.59 GiB |

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

Private evidence remains under ignored `data/staging/0041/`, including source
HEAD/envelope, `download.json`, `calendar-preflight.json`, `audit.json` and `.txt`,
phase resources and `results-summary.json`. Shared batch evidence is under
`data/staging/batch-0041-0049/`. Data and private evidence stay outside Git.
Fresh independent artifact review passed. Parent-coordinated B2 retention,
full isolated restore, guarded warm reuse and preferred `cache-v2` publication
also passed; see the [batch handoff](ten-item-backfill-and-repack.md). Data and
private evidence remain outside Git. Owner acceptance remains separate from
technical verification.
