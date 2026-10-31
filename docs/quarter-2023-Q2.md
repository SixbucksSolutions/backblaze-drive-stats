# Backward quarter audit: 2023 Q2

Localswim #0038 acquired and privately audited 2023 Q2 in the owner-approved
eight-quarter batch. Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2023 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2023.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 859,566,204 bytes; exact HEAD length matched |
| Calendar | All 91 days, 2023-04-01 through 2023-06-30 |
| Observations / drive-days | 21,835,156 |
| All-source inventory | 79 normalized models from 79 raw names |
| Model/serial identities observed during quarter | 248,100 |
| Daily failure flags | 1,389 |
| Projected daily Parquet | 128,761,168 bytes |
| Projection receipt | 518,646 bytes |
| Summary frames and manifest | 1,920,057 bytes |
| Download command | 19.70 seconds; sampled own-process-tree peak 0.017 GiB |
| Projection command | 31.93 seconds; sampled own-process-tree peak 0.356 GiB |
| First summary pass | 11.46 seconds; summary-cache miss |
| Guarded summary reuse | 0.20 seconds; cache hit |
| Whole audit command | 15.65 seconds; sampled own-process-tree peak 2.595 GiB |
| ZIP, daily Parquet, actual receipt and summary footprint | 990,766,075 bytes; excludes private reports and resource logs |

The official catalog lists 91 files, matching the archive's complete calendar.
There are no missing, duplicate or unexpected daily dates. Publisher HEAD exposes
`x-bz-content-sha1=none` and no usable large-file SHA-1. Publisher checksum
verification is therefore **unavailable**, not passed. Local ZIP SHA-1 is
`768d7217bdf175a385f15c1454e696f740457f0c`; local SHA-256 is
`cd43df47416fed6d358da090b3cab8f96dfbb7bcba70ea983d43b663005462f3`.
The production projector checked ZIP member CRCs; no raw CSV was extracted to disk.
The source remained below 2 GiB and retained quarter artifacts below the 10 GiB
additional-disk envelope.

Each quarter worker used two Polars threads. Eight native quarter pipelines were
launched; seven succeeded and 2022 Q4 failed a source-date integrity check because
its December 10 file contains December 11 internal dates. The coordinator released
barriers early after that failure. The 107.60-second batch envelope therefore
contains seven successes and one source failure; it is neither an eight-quarter
success nor evidence that eight audits aligned. Previously accepted baselines
remained unchanged. This quarter's successful result is recorded separately.

Measurements above are phase command envelopes under concurrent load, including
launch and cleanup overhead. The first summary pass was cold for the summary
cache; the operating-system file cache was not flushed. Working-set samples taken
approximately every 0.25 seconds can miss brief peaks and are not an RSS or
full-history aggregation bound. No serial-versus-parallel speedup is established.

## Acceptance evidence

The production projector and `tools/verify_quarter.py` completed successfully.
The audit verifies full source-calendar coverage, ZIP/receipt identity, partition
hashes, footer/profile lineage, numerical budgets and summary parity. The guarded
second pass confirms a current-profile cache hit while forbidding daily DataFrame
reads/scans; byte hashes and small summary reads remain permitted. Summary input
identity is `47f71628ed15ae15d49e13afe4f784ae0ba6ad12751ecb59b08ade0dc0c01298`.
The retained Parquet profile is `private-parquet-rich-v1-903ee87c89e5`.

All-source inventory retains 30 evidenced HDD models and
49 unclassified models; 28 models match the frozen seed patterns.
Raw aliases, media-class evidence and pattern-match flags remain explicit for every
source model. Population alone does not determine media class. Unclassified models
meeting the 2,000-identity threshold are **HMS5C4040ALE640** (3,721 identities); **ST4000DM000** (18,068 identities); **HMS5C4040BLE640** (12,757 identities).
These candidates remain visible for historical classification follow-up; no
registry or accepted cache bytes were rewritten.

Private evidence is under ignored `data/staging/0038/`: `audit.json` and `.txt`,
`results-summary.json`, `author-reconciliation.txt`, `download.json`, `envelope.json`,
`source-head.headers`, `calendar-expectations.json`, `calendar-preflight.json` and
phase resource reports. Author reconciliation separately checked inventory totals,
source identity and exact-model small-summary components and observation dates.
Fresh independent artifact review is recorded separately by the primary before
handoff; this report does not claim independent acceptance or owner completion.

## Exact reference model and search boundary

**HUH721212ALN604** has 10,705 observed identities, 941,603 drive-days
and 164 daily failure flags. Its sole observed raw alias is
`HGST HUH721212ALN604`; summary first/last observations span
2023-04-01 through 2023-06-30.
Quarter-only AFR is approximately **6.3572%**, calculated as
failures / drive-days × 365 × 100. Count means model/serial identities observed
anywhere in the quarter, not quarter-end installed population. Similar ALE variants
remain separate SKUs; no ALN/ALE merge was made.

The exact reference is above the 2,000-identity threshold in this complete quarter.
This quarter is not a complete-zero stopping quarter. First observed quarter and
first qualifying quarter remain separate questions requiring older evidence;
this audit establishes neither origin nor global inception. Below-threshold
observations remain part of the backward-search evidence.

No calendar-mapped workbook fixture comparison is claimed. Quarter-only results
do not establish cumulative AFR, lifecycle New/Retired values, production anchors
or complete global history. No production matrix was generated. Remote private
cache retention is coordinated separately by the primary; this document makes no
upload claim. Raw data and private audit/cache artifacts remain outside Git.

## Final verification

Fresh non-author review passed all daily partition hashes/footer/lineage checks,
three complete independently parsed CSV-day multisets, summary budgets and
guarded warm reuse. All 679 previously accepted baseline files remained
unchanged. Evidence is retained in this card's ignored `independent-review*` files.

The processing files and recovery manifest are retained in B2; readback,
zero-write reuse and a separate restore were verified. Independent local
source/restore hashes and guarded restored-summary hits passed. See the
[eight-quarter retention report](eight-quarter-benchmark.md) for the first
packet's failed restore and successful explicit resume, the second packet
and the separately qualified capacity probe. No new production matrix or
original-anchor claim follows from this audit.
