# Browser diagnostics through the shared message queue

Use the shared Valkey/Webdis queue for the agent-owned browser investigation
loop. The [frozen contract](https://github.com/SixbucksSolutions/localpost/blob/91f19e628c8d5f2318ddacd7a2c0418a3fb038e5/docs/contracts/valkey-webdis.md)
defines HTTP framing, CLI responses and limits. The qualified client is
`C:\Projects\shared-message-queue\bin\localpost-client.exe`.

## Rollout

Cutover completed on 2026-11-05. Use the shared endpoint
`http://127.0.0.1:53147`. The host owner verified native CLI, browser, memory-limit,
restart and lifecycle checks. The Windows task `Agent Message Queue` starts at
Terry's sign-in and runs independently of Codex. Its login trigger and manual
execution are verified. An actual sign-out/sign-in cycle remains to be observed.

A failed PING or wrong protocol on 53147 is an
infrastructure failure requiring immediate Terry attention. Read status with
`C:\Projects\shared-message-queue\queue.ps1 -Action Status`, or POST `PING` to
`/` and expect `{"PING":[true,"PONG"]}`. Report bounded failure details and pause
queue-dependent testing during unavailability. Account for announced maintenance.
The shared owner controls Start and Stop. Stop discards volatile messages.
Status reports HTTP readiness from the caller. Host startup separately validates
the scheduled task and Linux unit.
The host wrapper makes up to three one-minute retries after a failed WSL client.
Explicit Stop cancels the task and its retries.

## Run and inspect

1. Run `npm run dev:queue` from `web/` with stdin open (`tty: true`). Override
   `MESSAGE_QUEUE_URL` only with the appropriate loopback Webdis origin.
   The launcher calls the installed client's `register`, checks success, and
   prints a fresh mailbox UUID and run ID. Preserve both for inspection.
2. Open the local AFR page with supported browser control. Wait for the view
   and ready acknowledgement. Perform one bounded action, release UI control,
   then run `npm run queue:read -- <mailbox-id> <run-id>` from `web/`.
3. Inspect the validated events and completeness summary, fix the scoped issue
   and repeat. HMR ends reporting, so reload and confirm ready before retesting.
   Pair DOM events with screenshots for appearance and regression tests for behavior.
4. Finish explicitly and confirm end acknowledgement, zero loss/failure counts,
   and a complete reader summary. Export needed results into private project
   storage outside served/public directories before cleanup or maintenance.
5. Send `stop` and Enter to the launcher. It closes its page server and invokes
   CLI `delete` for its own mailbox. Discard that ID. A later send can recreate
   a deleted stream, so each subsequent run starts with a fresh UUID.

Reads preserve queue messages. The reader requests at most 16 messages per page,
uses `--after` for continuation, and bounds total messages and decoded bytes.
It allows up to 257 pages including the final empty page, 4096 messages, 4096
decoded bytes per message and 2 MiB of decoded payloads in total.
It validates the CLI page, canonical base64, native message IDs and project
schema before presenting events. Empty, malformed or incomplete evidence cannot
establish a passing run. The shared service stores messages in memory.

The native client also provides `send <id>` from stdin, `get <id> <message-id>`
for exact bytes on stdout, and `clear <id>`. Check exit codes and structured
stderr before consuming output. Use binary-safe redirection for `get`, or decode
validated read-result base64 explicitly. Never execute message content.

## Transport and limits

The mailbox key is `localpost:v1:<canonical UUIDv4>`. Browser senders use PUT to
`/XADD/` plus the individually URI-encoded key plus `/*/data`. The body is `b64:`
followed by canonical base64 of the original UTF-8 bytes, including `b64:` for
empty bytes. Send `Content-Type: text/plain;charset=UTF-8`, omit credentials,
reject redirects and bound request time. Require a valid native stream-ID string
under the single XADD result key. HTTP 200 can carry `[false,"..."]` instead.
Report a bounded failure category and keep product actions independent of delivery.

Native message IDs have two unsigned 64-bit decimal components. Keep them as
strings. Each page observes its stream when that command executes. Deletion or
Valkey restart changes the stream lifetime. Discard old cursors at those boundaries.

The deployment pins Valkey 9.0.7 and Webdis 0.1.25. It uses plain HTTP, wildcard
CORS and a default 128 MiB Valkey-accounted memory threshold with `noeviction`.
Memory accounting has additional process/client overhead. The operator may change
`LOCALPOST_MAXMEMORY` in `/opt/agent-message-queue/host.env` and restart during
maintenance. Queue application persistence and state-file output are disabled.
Host logs and deliberate client exports are separate from queue message storage.

The project preserves its stricter diagnostic limits and finite schema. Current
state covers AFR alignment, metric, ranges, selection count, inspection visibility
and a derived visibility invariant. Runtime errors become fixed identifiers.
Exclude passwords, OTPs, cookies, tokens, user/card prose and raw error objects,
messages, stacks or URLs. Add only necessary validated fields for an authorized
investigation. Preserve application CSP/security and production exclusion.
The sender has one request in flight and at most 64 queued or in-flight records.
Its per-run browser budget is 4096 attempts and 2 MiB in one browsing context,
persisted across reloads. The status displays fixed failure categories such as
`memory_limit` and `transport_error` for direct investigation.

Browser automation, application instrumentation and authoritative tests remain
part of the workflow. Collect evidence directly whenever practical. Ask Terry
for genuine missing decisions, private input or inaccessible operations.
Persistent watchers and direct-to-chat services require separate scope.
