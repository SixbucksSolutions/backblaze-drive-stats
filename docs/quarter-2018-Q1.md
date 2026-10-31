# Source issue and partial recovery: 2018 Q1

Localswim #0062 acquired the official [2018 Q1 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2018.zip)
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
in the owner-approved four-quarter batch (#0059–#0062). Strict projection stopped
at `2018-02-25.csv`: every date is non-ISO text and every capacity uses rounded
scientific notation. The quarter does not pass a complete-calendar audit.
An isolated partial recovery retains 89 valid observation days and explicitly
records February 25 as unavailable. Fresh actual-artifact review passed.
Processing and measurements are independent Sixbucks Solutions work.

## Source investigation

February 25 has 100,253 rows, a complete common 105-column header, consistent
row widths, nonnull required fields and verified ZIP CRC. Every date token is
`2/25/18`; all 100,253 capacity tokens use rounded scientific notation, with
no integer capacity tokens. Converting date syntax alone would not restore
precise capacity bytes.

For shared model/serial identities, every February 25 decimal capacity differs
from the neighboring exact capacity: 100,248 comparisons against February 24
and 100,250 against February 26. There are no duplicate raw identities or
scientific-notation serial tokens. One failure flag is present in the excluded
member. These facts do not authorize reconstructing capacities, assigning the
flag to a retained day or treating unavailable observations as zero.

The recovery excludes the entire February 25 member. No date was relabeled,
capacity reconstructed, failure reassigned or observation imputed. The ZIP and
55 atomically completed original daily files remain unchanged. The strict
production parser remains unchanged. Raw CSVs were streamed during investigation
and recovery, never extracted to disk. No authoritative source correction is
established by this bounded local-source investigation.

## Source identity

The official ZIP is 507,437,557 bytes, matching HEAD and below the 2 GiB cap.
Publisher SHA-1 was unavailable; **no publisher checksum comparison is claimed**.

- Local SHA-1: `0641b40e4acd956e05c031ab79a19639d122c1de`.
- Local SHA-256: `c33a2fb54b6bb65412611e4656f5100a21c4bee86e5ecc4e52b223aab0474d5e`.
- All 90 expected filenames exist, but the affected member's representations
  invalidate strict complete coverage. Filenames are not observation proof.

## Isolated partial recovery

The recovery copied 55 completed daily files into an isolated output root after
validating source lineage, Arrow types, writer/profile specification, sorting,
statistics/index/bloom metadata, stored-body page checksums and observation
dates. The unchanged strict parser projected the remaining 34 valid days,
February 26–March 31. All 55 originals remain byte-for-byte unchanged. The
explicit receipt records the excluded member's path, CRC, size, date tokens,
numerical issue and whole-day disposition.

| Known observation component | Result |
| --- | --- |
| Valid daily partitions | 89 of 90 expected days |
| Unavailable observation date | 2018-02-25 |
| Known drive-days | 8,849,239 |
| Known failure flags | 332 |
| Observed model/serial identities, a lower bound | 105,004 |
| Canonical models in valid observations | 53 from 53 raw names |
| Full-quarter Count and AFR | Unknown / null |

Coverage is **incomplete**. Missing exposure and failures are not zero.
Identity counts are lower bounds, not complete-quarter counts, quarter-end
populations or proof of full-quarter eligibility. Full-quarter eligibility
remains unknown. Cumulative history is incomplete; no public matrix is produced.

The full private inventory retains every alias, known exposure, known failure
total and classification, including populations below 2,000. It includes 3
evidenced HDD models and 50 unclassified models. Population alone does not
establish media class. These unclassified models have observed identity lower
bounds of at least 2,000 and remain unclassified:

| Model | Observed identity lower bound | Known drive-days | Known failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 6,237 | 499,514 | 8 |
| ST4000DM000 | 32,091 | 2,791,074 | 178 |
| Hitachi HDS5C4040ALE630 | 2,296 | 114,888 | 0 |
| HMS5C4040BLE640 | 15,374 | 1,347,944 | 16 |

Exact HUH721212ALN604 is absent from the 89 known valid days, with no raw alias
in their all-source inventory. February 25 is unavailable, so this is not a
complete-quarter zero and cannot establish an absence or birth boundary. The
later complete 2018 Q2 zero and complete 2018 Q3 positive independently provide
the candidate observed boundary. ALE variants remain separate SKUs. No global
inception, continuous service or original production anchor is established.

## Timing, footprint and review status

Isolated recovery took 14.42 seconds after 0.0010 seconds of
admission wait, including launch/import and cleanup. Sampled owned-process-tree
peak was 1.450 GiB. Sampling can miss brief peaks and count shared
pages. The first summary pass took 3.18 seconds within the recovery envelope.
Guarded warm reuse passed with no daily logical reads or scans. These figures
do not bound full-history aggregation memory. One worker used two Polars threads.

| Isolated artifact footprint | Bytes |
| --- | --- |
| Daily observations, including the 55 verified copies | 56,313,315 |
| Explicit partial receipt | 194,122 |
| Summary frames and manifest | 969,219 |
| Isolated observations, receipt and summary | 57,476,656 |
| Shared original ZIP plus isolated observations, receipt and summary | 564,914,213 |

These totals exclude staging reports and the 34,692,068 bytes of original
failed-attempt daily projections retained separately. The source ZIP is counted
once in the final row. These are artifact totals, not combined physical-disk
measurements across original and isolated roots. The audit's additional-output
figure (57,476,656 bytes) matches the isolated total above.

Fresh independent actual-artifact review passed all 89 partitions, three full
CSV-day multisets, known summary budgets and guarded warm reuse. Private
evidence remains in ignored `data/staging/0062/`: source findings and forensics,
`recovery-2018-Q1/partial-import-metadata.json`, `partial-projection.json`,
`partial-audit.json`, resource records and `results-summary.json`/`.txt`.
Final packet reconciliation read only small metadata and retained summary
evidence, with no new logical daily read.

The original four-quarter attempt remains three complete audit successes and
this source failure in 56.28693 seconds. Separate partial recovery does not make
four complete quarters or establish a serial-versus-parallel speedup.
Fixed-root promotion passed separate independent review with all 55 original
partitions unchanged. Fresh independent artifact review passed. Parent-coordinated B2 transfer,
actual encrypted SHA-256 readback, separate-root restore, guarded summary reuse
and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-origin-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
