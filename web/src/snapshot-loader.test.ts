import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { SnapshotLoader } from './snapshot-loader.ts';
import type { SnapshotFetcher } from './snapshot-loader.ts';
import { parseProductionIndex } from './production-data.ts';

const directory = new URL('../../fixtures/production-v2/', import.meta.url);
const names = await readdir(directory);
const indexName = names.find((name) => name.startsWith('sample-index.'))!;
const artifacts = new Map(
  await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => [name, await readFile(new URL(name, directory))] as const),
  ),
);
const index = parseProductionIndex(artifacts.get(indexName)!);
const indexUrl = `https://example.test/data/${indexName}`;
function harness() {
  const calls: string[] = [];
  const fetcher: SnapshotFetcher = async (url) => {
    calls.push(url);
    const raw = artifacts.get(new URL(url).pathname.split('/').at(-1)!);
    return raw ? new Response(new Uint8Array(raw)) : new Response(null, { status: 404 });
  };
  return { calls, fetcher, loader: new SnapshotLoader(indexUrl, fetcher) };
}

void test('metadata and selected quarter load lazily; missing quarter requires no synthetic fetch', async () => {
  const { loader, calls } = harness();
  const metadata = await loader.loadIndex();
  assert.equal(calls.length, 1);
  const descriptor = await loader.loadSnapshot(metadata.snapshots[0]!.snapshotId);
  assert.equal(calls.length, 2);
  const available = descriptor.quarters.find((row) => row.payload)!;
  const missing = descriptor.quarters.find((row) => !row.payload)!;
  assert.equal(await loader.loadQuarter(descriptor, missing.quarter), null);
  assert.equal(calls.length, 2);
  const payload = await loader.loadQuarter(descriptor, available.quarter);
  assert.equal(calls.length, 3);
  assert.equal(await loader.loadQuarter(descriptor, available.quarter), payload);
  assert.equal(calls.length, 3);
  assert.ok(!calls.some((url) => url.includes('-matrix.')));
  const matrix = await loader.loadMatrix(descriptor);
  assert.equal(calls.length, 4);
  assert.equal(await loader.loadMatrix(descriptor), matrix);
  assert.equal(calls.length, 4);
  assert.ok(Object.isFrozen(descriptor.context.selection.contextModelIds));
});

void test('snapshot change fetches its own descriptor/payload and preserves generation-keyed cache', async () => {
  const { loader, calls } = harness();
  const first = await loader.loadSnapshot(index.snapshots[0]!.snapshotId);
  const second = await loader.loadSnapshot(index.snapshots[1]!.snapshotId);
  const a = await loader.loadMatrix(first);
  const b = await loader.loadMatrix(second);
  assert.notEqual(a.contextSha256, b.contextSha256);
  assert.equal(a.snapshotId, first.context.snapshotId);
  assert.equal(b.snapshotId, second.context.snapshotId);
  const requests = calls.length;
  assert.equal(await loader.loadMatrix(first), a);
  assert.equal(calls.length, requests);
  await assert.rejects(
    loader.loadMatrix({ ...first, contextSha256: second.contextSha256 }),
    /Mixed generation/,
  );
  await assert.rejects(loader.loadSnapshot('unadvertised'), /not advertised/);
  await assert.rejects(loader.loadQuarter(first, '9999-Q1'), /outside/);
});

void test('wrong bytes fail before cache insertion and retry can recover', async () => {
  const { fetcher } = harness();
  let corrupt = true;
  const loader = new SnapshotLoader(indexUrl, async (url, init) => {
    const response = await fetcher(url, init);
    if (corrupt && url.includes('-descriptor.')) {
      return new Response('{}');
    }
    return response;
  });
  await assert.rejects(loader.loadSnapshot(index.snapshots[0]!.snapshotId), /size/);
  corrupt = false;
  assert.equal(
    (await loader.loadSnapshot(index.snapshots[0]!.snapshotId)).context.snapshotId,
    index.snapshots[0]!.snapshotId,
  );
});

void test('already aborted cache reads reject and aborted late responses cannot populate caches', async () => {
  const { fetcher } = harness();
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayed = true;
  let payloadCalls = 0;
  const loader = new SnapshotLoader(indexUrl, async (url, init) => {
    if (url.includes('-matrix.')) {
      payloadCalls++;
      if (delayed) {
        started!();
        await gate;
      }
    }
    // Deliberately ignores AbortSignal to test the post-response guard.
    return fetcher(url, init);
  });
  const descriptor = await loader.loadSnapshot(index.snapshots[0]!.snapshotId);
  const controller = new AbortController();
  const pending = loader.loadMatrix(descriptor, controller.signal);
  await ready;
  controller.abort();
  release!();
  await assert.rejects(pending, { name: 'AbortError' });
  delayed = false;
  await loader.loadMatrix(descriptor);
  assert.equal(payloadCalls, 2);
  await assert.rejects(loader.loadMatrix(descriptor, controller.signal), { name: 'AbortError' });
});

void test('one canceled consumer does not abort another consumer loading the same artifact', async () => {
  const { fetcher } = harness();
  const loader = new SnapshotLoader(indexUrl, fetcher);
  const descriptor = await loader.loadSnapshot(index.snapshots[0]!.snapshotId);
  const controller = new AbortController();
  const canceled = loader.loadMatrix(descriptor, controller.signal);
  const live = loader.loadMatrix(descriptor);
  controller.abort();
  await assert.rejects(canceled, { name: 'AbortError' });
  assert.equal((await live).snapshotId, descriptor.context.snapshotId);
});

void test('HTTP failures propagate without advertising a loaded generation', async () => {
  const loader = new SnapshotLoader(indexUrl, () =>
    Promise.resolve(new Response(null, { status: 503 })),
  );
  await assert.rejects(loader.loadIndex(), /503/);
});

void test('default transport preserves the global receiver required by browser fetch', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = function (this: unknown) {
      assert.equal(this, globalThis, 'native fetch requires its Window/global receiver');
      calls++;
      return Promise.resolve(new Response(null, { status: 404 }));
    };
    const loader = new SnapshotLoader(indexUrl);
    await assert.rejects(loader.loadIndex(), /Production data request failed \(404\)/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
