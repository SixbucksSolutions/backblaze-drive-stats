import type { ProductionMatrix, SnapshotDescriptor } from './production-data.ts';
import { displayModelLabel } from './model-labels.ts';

export type AfrTimeMode = 'relative' | 'calendar';
export type AfrMetric = 'cumulative' | 'quarterly';
export type AfrTimelinePoint = {
  quarter: string;
  relativeQuarter: number;
  cumulativeAfr: number | null;
  quarterlyAfr: number | null;
  count: number | null;
  failures: number;
  driveDays: number;
  coverage: 'complete' | 'partial' | 'missing' | 'unpublished';
  historyComplete: boolean;
};
export type AfrTimelineModel = {
  id: string;
  name: string;
  vendor: string;
  capacityTB: number | null;
  firstQuarter: string;
  points: AfrTimelinePoint[];
};
export type AfrTimelineData = {
  snapshotId: string;
  asOfQuarter: string;
  sourceManifestSha256: string;
  rateVersion: string;
  models: AfrTimelineModel[];
};
const ordinal = (quarter: string) => Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1)) - 1;

/** Use the snapshot's matrix model list, with each model's full recorded HDD history. */
export function deriveAfrTimeline(
  descriptor: SnapshotDescriptor,
  matrix: ProductionMatrix,
): AfrTimelineData {
  const context = descriptor.context;
  const modelIds = new Set(matrix.models.map((model) => model.modelId));
  const coverage = new Map(context.coverage.map((row) => [row.quarter, row.status]));
  return {
    snapshotId: context.snapshotId,
    asOfQuarter: context.asOfQuarter,
    sourceManifestSha256: context.sourceManifestSha256,
    rateVersion: context.versions.rate,
    models: context.inventory
      .filter(
        (model) =>
          modelIds.has(model.modelId) &&
          model.mediaClass === 'hdd' &&
          model.firstObservedInDeclaredHistory !== null,
      )
      .map((model) => {
        const firstQuarter = model.firstObservedInDeclaredHistory!;
        const label = displayModelLabel(model);
        const history = model.history.filter((row) => row.quarter <= context.asOfQuarter);
        const lastQuarter = history.findLast((row) => row.knownDriveDays > 0)?.quarter;
        let failures = 0;
        let driveDays = 0;
        const points: AfrTimelinePoint[] = [];
        for (const row of history) {
          failures += row.knownFailures;
          driveDays += row.knownDriveDays;
          if (row.quarter < firstQuarter || !lastQuarter || row.quarter > lastQuarter) {
            continue;
          }
          const status = coverage.get(row.quarter) ?? 'missing';
          const drawable = status === 'complete' && row.knownDriveDays > 0;
          points.push({
            quarter: row.quarter,
            relativeQuarter: ordinal(row.quarter) - ordinal(firstQuarter) + 1,
            cumulativeAfr: drawable ? (failures / driveDays) * 36500 : null,
            quarterlyAfr: drawable ? (row.knownFailures / row.knownDriveDays) * 36500 : null,
            count: row.quarterCount,
            failures: row.knownFailures,
            driveDays: row.knownDriveDays,
            coverage: status,
            historyComplete: context.coverage
              .filter((source) => source.quarter <= row.quarter)
              .every((source) => source.status === 'complete'),
          });
        }
        return {
          id: model.modelId,
          name: label.modelNumber,
          vendor: label.vendor,
          capacityTB: model.capacityTB,
          firstQuarter,
          points,
        };
      }),
  };
}
