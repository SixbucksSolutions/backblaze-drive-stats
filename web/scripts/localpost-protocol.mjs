const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(['ready', 'state', 'check', 'end', 'error']);
const SOURCES = new Set([
  'init',
  'pointer',
  'keyboard',
  'control',
  'mutation',
  'finish',
  'pagehide',
  'runtime',
]);
const FIELDS = ['schemaVersion', 'runId', 'pageId', 'sequence', 'event', 'source', 'state'];
const STATE_FIELDS = [
  'view',
  'mode',
  'metric',
  'from',
  'to',
  'y',
  'selectionCount',
  'tooltip',
  'crosshair',
  'marker',
  'pointIndex',
  'violation',
];
function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function bounded(value, max, integer = true) {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= max &&
      (!integer || Number.isInteger(value)))
  );
}
export function validDiagnosticEvent(value, runId) {
  if (
    !exactKeys(value, FIELDS) ||
    value.schemaVersion !== 1 ||
    typeof value.runId !== 'string' ||
    !UUID.test(value.runId) ||
    (runId !== undefined && value.runId !== runId) ||
    typeof value.pageId !== 'string' ||
    !UUID.test(value.pageId) ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    !EVENTS.has(value.event) ||
    !SOURCES.has(value.source)
  ) {
    return false;
  }
  const state = value.state;
  return (
    exactKeys(state, STATE_FIELDS) &&
    ['afr', 'other'].includes(state.view) &&
    ['relative', 'calendar', 'unknown'].includes(state.mode) &&
    ['cumulative', 'quarterly', 'unknown'].includes(state.metric) &&
    bounded(state.from, 20000) &&
    bounded(state.to, 20000) &&
    bounded(state.y, 1000000, false) &&
    Number.isInteger(state.selectionCount) &&
    state.selectionCount >= 0 &&
    state.selectionCount <= 256 &&
    ['tooltip', 'crosshair', 'marker', 'violation'].every(
      (key) => typeof state[key] === 'boolean',
    ) &&
    bounded(state.pointIndex, 20000) &&
    state.violation === (!state.tooltip && (state.crosshair || state.marker))
  );
}
// Run only after JSON.parse has established valid JSON syntax. Tracking the
// original property tokens also catches escaped spellings of duplicate keys.
function duplicateKeys(body) {
  const stack = [];
  for (const [token] of body.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g)) {
    if (token === '{' || token === '[') {
      stack.push({ object: token === '{', keys: new Set(), key: true });
    } else if (token === '}' || token === ']') {
      stack.pop();
    } else {
      const current = stack.at(-1);
      if (!current?.object) {
        continue;
      }
      if (token === ',') {
        current.key = true;
      } else if (token === ':') {
        current.key = false;
      } else if (current.key && token.startsWith('"')) {
        const key = JSON.parse(token);
        if (current.keys.has(key)) {
          return true;
        }
        current.keys.add(key);
      }
    }
  }
  return false;
}
export function parseDiagnosticBytes(bytes, runId) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 4096) {
    return null;
  }
  try {
    const body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const value = JSON.parse(body);
    return !duplicateKeys(body) && validDiagnosticEvent(value, runId) ? value : null;
  } catch {
    return null;
  }
}
