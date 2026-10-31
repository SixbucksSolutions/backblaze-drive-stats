# Four-quarter ETL and recovery benchmark

This is the earlier four-quarter experiment. The
[eight-quarter report](eight-quarter-benchmark.md) records the subsequent source
gap, capacity check and current 10-quarter cap; older scaling decisions below are
historical rather than current launch instructions.

The owner approved a four-card exception for 2025 Q3, 2025 Q2, 2025 Q1 and
2024 Q4 (#0029–#0032). The previously accepted 2026 Q2, 2026 Q1 and 2025 Q4
caches were preserved. Existing projection, Parquet profile, summary and audit
code ran unchanged, with four Polars threads per ETL process.

## What completed

All four official ZIPs downloaded successfully. Their actual calendars contain
92, 91, 90 and 92 days respectively. The 2025 Q3 download catalog's 91-file count
does not match its ZIP, which contains all 92 expected daily CSVs. The 2024 Q4
HEAD response exposes no publisher SHA-1; its exact advertised size, locally
computed SHA-1/SHA-256, source identity and ZIP/member integrity are recorded
without claiming an unavailable publisher checksum was verified.

The first coordinator attempt encountered a Windows `PermissionError` after
about 62 seconds. Its exact cause was not proven; mutable progress-file sharing
was a plausible cause. Owned jobs stopped their descendant writers, previously
accepted data remained byte-identical, and evidence from that attempt was kept.

Recovery removed cross-process readers/writers of mutable progress files and
used stdout telemetry. It reused all four byte-verified ZIPs and the completed
2025 Q1 projection. Three projections without completion receipts were preserved
separately and rebuilt into empty targets. One-time readiness markers aligned
the four summary audits. The recovery did not download any source again.

The resource guard counts source, staging, temporary output and preserved
attempt bytes. It stops at 9 GiB per quarter, leaving headroom under the 10 GiB
envelope. Suspended startup plus kill-on-close Windows jobs contain worker trees;
failure probes checked child and grandchild cleanup. Persistently unreadable
files fail the footprint guard rather than disappearing from its accounting.

## Measured recovery result

| Measurement | Result |
| --- | --- |
| Recovery worker envelope | 75.38 seconds |
| Concurrent worker processes | 4 |
| Three rebuilt projection command envelopes overlap | 50.92 seconds |
| Four audit command envelopes overlap | 18.08 seconds |
| Sampled combined worker-tree working-set peak | 13.01 GiB |
| Sampled minimum available system RAM | 21.39 GiB |
| Whole-machine average CPU utilization | 58.25% |
| Nominal sampling interval | 0.25 seconds |
| Resource samples | 256 |
| Worker exits | Four successful exits |
| Previously accepted source/cache bytes | Unchanged |

This is a **recovery measurement**, not a clean four-quarter end-to-end run.
The 75.38 seconds include source revalidation, three rebuilt projections,
readiness waiting and aligned audits. It is not an audit-only time. Q1's retained
projection resource record belongs to attempt one; its reuse receipt prevents
mistakenly counting it as a fourth rebuilt projection.

Command envelopes include launch/import/cleanup overhead. Their overlap does not
prove every native thread was simultaneously doing useful work. Working-set sums
can count shared pages more than once and sampling can miss brief peaks; available
system RAM provides a separate observed headroom measure. CPU includes other
desktop activity. Metadata hashing/preservation before and after the worker
envelope, agent preparation, review and B2 copying are outside that elapsed time.
No controlled serial-versus-parallel speedup was established.

## Discovery result

The frozen ingestion registry leaves **HMS5C4040BLE640** unclassified despite
5,866 observed identities in 2024 Q4 and 4,121 in 2025 Q1. It is retained in
all-source inventory rather than lost behind the old interest regex. Backblaze's
own [2025 Q1 report](https://www.backblaze.com/blog/backblaze-drive-stats-for-q1-2025/)
identifies it as one of its 4 TB HDD models. That source evidence is available for
the historical classification follow-up in #0017; the benchmark registry and
already audited cache bytes were not rewritten. Confirmed media, historical
fleet presence and current purchase relevance remain separate decisions.

## Durable retention and recovery

After the four independent quarter reviews cleared, a single writer copied
**477 processing objects / 849,747,911 bytes** to the owner's private B2 cache.
The manifest covers these four new quarters and the already accepted 2025 Q4
cache as retained input. It excludes raw ZIPs, partial attempts, private runtime
logs, workbooks and public snapshots. No 2025 Q4 ingestion was rerun.

Every uploaded object passed SHA-256 readback. A repeated full copy verified
477 reuses with zero writes. The content-addressed recovery manifest was stored
and verified in B2, fetched and used to restore all 477 objects to a separate
local root. All five restored enriched quarter summaries were guarded cache hits,
with logical daily reads forbidden. The full copy/readback/reuse/restore/check
sequence took **430.44 seconds**, outside the ETL recovery measurement above.

The transfer manifest SHA-256 is
`1b789e85b09bd26a2c71861a79ec63a3e52ec3f36f0681c328eff5beeee4b91f`.
Execution receipts and the reviewed manifest remain under ignored
`data/staging/batch-0029-0032-persistence/`. Local originals remain intact and no
delete was performed. Conflicting existing destination bytes are refused rather
than overwritten; one-writer ownership is still required and is not a distributed
conditional-write guarantee. The remote recovery manifest is an additional
object beyond the 477 payload objects.

Together with the accepted first migration, processing caches for seven loaded
quarters, 2024 Q4 through 2026 Q2, are retained in B2. Raw ZIPs remain local and
can be reacquired from the official source. The generic hierarchy and recovery
limitations are described in [history-storage.md](history-storage.md).

## Staffing decision

Four concurrent quarter processes completed with substantial memory headroom
and actual audit overlap. The owner then approved **eight quarters next, doubling
again while resources and required history permit**. That replaces the proposed
standing four-quarter limit. A later clean run is still needed for an end-to-end
throughput comparison; this result does not bound full-history aggregation memory.

One operator can orchestrate four native processes. In this batch, four author
agents prepared quarter-specific source checks and reports while the primary
coordinated computation and recovery. Fresh non-author reviewers then checked
the artifacts. That separation is useful for evidence and review; four language
model agents are not required to perform the computation itself.

The owner-approved doubling policy applies to quarter-backfill batches; it does
not raise the six-direct-agent ceiling or depth-one limit. Four author agents can
own two quarters each while one coordinator launches eight native processes.
Budget threads across the laptop rather than multiplying each worker's allocation
unchecked. Recheck available memory, source sizes and disk before each increase,
and keep stop guards. Stop increasing when measured resources or the required
history boundary makes it inappropriate. Other work retains its ordinary card
limit and In Progress gates.

Detailed private evidence is retained under ignored
`data/staging/batch-0029-0032/` and `data/staging/batch-0029-0032-recovery/`, plus
each card's staging directory. All raw data and private Parquet remain outside
Git. See the quarter reports for exact-model observations and source hashes:
[2025 Q3](quarter-2025-Q3.md), [2025 Q2](quarter-2025-Q2.md),
[2025 Q1](quarter-2025-Q1.md), [2024 Q4](quarter-2024-Q4.md).
