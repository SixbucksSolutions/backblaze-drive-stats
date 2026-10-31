# Backward quarter audit: 2023 Q4

Localswim #0036 processed this quarter in the owner-approved eight-quarter
batch (#0033–#0040). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2023 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2023.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,010,626,705 bytes; exact official HEAD size matched |
| Calendar | All 92 days, 2023-10-01 through 2023-12-31 |
| Observations / drive-days | 24,790,999 |
| All-source inventory | 80 normalized models from 81 raw names |
| Model/serial identities observed during quarter | 281,346 |
| Daily failure flags | 1,057 |
| Projected daily Parquet | 145,062,917 bytes |
| Projection completion receipt | 541,466 bytes |
| Summary frames and manifest | 2,123,012 bytes |
| Download | 48.14 seconds; sampled own-process-tree peak 0.02 GiB |
| Projection | 43.24 seconds; sampled own-process-tree peak 0.37 GiB |
| First summary pass | 8.81 seconds; summary-cache miss |
| Guarded summary reuse | 0.17 seconds; cache hit |
| Whole audit | 12.23 seconds; sampled own-process-tree peak 3.02 GiB |
| ZIP, daily Parquet, completion receipt and summary | 1,158,354,100 bytes; excludes private evidence |

Counts describe identities observed anywhere in the quarter, not quarter-end
installed populations. The inventory retains every source model: 29 match the
known-HDD seed, two have explicit HDD evidence, and 49 remain unclassified.
Population alone does not establish media class.

## Source identity and acceptance evidence

The official HEAD advertises `x-bz-content-sha1=none` and supplies no usable
publisher SHA-1. **Publisher checksum verification was unavailable.** This was
recorded before processing. Exact official length, local hashes, ZIP/calendar
validation and importer daily-member CRC checks provide the retained integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `ba568ab59d6ab7459a551bc217c45f2a44af1326`.
- Local SHA-256: `57bc4b5a981a6500362e074e8ded121b31154b6dce51e0f2f21dab9d2b854164`.
- All 92 expected daily members were present, with no duplicate, missing or
  unexpected calendar days.

The production projector and `tools/verify_quarter.py` completed successfully.
The audit reconciles source/receipt and partition hashes, complete calendar
coverage, footer/profile lineage, numerical budgets and summary parity. The
warm pass was a cache hit with daily DataFrame reads/scans forbidden; byte hashes
and small summary reads remain permitted. No CSV was extracted to disk. The
archive stayed below 2 GiB; the per-quarter additional-disk envelope was 10 GiB.

Private evidence is retained under ignored `data/staging/0036/`:
`envelope.json`, `source-head.headers`, `calendar-expectation.json`,
`download.json`, `calendar-preflight.json`, `audit.json` and `.txt`, phase
resource samples and `results-summary.json`. The reconciliation reads the stable
audit and small drives summary, without another daily logical scan. Fresh
independent review passed; see final verification below.

## Qualifying unclassified inventory

These models meet the 2,000 observed-identity threshold while remaining
unclassified in the frozen registry. They are retained for explicit media
classification follow-up; their inclusion does not establish HDD status,
current purchase relevance or a historical inception boundary.

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| `HMS5C4040ALE640` | 2,603 | 212,426 | 5 |
| `ST4000DM000` | 15,977 | 1,295,929 | 93 |
| `HMS5C4040BLE640` | 10,307 | 946,024 | 6 |

## Exact reference model and backward-search boundary

**HUH721212ALN604** has 10,651 observed identities,
968,472 drive-days and 113 daily failure flags.
Its sole observed raw alias is `HGST HUH721212ALN604`, with observations spanning
2023-10-01 through 2023-12-31.
Quarter-only AFR is about 4.259% (365 × failure flags / drive-days × 100).
It is classified as HDD through retained positive seed evidence. ALE variants
remain separate SKUs.

The exact model is above the 2,000-identity threshold in this complete quarter,
so backward search continues. Neither its first observed quarter nor its first
qualifying quarter is established; those remain separate findings. This quarter
is not a complete zero quarter. This audit establishes neither global inception
nor cumulative exposure, and generates no production matrix or production-anchor
claim.

## Batch outcome and measurement limits

This quarter succeeded using one worker and two Polars threads. The coordinator
launched eight quarter pipelines; seven succeeded. The 2022 Q4 source failed
because its December 10 member internally reports December 11. Peer readiness
barriers were released early after that failure. The 107.60-second coordinator
envelope in `data/staging/batch-0033-0040/benchmark.json` is therefore a failed
batch with seven successful quarters, not a clean eight-quarter benchmark.
No eight-heavy-audit overlap or serial-versus-parallel speedup is claimed.
Previously accepted source/cache files remained unchanged.

Command times include launch/import/cleanup overhead; adding phase times does not
establish batch throughput. First summary pass means a cold summary cache, not
flushed operating-system caches. Working-set samples were nominally spaced
0.25 seconds apart, can miss short peaks and may double-count shared pages.
These measurements do not establish full-history aggregation limits. Data and
private evidence remain outside Git; private B2 retention is coordinated
separately by the primary after review.

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
