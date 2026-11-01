import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { SnapshotLoader } from './snapshot-loader.ts';
import { parseProductionIndex } from './production-data.ts';
import {
  adaptProductionV2,
  initializedBaselineLabel,
  MatrixProductionReader,
  productionDomain,
} from './matrix-production.ts';
import { axisExtent, cellAt, metrics, visibleModels } from './matrix-data.ts';

function localLoader(directory: URL, indexName = 'index.json') {
  const calls: string[] = [];
  const loader = new SnapshotLoader(`https://matrix.test/${indexName}`, async (url) => {
    const path = new URL(url).pathname.slice(1);
    calls.push(path);
    return new Response(new Uint8Array(await readFile(new URL(path, directory))));
  });
  return { loader, calls };
}
const production = new URL('../public/data/production/', import.meta.url);
const samples = new URL('../../fixtures/production-v2/', import.meta.url);
const sampleIndex = (await readdir(samples)).find((name) => name.startsWith('sample-index.'))!;

void test('real three-snapshot matrix maps every v2 display value without changing source semantics or shared domains', async () => {
  const { loader, calls } = localLoader(production);
  const index = await loader.loadIndex();
  assert.equal(calls.length, 1);
  assert.equal(
    index.snapshots.find((s) => s.snapshotId === index.latestSnapshotId)?.asOfQuarter,
    '2026-Q2',
  );
  for (const entry of index.snapshots) {
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const view = adaptProductionV2(descriptor, matrix);
    assert.equal(view.kind, 'production');
    assert.equal(view.rateLabel, 'Observed-history AFR');
    assert.equal(view.models.length, entry.asOfQuarter === '2026-Q2' ? 22 : 21);
    assert.equal(descriptor.context.selection.purchaseDefaultModelIds.length, 0);
    assert.equal(descriptor.context.selection.historicalReferenceModelIds.length, 0);
    assert.deepEqual(
      new Set(view.models.map((m) => m.id)),
      new Set(descriptor.context.selection.analysisModelIds),
    );
    assert.equal(view.cutoff, descriptor.context.cutoffDate);
    for (const model of matrix.models) {
      const adapted = view.models.find((m) => m.id === model.modelId)!;
      assert.equal(adapted.anchor, model.reportingAnchorQuarter);
      for (const [i, cell] of model.cells.entries()) {
        assert.deepEqual(adapted.cells[i]!.metrics, {
          afr: cell.metrics.observedRecordedAfr,
          afrDelta: cell.metrics.observedRecordedAfrDelta,
          count: cell.metrics.count,
          populationDelta: cell.metrics.populationDelta,
          new: cell.metrics.new,
          retired: cell.metrics.retired,
          failed: cell.metrics.failed,
        });
        assert.equal(adapted.cells[i]!.relativeQuarter, cell.relativeQuarter);
        assert.equal(adapted.cells[i]!.quarter, cell.quarter);
        if (cell.status === 'eligible') {
          assert.equal(
            adapted.cells[i]!.cumulativeComponents?.complete,
            cell.sourceHistoryComplete,
          );
        }
        if (cell.retiredReason === 'cutoff_failed_proxy') {
          assert.match(adapted.cells[i]!.retirementInference!, /PROVISIONAL/);
        }
      }
    }
    for (const metric of metrics) {
      const values = view.models
        .flatMap((m) =>
          m.cells
            .filter((c) => c.state === 'eligible' && c.metrics[metric] !== null)
            .map((c) => c.metrics[metric]!),
        )
        .toSorted((a, b) => a - b);
      assert.equal(view.domains[metric].sampleCount, values.length);
      assert.equal(view.domains[metric].observedMinimum, values[0]);
      assert.equal(view.domains[metric].observedMaximum, values.at(-1));
    }
    const domains = structuredClone(view.domains);
    visibleModels(view, new Set([view.models[0]!.id]));
    assert.deepEqual(view.domains, domains);
    assert.ok(axisExtent(view, 6) >= 24);
    assert.throws(
      () => adaptProductionV2({ ...descriptor, contextSha256: '0'.repeat(64) }, matrix),
      /matching validated v2/,
    );
  }
  assert.equal(
    calls.length,
    7,
    'index and only three selected descriptor/matrix pairs, no supporting quarter fetches',
  );
});

void test('partial threshold anchor, source gap, reentry, initialization and future padding preserve evidence and nulls', async () => {
  const { loader } = localLoader(samples, sampleIndex);
  const index = await loader.loadIndex();
  const entry = index.snapshots.find((s) => s.asOfQuarter === '2014-Q2')!;
  const descriptor = await loader.loadSnapshot(entry.snapshotId);
  const matrix = await loader.loadMatrix(descriptor);
  const view = adaptProductionV2(descriptor, matrix);
  const model = view.models.find((m) => m.id === 'sample-seed-hdd')!;
  assert.equal(model.anchor, '2013-Q2');
  const first = model.cells[0]!;
  assert.equal(first.state, 'source_incomplete');
  assert.ok(Object.values(first.metrics).every((n) => n === null));
  assert.equal(
    first.quarterComponents?.driveDays,
    descriptor.context.inventory
      .find((m) => m.modelId === model.id)!
      .history.find((q) => q.quarter === '2013-Q2')!.knownDriveDays,
  );
  assert.ok(
    first.productionEvidence?.some(
      (d) => d.label === 'Threshold proof' && d.value === 'partial_identity_lower_bound',
    ),
  );
  assert.ok(
    first.productionEvidence?.some(
      (d) => d.label.startsWith('Known identity') && Number(d.value) >= 2000,
    ),
  );
  const initialized = model.cells[1]!;
  assert.ok(initialized.metrics.afr! > 0);
  assert.ok(initialized.metrics.count! > 0);
  assert.equal(initialized.metrics.afrDelta, 0);
  assert.equal(initialized.metrics.populationDelta, 0);
  assert.deepEqual(initialized.deltaBaseline, {
    kind: 'initial_zero_delta',
    priorQuarter: null,
    elapsedQuarters: null,
    afr: null,
    count: null,
  });
  assert.equal(
    initializedBaselineLabel(initialized.deltaBaseline),
    'Deltas initialized to zero. Prior AFR/Count baseline and elapsed span: not applicable.',
  );
  assert.equal(model.cells[2]!.state, 'source_missing');
  assert.equal(model.cells[3]!.state, 'below_threshold');
  const reentry = model.cells[4]!;
  assert.ok(reentry.metrics.afr! > 0);
  assert.equal(reentry.deltaBaseline?.priorQuarter, '2013-Q3');
  assert.equal(reentry.deltaBaseline?.elapsedQuarters, 3);
  assert.equal(reentry.cumulativeComponents?.complete, false);
  assert.ok(
    reentry.productionEvidence?.some(
      (d) => d.label.startsWith('Complete-history') && d.value === 'Unavailable',
    ),
  );
  assert.equal(cellAt(model, 24).state, 'snapshot_end');
  assert.equal(cellAt(model, 24).quarterComponents, undefined);
  assert.equal(
    view.models.find((m) => m.id === 'sample-new-vendor-hdd')?.vendor,
    'Sample New Vendor',
  );
});

void test('effective color rules cover empty, zero, singleton, signed, duplicate medians and fixed AFR endpoints', () => {
  assert.deepEqual(productionDomain([], 'count').knots, []);
  assert.deepEqual(productionDomain([0], 'failed').knots, [{ value: 0, color: '#00FF00' }]);
  assert.deepEqual(productionDomain([0], 'new').knots, [{ value: 0, color: '#FFFFFF' }]);
  assert.deepEqual(productionDomain([5], 'count').knots, [{ value: 5, color: '#FFFF00' }]);
  assert.deepEqual(productionDomain([2, 2, 4], 'failed').knots, [
    { value: 2, color: '#FFFF00' },
    { value: 4, color: '#FF0000' },
  ]);
  assert.deepEqual(productionDomain([0, 0, 4], 'retired').knots, [
    { value: 0, color: '#00FF00' },
    { value: 4, color: '#FF0000' },
  ]);
  assert.deepEqual(productionDomain([0, 4, 4], 'retired').knots, [
    { value: 0, color: '#00FF00' },
    { value: 4, color: '#FFFF00' },
  ]);
  assert.deepEqual(productionDomain([-2, 0, 3], 'afrDelta').knots, [
    { value: -2, color: '#00FF00' },
    { value: 0, color: '#FFFFFF' },
    { value: 3, color: '#FF0000' },
  ]);
  assert.deepEqual(productionDomain([1, 4], 'afr').knots, [
    { value: 1, color: '#FFFF00' },
    { value: 2, color: '#FF0000' },
  ]);
  assert.deepEqual(productionDomain([0], 'afr').knots, [
    { value: 0, color: '#00FF00' },
    { value: 1, color: '#FFFF00' },
    { value: 2, color: '#FF0000' },
  ]);
});

void test('rapid snapshot requests suppress stale completion even when transport ignores abort; external cancellation remains canceled', async () => {
  const index = parseProductionIndex(await readFile(new URL(sampleIndex, samples)));
  const first = index.snapshots[0]!,
    second = index.snapshots[1]!;
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const loader = new SnapshotLoader(`https://matrix.test/${sampleIndex}`, async (url) => {
    const path = new URL(url).pathname.slice(1);
    if (path === first.descriptor.path) {
      reached();
      await blocked;
    }
    return new Response(new Uint8Array(await readFile(new URL(path, samples))));
  });
  const reader = new MatrixProductionReader(loader);
  const stale = reader.select(first.snapshotId);
  await started;
  const fresh = await reader.select(second.snapshotId);
  release();
  assert.equal(await stale, null);
  assert.equal(fresh?.id, second.snapshotId);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(reader.select(second.snapshotId, abort.signal), { name: 'AbortError' });
  assert.equal((await reader.select(second.snapshotId))?.id, second.snapshotId);
  await assert.rejects(reader.select('unadvertised'), /not advertised/);
});
