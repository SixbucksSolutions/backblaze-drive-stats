import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readLocalpostInbox, summarizeEvents } from './read-localpost-inbox.mjs';

const runId = '11111111-1111-4111-8111-111111111111';
const pageId = '22222222-2222-4222-8222-222222222222';
const event = (sequence, kind = 'state', overrides = {}) => ({
  schemaVersion: 1,
  runId,
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
});
const name = (index) => `localpost_019a4fb0-1a00-7000-8000-${String(index).padStart(12, '0')}.dat`;
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'localpost-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('reader sorts by page/sequence, keeps bytes intact and marks complete sessions', async (t) => {
  const root = await fixture(t);
  const records = [event(3, 'end'), event(1, 'ready'), event(2)];
  for (const [index, record] of records.entries()) {
    await writeFile(path.join(root, name(index)), JSON.stringify(record));
  }
  const before = await readFile(path.join(root, name(0)));
  const result = await readLocalpostInbox(root, runId);
  assert.deepEqual(
    result.events.map((record) => record.sequence),
    [1, 2, 3],
  );
  assert.equal(result.summary.complete, true);
  assert.deepEqual(await readFile(path.join(root, name(0))), before);
  assert.equal((await readdir(root)).length, 3);
});
test('reader rejects malformed, foreign, oversized and nonregular completed deliveries', async (t) => {
  const root = await fixture(t);
  const bodies = [
    Buffer.from([0xff]),
    JSON.stringify(event(1, 'ready', { runId: pageId })),
    JSON.stringify({ ...event(1), raw: 'SECRET_CANARY' }),
    ' '.repeat(4097),
  ];
  for (const [index, body] of bodies.entries()) {
    await writeFile(path.join(root, name(index)), body);
  }
  await mkdir(path.join(root, name(4)));
  await writeFile(path.join(root, 'partial.tmp'), 'SECRET_CANARY');
  const result = await readLocalpostInbox(root, runId);
  assert.equal(result.summary.rejected, 5);
  assert.equal(result.summary.ignored, 1);
  assert.equal(result.summary.complete, false);
  assert.deepEqual(result.events, []);
  const cli = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('./read-localpost-inbox.mjs', import.meta.url)),
    root,
    runId,
  ]);
  assert.equal(cli.stdout.includes('SECRET_CANARY'), false);
});
test('session summary identifies duplicates, leading/internal loss, terminal ordering and missing acknowledgements', () => {
  const summary = summarizeEvents([event(2), event(2), event(4, 'end'), event(5)]);
  assert.equal(summary.duplicates, 1);
  assert.equal(summary.gaps, 2);
  assert.equal(summary.missingReady, 1);
  assert.equal(summary.sessionIssues, 1);
  assert.equal(summarizeEvents([event(1, 'ready')]).missingEnd, 1);
  assert.equal(summarizeEvents([event(1, 'ready'), event(2, 'ready')]).sessionIssues, 1);
});
test('reader enforces aggregate byte and entry limits', async (t) => {
  const root = await fixture(t);
  const valid = JSON.stringify(event(1, 'ready'));
  const padded = valid + ' '.repeat(4096 - Buffer.byteLength(valid));
  for (let index = 0; index < 513; index += 1) {
    await writeFile(path.join(root, name(index)), padded);
  }
  await assert.rejects(readLocalpostInbox(root, runId), /byte limit/);
  const many = await fixture(t);
  for (let index = 0; index < 4097; index += 1) {
    await writeFile(path.join(many, `${index}.tmp`), '');
  }
  await assert.rejects(readLocalpostInbox(many, runId), /entry limit/);
});
test('reader rejects redirected inboxes and skips symbolic completed deliveries', async (t) => {
  const root = await fixture(t);
  const target = path.join(root, 'target');
  await mkdir(target);
  const redirected = path.join(root, 'redirected');
  await symlink(target, redirected, 'junction');
  await assert.rejects(readLocalpostInbox(redirected, runId), /unredirected/);
  // Directory junctions work without Windows symlink privileges and must never be traversed.
  await symlink(target, path.join(target, name(0)), 'junction');
  assert.equal((await readLocalpostInbox(target, runId)).summary.rejected, 1);
});
