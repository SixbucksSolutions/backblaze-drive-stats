import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deploymentChartLimit, deploymentSummary, renderDeployments } from './deployment-report.ts';
import {
  parseProductionIndex,
  parseSnapshotDescriptor,
  parseSupportingQuarter,
  verifyReference,
} from './production-data.ts';
import { defaultFilter, selectRows } from './snapshot-selection.ts';
import type { DisplayRow } from './snapshot-selection.ts';

const row = (modelId: string, additions: number | null): DisplayRow => ({
  modelId,
  modelNumber: modelId,
  vendor: 'Unknown',
  count: additions,
  new: additions,
  capacityTB: null,
});

void test('independent additions sum and stable top-eight ranking preserve the full input', () => {
  const rows = [
    row('tie-b', 40),
    row('tie-a', 40),
    ...Array.from({ length: 9 }, (_, i) => row(`M${i}`, i)),
  ];
  const original = structuredClone(rows);
  const summary = deploymentSummary(rows, true);
  assert.equal(summary.total, 116); // 40 + 40 + (0 + ... + 8)
  assert.equal(deploymentChartLimit, 8);
  assert.deepEqual(
    summary.chartRows.map((entry) => entry.modelId),
    ['tie-a', 'tie-b', 'M8', 'M7', 'M6', 'M5', 'M4', 'M3'],
  );
  assert.deepEqual(rows, original);
  const html = renderDeployments(rows, true);
  assert.match(html, /Showing 8 of 11/);
  assert.match(html, /sortable table and CSV below/);
  assert.equal((html.match(/class="report-bar"/g) ?? []).length, 8);
});

void test('null additions do not become zero, while valid additions remain chartable', () => {
  const summary = deploymentSummary([row('unknown', null), row('measured', 0)], true);
  assert.equal(summary.total, null);
  assert.equal(summary.unavailableModels, 1);
  assert.deepEqual(
    summary.chartRows.map((entry) => entry.modelId),
    ['measured'],
  );
  const html = renderDeployments([row('unknown', null), row('measured', 0)], true);
  assert.match(html, /1 models have unavailable additions/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(
    renderDeployments([row('unknown', null)], true),
    /unavailable for the selected models/,
  );
});

void test('complete zero, empty filters and incomplete coverage have distinct meaningful states', () => {
  assert.equal(deploymentSummary([], true).total, 0);
  assert.equal(deploymentSummary([], false).total, null);
  assert.match(renderDeployments([], true), /No models match/);
  const zero = renderDeployments([row('zero', 0)], true);
  assert.match(zero, /No first recorded additions were observed/);
  assert.match(zero, /width:0%/);
  const partial = renderDeployments([row('stale', 700)], false);
  assert.match(partial, /unavailable for this coverage/);
  assert.doesNotMatch(partial, /class="report-bar"|700/);
});

void test('context retains seeded, historical, subthreshold and new-vendor models until explicit filters', () => {
  const rows = [row('seed', 7), row('historic', 0), row('discovered', 3)];
  const inventory = rows.map((entry) => ({
    ...entry,
    vendor: entry.modelId === 'discovered' ? 'New vendor' : 'Unknown',
  }));
  const selection = {
    contextModelIds: rows.map((entry) => entry.modelId),
    purchaseDefaultModelIds: ['discovered'],
    historicalReferenceModelIds: ['historic'],
  };
  const context = selectRows(rows, inventory, selection, defaultFilter());
  assert.equal(deploymentSummary(context, true).total, 10);
  assert.equal(context.length, 3);
  const filtered = selectRows(rows, inventory, selection, {
    ...defaultFilter(),
    vendor: 'New vendor',
  });
  assert.equal(deploymentSummary(filtered, true).total, 3);
  assert.equal(filtered.length, 1);
  assert.equal(context.length, 3);
});

void test('untrusted category labels are escaped and chart tracks have no duplicate spoken labels', () => {
  const html = renderDeployments(
    [{ ...row('x', 2), vendor: '<script>&"', modelNumber: "<img onerror='x'>" }],
    true,
  );
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;&amp;&quot;/);
  assert.match(html, /&lt;img onerror=&#39;x&#39;&gt;/);
  assert.match(html, /class="bar-track" aria-hidden="true"/);
  assert.match(html, /initial observed fleet/);
  assert.match(html, /left-censored/);
  assert.match(html, /Last-observed and Retired measures are unavailable/);
});

void test('accepted real 2026 Q2 payload reconciles all 40 context models and 12,261 additions', async () => {
  const directory = new URL('../public/data/production/', import.meta.url);
  const bytes = (path: string) => readFile(new URL(path, directory));
  const index = parseProductionIndex(await bytes('index.json'));
  const entry = index.snapshots.find((snapshot) => snapshot.asOfQuarter === '2026-Q2');
  assert.ok(entry);
  const descriptorBytes = await bytes(entry.descriptor.path);
  await verifyReference(descriptorBytes, entry.descriptor);
  const descriptor = parseSnapshotDescriptor(descriptorBytes, entry);
  const quarter = descriptor.quarters.find((candidate) => candidate.quarter === '2026-Q2');
  assert.ok(quarter?.payload);
  const quarterBytes = await bytes(quarter.payload.path);
  await verifyReference(quarterBytes, quarter.payload);
  const payload = parseSupportingQuarter(quarterBytes, descriptor, quarter.quarter);
  const selected = selectRows(
    payload.scopes.selected_hdd.models,
    descriptor.context.inventory,
    descriptor.context.selection,
    defaultFilter(),
  );
  const summary = deploymentSummary(selected, payload.status === 'complete');
  assert.equal(selected.length, 40);
  assert.equal(summary.total, 12261);
  assert.equal(summary.total, payload.scopes.selected_hdd.totals.new);
  assert.equal(summary.chartRows[0]?.modelId, 'd832457db0cfc2280209abd0');
  assert.equal(summary.chartRows[0]?.new, 4863);
  assert.match(renderDeployments(selected, true), /12,261/);
  assert.match(renderDeployments(selected, true), /Showing 8 of 40/);
});
