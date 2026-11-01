// Integrated aggregate/report gate. Reads committed public graphs only; never sources.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { adaptProductionV2 } from '../src/matrix-production.ts';
import { CapacityHistoryReader, capacityCsvRows, renderCapacity } from '../src/capacity-report.ts';
import { deploymentSummary, renderDeployments } from '../src/deployment-report.ts';
import { distributionSummary, renderDistribution } from '../src/distribution-report.ts';
import {
  manufacturerRows,
  manufacturerCsvRows,
  renderManufacturers,
} from '../src/manufacturer-report.ts';
import {
  datacenterSummary,
  datacenterCsvRows,
  renderDatacenters,
} from '../src/datacenter-report.ts';
import {
  defaultFilter,
  selectRows,
  selectionTotals,
  selectionCsv,
  reportCsv,
} from '../src/snapshot-selection.ts';
import { assertPublicValues, checkProductionData } from './check-production-data.mjs';

const metrics = ['count', 'new', 'capacityTB'];
const ordinal = (quarter) => Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1));
const total = (rows, key, complete) =>
  !complete || rows.some((row) => row[key] === null)
    ? null
    : rows.reduce((sum, row) => sum + row[key], 0);
// Decimal TB sums and fractional shares tolerate only floating arithmetic drift.
// Counts and additions are exact integers, regardless of their magnitude.
function equalFloat(actual, expected, label) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-11, label);
  } else {
    assert.equal(actual, expected, label);
  }
}

export function auditMetric(actual, expected, metric, label) {
  if (metric === 'capacityTB') {
    equalFloat(actual, expected, label);
  } else {
    assert.equal(actual, expected, label);
  }
}

/** Independent arithmetic over accepted aggregates, separate from reader validation. */
export function auditQuarter(descriptor, matrix, payload, point) {
  const context = descriptor.context;
  for (const artifact of [matrix, payload]) {
    assert.equal(artifact.contextSha256, descriptor.contextSha256, 'Mixed context');
    assert.equal(artifact.snapshotId, context.snapshotId, 'Mixed snapshot');
    assert.equal(artifact.asOfQuarter, context.asOfQuarter, 'Mixed as-of');
  }
  assert.ok(ordinal(payload.quarter) <= ordinal(context.asOfQuarter), 'Future quarter');
  const coverage = context.coverage.find((row) => row.quarter === payload.quarter);
  assert.equal(payload.status, coverage?.status, 'Coverage binding');
  assert.equal(point.quarter, payload.quarter, 'Capacity quarter binding');
  assert.equal(point.status, payload.status, 'Capacity coverage binding');
  const complete = payload.status === 'complete';
  const selection = context.selection;
  const selected = payload.scopes.selected_hdd;
  const all = payload.scopes.all_supplied;
  assert.deepEqual(
    selected.models.map((row) => row.modelId).sort(),
    [...selection.contextModelIds].sort(),
    'Whole HDD context lost',
  );
  assert.deepEqual(
    all.models.map((row) => row.modelId).sort(),
    context.inventory.map((row) => row.modelId).sort(),
    'All supplied scope lost',
  );
  for (const scope of [selected, all]) {
    for (const metric of metrics) {
      auditMetric(
        scope.totals[metric],
        total(scope.models, metric, complete),
        metric,
        `Scope ${metric} sum`,
      );
    }
    const labels = new Map(context.inventory.map((row) => [row.modelId, row.vendor]));
    assert.deepEqual(
      scope.manufacturers.map((row) => row.vendor).sort(),
      [...new Set(scope.models.map((row) => labels.get(row.modelId)))].sort(),
      'Manufacturer inventory',
    );
    for (const vendor of scope.manufacturers) {
      const group = scope.models.filter((row) => labels.get(row.modelId) === vendor.vendor);
      for (const [metric, share] of [
        ['count', 'populationShare'],
        ['new', 'newShare'],
        ['capacityTB', 'capacityShare'],
      ]) {
        const numerator = total(group, metric, complete);
        auditMetric(vendor[metric], numerator, metric, 'Published manufacturer sum');
        equalFloat(
          vendor[share],
          numerator !== null && scope.totals[metric] > 0 ? numerator / scope.totals[metric] : null,
          'Published manufacturer denominator',
        );
      }
    }
  }
  for (const row of selected.models) {
    const counterpart = all.models.find((entry) => entry.modelId === row.modelId);
    for (const metric of metrics) {
      auditMetric(row[metric], counterpart?.[metric], metric, `Cross-scope ${metric}`);
    }
  }
  const rows = selectRows(selected.models, context.inventory, selection, defaultFilter());
  assert.equal(rows.length, selected.models.length, 'Context rows truncated');
  assert.equal(
    distributionSummary(rows, complete).count,
    selected.totals.count,
    'Distribution Count',
  );
  assert.equal(deploymentSummary(rows, complete).total, selected.totals.new, 'Deployment New');
  for (const metric of metrics) {
    auditMetric(
      selectionTotals(rows, complete)[metric],
      selected.totals[metric],
      metric,
      `Selection ${metric}`,
    );
  }
  // Every vendor plus one identity and an empty search exercise narrowing independently.
  const filters = [
    defaultFilter(),
    ...[...new Set(rows.map((row) => row.vendor))].map((vendor) => ({
      ...defaultFilter(),
      vendor,
    })),
    { ...defaultFilter(), modelIds: new Set(rows.slice(0, 1).map((row) => row.modelId)) },
    { ...defaultFilter(), search: '__no_public_model_matches__' },
  ];
  for (const filter of filters) {
    const filtered = selectRows(selected.models, context.inventory, selection, filter);
    const expected = rows.filter(
      (row) =>
        (!filter.vendor || row.vendor === filter.vendor) &&
        (!filter.modelIds || filter.modelIds.has(row.modelId)) &&
        `${row.vendor} ${row.modelNumber}`.toLowerCase().includes(filter.search),
    );
    assert.deepEqual(
      filtered.map((row) => row.modelId).sort(),
      expected.map((row) => row.modelId).sort(),
      'Filter selection',
    );
    assert.equal(
      distributionSummary(filtered, complete).count,
      total(expected, 'count', complete),
      'Filtered Count',
    );
    assert.equal(
      deploymentSummary(filtered, complete).total,
      total(expected, 'new', complete),
      'Filtered New',
    );
    for (const vendor of manufacturerRows(filtered, selected.totals, complete)) {
      const group = expected.filter((row) => row.vendor === vendor.vendor);
      for (const [metric, share] of [
        ['count', 'populationShare'],
        ['new', 'newShare'],
        ['capacityTB', 'capacityShare'],
      ]) {
        const numerator = total(group, metric, complete);
        auditMetric(vendor[metric], numerator, metric, `Manufacturer ${metric}`);
        equalFloat(
          vendor[share],
          numerator !== null && selected.totals[metric] > 0
            ? numerator / selected.totals[metric]
            : null,
          `Whole-context ${share} denominator`,
        );
      }
    }
  }
  for (const model of matrix.models) {
    const cell = model.cells.find((row) => row.quarter === payload.quarter);
    if (cell?.status === 'eligible') {
      const row = selected.models.find((item) => item.modelId === model.modelId);
      assert.ok(row, 'Eligible model missing from context');
      for (const metric of ['count', 'new']) {
        assert.equal(cell.metrics[metric], row[metric], `Matrix/support ${metric}`);
      }
    }
  }
  assert.equal(point.count, all.totals.count, 'Capacity all-supplied Count');
  equalFloat(point.capacityTB, all.totals.capacityTB, 'Capacity all-supplied capacity');
  const dc = datacenterSummary(payload.datacenters, all.totals, coverage);
  assert.equal(dc.count, all.totals.count, 'Datacenter all-supplied Count');
  equalFloat(dc.capacityTB, all.totals.capacityTB, 'Datacenter all-supplied capacity');
  for (const metric of ['count', 'capacityTB']) {
    auditMetric(
      total(dc.rows, metric, complete),
      all.totals[metric],
      metric,
      `Location ${metric} sum includes Unknown`,
    );
  }
  for (const row of dc.rows) {
    equalFloat(
      row.populationShare,
      row.count !== null && dc.count > 0 ? row.count / dc.count : null,
      'Location population denominator',
    );
    equalFloat(
      row.capacityShare,
      row.capacityTB !== null && dc.capacityTB > 0 ? row.capacityTB / dc.capacityTB : null,
      'Location capacity denominator',
    );
  }
  if (complete && !coverage.datacenterFieldAvailable) {
    assert.ok(
      dc.rows.every((row) => row.name === 'Unknown'),
      'Unreported locations must be Unknown',
    );
  }
  equalFloat(
    dc.knownLocationPopulationShare,
    complete && dc.count > 0
      ? total(
          dc.rows.filter((row) => row.name !== 'Unknown'),
          'count',
          true,
        ) / dc.count
      : null,
    'Known-location population coverage',
  );
  if (!complete) {
    for (const row of rows) {
      for (const metric of metrics) {
        assert.equal(row[metric], null, 'Partial is unavailable');
      }
    }
  }
  return rows;
}

export function auditUnavailable(status, point) {
  assert.ok(['missing', 'unpublished'].includes(status), 'Unavailable quarter status');
  if (point) {
    for (const key of ['count', 'capacityTB', 'capacityDeltaTB']) {
      assert.equal(point[key], null, 'Unavailable quarter cannot be zero');
    }
  }
}

/** Parse quoted CSV without treating embedded commas/newlines as row boundaries. */
export function auditCsv(content, expectedMetadata) {
  const records = [];
  let record = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (char === ',' || char === '\r' || char === '\n')) {
      record.push(cell);
      cell = '';
      if (char !== ',') {
        records.push(record);
        record = [];
        if (char === '\r' && content[i + 1] === '\n') {
          i++;
        }
      }
    } else {
      cell += char;
    }
  }
  assert.ok(!quoted, 'Malformed CSV quotes');
  record.push(cell);
  records.push(record);
  const header = records.shift();
  assert.equal(new Set(header).size, header.length, 'Duplicate CSV column names');
  for (const [index, row] of records.entries()) {
    assert.equal(row.length, header.length, 'CSV row width');
    for (const value of row) {
      assert.ok(!/^(?:\s*[=+@]|[\t\r\n])/.test(value), 'Unsafe CSV formula');
      assert.ok(
        !/^\s*-/.test(value) || /^-\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value),
        'Unsafe CSV minus formula',
      );
    }
    const meta =
      typeof expectedMetadata === 'function' ? expectedMetadata(index) : expectedMetadata;
    for (const [column, value] of Object.entries(meta)) {
      assert.equal(row[header.indexOf(column)], String(value), `CSV metadata ${column}`);
    }
    // Structured attribution may contain public URLs, but never local paths/credentials.
    row.forEach(assertPublicValues);
  }
  return records.length;
}

export async function checkIntegratedRelease(
  directory,
  options = { latestQuarter: '2026-Q2', quarters: ['2025-Q3', '2025-Q4', '2026-Q2'] },
) {
  const graph = await checkProductionData(directory, options);
  const root = 'https://publication.example/production/';
  const sizes = new Map();
  const loader = new SnapshotLoader(`${root}index.json`, async (input) => {
    assert.ok(input.startsWith(root), 'Request escaped public graph');
    const name = input.slice(root.length);
    const bytes = await readFile(resolve(directory, name));
    sizes.set(name, bytes.length);
    return new Response(bytes);
  });
  const index = await loader.loadIndex();
  const snapshots = [];
  for (const entry of index.snapshots) {
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    const { context } = descriptor;
    const matrix = await loader.loadMatrix(descriptor);
    const presentation = adaptProductionV2(descriptor, matrix);
    assert.equal(presentation.id, context.snapshotId);
    assert.equal(presentation.sourceHash, context.sourceManifestSha256);
    assert.equal(presentation.sourceUrl, context.provenance.url);
    assert.equal(presentation.cutoff, context.cutoffDate);
    assert.deepEqual(
      matrix.models.map((row) => row.modelId).sort(),
      [...context.selection.analysisModelIds].sort(),
    );
    assert.ok(
      context.selection.contextModelIds.length > matrix.models.length,
      'Supporting context must retain models outside analysis',
    );
    const points = await new CapacityHistoryReader(loader).load(entry.snapshotId);
    assert.equal(
      points.length,
      descriptor.quarters.filter((row) => ordinal(row.quarter) <= ordinal(context.asOfQuarter))
        .length,
    );
    const htmlBytes = {
      deployments: 0,
      distribution: 0,
      capacity: 0,
      manufacturers: 0,
      datacenters: 0,
    };
    let available = 0,
      unavailable = 0,
      csvRows = 0,
      maxModels = 0,
      maxLocations = 0;
    const metadata = (quarter, status, scope, report, totals) => ({
      snapshotId: entry.snapshotId,
      asOfQuarter: context.asOfQuarter,
      quarter,
      status,
      kind: context.kind,
      sourceUrl: context.provenance.url,
      scope,
      report,
      contextCount: totals?.count ?? null,
      contextNew: totals?.new ?? null,
      sourceHistoryStart: context.sourceDomain.historyStartQuarter,
      filterDescription:
        scope === 'all_supplied'
          ? 'All supplied observations; HDD model/vendor filters do not apply'
          : 'Whole HDD context',
    });
    const expected = (meta) => ({
      Snapshot: meta.snapshotId,
      'As of quarter': meta.asOfQuarter,
      'Reporting quarter': meta.quarter,
      Coverage: meta.status,
      'Data kind': 'backblaze',
      Scope: meta.scope,
      'Whole scope observed drives': meta.contextCount ?? 'Unavailable',
      'Source URL': meta.sourceUrl,
      Report: meta.report,
      'Whole scope first recorded': meta.contextNew ?? 'Unavailable',
    });
    for (const quarter of descriptor.quarters) {
      const payload = await loader.loadQuarter(descriptor, quarter.quarter);
      const point = points.find((row) => row.quarter === quarter.quarter);
      if (!payload) {
        unavailable++;
        auditUnavailable(quarter.status, point);
        continue;
      }
      available++;
      assert.ok(point, 'Payload beyond cutoff');
      const rows = auditQuarter(descriptor, matrix, payload, point);
      const previous = points[points.indexOf(point) - 1];
      if (point.capacityDeltaTB !== null) {
        assert.equal(point.status, 'complete');
        assert.equal(previous?.status, 'complete');
        assert.equal(ordinal(point.quarter) - ordinal(previous.quarter), 1);
        assert.notEqual(previous.capacityTB, null);
        equalFloat(
          point.capacityDeltaTB,
          point.capacityTB - previous.capacityTB,
          'Adjacent capacity delta',
        );
      }
      maxModels = Math.max(maxModels, rows.length);
      maxLocations = Math.max(maxLocations, payload.datacenters.locations.length);
      const complete = payload.status === 'complete',
        whole = payload.scopes.selected_hdd.totals;
      const coverage = context.coverage.find((row) => row.quarter === payload.quarter);
      const fragments = {
        deployments: renderDeployments(rows, complete),
        distribution: renderDistribution(rows, complete),
        manufacturers: renderManufacturers(rows, whole, complete),
        datacenters: renderDatacenters(
          payload.datacenters,
          payload.scopes.all_supplied.totals,
          coverage,
        ),
      };
      for (const [report, html] of Object.entries(fragments)) {
        htmlBytes[report] = Math.max(htmlBytes[report], Buffer.byteLength(html));
        const all = report === 'datacenters';
        const meta = metadata(
          payload.quarter,
          payload.status,
          all ? 'all_supplied' : 'selected_hdd',
          report,
          all ? payload.scopes.all_supplied.totals : whole,
        );
        const content =
          report === 'manufacturers'
            ? reportCsv(manufacturerCsvRows(rows, whole, complete), meta)
            : all
              ? reportCsv(
                  datacenterCsvRows(
                    payload.datacenters,
                    payload.scopes.all_supplied.totals,
                    coverage,
                  ),
                  meta,
                )
              : selectionCsv(rows, meta);
        csvRows += auditCsv(content, expected(meta));
      }
    }
    htmlBytes.capacity = Buffer.byteLength(renderCapacity(points, context.asOfQuarter));
    const capacityMeta = (i) =>
      metadata(points[i].quarter, points[i].status, 'all_supplied', 'capacity', {
        count: points[i].count,
        new: null,
      });
    csvRows += auditCsv(reportCsv(capacityCsvRows(points), capacityMeta), (i) =>
      expected(capacityMeta(i)),
    );
    snapshots.push({
      snapshotId: entry.snapshotId,
      asOfQuarter: context.asOfQuarter,
      sourceManifestSha256: context.sourceManifestSha256,
      contextSha256: descriptor.contextSha256,
      analysisModels: matrix.models.length,
      matrixCells: matrix.models.reduce((sum, model) => sum + model.cells.length, 0),
      contextModels: maxModels,
      inventoryModels: context.inventory.length,
      maxLocations,
      available,
      unavailable,
      csvRows,
      historyPoints: points.length,
      maxRenderedFragmentBytes: htmlBytes,
      matrixAdapterJsonBytes: Buffer.byteLength(JSON.stringify(presentation)),
    });
  }
  return {
    graph,
    payloadBytes: {
      total: [...sizes.values()].reduce((a, b) => a + b, 0),
      maxArtifact: Math.max(...sizes.values()),
      files: sizes.size,
    },
    snapshots,
    limits:
      'Fragment and payload byte measurements only; no latency or full-page performance claim. No asset minimization, rankings or lifetime reliability conclusions.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/production');
  console.log(JSON.stringify(await checkIntegratedRelease(directory)));
}
