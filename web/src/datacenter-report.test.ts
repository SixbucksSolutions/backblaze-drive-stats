import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { datacenterCsvRows, datacenterSummary, renderDatacenters } from './datacenter-report.ts';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseSupportingQuarter,
  verifyReference,
} from './production-data.ts';
import type { Aggregate, Coverage, Datacenters } from './production-data.ts';

const coverage: Coverage = {
  quarter: '2023-Q3',
  status: 'complete',
  expectedDays: 92,
  observedDays: 92,
  firstObservedDate: '2023-07-01',
  lastObservedDate: '2023-09-30',
  knownObservationRows: 920,
  reason: 'Complete observations',
  datacenterFieldAvailable: true,
  evidence: [],
};
const totals: Aggregate = { count: 10, new: 2, capacityTB: 100 };
const locations: Datacenters = {
  fieldAvailable: true,
  knownLocationPopulationShare: 0.7,
  locations: [
    { name: 'A', count: 4, capacityTB: 60 },
    { name: 'B', count: 3, capacityTB: 10 },
    { name: 'Unknown', count: 3, capacityTB: 30 },
  ],
};

void test('accepted last-location allocation is used once without reconstructing movers; Unknown stays in denominators', () => {
  // The upstream identity allocation assigns one mover only to B. Its previous
  // location A is not a second population contribution in this accepted payload.
  const before = structuredClone(locations);
  const summary = datacenterSummary(locations, totals, coverage);
  assert.deepEqual(
    summary.rows.map((row) => row.count),
    [4, 3, 3],
  );
  assert.equal(
    summary.rows.reduce((sum, row) => sum + (row.count ?? 0), 0),
    10,
  );
  assert.equal(
    summary.rows.reduce((sum, row) => sum + (row.capacityTB ?? 0), 0),
    100,
  );
  assert.equal(summary.rows[0]?.populationShare, 0.4);
  assert.equal(summary.rows[0]?.capacityShare, 0.6);
  assert.equal(summary.knownLocationPopulationShare, 0.7);
  const csv = datacenterCsvRows(locations, totals, coverage);
  assert.deepEqual(csv[1], ['A', 4, 60, 0.4, 0.6, 0.7, 'Reported']);
  assert.deepEqual(csv[3], ['Unknown', 3, 30, 0.3, 0.3, 0.7, 'Reported']);
  assert.deepEqual(csv[4], ['All supplied total', 10, 100, 1, 1, 0.7, 'Reported']);
  const html = renderDatacenters(locations, totals, coverage);
  assert.equal((html.match(/<meter /g) ?? []).length, 3);
  assert.match(html, /value="60" aria-label="A: 60 decimal TB"/);
  assert.match(html, /<td>4<\/td><td>60<\/td><td>40%<\/td><td>60%<\/td>/);
  assert.match(html, /coverage: <strong>70%/);
  assert.deepEqual(locations, before);
});

void test('pre-boundary unreported is explicit even with a positive known Unknown total and 0% coverage', () => {
  const data: Datacenters = {
    fieldAvailable: false,
    knownLocationPopulationShare: 0,
    locations: [{ name: 'Unknown', count: 10, capacityTB: 100 }],
  };
  const source = { ...coverage, quarter: '2023-Q2', datacenterFieldAvailable: false };
  const html = renderDatacenters(data, totals, source);
  assert.doesNotMatch(html, /<meter /);
  assert.match(html, /field is unreported before 2023 Q3/);
  assert.match(html, /not zero capacity or evidence of flat growth/);
  assert.match(html, /coverage: <strong>0%/);
  assert.deepEqual(datacenterCsvRows(data, totals, source)[1], [
    'Unknown',
    10,
    100,
    1,
    1,
    0,
    'Unreported',
  ]);
});

void test('partial, missing, unpublished and absent payloads never invent exact totals from stale values', () => {
  for (const status of ['partial', 'missing', 'unpublished'] as const) {
    const source = { ...coverage, status };
    const summary = datacenterSummary(locations, totals, source);
    assert.equal(summary.count, null);
    assert.equal(summary.capacityTB, null);
    assert.equal(summary.knownLocationPopulationShare, null);
    assert.ok(
      summary.rows.every(
        (row) =>
          row.count === null &&
          row.capacityTB === null &&
          row.capacityShare === null &&
          row.populationShare === null,
      ),
    );
    assert.doesNotMatch(renderDatacenters(locations, totals, source), /<meter /);
    assert.deepEqual(
      datacenterCsvRows(locations, totals, source)[1]?.slice(1, 6),
      Array.from({ length: 5 }, () => 'Unavailable'),
    );
  }
  assert.match(renderDatacenters(null, null, coverage), /Quarter location totals are unavailable/);
  assert.equal(datacenterSummary(null, null, coverage).count, null);
  assert.equal(datacenterCsvRows(null, null, coverage).at(-1)?.at(-1), 'Reported');
});

void test('modern absent field retains Unknown totals and explains captured absence in report and CSV', () => {
  const data: Datacenters = {
    fieldAvailable: false,
    knownLocationPopulationShare: 0,
    locations: [{ name: 'Unknown', count: 10, capacityTB: 100 }],
  };
  const source = { ...coverage, quarter: '2024-Q1', datacenterFieldAvailable: false };
  const html = renderDatacenters(data, totals, source);
  assert.match(html, /field is absent from the captured source for this quarter/);
  assert.doesNotMatch(html, /field is unreported before 2023 Q3|<meter /);
  assert.match(html, /coverage: <strong>0%/);
  assert.deepEqual(datacenterCsvRows(data, totals, source)[1], [
    'Unknown',
    10,
    100,
    1,
    1,
    0,
    'Unreported',
  ]);
  assert.equal(datacenterSummary(data, totals, source).capacityTB, 100);
});

void test('null capacity retains known counts; positive all-Unknown and zero denominators stay distinct', () => {
  const nullCapacity: Datacenters = {
    fieldAvailable: true,
    knownLocationPopulationShare: 0,
    locations: [{ name: 'Unknown', count: 10, capacityTB: null }],
  };
  const nullTotals = { ...totals, capacityTB: null };
  assert.deepEqual(datacenterCsvRows(nullCapacity, nullTotals, coverage)[1], [
    'Unknown',
    10,
    'Unavailable',
    1,
    'Unavailable',
    0,
    'Reported',
  ]);
  const html = renderDatacenters(nullCapacity, nullTotals, coverage);
  assert.match(html, /10 observed drives/);
  assert.match(html, /Unavailable capacity/);
  assert.doesNotMatch(html, /<meter /);
  const empty: Datacenters = {
    fieldAvailable: true,
    knownLocationPopulationShare: null,
    locations: [{ name: 'Unknown', count: 0, capacityTB: 0 }],
  };
  assert.deepEqual(datacenterCsvRows(empty, { count: 0, new: 0, capacityTB: 0 }, coverage)[1], [
    'Unknown',
    0,
    0,
    'Unavailable',
    'Unavailable',
    'Unavailable',
    'Reported',
  ]);
  assert.match(
    renderDatacenters(empty, { count: 0, new: 0, capacityTB: 0 }, coverage),
    /value="0"/,
  );
});

void test('location labels escape text, table and chart accessible labels', () => {
  const data = {
    ...locations,
    locations: [{ name: '<img src=x onerror="bad">', count: 10, capacityTB: 100 }],
  };
  const html = renderDatacenters(data, totals, coverage);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-label="&lt;img src=x onerror=&quot;bad&quot;&gt;: 100 decimal TB"/);
  assert.equal(datacenterCsvRows(data, totals, coverage)[1]?.[0], data.locations[0]?.name);
});

void test('every accepted public generation reconciles actual 2023 Q2/Q3 boundary chart/table/CSV with all-supplied totals', async () => {
  const root = new URL('../public/data/production/', import.meta.url);
  const bytes = (path: string) => readFile(new URL(path, root));
  const index = parseProductionIndex(await bytes('index.json'));
  for (const entry of index.snapshots) {
    const descriptorBytes = await bytes(entry.descriptor.path);
    await verifyReference(descriptorBytes, entry.descriptor);
    const descriptor = parseSnapshotDescriptor(descriptorBytes, entry);
    for (const quarter of ['2023-Q2', '2023-Q3']) {
      const ref = descriptor.quarters.find((row) => row.quarter === quarter)?.payload;
      assert.ok(ref);
      const payloadBytes = await bytes(ref.path);
      await verifyReference(payloadBytes, ref);
      const payload = parseSupportingQuarter(payloadBytes, descriptor, quarter);
      const source = descriptor.context.coverage.find((row) => row.quarter === quarter)!;
      const total = payload.scopes.all_supplied.totals;
      const summary = datacenterSummary(payload.datacenters, total, source);
      const csv = datacenterCsvRows(payload.datacenters, total, source);
      assert.equal(
        summary.rows.reduce((sum, row) => sum + (row.count ?? 0), 0),
        total.count,
      );
      assert.equal(summary.count, total.count);
      assert.equal(summary.capacityTB, total.capacityTB);
      assert.equal(csv.length, payload.datacenters.locations.length + 2);
      assert.equal(csv.at(-1)?.[1], total.count);
      const html = renderDatacenters(payload.datacenters, total, source);
      if (quarter === '2023-Q2') {
        assert.equal(summary.fieldAvailable, false);
        assert.equal(summary.knownLocationPopulationShare, 0);
        assert.doesNotMatch(html, /<meter /);
        assert.match(html, /field is unreported/);
      } else {
        assert.equal(summary.fieldAvailable, true);
        assert.ok((summary.knownLocationPopulationShare ?? 0) > 0);
        assert.equal(
          (html.match(/<meter /g) ?? []).length,
          summary.rows.filter((row) => row.capacityTB !== null).length,
        );
      }
    }
  }
});
