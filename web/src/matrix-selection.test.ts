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
    ['Seagate', 'Toshiba', 'HGST/WD', 'Acme', 'Zeta'],
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

await test('nominal capacity descends within each vendor with displayed model and ID ties ascending and unknowns last', () => {
  const members = [
    { ...model('small', 'Seagate', 'ST31500541AS'), capacityTB: 1.5 },
    { ...model('tie-z', 'Seagate', 'ST12000NM0007'), capacityTB: 12 },
    { ...model('tie-a', 'Seagate', 'ST12000NM0007'), capacityTB: 12 },
    { ...model('first-name', 'Seagate', 'ST12000NM0006'), capacityTB: 12 },
    { ...model('unknown-z', 'Seagate', 'Z unknown'), capacityTB: null },
    model('unknown-a', 'Seagate', 'A unknown'),
    { ...model('other-vendor', 'Toshiba', 'large'), capacityTB: 20 },
  ];
  const original = [...members];
  const expected = [
    'first-name',
    'tie-a',
    'tie-z',
    'small',
    'unknown-a',
    'unknown-z',
    'other-vendor',
  ];
  assert.deepEqual(
    groupModels(members).flatMap((group) => group.models.map((m) => m.id)),
    expected,
  );
  const snapshot = { models: members } as MatrixSnapshot;
  assert.deepEqual(
    visibleModels(snapshot, new Set(members.map((m) => m.id))).map((m) => m.id),
    expected,
  );
  assert.deepEqual(members, original);
});

await test('equal nominal capacities use model ties despite different source precision and retain unknowns last', () => {
  const members = [
    { ...model('twelve-z', 'Seagate', 'ST12000NM0008'), capacityTB: 12.001 },
    { ...model('twelve-a', 'Seagate', 'ST12000NM0007'), capacityTB: 12.000138625024 },
    { ...model('one-half-z', 'Seagate', 'ST31500541AS'), capacityTB: 1.500301910016 },
    { ...model('one-half-a', 'Seagate', 'ST31500341AS'), capacityTB: 1.5001 },
    { ...model('unknown-z', 'Seagate', 'Z unknown'), capacityTB: null },
    model('unknown-a', 'Seagate', 'A unknown'),
  ];
  const original = structuredClone(members);
  const expected = ['twelve-a', 'twelve-z', 'one-half-a', 'one-half-z', 'unknown-a', 'unknown-z'];
  assert.deepEqual(
    groupModels(members)[0]!.models.map((m) => m.id),
    expected,
  );
  assert.deepEqual(
    visibleModels({ models: members } as MatrixSnapshot, new Set(members.map((m) => m.id))).map(
      (m) => m.id,
    ),
    expected,
  );
  assert.deepEqual(members, original);
});

await test('canonical HGST/WD groups and toggles include historical Deskstar and legacy WDC aliases', () => {
  const members = [
    model('legacy', 'WDC/HGST', 'WUH721816ALE6L4'),
    model('deskstar', 'Hitachi', 'Hitachi HDS5C3030ALA630'),
    model('bare', 'Hitachi', 'HDT721010SLA360'),
    model('other', 'Seagate', 'ST12000NM0007'),
  ];
  const family = groupModels(members).find((group) => group.vendor === 'HGST/WD')!;
  assert.deepEqual(
    family.models.map((m) => m.id),
    ['deskstar', 'bare', 'legacy'],
  );
  const selected = setVendorSelected(members, 'HGST/WD', new Set(['other']), true);
  assert.equal(vendorSelectionState(family.models, selected).checked, true);
  assert.deepEqual([...selected].sort(), ['bare', 'deskstar', 'legacy', 'other']);
  assert.deepEqual([...setVendorSelected(members, 'WDC/HGST', selected, false)], ['other']);
  assert.equal(members[1]!.name, 'Hitachi HDS5C3030ALA630');
});

await test('equal-capacity prefixed and bare models sort by displayed code then distinct ID without changing source names', () => {
  const members = [
    { ...model('z-prefixed', 'Hitachi', 'Hitachi HDS5C3030ALA630'), capacityTB: 3 },
    { ...model('first-display', 'Hitachi', 'Hitachi HDS5C3020ALA632'), capacityTB: 3 },
    { ...model('a-bare', 'HGST/WD', 'HDS5C3030ALA630'), capacityTB: 3 },
    { ...model('last-display', 'Hitachi', 'HDT721010SLA360'), capacityTB: 3 },
  ];
  const original = structuredClone(members);
  const expected = ['first-display', 'a-bare', 'z-prefixed', 'last-display'];
  assert.deepEqual(
    groupModels(members)[0]!.models.map((m) => m.id),
    expected,
  );
  assert.deepEqual(
    visibleModels({ models: members } as MatrixSnapshot, new Set(members.map((m) => m.id))).map(
      (m) => m.id,
    ),
    expected,
  );
  assert.deepEqual(members, original);
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
