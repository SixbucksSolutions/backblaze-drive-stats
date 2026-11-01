import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { appRoute } from './app-route.ts';
import type { FontMode } from './font-ready.ts';
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

async function mainStartupHarness(query: string) {
  const source = await readFile(new URL('./main.ts', import.meta.url), 'utf8');
  const executable =
    stripTypeScriptTypes(source)
      .replace(/^import[\s\S]*?;\r?$/gm, '')
      .replace("import('./matrix.ts')", '__matrixModule()')
      .replace("import('./snapshot-explorer.ts')", '__snapshotModule()')
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'))
      .replace('void start();', '') + '\nstart;';
  const fontChoice = deferred<FontMode>();
  const matrix = deferred<{ initMatrix: (signal: AbortSignal) => Promise<void> }>();
  const events: string[] = [];
  const root = { dataset: {} as Record<string, string>, classList: { remove: () => {} } };
  let fontStarts = 0;
  const context = {
    URLSearchParams,
    Intl,
    AbortController,
    AbortSignal,
    location: { search: query },
    document: { querySelector: () => ({}), fonts: {}, documentElement: root },
    waitForFonts: () => {
      fontStarts++;
      events.push('fonts started');
      return fontChoice.promise;
    },
    waitForPresentation,
    withStartupDeadline,
    appRoute,
    abortInitialPresentation: () => {
      events.push('abort early request');
    },
    __matrixModule: () => {
      events.push('matrix import started');
      return matrix.promise;
    },
    __snapshotModule: async () => ({
      initSnapshotExplorer: async () => {
        events.push('snapshot rendered');
      },
    }),
    requestAnimationFrame: (callback: () => void) => {
      callback();
    },
  };
  const start = vm.runInNewContext(executable, context) as () => Promise<void>;
  const rendering = start();
  return { fontChoice, matrix, events, root, rendering, fontStarts: () => fontStarts };
}

await test('main downloads matrix in parallel but applies font choice before its first render', async () => {
  for (const mode of ['custom', 'fallback'] as const) {
    const harness = await mainStartupHarness('?view=matrix');
    await Promise.resolve();
    assert.deepEqual(harness.events, ['fonts started', 'matrix import started']);
    let renders = 0;
    harness.matrix.resolve({
      initMatrix: async (signal) => {
        signal.throwIfAborted();
        assert.equal(harness.root.dataset.fontMode, mode);
        renders++;
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(renders, 0);
    harness.fontChoice.resolve(mode);
    await harness.rendering;
    assert.equal(renders, 1);
    assert.equal(harness.fontStarts(), 1);
    assert.equal(harness.root.dataset.appReady, 'true');
  }
});

await test('main retains reference route rendering without waiting for the font decision', async () => {
  const harness = await mainStartupHarness('?view=matrix&reference=1');
  let renders = 0;
  const rendered = deferred<void>();
  harness.matrix.resolve({
    initMatrix: async () => {
      renders++;
      rendered.resolve();
    },
  });
  await rendered.promise;
  assert.equal(renders, 1);
  assert.equal(harness.root.dataset.appReady, undefined);
  harness.fontChoice.resolve('fallback');
  await harness.rendering;
  assert.equal(harness.root.dataset.fontMode, 'fallback');
  assert.equal(harness.fontStarts(), 1);
});
