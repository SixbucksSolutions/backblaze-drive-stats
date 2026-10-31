# Nine historical quarters and the 2026 Q2 repack

The owner approved the existing RFR cards without changing their lanes and
authorized the next capped workset: nine historical quarter cards (#0041–#0049)
plus the lossless 2026 Q2 repack (#0058). All ten moved In Progress before work.
Approval comments preserve that distinction from owner-controlled Completed.

Four author packets handled the repack and three groups of historical quarters.
Fresh Sol / High reviewers checked their results. Six direct agents and depth one
remained the ceiling; native process concurrency was managed separately.
Underlying observations come from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Processing and analysis are independent Sixbucks Solutions work.

## Historical ingestion

| Quarter | Valid days | Source observations | Exact ALN604 identities |
| --- | --- | --- | --- |
| 2022 Q3 | 92/92 | 20,591,757 | 10,811 |
| 2022 Q2 | 91/91 | 19,424,436 | 10,819 |
| 2022 Q1 | 90/90 | 18,845,260 | 10,827 |
| 2021 Q4 | 92/92 | 18,385,255 | 10,833 |
| 2021 Q3 | 92/92 | 17,395,221 | 10,843 |
| 2021 Q2 | 91/91 | 16,226,492 | 10,848 |
| 2021 Q1 | 90/90 | 15,287,372 | 10,834 |
| 2020 Q4 | 92/92 | 14,631,135 | 10,838 |
| 2020 Q3 | 92/92 | 13,553,809 | 10,849 |

ALN604 means exact **HUH721212ALN604**, separate from ALE variants. Counts are
model/serial identities observed during each quarter, not quarter-end population.
The model is present at the oldest source loaded here; its first observed and
first >=2,000 quarters and a complete zero-observation boundary remain unverified.
The provisional 2019 Q1 queue floor is not a proven anchor.

Publisher SHA-1 was unavailable for these sources. Exact official sizes, locally
recorded hashes, actual calendars/internal dates and ZIP member CRCs were checked
without claiming a publisher checksum was verified. All-source inventory retains
boot/unknown devices and qualifying off-seed candidates. Population alone does
not establish media or current purchase relevance.

Independent reviews checked every daily hash/footer/profile/lineage, three
complete CSV-day projected multisets per quarter, typed summary budgets, exact
model aliases, receipt-inclusive bytes and guarded warm reuse. All **1,449**
previously protected files across 15 quarters and generation records remained
byte-identical. Raw CSV was streamed from ZIP and never extracted to disk.

## Admission and measurements

Nine source pipelines ran with two Polars threads each. Windows named semaphores
limited admitted source CPU phases to eight and heavy source summaries to seven,
reserving a heavy-job allowance for the concurrent guarded Q2 repack. A real
nine-process no-data probe confirmed the limits, permit waiting and release after
an injected admitted-phase exception. Suspended startup and owned jobs contain
descendant writers on failure; hard-killed workers can lose permits, so waits
have a bounded timeout and a timeout alone is not proof of source-workload error.

All nine source pipelines succeeded. Their worker envelope took **105.77 s**;
sampled combined source-worker working set peaked at about **14.34 GiB**, and
sampled available system RAM reached a minimum of about **22.05 GiB**. Whole-
machine average CPU was **36.41%**. These figures coexist with the separate repack;
source-worker sums exclude its process, while system/CPU figures include desktop
activity. They do not establish a controlled serial speedup or ten-heavy capacity.

Per-phase reports separate admission wait from the admitted envelope. That
envelope includes process launch, imports and cleanup rather than precisely
timing native execution. Nine launched pipelines do not imply nine simultaneous
heavy summaries. The 8 GiB free-RAM stop and sampled 9 GiB per-quarter disk stop
remain operational guards, not hard operating-system quotas.

## Lossless repack and preferred generation

The [full 2026 Q2 repack](repack-2026-Q2.md) reduced daily Parquet from
**221,850,393 to 183,750,684 bytes (17.17%)**. Independent comparison covered
all 91 days / 31,968,003 rows with exact typed/null multiset parity, enriched
metadata and unchanged numeric drive/capacity summaries.

The first local attempt stopped at an exact metadata-snapshot assertion: the
old cache preceded two already-approved HDD classifications. A read-only resume
restricted drift to those two models' media/evidence fields, preserved all raw
names and identity fields, and retained the full data/metric checks. No daily
files were repacked twice and no analytical cohort or formula changed.

The preferred storage namespace is now **`drive-stats/cache-v2`**, identified by
**`drive-stats/current-cache.json`**. This is a storage generation, not an AFR
formula or Parquet-profile version change. It contains one current enriched
summary variant per quarter; the old mixed-layout Q2 files and duplicate summary
variants remain preserved under the legacy `cache-v1` references.

The reviewed catalog covers **24 quarters, 2020 Q3 through 2026 Q2**, with
**2,286 payload objects / 3,282,681,671 bytes**. Fourteen existing cloud quarters
were copied server-side; nine newly ingested quarters and repacked Q2 were
uploaded from verified local files. Every payload passed actual SHA-256/AES256
readback, a repeated zero-write pass, complete isolated restore and **24 guarded
restored-summary hits**. Independent local review rehashed all source/restored
objects and checked the exact closure, daily profiles, numeric totals and old
protected files. Remote assurance is execution evidence; the independent reviewer
did not access cloud credentials or independently download the cloud payload.

The copy/reuse/restore execution took **363.50 s**, separate from ingestion and
repacking. Only after execution and independent candidate review passed did the
separately reviewed publisher replace the preferred pointer and verify readback
and encryption. Immutable catalog/manifests retain their content hashes. The
publisher archives an existing legacy pointer and can reconcile an interrupted
successful PUT without rewriting it. One coordinator owns publication; this is
not a distributed compare-and-swap transaction. No old-prefix writes or deletes
occurred.

For current local analysis use **`data/preferred-cache-v2/`**; private runtime
discovery is recorded in `data/preferred-cache.json`. Existing original/staging
paths and raw ZIPs remain intact. Do not mix a summary's source hashes with a
different daily layout. Future retention should follow the preferred pointer
rather than hardcode the legacy prefix.

## Coverage and next work

The current catalog has **23 complete quarters and one explicitly incomplete
2022 Q4**, with December 10 unavailable. Lossless repacking and namespace
publication neither repair that gap nor prove original model ages or cumulative-
history completeness. No new public matrix generation follows from this work.

The owner capped worksets at ten quarters. The six remaining initially queued
source cards (#0050–#0055, 2020 Q2 through 2019 Q1) come next alongside eligible
#0017 evidence/integration work. Scope earlier quarters only when the actual
model boundary requires them; do not fill a concurrency ceiling with irrelevant
history. Keep memory-aware heavy admission and six direct agents/depth one.

Detailed source/repack/publication evidence remains in ignored per-card staging
directories, `data/staging/batch-0041-0049/`, and `data/staging/0058/`. Private
processing blobs, raw data, runtime credentials and cache settings stay out of Git.
