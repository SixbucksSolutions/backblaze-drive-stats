# Project review #0098

Reviewed 2026-11-01 against `4275d3c87ff59cdfac0956b97da97d566d4b4066`.
Astra / Medium documentation, code and test reviews were independently curated
by a Sol / High review lead. This report recommends follow-up work; it does not
implement changes or authorize new processing, publication or deployment.

Three concrete defects and one test-coverage opportunity survived the value
filter. All are P3. No broad refactor, language modernization or test deletion
showed enough practical benefit to recommend.

| Order | Finding | Type | Effort / risk |
| --- | --- | --- | --- |
| 1 | Correct and simplify the current-site README entry path | Documentation defect | Small / low |
| 2 | Repair the two synthetic review links | Documentation defect | Very small / low |
| 3 | Preserve captured datacenter-field availability | Metadata correctness defect | Small to medium / bounded lineage risk |
| 4 | Guard the next explorer change with a wiring test | Conditional coverage opportunity | Moderate setup / added harness maintenance |

## 1. README sends current-site regeneration through the legacy exporter

[README.md](../README.md) lines 107 and 125–135 describe `data/index.json`, send
readers to the v1 exporter and call historical discovery future work. The default
matrix and current Explore views instead load `data/production/index.json`
([matrix.ts](../web/src/matrix.ts):129;
[snapshot-explorer.ts](../web/src/snapshot-explorer.ts):112–114). Running the
linked v1 export therefore does not refresh the views a new user opens.

**Recommended change:** lead with a short user entry point: what the explorer
shows, `npm ci` / `npm run dev`, how to read AFR and coverage, and where to go
next. State that viewing the committed aggregates needs no Python or source
processing. Link current regeneration to the implemented
[quarterly refresh](quarterly-refresh.md), and label the existing v1 workflow
as legacy. Move contributor/operational detail behind links and condense the
source-history navigation; preserve its underlying audit records.

This combines the requested simpler README with a real workflow correction.
Verify the instructions against routing and package scripts, without generating
data. Effort is small and documentation-only.

## 2. Synthetic verification links select the production reader

[flagship-ui.md](flagship-ui.md) lines 109–110 omit `reference=1` from both
synthetic fixture URLs. [matrix.ts](../web/src/matrix.ts):75–87 selects the
production reader without that flag. Both IDs are absent from the production
index, so the prescribed review opens an error instead of its intended example.

**Recommended change:** add `reference=1` to those two URLs. A bounded Node
check independently confirmed that both IDs reject production lookup and match
their bundled reference fixtures. Keep the recorded workbook and accessibility
evidence unchanged. This is a very small documentation correction.

## 3. An absent modern datacenter field is labeled reported

[production_history.py](../production_history.py):280 and :736 set availability
solely from `quarter >= 2023-Q3`. The supported cold-input path accepts an absent
optional datacenter column and substitutes Unknown
([historical_generator.py](../historical_generator.py):410–414). Even an explicit
import receipt with `datacenterAvailable=false` then produces availability=true.
The explorer methodology and CSV describe that field as reported
([snapshot-explorer.ts](../web/src/snapshot-explorer.ts):284;
[datacenter-report.ts](../web/src/datacenter-report.ts):78,87).

A fresh fictional 2024 Q1 input reproduced this through the real generator and
validators. This is a provenance/metadata defect; Unknown allocations and numeric
totals remain intact. No error in the accepted production releases was established.

**Recommended change:** carry verified captured-field availability into coverage
and payload metadata for new generations, keeping the pre-2023 suppression rule.
Define conservative, consistent handling of mixed and legacy receipts. An absent
column differs from a present column whose values are all null: the latter can
remain available with Unknown observations. Both existing validators already allow
post-2023 availability=false, but on complete quarters that flag also requires
all locations to be Unknown
([validate_production_v2.py](../tools/validate_production_v2.py):685;
[production-data.ts](../web/src/production-data.ts):1758–1761).
Do not blindly copy an all-days receipt boolean onto mixed captures with known
locations, or discard those locations to make it fit. Resolve or reject ambiguous
mixed evidence explicitly. The reproduced wholly absent-field case needs no
schema expansion.
Update the unavailable-field explanation at
[datacenter-report.ts](../web/src/datacenter-report.ts):103 too: it currently
attributes every unavailable field to the pre-2023 era, which would misdescribe
a later capture with an absent field.

Add small fictional cold/retained-path regressions for these cases. Preserve
Unknown allocation, formulas, normalizer bytes, retained summary identities and
all old immutable generations. The effort is small to medium because legacy
receipt behavior needs an explicit decision; new flags change new artifact hashes.

## 4. Exercise the real explorer wiring once

Current tests establish useful loader, reader, arithmetic, renderer and CSV
contracts. They do not mount or execute `snapshot-explorer.ts`, `matrix.ts` or
`main.ts`. The integrated checker constructs metadata independently and calls
helpers ([check-integrated-release.mjs](../web/scripts/check-integrated-release.mjs):421–462),
so it does not test the actual selector handlers or download metadata assembled
at [snapshot-explorer.ts](../web/src/snapshot-explorer.ts):353–365 and :407–469.

For example, changing the live download's scope at line 424 to always
`selected_hdd`, or disconnecting its snapshot selector, is outside those tested
paths. These are source-demonstrated coverage gaps, not observed UI defects or
executed mutation-test results.

**Recommended change:** add one bounded mounted-explorer scenario using small
fictional aggregates. Drive the real selectors and a filter, check URL/display
selection, then inspect the real download Blob's rows and scope for selected-HDD
and all-supplied reports. Include a delayed old response so the current DOM and
download retain the newer selection. Require wrong-scope and disconnected-selector
mutations to fail the scenario.

Pair this with the next explorer behavior change unless a low-cost suitable
DOM/browser harness is established first. There is no current UI defect to
justify substantial new test infrastructure by itself. Avoid a broad browser
matrix or new helper-only assertions; keep existing unit and build coverage.

## Follow-up sequence and areas to retain

**RECOMMENDED:** make the two documentation corrections together, then fix the
datacenter metadata with its focused regressions. Add the orchestration scenario
with the next explorer change, or sooner if its harness cost proves small.
No follow-up cards were created by this review.

Keep the independent producer/validator/reader tests, exact-byte hash checks,
lexeme-preserving JSON minimization and fictional graph rebinding. Similar values
at these boundaries protect different failure modes. Existing cancellation,
immutable publication, transfer draining and no-daily-rescan tests also have
distinct purposes; no useful consolidation or deletion was established.

Keep intent/constraint comments about cutoff ordering, cache identity, immutable
publication and cancellation. No naming/comment rewrite or supported-language
feature adoption demonstrated enough benefit to offset churn. Preserve the
accepted workbook differences and all golden/font/license bytes.

## Evidence and limits

The three review packets and the triage ledger are retained privately under
`data/staging/0098/`. The lead independently traced each promoted claim and reran
the fictional datacenter reproduction; the synthetic URL check used only the
committed index and fixture metadata. Python and TypeScript language-server
symbol queries passed. A tests-reviewer probe also confirmed correct recovery
when public index commit succeeds but final receipt writing fails; this passed
and was not promoted into another change request.

The primary verified green Ubuntu/Windows baseline CI run `41282178546`. The
unchanged implementation's recorded gates include 236 Python and 132 web tests.
No broad unchanged local suite was rerun for this report. Fresh non-author Sol / High
validation passed after clarifying mixed availability constraints and making the
orchestration-test recommendation conditional on its practical setup cost.
The private validation record is
`data/staging/0098/independent-report-validation.json` (with a readable `.txt`).

Coverage spans current user/operator documentation, Python generation/storage/
refresh, public contracts, TypeScript loading/presentation, static build/hosting
and representative tests. This was a risk-based repository review, not a claim
of line-by-line inspection of every file or exhaustive historical-document audit.
No daily corpus scan, real cache regeneration, source download, cloud operation,
UI session or deployment was performed. No new language/tool feature is proposed,
so this review makes no new compatibility qualification.
