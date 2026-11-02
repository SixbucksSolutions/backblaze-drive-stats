import { nominalCapacityTB } from './model-capacity.ts';
import { displayModelLabel } from './model-labels.ts';

type AlignmentModel = {
  id: string;
  name: string;
  capacityTB?: number | null;
};

/** Locate only a known capacity block; older Seagate codes can have one legacy digit. */
function seagateCapacityEnd(model: AlignmentModel): number | null {
  const capacity = nominalCapacityTB(model.capacityTB);
  if (capacity === null || !Number.isInteger(capacity * 1000)) {
    return null;
  }
  const gigabytes = String(capacity * 1000);
  if (model.name.startsWith(`ST${gigabytes}`)) {
    return 2 + gigabytes.length;
  }
  if (/^ST\d/.test(model.name) && model.name.slice(3).startsWith(gigabytes)) {
    return 3 + gigabytes.length;
  }
  return null;
}

/** Use every model in the brand, before search filtering, to keep alignment stable. */
export function seagateModelIndents(models: readonly AlignmentModel[]): Map<string, number> {
  const ends = models.map((model) => seagateCapacityEnd(model));
  const lastColumn = Math.max(0, ...ends.map((end) => end ?? 0));
  return new Map(
    models.map((model, index) => {
      const end = ends[index];
      return [model.id, end === null || end === undefined ? 0 : lastColumn - end];
    }),
  );
}

/** Shared selector columns come from the complete snapshot, never the search matches. */
export function modelSelectorLayout(models: readonly (AlignmentModel & { vendor: string })[]) {
  const indents = seagateModelIndents(models.filter((model) => model.vendor === 'Seagate'));
  const labels = new Map(
    models.map((model) => {
      const code = displayModelLabel({
        vendor: model.vendor,
        modelNumber: model.name,
      }).modelNumber;
      const capacity = nominalCapacityTB(model.capacityTB);
      const capacityText = capacity === null ? null : String(capacity);
      const decimalIndex = capacityText?.indexOf('.') ?? -1;
      return [
        model.id,
        {
          code,
          indent: indents.get(model.id) ?? 0,
          capacity: capacityText,
          integer: decimalIndex < 0 ? capacityText : capacityText!.slice(0, decimalIndex),
          fraction: decimalIndex < 0 ? '' : capacityText!.slice(decimalIndex),
        },
      ] as const;
    }),
  );
  const values = [...labels.values()];
  const codeWidth = Math.max(0, ...values.map((label) => label.indent + label.code.length));
  const integerWidth = Math.max(2, ...values.map((label) => label.integer?.length ?? 0));
  const fractionWidth = Math.max(2, ...values.map((label) => label.fraction.length));
  const capacityWidth = Math.max(
    integerWidth + fractionWidth + ' TB'.length,
    values.some((label) => label.capacity === null) ? 'capacity unknown'.length : 0,
  );
  return { labels, codeWidth, integerWidth, fractionWidth, capacityWidth };
}
