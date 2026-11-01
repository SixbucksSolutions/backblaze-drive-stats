import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { CapacityHistoryReader, capacityCsvRows, renderCapacity } from './capacity-report.ts';
import type { CapacityPoint } from './capacity-report.ts';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseSupportingQuarter,
} from './production-data.ts';
import type { SnapshotDescriptor, SupportingQuarter } from './production-data.ts';
import { SnapshotLoader } from './snapshot-loader.ts';
import { activeReleaseSelection } from '../scripts/active-release-selection.ts';

const directory = new URL('../../fixtures/production-v2/', import.meta.url);
const names = await readdir(directory);
const index = parseProductionIndex(
  await readFile(
    new URL(
      names.find((name) => name.startsWith('sample-index.'))!,
      directory,
    ),
  ),
);
const entry = index.snapshots[0]!;
const baseDescriptor = parseSnapshotDescriptor(
  await readFile(new URL(entry.descriptor.path, directory)),
  entry,
);
const reference = baseDescriptor.quarters.find((row) => row.payload)!;
const basePayload = parseSupportingQuarter(
  await readFile(new URL(reference.payload!.path, directory)),
  baseDescriptor,
  reference.quarter,
);

function point(
  quarter: string,
  capacityTB: number | null,
  status: CapacityPoint['status'] = 'complete',
): CapacityPoint {
  return {
    quarter,
    status,
    count: capacityTB === null ? 17 : capacityTB,
    capacityTB,
    capacityDeltaTB: null,
    capacityDeltaReason: 'first_quarter',
    reason: 'Source coverage <test>',
  };
}

function setup(points: readonly CapacityPoint[]) {
  const descriptor = structuredClone(baseDescriptor);
  descriptor.context.asOfQuarter = points.at(-1)!.quarter;
  descriptor.quarters = points.map((item) => ({
    quarter: item.quarter,
    status: item.status,
    payload: item.status === 'missing' || item.status === 'unpublished' ? null : reference.payload,
  }));
  descriptor.context.coverage = points.map((item) => ({
    ...baseDescriptor.context.coverage[0]!,
    quarter: item.quarter,
    status: item.status,
    reason: item.reason,
  }));
  const payloads = new Map(
    points.map((item) => {
      const payload = structuredClone(basePayload);
      payload.quarter = item.quarter;
      payload.status = item.status === 'partial' ? 'partial' : 'complete';
      payload.scopes.all_supplied.totals = {
        count: item.count,
        capacityTB: item.capacityTB,
        new: null,
      };
      payload.scopes.all_supplied.capacityDeltaTB = item.capacityDeltaTB;
      payload.scopes.all_supplied.capacityDeltaReason =
        item.capacityDeltaReason === 'unavailable'
          ? 'previous_unavailable'
          : item.capacityDeltaReason;
      // A deliberately different selected-HDD scope detects accidental scope narrowing.
      payload.scopes.selected_hdd.totals.capacityTB = 999999;
      return [item.quarter, payload] as const;
    }),
  );
  class FakeLoader extends SnapshotLoader {
    calls = 0;
    active = 0;
    maximum = 0;
    fail = false;
    before: (() => Promise<void>) | undefined;
    constructor() {
      super('https://example.test/index.json');
    }
    override loadSnapshot(): Promise<SnapshotDescriptor> {
      return Promise.resolve(descriptor);
    }
    override async loadQuarter(
      _snapshot: string | SnapshotDescriptor,
      quarter: string,
    ): Promise<SupportingQuarter | null> {
      this.calls++;
      this.active++;
      this.maximum = Math.max(this.maximum, this.active);
      try {
        if (this.before) {
          await this.before();
        }
        if (this.fail) {
          throw new Error('Test payload unavailable');
        }
        return payloads.get(quarter) ?? null;
      } finally {
        this.active--;
      }
    }
  }
  const loader = new FakeLoader();
  return { descriptor, loader, reader: new CapacityHistoryReader(loader) };
}

void test('full all-supplied history preserves zeros, known counts, gaps and accepted adjacent deltas', async () => {
  const rows: CapacityPoint[] = [
    point('2024-Q1', 0),
    { ...point('2024-Q2', 100), capacityDeltaTB: 100, capacityDeltaReason: 'previous_complete' },
    point('2024-Q3', null, 'missing'),
    {
      ...point('2024-Q4', 200),
      capacityDeltaTB: null,
      capacityDeltaReason: 'previous_unavailable',
    },
    { ...point('2025-Q1', null), capacityDeltaReason: 'invalid_capacity' },
    { ...point('2025-Q2', null, 'partial'), capacityDeltaReason: 'current_incomplete' },
    point('2025-Q3', null, 'unpublished'),
  ];
  const { reader } = setup(rows);
  const result = await reader.load('test');
  assert.deepEqual(
    result.map((row) => row.quarter),
    rows.map((row) => row.quarter),
  );
  assert.equal(result[0]!.capacityTB, 0);
  assert.equal(result[0]!.capacityDeltaTB, null);
  assert.equal(result[1]!.capacityDeltaTB, 100);
  assert.equal(result[2]!.capacityTB, null);
  assert.equal(result[2]!.capacityDeltaReason, 'unavailable');
  assert.equal(result[3]!.capacityDeltaTB, null);
  assert.equal(result[4]!.count, 17);
  assert.equal(result[4]!.capacityTB, null);
  assert.equal(result[5]!.capacityDeltaReason, 'current_incomplete');
  assert.ok(Object.isFrozen(result));
  assert.ok(result.every(Object.isFrozen));
  const csv = capacityCsvRows(result);
  assert.equal(csv.length, result.length + 1);
  assert.equal(csv[1]![3], 0);
  assert.equal(csv[3]![3], 'Unavailable');
  assert.equal(csv[5]![2], 17);
  assert.deepEqual(
    csv.slice(1).map((row) => row[0]),
    result.map((row) => row.quarter),
  );
});

void test('line segments break at unavailable, partial and calendar gaps; selected quarter changes emphasis only', () => {
  const rows = [
    point('2023-Q1', 0),
    point('2023-Q2', 10),
    point('2023-Q3', 50, 'partial'),
    point('2023-Q4', 20),
    point('2024-Q1', null),
    point('2024-Q2', 30),
    point('2024-Q4', 40),
  ];
  const html = renderCapacity(rows, '2023-Q2');
  assert.equal((html.match(/class="capacity-segment"/g) ?? []).length, 4);
  assert.equal((html.match(/<circle /g) ?? []).length, 5);
  assert.equal((html.match(/<tr/g) ?? []).length, rows.length + 1);
  assert.match(html, /2023-Q2 \(selected\)/);
  assert.match(html, /aria-current="true"/);
  assert.match(
    html,
    /class="capacity-plot" tabindex="0" role="region" aria-label="Scrollable capacity chart"/,
  );
  assert.match(html, /Source coverage &lt;test&gt;/);
  assert.match(html, /mode through the snapshot cutoff/);
  assert.match(html, /ties choosing the smaller byte capacity/);
  assert.match(html, /1 PB = 1,000 TB/);
  const lines = (value: string) => value.match(/<polyline[^>]*>/g);
  assert.deepEqual(lines(html), lines(renderCapacity(rows, '2024-Q4')));
  assert.match(renderCapacity([point('2024-Q1', null)], '2024-Q1'), /No complete-quarter capacity/);
  assert.match(renderCapacity([point('2024-Q1', 0)], '2024-Q1'), /<circle /);
});

void test('even a malformed finite delta cannot bridge an absent or partial predecessor', async () => {
  const { reader } = setup([
    point('2024-Q1', 10),
    { ...point('2024-Q3', 20), capacityDeltaTB: 10, capacityDeltaReason: 'previous_complete' },
    point('2024-Q4', 20, 'partial'),
    { ...point('2025-Q1', 30), capacityDeltaTB: 10, capacityDeltaReason: 'previous_complete' },
  ]);
  const rows = await reader.load('test');
  assert.equal(rows[1]!.capacityDeltaTB, null);
  assert.equal(rows[3]!.capacityDeltaTB, null);
});

void test('bounded concurrency, completed cache and generation separation', async () => {
  const { loader, descriptor, reader } = setup(
    Array.from({ length: 12 }, (_, i) => point(`${2022 + Math.floor(i / 4)}-Q${(i % 4) + 1}`, i)),
  );
  loader.before = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  const first = await reader.load('test');
  assert.equal(loader.maximum, 4);
  assert.equal(loader.calls, 12);
  assert.equal(await reader.load('test'), first);
  assert.equal(loader.calls, 12);
  descriptor.contextSha256 = 'a'.repeat(64);
  assert.notEqual(await reader.load('test'), first);
  assert.equal(loader.calls, 24);
});

void test('late ignored-signal responses and failed loads cannot cache partial histories', async () => {
  const { loader, reader } = setup([point('2024-Q1', 1), point('2024-Q2', 2)]);
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  loader.before = () => {
    started!();
    return gate;
  };
  const controller = new AbortController();
  const pending = reader.load('test', controller.signal);
  await ready;
  controller.abort();
  release!();
  await assert.rejects(pending, { name: 'AbortError' });
  loader.before = undefined;
  loader.fail = true;
  await assert.rejects(reader.load('test'), /Test payload unavailable/);
  loader.fail = false;
  const before = loader.calls;
  const result = await reader.load('test');
  assert.equal(result.length, 2);
  assert.equal(loader.calls, before + 2);
  await assert.rejects(reader.load('test', controller.signal), { name: 'AbortError' });
});

void test('one canceled reader consumer cannot cancel a live consumer', async () => {
  const { reader } = setup([point('2024-Q1', 5)]);
  const controller = new AbortController();
  const canceled = reader.load('test', controller.signal);
  const live = reader.load('test');
  controller.abort();
  await assert.rejects(canceled, { name: 'AbortError' });
  assert.equal((await live)[0]!.capacityTB, 5);
});

void test('all 53 historical snapshot graphs produce exact all-supplied chronological histories', async () => {
  const root = new URL('../public/data/production/', import.meta.url);
  const loader = new SnapshotLoader('https://example.test/production/index.json', async (url) => {
    const relative = new URL(url).pathname.replace('/production/', '');
    return new Response(new Uint8Array(await readFile(new URL(relative, root))));
  });
  const productionIndex = await loader.loadIndex();
  assert.equal(productionIndex.snapshots.length, activeReleaseSelection.requiredSnapshotCount);
  assert.deepEqual(
    productionIndex.snapshots.map((entry) => entry.asOfQuarter).sort(),
    [...activeReleaseSelection.quarters].sort(),
  );
  const reader = new CapacityHistoryReader(loader);
  for (const snapshot of productionIndex.snapshots) {
    const descriptor = await loader.loadSnapshot(snapshot.snapshotId);
    const points = await reader.load(snapshot.snapshotId);
    assert.equal(points.length, descriptor.quarters.length);
    assert.equal(points.at(-1)!.quarter, snapshot.asOfQuarter);
    let previous: CapacityPoint | undefined;
    for (const [i, row] of points.entries()) {
      assert.equal(row.quarter, descriptor.quarters[i]!.quarter);
      const payload = await loader.loadQuarter(descriptor, row.quarter);
      assert.equal(row.count, payload?.scopes.all_supplied.totals.count ?? null);
      assert.equal(row.capacityTB, payload?.scopes.all_supplied.totals.capacityTB ?? null);
      assert.equal(row.capacityDeltaTB, payload?.scopes.all_supplied.capacityDeltaTB ?? null);
      if (row.capacityDeltaTB !== null) {
        assert.equal(row.status, 'complete');
        assert.equal(previous!.status, 'complete');
        assert.ok(
          Math.abs(row.capacityDeltaTB - (row.capacityTB! - previous!.capacityTB!)) < 0.000001,
        );
      }
      previous = row;
    }
    const html = renderCapacity(points, points.at(-1)!.quarter);
    assert.equal((html.match(/<tr/g) ?? []).length, points.length + 1);
    assert.equal(capacityCsvRows(points).length, points.length + 1);
  }
});
