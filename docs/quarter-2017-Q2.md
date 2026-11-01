# Source issue and partial recovery: 2017 Q2

Localswim #0066 acquired the official [2017 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2017.zip)
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
in the owner-approved ten-quarter batch (#0064–#0073). All 91 daily files were
projected, but the strict audit rejected invalid required identity fields.
A reviewed isolated partial recovery retains 84 valid observation days and
records April 12–18 as unavailable. The quarter does not pass a complete-calendar
audit. Processing and measurements are independent Sixbucks Solutions work.

## Source investigation

The source contains one empty `serial_number` on each of April 12–18, seven
invalid rows in total. Each has raw model ` 00MD00` (including the leading space)
and failure flag 0. This model remains **unclassified**; its name and population
do not establish HDD media class. Empty serials were projected as null and
rejected by the audit. No normalized duplicate identity groups were found.

The recovery conservatively excludes all seven whole days: 588,763 total rows,
including **588,756 otherwise-valid rows**. This is a conservative availability
policy, not a finding that every row on those days is bad or that the bad rows
are HDDs. The seven invalid rows have zero flags, but the other excluded rows'
exposure and failures are unavailable to this partial summary, not zero.

No serial was invented, no row repaired or deduplicated, and no observation
imputed. All 91 original daily files and the full original receipt remain
byte-for-byte unchanged as failed-original evidence. The source ZIP remains
intact; no CSV was extracted. No authoritative source correction is established.
A future, separately authorized granular policy could reconsider otherwise-valid
rows; this recovery does not silently apply one.

## Source identity

The official ZIP is 387,036,146 bytes, matching HEAD and below the
2,147,483,648-byte (2 GiB) cap. Publisher SHA-1 was unavailable;
**no publisher checksum comparison is claimed**.

- Local SHA-1: `28eaf5d82ad5a63489316ab2558b98c14a466149`.
- Local SHA-256: `6508b491f54323e18cc67e32a5c04c3dcbe8d0fb014b5918718875eff9d03dc8`.
- All 91 expected daily filenames exist. Filename coverage alone does not prove
  valid observation coverage or required identities.

## Verified isolated partial recovery

The recovery reused 84 verified daily projections in the isolated canonical
root `data/staging/0066/recovery-2017-Q2/`, with no newly projected days.
Its standard-layout `processed/2017-Q2/import-metadata.json` explicitly records
`selectedQuarter: 2017-Q2`, the incomplete calendar and seven exclusions;
its summary is under that root's `history-cache/`.

| Known observation component | Result |
| --- | --- |
| Valid daily partitions | 84 of 91 expected days |
| Unavailable observation dates | 2017-04-12 through 2017-04-18 |
| Known drive-days | 6,979,867 |
| Known failure flags | 360 |
| Observed model/serial identities, a lower bound | 89,836 |
| Canonical models in valid observations | 56 from 56 raw names |
| Full-quarter Count and AFR | Unknown / null |

Coverage is **incomplete**. Missing exposure and failures are not zero. Observed
identity counts are lower bounds, not full-quarter Count or quarter-end installed
populations. At least 2,000 identities in available days proves that observed
lower bound; it does not independently establish v1 complete-quarter eligibility,
a first qualifying quarter or an original production anchor. Full-quarter Count
and AFR remain null for every model. Cumulative history remains incomplete;
no production matrix was generated.

The full private all-source inventory retains every raw alias, known exposure,
known failure total and classification, including populations below 2,000.
There are 2 evidenced HDD models and 54 unclassified models.
Population alone does not establish media class. These unclassified models have
observed identity lower bounds of at least 2,000 and remain unclassified:

| Model | Observed identity lower bound | Known drive-days | Known failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 8,577 | 716,684 | 7 |
| ST4000DM000 | 34,692 | 2,892,896 | 255 |
| Hitachi HDS5C4040ALE630 | 2,624 | 220,364 | 1 |
| HMS5C4040BLE640 | 16,189 | 1,297,851 | 18 |
| Hitachi HDS5C3030ALA630 | 4,380 | 225,494 | 3 |

Exact **HUH721212ALN604** has zero observed identities, zero known drive-days
and zero known flags in the 84 valid days. This is **not full-quarter absence**:
the seven unavailable dates prevent that conclusion. Its full-quarter Count and
AFR remain null. Similar ALE variants remain separate SKUs.

The three exact epoch-frontier models have these valid-day observations:

| Model | Observed identity lower bound | Known drive-days | Known failure flags | Observed interval |
| --- | --- | --- | --- | --- |
| ST12000NM0007 | 0 | 0 | 0 | None in valid days |
| ST8000DM002 | 9,894 | 828,887 | 22 | 2017-04-01 through 2017-06-30 |
| ST8000NM0055 | 6,068 | 313,006 | 13 | 2017-04-01 through 2017-06-30 |

The zero ST12000NM0007 result is confined to valid days. Neither first-ever
appearance nor first qualification is proved by this partial quarter. Within-quarter
dates do not establish uninterrupted service, true origin or cumulative exposure.

## Timing, footprint and independent review

Isolated recovery took 8.02178 seconds after
0.003263 seconds of admission wait, including launch/import
and cleanup. Sampled owned-process-tree peak was
1.196 GiB (1,284,026,368 bytes).
The first summary pass took 3.47121 seconds within that
envelope. Guarded warm reuse passed with zero daily logical read attempts.
Cold refers to the summary cache; operating-system caches were not flushed.
Sampling every approximately 0.25 seconds can miss brief peaks and count shared
pages. These measurements do not bound full-history aggregation memory.

| Isolated artifact footprint | Bytes |
| --- | --- |
| Daily observations, 84 verified reused files | 43,815,993 |
| Explicit partial receipt | 168,305 |
| Summary frames and manifest | 812,001 |
| Isolated observations, receipt and summary | 44,796,299 |
| Shared original ZIP plus isolated observations, receipt and summary | 431,832,445 |

These totals exclude staging reports and the separately preserved original
91-file projection (47,515,124 bytes) and full original receipt
(275,061 bytes). The ZIP is counted once in the final row.
These are artifact totals, not a combined physical-disk measurement. The audit's
additional-output total equals 44,796,299 bytes and is below the
10,737,418,240-byte (10 GiB) additional-disk envelope.

Fresh independent actual artifact review **passed**. It checked all 84 payloads,
required identities, dates, lineage, profile/body properties, row-group statistics
and sorting; the exclusion/calendar; all 91 unchanged originals and the original
receipt; per-identity summary and capacity-frequency parity; null full-quarter
metrics; and guarded warm reuse. Three independently parsed full source-day
multisets (April 1, May 15 and June 30) matched projections with CRC validation.
This is bounded independent source parity, not a second full-quarter raw reparse.

The reviewed report is `data/staging/0066/independent-actual-review.json`,
SHA-256 `cbb5fb5537934fff9289d31d27ef23b6f92bd277c595ad2699ccaffe03ef6627`.
Private evidence also includes source findings, `invalid-row-model-evidence.json`,
resource records, `recovery-2017-Q2/partial-projection.json` and `partial-audit.json`,
and `results-summary.json`/`.txt`. Final packet reconciliation read metadata and
the small retained drive summary, with no new daily logical read.

The original ten-worker batch remains seven complete successes and three strict
failures in 64.37664 seconds, including the parent annual-2015
download prelude. Final preservation hashing was outside that interval. Separate
partial recovery does not turn #0066 into a complete quarter or establish a
controlled serial/parallel speedup.

Retention uses an exact **2017-Q2-only source-root exception** for this isolated
canonical root, preserving standard logical artifact keys. The normal
`data/processed/2017-Q2/` root remains failed-original evidence. No #0066 promotion
to that root is authorized or performed. Actual B2 transfer, encrypted SHA-256
readback, separate-root restore, restored guarded summary reuse and preferred
catalog publication passed independent acceptance; see the
[batch handoff](ten-quarter-epoch-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
