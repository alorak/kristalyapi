"""Analytical invariants of Package 10.8.5 (not real-map convergence)."""
import unittest

import numpy as np

from volume_sampling_reference import (
    check_extents,
    isolevel_metrics,
    measure_grid,
    nyquist_band_fraction,
    source_gap_levels,
)


class VolumeSamplingTests(unittest.TestCase):
    def setUp(self):
        self.axes = np.asarray([[.3, .04, 0], [0, .32, 0],
                                [.02, 0, .36]], dtype=np.float64)
        self.origin = np.asarray([1, -2, .5], dtype=np.float64)
        coords = np.indices((16, 16, 16), dtype=np.float64)
        squared = sum((coords[axis] - [7.2, 8.1, 6.8][axis]) ** 2
                      for axis in range(3))
        self.positive = np.exp(-squared / 9).astype(np.float32)

    def test_source_fixed_level_is_between_distinct_samples(self):
        for row in source_gap_levels(self.positive):
            self.assertGreater(row["sourceLevelGap"], 0)
            self.assertTrue(self.positive.min() < row["scoreLevel"]
                            < self.positive.max())

    def test_negative_and_positive_signs_have_matching_geometry(self):
        level = source_gap_levels(self.positive)[0]["scoreLevel"]
        positive = measure_grid(self.positive, 1, self.axes, self.origin,
                                False, level, .01)
        negative = measure_grid(-self.positive, -1, self.axes, self.origin,
                                False, level, .01)
        for name in ("below", "baseline", "above"):
            p, n = positive["levels"][name], negative["levels"][name]
            self.assertEqual(p["occupiedNodes"], n["occupiedNodes"])
            self.assertEqual(p["voxelComponents6ConnectedNonperiodic"],
                             n["voxelComponents6ConnectedNonperiodic"])
            self.assertAlmostEqual(p["surfaceAreaA2"], n["surfaceAreaA2"])
            self.assertAlmostEqual(p["signedSourceLevel"],
                                   -n["signedSourceLevel"])
        self.assertAlmostEqual(positive["nearNyquistIndexEnergyFraction"],
                               negative["nearNyquistIndexEnergyFraction"])

    def test_disappearing_contour_is_recorded_not_crashed(self):
        result = isolevel_metrics(self.positive, 2., self.axes, self.origin, False)
        self.assertEqual(result["surfaceState"], "empty")
        self.assertIsNone(result["surfaceAreaA2"])
        self.assertEqual(result["occupiedNodes"], 0)

    def test_constant_field_has_zero_spectral_fraction(self):
        self.assertEqual(nyquist_band_fraction(np.ones((8, 8, 8)), False), 0)
        self.assertEqual(nyquist_band_fraction(np.ones((8, 8, 8)), True), 0)

    def test_source_extent_must_be_preserved_in_skew_cell(self):
        src = {"dims": [16, 16, 16], "axes": self.axes.tolist(),
               "origin": self.origin.tolist(), "periodic": False}
        scaled = {**src, "dims": [8, 8, 8],
                  "axes": (self.axes * 15 / 7).tolist()}
        check_extents(src, scaled)
        bad = {**scaled, "axes": (self.axes * 2).tolist()}
        with self.assertRaises(AssertionError):
            check_extents(src, bad)


if __name__ == "__main__":
    unittest.main()
