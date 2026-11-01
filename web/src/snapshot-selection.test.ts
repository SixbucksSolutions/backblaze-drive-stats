import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csv } from './data.ts';
import {
  snapshotAvailable,
  snapshotChoices,
  snapshotUnavailableReason,
} from './snapshot-availability.ts';
import { activeReleaseSelection } from '../scripts/active-release-selection.ts';
import {
  defaultFilter,
  exploreUrl,
  quarterLabel,
  selectRows,
  selectionCsv,
  selectionTotals,
  customerHddScopeDescription,
} from './snapshot-selection.ts';

void test('historical customer-fleet labels use descriptor capacity/exclusions and separate AFR qualification', () => {
  const description = customerHddScopeDescription(
    '2.1.0',
    {
      minimumCapacityTB: 1,
      excludedModelIds: ['a'.repeat(64), 'b'.repeat(64)],
    },
    [
      { modelId: 'a'.repeat(64), modelNumber: 'WD800LB' },
      { modelId: 'b'.repeat(64), modelNumber: 'DELL "BOSS"' },
    ],
  );
  assert.match(description!, /observed by this snapshot cutoff.*≥1 TB/);
  assert.match(description!, /Owner-designated exclusions: WD800LB, DELL "BOSS"/);
  assert.doesNotMatch(description!, /[ab]{64}|boot\/system/);
  assert.match(csv([[description!]]), /DELL ""BOSS""/);
  const unnamed = customerHddScopeDescription('2.1.0', {
    minimumCapacityTB: 1,
    excludedModelIds: ['a'.repeat(64)],
  });
  assert.match(unnamed!, /Owner-designated exclusions: 1 model/);
  assert.doesNotMatch(unnamed!, /a{64}/);
  assert.match(
    description!,
    /Smaller populations.*AFR comparison separately requires at least 2,000/,
  );
  assert.match(description!, /partial capture.*AFR values remain unavailable/);
  assert.equal(customerHddScopeDescription('2.0.0', {}), undefined);
  assert.equal(customerHddScopeDescription('2.0.0', { minimumCapacityTB: 1 }), undefined);
});

void test('six views offer only cutoffs with their reviewed evidence availability', () => {
  for (const [view, expected, first] of [
    ['matrix', 53, '2013-Q2'],
    ['deployments', 53, '2013-Q2'],
    ['distribution', 53, '2013-Q2'],
    ['manufacturers', 53, '2013-Q2'],
    ['capacity', 53, '2013-Q2'],
    ['datacenters', 12, '2023-Q3'],
  ] as const) {
    const available = activeReleaseSelection.quarters.filter((quarter) =>
      snapshotAvailable(quarter, view),
    );
    assert.equal(available.length, expected, view);
    assert.equal(available[0], first, view);
    assert.equal(available.at(-1), '2026-Q2', view);
  }
  assert.equal(snapshotAvailable('2013-Q1', 'matrix'), false);
  assert.equal(snapshotAvailable('2023-Q2', 'datacenters'), false);
  assert.match(snapshotUnavailableReason('matrix'), /evidenced HDD models.*Total capacity/);
  assert.match(
    snapshotUnavailableReason('datacenters'),
    /July 2023.*Earlier calendar periods remain unavailable/,
  );
});

void test('unavailable direct URLs retain their exact cutoff while other unavailable choices are excluded', () => {
  const entries = activeReleaseSelection.quarters.map((asOfQuarter) => ({
    snapshotId: asOfQuarter,
    asOfQuarter,
  }));
  const entriesBefore = structuredClone(entries);
  const choices = snapshotChoices(entries, 'datacenters', '2014-Q1');
  assert.equal(choices.length, 13);
  assert.equal(choices[0]!.snapshotId, '2014-Q1');
  assert.equal(snapshotAvailable(choices[0]!.asOfQuarter, 'datacenters'), false);
  assert.ok(choices.slice(1).every((entry) => snapshotAvailable(entry.asOfQuarter, 'datacenters')));
  assert.deepEqual(entries, entriesBefore);
  assert.equal(snapshotChoices(entries, 'matrix', '2026-Q2').length, 53);
  assert.equal(snapshotChoices(entries, 'capacity', '2014-Q1').length, 53);
});

const inventory = [
  { modelId: 'large', vendor: 'New vendor', modelNumber: 'LARGE' },
  { modelId: 'small', vendor: 'Unknown', modelNumber: 'SMALL' },
  { modelId: 'unknown', vendor: 'Unknown', modelNumber: 'UNKNOWN' },
];
const selection = {
  contextModelIds: ['large', 'small', 'unknown'],
  purchaseDefaultModelIds: ['large'],
  historicalReferenceModelIds: ['small'],
};
const rows = [
  { modelId: 'large', count: 2200, new: 20, capacityTB: 17600 },
  { modelId: 'small', count: 0, new: 0, capacityTB: 0 },
  { modelId: 'unknown', count: null, new: null, capacityTB: null },
];

await test('context retains subthreshold and unknown-vendor rows; presets are explicit subsets', () => {
  assert.equal(selectRows(rows, inventory, selection, defaultFilter()).length, 3);
  const chosen = selectRows(rows, inventory, selection, { ...defaultFilter(), preset: 'purchase' });
  assert.deepEqual(
    chosen.map((row) => row.modelId),
    ['large'],
  );
  assert.equal(selection.contextModelIds.length, 3);
  assert.deepEqual(
    selectRows(rows, inventory, selection, {
      ...defaultFilter(),
      vendor: 'Unknown',
      search: 'small',
    }).map((row) => row.modelId),
    ['small'],
  );
});
await test('null is never summed as zero and sorts after measured zero in both directions', () => {
  for (const descending of [true, false]) {
    assert.equal(
      selectRows(rows, inventory, selection, defaultFilter(), 'count', descending).at(-1)?.modelId,
      'unknown',
    );
  }
  assert.deepEqual(selectionTotals(rows, true), { count: null, new: null, capacityTB: null });
  assert.deepEqual(selectionTotals([rows[1]!], true), { count: 0, new: 0, capacityTB: 0 });
  assert.deepEqual(selectionTotals([], false), { count: null, new: null, capacityTB: null });
});
await test('explicit model checkboxes intersect vendor/search filters without pruning the context', () => {
  const selected = selectRows(rows, inventory, selection, {
    ...defaultFilter(),
    modelIds: new Set(['small']),
  });
  assert.deepEqual(
    selected.map((row) => row.modelId),
    ['small'],
  );
  assert.deepEqual(selectionTotals(selected, true), { count: 0, new: 0, capacityTB: 0 });
  assert.equal(selection.contextModelIds.length, 3);
  assert.deepEqual(
    selectRows(rows, inventory, selection, { ...defaultFilter(), modelIds: new Set() }),
    [],
  );
  assert.deepEqual(
    selectRows(rows, inventory, selection, {
      ...defaultFilter(),
      vendor: 'New vendor',
      modelIds: new Set(['small']),
    }),
    [],
  );
});
await test('URLs retain independent snapshot and calendar-quarter selection and example context', () => {
  const url = exploreUrl(
    'https://example.org/?view=explore&example=1',
    'as-of-Q4',
    '2023-Q2',
    'distribution',
  );
  assert.equal(url.searchParams.get('snapshot'), 'as-of-Q4');
  assert.equal(url.searchParams.get('quarter'), '2023-Q2');
  assert.equal(url.searchParams.get('example'), '1');
  assert.equal(quarterLabel('2023-Q2'), '2023 Q2');
});
await test('CSV carries coverage/scope and neutralizes formulas after leading whitespace', () => {
  assert.equal(csv([['  =1+1', '\n@SUM(A1)', -3]]), '"\'  =1+1","\'\n@SUM(A1)","-3"');
  const exported = selectionCsv(selectRows(rows, inventory, selection, defaultFilter()), {
    snapshotId: 'snapshot',
    asOfQuarter: '2023-Q4',
    quarter: '2023-Q2',
    status: 'partial',
    kind: 'sample',
    sourceUrl: 'https://www.backblaze.com/',
    scope: 'selected_hdd',
    contextCount: null,
  });
  assert.match(exported, /Whole scope observed drives/);
  assert.match(exported, /"partial","sample","selected_hdd","Unavailable"/);
  assert.match(exported, /"UNKNOWN","Unavailable"/);
});
