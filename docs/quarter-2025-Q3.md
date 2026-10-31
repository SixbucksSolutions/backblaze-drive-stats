# Backward quarter audit: 2025 Q3

Localswim #0029 acquired and privately audited 2025 Q3 in the owner-approved
four-quarter benchmark. Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official
[2025 Q3 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q3_2025.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,111,587,745 bytes; publisher SHA-1 verified before promotion |
| Calendar | All 92 days, 2025-07-01 through 2025-09-30 |
| Observations / drive-days | 29,844,451 |
| All-source inventory | 76 normalized models from 77 raw names |
| Model/serial identities observed during quarter | 332,915 |
| Daily failure flags | 1,254 |
| Projected daily Parquet | 172,003,607 bytes |
| Summary frames and manifest | 2,382,461 bytes |
| Original download | 23.21 seconds; sampled own-process-tree peak 0.02 GiB |
| Recovery projection | 53.54 seconds; sampled own-process-tree peak 0.47 GiB |
| First summary pass | 15.49 seconds; summary-cache miss |
| Guarded summary reuse | 0.21 seconds; cache hit |
| Recovery whole audit | 18.98 seconds; sampled own-process-tree peak 3.41 GiB |
| Retained ZIP, projection/receipt and summary footprint | 1,286,526,239 bytes |

The official catalog lists 91 files for Q3. The actual archive and receipt contain
all 92 expected daily dates with no missing, duplicate or unexpected dates; the
audit resolves that catalog discrepancy using the source contents.

The initial four-worker attempt stopped after approximately 62 seconds when the
coordinator encountered a permission error. Verified ZIPs were retained, workers
stopped, and incomplete projections were preserved separately. Recovery reused
all four verified ZIPs and the already committed Q1 projection, then rebuilt the
three uncommitted projections, including Q3. Final Q3 projection and audit values
above are recovery measurements; the download value belongs to the first attempt.
Their sum is not a clean end-to-end throughput measurement.

Each quarter worker used four Polars threads. First-pass cold means a summary
cache miss; the operating-system file cache was not flushed. Memory was sampled
approximately every 0.25 seconds and can miss short peaks. These measurements do
not establish full-history aggregation limits. The archive stayed below 2 GiB;
retained quarter artifacts stayed below the 10 GiB additional-disk envelope.

Publisher large-file SHA-1 is
`ead2389dcb7be868a3b48fa4e139f9e9df43949a`; local ZIP SHA-256 is
`0c8962e8efef6eba5ebe6f17f561265fef07df68c88fe3c65d4225159c54528c`.
No raw CSV was extracted to disk. The production projector checked daily ZIP CRCs.

## Acceptance evidence

The production projector and quarter audit completed with the retained Q2 registry
and patterns. The audit verifies the full source calendar, ZIP/receipt and partition
hashes, footer/profile lineage, numerical budgets and summary parity. It records
a first-pass miss followed by a current-profile warm hit. The guarded warm pass
forbids daily DataFrame reads/scans, while permitting byte hashes and small summary
reads. The summary input identity is
`37192df739c28cfd552ba0c27035343a0ab1c008a10f1754b7fb1576aadbdab4`.

All-source inventory retains 36 evidenced HDD models and 40 unclassified models;
34 models match the retained seed patterns. Population alone is not media evidence,
and unclassified models remain visible in the private inventory. Summaries use
`private-parquet-rich-v1-903ee87c89e5` with the audited statistics, indexes, sorting,
custom distinct-count metadata and serial-number bloom filters where applicable.

Private evidence is under ignored `data/staging/0029/`: `audit.json` and `.txt`,
`results-summary.json`, `workbook-quarter-comparison.json`, `envelope.json`,
`source-head.headers`, final phase resource reports and original `attempt-1/`
download evidence. The primary maintains batch preservation and recovery evidence.
Fresh independent review is pending; this document records production-audit results,
without claiming independent acceptance or owner completion.

## Exact reference model and search boundary

**HUH721212ALN604** has 9,985 observed identities, 912,361 drive-days and 109 daily
failure flags. Its sole observed raw alias is `HGST HUH721212ALN604`; summary
first/last observations span July 1 through September 30. Quarter-only AFR is
approximately 4.361%. Count is identities observed anywhere in the quarter, not
quarter-end installed population. Similar ALE variants remain separate SKUs.

The exact model is present above the 2,000-identity threshold in this complete
quarter. Backward search continues: this audit establishes neither its first
observed nor first qualifying quarter, and has not reached a complete zero quarter.
Those two first-quarter findings must remain separate when older evidence exists.

## Workbook comparison limits

Under the conditional inference that terminal retained rows in the Q3 reference
snapshot represent calendar Q3, all 18 compared Count values and all 18 Failed
values match this audit exactly. The candidates are models to which the Q4 fixture
adds one retained row while preserving preceding Count/Failed values.
ST12000NM0007 receives no appended Q4 row and is excluded because its last retained
calendar quarter remains unknown.

The fixtures encode relative retained positions without calendar dates. Agreement
therefore does not independently prove the calendar mapping. Count and Failed have
matching quarter-only meanings: distinct observed identities and summed daily
failure flags. New requires earlier first-appearance history; Retired requires
last-seen history and the newest-boundary rule. Count Delta requires the preceding
retained quarter. Cumulative AFR and AFR Delta require older history and cumulative
exposure; they cannot be equated with quarter-only AFR.

No production matrix, cumulative-history or production-anchor claim was generated.
B2 retention is coordinated separately by the primary; this audit makes no upload
claim. Raw data and private audit/cache artifacts remain outside Git.
