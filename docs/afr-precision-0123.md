# AFR display precision (#0123)

The [live explorer](https://backblaze-drive-stats-analysis.pages.dev/) shows
exactly three decimal places for numeric AFR displays:

- `3.4738221444845383%` displays as `3.474%`.
- Integer and zero values retain trailing decimals: `2.000%`, `0.000%`.
- AFR percentage-point deltas retain their existing sign/spacing behavior.

A shared formatter covers matrix cells, selected and quarter-only inspector
values, complete-history detail strings, baselines, legend statistics/knots,
accessible labels and tooltips, and legacy summary/chart/axis/table displays.
Reference reading-case AFR prose is formatted only when rendered; its original
fixture remains unchanged. Unknown/unavailable markers remain distinct from zero.

This is presentation rounding. Raw numeric values, calculations, color domains,
sorting, CSV precision and non-AFR percentage formats are unchanged. All 3,097
public JSON files are byte-identical to the predecessor in this release.

## Verification and publication

- Full quality, all 246 web tests, the normal production build and both
  operating-system CI jobs passed run `41487298647` for source
  `dacd0b9106be716f47b232a099866c3d6573b75e`.
- Fresh independent review and all 34 local Chrome checks passed, including
  1,126 AFR cell displays, the exact owner screenshot case at desktop/narrow
  widths, zero, integer thresholds, baselines, legends, ARIA/tooltips, legacy
  reports, unchanged raw CSV precision and reference prose. Non-AFR legacy
  percentages retain fixed two decimals, published manufacturer percentages retain
  their maximum two decimals, and datacenter percentages retain maximum six.
- Real complete-history AFR remains unavailable in the checked snapshot. Its
  nonnull numeric formatting is covered by adapter tests using controlled inputs;
  the real UI was checked for preserved unavailability, without inventing data.
- Production `3065acc3-1ee7-49b3-88b8-862b3edbab09` succeeded. Full hosted proof
  passed 4,790 assets, four navigation cases, eighteen missing/private paths and
  nine redirects. Every archived file passed hash readback. All 4,781 prior
  immutable assets remain compatible; predecessor `88b2a359` is retained.
- All 17 separate public-origin smoke checks passed. The actual inspector shows
  quarter `3.474%`, cumulative `3.028%` and baseline `2.889%`. No application errors
  or failed application assets occurred; one implicit favicon `404` is recorded
  separately. Owned Chrome/server processes were closed.

Private source/browser/publication evidence is under ignored `data/staging/0123/`
and `data/staging/0123-publication/`, outside Git and the served bundle. No source
data refresh, dependency, font, Worker or Function was added.
