import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queueBaseUrl, queueCommand, queueFailureCode } from './queue-cli.mjs';

const id = '11111111-1111-4111-8111-111111111111';
test('queue failure codes preserve fixed context without exposing untrusted errors', () => {
  for (const code of [
    'transport_error',
    'http_error',
    'memory_limit',
    'backend_error',
    'invalid_response',
    'response_too_large',
    'output_error',
    'invalid_argument',
    'input_too_large',
    'input_error',
    'message_not_found',
    'client_unavailable',
    'client_failure',
  ]) {
    assert.equal(queueFailureCode({ code, message: 'SECRET', stderr: 'SECRET' }), code);
  }
  for (const error of [
    null,
    undefined,
    'SECRET',
    new Error('SECRET'),
    { code: 'SECRET' },
    { code: 'EADDRINUSE' },
    { code: {} },
  ]) {
    assert.equal(queueFailureCode(error), 'invalid_response');
    assert.equal(queueFailureCode(error, 'client_failure'), 'client_failure');
    assert.equal(queueFailureCode(error, 'SECRET'), 'invalid_response');
  }
});
test('queue endpoint allows only literal loopback HTTP origins', () => {
  assert.equal(queueBaseUrl(), 'http://127.0.0.1:53147');
  assert.equal(queueBaseUrl('http://[::1]:53147/'), 'http://[::1]:53147');
  for (const value of [
    '',
    'https://127.0.0.1',
    'http://localhost',
    'http://127.1',
    'http://user@127.0.0.1',
    'http://127.0.0.1:0',
    'http://127.0.0.1:65536',
    'http://127.0.0.1/?a',
    'http://127.0.0.1/#a',
    'http://127.0.0.1/%2f',
    'http://127.0.0.1/../',
    42,
  ]) {
    assert.throws(() => queueBaseUrl(value), /invalid_argument/);
  }
});

test('native invocation fixes binary, endpoint, timeout and bounded process options', async () => {
  const calls = [];
  const result = await queueCommand(undefined, ['read', id, '--count', '16', '--after', '12-3'], {
    execute: async (...args) => {
      calls.push(args);
      return { stdout: '{"ok":true}\n', stderr: '' };
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'C:/Projects/shared-message-queue/bin/localpost-client.exe');
  assert.deepEqual(calls[0][1], [
    '--url',
    'http://127.0.0.1:53147',
    '--timeout',
    '5s',
    'read',
    id,
    '--count',
    '16',
    '--after',
    '12-3',
  ]);
  assert.deepEqual(calls[0][2], {
    encoding: 'utf8',
    timeout: 7000,
    maxBuffer: 256 * 1024,
    windowsHide: true,
    shell: false,
  });
});

test('invalid commands never execute and command failures contain only safe diagnostics', async () => {
  for (const args of [
    [],
    ['clear', id],
    ['register', 'extra'],
    ['delete', '../'],
    ['read', id, '--count', '17'],
    ['read', id, '--count', '16', '--after', '01-0'],
  ]) {
    await assert.rejects(
      queueCommand(undefined, args, {
        execute: () => assert.fail('invalid command executed'),
      }),
      /invalid_argument/,
    );
  }
  for (const [error, code] of [
    [{ code: 'ENOENT', message: 'SECRET' }, 'client_unavailable'],
    [
      { code: 1, stderr: '{"error":{"code":"memory_limit","operation":"register"}}' },
      'memory_limit',
    ],
    [{ code: 1, stderr: '{"error":{"code":"SECRET","operation":"register"}}' }, 'client_failure'],
    [
      { code: 1, stderr: '{"error":{"code":"memory_limit","operation":"delete"}}' },
      'client_failure',
    ],
    [{ code: 1, stderr: 'SECRET' }, 'client_failure'],
  ]) {
    await assert.rejects(
      queueCommand(undefined, ['register'], {
        execute: async () => {
          throw error;
        },
      }),
      (caught) => caught.code === code && !caught.message.includes('SECRET'),
    );
  }
});

test('malformed, oversized and stderr-bearing success output is rejected safely', async () => {
  for (const result of [
    { stdout: 'SECRET', stderr: '' },
    { stdout: 'null', stderr: '' },
    { stdout: '[]', stderr: '' },
    { stdout: '{}', stderr: 'SECRET' },
    { stdout: ' '.repeat(256 * 1024 + 1), stderr: '' },
  ]) {
    await assert.rejects(
      queueCommand(undefined, ['register'], { execute: async () => result }),
      (error) => error.code === 'invalid_response' && !error.message.includes('SECRET'),
    );
  }
});
