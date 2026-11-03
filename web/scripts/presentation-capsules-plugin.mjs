import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  derivePresentationSnapshots,
  presentationDigest,
  safePresentationJson,
} from './presentation-capsules.mjs';
import { parsePresentationCatalogue } from '../src/presentation-data.ts';
import { presentationBootstrapSource } from '../src/presentation-bootstrap.ts';
import { renderStaticPicks, staticPicksContext } from '../src/static-picks.ts';

export function presentationCapsulesPlugin() {
  let root;
  let catalogue;
  let latestCapsule;
  let emitAsset;
  let building = false;
  let fileName;
  let devGeneration;
  let devReady = false;
  let sourceEpoch = 0;
  const devAssets = () => {
    if (!devGeneration) {
      const epoch = sourceEpoch;
      devReady = false;
      devGeneration = (async () => {
        const files = new Map();
        let totalBytes = 0;
        const derived = {
          contractVersion: 1,
          sourceIndexSha256: '',
          latestSnapshotId: '',
          snapshots: [],
        };
        const emit = (capsule, name) => {
          const bytes = Buffer.from(JSON.stringify(capsule));
          totalBytes += bytes.length;
          if (files.size >= 10_000 || totalBytes > 512 * 1024 * 1024) {
            throw new Error(
              'Development presentation assets exceed the bounded source graph budget',
            );
          }
          const sha256 = presentationDigest(bytes);
          const path = `/assets/presentation-${name}-${sha256}.json`;
          files.set(path, bytes);
          return { path, sha256, sizeBytes: bytes.length };
        };
        let latest;
        for await (const item of derivePresentationSnapshots(
          resolve(root, 'public/data/production'),
        )) {
          if (item.entry.snapshotId === item.index.latestSnapshotId) {
            latest = item.matrixCapsule;
          }
          derived.sourceIndexSha256 = item.sourceIndexSha256;
          derived.latestSnapshotId = item.index.latestSnapshotId;
          derived.snapshots.push({
            snapshotId: item.entry.snapshotId,
            asOfQuarter: item.entry.asOfQuarter,
            contextSha256: item.descriptor.contextSha256,
            sourceManifestSha256: item.entry.sourceManifestSha256,
            descriptor: item.entry.descriptor,
            matrix: emit(item.matrixCapsule, `${item.entry.asOfQuarter}-matrix`),
            reports: item.reports.map((row) => ({
              quarter: row.quarter,
              status: row.status,
              ref: emit(row.capsule, `${item.entry.asOfQuarter}-${row.quarter}-report`),
            })),
          });
        }
        if (epoch !== sourceEpoch) {
          throw new Error(
            'Public presentation sources changed during development generation; retry the request',
          );
        }
        const validated = parsePresentationCatalogue(derived);
        devReady = true;
        const bytes = Buffer.from(JSON.stringify(validated));
        const sha256 = presentationDigest(bytes);
        const path = `/assets/analytics-catalogue-${sha256}.json`;
        files.set(path, bytes);
        return {
          catalogue: validated,
          files,
          latest,
          ref: { contractVersion: 1, path, sha256, sizeBytes: bytes.length },
        };
      })().catch((error) => {
        // A failed or invalidated generation never poisons later requests.
        devGeneration = undefined;
        throw error;
      });
    }
    return devGeneration;
  };
  const inject = (html, resolved, latest, ref) => {
    const scripts = `<script id="presentation-catalogue-ref" type="application/json">${safePresentationJson(ref)}</script><script id="static-picks-context" type="application/json">${safePresentationJson(staticPicksContext(resolved))}</script><script>${presentationBootstrapSource(resolved, '/')}</script>`;
    return html
      .replace(/<\/head>/i, `${scripts}</head>`)
      .replace(
        '<div id="app"></div>',
        `<div id="app">${renderStaticPicks(resolved, latest)}</div>`,
      );
  };
  return {
    name: 'immutable-presentation-capsules',
    configResolved(config) {
      root = config.root;
      building = config.command === 'build';
    },
    configureServer(server) {
      const sourceRoot = resolve(root, 'public/data/production');
      server.watcher.add(sourceRoot);
      const invalidate = (_event, path) => {
        const within = relative(sourceRoot, resolve(path));
        if (!isAbsolute(within) && within !== '..' && !within.startsWith(`..${sep}`)) {
          sourceEpoch++;
          if (devReady) {
            devGeneration = undefined;
            devReady = false;
          }
        }
      };
      server.watcher.on('all', invalidate);
      server.httpServer?.once('close', () => server.watcher.off('all', invalidate));
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (
          !url.pathname.startsWith('/assets/presentation-') &&
          !url.pathname.startsWith('/assets/analytics-catalogue-')
        ) {
          next();
          return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.statusCode = 405;
          response.end();
          return;
        }
        try {
          const bytes = (await devAssets()).files.get(url.pathname);
          if (!bytes) {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Content-Length', bytes.length);
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) {
          next(error);
        }
      });
    },
    async buildStart() {
      if (!building) {
        return;
      }
      emitAsset = (asset) => this.emitFile(asset);
      fileName = (id) => this.getFileName(id);
      catalogue = {
        contractVersion: 1,
        sourceIndexSha256: '',
        latestSnapshotId: '',
        snapshots: [],
      };
      const emit = (capsule, name) => {
        const bytes = Buffer.from(JSON.stringify(capsule));
        const id = this.emitFile({
          type: 'asset',
          name: `presentation-${name}.json`,
          source: bytes,
          originalFileName: `presentation/${name}.json`,
        });
        return { id, sha256: presentationDigest(bytes), sizeBytes: bytes.length };
      };
      for await (const item of derivePresentationSnapshots(
        resolve(root, 'public/data/production'),
      )) {
        if (item.entry.snapshotId === item.index.latestSnapshotId) {
          latestCapsule = item.matrixCapsule;
        }
        catalogue.sourceIndexSha256 = item.sourceIndexSha256;
        catalogue.latestSnapshotId = item.index.latestSnapshotId;
        catalogue.snapshots.push({
          snapshotId: item.entry.snapshotId,
          asOfQuarter: item.entry.asOfQuarter,
          contextSha256: item.descriptor.contextSha256,
          sourceManifestSha256: item.entry.sourceManifestSha256,
          descriptor: item.entry.descriptor,
          matrix: emit(item.matrixCapsule, `${item.entry.asOfQuarter}-matrix`),
          reports: item.reports.map((row) => ({
            quarter: row.quarter,
            status: row.status,
            ref: emit(row.capsule, `${item.entry.asOfQuarter}-${row.quarter}-report`),
          })),
        });
      }
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        if (!building) {
          const dev = await devAssets();
          return inject(html, dev.catalogue, dev.latest, dev.ref);
        }
        const reference = (ref) => ({
          path: `/${fileName(ref.id)}`,
          sha256: ref.sha256,
          sizeBytes: ref.sizeBytes,
        });
        const resolved = parsePresentationCatalogue({
          ...catalogue,
          snapshots: catalogue.snapshots.map((snapshot) => ({
            ...snapshot,
            matrix: reference(snapshot.matrix),
            reports: snapshot.reports.map((row) => ({ ...row, ref: reference(row.ref) })),
          })),
        });
        const bytes = Buffer.from(JSON.stringify(resolved));
        const sha256 = presentationDigest(bytes);
        const name = `assets/analytics-catalogue-${sha256}.json`;
        emitAsset({
          type: 'asset',
          fileName: name,
          originalFileName: 'analytics-catalogue.json',
          source: bytes,
        });
        return inject(html, resolved, latestCapsule, {
          contractVersion: 1,
          path: `/${name}`,
          sha256,
          sizeBytes: bytes.length,
        });
      },
    },
  };
}
