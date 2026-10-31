# Backblaze Drive Stats

**Updated 2026-10-31**

Independent hard-drive reliability analysis and a static data explorer by
[Sixbucks Solutions](https://github.com/SixbucksSolutions).

**Made possible by Backblaze.** Thank you to Backblaze for collecting, maintaining,
and openly publishing the [Drive Stats dataset](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Their ongoing work makes these comparisons possible. Please visit their
[official Drive Stats reports](https://www.backblaze.com/blog/category/hard-drive-stats/)
for Backblaze's own analysis and context.

The current site provides calendar-quarter exploration using real 2026 Q2 data.
The planned flagship is a vendor-grouped comparison aligned by relative quarter,
preserving the AFR workbook's seven adjacent metrics and conditional colors.
See the [flagship plan](docs/flagship-afr-plan.md) for scope and implementation gates.

The approved [matrix contract](docs/flagship-matrix-contract.md) and
[supporting-report contract](docs/supporting-report-contract.md) define the next
data products. [Golden workbook fixtures](docs/flagship-workbook-fixtures.md)
preserve both owner-supplied references, separately from explicitly synthetic
production edge cases. A [fixture comparison preview](docs/flagship-ui.md) is
available at `?view=matrix`, with full workbook references and clearly labeled
synthetic edge cases. The [historical generator](docs/historical-generator.md)
prepares paired aggregate snapshots offline; its private caches support
[verified local/B2 transfer](docs/history-storage.md). Parquet uses an
[explicit enriched metadata profile](docs/parquet-profile.md) with statistics,
real sorting, page indexes/checksums and selective serial Bloom. Full history and
primary integration retain their [separate execution gate](docs/history-verification-and-backfill.md).
The first backward quarter, 2026 Q1, now has a [verified pilot result and repeatable audit](docs/quarter-pilot.md).
The next [2025 Q4 audit](docs/quarter-2025-Q4.md), [durable Q1/Q2 B2 copy](docs/b2-cache-migration.md),
and additive [cohort/history evidence proposal](docs/cohort-history-evidence.md) document current work.
The current explorer remains the default.

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

For eventual Cloudflare Pages hosting, use `web` as the root directory,
`npm run build` as the build command, and `dist` as the output directory. The
included `_headers` keeps the quarter index fresh and caches hashed application
assets. Deploying is a separate step; local development does not publish a site.

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
