import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { format } from 'prettier';
import {
  assertHostingPolicy,
  auditHostingInventory,
  cachePolicy,
  dailyCache,
  immutable,
  hostingFiles,
  writeHostingEvidence,
} from './check-hosting-release.mjs';
import { checkHostingLocal } from './check-hosting-local.mjs';
import { retainHostingManifest } from './retain-hosting-manifest.mjs';

const config = JSON.parse(
  await format(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), {
    parser: 'json',
    trailingComma: 'none',
  }),
);
const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const generation = `data/production/2026-Q2-v2-${'a'.repeat(24)}/matrix.${'b'.repeat(64)}.json`;
const script = 'assets/index-Abcd1234.js';
const style = 'assets/index-Abcd1234.css';
const chunk = 'assets/lazy-Abcd1234.js';
const data = 'assets/sample-Abcd1234.json';

await test('Canonical evidence boundaries reject junctions and preserve served files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hosting-boundary-'));
  const publicRoot = join(root, 'public');
  const distRoot = join(root, 'dist');
  const alias = join(root, 'alias');
  const output = join(root, 'evidence.json');
  await mkdir(publicRoot);
  await mkdir(distRoot);
  try {
    for (const target of [publicRoot, distRoot]) {
      await symlink(target, alias, 'junction');
      try {
        await assert.rejects(hostingFiles(alias), /real directory/);
        await assert.rejects(
          writeHostingEvidence(root, join(alias, 'evidence.json'), {}),
          /outside both/,
        );
        assert.deepEqual(await hostingFiles(target), new Map());
      } finally {
        await unlink(alias);
      }
    }
    await writeHostingEvidence(root, output, { generation: 1 });
    await writeHostingEvidence(root, output, { generation: 2 });
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), { generation: 2 });
    assert.deepEqual(await hostingFiles(publicRoot), new Map());
    assert.deepEqual(await hostingFiles(distRoot), new Map());
  } finally {
    await unlink(output).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
    await rmdir(publicRoot);
    await rmdir(distRoot);
    await rmdir(root);
  }
});

function release() {
  const publicFiles = new Map(
    [
      '_headers',
      '404.html',
      'data/index.json',
      'data/2026-Q2.json',
      'data/production/index.json',
      generation,
      'fonts/Inter-OFL-4.1.txt',
      'fonts/InterVariable-4.1.woff2',
      'fonts/JetBrainsMono-OFL-2.304.txt',
      'fonts/JetBrainsMono-Regular-2.304.woff2',
      'fonts/JetBrainsMono-SemiBold-2.304.woff2',
      'fonts/NOTICE.txt',
      'fonts/provenance.json',
    ].map((path) => [path, Buffer.from(path)]),
  );
  const distFiles = new Map(publicFiles);
  distFiles.set(
    'index.html',
    Buffer.from(`<script src="/${script}"></script><link href="/${style}">`),
  );
  for (const path of [script, style, chunk, data]) {
    distFiles.set(path, Buffer.from(path));
  }
  const build = {
    'index.html': { file: script, isEntry: true, css: [style], dynamicImports: ['src/lazy.ts'] },
    'src/lazy.ts': { file: chunk, assets: [data] },
  };
  return { publicFiles, distFiles, build };
}

await test('exact package includes dynamic chunks, bundled JSON and font attribution with SHA256 evidence', () => {
  const { publicFiles, distFiles, build } = release();
  const manifest = auditHostingInventory(publicFiles, distFiles, build);
  assert.equal(manifest.length, distFiles.size);
  assert.equal(manifest.find((asset) => asset.path === '_headers').served, false);
  assert.equal(manifest.find((asset) => asset.path === generation).cacheControl, immutable);
  for (const asset of manifest) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(asset.sizeBytes, distFiles.get(asset.path).length);
  }
});

await test('missing required attribution, extra public files and unmanifested dist files fail closed', () => {
  for (const mutate of [
    ({ publicFiles }) => publicFiles.delete('fonts/NOTICE.txt'),
    ({ distFiles }) => distFiles.delete('fonts/Inter-OFL-4.1.txt'),
    ({ publicFiles }) => publicFiles.set('private/summary.json', Buffer.from('{}')),
    ({ distFiles }) => distFiles.set('.env', Buffer.from('private')),
    ({ distFiles }) => distFiles.set('assets/private-Abcd1234.json', Buffer.from('{}')),
    ({ distFiles }) => distFiles.delete(chunk),
    ({ build }) => build['index.html'].dynamicImports.push('missing'),
    ({ build }) => {
      build['src/lazy.ts'].file = '../private.json';
    },
  ]) {
    const fixture = release();
    mutate(fixture);
    assert.throws(() =>
      auditHostingInventory(fixture.publicFiles, fixture.distFiles, fixture.build),
    );
  }
});

await test('any public JSON, font, license or header byte mutation fails packaging', () => {
  for (const path of [
    generation,
    'fonts/InterVariable-4.1.woff2',
    'fonts/Inter-OFL-4.1.txt',
    '_headers',
  ]) {
    const { publicFiles, distFiles, build } = release();
    distFiles.set(path, Buffer.concat([distFiles.get(path), Buffer.from('\n')]));
    assert.throws(() => auditHostingInventory(publicFiles, distFiles, build), /bytes changed/);
  }
});

await test('reviewed routing and disjoint caching reject SPA fallback, bindings and mutable immutable policy', () => {
  assertHostingPolicy(config, headers);
  for (const mutate of [
    (copy) => {
      copy.assets = { not_found_handling: 'single-page-application' };
    },
    (copy) => {
      copy.pages_build_output_dir = '..';
    },
    (copy) => {
      copy.main = 'worker.js';
    },
    (copy) => {
      copy.vars = { TOKEN: 'example' };
    },
    (copy) => {
      copy.routes = ['example.com/*'];
    },
    (copy) => {
      copy.workers_dev = true;
    },
  ]) {
    const copy = structuredClone(config);
    mutate(copy);
    assert.throws(() => assertHostingPolicy(copy, headers));
  }
  for (const newline of ['\n', '\r\n']) {
    const input = headers.replace(/\r?\n/g, newline);
    assertHostingPolicy(config, input);
    const changed = input.replace(
      `/fonts/provenance.json${newline}  Cache-Control: ${dailyCache}`,
      `/fonts/provenance.json${newline}  Cache-Control: ${immutable}`,
    );
    assert.notEqual(changed, input, 'Cache-policy corruption must actually change the fixture');
    assert.throws(() => assertHostingPolicy(config, changed));
  }
  assert.throws(() =>
    assertHostingPolicy(config, `${headers}\n/data/*.json\n  Cache-Control: ${immutable}\n`),
  );
  for (const path of [
    'index.html',
    'data/index.json',
    'data/production/index.json',
    'fonts/provenance.json',
    'fonts/NOTICE.txt',
  ]) {
    assert.equal(cachePolicy(path), dailyCache);
  }
  assert.equal(cachePolicy(''), dailyCache);
  for (const path of [
    'data/2026-Q2.json',
    'fonts/Inter-OFL-4.1.txt',
    'fonts/JetBrainsMono-OFL-2.304.txt',
    'fonts/InterVariable-4.1.woff2',
    'fonts/JetBrainsMono-Regular-2.304.woff2',
    'fonts/JetBrainsMono-SemiBold-2.304.woff2',
  ]) {
    assert.equal(cachePolicy(path), immutable);
  }
  for (const path of [
    '404.html',
    '404',
    'missing.html',
    'data/missing.json',
    'fonts/InterVariable-4.2.woff2',
    'fonts/unversioned.woff2',
    'assets/index.js',
    'data/production/missing/descriptor.json',
  ]) {
    assert.equal(cachePolicy(path), 'no-cache');
  }
  assert.equal(cachePolicy(generation), immutable);
  assert.equal(cachePolicy(data), immutable);
});

await test('header URL matching selects one policy independent of navigation queries', () => {
  // Read the deployed file independently of the policy inventory. Cloudflare
  // matches pathnames, with :placeholders confined to a segment and * splats.
  const rules = [...headers.matchAll(/^(\/\S*)\r?\n\s+Cache-Control: (.+)$/gm)].map(
    ([, pattern, policy]) => ({
      pattern: new RegExp(
        `^${pattern
          .replaceAll('.', '\\.')
          .replaceAll(/:[A-Za-z]+/g, '[^/]+')
          .replaceAll('*', '.*')}$`,
      ),
      policy: policy.trim(),
    }),
  );
  for (const [path, expected] of [
    ['/', dailyCache],
    ['/index.html', dailyCache],
    ['/data/index.json', dailyCache],
    ['/data/2026-Q2.json', immutable],
    ['/data/production/index.json', dailyCache],
    [`/${generation}`, immutable],
    [`/${script}`, immutable],
    ['/fonts/InterVariable-4.1.woff2', immutable],
    ['/fonts/JetBrainsMono-Regular-2.304.woff2', immutable],
    ['/fonts/JetBrainsMono-SemiBold-2.304.woff2', immutable],
    ['/fonts/provenance.json', dailyCache],
    ['/fonts/NOTICE.txt', dailyCache],
    ['/fonts/Inter-OFL-4.1.txt', immutable],
    ['/fonts/JetBrainsMono-OFL-2.304.txt', immutable],
    ['/404.html', 'no-cache'],
    ['/404', 'no-cache'],
  ]) {
    for (const query of ['', '?view=matrix&reference=1', '?cache-bust=2']) {
      const url = new URL(`${path}${query}`, 'https://example.com');
      assert.deepEqual(
        rules.filter((rule) => rule.pattern.test(url.pathname)).map((rule) => rule.policy),
        [expected],
        `Exactly one cache policy must match ${url.pathname}${url.search}`,
      );
    }
  }
  for (const path of [
    '/fonts/missing.woff2',
    '/fonts/InterVariable-4.2.woff2',
    '/data/missing.json',
  ]) {
    assert.deepEqual(
      rules.filter((rule) => rule.pattern.test(path)),
      [],
    );
  }
});

function responder(distFiles, manifest, defect) {
  return async (url) => {
    if (url.pathname === '/index.html') {
      return new Response(null, {
        status: 307,
        headers: { Location: defect === 'query' ? '/' : `/${url.search}` },
      });
    }
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const asset = manifest.assets.find((entry) => entry.path === path && entry.served);
    if (!asset) {
      return new Response('', {
        status: defect === 'fallback' ? 200 : 404,
        headers: { 'Cache-Control': defect === 'error-cache' ? immutable : 'no-cache' },
      });
    }
    return new Response(defect === 'bytes' ? 'corrupt' : distFiles.get(path), {
      headers: {
        'Cache-Control': defect === 'cache' ? immutable : asset.cacheControl,
        'Content-Type':
          defect === 'mime'
            ? 'application/octet-stream'
            : ({
                js: 'application/javascript',
                css: 'text/css',
                woff2: 'font/woff2',
                html: 'text/html',
                json: 'application/json',
              }[path.split('.').at(-1)] ?? 'text/plain'),
      },
    });
  };
}

await test('local probes verify HTTP bytes/cache, query retention and genuine missing-data 404s', async () => {
  const { publicFiles, distFiles, build } = release();
  const manifest = { assets: auditHostingInventory(publicFiles, distFiles, build) };
  const result = await checkHostingLocal(
    manifest,
    'http://127.0.0.1:8787',
    responder(distFiles, manifest),
  );
  assert.equal(result.missing, 12);
  for (const defect of ['query', 'fallback', 'bytes', 'cache', 'mime', 'error-cache']) {
    await assert.rejects(
      checkHostingLocal(manifest, 'http://127.0.0.1:8787', responder(distFiles, manifest, defect)),
    );
  }
  await assert.rejects(
    checkHostingLocal(manifest, 'https://example.com', () => {
      throw new Error('Must not fetch');
    }),
    /loopback/,
  );
});

await test('local error cache checks reject positive freshness even alongside no-cache/no-store', async () => {
  const { publicFiles, distFiles, build } = release();
  const manifest = { assets: auditHostingInventory(publicFiles, distFiles, build) };
  for (const policy of [
    'no-store',
    'public, max-age="0"',
    'no-cache, s-maxage=0',
    '',
    'no-cache, max-age=86400',
    'no-store, s-maxage=86400',
    'no-cache, immutable',
    'no-cache, max-age=invalid',
  ]) {
    const request = async (url) => {
      const response = await responder(distFiles, manifest)(url);
      if (response.status === 404) {
        response.headers.set('Cache-Control', policy);
      }
      return response;
    };
    const result = checkHostingLocal(manifest, 'http://127.0.0.1:8787', request);
    if (['no-store', 'public, max-age="0"', 'no-cache, s-maxage=0'].includes(policy)) {
      assert.equal((await result).missing, 12);
    } else {
      await assert.rejects(result, /error cache policy/);
    }
  }
});

await test('build manifest retention preserves exact bytes and refuses unexpected sibling output', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'hosting-release-'));
  const directory = join(root, 'dist', '.vite');
  await mkdir(directory, { recursive: true });
  context.after(async () => {
    for (const path of [
      'dist/.vite/manifest.json',
      'dist/.vite/private.json',
      'hosting-vite-manifest.json',
    ]) {
      await unlink(join(root, path)).catch((error) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
    for (const path of [directory, join(root, 'dist'), root]) {
      await rmdir(path).catch((error) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
  });
  const bytes = Buffer.from('{ "index.html": { "file": "assets/index-Abcd1234.js" } }\n');
  await writeFile(join(directory, 'manifest.json'), bytes);
  await writeFile(join(directory, 'private.json'), '{}');
  await assert.rejects(retainHostingManifest(root), /Unexpected Vite output/);
  assert.ok((await readFile(join(directory, 'manifest.json'))).equals(bytes));
  await unlink(join(directory, 'private.json'));
  await retainHostingManifest(root);
  assert.ok((await readFile(join(root, 'hosting-vite-manifest.json'))).equals(bytes));
  await assert.rejects(lstat(directory), { code: 'ENOENT' });
});
