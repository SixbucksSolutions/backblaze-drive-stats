import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseProductionMatrix,
  parseSupportingQuarter,
  parseStrictJson,
  verifyReference,
  validateMatrixQuarter,
} from './production-data.ts';
import type { SnapshotDescriptor } from './production-data.ts';

const directory = new URL('../../fixtures/production-v2/', import.meta.url);
const names = await readdir(directory);
const bytes = (name: string) => readFile(new URL(name, directory));
const index = parseProductionIndex(
  await bytes(names.find((name) => name.startsWith('sample-index.'))!),
);
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const descriptors: SnapshotDescriptor[] = [];
for (const entry of index.snapshots) {
  descriptors.push(parseSnapshotDescriptor(await bytes(entry.descriptor.path), entry));
}

void test('both fictional generation graphs pass strict parsing and exact byte validation', async () => {
  for (const [i, entry] of index.snapshots.entries()) {
    await verifyReference(await bytes(entry.descriptor.path), entry.descriptor);
    const descriptor = descriptors[i]!;
    await verifyReference(await bytes(descriptor.matrix.path), descriptor.matrix);
    const matrix = parseProductionMatrix(await bytes(descriptor.matrix.path), descriptor);
    assert.deepEqual(
      matrix.models.map((model) => model.modelId).sort(),
      [...descriptor.context.selection.analysisModelIds].sort(),
    );
    for (const quarter of descriptor.quarters) {
      if (!quarter.payload) {
        continue;
      }
      await verifyReference(await bytes(quarter.payload.path), quarter.payload);
      const payload = parseSupportingQuarter(
        await bytes(quarter.payload.path),
        descriptor,
        quarter.quarter,
      );
      validateMatrixQuarter(matrix, payload);
      assert.equal(payload.status, quarter.status);
    }
  }
});

void test('lazy cross-payload reconciliation rejects conflicting New values', async () => {
  const descriptor = descriptors[0]!;
  const matrix = parseProductionMatrix(await bytes(descriptor.matrix.path), descriptor);
  const eligible = matrix.models[0]!.cells.find((cell) => cell.status === 'eligible')!;
  const quarter = descriptor.quarters.find((row) => row.quarter === eligible.quarter)!;
  const payload = parseSupportingQuarter(
    await bytes(quarter.payload!.path),
    descriptor,
    quarter.quarter,
  );
  validateMatrixQuarter(matrix, payload);
  const changed = structuredClone(payload);
  changed.scopes.selected_hdd.models.find((row) => row.modelId === matrix.models[0]!.modelId)!.new =
    (eligible.metrics.new ?? 0) + 1;
  assert.throws(() => validateMatrixQuarter(matrix, changed), /New disagreement/);
});

void test('JSON boundaries reject duplicate decoded keys, nonfinite numbers, malformed UTF-8 and trailing input', () => {
  for (const source of [
    '{"a":1,"\\u0061":2}',
    '{"nested":{"a":1,"a":2}}',
    '[1e999]',
    '[NaN]',
    '[1,]',
    '{} true',
  ]) {
    assert.throws(() => parseStrictJson(new TextEncoder().encode(source)));
  }
  assert.throws(() => parseStrictJson(new Uint8Array([0xff])));
});

void test('index rejects unknown/serial fields, unsafe references, versions and duplicate snapshot identities', () => {
  const entry = index.snapshots[0]!;
  for (const path of [
    '../x.json',
    'https://user:secret@example.com/file.json',
    'C:/private/x.json',
    '%2e%2e/x.json',
    '/x.json',
    'a\\x.json',
  ]) {
    assert.throws(() =>
      parseProductionIndex(
        encode({ ...index, snapshots: [{ ...entry, descriptor: { ...entry.descriptor, path } }] }),
      ),
    );
  }
  assert.throws(() => parseProductionIndex(encode({ ...index, serial: 'private' })));
  assert.throws(() => parseProductionIndex(encode({ ...index, contractVersion: '1.0.0' })));
  assert.throws(() => parseProductionIndex(encode({ ...index, snapshots: [entry, entry] })));
});

void test('descriptor rejects mixed identity, semantic versions, selected SSD and unavailable payload references', () => {
  const descriptor = descriptors[0]!;
  const entry = index.snapshots[0]!;
  assert.throws(() =>
    parseSnapshotDescriptor(encode(descriptor), { ...entry, sourceManifestSha256: 'f'.repeat(64) }),
  );
  const unsupported = structuredClone(descriptor);
  unsupported.context.versions.rate = '99.0.0';
  assert.throws(() => parseSnapshotDescriptor(encode(unsupported), entry));
  const invalidScope = structuredClone(descriptor);
  invalidScope.context.selection.contextModelIds.push('unknown-model');
  assert.throws(() => parseSnapshotDescriptor(encode(invalidScope), entry));
  const invalidQuarter = structuredClone(descriptor);
  const available = invalidQuarter.quarters.find((row) => row.payload)!;
  available.payload = null;
  assert.throws(() => parseSnapshotDescriptor(encode(invalidQuarter), entry));
});

void test('evidence and provenance URLs share the producer public-host privacy boundary', () => {
  const descriptor = descriptors[0]!;
  const entry = index.snapshots[0]!;
  for (const host of [
    '127.0.0.1',
    '10.1.2.3',
    '100.64.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '192.0.0.8',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '240.0.0.1',
    'localhost',
    'service.internal',
    'host.local',
    'host.home.arpa',
    'host.test',
    '-bad.example.com',
    'singlelabel',
  ]) {
    for (const target of ['provenance', 'evidence'] as const) {
      const changed = structuredClone(descriptor);
      const url = `https://${host}/private`;
      if (target === 'provenance') {
        changed.context.provenance.url = url;
      } else {
        changed.context.inventory[0]!.history[0]!.evidence[0]!.url = url;
      }
      assert.throws(
        () => parseSnapshotDescriptor(encode(changed), entry),
        /private evidence/,
        host,
      );
    }
  }
  for (const host of ['8.8.8.8', '192.0.0.9', '192.0.0.10', 'EXAMPLE.COM.']) {
    const changed = structuredClone(descriptor);
    changed.context.provenance.url = `https://${host}/public`;
    assert.doesNotThrow(() => parseSnapshotDescriptor(encode(changed), entry), host);
  }
});

void test('producer retained normalizer/classification lineage remains compatible with v2 semantics', () => {
  const descriptor = structuredClone(descriptors[0]!);
  descriptor.context.versions.normalization = '1.0.0';
  descriptor.context.versions.classification = '1.0.0';
  assert.doesNotThrow(() => parseSnapshotDescriptor(encode(descriptor), index.snapshots[0]!));
  for (const key of Object.keys(
    descriptor.context.versions,
  ) as (keyof typeof descriptor.context.versions)[]) {
    const changed = structuredClone(descriptor);
    changed.context.versions[key] = '99.0.0';
    assert.throws(
      () => parseSnapshotDescriptor(encode(changed), index.snapshots[0]!),
      /unsupported semantic version/,
    );
  }
});

void test('2.1 distinct failures respect the quarter identity bound while 2.0 retains flag counts', () => {
  const changed = structuredClone(descriptors[0]!);
  const ledger = changed.context.inventory[0]!.history[1]!;
  ledger.knownFailures = ledger.knownIdentityLowerBound! + 1;
  assert.ok(ledger.knownFailures <= ledger.knownDriveDays);
  assert.doesNotThrow(() => parseSnapshotDescriptor(encode(changed), index.snapshots[0]!));
  changed.context.versions.rate = '2.1.0';
  assert.throws(
    () => parseSnapshotDescriptor(encode(changed), index.snapshots[0]!),
    /distinct failure\/identity budget/,
  );
});

void test('2.1 empty analysis retains supplied evidence and rejects legacy or invented membership', async () => {
  const descriptor = structuredClone(descriptors[0]!);
  descriptor.context.versions.rate = '2.1.0';
  const selection = descriptor.context.selection;
  selection.analysisModelIds = [];
  selection.purchaseDefaultModelIds = [];
  selection.historicalReferenceModelIds = [];
  // Empty analysis can coexist with a populated HDD context.
  assert.doesNotThrow(() => parseSnapshotDescriptor(encode(descriptor), index.snapshots[0]!));
  const matrix = structuredClone(
    parseProductionMatrix(await bytes(descriptor.matrix.path), descriptors[0]!),
  );
  matrix.models = [];
  matrix.relativeQuarterCount = 24;
  matrix.rateBasis = 'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1';
  matrix.rateLabel = 'Observed-history AFR (quarterly unique failures)';
  assert.doesNotThrow(() => parseProductionMatrix(encode(matrix), descriptor));
  const legacy = structuredClone(descriptor);
  legacy.context.versions.rate = '2.0.0';
  assert.throws(
    () => parseSnapshotDescriptor(encode(legacy), index.snapshots[0]!),
    /empty analysis requires/,
  );
  const droppedContext = structuredClone(descriptor);
  droppedContext.context.selection.contextModelIds = [];
  assert.throws(
    () => parseSnapshotDescriptor(encode(droppedContext), index.snapshots[0]!),
    /context membership/,
  );
  // Fictional classification variant: supplied observations remain, with no HDD context.
  for (const model of descriptor.context.inventory) {
    model.mediaClass = 'unclassified';
    model.seedMatch = false;
  }
  selection.contextModelIds = [];
  selection.positiveSeed.modelIds = [];
  assert.doesNotThrow(() => parseSnapshotDescriptor(encode(descriptor), index.snapshots[0]!));
  for (const quarter of descriptor.quarters.filter((row) => row.payload !== null)) {
    const payload = structuredClone(
      parseSupportingQuarter(await bytes(quarter.payload!.path), descriptors[0]!, quarter.quarter),
    );
    const supplied = structuredClone(payload.scopes.all_supplied);
    const selected = payload.scopes.selected_hdd;
    selected.models = [];
    selected.manufacturers = [];
    const value = payload.status === 'complete' ? 0 : null;
    selected.totals = { count: value, new: value, capacityTB: value };
    selected.capacityDeltaTB = selected.capacityDeltaReason === 'previous_complete' ? 0 : null;
    assert.doesNotThrow(() => parseSupportingQuarter(encode(payload), descriptor, quarter.quarter));
    assert.deepEqual(payload.scopes.all_supplied, supplied);
    if (payload.status === 'partial') {
      selected.totals.count = 0;
      assert.throws(
        () => parseSupportingQuarter(encode(payload), descriptor, quarter.quarter),
        /scope totals/,
      );
    }
  }
  for (const field of ['purchaseDefaultModelIds', 'historicalReferenceModelIds'] as const) {
    const changed = structuredClone(descriptor);
    changed.context.selection[field] = [changed.context.inventory[0]!.modelId];
    assert.throws(
      () => parseSnapshotDescriptor(encode(changed), index.snapshots[0]!),
      /default\/reference membership/,
    );
  }
});

void test('large integer population totals and manufacturer counts reconcile exactly', async () => {
  const descriptor = structuredClone(descriptors[0]!);
  const quarter = descriptor.quarters.findLast((row) => row.status === 'complete')!;
  const payload = parseSupportingQuarter(
    await bytes(quarter.payload!.path),
    descriptors[0]!,
    quarter.quarter,
  );
  const changed = structuredClone(payload);
  const model = descriptor.context.inventory.find((item) =>
    item.history.some((row) => row.quarter === quarter.quarter && (row.quarterCount ?? 0) >= 2000),
  )!;
  const ledger = model.history.find((row) => row.quarter === quarter.quarter)!;
  const oldCount = ledger.quarterCount!;
  const scale = 1000000;
  ledger.quarterCount = oldCount * scale;
  ledger.knownIdentityLowerBound = ledger.quarterCount;
  ledger.knownFailures *= scale;
  ledger.knownDriveDays *= scale;
  descriptor.context.coverage.find((row) => row.quarter === quarter.quarter)!.knownObservationRows =
    descriptor.context.inventory.reduce(
      (total, item) =>
        total + item.history.find((row) => row.quarter === quarter.quarter)!.knownDriveDays,
      0,
    );
  for (const scope of Object.values(changed.scopes)) {
    const modelRow = scope.models.find((row) => row.modelId === model.modelId)!;
    for (const key of ['count', 'new', 'capacityTB'] as const) {
      modelRow[key] = modelRow[key]! * scale;
    }
    for (const key of ['count', 'new', 'capacityTB'] as const) {
      scope.totals[key] = scope.models.reduce((total, row) => total + row[key]!, 0);
      for (const vendor of scope.manufacturers) {
        vendor[key] = scope.models
          .filter(
            (row) =>
              descriptor.context.inventory.find((item) => item.modelId === row.modelId)!.vendor ===
              vendor.vendor,
          )
          .reduce((total, row) => total + row[key]!, 0);
      }
    }
    for (const vendor of scope.manufacturers) {
      for (const [key, share] of [
        ['count', 'populationShare'],
        ['new', 'newShare'],
        ['capacityTB', 'capacityShare'],
      ] as const) {
        vendor[share] = scope.totals[key] ? vendor[key]! / scope.totals[key] : null;
      }
    }
    if (scope.capacityDeltaTB !== null) {
      scope.capacityDeltaTB += (ledger.quarterCount - oldCount) * model.capacityTB!;
    }
  }
  const unknown = changed.datacenters.locations.find((row) => row.name === 'Unknown')!;
  unknown.count! += ledger.quarterCount - oldCount;
  unknown.capacityTB! += (ledger.quarterCount - oldCount) * model.capacityTB!;
  changed.datacenters.knownLocationPopulationShare =
    (changed.scopes.all_supplied.totals.count! - unknown.count!) /
    changed.scopes.all_supplied.totals.count!;
  parseSnapshotDescriptor(encode(descriptor), index.snapshots[0]!);
  parseSupportingQuarter(encode(changed), descriptor, quarter.quarter);
  for (const mutation of [
    'count',
    'new',
    'manufacturerCount',
    'manufacturerNew',
    'locationCount',
  ] as const) {
    const invalid = structuredClone(changed);
    if (mutation === 'count' || mutation === 'new') {
      invalid.scopes.selected_hdd.totals[mutation]!++;
    } else if (mutation === 'locationCount') {
      invalid.datacenters.locations[0]!.count!++;
    } else {
      invalid.scopes.selected_hdd.manufacturers.find((row) => row.vendor === model.vendor)![
        mutation === 'manufacturerCount' ? 'count' : 'new'
      ]!++;
    }
    assert.throws(
      () => parseSupportingQuarter(encode(invalid), descriptor, quarter.quarter),
      /totals/,
      mutation,
    );
  }
});

void test('payloads reject mixed generation, scope membership and unavailable metric claims', async () => {
  const descriptor = descriptors[0]!;
  const matrix = parseProductionMatrix(await bytes(descriptor.matrix.path), descriptor);
  assert.throws(() =>
    parseProductionMatrix(encode({ ...matrix, contextSha256: 'f'.repeat(64) }), descriptor),
  );
  const invalidMatrix = structuredClone(matrix);
  invalidMatrix.models[0]!.cells.find((cell) => cell.status !== 'eligible')!.metrics.count = 1;
  assert.throws(() => parseProductionMatrix(encode(invalidMatrix), descriptor));
  const quarter = descriptor.quarters.find((row) => row.status === 'partial' && row.payload)!;
  const payload = parseSupportingQuarter(
    await bytes(quarter.payload!.path),
    descriptor,
    quarter.quarter,
  );
  const invalidPartial = structuredClone(payload);
  invalidPartial.scopes.selected_hdd.models[0]!.count = 0;
  assert.throws(() => parseSupportingQuarter(encode(invalidPartial), descriptor, quarter.quarter));
  const invalidScope = structuredClone(payload);
  invalidScope.scopes.all_supplied.models.pop();
  assert.throws(() => parseSupportingQuarter(encode(invalidScope), descriptor, quarter.quarter));
});

void test('reference verification uses exact bytes, length and embedded filename hash', async () => {
  const reference = index.snapshots[0]!.descriptor;
  const raw = await bytes(reference.path);
  const changed = new Uint8Array(raw);
  changed[0] = 32;
  await assert.rejects(verifyReference(changed, reference), /hash/);
  await assert.rejects(verifyReference(raw.subarray(1), reference), /size/);
  await assert.rejects(
    verifyReference(raw, { ...reference, path: `fake.${'f'.repeat(64)}.json` }),
    /path/,
  );
});
