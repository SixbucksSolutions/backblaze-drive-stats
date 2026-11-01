# Integrated localhost release review

This is the #0094 review packet for the real flagship matrix and all five Explore
views. The source history, contracts, real JSON and refresh workflow are already
owner-accepted. This validation does not deploy a website or approve the parent
release on Terry's behalf.

**Local review:** <http://127.0.0.1:5179/>. The preview binds to loopback only. Its
private runtime/evidence record is under `data/staging/0094/`. If the local preview
needs restarting, use the commands at the end of this document.

## Review the six views

| View | URL suffix | Scope and useful check |
| --- | --- | --- |
| Flagship AFR | `/` or `?view=matrix` | 22 analysis models at 2026 Q2; earliest proven threshold anchors; seven adjacent metrics |
| Deployments | `?view=deployments` | Whole selected-HDD supporting context; 12,261 first recorded additions at 2026 Q2 |
| Drive mix | `?view=distribution` | 353,575 selected-HDD observed identities, including smaller/context-only models |
| Total capacity | `?view=capacity` | All supplied observations; 54 calendar positions and gaps, not 54 measured datasets |
| Manufacturer shares | `?view=manufacturers` | Filtered numerators, separate unfiltered HDD Count/New/capacity denominators |
| Datacenters | `?view=datacenters` | All supplied identities, including Unknown; field unavailable before 2023 Q3 |

The immutable release advertises three as-of snapshots: 2025 Q3, 2025 Q4 and
2026 Q2. Their matrix analysis cohorts contain 21, 21 and 22 models; supporting
HDD contexts contain 36, 37 and 40. The older cutoffs do not borrow later
observations, capacities or WUH722626ALE6L4's 2026 Q1 threshold proof.

The entire public graph has **161 files / 14,845,031 bytes**: three descriptors,
three matrices, 154 supporting-quarter payloads and one index. Descriptor-only
unpublished 2013 Q1 appears in each snapshot. The 24 partial payloads are the
same eight partial source quarters represented at three cutoffs, not 24 separate
source defects. All hashes, lengths, source identities and context bindings stay
unchanged by this validation.

## Independent numerical and integration checks

A fresh Sol / High audit independently derived **268,107 comparisons** from
pinned small identity-quarter/capacity summaries. It covered 27,066 inventory
model-quarter entries, 1,141 eligible matrix cells, all three cutoff-specific
last-observed retirement inferences, recorded exposure/failures, pre-anchor
components, deltas, threshold proofs, nominal capacity modes and scope/location
rollups. No daily partitions were read or regenerated. Integer comparisons are
exact; decimal TB and fractional shares use absolute/relative tolerance `1e-11`.

The maintained `check-integrated-release.mjs` gate independently reconciles the
report helpers, matrices and supporting payloads across all three graphs. It
checks binding tuples, selected-HDD versus all-supplied membership, vendor/model
filters, whole-context share denominators, unavailable values, capacity
adjacency, full chronological exports and source attribution. It rejects duplicate
CSV headings and uses exact comparisons for integer measures. Maintained tests
and independent negative probes together
include mixed generations, missing/altered scopes, tiny integer drift,
trillion-scale off-by-one errors, unavailable-to-zero substitutions and CSV
metadata/formula problems.

Independent numeric CSV roundtrips covered **927 exports / 12,863 rows / 36,283
numeric cells** against the accepted public aggregates, which were separately
reconciled to retained source summaries. Structural/public-value checks forbid
serial fields and recognizable credential/private paths; 30 actual retained
serial tokens were also checked for absence from the public graph and prose.
That token sample is a bounded check, not a claim to recognize every possible
undisclosed identity embedded in arbitrary text.

## Browser, keyboard and responsive checks

The primary validated the built production preview in Chrome at desktop size and
at **390 × 844 CSS pixels**. The selected custom Inter/JetBrains Mono fonts loaded
and remained stable through report changes. Explicit report navigation, including
the corrected Explore-to-matrix return link, retained the chosen 2025 Q4
generation; the older Explore
calendar never advertised a 2026 quarter. Supporting views had the expected 37
model rows, 52 capacity calendar rows, three manufacturer groups and seven
location rows for that cutoff.

- Matrix brand selection exposed a native indeterminate state after one child
  was cleared. Brand selection included children hidden by sidebar search.
  Home/End/arrow navigation moved through cells and opened the matching evidence.
  A partial-source cell remained unavailable, with no inferred threshold exit.
- Rapid as-of, quarter and report changes settled on the final choice. A capacity
  load was visibly pending when switched to datacenters; no stale capacity view
  or previous-generation rows appeared. Invalid matrix snapshot IDs showed an
  alert without a fabricated fallback; Retry latest restored the valid matrix.
- At 390 pixels the document stayed within its viewport. Wide numeric tables,
  the full matrix and the capacity graph scrolled within their own regions.
  The capacity chart has an explicit keyboard-focusable horizontal region; its
  axis text is not reduced to unreadable mobile-size glyphs.
- Chart numeric labels, native meter names and full table equivalents remained
  available. This includes Unknown locations and partial/unpublished states.
  Browser semantic checks and source review were performed; a separate native
  screen-reader application was not run, and no accessibility certification is
  claimed.

The review also caught an Explore-to-matrix link that reset historical as-of
selection to latest. It now carries a validated real snapshot ID; fictional
example IDs are dropped when returning to production. URL regression and browser
roundtrip checks cover both paths.

The review found and corrected two Explore contrast values: inactive navigation
text and global control focus outlines. Current navigation contrast is at least
**5.21:1** on the tested white/page/hover backgrounds; the corrected Explore control outline is at
least **5.22:1**. Snapshot/calendar boundaries measure **3.70:1** on white.
Regressions enforce normal-text `4.5:1` and meaningful control/focus `3:1`
thresholds without rounding a failing value upward. Existing matrix data-color
and category-color contrast checks remain unchanged.

## Owner reading cases and reference separation

The eight preserved owner comparison buttons were exercised at
`?view=matrix&reference=1`: warning, promising, mature-good, early-spike,
historically unavailable favorable comparison, early deterioration, rollout
plateau and sustained rollout. Each selected its intended exact model(s), and
the reference notice remained visible. The early-spike reference still shows
MG08ACA16TA's **3.570%** cumulative AFR alongside **zero** current-quarter Failed;
neither is presented as proof of zero earlier exposure or failures.

Production labels distinguish recorded history, relative model deployment
history, actual calendar quarter and unavailable/partial evidence. No automatic
purchase score, current retail/manufacturing claim, procurement motive or
individual-drive survival forecast is introduced.

The previously accepted workbook limitation remains: 307 Q3 and 325 Q4 rows have
conditional Count/chronology mappings, with no unexplained integer differences
under those inferences. **402 Q3 and 430 Q4 AFR/rate-delta cells remain numerically
unexplained.** The fresh review reproduced those counts against committed
artifacts. Missing workbook source/exposure metadata prevents an equivalence
claim; the reference values remain unchanged. See
[workbook reconciliation](production-workbook-reconciliation.md).

## Actual optional downloads

Two browser-generated blob downloads were parsed from disk: a 54-row capacity
history export while unpublished 2013 Q1 was selected, and a one-row filtered
Toshiba manufacturer export. Their source/generation, scope, per-row calendar and
availability values, counts, capacities and shares matched the accepted graph.
Toshiba's filtered shares retained whole-context denominators rather than
becoming 100%: 35.39% population, 63.67% additions and 36.63% capacity.

The download-event automation hook timed out, but the file itself was produced
normally. The disk files provided direct evidence. The first history export also
exposed a duplicate Coverage heading; its base heading is now **Quarter coverage**,
distinct from shared metadata **Coverage**, with a negative gate regression.
Temporary downloads created by this validation were cleaned after exact evidence
copies were verified; older user downloads were untouched. No CSV was added to
the processing pipeline or used to regenerate data.

## Observed sizes and limits

The largest public JSON object is **3,770,556 bytes**; total public JSON is 14.85 MB.
Measured report-renderer HTML fragments range up to 21,156 bytes, and matrix
presentation JSON reaches 1,338,731 bytes. These are measured fragments/adapters,
not full-page transfer sizes. The live latest matrix had **6,314 cell buttons /
16,499 DOM elements**, and serialized HTML length of 4,551,708 UTF-16 code units.
That last measurement is not a UTF-8 payload byte count or a latency benchmark.

The full matrix deliberately keeps all accepted models and relative history;
its narrow viewport contained a 12,180-pixel table in a 331-pixel scroll window.
No arbitrary speed threshold or general device/network performance guarantee is
invented. These observations are evidence for owner review. Asset minimization
remains #0097's later scope; no minification or image changes were performed here.

## Reproduce and restart the local review

Use all Python/frontend gates in [code quality](code-quality.md). The integrated
gate is part of the production build:

```console
uv sync --frozen --extra postgres
uv run --frozen --no-sync ruff check .
uv run --frozen --no-sync ruff format --check .
uv run --frozen --no-sync pyright --warnings
uv run --frozen --no-sync python -m unittest discover -s tests
cd web
npm ci
npm run quality
npm test
npm run check:integrated-release
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5179 --strictPort
```

The final hosted Windows/Linux workflow and commit are linked from #0094's
handoff comment. Private source-audit, CSV, browser and size evidence is under
`data/staging/0094/`; raw summaries, runtime files and downloaded exports are not
committed. Parent #0017 still requires Terry's acceptance of this validation.
Hosting #0007 remains separately gated, with no deployment implied.
