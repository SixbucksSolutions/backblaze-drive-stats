// Only the two reviewed HTML entry points are transformed. Vite already minifies
// its hashed JS/CSS; public JSON, fonts, attribution and other assets keep bytes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { minify } from 'html-minifier-terser';

// These settings cover the reviewed index/404 markup, which does not use CSS
// white-space to render indentation outside pre/textarea. Keep inline separators,
// raw script/style content, attributes, and required tags intact.
export const htmlMinifyOptions = Object.freeze({
  collapseWhitespace: true,
  conservativeCollapse: true,
  collapseInlineTagWhitespace: false,
  removeComments: true,
  ignoreCustomComments: [/^!/, /@license\b/i, /@preserve\b/i, /\blicen[cs]e\b/i, /\bcopyright\b/i],
  removeOptionalTags: false,
  removeEmptyAttributes: false,
  removeAttributeQuotes: false,
  removeRedundantAttributes: false,
  collapseBooleanAttributes: false,
  decodeEntities: false,
  minifyCSS: false,
  minifyJS: false,
  minifyURLs: false,
  sortAttributes: false,
  sortClassName: false,
});

export async function minifyHtml(html) {
  assert.equal(typeof html, 'string', 'HTML input must be text');
  return minify(html, htmlMinifyOptions);
}

async function realDirectory(path) {
  const stats = await lstat(path);
  assert.ok(stats.isDirectory() && !stats.isSymbolicLink(), 'Build root must be a real directory');
  return realpath(path);
}

export async function minimizeStaticAssets(webRoot) {
  const root = await realDirectory(resolve(webRoot));
  const dist = await realDirectory(resolve(root, 'dist'));
  assert.equal(dist, resolve(root, 'dist'), 'Build output must be the direct dist directory');
  const transformations = [];
  // Resolve and validate every target before writing any of them. Nothing is
  // discovered recursively, and callers cannot provide another output filename.
  for (const path of ['index.html', '404.html']) {
    const target = resolve(dist, path);
    const stats = await lstat(target);
    assert.ok(stats.isFile() && !stats.isSymbolicLink(), 'HTML target must be a regular file');
    const before = await readFile(target);
    const after = Buffer.from(await minifyHtml(before.toString('utf8')));
    assert.ok(after.length <= before.length, 'HTML minification unexpectedly enlarged a target');
    transformations.push({ path, target, before, after });
  }
  for (const { target, before, after } of transformations) {
    if (before.equals(after)) {
      continue;
    }
    // Replace the entry rather than writing through it, including a hard link.
    // Exclusive temporary files stay in dist only for the atomic replacement.
    const temporary = resolve(dist, `.minify-${randomUUID()}.tmp`);
    let created = false;
    try {
      await writeFile(temporary, after, { flag: 'wx' });
      created = true;
      await rename(temporary, target);
      created = false;
    } finally {
      if (created) {
        await unlink(temporary);
      }
    }
  }
  const files = transformations.map(({ path, before, after }) => ({
    path,
    beforeBytes: before.length,
    afterBytes: after.length,
    savedBytes: before.length - after.length,
  }));
  return {
    files,
    beforeBytes: files.reduce((sum, file) => sum + file.beforeBytes, 0),
    afterBytes: files.reduce((sum, file) => sum + file.afterBytes, 0),
    savedBytes: files.reduce((sum, file) => sum + file.savedBytes, 0),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'Usage: minimize-static-assets.mjs');
  const result = await minimizeStaticAssets(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  for (const file of result.files) {
    console.log(
      `${file.path}: ${file.beforeBytes} -> ${file.afterBytes} bytes (${file.savedBytes} saved)`,
    );
  }
  console.log(`Static HTML: ${result.beforeBytes} -> ${result.afterBytes} bytes.`);
}
