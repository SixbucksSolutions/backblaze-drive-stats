# Source history through the oldest published observations

The final authorized source workset (#0074–#0083) reaches the start of the
published [Backblaze Drive Stats dataset](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
The requested 2013 Q1 period has no published captures in the official annual
archive. It is recorded as unavailable, with unknown metrics and no synthetic
Parquet or summary dataset.

Backblaze explains that collection began on **2013-04-10**, with some drives
already in service. Independent archive and member-body checks corroborated that
date: 266 daily files through 2013-12-31, no internal filename gaps, 21,195 rows
on the first day and 27,223 on the last. This is a published observation boundary,
not physical drive inception or complete pre-capture exposure. [Backblaze's dataset history](https://www.backblaze.com/blog/10-stories-from-10-years-of-drive-stats-data/)

Processing and analysis are independent Sixbucks Solutions work. Backblaze's
source data and branding retain their own rights and usage terms.

## Final source workset

| Requested period | Retained days | Known observations | Disposition |
| --- | --- | ---: | --- |
| 2013 Q1 | No published captures | Unknown | Unavailable; no dataset |
| 2013 Q2 | 82/91 | 1,820,184 | Published-domain prefix boundary |
| 2013 Q3 | 92/92 | 1,209,274 | Complete calendar |
| 2013 Q4 | 92/92 | 2,062,043 | Complete calendar |
| 2014 Q1 | 90/90 | 2,617,973 | Complete calendar |
| 2014 Q2 | 91/91 | 2,996,584 | Complete calendar |
| 2014 Q3 | 92/92 | 3,338,425 | Complete calendar |
| 2014 Q4 | 91/92 | 3,629,432 | Header-only November 2 excluded |
| 2015 Q1 | 90/90 | 3,877,265 | Complete calendar |
| 2015 Q2 | 91/91 | 4,253,279 | Complete calendar |

This workset adds **nine data-bearing quarters, 811 valid dates and 25,804,459
observations**, plus one reviewed unavailable-quarter record. The entire retained
source corpus now contains **53 datasets across 54 requested periods**: 45
complete-calendar quarters, eight partial quarters and the unpublished 2013 Q1
period. It holds **4,817 valid dates / 743,490,518 known observations**.

There are two distinct kinds of absent coverage:

- **99 calendar days before publication:** all 90 days of 2013 Q1 and April 1–9
  in 2013 Q2. These precede the source domain; they are not zero populations.
- **13 problematic captures within the published span:** 2014-11-02,
  2015-11-01, 2017-01-30, 2017-04-12 through 2017-04-18, 2018-02-25,
  2019-06-17 and 2022-12-10. Existing exact reviewed dispositions remain intact.

The source span contains 4,830 calendar days from 2013-04-10 through 2026-06-30.
Excluding those 13 captures leaves the 4,817 retained dates. Full-quarter Count
and AFR remain null for partial quarters; recorded identities are lower bounds.
The unavailable quarter has null Count, AFR and row count, not a zero-row cache.
Complete-calendar source coverage does not certify physical fleet completeness
or full lifetime exposure before observation began.

The six retained fields are date, serial number, raw model, capacity bytes,
failure flag and datacenter. All supplied models remain available before cohort
filtering. These inputs support the five Explore reports: deployments, model
distribution, total capacity, manufacturer capacity and datacenter capacity.
Retained source-header metadata first records `datacenter` on **2023-07-01
(2023 Q3)**. Earlier location values remain unknown; the location chart must
distinguish unreported locations from measured zero capacity. Production report
integration remains under #0017 and the [supporting-report contract](supporting-report-contract.md).

## Annual sources and validation

One primary owner reused the verified 2015 annual ZIP and downloaded the official
2014 and 2013 archives once each. Their exact compressed sizes are 843,026,671,
587,751,755 and 80,983,520 bytes. Every worker rechecked its immutable source pin.
Per-quarter footprints include shared annual bytes and cannot be summed as
physical disk usage. Native import timing excludes these bootstrap downloads.

The 2013 source exposes a valid publisher SHA-1 and was compared against it.
The 2014/2015 headers expose no usable publisher checksum; local SHA-1/SHA-256,
exact lengths, member CRCs and actual dates were verified without claiming a
publisher-checksum comparison for those archives.

The eight inputs with complete filename calendars used the maintained strict
quarter selector; seven completed, while 2014 Q4 stopped on its empty capture.
The exact 2013 Q2 boundary used a separately reviewed helper: only April 10–June
30 could be read, the nine absent prefix days stayed undefined, and the receipt
retained `selectedQuarter`, whole annual ZIP identity and a specific source
coverage exception. No general missing-date bypass was introduced.

2014 Q4 then stopped on a CRC-valid, header-only 2014-11-02 member. The separately
reviewed recovery preserved all 32 original daily files and projected 59 more
valid days. Its 91-day receipt/cache passed an independent actual audit and
immutable promotion: 95 canonical files matched the accepted bytes, the empty
capture remained absent and guarded warm reuse attempted zero daily reads.
The isolated recovery took **8.27 seconds**. No empty day was converted into
zero drive-days or zero failures.

Fresh non-author reviews checked every new daily payload, source lineage,
required values, dates, normalized identities, complete summary/inventory
budgets and three streamed full CSV-day multisets per data-bearing quarter.
The unavailable quarter received its own negative-evidence and no-output review.
Raw CSV files were never extracted or committed.

## Measurements and preserved evidence

The original native envelope took **14.61 seconds** with source ZIPs already
present and verified. It produced seven complete quarters, the 2013 Q2 boundary
dataset and the unavailable-quarter record, while 2014 Q4 stopped for later
recovery. This is not ten complete-quarter successes or a controlled serial
speedup. Bootstrap, final preservation hashing, independent review and cloud
work are outside that elapsed time.

The coordinator permitted eight CPU/heavy phases with two Polars threads per
worker. Sampled worker working set peaked at about **2.47 GiB**, minimum
available system RAM was **34.32 GiB**, and whole-machine average CPU was
**46.98%**. These are sampled observations, not hard operating-system quotas.
The unavailable metadata worker can release the projection barrier early; the
eight-permit gates provide the actual concurrency bound.

Independent checks verified **12,528 protected files / 47,267,148,280 bytes**
unchanged across the previous 44 accepted quarters, their preferred copies,
isolated 2017 Q2 source and retained evidence. The evidence-producing rehash
followed correction of a reviewer-only assertion about that isolated folder's
location; no source payload changed. A runner review also caught and corrected
success reporting that ignored a nonzero child exit. Regression probes verified
that all workers, typed successful results and zero exits are required before
the coordinator may report success.

The final nine datasets keep the enriched Parquet profile and reusable small
summaries. Across all 53 data-bearing quarters, corresponding retained CSV
members total **258,788,362,584 bytes**, versus **4,465,394,112 bytes** of daily
six-column Parquet: **1.7255%**, about **58× smaller**. This combines projection,
encoding and Zstandard. Receipts, caches and ZIP compression are excluded from
that comparison, and both sides use the same retained valid days.

## Availability, retention and handoff

Content-addressed source-availability and source-domain metadata separately
represent published-member dates, validated observation dates, unavailable
periods and exact partial receipts. They are metadata references, not empty
payload datasets. The combined catalog's `quarterCount` counts actual datasets;
its requested-period ledger also includes the unpublished quarter. A private
independent-acceptance wrapper binds both metadata objects and each available
partial quarter's exact receipt, manifest and daily payload hashes.

B2 encrypted transfer/readback, zero-write reuse, isolated restore and preferred
publication passed. The new delta contains **847 payloads / 186,487,415 bytes**;
the combined catalog references **5,029 payloads / 4,554,589,393 bytes**. Old
immutable payloads and recovery references remain preserved, with no old-payload
transfers, deletes or legacy writes. The prior remote pointer was archived.

The local preferred mirror passed an independent full 5,029-file hash and exact
keyset check. All 4,182 previous payloads and the prior local discovery record
remain preserved. The parent verified all 53 guarded quarter-summary hits; an
independent reviewer checked numerical budgets for 16 quarters covering every
new dataset, every partial dataset and the latest-quarter boundary. Daily
DataFrame reads were forbidden during warm checks. Unpublished 2013 Q1 has no
payload dataset or warm-hit count.

#0023 and all ten final source cards are ready for owner review. Technical
verification does not grant owner approval.

The first transfer attempt stopped on a guard before pointer publication. A
reviewed diagnostic resume retained the same plan and checks: it reused 169
verified objects, copied the remaining 678, then repeated with zero writes and
847 verified reuses. All 847 objects were restored separately. The original
failure did not recur and its cause remains unconfirmed; both attempt records
are preserved. No guard was relaxed and no prior payload was overwritten.

#0023 owns source/domain completion and #0074–#0083 the per-quarter dispositions.
#0063 remains owner-Completed research. #0017 retains production cohort/epoch
application, source-gap/null semantics, truthful completeness claims and real
2026 Q2 AFR output validation. Completing the source census neither publishes a
new matrix nor certifies global first deployment or complete lifetime AFR.

Detailed source, review and operational evidence remains under ignored per-card
staging directories and `data/staging/batch-0074-0083/`. Raw/cache data, serial
identities, private connection settings and credentials stay outside Git.
