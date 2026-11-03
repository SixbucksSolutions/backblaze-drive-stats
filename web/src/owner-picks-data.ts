import type { MatrixModel, MatrixSnapshot } from './matrix-data.ts';
import type { MatrixCapsule } from './presentation-data.ts';
import { nominalCapacityTB } from './model-capacity.ts';

/** Editorial review binds model identities to one immutable generation, never a moving latest. */
export const reviewedSnapshotId = '2026-Q2-v2-df0f0fab6e6927622091aaba';
export const editorialUpdateDate = '2026-11-03';
export const editorialModels = ['ST16000NM001G', 'WUH722222ALE6L4', 'WUH721816ALE6L4'] as const;
const quarterPosition = (quarter: string) =>
  Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1));
export function pickEvidence(model: MatrixModel, snapshot: MatrixSnapshot, asOfQuarter: string) {
  const cell = model.cells.find((row) => row.quarter === asOfQuarter);
  // This existing capsule evidence retains the pre-anchor first observation. Counting
  // only visible/eligible cells would discard early history and compress missing quarters.
  const first = cell?.productionEvidence
    ?.find((row) => row.label === 'First recorded / first proven threshold')
    ?.value.split(' / ')[0];
  const firstQuarter = first && /^\d{4}-Q[1-4]$/.test(first) && first <= asOfQuarter ? first : null;
  const endMonth = Number(asOfQuarter.at(-1)) * 3;
  const endDate = new Date(Date.UTC(Number(asOfQuarter.slice(0, 4)), endMonth, 0))
    .toISOString()
    .slice(0, 10);
  const currentCompleted = snapshot.cutoff !== null && snapshot.cutoff >= endDate;
  const elapsedQuarters = firstQuarter
    ? Math.max(
        0,
        quarterPosition(asOfQuarter) - quarterPosition(firstQuarter) + (currentCompleted ? 1 : 0),
      )
    : null;
  const matureQuarters =
    model.anchor && model.anchor <= asOfQuarter
      ? Math.max(
          0,
          quarterPosition(asOfQuarter) - quarterPosition(model.anchor) + (currentCompleted ? 1 : 0),
        )
      : null;
  const count = cell?.metrics.count ?? null;
  const capacityTB = nominalCapacityTB(model.capacityTB);
  const quarterlyAfr = cell?.quarterAfr ?? null;
  const cumulativeAfr = cell?.metrics.afr ?? null;
  const eligible =
    quarterlyAfr !== null &&
    cumulativeAfr !== null &&
    Number.isFinite(quarterlyAfr) &&
    Number.isFinite(cumulativeAfr) &&
    capacityTB !== null &&
    capacityTB >= 16 &&
    count !== null &&
    count >= 20_000 &&
    matureQuarters !== null &&
    matureQuarters >= 8 &&
    currentCompleted &&
    cell?.state === 'eligible' &&
    cell.quarterComponents?.complete === true;
  return {
    cell,
    firstQuarter,
    elapsedQuarters,
    matureQuarters,
    count,
    capacityTB,
    quarterlyAfr,
    cumulativeAfr,
    eligible,
    preferredHistory: matureQuarters !== null && matureQuarters >= 12,
    completeHistory: cell?.cumulativeComponents?.complete === true,
  };
}
export function reviewedPicks(capsule: MatrixCapsule) {
  if (capsule.snapshotId !== reviewedSnapshotId || capsule.body.kind !== 'production') {
    return [];
  }
  return editorialModels
    .map((name) => {
      const model = capsule.body.models.find((row) => row.name === name);
      return {
        name,
        model,
        evidence: model ? pickEvidence(model, capsule.body, capsule.asOfQuarter) : null,
      };
    })
    .sort((a, b) => {
      const aCount = a.evidence?.count;
      const bCount = b.evidence?.count;
      const aValid = aCount != null && Number.isFinite(aCount);
      const bValid = bCount != null && Number.isFinite(bCount);
      if (!aValid) {
        return bValid ? 1 : 0;
      }
      if (!bValid) {
        return -1;
      }
      return bCount - aCount;
    });
}
