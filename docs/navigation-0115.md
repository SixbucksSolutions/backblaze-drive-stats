# Shared view navigation (#0115)

The [live explorer](https://backblaze-drive-stats-analysis.pages.dev/) uses one
navigation for AFR comparison and the five published reports. Collapse it to
recover matrix space, then expand it to switch views. Narrow screens use an
expandable menu above the report. Model context, legacy reports and workbook or
synthetic references remain under **More context & references**.

Shared navigation links preserve the selected snapshot, reporting quarter and
collapse preference. Production links clear fictional/reference selectors;
historical availability remains explicit. Collapse retains the current table and
selection, keeping keyboard focus on its toggle instead of rebuilding the report. The entire shell remains
inside the accepted startup font/loading/fade boundary.

## Verification and publication

- Strict types, typed lint, formatting, all 227 web tests and the normal production
  build passed. Both Windows/Linux CI jobs passed in run `41373138522` for source
  `966006568f9ae3d51af6b09152efbcaf9387ba0d`.
- Fresh independent code review and 59 actual-Chrome checks passed, including all
  36 view-to-view transitions, historical snapshot/quarter retention, unavailable
  datacenter evidence, keyboard access, collapse/reload behavior and startup
  gating. Desktop collapse recovered 164 pixels while preserving the table and
  selection. Independent review of seven desktop/narrow screenshots passed.
- The browser-tested inventory matches the qualified bundle exactly. All 3,097
  published JSON files are unchanged. The upload retains 117 predecessor files
  and preserves all 3,220 prior immutable assets compatibly.
- Production deployment `8e871449-c5d1-42c9-888f-4157b15406d0` succeeded. Full hosted
  verification passed 3,230 assets, four navigation cases, eighteen missing/private
  path cases and nine redirects. Every file in the retained archive passed hash
  readback. Predecessor `c5d1535d` remains retained for rollback.
- A separate public-origin Chrome smoke passed all eleven core functional checks:
  all six views, fonts, historical availability, collapse/reload and narrow
  keyboard use. No application assets failed and no page exceptions occurred.
  Its ancillary network check retained the browser's implicit `/favicon.ico`
  `404` as a recorded exception; it is not counted as a passed check. All owned
  browser/server processes were closed after verification.

This is a static Pages frontend change; no data refresh, Worker, Function or
dependency was added. Private review, browser and publication evidence is retained
under ignored `data/staging/0115/` and `data/staging/0115-publication/`, outside Git
and the served bundle. Early harness attempts required sandbox-launch and URL,
hover and implicit-favicon expectation corrections; no app defect was established
by those attempts. The final frozen-bundle pass had no browser errors or alerts.
