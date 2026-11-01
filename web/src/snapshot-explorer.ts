import { SnapshotLoader } from './snapshot-loader.ts';
import type { ProductionIndex, SnapshotDescriptor, SupportingQuarter } from './production-data.ts';
import { patchContent } from './matrix-render.ts';
import {
  defaultFilter,
  exploreUrl,
  quarterLabel,
  selectRows,
  selectionCsv,
  selectionTotals,
} from './snapshot-selection.ts';
import type { ModelFilter, ModelSort } from './snapshot-selection.ts';
import './snapshot-explorer.css';
import { renderDeployments } from './deployment-report.ts';
import { renderDistribution } from './distribution-report.ts';
import { snapshotReport } from './app-route.ts';
import type { SnapshotReport } from './app-route.ts';

const reportNames = {
  reliability: 'Reliability',
  deployments: 'Deployments',
  distribution: 'Drive mix',
  capacity: 'Total capacity',
  manufacturers: 'By manufacturer',
  datacenters: 'By datacenter',
};
const snapshotReports: Record<
  SnapshotReport,
  { label: string; title: string; description: string }
> = {
  overview: {
    label: 'Model context',
    title: 'Model context',
    description: 'Calendar-quarter observations within a shared as-of snapshot.',
  },
  deployments: {
    label: 'Deployments',
    title: 'What joined the recorded fleet?',
    description:
      'First recorded additions by HDD model, including smaller populations and the initial observed fleet.',
  },
  distribution: {
    label: 'Drive mix',
    title: 'A closer look at the observed fleet.',
    description:
      'Distinct HDD identities observed anywhere in the calendar quarter, grouped by model.',
  },
};
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const number = (value: number | null) => (value === null ? 'Unavailable' : integer.format(value));
const capacity = (value: number | null) =>
  value === null
    ? 'Unavailable'
    : value >= 1_000_000
      ? `${decimal.format(value / 1_000_000)} EB`
      : `${decimal.format(value / 1000)} PB`;

/** The explicit example route emits every immutable example byte unchanged in a build. */
function exampleTransport() {
  const assets = import.meta.glob<string>('../../fixtures/production-v2/*.json', {
    query: '?url',
    import: 'default',
    eager: true,
  });
  const byName = new Map(
    Object.entries(assets).map(([path, url]) => [path.split('/').at(-1)!, url]),
  );
  const indexName = [...byName.keys()].find((name) => name.startsWith('sample-index.'))!;
  const base = new URL(`${import.meta.env.BASE_URL}examples/`, location.origin);
  const fetcher: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const name = url.pathname.split('/').at(-1)!;
    const asset = byName.get(name);
    if (!asset) {
      return Promise.reject(new Error('The example references an unavailable artifact.'));
    }
    return fetch(asset, init);
  };
  return new SnapshotLoader(new URL(indexName, base).href, fetcher);
}

export async function initSnapshotExplorer(startupSignal?: AbortSignal) {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  const params = new URLSearchParams(location.search);
  const example = params.get('example') === '1';
  const loader = example
    ? exampleTransport()
    : new SnapshotLoader(
        new URL(`${import.meta.env.BASE_URL}data/production/index.json`, location.origin).href,
      );
  let index: ProductionIndex | undefined;
  let descriptor: SnapshotDescriptor | undefined;
  let payload: SupportingQuarter | null = null;
  let snapshotId = params.get('snapshot') ?? '';
  let quarter = params.get('quarter') ?? '';
  let report = snapshotReport(params);
  let filter: ModelFilter = defaultFilter();
  let sort: ModelSort = report === 'deployments' ? 'new' : 'count';
  let descending = true;
  let busy = true;
  let error = '';
  let request = 0;
  let controller: AbortController | undefined;
  document.title = 'Drive Stats — Explore snapshots';

  const rows = () =>
    descriptor && payload
      ? selectRows(
          payload.scopes.selected_hdd.models,
          descriptor.context.inventory,
          descriptor.context.selection,
          report === 'overview' ? filter : { ...filter, preset: 'context' },
          sort,
          descending,
        )
      : [];

  function syncUrl() {
    history.replaceState(null, '', exploreUrl(location.href, snapshotId, quarter, report));
  }

  function render() {
    const active = document.activeElement;
    const focusId = active instanceof HTMLElement ? active.id : '';
    const selection =
      active instanceof HTMLInputElement && active.type === 'search'
        ? ([active.selectionStart, active.selectionEnd] as const)
        : undefined;
    const context = descriptor?.context;
    const currentReport = snapshotReports[report];
    document.title = `Drive Stats — ${currentReport.label}`;
    const deployments = report === 'deployments';
    const coverage = context?.coverage.find((entry) => entry.quarter === quarter);
    const visible = rows();
    const totals = selectionTotals(visible, payload?.status === 'complete');
    const whole = payload?.scopes.selected_hdd.totals;
    const all = payload?.scopes.all_supplied.totals;
    const vendors = [
      ...new Set(
        context?.inventory
          .filter((model) => context.selection.contextModelIds.includes(model.modelId))
          .map((model) => model.vendor),
      ),
    ].sort();
    patchContent(
      app,
      `<div class="layout snapshot-layout"><aside class="sidebar"><a class="brand" href="${esc(import.meta.env.BASE_URL)}">DriveStats<small>EXPLORE THE DATA</small></a><a class="nav-item" href="?view=matrix">AFR comparison</a><nav aria-label="Snapshot Explore reports">${Object.entries(
        snapshotReports,
      )
        .map(
          ([id, entry]) =>
            `<button id="report-${id}" class="nav-item ${id === report ? 'active' : ''}" data-report="${id}" ${id === report ? 'aria-current="page"' : ''}>${entry.label}</button>`,
        )
        .join(
          '',
        )}</nav><p class="nav-label">OTHER QUARTERLY REPORTS</p><nav aria-label="Other quarterly reports">${Object.entries(
        reportNames,
      )
        .filter(([id]) => id !== 'deployments' && id !== 'distribution')
        .map(([id, label]) => `<a class="nav-item" href="?view=${id}">${label}</a>`)
        .join(
          '',
        )}</nav><div class="sidebar-foot"><a href="?view=reliability">Original quarterly explorer</a><br><a href="?view=matrix&reference=1">AFR comparison references</a></div></aside><main id="main"><div class="page">
      <section class="page-heading"><div><p class="eyebrow">BACKBLAZE DRIVE STATS</p><h1>${currentReport.title}</h1><p class="subtitle">${currentReport.description}</p></div></section>
      <aside class="source-credit"><span>Source dataset: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a> · <a href="https://www.backblaze.com/blog/category/hard-drive-stats/">Official reports</a></span><span>Independent analysis by <a href="https://github.com/SixbucksSolutions/backblaze-drive-stats">Sixbucks Solutions</a></span></aside>
      ${example || context?.kind === 'sample' ? '<div class="sample-banner"><strong>SAMPLE DATA</strong> Fictional examples for exploring coverage and selection. These are not Backblaze results.</div>' : ''}
      <div class="snapshot-controls"><label>Snapshot as of<select id="snapshot-choice" ${!index ? 'disabled' : ''}>${
        index
          ? [...index.snapshots]
              .sort((a, b) => b.asOfQuarter.localeCompare(a.asOfQuarter))
              .map(
                (entry) =>
                  `<option value="${esc(entry.snapshotId)}" ${entry.snapshotId === snapshotId ? 'selected' : ''}>${quarterLabel(entry.asOfQuarter)} · ${esc(entry.snapshotId)}</option>`,
              )
              .join('')
          : '<option>Loading snapshots…</option>'
      }</select></label><label>Explore calendar quarter<select id="calendar-choice" ${!descriptor ? 'disabled' : ''}>${
        descriptor
          ? [...descriptor.quarters]
              .reverse()
              .map(
                (entry) =>
                  `<option value="${entry.quarter}" ${entry.quarter === quarter ? 'selected' : ''}>${quarterLabel(entry.quarter)}${entry.status === 'complete' ? '' : ` · ${entry.status}`}</option>`,
              )
              .join('')
          : '<option>Loading quarters…</option>'
      }</select></label></div>
      <div id="snapshot-report" aria-busy="${busy}">${
        busy
          ? '<div class="state-panel" role="status">Loading selected snapshot…</div>'
          : error
            ? `<div class="state-panel error" role="alert"><h2>Snapshot unavailable</h2><p>${esc(error)}</p><button id="snapshot-retry" class="button">Try again</button>${!example ? '<p><a href="?view=explore&example=1">Explore clearly labeled fictional examples</a></p>' : ''}</div>`
            : context
              ? `
      <div class="coverage-banner"><strong>${esc(coverage?.status ?? 'Unavailable')} source coverage · ${quarterLabel(quarter)}</strong><span>${esc(coverage?.reason ?? '')} ${coverage ? `${coverage.observedDays}/${coverage.expectedDays} calendar days observed.` : ''} Snapshot cutoff: ${esc(context.cutoffDate)}. Full-quarter metrics remain unavailable for incomplete coverage.</span></div>
      <section class="metrics" aria-label="Population scopes"><article class="metric"><div class="metric-label">${deployments ? 'FILTERED FIRST RECORDED HDDs' : 'FILTERED HDD OBSERVED DRIVES'}</div><strong>${number(deployments ? totals.new : totals.count)}</strong><small>${visible.length} models in the visible selection</small></article><article class="metric"><div class="metric-label">${deployments ? 'WHOLE HDD CONTEXT FIRST RECORDED' : 'WHOLE SELECTED-HDD CONTEXT'}</div><strong>${number((deployments ? whole?.new : whole?.count) ?? null)}</strong><small>Includes seeded and smaller-population context</small></article><article class="metric"><div class="metric-label">ALL SUPPLIED OBSERVED DRIVES</div><strong>${number(all?.count ?? null)}</strong><small>Includes SSDs and unresolved media</small></article><article class="metric"><div class="metric-label">ALL SUPPLIED RAW CAPACITY</div><strong>${capacity(all?.capacityTB ?? null)}</strong><small>Aggregate capacity; decimal PB / EB</small></article></section>
      <section class="panel table-panel"><div class="panel-header"><div><p class="eyebrow">COMPLETE SELECTED-HDD RESULTS</p><h2>${deployments ? 'First recorded additions by model' : 'Selected HDD observations'}</h2></div><button id="snapshot-download" class="button" ${!payload || !visible.length ? 'disabled' : ''}>Download CSV</button></div>
      <div class="filters"><label class="search"><input id="snapshot-search" type="search" aria-label="Find a model or vendor" placeholder="Find a model or vendor…" value="${esc(filter.search)}"></label><label>Vendor<select id="snapshot-vendor"><option value="">All vendors</option>${vendors.map((vendor) => `<option value="${esc(vendor)}" ${filter.vendor === vendor ? 'selected' : ''}>${esc(vendor)}</option>`).join('')}</select></label>${report === 'overview' ? `<label>Model set<select id="snapshot-preset"><option value="context" ${filter.preset === 'context' ? 'selected' : ''}>Whole HDD context</option><option value="purchase" ${filter.preset === 'purchase' ? 'selected' : ''}>Purchase comparison defaults</option><option value="reference" ${filter.preset === 'reference' ? 'selected' : ''}>Historical references</option></select></label>` : ''}<button id="snapshot-reset" class="text-button">Clear filters</button></div>
      <details class="snapshot-model-picker" id="snapshot-model-picker"><summary>Choose models (${filter.modelIds?.size ?? context.selection.contextModelIds.length} selected)</summary><div class="snapshot-model-actions"><button id="models-all" class="text-button">All models</button><button id="models-none" class="text-button">No models</button></div><div class="snapshot-model-list">${context.inventory
        .filter((model) => context.selection.contextModelIds.includes(model.modelId))
        .map(
          (model) =>
            `<label><input type="checkbox" id="model-${esc(model.modelId)}" data-model-id="${esc(model.modelId)}" ${!filter.modelIds || filter.modelIds.has(model.modelId) ? 'checked' : ''}><span>${esc(model.vendor)} · ${esc(model.modelNumber)}</span></label>`,
        )
        .join('')}</div></details>
      <p class="snapshot-note">Filters affect this table and its export. Whole-context and all-supplied totals keep their own denominators. Capacity is aggregate model capacity, not per-drive capacity. First recorded is not an installation date.</p>
      ${report === 'deployments' ? renderDeployments(visible, payload?.status === 'complete') : report === 'distribution' ? renderDistribution(visible, payload?.status === 'complete') : ''}
      ${
        payload
          ? `<div class="table-scroll"><table><caption class="sr-only">Selected HDD context for ${quarterLabel(quarter)}, snapshot as of ${quarterLabel(context.asOfQuarter)}</caption><thead><tr>${(
              [
                ['modelNumber', 'Model'],
                ['vendor', 'Vendor'],
                ['count', 'Observed drives'],
                ['new', 'First recorded'],
                ['capacityTB', 'Raw capacity'],
              ] as const
            )
              .map(
                ([key, label]) =>
                  `<th aria-sort="${sort === key ? (descending ? 'descending' : 'ascending') : 'none'}"><button id="sort-${key}" data-snapshot-sort="${key}">${label}${sort === key ? (descending ? ' ↓' : ' ↑') : ''}</button></th>`,
              )
              .join(
                '',
              )}</tr></thead><tbody>${visible.map((row) => `<tr data-render-key="${esc(row.modelId)}"><th scope="row">${esc(row.modelNumber)}</th><td>${esc(row.vendor)}</td><td>${number(row.count)}</td><td>${number(row.new)}</td><td>${capacity(row.capacityTB)}</td></tr>`).join('')}</tbody></table>${!visible.length ? '<p class="snapshot-note" role="status">No models match the current filters.</p>' : ''}</div>`
          : '<div class="state-panel" role="status">No observations are published for this period. Unknown values are not zero drives or capacity.</div>'
      }</section>
      <details class="methodology panel" id="snapshot-methodology"><summary>Coverage, scope and source information</summary><div class="methodology-body"><p>${esc(context.provenance.label)}. ${esc(context.provenance.credit)}.</p><p>History begins ${quarterLabel(context.sourceDomain.historyStartQuarter)}; source publication begins ${esc(context.sourceDomain.firstPublishedDate)}. Recorded observations do not establish complete lifetime exposure. Datacenter fields are ${coverage?.datacenterFieldAvailable ? 'reported' : 'unreported; earlier locations stay Unknown'} for this period.</p><p>Snapshot ${esc(context.snapshotId)}. Generated ${esc(context.generatedAt)}. <a href="${esc(context.provenance.url)}">Source dataset</a>.</p></div></details>`
              : ''
      }</div>
      <footer><a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a><span>Independent Sixbucks Solutions analysis</span><a href="${import.meta.env.BASE_URL}fonts/NOTICE.txt">Font credits & licenses</a></footer></div></main></div>`,
    );
    bind();
    if (focusId) {
      const restored = document.getElementById(focusId);
      restored?.focus({ preventScroll: true });
      if (selection && restored instanceof HTMLInputElement) {
        restored.setSelectionRange(selection[0], selection[1]);
      }
    }
  }

  function bind() {
    app.querySelectorAll<HTMLButtonElement>('[data-report]').forEach((button) => {
      button.onclick = () => {
        report = button.dataset.report as SnapshotReport;
        if (report !== 'overview') {
          filter.preset = 'context';
        }
        sort = report === 'deployments' ? 'new' : 'count';
        descending = true;
        syncUrl();
        render();
      };
    });
    app.querySelectorAll<HTMLInputElement>('[data-model-id]').forEach((input) => {
      input.onchange = () => {
        if (!descriptor) {
          return;
        }
        const ids = new Set(filter.modelIds ?? descriptor.context.selection.contextModelIds);
        const id = input.dataset.modelId!;
        if (input.checked) {
          ids.add(id);
        } else {
          ids.delete(id);
        }
        filter.modelIds = ids;
        render();
      };
    });
    const allModels = app.querySelector<HTMLButtonElement>('#models-all');
    if (allModels) {
      allModels.onclick = () => {
        filter.modelIds = undefined;
        render();
      };
    }
    const noModels = app.querySelector<HTMLButtonElement>('#models-none');
    if (noModels) {
      noModels.onclick = () => {
        filter.modelIds = new Set();
        render();
      };
    }
    const snapshotChoice = app.querySelector<HTMLSelectElement>('#snapshot-choice');
    if (snapshotChoice) {
      snapshotChoice.onchange = () => {
        void load(snapshotChoice.value, quarter);
      };
    }
    const quarterChoice = app.querySelector<HTMLSelectElement>('#calendar-choice');
    if (quarterChoice) {
      quarterChoice.onchange = () => {
        void load(snapshotId, quarterChoice.value);
      };
    }
    const retry = app.querySelector<HTMLButtonElement>('#snapshot-retry');
    if (retry) {
      retry.onclick = () => {
        void load(snapshotId, quarter);
      };
    }
    const search = app.querySelector<HTMLInputElement>('#snapshot-search');
    if (search) {
      search.oninput = () => {
        filter.search = search.value;
        render();
      };
    }
    const vendor = app.querySelector<HTMLSelectElement>('#snapshot-vendor');
    if (vendor) {
      vendor.onchange = () => {
        filter.vendor = vendor.value;
        render();
      };
    }
    const preset = app.querySelector<HTMLSelectElement>('#snapshot-preset');
    if (preset) {
      preset.onchange = () => {
        filter.preset = preset.value as ModelFilter['preset'];
        render();
      };
    }
    const reset = app.querySelector<HTMLButtonElement>('#snapshot-reset');
    if (reset) {
      reset.onclick = () => {
        filter = defaultFilter();
        render();
      };
    }
    app.querySelectorAll<HTMLButtonElement>('[data-snapshot-sort]').forEach((button) => {
      button.onclick = () => {
        const next = button.dataset.snapshotSort as ModelSort;
        descending = sort === next ? !descending : next !== 'modelNumber' && next !== 'vendor';
        sort = next;
        render();
      };
    });
    const download = app.querySelector<HTMLButtonElement>('#snapshot-download');
    if (download) {
      download.onclick = () => {
        if (!descriptor || !payload) {
          return;
        }
        const exportRows = rows();
        if (!exportRows.length) {
          return;
        }
        const content = selectionCsv(exportRows, {
          snapshotId,
          asOfQuarter: descriptor.context.asOfQuarter,
          quarter,
          status: payload.status,
          kind: descriptor.context.kind,
          sourceUrl: descriptor.context.provenance.url,
          scope: 'selected_hdd',
          contextCount: payload.scopes.selected_hdd.totals.count,
          contextNew: payload.scopes.selected_hdd.totals.new,
          report,
          filterDescription: `Vendor: ${filter.vendor || 'all'}; search: ${filter.search || 'none'}; model selection: ${filter.modelIds ? [...filter.modelIds].join(' ') : 'all context'}; model set: ${report === 'overview' ? filter.preset : 'context'}`,
          sourceHistoryStart: descriptor.context.sourceDomain.historyStartQuarter,
        });
        const url = URL.createObjectURL(
          new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = `${descriptor.context.kind === 'sample' ? 'SAMPLE-' : ''}drive-stats-${quarter}-${report}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
    }
  }

  async function load(nextSnapshot: string, nextQuarter: string, signal?: AbortSignal) {
    const id = ++request;
    controller?.abort();
    controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    busy = true;
    error = '';
    payload = null;
    // Never offer a previous generation's quarter choices while a new descriptor loads.
    if (nextSnapshot !== snapshotId) {
      descriptor = undefined;
      filter = defaultFilter();
    }
    snapshotId = nextSnapshot;
    render();
    try {
      const loadedIndex = index ?? (await loader.loadIndex(combined));
      if (id !== request) {
        return;
      }
      index = loadedIndex;
      const target = index.snapshots.some((entry) => entry.snapshotId === nextSnapshot)
        ? nextSnapshot
        : index.latestSnapshotId;
      const loaded = await loader.loadDescriptor(target, combined);
      if (id !== request) {
        return;
      }
      descriptor = loaded;
      snapshotId = target;
      quarter = loaded.quarters.some((entry) => entry.quarter === nextQuarter)
        ? nextQuarter
        : loaded.context.asOfQuarter;
      syncUrl();
      const loadedPayload = await loader.loadQuarter(target, quarter, combined);
      if (id !== request) {
        return;
      }
      payload = loadedPayload;
    } catch {
      if (id !== request) {
        return;
      }
      error = 'The selected snapshot could not be loaded or verified. Please try again.';
    }
    if (id === request) {
      busy = false;
      render();
    }
  }

  await load(snapshotId, quarter, startupSignal);
}
