# AFR trends

`?view=afr` compares model-level annualized failure rates using the retained
Backblaze snapshots. The snapshot dropdown defaults to the latest published
quarter. This view does not replace or remove the matrix.

## Reading the chart

- Cumulative AFR is the default. Quarterly AFR is available in the metric control.
- Relative time starts at each model's first recorded quarter, labeled Y1Q1.
  Missing quarters retain their time positions; the clock never resets.
- Calendar time uses real quarters and ends at the selected snapshot. A model
  that stopped appearing earlier stops there, rather than being extended.
- The same models as the selected snapshot’s matrix are available in the
  manufacturer/model selector, with their full recorded history. The initial chart shows the three
  largest populations in the snapshot quarter; users can select any models.

The selector shares the matrix's manufacturer groups, model labels, search and
checkbox behavior. The model list follows that snapshot's matrix; the plotted quarters do not inherit
its 2,000-drive visibility threshold.

## What the rates mean

AFR is recorded failures divided by recorded drive-days, multiplied by 36,500.
Cumulative AFR uses all recorded history through the point, including observations
before a model had a large deployment. Quarterly AFR uses only that quarter.
The snapshot's versioned failure-count convention remains authoritative.

Only quarters with complete source coverage and positive recorded exposure have
plotted rates. Missing, partial, unpublished and zero-exposure quarters break the
line; zero failures with positive exposure is a real 0% point. A later cumulative
point still uses the known recorded exposure and failures before a gap; no missing
exposure is imputed. The view does not invent observations beyond the cutoff.

First recorded appearance is not a proven manufacturing or installation date,
and a model's deployment duration is not the age of every drive in its changing
population. These are observed-history AFRs, not survival probabilities or a
prediction that any particular drive will fail.

## Implementation and verification

The build derives a dedicated, immutable timeline presentation from the validated
public snapshot ledger. Browser requests retain digest, size and snapshot binding
checks. Release checks independently reconstruct the timeline from canonical
source aggregates. No daily source data is downloaded to generate this view.

The chart uses SVG series paths instead of one DOM table cell per metric and
quarter. What I'd Buy remains build-rendered and does not load timeline JSON.
