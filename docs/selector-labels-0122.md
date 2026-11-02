# Fitted monospace model selector (#0122)

The [live matrix](https://backblaze-drive-stats-analysis.pages.dev/?view=matrix)
fits the selector width to its complete, single-line labels. There is no
horizontal selector scrollbar or clipping. The existing vertical list scrolling
remains; help text wraps within the pane.

Model labels use the existing bundled JetBrains Mono font. Known Seagate capacity
blocks end in the same character column, including legacy prefixes:

```text
ST24000NM002H (24 TB)
 ST8000DM0002 (8 TB)
ST31500541AS (1.5 TB)
```

The indentation is visual padding, not a change to the model number. It uses
the full manufacturer group before search filtering, so filtering does not move
the capacity column. Unknown or unrecognized blocks retain their complete codes;
the helper does not invent capacity. Source IDs, ordering, selection and metrics
remain unchanged.

## Verification and release

- Full quality checks, all 240 web tests and the normal production build passed.
  Both Windows/Linux CI jobs passed run `41465911189` for source
  `7b8177c4d5b21cadbd1f5bcf75c5478a6a00ee64`.
- Fresh independent source/visual review and 24 actual-browser checks passed
  (17 geometry/font checks plus seven adjacent controls/navigation checks).
  At 1350 and 390 CSS pixels, custom and forced-fallback fonts preserve full label
  bounds, single lines, and zero horizontal selector overflow. Capacity digit ends
  differed by at most 0.016 CSS pixels in the custom-font captures and zero in
  fallback captures. Full legacy codes, stable filtered alignment, vertical
  scrolling, keyboard, ordering and startup behavior passed.
- Deployment `46d05fc2-2fa6-4529-9873-8f35ec9f149b` succeeded. Full hosted proof
  passed 4,783 assets, four navigation cases, eighteen missing/private paths and
  nine redirects. All 4,773 predecessor immutable assets remain compatible.
  Archive readback verified every file hash; predecessor `5a338eab` is retained.
- Ten separate public-origin smoke checks passed, with no application errors or
  failed assets. One implicit favicon `404` is recorded separately. Owned Chrome
  and local test servers were closed.

All 3,097 public JSON files are byte-identical to the predecessor. No data refresh,
new font/dependency, Worker or Function was introduced. Private current evidence
is under ignored `data/staging/0122/fit-verification/`, `data/staging/0122/fit/`,
`data/staging/0122/fit-review/` and `data/staging/0122-fit-publication/`.

## Superseded first implementation

The initial CSS-only revision kept a 230 px pane and used horizontal scrolling.
Source `5527e5b` was published as `5a338eab` after 237 tests, 27 local browser checks
and ten public smoke checks. Terry clarified that full labels must fit without
horizontal scrolling, while retaining vertical scrolling, then requested the
fixed-width font and capacity-column alignment. The current revision supersedes
that design. Earlier evidence and the rollback archive remain preserved under
`data/staging/0122/verification/`, `data/staging/0122/publication/` and
`data/staging/0122-publication/`.
