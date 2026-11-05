import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readQueue, summarizeEvents } from './read-queue.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const pageId = '22222222-2222-4222-8222-222222222222';
function event(sequence, kind = 'state', overrides = {}) {
  return {
    schemaVersion: 1,
    runId: id,
    pageId,
    sequence,
    event: kind,
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
function message(streamId, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return { id: streamId, bytes: bytes.length, data: bytes.toString('base64') };
}
function page(messages = []) {
  return { id, messages, next_after: messages.at(-1)?.id ?? null };
}
function reader(pages, calls = []) {
  return readQueue(undefined, id, id, {
    command: async (base, args) => {
      calls.push([base, args]);
      assert.ok(pages.length, 'unexpected extra page');
      return pages.shift();
    },
  });
}

test('reader pages through short pages to empty, retains cursor and projects complete sessions', async () => {
  const calls = [];
  const result = await reader(
    [
      page([message('9-0', event(3, 'end')), message('10-0', event(1, 'ready'))]),
      page([message('10-1', event(2))]),
      page(),
    ],
    calls,
  );
  assert.equal(result.summary.complete, true);
  assert.equal(result.summary.messages, 3);
  assert.deepEqual(
    result.events.map((record) => record.sequence),
    [1, 2, 3],
  );
  assert.deepEqual(
    calls.map((call) => call[1]),
    [
      ['read', id, '--count', '16'],
      ['read', id, '--count', '16', '--after', '10-0'],
      ['read', id, '--count', '16', '--after', '10-1'],
    ],
  );
  assert.ok(calls.every(([base]) => base === 'http://127.0.0.1:53147'));
});

test('reader validates page shape, identity, order, cursor and base64 independently', async () => {
  const valid = message('1-0', event(1, 'ready'));
  for (const malformed of [
    null,
    [],
    { ...page(), extra: 'SECRET' },
    { ...page(), id: pageId },
    { ...page(), next_after: '1-0' },
    { ...page(), messages: {} },
    page(Array.from({ length: 17 }, () => valid)),
    page([{ ...valid, extra: 'SECRET' }]),
    page([{ ...valid, id: '01-0' }]),
    page([{ ...valid, id: '18446744073709551616-0' }]),
    page([valid, valid]),
    page([valid, { ...valid, id: '0-0' }]),
    { ...page([valid]), next_after: '2-0' },
    page([{ ...valid, bytes: valid.bytes + 1 }]),
    page([{ ...valid, bytes: 4097 }]),
    page([{ ...valid, data: valid.data + '\n' }]),
    page([{ ...valid, bytes: 1, data: 'Zh==' }]),
    page([{ ...valid, data: 'b64:' + valid.data }]),
  ]) {
    await assert.rejects(reader([malformed]), /Invalid queue/);
  }
  await assert.rejects(reader([page([valid]), page([valid])]), /Invalid queue/);
});

test('reader rejects unsafe payloads without exposing bytes and reports incomplete empty sessions', async () => {
  const result = await reader([
    page([
      message('1-0', Buffer.from([255])),
      message('1-1', event(1, 'ready', { runId: pageId })),
      message('1-2', { ...event(1), raw: 'SECRET_CANARY' }),
      message('1-3', Buffer.alloc(0)),
    ]),
    page(),
  ]);
  assert.equal(result.summary.rejected, 4);
  assert.equal(result.summary.complete, false);
  assert.deepEqual(result.events, []);
  assert.equal(JSON.stringify(result).includes('SECRET_CANARY'), false);
  assert.equal((await reader([page()])).summary.complete, false);
});

test('session summary catches duplicates, gaps, acknowledgements and terminal ordering', () => {
  const summary = summarizeEvents([event(2), event(2), event(4, 'end'), event(5)]);
  assert.equal(summary.duplicates, 1);
  assert.equal(summary.gaps, 2);
  assert.equal(summary.missingReady, 1);
  assert.equal(summary.sessionIssues, 1);
  assert.equal(summarizeEvents([event(1, 'ready')]).missingEnd, 1);
  assert.equal(summarizeEvents([event(1, 'ready'), event(2, 'ready')]).sessionIssues, 1);
  assert.equal(summarizeEvents([event(1, 'error')]).errors, 1);
});

test('reader bounds total decoded bytes, messages and number of pages', async () => {
  const full = (index, bytes) =>
    page(
      Array.from({ length: 16 }, (_, offset) =>
        message(`${index * 16 + offset + 1}-0`, Buffer.alloc(bytes, 32)),
      ),
    );
  await assert.rejects(
    reader(Array.from({ length: 33 }, (_, index) => full(index, 4096))),
    /limit/,
  );
  await assert.rejects(reader(Array.from({ length: 257 }, (_, index) => full(index, 1))), /limit/);
  const result = await reader([
    ...Array.from({ length: 256 }, (_, index) => full(index, 1)),
    page(),
  ]);
  assert.equal(result.summary.messages, 4096);
  await assert.rejects(
    reader(
      Array.from({ length: 257 }, (_, index) => page([message(`${index + 1}-0`, Buffer.alloc(0))])),
    ),
    /page limit/,
  );
});

test('reader rejects invalid identities before command execution', async () => {
  const command = () => assert.fail('executed invalid identity');
  await assert.rejects(readQueue(undefined, 'bad', id, { command }), /identity/);
  await assert.rejects(readQueue(undefined, id, 'bad', { command }), /identity/);
});

test('reader CLI emits only a bounded structured failure', async () => {
  await assert.rejects(
    promisify(execFile)(process.execPath, [
      fileURLToPath(new URL('./read-queue.mjs', import.meta.url)),
      'SECRET',
      id,
    ]),
    (error) => {
      assert.equal(error.stdout, '');
      assert.deepEqual(JSON.parse(error.stderr), {
        error: { code: 'invalid_response', operation: 'read' },
      });
      assert.equal(error.stderr.includes('SECRET'), false);
      return true;
    },
  );
});
