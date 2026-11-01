# Static Cloudflare Pages hosting

#0007 prepares a static Pages upload served through Cloudflare's CDN. The package
contains HTML, JavaScript, CSS, public aggregate JSON, fonts and attribution.
There is no Worker script, Pages Function, database or runtime Python service.
Wrangler is the pinned local verification and eventual upload tool.

Terry accepted parent #0017. He will supply the Cloudflare account, intended
hostname and any existing Pages project in the morning. The committed name
`backblaze-drive-stats-local` is a local template, not a chosen remote resource.
Target-specific configuration and hosted verification remain unfinished until
those details arrive. No Cloudflare account, DNS or resource changes have been
made and no files have been uploaded.

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
the output inventory, public source byte identity, production graph, attribution,
cache rules and absence of unexpected files, Functions or Worker entry points.
Its optional private release manifest records file sizes and SHA-256 hashes for
the complete upload directory. Keep both manifests and retained release bundles
outside the served directory.

Private B2 processing objects, raw data, credentials, staging evidence and source
Parquet are never upload inputs. The existing 161 production JSON files keep
their exact bytes and calculation semantics. Asset minimization is later #0097.

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
such as `/?view=capacity&snapshot=2025-Q4-v2-567907ee122370721c8f1a09`.
No catch-all rewrite is needed. Root `404.html` disables Pages' automatic SPA
fallback so a missing aggregate URL returns 404 instead of the app shell.

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

## Target-specific finishing steps

Once Terry provides the account, hostname and existing project information:

1. Recheck #0007's lane and move In Progress before resuming. Identify the correct
   account and project, deployment mode and production branch. Preserve an
   existing Git-integrated Pages project rather than assuming it can become a
   Direct Upload project. Do not create resources to discover these answers.
2. Finish and review the target-specific configuration. Use the existing
   authorized login or arrange the concrete missing access privately. Do not
   put credentials into a card, source file or build artifact.
3. Retain the exact validated release bundle and manifest. Record its Git commit
   and the previous production deployment ID, if any. A Pages dashboard upload
   or pinned Wrangler direct upload can send this static directory; no Worker
   or Functions are needed.
4. Only after the separately required upload/resource authorization, deploy an
   approved preview or production target. Do not enable automatic Git deploys
   merely by connecting the repository. Verify all six views, historical links,
   aggregate hashes, cache headers, missing JSON, custom fonts, attribution,
   narrow layouts and keyboard behavior on the actual hosted URL.
5. Record the resulting deployment ID, hostname and verification. Finish the
   hosting card only when its target-specific acceptance criteria are satisfied.

For a later authorized Direct Upload, the concrete command will have this form
after replacing the target values with reviewed project settings:

```console
node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name APPROVED_PROJECT --branch APPROVED_BRANCH
```

Do not execute that template during local preparation. Pages supports distinct
Git integration and Direct Upload project modes; confirm the existing mode first.

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
