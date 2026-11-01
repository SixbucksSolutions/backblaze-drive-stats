import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csv } from './data.ts';
import {
  defaultFilter,
  exploreUrl,
  quarterLabel,
  selectRows,
  selectionCsv,
  selectionTotals,
} from './snapshot-selection.ts';

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
