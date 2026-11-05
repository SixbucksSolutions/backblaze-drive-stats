import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function serviceUrl(value = 'http://127.0.0.1:53147') {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{4,5}\/?$/.test(value)) {
    throw new Error('LOCALPOST_URL must be plain HTTP on 127.0.0.1 with only a service port.');
  }
  const url = new URL(value);
  const port = Number(url.port || 80);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    port < 1024 ||
    port > 65535
  ) {
    throw new Error('LOCALPOST_URL must be plain HTTP on 127.0.0.1 with only a service port.');
  }
  return url.origin;
}

async function boundedJson(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > 1024) {
      await reader.cancel();
      throw new Error('Invalid localpost response.');
    }
    chunks.push(...value);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(chunks)));
}

// Read only a bounded command line; never interpret input as code or a path.
export function attachStopCommand(input, stop) {
  let line = '';
  let overflow = false;
  let attached = true;
  const detach = () => {
    if (!attached) {
      return;
    }
    attached = false;
    input.off('data', data);
    input.pause();
  };
  const data = (chunk) => {
    for (const character of chunk.toString()) {
      if (character === '\n') {
        const command = line.endsWith('\r') ? line.slice(0, -1) : line;
        if (!overflow && command === 'stop') {
          detach();
          stop();
          return;
        }
        line = '';
        overflow = false;
      } else if (!overflow) {
        if (line.length < 64) {
          line += character;
        } else {
          line = '';
          overflow = true;
        }
      }
    }
  };
  input.on('data', data);
  return detach;
}

export async function startLocalpost({
  environment = process.env,
  fetcher = fetch,
  createVite,
  root = webRoot,
  log = console.log,
  shouldStop = () => false,
} = {}) {
  const base = serviceUrl(environment.LOCALPOST_URL);
  const runId = randomUUID();
  const parent = resolve(root, '../data/localpost');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  if ((await realpath(parent)).toLowerCase() !== parent.toLowerCase()) {
    throw new Error('localpost inbox parent must not be redirected.');
  }
  const directory = resolve(parent, runId);
  await mkdir(directory, { mode: 0o700 });
  if ((await realpath(directory)).toLowerCase() !== directory.toLowerCase()) {
    throw new Error('localpost inbox must not be redirected.');
  }
  let id;
  let server;
  let stopping;
  const stop = () => {
    stopping ??= (async () => {
      let failed = false;
      try {
        await server?.close();
      } catch {
        failed = true;
      }
      if (id) {
        try {
          const response = await fetcher(`${base}/registrations/${id}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(35000),
            credentials: 'omit',
            redirect: 'error',
          });
          if (response.status !== 200) {
            await response.body?.cancel();
            failed = true;
          } else {
            const result = await boundedJson(response);
            if (
              !result ||
              Object.keys(result).length !== 3 ||
              result.id !== id ||
              result.unregistered !== true ||
              result.forced !== false
            ) {
              failed = true;
            }
          }
        } catch {
          failed = true;
        }
      }
      if (failed) {
        throw new Error('localpost cleanup incomplete; inspect the owned registration.');
      }
    })();
    return stopping;
  };
  try {
    let registration;
    try {
      const response = await fetcher(`${base}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory }),
        signal: AbortSignal.timeout(5000),
        credentials: 'omit',
        redirect: 'error',
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error('registration');
      }
      registration = await boundedJson(response);
    } catch {
      throw new Error(
        `localpost registration failed or response uncertain; no retry. Ask the shared-service owner to inspect it. Inbox: ${directory}`,
      );
    }
    if (typeof registration?.id === 'string' && uuid4.test(registration.id)) {
      id = registration.id;
    }
    if (!id || Object.keys(registration).length !== 1) {
      throw new Error(
        'Invalid localpost registration response; ask the shared-service owner to inspect it.',
      );
    }
    log(`localpost run: ${runId}\nInbox: ${directory}\nRegistration: ${id}`);
    if (shouldStop()) {
      await stop();
      return { stop, runId, directory, id };
    }
    // Configuration exists only for this owned Vite instance; normal commands do not register.
    const { localpostPlugin } = await import('./localpost-plugin.mjs');
    server = await createVite({
      root,
      plugins: [
        localpostPlugin({
          DRIVE_STATS_LOCALPOST: '1',
          LOCALPOST_RUN_ID: runId,
          LOCALPOST_MESSAGE_URL: `${base}/registrations/${id}/messages`,
        }),
      ],
      server: { host: '127.0.0.1', port: 5173, strictPort: true },
    });
    await server.listen();
    server.httpServer?.once('close', () => {
      void stop().catch(() => {
        log('localpost cleanup incomplete; inspect the owned registration.');
      });
    });
    server.printUrls();
    return { stop, runId, directory, id };
  } catch (error) {
    try {
      await stop();
    } catch {
      throw new Error('localpost startup failed and owned registration cleanup failed.');
    }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let session;
  let requestedStop = false;
  let detachInput = () => {};
  const stop = () => {
    requestedStop = true;
    detachInput();
    void session?.stop().catch(() => {
      console.error('localpost cleanup incomplete.');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  detachInput = attachStopCommand(process.stdin, stop);
  try {
    const { createServer } = await import('vite');
    session = await startLocalpost({ createVite: createServer, shouldStop: () => requestedStop });
    if (requestedStop) {
      await session.stop();
    } else {
      console.log('Type stop and press Enter to close this localpost session.');
    }
  } catch {
    detachInput();
    console.error(
      'localpost development startup failed; the shared-service owner may need to inspect an uncertain registration. No retry was made.',
    );
    process.exitCode = 1;
  }
}
