/** Reserve a real monospace sign column without announcing a positive sign. */
export function deltaDisplay(value: number) {
  const text = value.toFixed(3);
  return { text, reserveSign: !text.startsWith('-') };
}
import { formatMetric, metrics } from './matrix-data.ts';
import type { MatrixSnapshot, Metric } from './matrix-data.ts';

/** Widths use every model in the snapshot, so model selection never shifts digits. */
export function metricFieldWidths(snapshot: MatrixSnapshot): Record<Metric, number> {
  const widths = Object.fromEntries(metrics.map((metric) => [metric, 1])) as Record<Metric, number>;
  for (const model of snapshot.models) {
    for (const cell of model.cells) {
      for (const metric of metrics) {
        const value = cell.metrics[metric],
          text = formatMetric(value, metric);
        const length =
          text.length +
          Number(metric === 'afrDelta' && value !== null && deltaDisplay(value).reserveSign);
        widths[metric] = Math.max(widths[metric], length);
      }
    }
  }
  return widths;
}

/** Each year is a semantic row group, including the final partial year. */
export function yearRowGroups(extent: number) {
  return Array.from({ length: Math.ceil(extent / 4) }, (_, index) => ({
    year: index + 1,
    quarters: Array.from(
      { length: Math.min(4, extent - index * 4) },
      (_, quarter) => index * 4 + quarter + 1,
    ),
  }));
}
