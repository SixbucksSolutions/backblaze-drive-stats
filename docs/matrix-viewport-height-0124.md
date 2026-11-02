# Responsive matrix height

The matrix now grows with browser height instead of stopping at a fixed 520–600 pixels. The selector shares the desktop height allowance; narrow layouts retain their stacked, compact selector.

The CSS uses `max(320px, calc(100dvh - 20rem))` as a **maximum**, so shorter datasets and empty selections keep their natural height. Row text and row geometry are unchanged. Short windows use a smaller scrollport so controls remain reachable; normal page scrolling still reaches the inspector and legend.

Measured with the same actual 2026 Q2 dataset and the workspace aligned to the browser top:

| Browser viewport | Old full rows | New full rows |
| --- | ---: | ---: |
| 1920 × 900 | 14 | 15 |
| 1920 × 1300 | 14 | 27 |
| 1920 × 2000 | 14 | 48 |
| 1280 × 600 | 11 | 6 |

At 390 × 844, matrix capacity grows from 10 to 13 rows; seven full rows are visible while the selector is stacked above it. Scrolling the page reveals the remaining matrix area. Initial desktop page loads show 12, 24 and 45 full rows at the three listed desktop heights before scrolling to the workspace.

Verification:

- Strict TypeScript, typed lint, Prettier, all 246 tests and full build passed. Both hosted CI jobs passed for `b84297bf998657723aa51d62a482e2fcef488f76`: [run 41492871126](https://github.com/SixbucksSolutions/backblaze-drive-stats/actions/runs/41492871126).
- Fresh independent browser review passed 38 checks: height changes, tall→short→tall resize, sticky headers, frozen columns, both synchronized rails and their endpoints, selector overflow, empty/short datasets, and reachable controls/inspector. Screenshots inspected at tall, short and narrow sizes.
- A baseline-only harness correction reran six checks at 1280 × 600. The original short comparison had incorrectly injected a 600px cap rather than its actual 520px cap. The corrected scrollport capacity is 12→6 rows, while browser-visible full rows are 11→6 as shown above; no application change was required.
- All 3,097 JSON files match the predecessor byte-for-byte. Data, metrics, fonts, export precision, navigation and loading transitions remain unchanged; implementation changes only two CSS files.
- Hosted verification passed all 4,794 served assets, four navigation routes, 18 missing/private-path checks and nine redirects. The retained union archive was read back and every file matched its manifest hash.
- Public browser smoke passed 30 checks. Owned browser cleanup is recorded in private verification evidence.

Production: [DriveStats](https://backblaze-drive-stats-analysis.pages.dev/), deployment `8c9487c8-1e18-4780-9bf9-545d64c1d316`. Static Pages only; no Functions/Worker, new dependencies or data refresh. Previous deployment `3065acc3-1ee7-49b3-88b8-862b3edbab09` remains recorded for rollback.

Private evidence: `data/staging/0124/verification/`, `data/staging/0124/review/`, and `data/staging/0124-publication/current-static-release.json`.
