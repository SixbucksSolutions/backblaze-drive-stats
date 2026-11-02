import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adaptProduction,
  adaptWorkbook,
  axisExtent,
  cellAt,
  formatMetric,
  interpolate,
  matrixModelLabel,
  metrics,
  stateInfo,
  visibleModels,
} from './matrix-data.ts';
import type { Domain, Workbook, Production } from './matrix-data.ts';
import { captureControlFocus, controlId, restoreControlFocus } from './matrix-focus.ts';

await test('model labels display nominal capacity, preserve fractional TB and explicitly identify unknown capacity', () => {
  const model = { id: 'raw-id', name: 'ST12000NM0007', vendor: 'Seagate', cells: [], anchor: null };
  assert.equal(matrixModelLabel({ ...model, capacityTB: 12 }), 'ST12000NM0007 (12 TB)');
  assert.equal(
    matrixModelLabel({ ...model, name: 'ST31500541AS', capacityTB: 1.5 }),
    'ST31500541AS (1.5 TB)',
  );
  assert.equal(matrixModelLabel(model), 'ST12000NM0007 (capacity unknown)');
  assert.equal(
    matrixModelLabel({ ...model, capacityTB: null }),
    'ST12000NM0007 (capacity unknown)',
  );
  const historical = { ...model, name: 'Hitachi HDS5C3030ALA630', capacityTB: 3 };
  assert.equal(matrixModelLabel(historical), 'HDS5C3030ALA630 (3 TB)');
  assert.equal(historical.name, 'Hitachi HDS5C3030ALA630');
});

await test('real byte-derived metadata displays advertised TB without mutating source capacity', () => {
  for (const [name, capacityTB, expected] of [
    ['ST12000NM0007', 12.000138625024, 'ST12000NM0007 (12 TB)'],
    ['ST31500541AS', 1.500301910016, 'ST31500541AS (1.5 TB)'],
  ] as const) {
    const model = { id: name, name, vendor: 'Seagate', cells: [], anchor: null, capacityTB };
    const original = structuredClone(model);
    assert.equal(matrixModelLabel(model), expected);
    assert.deepEqual(model, original);
  }
});
// Repository fixtures are versioned alongside their adapter contracts.
function fixture(path: 'workbooks/owner-stories.json'): { stories: { models: string[] }[] };
function fixture(path: `workbooks/${string}`): Workbook;
function fixture(path: `matrix/${string}`): Production;
function fixture(path: string): unknown {
  const data: unknown = JSON.parse(
    readFileSync(new URL(`../../fixtures/${path}`, import.meta.url), 'utf8'),
  );
  return data;
}
await test('rerender restores the exact brand, model or story control and preserves a middle-string search caret', () => {
  const calls: unknown[] = [];
  for (const scope of ['vendor', 'model', 'story']) {
    const id = controlId(scope, 'model with spaces / variant');
    const saved = captureControlFocus({ id, focus() {} });
    restoreControlFocus(saved, (sought) => {
      assert.equal(sought, id);
      return { id, focus: (options) => calls.push([id, options]) };
    });
    assert.deepEqual(calls.at(-1), [id, { preventScroll: true }]);
  }
  assert.notEqual(controlId('vendor', 'a / b'), controlId('model', 'a / b'));
  assert.notEqual(controlId('model', 'a / b'), controlId('model', 'a%20%2F%20b'));
  assert.equal(controlId('vendor', 'WDC/HGST'), 'matrix-vendor-WDC%2FHGST');
  const saved = captureControlFocus({
    id: 'matrix-search',
    selectionStart: 3,
    selectionEnd: 7,
    selectionDirection: 'backward',
    focus() {},
  });
  restoreControlFocus(saved, (id) => ({
    id,
    focus: () => calls.push('focus'),
    setSelectionRange: (...args) => calls.push(args),
  }));
  assert.deepEqual(calls.slice(-2), ['focus', [3, 7, 'backward']]);
  assert.equal(captureControlFocus(null), undefined);
  assert.equal(captureControlFocus({ id: '', focus() {} }), undefined);
  restoreControlFocus(saved, () => null);
});
await test('both real workbook snapshots retain every model, exact source values, unknown blanks and all owner stories', () => {
  const stories = fixture('workbooks/owner-stories.json').stories as { models: string[] }[];
  for (const q of ['2025-Q3', '2025-Q4']) {
    const raw = fixture(`workbooks/${q}.json`),
      s = adaptWorkbook(raw);
    assert.equal(s.kind, 'reference');
    assert.equal(s.models.length, 19);
    assert.equal(s.cutoff, null);
    for (const story of stories) {
      for (const name of story.models) {
        assert.ok(s.models.some((m) => m.id === name));
      }
    }
    for (let mi = 0; mi < s.models.length; mi++) {
      const m = s.models[mi]!;
      assert.equal(m.anchor, null);
      assert.equal(m.capacityTB, null);
      for (let ri = 0; ri < m.cells.length; ri++) {
        const cell = m.cells[ri]!,
          row = raw.models[mi]!.rows[ri]!;
        assert.equal(cell.quarter, null);
        assert.equal(cell.quarterComponents, undefined);
        for (let i = 0; i < 7; i++) {
          assert.equal(cell.raw![i], row.cells[i]![1]);
          assert.equal(
            cell.metrics[metrics[i]!],
            row.cells[i]![1] === null ? null : Number(row.cells[i]![1]),
          );
        }
        if (row.status === 'trailing_blank_unknown') {
          assert.equal(cell.state, 'trailing_blank_unknown');
          assert.ok(Object.values(cell.metrics).every((v) => v === null));
        }
      }
    }
    const toshiba = s.models.find((m) => m.id === 'MG08ACA16TA')!.cells[0]!;
    assert.equal(toshiba.raw![0], '3.570438723771948');
    assert.equal(toshiba.metrics.failed, 0);
    assert.equal(s.domains.new.knots[0]!.color, '#FFFFFF');
  }
});
await test('calendar offsets, exposure, prior-eligible baselines, gaps, threshold exits and snapshot ends remain distinct', () => {
  const s = adaptProduction(fixture('matrix/synthetic-later.json')),
    m = s.models[0]!;
  assert.equal(m.cells[0]!.quarter, '2024-Q1');
  assert.equal(m.cells[0]!.metrics.failed, 0);
  assert.equal(m.preEligibility!.failures, 1);
  assert.equal(m.cells[0]!.cumulativeComponents!.failures, 1);
  assert.equal(m.cells[1]!.state, 'below_threshold');
  assert.equal(m.cells[1]!.observations!.count, 1999);
  assert.ok(Object.values(m.cells[1]!.metrics).every((v) => v === null));
  assert.equal(m.cells[2]!.relativeQuarter, 3);
  assert.equal(m.cells[2]!.deltaBaseline!.elapsedQuarters, 2);
  assert.equal(m.cells[4]!.state, 'source_missing');
  assert.equal(m.cells[5]!.state, 'source_incomplete');
  assert.equal(m.cells[6]!.state, 'eligible');
  assert.equal(m.cells[6]!.metrics.afr, null);
  assert.equal(m.cells[6]!.metrics.count, 2600);
  assert.equal(m.cells[7]!.state, 'snapshot_end');
  const distinct = [
    'below_threshold',
    'source_missing',
    'source_incomplete',
    'snapshot_end',
    'trailing_blank_unknown',
  ].map((s) => stateInfo(s).label);
  assert.equal(new Set(distinct).size, 5);
  assert.match(
    stateInfo('trailing_blank_unknown').description,
    /does not establish threshold exit/,
  );
  assert.equal(formatMetric(0, 'failed'), '0');
  assert.equal(formatMetric(null, 'failed'), '—');
});
await test('full snapshot color domains are immutable across model selection, new vendors and snapshot changes', () => {
  const s = adaptWorkbook(fixture('workbooks/2025-Q4.json'));
  const serialized = JSON.stringify(s.domains);
  const selected = new Set(['WUH721816ALE6L4', 'MG08ACA16TA']);
  const filtered = visibleModels(s, selected);
  assert.deepEqual(
    filtered.map((m) => m.id),
    ['MG08ACA16TA', 'WUH721816ALE6L4'],
  );
  assert.deepEqual(visibleModels(s, new Set()), []);
  assert.equal(visibleModels(s, new Set(s.models.map((m) => m.id))).length, s.models.length);
  assert.equal(JSON.stringify(s.domains), serialized);
  assert.equal(s.domains.count.observedMaximum, 44425);
  assert.equal(
    adaptWorkbook(fixture('workbooks/2025-Q3.json')).domains.count.observedMaximum,
    40322,
  );
  const xyz = adaptProduction(fixture('matrix/synthetic-new-manufacturer.json'));
  const xyzDomains = JSON.stringify(xyz.domains);
  const newVendorModels = xyz.models.filter((m) => m.vendor === 'XYZ');
  assert.ok(newVendorModels.length > 0);
  assert.deepEqual(visibleModels(xyz, new Set(newVendorModels.map((m) => m.id))), newVendorModels);
  assert.equal(JSON.stringify(xyz.domains), xyzDomains);
});
await test('the chosen year guide extends the axis without truncating history or inventing a reference exit', () => {
  const s = adaptWorkbook(fixture('workbooks/2025-Q4.json')),
    promising = s.models.find((m) => m.id === 'WUH721816ALE6L4')!;
  assert.equal(promising.cells.filter((c) => c.state === 'reference_observed').length, 14);
  assert.equal(axisExtent(s, 1), s.extent);
  assert.ok(axisExtent(s, 5) >= 20);
  assert.equal(axisExtent(s, 6), s.extent);
  assert.equal(axisExtent(adaptProduction(fixture('matrix/synthetic-earlier.json')), 6), 24);
  assert.equal(cellAt(promising, 24).state, 'trailing_blank_unknown');
  assert.equal(cellAt(promising, 40).state, 'outside_reference');
});
await test('exact piecewise sRGB interpolation, clamping, singleton, empty and tied production domains', () => {
  const domain: Domain = {
    sampleCount: 3,
    observedMinimum: 0,
    observedMedian: 1,
    observedMaximum: 2,
    knots: [
      { value: 0, color: '#00FF00' },
      { value: 1, color: '#FFFF00' },
      { value: 2, color: '#FF0000' },
    ],
  };
  assert.equal(interpolate(0.5, domain), '#80FF00');
  assert.equal(interpolate(1.5, domain), '#FF8000');
  assert.equal(interpolate(1, domain), '#FFFF00');
  assert.equal(interpolate(9, domain), '#FF0000');
  assert.equal(interpolate(-1, domain), '#00FF00');
  assert.equal(interpolate(null, domain), '#F2F2F2');
  assert.equal(interpolate(4, { ...domain, knots: [] }), '#F2F2F2');
  assert.equal(interpolate(9, { ...domain, knots: [{ value: 0, color: '#FFFFFF' }] }), '#FFFFFF');
  for (const name of ['earlier', 'later', 'correction', 'new-manufacturer']) {
    const s = adaptProduction(fixture(`matrix/synthetic-${name}.json`));
    for (const domain of Object.values(s.domains)) {
      for (let i = 1; i < domain.knots.length; i++) {
        assert.ok(domain.knots[i]!.value > domain.knots[i - 1]!.value);
      }
      for (const knot of domain.knots) {
        assert.equal(interpolate(knot.value, domain), knot.color);
      }
    }
  }
});
