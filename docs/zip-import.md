# Import a quarterly raw ZIP locally

Download the quarterly ZIP from the [Backblaze Drive Stats data page](https://www.backblaze.com/cloud-storage/resources/hard-drive-test-data) into `data/raw/`. Keep the ZIP, daily data, and all private Parquet outputs out of Git. The repository ignores `data/`, ZIPs, CSVs and Parquet files.

From the repository root, run:

```powershell
uv run --no-project --with polars==1.41.2 python prepare_quarter_zip.py --input-zip data/raw/data_2026_Q2.zip --output-dir data/processed/2026-Q2 --source-url https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q2_2026.zip
```

The importer processes one daily `YYYY-MM-DD.csv` member at a time. It never extracts raw CSVs. Only `date`, `serial_number`, `model`, `capacity_bytes`, `failure`, and an explicitly named `datacenter` column are retained. SMART columns and other fields are discarded. Without a `datacenter` source column, the output column is null; the web exporter labels these observations `Unknown`. Fields such as `vault_id` are not treated as datacenters.

Each daily output is a Zstandard-compressed Parquet file published through an atomic rename. Archive CRC checks and date/filename validation must succeed before that day's file is published. Hidden metadata and symbolic links are ignored; unsafe paths and duplicate daily filenames are rejected. Memory use is bounded to one day's CSV and projected frame, rather than the entire quarter.

`import-metadata.json` is written only after all selected days succeed. It records the ZIP SHA-256, optional HTTPS source URL, dates, row counts, source column names, datacenter availability, and member CRC/size. It contains no drive serials or source row values. A successful import does not certify complete quarter coverage; the quarterly exporter performs its own coverage and observation checks.

Existing target files cause refusal before processing. To retry a partial import, use a new empty output directory (**RECOMMENDED** when preserving an earlier import), or explicitly add `--overwrite` to replace the selected daily outputs. Overwrite removes the old success receipt before processing; a failure can leave completed daily files but no success receipt. Unrelated Parquet files in the directory are always refused to prevent an exporter glob from mixing datasets. There is no automatic resume or unchecked skipping.

Pass `data/processed/2026-Q2/*.parquet` as the local Parquet input to `export_quarterly_web_data.py`. Only the exporter's aggregate JSON belongs in the public web bundle. Never copy these daily Parquet files into the website.

Run the small synthetic checks without downloading data:

```powershell
uv run --no-project --with polars==1.41.2 python -m unittest discover -s tests -p test_prepare_quarter_zip.py
```
