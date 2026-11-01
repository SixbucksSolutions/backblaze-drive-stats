# Quarterly replay benchmark (#0101)

This record distinguishes measured stages from a complete publication. The
full fresh ZIP-to-Parquet/JSON-to-B2-to-Pages chain has not yet been measured
or verified end to end. Do not add the separate stage times and present the sum
as an end-to-end result. Private receipts and trial evidence are retained under
ignored `data/staging/0101/`.

## Source and baseline

On 2026-11-01 a fresh absent-destination download of the official 2026 Q2 ZIP
transferred 2,092,757,685 bytes in 46.3943 seconds. Its SHA-256 was
`b30be47290580c1aee9a5155afadc97c26e36220722bc5ee689108e949c74acc`.
The pin came from accepted earlier source metadata and the freshly confirmed
official HTTPS link; the response did not supply a publisher SHA-1. The
download required all response bytes but does not establish cold network, CDN
or operating-system caches.

A separate experimental private downloader used HTTP ranges against a fresh
destination. Two connections took 27.1648 seconds (24.2137 seconds network,
2.6666 seconds assembly); four took 14.7433 seconds (11.6988 seconds network,
2.7537 seconds assembly). Both matched the baseline SHA-256 and the 91-day ZIP
central directory. These single measurements are not cold-cache guarantees.
The downloader is a private experiment, not a maintained runbook command.

The serial offline baseline took 214.2832 seconds. A separate fresh-prefix B2
push, readback and restore took 9.6871 seconds. These are distinct scopes, not
a measurement of the entire release. Existing Q2 processing inputs were moved
aside with a verified quarantine journal for cold trials; restore the accepted
paths after the trials and retain the old recovery evidence. This replay uses
a derived 52-snapshot baseline through Q1, pins the 52 other retained summaries
and supplies fresh Q2 once. The complete previous release remains separate for
immutable upload and recovery. Combining the full old Q2 baseline with the fresh
revision would leave an extra active snapshot.

## Worker trials

The following day-projection trials used the same 91-day quarter and passed
byte parity. Times are individual trial measurements, not repeat distributions
or a guaranteed future duration.

| Day workers × Polars threads | Seconds |
| --- | ---: |
| 2 × 2 | 21.436 |
| 4 × 2 | 15.524 |
| 6 × 2 | 12.264 |
| 8 × 2 | 12.203 |
| 12 × 1 | 12.601 |

On the measured 53-snapshot validation workload, the serial run took 50.4208
seconds, four workers took 15.0359 seconds, and eight took 10.6568 seconds.
The parallel measurements include pool startup and shutdown. These stage tests
do not establish a whole-refresh speedup or account for concurrent workloads.
Repeat runs can benefit from warm filesystem and operating-system caches.
Six day workers with two Polars threads is a reasonable measured choice: eight
and twelve workers did not materially improve this trial. The full source quality
gates passed: 282 Python tests, 213 web tests, and lint, type and formatting checks.

## Operator handoff

Use the [quarterly refresh procedure](quarterly-refresh.md) for pins, discovery,
selection, verification and recovery. Acquiring and authenticating the source,
reviewing discoveries and selection, preparing a private retention manifest,
running the separate B2 transfer and verifying its restore, and promoting the
validated public graph to Pages remain explicit operator steps. Preserve the
production graph's immutable historical URLs through the reviewed packaging
process. Do not deploy or assert successful publication based on these isolated
trials. Record the final full-chain timings and verification only after that
actual chain completes.
