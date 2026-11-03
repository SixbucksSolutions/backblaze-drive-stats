import { updatePublishedNavigation } from './published-navigation.ts';
import { displayModelLabel } from './model-labels.ts';
import { PresentationLoader, presentationCatalogue } from './presentation-loader.ts';
import type { DisplayDescriptor, PresentationCatalogue } from './presentation-data.ts';
import type { ProductionIndex, SupportingQuarter } from './production-data.ts';
import { patchContent } from './matrix-render.ts';
import {
  defaultFilter,
  exploreUrl,
  quarterLabel,
  selectRows,
  selectionCsv,
  selectionTotals,
  reportCsv,
  customerHddScopeDescription,
} from './snapshot-selection.ts';
import type { ModelFilter, ModelSort, ReportCsvMetadata } from './snapshot-selection.ts';
import { CapacityHistoryReader, renderCapacity, capacityCsvRows } from './capacity-report.ts';
import type { CapacityPoint } from './capacity-report.ts';
import { renderManufacturers, manufacturerCsvRows } from './manufacturer-report.ts';
import type { ManufacturerSort } from './manufacturer-report.ts';
import { renderDatacenters, datacenterCsvRows } from './datacenter-report.ts';
import { renderScopeMetrics } from './snapshot-summary.ts';
import './snapshot-explorer.css';
import { renderDeployments } from './deployment-report.ts';
import { renderDistribution } from './distribution-report.ts';
import { snapshotReport } from './app-route.ts';
import type { SnapshotReport } from './app-route.ts';
import { exampleUrls, exampleIndexName } from 'virtual:minimized-example-json';
import {
  snapshotAvailable,
  snapshotChoices,
  snapshotUnavailableReason,
} from './snapshot-availability.ts';

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
  capacity: {
    label: 'Total capacity',
    title: 'Capacity over recorded history.',
    description:
      'All-supplied nominal raw capacity across calendar quarters, with unavailable periods left explicit.',
  },
  manufacturers: {
    label: 'By manufacturer',
    title: 'The manufacturers behind the HDD context.',
    description:
      'Capacity, observed population and first recorded additions, with distinct whole-context share denominators.',
  },
  datacenters: {
    label: 'By datacenter',
    title: 'Where the observed capacity lives.',
    description:
      'All supplied drive identities assigned once to their last observed location within each quarter.',
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

/** The build derives a compact fictional graph with its own byte-bound references. */
async function exampleTransport() {
  const { SnapshotLoader } = await import('./snapshot-loader.ts');
  const byName = new Map(Object.entries(exampleUrls));
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
  return new SnapshotLoader(new URL(exampleIndexName, base).href, fetcher);
}

export async function initSnapshotExplorer(startupSignal?: AbortSignal) {
  startupSignal?.throwIfAborted();
  const app = document.querySelector<HTMLDivElement>('#route-content')!;
  const params = new URLSearchParams(location.search);
  const example = params.get('example') === '1';
  const loader = example ? await exampleTransport() : undefined;
  startupSignal?.throwIfAborted();
  const presentation = example
    ? undefined
    : new PresentationLoader(await presentationCatalogue(startupSignal));
  let index:
    | (Pick<ProductionIndex, 'latestSnapshotId'> & {
        snapshots: { snapshotId: string; asOfQuarter: string }[];
      })
    | PresentationCatalogue
    | undefined;
  let descriptor: DisplayDescriptor | undefined;
  let payload: SupportingQuarter | null = null;
  const capacityReader = loader ? new CapacityHistoryReader(loader) : undefined;
  let capacityHistory: readonly CapacityPoint[] = [];
  let manufacturerSort: ManufacturerSort = { key: 'capacityTB', descending: true };
  let snapshotId = params.get('snapshot') ?? '';
  let quarter = params.get('quarter') ?? '';
  const report = snapshotReport(params);
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
    if (startupSignal?.aborted) {
      return;
    }
    const active = document.activeElement;
    const focusId = active instanceof HTMLElement ? active.id : '';
    const selection =
      active instanceof HTMLInputElement && active.type === 'search'
        ? ([active.selectionStart, active.selectionEnd] as const)
        : undefined;
    const context = descriptor?.context;
    const currentReport = snapshotReports[report];
    const hddScopeDescription = context
      ? customerHddScopeDescription(
          context.versions.selection,
          context.selection,
          context.inventory,
        )
      : undefined;
    const viewUnavailable =
      !example && context?.kind === 'backblaze' && !snapshotAvailable(context.asOfQuarter, report);
    document.title = `Drive Stats — ${currentReport.label}`;
    const deployments = report === 'deployments';
    const allSupplied = report === 'capacity' || report === 'datacenters';
    const specialized = allSupplied || report === 'manufacturers';
    const coverage = context?.coverage.find((entry) => entry.quarter === quarter);
    const visible = rows();
    const totals = selectionTotals(visible, payload?.status === 'complete');
    const whole = payload?.scopes.selected_hdd.totals;
    const all = payload?.scopes.all_supplied.totals;
    const reportMarkup =
      report === 'capacity'
        ? renderCapacity(capacityHistory, quarter)
        : report === 'manufacturers' && whole
          ? renderManufacturers(visible, whole, payload?.status === 'complete', manufacturerSort)
          : report === 'manufacturers'
            ? '<div class="state-panel" role="status">No manufacturer observations are available for this period. Unknown metrics are not zero.</div>'
            : report === 'datacenters' && coverage
              ? renderDatacenters(payload?.datacenters ?? null, all ?? null, coverage)
              : report === 'deployments'
                ? renderDeployments(visible, payload?.status === 'complete')
                : report === 'distribution'
                  ? renderDistribution(visible, payload?.status === 'complete')
                  : '';
    const canExport =
      !viewUnavailable &&
      (report === 'capacity'
        ? capacityHistory.length > 0
        : report === 'datacenters'
          ? payload !== null
          : payload !== null && visible.length > 0);
    const vendors = [
      ...new Set(
        context?.inventory
          .filter((model) => context.selection.contextModelIds.includes(model.modelId))
          .map((model) => displayModelLabel(model).vendor),
      ),
    ].sort();
    patchContent(
      app,
      `<div class="layout snapshot-layout"><main id="main"><div class="page">
      <section class="page-heading"><div><p class="eyebrow">BACKBLAZE DRIVE STATS</p><h1>${currentReport.title}</h1><p class="subtitle">${currentReport.description}</p></div></section>
      <aside class="source-credit"><span>Source dataset: <a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a> · <a href="https://www.backblaze.com/blog/category/hard-drive-stats/">Official reports</a></span><span>Independent analysis by <a href="https://github.com/SixbucksSolutions/backblaze-drive-stats">Sixbucks Solutions</a></span></aside>
      ${example || context?.kind === 'sample' ? '<div class="sample-banner"><strong>SAMPLE DATA</strong> Fictional examples for exploring coverage and selection. These are not Backblaze results.</div>' : ''}
      <div class="snapshot-controls"><label>Snapshot as of<select id="snapshot-choice" ${!index ? 'disabled' : ''}>${
        index
          ? (example ? [...index.snapshots] : snapshotChoices(index.snapshots, report, snapshotId))
              .sort((a, b) => b.asOfQuarter.localeCompare(a.asOfQuarter))
              .map(
                (entry) =>
                  `<option value="${esc(entry.snapshotId)}" ${!example && !snapshotAvailable(entry.asOfQuarter, report) ? 'disabled' : ''} ${entry.snapshotId === snapshotId ? 'selected' : ''}>${quarterLabel(entry.asOfQuarter)} · ${!example && !snapshotAvailable(entry.asOfQuarter, report) ? 'unavailable for this view' : esc(entry.snapshotId)}</option>`,
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
              ? viewUnavailable
                ? `<div class="state-panel" role="status"><h2>${quarterLabel(context.asOfQuarter)} · ${currentReport.label} unavailable</h2><p>${esc(snapshotUnavailableReason(report))}</p><a href="${esc(exploreUrl(location.href, context.snapshotId, quarter, 'capacity'))}">View total capacity at this cutoff</a></div>`
                : `
      <div class="coverage-banner"><strong>${esc(coverage?.status ?? 'Unavailable')} source coverage · ${quarterLabel(quarter)}</strong><span>${esc(coverage?.reason ?? '')} ${coverage ? `${coverage.observedDays}/${coverage.expectedDays} calendar days observed.` : ''} Snapshot cutoff: ${esc(context.cutoffDate)}. Full-quarter metrics remain unavailable for incomplete coverage.</span></div>
      ${renderScopeMetrics(report, totals, payload, coverage, visible.length)}
      ${!allSupplied && hddScopeDescription ? `<p class="snapshot-note">${esc(hddScopeDescription)}</p>` : ''}
      <section class="panel table-panel"><div class="panel-header"><div><p class="eyebrow">${allSupplied ? 'ALL SUPPLIED OBSERVATIONS' : 'COMPLETE SELECTED-HDD RESULTS'}</p><h2>${specialized ? currentReport.label : deployments ? 'First recorded additions by model' : 'Selected HDD observations'}</h2></div><button id="snapshot-download" class="button" ${!canExport ? 'disabled' : ''}>Download CSV</button></div>
      ${
        !allSupplied
          ? `
      <div class="filters"><label class="search"><input id="snapshot-search" type="search" aria-label="Find a model or vendor" placeholder="Find a model or vendor…" value="${esc(filter.search)}"></label><label>Vendor<select id="snapshot-vendor"><option value="">All vendors</option>${vendors.map((vendor) => `<option value="${esc(vendor)}" ${filter.vendor === vendor ? 'selected' : ''}>${esc(vendor)}</option>`).join('')}</select></label>${report === 'overview' ? `<label>Model set<select id="snapshot-preset"><option value="context" ${filter.preset === 'context' ? 'selected' : ''}>Whole HDD context</option><option value="purchase" ${filter.preset === 'purchase' ? 'selected' : ''}>Purchase comparison defaults</option><option value="reference" ${filter.preset === 'reference' ? 'selected' : ''}>Historical references</option></select></label>` : ''}<button id="snapshot-reset" class="text-button">Clear filters</button></div>
      <details class="snapshot-model-picker" id="snapshot-model-picker"><summary>Choose models (${filter.modelIds?.size ?? context.selection.contextModelIds.length} selected)</summary><div class="snapshot-model-actions"><button id="models-all" class="text-button">All models</button><button id="models-none" class="text-button">No models</button></div><div class="snapshot-model-list">${context.inventory
        .filter((model) => context.selection.contextModelIds.includes(model.modelId))
        .map(
          (model) =>
            `<label><input type="checkbox" id="model-${esc(model.modelId)}" data-model-id="${esc(model.modelId)}" ${!filter.modelIds || filter.modelIds.has(model.modelId) ? 'checked' : ''}><span>${esc(model.vendor)} · ${esc(model.modelNumber)}</span></label>`,
        )
        .join('')}</div></details>`
          : '<p class="snapshot-note">This report uses all supplied observations, including HDDs, SSDs and unresolved media. HDD model/vendor filters do not change its totals. Capacity is nominal raw capacity, not utilized space.</p>'
      }
      ${!allSupplied ? '<p class="snapshot-note">Filters affect this table and its export. Whole-context share denominators remain unchanged. Capacity is aggregate model capacity, not per-drive capacity. First recorded is not an installation date.</p>' : ''}
      ${reportMarkup}
      ${
        specialized
          ? ''
          : payload
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
      <details class="methodology panel" id="snapshot-methodology"><summary>Coverage, scope and source information</summary><div class="methodology-body"><p>${esc(context.provenance.label)}. ${esc(context.provenance.credit)}.</p><p>History begins ${quarterLabel(context.sourceDomain.historyStartQuarter)}; source publication begins ${esc(context.sourceDomain.firstPublishedDate)}. Recorded observations do not establish complete lifetime exposure. Datacenter fields are ${coverage?.datacenterFieldAvailable ? 'reported' : 'unreported; locations stay Unknown'} for this period.</p><p>Snapshot ${esc(context.snapshotId)}. Generated ${esc(context.generatedAt)}. <a href="${esc(context.provenance.url)}">Source dataset</a>.</p></div></details>`
              : ''
      }</div>
      <footer><a href="https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data">Backblaze Drive Stats</a><span>Independent Sixbucks Solutions analysis</span><a href="${import.meta.env.BASE_URL}fonts/NOTICE.txt">Font credits & licenses</a></footer></div></main></div>`,
    );
    updatePublishedNavigation(
      context ? { snapshotId: context.snapshotId, kind: context.kind } : undefined,
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
    app.querySelectorAll<HTMLButtonElement>('[data-manufacturer-sort]').forEach((button) => {
      button.onclick = () => {
        const key = button.dataset.manufacturerSort as ManufacturerSort['key'];
        manufacturerSort = {
          key,
          descending:
            key === manufacturerSort.key ? !manufacturerSort.descending : key !== 'vendor',
        };
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
        if (!descriptor) {
          return;
        }
        const exportRows = rows();
        const coverage = descriptor.context.coverage.find((row) => row.quarter === quarter)!;
        const allSupplied = report === 'capacity' || report === 'datacenters';
        const scope = allSupplied ? payload?.scopes.all_supplied : payload?.scopes.selected_hdd;
        const metadata: ReportCsvMetadata = {
          snapshotId,
          asOfQuarter: descriptor.context.asOfQuarter,
          quarter,
          status: coverage.status,
          kind: descriptor.context.kind,
          sourceUrl: descriptor.context.provenance.url,
          scope: allSupplied ? 'all_supplied' : 'selected_hdd',
          contextCount: scope?.totals.count ?? null,
          contextNew: scope?.totals.new ?? null,
          report,
          filterDescription: allSupplied
            ? 'All supplied observations; HDD model/vendor filters do not apply'
            : `${customerHddScopeDescription(descriptor.context.versions.selection, descriptor.context.selection, descriptor.context.inventory) ?? 'Whole HDD context'} Vendor: ${filter.vendor || 'all'}; search: ${filter.search || 'none'}; model selection: ${filter.modelIds ? [...filter.modelIds].join(' ') : 'all context'}; model set: ${report === 'overview' ? filter.preset : 'context'}`,
          sourceHistoryStart: descriptor.context.sourceDomain.historyStartQuarter,
        };
        let content: string;
        if (report === 'capacity') {
          if (!capacityHistory.length) {
            return;
          }
          content = reportCsv(capacityCsvRows(capacityHistory), (index) => ({
            ...metadata,
            quarter: capacityHistory[index]!.quarter,
            status: capacityHistory[index]!.status,
            contextCount: capacityHistory[index]!.count,
            contextNew: null,
          }));
        } else if (report === 'datacenters') {
          if (!payload) {
            return;
          }
          content = reportCsv(
            datacenterCsvRows(payload.datacenters, payload.scopes.all_supplied.totals, coverage),
            metadata,
          );
        } else if (report === 'manufacturers') {
          if (!payload || !exportRows.length) {
            return;
          }
          content = reportCsv(
            manufacturerCsvRows(
              exportRows,
              payload.scopes.selected_hdd.totals,
              payload.status === 'complete',
              manufacturerSort,
            ),
            metadata,
          );
        } else {
          if (!payload || !exportRows.length) {
            return;
          }
          content = selectionCsv(exportRows, metadata);
        }
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
    if (signal?.aborted || startupSignal?.aborted) {
      return;
    }
    const id = ++request;
    controller?.abort();
    controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    busy = true;
    error = '';
    payload = null;
    capacityHistory = [];
    // Never offer a previous generation's quarter choices while a new descriptor loads.
    if (nextSnapshot !== snapshotId) {
      descriptor = undefined;
      filter = defaultFilter();
    }
    snapshotId = nextSnapshot;
    render();
    try {
      if (presentation) {
        index = presentation.catalogue;
        const choice = presentation.selection(
          new URLSearchParams({ view: 'explore', snapshot: nextSnapshot, quarter: nextQuarter }),
        );
        if (!choice) {
          throw new Error('Unknown production presentation.');
        }
        const capsule = await presentation.load(choice, combined);
        if (id !== request || combined.aborted) {
          return;
        }
        if (capsule.kind !== 'report') {
          throw new Error('Invalid report presentation.');
        }
        descriptor = capsule.body.descriptor;
        snapshotId = capsule.snapshotId;
        quarter = capsule.quarter!;
        payload = capsule.body.quarter;
        capacityHistory = capsule.body.capacityHistory;
        syncUrl();
        busy = false;
        render();
        return;
      }
      if (!loader || !capacityReader) {
        throw new Error('Example reader unavailable.');
      }
      const loadedIndex = index ?? (await loader.loadIndex(combined));
      if (id !== request || combined.aborted) {
        return;
      }
      index = loadedIndex;
      const target = index.snapshots.some((entry) => entry.snapshotId === nextSnapshot)
        ? nextSnapshot
        : index.latestSnapshotId;
      const loaded = await loader.loadDescriptor(target, combined);
      if (id !== request || combined.aborted) {
        return;
      }
      descriptor = loaded;
      snapshotId = target;
      quarter = loaded.quarters.some((entry) => entry.quarter === nextQuarter)
        ? nextQuarter
        : loaded.context.asOfQuarter;
      syncUrl();
      const loadedPayload = await loader.loadQuarter(target, quarter, combined);
      if (id !== request || combined.aborted) {
        return;
      }
      const history = report === 'capacity' ? await capacityReader.load(target, combined) : [];
      if (id !== request || combined.aborted) {
        return;
      }
      payload = loadedPayload;
      capacityHistory = history;
    } catch {
      if (id !== request || combined.aborted) {
        return;
      }
      error = 'The selected snapshot could not be loaded or verified. Please try again.';
    }
    if (id === request && !combined.aborted) {
      busy = false;
      render();
    }
  }

  await load(snapshotId, quarter, startupSignal);
}
