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
| Root HTML, production/legacy indexes, unversioned font notice/provenance | `public, max-age=86400, must-revalidate` |
| Content-addressed production JSON and Vite assets | `public, max-age=31536000, immutable` |
| Dated legacy quarter JSON, versioned fonts and OFL licenses | `public, max-age=31536000, immutable` |
| Canonical 404 page and missing/private responses | Revalidation or non-storage; no positive freshness |

Successful unversioned URLs stay fresh for at least 24 hours. `must-revalidate`
applies after that period, not on every visit. A cached page can therefore show
the previous latest-snapshot catalogue for a day after publication; that is the
owner-selected freshness policy. Historical data use versioned URLs whose bytes
must never change. The one-year immutable policy encourages long-lived reuse;
it cannot force a browser or CDN to retain an object forever.

`Cache-Control: public` also supplies freshness instructions to shared caches.
Pages already provides [built-in Tiered Cache](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance)
and transport compression. JSON and fonts expose native ETags; the current HTML
delivery path does not, as described below. This package does not add account-level cache
rules or a Worker. Actual edge residency is separate from browser freshness and
can end before a TTL; observed edge hits are verification evidence, not a promise
of permanent residency. Cloudflare's default cache key includes the
[full URI and query string](https://developers.cloudflare.com/cache/how-to/cache-keys/).
The root HTML is identical across our query selections; the inline bootstrap
chooses the exact versioned data URL. No timestamp cache-busting is added.

Rules are disjoint because Cloudflare joins repeated header values. The local
probe checks actual response headers, content types, bodies and hashes, query
navigation and absent/private paths. Local checks cannot establish the eventual
account's DNS, TLS, cache-rule overrides or live CDN behavior. The probe accepts
loopback URLs only. After an authorized upload, verify the same properties on
the actual approved preview/hostname with read-only HTTP and browser checks.

### HTML reload validation (#0112)

Normal navigation can reuse fresh HTML locally. Chrome reloads instead send
`Cache-Control: max-age=0` and ask for validation. In this Pages configuration,
HTML responses do not expose ETag or Last-Modified, even though the native asset
service accepts its exact strong/weak asset key and returns an empty `304`.

Actual Pages previews tested native ETag overrides, Last-Modified, targeted CDN
headers and two HTML versions. With transforms allowed, overridden ETags were
still stripped; displayed
Last-Modified did not cause conditional `304`s. Ordinary `no-transform` restored
the native ETag and automatic Chrome revalidation, but also disabled HTML gzip
and Brotli. No validated static-only option preserving both was found.

For the same preview HTML, raw encoded bodies measured about 95 KB with Brotli
and 352 KB with `no-transform`; the latter's unchanged conditional response had
no body. Those are body-byte measurements, excluding headers, not a latency
comparison. Chrome/Lighthouse automatically supplied the validator in a forced
revalidation diagnostic; this was not a manual UI reload test. Changed HTML
rejected the previous validator and returned its new body.

Terry selected retaining compressed HTML on #0112. Production keeps the 24-hour
HTML cache policy; explicit reloads may still download compressed HTML. The
investigation is resolved without an application or production configuration change.
The tested but unadopted `no-transform` candidate needs
no custom hashing or Worker: Pages already stores and compares its uploaded asset
key. Diagnostic use of Wrangler's existing BLAKE3 dependency added no installation
or browser dependency. Detailed evidence is retained in `data/staging/0112/` and
`data/staging/0112-preview/`.

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
   Compare the new inventory with the verified manifest belonging to the actual
   successful predecessor deployment:

   ```console
   npm run check:cache-transition -- PREVIOUS-VERIFIED-MANIFEST.json NEW-VERIFIED-MANIFEST.json
   ```

   Retain the JSON result privately, including both manifest hashes. Every prior
   immutable URL must still exist with the same size/hash and at least its prior
   browser and shared-cache freshness. Changing mutable HTML or an index is
   allowed. This supplements the normal exact-inventory and canonical-data audits;
   it does not replace them or permit arbitrary stale files. Run it again against
   the exact upload manifest immediately before publication.

   #0109 changes headers only, so all existing asset bytes already carry forward.
   If a future build drops an old hashed chunk, stylesheet or capsule, stop and
   package the previously qualified immutable files alongside the new release.
   Their separately validated inventory must form an exact union with the current
   release; do not weaken the public-file allowlist to accept arbitrary extras.
   That requires a separately scoped retention implementation: today's exact
   inventory gate deliberately rejects unmanifested previous files. Recheck that
   publication's resource/file limits before upload.
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

Browser-cached HTML is not purged by a Pages rollback. If a newer release added
immutable files absent from the rollback target, refresh that cached page or
publish the prior shell with the qualified immutable files from both releases.
#0109's headers-only release and its predecessor share every asset, so their
rollback does not introduce that mismatch.

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
