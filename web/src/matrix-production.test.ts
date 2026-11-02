import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { SnapshotLoader } from './snapshot-loader.ts';
import {
  parseProductionIndex,
  parseProductionMatrix,
  parseSnapshotDescriptor,
  verifyReference,
} from './production-data.ts';
import {
  adaptProductionV2,
  initializedBaselineLabel,
  MatrixProductionReader,
  productionDomain,
} from './matrix-production.ts';
import { axisExtent, cellAt, metrics, visibleModels } from './matrix-data.ts';
import { activeReleaseSelection } from '../scripts/active-release-selection.ts';

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

void test('matrix carries nominal per-drive capacity from inventory without changing raw model identity or metrics', async () => {
  const { loader } = localLoader(samples, sampleIndex);
  const index = await loader.loadIndex();
  const descriptor = structuredClone(await loader.loadSnapshot(index.latestSnapshotId));
  const matrix = await loader.loadMatrix(descriptor);
  const before = adaptProductionV2(descriptor, matrix);
  const entry = descriptor.context.inventory.find(
    (row) => row.modelId === matrix.models[0]!.modelId,
  )!;
  for (const capacityTB of [12, 1.5, null]) {
    entry.capacityTB = capacityTB;
    const after = adaptProductionV2(descriptor, matrix);
    assert.equal(after.models[0]!.capacityTB, capacityTB);
    assert.equal(after.models[0]!.name, entry.modelNumber);
    assert.equal(after.models[0]!.id, entry.modelId);
    assert.deepEqual(after.models[0]!.cells, before.models[0]!.cells);
    assert.deepEqual(after.domains, before.domains);
  }
});

void test('customer fleet metadata reaches the matrix without changing legacy presentations', async () => {
  const { loader } = localLoader(samples, sampleIndex);
  const index = await loader.loadIndex();
  const descriptor = await loader.loadSnapshot(index.latestSnapshotId);
  const matrix = await loader.loadMatrix(descriptor);
  assert.equal(adaptProductionV2(descriptor, matrix).hddScopeDescription, undefined);
  const labeled = structuredClone(descriptor);
  labeled.context.versions.selection = '2.1.0';
  labeled.context.selection.minimumCapacityTB = 1;
  labeled.context.selection.excludedModelIds = [labeled.context.inventory[0]!.modelId];
  const view = adaptProductionV2(labeled, matrix);
  assert.match(view.hddScopeDescription!, /observed by this snapshot cutoff.*≥1 TB/);
  assert.ok(view.hddScopeDescription!.includes(labeled.context.inventory[0]!.modelNumber));
  assert.match(view.hddScopeDescription!, /AFR comparison separately requires at least 2,000/);
  assert.deepEqual(view.models, adaptProductionV2(descriptor, matrix).models);
});

void test('2.1 calculation semantics subtract synthetic zero while legacy zero deltas remain versioned', async () => {
  const { loader } = localLoader(samples, sampleIndex);
  const index = await loader.loadIndex();
  const entry = structuredClone(index.snapshots[0]!);
  const descriptor = structuredClone(await loader.loadSnapshot(entry.snapshotId));
  const matrix = structuredClone(await loader.loadMatrix(descriptor));
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, canonical(item)]),
          )
        : value;
  descriptor.context.versions.rate = '2.1.0';
  descriptor.context.snapshotId += '-matrix-2-1';
  entry.snapshotId = descriptor.context.snapshotId;
  matrix.snapshotId = entry.snapshotId;
  descriptor.contextSha256 = hash(encode(canonical(descriptor.context)));
  matrix.contextSha256 = descriptor.contextSha256;
  matrix.rateBasis = 'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1';
  matrix.rateLabel = 'Observed-history AFR (quarterly unique failures)';
  assert.throws(
    () => parseProductionMatrix(encode(matrix), descriptor),
    /initial population delta|initial rate delta/,
  );
  for (const model of matrix.models) {
    const first = model.cells.find((cell) => cell.status === 'eligible');
    if (first) {
      first.metrics.populationDelta = first.metrics.count;
      first.metrics.observedRecordedAfrDelta = first.metrics.observedRecordedAfr;
    }
    for (const cell of model.cells) {
      if (cell.status === 'eligible' && cell.quarter === descriptor.context.asOfQuarter) {
        cell.metrics.retired = null;
        cell.retiredReason = 'right_censored';
      }
    }
  }
  const matrixBytes = encode(matrix);
  descriptor.matrix = {
    path: `matrix.${hash(matrixBytes)}.json`,
    sha256: hash(matrixBytes),
    sizeBytes: matrixBytes.length,
  };
  const descriptorBytes = encode(descriptor);
  entry.descriptor = {
    path: `descriptor.${hash(descriptorBytes)}.json`,
    sha256: hash(descriptorBytes),
    sizeBytes: descriptorBytes.length,
  };
  await verifyReference(descriptorBytes, entry.descriptor);
  const parsedDescriptor = parseSnapshotDescriptor(descriptorBytes, entry);
  await verifyReference(matrixBytes, parsedDescriptor.matrix);
  const parsedMatrix = parseProductionMatrix(matrixBytes, parsedDescriptor);
  const view = adaptProductionV2(parsedDescriptor, parsedMatrix);
  assert.equal(view.matrixCalculationVersion, '2.1.0');
  const first = view.models
    .flatMap((model) => model.cells)
    .find((cell) => cell.deltaBaseline?.kind === 'initial_subtract_zero')!;
  assert.equal(first.metrics.populationDelta, first.metrics.count);
  assert.equal(first.metrics.afrDelta, first.metrics.afr);
  assert.equal(first.deltaBaseline?.count, 0);
  assert.equal(first.deltaBaseline?.afr, 0);
  assert.match(
    initializedBaselineLabel(first.deltaBaseline)!,
    /synthetic zero.*not a prior observed quarter/,
  );
  const terminal = parsedMatrix.models
    .flatMap((model) => model.cells)
    .find((cell) => cell.status === 'eligible' && cell.quarter === descriptor.context.asOfQuarter)!;
  const adaptedTerminal = view.models
    .flatMap((model) => model.cells)
    .find((cell) => cell.retirementInference?.includes('right-censored'))!;
  assert.equal(adaptedTerminal.metrics.retired, null);
  for (const value of [0, terminal.metrics.failed]) {
    const changed = structuredClone(parsedMatrix);
    const cell = changed.models
      .flatMap((model) => model.cells)
      .find((row) => row.status === 'eligible' && row.quarter === descriptor.context.asOfQuarter)!;
    cell.metrics.retired = value;
    assert.throws(
      () => parseProductionMatrix(encode(changed), parsedDescriptor),
      /terminal retirement right-censoring/,
    );
  }
  const legacyDescriptor = structuredClone(parsedDescriptor);
  legacyDescriptor.context.versions.rate = '2.0.0';
  assert.throws(() => parseProductionMatrix(matrixBytes, legacyDescriptor), /rate basis\/label/);
});

void test('all 53 historical matrices preserve 2.1 display values, source semantics and shared domains', async () => {
  const { loader, calls } = localLoader(production);
  const index = await loader.loadIndex();
  assert.equal(calls.length, 1);
  assert.equal(index.snapshots.length, activeReleaseSelection.requiredSnapshotCount);
  assert.deepEqual(
    index.snapshots.map((entry) => entry.asOfQuarter).sort(),
    [...activeReleaseSelection.quarters].sort(),
  );
  assert.equal(
    index.snapshots.find((s) => s.snapshotId === index.latestSnapshotId)?.asOfQuarter,
    '2026-Q2',
  );
  for (const entry of index.snapshots) {
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const view = adaptProductionV2(descriptor, matrix);
    assert.equal(view.kind, 'production');
    assert.equal(view.rateLabel, 'Observed-history AFR (quarterly unique failures)');
    assert.equal(view.matrixCalculationVersion, activeReleaseSelection.requiredRateVersion);
    assert.equal(view.models.length, descriptor.context.selection.analysisModelIds.length);
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
      assert.equal(view.domains[metric].observedMinimum, values[0] ?? null);
      assert.equal(view.domains[metric].observedMaximum, values.at(-1) ?? null);
    }
    const domains = structuredClone(view.domains);
    visibleModels(view, new Set(view.models.slice(0, 1).map((model) => model.id)));
    assert.deepEqual(view.domains, domains);
    assert.ok(axisExtent(view, 6) >= 24);
    assert.throws(
      () => adaptProductionV2({ ...descriptor, contextSha256: '0'.repeat(64) }, matrix),
      /matching validated v2/,
    );
  }
  assert.equal(
    calls.length,
    1 + 2 * activeReleaseSelection.requiredSnapshotCount,
    'index and one descriptor/matrix pair per cutoff, no supporting quarter fetches',
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
