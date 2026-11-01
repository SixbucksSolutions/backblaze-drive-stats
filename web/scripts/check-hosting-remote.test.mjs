import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkHostingRemote,
  runHostingRemoteCli,
  validateRemoteOrigin,
} from './check-hosting-remote.mjs';

const origin = 'https://backblaze-drive-stats-analysis.pages.dev';
const bodies = new Map([
  ['index.html', '<html>release</html>'],
  ['404.html', '<html>missing</html>'],
  ['_headers', '/\nCache-Control: no-cache'],
  ['data/index.json', '{"latest":"2026-Q2"}'],
  ['data/production/generation/matrix.json', '{"data":[1,2]}'],
  ['assets/app-abcdefgh.js', 'export const release = 1;'],
  ['assets/app-abcdefgh.css', 'html{color:black}'],
  ['fonts/font.woff2', 'binary-font-fixture'],
  ['fonts/NOTICE.txt', 'attribution'],
]);
const manifest = {
  assets: [...bodies].map(([path, body]) => ({
    path,
    sizeBytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
    cacheControl: path === '_headers' ? null : 'no-cache',
    served: path !== '_headers',
  })),
};
const types = {
  html: 'text/html; charset=utf-8',
  json: 'application/json',
  js: 'text/javascript',
  css: 'text/css',
  woff2: 'font/woff2',
  txt: 'text/plain',
};

function fixture(change = () => {}) {
  const calls = [];
  let active = 0;
  let peak = 0;
  const request = async (url, options) => {
    assert.equal(url.origin, origin);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(options.headers ?? {}), options.headers ? ['Accept'] : []);
    calls.push({ path: `${url.pathname}${url.search}`, accept: options.headers?.Accept });
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    active -= 1;
    const path = url.pathname.slice(1);
    const state = { status: 200, body: '', headers: { 'cache-control': 'no-cache' } };
    if (path === 'index.html' || path === '404.html') {
      state.status = 308;
      state.headers.location = `${path === 'index.html' ? '/' : '/404'}${url.search}`;
    } else {
      const asset = path === '' ? 'index.html' : path === '404' ? '404.html' : path;
      const found = bodies.has(asset) && asset !== '_headers';
      state.status = found ? 200 : 404;
      const bodyPath = found ? asset : '404.html';
      state.body = bodies.get(bodyPath);
      state.headers['content-type'] = types[bodyPath.split('.').at(-1)];
    }
    change(url, state, options);
    return new Response(state.body, state);
  };
  return { request, calls, peak: () => peak };
}

async function qualifiedFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'remote-qualified-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'qualified.json');
  const qualified = {
    formatVersion: 1,
    assets: structuredClone(manifest.assets).filter(
      (asset) =>
        !['data/production/generation/matrix.json', 'fonts/font.woff2'].includes(asset.path),
    ),
  };
  async function save(value = qualified) {
    const bytes = Buffer.from(JSON.stringify(value));
    await writeFile(path, bytes);
    return [
      origin,
      '--manifest',
      path,
      '--manifest-sha256',
      createHash('sha256').update(bytes).digest('hex'),
    ];
  }
  return { root, path, qualified, save };
}

test('explicit pinned qualified CLI inventory probes retained union assets without deriving pristine dist', async (t) => {
  const files = await qualifiedFixture(t);
  const retained = 'assets/previous-abcdefgh.js';
  const body = 'export const retained = 1;';
  files.qualified.assets.push({
    path: retained,
    sizeBytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
    served: true,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  // Exact packageCacheCompatibleRelease output shape, including its retention
  // ledger. The pin covers this entire union, rather than the pristine inputs.
  files.qualified.retention = {
    formatVersion: 1,
    currentManifestSha256: '1'.repeat(64),
    previousManifestSha256: '2'.repeat(64),
    retainedAssets: [structuredClone(files.qualified.assets.at(-1))],
  };
  const mock = fixture((url, state) => {
    if (url.pathname === `/${retained}`) {
      state.status = 200;
      state.body = body;
      state.headers['content-type'] = 'text/javascript';
      state.headers['cache-control'] = 'public, max-age=31536000, immutable';
    }
  });
  const result = await runHostingRemoteCli(await files.save(), {
    root: files.root,
    request: mock.request,
    releaseCheck: () => assert.fail('Explicit union must not derive pristine dist'),
  });
  assert.equal(result.assets, files.qualified.assets.length - 1);
  assert.ok(mock.calls.some((call) => call.path === `/${retained}`));
  assert.equal(result.missing, 18);
});

test('qualified union rejects forged, duplicate, unknown or malformed retention metadata before GET', async (t) => {
  const files = await qualifiedFixture(t);
  const noRequest = () => assert.fail('Network must not be reached');
  const immutableAsset = files.qualified.assets.find((asset) => asset.path.startsWith('assets/'));
  immutableAsset.cacheControl = 'public, max-age=31536000, immutable';
  const base = {
    formatVersion: 1,
    currentManifestSha256: '1'.repeat(64),
    previousManifestSha256: '2'.repeat(64),
    retainedAssets: [],
  };
  for (const mutate of [
    () => null,
    (value) => ({ ...value, unexpected: true }),
    (value) => ({ ...value, formatVersion: 2 }),
    (value) => ({ ...value, currentManifestSha256: 'invalid' }),
    (value) => ({ ...value, previousManifestSha256: null }),
    (value) => ({ ...value, retainedAssets: 'not-an-array' }),
    (value) => ({
      ...value,
      retainedAssets: [{ ...files.qualified.assets[0], sha256: '3'.repeat(64) }],
    }),
    (value) => ({ ...value, retainedAssets: [{ ...files.qualified.assets[0], unreviewed: true }] }),
    (value) => ({ ...value, retainedAssets: [immutableAsset, immutableAsset] }),
    (value) => ({ ...value, retainedAssets: [files.qualified.assets[0]] }),
  ]) {
    const altered = {
      ...structuredClone(files.qualified),
      retention: mutate(structuredClone(base)),
    };
    await assert.rejects(
      runHostingRemoteCli(await files.save(altered), { root: files.root, request: noRequest }),
    );
  }
});

test('origin-only CLI retains pristine release audit', async () => {
  const mock = fixture();
  let checked = false;
  const result = await runHostingRemoteCli([origin], {
    request: mock.request,
    releaseCheck: async () => {
      checked = true;
      return manifest;
    },
  });
  assert.ok(checked);
  assert.equal(result.assets, manifest.assets.length - 1);
});

test('qualified manifest pin, shape, bounds and private paths fail before any GET', async (t) => {
  const files = await qualifiedFixture(t);
  const noRequest = () => assert.fail('Network must not be reached');
  const args = await files.save();
  await assert.rejects(
    runHostingRemoteCli([...args.slice(0, 4), '0'.repeat(64)], {
      root: files.root,
      request: noRequest,
    }),
    /SHA-256 differs/,
  );
  for (const mutate of [
    (value) => {
      value.unreviewed = true;
    },
    (value) => {
      value.formatVersion = 2;
    },
    (value) => {
      value.assets[0].credential = 'forbidden';
    },
    (value) => {
      value.assets[0].path = '../private/token';
    },
    (value) => {
      value.assets[0].path = 'private/summary.json';
    },
    (value) => {
      value.assets[0].sizeBytes = 25 * 1024 * 1024 + 1;
    },
    (value) => {
      value.assets[0].served = false;
    },
    (value) => {
      value.assets.push({
        ...value.assets.find((asset) => asset.path.startsWith('assets/')),
        path: 'assets/App-abcdefgh.js',
      });
    },
  ]) {
    const altered = structuredClone(files.qualified);
    mutate(altered);
    await assert.rejects(
      runHostingRemoteCli(await files.save(altered), { root: files.root, request: noRequest }),
    );
  }
  for (const malformed of [
    [origin, '--manifest', files.path],
    [origin, '--manifest-sha256', args[4]],
    [origin, '--manifest', files.path, '--unknown', args[4]],
    [origin, '--manifest', files.path, '--manifest', files.path],
  ]) {
    await assert.rejects(
      runHostingRemoteCli(malformed, { root: files.root, request: noRequest }),
      /Usage/,
    );
  }
  await mkdir(join(files.root, 'public'));
  const servedPath = join(files.root, 'public', 'qualified.json');
  const validArgs = await files.save();
  await writeFile(servedPath, JSON.stringify(files.qualified));
  await assert.rejects(
    runHostingRemoteCli([origin, '--manifest-sha256', validArgs[4], '--manifest', servedPath], {
      root: files.root,
      request: noRequest,
    }),
    /outside served/,
  );
});

test('only the exact approved HTTPS project and one valid deployment label are accepted', () => {
  for (const url of [
    origin,
    `${origin}/`,
    `${origin}:443/`,
    origin.replace('https://', 'https://ab12-branch.'),
  ]) {
    assert.equal(validateRemoteOrigin(url).protocol, 'https:');
  }
  for (const url of [
    origin.replace('https:', 'http:'),
    `${origin}:8443`,
    `${origin}/data`,
    `${origin}/data/..`,
    `${origin}?x=1`,
    `${origin}#x`,
    `${origin}?`,
    `${origin}\n`,
    origin.replace('https://', 'https://user@'),
    origin.replace('https://', 'https://a.b.'),
    origin.replace('https://', 'https://-bad.'),
    `${origin}.evil.test`,
    'https://example.pages.dev',
    'file:///private/token',
    'data:text/html,hello',
  ]) {
    assert.throws(() => validateRemoteOrigin(url));
  }
});

test('checks every served inventory entry, navigation, redirects and genuine missing responses', async () => {
  const mock = fixture();
  const result = await checkHostingRemote(manifest, origin, mock.request);
  assert.deepEqual(result, {
    assets: manifest.assets.length - 1,
    assetBytes: manifest.assets
      .filter((asset) => asset.served)
      .reduce((sum, asset) => sum + asset.sizeBytes, 0),
    navigation: 4,
    missing: 18,
    redirects: 9,
  });
  assert.ok(mock.peak() <= 4 && mock.peak() > 1);
  for (const asset of manifest.assets.filter((asset) => asset.served)) {
    const servedPath = asset.path === 'index.html' ? '/' : `/${asset.path}`;
    assert.ok(mock.calls.some((call) => call.path === servedPath));
  }
  assert.equal(mock.calls.filter((call) => call.path === '/_headers').length, 2);
  assert.ok(mock.calls.filter((call) => call.path === '/_headers').every((call) => call.accept));
});

test('foreign origins and unsafe inventory paths fail before any request', async () => {
  const noRequest = () => assert.fail('Network must not be reached');
  await assert.rejects(checkHostingRemote(manifest, 'https://foreign.pages.dev', noRequest));
  const unsafe = structuredClone(manifest);
  unsafe.assets[0].path = '../private/token';
  await assert.rejects(checkHostingRemote(unsafe, origin, noRequest), /inventory entry/);
});

test('sums every verified byte when four response bodies complete concurrently', async () => {
  const mock = fixture();
  const waiting = [];
  let delayed = 0;
  const request = async (url, options) => {
    const response = await mock.request(url, options);
    if (response.status !== 200 || delayed >= 4) {
      return response;
    }
    delayed += 1;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const stream = new ReadableStream(
      {
        pull(controller) {
          waiting.push(() => {
            controller.enqueue(bytes);
            controller.close();
          });
          if (waiting.length === 4) {
            for (const release of waiting) {
              release();
            }
          }
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(stream, { status: response.status, headers: response.headers });
  };
  const result = await checkHostingRemote(manifest, origin, request);
  const expectedBytes = manifest.assets
    .filter((asset) => asset.served)
    .reduce((sum, asset) => sum + asset.sizeBytes, 0);
  assert.equal(delayed, 4);
  assert.equal(result.assetBytes, expectedBytes);
  assert.equal(result.assets, manifest.assets.length - 1);
  assert.ok(mock.peak() <= 4);
});

for (const [name, change, expected] of [
  [
    'hash',
    (state) => {
      state.body = '{"latest":"2026-Q3"}';
    },
    /hash differs/,
  ],
  [
    'size',
    (state) => {
      state.body += 'x';
    },
    /exceeds reviewed byte size/,
  ],
  [
    'cache',
    (state) => {
      state.headers['cache-control'] = 'public, max-age=999';
    },
    /cache policy/,
  ],
  [
    'MIME',
    (state) => {
      state.headers['content-type'] = 'text/html';
    },
    /media type/,
  ],
  [
    'asset redirect',
    (state) => {
      state.status = 302;
      state.headers.location = 'https://evil.test/';
    },
    /did not return 200/,
  ],
]) {
  test(`rejects incorrect asset ${name}`, async () => {
    const mock = fixture((url, state) => {
      if (url.pathname === '/data/index.json') {
        change(state);
      }
    });
    await assert.rejects(checkHostingRemote(manifest, origin, mock.request), expected);
    assert.ok(!mock.calls.some((call) => call.path === '/private/summary.json'));
  });
}

for (const location of [
  'https://evil.test/?view=matrix&reference=1',
  '/',
  '/?view=matrix&reference=1#lost',
  'https://user@backblaze-drive-stats-analysis.pages.dev/?view=matrix&reference=1',
]) {
  test(`rejects changed canonical redirect ${location.includes('evil') ? 'origin' : 'navigation'}`, async () => {
    const mock = fixture((url, state) => {
      if (url.pathname === '/index.html') {
        state.headers.location = location;
      }
    });
    await assert.rejects(checkHostingRemote(manifest, origin, mock.request), /Canonical redirect/);
  });
}

test('rejects root-query HTML that differs from the reviewed release', async () => {
  const mock = fixture((url, state) => {
    if (url.pathname === '/' && url.search) {
      state.body = '<html>changed</html>';
    }
  });
  await assert.rejects(checkHostingRemote(manifest, origin, mock.request), /hash differs/);
});

test('rejects a custom-404 canonical redirect that loses its query', async () => {
  const mock = fixture((url, state) => {
    if (url.pathname === '/404.html' && url.search) {
      state.headers.location = '/404';
    }
  });
  await assert.rejects(checkHostingRemote(manifest, origin, mock.request), /changed navigation/);
});

test('cancels an oversized streamed response before reading its remaining chunks', async () => {
  let cancelled = false;
  let chunks = 0;
  const mock = fixture();
  const request = async (url, options) => {
    if (url.pathname !== '/data/index.json') {
      return mock.request(url, options);
    }
    const stream = new ReadableStream({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new Uint8Array(1000));
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: { 'cache-control': 'no-cache', 'content-type': 'application/json' },
    });
  };
  await assert.rejects(checkHostingRemote(manifest, origin, request), /exceeds reviewed byte size/);
  assert.ok(cancelled);
  assert.ok(chunks <= 2);
});

test('rejects HTML fallback with status 200 for either missing Accept type', async () => {
  for (const accept of ['text/html', 'application/json']) {
    const mock = fixture((url, state, options) => {
      if (url.pathname === '/data/missing.json' && options.headers?.Accept === accept) {
        state.status = 200;
        state.body = bodies.get('index.html');
      }
    });
    await assert.rejects(checkHostingRemote(manifest, origin, mock.request), /genuine 404/);
  }
});

test('rejects exposed hosting configuration and changed custom 404 bytes', async () => {
  for (const expose of [true, false]) {
    const mock = fixture((url, state) => {
      if (url.pathname === '/_headers') {
        if (expose) {
          state.status = 200;
        } else {
          state.body = '<html>altered</html>';
        }
      }
    });
    await assert.rejects(checkHostingRemote(manifest, origin, mock.request));
  }
});

test('accepts safe error cache policies independently of the canonical 404 asset policy', async () => {
  for (const policy of [
    'no-store',
    'no-cache',
    'max-age=0',
    'public, max-age="0"',
    'no-cache, s-maxage=0',
  ]) {
    const mock = fixture((_url, state) => {
      if (state.status === 404) {
        state.headers['cache-control'] = policy;
      }
    });
    assert.equal((await checkHostingRemote(manifest, origin, mock.request)).missing, 18);
  }
});

test('rejects missing or unsafe error cache policies including year-long freshness', async () => {
  for (const policy of [
    '',
    'public, max-age=31536000, immutable',
    'no-cache, max-age=60',
    'no-store, s-maxage=60',
    'no-cache, immutable',
    'no-cache, max-age=invalid',
  ]) {
    const mock = fixture((_url, state) => {
      if (state.status === 404) {
        state.headers['cache-control'] = policy;
      }
    });
    await assert.rejects(checkHostingRemote(manifest, origin, mock.request), /error cache policy/);
  }
});

test('retains exact cache policy checks for a successful canonical 404 asset', async () => {
  const mock = fixture((url, state) => {
    if (url.pathname === '/404') {
      state.headers['cache-control'] = 'no-store';
    }
  });
  await assert.rejects(
    checkHostingRemote(manifest, origin, mock.request),
    /Hosted cache policy differs/,
  );
});
