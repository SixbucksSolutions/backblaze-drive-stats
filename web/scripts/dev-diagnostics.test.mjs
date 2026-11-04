import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  createDiagnosticsCollector,
  devDiagnosticsPlugin,
  validDiagnosticsEvent,
} from './dev-diagnostics.mjs';

function event(runId, overrides = {}) {
  return {
    schemaVersion: 1,
    runId,
    pageId: randomUUID(),
    sequence: 1,
    event: 'ready',
    source: 'init',
    state: {
      view: 'afr',
      mode: 'relative',
      metric: 'cumulative',
      from: null,
      to: 600,
      y: 0.05,
      selectionCount: 2,
      tooltip: false,
      crosshair: false,
      marker: false,
      pointIndex: null,
      violation: false,
    },
    ...overrides,
  };
}
async function fixture(t, options = {}) {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'drive-diagnostics-test-')),
  );
  const collector = await createDiagnosticsCollector({ directory, ...options });
  const server = http.createServer((req, res) => {
    void collector
      .middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      })
      .catch(() => {
        res.writeHead(500);
        res.end();
      });
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => {
    server.once('listening', resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    await collector.close();
    await rm(directory, { recursive: true, force: true });
  });
  const port = server.address().port;
  const headers = {
    Host: '127.0.0.1:5173',
    Origin: 'http://127.0.0.1:5173',
    'Content-Type': 'application/json',
    'X-Drive-Stats-Diagnostics': collector.token,
  };
  const send = (body, options = {}) =>
    new Promise((resolve, reject) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port,
          path: '/__dev-diagnostics',
          method: 'POST',
          ...options,
          headers: { ...headers, ...options.headers },
        },
        (response) => {
          response.resume();
          response.once('end', () => resolve(response.statusCode));
        },
      );
      request.once('error', reject);
      request.end(typeof body === 'string' ? body : JSON.stringify(body));
    });
  const raw = (lines, body = '', finish = true) =>
    new Promise((resolve, reject) => {
      const socket = net.connect({ host: '127.0.0.1', port }, () => {
        socket.write(`${lines.join('\r\n')}\r\n\r\n${body}`);
        if (finish) {
          socket.end();
        }
      });
      let response = '';
      socket.on('data', (chunk) => {
        response += chunk.toString();
      });
      socket.once('error', reject);
      socket.once('close', () => resolve(Number(/^HTTP\/1\.1 (\d+)/.exec(response)?.[1])));
    });
  return {
    ...collector,
    send,
    raw,
    headers,
    lines: async () =>
      (await readFile(collector.filePath, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  };
}

test('schema accepts only bounded, exact, internally consistent structured fields', () => {
  const runId = randomUUID();
  const good = event(runId);
  assert.equal(validDiagnosticsEvent(good, runId), true);
  for (const changes of [
    { password: 'private' },
    { runId: randomUUID() },
    { pageId: 'invalid' },
    { schemaVersion: 2 },
    { sequence: 0 },
    { sequence: 1.5 },
    { event: 'exception content' },
    { source: 'https://private' },
    { state: null },
  ]) {
    assert.equal(validDiagnosticsEvent({ ...good, ...changes }, runId), false);
  }
  for (const changes of [
    { token: 'private' },
    { from: -1 },
    { to: 20001 },
    { y: Infinity },
    { y: -1 },
    { selectionCount: 257 },
    { pointIndex: 1.2 },
    { tooltip: 'false' },
    { marker: true },
    { violation: true },
    { mode: 'private' },
    { metric: 'private' },
    { view: 'private' },
  ]) {
    assert.equal(
      validDiagnosticsEvent({ ...good, state: { ...good.state, ...changes } }, runId),
      false,
    );
  }
});

test('HTTP authorization, methods, malformed JSON and extra fields never write', async (t) => {
  const f = await fixture(t);
  const good = event(f.runId);
  for (const options of [
    { method: 'GET' },
    { headers: { Host: 'localhost:5173' } },
    { headers: { Origin: 'http://127.0.0.1:5174' } },
    { headers: { Origin: '' } },
    { headers: { 'X-Drive-Stats-Diagnostics': 'incorrect' } },
    { headers: { 'Content-Type': 'text/plain' } },
    { headers: { 'Content-Encoding': 'gzip' } },
  ]) {
    assert.ok((await f.send(good, options)) >= 400);
  }
  assert.equal(await f.send('{'), 400);
  assert.equal(await f.send(good, { path: '/__dev-diagnostics?anything=1' }), 400);
  const serialized = JSON.stringify(good);
  assert.equal(
    await f.send(serialized.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')),
    400,
  );
  assert.equal(
    await f.send(serialized.replace('"tooltip":false', '"tooltip":false,"tool\\u0074ip":false')),
    400,
  );
  assert.equal(await f.send({ ...good, secret: 'never retained' }), 400);
  assert.equal(await f.send({ ...good, runId: randomUUID() }), 400);
  assert.deepEqual(await f.lines(), []);
  assert.equal(await f.send(good), 200);
  const [record] = await f.lines();
  assert.equal(record.pageId, good.pageId);
  assert.equal(record.lostBefore, 0);
  assert.match(record.utc, /^\d{4}-\d\d-\d\dT/);
  assert.equal(Object.hasOwn(record, 'token'), false);
});

test('duplicate sensitive headers, oversize and slow bodies reject through real sockets', async (t) => {
  const f = await fixture(t, { bodyTimeoutMs: 30 });
  const base = [
    'POST /__dev-diagnostics HTTP/1.1',
    ...Object.entries(f.headers).map(([key, value]) => `${key}: ${value}`),
    'Connection: close',
  ];
  for (const key of ['Host', 'Origin', 'Content-Type', 'X-Drive-Stats-Diagnostics']) {
    const status = await f.raw([...base, `${key}: ${f.headers[key]}`, 'Content-Length: 2'], '{}');
    assert.ok(status >= 400, key);
  }
  assert.equal(await f.send('x'.repeat(4097)), 413);
  assert.equal(
    await f.raw(
      [...base, 'Transfer-Encoding: chunked'],
      `1001\r\n${'x'.repeat(4097)}\r\n0\r\n\r\n`,
      false,
    ),
    413,
  );
  assert.equal(await f.raw([...base, 'Content-Length: 100'], '{', false), 408);
  assert.deepEqual(await f.lines(), []);
});

test('private paths reject literal, traversal, Windows and encoded filesystem routes', async (t) => {
  const f = await fixture(t);
  for (const pathname of [
    '/data/diagnostics/file.jsonl',
    '/@fs/D:/Projects/Backblaze%20Drive%20Stats/data/diagnostics/file.jsonl',
    '/@fs/D%3A%5CProjects%5Cdata%5Cdiagnostics%5Cfile.jsonl',
    '/@fs/%252fdata%252fdiagnostics%252ffile.jsonl',
    '/x/../data/diagnostics/file.jsonl',
    '/x/%2e%2e/private',
    '/%zz',
  ]) {
    assert.equal(await f.send('', { path: pathname, method: 'GET' }), 403, pathname);
  }
  assert.equal(await f.send('', { path: '/ordinary-page', method: 'GET' }), 404);
});

test('serialized appends enforce sequence, finish, page count and concurrent record caps', async (t) => {
  const f = await fixture(t, { maxRecords: 35 });
  const first = event(f.runId);
  assert.equal(await f.send(first), 200);
  assert.equal(await f.send(first), 409);
  assert.equal(await f.send({ ...first, event: 'state', sequence: 3 }), 200);
  assert.equal(await f.send({ ...first, event: 'state', sequence: 2 }), 409);
  assert.equal(await f.send({ ...first, event: 'end', sequence: 4 }), 200);
  assert.equal(await f.send({ ...first, event: 'state', sequence: 5 }), 409);
  assert.equal((await f.lines())[1].lostBefore, 1);
  assert.equal(await f.send(event(f.runId, { event: 'state', sequence: 2 })), 409);
  const initial = await Promise.all(Array.from({ length: 31 }, () => f.send(event(f.runId))));
  assert.ok(initial.every((status) => status === 200));
  assert.equal(await f.send(event(f.runId)), 409);
  const current = (await f.lines())[3];
  const competing = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      f.send({ ...event(f.runId), pageId: current.pageId, event: 'state', sequence: index + 2 }),
    ),
  );
  assert.equal(competing.filter((status) => status === 200).length, 1);
  assert.equal((await f.lines()).length, 35);
});

test('byte cap rejects without partial or additional writes', async (t) => {
  const f = await fixture(t, { maxBytes: 1 });
  assert.equal(await f.send(event(f.runId)), 507);
  assert.deepEqual(await f.lines(), []);
});

test('private directory and ancestor junctions cannot redirect the log', async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'drive-diagnostics-path-')));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const target = path.join(root, 'target');
  const link = path.join(root, 'link');
  await mkdir(target);
  await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createDiagnosticsCollector({ directory: link }), /must not be redirected/);
  await assert.rejects(
    createDiagnosticsCollector({ directory: path.join(link, 'nested') }),
    /must not be redirected/,
  );
});

test('close flushes and is idempotent; closed collector rejects further writes', async (t) => {
  const f = await fixture(t);
  assert.equal(await f.send(event(f.runId)), 200);
  await Promise.all([f.close(), f.close()]);
  assert.equal((await f.lines()).length, 1);
  assert.equal(await f.send(event(f.runId)), 503);
});

test('plugin opt-in, production exclusion, exact binding and default file denies', () => {
  const previous = process.env.DRIVE_STATS_DIAGNOSTICS;
  try {
    delete process.env.DRIVE_STATS_DIAGNOSTICS;
    assert.equal(devDiagnosticsPlugin().apply({}, { command: 'serve' }), false);
    process.env.DRIVE_STATS_DIAGNOSTICS = '1';
    assert.equal(devDiagnosticsPlugin().apply({}, { command: 'build' }), false);
    assert.equal(devDiagnosticsPlugin().apply({}, { command: 'serve', isPreview: true }), false);
    const plugin = devDiagnosticsPlugin();
    assert.equal(plugin.apply({}, { command: 'serve' }), true);
    const config = plugin.config({ server: { fs: { deny: ['private-custom'] } } });
    assert.equal(config.server.host, '127.0.0.1');
    assert.equal(config.server.port, 5173);
    assert.equal(config.server.strictPort, true);
    for (const pattern of [
      '.env',
      '.env.*',
      '**/.git/**',
      '*.{crt,pem,key,p12,pfx,cer,der}',
      'private-custom',
      '**/data/diagnostics/**',
    ]) {
      assert.ok(config.server.fs.deny.includes(pattern));
    }
    for (const server of [
      { host: '0.0.0.0' },
      { port: 5174 },
      { strictPort: false },
      { https: {} },
      { middlewareMode: true },
    ]) {
      assert.throws(() => plugin.config({ server }), /dedicated loopback/);
    }
    assert.throws(
      () => plugin.configResolved({ server: { host: true, port: 5173, strictPort: true } }),
      /dedicated loopback/,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.DRIVE_STATS_DIAGNOSTICS;
    } else {
      process.env.DRIVE_STATS_DIAGNOSTICS = previous;
    }
  }
});
