"""Synthetic negative tests + genuine, SHA-pinned 5i55 CCP4 metadata audit."""
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_15_ccp4_reference as ccp4
from vesta_15_visual import ROOT


class RealCcp4ReferenceTests(unittest.TestCase):
    def test_pinned_real_ccp4_native_level(self):
        result = ccp4.run()
        self.assertEqual(result["dimensionsCRS"], [8, 6, 10])
        self.assertEqual(result["crsToXYZ"], [2, 1, 3])
        self.assertEqual(result["startCRS"], [50, -8, 40])
        self.assertEqual(result["isoLevelAbsoluteNativeUnits"], 1.0)
        self.assertEqual(result["sampleCount"], 480)
        self.assertEqual(result["voxelsAboveIsoLevel"], 103)
        self.assertEqual(result["thresholdGridEdgeCrossings"], 188)
        self.assertEqual(result["physicalUnits"], "UNKNOWN")
        self.assertEqual(result["vestaGuiStatus"], "NOT_RUN")
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")
        self.assertFalse(result["sampledFullCell"])
        self.assertAlmostEqual(result["statisticsNativeUnits"]["min"], -0.53103828, places=6)
        self.assertAlmostEqual(result["statisticsNativeUnits"]["max"], 2.39882803, places=6)

    def test_invalid_or_nonphysical_threshold(self):
        p = ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4"
        for threshold in (float("nan"), float("inf"), -99., 99.):
            with self.assertRaises(ValueError):
                ccp4.inspect_ccp4(p, threshold)

    def test_tampered_header_and_voxels_fail_closed(self):
        p = ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4"
        data = bytearray(p.read_bytes())
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / "damaged.ccp4"
            altered = bytearray(data)
            altered[208:212] = b"NOPE"
            f.write_bytes(altered)
            with self.assertRaisesRegex(ValueError, "MAP"):
                ccp4.inspect_ccp4(f, 1.)
            altered = bytearray(data)
            altered[1184:1188] = b"\x00\x00\x80\x7f"  # +inf float
            f.write_bytes(altered)
            with self.assertRaisesRegex(ValueError, "Non-finite"):
                ccp4.inspect_ccp4(f, 1.)
            f.write_bytes(data[:-4])
            with self.assertRaisesRegex(ValueError, "voxel bytes"):
                ccp4.inspect_ccp4(f, 1.)


if __name__ == "__main__":
    unittest.main()
