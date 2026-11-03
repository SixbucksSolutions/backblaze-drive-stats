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
};
export function chartGeometry(
  models: readonly AfrTimelineModel[],
  mode: AfrTimeMode,
  metric: AfrMetric,
  asOfQuarter: string,
  viewportWidth = plot.width,
): ChartGeometry {
  const width = Math.max(280, Math.min(plot.width, viewportWidth));
  const height = width < 640 ? 340 : plot.height;
  let minimum = mode === 'relative' ? 1 : quarterOrdinal(asOfQuarter);
  let maximum = mode === 'relative' ? 1 : quarterOrdinal(asOfQuarter);
  let highest = 2;
  for (const model of models) {
    for (const point of model.points) {
      const position = mode === 'relative' ? point.relativeQuarter : quarterOrdinal(point.quarter);
      if (mode === 'calendar') {
        minimum = Math.min(minimum, position);
      } else {
        maximum = Math.max(maximum, position);
      }
      highest = Math.max(highest, pointRate(point, metric) ?? 0);
    }
  }
  // Round upwards while retaining finite, safe coordinates even for very large rates.
  const magnitude = 10 ** Math.floor(Math.log10(highest));
  const rounded = Math.ceil((highest / magnitude) * 1.08) * magnitude;
  const yMaximum = Number.isFinite(rounded) ? rounded : highest;
  const span = Math.max(1, maximum - minimum);
  const step = Math.max(1, Math.ceil(span / (width < 480 ? 2 : width < 740 ? 4 : 7)));
  const ticks = [minimum];
  for (let value = minimum + step; value < maximum; value += step) {
    ticks.push(value);
  }
  if (maximum !== minimum) {
    if (ticks.length > 1 && maximum - ticks.at(-1)! < step * 0.75) {
      ticks.pop();
    }
    ticks.push(maximum);
  }
  return {
    width,
    height,
    minimum,
    maximum,
    yMaximum,
    ticks,
    x: (position) => plot.left + ((position - minimum) / span) * (width - plot.left - plot.right),
    y: (rate) => height - plot.bottom - (rate / yMaximum) * (height - plot.top - plot.bottom),
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
  for (const point of model.points) {
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
