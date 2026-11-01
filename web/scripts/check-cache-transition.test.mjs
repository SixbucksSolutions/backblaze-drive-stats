import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkCacheTransition, checkCacheTransitionFiles } from './check-cache-transition.mjs';

const immutable = 'public, max-age=31536000, immutable';
const daily = 'public, max-age=86400, must-revalidate';
const oldPaths = [
  'assets/index-Abcd1234.js',
  'assets/index-Abcd1234.css',
  `assets/presentation-${'c'.repeat(64)}.json`,
  `data/production/2026-Q2-v2-${'a'.repeat(24)}/matrix.${'b'.repeat(64)}.json`,
  'fonts/InterVariable-4.1.woff2',
];
const asset = (path, cacheControl = immutable) => ({
  path,
  sizeBytes: 10,
  sha256: 'a'.repeat(64),
  cacheControl,
  served: true,
});
const release = () => ({
  formatVersion: 1,
  assets: [
    { ...asset('_headers'), served: false, cacheControl: null },
    asset('index.html', daily),
    asset('data/production/index.json', daily),
    ...oldPaths.map((path) => asset(path)),
  ],
});

test('allows mutable shell/index replacement and new assets while retaining every immutable URL', () => {
  const previous = release();
  const next = release();
  for (const record of next.assets.filter((entry) => entry.cacheControl === daily)) {
    record.sha256 = 'b'.repeat(64);
    record.sizeBytes = 20;
  }
  next.assets.push(asset('assets/newchunk-Bbcd1234.js'));
  assert.deepEqual(checkCacheTransition(previous, next), {
    status: 'compatible',
    immutableAssets: oldPaths.length,
    immutableBytes: oldPaths.length * 10,
  });
});

test('rejects removal, changed bytes and weaker freshness of each historical immutable class', () => {
  for (const path of oldPaths) {
    for (const defect of ['missing', 'size', 'digest', 'mutable', 'freshness']) {
      const next = release();
      const record = next.assets.find((entry) => entry.path === path);
      if (defect === 'missing') {
        next.assets = next.assets.filter((entry) => entry.path !== path);
      } else if (defect === 'size') {
        record.sizeBytes += 1;
      } else if (defect === 'digest') {
        record.sha256 = 'b'.repeat(64);
      } else {
        record.cacheControl = defect === 'mutable' ? daily : 'public, max-age=86400, immutable';
      }
      assert.throws(() => checkCacheTransition(release(), next), /immutable asset/i);
    }
  }
});

test('retains transitive history across two rapid replacements', () => {
  const first = release();
  const second = release();
  second.assets.push(asset('assets/second-Bbcd1234.js'));
  checkCacheTransition(first, second);
  const third = structuredClone(second);
  third.assets.push(asset('assets/third-Cbcd1234.js'));
  assert.equal(checkCacheTransition(second, third).immutableAssets, oldPaths.length + 1);
  third.assets = third.assets.filter((entry) => entry.path !== oldPaths[0]);
  assert.throws(() => checkCacheTransition(second, third), /missing/);
});

test('preserves effective shared freshness including the max-age fallback', () => {
  for (const [priorPolicy, nextPolicy, accepted] of [
    [immutable, 'public, max-age=31536000, s-maxage=0, immutable', false],
    [immutable, 'public, max-age=31536000, s-maxage=86400, immutable', false],
    [immutable, 'public, max-age=31536000, s-maxage=31536000, immutable', true],
    ['public, max-age=31536000, s-maxage=63072000, immutable', immutable, false],
    ['public, max-age=31536000, s-maxage=86400, immutable', immutable, true],
    [immutable, 'public, max-age=86400, s-maxage=63072000, immutable', false],
  ]) {
    const previous = release();
    const next = release();
    previous.assets.at(-1).cacheControl = priorPolicy;
    next.assets.at(-1).cacheControl = nextPolicy;
    if (accepted) {
      assert.equal(checkCacheTransition(previous, next).status, 'compatible');
    } else {
      assert.throws(() => checkCacheTransition(previous, next), /freshness weakened/);
    }
  }
});

test('validates both manifests and all records before comparing immutable inventories', () => {
  for (const mutate of [
    (manifest) => {
      manifest.formatVersion = 2;
    },
    (manifest) => {
      manifest.assets = [];
    },
    (manifest) => {
      manifest.assets.push(structuredClone(manifest.assets[1]));
    },
    ...[
      '../escape',
      '/absolute',
      'a/../b',
      'a//b',
      'a\\b',
      'a%2fb',
      'a?b',
      'a#b',
      'https://host/a',
    ].map((path) => (manifest) => {
      manifest.assets[1].path = path;
    }),
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '10'].map((size) => (manifest) => {
      manifest.assets[1].sizeBytes = size;
    }),
    (manifest) => {
      manifest.assets[1].sha256 = 'invalid';
    },
    (manifest) => {
      manifest.assets[1].served = 'true';
    },
    (manifest) => {
      manifest.assets[1].cacheControl = null;
    },
    (manifest) => {
      manifest.assets[0].served = true;
    },
    ...[
      '',
      'public, immutable',
      'public, max-age=0, immutable',
      'public, max-age=-1, immutable',
      'public, max-age=1.5, immutable',
      'public, max-age=60, max-age=90, immutable',
      'public, max-age=31536000, no-cache, immutable',
      'public, max-age=31536000, no-store, immutable',
      'private, max-age=31536000, immutable',
      'public, max-age=31536000, immutable=1',
    ].map((policy) => (manifest) => {
      manifest.assets[1].cacheControl = policy;
    }),
  ]) {
    for (const side of ['previous', 'next']) {
      const previous = release();
      const next = release();
      mutate(side === 'previous' ? previous : next);
      assert.throws(() => checkCacheTransition(previous, next));
    }
  }
  for (const value of [null, [], {}, { formatVersion: 1, assets: [null] }]) {
    assert.throws(() => checkCacheTransition(value, release()));
    assert.throws(() => checkCacheTransition(release(), value));
  }
});

test('file evidence binds exact manifest bytes and refuses malformed JSON', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'cache-transition-'));
  context.after(() => rm(directory, { recursive: true }));
  const previous = join(directory, 'previous.json');
  const next = join(directory, 'next.json');
  await writeFile(previous, JSON.stringify(release()));
  await writeFile(next, JSON.stringify(release(), null, 2));
  const result = await checkCacheTransitionFiles(previous, next);
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(result.previousManifestSha256, hash(await readFile(previous)));
  assert.equal(result.nextManifestSha256, hash(await readFile(next)));
  assert.notEqual(result.previousManifestSha256, result.nextManifestSha256);
  await writeFile(next, '{broken');
  await assert.rejects(checkCacheTransitionFiles(previous, next));
});
