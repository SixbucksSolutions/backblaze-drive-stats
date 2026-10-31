"""Source-preservation regressions for the disposable local benchmark CLI."""
from datetime import date
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import polars as pl

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "benchmark_parquet_profile.py"


class BenchmarkSourcePreservationTests(unittest.TestCase):
    def write_source(self, path):
        pl.DataFrame({"date": [date(2026, 4, 1)], "model": ["sample"],
                      "serial_number": ["disposable"]}).write_parquet(path)
        return path.read_bytes()

    def run_cli(self, sources, output, shared=False):
        args = [sys.executable, str(SCRIPT), "--output-dir", str(output),
                "--repeats", "1", "--row-group-size", "3"]
        for source in sources:
            args += ["--input", str(source)]
        if shared:
            args.append("--shared-profile")
        return subprocess.run(args, capture_output=True, text=True, check=False)

    def assert_rejected_unchanged(self, name, shared=False, second_source=False):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            source = output / name
            original = self.write_source(source)
            sources = [source]
            if second_source:
                earlier = output / "unrelated-first-input.parquet"
                earlier_original = self.write_source(earlier)
                sources.insert(0, earlier)
            before_files = set(output.iterdir())
            result = self.run_cli(sources, output, shared)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("aliases a source", result.stderr)
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(set(output.iterdir()), before_files)
            if second_source:
                self.assertEqual(earlier.read_bytes(), earlier_original)

    def test_shared_destination_is_input(self):
        self.assert_rejected_unchanged("benchmark-shared-0-daily_projection.parquet", shared=True)

    def test_normal_destination_is_input(self):
        self.assert_rejected_unchanged("benchmark-0-3-0-native_default.parquet")

    def test_edge_destination_is_later_input_before_any_writes(self):
        self.assert_rejected_unchanged("benchmark-edge-native_default.parquet", second_source=True)

    def test_report_destination_is_input(self):
        self.assert_rejected_unchanged("benchmark-results.json")

    def test_symlinked_source_alias_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "output"
            output.mkdir()
            source = output / "benchmark-shared-0-daily_projection.parquet"
            original = self.write_source(source)
            alias = root / "source-alias.parquet"
            try:
                alias.symlink_to(source)
            except (OSError, NotImplementedError):
                self.skipTest("File symlinks unavailable for this Windows account")
            result = self.run_cli([alias], output, shared=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("aliases a source", result.stderr)
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(set(output.iterdir()), {source})

    def test_nonempty_output_rejected_without_overwriting_unrelated_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.parquet"
            original = self.write_source(source)
            output = root / "output"
            output.mkdir()
            marker = output / "keep.txt"
            marker.write_bytes(b"preserve")
            result = self.run_cli([source], output)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("must be new or empty", result.stderr)
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(marker.read_bytes(), b"preserve")
            self.assertEqual(set(output.iterdir()), {marker})

    def test_new_output_runs_without_modifying_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.parquet"
            original = self.write_source(source)
            output = root / "new-output"
            result = self.run_cli([source], output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(source.read_bytes(), original)
            self.assertTrue((output / "benchmark-results.json").is_file())


if __name__ == "__main__":
    unittest.main()
