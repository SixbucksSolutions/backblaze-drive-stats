# Static quarterly data

`export_quarterly_web_data.py` is an offline publishing step. The web client fetches `index.json`, then the selected quarter's JSON; no Python process or database serves requests. The same directory can be hosted locally or uploaded to a CDN. Browser URLs are relative to the manifest's directory.

Use the project's Python environment and existing dependencies (Polars; Iceberg additionally needs the existing S3/Iceberg dependencies):

```powershell
uv run --frozen python export_quarterly_web_data.py --input-parquet 'data/*.parquet' --through-quarter 2026-Q2 --output-dir web/public/data
```

Omit `--input-parquet` to use the public Backblaze Iceberg table through the repository's metadata discovery helper. Set `B2_ACCESS_KEY_ID` and `B2_SECRET_ACCESS_KEY` in the environment, using the published read-only credentials or your authorized read-only credentials. Credentials are never JSON fields or command arguments. Endpoint, region, bucket and table flags retain the repository's defaults. This can scan a very large source: run deliberately as an offline job, not at web startup. No full public source scan is part of the synthetic test suite.

The exporter uses six source queries independent of the number of emitted quarters: required-field validation, model discovery, duplicate validation, date coverage, quarterly capacity frequencies, and drive-quarter summaries. Each bundle then uses only the retained summaries, with capacity frequency counts accumulated only through that bundle's end. Daily rows are not collected into Python. Retained memory scales with unique drive-quarter records, distinct model/capacity/quarter combinations, coverage dates and generated aggregate bundles; this is smaller than the daily source but can still be substantial for full history. Grouping/validation also require working memory. This is not an out-of-core or guaranteed fixed-memory exporter.

`--through-quarter YYYY-QN` is required. `--from-quarter YYYY-QN` limits emitted bundles while retaining earlier input for cumulative metrics. By default, export starts at the first complete quarter. The cutoff must be a completed calendar quarter, fully covered by observed dates; missing days or a partial requested quarter fail before publication. Supply all available prior history: a single-quarter input cannot establish lifetime deployments or lifetime AFR.

The publication cutoff is applied after date parsing and before other source-field casts, validation and aggregation. Invalid fields or duplicate observations after that cutoff do not block historical publication. Malformed dates remain errors because they cannot reliably be classified relative to the cutoff.

Optional `--drive-patterns-json` takes the existing format of a JSON list of model regexes. The identical filtered population feeds every metric. Without it, all models are included, with unrecognized manufacturers shown as `Unknown`. Optional `--kind sample` labels synthetic test data explicitly; never label fabricated figures as Backblaze measurements.

Every export records whether model-selection filters were applied, including the actual regex list when supplied. An unfiltered export includes all supplied models, including boot drives if present; neither mode claims to reproduce the eligible-drive population in a Backblaze quarterly article. When the supplied history starts in an emitted reporting quarter, that bundle explicitly warns that `newDrives` includes the initial observed fleet rather than only confirmed deployments.

## JSON contract, version 1

Manifest: `schemaVersion: 1`, `quarters: [{quarter, label, url, kind}]`. Entries are newest first; `url` is a filename such as `2026-Q2.json`; `kind` is `backblaze` or `sample`.

Each bundle contains:

- `schemaVersion`, `quarter`, `period: {start, end}` (inclusive ISO calendar dates).
- `provenance: {kind, sourceUrl, generatedAt, coverageStart, coverageEnd, notes, metadataUri?}`. Dates reflect the actual supplied history through this quarter; `generatedAt` is UTC. Iceberg exports record the selected metadata URI, never credentials. The source URL identifies the Backblaze data program; it is not a claim that synthetic data is published Backblaze data.
- `models: [{id, manufacturer, model, capacityTb, driveCount, driveDays, failures, quarterlyAfr, cumulativeAfr, newDrives, lastObservedDrives}]`.
- `capacityByDatacenter: [{datacenter, capacityTb, driveCount}]`.
- `history: [{quarter, driveCount, driveDays, failures, quarterlyAfr, capacityTb, newDrives}]`, oldest first through this quarter.

All metric values are finite numbers; counts are integers. No field is null. Unknown model capacity fails export rather than silently dropping those drives. Model IDs are stable opaque hashes of normalized manufacturer/model, not drive identifiers. No serial numbers or daily observations are published.

## Metric interpretation

- A drive is identified by normalized model plus serial number. Aliases such as `ST...` and `Seagate ST...` coalesce. Duplicate drive/date observations, invalid dates, missing identifiers and nonbinary failure flags fail validation.
- `driveCount` counts unique drives observed at any point in the quarter, including failures. `driveDays` counts observed daily records, not elapsed days between observations. All aggregate populations reconcile.
- Capacity uses decimal TB (`10^12` bytes). Each normalized model uses its most frequent positive finite byte capacity observed through the bundle's end; ties choose the smaller value. This repairs missing or invalid SMART capacities consistently. Model `capacityTb` is per-drive nominal capacity; datacenter/history `capacityTb` is the sum across unique quarterly drives. Capacity is observed-quarter capacity, not an endpoint fleet snapshot. A moving drive is assigned once, to its latest observed datacenter in that quarter; missing datacenters become `Unknown`.
- Both AFR fields are annualized percentages: `failures / driveDays * 365 * 100`. Quarterly AFR uses that quarter's observations; cumulative AFR uses all supplied history for that model through this quarter. Partial leading quarters remain visible in history and cumulative calculations.
- `newDrives` means first observed in supplied history, not confirmed installation. Drives already present at `coverageStart` are counted there. `lastObservedDrives` means the last observation falls within this quarter and before its `coverageEnd`; this is provisional inferred disappearance, includes failures, and is not confirmed retirement. Drives observed on the final covered date are not inferred gone. Bundles never use later observations for capacity, first/last observations or AFR.
- Calendar coverage establishes that some filtered observations exist on each day, not that every source drive or datacenter was reported. Historical records and inferred departures can change when source history is corrected.

## Publication and verification

All bundles are validated and built before writing. Individual JSON files are replaced atomically; the manifest is replaced last. Each run's manifest lists only that run's requested quarters and kind (it replaces any previous manifest, including sample entries). Old unreferenced files are not deleted. Readers with a cached old manifest can still fetch its files. For a CDN, upload bundles before the manifest and configure appropriate cache refreshes; file replacement is not a multi-file transaction.

Run the tiny synthetic suite without network dataset access:

```powershell
uv run --frozen python -m unittest discover -s tests -p test_export_quarterly_web_data.py
```

It covers alias normalization, repaired capacity, changing datacenters, missing datacenters, drive-days/failure AFR, cumulative history, cutoff isolation (including invalid future fields/duplicates), bounded source passes across multiple quarters, privacy, manifest output and invalid/incomplete inputs.
