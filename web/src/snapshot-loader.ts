import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseProductionMatrix,
  parseSupportingQuarter,
  verifyReference,
  validateMatrixQuarter,
} from './production-data.ts';
import type {
  ProductionIndex,
  SnapshotDescriptor,
  ProductionMatrix,
  SupportingQuarter,
  Reference,
} from './production-data.ts';

export type SnapshotFetcher = (input: string, init?: RequestInit) => Promise<Response>;

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      freeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
function canceled(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}

/** One immutable index per reader. Create a new reader to discover a new publication.
 * Only completed validated artifacts enter caches; canceled requests never poison
 * another consumer's request. Consumers abort stale UI selections independently.
 */
export class SnapshotLoader {
  readonly indexUrl: string;
  readonly #fetcher: SnapshotFetcher;
  #index: ProductionIndex | undefined;
  readonly #descriptors = new Map<string, SnapshotDescriptor>();
  readonly #matrices = new Map<string, ProductionMatrix>();
  readonly #quarters = new Map<string, SupportingQuarter>();

  constructor(
    indexUrl: string,
    fetcher: SnapshotFetcher = (input, init) => globalThis.fetch(input, init),
  ) {
    this.indexUrl = indexUrl;
    this.#fetcher = fetcher;
  }

  async #bytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
    canceled(signal);
    const response = await this.#fetcher(url, {
      ...(signal ? { signal } : {}),
      redirect: 'error',
      credentials: 'omit',
    });
    canceled(signal);
    if (!response.ok) {
      throw new Error(`Production data request failed (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    canceled(signal);
    return bytes;
  }

  async #referenced(reference: Reference, signal?: AbortSignal): Promise<Uint8Array> {
    // The structural parser has already restricted this path to immutable public JSON.
    // A base URL is needed for Node tests and for relative app deployments alike.
    const base = new URL(this.indexUrl, globalThis.location?.href ?? 'http://localhost/');
    const url = new URL(reference.path, base).href;
    const bytes = await this.#bytes(url, signal);
    await verifyReference(bytes, reference);
    canceled(signal);
    return bytes;
  }

  async loadIndex(signal?: AbortSignal): Promise<ProductionIndex> {
    canceled(signal);
    if (this.#index) {
      return this.#index;
    }
    const index = parseProductionIndex(await this.#bytes(this.indexUrl, signal));
    canceled(signal);
    this.#index ??= freeze(index);
    return this.#index;
  }

  async loadSnapshot(snapshotId: string, signal?: AbortSignal): Promise<SnapshotDescriptor> {
    const index = await this.loadIndex(signal);
    canceled(signal);
    const entry = index.snapshots.find((item) => item.snapshotId === snapshotId);
    if (!entry) {
      throw new Error('Snapshot is not advertised by this generation index');
    }
    const key = `${entry.snapshotId}:${entry.descriptor.sha256}`;
    const cached = this.#descriptors.get(key);
    if (cached) {
      return cached;
    }
    const descriptor = parseSnapshotDescriptor(
      await this.#referenced(entry.descriptor, signal),
      entry,
    );
    canceled(signal);
    const result = freeze(descriptor);
    this.#descriptors.set(key, result);
    return result;
  }

  async loadDescriptor(snapshotId: string, signal?: AbortSignal): Promise<SnapshotDescriptor> {
    return this.loadSnapshot(snapshotId, signal);
  }

  async #snapshot(
    snapshot: string | SnapshotDescriptor,
    signal?: AbortSignal,
  ): Promise<SnapshotDescriptor> {
    const descriptor = await this.loadSnapshot(
      typeof snapshot === 'string' ? snapshot : snapshot.context.snapshotId,
      signal,
    );
    if (
      typeof snapshot !== 'string' &&
      (snapshot.contextSha256 !== descriptor.contextSha256 ||
        snapshot.context.sourceManifestSha256 !== descriptor.context.sourceManifestSha256)
    ) {
      throw new Error('Mixed generation snapshot');
    }
    return descriptor;
  }

  async loadMatrix(
    snapshot: string | SnapshotDescriptor,
    signal?: AbortSignal,
  ): Promise<ProductionMatrix> {
    const descriptor = await this.#snapshot(snapshot, signal);
    canceled(signal);
    const key = `${descriptor.contextSha256}:${descriptor.matrix.sha256}`;
    const cached = this.#matrices.get(key);
    if (cached) {
      return cached;
    }
    const matrix = parseProductionMatrix(
      await this.#referenced(descriptor.matrix, signal),
      descriptor,
    );
    for (const payload of this.#quarters.values()) {
      if (payload.contextSha256 === descriptor.contextSha256) {
        validateMatrixQuarter(matrix, payload);
      }
    }
    canceled(signal);
    const result = freeze(matrix);
    this.#matrices.set(key, result);
    return result;
  }

  async loadQuarter(
    snapshot: string | SnapshotDescriptor,
    quarter: string,
    signal?: AbortSignal,
  ): Promise<SupportingQuarter | null> {
    const descriptor = await this.#snapshot(snapshot, signal);
    canceled(signal);
    const row = descriptor.quarters.find((item) => item.quarter === quarter);
    if (!row) {
      throw new Error('Quarter is outside this snapshot');
    }
    if (!row.payload) {
      return null;
    }
    const key = `${descriptor.contextSha256}:${row.payload.sha256}`;
    const cached = this.#quarters.get(key);
    if (cached) {
      return cached;
    }
    const payload = parseSupportingQuarter(
      await this.#referenced(row.payload, signal),
      descriptor,
      quarter,
    );
    const matrix = this.#matrices.get(`${descriptor.contextSha256}:${descriptor.matrix.sha256}`);
    if (matrix) {
      validateMatrixQuarter(matrix, payload);
    }
    canceled(signal);
    const result = freeze(payload);
    this.#quarters.set(key, result);
    return result;
  }
}
