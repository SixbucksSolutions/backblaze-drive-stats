# Backblaze Drive Stats

**Updated 2026-10-31**

Independent hard-drive reliability analysis and a static data explorer by
[Sixbucks Solutions](https://github.com/SixbucksSolutions).

**Made possible by Backblaze.** Thank you to Backblaze for collecting, maintaining,
and openly publishing the [Drive Stats dataset](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Their ongoing work makes these comparisons possible. Please visit their
[official Drive Stats reports](https://www.backblaze.com/blog/category/hard-drive-stats/)
for Backblaze's own analysis and context.

The site opens a real-data, vendor-grouped AFR comparison aligned by relative
quarter, preserving seven adjacent metrics and conditional colors. The latest
snapshot is 2026 Q2. All five Explore views use the paired calendar-quarter data:
deployments, distribution, total capacity, manufacturer shares and datacenter
capacity. Their scope and source-coverage limits stay explicit.
See the [flagship plan](docs/flagship-afr-plan.md) for scope and implementation gates.

The accepted [v2 contracts](docs/production-data-v2.md) define production data;
the original [matrix](docs/flagship-matrix-contract.md) and
[supporting-report](docs/supporting-report-contract.md) contracts remain v1
references. [Golden workbook fixtures](docs/flagship-workbook-fixtures.md)
preserve both owner-supplied references, separately from explicitly synthetic
production edge cases. The [production comparison](docs/flagship-ui.md) is the
landing view and is available at `?view=matrix`. Full workbook references and
clearly labeled synthetic examples remain at `?view=matrix&reference=1`, with
their original values. The [historical generator](docs/historical-generator.md)
prepares paired aggregate snapshots offline; its private caches support
[verified local/B2 transfer](docs/history-storage.md). Parquet uses an
[explicit enriched metadata profile](docs/parquet-profile.md) with statistics,
real sorting, page indexes/checksums and selective serial Bloom. Primary
integration retains its [separate execution gate](docs/history-verification-and-backfill.md).
The first backward quarter, 2026 Q1, now has a [verified pilot result and repeatable audit](docs/quarter-pilot.md).
The earlier [2025 Q4 audit](docs/quarter-2025-Q4.md), [durable Q1/Q2 B2 copy](docs/b2-cache-migration.md),
and additive [cohort/history evidence proposal](docs/cohort-history-evidence.md) record earlier verified work.
The [four-quarter benchmark and recovery](docs/parallel-quarter-benchmark.md) extends verified private history
through 2024 Q4 and records the next owner-approved eight-quarter scaling step.
The [eight-quarter batch](docs/eight-quarter-benchmark.md) extends retained observations through 2022 Q4,
records a verified one-day source gap, and measures eight simultaneous cold summaries.
The [next capped batch and lossless repack](docs/ten-item-backfill-and-repack.md) extend processing history
through 2020 Q3 and publish a verified preferred cache generation with the 2026 Q2 size anomaly removed.
The [ten-quarter origin search](docs/ten-quarter-origin-backfill.md) reaches 2018 Q1,
records two more source defects, separates ALN604's first observation from eligibility,
and measures the six-column daily Parquet at about 1.6% of original CSV size.
The [following ten-quarter epoch backfill](docs/ten-quarter-epoch-backfill.md) reaches
2015 Q3, adds safe annual-archive selection and records the three older Seagate
threshold starts, including explicit partial-data evidence.
The [source-history completion record](docs/source-history-completion.md) now reaches
2013-04-10 through 2026-06-30: 53 data-bearing datasets across 54 requested periods,
with 45 complete quarters, eight partials and one unpublished period. The corpus
holds 4,817 valid dates and 743,490,518 known observations. Thirteen problematic
captures within the published span and 99 calendar days before publication remain
explicitly unavailable. Unpublished 2013 Q1 has no dataset or warm-cache count.
Source computation, B2 retention/readback, isolated restore, preferred publication
and independent local-mirror acceptance passed. Terry accepted #0023 and the final
source cards. No further source cards are queued. Terry has accepted #0017's
integrated release; its RFR lane is held for his later move. #0063 is
owner-Completed research. The
[remaining delivery plan](docs/remaining-delivery-plan.md) tracks the flagship and
each Explore view separately. The [shared v2 contracts](docs/production-data-v2.md)
are owner-accepted under #0084. The offline producer and
[shared snapshot reader](docs/snapshot-reader.md) implement the next foundation;
real-artifact generation and individual report adoption retain their own gates.
The [real production v2 aggregate release](docs/production-release.md) now supplies
2026 Q2 and the 2025 Q3/Q4 workbook cutoffs, with explicit
[workbook reconciliation limits](docs/production-workbook-reconciliation.md).
The real matrix is now the default. Explore [deployments](docs/explore-deployments.md)
at `?view=deployments` and [drive distribution](docs/explore-distribution.md) at
`?view=distribution`; the shared model context remains at `?view=explore`.
Explore [capacity history](docs/explore-capacity.md) at `?view=capacity`,
[manufacturer shares](docs/explore-manufacturers.md) at `?view=manufacturers`, and
[datacenters](docs/explore-datacenters.md) at `?view=datacenters`. Capacity history
and datacenters use all supplied observations; model and manufacturer reports
use the separate selected-HDD context. The private rolling plan is r042.
The original quarterly reliability view remains at `?view=reliability`;
explicit `legacy=1` preserves the original report routes for comparison.

The maintained [quarterly refresh workflow](docs/quarterly-refresh.md) provides
offline plan/run/verify commands, pinned local source projection, retained-summary
reuse, explicit model-discovery gates and recoverable immutable publication.
An unchanged refresh reuses the approved generation without public payload/index
writes. Private B2 retention and site deployment remain separate operations.

The [integrated localhost review packet](docs/integrated-release-validation.md)
records cross-view/source reconciliation, keyboard/responsive/contrast checks,
actual aggregate exports and the preserved workbook evidence limits. The maintained
`npm run check:integrated-release` gate is part of the production build.

The software and original project analysis are [MIT licensed](LICENSE). Backblaze's
source data, name, branding and other third-party material retain their own rights
and usage terms. This is an independent project. See [data sources and attribution](DATA_SOURCES.md).

## Development quality

Python uses **uv + Ruff + Pyright**. The frontend uses **strict TypeScript 7,
type-aware Oxlint and Prettier**. GitHub Actions checks both platforms, tests,
production data/font integrity and real Python/TypeScript language-service queries.
See the [quality policy and commands](docs/code-quality.md) for the selected rules,
coverage, justified exceptions and update process. [AGENTS.md](AGENTS.md) documents
the same workflow for coding agents; `.venv` is managed by uv.

## Quarterly website

The `web/` directory contains a TypeScript 7 static explorer for all six quarterly
report views. It fetches `data/index.json`, then one aggregate JSON file for the
selected quarter. Python runs only when preparing data; the website needs no backend.

Use Node.js 26.13.0 LTS and npm 12.2.1 for the frontend. The `web/.node-version`
file pins the tested Node version, and `web/package.json` records the runtime
requirements and package-manager version. After installing Node, update its bundled
npm with `npm install --global npm@12.2.1` (use an administrator terminal when Node
is installed under Windows Program Files). Start the localhost site:

```powershell
cd web
npm ci
npm run dev
```

Open the printed localhost URL. Run `npm test` for the data-contract checks and
`npm run build` for type checking and a production build in `web/dist/`.

Use the [ZIP importer](docs/zip-import.md) to prepare the public daily CSVs without
extracting them to disk, then the [quarterly exporter](docs/web-data.md) to generate
the website data. Raw ZIPs, CSVs, Parquet caches, and `data/` are ignored by Git.
Only aggregate JSON under `web/public/data/` is published; it contains no drive
serial numbers. Illustrative test fixtures live separately in `web/test/fixtures/`.

The initial 2026 Q2 release uses `drives_of_interest_regexes.json`, preserving the
selected HDD population. That list is a positive seed from 2025 Q4; the planned
historical generator must also discover additional HDD models/vendors crossing
2,000 drives, without requiring a regex change. The current explorer retains its
existing fixed-filter behavior until that generator is implemented.
The existing SMART-name normalization rules are shared
through `drive_model_names.py`; the original analysis helper and AFR workbook keep
their existing entry points. See [validation evidence](docs/web-validation.md).

History-based measures use the supplied data window. A single quarter can show
quarterly AFR and capacity, but cannot establish lifetime AFR or true deployments
before that quarter. The interface displays the available coverage explicitly.

The [static Cloudflare Pages package](docs/cloudflare-hosting.md) uses `web/dist`
with no Worker scripts or Functions. `npm run build` verifies its inventory and
immutable public data; `npm run preview:hosting` and `npm run check:hosting:serve`
check the local Pages runtime. Account/project/hostname details remain pending;
local preparation does not publish a site.

The [asset minimization record](docs/asset-minimization.md) documents the compact
HTML/JSON pipeline, pinned JavaScript/CSS minifiers and exact immutable-data
preservation. The reviewed static directory is 179,204 bytes smaller; source
fixtures and font/license bytes remain unchanged.

## Python generator environment

The tested generator uses Python 3.15.2, Polars 2.1.0 and uv 0.13.6. From the
repository root:

```powershell
uv python install 3.15.2
uv sync --frozen
uv run --frozen python -m unittest discover -s tests
```

Use `uv run --frozen` for the generator and original reports. See the
[Python toolchain](docs/python-toolchain.md) for native build prerequisites,
dependency constraints and lockfile refresh instructions. The flagship relative
quarter comparison is specified in the [AFR plan](docs/flagship-afr-plan.md).

## Creating Quarterly AFR XLSX

### System Requirements

1. sudo access (to install a C compiler and a system-wide version of uv)
1. 64+ GB of memory (process will be killed by the OS due to memory exhaustion with less)
1. Network access
1. Permission to write to S3 destination (optional)

The scripts have been tested on both x86-64 amd ARM64 architectures. 

### Backblaze B2 Bucket Credentials

To get the access key/secret access key for read-only access to the B2 bucket, visit 
the [Backblaze source data site](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
and search for the string "**Application Key**." 

Both values are public because they only provide read-only access, but GitHub doesn't love seeing access keys committed to
repositories, so it's left as an exercise for the reader.

### Installation Steps

```bash
$ sudo apt-get update
$ sudo apt-get -y install build-essential
$ curl -LsSf https://astral.sh/uv/install.sh | sh
$ uv python install 3.15.2
$ uv sync --frozen
```

### Running The Script

```
$ uv run --frozen quarterly_afr_xlsx_from_iceberg.py 	        \
    drives_of_interest_regexes.json     		        \
    [s3_access_key]                     		        \
    [s3_secret_access_key]              		        \
    s3://bucket_name/bucket_path/quarterly_afr.xlsx

Opening Polars datasource...
        Current Backblaze Drive Stats Iceberg schema file: 00248-af7b2e6d-6381-4dcd-a949-a6f8f74ad51e.metadata.json
                Schema URI: s3://drivestats-iceberg/drivestats/metadata/00248-af7b2e6d-6381-4dcd-a949-a6f8f74ad51e.metadata.json

ETL pipeline stage 1 of 5: Retrieve candidate SMART drive model names...
        Retrieved 3 regexes for SMART drive model names from "drives_of_interest_regexes.json"
        Retrieving unique candidate SMART drive model names from Polars...
                Retrieved 38 candidate SMART drive model names in 10.9 seconds

ETL pipeline stage 2 of 5: Create mapping table for SMART model name -> normalized model name...
        38 SMART drive model names -> 34 normalized drive model names

ETL pipeline stage 3 of 5: Perform AFR calculations...
        Operation time: 16.8 seconds

ETL pipeline stage 4 of 5: Enrich viz data with quarterly drive deploys/removals...
        Data enriched with quarterly drive deploys/removals in 7.0 seconds

ETL pipeline stage 5 of 5: Generating XLSX for visualizing Backblaze drive stats quarterly data...
        Created output XLSX: s3://bucket_name/bucket_path/quarterly_afr_2025q3.xlsx

ETL pipeline total processing time: 36.2 seconds
```

## Runtime Data
 
This section demonstrates the effects of various amounts of CPU, RAM, and network
bandwidth resources when running this script.

I _happened_ to test on AWS EC2 instances as it was convenient for me.

Tests were performed in AWS's `us-west-1` region due to it being the lowest latency 
region to the Backblaze B2 bucket where the Iceberg table is stored.

* **8 vCPU Graviton4 ARM64 Instances**
  * **r8g.2xlarge** (8 C / 8 T CPU, 64 GB memory): 161 seconds
* **16 vCPU Instances**
  * **m8g.4xlarge** (16 C / 16 T CPU, 64 GB memory, up to 15 Gbps network): 120 seconds
  * **r8g.4xlarge** (16 C / 16 T CPU, 128 GB memory, up to 15 Gbps network): 111 seconds
* **32 vCPU Instances**
  * **c8g.8xlarge** (32 C / 32 T CPU, 64 GB memory, 15 Gbps network): 91 seconds
  * **c8gn.8xlarge** (32 C / 32 T CPU, 64 GB memory, 100 Gbps network): 67 seconds
  * **m8g.8xlarge** (32 C / 32 T CPU, 128 GB memory, 15 Gbps network): 77 seconds
  * **r8g.8xlarge** (32 C / 32 T CPU, 256 GB memory, 15 Gbps network): 74 seconds
* **48 vCPU Instances**
  * **c8g.12xlarge** (48 C / 48 T CPU, 96 GB memory, 22.5 Gbps network): 64 seconds
  * **c8gn.12xlarge** (48 C / 48 T CPU, 96 GB memory, 150 Gbps network): 60 seconds
  * **m8g.12xlarge** (48 C / 48 T CPU, 192 GB memory, 22.5 Gbps network): 61 seconds
  * **r8g.12xlarge** (48 C / 48 T CPU, 384 GB memory, 22.5 Gbps network): 59 seconds
* **64 vCPU Instances***
  * **c8g.16xlarge** (64 C / 64 T CPU, 128 GB memory, 30 Gbps network): 54 seconds
  * **c8gn.16xlarge** (64 C / 64 T CPU, 128 GB memory, 200 Gbps network): 53 seconds
  * **m8g.16xlarge** (64 C / 64 T CPU, 256 GB memory, 30 Gbps network): 54 seconds
  * **r8g.16xlarge** (64 C / 64 T CPU, 512 GB memory, 30 Gbps network): 54 seconds
* **96 vCPU Instances**
  * **c8g.24xlarge** (96 C / 96 T CPU, 192 GB memory, 40 Gbps network): 50 seconds
  * **c8gn.24xlarge** (96 C / 96 T CPU. 192 GB memory, 300 Gbps network): 49 seconds
  * **m8g.24xlarge** (96 C / 96 T CPU, 384 GB memory, 40 Gbps network): 50 seconds
  * **r8g.24xlarge** (96 C / 96 T CPU, 768 GB memory, 40 Gbps network): 50 seconds
