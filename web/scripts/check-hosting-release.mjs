// Inspect only the public release tree, never daily source data or caches.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format } from 'prettier';
import { checkProductionData } from './check-production-data.mjs';

export const immutable = 'public, max-age=31536000, immutable';
const shortCache = 'public, max-age=300, must-revalidate';
const fontFiles = [
  'Inter-OFL-4.1.txt',
  'InterVariable-4.1.woff2',
  'JetBrainsMono-OFL-2.304.txt',
  'JetBrainsMono-Regular-2.304.woff2',
  'JetBrainsMono-SemiBold-2.304.woff2',
  'NOTICE.txt',
  'provenance.json',
];
const generationFile =
  /^data\/production\/\d{4}-Q[1-4]-v2-[a-f0-9]{24}\/(?:descriptor|matrix|\d{4}-Q[1-4])\.[a-f0-9]{64}\.json$/;
const builtAsset = /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|json)$/;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function cachePolicy(path) {
  if (generationFile.test(path) || builtAsset.test(path)) {
    return immutable;
  }
  return path === 'data/2026-Q2.json' ? shortCache : 'no-cache';
}

// Disjoint rules matter: Cloudflare joins duplicate header values with commas.
export const headerRules = [
  ['/', 'no-cache'],
  ['/index.html', 'no-cache'],
  ['/404.html', 'no-cache'],
  ['/data/index.json', 'no-cache'],
  ['/data/2026-Q2.json', shortCache],
  ['/data/production/index.json', 'no-cache'],
  ['/data/production/:generation/*.json', immutable],
  ['/assets/*', immutable],
  ['/fonts/*', 'no-cache'],
];

export function assertHostingPolicy(config, headers) {
  assert.deepEqual(
    config,
    {
      $schema: './node_modules/wrangler/config-schema.json',
      name: 'backblaze-drive-stats-local',
      compatibility_date: '2026-10-23',
      pages_build_output_dir: './dist',
    },
    'Hosting template must remain static Pages without Functions until its target is approved',
  );
  const expected = headerRules.flatMap(([path, policy]) => [path, `Cache-Control: ${policy}`]);
  const actual = headers
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  assert.deepEqual(actual, expected, 'Release cache rules differ from reviewed hosting policy');
}

export async function hostingFiles(directory, prefix = '') {
  const root = await lstat(directory);
  assert.ok(root.isDirectory() && !root.isSymbolicLink(), 'Release root must be a real directory');
  const result = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Release assets must not contain symlinks');
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      for (const [name, bytes] of await hostingFiles(resolve(directory, entry.name), `${path}/`)) {
        result.set(name, bytes);
      }
    } else {
      assert.ok(entry.isFile(), 'Release assets must be regular files');
      result.set(path, await readFile(resolve(directory, entry.name)));
    }
  }
  return result;
}

// Public JSON's schema, reachable graph and content hashes are checked separately
// through the production browser reader. This audit enforces the package boundary.
export function auditHostingInventory(publicFiles, distFiles, buildManifest) {
  const required = [
    '_headers',
    '404.html',
    'data/index.json',
    'data/2026-Q2.json',
    'data/production/index.json',
  ];
  required.push(...fontFiles.map((file) => `fonts/${file}`));
  for (const path of required) {
    assert.ok(publicFiles.has(path), 'Required public data or attribution asset is missing');
  }
  for (const [path, bytes] of publicFiles) {
    assert.ok(required.includes(path) || generationFile.test(path), 'Unexpected public asset');
    assert.ok(distFiles.has(path), 'Public asset is missing from dist');
    assert.ok(bytes.equals(distFiles.get(path)), 'Public asset bytes changed during packaging');
  }
  assert.ok(distFiles.has('index.html'), 'Built application HTML is missing');
  assert.ok(
    buildManifest && typeof buildManifest === 'object' && !Array.isArray(buildManifest),
    'Vite build manifest is missing',
  );
  const outputs = new Set();
  for (const record of Object.values(buildManifest)) {
    assert.ok(
      record && typeof record === 'object' && typeof record.file === 'string',
      'Invalid Vite manifest record',
    );
    for (const path of [record.file, ...(record.css ?? []), ...(record.assets ?? [])]) {
      assert.ok(
        builtAsset.test(path) && distFiles.has(path),
        'Invalid or missing manifested build asset',
      );
      outputs.add(path);
    }
    for (const key of [...(record.imports ?? []), ...(record.dynamicImports ?? [])]) {
      assert.ok(Object.hasOwn(buildManifest, key), 'Vite manifest dependency is missing');
    }
  }
  assert.ok(
    Object.values(buildManifest).some((record) => record.isEntry),
    'Vite manifest entry is missing',
  );
  const html = distFiles.get('index.html').toString('utf8');
  const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)"/g)].map((match) => match[1]);
  assert.ok(
    assets.some((path) => path.endsWith('.js')),
    'Built script reference is missing',
  );
  assert.ok(
    assets.some((path) => path.endsWith('.css')),
    'Built stylesheet reference is missing',
  );
  for (const path of assets) {
    assert.ok(outputs.has(path), 'HTML references an unmanifested built asset');
  }
  const expected = new Set([...publicFiles.keys(), 'index.html', ...outputs]);
  assert.deepEqual(
    [...distFiles.keys()].sort(),
    [...expected].sort(),
    'Dist contains missing or unadvertised files (including private or stale assets)',
  );
  return [...distFiles]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([path, bytes]) => ({
      path,
      sizeBytes: bytes.length,
      sha256: digest(bytes),
      cacheControl: path === '_headers' ? null : cachePolicy(path),
      served: path !== '_headers',
    }));
}

export async function checkHostingRelease(webRoot, distDirectory = resolve(webRoot, 'dist')) {
  try {
    await lstat(resolve(webRoot, 'functions'));
    assert.fail('Static Pages release must not contain a Functions directory');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  const headers = await readFile(resolve(webRoot, 'public/_headers'), 'utf8');
  // The reviewed template contains JSON with optional trailing commas. Use the
  // locked formatter's JSON parser rather than assuming TypeScript 7's old API.
  const config = JSON.parse(
    await format(await readFile(resolve(webRoot, 'wrangler.jsonc'), 'utf8'), {
      parser: 'json',
      trailingComma: 'none',
    }),
  );
  assertHostingPolicy(config, headers);
  const publicFiles = await hostingFiles(resolve(webRoot, 'public'));
  const buildManifest = JSON.parse(
    await readFile(resolve(webRoot, 'hosting-vite-manifest.json'), 'utf8'),
  );
  const manifest = auditHostingInventory(
    publicFiles,
    await hostingFiles(distDirectory),
    buildManifest,
  );
  await checkProductionData(resolve(distDirectory, 'data/production'), {
    latestQuarter: '2026-Q2',
    quarters: ['2026-Q2', '2025-Q3', '2025-Q4'],
  });
  return { formatVersion: 1, assets: manifest };
}

export async function writeHostingEvidence(webRoot, outputPath, manifest) {
  const output = resolve(outputPath);
  const parent = await realpath(dirname(output));
  const canonical = resolve(parent, basename(output));
  for (const root of ['public', 'dist']) {
    const fromRoot = relative(await realpath(resolve(webRoot, root)), canonical);
    assert.ok(
      fromRoot &&
        (isAbsolute(fromRoot) ||
          fromRoot === '..' ||
          fromRoot.startsWith('../') ||
          fromRoot.startsWith('..\\')),
      'Keep release evidence outside both public source and served dist',
    );
  }
  try {
    const existing = await lstat(canonical);
    assert.ok(
      existing.isFile() && !existing.isSymbolicLink(),
      'Evidence target must be a regular file',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  // Write through the resolved parent, then replace the directory entry rather
  // than following an existing target link. Only this exclusive temp is cleaned.
  const temporary = resolve(parent, `.hosting-${randomUUID()}.tmp`);
  let created = false;
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    created = true;
    await rename(temporary, canonical);
    created = false;
  } finally {
    if (created) {
      await unlink(temporary);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(process.argv.length <= 3, 'Usage: check-hosting-release.mjs [manifest-output.json]');
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = await checkHostingRelease(webRoot);
  if (process.argv[2]) {
    await writeHostingEvidence(webRoot, process.argv[2], manifest);
  }
  console.log(
    `Hosting release verified: ${manifest.assets.length} files, exact public bytes and reachable production graph.`,
  );
}
