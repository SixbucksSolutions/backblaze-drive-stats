import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appRoute, snapshotReport } from './app-route.ts';

await test('landing page and explicit matrix route to the flagship with reference selection preserved', () => {
  assert.equal(appRoute(new URLSearchParams()), 'matrix');
  assert.equal(appRoute(new URLSearchParams('view=matrix&reference=1')), 'matrix');
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
