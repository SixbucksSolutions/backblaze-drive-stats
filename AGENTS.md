# Project development guidance

Follow the owner's current instructions and localswim workflow. This file adds
repository-specific guidance; it does not authorize data downloads or deployment.

## Environments and quality gates

- Use **uv** for Python installation, dependency resolution, environments and runs.
  `.venv` is uv's project environment, not a separate environment-management flow.
- Use the committed `.python-version`, `uv.lock`, `web/.node-version` and npm lock.
  Start with `uv sync --frozen --extra postgres` and `npm ci` from `web/`.
  The optional PostgreSQL extra resolves every legacy import for repository checks;
  checks and tests do not connect to a database.
- Run the appropriate documented gates in [docs/code-quality.md](docs/code-quality.md).
  Fix real findings. Do not weaken a rule, add blanket suppressions or widen types
  to `Any` merely to make a checker pass.
- Ruff owns Python formatting/import order. Prettier owns frontend formatting.
  Python type analysis uses Pyright; TypeScript uses strict compiler options and
  Oxlint's native type-aware backend. Do not add conflicting formatting policies.
- Use `uv add --dev` for Python development tools and commit the lock update.
  Keep `requirements.txt` a generated runtime-only export; never edit it manually.
- If an agent cannot write the default uv cache, set `UV_CACHE_DIR` for that
  process to the ignored `data/toolchains/uv-cache` directory. Keep using uv;
  do not replace its environment manager or change the user's global settings.

## Cache and data invariants

- Do not format `drive_model_names.py`. Its exact bytes participate in the retained
  cache identity. Ruff still lints it and Pyright checks it in strict mode.
- Its existing CRLF bytes are intentional and protected by `.gitattributes` and a
  fingerprint regression. Any deliberate change needs a cache-lineage review and
  an updated fingerprint, rather than an incidental formatting fix.
- Preserve golden JSON, source workbooks, font/license bytes and numerical behavior.
  Raw ZIP/CSV/Parquet, private summaries and operational runtime files stay out of Git.
- Do not scan daily data or regenerate caches just to validate a tooling change.

## Language-service queries

Use the local language servers when symbols, types, definitions or references help
resolve a code change. The bridge uses the locked Pyright and native TypeScript
servers and can be called through the agent's command tool:

```console
uv run --frozen --no-sync python tools/code_intel.py symbols drive_model_names.py
uv run --frozen --no-sync python tools/code_intel.py hover web/src/matrix-data.ts --line 1 --column 10
uv run --frozen --no-sync python tools/code_intel.py definition web/src/matrix-data.ts --line 1 --column 10
```

Positions supplied to the command are one-based Unicode columns; returned LSP
positions are zero-based UTF-16. Queries are read-only and restricted to configured
repository source files. Each call starts and cleans up its own bounded session.
Repository-wide Python reference completeness is not established: corroborate a
rename or deletion with `rg`, type checks and tests. This is a project CLI bridge,
not a claim that Codex has a registered native LSP/MCP tool.

## Tool updates

Follow the deliberate update/check sequence in the quality policy. Recheck official
compiler/parser compatibility before adding typescript-eslint; localswim #0024 and
#0025 track TypeScript 7.1 and its dependent tooling. Existing complementary tools
may remain. A release number alone does not establish compiler-API compatibility.
