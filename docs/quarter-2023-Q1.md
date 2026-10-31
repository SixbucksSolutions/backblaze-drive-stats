# Backward quarter audit: 2023 Q1

Localswim #0039 processed 2023 Q1 in the owner-approved eight-quarter batch
(#0033–#0040). Source data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2023 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2023.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 819,095,135 bytes; exact official HEAD size matched |
| Calendar | All 90 days, 2023-01-01 through 2023-03-31 |
| Observations / drive-days | 21,454,992 |
| All-source inventory | 75 normalized models from 75 raw names |
| Model/serial identities observed during quarter | 242,703 |
| Daily failure flags | 929 |
| Projected daily Parquet | 126,822,869 bytes |
| Summary frames and manifest | 1,869,755 bytes |
| Download | 23.13 seconds; sampled own-process-tree peak 0.02 GiB |
| Projection | 32.68 seconds; sampled own-process-tree peak 0.33 GiB |
| First summary pass | 12.11 seconds; summary-cache miss |
| Guarded summary reuse | 0.24 seconds; cache hit |
| Whole audit command | 16.18 seconds; sampled own-process-tree peak 2.72 GiB |
| Retained source, projection/receipt and summary | 948,284,138 bytes; excludes staging evidence |

The catalog lists 91 files; the actual archive contains all 90 expected daily
members, with no missing, duplicate or unexpected daily dates. Calendar coverage
comes from the source contents and completed receipt, not the catalog count.

Counts describe identities observed anywhere in the quarter, not quarter-end
installed populations. The all-source inventory retains 26 evidenced HDD models
and 49 unclassified models; 24 match the retained seed patterns. Population alone
does not establish media class, and unclassified models remain visible.

## Source identity and audit evidence

The official HEAD response provides no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact official length, local hashes,
ZIP/calendar validation and daily-member CRC checks provide the recorded integrity
evidence; local hashes are not a publisher checksum comparison.

- Local SHA-1: `af51adefed77284c29afad5069303ae3852fc8e1`.
- Local SHA-256: `d7d01c961bd1a956f36e383aabb901f97f6046e9213177800ddbc0c6241ff0d6`.
- Summary input identity: `5055b554e7c0cd3cf34c53616e9f2e521541b03848d521ddffb440c0fd929bb4`.

The unchanged production projector and quarter audit reconcile complete calendar
coverage, source/receipt and partition hashes, footer/profile lineage, numerical
budgets and summary parity. The summary profile is
`private-parquet-rich-v1-903ee87c89e5`. The first pass was a summary-cache miss;
the guarded warm pass hit while daily DataFrame reads/scans were forbidden.
Byte hashes and small summary reads remained permitted. No CSV was extracted.

Private evidence is under ignored `data/staging/0039/`: `audit.json` and `.txt`,
`results-summary.json`, `envelope.json`, `source-head.headers`, calendar preflight
and phase resource records. Final reconciliation reads audit metadata and the
small drive summary, without another daily logical scan. Fresh independent review
passed; owner completion remains separate from this verification.

## Exact reference model and historical boundary

**HUH721212ALN604** has 10,781 observed identities, 959,203 drive-days and 77
daily failure flags. Its sole observed raw alias is `HGST HUH721212ALN604`;
summary observations span January 1 through March 31. Quarter-only AFR is about
2.930%. Similar ALE variants remain separate SKUs.

The exact model exceeds the 2,000-identity threshold in this complete quarter.
This establishes neither its first observed nor first qualifying quarter; those
are separate findings. The adjacent 2022 Q4 source has an internal-date defect,
so it cannot currently supply a complete preceding-quarter boundary. No true
origin, complete zero quarter, cumulative exposure or production-anchor claim
is established. No production matrix was generated.

## Measurement limits

Each quarter used one native worker and two Polars threads. The eight-worker
batch envelope was 107.60 seconds, with seven successful audits and one source
validation failure in 2022 Q4. This is not evidence that eight audits completed,
and phase sums do not establish serial-versus-parallel speedup.

First-pass cold refers to the summary cache; the operating-system cache was not
flushed. Process-tree working sets were sampled approximately every 0.25 seconds
and can miss brief peaks. Measurements do not bound full-history aggregation
memory. The archive stayed below 2 GiB and the retained footprint below the
10 GiB additional-disk envelope. Raw data and private artifacts remain outside
Git; private B2 retention is coordinated separately by the primary.

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
