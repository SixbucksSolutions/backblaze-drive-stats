import { vendorPaint } from './matrix-brand.ts';
import type { Aggregate, Manufacturer } from './production-data.ts';
import type { DisplayRow } from './snapshot-selection.ts';

export type ManufacturerSort = { key: keyof Manufacturer; descending: boolean };
export const manufacturerChartLimit = 8;

/** Filters narrow numerators only; each denominator is the whole selected-HDD metric. */
export function manufacturerRows(
  rows: readonly DisplayRow[],
  whole: Aggregate,
  complete: boolean,
): Manufacturer[] {
  const grouped = new Map<string, DisplayRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.vendor) ?? [];
    group.push(row);
    grouped.set(row.vendor, group);
  }
  const share = (value: number | null, denominator: number | null) =>
    complete && value !== null && denominator !== null && denominator > 0
      ? value / denominator
      : null;
  return [...grouped].map(([vendor, models]) => {
    const sum = (metric: keyof Aggregate) =>
      !complete || models.some((model) => model[metric] === null)
        ? null
        : models.reduce((total, model) => total + (model[metric] ?? 0), 0);
    const count = sum('count');
    const additions = sum('new');
    const capacityTB = sum('capacityTB');
    return {
      vendor,
      count,
      new: additions,
      capacityTB,
      populationShare: share(count, whole.count),
      newShare: share(additions, whole.new),
      capacityShare: share(capacityTB, whole.capacityTB),
    };
  });
}

export function sortManufacturers(
  rows: readonly Manufacturer[],
  key: keyof Manufacturer = 'capacityTB',
  descending = true,
): Manufacturer[] {
  return [...rows].sort((a, b) => {
    const av = a[key],
      bv = b[key];
    if (av === null || bv === null) {
      return av === bv ? a.vendor.localeCompare(b.vendor) : av === null ? 1 : -1;
    }
    const order =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : Number(av) - Number(bv);
    return order * (descending ? -1 : 1) || a.vendor.localeCompare(b.vendor);
  });
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: 12 });
const percent = (value: number | null) =>
  value === null
    ? 'Unavailable'
    : `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
const columns: readonly [keyof Manufacturer, string][] = [
  ['vendor', 'Manufacturer'],
  ['count', 'Count'],
  ['new', 'New (first recorded)'],
  ['capacityTB', 'Raw capacity (TB)'],
  ['populationShare', 'Population share'],
  ['newShare', 'First recorded share'],
  ['capacityShare', 'Capacity share'],
];

/** The chart is a preview; the accessible sortable table retains every filtered vendor. */
export function renderManufacturers(
  rows: readonly DisplayRow[],
  whole: Aggregate,
  complete: boolean,
  sort: ManufacturerSort = { key: 'capacityTB', descending: true },
): string {
  const manufacturers = manufacturerRows(rows, whole, complete);
  const measured = sortManufacturers(manufacturers).filter((row) => row.capacityTB !== null);
  const chartRows = measured.slice(0, manufacturerChartLimit);
  const maximum = Math.max(0, ...chartRows.map((row) => row.capacityTB ?? 0));
  const chart = !complete
    ? '<p>Manufacturer observations are unavailable for this coverage. Missing observations are not zero.</p>'
    : rows.length === 0
      ? '<p>No models match the current filters.</p>'
      : !chartRows.length
        ? '<p>Raw capacity is unavailable for the selected manufacturers. Known Count and New values remain in the table.</p>'
        : `<div class="report-bars">${chartRows.map((row) => `<div class="report-bar"><span class="bar-label">${escape(row.vendor)}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${maximum > 0 ? (row.capacityTB! / maximum) * 100 : 0}%;background:${vendorPaint(row.vendor).background}"></div></div><span class="bar-value">${number(row.capacityTB)} TB</span></div>`).join('')}</div><p class="chart-caption">Showing ${chartRows.length} of ${measured.length} manufacturers with available capacity, ranked by raw capacity. ${manufacturers.length - measured.length} manufacturers have unavailable capacity. Every filtered manufacturer remains in the table and CSV; no Other category is introduced. Chart limits do not change totals.</p>`;
  return `<section class="report-chart" aria-label="Manufacturer raw capacity"><h2>Raw capacity by manufacturer</h2>${chart}</section>
    <section class="report-reading"><h2>Reading manufacturer shares</h2><p>Filtered manufacturer numerators use only the displayed model selection. Each share uses its own unfiltered whole selected-HDD context denominator for this quarter: population ${complete ? number(whole.count) : 'Unavailable'} drives; first recorded ${complete ? number(whole.new) : 'Unavailable'} drives; raw capacity ${complete ? number(whole.capacityTB) : 'Unavailable'} TB. Filters never redefine these denominators. Filtered shares need not sum to 100%. Zero or unavailable denominators give unavailable shares.</p><p>Count is distinct identities observed anywhere in the quarter, not quarter-end stock. New means first recorded in supplied history, including the initial observed fleet; publication boundaries and source gaps prevent inferring physical installation dates. Raw capacity uses decimal TB (10¹² bytes), not usable storage. Supporting context retains seeded, historical, subthreshold and evidenced new-vendor HDD models. These are shares of this selected HDD context, not market share or a complete physical-fleet census.</p></section>
    <div class="table-scroll"><table><caption>All filtered manufacturers · selected HDD context</caption><thead><tr>${columns.map(([key, label]) => `<th scope="col" aria-sort="${sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}"><button type="button" data-manufacturer-sort="${key}">${label}${sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}</button></th>`).join('')}</tr></thead><tbody>${sortManufacturers(
      manufacturers,
      sort.key,
      sort.descending,
    )
      .map(
        (row) =>
          `<tr><th scope="row">${escape(row.vendor)}</th><td>${number(row.count)}</td><td>${number(row.new)}</td><td>${number(row.capacityTB)}</td><td>${percent(row.populationShare)}</td><td>${percent(row.newShare)}</td><td>${percent(row.capacityShare)}</td></tr>`,
      )
      .join(
        '',
      )}</tbody></table>${!rows.length ? '<p role="status">No models match the current filters.</p>' : ''}</div>`;
}

/** Raw numeric fractions and TB are exported without presentation rounding. */
export function manufacturerCsvRows(
  rows: readonly DisplayRow[],
  whole: Aggregate,
  complete: boolean,
  sort: ManufacturerSort = { key: 'capacityTB', descending: true },
): (string | number)[][] {
  return [
    [
      'Manufacturer',
      'Count',
      'New (first recorded)',
      'Raw capacity TB',
      'Population share (fraction of whole selected HDD)',
      'First recorded share (fraction of whole selected HDD)',
      'Capacity share (fraction of whole selected HDD)',
      'Whole selected HDD Count',
      'Whole selected HDD New',
      'Whole selected HDD capacity TB',
    ],
    ...sortManufacturers(manufacturerRows(rows, whole, complete), sort.key, sort.descending).map(
      (row) => [
        row.vendor,
        row.count ?? 'Unavailable',
        row.new ?? 'Unavailable',
        row.capacityTB ?? 'Unavailable',
        row.populationShare ?? 'Unavailable',
        row.newShare ?? 'Unavailable',
        row.capacityShare ?? 'Unavailable',
        complete ? (whole.count ?? 'Unavailable') : 'Unavailable',
        complete ? (whole.new ?? 'Unavailable') : 'Unavailable',
        complete ? (whole.capacityTB ?? 'Unavailable') : 'Unavailable',
      ],
    ),
  ];
}
