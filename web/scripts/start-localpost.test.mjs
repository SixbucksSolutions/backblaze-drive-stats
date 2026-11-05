import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { attachStopCommand, serviceUrl, startLocalpost } from './start-localpost.mjs';

const id = 'f737b3e8-f66b-4196-ac22-b7ce959e4e87';

test('service URL permits only the configured IPv4 loopback port', () => {
  assert.equal(serviceUrl(), 'http://127.0.0.1:53147');
  assert.equal(serviceUrl('http://127.0.0.1:54000/'), 'http://127.0.0.1:54000');
  for (const value of [
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
          request.method === 'POST' ? { id } : { id, unregistered: true, forced: false },
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
  assert.deepEqual(JSON.parse(f.requests[0].request.body), { directory: session.directory });
  assert.equal(f.requests[0].request.credentials, 'omit');
  assert.equal(f.viteConfig.server.strictPort, true);
  assert.equal(f.viteConfig.plugins.length, 1);
  await Promise.all([session.stop(), session.stop()]);
  assert.equal(f.closed, 1);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].request.method, 'DELETE');
  assert.equal(f.requests[1].url, `http://127.0.0.1:53147/registrations/${id}`);
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
