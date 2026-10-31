# Quarterly ETL staffing and initial fanout

Current policy: the owner capped backfill batches at **10 quarters**, replacing
the earlier doubling plan. The [eight-quarter capacity check](eight-quarter-benchmark.md)
measured eight overlapping cold summaries at 21.77 GiB sampled worker working set
with 14.62 GiB sampled minimum available RAM. Native heavy-phase admission remains
memory-aware; more queued quarters do not automatically get simultaneous heavy
summaries. The six-direct-agent/depth-one ceiling is unchanged.

The subsequent [nine-quarter ingestion and Q2 repack](ten-item-backfill-and-repack.md)
completed the next ten-item workset. Source admission allowed eight CPU phases
and seven heavy summaries, reserving capacity for the repack. The nine source
pipelines completed in 105.77 seconds with 14.34 GiB sampled worker working set
and 22.05 GiB minimum available system RAM. This does not establish ten-heavy
capacity. All 24 loaded quarters now have a verified preferred `cache-v2` view,
including the unchanged explicit 2022 Q4 coverage gap.

The [completed four-quarter recovery benchmark](parallel-quarter-benchmark.md)
supersedes this initial sizing proposal. Four audits overlapped with a sampled
13.01 GiB worker working-set peak and a sampled minimum of 21.39 GiB RAM available. The owner
approved eight quarters next, then doubling while resources and required history
permit. Keep the six-direct-agent/depth-one limits and budget native threads
across processes. The older four-quarter recommendation below records the basis
for that first experiment rather than limiting the newly approved batch size.

## Historical initial proposal

The following proposal and its gates are retained as history. Its references to
the next four-quarter batch and the then-current three-card turn describe that
earlier approval, not the current ten-quarter cap above.

Recommendation from the accepted 2026 Q1 pilot and the measured 2025 Q4 run:
**one ETL operator plus a fresh independent reviewer** is useful for a new quarter.
The reviewer starts when artifacts exist; this is not a permanently idle pair.
The primary owns integration, board gates and final verification.

An agent coordinates work. Native Python/Polars processes perform the ETL, and
Polars threads perform its parallel computation. Increasing agent count does not
automatically increase those threads or improve a single quarter's throughput.

| Execution | Useful initial allocation |
| --- | --- |
| One routine new quarter | One operator, one fresh reviewer afterward |
| Historical batch | Four independent quarter ETL processes, four Polars threads each |
| Agents coordinating a batch | One operator can orchestrate all four processes; alternatively up to four authors can own separate quarter cards |
| Review wave | Reuse finished-author slots for fresh non-author reviews; no fixed idle reviewer reservations |

The four-process starting point is **RECOMMENDED** for the first measured fanout.
It is a capacity recommendation, not evidence of fourfold speedup or an
instruction to start extra cards during the current three-card turn. The owner
subsequently approved the four-quarter exception for the next benchmark batch:
2025 Q3, 2025 Q2, 2025 Q1 and 2024 Q4 (#0029–#0032).

## What was measured

2025 Q4 took 26.94 seconds to download, 30.78 seconds to project and 9.88 seconds
to audit. The author used one ETL worker and four Polars threads. The audit's
sampled process-tree peak was 3.82 GiB; projection peaked at 0.49 GiB.
The 2026 Q1 measurements were similar. These are sequential phase times;
agent setup, evidence interpretation and independent review add elapsed time.

Download, projection and summary audit depend on their preceding outputs. Extra
agents offer little useful subdivision of that chain. Independent quarters have
separate archives, projections, summaries and review evidence, making them the
natural first unit of throughput parallelism. The fixed pipeline can also be
orchestrated by one agent rather than assigning one agent to every process.

The laptop reports 14 physical cores / 20 logical processors and 63.68 GiB RAM.
During this turn it had 34.47 GiB free RAM and about 2,425 GiB free on D:.
Four workers at the observed audit peak would total about 15.3 GiB; that is a
planning estimate, not a measured concurrent peak. Sixteen Polars threads across
four workers leave some CPU capacity for review and the desktop. The owner's
5 Gbit/s Internet connection provides potential transfer headroom, but source
service throughput and concurrent performance have not been benchmarked.

## Historical first parallel batch gate

- Select up to the authorized number of eligible quarter cards and move each
  In Progress before any work. The current six-direct-agent, depth-one limit
  and three-cards-per-turn policy still apply generally. The owner's explicit
  exception permits the next four-quarter benchmark; it does not raise the
  general limit or authorize unrelated cards.
- Keep each quarter's outputs and logs separate. Use one writer for each
  quarter summary path and serialize writes to a shared B2 destination prefix.
- Recheck archive sizes, disk and available memory before launching; retain
  the measured per-quarter source/disk envelope until deliberately revised.
- Start with four ETL processes only when four cards are authorized together.
  With two quarter cards in a turn, run two processes; do not fill idle slots
  with unselected work.
- Measure actual concurrent wall time, peak memory, disk and transfer rates.
  Reduce concurrency if memory headroom or interactive responsiveness suffers.
  Increase beyond four only after those measurements justify it.
- Preserve source receipts, SHA-256 validation, full-calendar coverage and
  guarded cache reuse. More workers do not relax the independent review or
  truthful history/anchor requirements.

This recommendation covers quarter ingestion and persisted quarter summaries.
Combining complete history into a matrix has a different memory profile and
must be measured separately. B2 copying and restore verification also have
different transfer costs; they should not be counted as ETL CPU workers.
