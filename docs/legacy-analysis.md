# Legacy Iceberg-to-XLSX analysis

The original `quarterly_afr_xlsx_from_iceberg.py` reads Backblaze's Iceberg table
and creates a quarterly AFR workbook. It remains available for that original
workflow. It does not generate the current website's production v2 snapshots;
use the maintained [quarterly refresh workflow](quarterly-refresh.md) for those.
To view the website's committed aggregates, follow the [README](../README.md).

## Environment and source access

Use the committed `.python-version` and `uv.lock`. The project currently pins
Python 3.15.2 and uv 0.13.7-compatible tooling; see the
[Python toolchain](python-toolchain.md) for native build prerequisites and the
[quality policy](code-quality.md) for verification. From the repository root:

```console
uv python install 3.15.2
uv sync --frozen --extra postgres
uv run --frozen --no-sync python quarterly_afr_xlsx_from_iceberg.py --help
```

The original full-table runs required substantial memory (historically 64 GB or
more), network access and source-read credentials. That historical observation
is not a measured resource guarantee for today's table. x86-64 and ARM64 were
both used in the original tests. A native source build can require a C compiler;
follow the toolchain guide for your platform rather than assuming administrator
access is always required.

For the public read-only source credentials, visit
[Backblaze's source data page](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data)
and find **Application Key**. Obtain the current values there; no credential
values are stored in this document.

## Current legacy command interface

The four positional arguments are the model-pattern JSON, source access key,
source secret key and output XLSX path. The following Bash examples assume those
source credentials have been assigned to `B2_SOURCE_ACCESS_KEY` and
`B2_SOURCE_SECRET_KEY` in your local shell:

```bash
uv run --frozen --no-sync python quarterly_afr_xlsx_from_iceberg.py \
  drives_of_interest_regexes.json \
  "$B2_SOURCE_ACCESS_KEY" \
  "$B2_SOURCE_SECRET_KEY" \
  quarterly_afr.xlsx
```

This command reads remote source data and writes a workbook. The default
`--min-drives` is 2,000. The source defaults are:

| Option | Default |
| --- | --- |
| `--s3-endpoint` | `https://s3.us-west-004.backblazeb2.com` |
| `--b2-region` | `us-west-004` |
| `--bucket-name` | `drivestats-iceberg` |
| `--table-path` | `drivestats` |

The pipeline retrieves candidate SMART model names, normalizes them, calculates
quarterly/cumulative AFR, enriches quarterly additions/removals and generates
the XLSX. The original illustrative run recorded 38 SMART names normalized to
34 models and a 36.2-second total; those figures describe that run's inputs and
resources, not a current performance promise.

For S3 output, replace the final positional argument with an `s3://` destination:

```bash
uv run --frozen --no-sync python quarterly_afr_xlsx_from_iceberg.py \
  drives_of_interest_regexes.json \
  "$B2_SOURCE_ACCESS_KEY" \
  "$B2_SOURCE_SECRET_KEY" \
  s3://bucket_name/bucket_path/quarterly_afr.xlsx
```

The source B2 arguments configure Iceberg reads. Destination writes use the
separate default Boto3 credential/configuration chain through
`boto3.client("s3")`, require write permission and request `GLACIER_IR` storage.
The script writes exactly the supplied output path; it does not append a quarter
suffix. Local output does not need an S3 destination or write permission.

The original regex-selected workbook compresses qualifying quarters into rows.
Its semantics differ from the current matrix's elapsed calendar-quarter axis and
coverage rules. See [workbook reconciliation](production-workbook-reconciliation.md)
for the evidence limits, including the 832 unexplained AFR/AFR-delta differences.
The original [v1 web exporter](web-data.md) is another distinct legacy entry point.

## Historical runtime measurements

These original AWS EC2 measurements were taken in `us-west-1`, chosen for low
latency to the Backblaze B2 Iceberg source. They compare full-script runtimes
under the source and software available for those tests. No new benchmarks were
run for this documentation change.

| vCPU | Instance | Memory | Listed network | Runtime |
| ---: | --- | ---: | --- | ---: |
| 8 | r8g.2xlarge | 64 GB | — | 161 s |
| 16 | m8g.4xlarge | 64 GB | up to 15 Gbps | 120 s |
| 16 | r8g.4xlarge | 128 GB | up to 15 Gbps | 111 s |
| 32 | c8g.8xlarge | 64 GB | 15 Gbps | 91 s |
| 32 | c8gn.8xlarge | 64 GB | 100 Gbps | 67 s |
| 32 | m8g.8xlarge | 128 GB | 15 Gbps | 77 s |
| 32 | r8g.8xlarge | 256 GB | 15 Gbps | 74 s |
| 48 | c8g.12xlarge | 96 GB | 22.5 Gbps | 64 s |
| 48 | c8gn.12xlarge | 96 GB | 150 Gbps | 60 s |
| 48 | m8g.12xlarge | 192 GB | 22.5 Gbps | 61 s |
| 48 | r8g.12xlarge | 384 GB | 22.5 Gbps | 59 s |
| 64 | c8g.16xlarge | 128 GB | 30 Gbps | 54 s |
| 64 | c8gn.16xlarge | 128 GB | 200 Gbps | 53 s |
| 64 | m8g.16xlarge | 256 GB | 30 Gbps | 54 s |
| 64 | r8g.16xlarge | 512 GB | 30 Gbps | 54 s |
| 96 | c8g.24xlarge | 192 GB | 40 Gbps | 50 s |
| 96 | c8gn.24xlarge | 192 GB | 300 Gbps | 49 s |
| 96 | m8g.24xlarge | 384 GB | 40 Gbps | 50 s |
| 96 | r8g.24xlarge | 768 GB | 40 Gbps | 50 s |

See [project navigation](project-navigation.md#historical-source-and-cache-evidence)
for later offline-history, cache, recovery and scaling audit records.
