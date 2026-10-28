"""Regression cases for official spin-unpolarized projwfc.x per-atom format.

Artificial numeric text fixtures, NOT experimental or calculated MoS2 outputs.
"""
import sys
from pathlib import Path
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from qe_pdos import parse_atom_symbols, parse_atom_orbital_pdos
from test_qe_runner import INPUT


class AtomOrbitalPdosTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.energy = [-1.0, 0.0, 1.0]
        self.total = [0.08, 0.30, 0.12]
        self.symbols = ["Mo", "S", "S"]

    def write(self, name, values, orbital="p"):
        # Header: E LDOS PDOS_1 PDOS_2 PDOS_3
        # Use a clean symmetric distribution of projections.
        path = self.root / f"pdos.pdos_atm#{name}_wfc#1({orbital})"
        with path.open("w") as stream:
            stream.write("# E (eV) ldos(E) pdos_1(E) pdos_2(E) pdos_3(E)\n")
            for energy, density in zip(self.energy, values):
                stream.write(f"{energy} {density} {density} 0 0\n")
        return path

    def populate(self):
        self.write("1(Mo)", [0.04, 0.15, 0.06])
        self.write("2(S)", [0.02, 0.08, 0.03])
        self.write("3(S)", [0.02, 0.07, 0.03])

    def test_scf_atomic_order(self):
        self.assertEqual(parse_atom_symbols(INPUT), ["Mo", "S", "S"])
        with self.assertRaisesRegex(ValueError, "final SCF"):
            parse_atom_symbols(INPUT.replace("ATOMIC_POSITIONS crystal", "ATOMIC_POSITIONS angstrom"))

    def test_atom_and_element_pdos_sums_multiply_by_no_duplicate_m_channels(self):
        self.populate()
        result = parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)
        self.assertEqual(len(result["atoms"]), 3)
        self.assertEqual(len(result["elements"]), 2)
        by_element = {x["element"]: x for x in result["elements"]}
        self.assertAlmostEqual(by_element["S"]["orbitals"]["p"][1], 0.15)
        self.assertAlmostEqual(by_element["Mo"]["total_dos_states_per_ev"][1], 0.15)
        self.assertEqual(result["spin_mode"], "collinear-unpolarized")
        self.assertLess(result["max_projection_reconciliation_error"], 1e-9)

    def test_missing_atom_wfc_is_not_reported_as_complete(self):
        self.populate()
        (self.root / "pdos.pdos_atm#3(S)_wfc#1(p)").unlink()
        with self.assertRaisesRegex(ValueError, "reconcile"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)

    def test_invalid_atom_number_or_element_rejected(self):
        self.write("5(S)", [0.08, 0.30, 0.12])
        with self.assertRaisesRegex(ValueError, "atom index/element"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)
        (self.root / "pdos.pdos_atm#5(S)_wfc#1(p)").rename(
            self.root / "pdos.pdos_atm#1(S)_wfc#1(p)")
        with self.assertRaisesRegex(ValueError, "atom index/element"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)

    def test_spin_orbit_and_spin_polarized_columns_fail_closed(self):
        self.write("1(Mo)", [.08, .30, .12])
        (self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p)").rename(
            self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p_0.5)")
        with self.assertRaisesRegex(ValueError, "Spin/SOC"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)
        self.write("1(Mo)", [.08, .30, .12])
        (self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p_0.5)").unlink()
        file = self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p)"
        file.write_text("-1 .08 .08 0 0 0\n0 .30 .30 0 0 0\n1 .12 .12 0 0 0\n")
        with self.assertRaisesRegex(ValueError, "expected 5"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)

    def test_grid_and_ldos_mismatch_rejected(self):
        self.populate()
        file = self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p)"
        file.write_text("-1 .04 .04 0 0\n0.2 .15 .15 0 0\n1 .06 .06 0 0\n")
        with self.assertRaisesRegex(ValueError, "energy axes mismatch"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)
        file.write_text("-1 .04 .04 0 0\n0 .15 .01 0 0\n1 .06 .06 0 0\n")
        with self.assertRaisesRegex(ValueError, "LDOS"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)

    def test_negative_or_nonnumeric_density_is_not_accepted(self):
        self.write("1(Mo)", [0.08, 0.30, 0.12])
        path = self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p)"
        path.write_text("-1 .08 .08 0 0\n0 -.30 -.30 0 0\n1 .12 .12 0 0\n")
        with self.assertRaisesRegex(ValueError, "negative projected density"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)
        path.write_text("-1 .08 .08 0 0\n0 junk .30 0 0\n1 .12 .12 0 0\n")
        with self.assertRaisesRegex(ValueError, "nonnumeric"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)

    def test_multiple_wavefunctions_on_same_atom_accumulate_and_no_double_count(self):
        self.write("1(Mo)", [0.04, 0.15, 0.06])
        extra = self.root / "pdos.pdos_atm#1(Mo)_wfc#2(s)"
        extra.write_text("-1 .04 .04\n0 .15 .15\n1 .06 .06\n")
        result = parse_atom_orbital_pdos(self.root, self.energy, self.total, ["Mo", "S", "S"])
        self.assertEqual(len(result["atoms"]), 1)
        orbitals = result["atoms"][0]["orbitals"]
        self.assertIn("s", orbitals)
        self.assertIn("p", orbitals)
        self.assertAlmostEqual(result["atoms"][0]["total_dos_states_per_ev"][1], .30)

    def test_large_or_unsupported_files_fail_closed(self):
        self.write("1(Mo)", [.08, .30, .12])
        sym = self.root / "pdos.pdos_atm#1(Mo)_wfc#1(p)"
        sym.unlink()
        sym.symlink_to(self.root / "bogus")
        with self.assertRaisesRegex(ValueError, "Missing, symlinked"):
            parse_atom_orbital_pdos(self.root, self.energy, self.total, self.symbols)


if __name__ == "__main__":
    unittest.main()
