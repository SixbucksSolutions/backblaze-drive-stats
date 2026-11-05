import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { attachStopCommand, queueFailureReport, startQueue } from './start-queue.mjs';

const id = 'f737b3e8-f66b-4196-ac22-b7ce959e4e87';
const base = 'http://127.0.0.1:53147';
function fixture({ listenFails = false, registrationFails = false, deleted = true } = {}) {
  const requests = [];
  let closed = 0;
  let viteConfig;
  const options = {
    environment: {},
    log: () => {},
    command: async (url, args) => {
      requests.push({ url, args });
      if (registrationFails) {
        throw new Error('private transport details');
      }
      return args[0] === 'register' ? { id } : { id, deleted };
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
    requests,
    get closed() {
      return closed;
    },
    get viteConfig() {
      return viteConfig;
    },
  };
}

test('launcher registers once and deletes only owned mailbox on idempotent stop', async () => {
  const f = fixture();
  const session = await startQueue(f.options);
  assert.deepEqual(f.requests, [{ url: base, args: ['register'] }]);
  assert.equal(session.id, id);
  assert.equal(f.viteConfig.server.strictPort, true);
  await Promise.all([session.stop(), session.stop()]);
  assert.equal(f.closed, 1);
  assert.deepEqual(f.requests[1], { url: base, args: ['delete', id] });
});

test('startup failure cleans up mailbox and Vite', async () => {
  const f = fixture({ listenFails: true });
  await assert.rejects(
    startQueue(f.options),
    (error) =>
      error.phase === 'vite' &&
      error.code === 'client_failure' &&
      !error.message.includes('occupied'),
  );
  assert.equal(f.closed, 1);
  assert.deepEqual(f.requests.at(-1).args, ['delete', id]);
});

test('registration failure is sanitized and not retried', async () => {
  const f = fixture({ registrationFails: true });
  await assert.rejects(
    startQueue(f.options),
    (error) =>
      error.phase === 'register' &&
      error.code === 'client_failure' &&
      !error.message.includes('private transport'),
  );
  assert.equal(f.requests.length, 1);
  assert.equal(f.closed, 0);
});

test('stop during registration avoids starting Vite', async () => {
  const f = fixture();
  await startQueue({ ...f.options, shouldStop: () => true });
  assert.equal(f.viteConfig, undefined);
  assert.equal(f.requests.length, 2);
});

test('cleanup accepts absent streams and rejects malformed receipts without retry', async () => {
  for (const deleted of [true, false]) {
    const f = fixture({ deleted });
    await (await startQueue(f.options)).stop();
    assert.equal(f.requests.length, 2);
  }
  for (const receipt of [
    { id, deleted: 1 },
    { id, deleted: true, extra: true },
    { id: 'other', deleted: true },
  ]) {
    const f = fixture();
    const original = f.options.command;
    f.options.command = (url, args) =>
      args[0] === 'delete' ? Promise.resolve(receipt) : original(url, args);
    const session = await startQueue(f.options);
    await assert.rejects(session.stop(), /Queue delete failed/);
    await assert.rejects(session.stop(), /Queue delete failed/);
  }
});

test('invalid registration never starts Vite and cleans up only known canonical ID', async () => {
  for (const receipt of [{ id, extra: true }, { id: id.toUpperCase() }, {}, null]) {
    const f = fixture();
    const original = f.options.command;
    f.options.command = (url, args) =>
      args[0] === 'register' ? Promise.resolve(receipt) : original(url, args);
    await assert.rejects(startQueue(f.options), /Queue register failed/);
    assert.equal(f.viteConfig, undefined);
    assert.equal(f.requests.length, receipt?.id === id ? 1 : 0);
  }
});

test('configured base and ID derive the browser endpoint', async () => {
  const f = fixture();
  const customBase = 'http://127.0.0.1:54000';
  const session = await startQueue({
    ...f.options,
    environment: { MESSAGE_QUEUE_URL: customBase },
  });
  const plugin = f.viteConfig.plugins[0];
  plugin.apply({}, { command: 'serve', isPreview: false });
  plugin.config();
  const tags = await plugin.transformIndexHtml();
  assert.ok(tags[0].children.includes(`${customBase}/XADD/localpost%3Av1%3A${id}/*/data`));
  await session.stop();
  assert.equal(f.requests[1].url, customBase);
});

test('bounded stdin stop command handles split lines and calls session cleanup once', async () => {
  const f = fixture();
  const session = await startQueue(f.options);
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

test('safe queue failure categories and phases survive startup and cleanup', async () => {
  for (const code of [
    'memory_limit',
    'backend_error',
    'http_error',
    'transport_error',
    'client_unavailable',
  ]) {
    const f = fixture();
    f.options.command = async () => {
      throw Object.assign(new Error('private backend details'), { code });
    };
    await assert.rejects(startQueue(f.options), (error) => {
      assert.deepEqual(queueFailureReport(error), { error: { code, phase: 'register' } });
      assert.equal(error.message.includes('private'), false);
      return true;
    });
  }
  const f = fixture();
  const original = f.options.command;
  f.options.command = (url, args) => {
    if (args[0] === 'delete') {
      throw Object.assign(new Error('private cleanup details'), { code: 'backend_error' });
    }
    return original(url, args);
  };
  const session = await startQueue(f.options);
  await assert.rejects(session.stop(), (error) => {
    assert.deepEqual(queueFailureReport(error), {
      error: { code: 'backend_error', phase: 'delete' },
    });
    return true;
  });
  assert.deepEqual(
    queueFailureReport({ code: 'EADDRINUSE', phase: 'private phase', message: 'secret' }),
    { error: { code: 'client_failure', phase: 'startup' } },
  );
});
