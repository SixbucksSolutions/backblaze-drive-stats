import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSelectorLayout, seagateModelIndents } from './model-alignment.ts';

await test('aligns the known capacity end while preserving legacy prefixes and source models', () => {
  const models = [
    { id: 'large', name: 'ST24000NM002H', capacityTB: 24 },
    { id: 'small', name: 'ST8000NM0055', capacityTB: 8 },
    { id: 'legacy', name: 'ST31500541AS', capacityTB: 1.5 },
    { id: 'legacy-small', name: 'ST3500418AS', capacityTB: 0.5 },
  ];
  const original = structuredClone(models);
  assert.deepEqual(
    [...seagateModelIndents(models)],
    [
      ['large', 0],
      ['small', 1],
      ['legacy', 0],
      ['legacy-small', 1],
    ],
  );
  assert.deepEqual(models, original);
});

await test('does not guess capacity blocks for absent, invalid, mismatched or non-Seagate codes', () => {
  const models = [
    { id: 'known', name: 'ST24000NM002H', capacityTB: 24 },
    { id: 'absent', name: 'ST8000NM0055' },
    { id: 'null', name: 'ST8000NM0055', capacityTB: null },
    { id: 'invalid', name: 'ST8000NM0055', capacityTB: NaN },
    { id: 'mismatch', name: 'ST8000NM0055', capacityTB: 12 },
    { id: 'other', name: 'HDS8000', capacityTB: 8 },
  ];
  assert.deepEqual([...seagateModelIndents(models).values()], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...seagateModelIndents([])], []);
});

await test('a search consumes indents from the complete group rather than re-aligning matches', () => {
  const models = [
    { id: 'large', name: 'ST24000NM002H', capacityTB: 24 },
    { id: 'small', name: 'ST8000NM0055', capacityTB: 8 },
  ];
  const indents = seagateModelIndents(models);
  const matches = models.filter((model) => model.name.includes('8000'));
  assert.deepEqual(
    matches.map((model) => indents.get(model.id)),
    [1],
  );
});

await test('snapshot-wide columns align brands with separate integer and decimal capacity fields', () => {
  const models = [
    { id: 'large', vendor: 'Seagate', name: 'ST24000NM002H', capacityTB: 24 },
    { id: 'small', vendor: 'Seagate', name: 'ST8000NM0055', capacityTB: 8 },
    { id: 'legacy', vendor: 'Seagate', name: 'ST31500541AS', capacityTB: 1.5 },
    { id: 'other', vendor: 'Toshiba', name: 'LONGER-MODEL-CODE', capacityTB: 12 },
  ];
  const original = structuredClone(models);
  const layout = modelSelectorLayout(models);
  assert.deepEqual(
    {
      code: layout.codeWidth,
      integer: layout.integerWidth,
      fraction: layout.fractionWidth,
      capacity: layout.capacityWidth,
    },
    { code: 17, integer: 2, fraction: 2, capacity: 7 },
  );
  assert.deepEqual(layout.labels.get('small'), {
    code: 'ST8000NM0055',
    indent: 1,
    capacity: '8',
    integer: '8',
    fraction: '',
  });
  assert.deepEqual(layout.labels.get('legacy'), {
    code: 'ST31500541AS',
    indent: 0,
    capacity: '1.5',
    integer: '1',
    fraction: '.5',
  });
  const matches = models.filter((model) => model.id === 'small');
  assert.deepEqual(
    matches.map((model) => layout.labels.get(model.id)?.indent),
    [1],
  );
  assert.equal(layout.codeWidth, 'LONGER-MODEL-CODE'.length);
  assert.deepEqual(models, original);
});

await test('unknown text and longer known values expand shared capacity fields without guesses', () => {
  const layout = modelSelectorLayout([
    { id: 'unknown', vendor: 'Toshiba', name: 'UNKNOWN' },
    { id: 'long', vendor: 'Seagate', name: 'ST12340000', capacityTB: 1234 },
  ]);
  assert.equal(layout.integerWidth, 4);
  assert.equal(layout.fractionWidth, 2);
  assert.equal(layout.capacityWidth, 'capacity unknown'.length);
  assert.equal(layout.labels.get('unknown')?.capacity, null);
  assert.equal(layout.labels.get('long')?.capacity, '1234');
  const known = modelSelectorLayout([
    { id: 'long', vendor: 'Toshiba', name: 'LONG', capacityTB: 1234 },
  ]);
  assert.equal(known.capacityWidth, 9);
  assert.deepEqual(modelSelectorLayout([]), {
    labels: new Map(),
    codeWidth: 0,
    integerWidth: 2,
    fractionWidth: 2,
    capacityWidth: 7,
  });
});

await test('integer and fractional slots preserve the requested spaces without showing decimal zeroes', () => {
  const layout = modelSelectorLayout([
    { id: 'large', vendor: 'Seagate', name: 'ST24000NM002H', capacityTB: 24 },
    { id: 'small', vendor: 'Seagate', name: 'ST8000NM0055', capacityTB: 8 },
    { id: 'legacy', vendor: 'Seagate', name: 'ST31500541AS', capacityTB: 1.5 },
  ]);
  const fields = [...layout.labels.values()].map(
    (label) =>
      `(${label.integer!.padStart(layout.integerWidth)}${label.fraction.padEnd(layout.fractionWidth)} TB)`,
  );
  assert.deepEqual(fields, ['(24   TB)', '( 8   TB)', '( 1.5 TB)']);
  const widerFraction = modelSelectorLayout([
    { id: 'fraction', vendor: 'Toshiba', name: 'SUB-TB', capacityTB: 0.125 },
  ]);
  assert.equal(widerFraction.fractionWidth, 4);
  assert.equal(widerFraction.capacityWidth, 9);
  assert.equal(widerFraction.labels.get('fraction')?.fraction, '.125');
});
