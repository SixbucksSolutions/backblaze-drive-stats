import './matrix.css';
import { deltaDisplay, metricFieldWidths, yearRowGroups } from './matrix-display.ts';
import { patchContent } from './matrix-render.ts';
import { heatmapPaint } from './matrix-contrast.ts';
import { vendorPaint } from './matrix-brand.ts';
import q3 from '../../fixtures/workbooks/2025-Q3.json?url';
import q4 from '../../fixtures/workbooks/2025-Q4.json?url';
import earlier from '../../fixtures/matrix/synthetic-earlier.json?url';
import later from '../../fixtures/matrix/synthetic-later.json?url';
import correction from '../../fixtures/matrix/synthetic-correction.json?url';
import xyz from '../../fixtures/matrix/synthetic-new-manufacturer.json?url';
import storyUrl from '../../fixtures/workbooks/owner-stories.json?url';
import { adaptProduction, adaptWorkbook, axisExtent, cellAt, formatMetric, interpolate, metrics, metricLabels, stateInfo, visibleModels } from './matrix-data.ts';
import type { MatrixSnapshot, MatrixModel, MatrixCell, Metric } from './matrix-data.ts';
import { captureControlFocus, controlId, restoreControlFocus } from './matrix-focus.ts';

const files = [q4, q3, later, earlier, correction, xyz];
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const quarter = (value: string | null | undefined) => value ? value.replace('-Q', ' Q') : 'Unknown in workbook';
let snapshots: MatrixSnapshot[] = [];
let snapshot: MatrixSnapshot;
let stories: { id: string; models: string[]; owner_reading: string }[] = [];
let vendor = 'all', search = '', guide = 20, neutral = false, onlyPinned = false;
let pinned = new Set<string>(), selected = new Set<string>();
let selection: { model: MatrixModel; cell: MatrixCell; metric: Metric } | undefined;
let activeRow = 0;
const app = document.querySelector<HTMLDivElement>('#app')!;
const empty = (value: unknown) => value === null || value === undefined ? 'Unavailable' : esc(value);

export async function initMatrix(signal?: AbortSignal) {
  signal?.throwIfAborted();
  document.title = 'Drive Stats — Matrix reference preview';
  app.innerHTML = '<div class="matrix-loading" role="status">Loading comparison references…</div>';
  try {
    const [loaded, storyData] = await Promise.all([Promise.all(files.map(async url => { const response = await fetch(url, { signal }); if (!response.ok) throw new Error('A comparison fixture could not be loaded.'); const data = await response.json(); return data.schema ? adaptWorkbook(data) : adaptProduction(data); })), fetch(storyUrl, { signal }).then(r => { if (!r.ok) throw new Error('Owner reading cases could not be loaded.'); return r.json(); })]);
    signal?.throwIfAborted();
    snapshots = loaded; stories = storyData.stories;
    const id = new URLSearchParams(location.search).get('snapshot');
    snapshot = snapshots.find(s => s.id === id) ?? snapshots[0]!;
    selected = new Set(snapshot.models.map(m => m.id));
    render();
  } catch (error) { if (signal?.aborted) throw error; app.innerHTML = `<div class="matrix-loading" role="alert"><h1>Comparison preview unavailable</h1><p>${esc(error instanceof Error ? error.message : error)}</p><a href="?">Return to Explore</a></div>`; }
}
function groups(models: MatrixModel[]) {
  const result: { vendor: string; count: number; pinned: boolean }[] = [];
  for (const m of models) { const last = result.at(-1); if (last?.vendor === m.vendor && last.pinned === pinned.has(m.id)) last.count++; else result.push({ vendor: m.vendor, count: 1, pinned: pinned.has(m.id) }); }
  return result;
}
function render() {
  const savedFocus = captureControlFocus(document.activeElement as HTMLElement | null);
  const focusedElement = document.activeElement;
  const scroll = app.querySelector('.matrix-scroll');
  const left = scroll?.scrollLeft ?? 0, top = scroll?.scrollTop ?? 0;
  const models = visibleModels(snapshot, vendor, search, pinned, selected, onlyPinned);
  patchContent(app, `<div class="matrix-page"><header class="matrix-top"><a class="matrix-brand" href="?">▰ DriveStats <span>BY SIXBUCKSSOLUTIONS</span></a><a href="?">Explore calendar-quarter reports ↗</a></header>
  <section class="matrix-heading"><div><p class="eyebrow">THE FULL TRAJECTORY</p><h1>Reliability through deployment history.</h1><p>Compare cumulative AFR, population and turnover together. Each model keeps its seven workbook columns.</p></div><label class="snapshot-control">AS-OF EVIDENCE<select id="matrix-snapshot">${snapshots.map(s => `<option value="${esc(s.id)}" ${s === snapshot ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label></section>
  <aside class="matrix-notice ${snapshot.kind}"><strong>${snapshot.kind === 'reference' ? 'WORKBOOK REFERENCE · NOT A PRODUCTION SNAPSHOT' : 'SYNTHETIC SAMPLE · INVENTED FIGURES'}</strong><span>${esc(snapshot.notice)}</span></aside>
  <div class="matrix-source">Dataset and reports: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a> · <a href="https://www.backblaze.com/blog/category/hard-drive-stats/">Official reports</a> · Independent analysis by <a href="https://github.com/SixbucksSolutions">SixbucksSolutions</a>. Software MIT; dataset retains its own terms.</div>
  <section class="matrix-tools" aria-label="Comparison controls"><div class="matrix-filters"><label>Find models<input id="matrix-search" type="search" value="${esc(search)}" placeholder="Model number or vendor"></label><label>Vendor<select id="matrix-vendor"><option value="all">All vendors</option>${[...new Set(snapshot.models.map(m => m.vendor))].map(v => `<option ${v === vendor ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>Guide after quarter<input id="matrix-guide" type="number" min="1" max="80" value="${guide}"></label><label class="matrix-check"><input id="matrix-neutral" type="checkbox" ${neutral ? 'checked' : ''}>Neutral colors</label><label class="matrix-check"><input id="matrix-pinned-only" type="checkbox" ${onlyPinned ? 'checked' : ''}>Pinned only (${pinned.size})</label><button id="matrix-reset">Reset selection</button></div>
  <details class="model-picker"><summary>Choose models & pin comparisons <span>${models.length} of ${snapshot.models.length} shown</span></summary><p>Pinned models stay together at the left, across filters. Pinning does not freeze columns or change the snapshot color scales.</p><div>${snapshot.models.map(m => `<label><input type="checkbox" id="${controlId('model', m.id)}" data-model="${esc(m.id)}" ${selected.has(m.id) ? 'checked' : ''}><span class="model-id">${esc(m.name)}</span> <small>${esc(m.vendor)}</small><button id="${controlId('picker-pin', m.id)}" data-pin="${esc(m.id)}" aria-pressed="${pinned.has(m.id)}" aria-label="${pinned.has(m.id) ? 'Unpin' : 'Pin'} ${esc(m.name)}">${pinned.has(m.id) ? '★ Pinned' : '☆ Pin'}</button></label>`).join('')}</div></details>
  ${snapshot.kind === 'reference' ? `<details class="matrix-stories"><summary>Owner reading cases · all eight reference stories</summary><p>Historical owner interpretations, not automated rankings or purchase recommendations. Select a case to place its exact models together.</p><div>${stories.map(s => `<button id="${controlId('story', s.id)}" data-story="${esc(s.id)}"><strong>${esc(s.models.join(' / '))}</strong><span>${esc(s.owner_reading)}</span></button>`).join('')}</div></details>` : ''}</section>
  <section class="matrix-workspace"><div class="matrix-caption"><div><strong>${models.length} models · ${esc(snapshot.label)}</strong><span>${snapshot.kind === 'reference' ? 'Relative retained-row positions' : 'Calendar offsets from first ≥2,000-drive quarter'} · guides follow Q${guide} and Q24 · scroll for the full history</span></div><a href="#matrix-legend">Color legend ↓</a></div>
  <p class="matrix-instruction" id="matrix-help">Focus, click or hover any value for details. Arrow keys move between cells; Home/End move across a row. The same relative row is outlined across models. Relative history is not individual drive age.</p>
  <div class="matrix-scroll" tabindex="0" role="region" aria-label="Deployment history matrix, scroll horizontally and vertically" aria-describedby="matrix-help">${models.length ? table(models) : '<div class="matrix-empty">No models match. Adjust filters, select a model, or reset selection.</div>'}</div>
  <div class="matrix-states">${['below_threshold', 'source_missing', 'source_incomplete', 'snapshot_end', 'trailing_blank_unknown'].map(s => `<span class="state-key state-${s}" title="${esc(stateInfo(s).description)}">${stateInfo(s).label}</span>`).join('')}<span>— on an eligible row = metric unavailable; inspect for the reason</span></div></section>
  <aside class="matrix-inspector" id="matrix-inspector" aria-label="Cell details">${selection ? inspector() : '<p class="eyebrow">CELL INSPECTOR</p><h2>Read a value in context.</h2><p>Focus, click or hover a matrix cell for its exact value, calendar context, exposure and baseline.</p>'}</aside>
  ${legend()}<details class="matrix-method"><summary>How to read this comparison & source context</summary><p>AFR is cumulative through the displayed quarter, in percent; AFR delta is in percentage points. Count means distinct drives observed anywhere in a quarter, not the installed population at quarter end. New means first seen in supplied history. Failed sums daily failure flags.</p><p>Retired is inferred from last observations and may include failures. A newest-quarter Failed proxy, when identified by production metadata, is provisional. Neither is proof of voluntary retirement or its cause. Large population and continuing additions provide deployment context, not a spending measurement.</p><p>All seven scales use the full eligible snapshot population. Filtering, selection, pinning and neutral colors never recalculate them. The malformed New source color is normalized to intended white. No composite ranking is calculated.</p><p>${snapshot.kind === 'reference' ? 'Workbook first-row deltas subtract zero; subsequent rows subtract the prior retained row. Calendar, pre-eligibility exposure and cutoff are unknown. Nonzero cumulative AFR with zero current Failed can reflect earlier contributions, but those components cannot be reconstructed here.' : 'Production examples retain real calendar offsets and the original anchor after reentry. Delta subtracts the prior eligible row and states its elapsed span. Pre-eligibility contributions remain in cumulative AFR; coverage gaps can make cumulative rates unavailable while Count remains known.'}</p><p>Guides after 20 and 24 quarters are deployment-history references for five and six years. They do not predict an individual drive’s lifetime or recommend a replacement date.</p><p>Snapshot: ${esc(snapshot.id)} · ${esc(snapshot.versions)}.</p><p class="matrix-hash">Source SHA-256 / manifest: ${esc(snapshot.sourceHash)}</p>${snapshot.sourceUrl ? `<a href="${esc(snapshot.sourceUrl)}">Original owner-supplied workbook ↗</a>` : '<p>Invented aggregate contract example; no observed Backblaze performance is represented.</p>'}</details>
  <footer>Local comparison preview · Production generation and primary navigation remain separately gated.<a href="${import.meta.env.BASE_URL}fonts/NOTICE.txt">Font credits & licenses</a><a href="?">Back to Explore ↗</a></footer></div>`);
  bind();
  const nextScroll = app.querySelector('.matrix-scroll'); if (nextScroll) { nextScroll.scrollLeft = left; nextScroll.scrollTop = top; }
  if (document.activeElement !== focusedElement) restoreControlFocus(savedFocus, id => document.getElementById(id));
  const focusedCell = document.activeElement;
  if (focusedCell instanceof HTMLButtonElement && focusedCell.dataset.cell) {
    app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(cell => { cell.tabIndex = cell === focusedCell ? 0 : -1; });
  }
  highlight(activeRow);
}
function table(models: MatrixModel[]) {
  const extent = axisExtent(snapshot, guide);
  const widths = metricFieldWidths(snapshot);
  return `<table class="comparison-matrix" style="${metrics.map(metric => `--field-${metric}:${widths[metric]}ch`).join(';')}"><caption class="sr-only">Seven adjacent metrics per model. Relative year and quarter down the left; vendor and model across the top.</caption><thead><tr class="vendor-row"><th rowspan="4" class="age year">Year</th><th rowspan="4" class="age age-quarter">Quarter</th>${groups(models).map(g => `<th colspan="${g.count * 7}" class="vendor-header" style="background:${vendorPaint(g.vendor).background};color:${vendorPaint(g.vendor).foreground}"><span class="vendor-label">${esc(g.vendor)}${g.pinned ? ' · PINNED COMPARISONS' : ''}</span></th>`).join('')}</tr>
  <tr class="model-row">${models.map(m => `<th colspan="7" class="model-header" data-render-key="model-${esc(m.id)}" style="background:${vendorPaint(m.vendor).background};color:${vendorPaint(m.vendor).foreground}"><span class="model-label-track"><span class="model-name">${esc(m.name)}</span></span><button id="${controlId('header-pin', m.id)}" data-pin="${esc(m.id)}" aria-pressed="${pinned.has(m.id)}" aria-label="${pinned.has(m.id) ? 'Unpin' : 'Pin'} ${esc(m.name)}">${pinned.has(m.id) ? '★ Pinned' : '☆ Pin'}</button></th>`).join('')}</tr>
  <tr class="family-row">${models.map(() => '<th colspan="2" class="model-start">AFR</th><th colspan="5">Drives</th>').join('')}</tr>
  <tr class="metric-row">${models.map(() => ['Value %', 'Delta pp', 'Count', 'Delta', 'New', 'Retired', 'Failed'].map((v, i) => `<th class="${i === 0 ? 'model-start' : ''} ${i < 2 ? 'metric-rate' : 'metric-count'}" title="${metricLabels[i]}">${v}</th>`).join('')).join('')}</tr></thead>${yearRowGroups(extent).map(group => `<tbody data-render-key="year-${group.year}">${group.quarters.map((q, rowIndex) => `<tr data-render-key="row-${q}" data-relative="${q}" class="${q % 4 === 1 ? 'year-start' : ''} ${q === guide || q === 24 ? 'horizon-row' : ''}">${rowIndex === 0 ? `<th class="age year ${group.quarters.at(-1) === guide || group.quarters.at(-1) === 24 ? 'horizon-year' : ''}" scope="rowgroup" rowspan="${group.quarters.length}"><span class="year-number">${group.year}</span></th>` : ''}<th class="age age-quarter" scope="row">Q${(q - 1) % 4 + 1}<small>${q}</small>${q === guide || q === 24 ? `<span class="guide-label">After Q${q}${q === 20 ? ' · 5y' : q === 24 ? ' · 6y' : ''}</span>` : ''}</th>${models.map(m => metrics.map((metric, mi) => cellHtml(m, cellAt(m, q), metric, mi)).join('')).join('')}</tr>`).join('')}</tbody>`).join('')}</table>`;
}
function cellHtml(m: MatrixModel, c: MatrixCell, metric: Metric, mi: number) {
  const value = c.metrics[metric], info = stateInfo(c.state);
  const observed = c.state === 'eligible' || c.state === 'reference_observed';
  const text = observed ? formatMetric(value, metric) : info.label;
  const unit = observed && value !== null ? metric === 'afr' ? ' percent' : metric === 'afrDelta' ? ' percentage points' : '' : '';
  const detail = `${m.name}, relative quarter ${c.relativeQuarter}, ${quarter(c.quarter)}, ${metricLabels[mi]}: ${text}${unit}. ${info.description}`;
  return `<td data-render-key="cell-${esc(m.id)}-${metric}" class="${mi < 2 ? 'metric-rate' : 'metric-count'} ${mi === 0 ? 'model-start' : ''} ${observed ? 'observed' : `unavailable state-${c.state}`}"><button id="${controlId('cell', `${m.id}-${c.relativeQuarter}-${metric}`)}" class="matrix-cell" tabindex="${c.relativeQuarter === 1 && mi === 0 ? '0' : '-1'}" data-cell="${esc(m.id)}" data-q="${c.relativeQuarter}" data-metric="${metric}" style="${neutral || !observed ? '' : `background:${heatmapPaint(interpolate(value, snapshot.domains[metric])).background};color:${heatmapPaint(interpolate(value, snapshot.domains[metric])).foreground}`}" aria-label="${esc(detail)}" aria-controls="matrix-inspector" title="${esc(detail)}">${observed ? `<span class="numeric-field" style="width:var(--field-${metric})">${metric === 'afrDelta' && value !== null && deltaDisplay(value).reserveSign ? '<span class="pp-sign-space" aria-hidden="true">−</span>' : ''}${esc(text)}</span>` : esc(text)}</button></td>`;
}
function inspector() {
  const { model: m, cell: c, metric } = selection!;
  const mi = metrics.indexOf(metric), value = c.metrics[metric];
  const component = (label: string, v: MatrixCell['quarterComponents']) => `<div><dt>${label}</dt><dd>${v ? `${v.failures.toLocaleString()} failure flags / ${v.driveDays.toLocaleString()} recorded drive-days${v.complete ? '' : ' · incomplete'}` : 'Unknown in workbook'}</dd></div>`;
  const baseline = c.deltaBaseline;
  return `<div class="inspector-title"><div><p class="eyebrow">CELL INSPECTOR · ${esc(stateInfo(c.state).label)}</p><h2><span class="model-id">${esc(m.name)}</span> <small>${esc(m.vendor)}</small></h2></div><strong>${esc(metricLabels[mi])}: ${value === null ? 'Unavailable' : esc(c.raw?.[mi] ?? value)} ${metric === 'afr' ? '%' : metric === 'afrDelta' ? 'pp' : 'drives / flags'}</strong></div><p>${esc(stateInfo(c.state).description)}</p><dl class="inspector-grid"><div><dt>Relative position</dt><dd>Year ${Math.ceil(c.relativeQuarter / 4)} · Q${(c.relativeQuarter - 1) % 4 + 1} · quarter ${c.relativeQuarter}</dd></div><div><dt>Actual calendar quarter</dt><dd>${quarter(c.quarter)}</dd></div><div><dt>Anchor / last eligible</dt><dd>${quarter(m.anchor)} / ${quarter(m.finalEligible)}</dd></div><div><dt>As-of cutoff / source coverage</dt><dd>${snapshot.cutoff ?? 'Unknown in workbook'} / ${esc(c.coverage ?? 'Unknown in workbook')}</dd></div>${component('Current-quarter exposure', c.quarterComponents)}${component('Cumulative exposure', c.cumulativeComponents)}${component('Pre-eligibility contribution', m.preEligibility)}<div><dt>Quarter-only AFR (detail only)</dt><dd>${c.quarterAfr == null ? 'Unavailable' : `${esc(c.quarterAfr)}%`}</dd></div><div><dt>Delta baseline / span</dt><dd>${snapshot.kind === 'reference' ? c.state !== 'reference_observed' ? 'Unknown for blank row' : c.relativeQuarter === 1 ? 'Initialization: subtract zero' : `Previous retained row (${c.relativeQuarter - 1}); elapsed calendar span unknown` : baseline ? `${esc(baseline.kind)} · ${baseline.priorQuarter ? quarter(baseline.priorQuarter) : 'initial zero'} · ${baseline.elapsedQuarters ?? 'initial'} quarter span · AFR ${empty(baseline.afr)}%, Count ${empty(baseline.count)}` : 'Not applicable to unavailable row'}</dd></div><div><dt>Rate availability / retirement</dt><dd>${esc(c.rateUnavailableReason ?? (snapshot.kind === 'reference' ? 'Unknown workbook components' : 'Available'))} / ${esc(c.retirementInference ?? 'Unknown workbook inference/proxy status')}</dd></div>${c.observations ? `<div><dt>Inspector observations (not display metrics)</dt><dd>Count ${empty(c.observations.count)} · New ${empty(c.observations.new)} · Retired ${empty(c.observations.retired)} · Failed ${empty(c.observations.failed)}</dd></div>` : ''}<div><dt>Snapshot / source cell</dt><dd>${esc(snapshot.id)} · ${esc(c.coordinates?.[mi] ?? 'Aggregate contract cell')}</dd></div></dl><p>${snapshot.kind === 'reference' ? 'Cumulative AFR retains prior history. The workbook cannot establish the pre-eligibility failures or exposure; zero current Failed does not establish zero earlier losses.' : 'AFR = cumulative failure flags ÷ cumulative recorded drive-days × 365 × 100. Reentry keeps the original calendar anchor; unavailable cumulative rates never become zero.'}</p><p class="matrix-hash">${snapshot.sourceUrl ? `<a href="${esc(snapshot.sourceUrl)}">Source workbook ↗</a> · ` : 'SYNTHETIC SAMPLE · '}SHA-256 / manifest ${esc(snapshot.sourceHash)}</p>`;
}
function legend() {
  return `<details class="matrix-legend" id="matrix-legend"><summary>Shared snapshot color scales · ${snapshot.models.length} full model blocks</summary><p>Colors compare all numeric eligible cells in this snapshot. Warm AFR flags higher rates; green Count means larger observed population. Vendor header colors identify categories only. Numeric values remain visible; neutral mode removes metric colors. High contrast display preserves thresholds.</p><div class="legend-grid">${metrics.map((m, i) => { const d = snapshot.domains[m]; return `<article><strong>${metricLabels[i]}${m === 'afr' ? ' (%)' : m === 'afrDelta' ? ' (pp)' : ''}</strong><div class="legend-swatches">${d.knots.map(k => `<span style="background:${heatmapPaint(k.color).background};color:${heatmapPaint(k.color).foreground}">${formatMetric(k.value, m)}</span>`).join('')}</div><small>n=${d.sampleCount} · min ${empty(d.observedMinimum)} · P50 ${empty(d.observedMedian)} · max ${empty(d.observedMaximum)}</small></article>`; }).join('')}</div><p>Inclusive P50 uses (n − 1) × 0.5 with interpolation. Encoded sRGB channels interpolate linearly, rounded to nearest integer, exact halves upward; values clamp at scale endpoints. AFR clamps red at 2%. No-data cells use state labels, never a low-value color.</p></details>`;
}
function highlight(q: number) { app.querySelectorAll('tr[data-relative]').forEach(row => row.classList.toggle('active-relative', Number((row as HTMLElement).dataset.relative) === q)); }
function inspect(button: HTMLButtonElement) {
  const model = snapshot.models.find(m => m.id === button.dataset.cell)!;
  activeRow = Number(button.dataset.q); selection = { model, cell: cellAt(model, activeRow), metric: button.dataset.metric as Metric };
  patchContent(app.querySelector<HTMLElement>('#matrix-inspector')!, inspector()); highlight(activeRow);
  if (document.activeElement === button) { app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(cell => { cell.tabIndex = cell === button ? 0 : -1; }); }
}
function bind() {
  app.querySelector<HTMLElement>('#matrix-snapshot')!.onchange = event => { snapshot = snapshots.find(s => s.id === (event.target as HTMLSelectElement).value)!; selected = new Set(snapshot.models.map(m => m.id)); pinned = new Set([...pinned].filter(id => snapshot.models.some(m => m.id === id))); vendor = 'all'; search = ''; onlyPinned = false; selection = undefined; activeRow = 0; const url = new URL(location.href); url.searchParams.set('snapshot', snapshot.id); history.replaceState(null, '', url); render(); };
  app.querySelector<HTMLElement>('#matrix-search')!.oninput = event => { search = (event.target as HTMLInputElement).value; render(); };
  app.querySelector<HTMLElement>('#matrix-vendor')!.onchange = event => { vendor = (event.target as HTMLSelectElement).value; render(); };
  app.querySelector<HTMLElement>('#matrix-guide')!.onchange = event => { guide = Math.min(80, Math.max(1, Math.trunc(Number((event.target as HTMLInputElement).value)) || 20)); render(); };
  app.querySelector<HTMLElement>('#matrix-neutral')!.onchange = event => { neutral = (event.target as HTMLInputElement).checked; render(); };
  app.querySelector<HTMLElement>('#matrix-pinned-only')!.onchange = event => { onlyPinned = (event.target as HTMLInputElement).checked; render(); };
  app.querySelector<HTMLElement>('#matrix-reset')!.onclick = () => { vendor = 'all'; search = ''; selected = new Set(snapshot.models.map(m => m.id)); pinned.clear(); onlyPinned = false; render(); };
  app.querySelectorAll<HTMLInputElement>('[data-model]').forEach(input => input.onchange = () => { if (input.checked) selected.add(input.dataset.model!); else { selected.delete(input.dataset.model!); pinned.delete(input.dataset.model!); } render(); });
  app.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach(button => button.onclick = () => { const id = button.dataset.pin!; if (pinned.has(id)) pinned.delete(id); else { pinned.add(id); selected.add(id); } render(); });
  app.querySelectorAll<HTMLButtonElement>('[data-story]').forEach(button => button.onclick = () => { const s = stories.find(s => s.id === button.dataset.story)!; selected = new Set(s.models); pinned = new Set(s.models); onlyPinned = true; vendor = 'all'; search = ''; selection = undefined; render(); });
  app.querySelectorAll<HTMLTableRowElement>('tr[data-relative]').forEach(row => row.onmouseleave = () => {
    if (activeRow === Number(row.dataset.relative)) { activeRow = 0; highlight(0); }
  });
  app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach(button => { button.onfocus = button.onclick = button.onmouseenter = () => inspect(button); button.onkeydown = event => { const tr = button.closest('tr')!, buttons = [...tr.querySelectorAll<HTMLButtonElement>('[data-cell]')], index = buttons.indexOf(button); let target: HTMLButtonElement | undefined; if (event.key === 'ArrowRight') target = buttons[index + 1]; if (event.key === 'ArrowLeft') target = buttons[index - 1]; if (event.key === 'Home') target = buttons[0]; if (event.key === 'End') target = buttons.at(-1); if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { const q = Number(button.dataset.q) + (event.key === 'ArrowDown' ? 1 : -1); target = app.querySelector<HTMLButtonElement>(`tr[data-relative="${q}"]`)?.querySelectorAll<HTMLButtonElement>('[data-cell]')[index]; } if (target) { event.preventDefault(); target.focus(); } }; });
}
