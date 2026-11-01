# Backward quarter audit: 2017 Q1 — incomplete observations

Localswim #0067 retained a reviewed **89/90-day partial recovery** of 2017 Q1
after the original complete-quarter attempt failed on source evidence. Source
data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2017 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2017.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Source finding and coverage limits

`2017-01-30.csv` contains a complete 95-column required header and
**zero observation records**. Its 1,580-byte body passed ZIP CRC verification
(`2261d974`); the complete official source identity matches the original
download receipt. A CRC-valid header-only file does not establish zero active
drives, zero exposure or zero failures. Strict observation validation correctly
rejected it; no schema or numeric/date checks were relaxed.

The unavailable date is **2017-01-30**. Its exposure and failures remain
unknown. Valid neighboring and remaining selected-quarter source days passed
strict validation and EOF/CRC checks; no additional bad member was found. The
partial receipt retains `selectedQuarter=2017-Q1`, exact unavailable-date lineage
and the complete source archive SHA-256. No dates were relabeled, observations
reassigned, source repaired or missing values imputed. No CSV was extracted.

## Measured partial result

| Item | Result |
| --- | --- |
| Source ZIP | 339,084,144 bytes; exact official HEAD size matched |
| Valid observation coverage | 89/90 days; 2017-01-01 through 2017-03-31, with the stated unavailable date |
| Known drive-days / observation rows | 6,632,104 |
| Known failure flags | 380 |
| Observed model/serial identity lower bound | 85,301 |
| Full-quarter drive count / AFR | **Unknown / unknown** (`null`); missing-day exposure and failures are unknown |
| All-source observed inventory | 58 normalized models; 58 raw names |
| Selected valid CSV member bytes (uncompressed) | 1,740,425,800 |
| Selected unavailable header-only CSV bytes | 1,580 |
| Selected-quarter total CSV member bytes | 1,740,427,380; includes header-only member |
| Isolated daily Parquet | 42,611,114 bytes |
| Isolated partial import receipt | 176,581 bytes |
| Isolated summary frames and manifest | 797,103 bytes |
| Other isolated evidence JSON | 31,083 bytes |
| Actual complete isolated recovery directory | **43,615,881 bytes**; all current files included |
| Whole source plus actual isolated directory | 382,700,025 bytes |
| Original successful Parquets preserved | 29 byte-identical files; copied into isolation |
| Newly projected valid days | 60 |
| First summary pass | 3.53 seconds; summary-cache miss |
| Guarded warm reuse | Cache hit; 0 daily logical reads/scans; 2 small summary reads |

The earlier helper's `additionalOutputBytes` (43,584,798) was sampled
before its final JSON evidence writes and is **not** the complete isolated-directory
measurement. The actual total above includes those JSON files and agrees with
the successful independent actual-output review. These byte counts describe
isolated recovery output; they do not claim fixed-root promotion or cloud retention.

## Source identity and all-source inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, local hashes, ZIP member
CRC checks and strict selected-day validation provide the recorded integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `a449851557bff9454d13768c75d62c2cc595e7a6`.
- Local SHA-256: `2e3ea1892ee5bba4c4bfdb5af3eac50c35c3b6e43251daa4e04a5be48920ffe1`.
- Summary input identity: `8e8130b2ae7eddc0eb1bdb0de13d3394edbfedd708aeb502355dcc545eded532`.

The private packet retains every observed model, raw alias, known exposure,
known failure total and classification, including populations below 2,000.
There are 2 evidenced HDD models and 56 unclassified models.
Population alone does not establish media class. All observed identity counts
are lower bounds for the incomplete quarter; all full-quarter model drive counts
and quarter AFR values remain `null`. These models have known identity lower
bounds of at least 2,000; unclassified entries remain unclassified:

| Model | Observed identity lower bound | Known drive-days | Known failure flags | Media class |
| --- | --- | --- | --- | --- |
| HMS5C4040ALE640 | 8,488 | 644,282 | 6 | unclassified |
| ST4000DM000 | 34,802 | 2,981,251 | 264 | unclassified |
| ST8000NM0055 | 2,460 | 37,559 | 2 | hdd |
| ST8000DM002 | 9,884 | 815,494 | 23 | hdd |
| Hitachi HDS5C4040ALE630 | 2,625 | 225,686 | 1 | unclassified |
| HMS5C4040BLE640 | 15,377 | 959,967 | 37 | unclassified |
| Hitachi HDS5C3030ALA630 | 4,479 | 383,788 | 10 | unclassified |

Counts describe distinct model/serial identities observed on known-valid days,
not quarter-end installed populations. Known failure flags and drive-days are
partial totals, not full-quarter estimates. The capacity summary accounts for
6,631,684 valid capacity observations; this is separate from the
6,632,104 known drive-day budget.

## Exact reference model and historical frontier

**HUH721212ALN604** has zero exact-model identities, known drive-days and known
failure flags **on the known-valid days only**. The unavailable day's observations
are unknown; complete-quarter absence is not established. There is no known
first/last observation. Similar ALE variants remain separate SKUs.

| Frontier model | Observed identity lower bound | Known drive-days | Known failure flags | First known observation | Last known observation |
| --- | --- | --- | --- | --- | --- |
| ST12000NM0007 | 0 | 0 | 0 | none | none |
| ST8000DM002 | 9,884 | 815,494 | 23 | 2017-01-01 | 2017-03-31 |
| ST8000NM0055 | 2,460 | 37,559 | 2 | 2017-01-01 | 2017-03-31 |

The **ST8000NM0055 lower bound of 2,460 identities** establishes that at least
2,000 distinct model/serial identities were observed on known-valid days. This
population fact does not establish a full-quarter drive count, full-quarter AFR,
production eligibility, original eligibility epoch or a production-policy change.

Zero entries indicate absence on known-valid days only. No true origin, original
production or eligibility epoch, cumulative exposure or complete cumulative
history is established. The history anchor is unverified and cumulative history
is incomplete. No production matrix was generated.

## Timing and resource limits

The separately guarded partial recovery took **14.8706883 seconds** of
admitted elapsed time, plus 0.0021 seconds admission wait.
Its sampled owned-process-tree peak was **1,306,857,472 bytes**
(1.217 GiB). The envelope includes process launch/import and cleanup;
internal first-summary timing is part of that envelope. The worker used two
Polars threads. Independent actual-output review is a separate measurement.

The original ten-quarter command envelope remains **64.3766447 seconds**,
including the single annual-download prelude and ten worker subprocesses,
excluding final preservation checking. That run had **seven complete audits and
three failures (#0066, #0067, #0072)**. Later partial recoveries do not convert
those outcomes into ten original successes or ten complete quarters. Original
sampled batch peak owned working set was 2.571 GiB, minimum available system
memory 32.166 GiB and whole-machine average CPU 43.83%. These measurements do
not establish controlled speedup, simultaneous successful heavy-audit capacity
or a memory ceiling. Sampling may miss brief peaks or count shared pages; cold
means summary-cache miss, with no operating-system cache flush.

The expanded original preservation check covered 9,896 files across 34 prior
quarters, plus preferred/repacked state and private immutable evidence; all were
unchanged. This recovery additionally preserved all 29 successful original
partitions byte for byte. The source remains below the 2,147,483,648-byte archive
cap; the source plus isolated output is below the 10,737,418,240-byte additional-
disk envelope. Neither bound establishes full-history aggregation capacity.

## Evidence and handoff

Ignored `data/staging/0067/` retains source findings and forensic evidence,
`partial-recovery-resources.json`, `independent-actual-review.json` and its hash,
independent review/probe evidence, and `results-summary.json`/`.txt`. The isolated
`recovery-2017-Q1/` retains `partial-audit.json`, `partial-import-metadata.json`,
`partial-projection.json`, valid observations and bound rich-profile summary
objects/manifest. The profile is `private-parquet-rich-v1-903ee87c89e5`.

**Fresh independent actual-output review passed (`success: true`)**. It verified
all recovered daily Parquets, three independently compared complete selected-day
CSV multisets, exact receipt/source/summary lineage, numerical budgets, original
partition preservation and guarded warm reuse. The review's scope does not
claim a complete-quarter source-body rescan or accepted global history anchor.

Fixed-root promotion passed fresh independent byte/closure verification and
guarded reuse, preserving all original partitions.

Fresh independent artifact review passed. B2 transfer, actual encrypted
SHA-256 readback, zero-write repeat, separate-root restore, guarded restored
summary reuse and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-epoch-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
This packet's reconciliation read metadata, file sizes and the small retained
drive summary only, with no additional logical daily scan or cache generation.
