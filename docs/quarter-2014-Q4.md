# Backward quarter audit: 2014 Q4

Localswim #0076 recovered the valid observations from 2014 Q4 in the owner-approved
ten-quarter workset (#0074–#0083). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its official [2014 annual archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_2014.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Incomplete-quarter result

**91 of 92 observation days are available.** The CRC-valid member
`2014/2014-11-02.csv` contains an 85-column required header, zero observation
rows and 1,407 bytes (CRC-32 `a4cbfe51`). A header-only file does not establish
zero observed drives. Exposure and failures for November 2 remain unknown.
No authoritative source correction has been established.

| Item | Result |
| --- | --- |
| Shared annual source ZIP | 587,751,755 bytes; exact official HEAD size matched |
| Whole annual source calendar | 365 member dates, 2014-01-01 through 2014-12-31 |
| Valid selected observation calendar | 91/92 days, 2014-10-01 through 2014-12-31; November 2 unavailable |
| Selected valid CSV member bytes (uncompressed) | 889,693,885; header-only member adds 1,407 bytes |
| Known observations / drive-days | 3,629,432 |
| Known daily failure flags | 419 |
| Observed model/serial identity lower bound | 43,945 |
| Full-quarter drive count / AFR | unknown / undefined (`null`) |
| All-source inventory from valid days | 76 normalized models from 76 raw names |
| Promoted daily Parquet | 25,871,965 bytes across 91 days |
| Promoted partial import receipt | 162,698 bytes |
| Promoted summary frames and manifest | 543,440 bytes |
| Canonical payload | 26,578,103 bytes; 95 reviewed files |
| Source plus canonical payload | 614,329,858 bytes; staging excluded; shared ZIP non-additive |
| Complete isolated recovery root | 26,616,518 bytes, including final report JSONs |

The fresh isolated recovery copied all 32 verified original daily projections
and strictly projected 59 additional valid days. All 32 original files remained
unchanged. Promotion preserved those originals and added only missing reviewed
payload to standard roots. All 95 promoted files were verified byte-equivalent;
the unavailable day remains absent. The receipt's `selectedQuarter` is `2014-Q4`.
The rich profile is `private-parquet-rich-v1-903ee87c89e5`.

The helper's earlier `additionalOutputBytes` counter was 26,578,103 bytes and
predated final report writes. It does not measure the complete isolated recovery
root; the 26,616,518-byte measurement above includes the partial projection,
partial receipt and final audit JSON reports. The canonical payload and isolated
recovery are separate retained copies and must not be confused or summed with
shared source footprints without explicit physical accounting.

The whole annual ZIP is shared by four 2014 quarters through one primary download.
Each quarter selects its own members and rows. Physical batch storage counts the
ZIP once; per-quarter source-inclusive footprints are non-additive. No CSV was
extracted, dates reassigned, empty day manufactured or records automatically
deduplicated.

## Source identity and inventory

The official 2014 HEAD response has no usable publisher SHA-1. **Publisher checksum
verification was unavailable.** Exact length, local hashes, member CRC checks and
valid-day reconciliation are integrity evidence; local hashes are not publisher
checksum comparisons.

- Local SHA-1: `bd1ba79db8ec5d6743363300acb8e55e857357ef`.
- Local SHA-256: `a16ae31ab9b5ac73fcd64554e4d4d49cdbcd2a22bcae73bcebcf0426ce859ef5`.
- Summary input identity: `8ed0fc400fbbc0bf66a45b5242ac3542d4c3e8efe2580dc56ada96eb91f85ba8`.

The private inventory preserves all 76 normalized models and every raw alias,
including populations below 2,000, with known exposure and failures. There are
0 evidenced HDD models and 76 unclassified models. Population alone does not
establish media class. These unclassified models meet the 2,000-observed-identity
lower-bound threshold on the 91 valid days and remain unclassified:

| Model | Observed identity lower bound | Known drive-days | Known failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 7,152 | 603,153 | 20 |
| Hitachi HDS722020ALA330 | 4,700 | 423,659 | 14 |
| ST4000DM000 | 12,713 | 1,022,362 | 79 |
| ST3000DM001 | 2,244 | 124,484 | 159 |
| Hitachi HDS5C4040ALE630 | 2,655 | 233,908 | 11 |
| HMS5C4040BLE640 | 3,106 | 271,079 | 3 |
| Hitachi HDS5C3030ALA630 | 4,605 | 417,931 | 9 |

These are quarter-local observed model/serial identities, not quarter-end installed
populations or complete-quarter counts. The unavailable day could add identities,
exposure or failures. Threshold crossings do not establish original eligibility
anchors. Full-quarter model counts and AFR remain `null`, including for these
qualifiers; no complete cumulative history or true production origin is established.

## Exact reference model and historical frontier

| Exact model | Observed identities on valid days | Known drive-days | Known failure flags | First / last observed |
| --- | --- | --- | --- | --- |
| HUH721212ALN604 | 0 | 0 | 0 | none / none |
| ST12000NM0007 | 0 | 0 | 0 | none / none |
| ST8000DM002 | 0 | 0 | 0 | none / none |
| ST8000NM0055 | 0 | 0 | 0 | none / none |

These zeros apply only to the 91 valid observation days. They do not prove absence
on November 2 or complete-quarter absence. Full-quarter counts and AFR remain
unknown/undefined. Similar ALE variants remain separate SKUs and are not merged
with exact **HUH721212ALN604**. History anchor is unverified, cumulative history is
incomplete, and no production matrix was generated.

## Timing and resource limits

The separate guarded recovery envelope was **8.2730433 seconds**, with
0.0008571 seconds of admission wait and sampled owned-process-tree peak
**976,830,464 bytes (0.910 GiB)**. It used one native worker and two Polars
threads. First summary construction took 1.51 seconds and missed the summary cache;
guarded warm reuse hit it. Recovery and promoted-root warm checks each forbade
daily logical reads/scans and recorded zero such reads/scans.

The original native ten-quarter envelope remains **14.6101304 seconds**, reusing
pre-downloaded annual ZIPs: seven complete audits, #0082 partial published domain,
#0083 unpublished/no ETL, and #0076 projection failure. This later recovery does
not change the original failure or make the original batch ten complete audits.
Bootstrap, preservation checks, independent review, recovery and cloud work are
outside that original envelope. Original sampled batch peak was 2.474 GiB,
minimum system available memory 34.317 GiB and whole-machine average CPU 46.98%.
These observations do not establish controlled speedup or a capacity ceiling.
Working-set sampling may miss brief peaks or count shared pages; the operating
system cache was not flushed, and full-history aggregation memory is not bounded.

The source is below the **2,147,483,648-byte archive cap**; retained artifacts
are below the **10,737,418,240-byte additional-disk envelope**.

## Evidence and handoff

Fresh independent actual-output review passed, binding source and receipt hashes,
all recovered partition lineage, numerical budgets and summary parity. Fresh
independent promotion review passed for all 95 standard-root payload files and
guarded warm reuse. Review pins are:

- Actual-output review: `24306688f0d2a35be1a582ab7b19b62453057f0fe92326261d47036485b06b0d`.
- Actual-promotion review: `2428cbef376ba509e9b925926d0a1cc36abc8642094f85eaf337ac696d8ab9a5`.

Private evidence is in ignored `data/staging/0076/`, including source findings,
recovery and promotion review JSON/TXT, partial recovery resource records,
`recovery-2014-Q4/partial-audit.json`, the partial receipt and projection report,
and `results-summary.json` / `.txt`. Packet reconciliation used metadata and the
small retained drive summary; it performed no daily or source-body scan.

Fresh independent artifact review passed. B2 transfer, encrypted SHA-256
readback, zero-write reuse, separate-root restore and guarded cache reuse passed
for the nine new datasets. Source availability/domain metadata and the preferred
53-dataset catalog were published after independent acceptance. See the
[full-source handoff](source-history-completion.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
