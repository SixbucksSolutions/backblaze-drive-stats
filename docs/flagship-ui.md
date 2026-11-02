# Flagship comparison interface

Ticket #0015 established the fixture-backed comparison; #0087 connects the same
interface to validated real v2 production history. Explore presentation and release
validation retain their separately authorized work. No backfill or publishing is
performed by the browser.

## Real v2 production matrix (#0087)

The primary matrix now reads the immutable v2 generation index through the shared
validated `SnapshotLoader`. The default is its `latestSnapshotId`; an advertised
as-of generation can be selected with `?view=matrix&snapshot=<snapshotId>`. Only the
chosen descriptor and full matrix are fetched. A snapshot switch validates before
replacing the old matrix, aborts stale requests and keeps the previous validated
comparison visible if loading fails. Invalid IDs fail visibly rather than silently
substituting a different generation.

The public rate label is **Observed-history AFR**. The explicit v2 presentation
adapter maps recorded-exposure metrics and retains current coverage, known
components, threshold lower bounds/proofs, complete-history availability,
completeness limitations and actual delta baseline/span in the cell inspector.
Partial anchors and calendar gaps consume relative positions. Rates can remain
available on a later complete eligible row after a historical gap; missing days
are never imputed. Retired inference and the provisional cutoff Failed proxy are
identified separately. Source IDs/hashes and Backblaze attribution remain visible.

All analysis IDs in the selected snapshot start selected: the accepted real
2025 Q3/Q4 snapshots each contain 21 and 2026 Q2 contains 22. Supporting context
is separate. Purchase and historical-reference default sets remain empty; no
recommendation is inferred. Color domains are derived once from every numeric
eligible value in that selected matrix, following the accepted palette/edge rules,
and remain fixed through model filtering. Existing accessibility, frozen axes,
checkbox hierarchy, native rails, fonts and guide-after-year-6 defaults remain.

Historical workbook and invented v1 references are explicitly separate at
`?view=matrix&reference=1`. Append their existing `snapshot` IDs to that URL to
select one directly; their source files, values and original semantics are intact.
The older verification notes below document that reference work and its evidence.

`matrix-production.test.ts` checks every displayed value against all three real
v2 matrices, the fictional partial-anchor/gap/reentry case, complete-history nulls,
threshold evidence, baseline distance, color edge rules and stale/canceled loads.
Run `npm run quality`, `npm test` and `npm run build` from `web` for integration.

## Evidence and labels

- Both owner-supplied references, 2025 Q3 and 2025 Q4, expose all 19 model blocks
  and every original row. The eight reading-case controls select their exact
  models, including both early-spike Toshiba variants.
- References are labeled **reference only**. Calendar mappings, actual cutoff,
  exposure, pre-eligibility components and trailing-blank causes remain unknown.
  Inspector values preserve the original OOXML numeric text and cell address.
  Reference positions are retained rows, not proven elapsed calendar time.
- Four production-contract fixtures are separately labeled **synthetic sample**.
  They demonstrate calendar offsets, reentry, source gaps, incomplete coverage,
  threshold exit, snapshot end, corrected generations and dynamic new vendors.
  They make no claims about observed Backblaze performance.
- Vite imports the canonical repository JSON files with `?url`. Build assets are
  generated into ignored `web/dist`; no duplicate source fixtures are maintained.

## Reading and interaction

- Numeric AFR and AFR-delta displays use [exactly three decimal places](afr-precision-0123.md),
  including `0.000`. This is display formatting; raw precision and calculations remain intact.
- Current display updates are recorded in the [model presentation handoff](model-presentation-0119-0121.md).
  Snapshot choices descend from newest to oldest. Models show nominal per-drive
  capacity and sort within manufacturer by descending capacity, then model code;
  unknown capacity remains explicit. Historical Deskstar labels share HGST/WD,
  without changing source IDs, metrics or stored color domains.
- Model selector labels [fit on one line](selector-labels-0122.md) without
  horizontal scrolling. They use a fixed-width font; known Seagate capacity digits
  align while complete model codes remain unchanged. Capacity parentheses share
  columns, with two integer and two optional decimal positions. Vertical list
  scrolling stays.
- Relative Year/Quarter stays at the left. Vendor, exact model, AFR/Drives and
  metric headers stay visible while the matrix scrolls on both axes.
- Every model retains AFR Value, AFR Delta, Count, Population Delta, New, Retired
  and Failed in seven adjacent columns. Models never become isolated cards.
- The left-side selector groups indented model checkboxes under their brand.
  A checked brand toggles every child off; an unchecked or mixed brand selects
  every child. Mixed uses a native, operable indeterminate checkbox. Each brand's
  color bar extends through its model list. Select all and Clear all are global.
- Search finds sidebar choices without changing the table selection. Brand
  toggles include search-hidden children. Brands/models keep a stable order;
  all models in a newly selected snapshot start checked. Reading cases apply
  their exact model selections and update the sidebar states.
- All stored snapshot color domains remain fixed during model selection.
  Exact encoded-sRGB interpolation rounds half upward and clamps endpoints.
  **Show data colors** is checked when numeric cells have their heatmap colors.
  Unchecking it preserves numbers and state patterns. The expandable legend
  gives every metric's knots, population count, extrema and inclusive median.
- Focus, click or hover a value to populate the inspector. Arrow keys move
  across metrics and relative rows; Home/End move to row endpoints. A focused
  cell becomes the keyboard entry point. Relative-row outlines preserve colors.
- The inspector includes exact value, calendar/relative context, cutoff,
  quarterly/cumulative/pre-eligibility exposure, quarter-only AFR, baseline/span,
  retirement inference, raw inspector observations and source hash when supplied.
- Below-threshold exit, missing source, partial source, unknown reference blank
  and snapshot-ended future history use distinct labels/patterns and accessible
  explanations. An eligible cell with an unavailable metric shows a dash and
  retains its available neighboring metrics. Observed zeros stay numeric zeros.
- **Guide after year** is a compact, centered native dropdown offering 1–6 and
  defaulting to 6. Exactly one guide appears after the selected year's Q4; year 6
  means relative quarter 24. Its label spans Year and Quarter. The axis extends
  to at least 24 and retains the full source history, even beyond the chosen guide.
  Extended production sample rows remain snapshot-ended; extended reference rows
  remain unknown reference coverage. The guide describes deployment history, not
  physical drive age or a replacement prediction.

## Verification

From `web`, run `npm test` and `npm run build`. Tests preserve all source values
and owner-case availability in both real references, unknown calendar/exposure,
gap/reentry baseline spans, partial rate availability, distinct render states,
full-snapshot domain invariance, new manufacturer discovery, short-history guide
extent, malformed New-to-white normalization and exact color interpolation.
The build also performs TypeScript and existing published-data checks.

For local review, run `npm run dev`, then open `http://127.0.0.1:5173/?view=matrix`.
An immutable fixture can be selected directly, for example
`?view=matrix&reference=1&snapshot=synthetic-later-v1` or
`?view=matrix&reference=1&snapshot=synthetic-new-manufacturer-v1`.
Browser review should include wide and narrow viewports, both scroll axes,
the promising 14-row reference against the selected-year guide, the first Toshiba
spike, the later synthetic gap and an XYZ-only comparison. Source review and
visual review are independent handoff gates, recorded by the parent task.

## Color accessibility review

Owner review on 2026-10-31 requested higher contrast, specifically the first
ST12000NM0007 AFR cell (2.006%). The original `#101810` text on pure red measured
about 4.53:1: just above the normal-text AA minimum, but below enhanced contrast.
The owner found it difficult to read, so the numeric display now targets more
than that minimum.

`matrix-contrast.ts` applies WCAG 2.2 relative-luminance calculations to opaque
sRGB colors. After the original scale interpolates its color, the presentation
fill is mixed toward white only as far as needed for **at least 7.1:1 with black
text**, leaving a margin above the enhanced 7:1 requirement. Already sufficient
fills stay unchanged. The reported cell now uses `#FF6161` with `#000000`, about
**7.13:1**, and numeric text is now 14 px/600 weight. Its value remains 2.006%.

The same deterministic presentation mapping applies to numeric cells and legend
chips; model selection cannot rebase it. Brand headers use the exact category
colors described below. Source palettes, raw fixture
colors, numeric domains, thresholds and values are retained unchanged. This is
an explicitly owner-requested accessibility adjustment to rendering, not a new
AFR calculation or a rewrite of the workbook evidence. The legend identifies the
high-contrast presentation.

Supporting text/links and control borders are darker. The inspector link was
corrected from 4.409:1 to about 8.71:1. Keyboard focus and active rows use clear
black/white treatment; meaningful focus/control cues target at least 3:1.
Numeric values, state labels/patterns and neutral mode keep color from being the
only means of reading the comparison. `forced-colors` styles use system colors
and do not disable the user's forced-color preferences. Real OS forced-color
rendering was not emulated in the browser check; source rules were reviewed.

Verification includes all numeric cells from both references and four synthetic
snapshots, 512 samples along every gradient segment, exact WCAG threshold math
without ratio rounding, invalid/translucent-color rejection, actual computed red
cell/legend colors, neutral display, keyboard focus and 390 px horizontal
navigation. A visible-leaf browser audit checked 294 text nodes with no AA
contrast failures; it is a bounded color check, not a complete WCAG conformance
audit. The frozen age/model/header geometry was preserved and rechecked.

Standards used: [WCAG 2.2 text contrast AA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[enhanced text contrast AAA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html),
[non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
and [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
Saved local browser evidence: `data/staging/ui-0015/contrast/`.

## Typography, stable rendering and grouped years

Owner feedback on 2026-10-31 added these presentation requirements:

- Self-hosted Inter for interface text and model names; JetBrains Mono for
  numerical matrix cells. Numbers use 14 px/600 weight, fixed character-width
  fields and a reserved sign position for AFR delta. All seven metric columns
  and their headers are centered. Field widths use the full snapshot and remain
  stable when model selection changes.
- AFR cells show `2.006` under **Value %**, without repeating the percent sign.
  Inspector values and accessible cell descriptions retain explicit units.
- Vendor colors continue through model headers. Exact fills are Seagate
  `#6EBE49`, WDC/HGST `#005195` and Toshiba `#CC0000`. Black or white text is
  selected for the stronger contrast; these category headers meet normal-text
  AA, while numeric heatmap cells retain the separate 7.1:1 target. Seagate uses
  black text because white on that green would have insufficient contrast.
- Model names center across their seven columns. Sticky label insets keep names
  visible beside the frozen age
  columns on narrow screens.
- Each relative year has one extended cell covering its quarter row group,
  with its number aligned beside Q1. Internal quarter lines stop at the Year
  column. Final partial years span only their actual rows; horizon rules remain.

The initial interface stays hidden until fonts and first-route rendering settle,
then becomes visible after two animation frames. Fonts are preloaded from the
same origin; no external font connection or preconnect is needed. After five
seconds or a font failure, a permanent system-font fallback prevents a later
font swap. A 15-second startup deadline reveals an error if rendering stalls;
late startup work is prevented from overwriting that error.

Matrix interactions reconcile retained DOM nodes instead of replacing the whole
interface. Search focus/caret, disclosure state and scroll containers survive
updates. This reduces avoidable flicker; it does not claim virtualization or
eliminate all browser painting. Font licenses, attribution and unmodified source
hashes are recorded in [COPYRIGHTS.md](../COPYRIGHTS.md) and distributed with the
font assets. The production build verifies those assets.

Browser verification confirmed custom fonts, Inter model names, Mono numbers,
percent-free AFR cells with explicit accessible units, centered metric fields,
and Q1-aligned year numbers (within one pixel). The 2025 Q3 final year spans three
rows. Search kept its caret through updates. Computed WD model colors matched
the specified palette.
At a 390 px viewport, initial and final model names remained visible beside the
frozen age columns. Desktop evidence is in
`data/staging/ui-0015/typography/desktop-final.png`. Unit checks cover late font
completion, fallback, stalled startup and partial year grouping; these do not
replace a full-site accessibility or performance audit.

Subsequent owner feedback makes the relative-row outline transient: leaving a
row clears its highlight and stored active-row state, without clearing the cell
inspector or changing keyboard focus. Moving between cells within the same row
keeps the outline. The guide reserves a label line in Q4 and spans the frozen
Year/Quarter columns, so subsequent sticky rows cannot cover it. Browser checks
confirmed the badge fits the frozen width and leaving row 27 removes the row outline. The owner also
confirmed the hover behavior. Evidence:
`data/staging/ui-0015/typography/hover-guides-final.png`.

## Scrollbars around the data area

The owner approved placing the vertical scrollbar below the frozen headers and
the horizontal scrollbar after the frozen Year/Quarter columns. The matrix keeps
one semantic table and its sticky headers. Two separate native overflow rails
control the same viewport; no scrollbar thumb or drag behavior is drawn by the
application.

- The right rail starts at the measured bottom of the table header. The bottom
  rail starts at the measured right edge of the frozen age columns.
- Rail content extents match the viewport's scroll ranges exactly. Scrolling
  either rail updates the table; wheel, touch and focus-driven movement in the
  table update the rails. Resize and font changes refresh the geometry.
- Rail boxes use size containment, so their invisible sizing content cannot
  enlarge the surrounding grid. The fixed 18 px slots remain allocated; a rail
  is hidden when its axis has no overflow.
- The matrix and both native rails have keyboard-accessible region labels. The
  rails identify the table viewport they control. Existing cell navigation,
  source/inspector detail, hover exit and model selection remain in place.
- Rendering reconnects synchronization after content updates and restores the
  table's prior offsets. Cleanup removes old listeners and resize observers.

Native scrollbar appearance and auto-hiding follow the browser and operating
system. This changes their placement without adding a custom scrollbar widget.

Verification on 2026-10-31: 26 web tests and the production/type/data/font build
pass. A regression reproduces delayed scroll-event echoes during native rail
animation and verifies that synchronization does not rewrite the active rail's
position. Actual native keyboard scrolling reached the full 528 px vertical
range and advanced 80 px for two horizontal arrow presses. Cell End navigation
also moved the viewport and horizontal rail together to the final model.

Desktop and 390 px browser checks confirmed matching rail/viewport ranges, track
origins aligned with the header bottom and frozen-column edge, retained offsets
through a neutral-color update, hidden rails for empty results, and visible final
model labels after resizing/model selection. Fresh independent source and screenshot
reviews were completed. Continuous horizontal scrolling can expose a partial
column beside the frozen boundary, as before. Evidence:
`data/staging/ui-0015/typography/scrollbars-desktop-final.png` and
`scrollbars-narrow-final.png` in the same directory. Mouse-wheel/touch support is
retained through the original viewport; physical touchscreen input and other
browser engines were not separately exercised.

Owner follow-up centers manufacturer names within the visible portion of their
brand band, excluding the frozen age columns. This keeps labels centered during
horizontal movement and centers each band separately at a manufacturer boundary.
Offscreen labels stay within their own bands and retain accessible header text;
narrow visible fragments may ellipsize. Resize and model selection
refresh the placement without changing scroll offsets or native scrollbar ranges.

Browser checks found subpixel centering agreement for a full Seagate band, the
Seagate/Toshiba boundary and WDC/HGST at 390 px. All 26 tests, TypeScript and production checks
pass; fresh independent source review has no findings. Evidence is saved as
`brands-centered-desktop.png`, `brands-centered-boundary.png` and
`brands-centered-narrow.png` under `data/staging/ui-0015/typography/`.

The display name is **Sixbucks Solutions** in the interface, project documentation,
copyright notice and future generated attribution. GitHub organization identifiers
and URLs retain `SixbucksSolutions`. Existing immutable snapshots and source
fixtures remain historical evidence; new exports use the actual generator code
revision, as required by the publication workflow.

## Brand and model selection

The owner's final 2026-10-31 refinement replaces the former pin workflow with
native hierarchical checkboxes. The selector sits left of the table on desktop;
at widths of 850 px or less it stacks above the full-width table, with its own
bounded scrolling area. Native fieldsets/legends label each brand group.

- All children selected: the brand is checked; activating it clears every child.
- No children selected: the brand is unchecked; activating it selects every child.
- Some children selected: the brand uses the browser's native indeterminate dash
  with a gray accent. It remains enabled; click or Space selects every child.
- Individual model controls update their brand state immediately. Select all and
  Clear all apply to the complete snapshot, including choices hidden by search.
- Find choices narrows the selector only. Selection counts and the table still
  reflect the complete chosen set; brand controls always apply to the full brand.
- Each full-height brand color bar ends with its last model. Model checkboxes are
  indented 24 px from their brand checkbox. Header brand colors and centered names
  remain on the table, with no pin controls or special candidate ordering.
- The eight reference cases are now **Example comparisons**, below the table,
  inspector and legend, immediately before **How to read**. Applying an example
  selects its models, resets the matrix offsets, focuses the matrix region and
  brings the comparison into view without animation. Sidebar states reflect it.
- Changing snapshots selects all models in the new snapshot, including newly
  encountered brands. Deselecting the inspected model clears its old details.

Verification: all 30 web tests and the production/type/data/font checks pass.
Fresh independent source and visual reviews found no remaining issues. Browser
checks cover mixed/full/empty states with click and Space, search-hidden children,
global selection, empty results, the synthetic XYZ brand, reference presets and
their return-to-table focus. The bar ends at the last child and the measured
indent is 24 px. Desktop/390 px checks retain exact native scrollbar ranges and
origins, keyboard End navigation, search caret and row-highlight exit. Physical
touch hardware, other engines and an OS forced-colors session were not exercised.

Evidence under `data/staging/ui-0015/typography/`:
`selection-sidebar-desktop-final.png`, `selection-sidebar-narrow-final.png` and
`example-comparisons-bottom.png`.

## Final guide and color controls

The owner's final controls review requested these refinements:

- **Table display** titles the guide/color controls at the bottom right of the
  table footer, beside the state legends, and labels their region for assistive
  technology. On narrow screens the controls wrap below the legends.
- **Guide after year** is a 56 px native dropdown with centered values 1–6 and a
  default of 6. It draws one guide after that year's Q4, replacing both former
  simultaneous guides. Choosing 1 or 5 moves it to quarter 4 or 20; 6 uses 24.
- **After year N** spans the frozen Year and Quarter columns. A reserved label
  line prevents overlap with Q4 text or the following year. The full source
  history stays visible, including years beyond the guide.
- **Show data colors** uses positive checkbox wording: checked means numeric
  cells are colored; unchecked removes those colors. It starts checked and is
  independent of the year selection.

Browser verification confirms all six dropdown choices, centered styling and
56 px width; exactly one row/year marker for years 1, 5 and 6; and a 124 px label
span within one pixel of both frozen edges on desktop and 390 px screens. The
color checkbox removes/restores metric paints while retaining year 6 and its
single guide. The application default explicitly overrides older producer hints;
golden fixtures and existing immutable artifact metadata were not rewritten.

Final evidence: `data/staging/ui-0015/typography/year-guide-and-data-colors-final.png`
and `year-guide-six-narrow-final.png` in the same directory. The final titled
section is captured in `table-display-final-signoff.png`.
The subsequent footer placement is captured in `table-display-footer-desktop-final.png`
and `table-display-footer-narrow.png`. Browser checks confirm desktop alignment,
narrow containment, native dropdown keyboard focus through changes and unchanged
guide/color behavior. The former standalone control card above the table is removed.

The compact 56 × 30 px year dropdown uses 4 px vertical padding, avoiding the
clipped numeral caused by inheriting the taller field's 9 px padding. Desktop and
390 px checks confirm the complete selected `6`; its size and footer spacing
are unchanged. Evidence: `dropdown-six-unclipped-desktop.png` and
`dropdown-six-unclipped-narrow.png` in the same directory.

The [responsive matrix viewport](matrix-viewport-height-0124.md) uses browser height to show more rows in tall windows while preserving row text size and synchronized scrolling.
