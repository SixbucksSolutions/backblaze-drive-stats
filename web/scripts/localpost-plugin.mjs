import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function localpostPlugin(environment = process.env) {
  const enabled = environment.DRIVE_STATS_LOCALPOST === '1';
  let active = false;
  let runId;
  let endpoint;
  return {
    name: 'drive-stats-localpost',
    apply(_config, env) {
      active = enabled && env.command === 'serve' && !env.isPreview;
      return active;
    },
    config() {
      if (!active) {
        return;
      }
      runId = environment.LOCALPOST_RUN_ID;
      endpoint = environment.LOCALPOST_MESSAGE_URL;
      const url = new URL(endpoint);
      if (
        !uuid.test(runId ?? '') ||
        endpoint !== url.href ||
        url.protocol !== 'http:' ||
        url.hostname !== '127.0.0.1' ||
        Number(url.port) < 1024 ||
        Number(url.port) > 65535 ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/api\/2026-11-05\/registrations\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/messages$/.test(
          url.pathname,
        )
      ) {
        throw new Error('Invalid localpost development configuration.');
      }
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
        throw new Error('localpost requires the dedicated loopback development server.');
      }
    },
    async transformIndexHtml() {
      if (!active) {
        return;
      }
      const [protocol, client] = await Promise.all([
        readFile(new URL('./localpost-protocol.mjs', import.meta.url), 'utf8'),
        readFile(new URL('./localpost-client.mjs', import.meta.url), 'utf8'),
      ]);
      const source = client.replace(
        "import { validDiagnosticEvent } from './localpost-protocol.mjs';",
        '',
      );
      const config = JSON.stringify({ runId, endpoint }).replaceAll('<', '\\u003c');
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          injectTo: 'body',
          children: `import { createHotContext } from '/@vite/client';\n${protocol.replace(/^export /gm, '')}\n${source.replace(/^export /gm, '')}\nconst localpostSession = startDiagnostics(${config}, window);\nconst localpostHot = createHotContext('/localpost-client');\nconst stopLocalpost = () => localpostSession.teardown();\nlocalpostHot.on('vite:beforeUpdate', stopLocalpost);\nlocalpostHot.on('vite:beforeFullReload', stopLocalpost);\nlocalpostHot.dispose(stopLocalpost);`,
        },
      ];
    },
  };
}
