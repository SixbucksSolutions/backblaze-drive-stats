# First backward quarter pilot: 2026 Q1

Localswim #0027 processes one quarter before wider backfill. The retained 2026 Q2
cache is the baseline. No older quarter was downloaded for this pilot, and no
production matrix or cumulative-history claim was generated.

Backblaze supplies the source data through its
[Drive Stats program](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
The source archive is
[2026 Q1](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2026.zip).
The software and these measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,312,921,361 bytes; publisher SHA-1 and local SHA-256 verified |
| Calendar | All 90 days, 2026-01-01 through 2026-03-31 |
| Observations / drive-days | 30,597,484 |
| Model inventory | 79 normalized models from 80 raw names |
| Model/serial identities observed during the quarter | 351,095 |
| Daily failure flags | 1,030 |
| Projected daily Parquet | 175,959,567 bytes |
| Summary frames and manifest | 2,512,007 bytes |
| ZIP download | 28.7 seconds |
| Projection | 35.3 seconds; sampled process-tree peak 0.46 GiB |
| First summary pass | 5.70 seconds, summary-cache miss |
| Guarded summary reuse | 0.24 seconds, cache hit |
| Whole audit | 10.0 seconds; sampled process-tree peak 3.60 GiB |

These are one-machine measurements with four Polars threads and one quarter
worker. The first summary pass was cold only with respect to the summary cache;
the operating-system file cache was not flushed. Sampled process-tree memory can
miss short peaks, and these results do not bound full-history aggregation memory.
The quarter's distinct identities are not a quarter-end installed-drive count.

The source ZIP SHA-256 is
`cad66574292b89bae8ec8370dbb5e90d2e0b45d61341502708df328fdb15ed5c`.
The private summary input identity is
`f5197e5180063e8c4e7b46938cde851b84de02ca7f50fe258a56b2a1061ec24f`.

## Repeatable acceptance audit

Run projection with `prepare_quarter_zip.py`, then:

```console
uv run --frozen --no-sync python tools/verify_quarter.py --quarter 2026-Q1 --input-dir data/processed/2026-Q1 --source-zip data/raw/data_2026_Q1.zip --cache-root data/history-cache --registry config/backblaze-hdd-evidence-2026-Q2.json --patterns drives_of_interest_regexes.json --report-json data/staging/0027/new-audit.json --report-txt data/staging/0027/new-audit.txt
```

Both report paths must be new. Keep reports and cached identities private. The
audit verifies the full receipt calendar, ZIP identity, partition hashes, footer
lineage/profile, numerical budgets and summary parity. It retains all-source
model inventory, raw aliases and media/seed classification in its private report.
An existing summary must be a valid current-profile hit; this audit refuses a
legacy repack or a fallback to logical daily reads. Its second pass forbids daily
Polars reads/scans while permitting byte hashes and small summary reads.

An independent review checked every daily footer and ZIP member receipt, and
independently reparsed January 1, February 15 and March 31 to compare complete
projected row multisets. This is three-day independent CSV parity, not a second
full-quarter CSV reparse. The source/report/summary hashes and numerical totals
were reconciled separately. The retained 2026 Q2 archive, all 91 projected daily
files, summary objects/manifests and paired snapshot objects remained byte-identical
to the pre-pilot lineage evidence.

Detailed evidence is retained under ignored `data/staging/0027/`, including the
resource samples, audit report, independent review and Q2 preservation proof.
No raw CSV was extracted to disk; no data file is committed to Git.

## Backward-search stopping rule

The owner's reference model is **HUH721212ALN604**. Keep this exact normalized SKU
separate from similar ALE variants. Record its first observed quarter and first
quarter with at least 2,000 observed drives separately. Continue backward until a
fully covered quarter has zero observations across its evidenced raw aliases;
missing or incomplete coverage is unknown, not zero.

The workbook's 28 retained positions imply 2019 Q1 only if they are consecutive
and end at 2025 Q4. The legacy generator omits below-threshold quarters before
assigning consecutive relative positions, and its fixtures lack calendar dates.
Consequently 2019 Q1 is a provisional queue floor. Extend the quarter cards earlier
if the model is still present there. One complete zero quarter meets this bounded
search rule; it does not prove global inception or exclude older deployment and
reentry. Cumulative exposure and production anchor evidence remain separate gates.

Whether the old Iceberg source omitted history is unverified. An observation-date
coverage comparison is required; metadata update timestamps do not establish that
coverage. The historical workbook alone cannot settle the question.

Quarter cards #0028–#0055 cover 2025 Q4 back through 2019 Q1. They stay Ready for
Work behind pilot acceptance. Wider parallel execution needs the owner's next
direction; creating the cards does not start their downloads.
