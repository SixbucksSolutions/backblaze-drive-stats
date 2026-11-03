import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activePublishedView,
  appRoute,
  matrixHref,
  publishedViews,
  publishedViewUrl,
  snapshotReport,
  viewUsesSpinner,
} from './app-route.ts';

await test('landing page opens editorial picks and explicit matrix routes to the flagship with reference selection preserved', () => {
  assert.equal(appRoute(new URLSearchParams()), 'picks');
  assert.equal(appRoute(new URLSearchParams('view=picks')), 'picks');
  assert.equal(activePublishedView(new URLSearchParams()), 'picks');
  assert.equal(appRoute(new URLSearchParams('view=matrix&reference=1')), 'matrix');
});

await test('Explore returns to its real as-of matrix and keeps fictional IDs out of production', () => {
  const older = new URL(
    matrixHref('2025-Q4-reviewed', 'backblaze'),
    'https://example.org/subpath/',
  );
  assert.equal(older.pathname, '/subpath/');
  assert.equal(older.searchParams.get('snapshot'), '2025-Q4-reviewed');
  assert.equal(older.searchParams.get('view'), 'matrix');
  assert.equal(matrixHref('fictional-snapshot', 'sample'), '?view=matrix');
  assert.equal(matrixHref(undefined, undefined), '?view=matrix');
});
await test('adopted reports use v2; explicit legacy and later reports remain addressable', () => {
  for (const view of ['deployments', 'distribution', 'capacity', 'manufacturers', 'datacenters']) {
    assert.equal(appRoute(new URLSearchParams({ view })), 'snapshot');
    assert.equal(snapshotReport(new URLSearchParams({ view })), view);
    assert.equal(appRoute(new URLSearchParams({ view, legacy: '1' })), 'legacy');
  }
  for (const view of ['reliability']) {
    assert.equal(appRoute(new URLSearchParams({ view })), 'legacy');
  }
  assert.equal(
    snapshotReport(new URLSearchParams('view=explore&report=distribution')),
    'distribution',
  );
  assert.equal(snapshotReport(new URLSearchParams('view=explore&report=toString')), 'overview');
});

await test('the shared navigation includes the AFR timeline and existing data views', () => {
  assert.deepEqual(
    publishedViews.map((view) => view.id),
    ['afr', 'matrix', 'deployments', 'distribution', 'capacity', 'manufacturers', 'datacenters'],
  );
  for (const view of publishedViews) {
    const url = publishedViewUrl('https://example.org/project/', view.id);
    assert.equal(
      appRoute(url.searchParams),
      view.id === 'matrix' ? 'matrix' : view.id === 'afr' ? 'timeline' : 'snapshot',
    );
    assert.equal(activePublishedView(url.searchParams), view.id);
  }
});

await test('switching reports and returning through matrix preserves selected snapshot and quarter', () => {
  let url = new URL(
    'https://example.org/project/?view=explore&report=deployments&snapshot=older&quarter=2024-Q2&nav=collapsed&custom=retained#snapshot-methodology',
  );
  for (const view of publishedViews) {
    url = publishedViewUrl(url.href, view.id);
    assert.equal(url.pathname, '/project/');
    assert.equal(url.searchParams.get('snapshot'), 'older');
    assert.equal(url.searchParams.get('quarter'), '2024-Q2');
    assert.equal(url.searchParams.get('nav'), 'collapsed');
    assert.equal(url.searchParams.get('custom'), 'retained');
    assert.equal(url.searchParams.has('report'), false);
    assert.equal(url.hash, '');
  }
});

await test('navigation uses the validated snapshot after an in-place snapshot change', () => {
  const url = publishedViewUrl('https://example.org/?view=matrix&quarter=2024-Q1', 'capacity', {
    kind: 'backblaze',
    snapshotId: '2025-Q4-reviewed',
  });
  assert.equal(url.searchParams.get('snapshot'), '2025-Q4-reviewed');
  assert.equal(url.searchParams.get('quarter'), '2024-Q1');
});

await test('secondary example, reference and legacy routes enter production without foreign IDs', () => {
  for (const query of [
    'view=matrix&reference=1',
    'view=explore&example=1&report=manufacturers',
    'view=deployments&legacy=1',
    'view=reliability',
  ]) {
    const current = `https://example.org/project/?${query}&snapshot=foreign&quarter=2024-Q2`;
    assert.equal(activePublishedView(new URL(current).searchParams), undefined);
    for (const view of publishedViews) {
      const url = publishedViewUrl(current, view.id);
      assert.equal(url.searchParams.has('snapshot'), false);
      assert.equal(url.searchParams.get('quarter'), '2024-Q2');
      for (const key of ['report', 'example', 'legacy', 'reference']) {
        assert.equal(url.searchParams.has(key), false);
      }
      assert.equal(activePublishedView(url.searchParams), view.id);
    }
  }
});

await test('existing Explore report deep links mark the corresponding canonical view active', () => {
  for (const view of publishedViews.filter((view) => !['matrix', 'afr'].includes(view.id))) {
    assert.equal(
      activePublishedView(new URLSearchParams({ view: 'explore', report: view.id })),
      view.id,
    );
  }
  assert.equal(activePublishedView(new URLSearchParams('view=explore')), undefined);
  assert.equal(
    publishedViewUrl('https://example.org/?view=distribution&snapshot=fictional', 'matrix', {
      kind: 'sample',
      snapshotId: 'fictional',
    }).searchParams.has('snapshot'),
    false,
  );
});

await test('AFR timeline has an explicit route without a matrix spinner', () => {
  const params = new URLSearchParams('view=afr&snapshot=older&time=calendar&metric=quarterly');
  assert.equal(appRoute(params), 'timeline');
  assert.equal(activePublishedView(params), 'afr');
  assert.equal(viewUsesSpinner(params), false);
});
