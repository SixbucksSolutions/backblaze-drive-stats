# Single-line model selector labels (#0122)

The [live matrix](https://backblaze-drive-stats-analysis.pages.dev/?view=matrix)
keeps every model-and-capacity label on one text line. The desktop selector stays
230 px wide. Longer labels are reachable through native horizontal scrolling
inside that pane; manufacturer counts, checkboxes, search and selection remain
usable. The matrix keeps its existing space, ordering and values.

Only `matrix-selection.css` changed in the application source. All 3,097 public
JSON files are byte-identical to the previous release; no data refresh, dependency,
Worker or Function was introduced.

Verification passed:

- Full quality checks, 237 web tests, the normal build and both operating-system
  CI jobs in run `41454998146`, for source
  `5527e5b0658756fdefab45b17c5589283fb97bd6`.
- Fresh independent source/visual review and 27 actual-browser checks: all 30
  latest labels occupy one text line at desktop and narrow widths, including
  24/12/1.5 TB cases. Long and unknown-capacity reference labels were also checked.
  Full text is reachable, controls
  and ordering work, and there is no page-level horizontal overflow.
- Production deployment `5a338eab-0ff0-4ed0-91e6-f663641c8ecc`; full hosted proof
  passed 4,779 assets, four navigation cases, eighteen missing/private paths and
  nine redirects. All 4,769 prior immutable assets remain compatible. Archive
  readback verified every file hash; predecessor `9e3ac7f0` is retained.
- Ten separate public-origin smoke checks passed with no application errors or
  failed assets. One implicit favicon `404` is recorded separately. Owned Chrome
  and local test servers were closed.

Private evidence remains under ignored `data/staging/0122/` and
`data/staging/0122-publication/`, outside Git and the served bundle.
