// Package an already-qualified pristine release. This is not a source audit or an upload command.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkCacheTransition } from './check-cache-transition.mjs';

const immutable = 'public, max-age=31536000, immutable';
const maximumFiles = 20000;
const maximumAssetBytes = 25 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;
const built = /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|json)$/;
const capsule =
  /^assets\/presentation-\d{4}-Q[1-4]-(?:matrix|\d{4}-Q[1-4]-report)-[A-Za-z0-9_-]{8,}\.json$/;
const generation =
  /^data\/production\/\d{4}-Q[1-4]-v2-[a-f0-9]{24}\/(?:descriptor|matrix|\d{4}-Q[1-4])\.([a-f0-9]{64})\.json$/;
const fixedImmutable = new Set([
  'data/2026-Q2.json',
  'fonts/Inter-OFL-4.1.txt',
  'fonts/InterVariable-4.1.woff2',
  'fonts/JetBrainsMono-OFL-2.304.txt',
  'fonts/JetBrainsMono-Regular-2.304.woff2',
  'fonts/JetBrainsMono-SemiBold-2.304.woff2',
]);

function contained(root, path) {
  const from = relative(root, path);
  return (
    from === '' ||
    (!isAbsolute(from) &&
      from !== '..' &&
      !from.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))
  );
}

async function realDirectory(path) {
  const absolute = resolve(path);
  let ancestor = absolute;
  while (true) {
    const metadata = await lstat(ancestor);
    assert.ok(
      metadata.isDirectory() && !metadata.isSymbolicLink(),
      'Directory ancestors must not be links',
    );
    const parent = dirname(ancestor);
    if (parent === ancestor) {
      break;
    }
    ancestor = parent;
  }
  return realpath(absolute);
}

async function regularBytes(path, limit = Number.MAX_SAFE_INTEGER) {
  const metadata = await lstat(path);
  assert.ok(
    metadata.isFile() && !metadata.isSymbolicLink() && metadata.nlink === 1,
    'Expected regular unlinked file',
  );
  assert.ok(metadata.size <= limit, 'File exceeds byte limit');
  const bytes = await readFile(path);
  assert.equal(bytes.length, metadata.size, 'File changed while reading');
  return bytes;
}

async function readManifest(path, expectedSha256) {
  const absolute = resolve(path);
  await realDirectory(dirname(absolute));
  const bytes = await regularBytes(absolute, 16 * 1024 * 1024);
  const sha256 = digest(bytes);
  if (expectedSha256 !== undefined) {
    assert.match(expectedSha256, /^[a-f0-9]{64}$/, 'Expected prior manifest SHA-256 is mandatory');
    assert.equal(sha256, expectedSha256, 'Prior manifest differs from preflight SHA-256');
  }
  const manifest = JSON.parse(bytes.toString('utf8'));
  checkCacheTransition(manifest, manifest);
  assert.ok(manifest.assets.length <= maximumFiles, 'Release exceeds static file budget');
  const paths = new Set();
  for (const asset of manifest.assets) {
    assert.ok(asset.sizeBytes <= maximumAssetBytes, 'Asset exceeds static file size budget');
    assert.ok(safePath.test(asset.path), 'Unsafe asset path');
    const folded = asset.path.toLowerCase();
    assert.ok(!paths.has(folded), 'Duplicate or case-conflicting asset path');
    paths.add(folded);
  }
  return { manifest, sha256 };
}

async function verifyTree(directory, manifest) {
  const root = await realDirectory(directory);
  const expected = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const files = new Map();
  async function visit(directoryPath, prefix = '') {
    for (const name of await readdir(directoryPath)) {
      const path = `${prefix}${name}`;
      assert.ok(safePath.test(path), 'Unsafe tree path');
      const diskPath = resolve(directoryPath, name);
      const metadata = await lstat(diskPath);
      assert.ok(!metadata.isSymbolicLink(), 'Tree must not contain links or reparse points');
      if (metadata.isDirectory()) {
        assert.ok(
          manifest.assets.some((asset) => asset.path.startsWith(`${path}/`)),
          'Unexpected directory',
        );
        await visit(diskPath, `${path}/`);
      } else {
        const asset = expected.get(path);
        assert.ok(asset, `Unmanifested file: ${path}`);
        const bytes = await regularBytes(diskPath, maximumAssetBytes);
        assert.equal(bytes.length, asset.sizeBytes, `Asset size changed: ${path}`);
        assert.equal(digest(bytes), asset.sha256, `Asset SHA-256 changed: ${path}`);
        files.set(path, bytes);
      }
    }
  }
  await visit(root);
  assert.equal(files.size, expected.size, 'Manifest file missing');
  return { root, files };
}

// Both inventories are frozen from production preflight, outside the upload tree.
// A hash-looking filename alone never qualifies a Vite output for retention.
function predecessorKnownAssets(files, viteManifest) {
  const known = new Set();
  assert.ok(
    viteManifest && typeof viteManifest === 'object' && !Array.isArray(viteManifest),
    'Invalid prior Vite manifest',
  );
  assert.ok(
    Object.values(viteManifest).some((record) => record.isEntry),
    'Missing prior Vite entry',
  );
  for (const record of Object.values(viteManifest)) {
    assert.ok(
      record && typeof record === 'object' && typeof record.file === 'string',
      'Invalid prior Vite record',
    );
    for (const path of [record.file, ...(record.css ?? []), ...(record.assets ?? [])]) {
      assert.ok(built.test(path) || capsule.test(path), 'Unreviewed prior Vite output class');
      assert.ok(files.has(path), 'Missing prior Vite output');
      if (path.startsWith('assets/presentation-')) {
        assert.ok(capsule.test(path), 'Invalid Vite presentation capsule path');
      } else {
        known.add(path);
      }
    }
    for (const key of [...(record.imports ?? []), ...(record.dynamicImports ?? [])]) {
      assert.ok(Object.hasOwn(viteManifest, key), 'Missing prior Vite dependency');
    }
  }
  const html = files.get('index.html').toString('utf8');
  const catalogues = [
    ...html.matchAll(
      /<script\s+id="presentation-catalogue"\s+type="application\/json">([^<]*)<\/script>/g,
    ),
  ];
  assert.equal(catalogues.length, 1, 'Expected one predecessor presentation catalogue');
  const catalogue = JSON.parse(catalogues[0][1]);
  assert.ok(Array.isArray(catalogue.snapshots), 'Invalid predecessor catalogue');
  for (const snapshot of catalogue.snapshots) {
    assert.match(
      snapshot.asOfQuarter ?? '',
      /^\d{4}-Q[1-4]$/,
      'Invalid predecessor snapshot quarter',
    );
    for (const [name, ref] of [
      [`${snapshot.asOfQuarter}-matrix`, snapshot.matrix],
      ...snapshot.reports.map((report) => {
        assert.match(report.quarter ?? '', /^\d{4}-Q[1-4]$/, 'Invalid predecessor report quarter');
        return [`${snapshot.asOfQuarter}-${report.quarter}-report`, report.ref];
      }),
    ]) {
      assert.ok(
        typeof ref.path === 'string' && ref.path.startsWith('/'),
        'Invalid capsule reference',
      );
      const path = ref.path.slice(1);
      assert.ok(capsule.test(path), 'Invalid capsule path');
      assert.ok(
        path.startsWith(`assets/presentation-${name}-`),
        'Capsule path differs from catalogue snapshot or report',
      );
      const bytes = files.get(path);
      assert.ok(bytes, 'Missing predecessor capsule');
      assert.equal(bytes.length, ref.sizeBytes, 'Capsule size differs from catalogue');
      assert.equal(digest(bytes), ref.sha256, 'Capsule differs from catalogue');
      known.add(path);
    }
  }
  return known;
}

function allowedImmutable(asset, known) {
  assert.equal(asset.cacheControl, immutable, 'Unreviewed immutable cache policy');
  assert.equal(asset.served, true, 'Retained file must be served');
  const addressed = generation.exec(asset.path);
  if (addressed) {
    assert.equal(addressed[1], asset.sha256, 'Content-addressed filename differs from digest');
  }
  assert.ok(
    fixedImmutable.has(asset.path) ||
      generation.test(asset.path) ||
      ((built.test(asset.path) || capsule.test(asset.path)) && known.has(asset.path)),
    `Unqualified prior immutable class: ${asset.path}`,
  );
}

async function priorRetention(manifest, known, ledgerPath, expectedLedgerSha256) {
  if (!Object.hasOwn(manifest, 'retention')) {
    return;
  }
  const retention = manifest.retention;
  assert.deepEqual(
    Object.keys(retention).sort(),
    ['currentManifestSha256', 'formatVersion', 'previousManifestSha256', 'retainedAssets'].sort(),
    'Invalid retention ledger fields',
  );
  assert.equal(retention.formatVersion, 1, 'Invalid retention ledger version');
  for (const key of ['currentManifestSha256', 'previousManifestSha256']) {
    assert.match(retention[key], /^[a-f0-9]{64}$/, 'Invalid retention lineage');
  }
  assert.ok(Array.isArray(retention.retainedAssets), 'Invalid retention records');
  const inventory = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const seen = new Set();
  for (const asset of retention.retainedAssets) {
    assert.ok(!seen.has(asset.path), 'Duplicate retention record');
    seen.add(asset.path);
    assert.deepEqual(asset, inventory.get(asset.path), 'Forged retention record');
  }
  if (retention.retainedAssets.length > 0) {
    assert.ok(
      typeof ledgerPath === 'string' && ledgerPath.length > 0,
      'Prior retained assets require separately pinned retention ledger',
    );
    assert.match(
      expectedLedgerSha256 ?? '',
      /^[a-f0-9]{64}$/,
      'Expected prior retention ledger SHA-256 is mandatory',
    );
    await realDirectory(dirname(resolve(ledgerPath)));
    const bytes = await regularBytes(resolve(ledgerPath), 16 * 1024 * 1024);
    assert.equal(
      digest(bytes),
      expectedLedgerSha256,
      'Prior retention ledger differs from preflight SHA-256',
    );
    assert.deepEqual(
      JSON.parse(bytes.toString('utf8')),
      retention,
      'Prior retention ledger differs from manifest records or lineage',
    );
  }
  // Only independently pinned qualification evidence may establish membership.
  for (const asset of retention.retainedAssets) {
    known.add(asset.path);
    allowedImmutable(asset, known);
  }
}

export async function packageCacheCompatibleRelease(options) {
  const {
    currentDirectory,
    currentManifestPath,
    previousDirectory,
    previousManifestPath,
    expectedPreviousManifestSha256,
    previousViteManifestPath,
    expectedPreviousViteManifestSha256,
    previousRetentionLedgerPath,
    expectedPreviousRetentionLedgerSha256,
    outputDirectory,
  } = options;
  assert.match(
    expectedPreviousManifestSha256 ?? '',
    /^[a-f0-9]{64}$/,
    'Expected prior manifest SHA-256 is mandatory',
  );
  assert.match(
    expectedPreviousViteManifestSha256 ?? '',
    /^[a-f0-9]{64}$/,
    'Expected prior Vite manifest SHA-256 is mandatory',
  );
  await realDirectory(dirname(resolve(previousViteManifestPath)));
  const viteBytes = await regularBytes(resolve(previousViteManifestPath), 16 * 1024 * 1024);
  assert.equal(
    digest(viteBytes),
    expectedPreviousViteManifestSha256,
    'Prior Vite manifest differs from preflight SHA-256',
  );
  const viteManifest = JSON.parse(viteBytes.toString('utf8'));
  const current = await readManifest(currentManifestPath);
  assert.ok(!Object.hasOwn(current.manifest, 'retention'), 'Current manifest must be pristine');
  const previous = await readManifest(previousManifestPath, expectedPreviousManifestSha256);
  const currentTree = await verifyTree(currentDirectory, current.manifest);
  const previousTree = await verifyTree(previousDirectory, previous.manifest);
  const requestedOutput = resolve(outputDirectory);
  const parent = await realDirectory(dirname(requestedOutput));
  const output = resolve(parent, basename(requestedOutput));
  for (const root of [currentTree.root, previousTree.root]) {
    assert.ok(
      !contained(root, output) && !contained(output, root),
      'Output must be separate from input trees',
    );
  }
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const path of ['public', 'dist']) {
    assert.ok(
      !contained(resolve(webRoot, path), output),
      'Keep private output outside public and dist',
    );
  }
  for (const path of [
    currentManifestPath,
    previousManifestPath,
    previousViteManifestPath,
    previousRetentionLedgerPath,
  ].filter((path) => path !== undefined)) {
    assert.ok(!contained(output, resolve(path)), 'Output must not contain input evidence');
  }
  const known = predecessorKnownAssets(previousTree.files, viteManifest);
  await priorRetention(
    previous.manifest,
    known,
    previousRetentionLedgerPath,
    expectedPreviousRetentionLedgerSha256,
  );
  const assets = new Map(current.manifest.assets.map((asset) => [asset.path, asset]));
  const retainedAssets = [];
  for (const asset of previous.manifest.assets) {
    if (!asset.cacheControl?.split(',').some((part) => part.trim() === 'immutable')) {
      continue;
    }
    allowedImmutable(asset, known);
    const present = assets.get(asset.path);
    if (present) {
      assert.equal(present.sizeBytes, asset.sizeBytes, 'Shared immutable size conflict');
      assert.equal(present.sha256, asset.sha256, 'Shared immutable digest conflict');
    } else {
      assert.ok(
        ![...assets.keys()].some((path) => path.toLowerCase() === asset.path.toLowerCase()),
        'Case-conflicting retained path',
      );
      assets.set(asset.path, asset);
      retainedAssets.push(asset);
    }
  }
  const manifest = {
    formatVersion: 1,
    assets: [...assets.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')),
    retention: {
      formatVersion: 1,
      currentManifestSha256: current.sha256,
      previousManifestSha256: previous.sha256,
      retainedAssets,
    },
  };
  assert.ok(manifest.assets.length <= maximumFiles, 'Retained union exceeds static file budget');
  const transition = checkCacheTransition(previous.manifest, manifest);
  // mkdir is deliberately exclusive; failure never overwrites or cleans evidence.
  await mkdir(output);
  const uploadDirectory = resolve(output, 'upload');
  await mkdir(uploadDirectory);
  for (const asset of manifest.assets) {
    const target = resolve(uploadDirectory, asset.path);
    await mkdir(dirname(target), { recursive: true });
    const bytes = currentTree.files.get(asset.path) ?? previousTree.files.get(asset.path);
    await writeFile(target, bytes, { flag: 'wx' });
  }
  await verifyTree(uploadDirectory, manifest);
  const manifestPath = resolve(output, 'release-manifest.json');
  const retentionLedgerPath = resolve(output, 'retention-ledger.json');
  const ledgerBytes = Buffer.from(`${JSON.stringify(manifest.retention, null, 2)}\n`);
  await writeFile(retentionLedgerPath, ledgerBytes, { flag: 'wx' });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return {
    uploadDirectory,
    manifestPath,
    manifestSha256: digest(await regularBytes(manifestPath)),
    retentionLedgerPath,
    retentionLedgerSha256: digest(ledgerBytes),
    retainedAssets: retainedAssets.length,
    transition,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(
    process.argv.length === 10 || process.argv.length === 12,
    'Usage: package-cache-compatible-release.mjs current-dist current-manifest previous-bundle previous-manifest expected-previous-manifest-sha256 previous-vite-manifest expected-previous-vite-manifest-sha256 fresh-private-output [previous-retention-ledger expected-previous-retention-ledger-sha256]',
  );
  const [
    currentDirectory,
    currentManifestPath,
    previousDirectory,
    previousManifestPath,
    expectedPreviousManifestSha256,
    previousViteManifestPath,
    expectedPreviousViteManifestSha256,
    outputDirectory,
    previousRetentionLedgerPath,
    expectedPreviousRetentionLedgerSha256,
  ] = process.argv.slice(2);
  console.log(
    JSON.stringify(
      await packageCacheCompatibleRelease({
        currentDirectory,
        currentManifestPath,
        previousDirectory,
        previousManifestPath,
        expectedPreviousManifestSha256,
        previousViteManifestPath,
        expectedPreviousViteManifestSha256,
        outputDirectory,
        previousRetentionLedgerPath,
        expectedPreviousRetentionLedgerSha256,
      }),
    ),
  );
}
