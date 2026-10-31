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
