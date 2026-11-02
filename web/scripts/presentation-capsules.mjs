import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { CapacityHistoryReader } from '../src/capacity-report.ts';
import { adaptProductionV2 } from '../src/matrix-production.ts';
import { parsePresentationCapsule, parsePresentationCatalogue } from '../src/presentation-data.ts';
import { displayModelLabel } from '../src/model-labels.ts';

export const presentationDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const safePresentationJson = (value) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
export function displayDescriptor(descriptor) {
  const { matrix: _matrix, context, ...rest } = descriptor;
  return {
    ...rest,
    context: {
      ...context,
      inventory: context.inventory.map(({ modelId, vendor, modelNumber }) =>
        displayModelLabel({ modelId, vendor, modelNumber }),
      ),
    },
  };
}
/** Every input uses the existing canonical parser, reference verifier and cross-artifact validators.
 * This generator retains only one snapshot's graph at a time. It reads committed public data only.
 */
export async function* derivePresentationSnapshots(productionRoot) {
  const indexUrl = pathToFileURL(resolve(productionRoot, 'index.json')).href;
  const fetcher = async (url) => new Response(await readFile(fileURLToPath(url)));
  const indexBytes = await readFile(fileURLToPath(indexUrl));
  const sourceIndexSha256 = presentationDigest(indexBytes);
  const indexLoader = new SnapshotLoader(indexUrl, fetcher);
  const index = await indexLoader.loadIndex();
  for (const entry of index.snapshots) {
    const loader = new SnapshotLoader(indexUrl, fetcher);
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const capacityHistory = await new CapacityHistoryReader(loader).load(entry.snapshotId);
    const binding = {
      artifactType: 'backblaze-presentation',
      contractVersion: 1,
      snapshotId: entry.snapshotId,
      asOfQuarter: entry.asOfQuarter,
      contextSha256: descriptor.contextSha256,
      sourceManifestSha256: entry.sourceManifestSha256,
      descriptor: entry.descriptor,
    };
    const matrixCapsule = {
      ...binding,
      kind: 'matrix',
      quarter: null,
      body: adaptProductionV2(descriptor, matrix),
    };
    parsePresentationCapsule(matrixCapsule);
    const thin = displayDescriptor(descriptor);
    const reports = [];
    for (const row of descriptor.quarters) {
      const quarter = await loader.loadQuarter(descriptor, row.quarter);
      const capsule = {
        ...binding,
        kind: 'report',
        quarter: row.quarter,
        body: { descriptor: thin, quarter, capacityHistory },
      };
      parsePresentationCapsule(capsule);
      reports.push({ quarter: row.quarter, status: row.status, capsule });
    }
    yield { index, entry, sourceIndexSha256, descriptor, matrixCapsule, reports };
  }
}

/** Independent packaging audit regenerates projections from the public source graph,
 * compares complete decoded structures AND deterministic serialized bytes, then proves
 * every advertised capsule is unique/reachable and no extra capsule is served.
 */
export async function auditPresentationAssets(productionRoot, files, catalogue) {
  const paths = new Set();
  const indexUrl = pathToFileURL(resolve(productionRoot, 'index.json')).href;
  const fetcher = async (url) => new Response(await readFile(fileURLToPath(url)));
  const index = await new SnapshotLoader(indexUrl, fetcher).loadIndex();
  const sourceIndexSha256 = presentationDigest(await readFile(fileURLToPath(indexUrl)));
  let snapshots = 0,
    reports = 0,
    bytes = 0;
  // Do not use the emitter's projection generator or thin-descriptor helper here.
  // Reconstruct the contract independently from canonical source readers.
  for (const entry of index.snapshots) {
    const loader = new SnapshotLoader(indexUrl, fetcher);
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const history = await new CapacityHistoryReader(loader).load(entry.snapshotId);
    const expected = { entry, descriptor, sourceIndexSha256, index };
    assert.equal(
      catalogue.sourceIndexSha256,
      expected.sourceIndexSha256,
      'Presentation source index drift',
    );
    assert.equal(catalogue.latestSnapshotId, expected.index.latestSnapshotId);
    const actual = catalogue.snapshots[snapshots++];
    assert.ok(actual, 'Presentation snapshot missing');
    assert.deepEqual(
      {
        snapshotId: actual.snapshotId,
        asOfQuarter: actual.asOfQuarter,
        contextSha256: actual.contextSha256,
        sourceManifestSha256: actual.sourceManifestSha256,
        descriptor: actual.descriptor,
      },
      {
        snapshotId: expected.entry.snapshotId,
        asOfQuarter: expected.entry.asOfQuarter,
        contextSha256: expected.descriptor.contextSha256,
        sourceManifestSha256: expected.entry.sourceManifestSha256,
        descriptor: expected.entry.descriptor,
      },
    );
    const compare = (ref, capsule) => {
      assert.ok(!paths.has(ref.path), 'Duplicate presentation reference');
      paths.add(ref.path);
      const served = files.get(ref.path.slice(1));
      assert.ok(served, 'Missing presentation capsule');
      assert.equal(served.length, ref.sizeBytes, 'Presentation size drift');
      assert.equal(presentationDigest(served), ref.sha256, 'Presentation digest drift');
      const decoded = parsePresentationCapsule(JSON.parse(served.toString('utf8')));
      assert.deepEqual(decoded, capsule, 'Presentation differs from canonical adapters');
      assert.ok(
        served.equals(Buffer.from(JSON.stringify(capsule))),
        'Nondeterministic presentation bytes',
      );
      bytes += served.length;
    };
    const envelope = {
      artifactType: 'backblaze-presentation',
      contractVersion: 1,
      snapshotId: entry.snapshotId,
      asOfQuarter: entry.asOfQuarter,
      contextSha256: descriptor.contextSha256,
      sourceManifestSha256: entry.sourceManifestSha256,
      descriptor: entry.descriptor,
    };
    compare(actual.matrix, {
      ...envelope,
      kind: 'matrix',
      quarter: null,
      body: adaptProductionV2(descriptor, matrix),
    });
    assert.equal(actual.reports.length, descriptor.quarters.length);
    for (const [index, row] of descriptor.quarters.entries()) {
      const reference = actual.reports[index];
      assert.equal(reference.quarter, row.quarter);
      assert.equal(reference.status, row.status);
      const { matrix: _matrix, context, ...noncontext } = descriptor;
      const thin = {
        ...noncontext,
        context: {
          ...context,
          inventory: context.inventory.map((model) => {
            const label = displayModelLabel(model);
            return {
              modelId: model.modelId,
              vendor: label.vendor,
              modelNumber: label.modelNumber,
            };
          }),
        },
      };
      compare(reference.ref, {
        ...envelope,
        kind: 'report',
        quarter: row.quarter,
        body: {
          descriptor: thin,
          quarter: await loader.loadQuarter(descriptor, row.quarter),
          capacityHistory: history,
        },
      });
      reports++;
    }
  }
  assert.equal(catalogue.snapshots.length, snapshots);
  const emitted = [...files.keys()]
    .filter((path) => /^assets\/presentation-/.test(path))
    .map((path) => `/${path}`);
  assert.deepEqual(emitted.sort(), [...paths].sort(), 'Extra or unadvertised presentation asset');
  return { snapshots, reports, assets: paths.size, bytes };
}

export function presentationCatalogueFromHtml(html) {
  const matches = [
    ...html.matchAll(
      /<script\s+id="presentation-catalogue"\s+type="application\/json">([^<]*)<\/script>/g,
    ),
  ];
  assert.equal(matches.length, 1, 'Exactly one build-owned presentation catalogue is required');
  return parsePresentationCatalogue(JSON.parse(matches[0][1]));
}
