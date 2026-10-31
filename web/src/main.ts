import './style.css';
import { waitForFonts, waitForPresentation, withStartupDeadline } from './font-ready.ts';
import { csv, groupManufacturers, parseBundle, parseManifest, summarize } from './data.ts';
import type { Bundle, Manifest, Model, Quarter } from './data.ts';

type View = 'reliability' | 'deployments' | 'distribution' | 'capacity' | 'manufacturers' | 'datacenters';
type SortKey = keyof Model;
const views: { id: View; label: string; icon: string; title: string; description: string }[] = [
  { id: 'reliability', label: 'Reliability', icon: '◴', title: 'Reliability, in perspective.', description: 'Explore failure rates alongside the population and exposure behind them.' },
  { id: 'deployments', label: 'Deployments', icon: '↗', title: 'What joined the fleet?', description: 'First-observed drives by model, within the available source history.' },
  { id: 'distribution', label: 'Drive mix', icon: '▥', title: 'A closer look at the fleet.', description: 'Distinct drives observed during the selected quarter, grouped by model.' },
  { id: 'capacity', label: 'Total capacity', icon: '▱', title: 'Capacity over time.', description: 'Raw capacity represented by distinct drives observed in each quarter.' },
  { id: 'manufacturers', label: 'By manufacturer', icon: '▦', title: 'The manufacturers behind the fleet.', description: 'Compare raw capacity and drive populations across manufacturers.' },
  { id: 'datacenters', label: 'By datacenter', icon: '◎', title: 'Where the capacity lives.', description: 'Quarterly capacity by each drive’s last observed datacenter in the quarter.' },
];
const params = new URLSearchParams(location.search);
let view: View = views.find(item => item.id === params.get('view'))?.id ?? 'reliability';
let manifest: Manifest;
let bundle: Bundle | undefined;
let selectedQuarter = '';
let manufacturer = 'all';
let search = '';
let minimum = 0;
let afrMode: 'quarterlyAfr' | 'cumulativeAfr' = 'quarterlyAfr';
let sortKey: SortKey = 'driveCount';
let sortDirection = -1;
let loading = true;
let loadError = '';
let controller: AbortController | undefined;
let requestId = 0;
const cache = new Map<Quarter, Bundle>();
const app = document.querySelector<HTMLDivElement>('#app')!;
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const pct = (value: number) => `${value.toFixed(2)}%`;
const capacity = (tb: number) => tb >= 1_000_000 ? `${decimal.format(tb / 1_000_000)} EB` : `${decimal.format(tb / 1000)} PB`;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const labelQuarter = (quarter: string) => `${quarter.slice(0, 4)} · ${quarter.slice(5)}`;
const color = (name: string) => name.startsWith('Seagate') ? '#187d72' : name.startsWith('Toshiba') ? '#bc743f' : name.startsWith('W') || name.startsWith('HGST') ? '#607da3' : '#6b807b';
const filteredModels = () => (bundle?.models ?? []).filter(row => (manufacturer === 'all' || row.manufacturer === manufacturer) && row.driveCount >= minimum && `${row.manufacturer} ${row.model}`.toLowerCase().includes(search.toLowerCase()));
function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.set('quarter', selectedQuarter);
  url.searchParams.set('view', view);
  history.replaceState(null, '', url);
}
function nav() {
  return `<aside class="sidebar"><a class="brand" href="${escape(import.meta.env.BASE_URL)}"><span class="brand-mark" aria-hidden="true">▰</span><span>Drive<span class="brand-light">Stats</span><small>THE QUARTERLY EXPLORER</small></span></a><p class="nav-label">EXPLORE THE DATA</p><nav aria-label="Report views">${views.map(item => `<button class="nav-item ${item.id === view ? 'active' : ''}" data-view="${item.id}" ${item.id === view ? 'aria-current="page"' : ''}><span aria-hidden="true">${item.icon}</span>${item.label}</button>`).join('')}</nav><div class="sidebar-foot"><span class="status-dot"></span>Static by design<p>Built on open data.<br>Made for a closer look.</p><a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data" target="_blank" rel="noreferrer">Backblaze source data ↗</a></div></aside>`;
}
function render() {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const focusSelector = active?.id ? `#${CSS.escape(active.id)}` : active?.dataset.view ? `[data-view="${active.dataset.view}"]` : active?.dataset.afr ? `[data-afr="${active.dataset.afr}"]` : active?.dataset.sort ? `[data-sort="${active.dataset.sort}"]` : undefined;
  const focusLink = active?.matches('a, summary') ? { tag: active.tagName, href: active.getAttribute('href'), text: active.textContent } : undefined;
  const methodologyOpen = document.querySelector<HTMLDetailsElement>('#methodology')?.open ?? false;
  const currentView = views.find(item => item.id === view)!;
  const sample = bundle?.provenance.kind === 'sample' || manifest?.quarters.find(item => item.quarter === selectedQuarter)?.kind === 'sample';
  const populationLabel = bundle?.provenance.notes.some(note => note.startsWith('Model-selection regex filters')) ? 'Selected drive models.' : 'All source models.';
  app.innerHTML = `<div class="layout">${nav()}<main id="main"><header class="topbar"><span>BACKBLAZE DRIVE STATS <span class="slash">/</span> ${escape(currentView.label)}</span><span class="local-label"><span class="status-dot"></span> QUARTERLY DATA EXPLORER</span></header><div class="page"><section class="page-heading"><div><p class="eyebrow">THE BIG PICTURE, DOWN TO THE DRIVE</p><h1>${currentView.title}</h1><p class="subtitle">${currentView.description}</p></div><div class="quarter-control"><label for="quarter">REPORTING QUARTER</label><select id="quarter" ${!manifest ? 'disabled' : ''}>${manifest ? manifest.quarters.map(item => `<option value="${item.quarter}" ${item.quarter === selectedQuarter ? 'selected' : ''}>${escape(item.label)}${item.kind === 'sample' ? ' · sample' : ''}</option>`).join('') : '<option>Loading quarters…</option>'}</select></div></section>
    <aside class="source-credit" aria-label="Data attribution"><span><strong>Source dataset published by <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data" target="_blank" rel="noreferrer">Backblaze</a>.</strong> Explore their <a href="https://www.backblaze.com/blog/category/hard-drive-stats/" target="_blank" rel="noreferrer">official Drive Stats reports</a>.</span><span>Independent analysis by <a href="https://github.com/SixbucksSolutions" target="_blank" rel="noreferrer">Sixbucks Solutions</a>. <a href="https://github.com/SixbucksSolutions/backblaze-drive-stats/blob/main/DATA_SOURCES.md" target="_blank" rel="noreferrer">Sources and ownership ↗</a></span></aside>
    ${sample ? '<div class="sample-banner"><span class="sample-tag">SAMPLE DATA</span><span>Development preview using illustrative numbers. These are not Backblaze results.</span></div>' : bundle && !loading && !loadError ? `<div class="coverage-banner"><span class="sample-tag">SOURCE COVERAGE</span><span><strong>${populationLabel}</strong> History begins ${escape(bundle.provenance.coverageStart)}. Cumulative AFR and first-observed counts use this available window; the initial fleet is included.</span></div>` : ''}
    <div id="report" aria-busy="${loading}">${loading ? '<div class="state-panel" role="status"><span class="spinner"></span>Loading quarter data…</div>' : loadError ? `<div class="state-panel error" role="alert"><h2>We couldn’t load this quarter.</h2><p>${escape(loadError)}</p><button id="retry" class="button">Try again</button></div>` : report()}</div>
    <footer>Data source: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data" target="_blank" rel="noreferrer">Backblaze Drive Stats ↗</a><span>Independent explorer · ${bundle && !loading && !loadError ? escape(bundle.period.start + ' → ' + bundle.period.end) : 'Quarterly observations'}</span><a href="${import.meta.env.BASE_URL}fonts/NOTICE.txt">Font credits & licenses</a></footer></div></main></div>`;
  bindEvents();
  const methodology = document.querySelector<HTMLDetailsElement>('#methodology');
  if (methodology) methodology.open = methodologyOpen;
  // Capture at each render, including async completion: preserve wherever the user
  // has moved focus in the meantime rather than returning to the original trigger.
  if (focusSelector) document.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  else if (focusLink) [...app.querySelectorAll<HTMLElement>('a, summary')].find(element => element.tagName === focusLink.tag && element.getAttribute('href') === focusLink.href && element.textContent === focusLink.text)?.focus({ preventScroll: true });
}
function report() {
  if (!bundle) return '';
  const models = filteredModels();
  const totals = summarize(models);
  const whole = summarize(bundle.models);
  const datacenters = view === 'datacenters';
  const metrics = datacenters ? whole : totals;
  const items = [
    { label: 'DRIVES OBSERVED', value: integer.format(metrics.driveCount), suffix: 'unique drives this quarter', icon: '▥' },
    { label: 'QUARTERLY AFR', value: metrics.driveDays ? pct(metrics.quarterlyAfr) : '—', suffix: `${integer.format(metrics.failures)} recorded failures`, icon: '◴' },
    { label: 'RAW CAPACITY OBSERVED', value: capacity(metrics.capacityTb), suffix: 'distinct drives × model capacity', icon: '▱' },
    { label: 'FIRST OBSERVED', value: integer.format(metrics.newDrives), suffix: 'first appearances in available history', icon: '↗' },
  ];
  return `<section class="metrics" aria-label="Quarter summary">${items.map(item => `<article class="metric"><div class="metric-label">${item.label}<span aria-hidden="true">${item.icon}</span></div><strong>${item.value}</strong><small>${item.suffix}</small></article>`).join('')}</section>
    <div class="analysis-grid"><section class="panel chart-panel"><div class="panel-header"><div><p class="eyebrow">${escape(labelQuarter(bundle.quarter))}</p><h2>${chartTitle()}</h2></div>${view === 'reliability' ? `<div class="segmented" role="group" aria-label="Failure rate period"><button data-afr="quarterlyAfr" aria-pressed="${afrMode === 'quarterlyAfr'}">Quarterly</button><button data-afr="cumulativeAfr" aria-pressed="${afrMode === 'cumulativeAfr'}">Cumulative</button></div>` : '<span class="panel-unit">' + (view === 'capacity' ? 'PETABYTES · PB' : view === 'manufacturers' || datacenters ? 'RAW CAPACITY' : 'DRIVES') + '</span>'}</div><div class="chart">${chart(models)}</div></section>
    <aside class="panel reading-panel"><p class="eyebrow">READING THE NUMBERS</p><h2>${view === 'reliability' ? 'Exposure matters.' : view === 'deployments' ? 'New to the data.' : 'A quarter is a window.'}</h2><p>${view === 'reliability' ? 'A failure rate needs context. Compare drive-days and sample sizes alongside the headline percentage.' : view === 'deployments' ? 'First observed means first appearance in the available source history. It may differ from the physical installation date.' : 'A drive contributes if it appeared at any point in the quarter. Replacements can both count toward the observed population.'}</p><div class="reading-stat"><strong>${integer.format(datacenters ? whole.driveDays : totals.driveDays)}</strong><span>drive-days of exposure</span></div><p class="small">${datacenters ? 'Each drive is assigned to its last observed datacenter within the quarter. Unknown locations remain included.' : 'Filters apply to the model chart, summary, and table. The capacity history shows the full exported population.'}</p><a href="#methodology">See methodology ↓</a></aside></div>
    ${datacenters ? datacenterTable() : `<section class="panel table-panel"><div class="panel-header"><div><p class="eyebrow">BEHIND THE CHART</p><h2>${view === 'manufacturers' ? 'Capacity by manufacturer' : 'The model breakdown'} <span class="count-badge">${models.length}${view === 'manufacturers' ? ' models' : ''}</span></h2></div><button id="download" class="button">↓ Download CSV</button></div>${filters()}<div id="table-content">${table(models)}</div></section>`}
    <details class="methodology panel" id="methodology"><summary>Methodology & source information<span aria-hidden="true">+</span></summary><div class="methodology-body"><p><strong>Reporting period:</strong> ${escape(bundle.period.start)} through ${escape(bundle.period.end)}. <strong>Source history:</strong> ${escape(bundle.provenance.coverageStart)} through ${escape(bundle.provenance.coverageEnd)}.</p><ul><li>Quarterly AFR = failures ÷ drive-days × 365 × 100. Cumulative AFR uses available history through the selected quarter. Fleet AFR is weighted by exposure, never an average of model percentages.</li><li>Drive count and capacity describe distinct drives observed during the quarter; they are not quarter-end installed totals or averages. TB, PB and EB use decimal units.</li><li>First-observed counts depend on source history. Last-observed counts infer disappearance, may include failures, and remain provisional at the publication boundary.</li>${bundle.provenance.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul><p>Generated ${escape(bundle.provenance.generatedAt)}. <a href="${escape(bundle.provenance.sourceUrl)}" target="_blank" rel="noreferrer">Source ↗</a></p></div></details>`;
}
function filters() {
  return `<div class="filters"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Find a model or manufacturer…" aria-label="Find a model or manufacturer" value="${escape(search)}"></label><label><span class="sr-only">Manufacturer</span><select id="manufacturer" aria-label="Manufacturer"><option value="all">All manufacturers</option>${[...new Set(bundle!.models.map(row => row.manufacturer))].sort().map(name => `<option ${manufacturer === name ? 'selected' : ''} value="${escape(name)}">${escape(name)}</option>`).join('')}</select></label><label><span class="sr-only">Minimum drives</span><select id="minimum" aria-label="Minimum drives">${[0, 100, 500, 2000].map(value => `<option value="${value}" ${value === minimum ? 'selected' : ''}>${value ? integer.format(value) + '+ drives' : 'Any population'}</option>`).join('')}</select></label>${manufacturer !== 'all' || search || minimum ? '<button class="text-button" id="reset">Clear filters</button>' : ''}</div>`;
}
function chartTitle() {
  return { reliability: `${afrMode === 'quarterlyAfr' ? 'Quarterly' : 'Cumulative'} AFR by model`, deployments: 'First-observed drives by model', distribution: 'Drive population by model', capacity: 'Observed raw capacity over time', manufacturers: 'Raw capacity by manufacturer', datacenters: 'Raw capacity by datacenter' }[view];
}
function chart(models: Model[]) {
  if (view === 'capacity') return timeline();
  let entries: { label: string; value: number; manufacturer: string; formatted: string }[];
  if (view === 'datacenters') entries = bundle!.capacityByDatacenter.map(row => ({ label: row.datacenter, value: row.capacityTb, manufacturer: '', formatted: capacity(row.capacityTb) }));
  else if (view === 'manufacturers') entries = groupManufacturers(models).map(row => ({ label: row.manufacturer, value: row.capacityTb, manufacturer: row.manufacturer, formatted: capacity(row.capacityTb) }));
  else entries = models.map(row => {
    const value = view === 'reliability' ? row[afrMode] : view === 'deployments' ? row.newDrives : row.driveCount;
    return { label: row.model, value, manufacturer: row.manufacturer, formatted: view === 'reliability' ? pct(value) : integer.format(value) };
  });
  entries.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const visible = entries.slice(0, 8);
  if (!visible.length) return empty();
  const max = Math.max(...visible.map(row => row.value), 1);
  return `<div class="bar-chart" role="img" aria-label="${escape(chartTitle())}. ${escape(visible.map(row => `${row.label}: ${row.formatted}`).join('; '))}">${visible.map(row => `<div class="bar-row"><span class="bar-label" title="${escape(row.label)}">${escape(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${row.value / max * 100}%;background:${color(row.manufacturer)}"></div></div><span class="bar-value">${row.formatted}</span></div>`).join('')}</div><p class="chart-caption">${entries.length > 8 ? `Top 8 of ${entries.length} entries · full results below` : `${entries.length} ${view === 'datacenters' ? 'datacenters' : view === 'manufacturers' ? 'manufacturers' : 'models'} shown`} ${view === 'reliability' ? '· annualized percent' : ''}</p>`;
}
function timeline() {
  const rows = [...bundle!.history].sort((a, b) => a.quarter.localeCompare(b.quarter));
  if (!rows.length) return empty();
  const width = 680, height = 200, left = 52, right = 30, top = 16, bottom = 38;
  const max = Math.max(...rows.map(row => row.capacityTb), 1000) * 1.15;
  const x = (i: number) => left + (rows.length === 1 ? (width - left - right) / 2 : i / (rows.length - 1) * (width - left - right));
  const y = (value: number) => height - bottom - value / max * (height - top - bottom);
  const points = rows.map((row, i) => `${x(i)},${y(row.capacityTb)}`).join(' ');
  return `<svg class="timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Full-population quarterly capacity: ${escape(rows.map(row => `${row.quarter}: ${capacity(row.capacityTb)}`).join('; '))}">${[0, 1, 2, 3].map(i => `<line x1="${left}" x2="${width - right}" y1="${y(max * i / 3)}" y2="${y(max * i / 3)}" class="gridline"/><text x="${left - 10}" y="${y(max * i / 3) + 4}" text-anchor="end">${decimal.format(max * i / 3 / 1000)}</text>`).join('')}<polygon points="${left},${height - bottom} ${points} ${x(rows.length - 1)},${height - bottom}" fill="#e5f0eb"/><polyline points="${points}" fill="none" stroke="#187d72" stroke-width="3"/>${rows.map((row, i) => `<circle cx="${x(i)}" cy="${y(row.capacityTb)}" r="4" fill="#187d72"><title>${escape(row.quarter)}: ${capacity(row.capacityTb)}</title></circle>${rows.length <= 8 || i % Math.ceil(rows.length / 7) === 0 || i === rows.length - 1 ? `<text x="${x(i)}" y="${height - 12}" text-anchor="middle">${escape(row.quarter.replace('-', ' '))}</text>` : ''}`).join('')}</svg><p class="chart-caption">Full exported population · ${rows.length} calendar quarters · petabytes (PB)</p>`;
}
function empty() { return '<div class="empty"><strong>No matching data</strong><span>Try another filter or quarter.</span></div>'; }
function table(models: Model[]) {
  if (!models.length) return empty();
  if (view === 'manufacturers') {
    const rows = groupManufacturers(models);
    const total = summarize(models).capacityTb;
    return `<div class="table-scroll"><table><caption class="sr-only">Capacity by manufacturer for ${bundle!.quarter}</caption><thead><tr><th>Manufacturer</th><th>Models</th><th>Drives observed</th><th>Raw capacity</th><th>Capacity share</th></tr></thead><tbody>${rows.map(row => `<tr><td><span class="manufacturer-dot" style="background:${color(row.manufacturer)}"></span>${escape(row.manufacturer)}</td><td>${row.modelCount}</td><td>${integer.format(row.driveCount)}</td><td>${capacity(row.capacityTb)}</td><td>${pct(total ? row.capacityTb / total * 100 : 0)}</td></tr>`).join('')}</tbody></table></div><div class="table-foot">${rows.length} manufacturers · ${integer.format(summarize(models).driveCount)} drives in current selection</div>`;
  }
  const columns: { key: SortKey; label: string; format?: (n: number) => string }[] = [
    { key: 'model', label: 'MODEL' }, { key: 'capacityTb', label: 'SIZE (TB)', format: decimal.format },
    { key: 'driveCount', label: 'DRIVES', format: integer.format },
    ...(view === 'deployments' ? [{ key: 'newDrives' as const, label: 'FIRST OBSERVED', format: integer.format }, { key: 'lastObservedDrives' as const, label: 'LAST OBSERVED*', format: integer.format }] : view === 'capacity' ? [] : [{ key: 'failures' as const, label: 'FAILURES', format: integer.format }]),
    { key: 'driveDays', label: 'DRIVE-DAYS', format: integer.format },
    ...(view === 'reliability' ? [{ key: afrMode, label: afrMode === 'quarterlyAfr' ? 'QUARTERLY AFR' : 'CUMULATIVE AFR', format: pct }] : []),
  ];
  const sorted = [...models].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const result = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
    return result * sortDirection || a.id.localeCompare(b.id);
  });
  return `<div class="table-scroll"><table><caption class="sr-only">${escape(views.find(item => item.id === view)!.label)} by model for ${bundle!.quarter}</caption><thead><tr>${columns.map(col => `<th aria-sort="${sortKey === col.key ? sortDirection === 1 ? 'ascending' : 'descending' : 'none'}"><button data-sort="${col.key}">${col.label}<span aria-hidden="true">${sortKey === col.key ? sortDirection === 1 ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>`).join('')}</tr></thead><tbody>${sorted.map(row => `<tr>${columns.map(col => col.key === 'model' ? `<td class="model-cell"><span class="manufacturer-dot" style="background:${color(row.manufacturer)}"></span><span><strong>${escape(row.model)}</strong><small>${escape(row.manufacturer)}</small></span></td>` : `<td>${col.key === afrMode && view === 'reliability' ? `<span class="afr-badge ${row[afrMode] > 2 ? 'elevated' : ''}">${pct(row[afrMode])}</span>` : escape(col.format ? col.format(Number(row[col.key])) : row[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-foot">${models.length} models · ${integer.format(summarize(models).driveCount)} drives in current selection${view === 'deployments' ? '<span>*Inferred disappearance; includes failures. Latest observations are provisional.</span>' : ''}</div>`;
}
function datacenterTable() {
  const rows = [...bundle!.capacityByDatacenter].sort((a, b) => b.capacityTb - a.capacityTb);
  const total = rows.reduce((sum, row) => sum + row.capacityTb, 0);
  return `<section class="panel table-panel"><div class="panel-header"><div><p class="eyebrow">BEHIND THE CHART</p><h2>The datacenter breakdown</h2></div><button id="download" class="button">↓ Download CSV</button></div>${rows.length ? `<div class="table-scroll"><table><caption class="sr-only">Raw capacity by datacenter</caption><thead><tr><th>Datacenter</th><th>Drives observed</th><th>Raw capacity</th><th>Capacity share</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.datacenter)}</td><td>${integer.format(row.driveCount)}</td><td>${capacity(row.capacityTb)}</td><td>${pct(total ? row.capacityTb / total * 100 : 0)}</td></tr>`).join('')}</tbody></table></div>` : empty()}<div class="table-foot">One location per drive per quarter · full exported population</div></section>`;
}
function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view as View; syncUrl(); render(); }));
  document.querySelector<HTMLSelectElement>('#quarter')?.addEventListener('change', event => { void loadQuarter((event.target as HTMLSelectElement).value as Quarter); });
  document.querySelector<HTMLButtonElement>('#retry')?.addEventListener('click', () => { if (manifest) void loadQuarter(selectedQuarter as Quarter); else void init(); });
  document.querySelectorAll<HTMLButtonElement>('[data-afr]').forEach(button => button.addEventListener('click', () => { afrMode = button.dataset.afr as typeof afrMode; render(); }));
  document.querySelector<HTMLInputElement>('#search')?.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    search = input.value;
    render();
    const next = document.querySelector<HTMLInputElement>('#search')!;
    next.focus();
    next.setSelectionRange(start, start);
  });
  document.querySelector<HTMLSelectElement>('#manufacturer')?.addEventListener('change', event => { manufacturer = (event.target as HTMLSelectElement).value; render(); });
  document.querySelector<HTMLSelectElement>('#minimum')?.addEventListener('change', event => { minimum = Number((event.target as HTMLSelectElement).value); render(); });
  document.querySelector<HTMLButtonElement>('#reset')?.addEventListener('click', () => { manufacturer = 'all'; search = ''; minimum = 0; render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => button.addEventListener('click', () => { const next = button.dataset.sort as SortKey; sortDirection = sortKey === next ? -sortDirection : next === 'model' ? 1 : -1; sortKey = next; render(); document.querySelector<HTMLButtonElement>(`[data-sort="${next}"]`)?.focus(); }));
  document.querySelector<HTMLButtonElement>('#download')?.addEventListener('click', download);
}
function download() {
  let rows: (string | number)[][];
  if (view === 'datacenters') rows = [['Datacenter', 'Observed drives', 'Observed capacity TB'], ...bundle!.capacityByDatacenter.map(row => [row.datacenter, row.driveCount, row.capacityTb])];
  else if (view === 'manufacturers') rows = [['Manufacturer', 'Models', 'Observed drives', 'Observed capacity TB'], ...groupManufacturers(filteredModels()).map(row => [row.manufacturer, row.modelCount, row.driveCount, row.capacityTb])];
  else rows = [['Manufacturer', 'Model', 'Capacity TB', 'Observed drives', 'Drive days', 'Failures', 'Quarterly AFR percent', 'Cumulative AFR percent', 'First observed', 'Last observed provisional'], ...filteredModels().map(row => [row.manufacturer, row.model, row.capacityTb, row.driveCount, row.driveDays, row.failures, row.quarterlyAfr, row.cumulativeAfr, row.newDrives, row.lastObservedDrives])];
  const observed = bundle!.provenance.kind === 'backblaze';
  const attribution = [observed ? 'Backblaze Drive Stats' : 'Illustrative development data', observed ? bundle!.provenance.sourceUrl : '', bundle!.quarter, bundle!.provenance.kind, 'https://github.com/SixbucksSolutions/backblaze-drive-stats'];
  rows = [
    [...rows[0]!, 'Data source', 'Source URL', 'Reporting quarter', 'Data kind', 'Analysis project'],
    ...rows.slice(1).map(row => [...row, ...attribution]),
  ];
  const blob = new Blob(['\ufeff', csv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle!.provenance.kind === 'sample' ? 'SAMPLE-' : ''}drive-stats-${selectedQuarter}-${view}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function getJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Data file returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}
async function loadQuarter(quarter: Quarter, startupSignal?: AbortSignal) {
  const id = ++requestId;
  controller?.abort();
  controller = new AbortController();
  selectedQuarter = quarter;
  loading = true;
  loadError = '';
  bundle = undefined;
  syncUrl();
  render();
  try {
    const entry = manifest.quarters.find(item => item.quarter === quarter);
    if (!entry) throw new Error('This quarter is not in the available data index.');
    const signal = startupSignal ? AbortSignal.any([controller.signal, startupSignal]) : controller.signal;
    const loaded = cache.get(quarter) ?? parseBundle(await getJson(`${import.meta.env.BASE_URL}data/${entry.url}`, signal), quarter, entry.kind);
    if (id !== requestId) return;
    cache.set(quarter, loaded);
    bundle = loaded;
    if (!loaded.models.some(row => row.manufacturer === manufacturer)) manufacturer = 'all';
  } catch (error) {
    if (id !== requestId) return;
    loadError = error instanceof Error ? error.message : 'Unexpected data error.';
  }
  if (id === requestId) { loading = false; render(); }
}
async function init(startupSignal?: AbortSignal) {
  loading = true;
  loadError = '';
  render();
  try {
    manifest = parseManifest(await getJson(`${import.meta.env.BASE_URL}data/index.json`, startupSignal));
    manifest.quarters.sort((a, b) => b.quarter.localeCompare(a.quarter));
    const requested = params.get('quarter');
    const quarter = manifest.quarters.find(entry => entry.quarter === requested)?.quarter ?? manifest.quarters[0]!.quarter;
    await loadQuarter(quarter, startupSignal);
  } catch (error) {
    loading = false;
    loadError = error instanceof Error ? error.message : 'Unexpected data error.';
    render();
  }
}
async function start() {
  const startup = new AbortController();
  const rendering = withStartupDeadline(() => params.get('view') === 'matrix'
    ? import('./matrix.ts').then(module => { startup.signal.throwIfAborted(); return module.initMatrix(startup.signal); })
    : init(startup.signal), startup);
  const readiness = await waitForPresentation(waitForFonts(document.fonts), rendering);
  document.documentElement.dataset.fontMode = readiness.fontMode;
  if (readiness.renderFailed || startup.signal.aborted) app.innerHTML = '<section class="state-panel error" role="alert"><h1>Unable to open the explorer</h1><p>Loading did not complete. Reload the page to try again.</p></section>';
  // Let selected-font metrics and the completed initial DOM settle before reveal.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  document.documentElement.dataset.appReady = 'true';
  document.documentElement.classList.remove('app-pending');
}
void start();
