/** Preserve explicit legacy views while the real flagship becomes the landing view. */
export function appRoute(params: URLSearchParams): 'matrix' | 'snapshot' | 'legacy' {
  const view = params.get('view');
  if (view === null || view === 'matrix') {
    return 'matrix';
  }
  if (
    view === 'explore' ||
    (params.get('legacy') !== '1' && (view === 'deployments' || view === 'distribution'))
  ) {
    return 'snapshot';
  }
  return 'legacy';
}

export type SnapshotReport = 'overview' | 'deployments' | 'distribution';
export function snapshotReport(params: URLSearchParams): SnapshotReport {
  const requested = params.get('report') ?? params.get('view');
  return requested === 'deployments' || requested === 'distribution' ? requested : 'overview';
}
