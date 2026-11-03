import { appRoute } from './app-route.ts';
import type { PresentationCatalogue, CapsuleReference } from './presentation-data.ts';

export type InitialPresentation = {
  kind: 'matrix' | 'report' | 'timeline';
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
    route === 'picks' ||
    route === 'legacy' ||
    (route === 'matrix' && params.get('reference') === '1') ||
    (route === 'snapshot' && params.get('example') === '1')
  ) {
    return null;
  }
  const requested = params.get('snapshot');
  const snapshot =
    catalogue.snapshots.find((s) => s.snapshotId === requested) ??
    ((route === 'matrix' || route === 'timeline') && requested !== null
      ? undefined
      : catalogue.snapshots.find((s) => s.snapshotId === catalogue.latestSnapshotId));
  if (!snapshot) {
    return null;
  }
  if (route === 'matrix') {
    return { kind: 'matrix', snapshotId: snapshot.snapshotId, quarter: null, ref: snapshot.matrix };
  }
  if (route === 'timeline') {
    return snapshot.timeline
      ? { kind: 'timeline', snapshotId: snapshot.snapshotId, quarter: null, ref: snapshot.timeline }
      : null;
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
export type AnalyticsCatalogueReference = {
  contractVersion: 1;
  path: string;
  sha256: string;
  sizeBytes: number;
};
export function parseAnalyticsCatalogueReference(value: unknown): AnalyticsCatalogueReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid catalogue reference');
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).sort().join(',') !== 'contractVersion,path,sha256,sizeBytes' ||
    row.contractVersion !== 1 ||
    typeof row.path !== 'string' ||
    !/^\/assets\/analytics-catalogue-[a-f0-9]{64}\.json$/.test(row.path) ||
    typeof row.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.sha256) ||
    !row.path.includes(row.sha256) ||
    typeof row.sizeBytes !== 'number' ||
    !Number.isSafeInteger(row.sizeBytes) ||
    row.sizeBytes <= 0 ||
    row.sizeBytes > 8 * 1024 * 1024
  ) {
    throw new Error('Invalid catalogue reference');
  }
  return row as AnalyticsCatalogueReference;
}
export type CatalogueRequest = {
  ref: AnalyticsCatalogueReference;
  controller: AbortController;
  promise: Promise<ArrayBuffer>;
};
export type CatalogueHost = { __analyticsCatalogueInitial?: CatalogueRequest };
export function presentationBootstrapSource(
  _catalogue: PresentationCatalogue,
  baseUrl: string,
): string {
  return `(()=>{
    const appRoute=${appRoute.toString()};
    const initialPresentation=${initialPresentation.toString()};
    const params=new URLSearchParams(location.search);
    const route=appRoute(params);
    if(route==='picks'||route==='legacy'||(route==='matrix'&&params.get('reference')==='1')||(route==='snapshot'&&params.get('example')==='1'))return;
    try{
      const parse=${parseAnalyticsCatalogueReference.toString()};
      const ref=parse(JSON.parse(document.getElementById('presentation-catalogue-ref').textContent));
      const controller=new AbortController();
      const base=new URL(${JSON.stringify(baseUrl)},location.href);
      const promise=fetch(new URL(ref.path,base),{signal:controller.signal,credentials:'omit',redirect:'error'})
        .then(r=>{if(!r.ok)throw new Error('Catalogue request failed');return r.arrayBuffer()})
        .then(async bytes=>{
          controller.signal.throwIfAborted();
          if(bytes.byteLength!==ref.sizeBytes)throw new Error('Catalogue size mismatch');
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
          controller.signal.throwIfAborted();
          if(hash!==ref.sha256)throw new Error('Catalogue hash mismatch');
          const catalogue=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
          const selection=initialPresentation(params,catalogue);
          if(selection){
            const asset=selection.ref;
            if(!/^\\/assets\\/presentation-[A-Za-z0-9_.-]+\\.json$/.test(asset.path)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.sizeBytes)||asset.sizeBytes<=0)throw new Error('Invalid early presentation reference');
            const early=new AbortController();
            controller.signal.addEventListener('abort',()=>early.abort(),{once:true});
            const payload=fetch(new URL(asset.path,base),{signal:early.signal,credentials:'omit',redirect:'error'}).then(r=>{if(!r.ok)throw new Error('Presentation request failed');return r.arrayBuffer()});
            payload.catch(()=>{});
            window.__presentationInitial={key:JSON.stringify([selection.kind,selection.snapshotId,selection.quarter]),ref:asset,controller:early,promise:payload};
          }
          return bytes;
        });
      promise.catch(()=>{});
      window.__analyticsCatalogueInitial={ref,controller,promise};
    }catch{}
  })();`;
}
