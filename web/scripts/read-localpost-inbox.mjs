import { constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDiagnosticBytes } from './localpost-protocol.mjs';

const COMPLETED =
  /^localpost_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.dat$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);

export function summarizeEvents(events) {
  const pages = new Map();
  let duplicates = 0;
  let gaps = 0;
  let sessionIssues = 0;
  for (const event of events) {
    if (!pages.has(event.pageId)) {
      pages.set(event.pageId, []);
    }
    pages.get(event.pageId).push(event);
  }
  let missingReady = 0;
  let missingEnd = 0;
  for (const records of pages.values()) {
    records.sort((a, b) => a.sequence - b.sequence);
    let previous = 0;
    for (const record of records) {
      if (record.sequence === previous) {
        duplicates += 1;
      } else {
        gaps += record.sequence - previous - 1;
      }
      previous = record.sequence;
    }
    const ready = records.filter((record) => record.event === 'ready');
    const end = records.filter((record) => record.event === 'end');
    if (ready.length === 0) {
      missingReady += 1;
    }
    if (end.length === 0) {
      missingEnd += 1;
    }
    if (
      ready.length > 1 ||
      end.length > 1 ||
      (ready.length === 1 && (records[0] !== ready[0] || ready[0].sequence !== 1)) ||
      (end.length === 1 && records.at(-1) !== end[0])
    ) {
      sessionIssues += 1;
    }
  }
  return {
    pages: pages.size,
    duplicates,
    gaps,
    missingReady,
    missingEnd,
    sessionIssues,
    violations: events.filter((event) => event.state.violation).length,
    errors: events.filter((event) => event.event === 'error').length,
  };
}

// Only validated projections leave this reader; delivered files are never modified.
export async function readLocalpostInbox(directory, runId) {
  if (typeof runId !== 'string' || !UUID.test(runId)) {
    throw new Error('Invalid run ID.');
  }
  const root = path.resolve(directory);
  if (canonical(await realpath(root)) !== canonical(root) || !(await lstat(root)).isDirectory()) {
    throw new Error('Inbox must be an unredirected directory.');
  }
  const events = [];
  let entries = 0;
  let files = 0;
  let bytes = 0;
  let rejected = 0;
  let ignored = 0;
  for await (const entry of await opendir(root)) {
    entries += 1;
    if (entries > 4096) {
      throw new Error('Inbox entry limit exceeded.');
    }
    if (!COMPLETED.test(entry.name)) {
      ignored += 1;
      continue;
    }
    files += 1;
    const filename = path.join(root, entry.name);
    let handle;
    try {
      const before = await lstat(filename);
      if (!before.isFile() || before.isSymbolicLink() || before.size > 4096) {
        rejected += 1;
        continue;
      }
      if (bytes + before.size > 2 * 1024 * 1024) {
        throw new Error('Inbox byte limit exceeded.');
      }
      handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const opened = await handle.stat();
      const after = await lstat(filename);
      if (
        !opened.isFile() ||
        after.isSymbolicLink() ||
        !after.isFile() ||
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.dev !== after.dev ||
        opened.ino !== after.ino ||
        opened.size !== before.size ||
        canonical(await realpath(filename)) !== canonical(filename)
      ) {
        rejected += 1;
        continue;
      }
      const buffer = Buffer.alloc(4097);
      let size = 0;
      while (size < buffer.length) {
        const read = await handle.read(buffer, size, buffer.length - size, size);
        if (read.bytesRead === 0) {
          break;
        }
        size += read.bytesRead;
      }
      bytes += size;
      if (bytes > 2 * 1024 * 1024) {
        throw new Error('Inbox byte limit exceeded.');
      }
      const event = parseDiagnosticBytes(buffer.subarray(0, size), runId);
      if (event) {
        events.push(event);
      } else {
        rejected += 1;
      }
    } finally {
      await handle?.close();
    }
  }
  events.sort((a, b) => a.pageId.localeCompare(b.pageId) || a.sequence - b.sequence);
  const summary = { files, bytes, rejected, ignored, ...summarizeEvents(events) };
  summary.complete =
    events.length > 0 &&
    rejected === 0 &&
    summary.duplicates === 0 &&
    summary.gaps === 0 &&
    summary.missingReady === 0 &&
    summary.missingEnd === 0 &&
    summary.sessionIssues === 0 &&
    summary.violations === 0 &&
    summary.errors === 0;
  return { events, summary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) {
      throw new Error('Arguments required.');
    }
    console.log(
      JSON.stringify(await readLocalpostInbox(process.argv[2], process.argv[3]), null, 2),
    );
  } catch {
    console.error(
      'Localpost inbox inspection failed; verify the private directory, run ID and limits.',
    );
    process.exitCode = 1;
  }
}
