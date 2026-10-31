"""Bounded, local Parquet profile comparison; outputs aggregate metrics only.

Example: python tools/benchmark_parquet_profile.py --input sample.parquet \
    --output-dir data/staging/profile-benchmark --row-group-size 65536 131072
Output files contain the input data; keep the output directory private/ignored.
The output directory must be new or empty; use a new directory for each run.
Reported min/max pruning is a footer-based estimate, not measured I/O.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import json
import statistics
import time
from pathlib import Path

import polars as pl
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq
from polars.testing import assert_frame_equal


def timed(operation):
    start = time.perf_counter()
    result = operation()
    return result, round(time.perf_counter() - start, 6)


def assert_parity(expected, actual):
    """Fail without exposing row values in assertion output."""
    try:
        assert_frame_equal(expected, actual)
    except AssertionError:
        raise RuntimeError("Logical Parquet round-trip/filter parity failed") from None


def footer(path):
    metadata = pq.ParquetFile(path).metadata
    chunks = [metadata.row_group(r).column(c)
              for r in range(metadata.num_row_groups)
              for c in range(metadata.num_columns)]
    return {
        "rows": metadata.num_rows, "row_groups": metadata.num_row_groups,
        "column_chunks": len(chunks), "file_bytes": path.stat().st_size,
        "footer_bytes": metadata.serialized_size,
        "chunks_with_minmax": sum(bool(c.statistics and c.statistics.has_min_max) for c in chunks),
        "chunks_with_null_count": sum(bool(c.statistics and c.statistics.has_null_count) for c in chunks),
        "chunks_with_ndv": sum(bool(c.statistics and c.statistics.has_distinct_count) for c in chunks),
        "chunks_with_column_index": sum(c.has_column_index for c in chunks),
        "chunks_with_offset_index": sum(c.has_offset_index for c in chunks),
        "chunks_with_bloom": sum(c.bloom_filter_offset is not None for c in chunks),
        "bloom_bytes": sum(c.bloom_filter_length or 0 for c in chunks),
        "sorted_row_groups": sum(bool(metadata.row_group(r).sorting_columns)
                                 for r in range(metadata.num_row_groups)),
    }


def predicates(frame, key):
    values = frame[key].drop_nulls().unique(maintain_order=True)
    probes = [values[i] for i in sorted({0, len(values) // 2, len(values) - 1})] if len(values) else []
    # No probe values are included in reports, including serial numbers.
    if frame.schema[key] == pl.String:
        missing = "__benchmark_absent_probe__"
        while missing in values:
            missing += "_"
        probes.append(missing)
    return probes


def run_case(frame, path, key, size, writer, ordered, repeats, fpp, sort_keys=None):
    sort_keys = sort_keys or [key]
    source, sort_seconds = timed(lambda: frame.sort(sort_keys, nulls_last=True)) if ordered else (frame, 0.0)
    bloom_keys = [k for k in ("model", "id", "serial_number") if k in source.columns] or [key]
    _, ndv_seconds = timed(lambda: [source.slice(start, size).select(
        pl.all().drop_nulls().n_unique()) for start in range(0, source.height, size)])
    table = source.to_arrow()
    options = dict(compression="zstd", compression_level=3, row_group_size=size)
    bloom = writer == "arrow_bloom"
    def write():
        if writer.startswith("native"):
            source.write_parquet(path, statistics="full" if writer == "native_full" else True, **options)
        else:
            sorting = pq.SortingColumn.from_ordering(table.schema, [(k, "ascending") for k in sort_keys], null_placement="at_end") if ordered else None
            pq.write_table(table, path, write_statistics=True, write_page_index=True,
                           write_page_checksum=True, sorting_columns=sorting,
                           bloom_filter_options={k: {"ndv": min(size, max(1, source[k].drop_nulls().n_unique())), "fpp": fpp} for k in bloom_keys} if bloom else None,
                           **options)
    _, write_seconds = timed(write)
    restored, read_seconds = timed(lambda: pl.read_parquet(path))
    assert_parity(source, restored)
    # Read with checksum checking enabled; absence of an error alone is not proof
    # that a writer emitted checksums (the Python metadata API has no CRC flag).
    pq.ParquetFile(path, page_checksum_verification=True).read()
    metadata = pq.ParquetFile(path).metadata
    queries = []
    for key in bloom_keys:
        key_index = metadata.schema.names.index(key)
        for probe in predicates(frame, key):
            expected = source.filter(pl.col(key) == probe)
            samples = []
            for _ in range(repeats):
                actual, seconds = timed(lambda: pl.scan_parquet(path).filter(pl.col(key) == probe).collect())
                assert_parity(expected, actual)
                samples.append(seconds)
            selected = 0
            for r in range(metadata.num_row_groups):
                stats = metadata.row_group(r).column(key_index).statistics
                selected += not stats or not stats.has_min_max or stats.min <= probe <= stats.max
            # Arrow dataset row-group selection exercises its actual metadata pruning.
            fragment = next(ds.dataset(path, format="parquet").get_fragments())
            arrow_groups = len(fragment.split_by_row_group(filter=ds.field(key) == probe))
            queries.append({"predicate_column": key, "matches": expected.height, "minmax_candidate_row_groups": selected,
                            "arrow_candidate_row_groups": arrow_groups,
                            "polars_filter_median_seconds": round(statistics.median(samples), 6)})
    return {"writer": writer, "ordered": ordered, "row_group_size": size,
            "sort_columns": sort_keys if ordered else [], "sort_seconds": sort_seconds, "write_seconds": write_seconds,
            "exact_nonnull_ndv_seconds": ndv_seconds,
            "read_seconds": read_seconds, "parity": True,
            "checksum_write_requested": writer.startswith("arrow"),
            "checksum_verification_read_passed": True,
            "bloom_target_fpp": fpp if bloom else None,
            "footer": footer(path), "queries": queries}


def edge_cases(output):
    frame = pl.DataFrame({"key": ["a", None, "a", "z", None],
                          "all_null": pl.Series([None] * 5, dtype=pl.Int64),
                          "number": [float("nan"), None, 1.0, float("inf"), -float("inf")]})
    results = []
    for writer in ("native_default", "native_full", "arrow_indexed", "arrow_bloom"):
        path = output / f"benchmark-edge-{writer}.parquet"
        result = run_case(frame, path, "key", 3, writer, True, 1, 0.05)
        restored = pl.read_parquet(path)
        assert restored["all_null"].null_count() == 5
        assert restored["number"].is_nan().sum() == 1
        assert_parity(frame.sort("key", nulls_last=True), restored)
        result["null_allnull_nan_parity"] = True
        results.append(result)
    return results


def benchmark_shared_profile(inputs, output, repeats):
    """Measure the production helper against unchanged local source files."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from parquet_profile import PROFILE_ID, ROW_GROUP_SIZE, SORT_KEYS, SPEC, inspect_profile, write_enriched_parquet

    results = {"profile_id": PROFILE_ID, "versions": {"polars": pl.__version__, "pyarrow": pa.__version__},
               "timing_note": "Local warm-cache timings; candidate groups do not measure bytes read or Bloom acceleration.",
               "inputs": []}
    for number, input_path in enumerate(inputs):
        path = Path(input_path)
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        frame, source_read_seconds = timed(lambda: pl.read_parquet(path))
        if "date" in frame.columns and "model" in frame.columns:
            kind = "daily_projection"
        elif "serial_number" in frame.columns and "id" in frame.columns:
            kind = "drive_quarter"
        elif "capacity_bytes" in frame.columns and "id" in frame.columns:
            kind = "capacity_frequencies"
        else:
            raise ValueError("Shared-profile benchmark needs a recognized full projected/summary schema")
        destination = output / f"benchmark-shared-{number}-{kind}.parquet"
        layout, write_seconds = timed(lambda: write_enriched_parquet(
            frame, destination, kind=kind, lineage={"sourcePartitionSha256": before}))
        restored, read_seconds = timed(lambda: pl.read_parquet(destination))
        ordered = frame.sort(SORT_KEYS[kind], nulls_last=True, maintain_order=True)
        assert_parity(ordered, restored)
        parquet = pq.ParquetFile(destination, page_checksum_verification=True)
        parquet.read()
        metadata = parquet.metadata
        custom_ndv = json.loads(metadata.metadata[b"backblaze.row_group_non_null_ndv"])
        for group in range(metadata.num_row_groups):
            actual = restored.slice(group * ROW_GROUP_SIZE, ROW_GROUP_SIZE).select(
                pl.all().drop_nulls().n_unique()).row(0, named=True)
            if actual != custom_ndv[group]:
                raise RuntimeError("Custom exact non-null NDV verification failed")
            expected_sorting = pq.SortingColumn.from_ordering(parquet.schema_arrow,
                [(key, "ascending") for key in SORT_KEYS[kind]], null_placement="at_end")
            if metadata.row_group(group).sorting_columns != expected_sorting:
                raise RuntimeError("Declared sorting metadata does not match actual sorted output")
        bloom_columns = sorted({metadata.row_group(r).column(c).path_in_schema
            for r in range(metadata.num_row_groups) for c in range(metadata.num_columns)
            if metadata.row_group(r).column(c).bloom_filter_offset is not None})
        expected_bloom = sorted(key for key in SPEC["bloomColumns"][kind]
            if frame.height >= SPEC["bloomMinRows"] and max(row[key] for row in custom_ndv) >= SPEC["bloomMinDistinct"])
        if bloom_columns != expected_bloom:
            raise RuntimeError("Unexpected actual Bloom-filter columns")
        if metadata.serialized_size >= 48 * 1024:
            raise RuntimeError("Shared profile footer exceeds 48 KiB benchmark threshold")
        fields_described = all(field.metadata and b"description" in field.metadata and b"unit" in field.metadata
                               for field in parquet.schema_arrow)
        queries = []
        keys = [k for k in ("model", "id", "serial_number") if k in frame.columns]
        for key in keys:
            for probe in predicates(frame, key):
                expected = ordered.filter(pl.col(key) == probe)
                sample_times = []
                for _ in range(repeats):
                    selected, seconds = timed(lambda: pl.scan_parquet(destination).filter(pl.col(key) == probe).collect())
                    assert_parity(expected, selected)
                    sample_times.append(seconds)
                counts = []
                for candidate in (path, destination):
                    fragment = next(ds.dataset(candidate, format="parquet").get_fragments())
                    counts.append(len(fragment.split_by_row_group(filter=ds.field(key) == probe)))
                queries.append({"column": key, "matches": expected.height,
                    "source_candidate_groups": counts[0], "profile_candidate_groups": counts[1],
                    "profile_filter_median_seconds": round(statistics.median(sample_times), 6)})
        unchanged = hashlib.sha256(path.read_bytes()).hexdigest() == before
        if not unchanged:
            raise RuntimeError("Benchmark source changed during execution")
        results["inputs"].append({"input_label": path.name, "rows": frame.height, "kind": kind,
            "source_unchanged": unchanged, "logical_parity": True, "exact_custom_ndv_verified": True,
            "truthful_sort_metadata_verified": True, "checksummed_arrow_read_passed": True,
            "field_descriptions_and_units": fields_described, "actual_bloom_columns": bloom_columns,
            "private_flag_present": b"backblaze.privacy" in metadata.metadata,
            "lineage_matches_source": json.loads(metadata.metadata[b"backblaze.lineage"]) == {"sourcePartitionSha256": before},
            "source_read_seconds": source_read_seconds, "profile_read_seconds": read_seconds,
            "profile_write_seconds": write_seconds, "layout": layout,
            "source_footer": footer(path), "profile_footer": footer(destination),
            "profile_features": inspect_profile(destination), "queries": queries})
    result = output / "final-shared-profile.json"
    result.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Aggregate shared-profile report: {result}")


def preflight_outputs(inputs, output, sizes, shared):
    """Reject every input/output alias before creating or writing any artifact.

    A fresh empty directory also prevents accidental replacement of unrelated
    prior benchmark output. Use a new directory for each benchmark run.
    """
    sources = [Path(path).resolve(strict=True) for path in inputs]
    writers = ("native_default", "native_full", "arrow_indexed", "arrow_bloom")
    if shared:
        # A superset avoids reading input data to discover its layout kind.
        names = [f"benchmark-shared-{i}-{kind}.parquet" for i in range(len(inputs))
                 for kind in ("daily_projection", "drive_quarter", "capacity_frequencies")]
        names.append("final-shared-profile.json")
    else:
        names = [f"benchmark-edge-{writer}.parquet" for writer in writers]
        names += [f"benchmark-{i}-{size}-{int(ordered)}-{writer}.parquet"
                  for i in range(len(inputs)) for size in sizes
                  for ordered in (False, True) for writer in writers]
        names.append("benchmark-results.json")
    for name in names:
        destination = (output / name).resolve()
        if any(destination == source or (destination.exists() and destination.samefile(source))
               for source in sources):
            raise ValueError("A planned output aliases a source input; no benchmark files were written")
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError("Benchmark output directory must be new or empty; use a new directory for each run")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--row-group-size", type=int, nargs="+", default=[65536, 131072])
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--max-rows", type=int, default=400000)
    parser.add_argument("--fpp", type=float, default=0.05)
    parser.add_argument("--shared-profile", action="store_true", help="Benchmark the current production helper on full inputs")
    args = parser.parse_args()
    if any(n <= 0 for n in args.row_group_size) or args.repeats <= 0 or args.max_rows <= 0 or not 0 < args.fpp < 1:
        parser.error("sizes/repeats must be positive and FPP must be between zero and one")
    if any("://" in path or not Path(path).is_file() for path in args.input):
        parser.error("inputs must be existing local files")
    try:
        preflight_outputs(args.input, args.output_dir, args.row_group_size, args.shared_profile)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.shared_profile:
        benchmark_shared_profile(args.input, args.output_dir, args.repeats)
        return
    report = {"versions": {"polars": pl.__version__, "pyarrow": pa.__version__},
              "timing_note": "Single-process local warm-cache timings; no I/O or Bloom-read acceleration claim.",
              "inputs": [], "edge_cases": edge_cases(args.output_dir)}
    for i, input_path in enumerate(args.input):
        if "://" in input_path:
            parser.error("only local input paths are supported")
        path = Path(input_path)
        if not path.is_file():
            parser.error("each input must be an existing local file")
        frame = pl.read_parquet(path, n_rows=args.max_rows)
        key = next((k for k in ("serial_number", "id") if k in frame.columns), frame.columns[0])
        sort_keys = (["model", "serial_number", "date"] if "model" in frame.columns and "date" in frame.columns
                     else ["id", "serial_number"] if "id" in frame.columns and "serial_number" in frame.columns
                     else ["id", "capacity_bytes"] if "id" in frame.columns and "capacity_bytes" in frame.columns
                     else [key])
        entry = {"input_label": path.name, "rows_sampled": frame.height,
                 "sample_limited": pq.ParquetFile(path).metadata.num_rows > frame.height,
                 "predicate_column": key, "source_footer": footer(path), "cases": []}
        for size in args.row_group_size:
            for ordered in (False, True):
                for writer in ("native_default", "native_full", "arrow_indexed", "arrow_bloom"):
                    destination = args.output_dir / f"benchmark-{i}-{size}-{int(ordered)}-{writer}.parquet"
                    entry["cases"].append(run_case(frame, destination, key, size, writer, ordered, args.repeats, args.fpp, sort_keys))
        report["inputs"].append(entry)
    result = args.output_dir / "benchmark-results.json"
    result.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Aggregate benchmark report: {result}")


if __name__ == "__main__":
    main()
