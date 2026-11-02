import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeReleaseSelection } from '../scripts/active-release-selection.ts';
import { distributionSummary, renderDistribution } from './distribution-report.ts';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseSupportingQuarter,
  verifyReference,
} from './production-data.ts';
import { defaultFilter, selectRows, selectionCsv, selectionTotals } from './snapshot-selection.ts';
import type { DisplayRow } from './snapshot-selection.ts';

const model = (modelId: string, count: number | null, vendor = 'New vendor'): DisplayRow => ({
  modelId,
  modelNumber: modelId.toUpperCase(),
  vendor,
  count,
  new: count === null ? null : 0,
  capacityTB: count === null ? null : count * 8,
});

void test('independent count and vendor sums retain small, historical and discovered-vendor models', () => {
  const rows = [model('seed', 17), model('historic', 200, 'Unknown'), model('discovered', 2300)];
  const summary = distributionSummary(rows, true);
  assert.equal(summary.count, 2517);
  assert.equal(summary.modelCount, 3);
  assert.deepEqual(summary.vendors, [
    { vendor: 'New vendor', count: 2317 },
    { vendor: 'Unknown', count: 200 },
  ]);
  assert.equal(
    summary.vendors.reduce((sum, row) => sum + (row.count ?? 0), 0),
    2517,
  );
  assert.deepEqual(
    summary.topModels.map((row) => row.modelId),
    ['discovered', 'historic', 'seed'],
  );
});

void test('top eight rank independently of table order, break ties stably and disclose omitted rows', () => {
  const rows = Array.from({ length: 10 }, (_, i) => model(`model-${i}`, i * 10));
  rows.push(model('tie', 90));
  const before = structuredClone(rows);
  assert.deepEqual(
    distributionSummary(rows, true).topModels.map((row) => row.modelId),
    ['model-9', 'tie', 'model-8', 'model-7', 'model-6', 'model-5', 'model-4', 'model-3'],
  );
  assert.deepEqual(distributionSummary([...rows].reverse(), true), distributionSummary(rows, true));
  assert.deepEqual(rows, before);
  const html = renderDistribution(rows, true);
  assert.equal((html.match(/<meter /g) ?? []).length, 8);
  assert.match(html, /largest 8 of 11 filtered models/);
  assert.match(html, /table below and CSV include all 11 filtered models/);
  assert.doesNotMatch(html, /MODEL-0/);
  assert.match(html, /not quarter-end installed stock/);
});

void test('unknown and zero counts remain distinct and incomplete coverage never draws population bars', () => {
  const rows = [model('unknown', null), model('zero', 0)];
  const summary = distributionSummary(rows, true);
  assert.equal(summary.count, null);
  assert.deepEqual(
    summary.topModels.map((row) => row.modelId),
    ['zero', 'unknown'],
  );
  assert.equal(summary.vendors[0]?.count, null);
  const html = renderDistribution(rows, true);
  assert.match(html, /max="1" value="0"/);
  assert.equal((html.match(/<meter /g) ?? []).length, 1);
  assert.match(html, /at least one model count is unknown/);
  assert.match(html, /report-bar-unavailable">Unavailable/);
  assert.equal(distributionSummary([model('zero', 0)], true).count, 0);
  assert.match(renderDistribution([model('zero', 0)], true), /0 observed drives/);
  assert.equal(distributionSummary([model('zero', 0)], false).count, null);
  assert.doesNotMatch(renderDistribution(rows, false), /<meter /);
  assert.match(renderDistribution([], false), /Unknown population is not zero/);
  assert.match(renderDistribution([], true), /No models match/);
});

void test('hostile vendor and model labels are escaped in both text and accessible labels', () => {
  const row = { ...model('safe', 1234, '<img src=x onerror="bad">'), modelNumber: '"<&\'model' };
  const html = renderDistribution([row], true);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/);
  assert.match(html, /&quot;&lt;&amp;&#39;model/);
  assert.match(html, /1,234 observed drives/);
  assert.match(html, /<strong>1,234<\/strong>/);
});

void test('explicit vendor/model filters keep chart, summary and CSV on the same complete rows', () => {
  const supplied = [model('large', 2300, 'Known'), model('seed', 12), model('historic', 0)];
  const inventory = supplied.map(({ modelId, modelNumber, vendor }) => ({
    modelId,
    modelNumber,
    vendor,
  }));
  const selection = {
    contextModelIds: supplied.map((row) => row.modelId),
    purchaseDefaultModelIds: ['large'],
    historicalReferenceModelIds: ['historic'],
  };
  const filtered = selectRows(supplied, inventory, selection, {
    ...defaultFilter(),
    vendor: 'New vendor',
  });
  assert.deepEqual(
    filtered.map((row) => row.modelId),
    ['seed', 'historic'],
  );
  assert.equal(distributionSummary(filtered, true).count, 12);
  assert.equal(selectionTotals(filtered, true).count, 12);
  const html = renderDistribution(filtered, true);
  assert.match(html, /12 observed drives across 2 filtered models/);
  assert.match(html, /SEED/);
  assert.match(html, /HISTORIC/);
  assert.doesNotMatch(html, /LARGE/);
  const exported = selectionCsv(filtered, {
    snapshotId: 'snapshot',
    asOfQuarter: '2026-Q2',
    quarter: '2026-Q2',
    status: 'complete',
    kind: 'sample',
    sourceUrl: 'https://www.backblaze.com/',
    scope: 'selected_hdd',
    contextCount: 2312,
  });
  assert.match(exported, /"SEED","12"/);
  assert.match(exported, /"HISTORIC","0"/);
  assert.doesNotMatch(exported, /LARGE/);
  const searched = selectRows(supplied, inventory, selection, {
    ...defaultFilter(),
    search: 'historic',
  });
  assert.equal(distributionSummary(searched, true).count, 0);
  assert.equal(supplied.length, 3);
});

void test('real immutable generations reconcile exact filtered model counts and published vendor totals', async () => {
  const root = new URL('../public/data/production/', import.meta.url);
  const bytes = (path: string) => readFile(new URL(path, root));
  const index = parseProductionIndex(await bytes('index.json'));
  assert.equal(index.snapshots.length, activeReleaseSelection.requiredSnapshotCount);
  assert.deepEqual(
    index.snapshots.map((entry) => entry.asOfQuarter).sort(),
    [...activeReleaseSelection.quarters].sort(),
  );
  for (const entry of index.snapshots) {
    const descriptorBytes = await bytes(entry.descriptor.path);
    await verifyReference(descriptorBytes, entry.descriptor);
    const descriptor = parseSnapshotDescriptor(descriptorBytes, entry);
    const reference = descriptor.quarters.find(
      (row) => row.quarter === entry.asOfQuarter,
    )!.payload!;
    const payloadBytes = await bytes(reference.path);
    await verifyReference(payloadBytes, reference);
    const payload = parseSupportingQuarter(payloadBytes, descriptor, entry.asOfQuarter);
    const scope = payload.scopes.selected_hdd;
    const rows = selectRows(
      scope.models,
      descriptor.context.inventory,
      descriptor.context.selection,
      defaultFilter(),
    );
    const summary = distributionSummary(rows, payload.status === 'complete');
    const complete = payload.status === 'complete';
    const ledgerCounts = descriptor.context.inventory
      .filter((model) => descriptor.context.selection.contextModelIds.includes(model.modelId))
      .map((model) => {
        const history = model.history.find((row) => row.quarter === entry.asOfQuarter);
        assert.ok(history);
        return history.quarterCount;
      });
    const ledgerCount =
      complete && ledgerCounts.every((count) => count !== null)
        ? ledgerCounts.reduce<number>((sum, count) => sum + count, 0)
        : null;
    if (!complete) {
      assert.ok(ledgerCounts.every((count) => count === null));
      assert.ok(
        rows.every((row) => row.count === null && row.new === null && row.capacityTB === null),
      );
      assert.equal(summary.count, null);
      assert.match(
        renderDistribution(rows, false),
        /Full-quarter observed population is unavailable/,
      );
    }
    assert.equal(summary.count, ledgerCount);
    assert.equal(summary.count, scope.totals.count);
    assert.equal(summary.modelCount, descriptor.context.selection.contextModelIds.length);
    const vendorCounts = new Map<string, number | null>();
    for (const source of scope.models) {
      const inventory = descriptor.context.inventory.find(
        (model) => model.modelId === source.modelId,
      );
      assert.ok(inventory);
      const vendor =
        /^(?:(?:Hitachi|HGST)\s+)?HD[ST][A-Z0-9]+$/i.test(inventory.modelNumber) ||
        ['WDC/HGST', 'HGST/WD', 'WD/HGST', 'HGST', 'WD', 'WDC'].includes(inventory.vendor)
          ? 'HGST/WD'
          : inventory.vendor;
      const prior = vendorCounts.get(vendor) ?? 0;
      vendorCounts.set(vendor, !complete || source.count === null ? null : prior + source.count);
    }
    assert.deepEqual(
      summary.vendors,
      [...vendorCounts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([vendor, count]) => ({ vendor, count })),
    );
    assert.ok(
      descriptor.context.selection.analysisModelIds.every((id) =>
        rows.some((row) => row.modelId === id),
      ),
    );
    assert.equal(summary.topModels.length, Math.min(8, rows.length));
    for (const row of summary.topModels) {
      if (!complete) {
        assert.equal(row.count, null);
        continue;
      }
      assert.match(
        renderDistribution(rows, complete),
        new RegExp(`<strong>${new Intl.NumberFormat('en-US').format(row.count!)}<\\/strong>`),
      );
    }
  }
});
