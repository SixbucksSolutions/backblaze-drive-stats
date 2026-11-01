import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveConfig } from 'vite';
import { hostingFiles } from './check-hosting-release.mjs';
import { minimizeJsonBytes } from './minimized-json.mjs';
import { minifyHtml } from './minimize-static-assets.mjs';

export async function auditMinimizedAssets(files, build) {
  assert.equal(build.minify, 'oxc', 'Production JavaScript minification must stay enabled');
  assert.equal(build.cssMinify, 'lightningcss', 'Production CSS minification must stay enabled');
  assert.equal(build.sourcemap, false, 'Do not publish development source maps');
  const counts = { json: 0, html: 0, js: 0, css: 0, images: 0, bytes: 0 };
  for (const [path, bytes] of files) {
    counts.bytes += bytes.length;
    if (path.endsWith('.json')) {
      const compact = minimizeJsonBytes(bytes);
      const retainedTerminator =
        path.startsWith('data/production/') &&
        bytes.equals(Buffer.concat([compact, Buffer.from('\n')]));
      assert.ok(bytes.equals(compact) || retainedTerminator, `JSON is not compact: ${path}`);
      counts.json++;
    } else if (path.endsWith('.html')) {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      assert.equal(await minifyHtml(text), text, `HTML is not minimized: ${path}`);
      counts.html++;
    } else if (path.endsWith('.js')) {
      counts.js++;
    } else if (path.endsWith('.css')) {
      counts.css++;
    } else if (/\.(?:png|jpe?g|gif|webp|avif|ico|svg)$/i.test(path)) {
      counts.images++;
    }
    assert.ok(!path.endsWith('.map'), 'Unexpected served source map');
  }
  assert.ok(
    counts.html >= 2 && counts.json > 0 && counts.js > 0 && counts.css > 0,
    'Incomplete static release',
  );
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'Usage: check-minimized-assets.mjs');
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const config = await resolveConfig({ root: webRoot }, 'build');
  console.log(
    JSON.stringify(
      await auditMinimizedAssets(await hostingFiles(resolve(webRoot, 'dist')), config.build),
    ),
  );
}
