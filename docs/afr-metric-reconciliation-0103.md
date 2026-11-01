# AFR metric reconciliation #0103

The original Python XLSX producer is the authority. Its `Retired` includes failed
departures, and its `Failed` sums recorded failure flags rather than distinct
failed serials. The recollection differed on both points. On 2026-11-01 Terry
explicitly changed the requirement for **Failed and the AFR numerator**: count
each model/serial with at least one failure flag once **per quarter**. This is
an authorized exception to the original code, not a claim that it already
implemented deduplication. Terry then refined Retired: count unique model/serials
observed in a quarter whose final recorded observation is in that quarter, only
when the quarter precedes the selected snapshot quarter. Terminal Retired is
right-censored/unavailable, with no Failed proxy. Failed identities remain included;
this is observed last-seen history rather than proof of a physical exit.

## Original calculation trace

`quarterly_afr_xlsx_from_iceberg.py` calls its own aggregation, enrichment and
display functions (lines 1035–1047). The only imported business transformation is
`drive_model_names.normalize_drive_model_name` (lines 15, 87–88). Iceberg supplies
the source; XlsxWriter writes values and formatting. All seven displayed numeric
cells are literal Python results, not Excel formulas (lines 489–522).

| Metric | Original behavior | Original source | Supported production conventions |
| --- | --- | --- | --- |
| Count | Distinct serials observed anywhere in the normalized-model quarter | 228–236 | Matches: unique model/serial quarter summary, then row count |
| Count Delta | Current Count minus previous retained ≥2,000-drive row; first row subtracts zero | 482–509 | Later rows match; old `2.0.0` policy initializes the delta to zero; new `2.1.0` subtracts zero |
| New | Count model/serial pairs whose earliest source observation lies in the quarter; initial fleet is included | 855–875 | Matches within supplied history |
| Retired | Count model/serial pairs whose final source observation lies in the quarter, excluding pairs seen on the global latest observed date; failures are included | 855–890 | Old `2.0.0` includes failed identities but limits the global latest-date sentinel to qualifying HDD context. New `2.1.0` follows Terry’s refinement: final-observed identities in nonterminal quarters, with no global latest-date exclusion |
| Retired at newest source quarter | Overwrite the final displayed row's Retired with Failed when that row is in the maximum source quarter | 999–1003 | Old `2.0.0` retains the selected-cutoff flag proxy. New `2.1.0` intentionally has no proxy: terminal Retired is null with `right_censored` reason |
| Failed | Sum daily `failure` values; repeated flags on one serial count repeatedly | 233–234, 981 | Old `2.0.0` matches; new `2.1.0` intentionally counts unique failing model/serials per quarter under Terry’s explicit decision |
| AFR | Cumulative summed flags ÷ cumulative recorded row exposure × 365 × 100; accumulate before applying quarter threshold | 118–127, 967–985 | Old `2.0.0` matches; new `2.1.0` accumulates quarterly distinct failure counts over the same recorded exposure, as explicitly requested |
| AFR Delta | Current cumulative AFR minus prior retained row; first row subtracts zero | 482–498 | Later rows match; old `2.0.0` policy initializes the delta to zero; new `2.1.0` subtracts zero |

Line references in this table refer to the unchanged original XLSX producer.
Current implementation references: `historical_generator.py:464–472` stores one
summary per model/serial/quarter and summed flags/exposure. The
`production_history.generate` lifecycle/quarter aggregation and cumulative cell
construction apply the explicitly versioned rules described here.

Read-only inspection of the checked-in public aggregates found 21 first eligible
model cells in each 2025-Q3/Q4 snapshot and 22 in 2026-Q2. Every one has positive
Count but zero initial Count Delta; 19, 19 and 20 respectively have positive AFR
but zero initial AFR Delta. Those existing immutable v2 outputs remain historical
evidence of their original zero-delta convention, not corrected XLSX results.

## Observed repeated-flag audit

The separately authorized read-only audit of 53 retained quarter-summary objects
examined 8,540,817 identity-quarter rows. It found 33,581 recorded flags versus
33,580 distinct failing identity-quarters: one identity-quarter had two flags.
No serial column was projected or read, and no daily source partitions or cache
objects were generated or modified.

The affected public aggregate is WDC/HGST WUH721816ALE6L0, 2024 Q3: its quarter
numerator changes from eight recorded flags to seven distinct failing identities.
That removes one numerator unit from subsequent cumulative rates that include
the quarter; the recorded exposure denominator and observed identity Count do
not change. This confirms the inflation exists in available observations while
keeping serial identities private. Existing public generations remain unchanged.

## Consequences and boundaries

- No identity `Delta = New − Retired − Failed` follows from Count. Count includes
  drives seen for any part of a quarter; Retired already includes failed exits;
  old `2.0.0` cutoff Retired is a flag proxy; new `2.1.0` terminal Retired is
  unavailable. Observed final appearances are not proof of voluntary retirement
  or physical exit.
- Reappearance retains the original first observation. A temporary disappearance
  is not a final departure when later observations exist in the selected history.
- In the original and retained `2.0.0` contract, a serial observed on two failure
  days contributes two Failed and two cumulative AFR numerator units. Under the
  explicitly requested `2.1.0` convention it contributes one in that quarter to
  both. If it has failure flags in two different quarters it contributes once
  in each: cumulative AFR sums quarterly unique counts, not lifetime-unique
  failing serials. New `2.1.0` terminal Retired has no Failed proxy.
- The original source is filtered by configured patterns on raw SMART names,
  normalized, then aggregated. Current `seedMatch` applies patterns to canonical
  names, with additional accepted HDD classification/discovery. These are distinct
  admission domains. An otherwise unqualified mapped model can set the original
  global latest date and maximum source quarter; a fictional oracle test proves
  that it changes a qualifying model's Retired. Exact admission/date-sentinel
  parity therefore requires a broader source/cohort contract review. The new
  Retired definition intentionally removes the global-date exclusion; old
  `2.0.0` preserves it. This card does not change model admission, ≥2,000
  threshold, calendar anchor or relative-quarter spacing.
- Original XLSX keeps only eligible rows and compresses their display positions.
  Its Delta baseline is the previous retained row, which can span calendar gaps.
  The app preserves calendar positions and discloses that span.
- The original code does not model missing source days. Current explicit nulls,
  lower bounds and gap-obstructed retirement protections remain necessary
  provenance controls; incomplete supplied history cannot prove lifetime history.
- Quarter summary caches already retain the necessary first/last observations,
  per-serial-quarter exposure and summed flags. Counting retained summary rows
  with `failures > 0` deduplicates quarterly
  failing identities without cache regeneration or a normalizer identity change.
- Existing hashed generations and golden XLSX fixtures retain their original
  interpretation. Any numerical correction must create a new semantic version,
  snapshot identity and hash-bound artifacts; no old artifact may be relabeled.
- The current CSV export is a supporting-view export of Count, New and capacity
  (`web/src/snapshot-selection.ts:161–180`), not an AFR matrix export. Its Count
  and New fields already match these definitions. This reconciliation does not
  introduce a new export feature or reinterpret its existing field values.

## Implementation and verification

`tests/test_afr_metric_reconciliation.py` invokes the unchanged original
aggregation/enrichment functions and parses an in-memory XLSX generated by the
original writer. Six tests cover repeated failure flags, failed and nonfailure
departures, reappearance, quarter boundaries, below-threshold cumulative exposure,
newest-quarter overwrite, unqualified-model global-date influence and
first/previous-retained-row deltas. The sixth comparison raises that same lifecycle
example to the production threshold and compares all seven producer metrics
with the unchanged original calculation on the same complete fictional source.
It demonstrates deliberate `2.1.0` Failed/AFR and terminal-retirement differences,
while confirming original flags/proxy and zero-initialized deltas remain in
`2.0.0`. Varying the cutoff proves a later reappearance removes that identity
from an earlier quarter’s Retired. A separate fixture demonstrates that a
nonterminal quarter counts last-observed identities even when their final date
is the global latest observed date; it includes failed and nonfailed identities.
Repeated flags on the same serial in Q1 and Q4 prove quarter rather than lifetime
deduplication. Focused numerical and binding checks pass.

New direct producer output defaults to matrix calculation version `2.1.0` in
`context.versions.rate`; this declares both Count/AFR delta semantics and the
quarterly distinct failing-identity numerator for Failed/AFR, nonterminal final-observed
identity Retired, and terminal right-censoring. The structural
contract and capacity versions remain
`2.0.0`. Explicit old `2.0.0` output preserves the original SID recipe. New
`2.1.0` SID identity includes the calculation version, preventing collisions for
the same inputs/revision/time. Readers and both validators distinguish the two
arithmetic conventions and reject unsupported semantic versions. New `2.1.0`
requires the distinct-failure rate basis and label; it cannot be mislabeled as
failure-flag math. `knownFailures` and `cumulativeKnownFailures` carry the declared
version’s numerator. Quarter counts are bounded by observed distinct identities;
no raw serial identities or extra raw-flag field are published.

Refresh configurations without `matrixCalculationVersion` inherit their baseline
version; old warm runs preserve their zero-write behavior. An explicit `2.1.0`
request creates new hash-bound artifacts and retains the old graph. Inspectors
identify the synthetic-zero baseline and its absence of a prior observed quarter;
help text distinguishes the old convention and explains overlapping Retired and
Failed.

The original-code comparisons cover the complete fictional observation fixture,
not full source/cohort parity with the current production contract. Admission,
source-gap protections, partial-quarter eligibility and calendar anchors remain
unchanged. Old `2.0.0` preserves its latest-date sentinel and newest-quarter proxy;
new `2.1.0` follows the explicitly refined Retired definition above. The current
checked-in public generations retain their old interpretation; refreshing them
is tracked separately by #0104 and requires future execution authority. #0101's
fresh-ETL exercise remains held for its own turn. No daily source scan, cache
regeneration, production refresh, cloud publication or deployment occurred here.

Fresh independent Sol / High review passed the numerical/provenance scope,
including exact legacy artifact comparison and independent reproduction of the
affected retained-summary quarter. After #0102 integration, the full repository
gate passes: **253 Python tests**, **156 frontend tests**, Ruff/Pyright, strict
TypeScript/typed lint/formatting, both language-service queries and the production
build. The card is the handoff record for the final commit and hosted
Windows/Linux CI status.
