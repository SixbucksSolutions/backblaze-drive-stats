// Release gate: consume every committed public artifact through the browser reader.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SnapshotLoader } from '../src/snapshot-loader.ts';
import { parseStrictJson } from '../src/production-data.ts';
import { activeReleaseSelection } from './active-release-selection.ts';
import { snapshotAvailable } from '../src/snapshot-availability.ts';

export function assertMinimumCapacity(selection, requiredMinimumCapacityTB) {
  if (requiredMinimumCapacityTB !== undefined) {
    assert.equal(
      selection.minimumCapacityTB,
      requiredMinimumCapacityTB,
      'Production snapshot minimum capacity differs from active release',
    );
  }
}

export function assertSnapshotAvailability(descriptor, matrix) {
  const { context } = descriptor;
  const hasContext = context.selection.contextModelIds.length > 0;
  const actual = {
    // The browser reader already proves analysis membership and threshold
    // anchors. Partial source capture can leave every display cell unavailable
    // while those models still have a valid qualification lower-bound proof.
    matrix: matrix.models.length > 0,
    deployments: hasContext,
    distribution: hasContext,
    manufacturers: hasContext,
    capacity: context.inventory.length > 0,
    datacenters:
      context.coverage.find((row) => row.quarter === context.asOfQuarter)
        ?.datacenterFieldAvailable === true,
  };
  for (const [view, available] of Object.entries(actual)) {
    assert.equal(
      available,
      snapshotAvailable(context.asOfQuarter, view),
      `Snapshot ${view} availability differs from reviewed release bounds`,
    );
  }
}

/** Conservative publication check for free text as well as schema-owned fields.
 * This detects recognizable leaks; it cannot establish source authenticity or
 * recognize arbitrary undisclosed identities. Never print rejected values.
 */
export function assertPublicValues(value) {
  if (typeof value === 'string') {
    assert.ok(!/\b(?:sample|synthetic|fictional)\b/i.test(value), 'Synthetic production label');
    assert.ok(
      !/\b(?:serial_number|serialNumber|b2_access_key|b2_secret_access_key)\b/i.test(value),
      'Private production field',
    );
    const urls = value.match(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>]+/g) ?? [];
    const prose = value.replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>]+/g, '');
    assert.ok(
      !/[\\]|[A-Za-z]:[\\/]|\bfile:|(?<![\w:/])\/[^\s/]+/.test(prose) &&
        !/\b(?:token|password|secret|access_key|authorization)\s*[:=]/i.test(prose),
      'Private production path or credential',
    );
    for (const token of urls) {
      let url;
      try {
        url = new URL(token.replace(/[.,);\]]+$/, ''));
      } catch {
        // Native URL errors retain the rejected input, including credentials.
        throw new Error('Malformed production URL');
      }
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      assert.ok(
        url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          host.includes('.') &&
          !isIP(host.replace(/^\[|\]$/g, '')) &&
          !/(?:^|\.)(?:localhost|local|internal|localdomain|lan|home|corp|onion|invalid|test)$/.test(
            host,
          ) &&
          !host.endsWith('.home.arpa'),
        'Private or credential-bearing production URL',
      );
    }
  } else if (Array.isArray(value)) {
    value.forEach(assertPublicValues);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertPublicValues(key);
      assertPublicValues(child);
    }
  }
}

async function publicFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Public production graph must not contain symlinks');
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await publicFiles(resolve(directory, entry.name), `${name}/`)));
    } else {
      assert.ok(
        entry.isFile() && entry.name.endsWith('.json'),
        'Unexpected public production file',
      );
      files.push(name);
    }
  }
  return files;
}

export async function checkProductionData(
  directory,
  {
    latestQuarter = '2026-Q2',
    quarters = ['2026-Q2'],
    requiredRateVersion,
    requiredSelectionVersion,
    requiredCohortVersion,
    requiredMinimumCapacityTB,
    requiredSnapshotCount,
    requireViewAvailability = false,
  } = {},
) {
  assert.ok(
    quarters.length > 0 &&
      quarters.every((quarter) => /^\d{4}-Q[1-4]$/.test(quarter)) &&
      new Set(quarters).size === quarters.length &&
      quarters.includes(latestQuarter),
    'Expected quarters must be unique calendar quarters including latest',
  );
  const files = new Set(await publicFiles(directory));
  assert.ok(files.has('index.json'), 'Public production index.json is required');
  const used = new Set();
  const indexUrl = 'https://publication.example/production/index.json';
  const base = new URL('.', indexUrl);
  const loader = new SnapshotLoader(indexUrl, async (input) => {
    const url = new URL(input);
    assert.ok(
      url.origin === base.origin &&
        url.pathname.startsWith(base.pathname) &&
        !url.search &&
        !url.hash,
      'Production request escaped public graph',
    );
    const name = url.pathname.slice(base.pathname.length);
    assert.ok(files.has(name), 'Referenced production artifact is missing');
    const bytes = await readFile(resolve(directory, name));
    let value;
    try {
      value = parseStrictJson(bytes);
    } catch {
      // String decoding can also throw native syntax errors containing input.
      throw new Error('Invalid public production JSON');
    }
    assertPublicValues(value);
    used.add(name);
    return new Response(new Uint8Array(bytes));
  });
  const index = await loader.loadIndex();
  if (requiredSnapshotCount !== undefined) {
    assert.equal(
      index.snapshots.length,
      requiredSnapshotCount,
      'Advertised production snapshot count differs from active release',
    );
  }
  assert.deepEqual(
    [...new Set(index.snapshots.map((entry) => entry.asOfQuarter))].sort(),
    [...quarters].sort(),
    'Advertised production snapshot quarters differ from release selection',
  );
  assert.equal(
    index.snapshots.find((entry) => entry.snapshotId === index.latestSnapshotId)?.asOfQuarter,
    latestQuarter,
    'Production latest snapshot differs from release selection',
  );
  let matrices = 0;
  let supporting = 0;
  let unavailable = 0;
  let analysisModels = 0;
  for (const entry of index.snapshots) {
    const descriptor = await loader.loadSnapshot(entry.snapshotId);
    assert.equal(descriptor.context.kind, 'backblaze', 'Production snapshot must be Backblaze');
    assertMinimumCapacity(descriptor.context.selection, requiredMinimumCapacityTB);
    if (requiredRateVersion !== undefined) {
      assert.equal(
        descriptor.context.versions.rate,
        requiredRateVersion,
        'Production snapshot calculation version differs from active release',
      );
    }
    for (const [semantic, expected] of [
      ['selection', requiredSelectionVersion],
      ['cohort', requiredCohortVersion],
    ]) {
      if (expected !== undefined) {
        assert.equal(
          descriptor.context.versions[semantic],
          expected,
          `Production snapshot ${semantic} version differs from active release`,
        );
      }
    }
    const matrix = await loader.loadMatrix(descriptor);
    if (requireViewAvailability) {
      assertSnapshotAvailability(descriptor, matrix);
    }
    matrices++;
    analysisModels += matrix.models.length;
    for (const quarter of descriptor.quarters) {
      const payload = await loader.loadQuarter(descriptor, quarter.quarter);
      if (payload) {
        supporting++;
      } else {
        unavailable++;
      }
    }
  }
  assert.ok(
    used.size === files.size && [...files].every((name) => used.has(name)),
    'Public production directory has unadvertised artifacts',
  );
  return {
    snapshots: index.snapshots.length,
    matrices,
    supporting,
    unavailable,
    analysisModels,
    files: used.size,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/production');
  assert.ok(process.argv.length <= 3, 'Usage: check-production-data.mjs [production-directory]');
  const result = await checkProductionData(directory, activeReleaseSelection);
  console.log(`Public production browser-reader verification passed: ${JSON.stringify(result)}`);
}
