# Local browser diagnostics

`npm run dev:diagnostics` from `web/` starts the opt-in development reporter and
collector on `127.0.0.1:5173`. Ordinary `npm run dev` is unchanged. The reporter is
injected by the development plugin; it is absent from production builds and preview.
No watcher, automation or direct-to-chat delivery is started.

Open the AFR view and wait for the fixed **Diagnostics** bar to show **ready
acknowledged**. Perform the bounded interaction being investigated, such as hover,
pointer leave, a range change and another hover. Click **Finish diagnostics** and
wait for **end acknowledged** before stopping the server. The button then disables
and the reporter disconnects its observers and event handlers. Page exit attempts
a best-effort end record; explicit Finish is the reliable way to obtain its visible
acknowledgement. A page that remains open after server restart needs a reload to
receive the new run credentials.

The collector writes a private per-run JSONL file under `data/diagnostics/`; the
directory is ignored by Git and denied by the development server. Each accepted
record contains a server UTC timestamp and a bounded, validated client projection:

- Run/page correlation, sequence, event kind and fixed action-source identifier.
- AFR view, time alignment, rate metric, numeric ranges and selected model count.
- Actual tooltip, crosshair and current-point visibility, point index and the
  invariant flag `(crosshair || marker) && !tooltip`.

Selection count comes from the inspection selector's complete option list, so
filtering the displayed model checkboxes does not reduce it. Visibility checks
include the element and its ancestors, HTML hidden state, SVG visibility,
computed display/visibility and zero opacity. The flag checks visibility state,
not screenshot pixels or chart correctness; a clean stream alone is not full UI
acceptance evidence.

Pointer and DOM changes are sampled after an animation frame, with a 100 ms
fallback. Unchanged pointer motion is deduplicated. Control changes, pointer-up
and chart pointer-leave retain checks even if the resulting state is unchanged,
so a repeated action still has evidence. No pointer coordinates, model IDs,
labels, raw text, URLs, request bodies or exception details are collected. Runtime
errors and unhandled rejections become only the fixed `error`/`runtime` event.

The client holds at most 64 pending/in-flight records and sends one request at a
time with a two-second timeout. It does not retry failed posts or report transport
errors recursively. **Dropped** includes overflow and failed delivery;
**failed** counts failed posts. A healthy proof requires ready/end acknowledgement,
zero loss/failures and inspection of the recorded action sequence. A server stop,
network failure or page closure can lose evidence but never retries an application
action or changes its result. HMR disposal tears down the reporter and attempts a
terminal record.

The loopback endpoint requires the per-run token and exact development Host/Origin,
validates the fixed schema, limits request/file/record/page sizes, and serializes
writes. It cannot read logs. Do not enable this collector on a public host or expose
the private output directory. Run the reporter/collector tests and the production
exclusion check when changing this path.
