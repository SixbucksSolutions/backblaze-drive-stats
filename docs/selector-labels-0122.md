# Fitted monospace model selector (#0122)

The [live matrix](https://backblaze-drive-stats-analysis.pages.dev/?view=matrix)
fits the selector width to its complete, single-line labels. There is no
horizontal selector scrollbar or clipping. The existing vertical list scrolling
remains; help text wraps within the pane.

Model labels use the existing bundled JetBrains Mono font. Known Seagate capacity
blocks retain their existing alignment, including the `ST3` lead-in before
`1500` in the legacy model. Capacity parentheses and `TB` units now share columns
across all manufacturers:

```text
ST24000NM002H   (24   TB)
 ST8000DM0002   ( 8   TB)
ST31500541AS    ( 1.5 TB)
```

Two positions are reserved for the right-aligned integer part and two for `.d`.
Whole values leave the decimal positions blank. The spaces are layout, not a
change to the model code or capacity value. Shared columns come from the full
snapshot before filtering, so filtering does not shift either parenthesis.
Unknown or unrecognized blocks retain their complete codes and readable text;
the helper does not invent capacity. Source IDs, ordering, selection and metrics
remain unchanged.

## Verification and release

- Full quality checks, all 243 web tests and the normal production build passed.
  Both Windows/Linux CI jobs passed run `41480321861` for source
  `a352680c6f399f91b0dc15bb2ad32741eef45073`.
- Fresh independent source/visual review and all 32 final browser checks passed
  (31 geometry/font/control checks plus a selection-copy assertion). At 1350 and
  390 CSS pixels with custom and forced-fallback fonts, both parentheses line up
  exactly across all 30 labels. Integer, fraction and `TB` geometry matches the
  accepted examples. Full bounds, no wrapping/horizontal selector overflow,
  unchanged legacy code alignment, stable filtering, keyboard, ordering, copy,
  accessible names and startup behavior passed.
- Deployment `88b2a359-466f-4418-90e3-fd05dc2e33dd` succeeded. Full hosted proof
  passed 4,787 assets, four navigation cases, eighteen missing/private paths and
  nine redirects. All 4,777 predecessor immutable assets remain compatible.
  Archive readback verified every file hash; predecessor `46d05fc2` is retained.
- Twelve separate public-origin smoke checks passed, with no application errors or
  failed assets. One implicit favicon `404` is recorded separately. Owned Chrome
  and local test servers were closed.

All 3,097 public JSON files are byte-identical to the predecessor. No data refresh,
new font/dependency, Worker or Function was introduced. Private current evidence
is under ignored `data/staging/0122/column-verification/`,
`data/staging/0122/columns/`, `data/staging/0122/column-review/` and
`data/staging/0122-columns-publication/`. Superseded three-character numeric-field
checks are explicitly marked and were not used for final acceptance or published.

## Earlier fitted-label release

Source `7b8177c` was published as `46d05fc2`, adding fitted mono labels and the
Seagate code alignment after 240 tests and 24 browser checks. Its ten public
checks passed. That evidence remains preserved in `data/staging/0122/fit-*` and
`data/staging/0122/fit/`; the current revision retains those behaviors and adds
the capacity columns confirmed by Terry.

## Superseded first implementation

The initial CSS-only revision kept a 230 px pane and used horizontal scrolling.
Source `5527e5b` was published as `5a338eab` after 237 tests, 27 local browser checks
and ten public smoke checks. Terry clarified that full labels must fit without
horizontal scrolling, while retaining vertical scrolling, then requested the
fixed-width font and capacity-column alignment. The current revision supersedes
that design. Earlier evidence and the rollback archive remain preserved under
`data/staging/0122/verification/`, `data/staging/0122/publication/` and
`data/staging/0122-publication/`.
