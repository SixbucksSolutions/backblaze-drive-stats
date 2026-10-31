"""Versioned, private Parquet layout with verified-reader optimization metadata.

Callers write to a temporary path and publish atomically. This module changes
physical row order/layout, never the logical observations or numerical semantics.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq

ROW_GROUP_SIZE = 65_536
SORT_KEYS = {
    "daily_projection": ["model", "serial_number", "date"],
    "drive_quarter": ["id", "serial_number"],
    "capacity_frequencies": ["id", "capacity_bytes"],
}
SPEC = {
    "version": "private-parquet-rich-v1",
    "engine": "pyarrow",
    "engineVersion": pa.__version__,
    "rowGroupRows": ROW_GROUP_SIZE,
    "dataPageBytes": 262_144,
    "maxRowsPerPage": 8192,
    "compression": "zstd",
    "compressionLevel": 3,
    "parquetVersion": "2.6",
    "dataPageVersion": "1.0",
    "statistics": True,
    "pageIndex": True,
    "pageChecksum": True,
    "storeArrowSchema": True,
    "dictionaryEncoding": True,
    "bloomFpp": 0.05,
    "bloomMinRows": 4096,
    "bloomMinDistinct": 1024,
    "bloomColumns": {
        "daily_projection": ["serial_number"],
        "drive_quarter": ["serial_number"],
        "capacity_frequencies": [],
    },
    "sortKeys": SORT_KEYS,
    "customNdv": "exact_non_null_per_row_group_nan_counts_as_one",
}


def _json(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


DESCRIPTIONS = {
    "date": ("Source observation date", "calendar_date"),
    "serial_number": ("Private drive serial; identity also includes canonical model", "identifier"),
    "model": ("Raw SMART model name; not a normalized selection filter", "identifier"),
    "id": ("Stable canonical model identifier; exact model variants remain separate", "identifier"),
    "capacity_bytes": (
        "Reported positive capacity for frequencies; raw reported capacity in daily projections",
        "bytes",
    ),
    "failure": ("Daily binary failure flag", "daily_failure_flag"),
    "failures": ("Sum of daily failure flags within this drive quarter", "daily_failure_flags"),
    "driveDays": (
        "Count of recorded daily observations within this drive quarter",
        "recorded_drive_days",
    ),
    "first": ("First observation in this quarter, not lifetime installation date", "calendar_date"),
    "last": ("Last observation in this quarter, not confirmed retirement date", "calendar_date"),
    "datacenter": (
        "Daily location or last quarterly location; missing source coverage stays explicit",
        "location_label",
    ),
    "len": (
        "Number of positive-capacity daily observations for this model and capacity",
        "recorded_observations",
    ),
}

SPEC["fieldDescriptions"] = DESCRIPTIONS
PROFILE_ID = SPEC["version"] + "-" + hashlib.sha256(_json(SPEC)).hexdigest()[:12]


def _lineage(value: dict | None) -> dict:
    value = {} if value is None else value
    allowed = {
        "sourceZipSha256",
        "sourcePartitionSha256",
        "sourceManifestSha256",
        "semanticKey",
        "partition",
    }
    if not isinstance(value, dict) or set(value) - allowed:
        raise ValueError("Parquet lineage accepts only explicit hashes and partition identity")
    for key, item in value.items():
        pattern = (
            r"[0-9]{4}-(?:[0-9]{2}-[0-9]{2}|Q[1-4])" if key == "partition" else r"[0-9a-f]{64}"
        )
        if not isinstance(item, str) or not re.fullmatch(pattern, item):
            raise ValueError("Invalid Parquet lineage hash or partition")
    return dict(value)


def write_enriched_parquet(
    frame: pl.DataFrame, path: Path, *, kind: str, lineage: dict | None = None
) -> dict:
    if kind not in SORT_KEYS or set(SORT_KEYS[kind]) - set(frame.columns):
        raise ValueError("Parquet layout kind or required sorting columns are invalid")
    lineage = _lineage(lineage)
    if any(dtype.is_nested() for dtype in frame.dtypes):
        raise ValueError("This profile is defined for flat projected/summary columns")
    # Declared SortingColumn metadata is truthful only because sorting happens
    # here, with the same null placement. Parquet writers do not verify it.
    ordered = frame.sort(SORT_KEYS[kind], nulls_last=True, maintain_order=True)
    ndv = []
    for offset in range(0, ordered.height, ROW_GROUP_SIZE):
        part = ordered.slice(offset, ROW_GROUP_SIZE)
        ndv.append(
            part.select(
                [pl.col(name).drop_nulls().n_unique().alias(name) for name in ordered.columns]
            ).row(0, named=True)
        )
    if not ndv:  # Arrow 26 emits one empty row group for an empty table.
        ndv = [dict.fromkeys(ordered.columns, 0)]
    table = ordered.to_arrow()
    fields = []
    for field in table.schema:
        description, unit = DESCRIPTIONS.get(
            field.name, ("Private processing field", "unspecified")
        )
        fields.append(
            field.with_metadata({b"description": description.encode(), b"unit": unit.encode()})
        )
    metadata = {
        b"backblaze.parquet_profile": PROFILE_ID.encode(),
        b"backblaze.writer_spec": _json(SPEC),
        b"backblaze.layout_kind": kind.encode(),
        b"backblaze.sort_keys": _json(SORT_KEYS[kind]),
        b"backblaze.lineage": _json(lineage),
        b"backblaze.privacy": b"private-processing; contains drive identities",
        b"backblaze.dataset_source": b"https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data",
        # Arrow 26 does not expose a standard distinct_count writer. These exact
        # counts are custom metadata; Trino is not claimed to consume this key.
        b"backblaze.row_group_non_null_ndv": _json(ndv),
    }
    table = pa.Table.from_arrays(list(table.columns), schema=pa.schema(fields, metadata=metadata))
    equality_columns = [
        name
        for name in SPEC["bloomColumns"][kind]
        if name in ordered.columns
        and ordered.height >= SPEC["bloomMinRows"]
        and max(row[name] for row in ndv) >= SPEC["bloomMinDistinct"]
    ]
    bloom = {
        name: {"ndv": max(1, max((row[name] for row in ndv), default=0)), "fpp": SPEC["bloomFpp"]}
        for name in equality_columns
    }
    sorting = pq.SortingColumn.from_ordering(
        table.schema, [(name, "ascending") for name in SORT_KEYS[kind]], null_placement="at_end"
    )
    pq.write_table(
        table,
        path,
        row_group_size=ROW_GROUP_SIZE,
        version=SPEC["parquetVersion"],
        compression="zstd",
        compression_level=3,
        use_dictionary=True,
        write_statistics=True,
        data_page_size=SPEC["dataPageBytes"],
        data_page_version=SPEC["dataPageVersion"],
        max_rows_per_page=SPEC["maxRowsPerPage"],
        store_schema=True,
        write_page_index=True,
        write_page_checksum=True,
        sorting_columns=sorting,
        bloom_filter_options=bloom,
    )
    return {
        "profileId": PROFILE_ID,
        "kind": kind,
        "rowCount": ordered.height,
        "rowGroupRows": ROW_GROUP_SIZE,
        "sortKeys": SORT_KEYS[kind],
        "bloomColumns": equality_columns,
    }


def inspect_profile(path: Path) -> dict:
    """Describe footer features without emitting any private min/max values."""
    parquet = pq.ParquetFile(path)
    footer = parquet.metadata
    rows = []
    for index in range(footer.num_row_groups):
        group = footer.row_group(index)
        columns = []
        for number in range(group.num_columns):
            chunk = group.column(number)
            stats = chunk.statistics
            columns.append(
                {
                    "column": chunk.path_in_schema,
                    "statistics": chunk.is_stats_set,
                    "minMax": bool(stats and stats.has_min_max),
                    "nullCount": bool(stats and stats.null_count is not None),
                    "standardDistinctCount": bool(stats and stats.distinct_count is not None),
                    "columnIndex": chunk.has_column_index,
                    "offsetIndex": chunk.has_offset_index,
                    "bloomFilter": chunk.bloom_filter_offset is not None,
                    "compression": chunk.compression,
                }
            )
        rows.append(
            {
                "rows": group.num_rows,
                "sortingColumns": len(group.sorting_columns),
                "columns": columns,
            }
        )
    metadata = footer.metadata or {}
    return {
        "rowCount": footer.num_rows,
        "rowGroups": rows,
        "footerBytes": footer.serialized_size,
        "profileId": metadata.get(b"backblaze.parquet_profile", b"").decode(),
        "kind": metadata.get(b"backblaze.layout_kind", b"").decode(),
        "arrowSchema": b"ARROW:schema" in metadata,
        "customNdv": b"backblaze.row_group_non_null_ndv" in metadata,
    }
