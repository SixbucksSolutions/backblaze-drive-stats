// Only these mutable, unhashed public JSON copies may change representation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { minimizeJsonBytes } from './minimized-json.mjs';
import { minifyHtml } from './minimize-static-assets.mjs';

export const publicJsonPaths = Object.freeze([
  'data/index.json',
  'data/2026-Q2.json',
  'fonts/provenance.json',
]);

/** Expected deployed representation derived from the unchanged public source. */
export async function expectedPublicBytes(path, bytes) {
  if (path === '404.html') {
    return Buffer.from(await minifyHtml(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  }
  return publicJsonPaths.includes(path) ? minimizeJsonBytes(bytes) : bytes;
}

async function realDirectory(path) {
  const stats = await lstat(path);
  assert.ok(stats.isDirectory() && !stats.isSymbolicLink(), 'JSON build directory must be real');
  assert.equal(await realpath(path), path, 'JSON build directory must not traverse aliases');
}

export async function minimizePublicJson(webRoot) {
  const root = resolve(webRoot);
  await realDirectory(root);
  const dist = resolve(root, 'dist');
  await realDirectory(dist);
  const changes = [];
  for (const path of publicJsonPaths) {
    const target = resolve(dist, path);
    await realDirectory(dirname(target));
    const stats = await lstat(target);
    assert.ok(stats.isFile() && !stats.isSymbolicLink(), 'JSON target must be a regular file');
    const before = await readFile(target);
    const after = minimizeJsonBytes(before);
    assert.ok(after.length <= before.length, 'JSON compaction must not enlarge an asset');
    changes.push({ path, target, before, after });
  }
  for (const { target, before, after } of changes) {
    if (before.equals(after)) {
      continue;
    }
    const temporary = resolve(dirname(target), `.compact-${randomUUID()}.tmp`);
    let created = false;
    try {
      await writeFile(temporary, after, { flag: 'wx' });
      created = true;
      await rename(temporary, target);
      created = false;
    } finally {
      if (created) {
        await unlink(temporary);
      }
    }
  }
  return changes.map(({ path, before, after }) => ({
    path,
    beforeBytes: before.length,
    afterBytes: after.length,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'Usage: minimize-public-json.mjs');
  console.log(
    JSON.stringify(
      await minimizePublicJson(resolve(dirname(fileURLToPath(import.meta.url)), '..')),
    ),
  );
}
