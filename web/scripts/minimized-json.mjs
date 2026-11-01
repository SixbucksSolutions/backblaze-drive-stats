import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const immutableName = /^([a-zA-Z0-9][a-zA-Z0-9._-]*)\.([a-f0-9]{64})\.json$/;
const referenceKeys = new Set(['path', 'sha256', 'sizeBytes']);
const virtualName = 'virtual:minimized-example-json';
const virtualId = `\0${virtualName}`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Remove only JSON's four insignificant whitespace characters. Never round-trip
 * values through JSON.stringify: large integers, -0 and exponent spelling matter.
 */
export function minimizeJsonBytes(bytes) {
  const text = decoder.decode(bytes);
  JSON.parse(text);
  let result = '';
  let quoted = false;
  let escaped = false;
  for (const character of text) {
    if (quoted || ![' ', '\t', '\r', '\n'].includes(character)) {
      result += character;
    }
    if (escaped) {
      escaped = false;
    } else if (quoted && character === '\\') {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    }
  }
  return Buffer.from(result, 'utf8');
}

function stringEnd(text, start) {
  let position = start + 1;
  while (position < text.length) {
    if (text[position] === '\\') {
      position += 2;
    } else if (text[position++] === '"') {
      return position;
    }
  }
  throw new Error('Unterminated JSON string');
}

// Locate complete reference object spans. Only these byte-binding objects may
// change lexemes during repacking; every other token is copied from the source.
function referenceSpans(text) {
  const stack = [];
  const spans = [];
  for (let position = 0; position < text.length; position++) {
    const character = text[position];
    if (character === '"') {
      const end = stringEnd(text, position);
      if (text[end] === ':') {
        const key = JSON.parse(text.slice(position, end));
        const entry = stack.at(-1);
        assert.ok(entry, 'JSON property outside an object');
        entry.duplicate ||= entry.keys.has(key);
        entry.keys.add(key);
      }
      position = end - 1;
    } else if (character === '{') {
      stack.push({ start: position, keys: new Set(), duplicate: false });
    } else if (character === '}') {
      const entry = stack.pop();
      assert.ok(entry, 'Unbalanced JSON object');
      if (entry.keys.has('path') || (entry.keys.has('sha256') && entry.keys.has('sizeBytes'))) {
        const reference = JSON.parse(text.slice(entry.start, position + 1));
        const keys = Object.keys(reference);
        assert.ok(
          !entry.duplicate && keys.length === 3 && keys.every((key) => referenceKeys.has(key)),
          'Malformed byte reference object',
        );
        spans.push({ start: entry.start, end: position + 1, reference });
      }
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/** Derive a separate compact fictional graph. Originals are immutable inputs;
 * filenames, SHA-256 and sizes are rebound bottom-up before Vite sees any asset.
 */
export function repackExampleGraph(sources) {
  assert.ok(sources instanceof Map && sources.size > 0, 'An example graph is required');
  const originals = new Map();
  const indexes = [];
  for (const [name, bytes] of sources) {
    const match = immutableName.exec(name);
    assert.ok(match, `Unsafe immutable artifact name: ${name}`);
    assert.equal(hash(bytes), match[2], `Original artifact hash mismatch: ${name}`);
    const text = minimizeJsonBytes(bytes).toString('utf8');
    const value = JSON.parse(text);
    assert.ok(
      ['generation_index', 'snapshot_descriptor', 'matrix', 'supporting_quarter'].includes(
        value.artifactType,
      ),
      'Unexpected example artifact type',
    );
    if (value.artifactType === 'generation_index') {
      indexes.push(name);
      assert.ok(value.snapshots.every((entry) => entry.snapshotId.startsWith('sample-')));
    }
    if (value.artifactType === 'snapshot_descriptor') {
      assert.equal(value.context.kind, 'sample', 'Only fictional examples may be repacked');
    }
    originals.set(name, { bytes, text, stem: match[1], spans: referenceSpans(text) });
  }
  assert.equal(indexes.length, 1, 'Exactly one example index is required');
  const active = new Set();
  const rewritten = new Map();
  const assets = new Map();
  function visit(name) {
    assert.ok(!active.has(name), 'Cyclic example references');
    if (rewritten.has(name)) {
      return rewritten.get(name);
    }
    const original = originals.get(name);
    assert.ok(original, `Missing example artifact: ${name}`);
    active.add(name);
    let position = 0;
    let text = '';
    for (const { start, end, reference } of original.spans) {
      assert.ok(
        typeof reference.path === 'string' && immutableName.test(reference.path),
        'Unsafe example reference path',
      );
      const target = originals.get(reference.path);
      assert.ok(target, 'Missing referenced example artifact');
      assert.equal(reference.sha256, hash(target.bytes), 'Original reference hash mismatch');
      assert.equal(reference.sizeBytes, target.bytes.length, 'Original reference size mismatch');
      assert.ok(
        reference.path.endsWith(`.${reference.sha256}.json`),
        'Reference path/hash mismatch',
      );
      const replacement = visit(reference.path);
      text += original.text.slice(position, start) + JSON.stringify(replacement);
      position = end;
    }
    text += original.text.slice(position);
    const bytes = Buffer.from(text, 'utf8');
    const sha256 = hash(bytes);
    const path = `${original.stem}.${sha256}.json`;
    assert.ok(!assets.has(path) || assets.get(path).equals(bytes), 'Conflicting example artifacts');
    const reference = { path, sha256, sizeBytes: bytes.length };
    assets.set(path, bytes);
    rewritten.set(name, reference);
    active.delete(name);
    return reference;
  }
  const indexName = visit(indexes[0]).path;
  assert.equal(rewritten.size, originals.size, 'Unreferenced example artifact');
  return { indexName, assets, references: rewritten };
}

export function minimizedJsonPlugin({
  exampleDirectory = new URL('../../fixtures/production-v2/', import.meta.url),
} = {}) {
  let building = false;
  let root = process.cwd();
  return {
    name: 'minimized-json-assets',
    enforce: 'pre',
    configResolved(config) {
      building = config.command === 'build';
      root = config.root ?? root;
    },
    resolveId(id) {
      return id === virtualName ? virtualId : null;
    },
    async load(id) {
      const assetUrl = (name, bytes, originalPath) => {
        if (!building) {
          return JSON.stringify(`data:application/json;base64,${bytes.toString('base64')}`);
        }
        const referenceId = this.emitFile({
          type: 'asset',
          name,
          source: bytes,
          originalFileName: relative(root, originalPath).replaceAll('\\', '/'),
        });
        return `import.meta.ROLLUP_FILE_URL_${referenceId}`;
      };
      if (id === virtualId) {
        const names = (await readdir(exampleDirectory)).filter((name) => name.endsWith('.json'));
        const sources = new Map(
          await Promise.all(
            names.map(async (name) => {
              const path = new URL(name, exampleDirectory);
              this.addWatchFile(fileURLToPath(path));
              return [name, await readFile(path)];
            }),
          ),
        );
        const graph = repackExampleGraph(sources);
        const originalNames = new Map(
          [...graph.references].map(([name, reference]) => [reference.path, name]),
        );
        const entries = [...graph.assets].map(
          ([name, bytes]) =>
            `${JSON.stringify(name)}:${assetUrl(name, bytes, fileURLToPath(new URL(originalNames.get(name), exampleDirectory)))}`,
        );
        return `export const exampleUrls={${entries.join(',')}};export const exampleIndexName=${JSON.stringify(graph.indexName)};`;
      }
      const [path, query] = id.split('?');
      if (
        isAbsolute(path) &&
        path.endsWith('.json') &&
        query &&
        new URLSearchParams(query).has('url')
      ) {
        this.addWatchFile(path);
        const bytes = minimizeJsonBytes(await readFile(path));
        return `export default ${assetUrl(basename(path), bytes, path)};`;
      }
      return null;
    },
  };
}
