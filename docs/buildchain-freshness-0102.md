# Buildchain freshness — #0102

Verified against official sources on **2026-11-01**. All direct dependencies and
runtime pins already select the newest stable releases compatible with this
project, except the documented boto3 constraint below. The qualified refresh adds
exact npm manifest pins and two routine transitive Python lock updates.

## Applied refresh

- Replace the `@types/node`, TypeScript and Vite manifest ranges with exact pins;
  their selected versions stay 26.6.6, 7.0.2 and 8.3.5. All npm direct dependencies
  now use exact versions, consistent with the frozen npm lock.
- Resolve Python with `uv lock --upgrade`: cachetools 7.2.7 → 7.2.8 and nodeenv
  1.11.1 → 1.12.0. Re-export runtime-only `requirements.txt` from the lock;
  nodeenv remains development-only through Pyright.
- Retain the runtime, uv/npm/CI pins and Wrangler compatibility date after checking
  their official current releases and supported runtime boundaries.

## Runtime and Python dependency audit

The [Python release page](https://www.python.org/downloads/) identifies 3.15.2 as
the latest stable Python. The [Node release index](https://nodejs.org/dist/index.json)
identifies 26.13.0 as the latest stable Node (27.0.0-alpha.0.0.0 is a prerelease).
The project retains Python 3.15.2, Node 26.13.0,
[npm 12.2.1](https://registry.npmjs.org/npm/latest) and
[uv 0.13.6](https://pypi.org/pypi/uv/json).

Every declared Python dependency, including PostgreSQL and development groups,
was compared with its live official PyPI metadata:

| Dependency | Latest stable | Selected |
| --- | --- | --- |
| [boto3](https://pypi.org/pypi/boto3/json) | 1.43.123 | 1.43.117 |
| [boto3-stubs](https://pypi.org/pypi/boto3-stubs/json) | 1.43.123 | 1.43.123 |
| [Polars](https://pypi.org/pypi/polars/json) | 2.1.0 | 2.1.0 |
| [PyArrow](https://pypi.org/pypi/pyarrow/json) | 26.0.0 | 26.0.0 |
| [PyIceberg](https://pypi.org/pypi/pyiceberg/json) | 0.12.0 | 0.12.0 |
| [s3fs](https://pypi.org/pypi/s3fs/json) | 2026.9.0 | 2026.9.0 |
| [XlsxWriter](https://pypi.org/pypi/xlsxwriter/json) | 3.3.1 | 3.3.1 |
| [jsonschema](https://pypi.org/pypi/jsonschema/json) | 4.26.0 | 4.26.0 |
| [psycopg2-binary](https://pypi.org/pypi/psycopg2-binary/json) | 2.9.13 | 2.9.13 |
| [Pyright](https://pypi.org/pypi/pyright/json) | 1.1.414 | 1.1.414 |
| [Ruff](https://pypi.org/pypi/ruff/json) | 0.17.3 | 0.17.3 |
| [types-jsonschema](https://pypi.org/pypi/types-jsonschema/json) | 4.26.0.20261006 | 4.26.0.20261006 |
| [types-psycopg2](https://pypi.org/pypi/types-psycopg2/json) | 2.9.21.20261030 | 2.9.21.20261030 |

boto3 1.43.123 remains held: current
[aiobotocore 3.10.0 metadata](https://pypi.org/pypi/aiobotocore/json) requires
`botocore>=1.43.115,<1.43.118`. The fresh resolver retains boto3/botocore 1.43.117,
the newest compatible pair in the existing s3fs chain. Replacing that chain or
forcing an incompatible botocore is outside this routine freshness update.

The refreshed transitives are the current
[cachetools 7.2.8](https://pypi.org/pypi/cachetools/json) and
[nodeenv 1.12.0](https://pypi.org/pypi/nodeenv/json). No Python direct declaration
or interpreter requirement needed a version change.

## Frontend, compiler and hosting audit

Every npm direct dependency was checked against its live official latest tag:

| Dependency | Latest stable and selected |
| --- | --- |
| [@types/node](https://registry.npmjs.org/@types/node/latest) | 26.6.6 |
| [html-minifier-terser](https://registry.npmjs.org/html-minifier-terser/latest) | 7.2.0 |
| [Oxlint](https://registry.npmjs.org/oxlint/latest) | 1.90.0 |
| [oxlint-tsgolint](https://registry.npmjs.org/oxlint-tsgolint/latest) | 7.0.2005 |
| [Prettier](https://registry.npmjs.org/prettier/latest) | 3.9.10 |
| [TypeScript](https://registry.npmjs.org/typescript/latest) | 7.0.2 |
| [Vite](https://registry.npmjs.org/vite/latest) | 8.3.5 |
| [Wrangler](https://registry.npmjs.org/wrangler/latest) | 4.156.0 |

TypeScript 7.1 is not the stable latest release. The
[typescript-eslint support policy](https://typescript-eslint.io/users/dependency-versions/)
and [parser 8.72.1 peer metadata](https://registry.npmjs.org/@typescript-eslint/parser/latest)
still support `>=4.8.4 <6.1.0`, excluding TypeScript 7. #0024 and #0025 retain their
release and compiler/API compatibility gates; no ESLint/parser tooling is added.
[Oxlint uses the native TypeScript engine for typed lint](https://oxc.rs/docs/guide/usage/linter/type-aware.html).
Its 1.90.0 peer metadata requires oxlint-tsgolint `>=7.0.2005`; the exact selected
backend satisfies that constraint and passes the project's typed lint.

Wrangler 4.156.0 explicitly pins workerd **1.20261023.1** in its official metadata.
[Standalone workerd latest](https://registry.npmjs.org/workerd/latest) is
1.20261101.1, but overriding Wrangler's declared runtime is not a supported
routine upgrade. The retained `compatibility_date` is **2026-10-23**, the earlier
of the client date (2026-11-01) and the locked runtime ceiling. This follows
[Cloudflare's compatibility-date guidance](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)
and avoids future-date fallback locally. The project remains pure static Pages
with no Functions; the existing hosting gate keeps its exact expected date.

Official latest release/tag APIs confirm the immutable CI action pins:

| Action | Current latest stable | Commit |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv/releases/tag/v10.3.3) | v10.3.3 | `68559e99cc807c1eb7e9238fd43a15bba460eec2` |

## Qualification and limits

Verification ran in an isolated tracked-source mirror of baseline `7429b28`,
with its own `.venv` and `web/node_modules`, on Windows using the retained runtime
pins. No root environment, user-global tool or application source was changed.

- `uv lock --check`, `uv sync --frozen --extra postgres`, Ruff lint and format
  (158 files), and Pyright pass with zero errors or warnings.
- Python behavior tests: **238 run, 1 skipped, no failures**. The normalizer SHA-256
  remains `e6c2ca5920d387e8ce06a8208f37e287637ffaee09392bf7531b88bb7a3e7d9d`.
- Real Python and TypeScript language-service symbol queries return nonempty data.
- `npm ci`, TypeScript checking, Prettier, **154 web tests**, and the full production
  build pass, including integrated release/data/font, static hosting and minimized
  asset checks. npm's installation audit reports zero vulnerabilities.
- Directory-based Oxlint inside `data/staging` inherits the root `/data/` ignore
  and reports no files. The same configured typed/syntax rules pass when supplied
  all **44 source files, 21 scripts and the Vite config explicitly**. No rule or
  ignore configuration was weakened. The normal `npm run quality` command must
  run again after integration into the repository root.

No compiler, rule or backend version changed, so new rule-migration probes were
not required. No local Wrangler server, remote hosting check, deployment, raw-data
scan, cache regeneration or numerical/data migration was performed. Fresh
independent review and the parent's combined integration gate remain separate
handoff steps. Private live metadata and command evidence are retained in
`data/staging/0102/`, including `version-audit.json` and `version-audit.txt`.

After selective integration with #0103, the parent reran the ordinary repository
gates: frozen Python/npm installation, Ruff, Pyright, `npm run quality`, **253
Python tests**, **156 frontend tests**, real Python/TypeScript symbol queries and
the full production build all pass. The directory-based lint command runs in the
repository root, closing the mirror-specific qualification limit above. Fresh
independent review found no material issue. The card is the handoff record for
the final commit and hosted CI status.
