import { formatAfr } from './afr-format.ts';
import type { AfrTimelineData, AfrTimelineModel } from './afr-timeline-data.ts';
import {
  chartGeometry,
  plot,
  pointRate,
  quarterLabel,
  quarterOrdinal,
  relativeLabel,
  seriesPath,
  seriesStyle,
  initialTimelineSelection,
} from './afr-timeline-chart.ts';
import type { AfrMetric, AfrTimeMode } from './afr-timeline-chart.ts';
import type { MatrixModel } from './matrix-data.ts';
import { matrixModelLabel } from './matrix-data.ts';
import { captureControlFocus, restoreControlFocus } from './matrix-focus.ts';
import { patchContent } from './matrix-render.ts';
import { bindModelSelector, escapeHtml as esc, renderModelSelector } from './model-selector.ts';
import type { CatalogueSnapshot } from './presentation-data.ts';
import { PresentationLoader, presentationCatalogue } from './presentation-loader.ts';
import { updatePublishedNavigation } from './published-navigation.ts';
import './matrix-selection.css';
import './afr-timeline.css';

const selectorModels = (data: AfrTimelineData): MatrixModel[] =>
  data.models.map((model) => ({ ...model, cells: [], anchor: model.firstQuarter }));
const number = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US');
const rate = (value: number | null) => (value === null ? 'Unavailable' : `${formatAfr(value)}%`);

export async function initAfrTimeline(routeSignal?: AbortSignal): Promise<void> {
  routeSignal?.throwIfAborted();
  const app = document.querySelector<HTMLDivElement>('#route-content')!;
  document.title = 'Drive Stats — AFR trends';
  app.innerHTML =
    '<main class="afr-page"><h1>AFR trends</h1><p role="status">Loading recorded HDD history…</p></main>';
  const params = new URLSearchParams(location.search);
  let mode: AfrTimeMode = params.get('time') === 'calendar' ? 'calendar' : 'relative';
  let metric: AfrMetric = params.get('metric') === 'quarterly' ? 'quarterly' : 'cumulative';
  let data: AfrTimelineData;
  let choices: CatalogueSnapshot[];
  let reader: PresentationLoader;
  let models: MatrixModel[] = [];
  let selected = new Set<string>();
  let search = '';
  let inspected = '';
  let pointIndex = 0;
  let pending = '';
  let error = '';
  let showTable = false;
  let switchController: AbortController | undefined;
  let request = 0;
  let userSelected = false;
  let chartWidth = Math.max(280, Math.min(1000, app.clientWidth - (innerWidth > 1050 ? 430 : 44)));
  let currentGeometry = chartGeometry([], mode, metric, '2000-Q1', chartWidth);
  const resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (width && Math.abs(chartWidth - Math.min(1000, width)) > 2) {
      chartWidth = Math.min(1000, width);
      render();
    }
  });
  routeSignal?.addEventListener('abort', () => resizeObserver.disconnect(), { once: true });
  routeSignal?.addEventListener('abort', () => switchController?.abort(), { once: true });

  function visible(): AfrTimelineModel[] {
    return data.models.filter((model) => selected.has(model.id));
  }
  function active(): AfrTimelineModel | undefined {
    return visible().find((model) => model.id === inspected);
  }
  function reconcileInspection() {
    if (!visible().some((model) => model.id === inspected)) {
      inspected = visible()[0]?.id ?? '';
    }
    pointIndex = Math.max(0, Math.min(pointIndex, (active()?.points.length ?? 1) - 1));
  }
  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('view', 'afr');
    url.searchParams.set('snapshot', data.snapshotId);
    url.searchParams.set('time', mode);
    url.searchParams.set('metric', metric);
    history.replaceState(null, '', url);
    updatePublishedNavigation({ snapshotId: data.snapshotId });
  }
  function readout(): string {
    const model = active();
    const point = model?.points[pointIndex];
    if (!model || !point) {
      return '<p>Select a model to inspect its recorded values.</p>';
    }
    return `<h3>${esc(matrixModelLabel({ ...model, cells: [], anchor: model.firstQuarter }))}</h3><p><strong>${esc(point.quarter.replace('-Q', ' Q'))} · ${relativeLabel(point.relativeQuarter)}</strong></p><dl><div><dt>${metric === 'cumulative' ? 'Observed-history' : 'Quarterly'} AFR</dt><dd>${rate(pointRate(point, metric))}</dd></div><div><dt>Observed drives</dt><dd>${number(point.count)}</dd></div><div><dt>Quarter failures</dt><dd>${number(point.failures)}</dd></div><div><dt>Quarter drive-days</dt><dd>${number(point.driveDays)}</dd></div><div><dt>Quarter coverage</dt><dd>${esc(point.coverage)}</dd></div><div><dt>Cumulative source coverage</dt><dd>${point.historyComplete ? 'Complete' : 'Incomplete'}</dd></div></dl>${pointRate(point, metric) === null ? '<p>AFR is unavailable for incomplete coverage or zero recorded exposure. The line breaks here.</p>' : ''}`;
  }
  function valuesTable(): string {
    const model = active();
    if (!model || !showTable) {
      return '';
    }
    return `<div class="afr-table-scroll"><table><caption>Recorded values for ${esc(model.name)} · ${metric === 'cumulative' ? 'observed-history' : 'quarterly'} AFR</caption><thead><tr><th scope="col">Quarter</th><th scope="col">Relative</th><th scope="col">AFR</th><th scope="col">Count</th><th scope="col">Failures</th><th scope="col">Drive-days</th><th scope="col">Coverage</th><th scope="col">History</th></tr></thead><tbody>${model.points.map((point) => `<tr><th scope="row">${esc(point.quarter)}</th><td>${relativeLabel(point.relativeQuarter)}</td><td>${rate(pointRate(point, metric))}</td><td>${number(point.count)}</td><td>${number(point.failures)}</td><td>${number(point.driveDays)}</td><td>${esc(point.coverage)}</td><td>${point.historyComplete ? 'Complete' : 'Incomplete'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function refreshInspection() {
    if (routeSignal?.aborted) {
      return;
    }
    patchContent(app.querySelector('#afr-readout')!, readout());
    patchContent(app.querySelector('#afr-table')!, valuesTable());
    const modelSelect = app.querySelector<HTMLSelectElement>('#afr-inspect-model')!;
    modelSelect.value = inspected;
    const slider = app.querySelector<HTMLInputElement>('#afr-point')!;
    slider.max = String(Math.max(0, (active()?.points.length ?? 1) - 1));
    slider.value = String(pointIndex);
    const point = active()?.points[pointIndex];
    slider.setAttribute(
      'aria-valuetext',
      point
        ? `${point.quarter}, ${relativeLabel(point.relativeQuarter)}, ${rate(pointRate(point, metric))}`
        : 'No values',
    );
    app.querySelectorAll<SVGPathElement>('[data-series]').forEach((path) => {
      path.classList.toggle('afr-active', path.dataset.series === inspected);
    });
    app.querySelectorAll<HTMLButtonElement>('[data-inspect]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.inspect === inspected));
    });
    const geometry = currentGeometry;
    const value = point ? pointRate(point, metric) : null;
    const dot = app.querySelector<SVGCircleElement>('#afr-current-point');
    if (dot) {
      dot.setAttribute('visibility', point && value !== null ? 'visible' : 'hidden');
      if (point && value !== null) {
        dot.setAttribute(
          'cx',
          String(
            geometry.x(mode === 'relative' ? point.relativeQuarter : quarterOrdinal(point.quarter)),
          ),
        );
        dot.setAttribute('cy', String(geometry.y(value)));
      }
    }
  }
  function chart(): string {
    const showing = visible();
    const geometry = chartGeometry(showing, mode, metric, data.asOfQuarter, chartWidth);
    currentGeometry = geometry;
    if (!showing.length) {
      return '<div id="afr-chart" class="afr-empty"><h2>No models selected</h2><p>Choose models at the left, or use Select all.</p></div>';
    }
    const ticks = Array.from({ length: 5 }, (_, index) => (geometry.yMaximum * index) / 4);
    const noRates = !showing.some((model) =>
      model.points.some((point) => pointRate(point, metric) !== null),
    );
    return `${noRates ? '<p class="afr-unavailable" role="status">Selected models have no complete quarter with positive recorded exposure in this snapshot. Inspect their recorded coverage below, or choose other models.</p>' : ''}<div class="afr-legend" aria-label="Selected model lines">${showing
      .map((model) => {
        const style = seriesStyle(model.id);
        return `<button type="button" id="afr-legend-${esc(encodeURIComponent(model.id))}" data-inspect="${esc(model.id)}"><svg width="36" height="12" viewBox="0 0 36 12" aria-hidden="true"><path d="M0,6H36" stroke="${style.color}" stroke-width="3" stroke-dasharray="${style.dash}"/></svg><span>${esc(model.name)}</span></button>`;
      })
      .join(
        '',
      )}</div><svg id="afr-chart" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-labelledby="afr-chart-title afr-chart-description"><title id="afr-chart-title">${metric === 'cumulative' ? 'Observed-history' : 'Quarterly'} AFR by ${mode === 'relative' ? 'quarter since first recorded appearance' : 'calendar quarter'}</title><desc id="afr-chart-description">${showing.length} selected model lines. Missing or incomplete quarters break lines. Focus a line or choose an inspection model, then use the quarter slider to read every value.</desc>${ticks.map((value) => `<g class="afr-axis"><line x1="${plot.left}" x2="${geometry.width - plot.right}" y1="${geometry.y(value)}" y2="${geometry.y(value)}"/><text x="${plot.left - 10}" y="${geometry.y(value) + 4}" text-anchor="end">${esc(value >= 1000000 ? value.toExponential(1) : value >= 100 ? number(Math.round(value)) : Number(value.toFixed(2)))}%</text></g>`).join('')}${[1, 2].map((value) => `<g class="afr-guide"><line x1="${plot.left}" x2="${geometry.width - plot.right}" y1="${geometry.y(value)}" y2="${geometry.y(value)}"/><title>${value}% guide</title></g>`).join('')}${geometry.ticks.map((position) => `<g class="afr-axis"><line x1="${geometry.x(position)}" x2="${geometry.x(position)}" y1="${geometry.height - plot.bottom}" y2="${geometry.height - plot.bottom + 6}"/><text x="${geometry.x(position)}" y="${geometry.height - plot.bottom + 24}" text-anchor="middle">${mode === 'relative' ? relativeLabel(position) : quarterLabel(position)}</text></g>`).join('')}<text class="afr-axis-label" x="${geometry.width / 2}" y="${geometry.height - 14}" text-anchor="middle">${mode === 'relative' ? 'Quarters since first recorded appearance' : 'Calendar quarter'}</text>${showing
      .map((model) => {
        const style = seriesStyle(model.id);
        return `<path id="afr-series-${esc(encodeURIComponent(model.id))}" class="afr-series" data-series="${esc(model.id)}" tabindex="0" role="button" aria-label="Inspect ${esc(model.name)}" d="${seriesPath(model, geometry, mode, metric)}" stroke="${style.color}" stroke-dasharray="${style.dash}"><title>${esc(model.vendor)} · ${esc(model.name)}</title></path>`;
      })
      .join(
        '',
      )}<circle id="afr-current-point" class="afr-current-point" r="5" visibility="hidden"/></svg>`;
  }
  function render() {
    if (routeSignal?.aborted) {
      return;
    }
    reconcileInspection();
    const focus = captureControlFocus(document.activeElement as HTMLElement | null);
    const showing = visible();
    patchContent(
      app,
      `<main id="main" class="afr-page"><header class="afr-heading"><div><p class="eyebrow">RECORDED HDD HISTORY</p><h1>AFR trends</h1><p>Compare how annualized failure rates change through recorded deployment history.</p></div><label>As-of evidence<select id="afr-snapshot">${choices
        .toSorted((a, b) => b.asOfQuarter.localeCompare(a.asOfQuarter))
        .map(
          (choice) =>
            `<option value="${esc(choice.snapshotId)}" ${choice.snapshotId === (pending || data.snapshotId) ? 'selected' : ''} ${choice.timeline ? '' : 'disabled'}>${esc(choice.asOfQuarter.replace('-Q', ' Q'))}${choice.timeline ? '' : ' · unavailable'}</option>`,
        )
        .join('')}</select></label></header>
      <div class="afr-controls"><label>Rate<select id="afr-metric"><option value="cumulative" ${metric === 'cumulative' ? 'selected' : ''}>Observed-history cumulative AFR</option><option value="quarterly" ${metric === 'quarterly' ? 'selected' : ''}>Quarterly AFR</option></select></label><label>Time alignment<select id="afr-time"><option value="relative" ${mode === 'relative' ? 'selected' : ''}>Since first recorded appearance</option><option value="calendar" ${mode === 'calendar' ? 'selected' : ''}>Calendar quarters</option></select></label><p class="afr-method-note">Models with at least 2,000 observed drives in a quarter; all recorded quarters shown. Starts with the three most-deployed models; choose any models to compare.</p></div>
      ${pending ? '<p role="status">Loading selected evidence… Previous validated chart remains visible.</p>' : ''}${error ? `<p role="alert">${esc(error)}</p>` : ''}
      <div class="afr-workspace">${renderModelSelector(models, selected, search, 'afr-chart', 'chart')}<section class="afr-chart-area" aria-label="AFR comparison">${chart()}<p class="afr-chart-note">Gaps mean unavailable AFR. The 1% and 2% guides are context, not predictions.</p><div class="afr-inspection-controls"><label>Inspect model<select id="afr-inspect-model" ${showing.length ? '' : 'disabled'}>${showing.map((model) => `<option value="${esc(model.id)}" ${model.id === inspected ? 'selected' : ''}>${esc(model.name)} · ${esc(model.vendor)}</option>`).join('')}</select></label><label>Inspect quarter<input id="afr-point" type="range" min="0" max="${Math.max(0, (active()?.points.length ?? 1) - 1)}" value="${pointIndex}" step="1" ${active()?.points.length ? '' : 'disabled'}></label></div><p class="afr-keyboard-help">Focus a line to identify it. Use the quarter slider with arrow keys, Home or End to inspect its values.</p><section id="afr-readout" class="afr-readout" aria-live="polite" aria-atomic="true">${readout()}</section><details id="afr-values" ${showTable ? 'open' : ''}><summary>Values for inspected model</summary><div id="afr-table">${valuesTable()}</div></details><button id="afr-download" type="button" ${showing.length ? '' : 'disabled'}>Download selected data (CSV)</button></section></div>
      <footer class="afr-method"><h2>Reading these rates</h2><p>First recorded appearance is not the age of individual drives. Observed-history cumulative AFR uses recorded failures ÷ recorded drive-days × 36500; it is not lifetime AFR. Quarterly AFR uses that quarter's recorded components. Incomplete, missing, unpublished and zero-exposure quarters break lines. Later cumulative values include earlier recorded exposure, even when earlier coverage is incomplete.</p><p>Early quarters below 2,000 drives remain visible. Models end at their last recorded quarter. Rate calculation version: ${esc(data.rateVersion)}. Data: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a>.</p></footer></main>`,
    );
    bindModelSelector(
      app,
      models,
      selected,
      (value) => {
        search = value;
        render();
      },
      (next) => {
        selected = next;
        userSelected = true;
        render();
      },
    );
    app.querySelector<HTMLSelectElement>('#afr-snapshot')!.onchange = (event) => {
      void changeSnapshot((event.target as HTMLSelectElement).value);
    };
    app.querySelector<HTMLSelectElement>('#afr-time')!.onchange = (event) => {
      mode = (event.target as HTMLSelectElement).value as AfrTimeMode;
      updateUrl();
      render();
    };
    app.querySelector<HTMLSelectElement>('#afr-metric')!.onchange = (event) => {
      metric = (event.target as HTMLSelectElement).value as AfrMetric;
      updateUrl();
      render();
    };
    app.querySelector<HTMLSelectElement>('#afr-inspect-model')!.onchange = (event) => {
      inspected = (event.target as HTMLSelectElement).value;
      reconcileInspection();
      refreshInspection();
    };
    app.querySelector<HTMLInputElement>('#afr-point')!.oninput = (event) => {
      pointIndex = Number((event.target as HTMLInputElement).value);
      refreshInspection();
    };
    app.querySelector<HTMLDetailsElement>('#afr-values')!.ontoggle = (event) => {
      showTable = (event.target as HTMLDetailsElement).open;
      patchContent(app.querySelector('#afr-table')!, valuesTable());
    };
    app.querySelector<HTMLButtonElement>('#afr-download')!.onclick = download;
    app.querySelectorAll<HTMLButtonElement>('[data-inspect]').forEach((button) => {
      button.onclick = button.onfocus = () => {
        inspected = button.dataset.inspect!;
        reconcileInspection();
        refreshInspection();
      };
    });
    app.querySelectorAll<SVGPathElement>('[data-series]').forEach((path) => {
      const inspect = () => {
        inspected = path.dataset.series!;
        reconcileInspection();
        refreshInspection();
      };
      path.onfocus = inspect;
      path.onpointerenter = inspect;
      path.onclick = inspect;
      path.onkeydown = (event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          inspect();
          const end = Math.max(0, (active()?.points.length ?? 1) - 1);
          pointIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? end
                : Math.max(
                    0,
                    Math.min(
                      end,
                      pointIndex +
                        (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0),
                    ),
                  );
          refreshInspection();
        }
      };
      path.onpointermove = (event) => {
        inspect();
        const model = active();
        const svg = app.querySelector<SVGSVGElement>('#afr-chart')!;
        const bounds = svg.getBoundingClientRect();
        const geometry = currentGeometry;
        const target = ((event.clientX - bounds.left) / bounds.width) * geometry.width;
        let distance = Infinity;
        model?.points.forEach((point, index) => {
          const candidate = Math.abs(
            geometry.x(
              mode === 'relative' ? point.relativeQuarter : quarterOrdinal(point.quarter),
            ) - target,
          );
          if (candidate < distance) {
            distance = candidate;
            pointIndex = index;
          }
        });
        refreshInspection();
      };
    });
    refreshInspection();
    resizeObserver.observe(app.querySelector<HTMLElement>('.afr-chart-area')!);
    restoreControlFocus(focus, (id) => document.getElementById(id));
  }
  function download() {
    const rows: (string | number | null | boolean)[][] = [
      [
        'model',
        'vendor',
        'quarter',
        'relativeQuarter',
        'cumulativeAfrPercent',
        'quarterlyAfrPercent',
        'count',
        'failures',
        'driveDays',
        'coverage',
        'historyComplete',
      ],
    ];
    for (const model of visible()) {
      for (const point of model.points) {
        rows.push([
          model.name,
          model.vendor,
          point.quarter,
          point.relativeQuarter,
          point.cumulativeAfr,
          point.quarterlyAfr,
          point.count,
          point.failures,
          point.driveDays,
          point.coverage,
          point.historyComplete,
        ]);
      }
    }
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `afr-${data.asOfQuarter}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function changeSnapshot(id: string) {
    const current = ++request;
    switchController?.abort();
    switchController = new AbortController();
    const signal = routeSignal
      ? AbortSignal.any([routeSignal, switchController.signal])
      : switchController.signal;
    pending = id;
    error = '';
    render();
    try {
      const selection = reader.selection(new URLSearchParams({ view: 'afr', snapshot: id }));
      if (!selection) {
        throw new Error('AFR trends are unavailable for this snapshot.');
      }
      const capsule = await reader.load(selection, signal);
      if (signal.aborted || current !== request) {
        return;
      }
      if (capsule.kind !== 'timeline') {
        throw new Error('Invalid AFR trends presentation.');
      }
      data = capsule.body;
      models = selectorModels(data);
      selected = userSelected
        ? new Set([...selected].filter((modelId) => models.some((model) => model.id === modelId)))
        : initialTimelineSelection(data.models, data.asOfQuarter);
      pending = '';
      updateUrl();
      render();
    } catch (cause) {
      if (signal.aborted || current !== request) {
        return;
      }
      pending = '';
      error = `Snapshot switch failed. Still showing ${data.asOfQuarter.replace('-Q', ' Q')}. ${cause instanceof Error ? cause.message : String(cause)}`;
      render();
    }
  }
  try {
    const catalogue = await presentationCatalogue(routeSignal);
    routeSignal?.throwIfAborted();
    reader = new PresentationLoader(catalogue);
    choices = catalogue.snapshots;
    const selection = reader.selection(
      new URLSearchParams({
        view: 'afr',
        snapshot: params.get('snapshot') ?? catalogue.latestSnapshotId,
      }),
    );
    if (!selection) {
      throw new Error(
        'AFR trends are unavailable for this snapshot. Choose a snapshot with published timeline evidence.',
      );
    }
    const capsule = await reader.load(selection, routeSignal);
    routeSignal?.throwIfAborted();
    if (capsule.kind !== 'timeline') {
      throw new Error('Invalid AFR trends presentation.');
    }
    data = capsule.body;
    models = selectorModels(data);
    selected = initialTimelineSelection(data.models, data.asOfQuarter);
    pointIndex =
      Math.max(0, data.models.find((model) => selected.has(model.id))?.points.length ?? 1) - 1;
    updateUrl();
    render();
  } catch (cause) {
    if (routeSignal?.aborted) {
      throw cause;
    }
    app.innerHTML = `<main class="afr-page"><h1>AFR trends unavailable</h1><p role="alert">${esc(cause instanceof Error ? cause.message : cause)}</p><a href="?view=afr">Try latest snapshot</a> · <a href="?view=matrix">Open the AFR matrix</a></main>`;
  }
}
