// Read-only public GET probes for the approved Pages project; never authenticates or deploys.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertErrorCachePolicy, checkHostingRelease } from './check-hosting-release.mjs';

const projectHost = 'backblaze-drive-stats-analysis.pages.dev';
const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const allowedOrigin = new RegExp(
  `^https://(?:${label}\\.)?${projectHost.replaceAll('.', '\\.')}(:443)?/?$`,
  'i',
);

export function validateRemoteOrigin(value) {
  assert.ok(
    typeof value === 'string' && value === value.trim() && allowedOrigin.test(value),
    'Remote probes require the approved HTTPS Pages project root or one deployment/branch label',
  );
  return new URL(value);
}

function mediaType(path) {
  if (path.endsWith('.json')) {
    return /^application\/json(?:\s*;|$)/i;
  }
  if (path.endsWith('.js')) {
    return /^(?:application|text)\/javascript(?:\s*;|$)/i;
  }
  if (path.endsWith('.css')) {
    return /^text\/css(?:\s*;|$)/i;
  }
  if (path.endsWith('.woff2')) {
    return /^font\/woff2(?:\s*;|$)/i;
  }
  if (path.endsWith('.html')) {
    return /^text\/html(?:\s*;|$)/i;
  }
  return null;
}

async function verifyBody(response, asset, errorResponse = false) {
  const cache = response.headers.get('cache-control');
  if (errorResponse) {
    assertErrorCachePolicy(cache);
  } else {
    assert.equal(cache, asset.cacheControl, 'Hosted cache policy differs');
  }
  const type = mediaType(asset.path);
  if (type) {
    assert.match(response.headers.get('content-type') ?? '', type, 'Hosted media type differs');
  }
  assert.ok(response.body, 'Hosted asset body is missing');
  // Fetch decodes transport compression. Count and hash those decoded release bytes,
  // rather than trusting Content-Length (which may describe the compressed body).
  const reader = response.body.getReader();
  const hash = createHash('sha256');
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      assert.ok(size <= asset.sizeBytes, 'Hosted asset exceeds reviewed byte size');
      hash.update(value);
    }
    assert.equal(size, asset.sizeBytes, 'Hosted asset size differs');
    assert.equal(hash.digest('hex'), asset.sha256, 'Hosted asset hash differs');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return size;
}

export async function checkHostingRemote(manifest, baseUrl, request = fetch) {
  const base = validateRemoteOrigin(baseUrl);
  assert.ok(
    Array.isArray(manifest.assets) && manifest.assets.length,
    'Release inventory is missing',
  );
  const paths = new Set();
  for (const asset of manifest.assets) {
    assert.ok(
      typeof asset.path === 'string' &&
        asset.path === asset.path.trim() &&
        /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(asset.path) &&
        !paths.has(asset.path) &&
        Number.isSafeInteger(asset.sizeBytes) &&
        asset.sizeBytes >= 0 &&
        /^[a-f0-9]{64}$/.test(asset.sha256) &&
        asset.served === (asset.path !== '_headers') &&
        (asset.served ? typeof asset.cacheControl === 'string' : asset.cacheControl === null),
      'Release inventory entry is invalid',
    );
    paths.add(asset.path);
  }
  const html = manifest.assets.find((asset) => asset.path === 'index.html');
  const notFound = manifest.assets.find((asset) => asset.path === '404.html');
  assert.ok(
    html && notFound && paths.has('_headers'),
    'Required hosting inventory entries are missing',
  );
  const result = { assets: 0, assetBytes: 0, navigation: 0, missing: 0, redirects: 0 };
  const get = (path, accept) =>
    request(new URL(path, base), {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      ...(accept ? { headers: { Accept: accept } } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  async function canonical(response, source, destination) {
    try {
      assert.ok([307, 308].includes(response.status), 'Canonical HTML redirect is missing');
      const location = response.headers.get('location');
      assert.ok(location, 'Canonical redirect location is missing');
      const target = new URL(location, new URL(source, base));
      assert.equal(target.origin, base.origin, 'Canonical redirect changed origin');
      assert.ok(
        !target.username && !target.password && !target.hash,
        'Canonical redirect is unsafe',
      );
      assert.equal(
        `${target.pathname}${target.search}`,
        destination,
        'Canonical redirect changed navigation',
      );
      result.redirects += 1;
    } finally {
      await response.body?.cancel();
    }
  }
  const served = manifest.assets.filter((asset) => asset.served);
  let next = 0;
  // Complete at most four probes at once; all workers settle before reporting failure.
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(4, served.length) }, async () => {
      while (next < served.length) {
        const asset = served[next++];
        const path = asset.path === 'index.html' ? '/' : `/${asset.path}`;
        let response = await get(path);
        if (asset.path.endsWith('.html') && asset.path !== 'index.html') {
          const target = `/${asset.path.slice(0, -5)}`;
          await canonical(response, path, target);
          response = await get(target);
        }
        try {
          assert.equal(response.status, 200, 'Hosted release asset did not return 200');
          const verifiedBytes = await verifyBody(response, asset);
          result.assetBytes += verifiedBytes;
          result.assets += 1;
        } finally {
          if (!response.body?.locked) {
            await response.body?.cancel();
          }
        }
      }
    }),
  );
  const failed = workers.find((worker) => worker.status === 'rejected');
  if (failed) {
    throw failed.reason;
  }
  for (const query of [
    '?view=matrix&reference=1',
    '?view=explore&report=distribution&snapshot=2025-Q4',
    '?view=matrix&snapshot=2013-Q2-v2-c7f86b91d0bbd7f5cca8b6f8',
    '?view=capacity&snapshot=2026-Q2-v2-e5e750b334c69fddd974556c&quarter=2026-Q2',
  ]) {
    const response = await get(`/${query}`);
    try {
      assert.equal(response.status, 200, 'Navigation root did not return 200');
      await verifyBody(response, html);
      result.navigation += 1;
    } finally {
      if (!response.body?.locked) {
        await response.body?.cancel();
      }
    }
    await canonical(await get(`/index.html${query}`), `/index.html${query}`, `/${query}`);
    await canonical(await get(`/404.html${query}`), `/404.html${query}`, `/404${query}`);
  }
  for (const path of [
    '/_headers',
    '/.env',
    '/private/summary.json',
    '/data/missing.json',
    '/data/production/missing/descriptor.json',
    '/assets/missing-abcdefgh.js',
    '/assets/presentation-missing-abcdefgh.json',
    '/fonts/missing.woff2',
    '/unknown-view',
  ]) {
    for (const accept of ['text/html', 'application/json']) {
      const response = await get(path, accept);
      try {
        assert.equal(response.status, 404, 'Missing/private asset must return a genuine 404');
        await verifyBody(response, notFound, true);
        result.missing += 1;
      } finally {
        if (!response.body?.locked) {
          await response.body?.cancel();
        }
      }
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: check-hosting-remote.mjs https://<approved-project>.pages.dev',
  );
  validateRemoteOrigin(process.argv[2]);
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = await checkHostingRelease(webRoot);
  const result = await checkHostingRemote(manifest, process.argv[2]);
  console.log(`Remote Pages release verified: ${JSON.stringify(result)}`);
}
