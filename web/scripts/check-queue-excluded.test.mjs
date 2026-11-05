import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkQueueExcluded } from './check-queue-excluded.mjs';

test('production exclusion rejects diagnostic code in nested assets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drive-stats-build-check-'));
  try {
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<main>Production page</main>');
    const script = join(directory, 'assets/chart.js');
    await writeFile(script, 'const chart = 1;');
    assert.equal(await checkQueueExcluded(directory), 2);
    await writeFile(script, 'fetch("http://127.0.0.1:53170/XADD/localpost:v1:test/*/data");');
    await assert.rejects(checkQueueExcluded(directory), /Queue development marker/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
