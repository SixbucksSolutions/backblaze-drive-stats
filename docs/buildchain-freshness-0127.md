# Frontend buildchain freshness — #0127

Verified against official release and registry metadata on **2026-11-03**.
Wrangler is the only direct npm dependency requiring an update. Node, npm,
TypeScript and every other direct dependency already select the latest stable
release. The separate [Python audit](buildchain-freshness-0126.md) covers Python,
uv and Python dependencies.

## Applied refresh

- Update Wrangler **4.156.0 → 4.157.0** with an exact manifest pin and regenerated
  npm lock. Retain its declared workerd **1.20261103.1** and Miniflare
  **5.20261103.0-beta** dependencies; the stable Wrangler release chooses these
  transitives. No runtime override is added.
- Update the explicit workerd install-script allowlist to its new exact version.
  The existing esbuild allowlist remains unchanged.
- The regenerated lock also selects the routine transitive
  [semver 7.8.6](https://registry.npmjs.org/semver/latest) patch, replacing 7.8.5.
- Advance `compatibility_date` **2026-10-23 → 2026-11-03** in the Wrangler config
  and the exact static-hosting policy assertion. No hosting boundary or cache
  validation is relaxed.

## Runtime and direct dependency audit

The [official Node release index](https://nodejs.org/dist/index.json) identifies
**26.13.0** (Lithium LTS) as the latest stable release. Its newer 27.0.0 alpha is
a prerelease. Keep `.node-version` and the Node engine range unchanged.
[npm 12.2.1 metadata](https://registry.npmjs.org/npm/latest) supports Node
`^22.22.2 || ^24.15.0 || >=26.0.0`; the installed and pinned Node 26.13.0 satisfies
that range. Keep npm's manifest and CI pins unchanged.

Every direct npm dependency was compared with its official `latest` metadata:

| Dependency | Latest stable / selected |
| --- | --- |
| [@types/node](https://registry.npmjs.org/@types/node/latest) | 26.6.6 |
| [html-minifier-terser](https://registry.npmjs.org/html-minifier-terser/latest) | 7.2.0 |
| [Oxlint](https://registry.npmjs.org/oxlint/latest) | 1.90.0 |
| [oxlint-tsgolint](https://registry.npmjs.org/oxlint-tsgolint/latest) | 7.0.2005 |
| [Prettier](https://registry.npmjs.org/prettier/latest) | 3.9.10 |
| [TypeScript](https://registry.npmjs.org/typescript/latest) | 7.0.2 |
| [Vite](https://registry.npmjs.org/vite/latest) | 8.3.5 |
| [Wrangler](https://registry.npmjs.org/wrangler/latest) | 4.157.0 |

The declared Node engine ranges of all direct tools accept Node 26.13.0. The
exact selected native backend satisfies Oxlint's `oxlint-tsgolint >=7.0.2005`
peer requirement. [Oxlint's type-aware documentation](https://oxc.rs/docs/guide/usage/linter/type-aware.html)
describes its native TypeScript engine and TypeScript 7.0 configuration boundary.

TypeScript's [official registry channels](https://registry.npmjs.org/typescript)
identify **7.1.0-beta** as beta and **7.1.0-dev.20261103.1** as next; neither
replaces stable 7.0.2. #0024 retains its TypeScript 7.1 stable-release gate.
The [typescript-eslint policy](https://typescript-eslint.io/users/dependency-versions/)
and [parser 8.72.1 peer metadata](https://registry.npmjs.org/@typescript-eslint/parser/latest)
still limit supported TypeScript to `>=4.8.4 <6.1.0`. #0025 retains its explicit
compiler/API compatibility gate; no unsupported parser or ESLint toolchain is added.

## Hosting runtime and CI pins

[Wrangler 4.157.0 release notes](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.157.0)
explicitly advance its default compatibility date to **2026-11-03**, matching the
bundled workerd release. Official Wrangler metadata and the regenerated lock both
select **workerd 1.20261103.1**, also the
[current standalone release](https://registry.npmjs.org/workerd/latest).
The configured date is the earlier of the audit date and locked runtime ceiling,
following [Cloudflare's compatibility-date guidance](https://developers.cloudflare.com/workers/configuration/compatibility-dates/).
The project remains static Pages with no Functions.

Official latest-release APIs and resolved tag references confirm the existing
immutable action pins; no CI action update is required:

| Action | Latest stable | Commit |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv/releases/tag/v10.3.3) | v10.3.3 | `68559e99cc807c1eb7e9238fd43a15bba460eec2` |

## Qualification

Verification ran in the repository on Windows using Node **26.13.0** and npm
**12.2.1**:

- Clean frozen `npm ci` passes and reports **zero vulnerabilities**. `npm outdated`
  returns an empty result; every direct declared, locked and installed version
  matches the audited selection.
- `npm run quality` passes strict TypeScript analysis, typed/syntax lint and
  formatting. All **254 frontend tests** pass.
- The full production build passes public-data, integrated-release, font,
  static-hosting and minimized-asset checks. The hosting inventory contains
  **3,117 files**.
- The real TypeScript language-service symbol query returns nonempty results.
  Wrangler reports **4.157.0** and its installed workerd binary reports
  **2026-11-03**.
- The actual updated Wrangler Pages server passes the documented local HTTP
  checks: **17 assets, 12 missing-resource cases and one redirect**, including
  exact bytes, cache policy and genuine 404 behavior. Startup reports no future
  compatibility-date fallback. The loopback server was stopped after the probes.

Compiler, rule and typed-backend versions did not change, so rule-migration
negative probes are not required for this refresh. Fresh independent review and
the parent's integration handoff remain separate steps.

Private official metadata and command evidence are retained under
`data/staging/0127/`. No deployment, data download, daily-data scan, cache
regeneration or global tool/configuration change is part of this refresh.
