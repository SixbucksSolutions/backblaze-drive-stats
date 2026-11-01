# Proposed cohort and history evidence amendment

#0017 additive proposal, evidence contract **1.0.0**, 2026-10-31. Owner review is
required before changing production cohort selection or history rules. This ledger
does not change the existing matrix schema, validator, generator, published bundle
or immutable workbook fixtures. Passing its validator does not authorize generation,
publication, downloads, cloud work or a further backward-processing batch.

The [schema](../contracts/cohort-history-evidence-v1.schema.json) and
[validator](../tools/validate_cohort_history_evidence.py) make the proposed evidence
requirements reviewable without processing daily data. They validate internal
consistency; they cannot establish the truth or completeness of upstream evidence.

This is the preserved v1 proposal and its earlier bounded-search context. The
owner has since accepted #0063’s research and #0023’s complete published-source
census. The [v2 production proposal](production-data-v2.md) under #0084 handles
partial threshold proofs and producer/consumer integration; its acceptance is
separate from the historical evidence fixtures here.

## Four distinct populations

- **All-source discovery inventory:** every supplied canonical model before seed
  filtering, including new vendors, SSDs and unclassified devices. Discovery scans
  all supplied quarters, newest first for the actionable release. Regex matching is
  a positive 2025 Q4 interest hint, never an exhaustive allowlist.
- **Fixed published analysis cohort:** explicit `analysisModelIds`, a versioned
  selection decision and evidence references. Each admitted model must be a
  classified HDD with at least one complete quarter at Count >=2,000. A qualifying
  off-seed HDD can enter through the same evidenced scope decision. Discovery does
  not automatically force every historical HDD into this first release.
- **Purchase-default subset:** explicit `purchaseDefaultModelIds` inside that
  cohort. It is a research/view default for the current purchase comparison, not a
  statement of manufacturing status, retail stock, NAS compatibility or quality.
- **Historical-reference subset:** explicit `historicalReferenceModelIds` inside
  the cohort, disjoint from the purchase default. This is a research role, not a
  manufacturer lifecycle claim. Other analysis models may be in neither default.

All inventory entries remain visible even when outside analysis. SSDs and unresolved
media cannot enter either comparison subset. A model's later below-threshold quarter
does not remove it from the fixed analysis cohort or reset its original anchor.
Changing a view filter cannot narrow its underlying cumulative-history obligation.
Changing cohort membership needs a new `cohortVersion` and recorded scope decision.
The validator checks membership consistency, not whether that decision was approved.

This is a proposed separation from the existing generator's seed-plus-all-discovered
resolved cohort. No current generator behavior is overridden by this document.

## Versioned per-model history evidence

Every inventory model carries `model-history-evidence-v1`, exact model number,
evidenced raw aliases, media evidence, seed flag and an ordered ledger for every
quarter in the declared source domain. `sourceDomainEvidenceRefs` identifies the
domain; `sourceInventoryEvidenceRefs` points to the exhaustive upstream inventory
audit. Source-backed references must resolve to retained, revision-identified,
content-hashed evidence. A free-text reference alone is not proof of source truth.

Each quarter records source coverage, Count, known failures, known recorded
drive-days and evidence references. Complete coverage needs validated full-calendar
partitions before model selection, including valid empty partitions. It is not
proved by a model's presence, an archive name, a row total or a file count.
Complete-quarter exposure must be at least Count and at most Count multiplied by
the actual number of calendar days in that quarter, including leap days. Each
`(vendor, rawAlias)` must belong to exactly one canonical model in the inventory.
Missing/incomplete quarters have null Count, so they cannot establish eligibility
or absence. Incomplete quarters may retain explicitly partial known exposure;
missing quarters contribute zero **known** components, which is not zero actual
exposure. `knownExposure` reconciles all recorded components, including below-2,000
pre-eligibility quarters; its sum alone never certifies completeness.

Keep these fields separate:

- `firstObservedInLoadedHistory`: earliest ledger quarter with positive known
  recorded exposure, including incomplete coverage. It is left-censored when older
  observations remain unknown, and is not first-ever deployment.
- `firstQualifyingInLoadedHistory`: earliest complete loaded quarter with Count
  >=2,000. It can be a candidate while earlier coverage remains unresolved.
- `verifiedWindowAnchor`: first >=2,000 quarter after complete search from the
  declared loaded-window start through that quarter. `windowHistoryComplete`
  separately records gap-free coverage through the loaded cutoff. Both can be
  true with a bounded-zero or unresolved older boundary. These support useful
  within-window comparisons and, after separate integration, explicitly labeled
  window AFR using complete window components. They do not require downloading
  the dataset's earliest sources or proving global inception.
- `verifiedAnchor` and `anchorSearchComplete`: full-source-domain first qualifying
  quarter only after
  an evidenced dataset start and complete coverage through that candidate. The
  anchor is earliest qualification **within the declared source domain**; it does
  not establish physical inception or time since manufacture.
- `cumulativeHistoryComplete`: an evidenced dataset start plus complete coverage
  in every quarter through the cutoff. A gap after a valid anchor can preserve the
  anchor while making cumulative history incomplete. Numeric cumulative AFR still
  needs the existing production formula/exposure gates; this ledger emits no rate.

For the full-source-domain fields, `dataset_start` means an independently evidenced beginning of the source domain,
not an arbitrary first downloaded quarter. A partial opening quarter remains
incomplete. The ledger is deliberately conservative: a complete bounded-zero
quarter or an unresolved lower boundary cannot certify either a true full-domain
anchor or full-domain cumulative history. Window claims remain independently useful.
Unresolved older histories require written limitations.

For the existing production contract, once a full-domain verified anchor exists,
relative quarter 1 is its first >=2,000 quarter. A future bounded comparison can
instead use the verified window anchor if the amended production contract is
reviewed and its timeline is explicitly labeled as within-window.
Subsequent relative positions use elapsed calendar offsets, preserving exits,
missing quarters and reentry. Displayed retained-row positions from the old workbook
are not calendar evidence. No global-inception, manufacturing or buyability claim
is part of this schema; `marketplaceClaims` must remain `not_assessed`.

## Exact reference model and bounded search

For **HUH721212ALN604**, stop the owner's bounded backward search at a complete
quarter with zero observations across its evidenced aliases. Keep ALN604 distinct
from ALE604/ALE600 and other exact SKUs. Record that quarter as `bounded_zero`.
Neither Count below 2,000, a missing day, a filtered-out model nor a workbook blank
meets this rule. One actual zero quarter can end this bounded search but cannot
exclude older deployment followed by reentry. Per-model anchor and cumulative
exposure checks remain separate from the sentinel's batch stop.

The private boundary audit currently establishes no zero quarter or validated
anchor. Its 2019 Q1 estimate is provisional. The earlier current-cohort audit's
19 seed-qualified purchase candidates are a starting research list, not a closed
purchase-default rule: all-source discovery and off-seed HDD admission remain
required. That Q2 audit predates the later Q1 pilot; it is not a current inventory
of every locally retained source. See [pilot evidence](quarter-pilot.md) and
[execution/history gates](history-verification-and-backfill.md).

## Synthetic acceptance examples

The two small [goldens](../fixtures/cohort-history-evidence/) contain fictional
models, populations, sources and evidence references. `synthetic-complete.json`
includes an off-seed purchase default, pre-eligibility exposure, threshold exit and
reentry, a high-population excluded SSD and an unresolved-media inventory entry.
`synthetic-bounded.json` demonstrates a valid zero stop without anchor/cumulative
certification. They provide no real-model history evidence.

```console
uv run --frozen --no-sync python tools/validate_cohort_history_evidence.py fixtures/cohort-history-evidence/synthetic-complete.json fixtures/cohort-history-evidence/synthetic-bounded.json
uv run --frozen --no-sync python -m unittest discover -s tests -p test_cohort_history_evidence.py
```

Focused negative tests reject unknown/gap-to-zero conversion, first-loaded-anchor
claims, bounded-zero completeness, unsupported SSD/media admission, changing
subset membership outside the fixed cohort, missing ledger quarters and exposure
omissions. Evidence authenticity, exact-alias exhaustiveness, domain justification,
source hashes, classification truth, scope approval and independent source audit
remain external gates. Production integration is a separately reviewed change.
