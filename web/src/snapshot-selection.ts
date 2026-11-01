import { csv } from './data.ts';

/** Plain text shared by report and matrix explanations; callers escape for HTML. */
export function customerHddScopeDescription(
  selectionVersion: string,
  selection: { minimumCapacityTB?: number; excludedModelIds?: readonly string[] },
  inventory: readonly Pick<InventoryLabel, 'modelId' | 'modelNumber'>[] = [],
): string | undefined {
  if (selectionVersion !== '2.1.0' || selection.minimumCapacityTB === undefined) {
    return undefined;
  }
  const excluded = selection.excludedModelIds ?? [];
  const labels = excluded.flatMap((id) => {
    const model = inventory.find((entry) => entry.modelId === id);
    return model ? [model.modelNumber] : [];
  });
  const unnamed = excluded.length - labels.length;
  if (unnamed > 0) {
    labels.push(`${unnamed} ${labels.length ? 'additional ' : ''}model${unnamed === 1 ? '' : 's'}`);
  }
  const exclusions = labels.length ? ` Owner-designated exclusions: ${labels.join(', ')}.` : '';
  return `Historical customer-HDD fleet: evidenced HDD models observed by this snapshot cutoff with nominal capacity ≥${selection.minimumCapacityTB} TB.${exclusions} Smaller populations remain in the supporting reports. AFR comparison separately requires at least 2,000 observed drives in a quarter; partial capture can establish a lower-bound qualification proof while AFR values remain unavailable.`;
}

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
export type ReportCsvMetadata = {
  snapshotId: string;
  asOfQuarter: string;
  quarter: string;
  status: string;
  kind: string;
  sourceUrl: string;
  scope: ScopeName;
  contextCount: number | null;
  contextNew?: number | null;
  report?: string;
  filterDescription?: string;
  sourceHistoryStart?: string;
};

/** Add the same scope/source attribution to model, grouped and history exports. */
export function reportCsv(
  rows: (string | number)[][],
  metadata: ReportCsvMetadata | ((dataRow: number) => ReportCsvMetadata),
) {
  return csv([
    [
      ...rows[0]!,
      'Snapshot',
      'As of quarter',
      'Reporting quarter',
      'Coverage',
      'Data kind',
      'Scope',
      'Whole scope observed drives',
      'Data source',
      'Source URL',
      'Report',
      'Visible row filters',
      'Whole scope first recorded',
      'Supplied history starts',
      'Observation interpretation',
    ],
    ...rows.slice(1).map((row, index) => {
      const meta = typeof metadata === 'function' ? metadata(index) : metadata;
      return [
        ...row,
        meta.snapshotId,
        meta.asOfQuarter,
        meta.quarter,
        meta.status,
        meta.kind,
        meta.scope,
        meta.contextCount ?? 'Unavailable',
        'Backblaze Drive Stats; independent Sixbucks Solutions analysis',
        meta.sourceUrl,
        meta.report ?? 'overview',
        meta.filterDescription ?? 'Whole context',
        meta.contextNew ?? 'Unavailable',
        meta.sourceHistoryStart ?? 'See source coverage',
        'Count is observed anywhere in the quarter, not quarter-end stock. Capacity is nominal raw capacity, not utilized space. First recorded includes the initial observed fleet; publication boundaries and gaps prevent inferring installation dates.',
      ];
    }),
  ]);
}

export function selectionCsv(rows: DisplayRow[], metadata: ReportCsvMetadata) {
  return reportCsv(
    [
      ['Vendor', 'Model', 'Observed drives', 'First recorded', 'Aggregate raw capacity TB'],
      ...rows.map((row) => [
        row.vendor,
        row.modelNumber,
        row.count ?? 'Unavailable',
        row.new ?? 'Unavailable',
        row.capacityTB ?? 'Unavailable',
      ]),
    ],
    metadata,
  );
}
