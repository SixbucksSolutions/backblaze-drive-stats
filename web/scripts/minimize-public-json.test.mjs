import assert from 'node:assert/strict';
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import {
  expectedPublicBytes,
  minimizePublicJson,
  publicJsonPaths,
} from './minimize-public-json.mjs';

async function fixture() {
  const base = await realpath(tmpdir());
  const root = await mkdtemp(join(base, 'compact-public-'));
  await mkdir(join(root, 'dist/data'), { recursive: true });
  await mkdir(join(root, 'dist/fonts'));
  const source = Buffer.from(
    '{\n  "number": 9007199254740993, "label": "a  b", "negative": -0\n}\n',
  );
  for (const path of publicJsonPaths) {
    await writeFile(join(root, 'dist', path), source);
  }
  return { root, base, source };
}

async function cleanup(root, base) {
  assert.equal(dirname(root), base);
  assert.ok(basename(root).startsWith('compact-public-'));
  await rm(root, { recursive: true, force: true });
}

await test('Only reviewed mutable JSON copies compact; hard-linked source bytes stay unchanged', async () => {
  const { root, base, source } = await fixture();
  try {
    const original = join(root, 'original.json');
    await unlink(join(root, 'dist/data/index.json'));
    await writeFile(original, source);
    await link(original, join(root, 'dist/data/index.json'));
    await writeFile(join(root, 'dist/data/immutable.hash.json'), source);
    const changed = await minimizePublicJson(root);
    assert.equal(changed.length, 3);
    assert.ok(changed.every((entry) => entry.afterBytes < entry.beforeBytes));
    for (const path of publicJsonPaths) {
      assert.deepEqual(
        await readFile(join(root, 'dist', path)),
        await expectedPublicBytes(path, source),
      );
    }
    assert.deepEqual(await readFile(original), source);
    assert.deepEqual(await readFile(join(root, 'dist/data/immutable.hash.json')), source);
    const repeated = await minimizePublicJson(root);
    assert.ok(repeated.every((entry) => entry.beforeBytes === entry.afterBytes));
    assert.equal(await expectedPublicBytes('fonts/font.woff2', source), source);
    assert.equal(await expectedPublicBytes('data/production/immutable.json', source), source);
  } finally {
    await cleanup(root, base);
  }
});

await test('Malformed later input and directory aliases fail before mutable JSON writes', async () => {
  const { root, base, source } = await fixture();
  try {
    await writeFile(join(root, 'dist/fonts/provenance.json'), 'not json');
    await assert.rejects(minimizePublicJson(root));
    assert.deepEqual(await readFile(join(root, 'dist/data/index.json')), source);
    await unlink(join(root, 'dist/fonts/provenance.json'));
    await rmdir(join(root, 'dist/fonts'));
    await mkdir(join(root, 'other'));
    await writeFile(join(root, 'other/provenance.json'), source);
    await symlink(join(root, 'other'), join(root, 'dist/fonts'), 'junction');
    await assert.rejects(minimizePublicJson(root), /real/);
    assert.deepEqual(await readFile(join(root, 'dist/data/index.json')), source);
    await unlink(join(root, 'dist/fonts'));
  } finally {
    await cleanup(root, base);
  }
});
