# Static presentation loading (#0108)

The production build derives presentation capsules from the canonical public v2
snapshot graph. `SnapshotLoader` validates the index, descriptors, matrix and
supporting quarters and their references and bindings; the capacity-history
reader supplies history. The build emits a content-addressed matrix capsule per
snapshot and a shared report capsule per snapshot and quarter. Report capsules
contain the display descriptor, selected quarter (including unavailable
quarters), and capacity history. An independent packaging audit reconstructs
projections from canonical readers and checks structures, deterministic bytes,
references and reachability.

## Current home and analytical loading contract (#0134)

Root and `?view=picks` deliver the complete latest recommendation markup, including
navigation, facts, coverage and links. The build uses the validated latest matrix
capsule and the existing exact-generation editorial and eligibility rules. A newer
unreviewed generation shows awaiting review; it never substitutes old endorsements.
An independent release audit reconstructs the latest capsule through canonical
public readers and compares the actual HTML tree and its small generation context.

Home does not request the matrix capsule or analytical catalogue and does not rerun
selection in the browser. It keeps Inter and stable-font/fallback handling, with no
Mono preload or readiness request. Minimal navigation/font JavaScript still runs.
The shared static Pages index serves every query route; an early route gate hides
home markup before first paint on non-home routes. No Worker is required.

The build emits the analytical catalogue at
`/assets/analytics-catalogue-<sha256>.json`. A small versioned JSON reference in HTML
binds its path, SHA-256 and byte length. Analytical routes start that request early,
verify the bytes and catalogue shape, then select the exact capsule. Later snapshot
or quarter selections resolve through the verified catalogue. Matrix, Explore and
the five specialized reports use this path without a runtime waterfall through the
canonical index, descriptor and quarter graph. Example and explicit legacy routes
retain their separate implementations; `reference=1` uses workbook and synthetic
fixtures. Those routes do not fetch the analytical catalogue.

The packaging reader accepts both the historical inline catalogue and the new
external representation, rejects duplicate or ambiguous metadata, and verifies
external bytes before parsing. Exact inventory and separately pinned retention
checks keep all qualified predecessor immutable URLs and bytes, including old
capsules and external catalogues. The catalogue lives outside the
`assets/presentation-*` capsule namespace.

The catalogue records the canonical index SHA-256 as an audit and generation
identity. It is not embedded in capsule bodies: publishing or reordering other
snapshots can change the index identity without changing an existing capsule's
bytes or content address. Capsule bindings instead include the snapshot, as-of
quarter, context and source-manifest hashes and descriptor reference.

At runtime the loader verifies the advertised byte length and SHA-256, parses a
bounded transport shape, and checks the selected kind, snapshot, quarter and
bindings against the catalogue, including report quarter status. Canonical
semantic validation and projection equivalence are build gates; the transport
validator does not replace them. Only completed verified capsules are frozen and
cached, with generation, selection and content identity in the key. Abort checks
prevent cancelled work from entering the cache, and stale selection completions
are suppressed by the shell. Errors remain visible and retryable; examples are
never silently substituted for production data.

## Historical #0108 measured outcome

The 2026-11-01 comparison used the exact deployed #0104 bundle (`5377bd02`) and
the #0108 candidate, extension-free Chrome 156 and Lighthouse 13.6. Both bundles
were served from the same memory-backed local server with precomputed gzip.
Desktop used the available machine without artificial throttling. Mobile used a
390 × 844 viewport, 150 ms request latency, 1,600 kbps download, 750 kbps upload
and 4× CPU slowdown. Cold/warm describe the **browser** cache; these measurements
do not include a cold Cloudflare edge's retrieval cost.

Useful readiness waits for report content, final font choice, application reveal
and two animation frames. It is not the network Finish or window Load event.
Times are individual sequential captures in seconds, not statistical guarantees.

| View / conditions | Before cold | After cold | Before warm | After warm |
| --- | ---: | ---: | ---: | ---: |
| Matrix / desktop | 0.81 | 0.94 | 0.73 | 0.60 |
| Capacity / desktop | 1.43 | 0.11 | 1.21 | 0.12 |
| Matrix / throttled mobile | 7.31 | 7.55 | 3.87 | 2.79 |
| Capacity / throttled mobile | 9.10 | 4.19 | 5.65 | 0.83 |

Matrix data requests fall from three to one; capacity falls from 55 to one.
The desktop matrix request begins at 25 ms rather than 150 ms; the mobile case
begins at 1.69 seconds rather than 3.62 seconds. Completed warm-cache capsule
responses transfer no data body. The early catalogue costs about 100 KB gzip
(79 KB Brotli), increasing the measured cold matrix page transfer by about 49 KB.
No unrelated snapshot payloads are fetched.

Capacity and warm matrix loading improve materially. The exploratory target of
a fixed 15% desktop matrix readiness improvement was not met by the cold capture;
the mobile request-start target of 60% was also not met (observed improvement
53%). Cold matrix traces show less script work and comparable layout, with
variable frame delivery; screenshots match the baseline exactly. There is no
claim of a universal matrix render speedup. The retained private #0108 packet
contains the full traces, earlier trials, targets, browser checks and independent
reviews.

These measurements predate the #0134 static home and external catalogue. They do
not establish current home latency or unchanged analytical startup. Measure bytes,
request counts and visible readiness separately for the new request graph. The large matrix's rendering
cost remains visible in these measurements. CDN/browser cache-policy changes
belong to the separate #0109 card; this change preserves the existing headers.
