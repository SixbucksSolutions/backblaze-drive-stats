# Static Cloudflare Pages hosting

#0007 prepares a static Pages upload served through Cloudflare's CDN. The package
contains HTML, JavaScript, CSS, public aggregate JSON, fonts and attribution.
There is no Worker script, Pages Function, database or runtime Python service.
Wrangler is the pinned local verification and eventual upload tool.

The owner-selected target is the **`backblaze-drive-stats-analysis`** Pages
project, production branch **`main`**, at
<https://backblaze-drive-stats-analysis.pages.dev/>. The account and credential
are supplied privately at release time; no token is stored in this repository.
The hosting card #0007 records the actual project/deployment receipt, qualified
release commit and hosted verification. This runbook describes the repeatable
build and publication procedure; a configured URL alone is not a deployment receipt.

## Build and inspect

Use the locked Node/npm versions in `web/.node-version` and `web/package.json`.
From `web/`:

```console
npm ci
npm run quality
npm test
npm run build
node -e "require('node:fs').mkdirSync('../data/staging/0007', {recursive: true})"
npm run check:hosting -- ../data/staging/0007/release-manifest.json
```

The upload directory is **`web/dist`**. The Vite build manifest is retained as
`web/hosting-vite-manifest.json`, outside that directory. The hosting gate verifies
the output inventory, reviewed minimized public representations, production graph, attribution,
cache rules and absence of unexpected files, Functions or Worker entry points.
Its optional private release manifest records file sizes and SHA-256 hashes for
the complete upload directory. Keep both manifests and retained release bundles
outside the served directory.

Private B2 processing objects, raw data, credentials, staging evidence and source
Parquet are never upload inputs. #0104's [full-history refresh](full-history-refresh-0104.md)
replaces the active production selector with 53 source-bounded cutoffs using
consistently bound calculation 2.1.0. The original 161-file 2.0 graph is preserved
outside the served tree.
#0097's
[asset minimization](asset-minimization.md) changes only reviewed build copies;
its 199-file bundle supersedes the earlier 190-file local candidate once accepted.

## Verify the actual local Pages server

Run from `web/` in PowerShell, using separate terminals for server and checks:

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_LOG_PATH = "$PWD/../data/staging/0007/wrangler.log"
$env:XDG_CONFIG_HOME = "$PWD/../data/toolchains/wrangler-config"
npm run preview:hosting
```

```console
npm run check:hosting:serve -- http://127.0.0.1:8787
```

These settings keep local logs/configuration private and bind the server to
loopback. No remote bindings are configured. Stop the managed local server with
Ctrl+C when finished. A Vite preview remains useful for UI development, but it
does not prove Cloudflare's header or missing-file behavior.

The six views use query URLs at the origin root, including historical selections
such as `/?view=capacity&snapshot=2025-Q4-v2-569fc69a7d6c1e0bd62c2e4c`.
No catch-all rewrite is needed. Root `404.html` disables Pages' automatic SPA
fallback so a missing aggregate URL returns 404 instead of the app shell.
The canonical `/404` page and `/404.html` path both have explicit revalidation
headers, accounting for Pages' HTML-extension redirects.

## Cache policy

| File group | Browser policy |
| --- | --- |
| Root HTML, 404 page, mutable production/legacy indexes | `no-cache` |
| Content-addressed production generation JSON and Vite assets | `public, max-age=31536000, immutable` |
| Fixed-name legacy quarter JSON | `public, max-age=300, must-revalidate` |
| Fixed-name fonts, provenance and license files | `no-cache` |

Rules are disjoint because Cloudflare joins repeated header values. The local
probe checks actual response headers, content types, bodies and hashes, query
navigation and absent/private paths. Local checks cannot establish the eventual
account's DNS, TLS, cache-rule overrides or live CDN behavior. The probe accepts
loopback URLs only. After an authorized upload, verify the same properties on
the actual approved preview/hostname with read-only HTTP and browser checks.

## Publish and verify an explicitly requested release

The owner supplies `CLOUDFLARE_ACCOUNT_ID` and a Pages Write token for the intended
account. Load the token only into the deployment process; keep it out of command
arguments, Git, build files, cards and logs. The local operator-specific runner
and sanitized receipts are private evidence under `data/staging/0007/`.

1. Recheck the card lane and owner-requested release scope before work. Use
   read-only Pages API lookup to confirm account access and project settings.
   An existing project/source integration must be preserved. First-time Direct
   Upload creation selects this exact project name and `main` production branch;
   it does not add a Git integration, custom domain, DNS record or Function.
2. Qualify the current revision with the documented build/quality gates and
   Windows/Linux CI. Keep the exact release manifest outside `dist` and verify
   every byte again immediately before upload. Record the prior production
   deployment ID, if any; an initial deployment has no rollback predecessor.
3. Use a clean child environment with the production Cloudflare API endpoint,
   process-only account/token, telemetry/error reporting and Wrangler disk logs
   disabled. Reject unreviewed dotenv/config redirects and Functions/Worker
   entry points at publication time. Keep the reviewed `wrangler.jsonc` target.
4. Upload only the validated static directory. The pinned Wrangler command uses
   `--force` to remain on Pages instead of its automatic Pages-to-Workers
   delegation path. No Worker scripts or Pages Functions are part of this build.
   Existing CI remains quality-only; commits do not automatically publish.
5. Confirm the API reports a successful production deployment for the exact
   project, branch and release commit. Run the public verification below, then
   check all six views, historical links, fonts, attribution and narrow/keyboard
   behavior in the browser. Record the deployment ID, hostname and results.

The equivalent publication command, after the owner-requested release and
credential/environment checks, is:

```console
node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name backblaze-drive-stats-analysis --branch main --commit-hash REVIEWED_COMMIT --commit-dirty=false --force
```

Supply the reviewed commit hash. Local preparation does not itself execute this
command. Pages supports distinct Git integration and Direct Upload project modes;
Direct Upload does not later become automatic Git integration in place.

After publication, from `web/`:

```console
npm run check:hosting:remote -- https://backblaze-drive-stats-analysis.pages.dev/
```

This credential-free verifier checks every served release file against its local
manifest, including decoded byte lengths, SHA-256, cache headers and media types.
It checks navigation queries, canonical HTML redirects and genuine custom 404s.
Requests are limited to this HTTPS project origin or a single deployment/branch
label beneath it, with bounded concurrency, response sizes and timeouts. It does
not authenticate or deploy. The separate local verifier remains loopback-only.

## Rollback

For a previously deployed production version, use the Pages deployment dashboard
to roll back to the recorded successful production deployment. Preview deployments
are not rollback targets. Keep the matching complete bundle and manifest so it
can be rebuilt or redeployed under the approved procedure if needed. The first
deployment has no prior production version to roll back to.

Rollback restores a coherent app/index/data bundle; it does not rewrite immutable
generation files. A browser already using a newer generation may encounter a
missing later artifact after rollback and need a reload or Retry latest. Verify
the restored generation and all six views; do not claim uninterrupted access to
newer artifacts that the older deployment never contained. Private B2 history
and Python cache lineage are outside the website rollback.

## Official references

- [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Serving Pages and 404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Wrangler Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
