import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { inspect } from 'node:util';
import { assertPublicValues, checkProductionData } from './check-production-data.mjs';

const fixtures = new URL('../../fixtures/production-v2/', import.meta.url);
const options = { latestQuarter: '2023-Q4', quarters: ['2014-Q2', '2023-Q4'] };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (name) => readFile(new URL(name, fixtures), 'utf8').then(JSON.parse);

// Test-only graphs use fictional arithmetic with publication-safe strings. Passing
// this release gate does not certify the provenance of their invented observations.
function clean(value) {
  if (typeof value === 'string') {
    return value.replace(/sample|fictional|synthetic/gi, 'recorded');
  }
  if (Array.isArray(value)) {
    return value.map(clean);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clean(child)]));
  }
  return value;
}
function sorted(value) {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted(value[key])]),
    );
  }
  return value;
}
async function publication(t, { revision = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'public-production-check-'));
  t.after(async () => {
    assert.ok(
      resolve(directory).startsWith(`${resolve(tmpdir())}\\public-production-check-`) ||
        resolve(directory).startsWith(`${resolve(tmpdir())}/public-production-check-`),
    );
    await rm(directory, { recursive: true, force: true });
  });
  const indexName = (await readdir(fixtures)).find((name) => name.startsWith('sample-index.'));
  const original = await json(indexName);
  const index = clean(original);
  async function artifact(stem, value) {
    const bytes = JSON.stringify(value);
    const checksum = sha(bytes);
    const path = `${stem}.${checksum}.json`;
    await writeFile(join(directory, path), bytes);
    return { path, sha256: checksum, sizeBytes: Buffer.byteLength(bytes) };
  }
  for (const [number, entry] of original.snapshots.entries()) {
    const raw = await json(entry.descriptor.path);
    const descriptor = clean(raw);
    descriptor.context.kind = 'backblaze';
    descriptor.contextSha256 = sha(JSON.stringify(sorted(descriptor.context)));
    const stem = descriptor.context.snapshotId;
    const matrix = clean(await json(raw.matrix.path));
    matrix.contextSha256 = descriptor.contextSha256;
    descriptor.matrix = await artifact(`${stem}-matrix`, matrix);
    for (const [offset, row] of raw.quarters.entries()) {
      if (row.payload) {
        const payload = clean(await json(row.payload.path));
        payload.contextSha256 = descriptor.contextSha256;
        descriptor.quarters[offset].payload = await artifact(`${stem}-${row.quarter}`, payload);
      }
    }
    index.snapshots[number].descriptor = await artifact(`${stem}-descriptor`, descriptor);
  }
  if (revision) {
    const previous = index.snapshots.at(-1);
    const descriptor = JSON.parse(
      await readFile(join(directory, previous.descriptor.path), 'utf8'),
    );
    const id = `${descriptor.context.snapshotId}-revision`;
    descriptor.context.snapshotId = id;
    descriptor.context.generatedAt = '2026-11-01T00:00:00Z';
    descriptor.contextSha256 = sha(JSON.stringify(sorted(descriptor.context)));
    const matrix = JSON.parse(await readFile(join(directory, descriptor.matrix.path), 'utf8'));
    matrix.snapshotId = id;
    matrix.contextSha256 = descriptor.contextSha256;
    descriptor.matrix = await artifact(`${id}-matrix`, matrix);
    for (const row of descriptor.quarters) {
      if (row.payload) {
        const payload = JSON.parse(await readFile(join(directory, row.payload.path), 'utf8'));
        payload.snapshotId = id;
        payload.contextSha256 = descriptor.contextSha256;
        row.payload = await artifact(`${id}-${row.quarter}`, payload);
      }
    }
    index.snapshots.push({
      ...previous,
      snapshotId: id,
      descriptor: await artifact(`${id}-descriptor`, descriptor),
    });
    index.latestSnapshotId = id;
  }
  await writeFile(join(directory, 'index.json'), JSON.stringify(index));
  return { directory, index };
}

void test('release checker consumes every advertised matrix and supporting byte-bound artifact', async (t) => {
  const { directory } = await publication(t);
  const result = await checkProductionData(directory, options);
  assert.equal(result.snapshots, 2);
  assert.equal(result.matrices, 2);
  assert.ok(result.supporting > 2);
  assert.ok(result.unavailable > 0);
  assert.equal(result.files, (await readdir(directory)).length);
});

void test('same-quarter immutable revisions keep every snapshot while release quarter inventory stays unique', async (t) => {
  const { directory } = await publication(t, { revision: true });
  const result = await checkProductionData(directory, options);
  assert.equal(result.snapshots, 3);
  assert.equal(result.matrices, 3);
  assert.equal(result.files, (await readdir(directory)).length);
  await assert.rejects(
    checkProductionData(directory, { latestQuarter: '2023-Q4', quarters: ['2023-Q4'] }),
    /release selection/,
  );
});

void test('release checker rejects extra files, missing bytes, and hash corruption', async (t) => {
  const { directory, index } = await publication(t);
  const extra = join(directory, 'unadvertised.json');
  await writeFile(extra, '{}');
  await assert.rejects(checkProductionData(directory, options), /unadvertised/);
  await rm(extra);
  const descriptor = join(directory, index.snapshots[0].descriptor.path);
  const bytes = await readFile(descriptor);
  await rm(descriptor);
  await assert.rejects(checkProductionData(directory, options), /missing/);
  await writeFile(descriptor, '{}');
  await assert.rejects(checkProductionData(directory, options), /size|hash/);
  await writeFile(descriptor, bytes);
  await writeFile(join(directory, '.credentials'), 'not-public');
  await assert.rejects(checkProductionData(directory, options), /Unexpected public/);
});

void test('release checker rejects mismatched release selection, unsafe paths and duplicate snapshots', async (t) => {
  const { directory, index } = await publication(t);
  await assert.rejects(checkProductionData(directory), /release selection/);
  await assert.rejects(
    checkProductionData(directory, { ...options, latestQuarter: '2014-Q2' }),
    /latest snapshot/,
  );
  const originalPath = index.snapshots[0].descriptor.path;
  index.snapshots[0].descriptor.path = '../outside.json';
  await writeFile(join(directory, 'index.json'), JSON.stringify(index));
  await assert.rejects(checkProductionData(directory, options), /path/);
  index.snapshots[0].descriptor.path = originalPath;
  index.snapshots[1].snapshotId = index.snapshots[0].snapshotId;
  await writeFile(join(directory, 'index.json'), JSON.stringify(index));
  await assert.rejects(checkProductionData(directory, options), /duplicate/i);
  await rm(join(directory, 'index.json'));
  await assert.rejects(checkProductionData(directory, options), /index.json is required/);
});

void test('publication checks reject recognizable private or synthetic free text without leaking it', () => {
  for (const value of [
    'SAMPLE',
    'fictional observations',
    'synthetic',
    'C:\\private\\summary.parquet',
    '/home/owner/data',
    'serial_number',
    { serialNumber: 'redacted' },
    'token=redacted',
    'https://owner:password@www.backblaze.com/data',
    'https://www.backblaze.com/data?token=redacted',
    'https://www.backblaze.com/data#secret',
    'https://127.0.0.1/data',
    'https://server.internal/data',
    'See https://www.backblaze.com/data?key=redacted for evidence',
  ]) {
    assert.throws(() => assertPublicValues(value));
  }
  assert.doesNotThrow(() =>
    assertPublicValues(
      'Backblaze: https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data',
    ),
  );
});

void test('malformed credential URLs produce sanitized errors without rejected input or cause', () => {
  const rejected = 'https://publication-sensitive-user:publication-sensitive-key@[';
  assert.throws(
    () => assertPublicValues(`Evidence: ${rejected}`),
    (error) => {
      assert.equal(error.message, 'Malformed production URL');
      assert.equal(error.cause, undefined);
      const rendered = inspect(error, { showHidden: true });
      assert.ok(!rendered.includes(rejected));
      assert.ok(!rendered.includes('publication-sensitive'));
      assert.ok(!rendered.includes('input:'));
      return true;
    },
  );
});

void test('malformed public JSON produces sanitized errors without secret content', async (t) => {
  const { directory } = await publication(t);
  const marker = 'publication-confidential-marker';
  for (const malformed of [`{ "evidence": ${marker} }`, `"${marker}\\q"`]) {
    await writeFile(join(directory, 'index.json'), malformed);
    await assert.rejects(checkProductionData(directory, options), (error) => {
      assert.equal(error.message, 'Invalid public production JSON');
      assert.equal(error.cause, undefined);
      assert.ok(!inspect(error, { showHidden: true }).includes(marker));
      return true;
    });
  }
});

void test('unadvertised filenames stay out of inspected release errors', async (t) => {
  const { directory } = await publication(t);
  const marker = 'publication-confidential-filename';
  await writeFile(join(directory, `${marker}.json`), '{}');
  await assert.rejects(checkProductionData(directory, options), (error) => {
    assert.match(error.message, /unadvertised artifacts/);
    assert.ok(!inspect(error, { showHidden: true }).includes(marker));
    return true;
  });
});
