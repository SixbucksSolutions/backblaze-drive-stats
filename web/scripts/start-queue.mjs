import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queueBaseUrl, queueCommand, queueFailureCode } from './queue-cli.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const failurePhases = new Set(['endpoint', 'register', 'vite', 'close', 'delete', 'startup']);

export function queueFailureReport(error) {
  return {
    error: {
      code: queueFailureCode(error, 'client_failure'),
      phase: failurePhases.has(error?.phase) ? error.phase : 'startup',
    },
  };
}

function launcherFailure(error, phase) {
  const code = queueFailureCode(error, 'client_failure');
  return Object.assign(new Error(`Queue ${phase} failed (${code}).`), { code, phase });
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

export async function startQueue({
  environment = process.env,
  command = queueCommand,
  createVite,
  root = webRoot,
  log = console.log,
  shouldStop = () => false,
} = {}) {
  let base;
  try {
    base = queueBaseUrl(environment.MESSAGE_QUEUE_URL);
  } catch (error) {
    throw launcherFailure(error, 'endpoint');
  }
  const runId = randomUUID();
  let id;
  let server;
  let stopping;
  const stop = () => {
    stopping ??= (async () => {
      let failure;
      try {
        await server?.close();
      } catch (error) {
        failure = launcherFailure(error, 'close');
      }
      if (id) {
        try {
          const result = await command(base, ['delete', id]);
          if (
            !result ||
            Object.keys(result).length !== 2 ||
            result.id !== id ||
            typeof result.deleted !== 'boolean'
          ) {
            throw Object.assign(new Error('receipt'), { code: 'invalid_response' });
          }
        } catch (error) {
          failure ??= launcherFailure(error, 'delete');
        }
      }
      if (failure) {
        throw failure;
      }
    })();
    return stopping;
  };
  let phase = 'register';
  try {
    let registration;
    try {
      registration = await command(base, ['register']);
    } catch (error) {
      throw launcherFailure(error, phase);
    }
    if (typeof registration?.id === 'string' && uuid4.test(registration.id)) {
      id = registration.id;
    }
    if (!id || Object.keys(registration).length !== 1) {
      throw launcherFailure({ code: 'invalid_response' }, phase);
    }
    log(`Queue run: ${runId}\nMailbox: ${id}\nEndpoint: ${base}`);
    if (shouldStop()) {
      await stop();
      return { stop, runId, id };
    }
    phase = 'vite';
    const { queuePlugin } = await import('./queue-plugin.mjs');
    server = await createVite({
      root,
      plugins: [
        queuePlugin({
          DRIVE_STATS_QUEUE: '1',
          MESSAGE_QUEUE_RUN_ID: runId,
          MESSAGE_QUEUE_ID: id,
          MESSAGE_QUEUE_URL: base,
        }),
      ],
      server: { host: '127.0.0.1', port: 5173, strictPort: true },
    });
    await server.listen();
    server.httpServer?.once('close', () => {
      void stop().catch((error) => log(JSON.stringify(queueFailureReport(error))));
    });
    server.printUrls();
    return { stop, runId, id };
  } catch (error) {
    try {
      await stop();
    } catch (cleanupError) {
      log(JSON.stringify(queueFailureReport(cleanupError)));
    }
    throw launcherFailure(error, failurePhases.has(error?.phase) ? error.phase : phase);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let session;
  let requestedStop = false;
  let detachInput = () => {};
  const stop = () => {
    requestedStop = true;
    detachInput();
    void session?.stop().catch((error) => {
      console.error(JSON.stringify(queueFailureReport(error)));
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  detachInput = attachStopCommand(process.stdin, stop);
  try {
    const { createServer } = await import('vite');
    session = await startQueue({ createVite: createServer, shouldStop: () => requestedStop });
    if (requestedStop) {
      await session.stop();
    } else {
      console.log('Type stop and press Enter to close this queue session.');
    }
  } catch (error) {
    detachInput();
    console.error(JSON.stringify(queueFailureReport(error)));
    process.exitCode = 1;
  }
}
