import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  initialPresentation,
  presentationBootstrapSource,
  presentationKey,
} from './presentation-bootstrap.ts';
import type { InitialRequest, PresentationHost } from './presentation-bootstrap.ts';
import { PresentationLoader, abortInitialPresentation } from './presentation-loader.ts';
import type { PresentationCatalogue, MatrixCapsule } from './presentation-data.ts';

const hash = 'a'.repeat(64);
const reference = { path: `descriptors/source.${hash}.json`, sha256: hash, sizeBytes: 1 };
const emptyDomain = {
  sampleCount: 0,
  observedMinimum: null,
  observedMedian: null,
  observedMaximum: null,
  knots: [],
};
const capsule: MatrixCapsule = {
  artifactType: 'backblaze-presentation',
  contractVersion: 1,
  kind: 'matrix',
  snapshotId: 'latest',
  asOfQuarter: '2026-Q2',
  contextSha256: hash,
  sourceManifestSha256: hash,
  descriptor: reference,
  quarter: null,
  body: {
    id: 'latest',
    label: 'Latest',
    kind: 'production',
    sourceHash: hash,
    sourceUrl: null,
    cutoff: null,
    models: [],
    domains: {
      afr: emptyDomain,
      afrDelta: emptyDomain,
      count: emptyDomain,
      populationDelta: emptyDomain,
      new: emptyDomain,
      retired: emptyDomain,
      failed: emptyDomain,
    },
    extent: 0,
    versions: 'v',
    notice: '',
  },
};
async function fixture(value: unknown = capsule) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).buffer;
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  const ref = { path: '/assets/presentation-abcdefgh.json', sha256, sizeBytes: bytes.byteLength };
  const snapshot = {
    snapshotId: 'latest',
    asOfQuarter: '2026-Q2',
    contextSha256: hash,
    sourceManifestSha256: hash,
    descriptor: reference,
    matrix: ref,
    reports: [
      { quarter: '2026-Q2', status: 'complete' as const, ref },
      { quarter: '2026-Q1', status: 'missing' as const, ref },
    ],
  };
  const catalogue: PresentationCatalogue = {
    contractVersion: 1,
    sourceIndexSha256: hash,
    latestSnapshotId: 'latest',
    snapshots: [snapshot, { ...snapshot, snapshotId: 'old', asOfQuarter: '2013-Q2' }],
  };
  return { bytes, ref, catalogue, choice: initialPresentation(new URLSearchParams(), catalogue)! };
}
await test('initial routes preserve precedence, exceptions, unknown ID policy and quarter fallback', async () => {
  const { catalogue } = await fixture();
  for (const query of ['', 'view=matrix', 'view=matrix&legacy=1']) {
    assert.equal(initialPresentation(new URLSearchParams(query), catalogue)?.kind, 'matrix');
  }
  for (const query of [
    'view=matrix&reference=1',
    'view=explore&example=1',
    'view=reliability',
    'view=capacity&legacy=1',
    'view=bogus',
    'view=matrix&snapshot=unknown',
  ]) {
    assert.equal(initialPresentation(new URLSearchParams(query), catalogue), null);
  }
  for (const view of [
    'explore',
    'deployments',
    'distribution',
    'capacity',
    'manufacturers',
    'datacenters',
  ]) {
    const choice = initialPresentation(
      new URLSearchParams({ view, snapshot: 'unknown', quarter: 'wrong', report: 'datacenters' }),
      catalogue,
    );
    assert.equal(choice?.snapshotId, 'latest');
    assert.equal(choice?.quarter, '2026-Q2');
  }
  assert.equal(
    initialPresentation(new URLSearchParams('view=explore&quarter=2026-Q1'), catalogue)?.quarter,
    '2026-Q1',
  );
  assert.equal(
    initialPresentation(new URLSearchParams('view=matrix&snapshot=old'), catalogue)?.snapshotId,
    'old',
  );
});
await test('matching early bytes adopted once and only validated completed values cached', async () => {
  const { catalogue, choice, bytes, ref } = await fixture();
  let requests = 0;
  const slot: InitialRequest = {
    key: presentationKey(choice),
    ref,
    controller: new AbortController(),
    promise: Promise.resolve(bytes),
  };
  const host: PresentationHost = { __presentationInitial: slot };
  const reader = new PresentationLoader(
    catalogue,
    async () => {
      requests++;
      return new Response(bytes);
    },
    host,
    'https://example.test/',
  );
  const result = await reader.load(choice);
  assert.equal(result.kind, 'matrix');
  assert.equal(requests, 0);
  assert.equal(host.__presentationInitial, undefined);
  assert.ok(Object.isFrozen(result.body));
  assert.equal(await reader.load(choice), result);
  assert.equal(requests, 0);
});
await test('mismatch discards and aborts early slot; failed fetch and hash permit retries', async () => {
  const { catalogue, choice, bytes, ref } = await fixture();
  let requests = 0;
  const controller = new AbortController();
  const host: PresentationHost = {
    __presentationInitial: { key: 'stale', ref, controller, promise: Promise.resolve(bytes) },
  };
  const reader = new PresentationLoader(
    catalogue,
    async () => {
      requests++;
      if (requests === 1) {
        throw new Error('offline');
      }
      if (requests === 2) {
        return new Response(new Uint8Array(bytes.byteLength));
      }
      return new Response(bytes);
    },
    host,
    'https://example.test/',
  );
  await assert.rejects(reader.load(choice), /offline/);
  assert.ok(controller.signal.aborted);
  await assert.rejects(reader.load(choice), /hash mismatch/);
  assert.equal((await reader.load(choice)).kind, 'matrix');
  assert.equal(requests, 3);
});
await test('cancelled consumer cannot cache; startup abort clears unadopted slot', async () => {
  const { catalogue, choice, bytes, ref } = await fixture();
  let finish: (value: Response) => void = () => {};
  let requests = 0;
  const reader = new PresentationLoader(
    catalogue,
    () => {
      requests++;
      return requests === 1
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(new Response(bytes));
    },
    {},
    'https://example.test/',
  );
  const controller = new AbortController();
  const pending = reader.load(choice, controller.signal);
  controller.abort();
  finish(new Response(bytes));
  await assert.rejects(pending);
  await reader.load(choice);
  assert.equal(requests, 2);
  const early = new AbortController();
  const host: PresentationHost = {
    __presentationInitial: { key: 'x', ref, controller: early, promise: Promise.resolve(bytes) },
  };
  abortInitialPresentation(host);
  assert.ok(early.signal.aborted);
  assert.equal(host.__presentationInitial, undefined);
});
await test('size and mixed context bindings reject before caching', async () => {
  const { catalogue, choice, bytes } = await fixture();
  const sizeReader = new PresentationLoader(
    catalogue,
    async () => new Response(new Uint8Array(1)),
    {},
    'https://example.test/',
  );
  await assert.rejects(sizeReader.load(choice), /size mismatch/);
  const bad = await fixture({ ...capsule, contextSha256: 'b'.repeat(64) });
  const mixed = new PresentationLoader(
    bad.catalogue,
    async () => new Response(bad.bytes),
    {},
    'https://example.test/',
  );
  await assert.rejects(mixed.load(bad.choice), /binding mismatch/);
  assert.ok(bytes.byteLength > 1);
});
await test('classic bootstrap starts exact route request synchronously and handles early rejection', async () => {
  const { catalogue, ref } = await fixture();
  let count = 0;
  let requested = '';
  const host: PresentationHost = {};
  vm.runInNewContext(presentationBootstrapSource(catalogue, '/'), {
    window: host,
    document: { getElementById: () => ({ textContent: JSON.stringify(catalogue) }) },
    location: {
      href: 'https://example.test/?view=capacity&quarter=2026-Q1',
      search: '?view=capacity&quarter=2026-Q1',
    },
    URLSearchParams,
    URL,
    AbortController,
    fetch: (url: URL) => {
      count++;
      requested = url.href;
      return Promise.reject(new Error('offline'));
    },
  });
  assert.equal(count, 1);
  assert.equal(requested, `https://example.test${ref.path}`);
  assert.equal(host.__presentationInitial?.key, JSON.stringify(['report', 'latest', '2026-Q1']));
  await assert.rejects(host.__presentationInitial.promise, /offline/);
});

await test('adopted cancellation aborts only early request; another consumer and retry remain independent', async () => {
  const { catalogue, choice, bytes, ref } = await fixture();
  const early = new AbortController();
  let rejectEarly: (error: Error) => void = () => {};
  const promise = new Promise<ArrayBuffer>((_resolve, reject) => {
    rejectEarly = reject;
  });
  void promise.catch(() => {});
  early.signal.addEventListener('abort', () => rejectEarly(new Error('early aborted')), {
    once: true,
  });
  const host: PresentationHost = {
    __presentationInitial: { key: presentationKey(choice), ref, controller: early, promise },
  };
  let requests = 0;
  const reader = new PresentationLoader(
    catalogue,
    async () => {
      requests++;
      return new Response(bytes);
    },
    host,
    'https://example.test/',
  );
  const controller = new AbortController();
  const abandoned = reader.load(choice, controller.signal);
  const live = reader.load(choice);
  controller.abort();
  await assert.rejects(abandoned, /early aborted/);
  assert.ok(early.signal.aborted);
  const result = await live;
  assert.equal(result.kind, 'matrix');
  assert.equal(await reader.load(choice), result);
  assert.equal(requests, 1);
});

async function explorerStartupHarness(delayed: Promise<unknown>) {
  const source = await readFile(new URL('./snapshot-explorer.ts', import.meta.url), 'utf8');
  const executable =
    stripTypeScriptTypes(source)
      .replace(/^import[\s\S]*?;\r?$/gm, '')
      .replace('export async function initSnapshotExplorer', 'async function initSnapshotExplorer')
      .replace("await import('./snapshot-loader.ts')", 'await __delayedExampleModule')
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')) + '\ninitSnapshotExplorer;';
  const writes: string[] = [];
  const app = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  class FakeElement {}
  const document = { querySelector: () => app, activeElement: null, title: 'Before startup' };
  const context = {
    URL,
    URLSearchParams,
    AbortController,
    AbortSignal,
    HTMLElement: FakeElement,
    HTMLInputElement: FakeElement,
    Intl,
    location: {
      search: '?view=explore&example=1',
      origin: 'https://example.test',
      href: 'https://example.test/?view=explore&example=1',
    },
    document,
    exampleUrls: {},
    exampleIndexName: 'index.json',
    __delayedExampleModule: delayed,
    defaultFilter: () => ({ search: '', vendor: '', preset: 'context' }),
    snapshotReport: () => 'overview',
    selectionTotals: () => ({}),
    updatePublishedNavigation: () => {},
    patchContent: (_app: unknown, text: string) => {
      writes.push(text);
      app.innerHTML = text;
    },
    exploreUrl: () => '',
    CapacityHistoryReader: class {},
  };
  const init = vm.runInNewContext(executable, context) as (signal: AbortSignal) => Promise<void>;
  return { init, app, document, writes };
}

await test('delayed example module cannot overwrite final timeout DOM or title after startup abort', async () => {
  let finish: (module: unknown) => void = () => {};
  const delayed = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  const { init, app, document, writes } = await explorerStartupHarness(delayed);
  const controller = new AbortController();
  const pending = init(controller.signal);
  controller.abort();
  app.innerHTML = 'FINAL STARTUP TIMEOUT';
  document.title = 'Final timeout';
  finish({ SnapshotLoader: class {} });
  await assert.rejects(pending);
  assert.equal(app.innerHTML, 'FINAL STARTUP TIMEOUT');
  assert.equal(document.title, 'Final timeout');
  assert.equal(writes.length, 0);
});

await test('late ignored-signal example failure cannot overwrite final startup timeout', async () => {
  let rejectIndex: (error: Error) => void = () => {};
  let indexStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    indexStarted = resolve;
  });
  const index = new Promise<unknown>((_resolve, reject) => {
    rejectIndex = reject;
  });
  class Loader {
    loadIndex() {
      indexStarted();
      return index;
    }
  }
  const { init, app, document, writes } = await explorerStartupHarness(
    Promise.resolve({ SnapshotLoader: Loader }),
  );
  const controller = new AbortController();
  const pending = init(controller.signal);
  await started;
  controller.abort();
  app.innerHTML = 'FINAL STARTUP TIMEOUT';
  document.title = 'Final timeout';
  const priorWrites = writes.length;
  rejectIndex(new Error('Late request failed'));
  await pending;
  assert.equal(app.innerHTML, 'FINAL STARTUP TIMEOUT');
  assert.equal(document.title, 'Final timeout');
  assert.equal(writes.length, priorWrites);
});

await test('unchanged immutable capsule remains valid in a new catalogue publication', async () => {
  const { catalogue, choice, bytes } = await fixture();
  catalogue.sourceIndexSha256 = 'b'.repeat(64);
  const reader = new PresentationLoader(
    catalogue,
    async () => new Response(bytes),
    {},
    'https://example.test/',
  );
  assert.equal((await reader.load(choice)).snapshotId, capsule.snapshotId);
});

await test('uncached snapshot navigation invokes receiver-sensitive fetch with the global receiver and retries safely', async () => {
  const { catalogue, choice, bytes, ref } = await fixture();
  const oldCapsule: MatrixCapsule = {
    ...capsule,
    snapshotId: 'old',
    asOfQuarter: '2013-Q2',
    body: { ...capsule.body, id: 'old' },
  };
  const oldBytes = new TextEncoder().encode(JSON.stringify(oldCapsule)).buffer;
  const oldRef = {
    path: '/assets/old-presentation-abcdefgh.json',
    sizeBytes: oldBytes.byteLength,
    sha256: Buffer.from(await crypto.subtle.digest('SHA-256', oldBytes)).toString('hex'),
  };
  catalogue.snapshots.find((item) => item.snapshotId === 'old')!.matrix = oldRef;
  let requests = 0;
  const fetcher: typeof fetch = async function (this: unknown, input) {
    assert.equal(this, globalThis, 'fetch must retain the browser global receiver');
    assert.ok(input instanceof URL);
    assert.equal(input.href, `https://example.test${oldRef.path}`);
    requests++;
    if (requests === 1) {
      throw new Error('temporary network failure');
    }
    return new Response(oldBytes);
  };
  const host: PresentationHost = {
    __presentationInitial: {
      key: presentationKey(choice),
      ref,
      controller: new AbortController(),
      promise: Promise.resolve(bytes),
    },
  };
  const reader = new PresentationLoader(catalogue, fetcher, host, 'https://example.test/');
  const initial = await reader.load(choice);
  assert.equal(requests, 0);
  const oldChoice = reader.selection(new URLSearchParams('view=matrix&snapshot=old'))!;
  await assert.rejects(reader.load(oldChoice), /temporary network failure/);
  const navigated = await reader.load(oldChoice);
  assert.equal(navigated.snapshotId, 'old');
  assert.equal(requests, 2);
  assert.equal(await reader.load(choice), initial);
  assert.equal(await reader.load(oldChoice), navigated);
  assert.equal(requests, 2);
});

await test('default fetch captures the global function without changing its required receiver', async () => {
  const { catalogue, choice, bytes } = await fixture();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async function (this: unknown) {
    assert.equal(this, globalThis);
    requests++;
    return new Response(bytes);
  };
  try {
    const reader = new PresentationLoader(catalogue, undefined, {}, 'https://example.test/');
    assert.equal((await reader.load(choice)).snapshotId, 'latest');
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
