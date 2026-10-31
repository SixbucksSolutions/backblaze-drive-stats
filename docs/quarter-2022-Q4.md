# Source issue: 2022 Q4

Localswim #0040 acquired the official [2022 Q4 archive](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q4_2022.zip)
from [Backblaze Drive Stats](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
in the owner-approved eight-quarter batch (#0033–#0040). Strict projection stopped
at the member named `2022-12-10.csv`: every row inside is dated **2022-12-11**.
The quarter does not pass a complete-calendar audit. A reviewed partial recovery
now retains 91 valid observation days and explicitly records December 10 as
unavailable, without treating it as zero or correcting its date.

## Read-only source investigation

Both December 10 and December 11 members contain 235,623 rows, 179 columns and
82,735,746 uncompressed bytes, but different CRCs. A bounded full-row multiset
comparison hashed canonical parsed CSV rows, retaining multiplicities and ignoring
row order. It found:

- 235,615 rows match across every column.
- Eight rows differ: the December 10-named member records zero failures, while
  the December 11-named member records eight failure flags.
- After excluding only `failure`, all 235,623 rows match across every remaining
  column, including all SMART values and identity fields.
- Every row in both members has internal date December 11. The December 9 member
  has 235,614 rows, all internally dated December 9.

This is consistent with the same internally December 11 snapshot carrying
different failure annotation. It does not establish a distinct December 10
capture or justify relabeling either member. No dates were changed or imputed;
the strict production parser remains unchanged.

Bounded searches of official Backblaze web sources and its GitHub organization
found no authoritative erratum or replacement daily source. That search result
does not prove none exists. No alternate daily path surfaced, so no speculative
alternate endpoints were probed and no other-quarter archive was downloaded.

## Retained evidence and limitations

The official ZIP is 821,370,492 bytes, matching HEAD and below the 2 GiB cap.
Publisher SHA-1 was unavailable; **no publisher checksum comparison is claimed**.

- Local SHA-1: `8b109f2436d81c2aa073b8e8895f89d073a37ac3`.
- Local SHA-256: `d89203d0906ca13860988e66320812f004eddb7afe816060849de9fbf2517ea1`.
- Filename-level calendar checks found all 92 expected daily names, despite the
  catalog listing 93 files. Internal row dates invalidate complete coverage.

Ignored `data/staging/0040/` retains the source envelope, HEAD and download records,
`internal-date-diagnostic.json`, `member-multiset-diagnostic.json` and
`official-errata-search.json`. The diagnostic writes no raw rows or serial
identifiers. Raw CSVs were streamed from the ZIP and never extracted to disk.
## Verified partial recovery

The recovery reused 70 atomically completed daily files after validating their
source lineage, Arrow types, writer/profile specification, row-group sorting,
statistics/index/bloom metadata, stored-body page checksums and observation dates.
The unchanged strict parser projected the remaining 21 valid days. Only the
invalid December 10 member is excluded; its original member path, CRC, size,
internal date and disposition remain in the receipt's source-coverage exception.
The original ZIP is intact. No record was relabeled or imputed.

| Known observation component | Result |
| --- | --- |
| Valid daily partitions | 91 of 92 expected days |
| Unavailable observation date | 2022-12-10 |
| Known drive-days | 21,260,686 |
| Known failure flags | 735 |
| Observed model/serial identities, a lower bound | 236,495 |
| Canonical models in valid observations | 71 |
| Full-quarter Count and AFR | Unknown / null |

The private summary's coverage is **incomplete**. Guarded warm reuse succeeds
without daily logical reads. Missing exposure or failure flags are not assumed
to be zero, and the known observations do not certify full-quarter eligibility,
cumulative-history completeness or an original model anchor.

Exact **HUH721212ALN604** appears as `HGST HUH721212ALN604`: at least 10,796
observed identities, 980,680 known drive-days and 23 known flags. Its full-quarter
Count and AFR remain null. ALE variants stay separate. This establishes presence,
not absence or the first appearance, so backward search continues.

Fresh independent review verified all 91 partition hashes/footers/profile/lineage,
the exclusion and calendar, unchanged bytes for the 70 reused files, and the 21
new dates. Three complete independently parsed CSV-day multisets (October 1,
December 11 and December 31) match the projections. Summary budgets, null full-
quarter metrics, guarded warm reuse and all 679 prior-file hashes reconcile.
This is bounded independent CSV parity, not a second full-quarter raw reparse.

Evidence: `partial-projection.json`, `partial-audit.json`,
`independent-review-source.json` and `independent-review.json` in the ignored
staging directory. The original eight-pipeline attempt still records seven
successful complete audits and this source failure in 107.60 seconds; partial
recovery is separate and does not turn that into a clean eight-quarter result.

The partial processing files and explicit exclusion receipt are also retained in
B2. Source/readback hashes, zero-write reuse, a separate restore and a guarded
restored-summary hit passed. Independent local source/restore validation confirms
the missing date and incomplete coverage survived transport. See the
[batch retention report](eight-quarter-benchmark.md).
