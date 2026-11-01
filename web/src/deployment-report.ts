import type { DisplayRow } from './snapshot-selection.ts';

export const deploymentChartLimit = 8;

/** The chart is a preview; no display threshold changes the filtered total. */
export function deploymentSummary(rows: readonly DisplayRow[], complete: boolean) {
  const measured = complete ? rows.filter((row) => row.new !== null) : [];
  const ranked = [...measured].sort(
    (a, b) => (b.new ?? 0) - (a.new ?? 0) || a.modelId.localeCompare(b.modelId),
  );
  return {
    total:
      complete && measured.length === rows.length
        ? measured.reduce((total, row) => total + (row.new ?? 0), 0)
        : null,
    chartRows: ranked.slice(0, deploymentChartLimit),
    measuredModels: measured.length,
    unavailableModels: rows.length - measured.length,
  };
}

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
const number = (value: number) => value.toLocaleString('en-US');

/** Render only the report: shared controls, complete table and CSV belong to Explore. */
export function renderDeployments(rows: readonly DisplayRow[], complete: boolean): string {
  const summary = deploymentSummary(rows, complete);
  const maximum = Math.max(0, ...summary.chartRows.map((row) => row.new ?? 0));
  const chart = !complete
    ? '<p>First recorded additions are unavailable for this coverage. Missing observations are not zero additions.</p>'
    : rows.length === 0
      ? '<p>No models match the current filters. The empty filtered selection totals 0 first recorded additions.</p>'
      : summary.measuredModels === 0
        ? '<p>First recorded additions are unavailable for the selected models.</p>'
        : `<p><strong>${summary.total === null ? 'Unavailable' : number(summary.total)}</strong> first recorded additions across the filtered selection.${summary.total === 0 ? ' No first recorded additions were observed for these models in this complete quarter.' : ''}</p>
          <div class="report-bars">${summary.chartRows
            .map(
              (row) => `<div class="report-bar">
                <span class="bar-label" title="${escape(`${row.vendor} · ${row.modelNumber}`)}">${escape(`${row.vendor} · ${row.modelNumber}`)}</span>
                <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${maximum > 0 ? ((row.new ?? 0) / maximum) * 100 : 0}%;background:var(--green)"></div></div>
                <span class="bar-value">${number(row.new ?? 0)}</span>
              </div>`,
            )
            .join('')}</div>
          <p class="chart-caption">Showing ${summary.chartRows.length} of ${summary.measuredModels} models with available additions, ranked by first recorded additions. ${summary.unavailableModels > 0 ? `${summary.unavailableModels} models have unavailable additions; their values are not counted as zero. ` : ''}The full filtered results, including zero and unavailable values, are in the sortable table and CSV below. The chart limit does not change totals.</p>`;
  return `<section class="report-chart" aria-label="First recorded additions"><h2>First recorded additions by model</h2>${chart}</section>
    <section class="report-reading" aria-label="Reading model deployments"><h2>Reading this report</h2>
      <p>First recorded additions count drive identities first observed in the supplied history during this calendar quarter. They include the initial observed fleet. Backblaze's published observations begin on 10 April 2013; existing drives at the history start are left-censored, so their earlier installation dates are unknown. Source gaps can also delay a first recorded observation.</p>
      <p>These observations do not establish physical installation dates, procurement motives or purchase recommendations. Supporting HDD context includes seeded, historical and subthreshold models as well as evidenced new vendors; vendor and model filters explicitly narrow the displayed results. Last-observed and Retired measures are unavailable in this supporting payload and are not inferred from population changes.</p>
    </section>`;
}
