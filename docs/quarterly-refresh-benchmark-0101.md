# Quarterly replay benchmark (#0101)

The fresh 2026 Q2 replay completed through private B2 retention and production
Pages verification on 2026-11-01. Private receipts and trial evidence remain
under ignored `data/staging/0101/` and `data/staging/0101-publication/`.
Terry approved #0101 and moved it to Completed on 2026-11-01.

The first fresh GET began at 19:45:00 UTC and the public probe finished at
20:57:26 UTC: approximately 72 minutes 25 seconds. The four-connection GET
began at 20:27:06 UTC, approximately 30 minutes 20 seconds before that probe
finished. Both intervals include ongoing implementation, reviews, iterations
and gaps; neither is a clean automated pipeline benchmark. Stage measurements
overlap and must not be added into an elapsed-time claim or an SLA.

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
aside with a verified quarantine journal for the trials; all 14 paths and 395
files (2,926,533,695 bytes) were restored exactly, with a 6.609-second guard.
This replay used
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
Repeat runs can benefit from warm filesystem and operating-system caches; no OS
cache flush was established. The test machine had an i7-13700H (14 cores, 20
logical processors) and about 63.7 GiB RAM. **Recommended for this measured
machine:** six day workers with two Polars threads and eight validation workers;
eight and twelve day workers did not materially improve the projection trial.

Three maintained 6 × 2 / 8-validation runs took approximately 66–85 seconds
under the whole offline supervisor, compared with 214.2832 seconds for the serial
baseline. Wrapper times were 81.5283, 65.54 and 84.66 seconds; corresponding
guard times were 82.0321, 66.0099 and 85.0278 seconds. The four-validation-worker
variant took 96.29 seconds in its wrapper. A seeded variant took 86.221 seconds,
including 25.409 seconds copying and 56 new durable writes; it did not beat the
simpler unseeded path and remains unadopted. An experimental schema-validator
reuse showed 1.36% in one pair and was reverted.

All 91 maintained-output Parquets were byte-identical to the fresh serial run,
as were all 1,538 public JSON files. The result combined computed Q2 with 52
retained quarters. The independent audit is in the private evidence directory.

The maintained `verify` path passed in a 35.4166-second supervisor. A subsequent
warm re-run passed in 47.2025 seconds, reusing all 53 summaries with zero computed
quarters and zero public writes. All 1,538 public files retained their bytes and
modification times. A separate warm receipt preserved the original cold-run
receipt; this retry time is not a cold-ingestion measurement.

## Retention and publication

The optimized output's 96 processing objects (186,868,250 bytes) passed encrypted
B2 push, readback and separate restore in 9.9569 seconds. A Windows sandbox
temporary-file ACL required an exact private copy for the owner network process,
which took 2.2953 seconds. Keep related phases under a consistent OS identity;
do not change ACLs to work around this. A 52-to-53 catalog rehearsal took 39.429
seconds: it fetched the remote recovery manifest, restored all 96 objects,
verified a zero-write repeat and a guarded summary hit. It read or transferred
no old Parquet and made no main/local discovery writes. The pointer proof was
isolated; actual preferred pointers were unchanged.

The full web build took 159.0065 seconds. Quality gates passed 282 Python and
219 final web tests, plus lint, types and formatting. Hosted CI run 41347870023
passed on both operating systems in 7 minutes 44 seconds. These release gates
are material to the clock; future unknown-model decisions remain a real gate.

Production deployment `f290ba5d-abd1-4398-b0c3-f38b164fe0b4` used source
`d40282948d891470e680c88ca67fa3e2af710946` at the
[stable site](https://backblaze-drive-stats-analysis.pages.dev/). The 3,224-file,
302,751,587-byte upload retained 110 prior immutable files (13,694,100 bytes);
all 3,107 prior immutable files passed compatibility checks. The production
deploy guard took 21.1375 seconds. The public probe passed 3,223 served files
(302,750,421 bytes), four navigation checks, 18 missing-path checks and nine
redirects in a 30.9146-second guard. The previous deployment remains the rollback
predecessor. The retained 34,006,999-byte release ZIP passed all file SHA checks;
its private continuation record identifies the manifest, ledger and Vite pins.

No new rendered UI session was performed for #0101. UI behavior qualification
was reused from the accepted [integrated release validation](integrated-release-validation.md)
and its private browser evidence. The current and prior releases have identical
paths, sizes and hashes for all five compiled JavaScript files, three CSS files,
and seven font, license and provenance files. Root HTML's catalogue changed;
that byte comparison does not itself prove rendered behavior. Current browser-reader
and integrated-release gates, numeric and selection parity, and the public HTTP
checks cover the changed data and publication. The HTTP probe is not a rendered UI test.

## Operator handoff

Use the [quarterly refresh procedure](quarterly-refresh.md) for pins, discovery,
selection, verification and recovery. Acquiring and authenticating the source,
reviewing discoveries and selection, preparing a private retention manifest,
running the separate B2 transfer and verifying its restore, and promoting the
validated public graph to Pages remain explicit operator steps. Preserve the
production graph's immutable historical URLs through the reviewed packaging
process. These measurements describe this replay and do not promise a future
release duration.
