import { updatePublishedNavigation } from './published-navigation.ts';
import './matrix.css';
import './matrix-selection.css';
import { PresentationLoader, presentationCatalogue } from './presentation-loader.ts';
import type { CatalogueSnapshot } from './presentation-data.ts';
import { deltaDisplay, metricFieldWidths, yearRowGroups } from './matrix-display.ts';
import { patchContent } from './matrix-render.ts';
import { heatmapPaint } from './matrix-contrast.ts';
import { vendorPaint } from './matrix-brand.ts';
import q3 from '../../fixtures/workbooks/2025-Q3.json?url';
import {
  snapshotAvailable,
  snapshotChoices,
  snapshotUnavailableReason,
} from './snapshot-availability.ts';
import q4 from '../../fixtures/workbooks/2025-Q4.json?url';
import earlier from '../../fixtures/matrix/synthetic-earlier.json?url';
import later from '../../fixtures/matrix/synthetic-later.json?url';
import correction from '../../fixtures/matrix/synthetic-correction.json?url';
import xyz from '../../fixtures/matrix/synthetic-new-manufacturer.json?url';
import storyUrl from '../../fixtures/workbooks/owner-stories.json?url';
import {
  adaptProduction,
  adaptWorkbook,
  axisExtent,
  cellAt,
  formatMetric,
  interpolate,
  metrics,
  metricLabels,
  stateInfo,
  visibleModels,
} from './matrix-data.ts';
import type {
  MatrixSnapshot,
  MatrixModel,
  MatrixCell,
  Metric,
  Workbook,
  Production,
} from './matrix-data.ts';
import { captureControlFocus, controlId, restoreControlFocus } from './matrix-focus.ts';
import { connectMatrixScroll } from './matrix-scroll.ts';
import { groupModels, setVendorSelected, vendorSelectionState } from './matrix-selection.ts';

const files = [q4, q3, later, earlier, correction, xyz];
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const quarter = (value: string | null | undefined) =>
  value
    ? value.replace('-Q', ' Q')
    : snapshot.kind === 'reference'
      ? 'Unknown in workbook'
      : 'Unavailable';
let snapshots: MatrixSnapshot[] = [];
let productionChoices: CatalogueSnapshot[] = [];
let reader: PresentationLoader | undefined;
let switchController: AbortController | undefined;
let switchRequest = 0;
let routeSignal: AbortSignal | undefined;
let pendingSnapshot = '';
let snapshotError = '';
let referenceMode = false;
let snapshot: MatrixSnapshot;
let stories: { id: string; models: string[]; owner_reading: string }[] = [];
let search = '',
  guideYear = 6,
  neutral = false;
let selected = new Set<string>();
let selection: { model: MatrixModel; cell: MatrixCell; metric: Metric } | undefined;
let activeRow = 0;
let disconnectScrolling: (() => void) | undefined;
const app = document.querySelector<HTMLDivElement>('#route-content')!;
const empty = (value: unknown) =>
  value === null || value === undefined ? 'Unavailable' : esc(value);

export async function initMatrix(signal?: AbortSignal) {
  signal?.throwIfAborted();
  referenceMode = new URLSearchParams(location.search).get('reference') === '1';
  routeSignal = signal;
  document.title = referenceMode
    ? 'Drive Stats — Matrix reference preview'
    : 'Drive Stats — Observed-history AFR matrix';
  if (!referenceMode) {
    await initProduction(signal);
    return;
  }
  reader = undefined;
  productionChoices = [];
  app.innerHTML = '<div class="matrix-loading" role="status">Loading comparison references…</div>';
  try {
    const [loaded, storyData] = await Promise.all([
      Promise.all(
        files.map(async (url) => {
          const response = await fetch(url, { signal: signal ?? null });
          if (!response.ok) {
            throw new Error('A comparison fixture could not be loaded.');
          }
          // These bundled, versioned fixtures have contracts chosen by their import URL.
          const data: unknown = await response.json();
          return url === q3 || url === q4
            ? adaptWorkbook(data as Workbook)
            : adaptProduction(data as Production);
        }),
      ),
      fetch(storyUrl, { signal: signal ?? null }).then(async (r) => {
        if (!r.ok) {
          throw new Error('Owner reading cases could not be loaded.');
        }
        // Owner stories are also a versioned repository fixture.
        const data: unknown = await r.json();
        return data as { stories: typeof stories };
      }),
    ]);
    signal?.throwIfAborted();
    snapshots = loaded;
    stories = storyData.stories;
    const id = new URLSearchParams(location.search).get('snapshot');
    snapshot = snapshots.find((s) => s.id === id) ?? snapshots[0]!;
    selected = new Set(snapshot.models.map((m) => m.id));
    render();
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    app.innerHTML = `<div class="matrix-loading" role="alert"><h1>Comparison preview unavailable</h1><p>${esc(error instanceof Error ? error.message : error)}</p><a href="?view=explore">Return to Explore</a></div>`;
  }
}
async function initProduction(signal?: AbortSignal) {
  app.innerHTML = '<div class="matrix-loading" role="status">Validating production snapshot…</div>';
  try {
    const index = presentationCatalogue();
    reader = new PresentationLoader(index);
    const params = new URLSearchParams(location.search);
    const id = params.get('snapshot') ?? index.latestSnapshotId;
    productionChoices = snapshotChoices(index.snapshots, 'matrix', id);
    const choice = reader.selection(params);
    if (!choice) {
      throw new Error('Unknown production snapshot.');
    }
    const capsule = await reader.load(choice, signal);
    if (capsule.kind !== 'matrix') {
      throw new Error('Invalid matrix presentation.');
    }
    const loaded = capsule.body;
    signal?.throwIfAborted();
    if (!loaded) {
      return;
    }
    snapshot = loaded;
    snapshots = [];
    stories = [];
    resetSnapshot();
    render();
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    app.innerHTML = `<div class="matrix-loading" role="alert"><h1>Production comparison unavailable</h1><p>${esc(error instanceof Error ? error.message : error)}</p><a href="?view=matrix">Retry latest snapshot</a> · <a href="?view=matrix&reference=1">Workbook and synthetic references</a></div>`;
  }
}
function resetSnapshot() {
  selected = new Set(snapshot.models.map((m) => m.id));
  search = '';
  selection = undefined;
  activeRow = 0;
  pendingSnapshot = '';
  snapshotError = '';
}
async function changeSnapshot(id: string) {
  const request = ++switchRequest;
  if (!reader) {
    snapshot = snapshots.find((s) => s.id === id)!;
    resetSnapshot();
  } else {
    pendingSnapshot = id;
    snapshotError = '';
    render();
    try {
      switchController?.abort();
      switchController = new AbortController();
      const signal = routeSignal
        ? AbortSignal.any([routeSignal, switchController.signal])
        : switchController.signal;
      const choice = reader.selection(new URLSearchParams({ view: 'matrix', snapshot: id }));
      if (!choice) {
        throw new Error('Unknown production snapshot.');
      }
      const capsule = await reader.load(choice, signal);
      if (request !== switchRequest || signal.aborted) {
        return;
      }
      if (capsule.kind !== 'matrix') {
        throw new Error('Invalid matrix presentation.');
      }
      const loaded = capsule.body;
      snapshot = loaded;
      resetSnapshot();
    } catch (error) {
      if (
        request !== switchRequest ||
        routeSignal?.aborted ||
        switchController?.signal.aborted ||
        pendingSnapshot !== id
      ) {
        return;
      }
      pendingSnapshot = '';
      snapshotError = `Snapshot switch failed. Still showing ${snapshot.label}. ${error instanceof Error ? error.message : String(error)}`;
      render();
      return;
    }
  }
  const url = new URL(location.href);
  url.searchParams.set('snapshot', snapshot.id);
  history.replaceState(null, '', url);
  render();
}
function labelForMetric(index: number) {
  return snapshot.rateLabel && index < 2
    ? `${snapshot.rateLabel}${index === 1 ? ' delta' : ''}`
    : metricLabels[index]!;
}
function failureUnit() {
  return snapshot.matrixCalculationVersion === '2.1.0'
    ? 'unique failing drives counted per quarter'
    : 'failure flags';
}
function productionMethod() {
  return `${snapshot.hddScopeDescription ? `<p>${esc(snapshot.hddScopeDescription)}</p>` : ''}<p><strong>${esc(snapshot.rateLabel ?? 'Observed-history AFR')}</strong> = ${failureUnit()} ÷ recorded drive-days × 36500. It includes recorded pre-anchor and below-threshold history. Missing days are not imputed or assumed representative. It is not lifetime AFR, complete-history AFR or individual-drive survival.</p><p>Each model starts at its earliest proven ≥2,000-drive quarter in supplied history, including a partial-quarter lower-bound proof. Earlier qualification can remain possible. Gaps, below-threshold quarters and reentry consume positions; the clock never resets. Relative history is not physical drive age.</p><p>Current partial, missing and unpublished rows have unavailable display metrics. A later complete eligible row can have Observed-history AFR despite a past gap. Inspect complete-history availability and source completeness separately. A numeric zero is an observed value; a dash is unavailable.</p><p>Deltas compare the prior eligible complete quarter at this rate basis and disclose its actual calendar quarter and elapsed distance. ${snapshot.matrixCalculationVersion === '2.1.0' ? 'First eligible deltas subtract a synthetic zero baseline for AFR and Count; zero is not a prior observed quarter.' : 'This snapshot uses the legacy 2.0 convention: first eligible deltas are initialized to zero; no prior AFR or Count baseline is asserted.'} A gap-spanning difference is not a quarter-over-quarter rate. Count is distinct observed identities during a complete quarter. New means first recorded observation, including the initial observed fleet. ${snapshot.matrixCalculationVersion === '2.1.0' ? 'Failed counts each model/serial with at least one failure flag once per quarter. AFR accumulates those quarterly counts; the same serial can count again in a later quarter.' : 'Failed sums daily failure flags; repeated flags on one serial count repeatedly and also contribute to AFR.'} ${snapshot.matrixCalculationVersion === '2.1.0' ? 'Retired counts unique identities observed this quarter whose final recorded observation is in this quarter, provided it precedes the selected snapshot quarter. It includes failed identities and does not prove physical exit. The terminal quarter is right-censored and unavailable; gaps can also obstruct inference.' : 'Retired includes failed departures and is inferred from last observations, becomes unavailable when gaps obstruct inference, and uses a provisional Retired = Failed proxy at the selected cutoff.'} Population Delta does not equal New minus Retired.</p><p>All accepted analysis models start selected. Supporting context is wider than this matrix; filters do not change its denominator. Purchase and historical-reference defaults remain unassigned in the current generation. Deployment evidence is not a manufacturing, retail availability, NAS compatibility or purchase recommendation.</p><p>The single guide defaults to after relative year 6 (quarter 24), with choices 1–6. It is a reading reference, not a lifetime or replacement prediction. The full history remains visible beyond it.</p><p>Colors use all numeric eligible cells in the selected snapshot, including initialization, with the accepted reference palette and edge rules. Selection never recalculates domains. Vendor colors identify categories; no composite ranking is calculated.</p>`;
}
function modelNavigation(models: MatrixModel[]) {
  const query = search.trim().toLowerCase();
  const groups = groupModels(snapshot.models)
    .map((group) => ({
      ...group,
      matches: group.models.filter((model) =>
        `${model.name} ${model.vendor}`.toLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.matches.length);
  return `<aside class="matrix-model-nav" aria-label="Brands and drive models">
    <h2 class="matrix-nav-heading">Brands & models</h2>
    <p class="matrix-nav-count" role="status">${models.length} of ${snapshot.models.length} models selected</p>
    <label class="matrix-nav-search">Find choices<input id="matrix-search" type="search" value="${esc(search)}" placeholder="Model or brand" aria-describedby="matrix-selection-help"></label>
    <p id="matrix-selection-help" class="matrix-nav-help">Search finds choices. Checkboxes control the table. Brand checkboxes apply to all models in that brand.</p>
    <div class="matrix-nav-actions"><button type="button" id="matrix-select-all">Select all</button><button type="button" id="matrix-clear">Clear all</button></div>
    <div class="matrix-brand-list">${
      groups
        .map((group) => {
          const state = vendorSelectionState(group.models, selected);
          return `<div class="matrix-brand-group" data-render-key="choices-${esc(group.vendor)}" style="--brand-color:${vendorPaint(group.vendor).background}"><fieldset class="matrix-brand-options"><legend><label class="matrix-vendor-choice"><input type="checkbox" id="${controlId('vendor', group.vendor)}" data-vendor="${esc(group.vendor)}" aria-controls="matrix-data" ${state.checked ? 'checked' : ''}><span>${esc(group.vendor)}</span><small aria-hidden="true">${state.selectedCount}/${state.totalCount}</small></label></legend><div class="matrix-model-choices">${group.matches.map((model) => `<label class="matrix-model-choice" data-render-key="choice-${esc(model.id)}"><input type="checkbox" id="${controlId('model', model.id)}" data-model="${esc(model.id)}" aria-controls="matrix-data" ${selected.has(model.id) ? 'checked' : ''}><span class="model-id">${esc(model.name)}</span></label>`).join('')}</div></fieldset></div>`;
        })
        .join('') || '<p class="matrix-nav-empty">No matching brands or models.</p>'
    }</div>
  </aside>`;
}
function updateSelected(next: Set<string>) {
  selected = next;
  if (selection && !selected.has(selection.model.id)) {
    selection = undefined;
    activeRow = 0;
  }
  render();
}
function exampleComparisons() {
  if (snapshot.kind !== 'reference') {
    return '';
  }
  return `<details class="matrix-stories matrix-method"><summary>Example comparisons · ${stories.length} reading cases</summary><p>Historical workbook examples. Choose a comparison to show its models in the table.</p><div>${stories.map((story) => `<button type="button" id="${controlId('story', story.id)}" data-story="${esc(story.id)}"><strong>${esc(story.models.join(' / '))}</strong><span>${esc(story.owner_reading)}</span></button>`).join('')}</div></details>`;
}
function tableDisplayOptions() {
  return `<section class="matrix-tools" aria-labelledby="matrix-options-heading"><h2 id="matrix-options-heading" class="matrix-options-heading">Table display</h2><div class="matrix-filters"><label>Guide after year<select id="matrix-guide">${[1, 2, 3, 4, 5, 6].map((year) => `<option value="${year}" ${year === guideYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label><label class="matrix-check"><input id="matrix-neutral" type="checkbox" ${!neutral ? 'checked' : ''} title="Color numeric cells by their values">Show data colors</label></div>
  </section>`;
}
function render() {
  disconnectScrolling?.();
  const savedFocus = captureControlFocus(document.activeElement as HTMLElement | null);
  const focusedElement = document.activeElement;
  const scroll = app.querySelector('.matrix-scroll');
  const left = scroll?.scrollLeft ?? 0,
    top = scroll?.scrollTop ?? 0;
  const models = visibleModels(snapshot, selected);
  patchContent(
    app,
    `<main id="main" class="matrix-page">
  <section class="matrix-heading"><div><p class="eyebrow">THE FULL TRAJECTORY</p><h1>Reliability through deployment history.</h1><p>${snapshot.rateLabel ? 'Compare Observed-history AFR, population and turnover. Seven adjacent metrics retain the evidence behind each value.' : 'Compare cumulative AFR, population and turnover together. Each model keeps its seven workbook columns.'}</p></div><label class="snapshot-control">AS-OF EVIDENCE<select id="matrix-snapshot">${(referenceMode ? snapshots : productionChoices.map((entry) => ({ id: entry.snapshotId, label: `${entry.asOfQuarter.replace('-Q', ' Q')} · ${snapshotAvailable(entry.asOfQuarter, 'matrix') ? 'observed history' : 'unavailable for AFR comparison'}` }))).map((s) => `<option value="${esc(s.id)}" ${!referenceMode && productionChoices.some((entry) => entry.snapshotId === s.id && !snapshotAvailable(entry.asOfQuarter, 'matrix')) ? 'disabled' : ''} ${s.id === (pendingSnapshot || snapshot.id) ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label></section>
  <aside class="matrix-notice ${snapshot.kind}"><strong>${snapshot.kind === 'production' ? 'BACKBLAZE OBSERVED HISTORY · V2' : snapshot.kind === 'reference' ? 'WORKBOOK REFERENCE · NOT A PRODUCTION SNAPSHOT' : 'SYNTHETIC SAMPLE · INVENTED FIGURES'}</strong><span>${esc(snapshot.notice)}</span></aside>
  ${pendingSnapshot ? '<p role="status">Validating selected snapshot… The previous validated matrix remains visible.</p>' : ''}${snapshotError ? `<p role="alert">${esc(snapshotError)}</p>` : ''}
  <div class="matrix-source">Dataset and reports: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a> · <a href="https://www.backblaze.com/blog/category/hard-drive-stats/">Official reports</a> · Independent analysis by <a href="https://github.com/SixbucksSolutions">Sixbucks Solutions</a>. Software MIT; dataset retains its own terms.</div>

  <section class="matrix-workspace"><div class="matrix-caption"><div><strong>${models.length} models · ${esc(snapshot.label)}</strong><span>${snapshot.kind === 'reference' ? 'Relative retained-row positions' : snapshot.rateLabel ? 'Calendar offsets from earliest proven ≥2,000-drive quarter' : 'Calendar offsets from first ≥2,000-drive quarter'} · guide after year ${guideYear} · scroll for the full history</span></div><a href="#matrix-legend">Color legend ↓</a></div>
  <p class="matrix-instruction" id="matrix-help">Focus, click or hover any value for details. Arrow keys move between cells; Home/End move across a row. The same relative row is outlined across models. Relative history is not individual drive age.</p>
  <div class="matrix-comparison-layout">${modelNavigation(models)}<div class="matrix-table-area"><div class="matrix-pane">
    <div class="matrix-scroll" id="matrix-data" tabindex="0" role="region" aria-label="Deployment history matrix, scroll horizontally and vertically" aria-describedby="matrix-help">${models.length ? table(models) : `<div class="matrix-empty">${snapshot.models.length === 0 ? `${esc(snapshotUnavailableReason('matrix'))} <a href="?view=capacity&snapshot=${esc(snapshot.id)}">View total capacity at this cutoff</a>` : 'No models selected. Choose a brand or model to display.'}</div>`}</div>
    <div class="matrix-vscroll" tabindex="0" role="region" aria-label="Scroll relative quarters vertically" aria-controls="matrix-data"><div class="matrix-scroll-size" aria-hidden="true"></div></div>
    <div class="matrix-hscroll" tabindex="0" role="region" aria-label="Scroll drive model columns horizontally" aria-controls="matrix-data"><div class="matrix-scroll-size" aria-hidden="true"></div></div>
    <div class="matrix-scroll-corner" aria-hidden="true"></div>
  </div></div></div>
  <div class="matrix-table-footer"><div class="matrix-states">${(snapshot.rateLabel ? ['below_threshold', 'source_missing', 'source_incomplete', 'unpublished', 'snapshot_end'] : ['below_threshold', 'source_missing', 'source_incomplete', 'snapshot_end', 'trailing_blank_unknown']).map((s) => `<span class="state-key state-${s}" title="${esc(stateInfo(s).description)}">${stateInfo(s).label}</span>`).join('')}<span>— on an eligible row = metric unavailable; inspect for the reason</span></div>${tableDisplayOptions()}</div></section>
  <aside class="matrix-inspector" id="matrix-inspector" aria-label="Cell details">${selection ? inspector() : '<p class="eyebrow">CELL INSPECTOR</p><h2>Read a value in context.</h2><p>Focus, click or hover a matrix cell for its exact value, calendar context, exposure and baseline.</p>'}</aside>
  ${legend()}${exampleComparisons()}<details class="matrix-method"><summary>How to read this comparison & source context</summary>${snapshot.rateLabel ? productionMethod() : `<p>AFR is cumulative through the displayed quarter, in percent; AFR delta is in percentage points. Count means distinct drives observed anywhere in a quarter, not the installed population at quarter end. New means first seen in supplied history. Failed sums daily failure flags.</p><p>Retired is inferred from last observations and may include failures. A newest-quarter Failed proxy, when identified by production metadata, is provisional. Neither is proof of voluntary retirement or its cause. Large population and continuing additions provide deployment context, not a spending measurement.</p><p>All seven scales use the full eligible snapshot population. Model selection and neutral colors never recalculate them. The malformed New source color is normalized to intended white. No composite ranking is calculated.</p><p>${snapshot.kind === 'reference' ? 'Workbook first-row deltas subtract zero; subsequent rows subtract the prior retained row. Calendar, pre-eligibility exposure and cutoff are unknown. Nonzero cumulative AFR with zero current Failed can reflect earlier contributions, but those components cannot be reconstructed here.' : 'Production examples retain real calendar offsets and the original anchor after reentry. Delta subtracts the prior eligible row and states its elapsed span. Pre-eligibility contributions remain in cumulative AFR; coverage gaps can make cumulative rates unavailable while Count remains known.'}</p><p>The guide marks the end of the selected relative year (four quarters per year). It is a deployment-history reference and does not predict an individual drive’s lifetime or recommend a replacement date.</p>`}<p>Snapshot: ${esc(snapshot.id)} · ${esc(snapshot.versions)}.</p><p class="matrix-hash">Source SHA-256 / manifest: ${esc(snapshot.sourceHash)}</p>${snapshot.sourceUrl ? `<a href="${esc(snapshot.sourceUrl)}">${snapshot.rateLabel ? 'Backblaze public dataset ↗' : 'Original owner-supplied workbook ↗'}</a>` : '<p>Invented aggregate contract example; no observed Backblaze performance is represented.</p>'}</details>
  <footer>${snapshot.rateLabel ? 'Recorded Backblaze history · Independent Sixbucks Solutions analysis. <a href="?view=matrix&reference=1">Workbook & synthetic references</a>' : 'Historical and synthetic comparison references. <a href="?view=matrix">Production matrix</a>'}<a href="${import.meta.env.BASE_URL}fonts/NOTICE.txt">Font credits & licenses</a></footer></main>`,
  );
  updatePublishedNavigation({
    snapshotId: snapshot.id,
    kind: referenceMode ? 'sample' : 'backblaze',
  });
  bind();
  const nextScroll = app.querySelector('.matrix-scroll');
  if (nextScroll) {
    nextScroll.scrollLeft = left;
    nextScroll.scrollTop = top;
  }
  disconnectScrolling = connectMatrixScroll(app.querySelector<HTMLElement>('.matrix-pane')!);
  if (document.activeElement !== focusedElement) {
    restoreControlFocus(savedFocus, (id) => document.getElementById(id));
  }
  const focusedCell = document.activeElement;
  if (focusedCell instanceof HTMLButtonElement && focusedCell.dataset.cell) {
    app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => {
      cell.tabIndex = cell === focusedCell ? 0 : -1;
    });
  }
  highlight(activeRow);
}
function table(models: MatrixModel[]) {
  const extent = axisExtent(snapshot, guideYear),
    guideQuarter = guideYear * 4;
  const widths = metricFieldWidths(snapshot);
  return `<table class="comparison-matrix" style="${metrics.map((metric) => `--field-${metric}:${widths[metric]}ch`).join(';')}"><caption class="sr-only">Seven adjacent metrics per model. Relative year and quarter down the left; vendor and model across the top.</caption><thead><tr class="vendor-row"><th rowspan="4" class="age year">Year</th><th rowspan="4" class="age age-quarter">Quarter</th>${groupModels(
    models,
  )
    .map(
      (g) =>
        `<th colspan="${g.models.length * 7}" class="vendor-header" style="background:${vendorPaint(g.vendor).background};color:${vendorPaint(g.vendor).foreground}"><span class="vendor-label">${esc(g.vendor)}</span></th>`,
    )
    .join('')}</tr>
  <tr class="model-row">${models.map((m) => `<th colspan="7" class="model-header" data-render-key="model-${esc(m.id)}" style="background:${vendorPaint(m.vendor).background};color:${vendorPaint(m.vendor).foreground}"><span class="model-label-track"><span class="model-name">${esc(m.name)}</span></span></th>`).join('')}</tr>
  <tr class="family-row">${models.map(() => `<th colspan="2" class="model-start">${snapshot.rateLabel ? 'Observed-history AFR' : 'AFR'}</th><th colspan="5">Drives</th>`).join('')}</tr>
  <tr class="metric-row">${models.map(() => ['Value %', 'Delta pp', 'Count', 'Delta', 'New', 'Retired', 'Failed'].map((v, i) => `<th class="${i === 0 ? 'model-start' : ''} ${i < 2 ? 'metric-rate' : 'metric-count'}" title="${labelForMetric(i)}">${v}</th>`).join('')).join('')}</tr></thead>${yearRowGroups(
    extent,
  )
    .map(
      (group) =>
        `<tbody data-render-key="year-${group.year}">${group.quarters.map((q, rowIndex) => `<tr data-render-key="row-${q}" data-relative="${q}" class="${q % 4 === 1 ? 'year-start' : ''} ${q === guideQuarter ? 'horizon-row' : ''}">${rowIndex === 0 ? `<th class="age year ${group.quarters.at(-1) === guideQuarter ? 'horizon-year' : ''}" scope="rowgroup" rowspan="${group.quarters.length}"><span class="year-number">${group.year}</span></th>` : ''}<th class="age age-quarter" scope="row">Q${((q - 1) % 4) + 1}<small>${q}</small>${q === guideQuarter ? `<span class="guide-slot"><span class="guide-label">After year ${guideYear}</span></span>` : ''}</th>${models.map((m) => metrics.map((metric, mi) => cellHtml(m, cellAt(m, q), metric, mi)).join('')).join('')}</tr>`).join('')}</tbody>`,
    )
    .join('')}</table>`;
}
function cellHtml(m: MatrixModel, c: MatrixCell, metric: Metric, mi: number) {
  const value = c.metrics[metric],
    info = stateInfo(c.state);
  const observed = c.state === 'eligible' || c.state === 'reference_observed';
  const text = observed ? formatMetric(value, metric) : info.label;
  const unit =
    observed && value !== null
      ? metric === 'afr'
        ? ' percent'
        : metric === 'afrDelta'
          ? ' percentage points'
          : ''
      : '';
  const detail = `${m.name}, relative quarter ${c.relativeQuarter}, ${quarter(c.quarter)}, ${labelForMetric(mi)}: ${text}${unit}. ${info.description}`;
  return `<td data-render-key="cell-${esc(m.id)}-${metric}" class="${mi < 2 ? 'metric-rate' : 'metric-count'} ${mi === 0 ? 'model-start' : ''} ${observed ? 'observed' : `unavailable state-${c.state}`}"><button id="${controlId('cell', `${m.id}-${c.relativeQuarter}-${metric}`)}" class="matrix-cell" tabindex="${c.relativeQuarter === 1 && mi === 0 ? '0' : '-1'}" data-cell="${esc(m.id)}" data-q="${c.relativeQuarter}" data-metric="${metric}" style="${neutral || !observed ? '' : `background:${heatmapPaint(interpolate(value, snapshot.domains[metric])).background};color:${heatmapPaint(interpolate(value, snapshot.domains[metric])).foreground}`}" aria-label="${esc(detail)}" aria-controls="matrix-inspector" title="${esc(detail)}">${observed ? `<span class="numeric-field" style="width:var(--field-${metric})">${metric === 'afrDelta' && value !== null && deltaDisplay(value).reserveSign ? '<span class="pp-sign-space" aria-hidden="true">−</span>' : ''}${esc(text)}</span>` : esc(text)}</button></td>`;
}
function inspector() {
  const { model: m, cell: c, metric } = selection!;
  const mi = metrics.indexOf(metric),
    value = c.metrics[metric];
  const component = (label: string, v: MatrixCell['quarterComponents']) =>
    `<div><dt>${label}</dt><dd>${v ? `${v.failures.toLocaleString()} ${failureUnit()} / ${v.driveDays.toLocaleString()} recorded drive-days${v.complete ? '' : ' · incomplete'}` : snapshot.rateLabel ? 'Unavailable: no recorded components for this position' : 'Unknown in workbook'}</dd></div>`;
  const baseline = c.deltaBaseline;
  return `<div class="inspector-title"><div><p class="eyebrow">CELL INSPECTOR · ${esc(stateInfo(c.state).label)}</p><h2><span class="model-id">${esc(m.name)}</span> <small>${esc(m.vendor)}</small></h2></div><strong>${esc(labelForMetric(mi))}: ${value === null ? 'Unavailable' : esc(c.raw?.[mi] ?? value)} ${metric === 'afr' ? '%' : metric === 'afrDelta' ? 'pp' : 'drives / flags'}</strong></div><p>${esc(stateInfo(c.state).description)}</p><dl class="inspector-grid"><div><dt>Relative position</dt><dd>Year ${Math.ceil(c.relativeQuarter / 4)} · Q${((c.relativeQuarter - 1) % 4) + 1} · quarter ${c.relativeQuarter}</dd></div><div><dt>Actual calendar quarter</dt><dd>${quarter(c.quarter)}</dd></div><div><dt>Anchor / last eligible</dt><dd>${quarter(m.anchor)} / ${quarter(m.finalEligible)}</dd></div><div><dt>As-of cutoff / source coverage</dt><dd>${snapshot.cutoff ?? 'Unknown in workbook'} / ${esc(c.coverage ?? 'Unknown in workbook')}</dd></div>${component('Current-quarter exposure', c.quarterComponents)}${component(snapshot.rateLabel ? 'Cumulative recorded exposure' : 'Cumulative exposure', c.cumulativeComponents)}${component(snapshot.rateLabel ? 'Pre-anchor recorded contribution' : 'Pre-eligibility contribution', m.preEligibility)}<div><dt>Quarter-only AFR (detail only)</dt><dd>${c.quarterAfr == null ? 'Unavailable' : `${esc(c.quarterAfr)}%`}</dd></div><div><dt>Delta baseline / span</dt><dd>${snapshot.kind === 'reference' ? (c.state !== 'reference_observed' ? 'Unknown for blank row' : c.relativeQuarter === 1 ? 'Initialization: subtract zero' : `Previous retained row (${c.relativeQuarter - 1}); elapsed calendar span unknown`) : initializedBaselineLabel(baseline) ? esc(initializedBaselineLabel(baseline)) : baseline ? `${esc(baseline.kind)} · ${baseline.priorQuarter ? quarter(baseline.priorQuarter) : 'initial zero'} · ${baseline.elapsedQuarters ?? 'initial'} quarter span · AFR ${empty(baseline.afr)}%, Count ${empty(baseline.count)}` : 'Not applicable to unavailable row'}</dd></div><div><dt>Rate availability / retirement</dt><dd>${esc(c.rateUnavailableReason ?? (snapshot.kind === 'reference' ? 'Unknown workbook components' : 'Available'))} / ${esc(c.retirementInference ?? 'Unknown workbook inference/proxy status')}</dd></div>${c.observations ? `<div><dt>Inspector observations (not display metrics)</dt><dd>Count ${empty(c.observations.count)} · New ${empty(c.observations.new)} · Retired ${empty(c.observations.retired)} · Failed ${empty(c.observations.failed)}</dd></div>` : ''}${c.productionEvidence?.map((detail) => `<div><dt>${esc(detail.label)}</dt><dd>${esc(detail.value)}</dd></div>`).join('') ?? ''}<div><dt>Snapshot / source cell</dt><dd>${esc(snapshot.id)} · ${esc(c.coordinates?.[mi] ?? 'Aggregate contract cell')}</dd></div></dl><p>${snapshot.kind === 'reference' ? 'Cumulative AFR retains prior history. The workbook cannot establish the pre-eligibility failures or exposure; zero current Failed does not establish zero earlier losses.' : `AFR = cumulative ${failureUnit()} ÷ cumulative recorded drive-days × 365 × 100. Reentry keeps the original calendar anchor; unavailable cumulative rates never become zero.`}</p><p class="matrix-hash">${snapshot.kind === 'production' ? 'BACKBLAZE OBSERVED HISTORY · ' : snapshot.sourceUrl ? `<a href="${esc(snapshot.sourceUrl)}">Source workbook ↗</a> · ` : 'SYNTHETIC SAMPLE · '}SHA-256 / manifest ${esc(snapshot.sourceHash)}</p>`;
}
function legend() {
  return `<details class="matrix-legend" id="matrix-legend"><summary>Shared snapshot color scales · ${snapshot.models.length} full model blocks</summary><p>Colors compare all numeric eligible cells in this snapshot. Warm AFR flags higher rates; green Count means larger observed population. Vendor header colors identify categories only. Numeric values remain visible; neutral mode removes metric colors. High contrast display preserves thresholds.</p><div class="legend-grid">${metrics
    .map((m, i) => {
      const d = snapshot.domains[m];
      return `<article><strong>${labelForMetric(i)}${m === 'afr' ? ' (%)' : m === 'afrDelta' ? ' (pp)' : ''}</strong><div class="legend-swatches">${d.knots.map((k) => `<span style="background:${heatmapPaint(k.color).background};color:${heatmapPaint(k.color).foreground}">${formatMetric(k.value, m)}</span>`).join('')}</div><small>n=${d.sampleCount} · min ${empty(d.observedMinimum)} · P50 ${empty(d.observedMedian)} · max ${empty(d.observedMaximum)}</small></article>`;
    })
    .join(
      '',
    )}</div><p>Inclusive P50 uses (n − 1) × 0.5 with interpolation. Encoded sRGB channels interpolate linearly, rounded to nearest integer, exact halves upward; values clamp at scale endpoints. AFR clamps red at 2%. No-data cells use state labels, never a low-value color.</p></details>`;
}
function highlight(q: number) {
  app
    .querySelectorAll('tr[data-relative]')
    .forEach((row) =>
      row.classList.toggle('active-relative', Number((row as HTMLElement).dataset.relative) === q),
    );
}
function inspect(button: HTMLButtonElement) {
  const model = snapshot.models.find((m) => m.id === button.dataset.cell)!;
  activeRow = Number(button.dataset.q);
  selection = { model, cell: cellAt(model, activeRow), metric: button.dataset.metric as Metric };
  patchContent(app.querySelector<HTMLElement>('#matrix-inspector')!, inspector());
  highlight(activeRow);
  if (document.activeElement === button) {
    app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => {
      cell.tabIndex = cell === button ? 0 : -1;
    });
  }
}
function bind() {
  app.querySelector<HTMLElement>('#matrix-snapshot')!.onchange = (event) => {
    void changeSnapshot((event.target as HTMLSelectElement).value);
  };
  app.querySelector<HTMLElement>('#matrix-search')!.oninput = (event) => {
    search = (event.target as HTMLInputElement).value;
    render();
  };
  app.querySelector<HTMLElement>('#matrix-guide')!.onchange = (event) => {
    const year = Number((event.target as HTMLSelectElement).value);
    guideYear = Number.isInteger(year) && year >= 1 && year <= 6 ? year : 6;
    render();
  };
  app.querySelector<HTMLElement>('#matrix-neutral')!.onchange = (event) => {
    neutral = !(event.target as HTMLInputElement).checked;
    render();
  };
  app.querySelector<HTMLElement>('#matrix-select-all')!.onclick = () =>
    updateSelected(new Set(snapshot.models.map((model) => model.id)));
  app.querySelector<HTMLElement>('#matrix-clear')!.onclick = () => updateSelected(new Set());
  app.querySelectorAll<HTMLInputElement>('[data-vendor]').forEach((input) => {
    const models = snapshot.models.filter((model) => model.vendor === input.dataset.vendor);
    input.indeterminate = vendorSelectionState(models, selected).indeterminate;
    input.onchange = () =>
      updateSelected(
        setVendorSelected(snapshot.models, input.dataset.vendor!, selected, input.checked),
      );
  });
  app.querySelectorAll<HTMLInputElement>('[data-model]').forEach(
    (input) =>
      (input.onchange = () => {
        const next = new Set(selected);
        if (input.checked) {
          next.add(input.dataset.model!);
        } else {
          next.delete(input.dataset.model!);
        }
        updateSelected(next);
      }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-story]').forEach(
    (button) =>
      (button.onclick = () => {
        const story = stories.find((item) => item.id === button.dataset.story)!;
        search = '';
        selection = undefined;
        activeRow = 0;
        updateSelected(new Set(story.models));
        const viewport = app.querySelector<HTMLElement>('.matrix-scroll')!;
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
        viewport.focus({ preventScroll: true });
        app
          .querySelector<HTMLElement>('.matrix-workspace')!
          .scrollIntoView({ block: 'start', behavior: 'instant' });
      }),
  );
  app.querySelectorAll<HTMLTableRowElement>('tr[data-relative]').forEach(
    (row) =>
      (row.onmouseleave = () => {
        if (activeRow === Number(row.dataset.relative)) {
          activeRow = 0;
          highlight(0);
        }
      }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((button) => {
    button.onfocus = button.onclick = button.onmouseenter = () => inspect(button);
    button.onkeydown = (event) => {
      const tr = button.closest('tr')!,
        buttons = [...tr.querySelectorAll<HTMLButtonElement>('[data-cell]')],
        index = buttons.indexOf(button);
      let target: HTMLButtonElement | undefined;
      if (event.key === 'ArrowRight') {
        target = buttons[index + 1];
      }
      if (event.key === 'ArrowLeft') {
        target = buttons[index - 1];
      }
      if (event.key === 'Home') {
        target = buttons[0];
      }
      if (event.key === 'End') {
        target = buttons.at(-1);
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const q = Number(button.dataset.q) + (event.key === 'ArrowDown' ? 1 : -1);
        target = app
          .querySelector<HTMLButtonElement>(`tr[data-relative="${q}"]`)
          ?.querySelectorAll<HTMLButtonElement>('[data-cell]')[index];
      }
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };
  });
}

function initializedBaselineLabel(baseline: MatrixCell['deltaBaseline']): string | null {
  return baseline?.kind === 'initial_subtract_zero'
    ? 'First eligible deltas subtract synthetic zero: AFR 0%, Count 0. This is not a prior observed quarter; elapsed span is not applicable.'
    : baseline?.kind === 'initial_zero_delta'
      ? 'Deltas initialized to zero. Prior AFR/Count baseline and elapsed span: not applicable.'
      : null;
}
