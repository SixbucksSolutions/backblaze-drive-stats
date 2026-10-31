# Initial website validation — 2026 Q2

The initial site contains real Backblaze observations for 2026 Q2, filtered with
the repository's `drives_of_interest_regexes.json`. The index advertises only this
quarter; additional exported quarters automatically become selectable.

## Source and reproducibility

- Source archive: [Backblaze 2026 Q2 ZIP](https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2026.zip).
- Local archive: `data/raw/data_2026_Q2.zip` (ignored by Git).
- SHA-256: `b30be47290580c1aee9a5155afadc97c26e36220722bc5ee689108e949c74acc`.
- Import: 91 daily CSV members, 31,968,003 observations, April 1–June 30 inclusive.
- Projected cache: `data/processed/2026-Q2/*.parquet`; about 222 MB, ignored by Git.
- Published artifacts: `web/public/data/index.json` and `2026-Q2.json`; approximately 12 KB for the selected quarter.

Prepare the cache using [the ZIP importer](zip-import.md), then run:

```powershell
uv run --no-project --with polars==1.41.2 python export_quarterly_web_data.py --input-parquet 'data/processed/2026-Q2/*.parquet' --drive-patterns-json drives_of_interest_regexes.json --through-quarter 2026-Q2 --from-quarter 2026-Q2 --output-dir web/public/data
```

## Reconciliation

Independent projected queries against the local cache verified every model metric,
the complete daily date coverage, per-day receipt counts, observation uniqueness,
normalization identities, and all six datacenter aggregates. They did not import
the exporter's calculation functions.

| Selected population | Result |
| --- | ---: |
| Raw selected SMART names | 39 |
| Normalized models | 38 |
| Distinct model/serial identities | 333,560 |
| Observed drive-days | 29,735,545 |
| Failure flags | 1,346 |
| Quarterly annualized failure rate | 1.6522% |

Manufacturer/datacenter/history totals reconcile to the model population. Capacity
checks allow floating-point summation rounding; regeneration with the canonical
normalizer retained the verified results within a relative tolerance of `1e-12`.
All 39 selected SMART names preserve their legacy normalized identities. The
shared normalizer's function body was independently compared with the legacy AST.

## Interpretation limits

- Only 2026 Q2 history is loaded. Cumulative AFR therefore covers this window;
  first-observed counts include the initial fleet and do not establish physical
  installations. Last-observed counts are provisional disappearance inferences.
- Population and capacity count drives observed anywhere in the quarter, rather
  than quarter-end installed capacity. Each drive contributes to its last observed
  datacenter within that quarter.
- The personal HDD filter differs from Backblaze's published report eligibility.
  Some raw per-model failure counts also differ from the published article despite
  matching drive-days. For example, raw observations contain 57 failures for
  `ST16000NM001G`, while the article lists 56. Repeated failure flags do not explain
  the difference: raw failure rows and distinct failed identities agree. The cause
  remains unestablished; the site follows the downloaded raw observations. See the
  [Backblaze 2026 Q2 report](https://www.backblaze.com/blog/backblaze-drive-stats-for-q2-2026/).
- Full-history resource use and remote Iceberg execution were not measured. The
  ZIP-only pipeline was executed locally on the complete selected quarter.

## Verification

- 21 Python tests: importer validation, exporter calculations/cutoffs/publication,
  bounded source passes, and legacy normalization preservation (Polars 1.41.2).
- Five frontend tests: schema, selection mismatch, population/capacity totals,
  weighted AFR, and safe CSV quoting.
- TypeScript 7.0.2 check, aggregate-data validation, and Vite production build.
- Browser checks: all six views, real-data filtering, cumulative toggle, empty
  results, sorting, focus retention, CSV download, and desktop/mobile layouts.
- Multiple-quarter switching was checked using explicitly marked development
  fixtures before the site was populated with the single real quarter.
- Fresh independent reviews of the exporter, importer, frontend, model-name
  refactor, and real-data reconciliation. Review findings were corrected and
  re-reviewed before handoff.
