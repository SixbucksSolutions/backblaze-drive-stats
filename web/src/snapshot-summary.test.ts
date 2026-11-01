import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SnapshotLoader } from './snapshot-loader.ts';
import { scopeMetrics } from './snapshot-summary.ts';
import { reportCsv } from './snapshot-selection.ts';

await test('all-supplied summaries ignore a narrower HDD filter and preserve known counts', async () => {
  const root = new URL('../public/data/production/', import.meta.url);
  const loader = new SnapshotLoader(
    'https://example.org/index.json',
    async (url) => new Response(await readFile(new URL(new URL(url).pathname.slice(1), root))),
  );
  const index = await loader.loadIndex();
  const d = await loader.loadDescriptor(index.latestSnapshotId);
  const payload = await loader.loadQuarter(d, d.context.asOfQuarter);
  assert.ok(payload);
  const filtered = { count: 1, new: 0, capacityTB: 1 };
  for (const report of ['capacity', 'datacenters'] as const) {
    const metrics = scopeMetrics(report, filtered, payload, d.context.coverage.at(-1), 1);
    assert.equal(
      metrics[1]!.value,
      payload.scopes.all_supplied.totals.count!.toLocaleString('en-US'),
    );
    assert.notEqual(metrics[1]!.value, '1');
  }
  const invalidCapacity = structuredClone(payload);
  invalidCapacity.scopes.all_supplied.totals.capacityTB = null;
  const metrics = scopeMetrics('capacity', filtered, invalidCapacity, d.context.coverage.at(-1), 1);
  assert.equal(metrics[0]!.value, 'Unavailable');
  assert.equal(metrics[1]!.value, '359,101');
  assert.equal(
    scopeMetrics('manufacturers', filtered, payload, d.context.coverage.at(-1), 1)[2]!.value,
    '1',
  );
});

await test('history exports bind attribution to each actual calendar row, including unavailable periods', () => {
  const values = reportCsv(
    [
      ['Quarter', 'Capacity TB'],
      ['2025-Q1', 12],
      ['2025-Q2', 'Unavailable'],
    ],
    (index) => ({
      snapshotId: 'snapshot',
      asOfQuarter: '2025-Q2',
      quarter: index === 0 ? '2025-Q1' : '2025-Q2',
      status: index === 0 ? 'complete' : 'partial',
      kind: 'sample',
      sourceUrl: 'https://www.backblaze.com/',
      scope: 'all_supplied',
      contextCount: index === 0 ? 3 : null,
      report: 'capacity',
      filterDescription: 'All supplied',
    }),
  );
  const lines = values.split('\r\n');
  assert.match(lines[1]!, /"2025-Q1","complete","sample","all_supplied","3"/);
  assert.match(lines[2]!, /"2025-Q2","partial","sample","all_supplied","Unavailable"/);
});
