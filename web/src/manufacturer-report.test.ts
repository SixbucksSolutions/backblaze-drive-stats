import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  manufacturerChartLimit,
  manufacturerCsvRows,
  manufacturerRows,
  renderManufacturers,
  sortManufacturers,
} from './manufacturer-report.ts';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseSupportingQuarter,
  verifyReference,
} from './production-data.ts';
import type { Aggregate } from './production-data.ts';
import { defaultFilter, selectRows } from './snapshot-selection.ts';
import type { DisplayRow } from './snapshot-selection.ts';
import { activeReleaseSelection } from '../scripts/active-release-selection.ts';
const row = (
  vendor: string,
  count: number | null,
  additions: number | null,
  capacityTB: number | null,
  modelId = vendor,
): DisplayRow => ({ vendor, count, new: additions, capacityTB, modelId, modelNumber: modelId });
const whole: Aggregate = { count: 100, new: 20, capacityTB: 1000 };
void test('independent sums keep distinct metric denominators and exact integer counts', () => {
  const input = [
    row('A', 12, 1, 240, 'seed'),
    row('A', 18, 5, 360, 'historic'),
    row('New vendor', 2, 2, 10),
  ];
  const original = structuredClone(input);
  assert.deepEqual(manufacturerRows(input, whole, true), [
    {
      vendor: 'A',
      count: 30,
      new: 6,
      capacityTB: 600,
      populationShare: 0.3,
      newShare: 0.3,
      capacityShare: 0.6,
    },
    {
      vendor: 'New vendor',
      count: 2,
      new: 2,
      capacityTB: 10,
      populationShare: 0.02,
      newShare: 0.1,
      capacityShare: 0.01,
    },
  ]);
  assert.deepEqual(input, original);
  const large = manufacturerRows(
    [row('large', 4_000_000_001, 0, 0), row('large', 4_000_000_002, 0, 0)],
    { count: 8_000_000_003, new: 0, capacityTB: 0 },
    true,
  )[0]!;
  assert.equal(large.count, 8_000_000_003);
  assert.equal(large.populationShare, 1);
});
void test('filters narrow numerators while preserving context denominators and membership', () => {
  const input = [
    row('A', 12, 1, 240, 'seed'),
    row('A', 18, 5, 360, 'historic'),
    row('New vendor', 2, 2, 10, 'discovered'),
  ];
  const selection = {
    contextModelIds: ['seed', 'historic', 'discovered'],
    purchaseDefaultModelIds: ['discovered'],
    historicalReferenceModelIds: ['historic'],
  };
  assert.equal(selectRows(input, input, selection, defaultFilter()).length, 3);
  const filtered = selectRows(input, input, selection, {
    ...defaultFilter(),
    modelIds: new Set(['seed']),
  });
  assert.deepEqual(manufacturerRows(filtered, whole, true)[0], {
    vendor: 'A',
    count: 12,
    new: 1,
    capacityTB: 240,
    populationShare: 0.12,
    newShare: 0.05,
    capacityShare: 0.24,
  });
  const vendor = selectRows(input, input, selection, { ...defaultFilter(), vendor: 'New vendor' });
  assert.equal(manufacturerRows(vendor, whole, true)[0]!.populationShare, 0.02);
  assert.match(
    renderManufacturers(filtered, whole, true),
    /Filters never redefine these denominators/,
  );
});
void test('null capacity preserves counts; zero denominators and incomplete coverage stay unavailable', () => {
  const result = manufacturerRows(
    [row('A', 10, 0, null), row('A', 2, 0, 5)],
    { count: 100, new: 0, capacityTB: null },
    true,
  )[0]!;
  assert.deepEqual(
    [
      result.count,
      result.new,
      result.capacityTB,
      result.populationShare,
      result.newShare,
      result.capacityShare,
    ],
    [12, 0, null, 0.12, null, null],
  );
  const zero = manufacturerRows([row('zero', 0, 0, 0)], whole, true)[0]!;
  assert.deepEqual([zero.populationShare, zero.newShare, zero.capacityShare], [0, 0, 0]);
  const partial = manufacturerRows([row('A', 10, 2, 20)], whole, false)[0]!;
  assert.deepEqual(Object.values(partial).slice(1), [null, null, null, null, null, null]);
  assert.match(renderManufacturers([], whole, true), /No models match/);
  assert.match(
    renderManufacturers([row('A', 10, 2, 20)], whole, false),
    /unavailable for this coverage/,
  );
  assert.doesNotMatch(
    renderManufacturers([row('A', 10, 2, 20)], whole, false),
    /class="report-bar"/,
  );
});
void test('chart preview retains all vendors in table/CSV, escapes names, and sorts null last', () => {
  const input = Array.from({ length: 11 }, (_, i) => row(`Vendor ${i}`, i, i, i === 10 ? null : i));
  input.push(row('<img onerror="x">', 2, 1, 0));
  const html = renderManufacturers(input, whole, true, { key: 'vendor', descending: false });
  assert.equal((html.match(/class="report-bar"/g) ?? []).length, manufacturerChartLimit);
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, 12);
  assert.doesNotMatch(html, /<img|NaN|Infinity/);
  assert.match(html, /&lt;img onerror=&quot;x&quot;&gt;/);
  assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /aria-hidden="true"/);
  assert.equal(manufacturerCsvRows(input, whole, true).length, 13);
  const grouped = manufacturerRows(input, whole, true);
  for (const descending of [true, false]) {
    assert.equal(sortManufacturers(grouped, 'capacityTB', descending).at(-1)!.vendor, 'Vendor 10');
  }
  const csvRows = manufacturerCsvRows(input, whole, true, { key: 'count', descending: false });
  assert.equal(csvRows[1]![0], 'Vendor 0');
  assert.deepEqual(csvRows[1]!.slice(7), [100, 20, 1000]);
});
void test('all 53 historical public cutoffs reconcile every manufacturer metric and share', async () => {
  const directory = new URL('../public/data/production/', import.meta.url);
  const bytes = (path: string) => readFile(new URL(path, directory));
  const index = parseProductionIndex(await bytes('index.json'));
  assert.equal(index.snapshots.length, activeReleaseSelection.requiredSnapshotCount);
  for (const cut of activeReleaseSelection.quarters) {
    const entry = index.snapshots.find((snapshot) => snapshot.asOfQuarter === cut);
    assert.ok(entry);
    const descriptorBytes = await bytes(entry.descriptor.path);
    await verifyReference(descriptorBytes, entry.descriptor);
    const descriptor = parseSnapshotDescriptor(descriptorBytes, entry);
    const quarter = descriptor.quarters.find((candidate) => candidate.quarter === cut);
    assert.ok(quarter?.payload);
    const quarterBytes = await bytes(quarter.payload.path);
    await verifyReference(quarterBytes, quarter.payload);
    const payload = parseSupportingQuarter(quarterBytes, descriptor, cut);
    const scope = payload.scopes.selected_hdd;
    const rows = selectRows(
      scope.models,
      descriptor.context.inventory,
      descriptor.context.selection,
      defaultFilter(),
    );
    const actual = manufacturerRows(rows, scope.totals, payload.status === 'complete');
    const complete = payload.status === 'complete';
    assert.equal(rows.length, scope.models.length);
    assert.equal(actual.length, scope.manufacturers.length);
    for (const expected of scope.manufacturers) {
      const vendor = actual.find((candidate) => candidate.vendor === expected.vendor);
      assert.ok(vendor);
      assert.equal(vendor.count, expected.count);
      assert.equal(vendor.new, expected.new);
      for (const metric of [
        'capacityTB',
        'populationShare',
        'newShare',
        'capacityShare',
      ] as const) {
        if (!complete) {
          assert.equal(vendor[metric], null);
          assert.equal(expected[metric], null);
          continue;
        }
        assert.ok(vendor[metric] !== null && expected[metric] !== null);
        assert.ok(
          Math.abs(vendor[metric] - expected[metric]) <= Math.max(1e-10, expected[metric] * 1e-10),
        );
      }
    }
    let count: number | null = complete ? 0 : null,
      additions: number | null = complete ? 0 : null;
    for (const model of scope.models) {
      if (!complete) {
        assert.equal(model.count, null);
        assert.equal(model.new, null);
        assert.equal(model.capacityTB, null);
        continue;
      }
      assert.ok(model.count !== null && model.new !== null);
      assert.ok(count !== null && additions !== null);
      count += model.count;
      additions += model.new;
    }
    assert.equal(complete ? actual.reduce((sum, vendor) => sum + vendor.count!, 0) : null, count);
    assert.equal(complete ? actual.reduce((sum, vendor) => sum + vendor.new!, 0) : null, additions);
    assert.equal(count, scope.totals.count);
    assert.equal(additions, scope.totals.new);
    if (!complete) {
      assert.ok(actual.every((vendor) => vendor.count === null && vendor.new === null));
      assert.equal(scope.totals.capacityTB, null);
    }
  }
});
