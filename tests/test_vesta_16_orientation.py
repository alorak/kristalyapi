"""V16.1 deterministic camera-frame geometry; NOT a genuine VESTA GUI test."""
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_16_orientation as v16


class CameraFrameReferenceTests(unittest.TestCase):
    def setUp(self):
        self.cubic = dict(a=5, b=5, c=5, alpha=90, beta=90, gamma=90)

    def test_cubic_reference_axes(self):
        r = v16.camera_frame(self.cubic, (0, 0, 1), (0, 1, 0))
        self.assertEqual(r["directionPlanePairing"]["hDotU"], 0)
        for got, expected in [
            (r["rightCartesian"], [1., 0., 0.]),
            (r["screenUpCartesian"], [0., 1., 0.]),
            (r["outwardViewNormalCartesian"], [0., 0., 1.]),
        ]:
            for a, b in zip(got, expected):
                self.assertAlmostEqual(a, b, places=10)
        self.assertAlmostEqual(r["cellVolumeA3"], 125)
        self.assertEqual(r["handednessDeterminant"], 1)

    def test_nonorthogonal_direct_and_reciprocal_vectors(self):
        triclinic = dict(a=5.6269, b=7.3728, c=11.884,
                         alpha=85.512, beta=80.428, gamma=82.1)
        a, b, c, volume = v16.lattice_vectors(triclinic)
        self.assertAlmostEqual(v16.dot(a, v16.cross(b, c)), volume)
        r = v16.camera_frame(triclinic, (1, 1, 0), (1, -1, 0))
        self.assertAlmostEqual(r["viewAndUpDot"], 0, places=10)
        self.assertAlmostEqual(r["handednessDeterminant"], 1, places=10)
        self.assertNotAlmostEqual(r["rightCartesian"][0], 1.0, places=4)

    def test_nonperpendicular_plane_and_singular_metric_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "not perpendicular"):
            v16.camera_frame(self.cubic, (1, 1, 1), (0, 0, 1))
        with self.assertRaisesRegex(ValueError, "zero"):
            v16.direction("[000]")
        with self.assertRaisesRegex(ValueError, "singular|Degenerate"):
            v16.lattice_vectors(dict(a=1, b=1, c=1, alpha=10, beta=10, gamma=175))

    def test_index_parser(self):
        self.assertEqual(v16.direction("[110]"), (1, 1, 0))
        self.assertEqual(v16.direction("[1,-1,0]"), (1, -1, 0))
        self.assertEqual(v16.direction("[1 -1 0]"), (1, -1, 0))
        with self.assertRaises(ValueError):
            v16.direction("[12]")

    def test_real_sha_pinned_cif_metric_and_nongui_status(self):
        result = v16.run()
        self.assertEqual(result["vestaGuiStatus"], "NOT_RUN")
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")
        self.assertEqual(len(result["cases"]), 5)
        computed = [x for x in result["cases"] if x["status"] == "REFERENCE_COMPUTED_GUI_NOT_RUN"]
        self.assertEqual(len(computed), 4)
        self.assertEqual(len([x for x in result["cases"] if x["status"] == "NOT_COMPUTED_NON_CIF"]), 1)
        for item in computed:
            self.assertEqual(len(item["sourceSha256"]), 64)
            self.assertAlmostEqual(item["frame"]["handednessDeterminant"], 1, places=10)
        self.assertAlmostEqual(computed[0]["frame"]["cellVolumeA3"], 5.62 ** 3, places=7)
        self.assertAlmostEqual(computed[1]["frame"]["cellVolumeA3"],
                               4.59373 ** 2 * 2.95812, places=6)

    def test_invalid_cell(self):
        for cell in [
            dict(a=0, b=5, c=5, alpha=90, beta=90, gamma=90),
            dict(a=5, b=5, c=5, alpha=90, beta=90, gamma=180),
            dict(a=math.nan, b=5, c=5, alpha=90, beta=90, gamma=90),
        ]:
            with self.assertRaises(ValueError):
                v16.lattice_vectors(cell)


if __name__ == "__main__":
    unittest.main()
