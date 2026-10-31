# Source issue and partial recovery: 2019 Q2

Localswim #0054 acquired the official [2019 Q2 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2019.zip)
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
in the owner-approved six-quarter batch (#0050–#0055). Strict projection stopped
at `2019-06-17.csv`: one row is internally dated June 15. The quarter does not
pass a complete-calendar audit. A reviewed isolated partial recovery retains
90 valid observation days and explicitly records June 17 as unavailable.
Processing and measurements are independent Sixbucks Solutions work.

## Source investigation

The June 17 member has 110,533 rows and a complete 129-column header, consistent
row widths, nonnull required fields, integer capacities/failures and a verified
ZIP CRC. Its date tokens are `6/17/19` for 110,532 rows and `6/15/19` for one row.
Converting date syntax alone does not resolve the mixed observation date.

The stale-date row is a failure observation. Its identity appears on June 15
and June 16 with different nondate required fields, and is absent on June 18.
These comparisons do not establish a safe source-date correction or the number
of unavailable June 17 failures. June 16 and every member from June 18 through
June 30 pass the unchanged strict parser and CRC validation.

The recovery excludes the entire June 17 member. No date was relabeled, no
failure reassigned and no observation imputed. The original ZIP remains intact;
the strict production parser remains unchanged. Raw CSVs were streamed from
the ZIP and never extracted to disk. No authoritative source correction is
established by the retained investigation.

## Source identity

The official ZIP is 574,522,473 bytes, matching HEAD and below the 2 GiB cap.
Publisher SHA-1 was unavailable; **no publisher checksum comparison is claimed**.

- Local SHA-1: `caa8536fb888c0466dbbfe714b0c7e44b489d3f5`.
- Local SHA-256: `af9c4c61c0723b1fe7b3d2426763232bb7bf6c238dd2e279a9a1539d3440a963`.
- All 91 expected daily filenames exist, but internal row dates invalidate
  complete coverage. Filename-level calendar checks are not observation proof.

## Verified isolated partial recovery

The recovery copied 77 atomically completed daily files into an isolated output
root after validating source lineage, Arrow types, writer/profile specification,
row-group sorting, statistics/index/bloom metadata, stored-body page checksums
and observation dates. The unchanged strict parser projected the remaining
13 valid days, June 18–30. All 77 original files remain byte-for-byte unchanged.
The explicit receipt retains the excluded member's path, CRC, size, date tokens
and disposition.

| Known observation component | Result |
| --- | --- |
| Valid daily partitions | 90 of 91 expected days |
| Unavailable observation date | 2019-06-17 |
| Known drive-days | 9,720,605 |
| Known failure flags | 492 |
| Observed model/serial identities, a lower bound | 111,817 |
| Canonical models in valid observations | 42 from 42 raw names |
| Full-quarter Count and AFR | Unknown / null |

Coverage is **incomplete**. Missing exposure and failure flags are not zero.
Observed identity counts are lower bounds, not complete-quarter counts,
quarter-end populations or proof of full-quarter eligibility. Cumulative
history remains incomplete; no original model anchor or public matrix is produced.

The full private all-source inventory retains every alias, known exposure,
known failure total and classification, including populations below 2,000.
There are 7 evidenced HDD models and 35 unclassified models. Population
alone does not establish media class. These unclassified models have observed
identity lower bounds of at least 2,000; they remain unclassified:

| Model | Observed identity lower bound | Known drive-days | Known failure flags |
| --- | --- | --- | --- |
| HMS5C4040ALE640 | 2,676 | 232,659 | 5 |
| ST4000DM000 | 19,924 | 1,762,279 | 103 |
| HMS5C4040BLE640 | 12,770 | 1,147,536 | 14 |

Exact **HUH721212ALN604** appears as `HGST HUH721212ALN604`: at least
9,675 observed identities, 636,296 known drive-days and 5 known flags.
Retained summary observations span 2019-04-01 through 2019-06-30, with June 17
unavailable. Its full-quarter Count and AFR remain null. ALE variants stay
separate. This establishes presence, not absence, first appearance or a first
qualifying quarter. The [combined search](ten-quarter-origin-backfill.md)
separately records the complete 2018 Q2/2018 Q3 boundary and 2019 Q1 threshold.

## Timing, footprint and independent review

Isolated recovery took 14.82 seconds after 0.0013 seconds of
admission wait, including launch/import and cleanup. Sampled owned-process-tree
peak working set was 1.531 GiB; sampling can miss brief peaks
and count shared pages. The first summary pass took 3.19 seconds within
that recovery envelope. Guarded warm reuse passed with no daily logical reads
or scans. These measurements do not bound full-history aggregation memory.

| Isolated artifact footprint | Bytes |
| --- | --- |
| Daily observations, including the 77 verified copies | 63,102,707 |
| Explicit partial receipt | 238,085 |
| Summary frames and manifest | 1,012,220 |
| Isolated observations, receipt and summary | 64,353,012 |
| Shared original ZIP plus isolated observations, receipt and summary | 638,875,485 |

These totals exclude staging reports and the 53,812,947 bytes of original
failed-attempt daily projections retained separately. The source ZIP is counted
once in the final row. They are artifact totals, not a combined physical-disk
measurement across original and isolated roots. The audit's additional-output
figure (64,353,012 bytes) matches the isolated artifact total above.

Fresh independent review passed for all 90 partition hashes, bodies, dates,
footers, profile and lineage; the exclusion/calendar; unchanged bytes for the
77 originals; and 13 new dates. Three independently parsed full CSV-day
multisets (April 1, June 18 and June 30) match the projections. Summary budgets,
null full-quarter metrics and guarded warm reuse reconcile. This is bounded
independent CSV parity, not a second full-quarter raw reparse.

Private evidence remains in ignored `data/staging/0054/`: source findings and
diagnostics, `recovery-2019-Q2/partial-import-metadata.json`, `partial-projection.json`
and `partial-audit.json`, plus `independent-actual-review.json`, resource records
and `results-summary.json`/`.txt`. Final packet reconciliation read only metadata
and the small retained drive summary, with no new logical daily read.

The original six-quarter attempt remains five complete audit successes and this
source failure in 69.07947 seconds. Separate partial recovery does not turn it
into six complete quarters or establish a serial-versus-parallel speedup.
Fixed-root promotion passed separate independent review with all 77 original
partitions unchanged. Fresh independent artifact review passed. Parent-coordinated B2 transfer,
actual encrypted SHA-256 readback, separate-root restore, guarded summary reuse
and preferred `cache-v2` catalog publication also passed. See the
[ten-quarter handoff](ten-quarter-origin-backfill.md). Data and private evidence
remain outside Git; owner acceptance remains separate from technical verification.
