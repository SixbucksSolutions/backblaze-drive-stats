# 2015 Q3 through 2017 Q4: ten-quarter epoch backfill

The owner authorized source cards #0064–#0073 for this turn, following approval
of the previous workset. All ten entered In Progress before work. The next ten
cards (#0074–#0083, through 2013 Q1) remain Ready for Work and were not started.
Source execution remains capped at ten quarters per turn, with six direct
subagents and depth one. Native worker processes have separate admission limits.

Underlying observations are supplied by [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Their published catalog uses quarterly archives from 2016 and annual archives
before then. Processing and analysis are independent Sixbucks Solutions work.

## Source results

| Quarter | Valid days | Known observations | Coverage |
| --- | --- | ---: | --- |
| 2015 Q3 | 92/92 | 4,497,107 | Complete |
| 2015 Q4 | 91/92 | 4,881,600 | Incomplete: November 1 |
| 2016 Q1 | 91/91 | 5,467,888 | Complete |
| 2016 Q2 | 91/91 | 5,971,169 | Complete |
| 2016 Q3 | 92/92 | 6,443,112 | Complete |
| 2016 Q4 | 92/92 | 6,589,448 | Complete |
| 2017 Q1 | 89/90 | 6,632,104 | Incomplete: January 30 |
| 2017 Q2 | 84/91 | 6,979,867 | Incomplete: April 12–18 |
| 2017 Q3 | 92/92 | 8,004,840 | Complete |
| 2017 Q4 | 92/92 | 8,266,213 | Complete |

The workset adds **906 valid days and 63,733,348 recorded drive-days**: seven
complete quarters and three explicit partial recoveries. Full-quarter Count and
AFR remain null for incomplete quarters; known identity totals are lower bounds.
Publisher SHA-1 was unavailable. Exact advertised byte lengths, local hashes,
actual archive calendars and member CRCs were checked without claiming a
publisher-checksum comparison.

### Annual source selection

The ten quarters use nine unique ZIPs. Both 2015 quarters share the official
**843,026,671-byte annual archive**. One coordinator downloaded it, pinned its
size/SHA-1/SHA-256 and completed ownership before the quarter workers launched.
Those workers verified and reused the same immutable archive.

The importer now supports optional `--quarter YYYY-QN` selection. It validates
archive-wide names and duplicate safety, requires the selected quarter's exact
calendar before output mutation, and reads only selected CSV bodies. All ten
new receipts carry `selectedQuarter`; the annual ZIP's whole-file SHA and URL
remain the source identity. No 2015 Q1 or Q2 bodies were read this turn.

Default importer output remains byte-compatible. The maintained change passed
fresh independent review, **150 Python tests**, Ruff lint/format and Pyright.
Independent probes also verified Q4 selection and default receipt/Parquet bytes.
See the [import example](historical-generator.md).

### Source exceptions and recovery

- **2015-11-01** and **2017-01-30** are CRC-valid, header-only CSV members.
  No observations are present. They are unavailable captures, not measured
  zero-drive or zero-failure days. Isolated recoveries preserved 31 and 29
  existing partitions respectively, then strictly projected 60 remaining valid
  days for each quarter.
- **2017-04-12 through 2017-04-18** each contain one empty serial number.
  Independent checks found no other required-field faults or normalized
  duplicates. The current strict contract conservatively excludes those whole
  days: **588,763 rows, including 588,756 otherwise valid rows**. All original
  91 daily projections and their receipt remain untouched for any later,
  separately reviewed finer-grained recovery policy. No synthetic serial,
  silent deduplication, row repair or zero exposure was introduced.

The 2017 Q2 recovery lives in an isolated canonical root. The private retention
plan has one exact source-root exception for that quarter, while published
object keys remain ordinary `processed/2017-Q2/...` and quarter-summary keys.
The failed original 91-day folder was not overwritten or promoted as accepted
input. The other two recoveries were promoted by immutable additions, with
independent byte/closure checks and guarded reuse at their normal retained roots.

Fresh non-author reviews checked all recovered partition bodies, profiles,
dates, normalized identities, source samples, summaries and original preservation.
Each quarter received three complete streamed CSV-day multiset comparisons.
Warm-summary verification attempted zero daily DataFrame reads or scans.

## Reporting epoch research

Research r003 preserves the same **22-model analysis candidate**, rather than
expanding it with historical fleet discoveries. A fresh reviewer recomputed all
**968 model-quarter ledger rows**, 44 manifests and 88 summary-object hashes.

| Model | First observation in searched data | First proven ≥2,000 quarter | Evidence |
| --- | --- | --- | --- |
| ST8000DM002 | 2016-05-11 | 2016 Q2 | Complete quarter: 2,754 identities |
| ST8000NM0055 | 2016-12-06 | 2017 Q1 | Incomplete quarter: at least 2,460 identities |
| ST12000NM0007 | 2017-09-06 | 2017 Q4 | Complete quarter: 7,242 identities |

These are searched-window reporting facts, not physical drive ages or proof
against older deployment/reentry. Earlier source history remains queued.

ST8000NM0055 illustrates an important separation. Its complete 2016 Q4 has
60 observed identities. Its incomplete 2017 Q1 already contains **2,460 distinct
valid identities**, proving that the 2,000 threshold was met even though its exact
full-quarter Count and AFR remain unknown. Its first *complete* qualifying
quarter in the retained data is 2017 Q3 (14,433).

The existing v1 evidence contract requires a complete qualifying quarter. r003
therefore proposes a reviewed partial-threshold evidence amendment; it does not
silently change production eligibility or shift the model's epoch two quarters
later. #0063/#0017 retain that integration work, the pinned cohort decision and
correction of unjustified `anchorSearchComplete` claims. No new production AFR
matrix or full-domain/cumulative-history certification is published here.

## Measurements and preservation

The original native envelope took **64.38 seconds**, including the single annual
download prelude and ten worker pipelines. The annual download command itself
took **20.74 seconds**. Seven audits succeeded; three stopped on the source
defects above. Their later guarded recovery envelopes were **8.02 seconds**
(2017 Q2), **14.87 seconds** (2017 Q1) and **12.58 seconds** (2015 Q4).

The coordinator permitted eight CPU/heavy phases and two Polars threads per
worker. An eleven-contender probe independently demonstrated eight-way admission,
waiting, exception release and permit recovery. Ten launched workers do not prove
ten simultaneous heavy phases. Sampled worker working set peaked at **2.57 GiB**,
minimum available system RAM was **32.17 GiB**, and whole-machine average CPU was
**43.83%**. These are sampled measurements, not operating-system quotas or a
controlled serial speedup. Whole-machine measurements include other activity.

Preservation hashing, independent review and cloud work are outside that native
envelope. The final completion timestamp includes later preservation work; it
must not be subtracted from the start timestamp and called the ETL-only time.
A fresh actual-byte audit verified all **9,896 protected files / 41,941,440,426
bytes** unchanged across 34 prior quarter roots, preferred/repacked data and
retained private evidence. Shared annual ZIPs make per-quarter footprints
non-additive; the physical disk delta counts the annual ZIP once.

## Retention and size

The reviewed candidate adds **946 payload objects / 425,761,375 bytes**, retaining
the old 34-quarter payloads and metadata references without copying or rewriting
them. Its combined catalog has **44 quarters: 38 complete and six partial**,
with 4,006 valid daily partitions. The full recovery closure contains **4,182
payload objects / 4,368,101,978 bytes**.

Across those 44 quarters, original CSV members for retained valid days total
**252,912,112,235 bytes**, versus **4,285,279,527 bytes** of six-column daily
Parquet: **1.6944% of CSV size**. Quarter ratios range from **1.4593% to 2.6704%**;
daily Parquet uses roughly **5.74–6.88 bytes per recorded drive-day**. These
savings combine column projection, encoding and Zstandard, not compression alone.
ZIPs, receipts and summary caches are excluded from that comparison. Partial
quarters use the same retained days on both sides.

Actual encrypted SHA-256 readback, repeated zero-write reuse, serial separate-root
restore and ten guarded restored-summary hits passed. A fresh reviewer rehashed
all 946 original/restored payloads and independently repeated the ten guarded
hits, including the exact isolated 2017 Q2 source route. Remote assurance rests
on the parent execution receipt; the reviewer did not access cloud credentials.

The separately reviewed publisher advanced `drive-stats/current-cache.json`
after acceptance, read back its exact bytes/encryption and archived the exact
prior pointer by hash. Old immutable recovery references remain usable. No old
payload transfers, cache-v1 writes or deletes occurred. One coordinator owns the
transition; its pointer recheck is not distributed compare-and-swap. The private
adapter checks passed 32 frozen fake-SDK cases before actual execution.

Local-mirror acceptance is recorded separately after its guarded copy and
verification. Detailed evidence stays in ignored per-card staging directories
and `data/staging/batch-0064-0073/`; raw CSV/Parquet, per-drive identities, private
connection settings and credentials stay outside Git.
