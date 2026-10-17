"""Focused regression checks for P10.8.6's independent format comparison gate."""
import unittest

import numpy as np

from volume_vesta_formats_reference import compare_array, independent_surface


class IndependentFormatGateTests(unittest.TestCase):
    def test_exact_grid_matches(self):
        expected = np.arange(24.0).reshape(2, 3, 4)
        self.assertEqual(compare_array(expected.copy(), expected)["failingVoxels"], 0)

    def test_x_fastest_vs_z_fastest_permutation_is_caught(self):
        source = np.arange(27.0).reshape(3, 3, 3)
        wrongly_transposed = source.transpose(2, 1, 0)
        self.assertGreater(compare_array(wrongly_transposed, source)["failingVoxels"], 0)

    def test_density_rescaling_is_caught(self):
        density = np.linspace(.04, 4.0, num=64).reshape(4, 4, 4)
        self.assertEqual(compare_array(density / 9.0, density)["failingVoxels"], 64)

    def test_non_finite_source_is_hard_failure(self):
        expected = np.ones((2, 2, 2))
        actual = expected.copy()
        actual[1, 1, 1] = np.inf
        with self.assertRaisesRegex(AssertionError, "Non-finite"):
            compare_array(actual, expected)

    def test_physical_affine_basis_changes_isosurface_area(self):
        i, j, k = np.indices((10, 10, 10))
        values = np.sqrt((i-4.5)**2+(j-4.5)**2+(k-4.5)**2)
        isotropic = independent_surface(values, np.eye(3), 3.1, False)
        dilated = independent_surface(values, np.diag([2, 2, 2]), 3.1, False)
        self.assertAlmostEqual(dilated["areaA2"] / isotropic["areaA2"], 4, places=6)


if __name__ == "__main__":
    unittest.main()
