import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const forbidden = ['localpost', 'LOCALPOST_'];

export async function checkLocalpostExcluded(directory) {
  let checked = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Production assets must not be symbolic links');
    const path = join(directory, entry.name);
    for (const marker of forbidden) {
      assert.ok(!entry.name.includes(marker), `Localpost development file in release: ${path}`);
    }
    if (entry.isDirectory()) {
      checked += await checkLocalpostExcluded(path);
    } else if (/\.(?:html|js|css|json|map)$/i.test(entry.name)) {
      const text = await readFile(path, 'utf8');
      for (const marker of forbidden) {
        assert.ok(!text.includes(marker), `Localpost development marker in release: ${path}`);
      }
      checked++;
    }
  }
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checked = await checkLocalpostExcluded(
    resolve(dirname(fileURLToPath(import.meta.url)), '../dist'),
  );
  assert.ok(checked > 0, 'Production assets are missing');
  console.log(JSON.stringify({ localpostExcluded: true, assetsChecked: checked }));
}
