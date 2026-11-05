import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validStreamId } from './diagnostic-protocol.mjs';

const executeFile = promisify(execFile);
const CLIENT = 'C:/Projects/shared-message-queue/bin/localpost-client.exe';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ERROR_CODES = new Set([
  'transport_error',
  'http_error',
  'memory_limit',
  'backend_error',
  'invalid_response',
  'response_too_large',
  'output_error',
  'invalid_argument',
  'input_too_large',
  'input_error',
  'message_not_found',
]);
const QUEUE_FAILURE_CODES = new Set([...ERROR_CODES, 'client_unavailable', 'client_failure']);

export function queueFailureCode(error, fallback = 'invalid_response') {
  if (QUEUE_FAILURE_CODES.has(error?.code)) {
    return error.code;
  }
  return QUEUE_FAILURE_CODES.has(fallback) ? fallback : 'invalid_response';
}

function failure(code, operation) {
  const error = new Error(`Shared queue ${operation} failed (${code}).`);
  error.code = code;
  error.operation = operation;
  return error;
}

export function queueBaseUrl(value = 'http://127.0.0.1:53147') {
  if (typeof value !== 'string') {
    throw failure('invalid_argument', 'endpoint');
  }
  const match = /^http:\/\/(127\.0\.0\.1|\[::1\])(?::([0-9]+))?\/?$/.exec(value);
  if (!match || (match[2] !== undefined && (Number(match[2]) < 1 || Number(match[2]) > 65535))) {
    throw failure('invalid_argument', 'endpoint');
  }
  return new URL(value).origin;
}

function validArguments(args) {
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) {
    return false;
  }
  if (args[0] === 'register') {
    return args.length === 1;
  }
  if (!UUID.test(args[1])) {
    return false;
  }
  if (args[0] === 'delete') {
    return args.length === 2;
  }
  if (args[0] !== 'read' || args[2] !== '--count' || !/^(?:[1-9]|1[0-6])$/.test(args[3])) {
    return false;
  }
  return (
    args.length === 4 || (args.length === 6 && args[4] === '--after' && validStreamId(args[5]))
  );
}

export async function queueCommand(base, args, { execute = executeFile } = {}) {
  const operation =
    Array.isArray(args) && ['register', 'read', 'delete'].includes(args[0]) ? args[0] : 'command';
  if (!validArguments(args)) {
    throw failure('invalid_argument', operation);
  }
  const endpoint = queueBaseUrl(base);
  let result;
  try {
    result = await execute(CLIENT, ['--url', endpoint, '--timeout', '5s', ...args], {
      encoding: 'utf8',
      timeout: 7000,
      maxBuffer: 256 * 1024,
      windowsHide: true,
      shell: false,
    });
  } catch (error) {
    let code = error?.code === 'ENOENT' ? 'client_unavailable' : 'client_failure';
    try {
      const diagnostic = JSON.parse(error?.stderr);
      if (diagnostic?.error?.operation === operation && ERROR_CODES.has(diagnostic.error.code)) {
        code = diagnostic.error.code;
      }
    } catch {
      /* Never expose untrusted process output. */
    }
    throw failure(code, operation);
  }
  if (
    typeof result?.stdout !== 'string' ||
    Buffer.byteLength(result.stdout) > 256 * 1024 ||
    typeof result.stderr !== 'string' ||
    result.stderr.length !== 0
  ) {
    throw failure('invalid_response', operation);
  }
  try {
    const parsed = JSON.parse(result.stdout);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw failure('invalid_response', operation);
  }
}
