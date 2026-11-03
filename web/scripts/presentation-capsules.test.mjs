import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { presentationCapsulesPlugin } from './presentation-capsules-plugin.mjs';
import { PresentationLoader } from '../src/presentation-loader.ts';
import { renderStaticPicks, staticPicksContext } from '../src/static-picks.ts';
import { minifyHtml } from './minimize-static-assets.mjs';
import { initialPresentation } from '../src/presentation-bootstrap.ts';
import {
  auditPresentationAssets,
  auditStaticPicks,
  presentationCatalogueReferenceFromHtml,
  derivePresentationSnapshots,
  displayDescriptor,
  presentationCatalogueFromHtml,
  presentationDigest,
  safePresentationJson,
} from './presentation-capsules.mjs';

test('report presentation descriptor corrects historical labels without mutating canonical metadata', () => {
  const descriptor = {
    matrix: { path: 'canonical.json' },
    contextSha256: 'canonical-context-hash',
    context: {
      inventory: [
        {
          modelId: 'prefixed',
          vendor: 'Unknown',
          modelNumber: 'Hitachi HDS5C4040ALE630',
          capacityTB: 4,
        },
        { modelId: 'bare', vendor: 'WDC/HGST', modelNumber: 'HDS5C4040ALE630', capacityTB: 4 },
      ],
    },
  };
  const before = structuredClone(descriptor);
  const display = displayDescriptor(descriptor);
  assert.deepEqual(display.context.inventory, [
    { modelId: 'prefixed', vendor: 'HGST/WD', modelNumber: 'HDS5C4040ALE630' },
    { modelId: 'bare', vendor: 'HGST/WD', modelNumber: 'HDS5C4040ALE630' },
  ]);
  assert.equal(display.contextSha256, descriptor.contextSha256);
  assert.deepEqual(descriptor, before);
});

async function fixture(latest = false) {
  const source = fileURLToPath(new URL('../public/data/production/', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'presentation-audit-'));
  const index = JSON.parse(await readFile(join(source, 'index.json'), 'utf8'));
  const entry = latest
    ? index.snapshots.find((item) => item.snapshotId === index.latestSnapshotId)
    : index.snapshots[0];
  const descriptor = JSON.parse(await readFile(join(source, entry.descriptor.path), 'utf8'));
  const refs = [
    entry.descriptor,
    descriptor.matrix,
    ...descriptor.quarters.flatMap((row) => (row.payload ? [row.payload] : [])),
  ];
  for (const ref of refs) {
    await mkdir(dirname(join(root, ref.path)), { recursive: true });
    await writeFile(join(root, ref.path), await readFile(join(source, ref.path)));
  }
  await writeFile(
    join(root, 'index.json'),
    JSON.stringify({ ...index, latestSnapshotId: entry.snapshotId, snapshots: [entry] }),
  );
  const item = (await derivePresentationSnapshots(root).next()).value;
  const files = new Map();
  const emit = (capsule) => {
    const bytes = Buffer.from(JSON.stringify(capsule));
    const sha256 = presentationDigest(bytes);
    const path = `/assets/presentation-${files.size}-${sha256}.json`;
    files.set(path.slice(1), bytes);
    return { path, sha256, sizeBytes: bytes.length };
  };
  const catalogue = {
    contractVersion: 1,
    sourceIndexSha256: item.sourceIndexSha256,
    latestSnapshotId: entry.snapshotId,
    snapshots: [
      {
        snapshotId: entry.snapshotId,
        asOfQuarter: entry.asOfQuarter,
        contextSha256: descriptor.contextSha256,
        sourceManifestSha256: entry.sourceManifestSha256,
        descriptor: entry.descriptor,
        matrix: emit(item.matrixCapsule),
        timeline: emit(item.timelineCapsule),
        reports: item.reports.map((row) => ({
          quarter: row.quarter,
          status: row.status,
          ref: emit(row.capsule),
        })),
      },
    ],
  };
  return { root, files, catalogue };
}
test('equivalence audit checks every full adapter/quarter/history structure independently', async () => {
  const f = await fixture();
  try {
    const good = await auditPresentationAssets(f.root, f.files, f.catalogue);
    assert.deepEqual({ ...good, bytes: 0 }, { snapshots: 1, reports: 2, assets: 4, bytes: 0 });
    const matrixRef = f.catalogue.snapshots[0].matrix;
    const original = f.files.get(matrixRef.path.slice(1));
    const changed = JSON.parse(original);
    changed.body.models[0].cells[0].metrics.count = 7;
    const corrupt = Buffer.from(JSON.stringify(changed));
    f.files.set(matrixRef.path.slice(1), corrupt);
    matrixRef.sizeBytes = corrupt.length;
    matrixRef.sha256 = presentationDigest(corrupt);
    await assert.rejects(
      auditPresentationAssets(f.root, f.files, f.catalogue),
      /differs from canonical adapters/,
    );
    f.files.set(matrixRef.path.slice(1), original);
    matrixRef.sizeBytes = original.length;
    matrixRef.sha256 = presentationDigest(original);
    f.files.set('assets/presentation-unadvertised-abcdefgh.json', Buffer.from('{}'));
    await assert.rejects(
      auditPresentationAssets(f.root, f.files, f.catalogue),
      /Extra or unadvertised/,
    );
    f.files.delete('assets/presentation-unadvertised-abcdefgh.json');
    f.files.delete(matrixRef.path.slice(1));
    await assert.rejects(
      auditPresentationAssets(f.root, f.files, f.catalogue),
      /Missing presentation/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('independent timeline audit detects omitted models and altered ledger rates with valid hashes', async () => {
  const f = await fixture(true);
  try {
    const ref = f.catalogue.snapshots[0].timeline;
    const original = JSON.parse(f.files.get(ref.path.slice(1)));
    for (const mutation of [
      (body) => {
        body.models.pop();
      },
      (body) => {
        body.models
          .flatMap((model) => model.points)
          .find((point) => point.cumulativeAfr !== null).cumulativeAfr += 1;
      },
    ]) {
      const value = structuredClone(original);
      mutation(value.body);
      const bytes = Buffer.from(JSON.stringify(value));
      f.files.set(ref.path.slice(1), bytes);
      ref.sha256 = presentationDigest(bytes);
      ref.sizeBytes = bytes.length;
      await assert.rejects(
        auditPresentationAssets(f.root, f.files, f.catalogue),
        /differs from canonical/,
      );
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test('catalogue embedding escapes script terminators and is readable after HTML minimization', () => {
  assert.equal(
    safePresentationJson({ value: '</script>\u2028\u2029' }),
    '{"value":"\\u003c/script>\\u2028\\u2029"}',
  );
  assert.throws(() => presentationCatalogueFromHtml('<html></html>'), /Exactly one/);
  assert.throws(() =>
    presentationCatalogueFromHtml(
      '<script id="presentation-catalogue" type="application/json">{}</script>',
    ),
  );
});

test('development serves canonical-derived capsules with catalogue parity, memoization, invalidation and retry', async () => {
  const f = await fixture();
  const webRoot = await mkdtemp(join(tmpdir(), 'presentation-dev-'));
  try {
    const production = join(webRoot, 'public/data/production');
    await mkdir(dirname(production), { recursive: true });
    await cp(f.root, production, { recursive: true });
    const plugin = presentationCapsulesPlugin();
    plugin.configResolved({ root: webRoot, command: 'serve' });
    const watcher = new EventEmitter();
    watcher.add = (path) => assert.equal(path, production);
    let middleware;
    const httpServer = new EventEmitter();
    plugin.configureServer({
      watcher,
      httpServer,
      middlewares: {
        use: (fn) => {
          middleware = fn;
        },
      },
    });
    await plugin.buildStart();
    // Mirrors Vite's post-transform order: module and CSS precede </head>.
    const html =
      '<!doctype html><html><head><meta charset="UTF-8"><link rel="preload" as="font" href="/fonts/InterVariable-4.1.woff2"><script type="module" crossorigin src="/assets/index-abcdefgh.js"></script><link rel="stylesheet" href="/assets/index-abcdefgh.css"></head><body><div id="app"></div></body></html>';
    const [first, concurrent] = await Promise.all([
      plugin.transformIndexHtml.handler(html),
      plugin.transformIndexHtml.handler(html),
    ]);
    assert.equal(first, concurrent);
    const request = async (path, method = 'GET') => {
      const response = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) {
          this.headers[name] = value;
        },
        end(bytes) {
          this.bytes = bytes;
        },
      };
      let nextError;
      await middleware({ url: path, method }, response, (error) => {
        nextError = error ?? new Error('Unexpected middleware fallthrough');
      });
      if (nextError) {
        throw nextError;
      }
      return response;
    };
    const readCatalogue = async (text) => {
      const ref = presentationCatalogueReferenceFromHtml(text);
      return presentationCatalogueFromHtml(
        text,
        new Map([[ref.path.slice(1), (await request(ref.path)).bytes]]),
      );
    };
    const catalogue = await readCatalogue(first);
    assert.equal(catalogue.snapshots.length, 1);
    assert.match(first, /window\.__analyticsCatalogueInitial/);
    const catalogueAt = first.indexOf('<script id="presentation-catalogue-ref"');
    assert.ok(first.indexOf('<meta charset="UTF-8">') < 1024);
    for (const marker of ['<meta charset=', 'rel="preload"', 'type="module"', 'rel="stylesheet"']) {
      assert.ok(
        first.indexOf(marker) < catalogueAt,
        `${marker} must be discovered before catalogue`,
      );
    }
    assert.match(first, /<\/script><script>[\s\S]*<\/script><\/head>/);
    // A discovered module is deferred by HTML semantics. Execute the emitted
    // classic script first, then model that module adopting its request once.
    const classic = first.match(/<\/script><script>([\s\S]*?)<\/script><\/head>/)[1];
    const host = {};
    let initialFetches = 0;
    const initialPaths = [];
    const ref = presentationCatalogueReferenceFromHtml(first);
    const bootstrap = (search) =>
      vm.runInNewContext(classic, {
        window: host,
        document: { getElementById: () => ({ textContent: JSON.stringify(ref) }) },
        location: { search, href: 'https://example.test/' },
        URL,
        URLSearchParams,
        AbortController,
        TextDecoder,
        Uint8Array,
        crypto: webcrypto,
        fetch: async (url) => {
          initialFetches++;
          initialPaths.push(new URL(url).pathname);
          return new Response((await request(new URL(url).pathname)).bytes);
        },
      });
    for (const search of [
      '',
      '?view=picks',
      '?view=matrix&reference=1',
      '?view=capacity&example=1',
      '?view=reliability',
    ]) {
      bootstrap(search);
      assert.equal(initialFetches, 0, 'home and explicit fixtures must not fetch analytics');
    }
    bootstrap('?view=matrix');
    assert.ok(host.__analyticsCatalogueInitial);
    assert.equal(initialFetches, 1);
    const early = Buffer.from(await host.__analyticsCatalogueInitial.promise);
    assert.equal(presentationDigest(early), ref.sha256);
    assert.equal(early.length, ref.sizeBytes);
    assert.deepEqual(JSON.parse(early), catalogue);
    const choice = initialPresentation(new URLSearchParams('view=matrix'), catalogue);
    assert.deepEqual(initialPaths, [ref.path, choice.ref.path]);
    assert.equal(initialFetches, 2, 'verified catalogue starts exactly its selected capsule');
    assert.ok(host.__presentationInitial);
    const loader = new PresentationLoader(
      catalogue,
      () => assert.fail('deferred application must adopt the early capsule without refetch'),
      host,
      'https://example.test/',
    );
    const loaded = await loader.load(choice);
    assert.equal(loaded.kind, 'matrix');
    assert.equal(loaded.snapshotId, catalogue.latestSnapshotId);
    assert.equal(Object.hasOwn(host, '__presentationInitial'), false);
    assert.equal(initialFetches, 2, 'capsule adoption must not add a request');
    assert.strictEqual(await loader.load(choice), loaded, 'completed capsule remains cached');
    assert.equal(initialFetches, 2);
    await auditStaticPicks(production, first, catalogue);
    const reference = catalogue.snapshots[0].matrix;
    const response = await request(reference.path);
    assert.equal(response.statusCode, 200);
    assert.equal(response.bytes.length, reference.sizeBytes);
    assert.equal(presentationDigest(response.bytes), reference.sha256);
    assert.match(response.headers['Cache-Control'], /immutable/);
    assert.equal((await request('/assets/presentation-missing-abcdefgh.json')).statusCode, 404);
    assert.equal((await request(reference.path, 'POST')).statusCode, 405);
    assert.equal((await request(reference.path, 'HEAD')).bytes, undefined);
    const indexPath = join(production, 'index.json');
    const indexBytes = await readFile(indexPath);
    // A completed generation is memoized until a relevant watcher event.
    // An unrelated sibling event must not read this temporarily invalid index.
    await writeFile(indexPath, '{}');
    watcher.emit('all', 'change', join(webRoot, 'src/main.ts'));
    assert.equal(await plugin.transformIndexHtml.handler(html), first);
    await writeFile(indexPath, indexBytes);
    await writeFile(indexPath, Buffer.concat([indexBytes, Buffer.from('\n')]));
    watcher.emit('all', 'change', indexPath);
    const second = await readCatalogue(await plugin.transformIndexHtml.handler(html));
    assert.notEqual(second.sourceIndexSha256, catalogue.sourceIndexSha256);
    assert.equal(second.snapshots[0].matrix.path, reference.path);
    await writeFile(indexPath, '{}');
    watcher.emit('all', 'change', indexPath);
    await assert.rejects(plugin.transformIndexHtml.handler(html));
    await writeFile(indexPath, indexBytes);
    watcher.emit('all', 'change', indexPath);
    assert.equal(await plugin.transformIndexHtml.handler(html), first);
    watcher.emit('all', 'change', indexPath);
    const interrupted = plugin.transformIndexHtml.handler(html);
    watcher.emit('all', 'change', indexPath);
    await assert.rejects(interrupted, /sources changed during development generation/);
    assert.equal(await plugin.transformIndexHtml.handler(html), first);
    httpServer.emit('close');
    assert.equal(watcher.listenerCount('all'), 0);
  } finally {
    await rm(f.root, { recursive: true, force: true });
    await rm(webRoot, { recursive: true, force: true });
  }
});

test('runtime rejects a report whose catalogue status differs from its display descriptor', async () => {
  const f = await fixture();
  try {
    const choice = initialPresentation(new URLSearchParams('view=explore'), f.catalogue);
    const row = f.catalogue.snapshots[0].reports.find((row) => row.quarter === choice.quarter);
    row.status = row.status === 'complete' ? 'partial' : 'complete';
    const loader = new PresentationLoader(
      f.catalogue,
      async () => new Response(f.files.get(choice.ref.path.slice(1))),
      {},
      'https://example.test/',
    );
    await assert.rejects(loader.load(choice), /binding mismatch/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('existing capsule bytes and hashes survive unrelated publication/latest/index-order changes', async () => {
  const f = await fixture();
  try {
    const before = (await derivePresentationSnapshots(f.root).next()).value;
    const source = fileURLToPath(new URL('../public/data/production/', import.meta.url));
    const published = JSON.parse(await readFile(join(source, 'index.json'), 'utf8'));
    const added = published.snapshots[1];
    const descriptor = JSON.parse(await readFile(join(source, added.descriptor.path), 'utf8'));
    for (const ref of [
      added.descriptor,
      descriptor.matrix,
      ...descriptor.quarters.flatMap((row) => (row.payload ? [row.payload] : [])),
    ]) {
      await mkdir(dirname(join(f.root, ref.path)), { recursive: true });
      await writeFile(join(f.root, ref.path), await readFile(join(source, ref.path)));
    }
    const collectOld = async () => {
      for await (const snapshot of derivePresentationSnapshots(f.root)) {
        if (snapshot.entry.snapshotId === before.entry.snapshotId) {
          return snapshot;
        }
      }
      assert.fail('Original snapshot absent');
    };
    const encoded = (item) =>
      [item.matrixCapsule, item.timelineCapsule, ...item.reports.map((row) => row.capsule)].map(
        (capsule) => Buffer.from(JSON.stringify(capsule)),
      );
    const original = encoded(before);
    const index = {
      ...published,
      latestSnapshotId: added.snapshotId,
      snapshots: [before.entry, added],
    };
    await writeFile(join(f.root, 'index.json'), JSON.stringify(index));
    const extended = await collectOld();
    assert.notEqual(extended.sourceIndexSha256, before.sourceIndexSha256);
    assert.equal(extended.index.latestSnapshotId, added.snapshotId);
    assert.deepEqual(encoded(extended), original);
    assert.deepEqual(encoded(extended).map(presentationDigest), original.map(presentationDigest));
    await writeFile(
      join(f.root, 'index.json'),
      JSON.stringify({ ...index, snapshots: [added, before.entry] }),
    );
    const reordered = await collectOld();
    assert.notEqual(reordered.sourceIndexSha256, extended.sourceIndexSha256);
    assert.deepEqual(encoded(reordered), original);
    assert.deepEqual(encoded(reordered).map(presentationDigest), original.map(presentationDigest));
    assert.ok(
      encoded(reordered).every((bytes) => !Object.hasOwn(JSON.parse(bytes), 'sourceIndexSha256')),
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

function externalCatalogue(catalogue) {
  const bytes = Buffer.from(JSON.stringify(catalogue));
  const sha256 = presentationDigest(bytes);
  const path = `/assets/analytics-catalogue-${sha256}.json`;
  const ref = { contractVersion: 1, path, sha256, sizeBytes: bytes.length };
  return {
    bytes,
    ref,
    html: `<script id="presentation-catalogue-ref" type="application/json">${JSON.stringify(ref)}</script>`,
  };
}

test('catalogue reader validates external identity and rejects ambiguous, inert and malformed metadata', async () => {
  const f = await fixture();
  try {
    const { html, ref, bytes } = externalCatalogue(f.catalogue);
    const files = new Map([[ref.path.slice(1), bytes]]);
    assert.deepEqual(presentationCatalogueFromHtml(await minifyHtml(html), files), f.catalogue);
    const inline = `<script type="application/json" id="presentation-catalogue">${safePresentationJson(f.catalogue)}</script>`;
    assert.deepEqual(presentationCatalogueFromHtml(inline), f.catalogue);
    for (const malformed of [
      html + html,
      html + inline,
      `<template>${html}</template>`,
      html.replace('type=', 'type="application/json" type='),
      html.replace('<script ', '<div '),
      html.replace(' type=', ' src="/evil.js" type='),
    ]) {
      assert.throws(() => presentationCatalogueFromHtml(malformed, files));
    }
    assert.throws(() => presentationCatalogueFromHtml(html), /Missing external/);
    assert.throws(
      () =>
        presentationCatalogueFromHtml(
          html,
          new Map([[ref.path.slice(1), Buffer.concat([bytes, Buffer.from(' ')])]]),
        ),
      /size drift/,
    );
    const corrupt = Buffer.from(bytes);
    corrupt[0] = 32;
    assert.throws(
      () => presentationCatalogueFromHtml(html, new Map([[ref.path.slice(1), corrupt]])),
      /digest drift/,
    );
    assert.throws(
      () =>
        presentationCatalogueFromHtml(
          html.replace(ref.path, '/assets/analytics-catalogue-' + 'f'.repeat(64) + '.json'),
          files,
        ),
      /Invalid catalogue reference/,
    );
    assert.throws(
      () =>
        presentationCatalogueFromHtml(
          html.replace('"contractVersion":1', '"contractVersion":2'),
          files,
        ),
      /Invalid catalogue reference/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('static-home audit recomputes reviewed and unreviewed markup and rejects actual content/context corruption', async () => {
  for (const latest of [false, true]) {
    const f = await fixture(latest);
    try {
      const matrix = JSON.parse(f.files.get(f.catalogue.snapshots[0].matrix.path.slice(1)));
      const context = `<script id="static-picks-context" type="application/json">${JSON.stringify(staticPicksContext(f.catalogue))}</script>`;
      const markup = renderStaticPicks(f.catalogue, matrix);
      if (latest) {
        assert.match(markup, /pick-metrics/);
      } else {
        assert.match(markup, /Latest selection awaiting review/);
      }
      const html = `<html><head>${context}</head><body><div id="app">${markup}</div></body></html>`;
      await auditStaticPicks(f.root, await minifyHtml(html), f.catalogue);
      for (const changed of [
        html.replace('BACKBLAZE DRIVE STATS', 'SOME OTHER CLAIM'),
        html.replace('id="static-picks-context"', 'id="missing-context"'),
        html.replace(context, context + context),
        html.replace('"sourceIndexSha256":"', '"sourceIndexSha256":"f'),
        html.replace('</body>', markup + '</body>'),
        html.replace('</div></body>', '<p>Extra claim</p></div></body>'),
        html.replace('https://www.backblaze.com/', 'https://example.invalid/'),
        html.replace(markup, renderStaticPicks(f.catalogue, undefined)),
      ]) {
        assert.notEqual(changed, html, 'corruption probe must change the document');
        await assert.rejects(auditStaticPicks(f.root, changed, f.catalogue));
      }
      if (latest) {
        await assert.rejects(
          auditStaticPicks(f.root, html.replace(/<dd>[^<]+<\/dd>/, '<dd>999999</dd>'), f.catalogue),
          /markup differs/,
        );
      }
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  }
});
