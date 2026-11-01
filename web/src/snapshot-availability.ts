import type { SnapshotReport } from './app-route.ts';

export type SnapshotView = SnapshotReport | 'matrix';

// Reviewed current-release bounds, verified against every public descriptor and
// matrix by the release gate. These are availability bounds, not invented data.
export const firstAvailableCutoff: Readonly<Record<SnapshotView, string>> = Object.freeze({
  matrix: '2013-Q2',
  overview: '2013-Q2',
  deployments: '2013-Q2',
  distribution: '2013-Q2',
  manufacturers: '2013-Q2',
  capacity: '2013-Q2',
  datacenters: '2023-Q3',
});

export function snapshotAvailable(asOfQuarter: string, view: SnapshotView): boolean {
  return asOfQuarter >= firstAvailableCutoff[view];
}

/** Keep unsupported direct URLs as disabled selected options without changing dates. */
export function snapshotChoices<T extends { snapshotId: string; asOfQuarter: string }>(
  entries: readonly T[],
  view: SnapshotView,
  selectedId: string,
): T[] {
  return entries.filter(
    (entry) => snapshotAvailable(entry.asOfQuarter, view) || entry.snapshotId === selectedId,
  );
}

export function snapshotUnavailableReason(view: SnapshotView): string {
  if (view === 'datacenters') {
    return 'Datacenter observations are unavailable at this cutoff. Datacenter capture begins in July 2023; choose a snapshot from 2023 Q3 onward. Earlier calendar periods remain unavailable.';
  }
  return 'No evidenced HDD models qualify for this view at the selected cutoff. Supporting fleet context remains available in Total capacity.';
}
