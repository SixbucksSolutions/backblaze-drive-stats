# Matrix startup feedback (#0113)

**Production deployed and verified.** The [live page](https://backblaze-drive-stats-analysis.pages.dev/) now shows an accessible “Preparing Drive Stats…” indicator while the complete matrix is prepared. The table still appears as one complete view with stable selected fonts, as requested; cells do not progressively pop in.

## What changed

The fixed indicator uses a system font, supports reduced motion, and is suppressed when JavaScript is unavailable. HTML and deferred module loading already allow downloads to overlap. The new startup helper gives a visible page one animation frame and a following task before heavy construction, giving the indicator an opportunity to paint. Hidden pages skip that wait; a 100 ms fallback bounds it and is not a minimum delay. Font and import requests remain parallel, and the existing whole-view and permanent font-choice gates remain in place.

The original renderer was retained: both renderer TypeScript files were restored to `efdea05`. An investigated renderer cleanup was removed because measurements were mixed and did not establish a robust latency improvement. Published data, metrics, calculations and cache policy are unchanged; delivery remains static Pages.

## Measured effect

The comparison used 16 captures on Chrome 156.0.8078.80, including older-snapshot and narrow-viewport controls. Latest desktop medians use two cold/warm pairs per bundle, with alternating bundle order, a clean headless profile, a 1350 × 940 viewport and the same memory-backed gzip server. Cached means warm HTTP cache, not application state or bfcache. Median first contentful paint was the complete matrix at 631 ms cold and 561 ms cached for the baseline. With the indicator, feedback appeared at 94 ms cold and 53.5 ms cached; the latest cached samples ranged from 51–56 ms.

The complete matrix's median largest contentful paint changed from 631 to 644 ms cold and from 561 to 579 ms cached: a 13–18 ms cost for the deliberate paint opportunity. This is earlier feedback, not a matrix speedup. The secondary ready observer changed from 577 to 592 ms cold and 548 to 563 ms cached. Lighthouse total blocking time uses a different measurement window when first contentful paint moves earlier and should be interpreted separately from complete-view latency.

The latest full matrix contains 11,130 cell buttons, 27,460 document elements, and 39,598 DOM nodes. All eight corresponding baseline/final screenshot pairs were byte-identical, and 29 functional checks passed, including 16-second hidden/background recovery and a complete view with custom fonts. These are bounded local browser observations, not a guarantee of identical timings on other devices or networks.

Chrome updated during investigation; final matched comparisons use the same full version, and no gain is attributed to the update. The owner's approximately 100 ms disk queue was not reproduced in actual-origin normal, hard-reload, or minimal-flags checks. A later owner capture showed 78 ms finish and 13 ms JSON before any app patch. The request was already High priority; no priority-hint change was justified. The exact cause of the owner’s earlier queue remains unidentified.

## Verification and release

Ten focused startup tests and all 222 web tests passed, as did types, lint, formatting, and build checks. Both operating-system CI jobs succeeded in run `41359054014`. The initial production deployment `7838a3f5-3bfc-405f-b0df-81bc9f359200` succeeded from source `0b803eba2b7d0a674aad580745a837503bbf814f`; the deploy guard completed in 19.57 seconds.

The qualified final distribution contains 3,114 files / 289,058,590 bytes, with manifest SHA-256 `a93343a2fefa6d811b366f124d06a0965e2fab303585c7213936ed65fce3d717`. The release union contains 3,227 files / 302,873,823 bytes, retains 113 predecessor files, and preserves all 3,217 prior immutable files compatibly. Rollback publication `f290ba5d`, source `d402829`, is retained. The public full-union probe passed all 3,226 served files (302,872,657 decoded bytes), four navigation cases, eighteen missing/private-path cases and nine redirects. The retained release ZIP was read back and every file matched its expected SHA-256.

Private evidence remains under ignored `data/staging/0113/measurement/`: `final-findings.txt`, `functional-final-v1/summary.json`, the `comparison-final-v1/` paired summaries, and the unadopted `comparison-v1-findings.txt`. Publication, CI, manifest/ledger pins, full hosted verification and the archived release are recorded under `data/staging/0113-publication/` and `data/staging/0113/publication/`. These operational files are outside the served bundle and Git.

See the [static loading design](static-page-loading-0108.md) and [hosting procedure](cloudflare-hosting.md). Rolling plan r057 queues #0115 for the next turn. #0114 is now Backlog/P5; both remain unstarted.

## Review follow-up: larger indicator

On 2026-11-01, Terry requested a more noticeable indicator. The spinner is now
64 × 64 CSS pixels with a 4-pixel border; the text is 24 pixels at weight 600,
stacked below it with a 20-pixel gap. The fixed overlay has 24-pixel padding and
centered text. Forced-pending previews at 1350 × 940 and 390 × 844 confirmed
legibility, no horizontal overflow and preserved reduced-motion behavior.

This size-only revision changes only the delivered HTML; all 3,113 other pristine
assets, including JavaScript, CSS, data and fonts, are byte-identical. The timing
measurements above describe the initial smaller indicator; no new latency claim
is made for the enlargement. Startup scheduling and the complete-view reveal
remain unchanged.

Source `bfbec3be151224bdffedaec2deeda29b5ca61e5e` passed both operating-system jobs
in CI run `41367562141` and was published as deployment
`28006713-1a0e-466b-987f-f76768879599`. All 3,226 served files and the navigation,
missing/private-path and redirect checks passed. The upload preserves all 3,220
previous immutable assets; its verified archive and rollback predecessor
`7838a3f5` are retained under ignored `data/staging/0113-size-publication/`.

## Review follow-up: sequential fade

Terry requested that the spinner disappear fully before the complete view enters.
The loader now fades out over 150 ms, followed by a 200 ms fade-in of the entire
prepared view. There is no intentional extra pause or overlapping fade. Reduced
motion removes both transitions. The view remains hidden and cannot receive
keyboard focus during the loader fade-out. Loader geometry stays fixed throughout.

This adds a nominal 350 ms presentation transition after data, DOM and fonts are
ready. The earlier load measurements describe the initial hard reveal, not this
transition. JavaScript scheduling and data loading are unchanged; all 3,113 other
pristine assets are byte-identical to the larger-indicator release.

A controlled CSS fixture checked the transition boundaries. A focused native
Chrome pass at desktop and narrow widths, plus reduced motion, verified no sampled
opacity overlap, all 11,130 cells already present, stable fonts and geometry, and
blocked focus during loader-out. The final desktop screenshot matches the prior
complete-view screenshot exactly. The instrumented capture skipped the earliest
low-opacity table frames: the first visible frames were around 54–59% opacity,
following a brief blank interval. This verifies whole-view sequencing, but does
not establish uniformly smooth visible 200 ms pacing. Independent visual review
found no demonstrated layout or partial-table defect requiring another change.

Source `069a245d819a627b93361b2c3ee0f94e9a75d4e4` passed both operating-system jobs
in CI run `41369946676` and is live as deployment
`c5d1535d-6d69-4e95-811f-c845b27ecc02`. The full hosted probe passed 3,226 assets,
four navigation cases, eighteen missing/private-path cases and nine redirects.
The retained upload preserves all 3,220 prior immutable assets. Its ZIP was read
back and all file hashes verified; predecessor `28006713` remains retained.

Private evidence is under `data/staging/0113/fade/` (fixture and full-table checks)
and `data/staging/0113-fade-publication/` (source CI, release pins, guarded deploy,
hosted proof and archived continuation). These remain outside Git and the served
bundle. Fresh visual and release reviews passed before handoff.
