# Development quality policy

The checks cover the maintained Python pipeline, legacy reports, tests and tools,
and the TypeScript UI and maintenance scripts. Rules target correctness and useful
maintainability findings. Neither linter enables an indiscriminate all-rules preset.

## Tool ownership and current pins

Python versions verified on 2026-11-03 (see the [Python freshness audit](buildchain-freshness-0126.md));
frontend versions verified on 2026-11-03 (see the [frontend freshness audit](buildchain-freshness-0127.md)):

| Concern | Tool | Version / scope |
| --- | --- | --- |
| Python environment, dependencies and execution | uv | 0.13.7; accepted 0.13 minor |
| Python runtime | CPython | 3.15.2 in `.python-version` |
| Python lint, imports and formatting | Ruff | 0.17.3 |
| Python types and Python language server | Pyright | 1.1.414 |
| TypeScript types and native language server | TypeScript | 7.0.2 |
| TypeScript semantic and syntax lint | Oxlint + tsgolint | 1.90.0 + 7.0.2005 |
| Frontend and CI YAML formatting | Prettier | 3.9.10 |

uv creates and manages `.venv`. There is no separate manual venv/pip workflow.
Development tools are in `dependency-groups.dev`; the lock fixes their actual
versions. The PostgreSQL extra is needed for a clean analysis of the optional legacy
importer. Installing it does not start or contact PostgreSQL. Runtime-only installs
can use `uv sync --frozen --no-dev`, adding `--extra postgres` only for that importer.

## Reproduce the gate

From the repository root:

```console
uv python install
uv sync --frozen --extra postgres
uv run --frozen --no-sync ruff check .
uv run --frozen --no-sync ruff format --check .
uv run --frozen --no-sync pyright --warnings
uv run --frozen --no-sync python -m unittest discover -s tests
```

Then from `web/`:

```console
npm ci
npm run quality
npm test
npm run build
```

`quality` runs strict TypeScript analysis, typed/syntax lint and formatting checks,
including parsing/formatting the CI YAML through the same pinned Prettier tool.
The build additionally validates published aggregates, cross-view scope/filter/CSV
consistency through `check:integrated-release`, the pinned font assets and the
static Pages upload boundary through `check:hosting`. The Vite build manifest
is retained outside `dist`; local Pages response checks use `check:hosting:serve`.
`check:minimized` also enforces compact HTML/JSON, enabled Oxc/Lightning CSS and
absence of served source maps. Derived fictional JSON references are rebound
before Vite hashes the assets; golden fixture bytes remain unchanged.
Use `uv run --frozen --no-sync ruff format .` and `npm run format` to apply formatting;
Ruff's safe fixes are available separately with `ruff check --fix`. Review fixes;
unsafe automatic fixes are not part of the normal workflow.

GitHub Actions runs the same gates on Ubuntu and Windows, with locked environments,
fixed tool versions and commit-pinned actions. It has repository-content read
permission, no retained checkout credentials, no dataset downloads and no deployment
step. Language-service smoke queries must return real symbol results for both
languages. Branch protection/required-check administration is not changed by this
workflow. Dependabot proposes npm-development and action updates; Python refreshes
use the explicit uv sequence below.

## Python policy and deliberate exceptions

Ruff selects syntax/import errors, Pyflakes, modern Python, bugbear, simplification,
comprehensions, useful miscellaneous rules, unused suppressions and blanket-ignore
hygiene. Its exact selectors and four readability exceptions are in `ruff.toml`.
They do not disable general correctness categories. It does not require docstrings
or every stylistic rewrite merely because a rule exists.

Pyright checks all maintained Python in standard mode, with strict checks on the
normalizer, ETL state and shared aggregate record types. Unnecessary casts,
comparisons and type ignores, always-true assertions and incompatible overrides
are errors. Structured record types check constructed public payloads. Standard
checks elsewhere still reject invalid arguments, operators, imports and unsafe
optional access; they are not an untyped-file exclusion.

Strict-mode trials on Polars/S3 consumers produced partially unknown third-party
method types. Broadly disabling unknown-type diagnostics would make a strict badge
misleading, so those files stay in the enforced standard gate. No blanket `Any`
or type-ignore baseline was added. The language-service protocol/FFI bridge has
dynamic external message boundaries; its transport and lifecycle are additionally
covered by focused tests and independent review.

The only Python formatter exclusion is `drive_model_names.py`: its raw bytes are a
cache-lineage input. Ruff lint and strict Pyright still include it. Git stores the
existing CRLF bytes without conversion, and a fingerprint test protects them. This
preserves the known local cache identity and makes future checkouts consistent.
Caches built from a different older LF checkout retain their distinct prior identity;
the policy does not pretend those hashes were equal. A deliberate normalizer edit
must review cache implications and update the pin in the same change.

Standalone fixture-builder imports after its repository-root bootstrap have narrow,
explained E402 suppressions. Source fixtures, downloaded/private data, environments,
generated frontend output and vendored assets have distinct ownership; formatting
tools do not rewrite golden JSON or downloaded font/license bytes.

## TypeScript policy and compatibility

The compiler enforces `strict`, unchecked-index access, exact optional properties,
unused declarations/parameters, implicit-return/override checks and switch/control
flow checks. Dependency declarations retain `skipLibCheck`; project source does not.

Oxlint rejects unsafe typed assignments/arguments/calls/members/returns, floating or
misused promises, non-Promise awaits, unsafe arithmetic/string coercion, invalid
throws/rejections and incomplete switches, plus high-value syntax/control-flow
rules. Source and tests receive typed analysis; standalone `.mjs` maintenance scripts
receive syntax/correctness lint. Their intentional console output is the sole
override. CLI warnings fail the gate.

Non-null and narrowing-assertion bans are not enabled indiscriminately. Existing
generated-DOM and versioned bundled-fixture invariants stay explicit; arbitrary
public report JSON still passes runtime validation. Formatting rules belong to
Prettier, rather than a second competing style engine. CI uses LF for formatter-owned
web text and canonical fixture JSON; `.gitattributes` protects byte-sensitive exceptions.

typescript-eslint's published supported range currently excludes TypeScript 7.
Oxlint's [type-aware backend](https://oxc.rs/docs/guide/usage/linter/type-aware.html)
uses the native TypeScript engine, so we retain TypeScript 7 without suppressing an
unsupported-parser warning. #0024 watches the TypeScript 7.1 stable release; #0025
adds supported ESLint/typescript-eslint checks afterward. It may coexist with
Oxlint. Migration requires declared compiler/API compatibility, preserved effective
rules, reviewed overlap, frozen installs and passing negative probes plus the full
gate. A TypeScript release by itself does not prove parser support.

## Real language-service queries

`tools/code_intel.py` is a local read-only command bridge for the installed Pyright
and native TypeScript servers. No additional server package or global Codex setting
was needed. It supports `symbols`, `hover`, `definition` and `references`:

```console
uv run --frozen --no-sync python tools/code_intel.py symbols drive_model_names.py
uv run --frozen --no-sync python tools/code_intel.py hover web/src/matrix-data.ts --line 1 --column 10
uv run --frozen --no-sync python tools/code_intel.py definition web/src/matrix-data.ts --line 1 --column 10
uv run --frozen --no-sync python tools/code_intel.py references drive_model_names.py --line 8 --column 6
```

CLI positions are one-based Unicode columns; returned standard LSP positions use
zero-based UTF-16. Source/results are limited to 1 MiB, frames to 8 MiB, and request
timeouts default to 20 seconds with a 120-second ceiling. Stderr is drained; shutdown,
EOF and timeout paths clean up process trees. The client does not run application
business code or download datasets. Real queries have returned symbols, hover,
definitions and references for both languages. Complete repository-wide Python
reference coverage is not established, so a rename still needs search and tests.
This CLI is callable by coding agents now; it is not native Codex/MCP registration.

## Keep the toolchain current

Review updates deliberately, with one change set and a clean full gate:

```console
uv lock --upgrade-package ruff --upgrade-package pyright --upgrade-package types-jsonschema --upgrade-package types-psycopg2
uv sync --frozen --extra postgres
uv export --frozen --format requirements-txt --no-hashes --no-dev --output-file requirements.txt
```

Audit every direct runtime, optional and development dependency against official
release/registry metadata, including Python/Node/npm/uv, CI tool pins and Wrangler's
locked workerd compatibility-date ceiling. Record unavailable or incompatible
updates explicitly. From `web/`, inspect `npm outdated`, then update selected
packages with exact pins; do not broadly upgrade unrelated runtime dependencies
to install a linter.
Language servers update with their owning Pyright and TypeScript dependencies, not
through unpinned global installs. After an update, run the quality/tests/build and
real code-query smoke checks. Recheck known-error probes after rule/backend changes:
an intentional unused import/type mismatch must fail in Python, and unsafe values
and missed/misused promises must fail typed frontend lint. Remove disposable probes.
Raising uv's accepted minor range is a deliberate toolchain change with the same gate.
