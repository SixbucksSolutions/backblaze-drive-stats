import type { DisplayRow } from './snapshot-selection.ts';

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export type DistributionSummary = {
  count: number | null;
  modelCount: number;
  topModels: DisplayRow[];
  vendors: { vendor: string; count: number | null }[];
};

/** Counts are distinct model/identity observations, already aggregated by the producer. */
export function distributionSummary(
  rows: readonly DisplayRow[],
  complete: boolean,
): DistributionSummary {
  const total = (group: readonly DisplayRow[]) =>
    !complete || group.some((row) => row.count === null)
      ? null
      : group.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const vendors = new Map<string, DisplayRow[]>();
  for (const row of rows) {
    const group = vendors.get(row.vendor) ?? [];
    group.push(row);
    vendors.set(row.vendor, group);
  }
  return {
    count: total(rows),
    modelCount: rows.length,
    topModels: [...rows]
      .sort((a, b) => {
        if (a.count === null || b.count === null) {
          return a.count === b.count
            ? a.modelId.localeCompare(b.modelId)
            : a.count === null
              ? 1
              : -1;
        }
        return b.count - a.count || a.modelId.localeCompare(b.modelId);
      })
      .slice(0, 8),
    vendors: [...vendors]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([vendor, group]) => ({ vendor, count: total(group) })),
  };
}

/** Parent supplies the same filtered rows to the complete table and CSV export. */
export function renderDistribution(rows: readonly DisplayRow[], complete: boolean): string {
  const summary = distributionSummary(rows, complete);
  const reading =
    'Distinct drives observed anywhere in the calendar quarter; this is not quarter-end installed stock. Seeded, smaller-population and historical HDDs stay in the context, independently of AFR matrix eligibility.';
  let content: string;
  if (!complete) {
    content =
      '<p class="report-reading" role="status">Full-quarter observed population is unavailable because source coverage is incomplete. Unknown population is not zero.</p>';
  } else if (!rows.length) {
    content =
      '<p class="report-reading" role="status">No models match the current filters. Clear filters to restore the whole HDD context.</p>';
  } else {
    const maximum = Math.max(1, ...summary.topModels.map((row) => row.count ?? 0));
    content = `<p class="report-reading">${summary.count === null ? 'Filtered observed population: Unavailable; at least one model count is unknown.' : `${integer.format(summary.count)} observed drives across ${integer.format(summary.modelCount)} filtered models.`} Showing the largest ${summary.topModels.length} of ${summary.modelCount} filtered models by observed population. The table below and CSV include all ${summary.modelCount} filtered models, including measured zeros and unavailable values.</p><ol class="report-bars">${summary.topModels
      .map((row) => {
        const label = `${row.modelNumber} — ${row.vendor}`;
        const count = row.count === null ? 'Unavailable' : integer.format(row.count);
        return `<li class="report-bar"><span class="report-bar-label">${escape(row.modelNumber)} <small>${escape(row.vendor)}</small></span>${row.count === null ? '<span class="report-bar-unavailable">Unavailable</span>' : `<meter min="0" max="${maximum}" value="${row.count}" aria-label="${escape(label)}: ${count} observed drives">${count}</meter>`}<strong>${count}</strong></li>`;
      })
      .join('')}</ol>`;
  }
  return `<section class="panel report-chart" aria-labelledby="distribution-title"><div class="panel-header"><div><p class="eyebrow">CALENDAR-QUARTER DRIVE MIX</p><h2 id="distribution-title">Observed population by model</h2></div></div><p class="report-reading">${reading}</p>${content}</section>`;
}
