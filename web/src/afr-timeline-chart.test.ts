import test from 'node:test';
import assert from 'node:assert/strict';
import type { AfrTimelineModel, AfrTimelinePoint } from './afr-timeline-data.ts';
import {
  chartGeometry,
  initialTimelineSelection,
  plot,
  pointRate,
  quarterLabel,
  quarterOrdinal,
  relativeLabel,
  seriesPath,
  seriesStyle,
} from './afr-timeline-chart.ts';
const point = (
  quarter: string,
  relativeQuarter: number,
  cumulativeAfr: number | null,
  quarterlyAfr = cumulativeAfr,
  count: number | null = 10,
): AfrTimelinePoint => ({
  quarter,
  relativeQuarter,
  cumulativeAfr,
  quarterlyAfr,
  count,
  failures: 1,
  driveDays: 1000,
  coverage: cumulativeAfr === null ? 'partial' : 'complete',
  historyComplete: cumulativeAfr !== null,
});
const model = (id: string, points: AfrTimelinePoint[]): AfrTimelineModel => ({
  id,
  name: id,
  vendor: 'Seagate',
  capacityTB: 10,
  firstQuarter: points[0]?.quarter ?? '2024-Q1',
  points,
});

await test('quarter labels cross years without zero-indexed relative years', () => {
  assert.equal(quarterOrdinal('2025-Q1') - quarterOrdinal('2024-Q4'), 1);
  assert.equal(quarterLabel(quarterOrdinal('2025-Q1')), '2025 Q1');
  assert.deepEqual([1, 4, 5, 24, 25].map(relativeLabel), ['Y1Q1', 'Y1Q4', 'Y2Q1', 'Y6Q4', 'Y7Q1']);
});
await test('relative and calendar alignment retain real elapsed quarters and cutoff', () => {
  const models = [
    model('a', [point('2024-Q1', 1, 0), point('2024-Q3', 3, 5)]),
    model('b', [point('2024-Q2', 1, 2)]),
  ];
  const relative = chartGeometry(models, 'relative', 'cumulative', '2025-Q2');
  assert.equal(relative.minimum, 1);
  assert.equal(relative.maximum, 3);
  assert.equal(relative.x(1), plot.left);
  const calendar = chartGeometry(models, 'calendar', 'cumulative', '2025-Q2');
  assert.equal(calendar.minimum, quarterOrdinal('2024-Q1'));
  assert.equal(calendar.maximum, quarterOrdinal('2025-Q2'));
  assert.equal(calendar.x(calendar.maximum), plot.width - plot.right);
  assert.equal(calendar.y(0), plot.height - plot.bottom);
});
await test('path retains zero, isolates nulls and never connects across implicit gaps', () => {
  const data = model('gaps', [
    point('2024-Q1', 1, 0),
    point('2024-Q2', 2, 1),
    point('2024-Q3', 3, null),
    point('2024-Q4', 4, 2),
    point('2025-Q2', 6, 3),
  ]);
  const geometry = chartGeometry([data], 'relative', 'cumulative', '2025-Q2');
  const path = seriesPath(data, geometry, 'relative', 'cumulative');
  assert.equal(path.match(/M/g)?.length, 3);
  assert.equal(path.match(/L/g)?.length, 1);
  assert.match(path, /^M76.00,372.00h0.01 L/);
  assert.equal(pointRate(data.points[0]!, 'cumulative'), 0);
  assert.equal(
    seriesPath(model('empty', [point('2024-Q1', 1, null)]), geometry, 'relative', 'cumulative'),
    '',
  );
});
await test('quarterly metric changes geometry and singleton remains visible', () => {
  const data = model('spike', [point('2024-Q1', 1, 1, 10000)]);
  const cumulative = chartGeometry([data], 'relative', 'cumulative', '2024-Q1');
  const quarterly = chartGeometry([data], 'relative', 'quarterly', '2024-Q1');
  assert.ok(quarterly.yMaximum > 10000);
  assert.ok(cumulative.yMaximum < quarterly.yMaximum);
  assert.ok(quarterly.y(10000) >= plot.top);
  assert.match(seriesPath(data, quarterly, 'relative', 'quarterly'), /^M.*h0.01$/);
});

await test('calendar cutoff label replaces a tick too close to the right edge', () => {
  const data = model('calendar', [point('2018-Q2', 1, 1), point('2026-Q2', 33, 1)]);
  const geometry = chartGeometry([data], 'calendar', 'cumulative', '2026-Q2', 746);
  assert.equal(geometry.ticks.at(-1), quarterOrdinal('2026-Q2'));
  assert.ok(geometry.x(geometry.ticks.at(-1)!) - geometry.x(geometry.ticks.at(-2)!) > 60);
});
await test('finite extremes and large selected sets do not overflow argument or chart bounds', () => {
  const extreme = model('large', [point('2024-Q1', 1, Number.MAX_VALUE)]);
  const geometry = chartGeometry([extreme], 'relative', 'cumulative', '2024-Q1');
  assert.ok(Number.isFinite(geometry.yMaximum));
  assert.ok(geometry.y(Number.MAX_VALUE) >= plot.top);
  assert.doesNotMatch(seriesPath(extreme, geometry, 'relative', 'cumulative'), /Infinity|NaN/);
  const many = model(
    'many',
    Array.from({ length: 150000 }, () => point('2024-Q1', 1, 1)),
  );
  assert.ok(Number.isFinite(chartGeometry([many], 'relative', 'cumulative', '2024-Q1').yMaximum));
});
await test('initial three use positive as-of counts, exclude retired and null counts, and break ties by id', () => {
  const data = [
    model('retired', [point('2024-Q1', 1, 1, 1, 1000000)]),
    model('b', [point('2024-Q2', 1, 1, 1, 100)]),
    model('a', [point('2024-Q2', 1, 1, 1, 100)]),
    model('c', [point('2024-Q2', 1, 1, 1, 50)]),
    model('d', [point('2024-Q2', 1, 1, 1, 10)]),
    model('zero', [point('2024-Q2', 1, null, null, 0)]),
    model('null', [point('2024-Q2', 1, null, null, null)]),
  ];
  assert.deepEqual([...initialTimelineSelection(data, '2024-Q2')], ['a', 'b', 'c']);
  assert.deepEqual([...initialTimelineSelection(data, '2025-Q1')], []);
  assert.deepEqual(seriesStyle('a'), seriesStyle('a'));
});

await test('mobile geometry uses measured width, readable unscaled labels and at most three ticks', () => {
  const data = model('mobile', [point('2014-Q1', 1, 1), point('2025-Q4', 48, 2)]);
  const geometry = chartGeometry([data], 'calendar', 'cumulative', '2025-Q4', 340);
  assert.equal(geometry.width, 340);
  assert.equal(geometry.height, 340);
  assert.ok(geometry.ticks.length <= 3);
  assert.equal(geometry.x(geometry.maximum), 340 - plot.right);
  assert.equal(geometry.y(0), 340 - plot.bottom);
});
