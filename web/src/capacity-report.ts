import type { Coverage, Scope, SupportingQuarter } from './production-data.ts';
import { SnapshotLoader } from './snapshot-loader.ts';

export type CapacityPoint = Readonly<{
  quarter: string;
  status: Coverage['status'];
  count: number | null;
  capacityTB: number | null;
  capacityDeltaTB: number | null;
  capacityDeltaReason: Scope['capacityDeltaReason'] | 'unavailable';
  reason: string;
}>;

const ordinal = (quarter: string) => Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1));

/** Reads only accepted public aggregates. Each call owns its cancellation lifecycle. */
export class CapacityHistoryReader {
  readonly #loader: SnapshotLoader;
  readonly #completed = new Map<string, readonly CapacityPoint[]>();

  constructor(loader: SnapshotLoader) {
    this.#loader = loader;
  }

  async load(snapshotId: string, signal?: AbortSignal): Promise<readonly CapacityPoint[]> {
    signal?.throwIfAborted();
    const descriptor = await this.#loader.loadSnapshot(snapshotId, signal);
    signal?.throwIfAborted();
    const key = JSON.stringify([
      descriptor.contextSha256,
      descriptor.context.sourceManifestSha256,
      descriptor.quarters,
    ]);
    const cached = this.#completed.get(key);
    if (cached) {
      return cached;
    }
    const rows = descriptor.quarters
      .filter((row) => ordinal(row.quarter) <= ordinal(descriptor.context.asOfQuarter))
      .toSorted((a, b) => ordinal(a.quarter) - ordinal(b.quarter));
    const payloads = new Map<string, SupportingQuarter>();
    let next = 0;
    let stopped = false;
    const worker = async () => {
      try {
        while (next < rows.length && !stopped) {
          signal?.throwIfAborted();
          const row = rows[next++]!;
          if (!row.payload) {
            continue;
          }
          const payload = await this.#loader.loadQuarter(descriptor, row.quarter, signal);
          signal?.throwIfAborted();
          if (!payload) {
            throw new Error('Advertised capacity quarter has no payload');
          }
          payloads.set(row.quarter, payload);
        }
      } catch (error) {
        stopped = true;
        throw error;
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
    signal?.throwIfAborted();
    const points: CapacityPoint[] = rows.map((row, index) => {
      const coverage = descriptor.context.coverage.find((item) => item.quarter === row.quarter);
      const scope = payloads.get(row.quarter)?.scopes.all_supplied;
      const previous = rows[index - 1];
      const priorScope = previous ? payloads.get(previous.quarter)?.scopes.all_supplied : undefined;
      const comparable =
        row.status === 'complete' &&
        scope?.totals.capacityTB !== null &&
        previous?.status === 'complete' &&
        ordinal(previous.quarter) === ordinal(row.quarter) - 1 &&
        priorScope?.totals.capacityTB !== null &&
        priorScope !== undefined;
      return Object.freeze({
        quarter: row.quarter,
        status: row.status,
        count: scope?.totals.count ?? null,
        capacityTB: scope?.totals.capacityTB ?? null,
        capacityDeltaTB:
          comparable && scope?.capacityDeltaReason === 'previous_complete'
            ? scope.capacityDeltaTB
            : null,
        capacityDeltaReason: scope?.capacityDeltaReason ?? 'unavailable',
        reason: coverage?.reason ?? 'Coverage metadata unavailable',
      });
    });
    const result = Object.freeze(points);
    this.#completed.set(key, result);
    return result;
  }
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: 6 });
const shortCapacity = (value: number) =>
  value >= 1_000_000
    ? `${number(value / 1_000_000)} EB`
    : value >= 1000
      ? `${number(value / 1000)} PB`
      : `${number(value)} TB`;

/** Chronological full history: the selected quarter changes emphasis only. */
export function renderCapacity(points: readonly CapacityPoint[], selectedQuarter: string): string {
  const measured = points.filter(
    (point) => point.status === 'complete' && point.capacityTB !== null,
  );
  const maximum = Math.max(0, ...measured.map((point) => point.capacityTB!));
  const first = points[0];
  const last = points.at(-1);
  const start = first ? ordinal(first.quarter) : 0;
  const span = Math.max(1, last ? ordinal(last.quarter) - start : 1);
  const x = (point: CapacityPoint) => 90 + ((ordinal(point.quarter) - start) / span) * 770;
  const y = (point: CapacityPoint) => 260 - ((point.capacityTB ?? 0) / (maximum || 1)) * 220;
  const segments: string[][] = [];
  let active: string[] | undefined;
  let previous: CapacityPoint | undefined;
  for (const point of points) {
    if (point.status !== 'complete' || point.capacityTB === null) {
      active = undefined;
      previous = undefined;
      continue;
    }
    if (!active || !previous || ordinal(point.quarter) !== ordinal(previous.quarter) + 1) {
      active = [];
      segments.push(active);
    }
    active.push(`${x(point)},${y(point)}`);
    previous = point;
  }
  const chart = measured.length
    ? `<svg class="capacity-chart" viewBox="0 0 900 330" role="img" aria-labelledby="capacity-chart-title capacity-chart-description">
      <title id="capacity-chart-title">Total nominal raw capacity over time</title>
      <desc id="capacity-chart-description">Chronological all-supplied complete-quarter capacity. Gaps and partial quarters break the line. Selected quarter: ${escape(selectedQuarter)}. Exact values and coverage reasons are in the table below.</desc>
      <line x1="90" y1="40" x2="90" y2="260" stroke="currentColor"/>
      <line x1="90" y1="260" x2="860" y2="260" stroke="currentColor"/>
      <text x="84" y="44" text-anchor="end" fill="currentColor" font-size="12">${shortCapacity(maximum)}</text>
      <text x="84" y="264" text-anchor="end" fill="currentColor" font-size="12">0 TB</text>
      <text x="90" y="290" fill="currentColor" font-size="12">${escape(first?.quarter ?? '')}</text>
      <text x="860" y="290" text-anchor="end" fill="currentColor" font-size="12">${escape(last?.quarter ?? '')}</text>
      ${segments.map((segment) => `<polyline class="capacity-segment" points="${segment.join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>`).join('')}
      ${measured.map((point) => `<circle cx="${x(point)}" cy="${y(point)}" r="${point.quarter === selectedQuarter ? 6 : 3}" fill="currentColor"${point.quarter === selectedQuarter ? ' class="selected-capacity-point"' : ''}><title>${escape(point.quarter)}: ${shortCapacity(point.capacityTB!)}${point.quarter === selectedQuarter ? ' (selected)' : ''}</title></circle>`).join('')}
      </svg>`
    : '<p>No complete-quarter capacity is available in this snapshot. Unavailable capacity is not zero.</p>';
  return `<section class="report-chart" aria-label="Total capacity history"><h2>Total nominal raw capacity over time</h2>
    <p>All supplied drive identities, including HDD, SSD and unclassified models. The full series belongs to the selected as-of snapshot; selecting a calendar quarter only highlights its row and point.</p>
    <div class="capacity-plot" tabindex="0" role="region" aria-label="Scrollable capacity chart">${chart}</div><p class="chart-caption">Decimal units: 1 PB = 1,000 TB; 1 EB = 1,000,000 TB. Missing, unpublished, partial and invalid-capacity quarters have no plotted capacity; lines never bridge them. Complete zero capacity remains a measured zero.</p></section>
    <section class="report-reading" aria-label="Reading capacity history"><h2>Reading this report</h2>
    <p>Capacity sums quarterly observed drive identities times each model's nominal capacity. The producer uses the positive finite daily-observation capacity mode through the snapshot cutoff, with ties choosing the smaller byte capacity. This is observed-quarter nominal raw capacity, not quarter-end installed stock, utilized space or customer storage.</p>
    <p>Capacity Delta is the accepted payload's change from the immediately preceding comparable complete calendar quarter. First quarters and unavailable predecessors have no delta; gaps are never bridged. Known drive counts remain visible when capacity is unavailable. No causal or event overlays are inferred.</p></section>
    <section aria-label="Capacity history table"><h2>Full chronological capacity history</h2><div class="table-scroll"><table class="report-table"><caption>All supplied identities; capacity and delta in decimal TB. Unavailable values are not zero.</caption>
    <thead><tr><th scope="col">Quarter</th><th scope="col">Coverage</th><th scope="col">Drive count</th><th scope="col">Capacity (TB)</th><th scope="col">Capacity Delta (TB)</th><th scope="col">Delta reason</th><th scope="col">Coverage reason</th></tr></thead>
    <tbody>${points.map((point) => `<tr${point.quarter === selectedQuarter ? ' aria-current="true" class="selected-capacity-row"' : ''}><th scope="row">${escape(point.quarter)}${point.quarter === selectedQuarter ? ' (selected)' : ''}</th><td>${escape(point.status)}</td><td>${number(point.count)}</td><td>${number(point.capacityTB)}</td><td>${number(point.capacityDeltaTB)}</td><td>${escape(point.capacityDeltaReason.replaceAll('_', ' '))}</td><td>${escape(point.reason)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/** The shared CSV writer adds snapshot metadata and quotes these cells. */
export function capacityCsvRows(points: readonly CapacityPoint[]): (string | number)[][] {
  return [
    [
      'Quarter',
      'Coverage',
      'Drive count',
      'Capacity (TB)',
      'Capacity Delta (TB)',
      'Delta reason',
      'Coverage reason',
    ],
    ...points.map((point) => [
      point.quarter,
      point.status,
      point.count ?? 'Unavailable',
      point.capacityTB ?? 'Unavailable',
      point.capacityDeltaTB ?? 'Unavailable',
      point.capacityDeltaReason,
      point.reason,
    ]),
  ];
}
