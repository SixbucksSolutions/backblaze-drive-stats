import type { Workbook } from './matrix-data.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaDisplay, metricFieldWidths, yearRowGroups } from './matrix-display.ts';
import { readFileSync } from 'node:fs';
import { adaptWorkbook, formatMetric, metrics, visibleModels } from './matrix-data.ts';
import { captureControlFocus, controlId, restoreControlFocus } from './matrix-focus.ts';
import { formatAfr, formatAfrProse } from './afr-format.ts';

await test('AFR display always includes three decimals while retaining raw numeric precision', () => {
  for (const [value, expected] of [
    [3.473822144, '3.474'],
    [2, '2.000'],
    [0, '0.000'],
    [0.0004, '0.000'],
    [-0.0001, '-0.000'],
    [-2.3456, '-2.346'],
  ] as const) {
    assert.equal(formatAfr(value), expected);
    assert.equal(formatMetric(value, 'afr'), expected);
    assert.equal(formatMetric(value, 'afrDelta'), expected);
  }
  assert.equal(formatMetric(null, 'afr'), '—');
  assert.equal(formatMetric(null, 'afrDelta'), '—');
  assert.equal(formatMetric(1234, 'count'), '1,234');
  assert.equal(formatMetric(3.473822144, 'populationDelta'), '3.474');
});

await test('AFR reading-case percentages gain fixed precision without changing counts or prose', () => {
  assert.equal(
    formatAfrProse('Early high AFR settling near 1%; 2,000 drives; factor 36500.'),
    'Early high AFR settling near 1.000%; 2,000 drives; factor 36500.',
  );
  assert.equal(
    formatAfrProse('Quarter AFR 3.473822%; baseline 0%.'),
    'Quarter AFR 3.474%; baseline 0.000%.',
  );
  assert.equal(
    formatAfrProse('Unavailable rate; 123 failures.'),
    'Unavailable rate; 123 failures.',
  );
});

await test('percentage point values reserve an equal sign column, including rounded negative zero', () => {
  for (const value of [0, 0.5, -0.5, -0.0001, 9.999, -9.999]) {
    const display = deltaDisplay(value);
    assert.equal(display.text.length + Number(display.reserveSign), 6);
    assert.equal(display.reserveSign, !display.text.startsWith('-'));
    assert.equal(Number(display.text), Number(value.toFixed(3)));
  }
});

await test('search focus fallback retains caret and direction without scrolling', () => {
  const saved = captureControlFocus({
    id: 'matrix-search',
    selectionStart: 2,
    selectionEnd: 5,
    selectionDirection: 'backward',
    focus() {},
  });
  const calls: unknown[] = [];
  restoreControlFocus(saved, () => ({
    id: 'matrix-search',
    focus: (options) => calls.push(options),
    setSelectionRange: (...args) => calls.push(args),
  }));
  assert.deepEqual(calls, [{ preventScroll: true }, [2, 5, 'backward']]);
  restoreControlFocus(saved, () => null);
  assert.equal(controlId('model', 'a / b'), 'matrix-model-a%20%2F%20b');
});

await test('all seven numeric field widths use the full snapshot and remain stable across model selection', () => {
  const snapshot = adaptWorkbook(
    JSON.parse(
      readFileSync(new URL('../../fixtures/workbooks/2025-Q4.json', import.meta.url), 'utf8'),
    ) as Workbook,
  );
  const widths = metricFieldWidths(snapshot);
  const before = { ...widths };
  for (const selected of [
    new Set<string>(),
    new Set(['WUH721816ALE6L4']),
    new Set(snapshot.models.map((model) => model.id)),
  ]) {
    visibleModels(snapshot, selected);
    assert.deepEqual(metricFieldWidths(snapshot), before);
  }
  for (const metric of metrics) {
    const lengths = snapshot.models.flatMap((model) =>
      model.cells.map((cell) => {
        const value = cell.metrics[metric];
        return (
          formatMetric(value, metric).length +
          Number(metric === 'afrDelta' && value !== null && deltaDisplay(value).reserveSign)
        );
      }),
    );
    assert.equal(widths[metric], Math.max(...lengths));
  }
});

await test('year row groups span four quarters and retain an exact final partial year', () => {
  const groups = yearRowGroups(27);
  assert.equal(groups.length, 7);
  assert.deepEqual(groups.at(-1), { year: 7, quarters: [25, 26, 27] });
  assert.ok(groups.slice(0, -1).every((group) => group.quarters.length === 4));
  assert.deepEqual(
    groups.flatMap((group) => group.quarters),
    Array.from({ length: 27 }, (_, index) => index + 1),
  );
  assert.deepEqual(yearRowGroups(24).at(-1), { year: 6, quarters: [21, 22, 23, 24] });
  assert.deepEqual(yearRowGroups(0), []);
});
