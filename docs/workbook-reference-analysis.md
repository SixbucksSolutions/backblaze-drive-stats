# Quarterly workbook reference audit

Read-only evidence for #0013, 2026-10-30. Both references were inspected directly as ZIP/XML; neither was recalculated, exported or changed. Native rendering is a separate check. Private extraction: `data/references/workbook-audit.json`.

## Source identity

| Reference | Bytes | SHA-256 |
| --- | ---: | --- |
| `data/references/2025-Q3_quarterly_afr.xlsx` | 30,298 | `a3e2f0517dcceb59c61b37833bd2c7010c5c4631bc841dc891d4b8c97aa1ebf9` |
| `data/references/2025-Q4_quarterly_afr.xlsx` | 31,207 | `8682be7fb2f85f27875739583c8aa934f4a290f903e2eca89c61bb154d4f3b65` |

Generator inspected: `quarterly_afr_xlsx_from_iceberg.py`, SHA-256 `102f59871d802e1307169902459f81a63755bd8ec56e25f84e37a839fc4684af`. This explains current code semantics; the files contain no invocation parameters proving how these particular exports were generated.

## Observed structure

Both contain only `Sheet1`, 135 columns A:EE, 19 adjacent seven-column model blocks. Header rows 1–5 are identical. Frozen panes retain A:B and rows 1:5 (`C6`, xSplit=2, ySplit=5). Numeric data are right-aligned, vertically centered and bordered. AFR uses `0.000`; drive metrics use `#,##0`. AFR values are percentage numbers, e.g. 1 means 1%, with no displayed percent sign. AFR Delta is percentage points.

Vendor merges and model starts below are identical in both files. Each listed cell is in row 3; each block extends six columns beyond its start.

| Vendor merge | Models and starting columns |
| --- | --- |
| Seagate C2:AR2 | C ST12000NM0007; J ST12000NM0008; Q ST12000NM001G; X ST14000NM001G; AE ST16000NM001G; AL ST24000NM002H |
| Toshiba AS2:CH2 | AS MG07ACA14TA; AZ MG08ACA16TA; BG MG08ACA16TE; BN MG08ACA16TEY; BU MG10ACA20TE; CB MG11ACA24TE |
| WDC/HGST CI2:EE2 | CI HUH721212ALE600; CP HUH721212ALE604; CW HUH721212ALN604; DD WUH721414ALE6L4; DK WUH721816ALE6L0; DR WUH721816ALE6L4; DY WUH722222ALE6L4 |

Vendor header fills are respectively #6EBE49, #CC0000 and #00529F. These identify vendors, not reliability. Year bands alternate white/#D0D0D0.

2025 Q3 occupies A1:EE32, with 27 relative-quarter rows (Year 1/Qtr 1 through Year 7/Qtr 3); 2025 Q4 extends to EE33, Year 7/Qtr 4. Every model begins on row 6. Shorter histories end with bordered blank cells, not zeros. For example, MG11ACA24TE has one populated row in 2025 Q3 and two in 2025 Q4 (CB6:CH6/CB6:CH7). ST12000NM0007 ends at row 21 in both. Different model columns on one row need not represent the same calendar quarter.

## Exact seven metrics and color rules

Each row-4 group is `AFR` (two columns) then `Drives` (five). Exact row-5 labels are below. All seven rules are `colorScale` with priorities 1–7. Each rule has **one discontiguous scope covering that metric across all 19 models and every relative-quarter row**, including trailing blanks. They are neither model-local nor row-local. Example AFR scope starts C6:C32, J6:J32 and ends DY6:DY32 in 2025 Q3; all end rows become 33 in 2025 Q4.

G=#00FF00; Y=#FFFF00; R=#FF0000; W=#FFFFFF. `min`/`max` use numeric extrema across the shared scope; P50 is the 50th percentile, not 50% of the numeric range.

| First block / group-label | Low → middle → high thresholds and colors |
| --- | --- |
| C / AFR Value | min G → fixed numeric 1 Y → fixed numeric 2 R |
| D / AFR Delta | min G → fixed numeric 0 W → max R |
| E / Drives Count | min R → P50 Y → max G |
| F / Drives Delta | min R → fixed numeric 0 W → max G |
| G / Drives New | fixed numeric 0 intended W → max G (two-color) |
| H / Drives Retired | fixed numeric 0 G → P50 Y → max R |
| I / Drives Failed | min G → P50 Y → max R |

**Source color anomaly:** New's low color is serialized as nine-digit `FFFFFFFFF`, originating from `#FFFFFFF` at generator line 554. The owner's Excel screenshots show the intended white-to-green appearance. The alternate artifact renderer produced black New cells, so those cells are not a faithful visual reference. Use valid white in the proposed web palette; do not edit the source workbooks. Other colors serialize as valid eight-digit ARGB.

## Calculation and interpretation limits

- Generator lines 94–101, 165–195, 868–881: AFR = cumulative failures / cumulative recorded drive-days ×365×100. Quarter failures/count/new/retired are quarter measures; AFR is cumulative through that quarter, not quarter-only AFR. Cumulative totals include earlier quarters below the display threshold.
- Lines 21–24, 871–881: default minimum is 2,000 distinct deployed serials **per model/calendar quarter**. Only qualifying quarters are appended. Axis labels then enumerate retained rows from 1/1 (lines 674–712). This is retained-quarter sequence, not demonstrated drive age, elapsed quarters or a common calendar baseline. Missing qualifying quarters can compress elapsed time. Actual export threshold cannot be established from XLSX alone; observed minimum Count is 2,059.
- Lines 440–481: deltas subtract the previous retained row; first-row deltas subtract zero. Every populated delta in both files reconciles accordingly. First-row positive AFR Delta therefore is initialization, not observed deterioration.
- Lines 767–800: New uses first recorded appearance; Retired uses last recorded appearance before the global newest observation. At the newest calendar-quarter boundary, lines 895–900 replace Retired with Failed. Retired is not exclusively voluntary retirement, and newest values are provisional boundary handling.
- No individual-drive age, capacity, price, NAS compatibility or uncertainty interval is encoded. Green Count means larger observed population, green New means more deployments; neither proves quality or purchasing suitability.

## Changes and useful reading examples

2025 Q4 adds one retained row to 18 models; ST12000NM0007 stays at 16. Existing AFR/count/new/failed values are unchanged. All 22 revised existing numbers are Retired counts, including CN6 4→3 and BL21 16→30, illustrating later last-seen reassessment.

Examples, **not a purchase ranking**:

- ST24000NM002H: AL8→AL9 cumulative AFR 2.305→2.720, while AN8→AN9 Count 7,245→8,467. Growing deployment and worsening AFR coexist.
- MG11ACA24TE: CB6=0 in 2025 Q3 becomes a two-row history ending CB7≈0.683 in 2025 Q4. An initial green zero is short evidence, not demonstrated long-term reliability.
- WUH722222ALE6L4: latest AFR DY13→DY14≈0.736→0.628; Count EA13→EA14=40,271→44,425. The shared Count maximum changes, so unchanged values elsewhere can acquire different relative shading.

## User's purchase heuristic (separate from mechanics)

The user favors high deployed counts, longevity, low AFR and no huge retirement waves. The user labels ST12000NM0007 a bad reference and interprets retirement waves as Backblaze/manufacturer problem indicators. Its Count falls 28,875→3,540 (E18:E21), with 9,514 and 10,039 Retired (H19:H20), alongside roughly 2% cumulative AFR. This supports inspecting the combined trajectory. It does not establish a causal defect, actual drive age or an automatic purchase ranking.

The user labels WUH721816ALE6L4 promising: low AFR, population growing toward 27,000, and little retired/failed activity across 14 displayed quarters. Green Count is explicitly the relative-population cue. The user also labels HUH721212ALN604 good despite late red AFR, because deterioration occurred at a recognizable late age after a long stable history. This mature example must remain distinguishable from an early withdrawal pattern.

The owner confirmed the 2,000-drive entry and exit convention: a model starts its relative series when it first qualifies and leaves the displayed series below that threshold. Five years is the minimum planned service-life target, with proactive annual retirement of the oldest drive while still apparently healthy. These are owner decisions and interpretation goals, not a statistical guarantee or a physical-age survival model.

The owner additionally supplied MG08ACA16TA and MG08ACA16TE as early-spike histories that settle near 1%. In both references AZ6=3.570% while BF6=0 Failed for MG08ACA16TA: cumulative AFR includes pre-eligibility history, so the first displayed rate cannot be attributed solely to the visible quarter's failures. The planned inspector should expose both quarter and cumulative components.

The owner calls ST16000NM001G favorable but says it was unavailable when shopping, and flags ST24000NM002H as concerning after an early AFR rise while the population grew. These examples reinforce exact-model comparison within a vendor/generation. Availability and procurement motives are not encoded in the workbook. Later quarters must be examined before treating these historical examples as current model assessments.

The owner explicitly uses Count and New as evidence of revealed deployment preference: scaling toward tens of thousands signals a substantial operating commitment as well as a larger evidence base. The intended comparison combines that commitment with reliability and lifespan; it does not estimate Backblaze's dollars spent or establish its procurement rationale.
