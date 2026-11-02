# Model presentation updates (#0119–#0121)

The [live explorer](https://backblaze-drive-stats-analysis.pages.dev/) now uses
corrected manufacturer/model labels, descending snapshot choices and nominal
capacity labels with capacity-first matrix ordering.

| Card | Delivered behavior |
| --- | --- |
| #0119 | Hitachi-prefixed Deskstar HDS/HDT models display their bare model code under one HGST/WD family. Filters, grouped reports and CSV output use the same presentation labels. |
| #0120 | The matrix snapshot dropdown lists newest dates first. Other date selectors already descended; their selection, availability and unpublished markers remain intact. |
| #0121 | Matrix headers, model choices, inspector titles and accessible labels include per-drive capacity, including `12 TB` and `1.5 TB`. Models sort within manufacturer by descending nominal capacity, then displayed model code and source ID. Unknown capacity stays explicit and sorts last. |

## Data boundaries

This changes presentation, without a source-data refresh. All 1,538 current
canonical production files and the retained `drive_model_names.py` fingerprint
are unchanged. Source model IDs, raw metadata, selection membership, recorded
metrics and whole-fleet totals remain intact. Manufacturer presentation totals
are recomputed from the unchanged model rows under the corrected family labels.

Distinct source IDs can now share a displayed model label. Their histories remain
separate; this update does not silently merge aliases or recalculate AFR.
Derived browser presentation capsules were rebuilt for all historical cutoffs.
Their hashes identify those projections; their source bindings still identify
the original canonical generation.

Nominal matrix capacity is a presentation value rounded to the nearest 0.1 TB
from per-drive inventory metadata. It never replaces raw capacity or aggregate
fleet-capacity metrics. The first real-data browser pass caught byte-derived
values such as `12.000138625024` and `1.500301910016`; the shared display/sort
helper and regressions now produce `12` and `1.5` consistently. No model-name
capacity guessing was introduced.

## Verification and publication

- Full quality checks, all 237 web tests and the normal production build passed,
  including the unchanged raw manufacturer audit and all 53 canonical cutoffs.
  Fresh independent source and lineage reviews passed.
- All 45 final local Chrome checks passed with no app/resource errors. They cover
  real capacity metadata and ties, identities and selection, historical HDS/HDT
  filtering and CSV labels, all six date-control contexts, keyboard/narrow behavior
  and the accepted navigation/startup gates. Independent visual review passed;
  desktop capacity labels are visible, while supplied narrow stills do not expose
  every table label. Failed initial evidence remains retained privately.
- Both Windows/Linux CI jobs passed run `41430613082` for source
  `7b279aae72b381c5918a2ce8dcc090826423b58d`.
- Production deployment `9e3ac7f0-60ec-4a89-86b7-8f1349057015` succeeded. Full
  hosted verification passed 4,775 assets, four navigation cases, eighteen
  missing/private paths and nine redirects. The upload retains 1,662 predecessor
  files and preserves all 3,228 prior immutable assets compatibly. Every file in
  the retained archive passed hash readback; predecessor `1cb7726c` remains
  retained for rollback.
- A separate public-origin Chrome smoke passed all 24 checks, with no application
  errors or failed app assets. One implicit favicon `404` is recorded separately.
  Owned browser/server processes were closed.

Delivery remains static Pages, with no Worker, Function, dependency or daily-data
scan added. Private source/browser/release evidence is under ignored
`data/staging/0119-0121/` and `data/staging/0119-0121-publication/`, outside Git and
the served bundle. The rolling plan preserves earlier assignments and owner
acceptance; Terry controls Completed.
