import { validDiagnosticEvent, validStreamId } from './diagnostic-protocol.mjs';

export function encodeQueueBytes(bytes) {
  if (bytes.byteLength > 4096) {
    throw new Error('message-size');
  }
  return `b64:${btoa(String.fromCharCode(...bytes))}`;
}

// Embedded by the opt-in development plugin; never import into application source.
export function sampleDiagnosticsState(window) {
  const document = window.document;
  const value = (id) => document.getElementById(id)?.value;
  const number = (id, maximum, integer = true) => {
    const raw = value(id);
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) &&
      parsed >= 0 &&
      parsed <= maximum &&
      (!integer || Number.isInteger(parsed))
      ? parsed
      : null;
  };
  const visible = (id) => {
    let node = document.getElementById(id);
    if (!node || !node.isConnected) {
      return false;
    }
    while (node) {
      const style = window.getComputedStyle(node);
      if (
        node.hidden ||
        node.getAttribute('visibility') === 'hidden' ||
        node.getAttribute('visibility') === 'collapse' ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0'
      ) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  };
  const tooltip = visible('afr-tooltip');
  const crosshair = visible('afr-crosshair');
  const marker = visible('afr-current-point');
  const mode = value('afr-time');
  const metric = value('afr-metric');
  return {
    view: document.querySelector('.afr-page') ? 'afr' : 'other',
    mode: mode === 'relative' || mode === 'calendar' ? mode : 'unknown',
    metric: metric === 'cumulative' || metric === 'quarterly' ? metric : 'unknown',
    from: number('afr-from', 20000),
    to: number('afr-to', 20000),
    y: number('afr-y-range', 1000000, false),
    // Inspection choices retain the selected set when search hides checkboxes.
    selectionCount: Math.min(
      256,
      document.getElementById('afr-inspect-model')?.options.length ?? 0,
    ),
    tooltip,
    crosshair,
    marker,
    pointIndex: number('afr-point', 20000),
    violation: (crosshair || marker) && !tooltip,
  };
}

export function startDiagnostics(config, window) {
  window.__queueDiagnostics?.teardown();
  window.document.getElementById('queue-status')?.remove();
  const document = window.document;
  const pageId = window.crypto.randomUUID();
  const queue = [];
  const listeners = [];
  let sequence = 0;
  let attempts = 0;
  let attemptedBytes = 0;
  let dropped = 0;
  let failures = 0;
  let lastFailure = null;
  let readyAck = false;
  let endAck = false;
  let ended = false;
  let inflight = false;
  let frame = null;
  let deadline = null;
  let pendingSource = 'mutation';
  let pendingCheck = false;
  let previous = '';
  const bar = document.createElement('div');
  bar.id = 'queue-status';
  bar.style.cssText =
    'position:fixed;bottom:0;right:0;z-index:2147483647;background:#102838;color:white;padding:8px;font:12px sans-serif';
  const status = document.createElement('span');
  status.id = 'queue-message';
  status.setAttribute('role', 'status');
  const finish = document.createElement('button');
  finish.id = 'queue-finish';
  finish.type = 'button';
  finish.textContent = 'Finish diagnostics';
  bar.append(status, finish);
  document.body.append(bar);
  const updateStatus = () => {
    status.textContent = `Diagnostics: ready ${readyAck ? 'acknowledged' : 'pending'}; end ${endAck ? 'acknowledged' : ended ? 'pending' : 'open'}; dropped ${dropped}; failed ${failures}.${lastFailure ? ` Last failure ${lastFailure}.` : ''}${ended ? ' Stopped; reload to resume.' : ''} `;
  };
  updateStatus();
  const reserveBudget = (bytes) => {
    const key = `queue-budget-${config.runId}`;
    const stored = window.sessionStorage.getItem(key);
    const budget = stored === null ? { attempts: 0, bytes: 0 } : JSON.parse(stored);
    if (
      !Number.isSafeInteger(budget.attempts) ||
      !Number.isSafeInteger(budget.bytes) ||
      budget.attempts < 0 ||
      budget.bytes < 0 ||
      budget.attempts >= 4096 ||
      budget.bytes + bytes > 2 * 1024 * 1024
    ) {
      throw new Error('budget');
    }
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ attempts: budget.attempts + 1, bytes: budget.bytes + bytes }),
    );
  };
  const drain = async () => {
    if (inflight || !queue.length) {
      return;
    }
    inflight = true;
    const { record, body, bytes } = queue.shift();
    attempts += 1;
    attemptedBytes += bytes;
    const controller = new window.AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2000);
    let failureCode = 'invalid_response';
    try {
      reserveBudget(bytes);
      failureCode = 'transport_error';
      const response = await window.fetch(config.endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: encodeQueueBytes(new TextEncoder().encode(body)),
        cache: 'no-store',
        signal: controller.signal,
        keepalive: record.source === 'pagehide',
        credentials: 'omit',
        redirect: 'error',
      });
      if (response.status !== 200) {
        failureCode = 'http_error';
        await response.body?.cancel();
        throw new Error('transport');
      }
      if (!response.body) {
        failureCode = 'invalid_response';
        throw new Error('receipt');
      }
      const reader = response.body.getReader();
      let receiptBytes = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        receiptBytes += value.byteLength;
        if (receiptBytes > 512) {
          failureCode = 'response_too_large';
          await reader.cancel();
          throw new Error('receipt-size');
        }
        chunks.push(...value);
      }
      failureCode = 'invalid_response';
      const receipt = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(chunks)),
      );
      if (
        receipt &&
        Object.keys(receipt).length === 1 &&
        Array.isArray(receipt.XADD) &&
        receipt.XADD.length === 2 &&
        receipt.XADD[0] === false &&
        typeof receipt.XADD[1] === 'string'
      ) {
        failureCode = receipt.XADD[1].startsWith('OOM') ? 'memory_limit' : 'backend_error';
        throw new Error('backend');
      }
      if (!receipt || Object.keys(receipt).length !== 1 || !validStreamId(receipt.XADD)) {
        throw new Error('receipt');
      }
      if (record.event === 'ready') {
        readyAck = true;
      }
      if (record.event === 'end') {
        endAck = true;
      }
    } catch {
      lastFailure = failureCode;
      failures += 1;
      dropped += 1;
    } finally {
      window.clearTimeout(timer);
      inflight = false;
      updateStatus();
      void drain();
    }
  };
  const emit = (event, source, force = false) => {
    const state = sampleDiagnosticsState(window);
    const signature = JSON.stringify(state);
    if (!force && signature === previous) {
      return;
    }
    previous = signature;
    sequence += 1;
    if (queue.length + Number(inflight) >= 64) {
      dropped += 1;
      updateStatus();
      return;
    }
    const record = {
      schemaVersion: 1,
      runId: config.runId,
      pageId,
      sequence,
      event,
      source,
      state,
    };
    if (!validDiagnosticEvent(record, config.runId)) {
      dropped += 1;
      updateStatus();
      return;
    }
    const body = JSON.stringify(record);
    const bytes = new TextEncoder().encode(body).byteLength;
    const queuedBytes = queue.reduce((sum, item) => sum + item.bytes, 0);
    if (
      bytes > 4096 ||
      attempts + queue.length >= 4096 ||
      attemptedBytes + queuedBytes + bytes > 2 * 1024 * 1024
    ) {
      dropped += 1;
      updateStatus();
      return;
    }
    queue.push({ record, body, bytes });
    void drain();
  };
  const flush = () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
    }
    if (deadline !== null) {
      window.clearTimeout(deadline);
    }
    frame = null;
    deadline = null;
    if (!ended) {
      emit(pendingCheck ? 'check' : 'state', pendingSource, pendingCheck);
    }
    pendingCheck = false;
    pendingSource = 'mutation';
  };
  const schedule = (source, check = false) => {
    if (ended) {
      return;
    }
    // Keep the initiating action when its DOM mutations arrive before settlement.
    if (source !== 'mutation' || pendingSource === 'mutation') {
      pendingSource = source;
    }
    pendingCheck ||= check;
    if (frame === null) {
      frame = window.requestAnimationFrame(flush);
    }
    if (deadline === null) {
      deadline = window.setTimeout(flush, 100);
    }
  };
  const ownNode = (node) => node === bar || bar.contains(node);
  const observer = new window.MutationObserver((mutations) => {
    if (mutations.some((mutation) => !ownNode(mutation.target))) {
      schedule('mutation');
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'visibility', 'style', 'class', 'value', 'checked'],
  });
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback, true);
    listeners.push(() => target.removeEventListener(type, callback, true));
  };
  const relevant = (event) =>
    !ownNode(event.target) && Boolean(event.target?.closest?.('.afr-page'));
  for (const type of ['pointermove', 'pointerdown', 'pointerup', 'pointerleave']) {
    listen(document, type, (event) => {
      if (relevant(event)) {
        schedule(
          'pointer',
          type === 'pointerup' || (type === 'pointerleave' && event.target.id === 'afr-chart'),
        );
      }
    });
  }
  for (const type of ['keydown', 'keyup', 'focusin', 'focusout']) {
    listen(document, type, (event) => {
      if (relevant(event)) {
        schedule('keyboard', type === 'keyup');
      }
    });
  }
  for (const type of ['input', 'change', 'click']) {
    listen(document, type, (event) => {
      if (relevant(event)) {
        schedule('control', true);
      }
    });
  }
  for (const type of ['error', 'unhandledrejection']) {
    listen(window, type, () => {
      if (!ended) {
        emit('error', 'runtime', true);
      }
    });
  }
  const stop = (source) => {
    if (ended) {
      return;
    }
    flush();
    ended = true;
    observer.disconnect();
    for (const remove of listeners) {
      remove();
    }
    finish.disabled = true;
    finish.removeEventListener('click', finishRun);
    // Reserve room for the terminal record even during a burst.
    if (queue.length + Number(inflight) >= 64) {
      queue.pop();
      dropped += 1;
    }
    emit('end', source, true);
    updateStatus();
  };
  const finishRun = () => stop('finish');
  finish.addEventListener('click', finishRun);
  listen(window, 'pagehide', () => stop('pagehide'));
  emit('ready', 'init', true);
  const session = {
    teardown: () => {
      stop('runtime');
      if (window.__queueDiagnostics === session) {
        delete window.__queueDiagnostics;
      }
    },
  };
  window.__queueDiagnostics = session;
  return session;
}
