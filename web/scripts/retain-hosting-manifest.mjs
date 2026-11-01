// Vite/Rolldown emits manifests inside outDir. Retain build evidence outside the
// upload tree, removing only the known manifest and its now-empty directory.
import assert from 'node:assert/strict';
import { lstat, readFile, readdir, rename, rmdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function retainHostingManifest(webRoot) {
  const directory = resolve(webRoot, 'dist/.vite');
  const input = resolve(directory, 'manifest.json');
  assert.ok(
    (await lstat(directory)).isDirectory(),
    'Vite manifest directory must be a real directory',
  );
  assert.deepEqual(
    await readdir(directory),
    ['manifest.json'],
    'Unexpected Vite output beside build manifest',
  );
  assert.ok((await lstat(input)).isFile(), 'Vite manifest must be a regular file');
  const manifest = JSON.parse(await readFile(input, 'utf8'));
  assert.ok(
    manifest && typeof manifest === 'object' && !Array.isArray(manifest),
    'Invalid Vite build manifest',
  );
  await rename(input, resolve(webRoot, 'hosting-vite-manifest.json'));
  await rmdir(directory);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'Usage: retain-hosting-manifest.mjs');
  await retainHostingManifest(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('Vite build manifest retained outside public dist.');
}
