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

## Review follow-up: animated icon rail

On 2026-11-02, Terry requested animation and usable collapsed navigation. Both
directions now use 200 ms ease-in-out motion, accelerating then decelerating.
Desktop width and narrow-screen menu height animate; initial loads stay static
and reduced-motion mode switches immediately. All six collapsed icon links remain
visible and named. Hover or keyboard focus shows an unclipped label; Escape
dismisses it. Existing route context, table selection and startup fades remain.

Fresh independent source review, all 227 web tests and 23 focused Chrome checks
passed. The browser checks include intermediate geometry in both directions,
all six collapsed destinations, hover/focus/Escape behavior, retained report state,
narrow layout, reduced motion and the startup gate. Independent desktop/narrow
screenshot review passed; still images are not evidence of animation pacing.

Both operating-system CI jobs passed run `41422927726` for source
`8ec5dac44999c06c9f809878c24d4dce810efe6c`. It was published as deployment
`1cb7726c-2694-48c1-a750-2aea57b792d5`. The qualified browser inventory matches
the published build; all 3,097 public JSON files remain unchanged. The upload
retains 121 predecessor files and preserves all 3,224 prior immutable assets.
Full hosted verification passed 3,234 assets, four navigation cases, eighteen
missing/private paths and nine redirects. The archive passed every file hash on
readback; predecessor `8e871449` remains retained for rollback.

A separate public-origin smoke passed all sixteen checks for collapsed destinations,
active names, hover/focus/Escape, expansion, narrow layout and reduced motion.
No application asset failures or page errors occurred. One implicit favicon
`404` is recorded separately as an ancillary exception. Owned Chrome was closed.

Private follow-up evidence is in `data/staging/0115/rail-verification/`,
`data/staging/0115/rail/` and `data/staging/0115-rail-publication/`.

Terry approved #0115 and moved it to Completed on 2026-11-02. Later label,
capacity and date changes are recorded in the [presentation batch handoff](model-presentation-0119-0121.md).
