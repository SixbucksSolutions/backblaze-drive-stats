import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { deriveAfrTimeline } from './afr-timeline-data.ts';
import { SnapshotLoader } from './snapshot-loader.ts';

const directory = new URL('../../fixtures/production-v2/', import.meta.url);
const indexName = (await readdir(directory)).find((name) => name.startsWith('sample-index.'))!;
const loader = new SnapshotLoader(
  `https://test.local/${indexName}`,
  async (url) =>
    new Response(
      new Uint8Array(await readFile(new URL(new URL(url).pathname.slice(1), directory))),
    ),
);
const index = await loader.loadIndex();
const original = await loader.loadSnapshot(index.latestSnapshotId);
const matrix = await loader.loadMatrix(original);

void test('matrix-listed HDDs retain pre-threshold exposure and gaps; unlisted inventory is excluded', () => {
  const descriptor = structuredClone(original);
  const context = descriptor.context;
  context.asOfQuarter = '2024-Q2';
  const quarters = ['2022-Q4', '2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2'];
  context.coverage = quarters.map((quarter, i) => ({
    ...context.coverage[0]!,
    quarter,
    status: i === 1 ? 'partial' : i === 2 ? 'missing' : 'complete',
  }));
  const base = {
    ...context.inventory[0]!,
    modelId: 'tiny-hdd',
    mediaClass: 'hdd' as const,
    firstObservedInDeclaredHistory: quarters[0]!,
    reportingAnchorQuarter: null,
    history: quarters.map((quarter, i) => ({
      ...context.inventory[0]!.history[0]!,
      quarter,
      quarterCount: i === 2 ? null : 3,
      knownFailures: i === 1 ? 2 : i === 4 ? 1 : 0,
      knownDriveDays: [100, 50, 0, 0, 150, 0, 0][i]!,
    })),
  };
  context.inventory = [
    base,
    { ...base, modelId: 'unlisted-hdd' },
    { ...base, modelId: 'ssd', mediaClass: 'ssd' },
    { ...base, modelId: 'unseen', firstObservedInDeclaredHistory: null },
  ];
  const selectedMatrix = {
    ...matrix,
    models: ['tiny-hdd', 'ssd', 'unseen'].map((modelId) => ({ ...matrix.models[0]!, modelId })),
  };
  const result = deriveAfrTimeline(descriptor, selectedMatrix);
  assert.deepEqual(
    result.models.map((model) => model.id),
    ['tiny-hdd'],
  );
  const points = result.models[0]!.points;
  assert.equal(points.length, 5);
  assert.deepEqual(
    points.map((point) => point.relativeQuarter),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    points.map((point) => point.cumulativeAfr),
    [0, null, null, null, 365],
  );
  assert.equal(points[4]!.quarterlyAfr, (1 / 150) * 36500);
  assert.equal(points[4]!.historyComplete, false);
  assert.equal(result.rateVersion, context.versions.rate);
  context.asOfQuarter = '2023-Q1';
  assert.equal(deriveAfrTimeline(descriptor, selectedMatrix).models[0]!.points.length, 2);
  assert.deepEqual(deriveAfrTimeline(descriptor, { ...matrix, models: [] }).models, []);
});

void test('shared eligible source points retain canonical matrix arithmetic', () => {
  const timeline = deriveAfrTimeline(original, matrix);
  for (const model of matrix.models) {
    const plotted = timeline.models.find((row) => row.id === model.modelId);
    for (const cell of model.cells) {
      if (cell.status !== 'eligible') {
        continue;
      }
      const point = plotted?.points.find((row) => row.quarter === cell.quarter);
      assert.ok(point?.cumulativeAfr !== null && point?.cumulativeAfr !== undefined);
      assert.ok(cell.metrics.observedRecordedAfr !== null);
      assert.ok(Math.abs(point.cumulativeAfr - cell.metrics.observedRecordedAfr) < 1e-12);
      assert.ok(point.quarterlyAfr !== null && cell.quarterAfr !== null);
      assert.ok(Math.abs(point.quarterlyAfr - cell.quarterAfr) < 1e-12);
    }
  }
});

void test('relative quarters are calendar elapsed quarters even with sparse input rows', () => {
  const descriptor = structuredClone(original);
  const model = descriptor.context.inventory.find((item) => item.mediaClass === 'hdd')!;
  model.firstObservedInDeclaredHistory = '2022-Q4';
  model.history = ['2022-Q4', '2024-Q1'].map((quarter) => ({
    ...model.history[0]!,
    quarter,
    knownDriveDays: 1,
  }));
  descriptor.context.asOfQuarter = '2024-Q1';
  descriptor.context.inventory = [model];
  assert.deepEqual(
    deriveAfrTimeline(descriptor, matrix).models[0]!.points.map((point) => point.relativeQuarter),
    [1, 6],
  );
});
