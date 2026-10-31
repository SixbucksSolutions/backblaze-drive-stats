# Private Parquet metadata and layout

#0021, 2026-10-31. `parquet_profile.py` is the shared writer for daily projections
and quarter summaries. Parquet and its serial-bearing statistics remain private
and ignored by Git. No Trino deployment or measured Trino speedup is claimed.

## What was already present

Existing real footers contain min/max and null-count statistics, Arrow schema,
and column/offset page indexes. Sorting metadata and Bloom filters were absent.
Existing files remain valid; no broad CSV reimport occurred.

The [Polars API](https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_parquet.html)
advertises `statistics="full"`, but installed Polars 2.1.0 emitted no standard
footer distinct counts in real and edge-case tests. Actual output is inspected
rather than assuming an option name guarantees every optional field.

## Explicit shared policy

PyArrow 26.0.0 is already a runtime dependency. The physical profile fingerprints
options, engine version, sort keys and field descriptions, independently of
numerical summary semantics (`private-drive-quarter-v2`).

| Feature | Policy |
| --- | --- |
| Statistics | Explicit min/max and null/count statistics where supported; empty/all-null/physical-NULL columns need not have min/max |
| Groups | Maximum 65,536 rows |
| Actual sorting | Daily: model/serial/date; drive summaries: model ID/serial; frequencies: model ID/capacity |
| Sorting metadata | Matching ascending keys, nulls last; data is sorted before writing |
| Pages | Column/offset indexes, 256 KiB target pages, maximum 8,192 rows per page |
| Integrity | Page CRC checksums plus existing whole-object SHA-256 manifests |
| Encoding | Zstandard level 3 and dictionary encoding with fallback |
| Schema/lineage | Arrow schema, column descriptions/units, layout kind, private marker, Backblaze link and allowlisted hashes/partition |
| Exact NDV | Custom non-null distinct counts per column/row group; NaN counts as one value |

[Arrow documents](https://arrow.apache.org/docs/python/generated/pyarrow.parquet.write_table.html)
that sorting metadata alone does not sort or verify data. Our writer sorts and
tests both order and metadata. Standard footer distinct-count writing is not
exposed by this writer. `backblaze.row_group_non_null_ndv` is custom analysis
metadata, **not a standard footer NDV and not claimed to be consumed by Trino**.

## Judicious Bloom filters

- Only `serial_number`, on daily/drive-quarter files with at least 4,096 rows and
  a group containing at least 1,024 distinct non-null serials. These minimums are
  explicit heuristics, not universal performance thresholds.
- No default Bloom on model, canonical ID, manufacturer or capacity. Clustered
  min/max, indexes and dictionaries serve their predicates; tiny capacity tables
  have none.
- Target false-positive probability 0.05; NDV uses the largest observed group,
  rather than Arrow's million-value default. Smaller final groups have headroom.
  The benchmark's 0.01 target roughly doubled serial-filter space.
- High cardinality alone is insufficient: benefit requires selective equality or
  membership queries and groups that can be excluded. New workload choices need
  measurements and a new profile.

[Trino documents](https://trino.io/docs/current/object-storage/file-formats.html)
Bloom and column-index predicate pushdown. Current PyArrow does not use these
Bloom filters or page indexes for its own filtering. Trino also has a small-file
whole-read threshold: these small private files are not an optimal-Trino-table
claim. Future compaction, partitions and catalog choices need workload evidence.

## Bounded measurement

`tools/benchmark_parquet_profile.py` compares native/default/full and Arrow
sorted/index/checksum/Bloom variants. `--shared-profile` tests the actual writer.
Output directories must be new/empty. All output/input paths are checked before
writing, including existing symlink/hardlink aliases. Reports contain aggregate
metrics, not serials or actual private min/max probes.

Final actual-profile evidence is in ignored
`data/staging/0021/benchmark-final-safe/final-shared-profile.json`:

| Input | Rows | Original bytes | Enriched bytes | Footer bytes |
| --- | ---: | ---: | ---: | ---: |
| Daily projection | 345,738 | 2,378,871 | 1,978,942 | 13,743 |
| Drive-quarter summary | 359,101 | 2,354,558 | 2,152,825 | 14,744 |
| Capacity frequencies | 80 | 3,062 | 9,452 | 7,376 |

Clustering/compression offset metadata overhead in large samples. The tiny table
grows by about 6.4 KB, a deliberate absolute-size tradeoff. Sample footers remain
below 48 KiB. Model/id predicates reduced candidate groups from 3/4 to 1 in a
dataset-metadata check: measured pruning, not end-to-end Trino timing. Exact NDV
calculation took about 9–13 ms for large sample variants. Logical parity, source
hashes, Bloom presence/absence, sorting, indexes, checksum reads and units passed.

## Reuse and recovery

New daily imports record `parquetProfile` in their receipt. Existing daily files
are preserved. A deliberate future daily-file migration must update hashes and
receipts; it is not silently performed here.

Verified legacy summaries are repacked from small retained frames into
`quarters/YYYY-QN/<semantic-key>.<physical-profile>/`. Original files/manifests
remain unchanged; valid current variants are preferred. Layout changes do not
invalidate numerical summaries or require daily parsing. Physical write failures
surface directly instead of triggering source rescans. Checksums and a manifest
commit marker retain their recovery role.

An actual 2026 Q2 repack took about 1.99 s, then 1.80 s on reuse, with daily scans
prohibited. The original three cache objects were unchanged. Matrix/supporting
values matched prior classified output at exact integers and `1e-10` float
tolerance; generation identity/time/code context changed. No historical archive,
remote object or published site bundle was rewritten.

```powershell
uv run --frozen python -m unittest discover -s tests -p test_parquet_profile.py
uv run --frozen python -m unittest discover -s tests -p test_historical_generator.py
uv run --frozen python -m unittest discover -s tests -p test_parquet_benchmark.py
```

Tests inspect physical headers/footers, CRC presence and verified reads,
empty/all-null/NaN cases, serial-only Bloom, actual group pruning, sorted parity,
no-rescan upgrades, original-byte preservation and interrupted-write behavior.
