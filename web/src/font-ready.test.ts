import { parseStaticPicksContext } from './static-picks-context.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { appRoute, viewUsesSpinner } from './app-route.ts';
import type { FontMode } from './font-ready.ts';
import {
  REQUIRED_FONTS,
  UI_FONTS,
  waitForFonts,
  waitForPresentation,
  withStartupDeadline,
  yieldToStartupPaint,
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

async function mainStartupHarness(query: string, firstPaint = Promise.resolve()) {
  const source = await readFile(new URL('./main.ts', import.meta.url), 'utf8');
  const executable =
    stripTypeScriptTypes(source)
      .replace(/^import[\s\S]*?;\r?$/gm, '')
      .replace("import('./matrix.ts')", '__matrixModule()')
      .replace("import('./snapshot-explorer.ts')", '__snapshotModule()')
      .replace("import('./afr-timeline.ts')", '__timelineModule()')
      .replace("import('./owner-picks.ts')", '__picksModule()')
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'))
      .replace('export async function startAnalytics', 'async function startAnalytics') +
    '\nstartAnalytics;';
  const fontChoice = deferred<FontMode>();
  const matrix = deferred<{ initMatrix: (signal: AbortSignal) => Promise<void> }>();
  const events: string[] = [];
  const root = { dataset: {} as Record<string, string>, classList: { remove: () => {} } };
  let fontStarts = 0;
  let paintWaits = 0;
  let revealFrames = 0;
  let requestedFonts: readonly string[] | undefined;
  const context = {
    URLSearchParams,
    Intl,
    AbortController,
    AbortSignal,
    location: { search: query },
    document: {
      querySelector: () => ({}),
      fonts: {},
      documentElement: root,
      visibilityState: 'visible',
    },
    UI_FONTS,
    waitForFonts: (_fonts: unknown, _timeout?: number, fonts?: readonly string[]) => {
      requestedFonts = fonts;
      fontStarts++;
      events.push('fonts started');
      return fontChoice.promise;
    },
    waitForPresentation,
    withStartupDeadline,
    yieldToStartupPaint: (visible: boolean) => {
      assert.equal(visible, true);
      paintWaits++;
      return firstPaint;
    },
    appRoute,
    viewUsesSpinner,
    mountPublishedNavigation: () => ({}),
    updatePublishedNavigation: () => {},
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
    __timelineModule: async () => ({
      initAfrTimeline: async () => {
        events.push('timeline rendered');
      },
    }),
    __picksModule: async () => ({
      initOwnerPicks: async () => {
        events.push('picks rendered');
      },
    }),
    requestAnimationFrame: (callback: () => void) => {
      revealFrames++;
      callback();
    },
  };
  const start = vm.runInNewContext(executable, context) as (
    controller: AbortController,
  ) => Promise<void>;
  const rendering = start(new AbortController());
  return {
    fontChoice,
    matrix,
    events,
    root,
    rendering,
    fontStarts: () => fontStarts,
    paintWaits: () => paintWaits,
    revealFrames: () => revealFrames,
    requestedFonts: () => requestedFonts,
  };
}

await test('prepaint spinner policy matches routes and defaults off for every other view', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const policy = html.match(/<script id="startup-policy">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(policy);
  // Run the actual head script: waiting for the module would allow a startup flash.
  for (const query of [
    '',
    'view=picks',
    'view=afr',
    'view=matrix',
    'view=matrix&reference=1',
    'view=matrix&legacy=1',
    'view=explore',
    'view=explore&report=matrix',
    'view=reliability',
    'view=unknown',
    'view=picks&view=matrix',
    'view=matrix&view=picks',
    ...['deployments', 'distribution', 'capacity', 'manufacturers', 'datacenters'].flatMap(
      (view) => [`view=${view}`, `view=${view}&legacy=1`],
    ),
  ]) {
    const classes = new Set<string>();
    vm.runInNewContext(policy, {
      URLSearchParams,
      location: { search: `?${query}` },
      document: { documentElement: { classList: { add: (name: string) => classes.add(name) } } },
    });
    const expected = new URLSearchParams(query).get('view') === 'matrix';
    assert.equal(viewUsesSpinner(new URLSearchParams(query)), expected, query);
    assert.equal(classes.has('matrix-startup'), expected, query);
  }
});

await test('nonmatrix startup keeps font readiness without spinner paint waits or reveal frames', async () => {
  for (const query of ['?view=deployments', '?view=explore&example=1', '?view=afr']) {
    const harness = await mainStartupHarness(query, new Promise<void>(() => {}));
    // Allow the route module and renderer to complete while the font choice is pending.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    assert.ok(
      harness.events.some((event) => event.endsWith('rendered')),
      query,
    );
    assert.equal(harness.root.dataset.appReady, undefined, query);
    assert.equal(harness.paintWaits(), 0, query);
    harness.fontChoice.resolve('custom');
    await harness.rendering;
    assert.equal(harness.root.dataset.fontMode, 'custom', query);
    assert.equal(harness.root.dataset.appReady, 'true', query);
    assert.equal(harness.revealFrames(), 0, query);
    if (query === '?view=afr') {
      assert.deepEqual(harness.requestedFonts(), UI_FONTS);
    }
  }
});

await test('startup feedback yields past a frame callback before synchronous rendering', async () => {
  let frame: (() => void) | undefined;
  let finished = false;
  const painted = yieldToStartupPaint(true, {
    request: (callback) => {
      frame = callback;
      return 1;
    },
    cancel: () => assert.fail('A completed frame should not be cancelled'),
  }).then(() => {
    finished = true;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.ok(frame);
  frame();
  await Promise.resolve();
  assert.equal(finished, false, 'The frame callback itself precedes paint');
  await painted;
  assert.equal(finished, true);
});

await test('hidden startup skips the frame wait; missing or failed frames cannot stall it', async () => {
  let requested = false;
  await yieldToStartupPaint(false, {
    request: () => {
      requested = true;
      return 1;
    },
    cancel: () => assert.fail('No frame was requested'),
  });
  assert.equal(requested, false);
  const cancelled: number[] = [];
  await yieldToStartupPaint(true, { request: () => 17, cancel: (id) => cancelled.push(id) }, 5);
  assert.deepEqual(cancelled, [17]);
  await yieldToStartupPaint(true, {
    request: () => {
      throw new Error('Frame scheduler unavailable');
    },
    cancel: () => assert.fail('No frame was scheduled'),
  });
});

await test('main overlaps downloads with feedback but defers complete matrix rendering until it', async () => {
  const paint = deferred<void>();
  const harness = await mainStartupHarness('?view=matrix', paint.promise);
  let renders = 0;
  harness.matrix.resolve({
    initMatrix: async () => {
      renders++;
    },
  });
  harness.fontChoice.resolve('custom');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 0);
  assert.deepEqual(harness.events, ['fonts started', 'matrix import started']);
  paint.resolve();
  await harness.rendering;
  assert.equal(renders, 1);
});

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
    assert.equal(harness.paintWaits(), 1);
    assert.equal(harness.revealFrames(), 2);
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

await test('home requests only the UI face and retains permanent fallback', async () => {
  const calls: string[] = [];
  assert.equal(
    await waitForFonts(
      {
        load: async (font) => {
          calls.push(font);
          return [{}];
        },
        ready: Promise.resolve(),
      },
      100,
      UI_FONTS,
    ),
    'custom',
  );
  assert.deepEqual(calls, ['400 14px Inter']);
  assert.equal(
    await waitForFonts({ load: async () => [], ready: Promise.resolve() }, 100, UI_FONTS),
    'fallback',
  );
});

await test('home entry adopts delivered markup without fetching data or analytical modules', async () => {
  const source = await readFile(new URL('./entry.ts', import.meta.url), 'utf8');
  const executable = stripTypeScriptTypes(
    source
      .replace(/^import[\s\S]*?;\r?$/gm, '')
      .replace("import('./main.ts')", '__analytics()')
      .replace('void start();', 'start;'),
  );
  for (const invalid of [false, true]) {
    let analytics = 0,
      mounted = 0;
    const root = { dataset: {} as Record<string, string>, classList: { remove: () => {} } };
    const app = { innerHTML: 'delivered cards' };
    const context = {
      contractVersion: 1,
      sourceIndexSha256: 'a'.repeat(64),
      latestSnapshotId: 'latest',
      asOfQuarter: '2026-Q2',
    };
    const run = vm.runInNewContext(executable, {
      appRoute,
      URLSearchParams,
      URL,
      parseStaticPicksContext,
      UI_FONTS,
      location: {
        href: 'https://example.test/?view=picks&snapshot=stale&quarter=1999-Q1',
        search: '?view=picks&snapshot=stale&quarter=1999-Q1',
      },
      history: {
        replaceState: (_a: unknown, _b: unknown, url: URL) => {
          assert.equal(url.searchParams.has('snapshot'), false);
          assert.equal(url.searchParams.has('quarter'), false);
        },
      },
      document: {
        fonts: undefined,
        documentElement: root,
        querySelectorAll: () => (invalid ? [] : [{ textContent: JSON.stringify(context) }]),
        querySelector: (id: string) => (id === '#app' ? app : {}),
      },
      waitForFonts: async () => 'fallback',
      mountPublishedNavigation: () => {
        mounted++;
      },
      updatePublishedNavigation: () => {},
      fetch: () => assert.fail('home fetched data'),
      __analytics: () => {
        analytics++;
      },
    }) as () => Promise<void>;
    await run();
    assert.equal(analytics, 0);
    assert.equal(mounted, invalid ? 0 : 1);
    assert.equal(root.dataset.fontMode, 'fallback');
    assert.equal(root.dataset.appReady, 'true');
    if (invalid) {
      assert.match(app.innerHTML, /unavailable/);
    } else {
      assert.equal(app.innerHTML, 'delivered cards');
    }
  }
});

async function analyticsEntryHarness(
  analytics: () => Promise<{ startAnalytics: (controller: AbortController) => Promise<void> }>,
) {
  const source = await readFile(new URL('./entry.ts', import.meta.url), 'utf8');
  const executable = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\r?$/gm, '')
    .replace("import('./main.ts')", '__analytics()')
    .replace('void start();', 'start;');
  const app = { innerHTML: 'initial markup' };
  const classes = new Set(['app-pending']);
  const root = {
    dataset: {} as Record<string, string>,
    classList: { remove: (value: string) => classes.delete(value) },
  };
  const early = new AbortController();
  const host = { __analyticsCatalogueInitial: { controller: early } };
  const run = vm.runInNewContext(executable, {
    appRoute,
    URLSearchParams,
    AbortController,
    location: { search: '?view=matrix' },
    document: { querySelector: () => app, documentElement: root },
    window: host,
    __analytics: analytics,
    withStartupDeadline: (render: () => Promise<unknown>, controller: AbortController) =>
      withStartupDeadline(render, controller, 5),
  }) as () => Promise<void>;
  return { run, app, root, classes, early };
}

async function inertMainModule(mount: () => object, extra: Record<string, unknown> = {}) {
  const source = await readFile(new URL('./main.ts', import.meta.url), 'utf8');
  const executable =
    stripTypeScriptTypes(source)
      .replace(/^import[\s\S]*?;\r?$/gm, '')
      .replace('export async function startAnalytics', 'async function startAnalytics')
      .replace("import('./matrix.ts')", '__matrixModule()')
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')) + '\n({startAnalytics});';
  return vm.runInNewContext(executable, {
    URLSearchParams,
    Intl,
    location: { search: '?view=matrix' },
    mountPublishedNavigation: mount,
    ...extra,
  }) as { startAnalytics: (controller: AbortController) => Promise<void> };
}

await test('analytics entry reveals a terminal fallback for rejected or stalled entry chunks', async () => {
  for (const load of [
    () => Promise.reject(new Error('chunk unavailable')),
    () => new Promise<{ startAnalytics: (controller: AbortController) => Promise<void> }>(() => {}),
  ]) {
    const harness = await analyticsEntryHarness(load);
    await harness.run();
    assert.match(harness.app.innerHTML, /Unable to open the explorer/);
    assert.equal(harness.root.dataset.fontMode, 'fallback');
    assert.equal(harness.root.dataset.appReady, 'true');
    assert.equal(harness.classes.has('app-pending'), false);
    assert.equal(harness.early.signal.aborted, true);
  }
});

await test('late main evaluation and aborted initialization cannot replace the entry deadline error', async () => {
  const imported = deferred<{ startAnalytics: (controller: AbortController) => Promise<void> }>();
  const harness = await analyticsEntryHarness(() => imported.promise);
  await harness.run();
  const terminal = harness.app.innerHTML;
  let mounts = 0;
  const module = await inertMainModule(() => {
    mounts++;
    harness.app.innerHTML = 'late mount';
    return harness.app;
  });
  assert.equal(mounts, 0, 'module evaluation must not mount navigation');
  imported.resolve(module);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(mounts, 0, 'late import must not initialize');
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(module.startAnalytics(aborted), { name: 'AbortError' });
  assert.equal(mounts, 0, 'initializer must check the signal before touching DOM');
  assert.equal(harness.app.innerHTML, terminal);
  assert.equal(harness.root.dataset.fontMode, 'fallback');
});

await test('an initialized analytics view cannot apply late fonts or render after entry timeout', async () => {
  const fonts = deferred<FontMode>();
  let renders = 0;
  const imported = deferred<{ startAnalytics: (controller: AbortController) => Promise<void> }>();
  const harness = await analyticsEntryHarness(() => imported.promise);
  const module = await inertMainModule(() => harness.app, {
    document: { fonts: {}, documentElement: harness.root, visibilityState: 'visible' },
    waitForFonts: () => fonts.promise,
    waitForPresentation,
    abortInitialPresentation: () => {},
    viewUsesSpinner,
    appRoute,
    yieldToStartupPaint: () => Promise.resolve(),
    __matrixModule: async () => ({
      initMatrix: async () => {
        renders++;
        harness.app.innerHTML = 'late matrix';
      },
    }),
  });
  imported.resolve(module);
  await harness.run();
  const terminal = harness.app.innerHTML;
  fonts.resolve('custom');
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  assert.equal(renders, 0);
  assert.equal(harness.app.innerHTML, terminal);
  assert.equal(harness.root.dataset.fontMode, 'fallback');
  assert.equal(harness.root.dataset.appReady, 'true');
});
