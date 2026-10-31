import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_FONTS,
  waitForFonts,
  waitForPresentation,
  withStartupDeadline,
} from './font-ready.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
await test('initial presentation waits for data and selected fonts, including a render failure', async () => {
  const fonts = deferred<'custom'>(),
    data = deferred<void>();
  let finished = false;
  const first = waitForPresentation(fonts.promise, data.promise).then((value) => {
    finished = true;
    return value;
  });
  fonts.resolve('custom');
  await Promise.resolve();
  assert.equal(finished, false);
  data.resolve();
  assert.deepEqual(await first, { fontMode: 'custom', renderFailed: false });
  const lateFonts = deferred<'fallback'>();
  finished = false;
  const failed = waitForPresentation(
    lateFonts.promise,
    Promise.reject(new Error('render failure')),
  ).then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  lateFonts.resolve('fallback');
  assert.deepEqual(await failed, { fontMode: 'fallback', renderFailed: true });
});
await test('required faces are explicitly loaded, then font layout readiness is awaited', async () => {
  const ready = deferred<void>(),
    calls: string[] = [];
  let finished = false;
  const loaded = waitForFonts({
    load: async (font) => {
      calls.push(font);
      return [{}];
    },
    ready: ready.promise,
  }).then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, [...REQUIRED_FONTS]);
  assert.equal(finished, false);
  ready.resolve();
  assert.equal(await loaded, 'custom');
});
await test('missing API, rejected loads, and absent font definitions choose stable fallback', async () => {
  assert.equal(await waitForFonts(undefined), 'fallback');
  assert.equal(
    await waitForFonts({
      load: async () => {
        throw new Error('font unavailable');
      },
      ready: Promise.resolve(),
    }),
    'fallback',
  );
  assert.equal(await waitForFonts({ load: async () => [], ready: Promise.resolve() }), 'fallback');
});
await test('slow fonts time out once; a later successful load cannot change the chosen mode', async () => {
  const loading = deferred<unknown[]>();
  const mode = waitForFonts({ load: () => loading.promise, ready: Promise.resolve() }, 5);
  assert.equal(await mode, 'fallback');
  loading.resolve([{}]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(await mode, 'fallback');
});
await test('a stalled route import reaches the deadline and a late route cannot start rendering', async () => {
  const imported = deferred<void>(),
    controller = new AbortController();
  let renders = 0;
  const route = withStartupDeadline(
    () =>
      imported.promise.then(() => {
        controller.signal.throwIfAborted();
        renders++;
      }),
    controller,
    5,
  );
  const ready = await waitForPresentation(Promise.resolve('custom'), route);
  assert.equal(ready.renderFailed, true);
  assert.equal(controller.signal.aborted, true);
  imported.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 0);
});
