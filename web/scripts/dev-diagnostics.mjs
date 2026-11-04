import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = '/__dev-diagnostics';
const ORIGIN = 'http://127.0.0.1:5173';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(['ready', 'state', 'check', 'end', 'error']);
const SOURCES = new Set([
  'init',
  'pointer',
  'keyboard',
  'control',
  'mutation',
  'finish',
  'pagehide',
  'runtime',
]);
const FIELDS = ['schemaVersion', 'runId', 'pageId', 'sequence', 'event', 'source', 'state'];
const STATE_FIELDS = [
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
];
// Preserve the deny defaults of the locked Vite version when adding our private directory.
const VITE_DENY = [
  '.env',
  '.env.*',
  '*.{crt,pem,key,p12,pfx,cer,der}',
  '.npmrc',
  '.yarnrc.yml',
  '**/.git/**',
];

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function bounded(value, max, integer = true) {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= max &&
      (!integer || Number.isInteger(value)))
  );
}
export function validDiagnosticsEvent(value, runId) {
  if (
    !exactKeys(value, FIELDS) ||
    value.schemaVersion !== 1 ||
    value.runId !== runId ||
    typeof value.pageId !== 'string' ||
    !UUID.test(value.pageId) ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    !EVENTS.has(value.event) ||
    !SOURCES.has(value.source)
  ) {
    return false;
  }
  const state = value.state;
  return (
    exactKeys(state, STATE_FIELDS) &&
    ['afr', 'other'].includes(state.view) &&
    ['relative', 'calendar', 'unknown'].includes(state.mode) &&
    ['cumulative', 'quarterly', 'unknown'].includes(state.metric) &&
    bounded(state.from, 20000) &&
    bounded(state.to, 20000) &&
    bounded(state.y, 1000000, false) &&
    Number.isInteger(state.selectionCount) &&
    state.selectionCount >= 0 &&
    state.selectionCount <= 256 &&
    ['tooltip', 'crosshair', 'marker', 'violation'].every(
      (key) => typeof state[key] === 'boolean',
    ) &&
    bounded(state.pointIndex, 20000) &&
    state.violation === (!state.tooltip && (state.crosshair || state.marker))
  );
}
function privatePath(url) {
  let decoded = url ?? '';
  for (let count = 0; count < 8; count += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    if (next === decoded) {
      break;
    }
    decoded = next;
  }
  const normalized = decoded.replaceAll('\\', '/').toLowerCase();
  return (
    normalized.includes('/data/diagnostics') ||
    normalized.includes('%') ||
    normalized.split(/[/?#]/).includes('..')
  );
}
// Run only after JSON.parse has established valid JSON syntax. Tracking the
// original property tokens also catches escaped spellings of duplicate keys.
function duplicateKeys(body) {
  const stack = [];
  for (const [token] of body.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g)) {
    if (token === '{' || token === '[') {
      stack.push({ object: token === '{', keys: new Set(), key: true });
    } else if (token === '}' || token === ']') {
      stack.pop();
    } else {
      const current = stack.at(-1);
      if (!current?.object) {
        continue;
      }
      if (token === ',') {
        current.key = true;
      } else if (token === ':') {
        current.key = false;
      } else if (current.key && token.startsWith('"')) {
        const key = JSON.parse(token);
        if (current.keys.has(key)) {
          return true;
        }
        current.keys.add(key);
      }
    }
  }
  return false;
}
function canonicalPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function header(req, name) {
  const entries = req.rawHeaders
    .filter((_, index) => index % 2 === 0)
    .filter((key) => key.toLowerCase() === name);
  return entries.length === 1 && typeof req.headers[name] === 'string' ? req.headers[name] : null;
}
function reply(req, res, status) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (status >= 400) {
    res.setHeader('Connection', 'close');
    req.resume();
  }
  res.writeHead(status);
  res.end(status < 300 ? '{"ok":true}' : '{"ok":false}');
}
function readBody(req, res, timeoutMs) {
  return new Promise((resolve) => {
    let bytes = 0;
    const chunks = [];
    let finished = false;
    const complete = (value, status) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      req.off('data', data);
      req.off('end', end);
      req.off('error', error);
      req.off('aborted', error);
      if (status && !res.destroyed) {
        reply(req, res, status);
      }
      resolve(value);
    };
    const data = (chunk) => {
      bytes += chunk.length;
      if (bytes > 4096) {
        complete(null, 413);
      } else {
        chunks.push(chunk);
      }
    };
    const end = () => complete(Buffer.concat(chunks).toString('utf8'));
    const error = () => complete(null);
    const timer = setTimeout(() => complete(null, 408), timeoutMs);
    req.on('data', data);
    req.on('end', end);
    req.on('error', error);
    req.on('aborted', error);
  });
}

export async function createDiagnosticsCollector({
  directory,
  runId = randomUUID(),
  token = randomBytes(32).toString('hex'),
  maxBytes = 2 * 1024 * 1024,
  maxRecords = 4096,
  bodyTimeoutMs = 1500,
} = {}) {
  if (
    canonicalPath(await realpath(path.dirname(directory))) !==
    canonicalPath(path.dirname(directory))
  ) {
    throw new Error('Diagnostics directory parent must not be redirected.');
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (canonicalPath(await realpath(directory)) !== canonicalPath(directory)) {
    throw new Error('Diagnostics directory must not be redirected.');
  }
  const filePath = path.join(directory, `${runId}.jsonl`);
  const file = await open(filePath, 'wx', 0o600);
  const pages = new Map();
  let bytes = 0;
  let records = 0;
  let pending = 0;
  let closed = false;
  let writer = Promise.resolve();
  let closing;
  const middleware = async (req, res, next) => {
    if (privatePath(req.url)) {
      return reply(req, res, 403);
    }
    if (req.url?.split('?')[0] !== ENDPOINT) {
      return next();
    }
    if (req.url !== ENDPOINT) {
      return reply(req, res, 400);
    }
    const supplied = header(req, 'x-drive-stats-diagnostics');
    if (req.method !== 'POST') {
      return reply(req, res, 405);
    }
    if (
      header(req, 'host') !== '127.0.0.1:5173' ||
      header(req, 'origin') !== ORIGIN ||
      header(req, 'content-type') !== 'application/json' ||
      !supplied ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    ) {
      return reply(req, res, 403);
    }
    if (
      req.headers['content-encoding'] !== undefined ||
      req.headers['transfer-encoding'] !== undefined ||
      header(req, 'content-length') === null ||
      !/^\d+$/.test(req.headers['content-length']) ||
      Number(req.headers['content-length']) > 4096
    ) {
      return reply(req, res, 413);
    }
    if (closed || pending >= 128) {
      return reply(req, res, 503);
    }
    pending += 1;
    try {
      const body = await readBody(req, res, bodyTimeoutMs);
      if (body === null) {
        return;
      }
      let event;
      try {
        event = JSON.parse(body);
      } catch {
        return reply(req, res, 400);
      }
      if (duplicateKeys(body) || !validDiagnosticsEvent(event, runId)) {
        return reply(req, res, 400);
      }
      const write = async () => {
        if (closed) {
          return reply(req, res, 503);
        }
        const previous = pages.get(event.pageId);
        if (
          (!previous && (pages.size >= 32 || event.event !== 'ready' || event.sequence !== 1)) ||
          (previous &&
            (previous.ended || event.event === 'ready' || event.sequence <= previous.sequence))
        ) {
          return reply(req, res, 409);
        }
        const line = `${JSON.stringify({ ...event, utc: new Date().toISOString(), lostBefore: previous ? event.sequence - previous.sequence - 1 : 0 })}\n`;
        const size = Buffer.byteLength(line);
        if (records >= maxRecords || bytes + size > maxBytes) {
          return reply(req, res, 507);
        }
        try {
          await file.writeFile(line);
          bytes += size;
          records += 1;
          pages.set(event.pageId, { sequence: event.sequence, ended: event.event === 'end' });
          reply(req, res, 200);
        } catch {
          closed = true;
          reply(req, res, 503);
        }
      };
      writer = writer.then(write);
      await writer;
    } finally {
      pending -= 1;
    }
  };
  return {
    runId,
    token,
    filePath,
    middleware,
    async close() {
      closed = true;
      closing ??= (async () => {
        await writer;
        try {
          await file.sync();
        } finally {
          await file.close();
        }
      })();
      await closing;
    },
  };
}

export function devDiagnosticsPlugin() {
  let enabled = process.env.DRIVE_STATS_DIAGNOSTICS === '1';
  let collector;
  return {
    name: 'drive-stats-private-diagnostics',
    apply(_config, env) {
      enabled = enabled && env.command === 'serve' && !env.isPreview;
      return enabled;
    },
    config(config) {
      if (!enabled) {
        return;
      }
      if (
        (config.server?.host !== undefined && config.server.host !== '127.0.0.1') ||
        (config.server?.port !== undefined && config.server.port !== 5173) ||
        config.server?.strictPort === false ||
        config.server?.https ||
        config.server?.middlewareMode
      ) {
        throw new Error('Diagnostics require the dedicated loopback development server.');
      }
      return {
        server: {
          host: '127.0.0.1',
          port: 5173,
          strictPort: true,
          fs: {
            deny: [...VITE_DENY, ...(config.server?.fs?.deny ?? []), '**/data/diagnostics/**'],
          },
        },
      };
    },
    configResolved(config) {
      if (
        enabled &&
        (config.server.host !== '127.0.0.1' ||
          config.server.port !== 5173 ||
          !config.server.strictPort ||
          config.server.https ||
          config.server.middlewareMode)
      ) {
        throw new Error('Diagnostics require the dedicated loopback development server.');
      }
    },
    async configureServer(server) {
      if (!enabled) {
        return;
      }
      const directory = fileURLToPath(new URL('../../data/diagnostics/', import.meta.url));
      collector = await createDiagnosticsCollector({ directory });
      server.middlewares.use((req, res, next) => {
        void collector.middleware(req, res, next).catch(() => {
          if (!res.headersSent) {
            reply(req, res, 503);
          } else {
            res.destroy();
          }
        });
      });
      server.httpServer?.once('close', () => {
        void collector.close().catch(() => {});
      });
    },
    async transformIndexHtml() {
      if (!enabled || !collector) {
        return;
      }
      const client = await readFile(
        new URL('./dev-diagnostics-client.mjs', import.meta.url),
        'utf8',
      );
      const config = JSON.stringify({
        runId: collector.runId,
        token: collector.token,
        endpoint: ENDPOINT,
      });
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `import { createHotContext } from '/@vite/client';\n${client.replace(/^export /gm, '')}\nconst diagnosticsSession = startDiagnostics(${config}, window);\nconst diagnosticsHot = createHotContext('/__dev-diagnostics-client');\nconst stopDiagnostics = () => diagnosticsSession.teardown();\ndiagnosticsHot.on('vite:beforeUpdate', stopDiagnostics);\ndiagnosticsHot.on('vite:beforeFullReload', stopDiagnostics);\ndiagnosticsHot.dispose(stopDiagnostics);`,
          injectTo: 'body',
        },
      ];
    },
    async closeBundle() {
      await collector?.close();
    },
  };
}
