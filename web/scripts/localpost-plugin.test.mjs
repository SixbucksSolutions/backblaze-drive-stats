import assert from 'node:assert/strict';
import test from 'node:test';
import { localpostPlugin } from './localpost-plugin.mjs';
import { resolveConfig } from 'vite';

const environment = {
  DRIVE_STATS_LOCALPOST: '1',
  LOCALPOST_RUN_ID: '52bcbf1f-e744-4f8d-a038-7f51bdf6024f',
  LOCALPOST_MESSAGE_URL:
    'http://127.0.0.1:53147/registrations/f737b3e8-f66b-4196-ac22-b7ce959e4e87/messages',
};

test('ordinary dev, build and preview do not inject or initialize transport', async () => {
  for (const [env, command, isPreview] of [
    [{}, 'serve', false],
    [environment, 'build', false],
    [environment, 'serve', true],
  ]) {
    const plugin = localpostPlugin(env);
    assert.equal(plugin.apply({}, { command, isPreview }), false);
    assert.equal(plugin.config(), undefined);
    assert.equal(await plugin.transformIndexHtml(), undefined);
    assert.equal(plugin.configureServer, undefined);
  }
});

test('dedicated development plugin embeds validated sender and confines fs to web root', async () => {
  const plugin = localpostPlugin(environment);
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
  assert.equal(tags[0].children.includes("from './localpost-protocol.mjs'"), false);
  assert.throws(() => plugin.configResolved({ server: { ...config.server, host: '0.0.0.0' } }));
});

test('invalid registration routes cannot be embedded', () => {
  for (const endpoint of [
    'https://127.0.0.1:53147/registrations/x/messages',
    'http://example.com/registrations/x/messages',
    `${environment.LOCALPOST_MESSAGE_URL}?secret=x`,
  ]) {
    const plugin = localpostPlugin({ ...environment, LOCALPOST_MESSAGE_URL: endpoint });
    plugin.apply({}, { command: 'serve', isPreview: false });
    assert.throws(() => plugin.config());
  }
});

test('actual Vite config resolution preserves the confined development setup', async () => {
  const config = await resolveConfig({ plugins: [localpostPlugin(environment)] }, 'serve');
  assert.equal(config.server.host, '127.0.0.1');
  assert.equal(config.server.fs.allow.length, 1);
});
