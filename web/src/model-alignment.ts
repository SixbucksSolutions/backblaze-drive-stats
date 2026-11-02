import { nominalCapacityTB } from './model-capacity.ts';

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
