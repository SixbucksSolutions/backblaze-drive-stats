import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleDiagnosticsState, startDiagnostics } from './localpost-client.mjs';

function receipt(options) {
  return new Response(
    JSON.stringify({
      filename: 'localpost_019a4567-1234-7abc-8def-0123456789ab.dat',
      bytes: new TextEncoder().encode(options.body).byteLength,
    }),
    { status: 200 },
  );
}

function fixture(fetchImplementation = async (_url, options) => receipt(options)) {
  const elements = new Map();
  const frames = new Map();
  const timers = new Map();
  const requests = [];
  let next = 0;
  let observer;
  class Element {
    constructor(id = '') {
      this.id = id;
      this.parentElement = null;
      this.children = [];
      this.attributes = new Map();
      this.listeners = new Map();
      this.style = {};
      this.value = '';
      this.hidden = false;
      this.isConnected = true;
      this.afr = false;
    }
    append(...children) {
      for (const child of children) {
        this.children.push(child);
        child.parentElement = this;
        elements.set(child.id, child);
      }
    }
    contains(node) {
      return node === this || this.children.some((child) => child.contains(node));
    }
    remove() {
      this.isConnected = false;
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }
    closest() {
      return this.afr ? this : this.parentElement?.closest();
    }
    setAttribute(key, value) {
      this.attributes.set(key, value);
    }
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type).add(callback);
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback);
    }
    trigger(type, target = this, extra = {}) {
      for (const callback of this.listeners.get(type) ?? []) {
        callback({ target, ...extra });
      }
    }
  }
  const document = new Element();
  document.body = new Element('body');
  document.createElement = () => new Element();
  document.getElementById = (id) => elements.get(id) ?? null;
  const page = new Element('main');
  page.afr = true;
  document.body.append(page);
  document.querySelector = () => page;
  document.querySelectorAll = () => [{ checked: true }, { checked: true }];
  for (const [id, value] of Object.entries({
    'afr-time': 'relative',
    'afr-metric': 'cumulative',
    'afr-from': '0',
    'afr-to': '16',
    'afr-y-range': '5',
    'afr-point': '4',
    'afr-tooltip': '',
    'afr-crosshair': '',
    'afr-current-point': '',
    'afr-chart': '',
  })) {
    const element = new Element(id);
    element.value = value;
    page.append(element);
  }
  elements.get('afr-tooltip').hidden = true;
  elements.get('afr-crosshair').setAttribute('visibility', 'hidden');
  elements.get('afr-current-point').setAttribute('visibility', 'hidden');
  const inspection = new Element('afr-inspect-model');
  inspection.options = [{}, {}];
  page.append(inspection);
  const window = new Element();
  const storage = new Map();
  Object.assign(window, {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document,
    crypto: { randomUUID: () => 'f737b3e8-f66b-4196-ac22-b7ce959e4e87' },
    getComputedStyle: (element) => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      ...element.style,
    }),
    AbortController,
    requestAnimationFrame: (callback) => {
      frames.set(++next, callback);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => {
      timers.set(++next, { callback, delay });
      return next;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return fetchImplementation(url, options);
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.active = true;
        observer = this;
      }
      observe() {}
      disconnect() {
        this.active = false;
      }
    },
  });
  return {
    window,
    document,
    elements,
    requests,
    frames,
    timers,
    mutate(target) {
      if (observer.active) {
        observer.callback([{ target }]);
      }
    },
    settleFrame() {
      for (const callback of [...frames.values()]) {
        callback();
      }
    },
    start() {
      return startDiagnostics(
        {
          runId: '52bcbf1f-e744-4f8d-a038-7f51bdf6024f',
          endpoint:
            'http://127.0.0.1:53147/api/2026-11-05/registrations/52bcbf1f-e744-4f8d-a038-7f51bdf6024f/messages',
          password: 'must-not-leak',
        },
        window,
      );
    },
  };
}
async function settle() {
  for (let i = 0; i < 150; i += 1) {
    await Promise.resolve();
  }
}

test('samples actual visibility including ancestors, numeric bounds and fixed projection', () => {
  const f = fixture();
  let state = sampleDiagnosticsState(f.window);
  assert.equal(state.violation, false);
  assert.equal(state.selectionCount, 2);
  // Filtered model checkboxes do not alter the complete inspection choices.
  f.document.querySelectorAll = () => [];
  assert.equal(sampleDiagnosticsState(f.window).selectionCount, 2);
  f.elements.get('afr-current-point').setAttribute('visibility', 'visible');
  assert.equal(sampleDiagnosticsState(f.window).marker, true);
  assert.equal(sampleDiagnosticsState(f.window).violation, true);
  f.elements.get('afr-current-point').setAttribute('visibility', 'hidden');
  f.elements.get('afr-crosshair').setAttribute('visibility', 'visible');
  state = sampleDiagnosticsState(f.window);
  assert.equal(state.violation, true);
  f.elements.get('afr-tooltip').hidden = false;
  assert.equal(sampleDiagnosticsState(f.window).violation, false);
  f.elements.get('main').style.display = 'none';
  assert.equal(sampleDiagnosticsState(f.window).crosshair, false);
  f.elements.get('main').style.display = 'block';
  f.elements.get('afr-tooltip').style.opacity = '0';
  assert.equal(sampleDiagnosticsState(f.window).tooltip, false);
  f.elements.get('afr-to').value = 'Infinity';
  f.elements.get('afr-from').value = '-1';
  f.elements.get('afr-point').value = '2.5';
  f.elements.get('afr-y-range').value = 'auto';
  f.elements.get('afr-time').value = 'secret-value';
  state = sampleDiagnosticsState(f.window);
  assert.deepEqual(
    [state.to, state.from, state.pointIndex, state.y, state.mode],
    [null, null, null, null, 'unknown'],
  );
});

test('serializes only the fixed projection and acknowledges ready and explicit finish', async () => {
  const f = fixture();
  f.start();
  await settle();
  assert.match(f.elements.get('localpost-message').textContent, /ready acknowledged/);
  assert.deepEqual(Object.keys(f.requests[0].body), [
    'schemaVersion',
    'runId',
    'pageId',
    'sequence',
    'event',
    'source',
    'state',
  ]);
  assert.deepEqual(Object.keys(f.requests[0].body.state), [
    'view',
    'mode',
    'metric',
    'from',
    'to',
    'y',
    'selectionCount',
    'tooltip',
    'crosshair',
    'marker',
    'pointIndex',
    'violation',
  ]);
  assert.equal(JSON.stringify(f.requests[0].body).includes('private-token'), false);
  assert.equal(JSON.stringify(f.requests[0].body).includes('must-not-leak'), false);
  f.elements.get('localpost-finish').trigger('click');
  await settle();
  assert.equal(f.requests.at(-1).body.event, 'end');
  assert.equal(f.requests.at(-1).body.source, 'finish');
  assert.match(f.elements.get('localpost-message').textContent, /end acknowledged/);
  assert.equal(f.elements.get('localpost-finish').disabled, true);
});

test('settles DOM changes, deduplicates motion, preserves action source and same-state checks', async () => {
  const f = fixture();
  f.start();
  await settle();
  for (let i = 0; i < 100; i += 1) {
    f.document.trigger('pointermove', f.elements.get('afr-chart'));
  }
  f.settleFrame();
  await settle();
  assert.equal(f.requests.length, 1);
  f.document.trigger('pointermove', f.elements.get('afr-chart'));
  f.elements.get('afr-tooltip').hidden = false;
  f.elements.get('afr-crosshair').setAttribute('visibility', 'visible');
  f.mutate(f.elements.get('afr-crosshair'));
  assert.equal(f.requests.length, 1);
  f.settleFrame();
  await settle();
  assert.equal(f.requests.at(-1).body.source, 'pointer');
  assert.equal(f.requests.at(-1).body.state.tooltip, true);
  f.document.trigger('change', f.elements.get('afr-y-range'));
  f.settleFrame();
  await settle();
  assert.equal(f.requests.at(-1).body.event, 'check');
  assert.equal(f.requests.at(-1).body.source, 'control');
  f.document.trigger('pointerleave', f.elements.get('afr-chart'));
  f.settleFrame();
  await settle();
  assert.equal(f.requests.at(-1).body.source, 'pointer');
  assert.equal(f.requests.at(-1).body.event, 'check');
  f.mutate(f.elements.get('localpost-message'));
  assert.equal(f.frames.size, 0);
});

test('bounded queue and a single flight; end survives saturation and errors carry no raw data', async () => {
  let release;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  f.start();
  await settle();
  for (let i = 0; i < 80; i += 1) {
    f.window.trigger('error', f.window, {
      message: 'password secret',
      filename: 'https://private.example',
    });
  }
  assert.equal(f.requests.length, 1);
  assert.match(f.elements.get('localpost-message').textContent, /dropped 17/);
  f.elements.get('localpost-finish').trigger('click');
  for (let i = 0; i < 64; i += 1) {
    release(receipt(f.requests.at(-1).options));
    await settle();
  }
  assert.equal(f.requests.length, 64);
  assert.equal(f.requests.at(-1).body.event, 'end');
  assert.equal(f.requests.at(-1).body.sequence, 82);
  assert.equal(JSON.stringify(f.requests).includes('password secret'), false);
  assert.equal(JSON.stringify(f.requests).includes('private.example'), false);
  assert.match(f.elements.get('localpost-message').textContent, /end acknowledged/);
});

test('transport rejection/timeout are isolated without retries or recursive error reports', async () => {
  const f = fixture(async () => {
    throw new Error('sensitive transport details');
  });
  const api = f.start();
  await settle();
  assert.equal(f.requests.length, 1);
  assert.match(f.elements.get('localpost-message').textContent, /failed 1/);
  api.teardown();
  await settle();
  assert.equal(f.requests.length, 2);
  assert.equal(f.timers.size, 0);
  const timed = fixture(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  timed.start();
  [...timed.timers.values()].find((timer) => timer.delay === 2000).callback();
  await settle();
  assert.equal(timed.requests.length, 1);
  assert.match(timed.elements.get('localpost-message').textContent, /failed 1/);
});

test('pagehide sends one best-effort end and teardown removes observers/listeners/scheduled samples', async () => {
  const f = fixture();
  const api = f.start();
  await settle();
  f.document.trigger('pointermove', f.elements.get('afr-chart'));
  f.window.trigger('pagehide');
  await settle();
  const count = f.requests.length;
  assert.equal(f.requests.at(-1).body.source, 'pagehide');
  assert.equal(f.requests.at(-1).options.keepalive, true);
  assert.equal(f.frames.size, 0);
  f.document.trigger('change', f.elements.get('afr-to'));
  f.window.trigger('unhandledrejection', f.window, { reason: 'secret' });
  f.mutate(f.elements.get('afr-to'));
  api.teardown();
  f.settleFrame();
  await settle();
  assert.equal(f.requests.length, count);
  assert.equal(f.timers.size, 0);
  assert.equal(
    [...f.document.listeners.values()].every((listeners) => listeners.size === 0),
    true,
  );
});

test('repeated injection ends the prior session and retains one status bar', async () => {
  const f = fixture();
  f.start();
  await settle();
  const original = f.elements.get('localpost-status');
  const api = f.start();
  await settle();
  assert.equal(original.isConnected, false);
  assert.equal(f.document.body.children.filter((node) => node.id === 'localpost-status').length, 1);
  assert.equal(f.requests.filter((request) => request.body.event === 'end').length, 1);
  api.teardown();
  await settle();
  assert.match(f.elements.get('localpost-message').textContent, /Stopped; reload to resume/);
  assert.equal(f.window.__localpostDiagnostics, undefined);
});

test('only exact valid publication receipts acknowledge a message', async () => {
  for (const result of [
    { filename: '../private', bytes: 1 },
    { filename: 'localpost_019a4567-1234-7abc-8def-0123456789ab.dat', bytes: 1 },
    { extra: true },
    'x'.repeat(600),
  ]) {
    const f = fixture(async () => new Response(JSON.stringify(result), { status: 200 }));
    f.start();
    await settle();
    assert.match(f.elements.get('localpost-message').textContent, /ready pending/);
    assert.match(f.elements.get('localpost-message').textContent, /failed 1/);
  }
});

test('run budget persists across injection and storage failure fails diagnostics closed', async () => {
  const f = fixture();
  const key = 'localpost-budget-52bcbf1f-e744-4f8d-a038-7f51bdf6024f';
  f.window.sessionStorage.setItem(key, JSON.stringify({ attempts: 4095, bytes: 0 }));
  f.start();
  await settle();
  assert.equal(f.requests.length, 1);
  f.start();
  await settle();
  assert.equal(f.requests.length, 1);
  const unavailable = fixture();
  unavailable.window.sessionStorage.getItem = () => {
    throw new Error('unavailable');
  };
  assert.doesNotThrow(() => unavailable.start());
  await settle();
  assert.equal(unavailable.requests.length, 0);
  assert.match(unavailable.elements.get('localpost-message').textContent, /failed 1/);
});

test('sender rejects invalid projected state before transport', async () => {
  const f = fixture();
  f.elements.get('afr-inspect-model').options = { length: 1.5 };
  f.start();
  await settle();
  assert.equal(f.requests.length, 0);
  assert.match(f.elements.get('localpost-message').textContent, /dropped 1/);
});
