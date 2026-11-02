import test from 'node:test';
import assert from 'node:assert/strict';
import { seagateModelIndents } from './model-alignment.ts';

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
