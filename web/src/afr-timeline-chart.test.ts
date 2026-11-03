import test from 'node:test';
import assert from 'node:assert/strict';
import type { AfrTimelineModel, AfrTimelinePoint } from './afr-timeline-data.ts';
import {
  chartGeometry,
  createTimeBrush,
  createChartResizeScheduler,
  initialTimelineSelection,
  plot,
  pointRate,
  quarterLabel,
  quarterOrdinal,
  relativeLabel,
  seriesPath,
  seriesStyle,
  timeDomain,
  clampTimeRange,
  reconcileTimeRange,
  selectedTimeRange,
  zoomOutTimeRange,
  visiblePoints,
  offscaleRuns,
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

await test('zoom survives clear-all and reselect in either time mode', () => {
  const selected = model('history', [point('2020-Q1', 1, 1), point('2029-Q4', 40, 1)]);
  for (const mode of ['relative', 'calendar'] as const) {
    const range =
      mode === 'relative'
        ? { minimum: 9, maximum: 24 }
        : { minimum: quarterOrdinal('2022-Q1'), maximum: quarterOrdinal('2025-Q4') };
    const cleared = reconcileTimeRange(range, [], mode, '2029-Q4');
    assert.deepEqual(cleared, range);
    assert.deepEqual(reconcileTimeRange(cleared, [selected], mode, '2029-Q4'), range);
    assert.equal(reconcileTimeRange(null, [], mode, '2029-Q4'), null);
    const later = model('later', [point('2030-Q1', 1, 1)]);
    if (mode === 'calendar') {
      assert.deepEqual(reconcileTimeRange(range, [later], mode, '2030-Q1'), {
        minimum: quarterOrdinal('2030-Q1'),
        maximum: quarterOrdinal('2030-Q1'),
      });
    }
  }
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
  const cumulative = chartGeometry([data], 'relative', 'cumulative', '2024-Q1', 1000, null, 'auto');
  const quarterly = chartGeometry([data], 'relative', 'quarterly', '2024-Q1', 1000, null, 'auto');
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
  const geometry = chartGeometry(
    [extreme],
    'relative',
    'cumulative',
    '2024-Q1',
    1000,
    null,
    'auto',
  );
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

await test('quarter windows normalize reverse drags, snap, clamp and zoom back to all time', () => {
  const domain = { minimum: 1, maximum: 20 };
  assert.deepEqual(selectedTimeRange(12.7, 4.4, domain), { minimum: 4, maximum: 13 });
  assert.deepEqual(selectedTimeRange(-20, 50, domain), domain);
  assert.deepEqual(clampTimeRange({ minimum: 10, maximum: 30 }, domain), {
    minimum: 10,
    maximum: 20,
  });
  assert.deepEqual(clampTimeRange({ minimum: 30, maximum: 40 }, domain), domain);
  assert.deepEqual(clampTimeRange(null, domain), domain);
  let range = { minimum: 8, maximum: 8 };
  for (let i = 0; i < 10; i++) {
    range = zoomOutTimeRange(range, domain);
  }
  assert.deepEqual(range, domain);
  assert.deepEqual(zoomOutTimeRange({ minimum: 1, maximum: 1 }, { minimum: 1, maximum: 1 }), {
    minimum: 1,
    maximum: 1,
  });
  assert.deepEqual(timeDomain([], 'relative', '2024-Q1'), { minimum: 1, maximum: 1 });
  assert.deepEqual(timeDomain([], 'calendar', '2024-Q1'), { minimum: 8096, maximum: 8096 });
});
await test('zoom preserves calendar gaps, recorded rates and full-range Y uses only visible quarters', () => {
  const data = model('gaps', [
    point('2024-Q1', 1, 100),
    point('2024-Q3', 3, 1.5),
    point('2024-Q4', 4, 2),
  ]);
  const range = { minimum: 2, maximum: 4 };
  const geometry = chartGeometry([data], 'relative', 'cumulative', '2024-Q4', 1000, range, 'auto');
  assert.equal(geometry.minimum, 2);
  assert.equal(geometry.maximum, 4);
  assert.ok(geometry.yMaximum < 100);
  assert.deepEqual(
    visiblePoints(data, 'relative', geometry).map((point) => point.cumulativeAfr),
    [1.5, 2],
  );
  assert.equal(visiblePoints(data, 'relative', { minimum: 2, maximum: 2 }).length, 0);
  const calendarRange = { minimum: quarterOrdinal('2024-Q2'), maximum: quarterOrdinal('2024-Q4') };
  const calendar = chartGeometry([data], 'calendar', 'cumulative', '2024-Q4', 1000, calendarRange);
  assert.equal(calendar.maximum - calendar.minimum, 2);
  assert.equal(calendar.yMaximum, 3);
});
await test('fixed Y keeps real high-value paths outside plot and discloses consecutive offscale runs', () => {
  const data = model('spikes', [
    point('2024-Q1', 1, 9),
    point('2024-Q2', 2, 12),
    point('2024-Q3', 3, null),
    point('2024-Q4', 4, 6),
    point('2025-Q1', 5, 1),
  ]);
  const geometry = chartGeometry([data], 'relative', 'cumulative', '2025-Q1');
  assert.equal(geometry.yMaximum, 3);
  assert.ok(geometry.y(9) < plot.top);
  assert.ok(geometry.y(12) < geometry.y(9));
  assert.ok(
    seriesPath(data, geometry, 'relative', 'cumulative').includes(geometry.y(9).toFixed(2)),
  );
  assert.deepEqual(
    offscaleRuns(data, 'relative', 'cumulative', geometry).map((run) => [
      run.count,
      run.maximum,
      run.point.relativeQuarter,
    ]),
    [
      [2, 12, 2],
      [1, 6, 4],
    ],
  );
  const zoom = chartGeometry(
    [data],
    'relative',
    'cumulative',
    '2025-Q1',
    1000,
    { minimum: 4, maximum: 5 },
    5,
  );
  assert.deepEqual(
    offscaleRuns(data, 'relative', 'cumulative', zoom).map((run) => run.count),
    [1],
  );
  const extreme = model('extreme', [point('2024-Q1', 1, Number.MAX_VALUE)]);
  const fixed = chartGeometry([extreme], 'relative', 'cumulative', '2024-Q1');
  assert.doesNotMatch(seriesPath(extreme, fixed, 'relative', 'cumulative'), /Infinity|NaN/);
  assert.equal(
    offscaleRuns(extreme, 'relative', 'cumulative', fixed)[0]?.maximum,
    Number.MAX_VALUE,
  );
});

await test('pointer gestures capture, reverse-drag, short-click, cancel and leave touch scrolling alone', () => {
  const captures: number[] = [];
  const releases: number[] = [];
  const selections: number[][] = [];
  let clicks = 0;
  let preview: { start: number; end: number } | null = null;
  const brush = createTimeBrush({
    capture: (id) => captures.push(id),
    release: (id) => releases.push(id),
    preview: (range) => {
      preview = range;
    },
    select: (a, b) => selections.push([a, b]),
    click: () => {
      clicks++;
    },
  });
  const event = (clientX: number, pointerType = 'mouse', pointerId = 1, button = 0) => ({
    clientX,
    pointerType,
    pointerId,
    button,
  });
  assert.equal(brush.start(event(200, 'touch'), 200), false);
  assert.equal(brush.start(event(200, 'mouse', 1, 2), 200), false);
  assert.deepEqual(captures, []);
  assert.equal(brush.start(event(200), 200), true);
  brush.move(event(100), 100);
  assert.deepEqual(preview, { start: 200, end: 100 });
  brush.end(event(100), 100);
  assert.deepEqual(selections, [[200, 100]]);
  assert.equal(preview, null);
  assert.deepEqual(releases, [1]);
  brush.start(event(50), 50);
  brush.move(event(53), 53);
  assert.equal(preview, null);
  brush.end(event(53), 53);
  assert.equal(clicks, 1);
  brush.start(event(50), 50);
  brush.move(event(90), 90);
  brush.cancel(); // Escape, pointercancel, lost capture and render share this cleanup.
  brush.end(event(90), 90);
  assert.equal(preview, null);
  assert.equal(clicks, 1);
  assert.deepEqual(selections, [[200, 100]]);
  assert.equal(releases.length, 3);
  assert.equal(brush.start(event(50), 50), true);
  brush.end(event(90, 'mouse', 2), 90);
  assert.equal(releases.length, 3);
  brush.cancel();
});

await test('single-quarter windows center only that quarter and exclude neighboring segments', () => {
  const data = model('neighbors', [
    point('2024-Q1', 1, 1),
    point('2024-Q2', 2, 2),
    point('2024-Q3', 3, 2.5),
  ]);
  for (const mode of ['relative', 'calendar'] as const) {
    const quarter = mode === 'relative' ? 2 : quarterOrdinal('2024-Q2');
    const geometry = chartGeometry([data], mode, 'cumulative', '2024-Q3', 1000, {
      minimum: quarter,
      maximum: quarter,
    });
    const path = seriesPath(data, geometry, mode, 'cumulative');
    assert.equal(geometry.x(quarter), (plot.left + geometry.width - plot.right) / 2);
    assert.equal(path, `M${geometry.x(quarter).toFixed(2)},${geometry.y(2).toFixed(2)}h0.01`);
    assert.deepEqual(
      visiblePoints(data, mode, geometry).map((point) => point.quarter),
      ['2024-Q2'],
    );
    const gap = model('gap', [data.points[0]!, data.points[2]!]);
    assert.equal(seriesPath(gap, geometry, mode, 'cumulative'), '');
  }
});

await test('resize redraws coalesce outside delivery, retain latest width and stop on disposal', () => {
  const frames = new Map<number, () => void>();
  const canceled: number[] = [];
  const widths: number[] = [];
  let sequence = 0;
  const scheduler = createChartResizeScheduler(
    800,
    (width) => widths.push(width),
    (callback) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    (id) => {
      canceled.push(id);
      frames.delete(id);
    },
  );
  const flush = () => {
    const work = [...frames.values()];
    frames.clear();
    work.forEach((callback) => callback());
  };
  scheduler.measure(650);
  scheduler.measure(500);
  assert.deepEqual(widths, []);
  assert.equal(frames.size, 1);
  flush();
  assert.deepEqual(widths, [500]);
  scheduler.measure(501);
  scheduler.measure(Number.NaN);
  scheduler.measure(0);
  assert.equal(frames.size, 0);
  scheduler.measure(400);
  scheduler.measure(500);
  flush();
  assert.deepEqual(widths, [500]);
  scheduler.measure(200);
  flush();
  assert.deepEqual(widths, [500, 280]);
  scheduler.measure(800);
  const stale = [...frames.values()][0]!;
  scheduler.dispose();
  assert.equal(canceled.length, 1);
  assert.equal(frames.size, 0);
  stale();
  scheduler.measure(1000);
  assert.equal(frames.size, 0);
  assert.deepEqual(widths, [500, 280]);
});
