import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { csv, groupManufacturers, parseBundle, parseManifest, summarize } from './data.ts';

const manifest = JSON.parse(readFileSync(new URL('../test/fixtures/data/index.json', import.meta.url), 'utf8'));
const sample = JSON.parse(readFileSync(new URL('../test/fixtures/data/2026-Q2.json', import.meta.url), 'utf8'));
test('every advertised sample quarter validates and all capacity breakdowns reconcile', () => {
  for (const entry of parseManifest(manifest).quarters) {
    const data = JSON.parse(readFileSync(new URL(`../test/fixtures/data/${entry.url}`, import.meta.url), 'utf8'));
    const bundle = parseBundle(data, entry.quarter, entry.kind);
    const totals = summarize(bundle.models);
    assert.equal(groupManufacturers(bundle.models).reduce((sum, row) => sum + row.capacityTb, 0), totals.capacityTb);
    assert.equal(bundle.capacityByDatacenter.reduce((sum, row) => sum + row.capacityTb, 0), totals.capacityTb);
    assert.equal(bundle.capacityByDatacenter.reduce((sum, row) => sum + row.driveCount, 0), totals.driveCount);
    const latest = bundle.history.find(row => row.quarter === bundle.quarter)!;
    assert.deepEqual({ ...latest, quarter: undefined }, { ...totals, quarter: undefined });
  }
});
test('fleet AFR weights exposure rather than averaging model AFR', () => {
  const bundle = parseBundle(sample, '2026-Q2', 'sample');
  const totals = summarize(bundle.models);
  assert.equal(totals.quarterlyAfr, totals.failures / totals.driveDays * 36500);
  assert.notEqual(totals.quarterlyAfr, bundle.models.reduce((sum, row) => sum + row.quarterlyAfr, 0) / bundle.models.length);
});
test('reject mismatched quarters, mislabeled sample data, invalid counts and duplicate models', () => {
  assert.throws(() => parseBundle(sample, '2026-Q1', 'sample'));
  assert.throws(() => parseBundle(sample, '2026-Q2', 'backblaze'));
  for (const value of [-1, 0.5, Infinity, '12']) {
    const invalid = structuredClone(sample);
    invalid.models[0].driveCount = value;
    assert.throws(() => parseBundle(invalid, '2026-Q2', 'sample'));
  }
  const duplicate = structuredClone(sample);
  duplicate.models.push(duplicate.models[0]);
  assert.throws(() => parseBundle(duplicate, '2026-Q2', 'sample'));
});
test('index paths cannot escape the data directory; duplicates and empty indexes fail', () => {
  for (const url of ['../secret.json', 'https://example.com/data.json', '/2026-Q2.json']) {
    assert.throws(() => parseManifest({ schemaVersion: 1, quarters: [{ quarter: '2026-Q2', label: '2026 Q2', kind: 'sample', url }] }));
  }
  assert.throws(() => parseManifest({ schemaVersion: 1, quarters: [] }));
  assert.throws(() => parseManifest({ schemaVersion: 1, quarters: [manifest.quarters[0], manifest.quarters[0]] }));
});
test('CSV preserves quoted fields and neutralizes spreadsheet formulas', () => {
  assert.equal(csv([['=SUM(A1)', 'a,"b', 12], ['@formula', 'safe', 0]]), '"\'=SUM(A1)","a,""b","12"\r\n"\'@formula","safe","0"');
});
