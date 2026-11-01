import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { presentationCapsulesPlugin } from './presentation-capsules-plugin.mjs';
import { PresentationLoader } from '../src/presentation-loader.ts';
import { initialPresentation } from '../src/presentation-bootstrap.ts';
import {
  auditPresentationAssets,
  derivePresentationSnapshots,
  presentationCatalogueFromHtml,
  presentationDigest,
  safePresentationJson,
} from './presentation-capsules.mjs';

async function fixture() {
  const source = fileURLToPath(new URL('../public/data/production/', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'presentation-audit-'));
  const index = JSON.parse(await readFile(join(source, 'index.json'), 'utf8'));
  const entry = index.snapshots[0];
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
    assert.deepEqual({ ...good, bytes: 0 }, { snapshots: 1, reports: 2, assets: 3, bytes: 0 });
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
      '<!doctype html><html><head><meta charset="UTF-8"><link rel="preload" as="font" href="/fonts/InterVariable-4.1.woff2"><script type="module" crossorigin src="/assets/index-abcdefgh.js"></script><link rel="stylesheet" href="/assets/index-abcdefgh.css"></head><body></body></html>';
    const [first, concurrent] = await Promise.all([
      plugin.transformIndexHtml.handler(html),
      plugin.transformIndexHtml.handler(html),
    ]);
    assert.equal(first, concurrent);
    const catalogue = presentationCatalogueFromHtml(first);
    assert.equal(catalogue.snapshots.length, 1);
    assert.match(first, /window\.__presentationInitial/);
    const catalogueAt = first.indexOf('<script id="presentation-catalogue"');
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
    const fetcher = async (url) => {
      initialFetches++;
      return new Response(f.files.get(new URL(url).pathname.slice(1)));
    };
    // Development filenames differ from the fixture emitter; bind by expected
    // SHA rather than creating an alternate presentation input.
    const initialBytes = [...f.files.values()].find(
      (bytes) => presentationDigest(bytes) === catalogue.snapshots[0].matrix.sha256,
    );
    const initialFetcher = async () => {
      initialFetches++;
      return new Response(initialBytes);
    };
    vm.runInNewContext(classic, {
      window: host,
      document: { getElementById: () => ({ textContent: JSON.stringify(catalogue) }) },
      location: { search: '', href: 'https://example.test/' },
      URL,
      URLSearchParams,
      AbortController,
      fetch: initialFetcher,
    });
    assert.ok(host.__presentationInitial);
    assert.equal(initialFetches, 1);
    const loader = new PresentationLoader(catalogue, fetcher, host, 'https://example.test/');
    await loader.load(initialPresentation(new URLSearchParams(), catalogue));
    assert.equal(initialFetches, 1, 'deferred app must adopt the classic request without refetch');
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
    const second = presentationCatalogueFromHtml(await plugin.transformIndexHtml.handler(html));
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
      [item.matrixCapsule, ...item.reports.map((row) => row.capsule)].map((capsule) =>
        Buffer.from(JSON.stringify(capsule)),
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
