# Backward quarter audit: 2020 Q2

Localswim #0050 processed 2020 Q2 in the owner-authorized six-quarter backward
workset (#0050–#0055). Source data comes from
[Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data),
using its [official 2020 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2020.zip).
Processing and measurements are independent Sixbucks Solutions work.

## Measured result

| Item | Result |
| --- | --- |
| Source ZIP | 749,304,173 bytes; exact official HEAD size matched |
| Valid observation calendar | 91/91 days, 2020-04-01 through 2020-06-30 |
| Observations / drive-days | 12,498,547 |
| All-source inventory | 45 normalized models from 45 raw names |
| Model/serial identities observed during quarter | 144,876 |
| Daily failure flags | 314 |
| Daily Parquet | 78,204,543 bytes |
| Import receipt | 371,760 bytes |
| Summary frames and manifest | 1,206,533 bytes |
| Retained source, projection, receipt and summary | 829,087,009 bytes; staging evidence excluded |
| First summary pass | 7.98 seconds; summary-cache miss |
| Guarded warm summary reuse | 0.10 seconds; cache hit |

Actual member and internal row dates establish coverage; the publisher's catalog
file count is not calendar proof. The completed audit reconciles source,
receipt and partition hashes, footer/profile lineage, numerical budgets and
summary parity. The profile is `private-parquet-rich-v1-903ee87c89e5`.
No CSV was extracted.

## Source identity and inventory

The official HEAD response supplies no usable publisher SHA-1. **Publisher
checksum verification was unavailable.** Exact length, locally verified hashes,
ZIP member CRC checks and completed calendar validation provide the integrity
evidence; local hashes are not publisher checksum comparisons.

- Local SHA-1: `6e71632ef4550c5f482a762f0979eb4d299bbeb2`.
- Local SHA-256: `6bb65a6d8de146b3b0f1b68c55790df44083b5cc7c75490f231a30bf3d7ef374`.
- Summary input identity: `094c6c98295b85f9431c4dfc75366dc7e43dfe6f36c62d43741bd89b914dd3ea`.

The inventory retains all 45 normalized source models, including
11 evidenced HDD models and 34 unclassified models.
The full private inventory preserves every raw alias, count, exposure, failure
total and classification, including populations below 2,000. Population alone
does not establish media class. These unclassified models meet the
2,000-observed-identity threshold and remain unclassified:

| Model | Observed identities | Drive-days | Failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 2,953 | 266,200 | 1 |
| ST4000DM000 | 19,142 | 1,739,577 | 49 |
| HMS5C4040BLE640 | 12,748 | 1,159,472 | 9 |

Counts describe model/serial identities observed anywhere in the quarter,
not daily peak or quarter-end installed populations. A threshold crossing does
not establish an original eligibility anchor.

## Exact reference model and deployment boundary

**HUH721212ALN604** has 10,866 observed identities,
986,674 drive-days and 19 daily failure flags.
Its raw alias is `HGST HUH721212ALN604`; retained summary observations span
2020-04-01 through 2020-06-30.
Quarter-only AFR is 0.702866%, calculated as failure flags /
drive-days × 365 × 100. Similar ALE variants remain separate SKUs.

This complete quarter exceeds the 2,000-identity threshold. It is a retained
quarter component for investigating first deployment, not proof of first
appearance or first qualification. The first observed or qualifying quarter in
a loaded window is not an all-time deployment origin or original device age.
A first-deployment boundary requires a preceding complete zero-observation
quarter and adjoining complete positive coverage. No such boundary, complete
cumulative history or original production anchor is established by this packet.
No production matrix was generated.

## Timing and resource limits

| Phase | Admission wait (seconds) | Admitted elapsed (seconds) | Sampled owned-process-tree peak (GiB) |
| --- | --- | --- | --- |
| Download | 0.0004 | 18.27 | 0.017 |
| Projection | 0.0005 | 22.38 | 0.232 |
| Audit | 0.0023 | 11.18 | 1.730 |

Admission waits are separate from admitted phase elapsed time, which includes
process launch/import and cleanup. First/warm summary timings are internal
portions of the audit envelope, not additional phases. Each quarter used one
native worker and two Polars threads.

The original six-worker command envelope took 69.07947 seconds:
five audits succeeded and 2019 Q2 failed strict projection. A separate recovery later retained 90 valid days;
it does not change that original failure outcome. Whole-machine average CPU was 48.69%;
sampled owned-worker peak was 7.55 GiB and minimum available
memory was 28.15 GiB. These are shared batch measurements,
not this quarter's isolated resource usage. This is neither six successful
quarters nor a controlled serial-versus-parallel speedup.

All protected earlier artifacts remained unchanged in the coordinator's expanded
preservation check: all 24 prior quarter caches plus preferred/repacked artifacts.
Cold refers to the summary cache; the operating-system cache was not flushed.
Working sets were sampled approximately every 0.25 seconds and may miss brief
peaks or count shared pages. Measurements do not bound full-history aggregation
memory. The archive is below 2 GiB and retained footprint below the 10 GiB
additional-disk envelope. The worker's contemporaneous footprint
(829,158,331 bytes) also included staging evidence and differs from
the receipt-inclusive retained-artifact total above.

## Evidence and handoff

Private evidence remains in ignored `data/staging/0050/`: `audit.json` and
`.txt`, `results-summary.json` and `.txt`, `download.json`, `envelope.json`,
sanitized `source-head.headers`, calendar records and phase resource records.
Final reconciliation verified metadata and small retained summary hashes, then
read the drive summary without another logical daily scan. Guarded warm reuse
forbade daily DataFrame reads and scans while allowing byte hashes and small
summary reads.

Fresh independent artifact review passed. Parent-coordinated B2 transfer,
actual encrypted SHA-256 readback, separate-root restore, guarded summary reuse
and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-origin-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
