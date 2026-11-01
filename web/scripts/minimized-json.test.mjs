import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { minimizeJsonBytes, repackExampleGraph, minimizedJsonPlugin } from './minimized-json.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const directory = new URL('../../fixtures/production-v2/', import.meta.url);
const sources = new Map(
  await Promise.all(
    (await readdir(directory))
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => [name, await readFile(new URL(name, directory))]),
  ),
);

test('lexical compaction preserves strings, Unicode and every numerical token exactly', () => {
  const input = Buffer.from(
    ' \r\n { "n": 9007199254740993, "z": -0, "e": 1.2300e+02, "s": " \\t \\" \\\\ ☃ \\u0020 ", "a": [ true, null ] } \n',
  );
  const expected = Buffer.from(
    '{"n":9007199254740993,"z":-0,"e":1.2300e+02,"s":" \\t \\" \\\\ ☃ \\u0020 ","a":[true,null]}',
  );
  assert.deepEqual(minimizeJsonBytes(input), expected);
  assert.deepEqual(minimizeJsonBytes(expected), expected);
  for (const input of [Buffer.from('{"n": NaN}'), Buffer.from([0x22, 0xff, 0x22])]) {
    assert.throws(() => minimizeJsonBytes(input));
  }
  assert.throws(() => minimizeJsonBytes(Buffer.from('\ufeff{}')));
});

function withoutByteBindings(value) {
  if (Array.isArray(value)) {
    return value.map(withoutByteBindings);
  }
  if (value && typeof value === 'object') {
    if (Object.keys(value).sort().join(',') === 'path,sha256,sizeBytes') {
      return 'BYTE_REFERENCE';
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, withoutByteBindings(child)]),
    );
  }
  return value;
}

test('all twelve compact derived examples retain context/data and pass the production reader', async () => {
  const fingerprints = [...sources].map(([name, bytes]) => [name, hash(bytes)]);
  const graph = repackExampleGraph(sources);
  assert.equal(graph.assets.size, 12);
  const fetched = new Set();
  const loader = new SnapshotLoader(
    `https://example.test/examples/${graph.indexName}`,
    async (url) => {
      const name = new URL(url).pathname.split('/').at(-1);
      const bytes = graph.assets.get(name);
      assert.ok(bytes, `Missing ${name}`);
      fetched.add(name);
      return new Response(new Uint8Array(bytes));
    },
  );
  const index = await loader.loadIndex();
  assert.equal(index.snapshots.length, 2);
  for (const snapshot of index.snapshots) {
    const descriptor = await loader.loadSnapshot(snapshot.snapshotId);
    assert.equal(descriptor.context.kind, 'sample');
    await loader.loadMatrix(descriptor);
    for (const quarter of descriptor.quarters) {
      await loader.loadQuarter(descriptor, quarter.quarter);
    }
  }
  assert.equal(fetched.size, 12);
  let saved = 0;
  for (const [oldName, reference] of graph.references) {
    const before = sources.get(oldName);
    const after = graph.assets.get(reference.path);
    assert.deepEqual(minimizeJsonBytes(after), after);
    assert.equal(reference.sha256, hash(after));
    assert.equal(reference.sizeBytes, after.length);
    assert.ok(reference.path.endsWith(`.${hash(after)}.json`));
    assert.deepEqual(
      withoutByteBindings(JSON.parse(before)),
      withoutByteBindings(JSON.parse(after)),
    );
    saved += before.length - after.length;
  }
  assert.ok(saved > 40_000, 'The pretty descriptors/matrices must actually be compacted');
  assert.deepEqual(
    [...sources].map(([name, bytes]) => [name, hash(bytes)]),
    fingerprints,
  );
});

function smallGraph(referenceChange = (reference) => reference) {
  const leaf = Buffer.from('{ "artifactType": "matrix", "n": 9007199254740993, "z": -0 }\n');
  const leafName = `sample-matrix.${hash(leaf)}.json`;
  const reference = referenceChange({ path: leafName, sha256: hash(leaf), sizeBytes: leaf.length });
  const index = Buffer.from(
    JSON.stringify({
      artifactType: 'generation_index',
      snapshots: [{ snapshotId: 'sample-test', descriptor: reference }],
    }),
  );
  const indexName = `sample-index.${hash(index)}.json`;
  return new Map([
    [leafName, leaf],
    [indexName, index],
  ]);
}

test('graph repacking rejects corrupt originals, unsafe/missing references and incorrect byte bindings', () => {
  const corrupt = smallGraph();
  corrupt.set([...corrupt.keys()][0], Buffer.from('{}'));
  assert.throws(() => repackExampleGraph(corrupt), /Original artifact hash mismatch/);
  for (const path of [
    '../outside.json',
    '/outside.json',
    'https://example.test/a.json',
    'a%2fb.json',
  ]) {
    assert.throws(
      () => repackExampleGraph(smallGraph((reference) => ({ ...reference, path }))),
      /Unsafe example reference path/,
    );
  }
  assert.throws(
    () =>
      repackExampleGraph(
        smallGraph((reference) => ({
          ...reference,
          path: `sample-missing.${reference.sha256}.json`,
        })),
      ),
    /Missing referenced/,
  );
  assert.throws(
    () => repackExampleGraph(smallGraph((reference) => ({ ...reference, sha256: 'a'.repeat(64) }))),
    /Original reference hash mismatch/,
  );
  assert.throws(
    () => repackExampleGraph(smallGraph((reference) => ({ ...reference, sizeBytes: 1 }))),
    /Original reference size mismatch/,
  );
  assert.throws(
    () => repackExampleGraph(smallGraph((reference) => ({ unexpected: true, ...reference }))),
    /Malformed byte reference object/,
  );
  const duplicate = smallGraph();
  const oldIndexName = [...duplicate.keys()].find((name) => name.startsWith('sample-index.'));
  const duplicateIndex = Buffer.from(
    duplicate.get(oldIndexName).toString('utf8').replace('"path":', '"path":"discarded","path":'),
  );
  duplicate.delete(oldIndexName);
  duplicate.set(`sample-index.${hash(duplicateIndex)}.json`, duplicateIndex);
  assert.throws(() => repackExampleGraph(duplicate), /Malformed byte reference object/);
  const unused = smallGraph();
  const bytes = Buffer.from('{"artifactType":"matrix"}');
  unused.set(`sample-unused.${hash(bytes)}.json`, bytes);
  assert.throws(() => repackExampleGraph(unused), /Unreferenced example artifact/);
  const graph = repackExampleGraph(smallGraph());
  assert.ok([...graph.assets.values()].some((bytes) => bytes.includes('9007199254740993,"z":-0')));
});

test('Vite emits compact bytes before URL hashing and resolves the derived example graph', async () => {
  const plugin = minimizedJsonPlugin();
  plugin.configResolved({ command: 'build' });
  const emitted = [];
  const watched = [];
  const context = {
    emitFile(asset) {
      emitted.push(asset);
      return `asset${emitted.length}`;
    },
    addWatchFile(path) {
      watched.push(path);
    },
  };
  const fixture = new URL('../../fixtures/production-v2/', import.meta.url);
  const id = plugin.resolveId('virtual:minimized-example-json');
  const module = await plugin.load.call(context, id);
  assert.match(module, /export const exampleIndexName="sample-index\.[a-f0-9]{64}\.json"/);
  assert.equal(emitted.length, 12);
  assert.equal(watched.length, 12);
  for (const asset of emitted) {
    assert.deepEqual(minimizeJsonBytes(asset.source), asset.source);
    assert.ok(asset.name.endsWith(`.${hash(asset.source)}.json`));
    assert.ok(sources.has(asset.originalFileName.split('/').at(-1)));
  }
  const sourceName = [...sources.keys()][0];
  const { fileURLToPath } = await import('node:url');
  const ordinary = await plugin.load.call(
    context,
    `${fileURLToPath(new URL(sourceName, fixture))}?url`,
  );
  assert.match(ordinary, /^export default import\.meta\.ROLLUP_FILE_URL_asset13;/);
  assert.deepEqual(emitted.at(-1).source, minimizeJsonBytes(sources.get(sourceName)));
  assert.equal(await plugin.load.call(context, '/some/file.css?url'), null);
});
