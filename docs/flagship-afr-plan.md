# Flagship AFR comparison plan

Plan #0013, revision 4 (r004), 2026-10-30. This specifies the primary comparison product;
it does not start its implementation or authorize a historical backfill. The
existing calendar-quarter explorer remains a supporting view. Python + Polars is
the owner's selected generator stack.

The owner's deployment, geography, COVID/AI and IPO observations explain how the
visualizations are read. They are interpretation context, not additional feature
requests. Preserve the existing six report families and the flagship scope; do
not add event overlays, financial-data ingestion, causal models or extra dashboards.

## Decision the view supports

Compare selected HDD models by vendor and relative quarter to judge an intended
service life and plan proactive replacement. The owner values a large deployed
population, a long useful history, low AFR, and absence of early retirement waves.
A model can remain attractive when deterioration occurs late enough for a planned
replacement horizon. The owner targets at least five years; an annual staggered
replacement cycle can make six years relevant too.

The owner also reads deployment scale as revealed preference: "Where is Backblaze
putting their money?" Growing from a small eligible population toward tens of
thousands represents substantial operational commitment. Count is both an evidence
base and a commitment cue; New shows continuing deployment. Keep that signal
prominent alongside reliability. The dataset does not provide purchase prices,
actual spending or the reasons for a procurement decision.

The primary display must preserve the combined trajectory. A final AFR number,
single color, newest-quarter ranking or invented composite score cannot replace
that reading task. This is a comparison workspace with owner judgment, not an
automatic purchase or replacement-age recommendation.

## Confirmed owner decisions

- Python + Polars generates static JSON offline. No request-time backend is needed.
- Keep the personal HDD selection and canonical SMART model normalization.
  Owner clarification, 2026-10-30: the regex list is a 2025 Q4 positive seed, not
  an exhaustive allowlist. Each quarterly run discovers additional HDD models
  and vendors from all supplied source data when they reach 2,000 observed drives;
  seed non-matches must not be filtered out before discovery. Classification and
  unfamiliar-name handling are specified in #0014's revised contract.
- Compare exact model numbers. Family, generation and vendor labels organize
  models; they must not merge variant histories or imply equal reliability.
- Group model columns under Seagate, Toshiba and WDC/HGST vendor headers.
  Preserve those groups and permit additional discovered vendors.
- Relative quarter 1 starts at the first calendar quarter with **at least 2,000
  observed drives** for the normalized model.
- Eligibility applies in both directions. Below 2,000, the model leaves the
  displayed metric series and is shown as out of service under this convention.
  A tooltip states that this means below the comparison threshold; some drives
  may remain in the source fleet. The cutoff is the owner's population-screening
  rule, not a universal guarantee of statistical significance.
- Warm AFR colors flag values the owner dislikes. Green Count means relatively
  many observed drives and is read by the owner as deployment commitment.
  Warm Retired colors flag large population outflows, read
  alongside the signed population Delta.
- Five years is the minimum service-life reference. The owner proactively
  replaces the oldest drive on an annual schedule while it still appears healthy.
- Preserve year-first calendar labels, such as **2025 Q4**.
- Publish the independent project under Sixbucks Solutions with MIT licensing for
  its software and original analysis. Prominently credit Backblaze and retain the
  source dataset's own rights and usage terms.

## Reference evidence and acceptance stories

The supplied [2025 Q3 workbook](https://s3.us-east-2.amazonaws.com/backblaze-drive-stats.sixbuckssolutions.com/afr_data/2025q3_quarterly_afr.xlsx)
and [2025 Q4 workbook](https://s3.us-east-2.amazonaws.com/backblaze-drive-stats.sixbuckssolutions.com/afr_data/2025q4_quarterly_afr.xlsx)
are the visual baseline. See the [mechanical audit](workbook-reference-analysis.md)
for hashes, exact ranges and rules. The owner also supplied cropped examples:

1. **ST12000NM0007, warning reference:** worsening AFR followed by large retirement
   waves and a collapsing population early in the displayed history. The user must
   be able to see that combination at a glance.
2. **WUH721816ALE6L4, promising reference:** low AFR, a population growing toward
   27,000, and quiet retirement/failure columns over 14 displayed quarters. Its
   shorter history remains visible; it does not yet demonstrate the full target
   horizon solely from this reference.
3. **HUH721212ALN604, mature-good reference:** long stable history followed by the
   owner's recognizable late reliability cliff. Late red AFR cells must remain in
   age context rather than automatically mark the entire model as bad.
4. **MG08ACA16TA / MG08ACA16TE, early-spike diagnostic:** the owner supplied
   histories that rise early and settle near 1%. Keep those initial quarters and
   the later trajectory together. MG08ACA16TA's first displayed row has 3.570%
   cumulative AFR and zero current-quarter Failed, so cell details must expose the
   pre-eligibility contribution instead of attributing the rate to that row alone.
5. **ST16000NM001G, favorable but historically unavailable:** the owner considered
   its history attractive but could not buy it when shopping. Retain it as a
   comparison baseline. Fleet data does not establish current purchase availability;
   no live inventory feed is in this phase.
6. **ST24000NM002H, early deterioration while growing:** the owner flagged the
   Exos X24 example's rise from about 1.03% to 2.72% over four displayed quarters,
   despite a growing population. A concerning AFR trajectory can appear before
   retirement waves. Keep this exact model distinct from favorable Seagate models.
7. **HUH721212ALE604, bulk rollout stops:** the owner points to the New column's
   abrupt reduction after relative quarter 5 while Count remains near 13,000.
   Preserve the distinction between a large existing deployment and continuing
   additions; neither Count nor New should stand in for the other.
8. **WUH722222ALE6L4, sustained bulk rollout:** the owner contrasts that plateau
   with thousands of additions per displayed quarter and a population exceeding
   44,000. This is a continuing-commitment reading case, without an asserted motive.
   Calendar-quarter details must remain available because equal relative ages of
   different models can refer to different years and market conditions.

The owner also wants to test whether WUH721816ALE6L4 outperforms the selected
large-population Seagate models at comparable relative ages, and whether Toshiba
models show high early mortality followed by a more stable period. Treat these as
questions for the evidence, not accepted vendor-wide conclusions. Preserve early
losses in the historical record; a later low cumulative AFR must not erase them.

The relative-quarter axis describes model deployment history from the eligibility
anchor. It is not each disk's physical age. Population additions and changes in
cohort mix remain visible in New and Count. Interpreting a fleet-history cliff as a
personal replacement horizon is owner judgment, not a measured individual survival
forecast. No price, SMART monitoring or shopping integration is in this phase.

## Primary layout and interactions

### Source-to-view map

| Existing script | Role and aggregation to preserve or reconcile |
| --- | --- |
| `quarterly_afr_xlsx_from_iceberg.py` | Flagship: cumulative AFR and quarterly model/lifecycle measures, aligned relative display rows and shared color scales |
| `quarterly_drive_model_deployments.py` | Calendar-quarter first-observed deployments by model/vendor; distinct from the active population |
| `quarterly_drive_model_distributions.py` | Calendar-quarter distinct observed drive populations by normalized model |
| `quarterly_raw_storage_capacity.py` | Overall observed-quarter raw capacity and change from the prior quarter |
| `quarterly_raw_storage_capacity_by_mfr.py` | Calendar-quarter raw capacity and shares by manufacturer within its selection |
| `quarterly_raw_storage_capacity_by_datacenter.py` | Calendar-quarter raw capacity by datacenter within available location coverage |

The contract task must reconcile the existing reports' different selection and
capacity-cleaning rules, including median versus mode and treatment of moves or
aliases. Preserve the intended aggregation and state any deliberate correction;
do not claim that differently scoped legacy totals are automatically equivalent.

Retain the workbook orientation: **relative Year/Quarter down the left, vendor and
model groups across the top**. Each model keeps these seven adjacent columns:

| AFR | AFR | Drives | Drives | Drives | Drives | Drives |
| --- | --- | --- | --- | --- | --- | --- |
| Value | Delta | Count | Delta | New | Retired | Failed |

Use a scrollable table with sticky age columns and vendor/model/metric headers.
Keep full model histories, including models that qualified previously but are
below the threshold now. Show blank/ineligible cells after their displayed service
series, with an explicit threshold status, rather than replacing missing cells
with zero or removing the historical model block.

Visibly distinguish three blank-like states: below-threshold exit, missing or
incomplete source observations, and history ending at the selected snapshot.
Provide a short label or pattern and keyboard-accessible explanation. A complete
quarter with a known sub-threshold count is an exit; an unknown population caused
by absent coverage is not. Never infer exit merely from trailing workbook blanks
when the reference lacks the required calendar/coverage metadata.

Provide a left-side brand/model checkbox selector, per the owner's 2026-10-31
refinement replacing pinning. Brand checkboxes toggle every model in that brand;
partially selected brands use an operable native indeterminate state. Indent
model choices and extend each brand color bar through its model list. All seven
metrics remain the default view. Model selection must not change color meanings. Keep the full
selected-population color reference for the chosen as-of snapshot, independent of
which models are currently visible.

Hovering, clicking or keyboard-focusing a cell reveals the model, actual calendar
quarter, relative quarter, exact value, exposure and source/as-of context. Highlight
the same relative row across visible models without washing out cell colors.
Provide one horizontal deployment-history guide using a compact, centered
**Guide after year** dropdown with choices 1–6, defaulting to **6**. The owner's
final 2026-10-31 refinement replaces the former pair of guides. Place the single
guide after Q4 of the chosen relative year; year 6 means quarter 24. Its label
spans the frozen Year and Quarter columns. Group the dropdown and **Show data colors**
under **Table display** at the footer's right side, beside the state legends;
wrap below them on narrow screens. Keep the age axis and guide reachable even when
all visible candidates have shorter histories; for example, the 14-quarter
promising reference still needs its unobserved distance to the target visible.
Future/unobserved age cells must not look like confirmed threshold exits.

An **as-of snapshot** selector defaults to the latest fully generated historical
snapshot. It selects the evidence available at that cutoff, not one calendar
quarter's fleet report. Supporting calendar-quarter reports stay under Explore.
The supporting manufacturer report provides context for whether deployment
choices moved with reliability patterns. A vendor-filter navigation link to that
existing report is optional; a new timeline is not a delivery gate. Keep observed
deployments, population/share and raw capacity/share distinct. The
owner's observed early Seagate-only series and later WD shift are a historical
question to reproduce from source, with selection and coverage stated explicitly;
do not imply the full fleet was 100% Seagate from a filtered-model result.
The 2,000-drive cutoff belongs to the AFR comparison. The supporting vendor view
retains all models in its stated HDD selection, including smaller populations,
unless the owner deliberately applies another filter. Preserve raw summaries so
screening the matrix does not erase that deployment context.
Retain the existing datacenter report under Explore as well. The owner's observed
PHX/IAD growth and Canada/Europe plateaus are supporting historical questions.
Keep observed raw capacity, population, units and coverage explicit; these records
do not directly measure customer demand or utilized storage. The original
datacenter report may use the full supplied drive population, so state its scope
separately from the personal HDD subset. A richer datacenter trend display is a
secondary enhancement, not a gate for the flagship's first delivery.
Preserve the existing raw-capacity calendar series and its quarter-over-quarter
change too. The owner's 2020 Q3 and later AI-era observations explain why those
aggregations were useful; they are not additional reconciliation requirements or
causal claims. No new event annotations or datacenter trend dashboard is required.
Define the capacity delta as the difference in observed-quarter raw capacity
from the previous calendar quarter. It is distinct from capacity of newly
observed drives and from customer data uploaded. Do not silently bridge missing
quarters or treat incomplete coverage as a measured zero. Use clearly labeled
decimal TB/PB/EB units and the stated population/coverage scope.
Mobile may scroll horizontally; it must preserve access to the complete block and
age context rather than silently turn the flagship into isolated summary cards.
Keep prominent Backblaze dataset/report links and independent-project attribution
in the common view, and carry source/as-of attribution with JSON, CSV and shared
outputs. Follow [the data-source notice](../DATA_SOURCES.md); the software's MIT
license does not replace Backblaze's dataset or branding terms.

## Color behavior

Preserve the reference palette and metric-specific semantics. Vendor colors are
category labels, with readable text; green vendor branding is not a reliability
assessment. Keep numeric values visible, provide a legend and accessible focus/
descriptions, and offer a neutral-color presentation without changing the data.

All dynamic scales use eligible cells across all model blocks in the as-of
snapshot, not each row or individual model. Ignore missing/ineligible cells.

| Metric | Scale to preserve |
| --- | --- |
| Cumulative AFR value | Observed minimum green, fixed 1% yellow, fixed 2% red; clamp beyond the fixed high endpoint |
| AFR Delta | Minimum green, zero white, maximum red |
| Count | Minimum red, median yellow, maximum green |
| Population Delta | Minimum red, zero white, maximum green |
| New | Zero white, maximum green |
| Retired | Zero green, median yellow, maximum red |
| Failed | Minimum green, median yellow, maximum red |

Use the actual percentile calculation, interpolation and scope from the reference
when generating the golden fixture. The New scale contains a malformed serialized
color; the owner's screenshots establish the intended white-to-green rendering.
Use valid CSS white, preserve the source files and document that normalization.
Do not copy the black New cells produced by the alternate renderer.

## Metric and history contract

The default AFR remains **cumulative AFR through that calendar quarter**, in
percent units. Delta is in percentage points. Count is distinct normalized
model/serial identities observed at any time in the quarter, not a quarter-end
installed fleet. New is first observed within supplied history. Failed is the sum
of daily failure flags. Cumulative exposure retains pre-eligibility history.

Retired preserves the reference's inference semantics for the fidelity phase:
last recorded observation before the as-of boundary, including failed identities.
The newest calendar-quarter rule currently substitutes Failed for Retired. Record
that rule and provisional status explicitly. It must not be represented as net
population Delta or confirmed manufacturer-directed retirement. A retirement wave
is an investigation signal, not proof of its cause.

Preserve the reference first-row delta convention for fidelity: subtract zero,
and explain that it is an initialization baseline. Subsequent reference deltas
subtract the previous retained row. Golden fixtures must retain those exact
values; changing delta behavior later requires a declared metric-version decision.

Proposed production time handling keeps real calendar offsets from the confirmed
anchor, leaves below-threshold gaps unavailable, and resumes at the original
anchor if eligibility returns. It does not compress elapsed time. This improves
edge-case age accuracy relative to the reference's retained-row numbering and is
an explicit proposal for review, not a silently accepted behavior change. The
contract task must reconcile the delta baseline after gaps and test both cases
before this behavior is implemented.

Create a separate versioned matrix contract; do not repurpose the current
calendar-quarter bundle. It needs:

- Snapshot id, as-of cutoff, coverage, source hashes, selection/normalization/
  metric versions, minimum population, horizon definition and color-scale domain.
- Every historically qualifying model, vendor, identity, actual anchor quarter,
  final eligible quarter and below-threshold/no-observation status.
- Model/calendar-quarter cells with the seven metrics, exposure, relative index,
  eligibility and inference status; never raw serial numbers. Include quarterly
  and cumulative failure/exposure components for inspecting rates. Quarter-only
  AFR can be calculated in cell details without replacing the main cumulative AFR.
- Explicit missing/ineligible cells and display units. Keep initial deltas and
  incomplete coverage distinguishable from observed zero.
- A defined supporting manufacturer/calendar-quarter rollup, derived from the
  retained source population rather than only visible matrix cells, for the
  existing manufacturer report and its trend link. Labels and denominators must
  distinguish new observations, population and capacity.
  Retain the level and calendar-quarter delta for the existing overall raw-capacity
  report, with coverage-aware unavailable values for noncomparable periods.

An early qualifying quarter can contain a short deployment exposure even with
2,000 observed drives. Make that exposure inspectable. The matrix alone does not
establish a conditional survival rate for individual drives reaching year 2;
that would require a separately defined cohort analysis and appropriate age data.

Later observations can revise earlier Retired values: 22 existing retirement
cells changed between the references. An as-of snapshot is immutable; selecting a
new snapshot can show those revisions. Publish a complete validated generation
under immutable paths, then switch its index. A new snapshot must not be assembled
from partially overwritten files or silently rebase colors to a visible subset.

## Data path and resource gate

Owner clarification on 2026-10-31 sets the order **newest to oldest** and prioritizes
actionable comparisons of purchase-relevant, still-produced models. The regex seed
is a starting interest signal; neither a match nor continued deployment proves
current manufacturing or availability. Keep all-source discovery and old reference
models, while separating their cache/inventory scope from the first purchase-focused
published cohort. Source/domain completion #0023 is owner-Completed:
computation reaches the oldest published observations, with retention and
independent mirror acceptance passed. Production integration remains separately gated under #0017. The prior
2013-first audit recommendation is superseded. Language quality gates (#0022)
come first.

The 2026 Q2 dataset alone cannot supply the complete flagship history. The
XLSX files provide visual/golden fixtures, but omit the calendar/exposure metadata
needed to reconstruct a trustworthy production matrix from them alone.

The planned current cutoff is **2026 Q2**, extending the latest supplied 2025 Q4
reference through 2026 Q1 and Q2. Screenshots illustrate historical reading cases;
new exposure, deployments and failures can change their assessment. Future refreshes
should select the newest complete published quarter, with the as-of cutoff visible.
Small or stalled deployment is a question to investigate; fleet records alone do
not identify a procurement motive or a vendor confidence decision.

Discover the earliest required history for the selected models and the cumulative
denominators, estimate transfer/disk/processing needs, and present that bounded
backfill scope before execution. ZIPs and Iceberg are alternative source adapters;
actual source coverage must be checked. On 2026-10-31 the owner approved quarter
cards and one newest-first pilot. #0027 imported and verified 2026 Q1 within its
2 GiB source/10 GiB additional-disk envelope. See the [pilot result](quarter-pilot.md).
No paid compute, broad historical fanout or production publication is implied.

### Earlier approved worksets

The owner accepted #0027 and B2 setup #0056, then cleared the next turn:
2025 Q4 #0028, the Q1/Q2 durable cache copy #0057 and the additive
[cohort/history evidence proposal](cohort-history-evidence.md) within #0017.
Q4's [audit](quarter-2025-Q4.md) and the [B2 recovery proof](b2-cache-migration.md)
are recorded separately. Existing production cohort/history behavior is unchanged
by the additive proposal. The owner also approved a next-batch exception to the
three-card limit for a four-quarter benchmark (#0029–#0032); see the
[resource/staffing recommendation](backfill-throughput.md).

The owner accepted #0028/#0057 and the four-quarter batch #0029–#0032 has now
completed private ingestion and independent artifact review. Its
[benchmark and recovery record](parallel-quarter-benchmark.md) distinguishes the
interrupted first attempt, successful recovery, actual phase overlap and durable
B2 copy. At that handoff, loaded coverage reached 2024 Q4; the reference model remained
present above threshold, so no original anchor or zero boundary is established.
The owner chose eight quarters next, then doubling while resources and required
history permit. Keep the six-direct-agent/depth-one ceiling and budget native
threads separately from language-model agents. The prior four-card exception is
superseded by that quarter-backfill scaling direction.

The next eight-card batch #0033–#0040 has completed seven full-quarter audits and
a reviewed 91/92-day partial recovery for 2022 Q4. The December 10-named source
contains December 11 observations; dates were not relabeled or imputed. The
[batch/capacity report](eight-quarter-benchmark.md) preserves that source issue,
retention evidence and measured eight-heavy-summary capacity. At that handoff,
loaded history reached 2022 Q4 with that explicit one-day gap, and the reference
model was present. No original anchor or cumulative-history completeness is certified.

The owner then capped backfill at **10 quarters per batch**, replacing doubling.
The owner also requested a lossless 2026 Q2 repack (#0058). Prioritize it plus
nine historical quarter cards #0041–#0049 (2022 Q3 through 2020 Q3); #0050 carries
forward. Keep six direct agents/depth one
and memory-aware heavy-phase admission; do not equate queued quarters with
unlimited simultaneous memory allocations. Normal source/resource gates remain.

That [ten-item workset](ten-item-backfill-and-repack.md) has completed private
ingestion, independent artifact review and preferred B2 publication. Coverage now
reaches 2020 Q3: 23 complete quarters and one explicit 2022 Q4 partial quarter.
The reference model still has 10,849 observed identities in 2020 Q3, so neither
its first appearance nor a known-zero boundary is established. The Q2 repack
saved 17.17% of daily Parquet bytes with unchanged observations and numeric
summaries. `drive-stats/current-cache.json` identifies the preferred `cache-v2`
generation; legacy objects and recovery references remain intact.

Terry initially approved #0033–#0040 while retaining their RFR lanes, then
approved and moved all preceding RFR cards to Completed. The
[next ten-quarter source workset](ten-quarter-origin-backfill.md) reached
2018 Q1: eight complete additions and two explicit partial recoveries. Preferred
processing coverage totals 34 quarters, 31 complete and three partial. Within
the searched window ALN604 has complete 2018 Q2 absence, first observation on
2018-07-12, 79 identities in 2018 Q3, 1,279 in 2018 Q4 and its first qualifying
quarter in 2019 Q1 (4,876). This does not prove global inception.

The owner expanded the objective to accurate first >=2,000 starts for every
2026 Q2 AFR analysis model and clarified **ten source quarters per turn**.
Reviewed #0063 research identifies ST12000NM0007, ST8000DM002 and ST8000NM0055
as the older-source frontier. Source cards #0064–#0073 (2017 Q4 through 2015 Q3)
were then queued for the following workset. #0017 retains production cohort/history integration
and correction of unjustified completeness claims; no production matrix changed.

That earlier source workset [completed the next ten-quarter backfill](ten-quarter-epoch-backfill.md),
reaching 2015 Q3. At that accepted handoff, the preferred catalog had 44 quarters, 38 complete and six
explicit partials. r003 research keeps the same 22-model candidate and separates
ST8000NM0055's proven partial >=2,000 threshold in 2017 Q1 from its first complete
qualifier in 2017 Q3. ST8000DM002 reaches the threshold in complete 2016 Q2;
ST12000NM0007 does so in complete 2017 Q4. These searched-window facts are not
global-inception or complete cumulative-history certifications. The evidence
amendment is reviewable; production selection/history behavior has not changed.
### Current source completion and production handoff

The final source workset #0074–#0083 has now completed computation; see the
[source-history completion record](source-history-completion.md). The corpus spans
2013-04-10 through 2026-06-30 with **53 datasets / 54 requested periods**:
45 complete quarters, eight partials and one unpublished period. It retains
**4,817 valid dates / 743,490,518 known observations**. Thirteen problematic
captures within the published span and 99 pre-publication calendar days remain
unavailable. Unpublished 2013 Q1 has no payload dataset or warm-cache count.

#0023 and the final source cards are now owner-Completed after verified retention
and source/domain reconciliation. #0063 remains owner-Completed research.
#0017 remains In Progress for production integration. The
[remaining delivery plan](remaining-delivery-plan.md) records #0084–#0095, including
one ticket per Explore view; the first shared data-contract prerequisite is
being worked to handoff before downstream implementation. See the
[proposed v2 contracts](production-data-v2.md) for the versioned policy changes.

Scope handoff: #0063 is the independently reviewed research/candidate proposal
for the 22-model cohort and its earliest proven threshold evidence in loaded
history. It is owner-Completed research, including the explicit partial-threshold
proposal. It does not certify globally first starts or approve a production
cohort. All remaining production application belongs to #0017: cohort/contract
acceptance and versioning, schema/generator/UI integration, accurate relative
quarters, source-gap/null handling, truthful completeness flags, tests and fresh
independent implementation review. Those duties were transferred explicitly;
they were not marked finished by the research handoff.

The original provisional quarter queue reached 2019 Q1. The initial rule was to
find a fully covered quarter with zero HUH721212ALN604 observations across its
evidenced aliases. Record first appearance and first >=2,000-drive quarter
separately. Missing coverage is unknown; a single known-zero quarter meets the
owner's bounded search rule without proving global inception or cumulative-history
completeness. The workbook's retained relative positions do not prove calendar dates.
Historical execution is bounded by the flagship's actual data requirements.
Do not expand the fetch solely to reproduce the owner's contextual stories or
populate a new supporting dashboard. Existing supporting reports must state the
coverage and population actually available to them.

### Owner storage clarification

The approved phase order is unchanged. Initial years and working copies may use
the D: SSD. **Backblaze B2 is the intended durable home for reusable Parquet,
quarter summaries and their manifests; Cloudflare remains the CDN/delivery layer.**
The owner supplied a private B2 bucket and locally stored scoped key. #0056
verified one small upload, SHA-256 readback, reuse and separate download. Keep
the owner's cache configuration separate from Backblaze's official read-only
source bucket. Large cache migration requires its explicit manifest and verified
transfer; the connection probe did not transfer Parquet.

Design cache identity and relative object paths independently of storage location.
Migration copies and verifies existing files/manifests rather than regenerating
them from CSV. Inspect manifests and explicit content checksums before computing;
reuse valid data and recompute only missing, invalid or semantically changed
partitions. Projection-cache and summary versions have different dependencies, so
a later model-normalization change need not force reparsing unchanged raw inputs.

The generator task must define resumable verified transfer and manifest/recovery
behavior, test the required B2-compatible operations, and retain source lineage.
Local working data can bootstrap the first batches; the remote bucket is needed
for the later migration/integration, not for writing the contract or tiny tests.
The public site continues to receive small aggregate JSON, separate from private
processing data. The hosting task decides the detailed delivery arrangement.

Persist projected private input and sufficient quarter/drive summaries so normal
quarterly updates avoid rescanning every historical daily observation. Keep source
checksums, row/date coverage, capacity frequencies and lifecycle state private.
Rebuild affected history when a source quarter or a semantic version changes.
Use the [locked Python toolchain](python-toolchain.md) and test the actual execution
plan/resource behavior; current single-quarter parity is not a full-history memory
guarantee.

## Implementation stages and review gates

1. **#0014 Contract and golden fixtures:** specify eligibility, anchors/gaps, units,
   deltas, departure boundary behavior, snapshot revisions and exact color domains.
   Extract both reference fixtures and all owner reading cases. Obtain
   owner acceptance before dependent implementation.
2. **#0015 UI and #0016 generator in parallel after the contract:** build the workbook-faithful
   matrix against fixtures; independently build persisted historical summaries and
   snapshot export against small multi-quarter cases and the existing real cache.
   Review source, visuals and numerical parity independently.
3. **#0017 Bounded backfill and integration:** after the earlier work is accepted and
   resource scope authorized, generate historical snapshots, reconcile the two
   workbook cutoffs where source coverage permits, validate the real latest matrix,
   and integrate it as the primary view with supporting reports under Explore.

Acceptance requires the owner examples to remain recognizable, faithful
shared color scopes, explicit threshold behavior, legible brand/model selection,
correct keyboard/focus behavior, valid aggregate-only JSON, exact integer metric
parity and appropriate floating-point tolerances. Verify the single selected-year guide
uses the displayed relative-quarter convention, lies after that year's Q4, and
remain reachable with short selected histories. Distinguish threshold exits,
source gaps and snapshot-ended histories in both sighted and keyboard use.
No automatic cliff detector,
ranking score or replacement prediction is part of the baseline.

The rolling worker assignments live in the private project plan. The current
assignment revision is **r031**; r001–r030 are retained as history. Planned workers
do not occupy slots or authorize execution. Recheck every prerequisite and move
the card In Progress before design, code, tests or review. Terry retains Completed.
