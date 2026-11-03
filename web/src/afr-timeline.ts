import { formatAfr } from './afr-format.ts';
import type { AfrTimelineData, AfrTimelineModel } from './afr-timeline-data.ts';
import {
  chartGeometry,
  pointTooltip,
  nearestPointIndex,
  yAxisTicks,
  createTimeBrush,
  createChartResizeScheduler,
  plot,
  pointRate,
  quarterLabel,
  quarterOrdinal,
  relativeLabel,
  seriesPath,
  seriesStyle,
  initialTimelineSelection,
  timeDomain,
  clampTimeRange,
  reconcileTimeRange,
  selectedTimeRange,
  zoomOutTimeRange,
  visiblePoints,
  pointPosition,
  offscaleRuns,
} from './afr-timeline-chart.ts';
import type { AfrMetric, AfrTimeMode, TimeRange, YRange } from './afr-timeline-chart.ts';
import type { MatrixModel } from './matrix-data.ts';
import { conciseVendor, manufacturerModelLabel } from './model-labels.ts';
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
  let timeRange: TimeRange | null = null;
  let yRange: YRange = 3;
  let cancelDrag = () => {};
  let dragging = false;
  let inspectionVisible = false;
  let suppressClick = false;
  let pending = '';
  let error = '';
  let showTable = false;
  let switchController: AbortController | undefined;
  let request = 0;
  let userSelected = false;
  let chartWidth = Math.max(280, Math.min(1000, app.clientWidth - (innerWidth > 1050 ? 430 : 44)));
  let currentGeometry = chartGeometry([], mode, metric, '2000-Q1', chartWidth);
  const chartResize = createChartResizeScheduler(
    chartWidth,
    (width) => {
      chartWidth = width;
      render();
    },
    (callback) => requestAnimationFrame(callback),
    (id) => cancelAnimationFrame(id),
  );
  const resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (width !== undefined) {
      chartResize.measure(width);
    }
  });
  routeSignal?.addEventListener('abort', () => cancelDrag(), { once: true });
  routeSignal?.addEventListener(
    'abort',
    () => {
      resizeObserver.disconnect();
      chartResize.dispose();
    },
    { once: true },
  );
  routeSignal?.addEventListener('abort', () => switchController?.abort(), { once: true });

  function visible(): AfrTimelineModel[] {
    return data.models.filter((model) => selected.has(model.id));
  }
  function active(): AfrTimelineModel | undefined {
    return visible().find((model) => model.id === inspected);
  }
  function inspectionPoints() {
    const model = active();
    return model ? visiblePoints(model, mode, currentRange()) : [];
  }
  function currentRange() {
    return clampTimeRange(timeRange, timeDomain(visible(), mode, data.asOfQuarter));
  }
  function reconcileInspection() {
    if (!visible().some((model) => model.id === inspected)) {
      inspected = visible()[0]?.id ?? '';
    }
    pointIndex = Math.max(0, Math.min(pointIndex, inspectionPoints().length - 1));
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
    const point = inspectionPoints()[pointIndex];
    if (!model || !point) {
      return model
        ? '<p>This model has no recorded quarters in this time range. Choose another model or use All time.</p>'
        : '<p>Select a model to inspect its recorded values.</p>';
    }
    return `<h3>${esc(manufacturerModelLabel(model))}</h3><p><strong>${esc(point.quarter.replace('-Q', ' Q'))} · ${relativeLabel(point.relativeQuarter)}</strong></p><dl><div><dt>${metric === 'cumulative' ? 'Observed-history' : 'Quarterly'} AFR</dt><dd>${rate(pointRate(point, metric))}</dd></div><div><dt>Observed drives</dt><dd>${number(point.count)}</dd></div><div><dt>Quarter failures</dt><dd>${number(point.failures)}</dd></div><div><dt>Quarter drive-days</dt><dd>${number(point.driveDays)}</dd></div><div><dt>Quarter coverage</dt><dd>${esc(point.coverage)}</dd></div><div><dt>Cumulative source coverage</dt><dd>${point.historyComplete ? 'Complete' : 'Incomplete'}</dd></div></dl>${pointRate(point, metric) === null ? '<p>AFR is unavailable for incomplete coverage or zero recorded exposure. The line breaks here.</p>' : ''}`;
  }
  function valuesTable(): string {
    const model = active();
    if (!model || !showTable) {
      return '';
    }
    return `<div class="afr-table-scroll"><table><caption>Recorded values in this time range for ${esc(model.name)} · ${metric === 'cumulative' ? 'observed-history' : 'quarterly'} AFR</caption><thead><tr><th scope="col">Quarter</th><th scope="col">Relative</th><th scope="col">AFR</th><th scope="col">Count</th><th scope="col">Failures</th><th scope="col">Drive-days</th><th scope="col">Coverage</th><th scope="col">History</th></tr></thead><tbody>${inspectionPoints()
      .map(
        (point) =>
          `<tr><th scope="row">${esc(point.quarter)}</th><td>${relativeLabel(point.relativeQuarter)}</td><td>${rate(pointRate(point, metric))}</td><td>${number(point.count)}</td><td>${number(point.failures)}</td><td>${number(point.driveDays)}</td><td>${esc(point.coverage)}</td><td>${point.historyComplete ? 'Complete' : 'Incomplete'}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
  }
  function hideInspection() {
    inspectionVisible = false;
    app.querySelector<HTMLElement>('#afr-tooltip')?.setAttribute('hidden', '');
    app.querySelector('#afr-crosshair')?.setAttribute('visibility', 'hidden');
  }
  function showInspection() {
    inspectionVisible = true;
    refreshInspection();
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
    slider.max = String(Math.max(0, inspectionPoints().length - 1));
    slider.value = String(pointIndex);
    slider.disabled = inspectionPoints().length === 0;
    const point = inspectionPoints()[pointIndex];
    slider.setAttribute(
      'aria-valuetext',
      point
        ? `${point.quarter}, ${relativeLabel(point.relativeQuarter)}, ${pointTooltip(active()!, point, metric)}`
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
      dot.setAttribute(
        'visibility',
        point && value !== null && value <= geometry.yMaximum ? 'visible' : 'hidden',
      );
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
    const crosshair = app.querySelector<SVGGElement>('#afr-crosshair');
    const tooltip = app.querySelector<HTMLDivElement>('#afr-tooltip');
    const svg = app.querySelector<SVGSVGElement>('svg#afr-chart');
    if (!inspectionVisible || dragging || !point || !active() || !crosshair || !tooltip || !svg) {
      hideInspection();
      return;
    }
    const position = geometry.x(pointPosition(point, mode));
    crosshair.setAttribute('visibility', 'visible');
    const guide = crosshair.querySelector('line')!;
    guide.setAttribute('x1', String(position));
    guide.setAttribute('x2', String(position));
    const label = crosshair.querySelector('text')!;
    label.textContent =
      mode === 'relative'
        ? relativeLabel(point.relativeQuarter)
        : quarterLabel(quarterOrdinal(point.quarter));
    // Anchor edge labels inwards so the exact quarter stays within the chart.
    label.setAttribute('x', String(position));
    label.setAttribute(
      'text-anchor',
      position < plot.left + 45
        ? 'start'
        : position > geometry.width - plot.right - 45
          ? 'end'
          : 'middle',
    );
    const emphasizedValue = document.createElement('strong');
    emphasizedValue.textContent = rate(value);
    tooltip.replaceChildren(
      document.createTextNode(`${manufacturerModelLabel(active()!)}: `),
      emphasizedValue,
    );
    tooltip.hidden = false;
    const bounds = svg.getBoundingClientRect();
    const frame = tooltip.parentElement!.getBoundingClientRect();
    const scale = bounds.width / geometry.width;
    const maxLeft = Math.max(
      0,
      Math.min(frame.width, innerWidth - frame.left) - tooltip.offsetWidth - 4,
    );
    const left = bounds.left - frame.left + position * scale + 12;
    tooltip.style.left = `${Math.max(Math.max(0, -frame.left + 4), Math.min(left, maxLeft))}px`;
    const y =
      value === null
        ? plot.top
        : Math.max(plot.top, Math.min(geometry.height - plot.bottom, geometry.y(value)));
    const top = bounds.top - frame.top + y * scale - tooltip.offsetHeight - 12;
    tooltip.style.top = `${Math.max(Math.max(4, -frame.top + 4), Math.min(top, frame.height - tooltip.offsetHeight - 4, innerHeight - frame.top - tooltip.offsetHeight - 4))}px`;
  }
  function chart(): string {
    const showing = visible();
    const geometry = chartGeometry(
      showing,
      mode,
      metric,
      data.asOfQuarter,
      chartWidth,
      timeRange,
      yRange,
    );
    currentGeometry = geometry;
    if (!showing.length) {
      return '<div id="afr-chart" class="afr-empty"><h2>No models selected</h2><p>Choose models at the left, or use Select all.</p></div>';
    }
    const ticks = yAxisTicks(geometry.yMaximum, yRange !== 'auto');
    const noRates = !showing.some((model) =>
      visiblePoints(model, mode, geometry).some((point) => pointRate(point, metric) !== null),
    );
    const runs = showing.flatMap((model) =>
      offscaleRuns(model, mode, metric, geometry).map((run) => ({ ...run, model })),
    );
    const aboveCount = runs.reduce((sum, run) => sum + run.count, 0);
    return `${aboveCount ? `<p class="afr-offscale-note" role="status">${aboveCount} recorded values exceed ${geometry.yMaximum}% in this time range. Triangle markers identify off-scale runs; inspect them for actual values or choose Full range.</p>` : ''}${noRates ? '<p class="afr-unavailable" role="status">Selected models have no available AFR in this time range. Use All time, inspect recorded coverage below, or choose other models.</p>' : ''}<div class="afr-legend" aria-label="Selected model lines">${showing
      .map((model) => {
        const style = seriesStyle(model.id);
        return `<button type="button" id="afr-legend-${esc(encodeURIComponent(model.id))}" data-inspect="${esc(model.id)}"><svg width="36" height="12" viewBox="0 0 36 12" aria-hidden="true"><path d="M0,6H36" stroke="${style.color}" stroke-width="3" stroke-dasharray="${style.dash}"/></svg><span>${esc(manufacturerModelLabel(model))}</span></button>`;
      })
      .join(
        '',
      )}</div><div class="afr-chart-frame"><svg id="afr-chart" viewBox="0 0 ${geometry.width} ${geometry.height}" role="group" aria-label="${metric === 'cumulative' ? 'Observed-history' : 'Quarterly'} AFR by ${mode === 'relative' ? 'quarter since first recorded appearance' : 'calendar quarter'}" aria-describedby="afr-chart-description"><desc id="afr-chart-description">${showing.length} selected model lines. Missing or incomplete quarters break lines. Focus a line or choose an inspection model, then use the quarter slider to read every value.</desc><defs><clipPath id="afr-plot-clip"><rect x="${plot.left}" y="${plot.top}" width="${geometry.width - plot.left - plot.right}" height="${geometry.height - plot.top - plot.bottom}"/></clipPath></defs>${ticks.map(({ value, minor }) => `<g class="afr-axis${minor ? ' afr-axis-minor' : ''}"><line x1="${plot.left}" x2="${geometry.width - plot.right}" y1="${geometry.y(value)}" y2="${geometry.y(value)}"/><text x="${plot.left - 10}" y="${geometry.y(value) + 4}" text-anchor="end">${esc(value >= 1000000 ? value.toExponential(1) : value >= 100 ? number(Math.round(value)) : Number(value.toFixed(2)))}%</text></g>`).join('')}${geometry.ticks.map((position) => `<g class="afr-axis"><line x1="${geometry.x(position)}" x2="${geometry.x(position)}" y1="${geometry.height - plot.bottom}" y2="${geometry.height - plot.bottom + 6}"/>${geometry.labelTicks.includes(position) ? `<text x="${geometry.x(position)}" y="${geometry.height - plot.bottom + 24}" text-anchor="middle">${mode === 'relative' ? relativeLabel(position) : quarterLabel(position)}</text>` : ''}</g>`).join('')}<text class="afr-axis-label" x="${geometry.width / 2}" y="${geometry.height - 14}" text-anchor="middle">${mode === 'relative' ? 'Quarters since first recorded appearance' : 'Calendar quarter'}</text><g clip-path="url(#afr-plot-clip)">${showing
      .map((model) => {
        const style = seriesStyle(model.id);
        return `<path id="afr-series-${esc(encodeURIComponent(model.id))}" class="afr-series" data-series="${esc(model.id)}" tabindex="0" role="button" aria-label="Inspect ${esc(manufacturerModelLabel(model))}" d="${seriesPath(model, geometry, mode, metric)}" stroke="${style.color}" stroke-dasharray="${style.dash}"></path>`;
      })
      .join(
        '',
      )}<circle id="afr-current-point" class="afr-current-point" r="5" visibility="hidden"/></g>${runs
      .map((run) => {
        const x = geometry.x(pointPosition(run.point, mode));
        const label = `${manufacturerModelLabel(run.model)}: ${run.count} off-scale value${run.count === 1 ? '' : 's'}, highest ${rate(run.maximum)} at ${run.point.quarter}. Inspect highest value.`;
        return `<path class="afr-offscale" data-offscale="${esc(run.model.id)}" data-position="${pointPosition(run.point, mode)}" role="button" tabindex="0" aria-label="${esc(label)}" d="M${x - 6},${plot.top + 10} L${x},${plot.top} L${x + 6},${plot.top + 10}Z" fill="${seriesStyle(run.model.id).color}"></path>`;
      })
      .join(
        '',
      )}<g id="afr-crosshair" class="afr-crosshair" visibility="hidden" aria-hidden="true"><line y1="${plot.top}" y2="${geometry.height - plot.bottom}"/><text y="${plot.top - 10}"></text></g><rect id="afr-brush" class="afr-brush" x="0" y="${plot.top}" width="0" height="${geometry.height - plot.top - plot.bottom}" visibility="hidden"/></svg><div id="afr-tooltip" class="afr-tooltip" hidden aria-hidden="true"></div></div>`;
  }
  function axisControls(): string {
    const domain = timeDomain(visible(), mode, data.asOfQuarter);
    const range = currentRange();
    const all = range.minimum === domain.minimum && range.maximum === domain.maximum;
    const options = (selectedPosition: number) =>
      Array.from({ length: domain.maximum - domain.minimum + 1 }, (_, index) => {
        const position = domain.minimum + index;
        return `<option value="${position}" ${position === selectedPosition ? 'selected' : ''}>${mode === 'relative' ? relativeLabel(position) : quarterLabel(position)}</option>`;
      }).join('');
    return `<div class="afr-axis-controls" role="group" aria-label="Chart ranges"><label>From ${mode === 'relative' ? 'relative quarter' : 'calendar quarter'}<select id="afr-from">${options(range.minimum)}</select></label><label>To ${mode === 'relative' ? 'relative quarter' : 'calendar quarter'}<select id="afr-to">${options(range.maximum)}</select></label><button id="afr-zoom-out" type="button" ${all ? 'disabled' : ''}>Zoom out</button><button id="afr-all-time" type="button" ${all ? 'disabled' : ''}>All time</button><label>Y range<select id="afr-y-range">${([1, 2, 3, 5, 'auto'] as const).map((value) => `<option value="${value}" ${value === yRange ? 'selected' : ''}>${value === 'auto' ? 'Full range (auto)' : `0-${value}%`}</option>`).join('')}</select></label></div><p class="afr-range-help">Drag across the plot to zoom to quarters. Use From and To with keyboard or touch. Escape cancels a drag.</p>`;
  }
  function bindAxes() {
    const setRange = (range: TimeRange | null) => {
      timeRange = range;
      render();
    };
    const from = app.querySelector<HTMLSelectElement>('#afr-from')!;
    const to = app.querySelector<HTMLSelectElement>('#afr-to')!;
    from.onchange = () =>
      setRange({
        minimum: Number(from.value),
        maximum: Math.max(Number(from.value), Number(to.value)),
      });
    to.onchange = () =>
      setRange({
        minimum: Math.min(Number(from.value), Number(to.value)),
        maximum: Number(to.value),
      });
    app.querySelector<HTMLButtonElement>('#afr-all-time')!.onclick = () => setRange(null);
    app.querySelector<HTMLButtonElement>('#afr-zoom-out')!.onclick = () =>
      setRange(zoomOutTimeRange(currentRange(), timeDomain(visible(), mode, data.asOfQuarter)));
    app.querySelector<HTMLSelectElement>('#afr-y-range')!.onchange = (event) => {
      const value = (event.target as HTMLSelectElement).value;
      yRange = value === 'auto' ? 'auto' : (Number(value) as YRange);
      render();
    };
    app.querySelectorAll<SVGPathElement>('[data-offscale]').forEach((marker) => {
      const inspect = () => {
        inspected = marker.dataset.offscale!;
        pointIndex = inspectionPoints().findIndex(
          (point) => pointPosition(point, mode) === Number(marker.dataset.position),
        );
        reconcileInspection();
        showInspection();
      };
      marker.onfocus = inspect;
      marker.onblur = hideInspection;
      marker.onpointerenter = (event) => {
        if (!dragging && !event.buttons) {
          inspect();
        }
      };
      marker.onpointerleave = hideInspection;
      marker.onclick = () => {
        if (!suppressClick) {
          inspect();
        }
      };
      marker.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inspect();
        }
      };
    });
    const svg = app.querySelector<SVGSVGElement>('svg#afr-chart');
    if (!svg) {
      return;
    }
    const brush = app.querySelector<SVGRectElement>('#afr-brush')!;
    let clickTarget: EventTarget | null = null;
    const x = (event: PointerEvent) => {
      const bounds = svg.getBoundingClientRect();
      return Math.max(
        plot.left,
        Math.min(
          currentGeometry.width - plot.right,
          ((event.clientX - bounds.left) / bounds.width) * currentGeometry.width,
        ),
      );
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        suppressClick = true;
        gesture.cancel();
      }
    };
    const gesture = createTimeBrush({
      capture: (id) => {
        hideInspection();
        svg.setPointerCapture(id);
        document.addEventListener('keydown', escape);
      },
      release: (id) => {
        document.removeEventListener('keydown', escape);
        if (svg.hasPointerCapture(id)) {
          svg.releasePointerCapture(id);
        }
      },
      preview: (range) => {
        dragging = range !== null;
        brush.setAttribute('visibility', range ? 'visible' : 'hidden');
        if (range) {
          brush.setAttribute('x', String(Math.min(range.start, range.end)));
          brush.setAttribute('width', String(Math.abs(range.end - range.start)));
        }
      },
      select: (start, finish) => {
        suppressClick = true;
        const geometry = currentGeometry;
        const position = (px: number) =>
          geometry.minimum +
          ((px - plot.left) / (geometry.width - plot.left - plot.right)) *
            (geometry.maximum - geometry.minimum);
        setRange(selectedTimeRange(position(start), position(finish), currentRange()));
      },
      click: () => {
        // Pointer capture retargets native clicks to the SVG; retain short-click inspection.
        if (clickTarget instanceof SVGElement) {
          clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      },
    });
    cancelDrag = gesture.cancel;
    svg.onpointerdown = (event) => {
      suppressClick = false;
      const bounds = svg.getBoundingClientRect();
      const px = ((event.clientX - bounds.left) / bounds.width) * currentGeometry.width;
      const py = ((event.clientY - bounds.top) / bounds.height) * currentGeometry.height;
      if (
        px < plot.left ||
        px > currentGeometry.width - plot.right ||
        py < plot.top ||
        py > currentGeometry.height - plot.bottom
      ) {
        return;
      }
      if (gesture.start(event, x(event))) {
        clickTarget = event.target;
      }
    };
    svg.onpointerleave = hideInspection;
    svg.onpointermove = (event) => gesture.move(event, x(event));
    svg.onpointerup = (event) => gesture.end(event, x(event));
    svg.onpointercancel = () => {
      suppressClick = true;
      gesture.cancel();
    };
    svg.onlostpointercapture = gesture.cancel;
  }

  function render() {
    if (routeSignal?.aborted) {
      return;
    }
    cancelDrag();
    hideInspection();
    const showing = visible();
    timeRange = reconcileTimeRange(timeRange, showing, mode, data.asOfQuarter);
    reconcileInspection();
    const focus = captureControlFocus(document.activeElement as HTMLElement | null);
    patchContent(
      app,
      `<main id="main" class="afr-page"><header class="afr-heading"><div><p class="eyebrow">RECORDED HDD HISTORY</p><h1>AFR trends</h1><p>Compare how annualized failure rates change through recorded deployment history.</p></div><label>As-of evidence<select id="afr-snapshot">${choices
        .toSorted((a, b) => b.asOfQuarter.localeCompare(a.asOfQuarter))
        .map(
          (choice) =>
            `<option value="${esc(choice.snapshotId)}" ${choice.snapshotId === (pending || data.snapshotId) ? 'selected' : ''} ${choice.timeline ? '' : 'disabled'}>${esc(choice.asOfQuarter.replace('-Q', ' Q'))}${choice.timeline ? '' : ' · unavailable'}</option>`,
        )
        .join('')}</select></label></header>
      <div class="afr-controls"><label>Rate<select id="afr-metric"><option value="cumulative" ${metric === 'cumulative' ? 'selected' : ''}>Observed-history cumulative AFR</option><option value="quarterly" ${metric === 'quarterly' ? 'selected' : ''}>Quarterly AFR</option></select></label><label>Time alignment<select id="afr-time"><option value="relative" ${mode === 'relative' ? 'selected' : ''}>Since first recorded appearance</option><option value="calendar" ${mode === 'calendar' ? 'selected' : ''}>Calendar quarters</option></select></label><p class="afr-method-note">Models with at least 2,000 observed drives in a quarter; all recorded quarters available. Starts with the three most-deployed models; choose any models to compare.</p></div>
      ${pending ? '<p role="status">Loading selected evidence… Previous validated chart remains visible.</p>' : ''}${error ? `<p role="alert">${esc(error)}</p>` : ''}
      <div class="afr-workspace">${renderModelSelector(models, selected, search, 'afr-chart', 'chart', conciseVendor)}<section class="afr-chart-area" aria-label="AFR comparison">${axisControls()}${chart()}<p class="afr-chart-note">Gaps mean unavailable AFR.</p><div class="afr-inspection-controls"><label>Inspect model<select id="afr-inspect-model" ${showing.length ? '' : 'disabled'}>${showing.map((model) => `<option value="${esc(model.id)}" ${model.id === inspected ? 'selected' : ''}>${esc(manufacturerModelLabel(model))}</option>`).join('')}</select></label><label>Inspect quarter<input id="afr-point" type="range" min="0" max="${Math.max(0, inspectionPoints().length - 1)}" value="${pointIndex}" step="1" ${inspectionPoints().length ? '' : 'disabled'}></label></div><p class="afr-keyboard-help">Focus a line to identify it. Use the quarter slider with arrow keys, Home or End to inspect its values.</p><section id="afr-readout" class="afr-readout" aria-live="polite" aria-atomic="true">${readout()}</section><details id="afr-values" ${showTable ? 'open' : ''}><summary>Values for inspected model</summary><div id="afr-table">${valuesTable()}</div></details><button id="afr-download" type="button" ${showing.length ? '' : 'disabled'}>Download full selected history (CSV)</button></section></div>
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
      timeRange = null;
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
      showInspection();
    };
    app.querySelector<HTMLInputElement>('#afr-point')!.onfocus = showInspection;
    app.querySelector<HTMLInputElement>('#afr-point')!.onblur = hideInspection;
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
      path.onfocus = () => {
        inspect();
        showInspection();
      };
      path.onblur = hideInspection;
      path.onpointerleave = hideInspection;
      path.onpointerenter = () => {
        if (!dragging) {
          inspect();
        }
      };
      path.onclick = () => {
        if (!suppressClick) {
          inspect();
        }
      };
      path.onkeydown = (event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          inspect();
          const end = Math.max(0, inspectionPoints().length - 1);
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
          showInspection();
        }
      };
      path.onpointermove = (event) => {
        if (dragging || event.buttons) {
          return;
        }
        inspect();
        const model = active();
        const svg = app.querySelector<SVGSVGElement>('#afr-chart')!;
        const bounds = svg.getBoundingClientRect();
        const geometry = currentGeometry;
        const target = ((event.clientX - bounds.left) / bounds.width) * geometry.width;
        if (!model) {
          return;
        }
        pointIndex = nearestPointIndex(inspectionPoints(), mode, geometry, target);
        showInspection();
      };
    });
    bindAxes();
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
      timeRange = null;
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
