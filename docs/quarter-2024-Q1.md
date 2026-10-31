# Backward quarter audit: 2024 Q1

Localswim #0035 processed this quarter in the owner-approved eight-quarter
batch (#0033–#0040). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2024 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2024.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,006,502,769 bytes; exact official HEAD size matched |
| Calendar | All 91 days, 2024-01-01 through 2024-03-31 |
| Observations / drive-days | 25,189,213 |
| All-source inventory | 80 normalized models from 81 raw names |
| Model/serial identities observed during quarter | 291,331 |
| Daily failure flags | 978 |
| Projected daily Parquet | 146,032,149 bytes |
| Projection completion receipt | 535,639 bytes |
| Summary frames and manifest | 2,149,663 bytes |
| Download | 30.74 seconds; sampled own-process-tree peak 0.02 GiB |
| Projection | 44.10 seconds; sampled own-process-tree peak 0.37 GiB |
| First summary pass | 10.84 seconds; summary-cache miss |
| Guarded summary reuse | 0.16 seconds; cache hit |
| Whole audit | 15.37 seconds; sampled own-process-tree peak 3.07 GiB |
| ZIP, daily Parquet, completion receipt and summary | 1,155,220,220 bytes; excludes private evidence |

Counts describe identities observed anywhere in the quarter, not quarter-end
installed populations. The inventory retains every source model: 29 match the
known-HDD seed, two have explicit HDD evidence, and 49 remain unclassified.
Population alone does not establish media class.

## Source identity and acceptance evidence

The official catalog labels this quarter as 92 files. Its actual archive contains all 91 expected daily CSV members; the catalog count was not treated as calendar evidence.

The official HEAD advertises `x-bz-content-sha1=none` and supplies no usable
publisher SHA-1. **Publisher checksum verification was unavailable.** This was
recorded before processing. Exact official length, local hashes, ZIP/calendar
validation and importer daily-member CRC checks provide the retained integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `b537bccd0c5f2e5cd7a2bdf5d5ce20674f9604db`.
- Local SHA-256: `a7882f8788f1b9f42e85949db167b53fc1287b5108fdf3e1f0507143486d9d5b`.
- All 91 expected daily members were present, with no duplicate, missing or
  unexpected calendar days.

The production projector and `tools/verify_quarter.py` completed successfully.
The audit reconciles source/receipt and partition hashes, complete calendar
coverage, footer/profile lineage, numerical budgets and summary parity. The
warm pass was a cache hit with daily DataFrame reads/scans forbidden; byte hashes
and small summary reads remain permitted. No CSV was extracted to disk. The
archive stayed below 2 GiB; the per-quarter additional-disk envelope was 10 GiB.

Private evidence is retained under ignored `data/staging/0035/`:
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
| `ST4000DM000` | 11,397 | 791,548 | 63 |
| `HMS5C4040BLE640` | 10,264 | 932,237 | 5 |

## Exact reference model and backward-search boundary

**HUH721212ALN604** has 10,634 observed identities,
958,729 drive-days and 93 daily failure flags.
Its sole observed raw alias is `HGST HUH721212ALN604`, with observations spanning
2024-01-01 through 2024-03-31.
Quarter-only AFR is about 3.541% (365 × failure flags / drive-days × 100).
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
