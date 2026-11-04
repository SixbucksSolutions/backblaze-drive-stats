import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const forbidden = [
  '__dev-diagnostics',
  'dev-diagnostics-client',
  'dev-diagnostics-status',
  'X-Drive-Stats-Diagnostics',
  'DRIVE_STATS_DIAGNOSTICS',
];

export async function checkDiagnosticsExcluded(directory) {
  let checked = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Production assets must not be symbolic links');
    const path = join(directory, entry.name);
    for (const marker of forbidden) {
      assert.ok(!entry.name.includes(marker), `Development diagnostics file in release: ${path}`);
    }
    if (entry.isDirectory()) {
      checked += await checkDiagnosticsExcluded(path);
    } else if (/\.(?:html|js|css|json|map)$/i.test(entry.name)) {
      const text = await readFile(path, 'utf8');
      for (const marker of forbidden) {
        assert.ok(!text.includes(marker), `Development diagnostics marker in release: ${path}`);
      }
      checked++;
    }
  }
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checked = await checkDiagnosticsExcluded(
    resolve(dirname(fileURLToPath(import.meta.url)), '../dist'),
  );
  assert.ok(checked > 0, 'Production assets are missing');
  console.log(JSON.stringify({ developmentDiagnosticsExcluded: true, assetsChecked: checked }));
}
