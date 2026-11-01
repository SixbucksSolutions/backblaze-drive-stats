# Backblaze Drive Stats

Compare hard-drive failure rates and explore quarterly drive populations and
capacity using Backblaze's open Drive Stats data. This independent project is by
[Sixbucks Solutions](https://github.com/SixbucksSolutions).

**Made possible by Backblaze.** Thank you to Backblaze for collecting, maintaining
and openly publishing the [Drive Stats dataset](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Read their [official Drive Stats reports](https://www.backblaze.com/blog/category/hard-drive-stats/)
for Backblaze's own analysis and context.

## Open the explorer locally

The repository includes the aggregate data needed to view the site. No Python
setup, raw-data download, cache generation or database is required.

Use Node.js **26.13.0** (pinned in `web/.node-version`) and npm **12.2.1**
(recorded in `web/package.json`). From the repository root:

```powershell
cd web
npm ci
npm run dev
```

Open the localhost URL printed by Vite. The default view is the real-data AFR
matrix. The latest committed snapshot is **2026 Q2**; 2025 Q3 and Q4 as-of
snapshots are also available. The site is static and needs no backend.

## What you can explore

Use these query strings after the localhost URL, or follow the site's navigation.

| View | Open | What it shows |
| --- | --- | --- |
| AFR comparison | `?view=matrix` | Model histories aligned by relative quarter, with AFR, population, additions, retirements and failures side by side. |
| Deployments | `?view=deployments` | First recorded additions by model in the selected calendar quarter. |
| Drive mix | `?view=distribution` | Distinct drives observed by model during the quarter. |
| Capacity history | `?view=capacity` | Nominal raw capacity across calendar quarters. |
| Manufacturer shares | `?view=manufacturers` | Each manufacturer's share of the selected HDD population, first recorded additions and capacity. |
| Datacenters | `?view=datacenters` | Capacity and population assigned to each drive's last observed datacenter in the quarter, including Unknown. |

In the matrix, choose brands or models in the left selector and inspect a cell
for its exposure, coverage and source details. Relative quarters begin at the
model's first proven 2,000-drive threshold; they do not measure physical drive age.
Explore views use calendar quarters. Select an as-of snapshot separately from
the reporting quarter to see the history available at that cutoff.

## Read the numbers with their coverage

**Observed-history AFR** is recorded failures divided by recorded drive-days,
multiplied by 365 and expressed as a percentage. It uses the supplied history,
including observations before the model reaches the matrix threshold. It does
not establish lifetime reliability or predict an individual drive's failure.

First recorded additions can include the initial observed fleet and do not prove
installation dates. Counts include drives seen anywhere in the quarter, rather
than a quarter-end census. Capacity is nominal raw capacity in decimal TB/PB,
rather than utilized or customer storage. Model and manufacturer Explore reports
use the selected HDD context; capacity history and datacenters use all supplied
observations, including SSD and unclassified identities.

Partial, missing and unpublished source periods remain explicit. Unavailable
values are distinct from zero; source gaps are not filled in. Before 2023 Q3,
datacenter locations are unreported and remain Unknown. Check the coverage and
source panels before comparing periods or populations. These are observations
of Backblaze's supplied fleet, not market shares or purchase recommendations.

Workbook references and synthetic examples are separate at
`?view=matrix&reference=1`. The original workbooks have unknown source exposure
and calendar mappings; **832 AFR/AFR-delta differences remain unexplained** in the
conditional comparison. See the [workbook reconciliation limits](docs/production-workbook-reconciliation.md).

## Where to go next

- [Explorer guide](docs/flagship-ui.md) and [report documentation](docs/project-navigation.md#explorer-and-data-definitions): controls, measures and source contracts.
- [Quarterly refresh](docs/quarterly-refresh.md): the maintained offline workflow for preparing and verifying a new aggregate generation.
- [Development quality](docs/code-quality.md): locked toolchains, checks and contribution workflow.
- [Project navigation](docs/project-navigation.md): production evidence, history, storage and hosting records.
- [Legacy analysis](docs/legacy-analysis.md): the original Iceberg-to-XLSX command, S3 behavior and historical benchmarks.

The software and original project analysis are [MIT licensed](LICENSE).
Backblaze's data, name, branding and other third-party material retain their own
rights and usage terms. See [data sources and attribution](DATA_SOURCES.md) and
[third-party notices, including font licenses](COPYRIGHTS.md).
