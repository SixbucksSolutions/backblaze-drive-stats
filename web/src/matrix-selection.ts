import type { MatrixModel } from './matrix-data.ts';

const vendorOrder = ['Seagate', 'Toshiba', 'WDC/HGST'];
const vendorRank = (vendor: string) => {
  const index = vendorOrder.indexOf(vendor);
  return index === -1 ? vendorOrder.length : index;
};

/** Sidebar and table share the same brand and model ordering. */
export function groupModels(
  models: readonly MatrixModel[],
): { vendor: string; models: MatrixModel[] }[] {
  const groups = new Map<string, MatrixModel[]>();
  for (const model of models) {
    const group = groups.get(model.vendor) ?? [];
    group.push(model);
    groups.set(model.vendor, group);
  }
  return [...groups]
    .sort(([a], [b]) => vendorRank(a) - vendorRank(b) || a.localeCompare(b))
    .map(([vendor, members]) => ({
      vendor,
      models: members.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    }));
}

export function vendorSelectionState(
  models: readonly MatrixModel[],
  selected: ReadonlySet<string>,
) {
  const totalCount = models.length;
  const selectedCount = models.filter((model) => selected.has(model.id)).length;
  return {
    checked: totalCount > 0 && selectedCount === totalCount,
    indeterminate: selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
    totalCount,
  };
}

/** Use the entire snapshot so a sidebar search cannot narrow a brand toggle. */
export function setVendorSelected(
  allModels: readonly MatrixModel[],
  vendor: string,
  selected: ReadonlySet<string>,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const model of allModels) {
    if (model.vendor !== vendor) {
      continue;
    }
    if (checked) {
      next.add(model.id);
    } else {
      next.delete(model.id);
    }
  }
  return next;
}
