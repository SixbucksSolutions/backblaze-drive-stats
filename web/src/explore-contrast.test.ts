import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contrastRatio } from './matrix-contrast.ts';

const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const explore = readFileSync(new URL('./snapshot-explorer.css', import.meta.url), 'utf8');
const backgrounds = ['#ffffff', '#f5f6f2', '#f3f6f1'];

await test('Explore inactive navigation text meets AA on its actual light backgrounds', () => {
  const rule = /\.nav-item\s*\{([^}]+)\}/.exec(styles)?.[1];
  assert.ok(rule);
  const foreground = /(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
  assert.ok(foreground);
  for (const background of backgrounds) {
    assert.ok(contrastRatio(foreground, background) >= 4.5);
  }
});
await test('Explicit keyboard focus cues meet non-text contrast on page and panel backgrounds', () => {
  const foreground = /outline:\s*3px solid\s*(#[0-9a-f]{6})/i.exec(styles)?.[1];
  assert.ok(foreground);
  for (const background of backgrounds) {
    assert.ok(contrastRatio(foreground, background) >= 3);
  }
});
await test('Snapshot and calendar selector boundaries remain distinguishable on white', () => {
  const rule = /\.snapshot-controls select\s*\{([^}]+)\}/.exec(explore)?.[1];
  assert.ok(rule);
  const foreground = /border:\s*1px solid\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
  assert.ok(foreground);
  assert.ok(contrastRatio(foreground, '#ffffff') >= 3);
});
