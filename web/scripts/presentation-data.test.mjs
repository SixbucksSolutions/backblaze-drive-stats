import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { derivePresentationSnapshots } from './presentation-capsules.mjs';
import { parsePresentationCapsule, parsePresentationCatalogue } from '../src/presentation-data.ts';

const first = await derivePresentationSnapshots(
  fileURLToPath(new URL('../public/data/production/', import.meta.url)),
).next();
assert.ok(first.value);
const matrix = first.value.matrixCapsule;
const report = first.value.reports.at(-1).capsule;
const timeline = first.value.timelineCapsule;
const bad = (original, mutate) => {
  const value = structuredClone(original);
  mutate(value);
  assert.throws(() => parsePresentationCapsule(value));
};
test('presentation types retain complete adapter and report body structures', () => {
  assert.deepEqual(parsePresentationCapsule(matrix), matrix);
  assert.deepEqual(parsePresentationCapsule(report), report);
  assert.deepEqual(parsePresentationCapsule(timeline), timeline);
  assert.ok(
    report.body.descriptor.context.inventory.every(
      (model) => Object.keys(model).sort().join(',') === 'modelId,modelNumber,vendor',
    ),
  );
});
test('timeline rejects mixed bindings, invalid points and duplicate models', () => {
  bad(timeline, (v) => {
    v.body.snapshotId = 'different';
  });
  bad(timeline, (v) => {
    v.body.asOfQuarter = '2099-Q1';
  });
  bad(timeline, (v) => {
    v.body.sourceManifestSha256 = '0'.repeat(64);
  });
  bad(timeline, (v) => {
    v.body.models.push(v.body.models[0]);
  });
  bad(timeline, (v) => {
    v.body.models[0].points[0].relativeQuarter = 0;
  });
  bad(timeline, (v) => {
    v.body.models[0].points[0].quarterlyAfr = Infinity;
  });
  bad(timeline, (v) => {
    v.body.models[0].points[0].driveDays = -1;
  });
  bad(timeline, (v) => {
    v.body.models[0].points[0].coverage = 'partial';
    v.body.models[0].points[0].cumulativeAfr = 1;
  });
});
test('presentation structural validation rejects unsupported/malformed/nonfinite values', () => {
  bad(matrix, (v) => {
    v.contractVersion = 2;
  });
  bad(matrix, (v) => {
    v.kind = 'capacity';
  });
  bad(matrix, (v) => {
    delete v.descriptor;
  });
  bad(matrix, (v) => {
    v.extra = true;
  });
  const invalid = structuredClone(matrix);
  invalid.body.extent = Infinity;
  assert.throws(() => parsePresentationCapsule(invalid));
  const invalidState = structuredClone(matrix);
  invalidState.body.models[0].cells[0].state = 'unknown';
  assert.throws(() => parsePresentationCapsule(invalidState));
  const invalidUrl = structuredClone(report);
  invalidUrl.body.descriptor.context.provenance.url = 'javascript:alert(1)';
  assert.throws(() => parsePresentationCapsule(invalidUrl));
});
test('presentation rejects mixed context, source, snapshot, quarter and history bindings', () => {
  bad(matrix, (v) => {
    v.sourceManifestSha256 = '0'.repeat(64);
  });
  for (const field of ['snapshotId', 'asOfQuarter', 'contextSha256', 'sourceManifestSha256']) {
    const value = structuredClone(report);
    Object.assign(value.body.descriptor.context, {
      [field]: field.includes('Sha256') ? '0'.repeat(64) : '2099-Q4',
    });
    assert.throws(() => parsePresentationCapsule(value));
  }
  const quarter = structuredClone(report);
  quarter.quarter = '2099-Q4';
  assert.throws(() => parsePresentationCapsule(quarter));
  const history = structuredClone(report);
  history.body.capacityHistory = [];
  assert.throws(() => parsePresentationCapsule(history));
});
test('catalogue rejects unsafe paths and duplicate/unknown snapshot identities', () => {
  const reference = {
    path: '/assets/presentation-test-abcdefgh.json',
    sha256: '0'.repeat(64),
    sizeBytes: 1,
  };
  const snapshot = {
    snapshotId: matrix.snapshotId,
    asOfQuarter: matrix.asOfQuarter,
    contextSha256: matrix.contextSha256,
    sourceManifestSha256: matrix.sourceManifestSha256,
    descriptor: matrix.descriptor,
    matrix: reference,
    reports: [{ quarter: report.quarter, status: 'complete', ref: reference }],
  };
  const catalogue = {
    contractVersion: 1,
    sourceIndexSha256: first.value.sourceIndexSha256,
    latestSnapshotId: matrix.snapshotId,
    snapshots: [snapshot],
  };
  assert.deepEqual(parsePresentationCatalogue(catalogue), catalogue);
  for (const path of [
    '//evil.test/assets/x-abcdefgh.json',
    '/assets/../x-abcdefgh.json',
    '/assets/x-abcdefgh.json?q=1',
  ]) {
    assert.throws(() =>
      parsePresentationCatalogue({
        ...catalogue,
        snapshots: [{ ...snapshot, matrix: { ...reference, path } }],
      }),
    );
  }
  assert.throws(() =>
    parsePresentationCatalogue({ ...catalogue, snapshots: [snapshot, snapshot] }),
  );
  assert.throws(() => parsePresentationCatalogue({ ...catalogue, latestSnapshotId: 'unknown' }));
});
