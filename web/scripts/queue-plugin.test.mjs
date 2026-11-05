import assert from 'node:assert/strict';
import test from 'node:test';
import { queuePlugin } from './queue-plugin.mjs';
import { resolveConfig } from 'vite';

const environment = {
  DRIVE_STATS_QUEUE: '1',
  MESSAGE_QUEUE_RUN_ID: '52bcbf1f-e744-4f8d-a038-7f51bdf6024f',
  MESSAGE_QUEUE_URL: 'http://127.0.0.1:53170',
  MESSAGE_QUEUE_ID: 'f737b3e8-f66b-4196-ac22-b7ce959e4e87',
};

test('ordinary dev, build and preview do not inject or initialize transport', async () => {
  for (const [env, command, isPreview] of [
    [{}, 'serve', false],
    [environment, 'build', false],
    [environment, 'serve', true],
  ]) {
    const plugin = queuePlugin(env);
    assert.equal(plugin.apply({}, { command, isPreview }), false);
    assert.equal(plugin.config(), undefined);
    assert.equal(await plugin.transformIndexHtml(), undefined);
    assert.equal(plugin.configureServer, undefined);
  }
});

test('dedicated development plugin embeds validated sender and confines fs to web root', async () => {
  const plugin = queuePlugin(environment);
  assert.equal(plugin.apply({}, { command: 'serve', isPreview: false }), true);
  const config = plugin.config();
  assert.equal(config.server.fs.strict, true);
  assert.equal(config.server.fs.allow.length, 1);
  assert.match(config.server.fs.allow[0].replaceAll('\\', '/'), /\/web\/?$/);
  plugin.configResolved(config);
  const tags = await plugin.transformIndexHtml();
  assert.match(tags[0].children, /validDiagnosticEvent/);
  assert.match(tags[0].children, /vite:beforeUpdate/);
  assert.match(tags[0].children, /credentials: 'omit'/);
  assert.equal(tags[0].children.includes("from './diagnostic-protocol.mjs'"), false);
  assert.throws(() => plugin.configResolved({ server: { ...config.server, host: '0.0.0.0' } }));
});

test('invalid queue configuration cannot be embedded', () => {
  for (const configuration of [
    { MESSAGE_QUEUE_URL: 'https://127.0.0.1:53170' },
    { MESSAGE_QUEUE_URL: 'http://localhost:53170' },
    { MESSAGE_QUEUE_URL: 'http://127.0.0.1:53170/api/2026-11-05' },
    { MESSAGE_QUEUE_URL: 'http://127.0.0.1:53170/?secret=x' },
    { MESSAGE_QUEUE_ID: environment.MESSAGE_QUEUE_ID.toUpperCase() },
    { MESSAGE_QUEUE_ID: '../other' },
    { MESSAGE_QUEUE_RUN_ID: 'invalid' },
  ]) {
    const plugin = queuePlugin({ ...environment, ...configuration });
    plugin.apply({}, { command: 'serve', isPreview: false });
    assert.throws(() => plugin.config());
  }
});

test('actual Vite config resolution preserves the confined development setup', async () => {
  const config = await resolveConfig({ plugins: [queuePlugin(environment)] }, 'serve');
  assert.equal(config.server.host, '127.0.0.1');
  assert.equal(config.server.fs.allow.length, 1);
});
