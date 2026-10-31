# Backward quarter audit: 2025 Q2

Localswim #0030 acquired and privately audited 2025 Q2 within the owner-approved
four-quarter benchmark (#0029–#0032), after acceptance of the pilot and Q4 audit.
Source data comes from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2025 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2025.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 1,067,562,257 bytes; publisher SHA-1 and local SHA-256 verified |
| Calendar | All 91 days, 2025-04-01 through 2025-06-30 |
| Observations / drive-days | 28,808,042 |
| All-source inventory | 74 normalized models from 75 raw names |
| Model/serial identities observed during quarter | 322,499 |
| Daily failure flags | 1,061 |
| Unclassified inventory | 40 models; retained explicitly in the private inventory |
| Projected daily Parquet | 166,545,752 bytes |
| Summary frames and manifest | 2,345,943 bytes |
| Original download | 49.32 seconds |
| Recovery projection | 52.39 seconds; sampled own-process-tree peak 0.51 GiB |
| First summary pass | 15.16 seconds; summary-cache miss |
| Guarded summary reuse | 0.21 seconds; cache hit |
| Recovery whole audit | 18.64 seconds; sampled own-process-tree peak 3.40 GiB |
| Current ZIP, committed projection/receipt and summary | 1,237,000,430 bytes; excludes preserved partial outputs and private evidence |

Each quarter worker used four Polars threads. The initial coordinator stopped
approximately 62 seconds into the batch after a PermissionError. The recovery
reused all four verified ZIPs and the committed Q1 projection; it rebuilt the
other three quarter projections, including Q2, then aligned the audits. Original
download evidence remains in `data/staging/0030/attempt-1/`; interrupted projection
artifacts remain in the original batch's `attempt-1-projections` directory.

These are measurements under concurrent batch load. Combining the original
download with recovery phases does not establish clean four-quarter end-to-end
throughput. The first summary pass was cold only for the summary cache; the
operating-system cache was not flushed. Memory sampling can miss short peaks.
The figures do not establish full-history aggregation memory limits.

The source remained below the 2 GiB archive cap. Publisher SHA-1 is
`5d77a593b635ef26d42e01572da40e153b421022`; local SHA-256 is
`cb2e7a2354e5691ac0660302d59ab807bf40a8d436701448bf2a92c7dad0fc09`.
The recovery verified the retained source and downloaded zero source bytes.
No CSV was extracted to disk.

## Acceptance evidence

The production projector and `tools/verify_quarter.py` completed successfully.
The audit verifies complete calendar coverage, ZIP and receipt identity,
partition hashes, footer lineage/profile, numerical budgets and summary parity.
The guarded second pass confirms a current-profile cache hit while forbidding
daily DataFrame reads/scans; byte hashing and small summary reads remain allowed.
All-source raw aliases and media classifications remain in the private report.
Unclassified candidates are retained rather than silently omitted or assigned a
media class from their population.

Private evidence under ignored `data/staging/0030/` includes `audit.json` and
`.txt`, `results-summary.json`, `envelope.json`, `source-head.headers`,
`calendar-expectations.json`, `source-reuse.json`, phase resource samples, and
the original download evidence in `attempt-1/`. The author reconciled inventory
totals and exact-model counts, exposure, failures and observed dates against
the small retained summary. Fresh independent artifact review is recorded
separately before handoff; this author reconciliation is not independent review.

## Exact reference model and search boundary

**HUH721212ALN604** has 10,070 observed identities, 903,548 drive-days and 84 daily
failure flags, spanning April 1 through June 30. Its sole observed raw alias is
`HGST HUH721212ALN604`. Quarter-only AFR is approximately 3.3933%. Count means
identities observed anywhere during the quarter, not quarter-end population.
ALE variants remain separate SKUs.

The exact reference is present above the 2,000-identity threshold in this fully
covered quarter. This quarter therefore does not meet the complete-zero stopping
rule. The first observed quarter and first qualifying quarter remain separate
questions requiring earlier evidence; this audit establishes neither origin nor
global inception. Below-threshold observations must remain visible as backward
search continues.

No calendar Q2 workbook fixture comparison is claimed. Quarter-only results do
not establish cumulative AFR, lifecycle New/Retired values, production anchors or
observation-date coverage of the old Iceberg source. No production matrix or
cumulative-history claim was generated. Remote private cache retention is handled
separately by the primary after independent review.
