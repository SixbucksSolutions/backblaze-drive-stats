"""Inspect physical Parquet metadata, sorted data and bounded pruning behavior."""

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import polars as pl
import pyarrow.dataset as ds
import pyarrow.parquet as pq
from polars.testing import assert_frame_equal

from parquet_profile import (
    PROFILE_ID,
    ROW_GROUP_SIZE,
    SORT_KEYS,
    inspect_profile,
    write_enriched_parquet,
)


def daily(rows=6):
    return pl.DataFrame(
        {
            "date": [date(2026, 4, 1)] * rows,
            "serial_number": [f"private-{i:08d}" for i in range(rows)],
            "model": ["B" if i % 2 else "A" for i in range(rows)],
            "capacity_bytes": [10**12] * rows,
            "failure": [0] * rows,
            "datacenter": pl.Series([None] * rows, dtype=pl.String),
        }
    )


def page_header_has_crc(data, offset):
    """Read just the leading compact-Thrift i32 PageHeader fields (spec field4)."""

    def varint(position):
        value = shift = 0
        while True:
            byte = data[position]
            position += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value, position
            shift += 7

    previous = 0
    for _ in range(4):
        header = data[offset]
        offset += 1
        delta, kind = header >> 4, header & 15
        if delta:
            field = previous + delta
        else:
            encoded, offset = varint(offset)
            field = (encoded >> 1) ^ -(encoded & 1)
        if field == 4:
            return kind == 5  # compact protocol i32
        if kind != 5:
            return False
        _, offset = varint(offset)
        previous = field
    return False


class ParquetProfileTests(unittest.TestCase):
    def test_actual_footer_sorted_data_stats_indexes_and_page_crc(self):
        frame = daily()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "day.parquet"
            write_enriched_parquet(
                frame,
                path,
                kind="daily_projection",
                lineage={"partition": "2026-04-01", "sourceZipSha256": "a" * 64},
            )
            report = inspect_profile(path)
            self.assertEqual(report["profileId"], PROFILE_ID)
            self.assertTrue(report["arrowSchema"] and report["customNdv"])
            self.assertEqual(report["rowGroups"][0]["sortingColumns"], 3)
            for column in report["rowGroups"][0]["columns"]:
                self.assertTrue(
                    column["statistics"] and column["nullCount"] and column["offsetIndex"]
                )
                self.assertEqual(column["compression"], "ZSTD")
                if column["column"] != "datacenter":
                    self.assertTrue(column["minMax"] and column["columnIndex"])
                self.assertFalse(column["bloomFilter"])  # tiny files do not pay Bloom overhead
            assert_frame_equal(
                pl.read_parquet(path),
                frame.sort(SORT_KEYS["daily_projection"], nulls_last=True, maintain_order=True),
            )
            with pq.ParquetFile(path, page_checksum_verification=True) as parquet:
                self.assertEqual(parquet.read().num_rows, frame.height)
                offset = parquet.metadata.row_group(0).column(0).data_page_offset
                self.assertTrue(page_header_has_crc(path.read_bytes(), offset))
                metadata = parquet.schema_arrow.metadata
                self.assertEqual(
                    json.loads(metadata[b"backblaze.lineage"])["partition"], "2026-04-01"
                )
                self.assertEqual(
                    json.loads(metadata[b"backblaze.row_group_non_null_ndv"])[0]["datacenter"], 0
                )
                self.assertNotIn(b"private-000", b"".join(metadata.values()))
                self.assertEqual(
                    parquet.schema_arrow.field("capacity_bytes").metadata[b"unit"], b"bytes"
                )
            baseline = Path(directory) / "no-crc.parquet"
            pq.write_table(frame.to_arrow(), baseline, write_page_checksum=False)
            with pq.ParquetFile(baseline) as without_crc:
                offset = without_crc.metadata.row_group(0).column(0).data_page_offset
                self.assertFalse(page_header_has_crc(baseline.read_bytes(), offset))

    def test_serial_only_bloom_and_real_row_group_pruning(self):
        frame = daily(ROW_GROUP_SIZE * 2)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "grouped.parquet"
            profile = write_enriched_parquet(frame, path, kind="daily_projection")
            self.assertEqual(profile["bloomColumns"], ["serial_number"])
            report = inspect_profile(path)
            self.assertEqual(len(report["rowGroups"]), 2)
            for group in report["rowGroups"]:
                self.assertEqual(
                    [c["column"] for c in group["columns"] if c["bloomFilter"]], ["serial_number"]
                )
            fragment = next(ds.dataset(path, format="parquet").get_fragments())
            candidates = list(fragment.split_by_row_group(filter=ds.field("model") == "A"))
            self.assertEqual(sum(len(part.row_groups) for part in candidates), 1)
            result = pl.scan_parquet(path).filter(pl.col("model") == "A").collect()
            assert_frame_equal(
                result, frame.filter(pl.col("model") == "A").sort(SORT_KEYS["daily_projection"])
            )
            self.assertLess(report["footerBytes"], 48 * 1024)

    def test_empty_and_nonkey_nan_infinity_null_round_trip(self):
        frame = daily(4).with_columns(
            pl.Series("measurement", [float("nan"), float("inf"), float("-inf"), None])
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "edge.parquet"
            write_enriched_parquet(frame, path, kind="daily_projection")
            assert_frame_equal(pl.read_parquet(path), frame.sort(SORT_KEYS["daily_projection"]))
            ndv = json.loads(pq.read_metadata(path).metadata[b"backblaze.row_group_non_null_ndv"])
            self.assertEqual(ndv[0]["measurement"], 3)
            empty = pl.DataFrame(
                schema={"id": pl.String, "capacity_bytes": pl.Float64, "len": pl.UInt32}
            )
            write_enriched_parquet(empty, path, kind="capacity_frequencies")
            assert_frame_equal(pl.read_parquet(path), empty)
            ndv = json.loads(pq.read_metadata(path).metadata[b"backblaze.row_group_non_null_ndv"])
            self.assertEqual(ndv, [{"id": 0, "capacity_bytes": 0, "len": 0}])
            self.assertFalse(
                any(
                    c["bloomFilter"]
                    for g in inspect_profile(path)["rowGroups"]
                    for c in g["columns"]
                )
            )

    def test_lineage_cannot_include_private_paths_or_arbitrary_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.parquet"
            for lineage in (
                {"privatePath": "D:/private"},
                {"semanticKey": "not-a-hash"},
                {"partition": "../../secret"},
            ):
                with self.subTest(lineage=lineage), self.assertRaises(ValueError):
                    write_enriched_parquet(daily(), path, kind="daily_projection", lineage=lineage)
                self.assertFalse(path.exists())


if __name__ == "__main__":
    unittest.main()
