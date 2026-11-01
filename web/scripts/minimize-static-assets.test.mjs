import assert from 'node:assert/strict';
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { htmlMinifyOptions, minifyHtml, minimizeStaticAssets } from './minimize-static-assets.mjs';

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>Drive Stats — quarterly explorer</title>
    <style>p::before { content: "a  b"; }\n    a { color: red; }</style>
  </head>
  <body>
    <!-- ordinary build comment -->
    <p><span>Drive</span> <strong>Stats</strong> &amp; reliability</p>
    <pre>  model\n    ST  16000\n</pre>
    <textarea aria-label="Model notes">  line one\n  line two</textarea>
    <a href="/data/report.json?quarter=2026-Q2&amp;view=all#fleet" data-model="a  b" aria-label="Open fleet" class="first second">Fleet</a>
    <input disabled="disabled" value="" aria-label="Unavailable" />
    <script type="module">const message = "a  b";\n    console.log(message);</script>
    <script type="application/ld+json">{ "name": "a  b" }</script>
    <!--! Attribution must remain -->
    <!-- @license Example -->
    <!-- Copyright Example -->
  </body>
</html>
`;

await test('Reviewed HTML minification preserves text, raw content, attributes and attribution', async () => {
  const output = await minifyHtml(html);
  assert.ok(Buffer.byteLength(output) < Buffer.byteLength(html));
  assert.ok(!output.includes('ordinary build comment'));
  for (const retained of [
    '<span>Drive</span> <strong>Stats</strong> &amp; reliability',
    '<pre>  model\n    ST  16000\n</pre>',
    '<textarea aria-label="Model notes">  line one\n  line two</textarea>',
    '<style>p::before { content: "a  b"; }\n    a { color: red; }</style>',
    '<script type="module">const message = "a  b";\n    console.log(message);</script>',
    '<script type="application/ld+json">{ "name": "a  b" }</script>',
    'href="/data/report.json?quarter=2026-Q2&amp;view=all#fleet"',
    'data-model="a  b"',
    'aria-label="Open fleet"',
    'class="first second"',
    'disabled="disabled" value="" aria-label="Unavailable"',
    '<!--! Attribution must remain -->',
    '<!-- @license Example -->',
    '<!-- Copyright Example -->',
    '<html lang="en">',
    '</head>',
    '</body>',
    '</html>',
  ]) {
    assert.ok(output.includes(retained), `Required HTML semantics changed: ${retained}`);
  }
  assert.equal(await minifyHtml(html), output, 'Same input must yield identical output');
  assert.equal(await minifyHtml(output), output, 'Minification must be idempotent');
  assert.ok(Object.isFrozen(htmlMinifyOptions));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'minify-static-'));
  await mkdir(join(root, 'dist'));
  await mkdir(join(root, 'public'));
  await mkdir(join(root, 'dist/assets'));
  await writeFile(join(root, 'dist/index.html'), html);
  await writeFile(join(root, 'public/404.html'), html);
  // An atomic replacement must also leave this source hard link untouched.
  await link(join(root, 'public/404.html'), join(root, 'dist/404.html'));
  return root;
}

async function removeFixture(root, child = '') {
  const canonical = await realpath(root);
  assert.equal(dirname(canonical), await realpath(tmpdir()));
  assert.ok(basename(canonical).startsWith('minify-static-'));
  assert.ok(child === '' || child === 'dist');
  await rm(resolve(canonical, child), { recursive: true, force: true });
}

await test('Bounded runner measures exact bytes and leaves every non-target asset unchanged', async () => {
  const root = await fixture();
  try {
    const preserved = new Map([
      ['public/404.html', Buffer.from(html)],
      ['dist/assets/index-Abcd1234.js', Buffer.from('/*! License */const x="a  b";')],
      ['dist/assets/index-Abcd1234.css', Buffer.from('/*! License */p{color:red}')],
      ['dist/assets/other.html', Buffer.from('<p>  untouched  </p>')],
      ['dist/assets/generation.hash.json', Buffer.from('{"model":"a  b"}\n')],
      ['dist/assets/font.woff2', Buffer.from([0, 255, 10, 128])],
      ['dist/assets/LICENSE.txt', Buffer.from('Keep attribution\r\n')],
      ['dist/_headers', Buffer.from('/\nCache-Control: no-cache\n')],
    ]);
    for (const [path, bytes] of preserved) {
      if (path !== 'public/404.html') {
        await writeFile(join(root, path), bytes);
      }
    }
    const beforeBytes = Buffer.byteLength(html);
    const expected = Buffer.from(await minifyHtml(html));
    const result = await minimizeStaticAssets(root);
    assert.deepEqual(result, {
      files: ['index.html', '404.html'].map((path) => ({
        path,
        beforeBytes,
        afterBytes: expected.length,
        savedBytes: beforeBytes - expected.length,
      })),
      beforeBytes: beforeBytes * 2,
      afterBytes: expected.length * 2,
      savedBytes: (beforeBytes - expected.length) * 2,
    });
    for (const path of ['index.html', '404.html']) {
      assert.deepEqual(await readFile(join(root, 'dist', path)), expected);
    }
    for (const [path, bytes] of preserved) {
      assert.deepEqual(await readFile(join(root, path)), bytes, `Changed non-target ${path}`);
    }
    const repeated = await minimizeStaticAssets(root);
    assert.equal(repeated.savedBytes, 0);
    assert.equal(repeated.beforeBytes, result.afterBytes);
    assert.equal(repeated.afterBytes, result.afterBytes);
    assert.deepEqual((await readdir(join(root, 'dist'))).sort(), [
      '404.html',
      '_headers',
      'assets',
      'index.html',
    ]);
  } finally {
    await removeFixture(root);
  }
});

await test('Missing or non-file targets fail before any HTML is changed', async () => {
  const root = await fixture();
  try {
    await unlink(join(root, 'dist/404.html'));
    await assert.rejects(minimizeStaticAssets(root), { code: 'ENOENT' });
    assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), html);
    await mkdir(join(root, 'dist/404.html'));
    await assert.rejects(minimizeStaticAssets(root), /regular file/);
    assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), html);
  } finally {
    await removeFixture(root);
  }
});

await test('Root, dist and HTML junction aliases are rejected without source writes', async () => {
  const root = await fixture();
  const alias = `${root}-alias`;
  try {
    await symlink(root, alias, 'junction');
    await assert.rejects(minimizeStaticAssets(alias), /real directory/);
    await unlink(alias);
    await removeFixture(root, 'dist');
    await symlink(join(root, 'public'), join(root, 'dist'), 'junction');
    await assert.rejects(minimizeStaticAssets(root), /real directory/);
    await unlink(join(root, 'dist'));
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/index.html'), html);
    await symlink(join(root, 'public'), join(root, 'dist/404.html'), 'junction');
    await assert.rejects(minimizeStaticAssets(root), /regular file/);
    await unlink(join(root, 'dist/404.html'));
    assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), html);
    assert.equal(await readFile(join(root, 'public/404.html'), 'utf8'), html);
  } finally {
    await unlink(alias).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
    await removeFixture(root);
  }
});
