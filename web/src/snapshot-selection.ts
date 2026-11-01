import { csv } from './data.ts';

export type ScopeName = 'selected_hdd' | 'all_supplied';
export type SelectionPreset = 'context' | 'purchase' | 'reference';
export type InventoryLabel = { modelId: string; vendor: string; modelNumber: string };
export type ContextSelection = {
  contextModelIds: string[];
  purchaseDefaultModelIds: string[];
  historicalReferenceModelIds: string[];
};
export type AggregateRow = {
  modelId: string;
  count: number | null;
  new: number | null;
  capacityTB: number | null;
};
export type DisplayRow = AggregateRow & { vendor: string; modelNumber: string };
export type ModelFilter = {
  vendor: string;
  search: string;
  preset: SelectionPreset;
  modelIds: ReadonlySet<string> | undefined;
};
export type ModelSort = 'modelNumber' | 'vendor' | 'count' | 'new' | 'capacityTB';

export const defaultFilter = (): ModelFilter => ({
  vendor: '',
  search: '',
  preset: 'context',
  modelIds: undefined,
});

/** Context is the initial selection; purchase presets never redefine its denominator. */
export function selectRows(
  rows: AggregateRow[],
  inventory: InventoryLabel[],
  selection: ContextSelection,
  filter: ModelFilter,
  sort: ModelSort = 'count',
  descending = true,
): DisplayRow[] {
  const labels = new Map(inventory.map((model) => [model.modelId, model]));
  const preset = new Set(
    filter.preset === 'purchase'
      ? selection.purchaseDefaultModelIds
      : filter.preset === 'reference'
        ? selection.historicalReferenceModelIds
        : selection.contextModelIds,
  );
  const search = filter.search.trim().toLocaleLowerCase('en-US');
  return rows
    .flatMap((row) => {
      const model = labels.get(row.modelId);
      if (!model) {
        throw new Error('A supporting model has no inventory label.');
      }
      return preset.has(row.modelId) &&
        (!filter.vendor || filter.vendor === model.vendor) &&
        (!filter.modelIds || filter.modelIds.has(row.modelId)) &&
        `${model.vendor} ${model.modelNumber}`.toLocaleLowerCase('en-US').includes(search)
        ? [{ ...row, vendor: model.vendor, modelNumber: model.modelNumber }]
        : [];
    })
    .sort((a, b) => {
      const av = a[sort],
        bv = b[sort];
      // Unknown values stay last in either direction, and zero remains a measured value.
      if (av === null || bv === null) {
        return av === bv ? a.modelId.localeCompare(b.modelId) : av === null ? 1 : -1;
      }
      const order =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return order * (descending ? -1 : 1) || a.modelId.localeCompare(b.modelId);
    });
}

export function selectionTotals(rows: AggregateRow[], complete: boolean) {
  const sum = (key: 'count' | 'new' | 'capacityTB') =>
    !complete || rows.some((row) => row[key] === null)
      ? null
      : rows.reduce((total, row) => total + (row[key] ?? 0), 0);
  return { count: sum('count'), new: sum('new'), capacityTB: sum('capacityTB') };
}

export function quarterLabel(quarter: string) {
  return quarter.replace('-Q', ' Q');
}

export function exploreUrl(current: string, snapshotId: string, quarter: string, report: string) {
  const url = new URL(current);
  url.searchParams.set('view', 'explore');
  url.searchParams.set('snapshot', snapshotId);
  url.searchParams.set('quarter', quarter);
  url.searchParams.set('report', report);
  return url;
}

/** Export the same filtered rows as the table, with the unfiltered scope made explicit. */
export function selectionCsv(
  rows: DisplayRow[],
  metadata: {
    snapshotId: string;
    asOfQuarter: string;
    quarter: string;
    status: string;
    kind: string;
    sourceUrl: string;
    scope: ScopeName;
    contextCount: number | null;
  },
) {
  return csv([
    [
      'Vendor',
      'Model',
      'Observed drives',
      'First recorded',
      'Aggregate raw capacity TB',
      'Snapshot',
      'As of quarter',
      'Reporting quarter',
      'Coverage',
      'Data kind',
      'Scope',
      'Whole scope observed drives',
      'Data source',
      'Source URL',
    ],
    ...rows.map((row) => [
      row.vendor,
      row.modelNumber,
      row.count ?? 'Unavailable',
      row.new ?? 'Unavailable',
      row.capacityTB ?? 'Unavailable',
      metadata.snapshotId,
      metadata.asOfQuarter,
      metadata.quarter,
      metadata.status,
      metadata.kind,
      metadata.scope,
      metadata.contextCount ?? 'Unavailable',
      'Backblaze Drive Stats; independent Sixbucks Solutions analysis',
      metadata.sourceUrl,
    ]),
  ]);
}
