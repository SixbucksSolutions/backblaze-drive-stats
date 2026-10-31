"""Keep SMART normalization and exported model identities aligned."""
import ast
from pathlib import Path
import unittest

from drive_model_names import normalize_drive_model_name
from export_quarterly_web_data import normalize_model


class DriveModelNameTests(unittest.TestCase):
    def test_legacy_aliases_and_whitespace(self):
        cases = {
            "ST1000": "Seagate ST1000",
            "ST12000NM0008": "Seagate ST12000NM0008",
            "WUH721414ALE6L4": "WDC/HGST WUH721414ALE6L4",
            "WUS721010ALE6L4": "WDC/HGST WUS721010ALE6L4",
            "HGST HUH721212ALE600": "WDC/HGST HUH721212ALE600",
            "WDC WUH721414ALE6L4": "WDC/HGST WUH721414ALE6L4",
            "WDC/HGST WUH721414ALE6L4": "WDC/HGST WUH721414ALE6L4",
            "TOSHIBA MG08ACA16TE": "Toshiba MG08ACA16TE",
            "Toshiba MG08ACA16TE": "Toshiba MG08ACA16TE",
            " \tSeagate   ST1000\n": "Seagate ST1000",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_drive_model_name(raw), expected)
                self.assertEqual(normalize_model(raw), tuple(expected.split(" ", 1)))

    def test_preserves_legacy_errors(self):
        cases = {
            "": "did not result in 1 or 2 tokens",
            "Seagate descriptive ST1000": "did not result in 1 or 2 tokens",
            "MG08ACA16TE": "Cannot determine mfr",
            "HUH721212ALE600": "Cannot determine mfr",
            "STORAGE": "Cannot determine mfr",
            "Unknown ST1000": "not recognized",
            "seagate ST1000": "not recognized",
        }
        for raw, message in cases.items():
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, message):
                    normalize_drive_model_name(raw)

    def test_unsupported_web_names_keep_the_full_raw_name(self):
        for raw in (
            "Seagate descriptive ST1000", "Unknown ST1000", "Custom ST1000",
            "Custom MG08ACA16TE", "HUH721212ALE600", "MG08ACA16TE",
            "Samsung SSD 870 EVO 1TB", "  Custom   ST1000  ",
        ):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_model(raw), ("Unknown", raw))
        self.assertNotEqual(normalize_model("Custom ST1000"), normalize_model("ST1000"))

    def test_analysis_wrappers_delegate_to_the_canonical_function(self):
        # Load only each wrapper to avoid unrelated remote-source dependencies.
        root = Path(__file__).resolve().parents[1]
        for filename in ("backblaze_drive_stats_data.py", "quarterly_afr_xlsx_from_iceberg.py"):
            with self.subTest(filename=filename):
                tree = ast.parse((root / filename).read_text())
                wrapper = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                               and node.name == "_normalize_drive_model_name")
                calls = []

                def sentinel(raw):
                    calls.append(raw)
                    return "canonical result"

                namespace = {"normalize_drive_model_name": sentinel}
                exec(compile(ast.Module(body=[wrapper], type_ignores=[]), filename, "exec"), namespace)
                self.assertEqual(namespace["_normalize_drive_model_name"]("raw model"), "canonical result")
                self.assertEqual(calls, ["raw model"])


if __name__ == "__main__":
    unittest.main()
