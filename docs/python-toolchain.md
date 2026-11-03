# Python toolchain

Versions rechecked against official release/registry metadata on 2026-11-03;
see the [Python freshness audit](buildchain-freshness-0126.md) for the current
quality gate and compatibility holds. Historical data verification below retains
its original scope.

| Component | Tested version |
| --- | --- |
| uv | 0.13.7 |
| Python | 3.15.2 |
| Polars | 2.1.0 |
| PyArrow | 26.0.1 |
| PyIceberg | 0.12.0 |
| s3fs | 2026.9.0 |
| boto3 / botocore | 1.43.117 |
| boto3-stubs / botocore-stubs | 1.43.123 |
| XlsxWriter | 3.3.1 |

`.python-version` selects the project interpreter; `pyproject.toml` requires
Python 3.15 or newer. `uv.lock` records the complete dependency resolution.
`requirements.txt` is generated from that lock for tools that need pip format.
The project pin does not change the default Python of unrelated projects.

## Reproduce the tested environment

Run from the repository root in PowerShell:

```powershell
uv python install 3.15.2
uv sync --frozen
uv run --frozen python --version
uv run --frozen python -m unittest discover -s tests
```

uv owns the project environment in `.venv`. For the complete development gate,
including the optional legacy PostgreSQL importer's dependencies, use
`uv sync --frozen --extra postgres` and the commands in the
[quality policy](code-quality.md). Ruff and Pyright are locked development tools;
Pyright also supplies the Python language server used by `tools/code_intel.py`.

The first installation needs network access. On the verified Windows/Python 3.15
installation, uv built the locked PyIceberg and zstandard source distributions
locally. The native zstandard build needs a compatible compiler, such as the
Microsoft C++ build tools; both builds succeeded on the verified machine. Other platforms may have different wheel
availability. No live cloud credentials or dataset downloads are needed for tests.

The default dependencies include `jsonschema` for the flagship and
supporting-history contracts. The historical generator validates artifacts during
normal operation, so production-only installs must retain it too. These validators enforce Draft
2020-12 structure and separate aggregate semantic checks. They do not verify an
upstream daily source scan or authorize publication by themselves.

Use `uv run --frozen` before an existing script command to select the pinned
environment without refreshing dependencies. Existing script names, arguments and
default behavior remain available, including the original Iceberg/AFR workflow.
For example, export the existing local 2026 Q2 cache into a private staging folder:

```powershell
uv run --frozen python export_quarterly_web_data.py --input-parquet 'data/processed/2026-Q2/*.parquet' --through-quarter 2026-Q2 --drive-patterns-json drives_of_interest_regexes.json --output-dir data/staging/toolchain-check
```

See [ZIP import](zip-import.md) and [web data](web-data.md) for source and output
details. Raw data, caches and staging outputs remain local and ignored by Git.

## Refresh dependencies deliberately

```powershell
uv lock --upgrade
uv sync --frozen
uv export --frozen --format requirements-txt --no-hashes --no-dev --output-file requirements.txt
uv run --frozen python -m unittest discover -s tests
```

Review and commit the dependency files together after verification. Do not edit
`requirements.txt` by hand. The legacy `install-latest-uv-python-env.sh` remains
available, but it deletes the environment/cache and uninstalls all uv-managed
interpreters; use the commands above for a project-scoped, reproducible setup.

The newest boto3 release at verification was 1.43.123. It cannot resolve with the
current s3fs dependency chain: aiobotocore 3.10.0 requires botocore
`>=1.43.115,<1.43.118`. The lock therefore selects boto3/botocore 1.43.117, the
newest compatible runtime pair. The typing packages resolve at 1.43.123. Existing
S3/Iceberg dependencies remain in the default installation.

## Refresh verification

All 21 synthetic tests pass, and all 19 source/test modules compile on Python
3.15.2. Polars 2 requires membership operands to have compatible types; exporter
failure validation now compares its Float64 values with `[0.0, 1.0]`. Its existing
fractional-failure rejection test continues to pass.

The regenerated selected-population 2026 Q2 bundle matches the existing published
bundle after excluding `provenance.generatedAt`, with relative and absolute float
tolerances of `1e-10`. Counts are unchanged: 38 models, 333,560 drives, 29,735,545
drive-days, 1,346 failure flags and six datacenters. Parallel float summation
differs by at most about `1.34e-7` TB for datacenter totals around millions of TB
(relative difference below `8e-14`). No published JSON was replaced.

The importer also produced exact frame equality against existing Parquet for
2026-04-01, 2026-05-16 and 2026-06-30 from the original local ZIP. No full-quarter
reimport or remote Iceberg scan was performed. Private verification artifacts are
under `data/staging/toolchain-0012/`.
