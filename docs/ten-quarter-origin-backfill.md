# 2018 Q1 through 2020 Q2: ten-quarter backfill and model anchors

The owner accepted the preceding RFR work and authorized all six queued source
cards, then the earlier exact-model search. This turn processed ten quarters:
#0050–#0055 and #0059–#0062. Each card entered In Progress before work. The owner
subsequently clarified a maximum of ten source quarters per turn and expanded
the target to accurate eligibility starts for every 2026 Q2 AFR analysis model.
No additional source quarters were started after these ten.

Underlying observations are supplied by [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Processing, verification and analysis are independent Sixbucks Solutions work.

## Accepted source observations

| Quarter | Valid days | Known observations | Exact ALN604 identities |
| --- | --- | --- | --- |
| 2018 Q1 | 89/90, incomplete | 8,849,239 | Zero on valid days; excluded day unknown |
| 2018 Q2 | 91/91 | 9,144,206 | 0 |
| 2018 Q3 | 92/92 | 9,249,199 | 79 |
| 2018 Q4 | 92/92 | 9,357,609 | 1,279 |
| 2019 Q1 | 90/90 | 9,577,046 | 4,876 |
| 2019 Q2 | 90/91, incomplete | 9,720,605 | At least 9,675 |
| 2019 Q3 | 92/92 | 10,338,153 | 10,864 |
| 2019 Q4 | 92/92 | 10,991,209 | 10,866 |
| 2020 Q1 | 91/91 | 11,602,907 | 10,861 |
| 2020 Q2 | 91/91 | 12,498,547 | 10,866 |

ALN604 means exact **HUH721212ALN604**, separate from ALE models. Counts are
normalized model/serial identities seen during the quarter, not quarter-end
population. These ten quarters add **910 valid days / 101,328,720 observations**.
Publisher SHA-1 was unavailable; exact source sizes, local hashes, ZIP member CRCs,
actual calendars and internal row dates were verified without claiming a
publisher checksum comparison.

Two genuine source defects prevented full-quarter acceptance:

- **2019-06-17:** the source CSV contains 110,532 rows dated June 17 and one
  failure row dated June 15, all using non-ISO date syntax. The entire day was
  excluded rather than relabeled or reassigned. Recovery verified and copied
  77 existing daily files and strictly projected 13 remaining valid days.
- **2018-02-25:** all 100,253 rows have non-ISO dates and rounded scientific-
  notation capacities. Every shared-identity capacity comparison against the
  neighboring valid days differs. Date-format conversion cannot restore the
  lost capacity precision. Recovery preserved 55 existing files and strictly
  projected 34 remaining valid days, excluding February 25.

Both recoveries used isolated roots, explicit exception receipts and fresh
independent actual-output review. A separately reviewed promotion added only
missing files to the normal retained roots; all original partitions remained
byte-identical. The copied receipt retained its exact bytes and exception, and
guarded warm reuse confirmed unchanged cache identity. Full-quarter Count and
AFR remain null for both partial quarters. Known exposure and identity lower
bounds are not complete-quarter metrics.

## Exact-model boundary and broader scope

Within the searched window, exact ALN604 is absent throughout complete **2018 Q2**
and first observed on **2018-07-12** in complete **2018 Q3**. Independent complete
CSV-day comparisons corroborated July 11 absence, July 12's 79 identities and
quarter-end observations. It reaches the **2,000-drive eligibility threshold in
2019 Q1**, after 79 in 2018 Q3 and 1,279 in 2018 Q4.

This establishes an adjacent complete-zero/positive boundary in the searched
window. It does not prove physical inception or exclude older deployment and
reentry. The partial 2018 Q1 quarter cannot prove absence on its excluded day.
First observation and first qualifying quarter are separate facts.

The reviewed #0063 research snapshot records **22 historically qualifying HDD
candidates**, comprising 20 seed models and two already evidenced off-seed HDDs,
within a separate 40-ID resolved research scope. Workbook-reference, current-
display and analysis-candidate sets are recorded separately. This is an audit
of existing semantics, not a new production cohort-selection decision.

Three models are already above threshold at the oldest complete loaded quarter
and therefore require older research: **ST12000NM0007, ST8000DM002 and
ST8000NM0055**. The next ten queued source cards cover **2017 Q4 through 2015 Q3**.
They remain Ready for Work for a later turn.

The current generator's supplied-history anchor and unconditional
`anchorSearchComplete` flag must not be interpreted as proof of a full-domain
first anchor. #0063/#0017 retain that integration gate. No new public matrix,
production cohort change or complete cumulative-history certification follows
from this backfill.

## Measurements and review

The original six-source worker envelope took **69.08 seconds**: five complete
successes and the 2019 Q2 validation failure. Six CPU/heavy phases were permitted,
with two Polars threads per worker. Sampled worker working set peaked at
**7.55 GiB**, minimum available system RAM was **28.15 GiB**, and whole-machine
average CPU was **48.69%**.

The four-quarter extension took **56.29 seconds**: three complete successes and
the 2018 Q1 source failure. Four CPU/heavy phases were permitted, again with two
Polars threads each. Sampled worker working set peaked at **4.50 GiB**, minimum
available RAM was **30.59 GiB**, and whole-machine average CPU was **60.59%**.

Separate partial recoveries took **14.82 seconds** for 2019 Q2 and **14.42 seconds**
for 2018 Q1. These are distinct execution envelopes; recovery does not turn the
original attempts into ten complete-quarter successes. Preservation hashing,
preparation, independent review and cloud work are not included in those native
worker times. No controlled serial speedup is claimed.

Fresh non-author reviews checked every partition hash/footer/profile/lineage,
calendar and internal dates, three complete streamed CSV-day multisets per
quarter, summary budgets, all-source inventories and exact-model aliases.
Guarded summary reuse performed zero daily DataFrame reads or scans. Separate
actual-byte preservation audits verified **4,704 prior files** for the initial
workset and **5,263 prior files** for the extension. Runtime discovery controls
may subsequently advance deliberately; retained source/cache payloads and prior
immutable recovery references remain preserved.

## Projection size

Across 34 retained quarters, full source CSV members for the valid retained days
total **236,187,727,612 bytes**. Their corresponding six-column enriched daily
Parquet totals **3,869,389,389 bytes**, or **1.6383%** of CSV size: about **61.0×**
smaller. Individual-quarter ratios range from **1.4593% to 2.2811%**.

Daily Parquet occupies roughly **5.74–6.53 bytes per recorded drive-day**. The
original daily CSVs grow from 105 to 197 columns across these sources, while the
projection retains six. These results combine projection, Parquet encoding and Zstandard;
they are not a codec-only comparison or a full-fidelity conversion of SMART data.
ZIP compression, receipts and summary caches are excluded from this comparison.
Partial-quarter comparisons use only the retained valid days on both sides.

## Retention handoff

The reviewed append candidate adds **950 payload objects / 659,658,932 bytes**
to the existing preferred `drive-stats/cache-v2` namespace. The combined immutable
catalog describes **34 quarters, 31 complete and three incomplete**. Existing
24-quarter catalog rows, quarter manifests and payload references remain intact;
only the ten new quarters are in the transfer/restore set. The existing 2022 Q4
December 10 gap remains explicit alongside the two newly identified source gaps.

Actual SHA-256/AES256 readback, a repeated zero-write reuse pass, a complete
950-object isolated restore and ten guarded restored-summary hits passed.
Fresh independent local review rehashed every source/restored object and
repeated all ten guarded hits, including partial coverage. It did not access
cloud credentials; remote assurance rests on parent execution evidence.

The separately reviewed publisher advanced `drive-stats/current-cache.json`
after acceptance, verified exact readback/encryption and archived the exact prior
pointer by hash. Old immutable catalogs, quarter manifests and payload references
remain usable. No old payload transfers, cache-v1 writes or deletes occurred.
One coordinator owns publication; the pointer recheck is not distributed CAS.

Private evidence is retained under ignored per-card
staging directories, `data/staging/batch-0050-0055/`,
`data/staging/batch-0059-0062/` and `data/staging/0063/`. No raw CSV, Parquet,
per-drive identity, private connection settings or credentials are committed.
