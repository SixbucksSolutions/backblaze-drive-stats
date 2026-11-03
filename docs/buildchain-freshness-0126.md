# Python buildchain freshness — #0126

Verified against official release and package metadata on **2026-11-03**.
This audit covers uv, CPython, all 13 declared Python runtime/optional/development
dependencies, and the complete compatible transitive lock resolution. Frontend
release research remains recorded in the [2026-11-01 audit](buildchain-freshness-0102.md).

## Applied refresh

- Upgrade the installed uv executable from 0.13.6 to
  [0.13.7](https://github.com/astral-sh/uv/releases/tag/0.13.7). Raise the project
  minimum and the exact CI pin together; retain the accepted 0.13 minor range.
- Upgrade [PyArrow](https://pypi.org/pypi/pyarrow/json) from 26.0.0 to 26.0.1
  in the declaration, lock and generated runtime-only requirements export.
- Run `uv lock --upgrade` across all groups. PyArrow is the only resolved package
  change; all other compatible locked versions remain current.
- Retain [CPython 3.15.2](https://www.python.org/downloads/), the latest stable
  release. The project interpreter pin and minimum Python requirement stay put.

## Direct dependency audit

| Dependency | Latest stable | Selected |
| --- | --- | --- |
| [boto3](https://pypi.org/pypi/boto3/json) | 1.43.123 | 1.43.117 |
| [boto3-stubs](https://pypi.org/pypi/boto3-stubs/json) | 1.43.123 | 1.43.123 |
| [Polars](https://pypi.org/pypi/polars/json) | 2.1.0 | 2.1.0 |
| [PyArrow](https://pypi.org/pypi/pyarrow/json) | 26.0.1 | 26.0.1 |
| [PyIceberg](https://pypi.org/pypi/pyiceberg/json) | 0.12.0 | 0.12.0 |
| [s3fs](https://pypi.org/pypi/s3fs/json) | 2026.9.0 | 2026.9.0 |
| [XlsxWriter](https://pypi.org/pypi/xlsxwriter/json) | 3.3.1 | 3.3.1 |
| [jsonschema](https://pypi.org/pypi/jsonschema/json) | 4.26.0 | 4.26.0 |
| [psycopg2-binary](https://pypi.org/pypi/psycopg2-binary/json) | 2.9.13 | 2.9.13 |
| [Pyright](https://pypi.org/pypi/pyright/json) | 1.1.414 | 1.1.414 |
| [Ruff](https://pypi.org/pypi/ruff/json) | 0.17.3 | 0.17.3 |
| [types-jsonschema](https://pypi.org/pypi/types-jsonschema/json) | 4.26.0.20261006 | 4.26.0.20261006 |
| [types-psycopg2](https://pypi.org/pypi/types-psycopg2/json) | 2.9.21.20261030 | 2.9.21.20261030 |

### Compatibility hold

[aiobotocore 3.10.0](https://pypi.org/pypi/aiobotocore/3.10.0/json) requires
`botocore>=1.43.115,<1.43.118`. Latest boto3 1.43.123 requires
`botocore>=1.43.123,<1.44.0`; those ranges do not intersect. Boto3/botocore
1.43.117 remains the newest compatible pair for the current s3fs chain. Forcing
the latest boto3 would violate that dependency contract.

### Python 3.15 installation

PyArrow 26.0.1 and psycopg2-binary publish CPython 3.15 Windows and Linux wheels.
Polars uses compatible ABI3 runtime wheels. PyIceberg 0.12.0 declares support for
Python `>=3.10,<4.0.0`, but its published wheels stop at CPython 3.14, with no ABI3
wheel. Its source-build path remains necessary on 3.15; the existing toolchain
documentation describes the native compiler requirement for source dependencies.

### Existing Parquet caches

`parquet_profile.py` includes the PyArrow engine version in its physical profile
fingerprint. This update changes that fingerprint from
`private-parquet-rich-v1-903ee87c89e5` to `private-parquet-rich-v1-3a4088bd33d3`.
Existing files retain their original profile and bytes. A later authorized
generator run can rewrite verified summaries into the new physical layout;
projection/verification commands that require the current profile will reject
old-profile receipts until the corresponding migration or rebuild is performed.
This is a future operational consequence of the dependency update, not a cache
migration performed by this ticket. Published static JSON remains unchanged.

## Qualification

- `uv lock --check`, frozen installation with the PostgreSQL extra, Ruff lint and
  formatting (172 files), and Pyright pass with zero errors or warnings.
- All **282 Python tests** and **254 frontend tests** pass.
- Real Python and TypeScript language-service queries return nonempty symbol data.
- `npm ci` reports zero vulnerabilities; TypeScript, typed/syntax lint, formatting
  and the full production build pass, including integrated data, fonts, hosting
  and minimized-asset checks. Fresh independent review found no material issue,
  including in the documented cache-profile consequence. Hosted CI completion
  is recorded on #0126.

Private command logs are retained under `data/staging/0126/`.

This maintenance does not download drive data, regenerate aggregate caches,
change numerical algorithms or publish a new site release. The protected
`drive_model_names.py` bytes and existing source/golden data are preserved.
