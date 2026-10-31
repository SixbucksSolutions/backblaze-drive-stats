# Flagship comparison preview

Ticket #0015 implements a local, fixture-backed comparison at `?view=matrix`.
The default route and all six existing Explore reports retain their published
calendar-quarter bundles. Primary navigation and real generated matrix integration
remain gated by #0017; this preview does not run a backfill or publish a Site.

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

- Relative Year/Quarter stays at the left. Vendor, exact model, AFR/Drives and
  metric headers stay visible while the matrix scrolls on both axes.
- Every model retains AFR Value, AFR Delta, Count, Population Delta, New, Retired
  and Failed in seven adjacent columns. Models never become isolated cards.
- Vendor/model filtering and explicit model selection narrow the comparison.
  Pins collect candidates at the left and remain visible across filters. A
  pinned-only switch and reset control support focused comparisons. Pinned
  model blocks are grouped, rather than horizontally frozen.
- All stored snapshot color domains remain fixed while filtering or pinning.
  Exact encoded-sRGB interpolation rounds half upward and clamps endpoints.
  Neutral mode preserves numbers and state patterns. The expandable legend
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
- A configurable guide defaults after quarter 20; the six-year guide stays after
  quarter 24. The axis always extends to at least 24 and includes the full source
  history, even for short candidates. Changing the guide extends it further.
  Extended production sample rows remain snapshot-ended; extended reference rows
  remain unknown reference coverage. Guides describe deployment history, not
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
`?view=matrix&snapshot=synthetic-later-v1` or
`?view=matrix&snapshot=synthetic-new-manufacturer-v1`.
Browser review should include wide and narrow viewports, both scroll axes,
the promising 14-row reference against the 20/24 guides, the first Toshiba
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
chips; filtering/pinning cannot rebase it. Brand headers use the exact category
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
  stable when filtering or pinning.
- AFR cells show `2.006` under **Value %**, without repeating the percent sign.
  Inspector values and accessible cell descriptions retain explicit units.
- Vendor colors continue through model headers. Exact fills are Seagate
  `#6EBE49`, WDC/HGST `#005195` and Toshiba `#CC0000`. Black or white text is
  selected for the stronger contrast; these category headers meet normal-text
  AA, while numeric heatmap cells retain the separate 7.1:1 target. Seagate uses
  black text because white on that green would have insufficient contrast.
- Model names center across their seven columns; pin controls are positioned
  separately. Sticky label insets keep names visible beside the frozen age
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
rows. Search kept its caret through filtering, and the model picker stayed open
through checkbox changes. Computed WD model colors matched the pinned palette.
At a 390 px viewport, initial and final model names remained visible beside the
frozen age columns. Desktop evidence is in
`data/staging/ui-0015/typography/desktop-final.png`. Unit checks cover late font
completion, fallback, stalled startup and partial year grouping; these do not
replace a full-site accessibility or performance audit.

Subsequent owner feedback makes the relative-row outline transient: leaving a
row clears its highlight and stored active-row state, without clearing the cell
inspector or changing keyboard focus. Moving between cells within the same row
keeps the outline. Horizon labels now occupy normal space inside Quarter cells,
so subsequent sticky rows cannot cover the lower half of the five-/six-year text.
Browser checks confirmed both badges fit vertically and horizontally inside
their Quarter cells, and leaving row 27 removes the row outline. The owner also
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
  source/inspector detail, hover exit and filter/pin behavior remain in place.
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
model labels after resizing/filtering. Fresh independent source and screenshot
reviews were completed. Continuous horizontal scrolling can expose a partial
column beside the frozen boundary, as before. Evidence:
`data/staging/ui-0015/typography/scrollbars-desktop-final.png` and
`scrollbars-narrow-final.png` in the same directory. Mouse-wheel/touch support is
retained through the original viewport; physical touchscreen input and other
browser engines were not separately exercised.
