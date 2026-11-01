import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { CapacityHistoryReader } from '../src/capacity-report.ts';
import { reportCsv } from '../src/snapshot-selection.ts';
import { activeReleaseSelection } from './active-release-selection.ts';
import {
  auditCsv,
  auditMetric,
  auditQuarter,
  auditUnavailable,
  checkIntegratedRelease,
} from './check-integrated-release.mjs';

// Mutations stay in memory. No source history, cache regeneration or fixture edits.
const directory = new URL('../public/data/production/', import.meta.url);
const loader = new SnapshotLoader(
  'https://publication.example/production/index.json',
  async (input) =>
    new Response(
      await readFile(
        new URL(input.slice('https://publication.example/production/'.length), directory),
      ),
    ),
);
const index = await loader.loadIndex();
const descriptor = await loader.loadSnapshot(index.latestSnapshotId);
const matrix = await loader.loadMatrix(descriptor);
const points = await new CapacityHistoryReader(loader).load(index.latestSnapshotId);
const payload = await loader.loadQuarter(descriptor, descriptor.context.asOfQuarter);
const point = points.find((row) => row.quarter === payload.quarter);
const copy = () => structuredClone([descriptor, matrix, payload, point]);

void test('large integer totals reject off-by-one errors while decimal TB permits only arithmetic drift', () => {
  const large = 1_000_000_000_000;
  for (const metric of ['count', 'new', 'failed', 'driveDays', 'retired', 'populationDelta']) {
    auditMetric(large, large, metric, metric);
    assert.throws(() => auditMetric(large + 1, large, metric, metric), { code: 'ERR_ASSERTION' });
    assert.throws(() => auditMetric(large - 1, large, metric, metric), { code: 'ERR_ASSERTION' });
    assert.throws(() => auditMetric(0, null, metric, metric), { code: 'ERR_ASSERTION' });
  }
  auditMetric(1_000_000 + 0.000001, 1_000_000, 'capacityTB', 'rounding drift');
  assert.throws(() => auditMetric(1_000_000 + 0.0001, 1_000_000, 'capacityTB', 'capacity error'));
});

void test('all 53 historical public cutoffs pass every quarter and five report renderers', async () => {
  const result = await checkIntegratedRelease(fileURLToPath(directory));
  assert.equal(result.snapshots.length, activeReleaseSelection.requiredSnapshotCount);
  assert.ok(result.graph.supporting >= activeReleaseSelection.requiredSnapshotCount);
  assert.equal(result.payloadBytes.files, result.graph.files);
  for (const snapshot of result.snapshots) {
    assert.ok(snapshot.contextModels >= snapshot.analysisModels);
    assert.ok(snapshot.inventoryModels >= snapshot.contextModels);
    assert.ok(snapshot.unavailable > 0);
    assert.equal(Object.keys(snapshot.maxRenderedFragmentBytes).length, 5);
  }
});

void test('mixed snapshot identity and future quarters cannot be accepted together', () => {
  for (const key of ['snapshotId', 'asOfQuarter', 'contextSha256']) {
    const args = copy();
    args[2][key] = 'other';
    assert.throws(() => auditQuarter(...args), /Mixed/);
  }
  const args = copy();
  args[2].quarter = '2099-Q1';
  assert.throws(() => auditQuarter(...args), /Future/);
});

void test('context cannot silently collapse to the analysis set or all-supplied to HDD', () => {
  const args = copy();
  const analysis = new Set(args[0].context.selection.analysisModelIds);
  args[2].scopes.selected_hdd.models = args[2].scopes.selected_hdd.models.filter((row) =>
    analysis.has(row.modelId),
  );
  assert.throws(() => auditQuarter(...args), /Whole HDD context/);
  const other = copy();
  other[2].scopes.all_supplied.models = other[2].scopes.selected_hdd.models;
  assert.throws(() => auditQuarter(...other), /All supplied scope/);
});

void test('totals, manufacturer denominator, location allocation and capacity scope corruption are rejected', () => {
  const mutations = [
    (args) => {
      args[2].scopes.selected_hdd.totals.count++;
    },
    (args) => {
      args[2].scopes.selected_hdd.manufacturers[0].populationShare = 1;
    },
    (args) => {
      args[2].datacenters.locations[0].count++;
    },
    (args) => {
      args[3].capacityTB = args[2].scopes.selected_hdd.totals.capacityTB;
    },
  ];
  for (const mutate of mutations) {
    const args = copy();
    mutate(args);
    assert.throws(() => auditQuarter(...args));
  }
});

void test('matrix Count and New remain calendar-bound to the same support model', () => {
  for (const key of ['count', 'new']) {
    const args = copy();
    const cell = args[1].models
      .flatMap((row) => row.cells)
      .find((row) => row.quarter === payload.quarter && row.status === 'eligible');
    assert.ok(cell);
    cell.metrics[key]++;
    assert.throws(() => auditQuarter(...args), /Matrix\/support/);
  }
});

void test('partial observations and missing/unpublished observations never become exact zeros', async () => {
  const quarter = descriptor.quarters.find((row) => row.status === 'partial');
  assert.ok(quarter);
  const partial = await loader.loadQuarter(descriptor, quarter.quarter);
  const partialPoint = points.find((row) => row.quarter === quarter.quarter);
  auditQuarter(descriptor, matrix, partial, partialPoint);
  const corrupt = structuredClone(partial);
  corrupt.scopes.selected_hdd.models[0].count = 0;
  assert.throws(
    () => auditQuarter(descriptor, matrix, corrupt, partialPoint),
    /Cross-scope|Partial/,
  );
  for (const status of ['missing', 'unpublished']) {
    auditUnavailable(status, { count: null, capacityTB: null, capacityDeltaTB: null });
    assert.throws(
      () => auditUnavailable(status, { count: 0, capacityTB: null, capacityDeltaTB: null }),
      /cannot be zero/,
    );
  }
});

const meta = {
  snapshotId: 'release',
  asOfQuarter: '2026-Q2',
  quarter: '2026-Q1',
  status: 'complete',
  kind: 'backblaze',
  sourceUrl: 'https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data',
  scope: 'selected_hdd',
  contextCount: 12,
  contextNew: 2,
  report: 'deployments',
  filterDescription: 'Vendor: =formula, selected model',
};
void test('CSV preserves filtered attribution, exact negatives, quoting and formula safety', () => {
  const content = reportCsv(
    [
      ['Model', 'Delta'],
      ['=SUM(1,2)', -2],
      ['quoted "model"\nsecond line', 0],
      ['-command', 1],
    ],
    meta,
  );
  assert.equal(
    auditCsv(content, {
      Snapshot: 'release',
      Scope: 'selected_hdd',
      'Whole scope observed drives': 12,
      'Visible row filters': meta.filterDescription,
    }),
    3,
  );
  assert.throws(() => auditCsv(content, { Scope: 'all_supplied' }), /metadata Scope/);
  assert.throws(() => auditCsv(content.replace("'=SUM", '=SUM'), {}), /Unsafe CSV/);
  assert.throws(() => auditCsv(content.replace("'-command", '-command'), {}), /Unsafe CSV/);
});

void test('CSV privacy audit rejects recognizable paths and credentials', () => {
  for (const unsafe of ['C:\\private\\source.csv', 'token=do-not-print']) {
    const content = reportCsv([['Model'], [unsafe]], meta);
    assert.throws(() => auditCsv(content, {}), /Private/);
  }
});

void test('CSV column names must be unique so metadata cannot bind ambiguously', () => {
  const ambiguous = reportCsv([['Coverage'], ['complete']], meta);
  assert.throws(() => auditCsv(ambiguous, { Coverage: 'complete' }), /Duplicate CSV column names/);
});
