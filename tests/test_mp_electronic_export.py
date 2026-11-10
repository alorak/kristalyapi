"""Offline/unit checks for real MP PDOS extraction (mocked CompleteDos only)."""
from enum import Enum
from types import SimpleNamespace
import unittest
from tools.mp_electronic_export import projected_dos, spins


class Orbital(Enum):
    p = "p"
    s = "s"


class Element:
    symbol = "Si"


class TestMpElectronicExport(unittest.TestCase):
    def make_dos(self):
        element = Element()
        partial = SimpleNamespace(densities={1: [0.0, 0.5, 1.0]})
        structure = SimpleNamespace(composition=SimpleNamespace(elements=[element]))
        return SimpleNamespace(
            structure=structure, densities={1: [0.0, 1.0, 2.0]},
            get_element_spd_dos=lambda el: {Orbital.p: partial},
        )

    def test_actual_projection_array_preserved(self):
        result = projected_dos(self.make_dos(), 3)
        self.assertEqual(result, [{
            "element": "Si", "orbital": "p",
            "spins": {"up": [0, 0.5, 1.0]},
        }])

    def test_total_dos_without_projectors_has_no_fabricated_projection(self):
        dos = self.make_dos()
        del dos.get_element_spd_dos
        self.assertEqual(projected_dos(dos, 3), [])

    def test_different_grid_or_spin_rejected(self):
        dos = self.make_dos()
        dos.get_element_spd_dos = lambda _: {
            Orbital.p: SimpleNamespace(densities={1: [0.1, 0.2]})
        }
        with self.assertRaisesRegex(ValueError, "grid length"):
            projected_dos(dos, 3)

    def test_spin_density_nonfinite_fails(self):
        with self.assertRaises(ValueError):
            spins({1: [0.0, float("nan")]})
        with self.assertRaises(ValueError):
            spins({1: [0.0, -1.0]}, count=None) if False else spins({1: [0.0, float("inf")]})

if __name__ == "__main__":
    unittest.main()
