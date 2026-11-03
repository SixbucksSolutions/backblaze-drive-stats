import { parsePresentationCatalogue, parsePresentationCapsule } from './presentation-data.ts';
import type { PresentationCatalogue, PresentationCapsule } from './presentation-data.ts';
import {
  initialPresentation,
  presentationKey,
  parseAnalyticsCatalogueReference,
} from './presentation-bootstrap.ts';
import type {
  InitialPresentation,
  PresentationHost,
  CatalogueHost,
} from './presentation-bootstrap.ts';

export async function presentationCatalogue(signal?: AbortSignal): Promise<PresentationCatalogue> {
  signal?.throwIfAborted();
  const inline = document.querySelectorAll('#presentation-catalogue');
  const external = document.querySelectorAll('#presentation-catalogue-ref');
  if (inline.length + external.length !== 1) {
    throw new Error('Presentation catalogue is unavailable or ambiguous.');
  }
  if (inline.length === 1) {
    return parsePresentationCatalogue(JSON.parse(inline[0]!.textContent ?? '') as unknown);
  }
  const ref = parseAnalyticsCatalogueReference(
    JSON.parse(external[0]!.textContent ?? '') as unknown,
  );
  const host = window as CatalogueHost;
  const slot = host.__analyticsCatalogueInitial;
  delete host.__analyticsCatalogueInitial;
  let bytes: ArrayBuffer;
  if (slot && JSON.stringify(slot.ref) === JSON.stringify(ref) && !slot.controller.signal.aborted) {
    const abort = () => slot.controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      bytes = await slot.promise;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  } else {
    slot?.controller.abort();
    const response = await fetch(
      new URL(ref.path, new URL(import.meta.env.BASE_URL, location.href)),
      { signal: signal ?? null, credentials: 'omit', redirect: 'error' },
    );
    if (!response.ok) {
      throw new Error('Catalogue request failed.');
    }
    bytes = await response.arrayBuffer();
  }
  signal?.throwIfAborted();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  if (bytes.byteLength !== ref.sizeBytes || hash !== ref.sha256) {
    throw new Error('Catalogue integrity mismatch.');
  }
  const catalogue = parsePresentationCatalogue(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown,
  );
  signal?.throwIfAborted();
  freeze(catalogue);
  return catalogue;
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      freeze(child);
    }
  }
}
export class PresentationLoader {
  readonly catalogue: PresentationCatalogue;
  readonly #fetch: typeof fetch;
  readonly #host: PresentationHost;
  readonly #baseUrl: string;
  readonly #completed = new Map<string, PresentationCapsule>();
  constructor(
    catalogue: PresentationCatalogue,
    fetcher: typeof fetch = fetch,
    host: PresentationHost = window as PresentationHost,
    baseUrl: string = location.href,
  ) {
    this.catalogue = catalogue;
    this.#fetch = fetcher;
    this.#host = host;
    this.#baseUrl = baseUrl;
  }
  selection(params: URLSearchParams) {
    return initialPresentation(params, this.catalogue);
  }
  async load(selection: InitialPresentation, signal?: AbortSignal): Promise<PresentationCapsule> {
    signal?.throwIfAborted();
    const snapshot = this.catalogue.snapshots.find((s) => s.snapshotId === selection.snapshotId);
    const expected =
      selection.kind === 'matrix'
        ? snapshot?.matrix
        : snapshot?.reports.find((q) => q.quarter === selection.quarter)?.ref;
    if (!snapshot || !expected || JSON.stringify(expected) !== JSON.stringify(selection.ref)) {
      throw new Error('Unknown presentation reference.');
    }
    const key = presentationKey(selection);
    const cacheKey = `${this.catalogue.sourceIndexSha256}:${key}:${expected.sha256}`;
    const cached = this.#completed.get(cacheKey);
    if (cached) {
      return cached;
    }
    const slot = this.#host.__presentationInitial;
    delete this.#host.__presentationInitial;
    let bytes: ArrayBuffer;
    if (
      slot &&
      slot.key === key &&
      slot.ref.path === expected.path &&
      slot.ref.sha256 === expected.sha256 &&
      slot.ref.sizeBytes === expected.sizeBytes &&
      !slot.controller.signal.aborted
    ) {
      const abort = () => slot.controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        bytes = await slot.promise;
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    } else {
      slot?.controller.abort();
      const response = await this.#fetch.call(globalThis, new URL(expected.path, this.#baseUrl), {
        signal: signal ?? null,
        credentials: 'omit',
        redirect: 'error',
      });
      if (!response.ok) {
        throw new Error('Presentation request failed.');
      }
      bytes = await response.arrayBuffer();
    }
    signal?.throwIfAborted();
    if (bytes.byteLength !== expected.sizeBytes) {
      throw new Error('Presentation size mismatch.');
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    signal?.throwIfAborted();
    if (hash !== expected.sha256) {
      throw new Error('Presentation hash mismatch.');
    }
    const capsule = parsePresentationCapsule(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown,
    );
    if (
      capsule.kind !== selection.kind ||
      capsule.snapshotId !== selection.snapshotId ||
      capsule.quarter !== selection.quarter ||
      capsule.asOfQuarter !== snapshot.asOfQuarter ||
      capsule.contextSha256 !== snapshot.contextSha256 ||
      capsule.sourceManifestSha256 !== snapshot.sourceManifestSha256 ||
      JSON.stringify(capsule.descriptor) !== JSON.stringify(snapshot.descriptor)
    ) {
      throw new Error('Presentation binding mismatch.');
    }
    if (
      capsule.kind === 'report' &&
      snapshot.reports.find((row) => row.quarter === capsule.quarter)?.status !==
        capsule.body.descriptor.quarters.find((row) => row.quarter === capsule.quarter)?.status
    ) {
      throw new Error('Presentation quarter status binding mismatch.');
    }
    signal?.throwIfAborted();
    freeze(capsule);
    signal?.throwIfAborted();
    this.#completed.set(cacheKey, capsule);
    return capsule;
  }
}

export function abortInitialPresentation(
  host: PresentationHost = window as PresentationHost,
): void {
  const catalogueHost = host as CatalogueHost;
  catalogueHost.__analyticsCatalogueInitial?.controller.abort();
  delete catalogueHost.__analyticsCatalogueInitial;
  host.__presentationInitial?.controller.abort();
  delete host.__presentationInitial;
}
