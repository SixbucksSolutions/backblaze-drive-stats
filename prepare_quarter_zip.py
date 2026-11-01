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
import subprocess
import sys
import tempfile
import time
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


def _write_day(archive, member, target, digest, temporary_dir=None):
    frame, columns = read_day(archive, member)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=temporary_dir or target.parent
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
    return {
        "date": target.stem,
        "rowCount": frame.height,
        "sourceColumns": columns,
        "datacenterAvailable": "datacenter" in columns,
        "memberCrc32": f"{member.CRC:08x}",
        "memberSizeBytes": member.file_size,
        "outputFile": target.name,
    }


def _member_identity(member, index):
    return {
        "index": index,
        "filename": member.filename,
        "originalFilename": member.orig_filename,
        "headerOffset": member.header_offset,
        "crc": member.CRC,
        "fileSize": member.file_size,
        "compressedSize": member.compress_size,
        "externalAttributes": member.external_attr,
        "compressionType": member.compress_type,
        "flags": member.flag_bits,
    }


def _day_worker(task_path, result_path):
    """Internal subprocess entry: use the coordinator's exact validated ZipInfo."""
    try:
        task = json.loads(task_path.read_text(encoding="utf-8"))
        records = []
        with zipfile.ZipFile(task["inputZip"]) as archive:
            members = archive.infolist()
            for identity in task["members"]:
                index = identity["index"]
                if type(index) is not int or not 0 <= index < len(members):
                    raise ValueError("Selected ZIP member index changed")
                member = members[index]
                if _member_identity(member, index) != identity:
                    raise ValueError("Selected ZIP member identity changed")
                target = Path(task["outputDir"]) / (
                    PurePosixPath(member.filename).stem + ".parquet"
                )
                records.append(
                    _write_day(archive, member, target, task["digest"], task_path.parent)
                )
        result_path.write_text(json.dumps(records), encoding="utf-8")
        return 0
    except Exception:
        # Parser exceptions may contain private row values; never emit them.
        return 1


def _parallel_days(input_zip, output_dir, archive, members, digest, workers, threads):
    groups = [[] for _ in range(min(workers, len(members)))]
    sizes = [0] * len(groups)
    indexes = {id(member): index for index, member in enumerate(archive.infolist())}
    for member in sorted(members, key=lambda item: (-item.file_size, item.filename)):
        slot = min(range(len(groups)), key=lambda index: (sizes[index], index))
        groups[slot].append(_member_identity(member, indexes[id(member)]))
        sizes[slot] += member.file_size
    env = dict(os.environ, POLARS_MAX_THREADS=str(threads))
    processes = []
    with tempfile.TemporaryDirectory(prefix=".day-workers-", dir=output_dir) as folder:
        temporary_root = Path(folder)
        results = []
        try:
            for index, group in enumerate(groups):
                worker_dir = temporary_root / str(index)
                worker_dir.mkdir()
                task_path, result_path = worker_dir / "task.json", worker_dir / "result.json"
                task_path.write_text(
                    json.dumps(
                        {
                            "inputZip": str(input_zip.resolve()),
                            "outputDir": str(output_dir.resolve()),
                            "digest": digest,
                            "members": sorted(group, key=lambda member: member["filename"]),
                        }
                    ),
                    encoding="utf-8",
                )
                processes.append(
                    subprocess.Popen(
                        [
                            sys.executable,
                            str(Path(__file__).resolve()),
                            "--day-worker",
                            str(task_path.resolve()),
                            str(result_path.resolve()),
                        ],
                        env=env,
                        stdin=subprocess.DEVNULL,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                    )
                )
                results.append(result_path)
            while any(process.poll() is None for process in processes):
                if any(process.poll() not in (None, 0) for process in processes):
                    raise ValueError("Daily CSV could not be read or verified in a worker")
                time.sleep(0.05)
            if any(process.returncode != 0 for process in processes):
                raise ValueError("Daily CSV could not be read or verified in a worker")
            records = [
                record
                for result in results
                for record in json.loads(result.read_text(encoding="utf-8"))
            ]
            expected = {PurePosixPath(member.filename).stem for member in members}
            if (
                len(records) != len(expected)
                or {record["date"] for record in records} != expected
                or len({record["outputFile"] for record in records}) != len(expected)
            ):
                raise ValueError("Daily worker result calendar mismatch")
            return sorted(records, key=lambda record: record["date"])
        finally:
            # Finally also covers KeyboardInterrupt/SystemExit. No worker launches
            # descendants; stop and join before deleting worker temporaries.
            for process in processes:
                if process.poll() is None:
                    process.terminate()
            for process in processes:
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def validate_execution_options(day_workers: int, polars_threads: int) -> None:
    if (
        type(day_workers) is not int
        or type(polars_threads) is not int
        or day_workers < 1
        or polars_threads < 1
        or day_workers * polars_threads > 20
    ):
        raise ValueError("Positive day-worker/thread budget must not exceed 20")


def prepare(
    input_zip: Path,
    output_dir: Path,
    *,
    source_url: str | None = None,
    overwrite: bool = False,
    quarter: str | None = None,
    day_workers: int = 1,
    polars_threads: int = 2,
) -> dict:
    """Import serially by default; explicit parallel workers have isolated pools.

    polars_threads applies only to child processes; the serial path retains the
    caller's existing native pool. Worker settings do not enter cache lineage.
    """
    validate_execution_options(day_workers, polars_threads)
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
        if day_workers == 1:
            records = [
                _write_day(archive, member, target, digest)
                for member, target in zip(members, targets, strict=False)
            ]
        else:
            records = _parallel_days(
                input_zip, output_dir, archive, members, digest, day_workers, polars_threads
            )
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
    if len(sys.argv) == 4 and sys.argv[1] == "--day-worker":
        raise SystemExit(_day_worker(Path(sys.argv[2]), Path(sys.argv[3])))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source-url")
    parser.add_argument("--quarter", help="Select a complete calendar quarter (YYYY-Qn)")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--day-workers", type=int, default=1)
    parser.add_argument(
        "--polars-threads",
        type=int,
        default=2,
        help="Native threads per day worker; serial mode uses the caller's pool",
    )
    args = parser.parse_args()
    try:
        metadata = prepare(
            args.input_zip,
            args.output_dir,
            source_url=args.source_url,
            overwrite=args.overwrite,
            quarter=args.quarter,
            day_workers=args.day_workers,
            polars_threads=args.polars_threads,
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
