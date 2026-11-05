import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readdir, realpath, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { attachStopCommand, boundedJson, serviceUrl, startLocalpost } from './start-localpost.mjs';

const base = 'http://127.0.0.1:53147/api/2026-11-05';
const id = 'f737b3e8-f66b-4196-ac22-b7ce959e4e87';

test('service URL permits only the configured IPv4 loopback port', () => {
  assert.equal(serviceUrl(), base);
  assert.equal(
    serviceUrl('http://127.0.0.1:54000/api/2026-11-05/'),
    'http://127.0.0.1:54000/api/2026-11-05',
  );
  for (const value of [
    'http://127.0.0.1:53147',
    'http://127.0.0.1:53147/api/2026-11-04',
    'https://127.0.0.1:53147',
    'http://localhost:53147',
    'http://user@127.0.0.1:53147',
    'http://127.0.0.1:53147/x',
    'http://127.0.0.1:53147/?x=y',
    'http://127.0.0.1:80',
    'http://127.1:53147',
    'http://127.0.0.1:53147/a/..',
  ]) {
    assert.throws(() => serviceUrl(value));
  }
});

async function fixture(t, { listenFails = false, registrationFails = false } = {}) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'localpost-launcher-')));
  const root = join(directory, 'web');
  await mkdir(root);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inbox = join(directory, id);
  await mkdir(inbox);
  const requests = [];
  let closed = 0;
  let viteConfig;
  const options = {
    root,
    environment: {},
    log: () => {},
    fetcher: async (url, request) => {
      requests.push({ url, request });
      if (registrationFails) {
        throw new Error('private transport details');
      }
      return new Response(
        JSON.stringify(
          request.method === 'POST'
            ? { id, directory: inbox }
            : { id, unregistered: true, forced: false },
        ),
        { status: 200 },
      );
    },
    createVite: async (config) => {
      viteConfig = config;
      return {
        listen: async () => {
          if (listenFails) {
            throw new Error('occupied');
          }
        },
        close: async () => {
          closed += 1;
        },
        printUrls: () => {},
      };
    },
  };
  return {
    options,
    directory,
    inbox,
    requests,
    get closed() {
      return closed;
    },
    get viteConfig() {
      return viteConfig;
    },
  };
}

test('launcher registers once, owns only Vite and its registration, preserves inbox on idempotent stop', async (t) => {
  const f = await fixture(t);
  const session = await startLocalpost(f.options);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, `${base}/registrations`);
  assert.equal(f.requests[0].request.body, '{}');
  assert.equal(f.requests[0].request.headers['Content-Type'], 'application/json');
  assert.equal(session.directory, f.inbox);
  assert.deepEqual((await readdir(f.directory)).sort(), [id, 'web'].sort());
  assert.equal(f.requests[0].request.credentials, 'omit');
  assert.equal(f.viteConfig.server.strictPort, true);
  assert.equal(f.viteConfig.plugins.length, 1);
  await Promise.all([session.stop(), session.stop()]);
  assert.equal(f.closed, 1);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].request.method, 'DELETE');
  assert.equal(f.requests[1].url, `${base}/registrations/${id}`);
  assert.deepEqual(await readdir(session.directory), []);
});

test('startup failure releases the owned registration and Vite', async (t) => {
  const f = await fixture(t, { listenFails: true });
  await assert.rejects(startLocalpost(f.options), /occupied/);
  assert.equal(f.closed, 1);
  assert.equal(f.requests.at(-1).request.method, 'DELETE');
});

test('uncertain registration is never retried and does not expose transport details', async (t) => {
  const f = await fixture(t, { registrationFails: true });
  await assert.rejects(
    startLocalpost(f.options),
    (error) => error.message.includes('uncertain') && !error.message.includes('private transport'),
  );
  assert.equal(f.requests.length, 1);
  assert.equal(f.closed, 0);
});

test('stop requested during registration cleans up without starting Vite', async (t) => {
  const f = await fixture(t);
  await startLocalpost({ ...f.options, shouldStop: () => true });
  assert.equal(f.viteConfig, undefined);
  assert.equal(f.requests.length, 2);
});

test('forced or invalid cleanup receipts report incomplete cleanup', async (t) => {
  const f = await fixture(t);
  const fetcher = f.options.fetcher;
  f.options.fetcher = (url, options) =>
    options.method === 'DELETE'
      ? Promise.resolve(
          new Response(JSON.stringify({ id, unregistered: true, forced: true }), { status: 200 }),
        )
      : fetcher(url, options);
  const session = await startLocalpost(f.options);
  await assert.rejects(session.stop(), /cleanup incomplete/);
});

test('bounded stdin stop command handles split lines and calls session cleanup once', async (t) => {
  const f = await fixture(t);
  const session = await startLocalpost(f.options);
  const input = new EventEmitter();
  let paused = 0;
  input.pause = () => {
    paused += 1;
  };
  let cleanup;
  const detach = attachStopCommand(input, () => {
    cleanup = session.stop();
  });
  input.emit('data', Buffer.from('unknown\nstop now\n'));
  input.emit('data', Buffer.from(`${'x'.repeat(65)}stop\n`));
  assert.equal(f.closed, 0);
  input.emit('data', Buffer.from('st'));
  input.emit('data', Buffer.from('op\r\nstop\n'));
  await cleanup;
  assert.equal(f.closed, 1);
  assert.equal(f.requests.length, 2);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(paused, 1);
  detach();
  assert.equal(paused, 1);
});

test('stdin command can detach without performing cleanup', () => {
  const input = new EventEmitter();
  input.pause = () => {};
  let stopped = false;
  const detach = attachStopCommand(input, () => {
    stopped = true;
  });
  input.emit('data', 'stop');
  assert.equal(stopped, false);
  detach();
  input.emit('data', '\n');
  assert.equal(stopped, false);
  assert.equal(input.listenerCount('data'), 0);
});

test('launcher rejects invalid service mailboxes and cleans up its known registration', async (t) => {
  const f = await fixture(t);
  const file = join(f.directory, 'file', id);
  await mkdir(join(f.directory, 'file'));
  await writeFile(file, '');
  const inside = join(f.options.root, id);
  await mkdir(inside);
  const linked = join(f.directory, 'linked');
  await symlink(f.directory, linked, process.platform === 'win32' ? 'junction' : 'dir');
  const cases = [
    { id, directory: id },
    { id, directory: join(f.directory, 'missing', id) },
    { id, directory: f.directory },
    { id, directory: file },
    { id, directory: inside },
    { id, directory: join(linked, id) },
    { id, directory: f.inbox, extra: true },
    { id },
  ];
  const fetcher = f.options.fetcher;
  for (const registration of cases) {
    let deleted = false;
    await assert.rejects(
      startLocalpost({
        ...f.options,
        fetcher: (url, request) => {
          if (request.method === 'POST') {
            return Promise.resolve(new Response(JSON.stringify(registration)));
          }
          deleted = true;
          assert.equal(url, `${base}/registrations/${id}`);
          return fetcher(url, request);
        },
      }),
    );
    assert.equal(deleted, true);
    assert.equal(f.viteConfig, undefined);
  }
});

test('uppercase registration IDs are rejected without starting Vite', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    startLocalpost({
      ...f.options,
      fetcher: async () =>
        new Response(JSON.stringify({ id: id.toUpperCase(), directory: f.inbox })),
    }),
    /Invalid localpost registration/,
  );
  assert.equal(f.viteConfig, undefined);
});

test('configured service port preserves the dated prefix for browser delivery and cleanup', async (t) => {
  const f = await fixture(t);
  const customBase = 'http://127.0.0.1:54000/api/2026-11-05';
  const session = await startLocalpost({
    ...f.options,
    environment: { LOCALPOST_URL: customBase },
  });
  assert.equal(f.requests[0].url, `${customBase}/registrations`);
  const plugin = f.viteConfig.plugins[0];
  plugin.apply({}, { command: 'serve', isPreview: false });
  plugin.config();
  const tags = await plugin.transformIndexHtml();
  assert.ok(tags[0].children.includes(`${customBase}/registrations/${id}/messages`));
  await session.stop();
  assert.equal(f.requests[1].url, `${customBase}/registrations/${id}`);
});

test('retired registration is reported inactive without silently registering again', async (t) => {
  const f = await fixture(t);
  const fetcher = f.options.fetcher;
  let registrationRequests = 0;
  let cleanupRequests = 0;
  const logs = [];
  const session = await startLocalpost({
    ...f.options,
    log: (message) => logs.push(message),
    fetcher: (url, request) => {
      if (request.method === 'POST') {
        registrationRequests += 1;
        return fetcher(url, request);
      }
      cleanupRequests += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: { code: 'registration_not_found', message: 'registration not found' },
          }),
          { status: 404 },
        ),
      );
    },
  });
  await session.stop();
  assert.match(logs.at(-1), /already inactive; no cleanup receipt/);
  assert.equal(registrationRequests, 1);
  assert.equal(cleanupRequests, 1);
  assert.equal(f.closed, 1);
});

test('unrelated or malformed not-found cleanup responses still fail', async (t) => {
  const f = await fixture(t);
  const fetcher = f.options.fetcher;
  for (const receipt of [
    { error: { code: 'unsupported_api_version', message: 'unsupported' } },
    { error: { code: 'registration_not_found' } },
    { error: { code: 'registration_not_found', message: 'missing' }, extra: true },
  ]) {
    const session = await startLocalpost({
      ...f.options,
      fetcher: (url, request) =>
        request.method === 'DELETE'
          ? Promise.resolve(new Response(JSON.stringify(receipt), { status: 404 }))
          : fetcher(url, request),
    });
    await assert.rejects(session.stop(), /cleanup incomplete/);
  }
});

test('registration accepts an escaped canonical mailbox response longer than 1 KiB', async (t) => {
  const f = await fixture(t);
  const directory = join(f.directory, 'a'.repeat(50), 'b'.repeat(50), id);
  await mkdir(directory, { recursive: true });
  const canonicalDirectory = await realpath(directory);
  const escapedDirectory = Array.from(
    canonicalDirectory,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  ).join('');
  const body = `{"id":"${id}","directory":"${escapedDirectory}"}`;
  assert.ok(Buffer.byteLength(body) > 1024);
  const fetcher = f.options.fetcher;
  const session = await startLocalpost({
    ...f.options,
    fetcher: (url, request) =>
      request.method === 'POST' ? Promise.resolve(new Response(body)) : fetcher(url, request),
  });
  assert.equal(session.directory, canonicalDirectory);
  await session.stop();
});

test('control JSON accepts the 128 KiB boundary in one chunk or across chunks', async () => {
  const body = new TextEncoder().encode(`{"value":1}${' '.repeat(128 * 1024 - 11)}`);
  assert.equal(body.byteLength, 128 * 1024);
  for (const chunks of [[body], [body.subarray(0, 65536), body.subarray(65536)]]) {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    assert.deepEqual(await boundedJson(new Response(stream)), { value: 1 });
  }
});

test('control JSON cancels an oversized stream before reading subsequent chunks', async () => {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(reads === 1 ? 128 * 1024 : 1));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await assert.rejects(boundedJson(new Response(stream)), /Invalid localpost response/);
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
});

test('known allocation is logged before mailbox access without echoing an invalid directory', async (t) => {
  const f = await fixture(t);
  const fetcher = f.options.fetcher;
  const logs = [];
  const invalidDirectory = 'private invalid response value';
  await assert.rejects(
    startLocalpost({
      ...f.options,
      log: (message) => logs.push(message),
      fetcher: (url, request) =>
        request.method === 'POST'
          ? Promise.resolve(new Response(JSON.stringify({ id, directory: invalidDirectory })))
          : fetcher(url, request),
    }),
    /Invalid localpost mailbox directory/,
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^localpost allocation run: [0-9a-f-]{36}\n/);
  assert.ok(logs[0].includes(`Registration: ${id}\nChecking mailbox access`));
  assert.equal(logs[0].includes(invalidDirectory), false);
  assert.equal(f.requests.at(-1).request.method, 'DELETE');
});
