import assert from 'node:assert/strict';
import test from 'node:test';
import { auditMinimizedAssets } from './check-minimized-assets.mjs';
import { minifyHtml } from './minimize-static-assets.mjs';

const policy = { minify: 'oxc', cssMinify: 'lightningcss', sourcemap: false };
const html = Buffer.from(
  await minifyHtml('<!doctype html>\n<html><body><p>Drive Stats</p></body></html>'),
);
const release = () =>
  new Map([
    ['index.html', html],
    ['404.html', html],
    ['assets/app-hash.js', Buffer.from('console.log("Drive Stats");')],
    ['assets/app-hash.css', Buffer.from('p{color:#000}')],
    ['data/production/matrix.hash.json', Buffer.from('{"number":1.00,"label":"a  b"}\n')],
    ['assets/example-hash.json', Buffer.from('{"number":1.00,"label":"a  b"}')],
  ]);

await test('Minimized release retains exact JSON tokens and immutable production terminator', async () => {
  const counts = await auditMinimizedAssets(release(), policy);
  assert.deepEqual(
    [counts.json, counts.html, counts.js, counts.css, counts.images],
    [2, 2, 1, 1, 0],
  );
});

await test('Formatting regressions, disabled minifiers and source maps fail the release', async () => {
  for (const mutate of [
    (files) => files.set('assets/example-hash.json', Buffer.from('{\n  "x": 1\n}')),
    (files) => files.set('data/production/matrix.hash.json', Buffer.from('{\n  "x": 1\n}')),
    (files) =>
      files.set(
        '404.html',
        Buffer.from('<!doctype html>\n  <html><body><!-- format --><p>x</p></body></html>'),
      ),
    (files) => files.set('assets/app.js.map', Buffer.from('{}')),
  ]) {
    const files = release();
    mutate(files);
    await assert.rejects(auditMinimizedAssets(files, policy));
  }
  for (const changed of [{ minify: false }, { cssMinify: false }, { sourcemap: true }]) {
    await assert.rejects(auditMinimizedAssets(release(), { ...policy, ...changed }));
  }
});
