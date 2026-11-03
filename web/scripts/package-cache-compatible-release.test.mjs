import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { packageCacheCompatibleRelease } from './package-cache-compatible-release.mjs';

const immutable = 'public, max-age=31536000, immutable';
const daily = 'public, max-age=86400, must-revalidate';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldChunk = 'assets/old-Abcd1234.js';
const oldLazy = 'assets/lazy-Abcd1234.js';
const css = 'assets/old-Abcd1234.css';
const newChunk = 'assets/new-Efgh1234.js';
const capsuleBytes = '{"capsule":1}';
const capsulePath = 'assets/presentation-2013-Q2-matrix-DaHuEIi0.json';
const reportBytes = '{"report":1}';
const reportPath = 'assets/presentation-2013-Q2-2013-Q1-report-RO0OW2MM.json';
const generationBytes = '{"descriptor":1}';
const generationPath = `data/production/2026-Q2-v2-${'a'.repeat(24)}/descriptor.${hash(generationBytes)}.json`;
const newCapsulePath = 'assets/presentation-2013-Q2-matrix-NewCaps8.json';
const newReportPath = 'assets/presentation-2013-Q2-2013-Q1-report-NewRepo8.json';
const timelinePath = 'assets/presentation-2013-Q2-timeline-Abcd1234.json';
const timelineBytes = '{"timeline":1}';
const testCatalogue = (old, timeline = false) => ({
  contractVersion: 1,
  sourceIndexSha256: 'a'.repeat(64),
  latestSnapshotId: 'snapshot',
  snapshots: [
    {
      snapshotId: 'snapshot',
      asOfQuarter: '2013-Q2',
      contextSha256: 'b'.repeat(64),
      sourceManifestSha256: 'c'.repeat(64),
      descriptor: {
        path: `2013-Q2-v2-test/descriptor.${'d'.repeat(64)}.json`,
        sha256: 'd'.repeat(64),
        sizeBytes: 1,
      },
      matrix: {
        path: `/${old ? capsulePath : newCapsulePath}`,
        sizeBytes: Buffer.byteLength(capsuleBytes),
        sha256: hash(capsuleBytes),
      },
      ...(timeline
        ? {
            timeline: {
              path: `/${timelinePath}`,
              sizeBytes: Buffer.byteLength(timelineBytes),
              sha256: hash(timelineBytes),
            },
          }
        : {}),
      reports: [
        {
          quarter: '2013-Q1',
          status: 'complete',
          ref: {
            path: `/${old ? reportPath : newReportPath}`,
            sizeBytes: Buffer.byteLength(reportBytes),
            sha256: hash(reportBytes),
          },
        },
      ],
    },
  ],
});
const html = (script, old, timeline = false) =>
  `<script src="/${script}"></script>${old ? `<link href="/${css}">` : ''}<script id="presentation-catalogue" type="application/json">${JSON.stringify(testCatalogue(old, timeline))}</script>`;

async function fixture(context, timeline = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cache-package-')));
  context.after(() => rm(root, { recursive: true, force: true }));
  const options = {
    currentDirectory: join(root, 'current'),
    currentManifestPath: join(root, 'current.json'),
    previousDirectory: join(root, 'previous'),
    previousManifestPath: join(root, 'previous.json'),
    previousViteManifestPath: join(root, 'vite.json'),
    outputDirectory: join(root, 'result'),
  };
  const previousFiles = new Map([
    ['_headers', 'old-policy'],
    ['index.html', html(oldChunk, true, timeline)],
    ['data/production/index.json', '{"old":1}'],
    [oldChunk, `import("./lazy-Abcd1234.js")`],
    [oldLazy, 'export const lazy = 1;'],
    [css, 'body{color:red}'],
    [capsulePath, capsuleBytes],
    [reportPath, reportBytes],
    [generationPath, generationBytes],
    ['fonts/InterVariable-4.1.woff2', 'font'],
  ]);
  if (timeline) {
    previousFiles.set(timelinePath, timelineBytes);
  }
  const currentFiles = new Map([
    ['_headers', 'new-policy'],
    ['index.html', html(newChunk, false)],
    ['data/production/index.json', '{"new":1}'],
    [newChunk, 'export const current = 1;'],
    [newCapsulePath, capsuleBytes],
    [newReportPath, reportBytes],
  ]);
  async function save(directory, path, files) {
    await mkdir(directory);
    const assets = [];
    for (const [name, content] of files) {
      const target = join(directory, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
      assets.push({
        path: name,
        sizeBytes: Buffer.byteLength(content),
        sha256: hash(content),
        cacheControl:
          name === '_headers'
            ? null
            : name === 'index.html' || name.endsWith('/index.json')
              ? daily
              : immutable,
        served: name !== '_headers',
      });
    }
    await writeFile(path, JSON.stringify({ formatVersion: 1, assets }));
  }
  await save(options.previousDirectory, options.previousManifestPath, previousFiles);
  await save(options.currentDirectory, options.currentManifestPath, currentFiles);
  await writeFile(
    options.previousViteManifestPath,
    JSON.stringify({
      main: { file: oldChunk, isEntry: true, css: [css], dynamicImports: ['lazy'] },
      lazy: { file: oldLazy },
    }),
  );
  options.expectedPreviousViteManifestSha256 = hash(
    await readFile(options.previousViteManifestPath),
  );
  options.expectedPreviousManifestSha256 = hash(await readFile(options.previousManifestPath));
  return {
    root,
    options,
    async mutate(side, mutation, pin = true) {
      const path = side === 'previous' ? options.previousManifestPath : options.currentManifestPath;
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      mutation(manifest);
      await writeFile(path, JSON.stringify(manifest));
      if (side === 'previous' && pin) {
        options.expectedPreviousManifestSha256 = hash(await readFile(path));
      }
    },
  };
}

test('retains authenticated timeline capsules while accepting current catalogues without timelines', async (context) => {
  const { options } = await fixture(context, true);
  const result = await packageCacheCompatibleRelease(options);
  assert.equal(await readFile(join(result.uploadDirectory, timelinePath), 'utf8'), timelineBytes);
  assert.equal(result.retainedAssets, 8);
});

test('copies exact current plus authenticated immutable history with private lineage evidence', async (context) => {
  const { options } = await fixture(context);
  const result = await packageCacheCompatibleRelease(options);
  assert.equal(result.retainedAssets, 7);
  assert.equal(await readFile(join(result.uploadDirectory, capsulePath), 'utf8'), capsuleBytes);
  assert.equal(await readFile(join(result.uploadDirectory, reportPath), 'utf8'), reportBytes);
  assert.equal(result.transition.status, 'compatible');
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.retention.previousManifestSha256, options.expectedPreviousManifestSha256);
  assert.deepEqual(
    JSON.parse(await readFile(result.retentionLedgerPath, 'utf8')),
    manifest.retention,
  );
  assert.equal(hash(await readFile(result.retentionLedgerPath)), result.retentionLedgerSha256);
  assert.equal(
    manifest.retention.currentManifestSha256,
    hash(await readFile(options.currentManifestPath)),
  );
  assert.equal(await readFile(join(result.uploadDirectory, '_headers'), 'utf8'), 'new-policy');
  assert.equal(
    await readFile(join(result.uploadDirectory, 'index.html'), 'utf8'),
    html(newChunk, false),
  );
  assert.equal(
    await readFile(join(result.uploadDirectory, 'data/production/index.json'), 'utf8'),
    '{"new":1}',
  );
  await assert.rejects(packageCacheCompatibleRelease(options), /EEXIST/);
});

test('retains transitive assets through two rapid replacements', async (context) => {
  const { options, root } = await fixture(context);
  const first = await packageCacheCompatibleRelease(options);
  await writeFile(
    options.previousViteManifestPath,
    JSON.stringify({ main: { file: newChunk, isEntry: true } }),
  );
  options.expectedPreviousViteManifestSha256 = hash(
    await readFile(options.previousViteManifestPath),
  );
  const second = await packageCacheCompatibleRelease({
    ...options,
    previousDirectory: first.uploadDirectory,
    previousManifestPath: first.manifestPath,
    expectedPreviousManifestSha256: first.manifestSha256,
    previousRetentionLedgerPath: first.retentionLedgerPath,
    expectedPreviousRetentionLedgerSha256: first.retentionLedgerSha256,
    outputDirectory: join(root, 'second'),
  });
  assert.equal(
    await readFile(join(second.uploadDirectory, oldLazy), 'utf8'),
    'export const lazy = 1;',
  );
  assert.equal(second.retainedAssets, first.retainedAssets);
});

test('rejects inline-only forged retained membership even with a recomputed manifest pin', async (context) => {
  const { options, mutate } = await fixture(context);
  const path = 'assets/private-Abcd1234.json';
  const bytes = '{"private":true}';
  await writeFile(join(options.previousDirectory, path), bytes);
  await mutate('previous', (manifest) => {
    const forged = {
      path,
      sizeBytes: bytes.length,
      sha256: hash(bytes),
      cacheControl: immutable,
      served: true,
    };
    manifest.assets.push(forged);
    manifest.retention = {
      formatVersion: 1,
      currentManifestSha256: 'a'.repeat(64),
      previousManifestSha256: 'b'.repeat(64),
      retainedAssets: [forged],
    };
  });
  await assert.rejects(
    packageCacheCompatibleRelease(options),
    /separately pinned retention ledger/,
  );
});

test('rejects foreign capsule snapshot names and incorrect catalogue SHA-256 or size', async (context) => {
  for (const defect of ['foreign-snapshot', 'digest', 'size']) {
    const { options, mutate } = await fixture(context);
    const indexPath = join(options.previousDirectory, 'index.html');
    const oldHtml = await readFile(indexPath, 'utf8');
    const matches = [
      ...oldHtml.matchAll(
        /(<script id="presentation-catalogue" type="application\/json">)([^<]*)(<\/script>)/g,
      ),
    ];
    const catalogue = JSON.parse(matches[0][2]);
    if (defect === 'foreign-snapshot') {
      catalogue.snapshots[0].asOfQuarter = '2013-Q3';
    } else if (defect === 'digest') {
      catalogue.snapshots[0].reports[0].ref.sha256 = 'f'.repeat(64);
    } else {
      catalogue.snapshots[0].matrix.sizeBytes += 1;
    }
    const changedHtml = oldHtml.replace(
      matches[0][0],
      `${matches[0][1]}${JSON.stringify(catalogue)}${matches[0][3]}`,
    );
    await writeFile(indexPath, changedHtml);
    await mutate('previous', (manifest) => {
      const asset = manifest.assets.find((record) => record.path === 'index.html');
      asset.sizeBytes = Buffer.byteLength(changedHtml);
      asset.sha256 = hash(changedHtml);
    });
    await assert.rejects(
      packageCacheCompatibleRelease(options),
      /catalogue snapshot|Capsule differs|Capsule size/,
    );
  }
});

test('a production-shaped Vite capsule still requires exact predecessor catalogue membership', async (context) => {
  const { options, mutate } = await fixture(context);
  const path = 'assets/presentation-2013-Q2-2012-Q4-report-Abcd1234.json';
  const bytes = '{"unadvertised":true}';
  await writeFile(join(options.previousDirectory, path), bytes);
  await mutate('previous', (manifest) => {
    manifest.assets.push({
      path,
      sizeBytes: bytes.length,
      sha256: hash(bytes),
      cacheControl: immutable,
      served: true,
    });
  });
  const vite = JSON.parse(await readFile(options.previousViteManifestPath, 'utf8'));
  vite.extra = { file: path };
  await writeFile(options.previousViteManifestPath, JSON.stringify(vite));
  options.expectedPreviousViteManifestSha256 = hash(
    await readFile(options.previousViteManifestPath),
  );
  await assert.rejects(packageCacheCompatibleRelease(options), /Unqualified prior immutable class/);
});

test('rejects changed standalone ledger bytes and record or lineage disagreement', async (context) => {
  const { options, root } = await fixture(context);
  const first = await packageCacheCompatibleRelease(options);
  const next = {
    ...options,
    previousDirectory: first.uploadDirectory,
    previousManifestPath: first.manifestPath,
    expectedPreviousManifestSha256: first.manifestSha256,
    previousRetentionLedgerPath: first.retentionLedgerPath,
    expectedPreviousRetentionLedgerSha256: first.retentionLedgerSha256,
    outputDirectory: join(root, 'next'),
  };
  const ledger = JSON.parse(await readFile(first.retentionLedgerPath, 'utf8'));
  ledger.currentManifestSha256 = 'c'.repeat(64);
  await writeFile(first.retentionLedgerPath, JSON.stringify(ledger));
  await assert.rejects(packageCacheCompatibleRelease(next), /ledger differs from preflight/);
  next.expectedPreviousRetentionLedgerSha256 = hash(await readFile(first.retentionLedgerPath));
  await assert.rejects(packageCacheCompatibleRelease(next), /ledger differs from manifest/);
});

test('requires exact out-of-band predecessor digest and refuses a forged changed ledger', async (context) => {
  const { options, mutate } = await fixture(context);
  await assert.rejects(
    packageCacheCompatibleRelease({ ...options, expectedPreviousManifestSha256: undefined }),
    /mandatory/,
  );
  await mutate(
    'previous',
    (manifest) => {
      manifest.retention = {};
    },
    false,
  );
  await assert.rejects(packageCacheCompatibleRelease(options), /preflight/);
  options.expectedPreviousManifestSha256 = hash(await readFile(options.previousManifestPath));
  await assert.rejects(packageCacheCompatibleRelease(options), /ledger fields/);
});

test('rejects unsafe, duplicate and case-conflicting inventory paths before file operations', async (context) => {
  const { options, mutate } = await fixture(context);
  const original = await readFile(options.currentManifestPath);
  for (const path of [
    '../escape',
    '/absolute',
    'a\\b',
    'a%2fb',
    'a//b',
    'a/../b',
    'INDEX.HTML',
    'index.html',
  ]) {
    await writeFile(options.currentManifestPath, original);
    await mutate('current', (manifest) => {
      manifest.assets.push({ ...manifest.assets[1], path });
    });
    await assert.rejects(packageCacheCompatibleRelease(options), /path/i);
  }
});

test('rejects changed, missing, extra, and hardlinked source files', async (context) => {
  for (const defect of ['changed', 'missing', 'extra', 'hardlink']) {
    const { options, root } = await fixture(context);
    const target = join(options.previousDirectory, oldLazy);
    if (defect === 'changed') {
      await writeFile(target, 'different bytes');
    }
    if (defect === 'missing') {
      await rm(target);
    }
    if (defect === 'extra') {
      await writeFile(join(options.currentDirectory, 'secret.json'), '{}');
    }
    if (defect === 'hardlink') {
      await link(target, join(root, 'linked.js'));
    }
    await assert.rejects(
      packageCacheCompatibleRelease(options),
      /changed|missing|Unmanifested|unlinked/,
    );
  }
});

test('rejects arbitrary hash-looking files, maps, mutable paths relabelled immutable, and digest-named lies', async (context) => {
  for (const path of [
    'assets/unreferenced-Abcd1234.js',
    'assets/private-Abcd1234.json',
    'assets/index-Abcd1234.js.map',
    'private.json',
    `assets/presentation-${'f'.repeat(64)}.json`,
  ]) {
    const { options, mutate } = await fixture(context);
    const bytes = '{}';
    await mkdir(dirname(join(options.previousDirectory, path)), { recursive: true });
    await writeFile(join(options.previousDirectory, path), bytes);
    await mutate('previous', (manifest) => {
      manifest.assets.push({
        path,
        sizeBytes: bytes.length,
        sha256: hash(bytes),
        served: true,
        cacheControl: immutable,
      });
    });
    await assert.rejects(packageCacheCompatibleRelease(options), /Unqualified|filename differs/);
  }
});

test('rejects shared immutable conflicts and cache-policy weakening', async (context) => {
  for (const defect of ['bytes', 'policy']) {
    const { options, mutate } = await fixture(context);
    const bytes = defect === 'bytes' ? 'changed font' : 'font';
    const path = 'fonts/InterVariable-4.1.woff2';
    await mkdir(join(options.currentDirectory, 'fonts'));
    await writeFile(join(options.currentDirectory, path), bytes);
    await mutate('current', (manifest) => {
      manifest.assets.push({
        path,
        sizeBytes: bytes.length,
        sha256: hash(bytes),
        served: true,
        cacheControl: defect === 'policy' ? daily : immutable,
      });
    });
    await assert.rejects(packageCacheCompatibleRelease(options), /conflict|freshness weakened/);
  }
});

test('rejects changed Vite evidence, forged ledger records and noncanonical retention policy', async (context) => {
  {
    const { options } = await fixture(context);
    await writeFile(options.previousViteManifestPath, '{}');
    await assert.rejects(packageCacheCompatibleRelease(options), /Vite manifest differs/);
  }
  {
    const { options, mutate } = await fixture(context);
    await mutate('previous', (manifest) => {
      manifest.retention = {
        formatVersion: 1,
        currentManifestSha256: 'a'.repeat(64),
        previousManifestSha256: 'b'.repeat(64),
        retainedAssets: [{ ...manifest.assets.at(-1), sha256: 'c'.repeat(64) }],
      };
    });
    await assert.rejects(packageCacheCompatibleRelease(options), /Forged retention record/);
  }
  {
    const { options, mutate } = await fixture(context);
    await mutate('previous', (manifest) => {
      manifest.assets.at(-1).cacheControl =
        'public, max-age=31536000, s-maxage=63072000, immutable';
    });
    await assert.rejects(
      packageCacheCompatibleRelease(options),
      /Unreviewed immutable cache policy/,
    );
  }
});

test('refuses outputs nested in source and source symlinks without overwriting evidence', async (context) => {
  const { options, root } = await fixture(context);
  await assert.rejects(
    packageCacheCompatibleRelease({
      ...options,
      outputDirectory: join(options.currentDirectory, 'nested'),
    }),
    /separate/,
  );
  const target = join(options.previousDirectory, oldLazy);
  await rm(target);
  await writeFile(join(root, 'outside.js'), 'export const lazy = 1;');
  try {
    await symlink(join(root, 'outside.js'), target);
  } catch (error) {
    if (error.code === 'EPERM') {
      return;
    }
    throw error;
  }
  await assert.rejects(packageCacheCompatibleRelease(options), /links|reparse/);
});

test('external predecessor catalogue bytes are authenticated and retained with their capsules', async (context) => {
  const { options, mutate } = await fixture(context);
  const bytes = JSON.stringify(testCatalogue(true));
  const path = `assets/analytics-catalogue-${hash(bytes)}.json`;
  const ref = {
    contractVersion: 1,
    path: `/${path}`,
    sizeBytes: Buffer.byteLength(bytes),
    sha256: hash(bytes),
  };
  const externalHtml = `<script id="presentation-catalogue-ref" type="application/json">${JSON.stringify(ref)}</script>`;
  await writeFile(join(options.previousDirectory, path), bytes);
  await writeFile(join(options.previousDirectory, 'index.html'), externalHtml);
  await mutate('previous', (manifest) => {
    const index = manifest.assets.find((asset) => asset.path === 'index.html');
    index.sizeBytes = Buffer.byteLength(externalHtml);
    index.sha256 = hash(externalHtml);
    manifest.assets.push({
      path,
      sizeBytes: Buffer.byteLength(bytes),
      sha256: hash(bytes),
      cacheControl: immutable,
      served: true,
    });
  });
  const result = await packageCacheCompatibleRelease(options);
  assert.equal(result.retainedAssets, 8);
  assert.equal(await readFile(join(result.uploadDirectory, path), 'utf8'), bytes);
  assert.equal(await readFile(join(result.uploadDirectory, capsulePath), 'utf8'), capsuleBytes);
});

test('Vite catalogue-shaped outputs still require exact predecessor metadata membership', async (context) => {
  const { options, mutate } = await fixture(context);
  const bytes = JSON.stringify(testCatalogue(true));
  const path = `assets/analytics-catalogue-${hash(bytes)}.json`;
  await writeFile(join(options.previousDirectory, path), bytes);
  await mutate('previous', (manifest) => {
    manifest.assets.push({
      path,
      sizeBytes: Buffer.byteLength(bytes),
      sha256: hash(bytes),
      cacheControl: immutable,
      served: true,
    });
  });
  const vite = JSON.parse(await readFile(options.previousViteManifestPath, 'utf8'));
  vite.catalogue = { file: path };
  await writeFile(options.previousViteManifestPath, JSON.stringify(vite));
  options.expectedPreviousViteManifestSha256 = hash(
    await readFile(options.previousViteManifestPath),
  );
  await assert.rejects(packageCacheCompatibleRelease(options), /Unqualified prior immutable class/);
});
