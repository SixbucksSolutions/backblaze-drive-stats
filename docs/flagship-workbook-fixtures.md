# Workbook reference fixtures

Ticket #0014 extracts the two owner-supplied workbook references as **golden
reference evidence**, separate from the proposed production matrix contract.
The originals remain unchanged under ignored `data/references/`. Extraction uses
read-only ZIP/XML, without recalculation or an alternate spreadsheet renderer.
Only model aggregates and provenance are committed; no serials or source files.

These are behavior baselines, not a correctness oracle. The owner explicitly
expects legacy errors may exist. Exact extraction must preserve such an error if
found; production corrections need independent numerical evidence and a declared
metric/version decision, rather than changing the historical fixture silently.

## Files and precision

| Fixture | Contents |
| --- | --- |
| `fixtures/workbooks/2025-Q3.json` | All 19 models, 27 display rows per model, 307 populated model-rows |
| `fixtures/workbooks/2025-Q4.json` | All 19 models, 28 display rows per model, 325 populated model-rows |
| `fixtures/workbooks/revisions.json` | All 22 changes to existing populated cells, exclusively Retired |
| `fixtures/workbooks/owner-stories.json` | Eight owner reading cases covering nine distinct models, with both snapshot ranges |

Snapshot fixtures use schema `workbook-reference-fixture/v1`. Each contains the
source URL, owner-supplied snapshot label, byte count and exact SHA-256 recorded in
[the reference audit](workbook-reference-analysis.md). A source hash mismatch
fails extraction instead of silently replacing the baseline. Snapshot names are
owner-supplied labels; XLSX metadata does not establish actual as-of dates or
invocation parameters.

`metrics` fixes cell-array order: `afr`, `afr_delta`, `count`, `count_delta`, `new`,
`retired`, `failed`. Every row has seven `[source_cell, raw_value]` pairs. A
numeric `raw_value` is the **exact OOXML `<v>` text string**, never a rounded
display value or a binary-float rewrite. For example, C6 retains
`"2.005727880425647"`. Parse with Decimal for parity comparisons, or convert
deliberately in a rendering adapter. AFR is in percent units; AFR Delta is in
percentage points. Other metrics are integer counts, including negative Count
Delta. No derived production AFR denominators are implied.

`sheet_row` and explicit cell coordinates retain physical positions;
`display_ordinal`, `display_year` and `display_quarter` preserve the reference's
relative labels. `retained_ordinal` exists only for populated rows. These are
retained-row positions, **not actual drive age or proven elapsed calendar time**.
First-row deltas subtract zero; later deltas subtract the previous retained row.
Tests reconcile those original values without changing their convention.

Every visible trailing blank is explicit: seven null values,
`status: "trailing_blank_unknown"`, and null `retained_ordinal`.
It does not establish a threshold exit, a missing source quarter or a future
quarter. `calendar_quarter` and `exposure_drive_days` remain null even for
populated rows. Calendar anchors, actual cutoff, cumulative exposure/failures,
coverage, entry/exit reasons and whether a particular row is a provisional
newest-quarter Retired substitution cannot be reconstructed from these XLSXs.
The fixture does not invent them. A production matrix needs separately validated
source history and the accepted matrix contract.

## Shared colors

Each snapshot preserves seven `color_rules`, with original priorities and
discontiguous source `scope` ranges. Each metric's domain includes all 19 models
and every display row, irrespective of a UI's selected models or viewport.
Numeric domains ignore blanks and preserve observed zeros. Each rule records
numeric/blank counts, minimum, median, maximum and resolved threshold stops.

Median uses inclusive percentile interpolation: sort numeric values,
`rank = (n - 1) * p / 100`, then linearly interpolate neighboring values. P50 is
the median, not the midpoint of the range. For these odd-sized source domains,
the median is an observed value. A separate even-sized synthetic test verifies
interpolation. Color interpolation occurs between resolved stops; numeric
threshold resolution is recorded independently of any renderer.

| Metric | Low → middle → high stops |
| --- | --- |
| AFR | min green → 1 yellow → 2 red |
| AFR Delta | min green → 0 white → max red |
| Count | min red → P50 yellow → max green |
| Count Delta | min red → 0 white → max green |
| New | 0 white → max green |
| Retired | 0 green → P50 yellow → max red |
| Failed | min green → P50 yellow → max red |

New's low color preserves malformed source `raw_argb: "FFFFFFFFF"` alongside
normalized `css_color: "#FFFFFF"` and an explicit owner-screenshot normalization
reason. This is intended web white, not the alternate renderer's erroneous
black. Source workbooks are never repaired. Other raw ARGB colors are retained
with their six-digit CSS equivalents.

Count's shared maximum changes from 40,322 to 44,425; unchanged cells can therefore
receive different shading in the next snapshot. Domains are immutable within a
snapshot, not across snapshots. The 22 existing Retired changes are listed with
model, retained ordinal, cell address and before/after strings; examples include
CN6 4→3 and BL21 16→30. New rows are distinct from existing-cell revisions.

## Owner cases

All retained rows and seven metrics for every case are already in each snapshot.
The small story index references those ranges instead of duplicating values.
These are historical owner interpretations, not automated rankings, defect
findings, current shopping availability or procurement-motive claims.

1. ST12000NM0007: warning reference combining worsening AFR, retirement waves and
   shrinking Count.
2. WUH721816ALE6L4: promising low AFR and growing Count; only 14 retained quarters
   in Q4, short of the full service-life horizon.
3. HUH721212ALN604: mature history before late deterioration, preserving the
   owner's age-context reading.
4. MG08ACA16TA and MG08ACA16TE: early spikes settling toward 1%; MG08ACA16TA's
   first displayed AFR is 3.570438723771948 with zero quarter Failed. The missing
   pre-eligibility denominator must remain unknown here.
5. ST16000NM001G: favorable owner comparison with historical shopping
   unavailability supplied by the owner, not inferred from the workbook.
6. ST24000NM002H: cumulative AFR increases during a growing rollout, before a
   large retirement wave is required to raise concern.
7. HUH721212ALE604: New falls after ordinal 5 while Count plateaus near 13,000.
8. WUH722222ALE6L4: continuing bulk additions and Count reaching 44,425, a
   deployment-flow comparison with case 7.

## Reproduce and verify

With the two original XLSXs at their audited paths, run from the repository root:

```powershell
uv run --frozen python tools/extract_workbook_fixtures.py
uv run --frozen python tools/extract_workbook_fixtures.py --check
uv run --frozen python -m unittest discover -s tests -p test_workbook_fixtures.py -v
```

The extractor uses only Python's standard library. `--source-dir` and
`--output-dir` support other local directories; `--check` writes nothing and
compares canonical UTF-8 bytes. JSON is compact, deterministic, newline-terminated
and has no generation timestamps or machine-specific absolute paths.

Offline tests validate all model shapes, exact integer counts, blank/zero
distinctions, retained ordinals, delta baselines, seven complete shared scopes,
their domains/stops and the malformed-color normalization. They also check all
owner-case references, critical numeric examples, 18 model extensions, and every
existing-cell revision. If local originals are available, optional source parity
re-extracts all four files byte-for-byte and rechecks original source hashes.
Without originals that one test skips; all remaining golden checks run offline.
No cloud access, downloads or native Excel session are needed.
