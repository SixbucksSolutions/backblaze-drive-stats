# Eight-quarter ingestion, source gap and capacity check

The owner accepted #0029–#0032 and authorized eight quarters: 2024 Q3 through
2022 Q4 (#0033–#0040). Four author agents prepared source checks and reports;
the primary coordinated eight native worker processes with two Polars threads
each. Fresh non-author reviewers checked each two-quarter packet. Maintained
projection and summary semantics were unchanged.

Backblaze provides the underlying [Drive Stats data](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data).
Processing, quality checks and measurements are independent Sixbucks Solutions
work. Publisher SHA-1 was unavailable for these eight archives; exact advertised
sizes, local hashes, ZIP member CRCs and actual observation dates were checked.
Catalog file counts were not treated as proof of daily coverage.

## Source result

| Quarter | Valid observation days | Known observations | Exact ALN604 identities |
| --- | --- | --- | --- |
| 2024 Q3 | 92/92 | 26,822,987 | 10,504 |
| 2024 Q2 | 91/91 | 26,022,269 | 10,698 |
| 2024 Q1 | 91/91 | 25,189,213 | 10,634 |
| 2023 Q4 | 92/92 | 24,790,999 | 10,651 |
| 2023 Q3 | 92/92 | 23,601,986 | 10,567 |
| 2023 Q2 | 91/91 | 21,835,156 | 10,705 |
| 2023 Q1 | 90/90 | 21,454,992 | 10,781 |
| 2022 Q4 | 91/92, incomplete | 21,260,686 | At least 10,796 |

ALN604 means exact **HUH721212ALN604**, separate from ALE variants. Counts are
model/serial identities seen in valid observations, not quarter-end installed
population. The incomplete quarter's full Count and AFR remain null; the table
shows its known lower-bound component. No zero-observation boundary, original
eligibility anchor or cumulative-history completeness was established.

The original eight-pipeline command envelope took **107.60 seconds**, completing
seven full-calendar audits. The eighth correctly stopped when `2022-12-10.csv`
contained only December 11 row dates. The December 10- and December 11-named
members match across all non-failure fields; eight failure flags differ. This is
not authority to relabel or reconstruct a December 10 capture.

The [reviewed partial recovery](quarter-2022-Q4.md) preserved the source ZIP,
reused 70 validated daily Parquets and projected 21 remaining valid days using
the strict parser. It excluded only the invalid member and stored explicit
missing-date/exclusion provenance in the receipt. There is no imputed observation,
failure, exposure or full-quarter Count. This recovery is separate from the
original seven-success/one-failure benchmark.

Each complete quarter received independent all-partition hash/footer/lineage
checks, three complete CSV-day multiset comparisons and guarded warm-summary
reuse. The partial quarter received equivalent bounded checks on its 91 retained
days, exclusion provenance and null full-quarter metrics. All 679 files in the
seven previously accepted quarter/generation baseline remained byte-identical.

## Actual eight-heavy-phase capacity

The source failure released waiting workers early, so eight launched pipelines
did not establish eight simultaneous heavy audits. A separate capacity probe
rebuilt only small summaries in an isolated cache from the verified daily
Parquet. It did not reparse ZIP/CSV or overwrite accepted caches. This workload
comprised seven complete quarters and the explicit 91-day partial quarter.

| Measurement | Result |
| --- | --- |
| Capacity-probe elapsed time | 22.72 seconds |
| Eight cold-summary command intervals overlapped | 16.40 seconds |
| Sampled peak combined owned working set | 21.77 GiB |
| Sampled minimum available system RAM | 14.62 GiB |
| Cold misses followed by guarded warm hits | 8 |
| Worker exits | All eight successful |
| Original summary caches | Unchanged |

Independent review checked sorted semantic parity for all 16 drive/capacity
summary Parquets. The reviewed probe's before/after hashes cover all 24 original
cache files. Seven original manifest hashes have separately retained earlier
audit fingerprints; the partial manifest's preservation relies on that recorded
before/after check. Cold refers to the summary cache; the operating-system cache
was not flushed. Working-set sums can count shared pages, and sampling can miss
brief peaks. This is a capacity check, not a controlled end-to-end speedup test
or a bound on full-history matrix aggregation.

The memory stop guard is sampled, not an operating-system quota. It stops below
8 GiB available RAM. Original ingestion's per-quarter disk monitor stops at
9 GiB with headroom under its 10 GiB execution envelope; the separate capacity
probe writes only small isolated summaries and does not use that disk monitor.
Owned Windows jobs contain descendant
writers through failures. No shared mutable progress-file readers were used.

## Durable retention and bounded object requests

`transfer_verified(..., max_workers=8)` and CLI `--workers 8` now allow bounded
requests to distinct verified object keys. The default remains one worker. All
manifest validation precedes object I/O; failures cancel pending work and wait
for started workers before raising. One coordinator owns the destination prefix
and shares one pre-created low-level client, without client metadata/event
mutation or process sharing. No distributed transaction is claimed.

Two independently reviewed manifests retained the new processing caches:

| Packet | Objects | Payload bytes | Result |
| --- | --- | --- | --- |
| 2024 Q3 through 2023 Q4 | 382 | 606,790,012 | Upload/readback/reuse passed; restore resumed and fully verified |
| 2023 Q3 through 2022 Q4 | 380 | 528,734,062 | Upload/readback/reuse/restore passed; incomplete coverage retained |

The first packet's initial restore stopped with `ValueError` after seven
verified files; the detailed cause was not captured and remains unknown. Its
failed receipt is preserved. A separate read-only resume copied 375 objects and
reused seven, then verified all 382 hashes and four guarded restored-summary
hits. Successful recovery does not establish that the unknown cause was fixed.

The second packet completed its full copy/readback, zero-write reuse and separate
restore/check sequence in **40.98 seconds**. All 380 hashes and four guarded
summary hits were independently checked locally. The restored 2022 Q4 receipt
still records 91/92 days and missing December 10. Remote verification is recorded
by execution; the independent reviewer did not access cloud credentials or
independently reread remote objects. These are different workloads from the
earlier serial transfer and do not establish a controlled speedup ratio.

Each content-addressed recovery manifest is also stored in B2, outside its
payload-object count. Sources remain local, no deletes occurred, and conflicting
existing destination content is refused. Raw ZIPs and runtime diagnostics are
outside the processing copies. Together with earlier copies, 15 quarter caches
are retained: **14 complete quarters and one explicitly incomplete quarter**.

## Next batch and evidence

The owner replaced the doubling policy with a **10-quarter cap**. The next
workset prioritizes the requested 2026 Q2 repack (#0058) plus nine historical
quarters (#0041–#0049, 2022 Q3 through 2020 Q3). #0050 carries forward. Keep six direct agents and depth
one. Native process count and agent count are separate. Use memory-aware phase
admission: eight heavy summaries are measured; ten or sixteen simultaneous heavy
summaries are not established by this run. Two times the observed working set
would be about 43.53 GiB before headroom, exceeding the approximately 34 GiB
available at preflight.

The repack must verify all 91 days losslessly and report an actual whole-quarter
saving. The 16.8% figure is one representative day, not a promise. Preferred-cache
publication must preserve old recovery-manifest objects and clearly distinguish
current from legacy layouts. No full-quarter repack was performed as part of this eight-card
ingestion batch.

Private evidence remains under each card's staging directory and
`data/staging/batch-0033-0040/`, `batch-0033-0040-capacity/`,
`batch-0033-0036-persistence/` and `batch-0037-0040-persistence/`. Source records,
private identities and Parquet remain outside Git. See the individual quarter
reports for exact source hashes, inventories and row/phase measurements.
