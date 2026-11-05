import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDiagnosticBytes, validDiagnosticEvent } from './localpost-protocol.mjs';

export const runId = '11111111-1111-4111-8111-111111111111';
export function event(overrides = {}) {
  return {
    schemaVersion: 1,
    runId,
    pageId: '22222222-2222-4222-8222-222222222222',
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

test('strict protocol accepts only bounded exact projections', () => {
  assert.equal(validDiagnosticEvent(event()), true);
  assert.deepEqual(parseDiagnosticBytes(Buffer.from(JSON.stringify(event())), runId), event());
  for (const override of [
    { runId: 'bad' },
    { sequence: 0 },
    { sequence: Infinity },
    { extra: 'secret' },
    { event: 'unknown' },
    { source: 'unknown' },
    { state: [] },
  ]) {
    assert.equal(validDiagnosticEvent(event(override)), false);
  }
  for (const override of [
    { from: -1 },
    { to: 20001 },
    { pointIndex: 0.5 },
    { y: Infinity },
    { y: 1000001 },
    { selectionCount: 257 },
    { tooltip: 1 },
    { violation: true },
    { extra: 'secret' },
  ]) {
    assert.equal(validDiagnosticEvent(event({ state: { ...event().state, ...override } })), false);
  }
  assert.equal(validDiagnosticEvent(event(), '33333333-3333-4333-8333-333333333333'), false);
});

test('bytes reject malformed UTF-8, oversized, duplicate and unknown payloads', () => {
  const body = JSON.stringify(event());
  for (const bytes of [
    Buffer.from([0xff]),
    Buffer.alloc(4097, 32),
    Buffer.alloc(0),
    Buffer.from('{'),
    Buffer.from('null'),
    Buffer.from('[]'),
    Buffer.from('\ufeff' + body),
    Buffer.from(body.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')),
    Buffer.from(body.replace('"schemaVersion":1', '"schemaVersion":1,"schema\\u0056ersion":1')),
    Buffer.from(body.replace('"view":"afr"', '"view":"afr","view":"afr"')),
    Buffer.from(body.replace('"view":"afr"', '"view":"afr","raw":"secret"')),
  ]) {
    assert.equal(parseDiagnosticBytes(bytes, runId), null);
  }
  assert.equal(parseDiagnosticBytes(body, runId), null);
});
