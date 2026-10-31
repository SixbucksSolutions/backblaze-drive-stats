// Validate exactly the same contract used by the browser, plus aggregate invariants.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest, parseBundle, summarize, groupManufacturers } from '../src/data.ts';

const folder = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '../public/data');
const read = name => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const manifest = parseManifest(read('index.json'));
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${label} does not reconcile`);
for (const entry of manifest.quarters) {
  const raw = read(entry.url);
  const bundle = parseBundle(raw, entry.quarter, entry.kind);
  assert.ok(!/"(?:serial_number|serialNumber|b2_access_key|b2_secret_access_key)"\s*:/.test(JSON.stringify(raw)), 'Private observation/credential fields must not be published');
  const totals = summarize(bundle.models);
  for (const row of bundle.models) {
    assert.ok(row.driveDays >= row.driveCount, 'Every observed drive needs at least one drive-day');
    close(row.quarterlyAfr, row.failures / row.driveDays * 36500, 'Model quarterly AFR');
  }
  close(bundle.capacityByDatacenter.reduce((sum, row) => sum + row.capacityTb, 0), totals.capacityTb, 'Datacenter capacity');
  assert.equal(bundle.capacityByDatacenter.reduce((sum, row) => sum + row.driveCount, 0), totals.driveCount, 'Datacenter population');
  close(groupManufacturers(bundle.models).reduce((sum, row) => sum + row.capacityTb, 0), totals.capacityTb, 'Manufacturer capacity');
  const latest = bundle.history.find(row => row.quarter === bundle.quarter);
  assert.ok(latest, 'History must include the selected quarter');
  for (const key of ['driveCount', 'driveDays', 'failures', 'newDrives']) assert.equal(latest[key], totals[key], `History ${key}`);
  close(latest.capacityTb, totals.capacityTb, 'History capacity');
  close(latest.quarterlyAfr, totals.quarterlyAfr, 'History AFR');
  console.log(`${entry.quarter.replace('-', ' ')}: ${bundle.models.length} models; populations, capacity, AFR and privacy checks passed (${entry.kind}).`);
}
