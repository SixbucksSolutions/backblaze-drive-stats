import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareStreamIds, parseDiagnosticBytes, validStreamId } from './diagnostic-protocol.mjs';
import { queueBaseUrl, queueCommand, queueFailureCode } from './queue-cli.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export function summarizeEvents(events) {
  const pages = new Map();
  let duplicates = 0;
  let gaps = 0;
  let sessionIssues = 0;
  let missingReady = 0;
  let missingEnd = 0;
  for (const event of events) {
    if (!pages.has(event.pageId)) {
      pages.set(event.pageId, []);
    }
    pages.get(event.pageId).push(event);
  }
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

function validatePage(page, id, cursor) {
  if (
    !exactKeys(page, ['id', 'messages', 'next_after']) ||
    page.id !== id ||
    !Array.isArray(page.messages) ||
    page.messages.length > 16
  ) {
    throw new Error('Invalid queue page.');
  }
  let previous = cursor;
  const decoded = [];
  for (const message of page.messages) {
    if (
      !exactKeys(message, ['id', 'bytes', 'data']) ||
      !validStreamId(message.id) ||
      (previous !== undefined && compareStreamIds(message.id, previous) <= 0) ||
      !Number.isInteger(message.bytes) ||
      message.bytes < 0 ||
      message.bytes > 4096 ||
      typeof message.data !== 'string' ||
      message.data.length > 5464 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(message.data)
    ) {
      throw new Error('Invalid queue message.');
    }
    const bytes = Buffer.from(message.data, 'base64');
    if (bytes.length !== message.bytes || bytes.toString('base64') !== message.data) {
      throw new Error('Invalid queue encoding.');
    }
    decoded.push(bytes);
    previous = message.id;
  }
  if (page.next_after !== (page.messages.length ? previous : null)) {
    throw new Error('Invalid queue cursor.');
  }
  return decoded;
}

// Reads retain the stream. Only validated project projections leave this reader.
export async function readQueue(base, id, runId, { command = queueCommand } = {}) {
  if (
    typeof id !== 'string' ||
    !UUID.test(id) ||
    typeof runId !== 'string' ||
    !RUN_ID.test(runId)
  ) {
    throw new Error('Invalid queue identity.');
  }
  const endpoint = queueBaseUrl(base);
  const events = [];
  let messages = 0;
  let bytes = 0;
  let rejected = 0;
  let cursor;
  for (let pageIndex = 0; pageIndex < 257; pageIndex += 1) {
    const args = ['read', id, '--count', '16'];
    if (cursor !== undefined) {
      args.push('--after', cursor);
    }
    const page = await command(endpoint, args);
    const decoded = validatePage(page, id, cursor);
    messages += decoded.length;
    bytes += decoded.reduce((total, body) => total + body.length, 0);
    if (messages > 4096 || bytes > 2 * 1024 * 1024) {
      throw new Error('Queue inspection limit exceeded.');
    }
    for (const body of decoded) {
      const event = parseDiagnosticBytes(body, runId);
      if (event) {
        events.push(event);
      } else {
        rejected += 1;
      }
    }
    if (decoded.length === 0) {
      events.sort((a, b) => a.pageId.localeCompare(b.pageId) || a.sequence - b.sequence);
      const summary = { messages, bytes, rejected, ...summarizeEvents(events) };
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
    cursor = page.next_after;
  }
  throw new Error('Queue page limit exceeded.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) {
      throw new Error('Arguments required.');
    }
    console.log(
      JSON.stringify(
        await readQueue(process.env.MESSAGE_QUEUE_URL, process.argv[2], process.argv[3]),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(JSON.stringify({ error: { code: queueFailureCode(error), operation: 'read' } }));
    process.exitCode = 1;
  }
}
