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

Ten focused startup tests and all 222 web tests passed, as did types, lint, formatting, and build checks. Both operating-system CI jobs succeeded in run `41359054014`. Production deployment `7838a3f5-3bfc-405f-b0df-81bc9f359200` succeeded from source `0b803eba2b7d0a674aad580745a837503bbf814f`; the deploy guard completed in 19.57 seconds.

The qualified final distribution contains 3,114 files / 289,058,590 bytes, with manifest SHA-256 `a93343a2fefa6d811b366f124d06a0965e2fab303585c7213936ed65fce3d717`. The release union contains 3,227 files / 302,873,823 bytes, retains 113 predecessor files, and preserves all 3,217 prior immutable files compatibly. Rollback publication `f290ba5d`, source `d402829`, is retained. The public full-union probe passed all 3,226 served files (302,872,657 decoded bytes), four navigation cases, eighteen missing/private-path cases and nine redirects. The retained release ZIP was read back and every file matched its expected SHA-256.

Private evidence remains under ignored `data/staging/0113/measurement/`: `final-findings.txt`, `functional-final-v1/summary.json`, the `comparison-final-v1/` paired summaries, and the unadopted `comparison-v1-findings.txt`. Publication, CI, manifest/ledger pins, full hosted verification and the archived release are recorded under `data/staging/0113-publication/` and `data/staging/0113/publication/`. These operational files are outside the served bundle and Git.

See the [static loading design](static-page-loading-0108.md) and [hosting procedure](cloudflare-hosting.md). Rolling plan r055 queues #0114 and #0115 for the next turn; both remain unstarted.
