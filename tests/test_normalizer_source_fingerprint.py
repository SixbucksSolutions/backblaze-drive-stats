"""Protect the source-byte identity used by the retained normalization caches."""

import hashlib
import unittest
from pathlib import Path


class NormalizerSourceFingerprintTests(unittest.TestCase):
    def test_existing_cache_identity_survives_checkout_and_formatting(self) -> None:
        # Deliberate source changes must review cache lineage and update this pin.
        # .gitattributes stores these existing CRLF bytes without OS conversion.
        source = Path(__file__).resolve().parents[1] / "drive_model_names.py"
        expected = "e6c2ca5920d387e8ce06a8208f37e287637ffaee09392bf7531b88bb7a3e7d9d"
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), expected)
