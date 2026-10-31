import test from 'node:test';
import assert from 'node:assert/strict';
import { groupModels, setVendorSelected, vendorSelectionState } from './matrix-selection.ts';
import { visibleModels } from './matrix-data.ts';
import type { MatrixModel, MatrixSnapshot } from './matrix-data.ts';

const model = (id: string, vendor: string, name = id): MatrixModel => ({
  id,
  name,
  vendor,
  anchor: null,
  cells: [],
});
const models = [
  model('z-2', 'Zeta'),
  model('w-1', 'WDC/HGST'),
  model('s-2', 'Seagate'),
  model('a-1', 'Acme'),
  model('t-1', 'Toshiba'),
  model('s-1', 'Seagate'),
  model('z-1', 'Zeta'),
];

await test('groups and visible columns share established vendor order, alphabetical unknown vendors and model order', () => {
  const original = [...models];
  const groups = groupModels(models);
  assert.deepEqual(
    groups.map((group) => group.vendor),
    ['Seagate', 'Toshiba', 'WDC/HGST', 'Acme', 'Zeta'],
  );
  assert.deepEqual(
    groups[0]!.models.map((model) => model.id),
    ['s-1', 's-2'],
  );
  assert.deepEqual(
    groups.at(-1)!.models.map((model) => model.id),
    ['z-1', 'z-2'],
  );
  const snapshot = { models } as MatrixSnapshot;
  const selected = new Set(['z-2', 's-2', 'a-1', 's-1', 'missing']);
  assert.deepEqual(
    visibleModels(snapshot, selected).map((model) => model.id),
    ['s-1', 's-2', 'a-1', 'z-2'],
  );
  assert.deepEqual(visibleModels(snapshot, new Set()), []);
  assert.deepEqual(models, original);
  assert.deepEqual(groupModels([]), []);
  assert.deepEqual(
    groupModels([model('b', 'Seagate', 'same'), model('a', 'Seagate', 'same')])[0]!.models.map(
      (model) => model.id,
    ),
    ['a', 'b'],
  );
});

await test('brand selection state distinguishes none, partial, all and an empty brand', () => {
  const members = models.filter((model) => model.vendor === 'Seagate');
  assert.deepEqual(vendorSelectionState(members, new Set(['z-1'])), {
    checked: false,
    indeterminate: false,
    selectedCount: 0,
    totalCount: 2,
  });
  assert.deepEqual(vendorSelectionState(members, new Set(['s-1', 'z-1'])), {
    checked: false,
    indeterminate: true,
    selectedCount: 1,
    totalCount: 2,
  });
  assert.deepEqual(vendorSelectionState(members, new Set(['s-1', 's-2'])), {
    checked: true,
    indeterminate: false,
    selectedCount: 2,
    totalCount: 2,
  });
  assert.deepEqual(vendorSelectionState([], new Set(['s-1'])), {
    checked: false,
    indeterminate: false,
    selectedCount: 0,
    totalCount: 0,
  });
});

await test('brand toggles select all from mixed state and clear all from full state, preserving other brands and input', () => {
  const original = new Set(['s-1', 'z-1', 'missing']);
  const seagate = models.filter((model) => model.vendor === 'Seagate');
  const selected = setVendorSelected(
    models,
    'Seagate',
    original,
    !vendorSelectionState(seagate, original).checked,
  );
  assert.deepEqual([...selected].sort(), ['missing', 's-1', 's-2', 'z-1']);
  assert.deepEqual([...original], ['s-1', 'z-1', 'missing']);
  const cleared = setVendorSelected(
    models,
    'Seagate',
    selected,
    !vendorSelectionState(seagate, selected).checked,
  );
  assert.deepEqual([...cleared].sort(), ['missing', 'z-1']);
  assert.notEqual(cleared, selected);
});

await test('brand toggles include children hidden by sidebar search and support new unknown vendors', () => {
  const searchMatches = models.filter((model) => model.name.includes('z-1'));
  assert.equal(searchMatches.length, 1);
  const selected = setVendorSelected(models, searchMatches[0]!.vendor, new Set(['s-1']), true);
  assert.deepEqual([...selected].sort(), ['s-1', 'z-1', 'z-2']);
  const extended = [...models, model('new-1', 'New Brand')];
  assert.ok(groupModels(extended).some((group) => group.vendor === 'New Brand'));
  assert.deepEqual([...setVendorSelected(extended, 'New Brand', selected, true)].sort(), [
    'new-1',
    's-1',
    'z-1',
    'z-2',
  ]);
  assert.deepEqual(setVendorSelected(models, 'Missing Brand', selected, false), selected);
});
