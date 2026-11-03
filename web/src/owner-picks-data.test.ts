import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MatrixModel, MatrixSnapshot } from './matrix-data.ts';
import type { MatrixCapsule, PresentationCatalogue } from './presentation-data.ts';
import { pickEvidence, reviewedPicks, reviewedSnapshotId } from './owner-picks-data.ts';
import { initialPresentation, presentationBootstrapSource } from './presentation-bootstrap.ts';
import { appRoute, activePublishedView, publishedViews } from './app-route.ts';
import vm from 'node:vm';
import { renderPicks } from './owner-picks-render.ts';

const model: MatrixModel = {
  id: 'pick',
  name: 'ST16000NM001G',
  vendor: 'Seagate',
  capacityTB: 16.0009,
  anchor: '2024-Q3',
  cells: [
    {
      quarter: '2026-Q2',
      relativeQuarter: 8,
      state: 'eligible',
      metrics: {
        afr: 0.72,
        afrDelta: null,
        count: 20000,
        populationDelta: null,
        new: null,
        retired: null,
        failed: 2,
      },
      quarterAfr: 0.61,
      quarterComponents: { complete: true, failures: 2, driveDays: 100000 },
      cumulativeComponents: { complete: false, failures: 20, driveDays: 1000000 },
      productionEvidence: [
        { label: 'First recorded / first proven threshold', value: '2020-Q1 / 2024-Q3' },
      ],
    },
  ],
};
const domain = {
  sampleCount: 0,
  observedMinimum: null,
  observedMedian: null,
  observedMaximum: null,
  knots: [],
};
const snapshot: MatrixSnapshot = {
  id: reviewedSnapshotId,
  label: 'Current',
  kind: 'production',
  sourceUrl: null,
  sourceHash: 'a'.repeat(64),
  cutoff: '2026-06-30',
  models: [model],
  extent: 8,
  versions: '',
  notice: '',
  domains: {
    afr: domain,
    afrDelta: domain,
    count: domain,
    populationDelta: domain,
    new: domain,
    retired: domain,
    failed: domain,
  },
};
const ref = { path: 'assets/latest.json', sha256: 'a'.repeat(64), sizeBytes: 1 };
const capsule: MatrixCapsule = {
  artifactType: 'backblaze-presentation',
  contractVersion: 1,
  kind: 'matrix',
  snapshotId: reviewedSnapshotId,
  asOfQuarter: '2026-Q2',
  contextSha256: 'a'.repeat(64),
  sourceManifestSha256: 'b'.repeat(64),
  descriptor: ref,
  quarter: null,
  body: snapshot,
};
const catalogue: PresentationCatalogue = {
  contractVersion: 1,
  sourceIndexSha256: 'c'.repeat(64),
  latestSnapshotId: reviewedSnapshotId,
  snapshots: [
    {
      snapshotId: reviewedSnapshotId,
      asOfQuarter: '2026-Q2',
      contextSha256: capsule.contextSha256,
      sourceManifestSha256: capsule.sourceManifestSha256,
      descriptor: ref,
      matrix: ref,
      reports: [],
    },
  ],
};
await test('editorial route is the home page while the six data views remain explicit', () => {
  assert.equal(appRoute(new URLSearchParams()), 'picks');
  assert.equal(activePublishedView(new URLSearchParams()), 'picks');
  assert.equal(publishedViews.length, 6);
  assert.equal(appRoute(new URLSearchParams('view=matrix')), 'matrix');
});
await test('picks always bootstrap latest matrix, ignoring all stale and example controls', () => {
  const query = new URLSearchParams(
    'view=picks&snapshot=unknown&quarter=2099-Q4&example=1&reference=1',
  );
  assert.equal(initialPresentation(query, catalogue)?.snapshotId, reviewedSnapshotId);
  assert.equal(initialPresentation(query, catalogue)?.kind, 'matrix');
  assert.equal(initialPresentation(query, catalogue)?.quarter, null);
  assert.equal(
    initialPresentation(new URLSearchParams(), catalogue)?.snapshotId,
    reviewedSnapshotId,
  );
  assert.equal(
    initialPresentation(new URLSearchParams('view=matrix&snapshot=unknown'), catalogue),
    null,
  );
});
await test('classic inline bootstrap uses same latest-only rule', () => {
  let requested = '';
  const host: Record<string, unknown> = {};
  vm.runInNewContext(presentationBootstrapSource(catalogue, '/'), {
    document: { getElementById: () => ({ textContent: JSON.stringify(catalogue) }) },
    location: { search: '?view=picks&snapshot=older', href: 'https://example.com/' },
    URL,
    URLSearchParams,
    AbortController,
    window: host,
    fetch: (url: URL) => {
      requested = url.href;
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) });
    },
  });
  assert.equal(requested, 'https://example.com/assets/latest.json');
  assert.ok(host.__presentationInitial);
});
await test('anchor maturity differs from full first-observed history and does not compress gaps', () => {
  const evidence = pickEvidence(model, snapshot, '2026-Q2');
  assert.equal(evidence.matureQuarters, 8);
  assert.equal(evidence.elapsedQuarters, 26);
  assert.equal(evidence.eligible, true);
  assert.equal(evidence.preferredHistory, false);
  assert.equal(evidence.completeHistory, false);
  assert.equal(evidence.cumulativeAfr, 0.72);
  assert.equal(evidence.quarterlyAfr, 0.61);
});
await test('unknown, below-threshold, incomplete and short history evidence fail the factual screen', () => {
  for (const candidate of [
    { ...model, capacityTB: null },
    { ...model, capacityTB: 12 },
    { ...model, anchor: '2024-Q4' },
    { ...model, anchor: null },
    { ...model, cells: [] },
    {
      ...model,
      cells: [{ ...model.cells[0]!, metrics: { ...model.cells[0]!.metrics, count: 19999 } }],
    },
    {
      ...model,
      cells: [
        {
          ...model.cells[0]!,
          quarterComponents: { complete: false, failures: 2, driveDays: 100000 },
        },
      ],
    },
  ]) {
    assert.equal(pickEvidence(candidate, snapshot, '2026-Q2').eligible, false);
  }
  assert.equal(
    pickEvidence(model, { ...snapshot, cutoff: '2026-06-29' }, '2026-Q2').eligible,
    false,
  );
});
await test('named picks require exact review and retain missing-model evidence without substitutes', () => {
  assert.equal(reviewedPicks(capsule).length, 3);
  assert.equal(reviewedPicks(capsule)[1]?.model, undefined);
  assert.deepEqual(reviewedPicks({ ...capsule, snapshotId: 'future' }), []);
  assert.deepEqual(reviewedPicks({ ...capsule, body: { ...snapshot, kind: 'sample' } }), []);
  assert.equal(
    reviewedPicks({ ...capsule, body: { ...snapshot, models: [{ ...model, anchor: null }] } })[0]
      ?.evidence?.eligible,
    false,
  );
});

await test('small editorial render shows real values, expandable coverage and no matrix table', () => {
  const html = renderPicks(capsule);
  assert.match(html, /20,000/);
  assert.match(html, /0.720%/);
  assert.match(html, /0.610%/);
  assert.match(html, /History & coverage/);
  assert.match(html, /Source history has gaps/);
  assert.equal((html.match(/<article /g) ?? []).length, 3);
  assert.doesNotMatch(html, /<table|picks-snapshot/);
  assert.match(html, /snapshot=2026-Q2-v2-/);
});
await test('future and missing evidence never render recommendations or stale substitutes', () => {
  const future = renderPicks({ ...capsule, snapshotId: 'future' });
  assert.match(future, /awaiting review/);
  assert.doesNotMatch(future, /ST16000|<article/);
  assert.match(
    renderPicks({ ...capsule, body: { ...snapshot, models: [] } }),
    /models are unavailable/,
  );
  const missingRate = { ...model, cells: [{ ...model.cells[0]!, quarterAfr: null }] };
  assert.equal(pickEvidence(missingRate, snapshot, '2026-Q2').eligible, false);
  const unavailable = renderPicks({ ...capsule, body: { ...snapshot, models: [missingRate] } });
  assert.match(unavailable, /Not currently included/);
  assert.doesNotMatch(unavailable, /Meets size/);
});
