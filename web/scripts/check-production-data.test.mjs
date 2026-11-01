import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { inspect } from 'node:util';
import {
  assertPublicValues,
  assertSnapshotAvailability,
  assertMinimumCapacity,
  checkProductionData,
} from './check-production-data.mjs';
import { activeReleaseSelection } from './active-release-selection.ts';

const fixtures = new URL('../../fixtures/production-v2/', import.meta.url);
const options = { latestQuarter: '2023-Q4', quarters: ['2014-Q2', '2023-Q4'] };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (name) => readFile(new URL(name, fixtures), 'utf8').then(JSON.parse);

void test('active release selects every quarterly cutoff from 2013-Q2 through 2026-Q2 exactly once', () => {
  const expected = [];
  for (let year = 2013; year <= 2026; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if ((year === 2013 && quarter === 1) || (year === 2026 && quarter > 2)) {
        continue;
      }
      expected.push(`${year}-Q${quarter}`);
    }
  }
  assert.deepEqual(activeReleaseSelection.quarters, expected);
  assert.equal(activeReleaseSelection.requiredSnapshotCount, 53);
  assert.equal(activeReleaseSelection.latestQuarter, '2026-Q2');
  assert.equal(activeReleaseSelection.requiredRateVersion, '2.1.0');
  assert.equal(activeReleaseSelection.requiredSelectionVersion, '2.1.0');
  assert.equal(activeReleaseSelection.requiredCohortVersion, '2.1.0');
  assert.equal(activeReleaseSelection.requiredMinimumCapacityTB, 1);
});

void test('view availability gate rejects missing historical analysis and delayed datacenter capture', () => {
  const descriptor = {
    context: {
      asOfQuarter: '2013-Q2',
      selection: { contextModelIds: [] },
      inventory: [{}],
      coverage: [{ quarter: '2013-Q2', datacenterFieldAvailable: false }],
    },
  };
  assert.throws(
    () => assertSnapshotAvailability(descriptor, { models: [] }),
    /matrix availability differs/,
  );
  const matrix = { models: [{ cells: [{ status: 'eligible' }] }] };
  assert.throws(
    () => assertSnapshotAvailability(descriptor, matrix),
    /deployments availability differs/,
  );
  descriptor.context.selection.contextModelIds = ['historical-hdd'];
  assert.doesNotThrow(() => assertSnapshotAvailability(descriptor, matrix));
  descriptor.context.asOfQuarter = '2023-Q3';
  descriptor.context.selection.contextModelIds = ['accepted-model'];
  descriptor.context.coverage = [{ quarter: '2023-Q3', datacenterFieldAvailable: false }];
  assert.throws(
    () => assertSnapshotAvailability(descriptor, matrix),
    /datacenters availability differs/,
  );
  descriptor.context.coverage[0].datacenterFieldAvailable = true;
  assert.doesNotThrow(() => assertSnapshotAvailability(descriptor, matrix));
});

void test('partial-only historical matrix remains selectable without asserting numeric AFR', () => {
  const descriptor = {
    context: {
      asOfQuarter: '2013-Q2',
      selection: { contextModelIds: ['historically-qualified-hdd'] },
      inventory: [{}],
      coverage: [{ quarter: '2013-Q2', datacenterFieldAvailable: false }],
    },
  };
  const matrix = {
    models: [
      {
        cells: [{ status: 'source_incomplete', metrics: { observedRecordedAfr: null } }],
      },
    ],
  };
  const before = structuredClone(matrix);
  assert.doesNotThrow(() => assertSnapshotAvailability(descriptor, matrix));
  assert.deepEqual(matrix, before);
  assert.equal(matrix.models[0].cells[0].metrics.observedRecordedAfr, null);
  assert.throws(
    () => assertSnapshotAvailability(descriptor, { models: [] }),
    /matrix availability differs/,
  );
});

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
async function publication(t, { revision = false, rateVersions } = {}) {
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
    if (rateVersions) {
      descriptor.context.versions.rate = rateVersions[number];
    }
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

void test('active release rejects legacy calculation semantics in every advertised snapshot', async (t) => {
  const { directory } = await publication(t);
  // The generic checker and browser reader retain their legacy fixture support.
  await checkProductionData(directory, { ...options, requiredRateVersion: '2.0.0' });
  await assert.rejects(
    checkProductionData(directory, { ...options, requiredRateVersion: '2.1.0' }),
    /calculation version differs from active release/,
  );
});

void test('uniform 2.1 rates cannot hide legacy selection or frozen-cohort semantics', async (t) => {
  const { directory } = await publication(t, { rateVersions: ['2.1.0', '2.1.0'] });
  for (const [option, semantic] of [
    ['requiredSelectionVersion', 'selection'],
    ['requiredCohortVersion', 'cohort'],
  ]) {
    await assert.rejects(
      checkProductionData(directory, {
        ...options,
        requiredRateVersion: '2.1.0',
        [option]: '2.1.0',
      }),
      new RegExp(`${semantic} version differs from active release`),
    );
  }
});

void test('active capacity policy rejects missing or broader minimum while legacy checks remain compatible', async (t) => {
  const { directory } = await publication(t);
  // Legacy 2.0 descriptors have no minimum-capacity selection field.
  await checkProductionData(directory, options);
  await assert.rejects(
    checkProductionData(directory, {
      ...options,
      requiredMinimumCapacityTB: activeReleaseSelection.requiredMinimumCapacityTB,
    }),
    /minimum capacity differs from active release/,
  );
  // The reader rejects minimum-capacity fields on legacy selection contexts;
  // exercise the same release assertion directly for valid new selection fields.
  for (const minimumCapacityTB of [0.5, 2]) {
    assert.throws(
      () =>
        assertMinimumCapacity(
          { minimumCapacityTB },
          activeReleaseSelection.requiredMinimumCapacityTB,
        ),
      /minimum capacity differs from active release/,
    );
  }
  assert.doesNotThrow(() =>
    assertMinimumCapacity(
      { minimumCapacityTB: 1 },
      activeReleaseSelection.requiredMinimumCapacityTB,
    ),
  );
});

void test('active release rejects a legacy advertised snapshot even when latest declares 2.1', async (t) => {
  const { directory, index } = await publication(t, { rateVersions: ['2.0.0', '2.1.0'] });
  const latest = index.snapshots.find((entry) => entry.snapshotId === index.latestSnapshotId);
  const latestDescriptor = JSON.parse(
    await readFile(join(directory, latest.descriptor.path), 'utf8'),
  );
  assert.equal(latestDescriptor.context.versions.rate, '2.1.0');
  // Descriptor/context hashes and referenced artifacts were rebound by publication().
  await assert.rejects(
    checkProductionData(directory, { ...options, requiredRateVersion: '2.1.0' }),
    /calculation version differs from active release/,
  );
});

void test('same-quarter immutable revisions keep every snapshot while release quarter inventory stays unique', async (t) => {
  const { directory } = await publication(t, { revision: true });
  const result = await checkProductionData(directory, options);
  assert.equal(result.snapshots, 3);
  assert.equal(result.matrices, 3);
  assert.equal(result.files, (await readdir(directory)).length);
  await assert.rejects(
    checkProductionData(directory, { ...options, requiredSnapshotCount: 2 }),
    /snapshot count differs from active release/,
  );
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
