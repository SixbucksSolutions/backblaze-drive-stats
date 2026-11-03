import test from 'node:test';
import assert from 'node:assert/strict';
import { renderModelSelector, bindModelSelector } from './model-selector.ts';
import type { MatrixModel } from './matrix-data.ts';
const models: MatrixModel[] = [
  { id: 'a', name: 'ST10000A', vendor: 'Seagate', capacityTB: 10, cells: [], anchor: null },
  { id: 'b', name: 'ST12000B', vendor: 'Seagate', capacityTB: 12, cells: [], anchor: null },
  { id: 'c', name: 'WDC<unsafe>', vendor: 'WDC/HGST', capacityTB: null, cells: [], anchor: null },
];
await test('shared renderer keeps complete counts, canonical brands, capacity alignment and scoped controls under search', () => {
  const html = renderModelSelector(models, new Set(['a', 'c']), 'ST10000', 'afr-chart', 'chart');
  assert.match(html, /2 of 3 models selected/);
  assert.match(html, /1\/2<\/small>/);
  assert.match(html, /data-model="a"/);
  assert.doesNotMatch(html, /data-model="b"/);
  assert.match(html, /aria-controls="afr-chart"/);
  assert.match(html, /control the chart/);
  assert.match(html, /matrix-model-integer/);
  const all = renderModelSelector(models, new Set(), '');
  assert.match(all, /HGST\/WD/);
  assert.match(all, /WDC&lt;unsafe&gt;/);
  assert.match(all, /capacity unknown/);
  assert.match(all, /aria-controls="matrix-data"/);
  assert.match(renderModelSelector(models, new Set(), '"<absent>'), /No matching brands or models/);
  assert.match(renderModelSelector(models, new Set(), '"<absent>'), /value="&quot;&lt;absent&gt;"/);
});
await test('shared bindings set tristate and apply search-visible brand to its whole population', () => {
  const control = (dataset: Record<string, string> = {}) => ({
    dataset,
    indeterminate: false,
    checked: false,
    value: '',
    oninput: null as ((event: Event) => void) | null,
    onchange: null as (() => void) | null,
    onclick: null as (() => void) | null,
  });
  const search = control(),
    all = control(),
    clear = control();
  const vendor = control({ vendor: 'Seagate' }),
    chosen = control({ model: 'a' });
  const controls = new Map([
    ['#matrix-search', search],
    ['#matrix-select-all', all],
    ['#matrix-clear', clear],
  ]);
  const host = {
    querySelector: (selector: string) => controls.get(selector),
    querySelectorAll: (selector: string) => (selector === '[data-vendor]' ? [vendor] : [chosen]),
  };
  let selected = new Set(['a']);
  let query = '';
  bindModelSelector(
    host as unknown as HTMLElement,
    models,
    selected,
    (value) => {
      query = value;
    },
    (next) => {
      selected = next;
    },
  );
  assert.equal(vendor.indeterminate, true);
  vendor.checked = true;
  vendor.onchange!();
  assert.deepEqual([...selected], ['a', 'b']);
  all.onclick!();
  assert.deepEqual([...selected], ['a', 'b', 'c']);
  clear.onclick!();
  assert.deepEqual([...selected], []);
  search.value = 'ST';
  search.oninput!({ target: search } as unknown as Event);
  assert.equal(query, 'ST');
});
