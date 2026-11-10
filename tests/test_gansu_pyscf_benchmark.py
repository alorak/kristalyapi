"""Synthetic unit tests for pure provenance/energy-comparison logic.

These fixtures DO NOT assert chemical accuracy. Actual solver values must
come from real Chromium GANSU and independently installed PySCF in CI.
"""
import copy
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import gansu_pyscf_benchmark as bench


class P03ComparisonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(
            (ROOT / "tests/fixtures/gansu/p03-molecules.json").read_text(encoding="utf-8")
        )

    def fake_provenance(self):
        cases = {}
        refs = {}
        Z = {"H": 1, "O": 8, "N": 7, "Si": 14}
        for case in self.fixture["cases"]:
            atoms = bench.parse_xyz(case["xyz"])
            electrons = sum(Z[a] for a, _ in atoms) - case["charge"]
            cases[case["id"]] = {
                "upstreamCommit": self.fixture["upstreamGansuCommit"],
                "xyzSha256": hashlib.sha256(case["xyz"].encode()).hexdigest(),
                "functional": case["functional"],
                "grid": case["grid"],
                "charge": case["charge"],
                "multiplicity": case["multiplicity"],
                "basis": "STO-3G",
                "backend": "WASM",
                "atoms": [a for a, _ in atoms],
                "electrons": electrons,
                "energyHartree": -10.001,
                "iterations": 9,
            }
            refs[case["id"]] = {
                "pyscfVersion": bench.PYSCF_VERSION,
                "basis": "STO-3G",
                "xc": bench.XC[case["functional"]],
                "electronCount": electrons,
                "energyHartree": -10.0,
                "converged": True,
                "cycles": 9,
            }
        return {
            "schema": "kristalyapi.gansu-p03-browser-results.v1",
            "upstreamCommit": self.fixture["upstreamGansuCommit"],
            "cases": cases,
        }, refs

    def test_preregistered_silicon_cases_and_safe_geometry(self):
        self.assertEqual(bench.validate_fixture(self.fixture), 0.02)
        ids = [c["id"] for c in self.fixture["cases"]]
        self.assertIn("sih4-pbe", ids)
        self.assertIn("sih4-svwn", ids)
        self.assertEqual(len(set(ids)), len(ids))
        si = next(c for c in self.fixture["cases"] if c["id"] == "sih4-pbe")
        self.assertEqual(bench.parse_xyz(si["xyz"])[0][0], "Si")
        self.assertEqual(len(bench.parse_xyz(si["xyz"])), 5)

    def test_all_synthetic_small_differences_pass(self):
        g, r = self.fake_provenance()
        rows = bench.compare_results(self.fixture, g, r)
        self.assertEqual(len(rows), len(self.fixture["cases"]))
        self.assertTrue(all(x["pass"] for x in rows))
        self.assertAlmostEqual(rows[0]["absoluteDifferenceMilliHartree"], 1.0)

    def test_significant_error_is_detected_not_clipped(self):
        g, r = self.fake_provenance()
        g["cases"]["sih4-pbe"]["energyHartree"] += 0.15
        rows = bench.compare_results(self.fixture, g, r)
        self.assertFalse(next(x for x in rows if x["id"] == "sih4-pbe")["pass"])
        self.assertGreater(max(x["absoluteDifferenceMilliHartree"] for x in rows), 100)

    def test_molecule_or_method_swap_is_rejected(self):
        g, r = self.fake_provenance()
        g["cases"]["sih4-pbe"]["xyzSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "coordinate SHA"):
            bench.compare_results(self.fixture, g, r)
        g, r = self.fake_provenance()
        r["sih4-pbe"]["xc"] = "B3LYP"
        with self.assertRaisesRegex(ValueError, "XC method"):
            bench.compare_results(self.fixture, g, r)

    def test_unconverged_and_incomplete_results_cannot_pass(self):
        g, r = self.fake_provenance()
        r["h2-svwn"]["converged"] = False
        with self.assertRaisesRegex(ValueError, "did not converge"):
            bench.compare_results(self.fixture, g, r)
        g, r = self.fake_provenance()
        del g["cases"]["nh3-pbe"]
        with self.assertRaisesRegex(ValueError, "precisely"):
            bench.compare_results(self.fixture, g, r)

    def test_limit_cannot_be_broadened_past_preregistration(self):
        wider = copy.deepcopy(self.fixture)
        wider["validationLimitHartree"] = 0.03
        with self.assertRaisesRegex(ValueError, "broadened"):
            bench.validate_fixture(wider)


if __name__ == "__main__":
    unittest.main()
