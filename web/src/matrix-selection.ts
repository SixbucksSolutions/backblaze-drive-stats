import type { MatrixModel } from './matrix-data.ts';
import { displayModelLabel, displayVendor } from './model-labels.ts';
import { nominalCapacityTB } from './model-capacity.ts';

const vendorOrder = ['Seagate', 'Toshiba', 'HGST/WD'];
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
    const vendor = displayModelLabel({ vendor: model.vendor, modelNumber: model.name }).vendor;
    const group = groups.get(vendor) ?? [];
    group.push(model);
    groups.set(vendor, group);
  }
  return [...groups]
    .sort(([a], [b]) => vendorRank(a) - vendorRank(b) || a.localeCompare(b))
    .map(([vendor, members]) => ({
      vendor,
      models: members.sort(
        (a, b) =>
          (nominalCapacityTB(b.capacityTB) ?? 0) - (nominalCapacityTB(a.capacityTB) ?? 0) ||
          displayModelLabel({ vendor: a.vendor, modelNumber: a.name }).modelNumber.localeCompare(
            displayModelLabel({ vendor: b.vendor, modelNumber: b.name }).modelNumber,
          ) ||
          a.id.localeCompare(b.id),
      ),
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
    if (
      displayModelLabel({ vendor: model.vendor, modelNumber: model.name }).vendor !==
      displayVendor(vendor)
    ) {
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
