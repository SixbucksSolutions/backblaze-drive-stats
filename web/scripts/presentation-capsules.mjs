import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse, parseFragment, serializeOuter } from 'parse5';
import { minifyHtml } from './minimize-static-assets.mjs';
import {
  renderStaticPicks,
  staticPicksContext,
  parseStaticPicksContext,
} from '../src/static-picks.ts';
import { parseAnalyticsCatalogueReference } from '../src/presentation-bootstrap.ts';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { CapacityHistoryReader } from '../src/capacity-report.ts';
import { adaptProductionV2 } from '../src/matrix-production.ts';
import { parsePresentationCapsule, parsePresentationCatalogue } from '../src/presentation-data.ts';
import { displayModelLabel } from '../src/model-labels.ts';
import { deriveAfrTimeline } from '../src/afr-timeline-data.ts';

export const presentationDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const safePresentationJson = (value) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
export function displayDescriptor(descriptor) {
  const { matrix: _matrix, context, ...rest } = descriptor;
  return {
    ...rest,
    context: {
      ...context,
      inventory: context.inventory.map(({ modelId, vendor, modelNumber }) =>
        displayModelLabel({ modelId, vendor, modelNumber }),
      ),
    },
  };
}
/** Every input uses the existing canonical parser, reference verifier and cross-artifact validators.
 * This generator retains only one snapshot's graph at a time. It reads committed public data only.
 */
export async function* derivePresentationSnapshots(productionRoot) {
  const indexUrl = pathToFileURL(resolve(productionRoot, 'index.json')).href;
  const fetcher = async (url) => new Response(await readFile(fileURLToPath(url)));
  const indexBytes = await readFile(fileURLToPath(indexUrl));
  const sourceIndexSha256 = presentationDigest(indexBytes);
  const indexLoader = new SnapshotLoader(indexUrl, fetcher);
  const index = await indexLoader.loadIndex();
  for (const entry of index.snapshots) {
    const loader = new SnapshotLoader(indexUrl, fetcher);
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const capacityHistory = await new CapacityHistoryReader(loader).load(entry.snapshotId);
    const binding = {
      artifactType: 'backblaze-presentation',
      contractVersion: 1,
      snapshotId: entry.snapshotId,
      asOfQuarter: entry.asOfQuarter,
      contextSha256: descriptor.contextSha256,
      sourceManifestSha256: entry.sourceManifestSha256,
      descriptor: entry.descriptor,
    };
    const matrixCapsule = {
      ...binding,
      kind: 'matrix',
      quarter: null,
      body: adaptProductionV2(descriptor, matrix),
    };
    parsePresentationCapsule(matrixCapsule);
    const timelineCapsule = {
      ...binding,
      kind: 'timeline',
      quarter: null,
      body: deriveAfrTimeline(descriptor, matrix),
    };
    parsePresentationCapsule(timelineCapsule);
    const thin = displayDescriptor(descriptor);
    const reports = [];
    for (const row of descriptor.quarters) {
      const quarter = await loader.loadQuarter(descriptor, row.quarter);
      const capsule = {
        ...binding,
        kind: 'report',
        quarter: row.quarter,
        body: { descriptor: thin, quarter, capacityHistory },
      };
      parsePresentationCapsule(capsule);
      reports.push({ quarter: row.quarter, status: row.status, capsule });
    }
    yield { index, entry, sourceIndexSha256, descriptor, matrixCapsule, timelineCapsule, reports };
  }
}

/** Independent packaging audit regenerates projections from the public source graph,
 * compares complete decoded structures AND deterministic serialized bytes, then proves
 * every advertised capsule is unique/reachable and no extra capsule is served.
 */
export async function auditPresentationAssets(productionRoot, files, catalogue) {
  const paths = new Set();
  const indexUrl = pathToFileURL(resolve(productionRoot, 'index.json')).href;
  const fetcher = async (url) => new Response(await readFile(fileURLToPath(url)));
  const index = await new SnapshotLoader(indexUrl, fetcher).loadIndex();
  const sourceIndexSha256 = presentationDigest(await readFile(fileURLToPath(indexUrl)));
  let snapshots = 0,
    reports = 0,
    bytes = 0;
  // Do not use the emitter's projection generator or thin-descriptor helper here.
  // Reconstruct the contract independently from canonical source readers.
  for (const entry of index.snapshots) {
    const loader = new SnapshotLoader(indexUrl, fetcher);
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const matrix = await loader.loadMatrix(descriptor);
    const history = await new CapacityHistoryReader(loader).load(entry.snapshotId);
    const expected = { entry, descriptor, sourceIndexSha256, index };
    assert.equal(
      catalogue.sourceIndexSha256,
      expected.sourceIndexSha256,
      'Presentation source index drift',
    );
    assert.equal(catalogue.latestSnapshotId, expected.index.latestSnapshotId);
    const actual = catalogue.snapshots[snapshots++];
    assert.ok(actual, 'Presentation snapshot missing');
    assert.deepEqual(
      {
        snapshotId: actual.snapshotId,
        asOfQuarter: actual.asOfQuarter,
        contextSha256: actual.contextSha256,
        sourceManifestSha256: actual.sourceManifestSha256,
        descriptor: actual.descriptor,
      },
      {
        snapshotId: expected.entry.snapshotId,
        asOfQuarter: expected.entry.asOfQuarter,
        contextSha256: expected.descriptor.contextSha256,
        sourceManifestSha256: expected.entry.sourceManifestSha256,
        descriptor: expected.entry.descriptor,
      },
    );
    const compare = (ref, capsule) => {
      assert.ok(!paths.has(ref.path), 'Duplicate presentation reference');
      paths.add(ref.path);
      const served = files.get(ref.path.slice(1));
      assert.ok(served, 'Missing presentation capsule');
      assert.equal(served.length, ref.sizeBytes, 'Presentation size drift');
      assert.equal(presentationDigest(served), ref.sha256, 'Presentation digest drift');
      const decoded = parsePresentationCapsule(JSON.parse(served.toString('utf8')));
      assert.deepEqual(decoded, capsule, 'Presentation differs from canonical adapters');
      assert.ok(
        served.equals(Buffer.from(JSON.stringify(capsule))),
        'Nondeterministic presentation bytes',
      );
      bytes += served.length;
    };
    const envelope = {
      artifactType: 'backblaze-presentation',
      contractVersion: 1,
      snapshotId: entry.snapshotId,
      asOfQuarter: entry.asOfQuarter,
      contextSha256: descriptor.contextSha256,
      sourceManifestSha256: entry.sourceManifestSha256,
      descriptor: entry.descriptor,
    };
    compare(actual.matrix, {
      ...envelope,
      kind: 'matrix',
      quarter: null,
      body: adaptProductionV2(descriptor, matrix),
    });
    // Independently reconstruct every timeline field from the canonical inventory.
    // Do not call the timeline projector: its omissions and arithmetic need auditing too.
    const context = descriptor.context;
    const models = [];
    for (const source of context.inventory) {
      if (
        !matrix.models.some((model) => model.modelId === source.modelId) ||
        source.mediaClass !== 'hdd' ||
        source.firstObservedInDeclaredHistory === null
      ) {
        continue;
      }
      const firstQuarter = source.firstObservedInDeclaredHistory;
      const rows = source.history.filter((row) => row.quarter <= entry.asOfQuarter);
      const observed = rows.filter((row) => row.knownDriveDays > 0);
      const end = observed.at(-1)?.quarter;
      const points = [];
      for (const row of rows) {
        if (row.quarter < firstQuarter || !end || row.quarter > end) {
          continue;
        }
        const through = rows.filter((prior) => prior.quarter <= row.quarter);
        const coverage =
          context.coverage.find((item) => item.quarter === row.quarter)?.status ?? 'missing';
        const available = coverage === 'complete' && row.knownDriveDays > 0;
        const [year, quarter] = row.quarter.split('-Q').map(Number);
        const [firstYear, first] = firstQuarter.split('-Q').map(Number);
        points.push({
          quarter: row.quarter,
          relativeQuarter: (year - firstYear) * 4 + quarter - first + 1,
          cumulativeAfr: available
            ? (through.reduce((sum, prior) => sum + prior.knownFailures, 0) /
                through.reduce((sum, prior) => sum + prior.knownDriveDays, 0)) *
              36500
            : null,
          quarterlyAfr: available ? (row.knownFailures / row.knownDriveDays) * 36500 : null,
          count: row.quarterCount,
          failures: row.knownFailures,
          driveDays: row.knownDriveDays,
          coverage,
          historyComplete: !context.coverage.some(
            (item) => item.quarter <= row.quarter && item.status !== 'complete',
          ),
        });
      }
      const label = displayModelLabel(source);
      models.push({
        id: source.modelId,
        name: label.modelNumber,
        vendor: label.vendor,
        capacityTB: source.capacityTB,
        firstQuarter,
        points,
      });
    }
    compare(actual.timeline, {
      ...envelope,
      kind: 'timeline',
      quarter: null,
      body: {
        snapshotId: entry.snapshotId,
        asOfQuarter: entry.asOfQuarter,
        sourceManifestSha256: entry.sourceManifestSha256,
        rateVersion: context.versions.rate,
        models,
      },
    });
    assert.equal(actual.reports.length, descriptor.quarters.length);
    for (const [index, row] of descriptor.quarters.entries()) {
      const reference = actual.reports[index];
      assert.equal(reference.quarter, row.quarter);
      assert.equal(reference.status, row.status);
      const { matrix: _matrix, context, ...noncontext } = descriptor;
      const thin = {
        ...noncontext,
        context: {
          ...context,
          inventory: context.inventory.map((model) => {
            const label = displayModelLabel(model);
            return {
              modelId: model.modelId,
              vendor: label.vendor,
              modelNumber: label.modelNumber,
            };
          }),
        },
      };
      compare(reference.ref, {
        ...envelope,
        kind: 'report',
        quarter: row.quarter,
        body: {
          descriptor: thin,
          quarter: await loader.loadQuarter(descriptor, row.quarter),
          capacityHistory: history,
        },
      });
      reports++;
    }
  }
  assert.equal(catalogue.snapshots.length, snapshots);
  const emitted = [...files.keys()]
    .filter((path) => /^assets\/presentation-/.test(path))
    .map((path) => `/${path}`);
  assert.deepEqual(emitted.sort(), [...paths].sort(), 'Extra or unadvertised presentation asset');
  return { snapshots, reports, assets: paths.size, bytes };
}

// Parse the actual browser tree, including template contents, so duplicate IDs,
// malformed attributes and inert metadata cannot masquerade as build-owned data.
function documentNodes(html) {
  const errors = [];
  const document = parse(html, { onParseError: (error) => errors.push(error.code) });
  assert.deepEqual(
    errors.filter((code) => code !== 'missing-doctype'),
    [],
    'Malformed release HTML',
  );
  const nodes = [];
  const visit = (node, inert = false) => {
    nodes.push({ node, inert });
    for (const child of node.childNodes ?? []) {
      visit(child, inert);
    }
    if (node.content) {
      visit(node.content, true);
    }
  };
  visit(document);
  return nodes;
}
const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
function uniqueNode(nodes, id, required = true) {
  const matches = nodes.filter(({ node }) => attribute(node, 'id') === id);
  assert.ok(
    matches.length <= 1 && (!required || matches.length === 1),
    `Exactly one ${id} is required`,
  );
  if (!matches.length) {
    return undefined;
  }
  const { node, inert } = matches[0];
  assert.ok(
    !inert && node.namespaceURI === 'http://www.w3.org/1999/xhtml',
    `Inert or foreign ${id}`,
  );
  return node;
}
function jsonScript(node) {
  assert.ok(
    node.tagName === 'script' && attribute(node, 'type') === 'application/json',
    'Invalid JSON metadata element',
  );
  assert.deepEqual(
    node.attrs.map(({ name }) => name).sort(),
    ['id', 'type'],
    'Unexpected JSON metadata attributes',
  );
  assert.ok(
    node.childNodes.every((child) => child.nodeName === '#text'),
    'Invalid JSON metadata content',
  );
  return JSON.parse(node.childNodes.map((child) => child.value).join(''));
}
export function presentationCatalogueReferenceFromHtml(html, required = true) {
  const nodes = documentNodes(html);
  const inline = uniqueNode(nodes, 'presentation-catalogue', false);
  const external = uniqueNode(nodes, 'presentation-catalogue-ref', false);
  if (!required && !inline && !external) {
    return null;
  }
  assert.equal(
    Number(Boolean(inline)) + Number(Boolean(external)),
    1,
    'Exactly one build-owned presentation catalogue is required',
  );
  return external ? parseAnalyticsCatalogueReference(jsonScript(external)) : null;
}
export function presentationCatalogueFromHtml(html, files = new Map()) {
  const ref = presentationCatalogueReferenceFromHtml(html);
  if (!ref) {
    return parsePresentationCatalogue(
      jsonScript(uniqueNode(documentNodes(html), 'presentation-catalogue')),
    );
  }
  const bytes = files.get(ref.path.slice(1));
  assert.ok(bytes, 'Missing external presentation catalogue');
  assert.equal(bytes.length, ref.sizeBytes, 'External catalogue size drift');
  assert.equal(presentationDigest(bytes), ref.sha256, 'External catalogue digest drift');
  return parsePresentationCatalogue(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
  );
}

// Reconstruct latest facts through canonical readers. Neither the emitted capsule
// nor a claimed HTML hash is evidence for the markup which browsers actually see.
export async function auditStaticPicks(productionRoot, html, catalogue) {
  const indexUrl = pathToFileURL(resolve(productionRoot, 'index.json')).href;
  const fetcher = async (url) => new Response(await readFile(fileURLToPath(url)));
  const loader = new SnapshotLoader(indexUrl, fetcher);
  const index = await loader.loadIndex();
  assert.equal(
    catalogue.sourceIndexSha256,
    presentationDigest(await readFile(fileURLToPath(indexUrl))),
    'Static picks source index drift',
  );
  assert.equal(
    catalogue.latestSnapshotId,
    index.latestSnapshotId,
    'Static picks latest snapshot drift',
  );
  const entry = index.snapshots.find((item) => item.snapshotId === index.latestSnapshotId);
  assert.ok(entry, 'Static picks latest snapshot missing');
  const descriptor = await loader.loadSnapshot(entry.snapshotId);
  const matrix = await loader.loadMatrix(descriptor);
  const capsule = {
    artifactType: 'backblaze-presentation',
    contractVersion: 1,
    snapshotId: entry.snapshotId,
    asOfQuarter: entry.asOfQuarter,
    contextSha256: descriptor.contextSha256,
    sourceManifestSha256: entry.sourceManifestSha256,
    descriptor: entry.descriptor,
    kind: 'matrix',
    quarter: null,
    body: adaptProductionV2(descriptor, matrix),
  };
  const nodes = documentNodes(html);
  const context = parseStaticPicksContext(jsonScript(uniqueNode(nodes, 'static-picks-context')));
  assert.deepEqual(context, staticPicksContext(catalogue), 'Static picks context binding drift');
  const root = uniqueNode(nodes, 'static-picks-root');
  const app = uniqueNode(nodes, 'app');
  assert.equal(root.parentNode, app, 'Static picks must be inside application root');
  assert.ok(
    app.childNodes.every(
      (node) => node === root || (node.nodeName === '#text' && !node.value.trim()),
    ),
    'Unexpected application markup beside static picks',
  );
  // Apply the same reviewed whitespace policy before parsing both sides. Comparing
  // normalized DOMs retains every attribute, link, fact and element while allowing
  // equivalent entity encoding and attribute order after HTML minification.
  const dom = async (markup) => {
    const parsed = parseFragment(await minifyHtml(markup));
    const shape = (node) => ({
      name: node.nodeName,
      namespace: node.namespaceURI,
      attrs: node.attrs
        ?.map(({ name, value, namespace, prefix }) => ({ name, value, namespace, prefix }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      text: node.value ?? node.data,
      children: node.childNodes?.map(shape),
      template: node.content ? shape(node.content) : undefined,
    });
    return shape(parsed);
  };
  assert.deepEqual(
    await dom(serializeOuter(root)),
    await dom(renderStaticPicks(catalogue, capsule)),
    'Static picks markup differs from canonical latest evidence',
  );
  return { snapshotId: entry.snapshotId, sourceIndexSha256: catalogue.sourceIndexSha256 };
}
