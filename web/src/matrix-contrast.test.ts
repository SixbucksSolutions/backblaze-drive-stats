import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { adaptProduction, adaptWorkbook, interpolate, metrics } from './matrix-data.ts';
import { contrastRatio, HEATMAP_CONTRAST_TARGET, heatmapPaint, relativeLuminance } from './matrix-contrast.ts';

function fixture(path: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../fixtures/${path}`, import.meta.url)), 'utf8'));
}

test('WCAG luminance and contrast use exact linearized sRGB, without threshold rounding', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.ok(Math.abs(contrastRatio('#FF0000', '#000000') - 5.252) < 1e-12);
  assert.ok(contrastRatio('#777777', '#FFFFFF') < 4.5);
  assert.equal(contrastRatio('#123456', '#123456'), 1);
});

test('the owner 2.006% red example receives enhanced contrast while green/yellow/white stay intact', () => {
  const paint = heatmapPaint('#FF0000');
  assert.equal(paint.foreground, '#000000');
  assert.notEqual(paint.background, '#FF0000');
  assert.ok(paint.contrast >= HEATMAP_CONTRAST_TARGET);
  for (const color of ['#00FF00', '#FFFF00', '#FFFFFF']) assert.equal(heatmapPaint(color).background, color);
  for (const color of ['#6EBE49', '#CC0000', '#00529F', '#485963']) {
    const header = heatmapPaint(color);
    assert.ok(contrastRatio(header.foreground, header.background) >= 7);
  }
  assert.equal(heatmapPaint('#ff0000'), heatmapPaint('#F00'));
});

test('all six snapshot cells and dense samples of every gradient meet enhanced text contrast', () => {
  const snapshots = [adaptWorkbook(fixture('workbooks/2025-Q3.json')), adaptWorkbook(fixture('workbooks/2025-Q4.json')),
    ...['earlier', 'later', 'correction', 'new-manufacturer'].map(name => adaptProduction(fixture(`matrix/synthetic-${name}.json`)))];
  for (const snapshot of snapshots) {
    const rawDomains = JSON.stringify(snapshot.domains);
    for (const model of snapshot.models) for (const cell of model.cells) for (const metric of metrics) {
      if (cell.metrics[metric] === null) continue;
      const paint = heatmapPaint(interpolate(cell.metrics[metric], snapshot.domains[metric]));
      assert.ok(paint.contrast >= HEATMAP_CONTRAST_TARGET, `${snapshot.id}/${metric}`);
    }
    for (const domain of Object.values(snapshot.domains)) {
      for (const knot of domain.knots) assert.ok(heatmapPaint(knot.color).contrast >= HEATMAP_CONTRAST_TARGET);
      for (let index = 1; index < domain.knots.length; index++) {
        const from = domain.knots[index - 1]!.value, to = domain.knots[index]!.value;
        for (let step = 0; step <= 512; step++) {
          const paint = heatmapPaint(interpolate(from + (to - from) * step / 512, domain));
          assert.ok(paint.contrast >= HEATMAP_CONTRAST_TARGET);
        }
      }
    }
    assert.equal(JSON.stringify(snapshot.domains), rawDomains);
  }
});

test('invalid or translucent colors are refused instead of claiming contrast against an unknown surface', () => {
  for (const invalid of ['red', '#0000', '#FFFFFF00', 'rgba(0,0,0,.5)', '#GGGGGG']) {
    assert.throws(() => heatmapPaint(invalid));
  }
});
