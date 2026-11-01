"""Project daily CSVs from a Backblaze ZIP into local, private Parquet files."""

from __future__ import annotations

import argparse
import calendar
import csv
import hashlib
import io
import json
import os
import re
import stat
import tempfile
import zipfile
from datetime import date
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

import polars as pl

from parquet_profile import PROFILE_ID, write_enriched_parquet

REQUIRED = ("date", "serial_number", "model", "capacity_bytes", "failure")
DAILY_NAME = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\.csv")
SCHEMA = {
    "date": pl.String,
    "serial_number": pl.String,
    "model": pl.String,
    "capacity_bytes": pl.Int64,
    "failure": pl.Int64,
    "datacenter": pl.String,
}


def daily_members(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    """Inspect member names, never extract archive paths to disk."""
    selected = {}
    for member in archive.infolist():
        # On Windows ZipInfo normalizes backslashes; validate the original archive spelling.
        name = member.orig_filename
        parts = PurePosixPath(name).parts
        if "__MACOSX" in parts or any(
            part.startswith(".") and part not in {".", ".."} for part in parts
        ):
            continue
        if stat.S_ISLNK(member.external_attr >> 16):
            continue
        if (
            "\0" in name
            or "\\" in name
            or ":" in name
            or name.startswith("/")
            or any(part in {".", ".."} for part in name.split("/"))
        ):
            raise ValueError("Archive contains an unsafe member path")
        if member.is_dir() or not DAILY_NAME.fullmatch(PurePosixPath(name).name):
            continue
        basename = PurePosixPath(name).name
        try:
            date.fromisoformat(basename[:-4])
        except ValueError:
            raise ValueError("Archive contains an invalid daily filename") from None
        if basename in selected:
            raise ValueError("Archive contains duplicate daily filenames")
        selected[basename] = member
    if not selected:
        raise ValueError("Archive contains no daily YYYY-MM-DD.csv files")
    return [selected[name] for name in sorted(selected)]


def read_day(archive: zipfile.ZipFile, member: zipfile.ZipInfo) -> tuple[pl.DataFrame, list[str]]:
    day = PurePosixPath(member.filename).stem
    try:
        with archive.open(member) as stream:
            with io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as text:
                columns = next(csv.reader(text), [])
        if len(set(columns)) != len(columns):
            raise ValueError("CSV has duplicate column names")
        missing = set(REQUIRED) - set(columns)
        if missing:
            raise ValueError("CSV is missing required columns: " + ", ".join(sorted(missing)))
        projection = list(REQUIRED) + (["datacenter"] if "datacenter" in columns else [])
        with archive.open(member) as stream:
            frame = pl.read_csv(
                stream,
                columns=projection,
                schema_overrides={key: SCHEMA[key] for key in projection},
            )
            # Explicitly reach EOF so ZipExtFile verifies the member CRC.
            while stream.read(1024 * 1024):
                pass
        frame = frame.with_columns(pl.col("date").str.to_date("%Y-%m-%d", strict=True))
        if (
            frame.is_empty()
            or frame.filter(
                pl.col("date").is_null() | (pl.col("date") != date.fromisoformat(day))
            ).height
        ):
            raise ValueError("CSV dates must match its daily filename and contain observations")
        if "datacenter" not in projection:
            frame = frame.with_columns(pl.lit(None, dtype=pl.String).alias("datacenter"))
        return frame.select(*REQUIRED, "datacenter"), columns
    except (ValueError, zipfile.BadZipFile) as error:
        # Only controlled validation messages may reach logs; Polars errors can include serials.
        if isinstance(error, ValueError) and str(error).startswith(
            ("CSV has", "CSV is", "CSV dates")
        ):
            raise ValueError(f"{day}: {error}") from None
        raise ValueError(f"{day}: daily CSV could not be read or verified") from None
    except Exception:
        raise ValueError(f"{day}: daily CSV could not be read or verified") from None


def prepare(
    input_zip: Path,
    output_dir: Path,
    *,
    source_url: str | None = None,
    overwrite: bool = False,
    quarter: str | None = None,
) -> dict:
    expected_names: set[str] | None = None
    if quarter is not None:
        if not re.fullmatch(r"[0-9]{4}-Q[1-4]", quarter) or quarter.startswith("0000"):
            raise ValueError("quarter must be YYYY-Qn with a valid year and quarter 1-4")
        year, number = int(quarter[:4]), int(quarter[-1])
        expected_names = {
            f"{date(year, month, day).isoformat()}.csv"
            for month in range((number - 1) * 3 + 1, number * 3 + 1)
            for day in range(1, calendar.monthrange(year, month)[1] + 1)
        }
    if source_url is not None:
        parsed = urlsplit(source_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.fragment
        ):
            raise ValueError("source URL must be HTTPS without credentials or fragments")
    input_zip, output_dir = Path(input_zip), Path(output_dir)
    with input_zip.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    with zipfile.ZipFile(input_zip) as archive:
        members = daily_members(archive)
        if expected_names is not None:
            # Validate all archive names first, but never open an unselected CSV body.
            members = [
                member
                for member in members
                if PurePosixPath(member.filename).name in expected_names
            ]
            if {PurePosixPath(member.filename).name for member in members} != expected_names:
                raise ValueError("Archive does not contain the complete selected quarter calendar")
        targets = [
            output_dir / (PurePosixPath(member.filename).stem + ".parquet") for member in members
        ]
        receipt = output_dir / "import-metadata.json"
        if any(path not in targets for path in output_dir.glob("*.parquet")):
            raise ValueError(
                "Output directory contains unrelated Parquet files; choose a new directory"
            )
        if not overwrite and any(
            path.exists() or path.is_symlink() for path in [*targets, receipt]
        ):
            raise ValueError("Output already exists; choose a new directory or use --overwrite")
        output_dir.mkdir(parents=True, exist_ok=True)
        # A failed replacement must not leave an earlier success receipt describing partial output.
        if overwrite:
            receipt.unlink(missing_ok=True)
        records = []
        for member, target in zip(members, targets, strict=False):
            frame, columns = read_day(archive, member)
            descriptor, temporary = tempfile.mkstemp(
                prefix=f".{target.name}.", suffix=".tmp", dir=output_dir
            )
            os.close(descriptor)
            try:
                write_enriched_parquet(
                    frame,
                    Path(temporary),
                    kind="daily_projection",
                    lineage={"sourceZipSha256": digest, "partition": target.stem},
                )
                os.replace(temporary, target)
            finally:
                Path(temporary).unlink(missing_ok=True)
            records.append(
                {
                    "date": target.stem,
                    "rowCount": frame.height,
                    "sourceColumns": columns,
                    "datacenterAvailable": "datacenter" in columns,
                    "memberCrc32": f"{member.CRC:08x}",
                    "memberSizeBytes": member.file_size,
                    "outputFile": target.name,
                }
            )
            del frame
        metadata = {
            "schemaVersion": 1,
            "parquetProfile": PROFILE_ID,
            "sourceZipSha256": digest,
            "sourceUrl": source_url,
            "rowCount": sum(record["rowCount"] for record in records),
            "fileCount": len(records),
            "dates": [record["date"] for record in records],
            "sourceColumns": sorted(
                {column for record in records for column in record["sourceColumns"]}
            ),
            "datacenterAvailable": all(record["datacenterAvailable"] for record in records),
            "files": records,
        }
        if quarter is not None:
            metadata["selectedQuarter"] = quarter
        descriptor, temporary = tempfile.mkstemp(
            prefix=".import-metadata.", suffix=".tmp", dir=output_dir
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(metadata, stream, indent=2)
                stream.write("\n")
            os.replace(temporary, receipt)
        finally:
            Path(temporary).unlink(missing_ok=True)
        return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-url")
    parser.add_argument("--quarter", help="Select a complete calendar quarter (YYYY-Qn)")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        metadata = prepare(
            args.input_zip,
            args.output_dir,
            source_url=args.source_url,
            overwrite=args.overwrite,
            quarter=args.quarter,
        )
    except Exception:
        parser.exit(
            1,
            "Import failed. Check the archive, required columns, and output directory; existing outputs require --overwrite.\n",
        )
    print(
        f"Prepared {metadata['fileCount']} daily files ({metadata['rowCount']} rows); import-metadata.json records provenance."
    )


if __name__ == "__main__":
    main()
