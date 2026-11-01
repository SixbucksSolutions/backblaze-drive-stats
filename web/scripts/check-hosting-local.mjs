// Probe a separately started Wrangler local server; never starts or deploys one.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkHostingRelease } from './check-hosting-release.mjs';

export async function checkHostingLocal(manifest, baseUrl, request = fetch) {
  const base = new URL(baseUrl);
  assert.ok(
    base.protocol === 'http:' &&
      ['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname) &&
      base.pathname === '/' &&
      !base.search &&
      !base.hash &&
      !base.username &&
      !base.password,
    'Hosting probes require an explicit HTTP loopback root URL',
  );
  const html = manifest.assets.find((asset) => asset.path === 'index.html');
  assert.ok(html, 'HTML inventory entry is missing');
  const representatives = [
    'data/index.json',
    'data/2026-Q2.json',
    'data/production/index.json',
    ...manifest.assets
      .filter((asset) => asset.path.startsWith('fonts/'))
      .map((asset) => asset.path),
    ...['js', 'css', 'json'].map(
      (extension) =>
        manifest.assets.find(
          (asset) => asset.path.startsWith('assets/') && asset.path.endsWith(`.${extension}`),
        )?.path,
    ),
    manifest.assets.find((asset) => /^data\/production\/.+\/.+\.json$/.test(asset.path))?.path,
  ];
  assert.ok(representatives.every(Boolean), 'Release lacks a representative hosting asset');
  const probes = [
    ['/', html],
    ['/?view=matrix&reference=1', html],
    ['/?view=explore&report=distribution&snapshot=2025-Q4', html],
    ...representatives.map((path) => [
      `/${path}`,
      manifest.assets.find((asset) => asset.path === path),
    ]),
  ];
  for (const [path, asset] of probes) {
    const response = await request(new URL(path, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, 'Hosted release asset did not return 200');
    assert.equal(
      response.headers.get('cache-control'),
      asset.cacheControl,
      'Hosted cache policy differs',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.length, asset.sizeBytes, 'Hosted asset size differs');
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      asset.sha256,
      'Hosted asset hash differs',
    );
    if (path.includes('.json')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /application\/json/i,
        'JSON returned a different media type',
      );
    } else if (asset.path.endsWith('.js')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /(?:application|text)\/javascript/i,
        'JavaScript media type is invalid',
      );
    } else if (asset.path.endsWith('.css')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /text\/css/i,
        'Stylesheet media type is invalid',
      );
    } else if (asset.path.endsWith('.woff2')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /font\/woff2/i,
        'Font media type is invalid',
      );
    } else if (asset.path.endsWith('.html')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /text\/html/i,
        'HTML media type is invalid',
      );
    }
  }
  const redirect = await request(new URL('/index.html?view=matrix&reference=1', base), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  assert.ok([307, 308].includes(redirect.status), 'Canonical index redirect is missing');
  const target = new URL(redirect.headers.get('location'), base);
  assert.equal(target.origin, base.origin, 'Canonical redirect changed origin');
  assert.equal(
    `${target.pathname}${target.search}`,
    '/?view=matrix&reference=1',
    'Canonical redirect lost navigation query',
  );
  for (const path of [
    '/_headers',
    '/.env',
    '/private/summary.json',
    '/data/missing.json',
    '/data/production/missing/descriptor.json',
    '/unknown-view',
  ]) {
    for (const accept of ['text/html', 'application/json']) {
      const response = await request(new URL(path, base), {
        redirect: 'manual',
        headers: { Accept: accept },
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(
        response.status,
        404,
        'Missing/private asset must return 404 without an HTML fallback',
      );
    }
  }
  return { assets: probes.length, missing: 12, redirects: 1 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 3, 'Usage: check-hosting-local.mjs http://127.0.0.1:8787');
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = await checkHostingRelease(webRoot);
  const result = await checkHostingLocal(manifest, process.argv[2]);
  console.log(`Local Cloudflare hosting verified: ${JSON.stringify(result)}`);
}
