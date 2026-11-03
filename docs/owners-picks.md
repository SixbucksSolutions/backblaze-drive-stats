# What I’d Buy

The public home page (`?view=picks`) presents a small editorial shortlist for researching replacement drives. The six analytical views remain separately linked. The build renders the latest published, validated matrix evidence into the delivered HTML. Root (`/`) and `?view=picks` show that same document; incoming snapshot and quarter parameters are ignored and removed. The browser does not fetch a matrix capsule or analytical catalogue, or rerun selection, to show the shortlist. There is no date selector or authentication.

The three editorial model identities are reviewed for one exact immutable generation in `web/src/owner-picks-data.ts`. A later generation must receive a new review before named picks appear. Passing the factual screen does not automatically add a model, and editorial inclusion does not override a failed screen.

The public screen requires:

- At least 16 TB nominal capacity and 20,000 distinct drives observed in the latest quarter.
- At least eight completed calendar-quarter positions from the reporting anchor (the first proven quarter meeting the 2,000-drive threshold); twelve preferred.
- Complete latest-quarter coverage, and an editorial reliability review for the exact generation.

The build reads population and quarterly/cumulative AFR from the validated capsule, without hardcoding statistical values. The release audit independently reconstructs the latest capsule from canonical public data and compares the actual delivered markup and navigation context. It displays years of model deployment using the full first-recorded history; reporting-anchor maturity remains part of the selection screen. Calendar positions include source gaps; gaps are disclosed rather than compressed away. Cumulative observed-history AFR uses recorded failures and exposure, including available pre-anchor exposure, without imputing missing days. History is model deployment history, not physical-drive age.

Cards are ordered by latest-quarter observed drive count, largest first. Full first-recorded history is displayed in years with two decimal places (elapsed calendar-quarter positions divided by four). The update date records the editorial page revision for its reviewed snapshot; the separately displayed quarter identifies the Backblaze data period.

Each included model links to its exact model-number search on PCPartPicker and to the underlying AFR comparison. A search link does not establish availability or current production.

The full vendor/model/capacity title has a padded background using the matrix brand palette. Toshiba uses a card-only darker red (`#B40000`) so white text exceeds the [WCAG AAA normal-text contrast requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html) of 7:1 at every size. Seagate uses black text; WD and Toshiba use white text. These category colors are independent of the AFR values.

These are curated research candidates, not trained scores or statistically certified predictions. Current manufacture and system compatibility are not established by these aggregates. The public implementation contains no personal inventory, ownership history or private narrative. The route renders only the three cards and never mounts the full matrix.

The shared static Pages index also serves analytical query routes. An early route gate hides the home markup on those routes before application startup. Home keeps Inter and its stable-font/fallback behavior; it neither preloads nor waits for JetBrains Mono. Analytical views retain their required fonts and the matrix retains its own loading spinner. Small navigation and font JavaScript still runs on home.

The analytical catalogue is a separately hashed asset. Analytical routes validate its reference, byte length and SHA-256 before using its capsule references; home, explicit examples, the reference matrix and legacy views do not fetch it. This changes the request graph, so transferred bytes, request counts and visible readiness must be measured separately. No fixed latency improvement or unchanged analytical startup time is promised.
