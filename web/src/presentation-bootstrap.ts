import { appRoute } from './app-route.ts';
import type { PresentationCatalogue, CapsuleReference } from './presentation-data.ts';

export type InitialPresentation = {
  kind: 'matrix' | 'report';
  snapshotId: string;
  quarter: string | null;
  ref: CapsuleReference;
};
/** Shared by the HTML bootstrap and application. Unknown matrix IDs remain errors. */
export function initialPresentation(
  params: URLSearchParams,
  catalogue: PresentationCatalogue,
): InitialPresentation | null {
  const route = appRoute(params);
  if (
    route === 'legacy' ||
    (route === 'matrix' && params.get('reference') === '1') ||
    (route === 'snapshot' && params.get('example') === '1')
  ) {
    return null;
  }
  const requested = params.get('snapshot');
  const snapshot =
    catalogue.snapshots.find((s) => s.snapshotId === requested) ??
    (route === 'matrix' && requested !== null
      ? undefined
      : catalogue.snapshots.find((s) => s.snapshotId === catalogue.latestSnapshotId));
  if (!snapshot) {
    return null;
  }
  if (route === 'matrix') {
    return { kind: 'matrix', snapshotId: snapshot.snapshotId, quarter: null, ref: snapshot.matrix };
  }
  const quarter =
    snapshot.reports.find((q) => q.quarter === params.get('quarter')) ??
    snapshot.reports.find((q) => q.quarter === snapshot.asOfQuarter);
  return quarter
    ? {
        kind: 'report',
        snapshotId: snapshot.snapshotId,
        quarter: quarter.quarter,
        ref: quarter.ref,
      }
    : null;
}

export type InitialRequest = {
  key: string;
  ref: CapsuleReference;
  controller: AbortController;
  promise: Promise<ArrayBuffer>;
};
export type PresentationHost = { __presentationInitial?: InitialRequest };
export const presentationKey = (
  selection: Pick<InitialPresentation, 'kind' | 'snapshotId' | 'quarter'>,
) => JSON.stringify([selection.kind, selection.snapshotId, selection.quarter]);
/** Generated as classic inline JavaScript, so request start does not await a module. */
export function presentationBootstrapSource(
  _catalogue: PresentationCatalogue,
  baseUrl: string,
): string {
  return `(()=>{const appRoute=${appRoute.toString()};const initialPresentation=${initialPresentation.toString()};const c=JSON.parse(document.getElementById('presentation-catalogue').textContent);const s=initialPresentation(new URLSearchParams(location.search),c);if(!s)return;const controller=new AbortController();const promise=fetch(new URL(s.ref.path,new URL(${JSON.stringify(baseUrl)},location.href)),{signal:controller.signal,credentials:'omit',redirect:'error'}).then(r=>{if(!r.ok)throw new Error('Presentation request failed');return r.arrayBuffer()});promise.catch(()=>{});window.__presentationInitial={key:JSON.stringify([s.kind,s.snapshotId,s.quarter]),ref:s.ref,controller,promise};})();`;
}
