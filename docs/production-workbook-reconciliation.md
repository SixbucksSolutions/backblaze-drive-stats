# Production v2 workbook reconciliation

#0086 compares real as-of 2025 Q3 and Q4 production v2 aggregates with the
immutable [owner workbook references](workbook-reference-analysis.md). These are
bounded aggregate comparisons; they do not scan daily source records, recalculate
the workbooks or rewrite the golden fixtures.

## What can be established

The workbook fixtures retain exact OOXML numeric text, model numbers and cell
addresses. They explicitly have **unknown calendar mappings and exposure**. The
workbooks do not contain invocation parameters establishing their source history
or cutoff. A workbook's relative row cannot be assigned the same calendar date
as the corresponding v2 relative row.

The comparison helper matches exact `modelNumber` and finds each workbook Count
in that model's retained-observation identity ledger. It retains only candidate
dates participating in a full strictly chronological sequence of Count matches.
A unique remaining date supplies an **inferred candidate quarter**. An ambiguous
or absent match stays unresolved. Count is therefore an inference anchor, not an
independently validated metric. New, Failed, Retired, AFR and both deltas are
then compared at the candidate quarter without using those values to select it.

These conditional mappings can demonstrate numerical agreement or identify
differences. They cannot authenticate the workbook's missing source lineage or
turn matching values into source-proven calendar dates. Trailing workbook blanks
remain unknown and are not interpreted as zeros or threshold exits.

## Declared semantic changes

- V2 initializes the first eligible row's population and AFR deltas to zero.
  The audited workbook generator subtracts zero, producing its initial Count
  and AFR as deltas.
- V2 uses elapsed calendar quarters from the first proven threshold. The
  workbook generator compresses qualifying quarters into consecutive rows.
  Comparisons use candidate calendar quarters, never visual row alignment.
- Current partial quarters have null display metrics in v2; their retained
  observations and threshold proof remain in the ledger. The workbook generator
  has no corresponding source-completeness availability rule.
- V2 withholds Retired where subsequent source gaps obstruct last-seen
  inference. Its cutoff Retired = Failed proxy is explicitly provisional.
- Observed-history AFR has the same cumulative recorded-failure/recorded-day
  formula as the audited workbook generator, including pre-threshold history.
  Its clearer label does **not** explain a numerical mismatch. Neither metric
  establishes complete lifetime exposure.

AFR comparisons allow absolute or relative numerical tolerance of `1e-12` for
OOXML/binary-float serialization differences; integer metrics compare exactly.
Any remaining numerical difference stays unexplained. The helper does not make
a blanket pass claim or relabel residual differences as accepted v2 changes.

## Actual aggregate results

| Result | 2025 Q3 | 2025 Q4 |
| --- | ---: | ---: |
| Workbook models / production matrix models | 19 / 21 | 19 / 21 |
| Conditionally inferred rows / retained workbook rows | 307 / 307 | 325 / 325 |
| Unresolved rows | 0 | 0 |
| Independent metric cells equal | 1,168 | 1,248 |
| Count anchor cells equal | 290 | 308 |
| Declared first-delta initialization differences | 36 | 36 |
| Declared partial-quarter null display cells | 119 | 119 |
| Declared gap-obstructed Retired null cells | 119 | 119 |
| Population deltas using a different partial-quarter predecessor | 15 | 15 |
| Unexplained AFR / AFR Delta differences | 202 / 200 | 216 / 214 |

All retained workbook rows have unique dates under the Count/chronology inference.
Their relative ordinals happen to equal v2's elapsed ordinals in these references;
this does not remove the need for elapsed-axis handling in other generations.
The two additional production models are `ST8000NM0055` and `ST8000DM002`.

No unexplained integer metric differences remain on the inferred rows. The 15
population delta differences follow a workbook predecessor that is partial in
v2, so v2 compares the previous eligible complete row. Each workbook delta is
checked against its own preceding Count before applying that classification.

The residual 402 Q3 and 430 Q4 metric differences are confined to cumulative AFR
and its delta. For example, `ST12000NM0007` at inferred 2018 Q2 has workbook
`C8 = 1.119955815441802`, versus v2 `1.1143762164637636`. A source-history or
recorded-exposure difference is possible, but the workbook has no exposure or
source invocation record establishing the reason. These differences therefore
remain unexplained, with exact evidence retained for follow-up. **This is not a
numerical workbook-equivalence pass.** Contract validation and byte-consistent
generation do not resolve that evidence limit.

## Reproduction and evidence

Run only after validating the generated v2 graph. From the repository root:

```console
uv run --frozen --no-sync python tools/reconcile_production_workbooks.py fixtures/workbooks/2025-Q3.json data/staging/0086/generated/2025-Q3 data/staging/0086/reconciliation-2025-Q3.json
uv run --frozen --no-sync python tools/reconcile_production_workbooks.py fixtures/workbooks/2025-Q4.json data/staging/0086/generated/2025-Q4 data/staging/0086/reconciliation-2025-Q4.json
```

The ignored reports record workbook source identity, exact input byte hashes,
candidate dates, cell addresses, all compared values and classifications. Public
source identity remains in the existing workbook audit. Private production
aggregate reports remain outside Git.
