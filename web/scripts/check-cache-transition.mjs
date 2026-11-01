// Compare qualified release inventories; never copies assets or authorizes upload.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const maxManifestBytes = 16 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function immutableFreshness(policy) {
  const directives = new Map();
  for (const part of policy.split(',')) {
    const match = /^\s*([a-z][a-z0-9-]*)(?:=(\d+|"\d+"))?\s*$/i.exec(part);
    assert.ok(match, 'Invalid cache directive');
    const name = match[1].toLowerCase();
    assert.ok(!directives.has(name), 'Duplicate cache directive');
    directives.set(name, match[2]?.replaceAll('"', '') ?? null);
  }
  for (const name of ['max-age', 's-maxage']) {
    if (directives.has(name)) {
      assert.ok(
        directives.get(name) !== null && Number.isSafeInteger(Number(directives.get(name))),
        'Invalid cache freshness',
      );
    }
  }
  if (!directives.has('immutable')) {
    return null;
  }
  const freshness = Number(directives.get('max-age'));
  assert.ok(
    directives.get('immutable') === null &&
      directives.get('public') === null &&
      freshness > 0 &&
      !['no-cache', 'no-store', 'private'].some((name) => directives.has(name)),
    'Immutable assets require public positive freshness without restrictive directives',
  );
  return {
    browser: freshness,
    shared: directives.has('s-maxage') ? Number(directives.get('s-maxage')) : freshness,
  };
}

function inventory(manifest) {
  assert.ok(
    manifest &&
      typeof manifest === 'object' &&
      !Array.isArray(manifest) &&
      manifest.formatVersion === 1 &&
      Array.isArray(manifest.assets) &&
      manifest.assets.length > 0,
    'Invalid hosting manifest',
  );
  const result = new Map();
  for (const asset of manifest.assets) {
    assert.ok(asset && typeof asset === 'object' && !Array.isArray(asset), 'Invalid asset record');
    assert.ok(
      typeof asset.path === 'string' &&
        /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(asset.path),
      'Unsafe asset path',
    );
    assert.ok(!result.has(asset.path), 'Duplicate asset path');
    assert.ok(Number.isSafeInteger(asset.sizeBytes) && asset.sizeBytes >= 0, 'Invalid asset size');
    assert.match(asset.sha256 ?? '', /^[a-f0-9]{64}$/, 'Invalid asset SHA-256');
    assert.equal(typeof asset.served, 'boolean', 'Invalid served flag');
    assert.ok(
      asset.served
        ? typeof asset.cacheControl === 'string' && asset.cacheControl.length > 0
        : asset.path === '_headers' && asset.cacheControl === null,
      'Invalid asset cache policy',
    );
    assert.equal(asset.served, asset.path !== '_headers', 'Invalid hosting control-file exposure');
    result.set(asset.path, {
      ...asset,
      freshness: asset.served ? immutableFreshness(asset.cacheControl) : null,
    });
  }
  return result;
}

export function checkCacheTransition(previous, next) {
  const before = inventory(previous);
  const after = inventory(next);
  let immutableAssets = 0;
  let immutableBytes = 0;
  for (const [path, asset] of before) {
    if (asset.freshness === null) {
      continue;
    }
    const replacement = after.get(path);
    assert.ok(replacement?.served, `Prior immutable asset is missing: ${path}`);
    assert.equal(replacement.sizeBytes, asset.sizeBytes, `Immutable asset size changed: ${path}`);
    assert.equal(replacement.sha256, asset.sha256, `Immutable asset SHA-256 changed: ${path}`);
    assert.ok(
      replacement.freshness !== null &&
        replacement.freshness.browser >= asset.freshness.browser &&
        replacement.freshness.shared >= asset.freshness.shared,
      `Immutable asset freshness weakened: ${path}`,
    );
    immutableAssets += 1;
    immutableBytes += asset.sizeBytes;
    assert.ok(Number.isSafeInteger(immutableBytes), 'Immutable byte total exceeds safe precision');
  }
  return { status: 'compatible', immutableAssets, immutableBytes };
}

async function readManifest(path) {
  const metadata = await lstat(path);
  assert.ok(
    metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= maxManifestBytes,
    'Hosting manifest must be a bounded regular file',
  );
  const bytes = await readFile(path);
  assert.ok(bytes.length <= maxManifestBytes, 'Hosting manifest exceeds byte limit');
  return { manifest: JSON.parse(bytes.toString('utf8')), sha256: digest(bytes) };
}

export async function checkCacheTransitionFiles(previousPath, nextPath) {
  const previous = await readManifest(previousPath);
  const next = await readManifest(nextPath);
  return {
    ...checkCacheTransition(previous.manifest, next.manifest),
    previousManifestSha256: previous.sha256,
    nextManifestSha256: next.sha256,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(
    process.argv.length,
    4,
    'Usage: check-cache-transition.mjs previous-verified-manifest.json next-verified-manifest.json',
  );
  console.log(JSON.stringify(await checkCacheTransitionFiles(process.argv[2], process.argv[3])));
}
