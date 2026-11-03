import { formatAfr } from './afr-format.ts';
import { manufacturerModelLabel } from './model-labels.ts';
import type {
  AfrTimelineModel,
  AfrTimelinePoint,
  AfrTimeMode,
  AfrMetric,
} from './afr-timeline-data.ts';
export type { AfrTimeMode, AfrMetric } from './afr-timeline-data.ts';
export const plot = { width: 1000, height: 440, left: 76, right: 24, top: 28, bottom: 68 };
export function quarterOrdinal(quarter: string): number {
  return Number(quarter.slice(0, 4)) * 4 + Number(quarter.slice(-1)) - 1;
}
export function quarterLabel(ordinal: number): string {
  return `${Math.floor(ordinal / 4)} Q${(ordinal % 4) + 1}`;
}
export function relativeLabel(position: number): string {
  return `Y${Math.floor((position - 1) / 4) + 1}Q${((position - 1) % 4) + 1}`;
}
export function pointRate(point: AfrTimelinePoint, metric: AfrMetric): number | null {
  return metric === 'cumulative' ? point.cumulativeAfr : point.quarterlyAfr;
}
export type ChartGeometry = {
  width: number;
  height: number;
  minimum: number;
  maximum: number;
  yMaximum: number;
  x: (position: number) => number;
  y: (rate: number) => number;
  ticks: number[];
  labelTicks: number[];
};
export type TimeRange = { minimum: number; maximum: number };
export type YRange = 1 | 2 | 3 | 5 | 'auto';
export const pointPosition = (point: AfrTimelinePoint, mode: AfrTimeMode): number =>
  mode === 'relative' ? point.relativeQuarter : quarterOrdinal(point.quarter);
export function timeDomain(
  models: readonly AfrTimelineModel[],
  mode: AfrTimeMode,
  asOfQuarter: string,
): TimeRange {
  let minimum = mode === 'relative' ? 1 : quarterOrdinal(asOfQuarter);
  let maximum = minimum;
  for (const model of models) {
    for (const point of model.points) {
      const position = pointPosition(point, mode);
      minimum = Math.min(minimum, position);
      maximum = Math.max(maximum, position);
    }
  }
  return { minimum, maximum };
}
export function clampTimeRange(range: TimeRange | null, domain: TimeRange): TimeRange {
  if (!range || range.maximum < domain.minimum || range.minimum > domain.maximum) {
    return { ...domain };
  }
  return {
    minimum: Math.max(domain.minimum, Math.round(range.minimum)),
    maximum: Math.min(domain.maximum, Math.round(range.maximum)),
  };
}
/** An empty selection is temporary, not a new one-quarter data domain. */
export function reconcileTimeRange(
  range: TimeRange | null,
  models: readonly AfrTimelineModel[],
  mode: AfrTimeMode,
  asOfQuarter: string,
): TimeRange | null {
  return !range || !models.some((model) => model.points.length > 0)
    ? range
    : clampTimeRange(range, timeDomain(models, mode, asOfQuarter));
}
export function selectedTimeRange(start: number, end: number, domain: TimeRange): TimeRange {
  return clampTimeRange({ minimum: Math.min(start, end), maximum: Math.max(start, end) }, domain);
}
export function zoomOutTimeRange(range: TimeRange, domain: TimeRange): TimeRange {
  const padding = Math.max(1, Math.ceil((range.maximum - range.minimum + 1) / 2));
  return clampTimeRange(
    { minimum: range.minimum - padding, maximum: range.maximum + padding },
    domain,
  );
}
export function visiblePoints(
  model: AfrTimelineModel,
  mode: AfrTimeMode,
  range: TimeRange,
): AfrTimelinePoint[] {
  return model.points.filter((point) => {
    const position = pointPosition(point, mode);
    return position >= range.minimum && position <= range.maximum;
  });
}
export function offscaleRuns(
  model: AfrTimelineModel,
  mode: AfrTimeMode,
  metric: AfrMetric,
  geometry: ChartGeometry,
): { point: AfrTimelinePoint; count: number; maximum: number }[] {
  const runs: { point: AfrTimelinePoint; count: number; maximum: number }[] = [];
  let previous = -Infinity;
  for (const point of visiblePoints(model, mode, geometry)) {
    const value = pointRate(point, metric);
    const position = pointPosition(point, mode);
    if (value !== null && value > geometry.yMaximum) {
      const last = runs.at(-1);
      if (last && position === previous + 1) {
        last.count++;
        if (value > last.maximum) {
          last.maximum = value;
          last.point = point;
        }
      } else {
        runs.push({ point, count: 1, maximum: value });
      }
      previous = position;
    } else {
      previous = -Infinity;
    }
  }
  return runs;
}
export function chartGeometry(
  models: readonly AfrTimelineModel[],
  mode: AfrTimeMode,
  metric: AfrMetric,
  asOfQuarter: string,
  viewportWidth = plot.width,
  range: TimeRange | null = null,
  yRange: YRange = 3,
): ChartGeometry {
  const width = Math.max(280, Math.min(plot.width, viewportWidth));
  const height = width < 640 ? 340 : plot.height;
  const { minimum, maximum } = clampTimeRange(range, timeDomain(models, mode, asOfQuarter));
  let highest = 2;
  for (const model of models) {
    for (const point of visiblePoints(model, mode, { minimum, maximum })) {
      highest = Math.max(highest, pointRate(point, metric) ?? 0);
    }
  }
  const magnitude = 10 ** Math.floor(Math.log10(highest));
  const rounded = Math.ceil((highest / magnitude) * 1.08) * magnitude;
  const yMaximum = yRange === 'auto' ? (Number.isFinite(rounded) ? rounded : highest) : yRange;
  const span = Math.max(1, maximum - minimum);
  const firstYear =
    Math.ceil((minimum - (mode === 'relative' ? 1 : 0)) / 4) * 4 + (mode === 'relative' ? 1 : 0);
  const ticks: number[] = [];
  for (let position = firstYear; position <= maximum; position += 4) {
    ticks.push(position);
  }
  // Keep every annual mark. Only labels thin, in whole-year increments.
  const labelBudget = Math.max(1, Math.floor((width - plot.left - plot.right) / 85));
  const labelStep = Math.max(1, Math.ceil(ticks.length / labelBudget));
  const labelTicks = ticks.filter((_, index) => index % labelStep === 0);
  return {
    width,
    height,
    minimum,
    maximum,
    yMaximum,
    ticks,
    labelTicks,
    x: (position) =>
      minimum === maximum
        ? (plot.left + width - plot.right) / 2
        : plot.left + ((position - minimum) / span) * (width - plot.left - plot.right),
    // Finite coordinates far outside the clip retain extreme values without SVG overflow.
    y: (rate) =>
      height - plot.bottom - Math.min(rate / yMaximum, 1e100) * (height - plot.top - plot.bottom),
  };
}
export function seriesPath(
  model: AfrTimelineModel,
  geometry: ChartGeometry,
  mode: AfrTimeMode,
  metric: AfrMetric,
): string {
  let connected = false;
  let previous = -Infinity;
  const commands: string[] = [];
  const points =
    geometry.minimum === geometry.maximum ? visiblePoints(model, mode, geometry) : model.points;
  for (const point of points) {
    const rate = pointRate(point, metric);
    const position = mode === 'relative' ? point.relativeQuarter : quarterOrdinal(point.quarter);
    if (rate === null) {
      connected = false;
      previous = position;
      continue;
    }
    const x = geometry.x(position).toFixed(2);
    const y = geometry.y(rate).toFixed(2);
    // The tiny round-capped segment keeps isolated observations visible without a node per point.
    commands.push(`${connected && position === previous + 1 ? 'L' : 'M'}${x},${y}h0.01`);
    connected = true;
    previous = position;
  }
  return commands.join(' ');
}
const colors = [
  '#205a91',
  '#a63930',
  '#48732b',
  '#784a99',
  '#a45513',
  '#007b80',
  '#9b3e70',
  '#595a23',
];
const dashes = ['', '8 3', '3 3', '10 3 2 3'];
export function seriesStyle(id: string) {
  let hash = 0;
  for (const char of id) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return {
    color: colors[hash % colors.length]!,
    dash: dashes[Math.floor(hash / colors.length) % dashes.length]!,
  };
}

export function initialTimelineSelection(
  models: readonly AfrTimelineModel[],
  asOfQuarter: string,
): Set<string> {
  return new Set(
    models
      .map((model) => ({
        model,
        count: model.points.find((point) => point.quarter === asOfQuarter)?.count ?? 0,
      }))
      .filter(({ count }) => count > 0)
      .toSorted((a, b) => b.count - a.count || a.model.id.localeCompare(b.model.id))
      .slice(0, 3)
      .map(({ model }) => model.id),
  );
}

export type BrushPointer = {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
};
/** Gesture state shared by pointer adapters; cancellation never commits a range. */
export function createTimeBrush(callbacks: {
  capture: (id: number) => void;
  release: (id: number) => void;
  preview: (range: { start: number; end: number } | null) => void;
  select: (start: number, end: number) => void;
  click: () => void;
}) {
  let pointer: number | null = null;
  let start = 0;
  let clientStart = 0;
  function cancel() {
    const id = pointer;
    pointer = null;
    callbacks.preview(null);
    if (id !== null) {
      callbacks.release(id);
    }
  }
  return {
    start(event: BrushPointer, x: number): boolean {
      if (event.pointerType === 'touch' || event.button !== 0 || pointer !== null) {
        return false;
      }
      pointer = event.pointerId;
      start = x;
      clientStart = event.clientX;
      callbacks.capture(pointer);
      return true;
    },
    move(event: BrushPointer, x: number) {
      if (event.pointerId !== pointer) {
        return;
      }
      callbacks.preview(Math.abs(event.clientX - clientStart) >= 6 ? { start, end: x } : null);
    },
    end(event: BrushPointer, x: number) {
      if (event.pointerId !== pointer) {
        return;
      }
      const dragged = Math.abs(event.clientX - clientStart) >= 6;
      const initial = start;
      cancel();
      if (dragged) {
        callbacks.select(initial, x);
      } else {
        callbacks.click();
      }
    },
    cancel,
  };
}

/** Coalesce observer measurements without mutating layout in its delivery callback. */
export function createChartResizeScheduler(
  initialWidth: number,
  resize: (width: number) => void,
  requestFrame: (callback: () => void) => number,
  cancelFrame: (id: number) => void,
) {
  const normalize = (width: number) => Math.max(280, Math.min(1000, width));
  let applied = normalize(initialWidth);
  let latest = applied;
  let pending: number | null = null;
  let disposed = false;
  return {
    measure(width: number) {
      if (disposed || !Number.isFinite(width) || width <= 0) {
        return;
      }
      latest = normalize(width);
      if (pending !== null || Math.abs(latest - applied) <= 2) {
        return;
      }
      pending = requestFrame(() => {
        pending = null;
        if (disposed || Math.abs(latest - applied) <= 2) {
          return;
        }
        applied = latest;
        resize(applied);
      });
    },
    dispose() {
      disposed = true;
      if (pending !== null) {
        cancelFrame(pending);
        pending = null;
      }
    },
  };
}

export function pointTooltip(
  model: AfrTimelineModel,
  point: AfrTimelinePoint,
  metric: AfrMetric,
): string {
  const value = pointRate(point, metric);
  return `${manufacturerModelLabel(model)}: ${value === null ? 'Unavailable' : `${formatAfr(value)}%`}`;
}

/** Nearest recorded quarter in the visible window; stable on equal-distance ties. */
export function nearestPointIndex(
  points: readonly AfrTimelinePoint[],
  mode: AfrTimeMode,
  geometry: ChartGeometry,
  targetX: number,
): number {
  let result = 0;
  let distance = Infinity;
  points.forEach((point, index) => {
    const candidate = Math.abs(geometry.x(pointPosition(point, mode)) - targetX);
    if (candidate < distance) {
      distance = candidate;
      result = index;
    }
  });
  return result;
}

/** Focused views distinguish half percents; full range uses a bounded integer scale. */
export function yAxisTicks(maximum: number, focused: boolean): { value: number; minor: boolean }[] {
  const rawStep = maximum / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = focused ? 0.5 : Math.max(1, nice * magnitude);
  const count = Math.floor(maximum / step);
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = index * step;
    return { value, minor: focused && !Number.isInteger(value) };
  });
}
