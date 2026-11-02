/** Preserve explicit legacy views while the real flagship becomes the landing view. */
export function appRoute(params: URLSearchParams): 'matrix' | 'snapshot' | 'legacy' {
  const view = params.get('view');
  if (view === null || view === 'matrix') {
    return 'matrix';
  }
  if (
    view === 'explore' ||
    (params.get('legacy') !== '1' &&
      ['deployments', 'distribution', 'capacity', 'manufacturers', 'datacenters'].includes(view))
  ) {
    return 'snapshot';
  }
  return 'legacy';
}

export type SnapshotReport =
  'overview' | 'deployments' | 'distribution' | 'capacity' | 'manufacturers' | 'datacenters';

/** The six published views share one navigation, independent of their renderer. */
export const publishedViews = [
  { id: 'matrix', label: 'AFR comparison', icon: '◴' },
  { id: 'deployments', label: 'Deployments', icon: '↗' },
  { id: 'distribution', label: 'Drive mix', icon: '▥' },
  { id: 'capacity', label: 'Total capacity', icon: '▱' },
  { id: 'manufacturers', label: 'By manufacturer', icon: '▦' },
  { id: 'datacenters', label: 'By datacenter', icon: '◎' },
] as const;
export type PublishedView = (typeof publishedViews)[number]['id'];
export type NavigationContext = { snapshotId?: string; kind?: 'backblaze' | 'sample' };

export function activePublishedView(params: URLSearchParams): PublishedView | undefined {
  const route = appRoute(params);
  if (route === 'matrix') {
    return params.get('reference') === '1' ? undefined : 'matrix';
  }
  const report = snapshotReport(params);
  return route === 'snapshot' && params.get('example') !== '1' && report !== 'overview'
    ? report
    : undefined;
}

/** Keep reporting context while entering an unambiguous production route. */
export function publishedViewUrl(
  current: string,
  view: PublishedView,
  context?: NavigationContext,
) {
  const url = new URL(current);
  const params = url.searchParams;
  const nonProduction =
    params.get('example') === '1' ||
    params.get('reference') === '1' ||
    appRoute(params) === 'legacy' ||
    context?.kind === 'sample';
  if (nonProduction) {
    params.delete('snapshot');
  }
  if (context?.kind === 'backblaze' && context.snapshotId) {
    params.set('snapshot', context.snapshotId);
  }
  for (const key of ['report', 'legacy', 'example', 'reference']) {
    params.delete(key);
  }
  params.set('view', view);
  // Cell/methodology fragments belong to the report being left.
  url.hash = '';
  return url;
}

/** Real links retain the as-of generation; fictional IDs never enter production. */
export function matrixHref(
  snapshotId: string | undefined,
  kind: 'backblaze' | 'sample' | undefined,
) {
  return `?view=matrix${kind === 'backblaze' && snapshotId ? `&snapshot=${encodeURIComponent(snapshotId)}` : ''}`;
}
export function snapshotReport(params: URLSearchParams): SnapshotReport {
  const requested = params.get('report') ?? params.get('view');
  return requested === 'deployments' ||
    requested === 'distribution' ||
    requested === 'capacity' ||
    requested === 'manufacturers' ||
    requested === 'datacenters'
    ? requested
    : 'overview';
}
