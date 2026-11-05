import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queueBaseUrl } from './queue-cli.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function queuePlugin(environment = process.env) {
  const enabled = environment.DRIVE_STATS_QUEUE === '1';
  let active = false;
  let runId;
  let endpoint;
  return {
    name: 'drive-stats-queue',
    apply(_config, env) {
      active = enabled && env.command === 'serve' && !env.isPreview;
      return active;
    },
    config() {
      if (!active) {
        return;
      }
      runId = environment.MESSAGE_QUEUE_RUN_ID;
      const id = environment.MESSAGE_QUEUE_ID;
      if (
        !uuid.test(runId ?? '') ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id ?? '')
      ) {
        throw new Error('Invalid queue development configuration.');
      }
      endpoint = `${queueBaseUrl(environment.MESSAGE_QUEUE_URL)}/XADD/${encodeURIComponent(`localpost:v1:${id}`)}/*/data`;
      return {
        server: {
          host: '127.0.0.1',
          port: 5173,
          strictPort: true,
          fs: {
            strict: true,
            allow: [webRoot],
            deny: [
              '.env',
              '.env.*',
              '*.{crt,pem,key,p12,pfx,cer,der}',
              '.npmrc',
              '.yarnrc.yml',
              '**/.git/**',
            ],
          },
        },
      };
    },
    configResolved(config) {
      if (
        active &&
        (config.server.host !== '127.0.0.1' ||
          config.server.port !== 5173 ||
          !config.server.strictPort ||
          config.server.https ||
          config.server.middlewareMode ||
          config.server.fs.strict !== true ||
          config.server.fs.allow.length !== 1 ||
          resolve(config.server.fs.allow[0]) !== resolve(webRoot))
      ) {
        throw new Error('queue requires the dedicated loopback development server.');
      }
    },
    async transformIndexHtml() {
      if (!active) {
        return;
      }
      const [protocol, client] = await Promise.all([
        readFile(new URL('./diagnostic-protocol.mjs', import.meta.url), 'utf8'),
        readFile(new URL('./queue-client.mjs', import.meta.url), 'utf8'),
      ]);
      const source = client.replace(
        "import { validDiagnosticEvent, validStreamId } from './diagnostic-protocol.mjs';",
        '',
      );
      const config = JSON.stringify({ runId, endpoint }).replaceAll('<', '\\u003c');
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          injectTo: 'body',
          children: `import { createHotContext } from '/@vite/client';\n${protocol.replace(/^export /gm, '')}\n${source.replace(/^export /gm, '')}\nconst queueSession = startDiagnostics(${config}, window);\nconst queueHot = createHotContext('/queue-client');\nconst stopQueue = () => queueSession.teardown();\nqueueHot.on('vite:beforeUpdate', stopQueue);\nqueueHot.on('vite:beforeFullReload', stopQueue);\nqueueHot.dispose(stopQueue);`,
        },
      ];
    },
  };
}
