import type { Aggregate, Coverage, Datacenters } from './production-data.ts';

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: 6 });
const percent = (value: number | null) =>
  value === null ? 'Unavailable' : `${number(value * 100)}%`;
const share = (value: number | null, total: number | null) =>
  value === null || total === null || total <= 0 ? null : value / total;

/** The validated payload already assigns movers once, at their last observed location. */
export function datacenterSummary(
  data: Datacenters | null,
  totals: Aggregate | null,
  coverage: Coverage,
) {
  const complete = coverage.status === 'complete' && data !== null && totals !== null;
  const count = complete ? totals.count : null;
  const capacityTB = complete ? totals.capacityTB : null;
  return {
    count,
    capacityTB,
    fieldAvailable: coverage.datacenterFieldAvailable && (data?.fieldAvailable ?? true),
    knownLocationPopulationShare: complete ? data.knownLocationPopulationShare : null,
    rows: (data?.locations ?? []).map((location) => {
      const locationCount = complete ? location.count : null;
      const locationCapacity = complete ? location.capacityTB : null;
      return {
        name: location.name,
        count: locationCount,
        capacityTB: locationCapacity,
        populationShare: share(locationCount, count),
        capacityShare: share(locationCapacity, capacityTB),
      };
    }),
  };
}

/** Numeric shares are fractions; unavailable values are explicit rather than zero. */
export function datacenterCsvRows(
  data: Datacenters | null,
  totals: Aggregate | null,
  coverage: Coverage,
): (string | number)[][] {
  const summary = datacenterSummary(data, totals, coverage);
  const value = (metric: number | null) => metric ?? 'Unavailable';
  return [
    [
      'Location',
      'Observed drive identities',
      'Nominal raw capacity (decimal TB)',
      'Population share (fraction)',
      'Capacity share (fraction)',
      'Known-location population coverage (fraction)',
      'Location field',
    ],
    ...summary.rows.map((row) => [
      row.name,
      value(row.count),
      value(row.capacityTB),
      value(row.populationShare),
      value(row.capacityShare),
      value(summary.knownLocationPopulationShare),
      summary.fieldAvailable ? 'Reported' : 'Unreported',
    ]),
    [
      'All supplied total',
      value(summary.count),
      value(summary.capacityTB),
      value(share(summary.count, summary.count)),
      value(share(summary.capacityTB, summary.capacityTB)),
      value(summary.knownLocationPopulationShare),
      summary.fieldAvailable ? 'Reported' : 'Unreported',
    ],
  ];
}

export function renderDatacenters(
  data: Datacenters | null,
  totals: Aggregate | null,
  coverage: Coverage,
): string {
  const summary = datacenterSummary(data, totals, coverage);
  const maximum = Math.max(1, ...summary.rows.map((row) => row.capacityTB ?? 0));
  const unavailable = coverage.status !== 'complete' || data === null || totals === null;
  const unreported =
    coverage.quarter < '2023-Q3'
      ? 'The datacenter field is unreported before 2023 Q3.'
      : 'The datacenter field is absent from the captured source for this quarter.';
  const chart = unavailable
    ? '<p>Quarter location totals are unavailable for this coverage. Missing observations are not zero capacity.</p>'
    : !summary.fieldAvailable
      ? `<p>${unreported} Capacity is allocated to Unknown; this is not zero capacity or evidence of flat growth. No location capacity bars are drawn.</p>`
      : `<ul class="report-bars">${summary.rows.map((row) => `<li class="report-bar"><span class="report-bar-label">${escape(row.name)}<small>${number(row.count)} observed drives · ${percent(row.populationShare)} of population</small></span>${row.capacityTB === null ? '<span class="report-bar-unavailable">Unavailable capacity</span>' : `<meter min="0" max="${maximum}" value="${row.capacityTB}" aria-label="${escape(row.name)}: ${number(row.capacityTB)} decimal TB"></meter>`}<strong>${number(row.capacityTB)} TB</strong></li>`).join('')}</ul>`;
  return `<section class="report-chart" aria-label="Datacenter nominal raw capacity"><h2>Nominal raw capacity by last observed location</h2><p>All supplied drive identities, including HDD, SSD and unclassified models. Unknown is included in every total and share denominator.</p><p><strong>${number(summary.capacityTB)} TB</strong> nominal raw capacity · <strong>${number(summary.count)}</strong> observed drive identities. Known-location population coverage: <strong>${percent(summary.knownLocationPopulationShare)}</strong>. This coverage measures drive population, not capacity share.</p>${chart}<p class="chart-caption">All locations and their numeric values appear in the table and CSV. Capacity bars use decimal TB; unavailable capacity does not erase a known drive count.</p></section>
    <div class="table-scroll"><table><caption>All supplied datacenter allocation — ${escape(coverage.quarter)}. Shares include Unknown.</caption><thead><tr><th scope="col">Location</th><th scope="col">Observed drives</th><th scope="col">Nominal raw capacity (TB)</th><th scope="col">Population share</th><th scope="col">Capacity share</th></tr></thead><tbody>${summary.rows.map((row) => `<tr><th scope="row">${escape(row.name)}</th><td>${number(row.count)}</td><td>${number(row.capacityTB)}</td><td>${percent(row.populationShare)}</td><td>${percent(row.capacityShare)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">All supplied total</th><td>${number(summary.count)}</td><td>${number(summary.capacityTB)}</td><td>${percent(share(summary.count, summary.count))}</td><td>${percent(share(summary.capacityTB, summary.capacityTB))}</td></tr></tfoot></table></div>
    <section class="report-reading" aria-label="Reading datacenter capacity"><h2>Reading this report</h2><p>Each normalized drive identity is assigned once per calendar quarter to its last observed location within that quarter. A move does not create a second allocation. Blank or missing locations are Unknown. The accepted aggregate supplies this assignment; the browser does not reconstruct individual drive histories.</p><p>These are identities observed during the quarter, not quarter-end installed stock. Nominal raw capacity uses the accepted identity capacity policy and decimal TB, not usable storage, customer uploads or demand. Location differences do not establish the cause of changes, regional demand or physical deployment decisions. No geographic dashboard or causal event interpretation is implied.</p><p>A positive all-Unknown population has 0% known-location population coverage; a zero or unavailable population has unavailable coverage. Partial, missing and unpublished quarters do not supply exact quarter totals. Location data is unreported before 2023 Q3 or when the captured source lacks the field, including when the Unknown count and capacity are known.</p></section>`;
}
