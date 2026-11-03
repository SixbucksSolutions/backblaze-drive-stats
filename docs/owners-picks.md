# What I’d Buy

The public home page (`?view=picks`) presents a small editorial shortlist for researching replacement drives. The six analytical views remain separately linked. It always loads the latest published, validated matrix presentation capsule; incoming snapshot and quarter parameters are ignored and removed. There is no date selector or authentication.

The three editorial model identities are reviewed for one exact immutable generation in `web/src/owner-picks-data.ts`. A later generation must receive a new review before named picks appear. Passing the factual screen does not automatically add a model, and editorial inclusion does not override a failed screen.

The public screen requires:

- At least 16 TB nominal capacity and 20,000 distinct drives observed in the latest quarter.
- At least eight completed calendar-quarter positions from the reporting anchor (the first proven quarter meeting the 2,000-drive threshold); twelve preferred.
- Complete latest-quarter coverage, and an editorial reliability review for the exact generation.

The page reads population and quarterly/cumulative AFR from the existing capsule, without hardcoding statistical values. It displays years of model deployment using the full first-recorded history; reporting-anchor maturity remains part of the selection screen. Calendar positions include source gaps; gaps are disclosed rather than compressed away. Cumulative observed-history AFR uses recorded failures and exposure, including available pre-anchor exposure, without imputing missing days. History is model deployment history, not physical-drive age.

Cards are ordered by latest-quarter observed drive count, largest first. Full first-recorded history is displayed in years with two decimal places (elapsed calendar-quarter positions divided by four). The update date records the editorial page revision for its reviewed snapshot; the separately displayed quarter identifies the Backblaze data period.

Each included model links to its exact model-number search on PCPartPicker and to the underlying AFR comparison. A search link does not establish availability or current production.

The full vendor/model/capacity title has a padded background using the matrix brand palette. Toshiba uses a card-only darker red (`#B40000`) so white text exceeds the [WCAG AAA normal-text contrast requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html) of 7:1 at every size. Seagate uses black text; WD and Toshiba use white text. These category colors are independent of the AFR values.

These are curated research candidates, not trained scores or statistically certified predictions. Current manufacture and system compatibility are not established by these aggregates. The public implementation contains no personal inventory, ownership history or private narrative. The route renders only the three cards and never mounts the full matrix.
