"""P1.3 synthetic scientific format gates; never run Quantum ESPRESSO or SLURM."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import qe_hpc_pipeline as pipeline

# Exported P1.2 ZIP stores tools/qe_hpc_pipeline.py as pipeline.py
sys.modules["pipeline"] = pipeline
import qe_hpc_electronic as electronic


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


class TestHpcElectronic(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for directory in ("pseudo", "stages", "reports", "tmp/kristalyapi.save"):
            (self.root / directory).mkdir(parents=True)
        self.input = (
            "&CONTROL\n calculation='scf',\n prefix='kristalyapi',\n"
            " pseudo_dir='./pseudo',\n outdir='./tmp',\n/\n"
            "&SYSTEM\n ibrav=0,\n nat=2,\n ntyp=1,\n/\n"
            "ATOMIC_SPECIES\nSi 28.0855 Si.UPF\n"
            "CELL_PARAMETERS angstrom\n5 0 0\n0 5 0\n0 0 5\n"
            "ATOMIC_POSITIONS crystal\nSi 0 0 0\nSi 0.25 0.25 0.25\n"
            "K_POINTS automatic\n4 4 4 0 0 0\n"
        )
        self.write("structure.in", self.input)
        self.write("scf.in", self.input)
        self.write("pipeline.py", (TOOLS / "qe_hpc_pipeline.py").read_bytes())
        self.write("electronic.py", (TOOLS / "qe_hpc_electronic.py").read_bytes())
        self.write("qe_pdos.py", (TOOLS / "qe_pdos.py").read_bytes())
        self.write("submit.sh", "mock")
        self.write("pseudo/Si.UPF", b"<UPF version='2.0'>Si</UPF>")
        self.plan = list(pipeline.STAGES[1:])
        file_hashes = {}
        for name in ["structure.in", "submit.sh", "pipeline.py",
                     "electronic.py", "qe_pdos.py"]:
            file_hashes[name] = digest((self.root / name).read_bytes())
        for stage in self.plan:
            key = "stages/" + stage + ".slurm"
            self.write(key, "mock " + stage)
            file_hashes[key] = digest((self.root / key).read_bytes())
        self.manifest = {
            "schema": pipeline.SCHEMA, "calculation": "scf",
            "stages": self.plan, "file_sha256": file_hashes,
            "pseudopotentials": [{"element": "Si", "file": "Si.UPF",
                "sha256": digest((self.root / "pseudo/Si.UPF").read_bytes())}],
            "electronic": {
                "nbnd": 2, "mesh": [8, 8, 8], "emin": -1, "emax": 1,
                "delta_e": .1, "degauss": .01,
                "path": [{"label": "G", "k": [0, 0, 0], "segments": 2},
                         {"label": "X", "k": [.5, 0, 0], "segments": 1}]
            }
        }
        self.write("pipeline.json", json.dumps(self.manifest))
        self.write("bands.dat.gnu",
                   "0 -2\n0.2 -1\n0.4 0\n\n0 1\n0.2 2\n0.4 3\n")
        self.write("dos.dat", "# E DOS Int\n-1 0.5 0.1\n0 1.0 0.4\n1 1.5 1.0\n")
        self.write("pdos.pdos_tot",
                   "# E DOS PDOS\n-1 0.5 .2\n0 1.0 .4\n1 1.5 .5\n")
        self.write("pdos.pdos_atm#1(Si)_wfc#1(s)",
                   "# E LDOS s\n-1 .1 .1\n0 .2 .2\n1 .2 .2\n")
        self.write("pdos.pdos_atm#2(Si)_wfc#1(p)",
                   "# E LDOS p1 p2 p3\n"
                   "-1 .1 .05 .03 .02\n0 .2 .1 .05 .05\n"
                   "1 .3 .1 .1 .1\n")
        self.write("projwfc.out", "PROJWFC completed\n")
        self.write("tmp/kristalyapi.save/data-file-schema.xml", "<qe>synthetic</qe>")
        for stage in self.plan[:-1]:
            receipt = {"schema": pipeline.REPORT_SCHEMA,
                       "stage": stage, "status": "completed",
                       "hashes": {"structure.in": file_hashes["structure.in"],
                                  "tmp/kristalyapi.save/data-file-schema.xml":
                                  digest((self.root / "tmp/kristalyapi.save/data-file-schema.xml").read_bytes())}}
            self.write("reports/" + stage + ".json", json.dumps(receipt))

    def write(self, name, value):
        (self.root / name).write_bytes(
            value if isinstance(value, bytes) else value.encode("utf-8"))

    def test_complete_electronic_json_and_atom_orbitals(self):
        output = electronic.collect(self.root)
        self.assertEqual(output["schema"], "kristalyapi.qe-electronic.v1")
        self.assertEqual(output["bands"]["total_bands"], 2)
        self.assertEqual(output["bands"]["distance"], [0.0, .2, .4])
        self.assertEqual(output["bands"]["k_path_nodes"], [
            {"label": "G", "distance": 0.0}, {"label": "X", "distance": .4}])
        self.assertEqual(output["bands"]["energies_ev"][1], [1, 2, 3])
        self.assertEqual(output["dos"]["energy_ev"], [-1, 0, 1])
        self.assertEqual(output["pdos_atoms"]["atoms"][0]["orbitals"]["s"], [.1, .2, .2])
        self.assertEqual(output["pdos_atoms"]["atoms"][1]["orbitals"]["p"], [.1, .2, .3])
        self.assertEqual(output["truba_provenance"]["source_sha256"]["structure.in"],
                         self.manifest["file_sha256"]["structure.in"])
        self.assertFalse(output["truba_provenance"]["scientific_convergence_verified"])
        self.assertEqual(electronic.main(["--bundle", str(self.root)]), 0)
        result = json.loads((self.root / "electronic-results.json").read_text())
        self.assertEqual(result["pdos_total"]["sum_projected_states_per_ev"], [.2, .4, .5])
        self.assertEqual(electronic.main(["--bundle", str(self.root)]), 2)

    def test_p14_800_calculated_bands_keep_only_requested_301_to_380(self):
        self.manifest["electronic"]["nbnd"] = 800
        self.manifest["electronic"]["band_window"] = [301, 380]
        self.write("pipeline.json", json.dumps(self.manifest))
        self.write("bands.dat.gnu", "".join(
            f"0 {band}\n0.2 {band + 0.1}\n0.4 {band + 0.2}\n\n"
            for band in range(1, 801)))
        result = electronic.collect(self.root)
        bands = result["bands"]
        self.assertEqual(bands["band_index_start"], 301)
        self.assertEqual(bands["total_bands"], 800)
        self.assertEqual(len(bands["energies_ev"]), 80)
        self.assertEqual(bands["energies_ev"][0], [301.0, 301.1, 301.2])
        self.assertEqual(bands["energies_ev"][-1], [380.0, 380.1, 380.2])
        self.assertEqual(bands["distance"], [0.0, 0.2, 0.4])
        self.assertEqual(bands["selection_policy"], "explicit-one-based-inclusive")
        self.assertEqual(result["truba_provenance"]["source_sha256"]["structure.in"],
                         self.manifest["file_sha256"]["structure.in"])
        self.assertEqual(electronic.main(["--bundle", str(self.root)]), 0)
        stored = json.loads((self.root / "electronic-results.json").read_text())
        self.assertEqual(stored["bands"]["total_bands"], 800)
        self.assertEqual(len(stored["bands"]["energies_ev"]), 80)

    def test_p14_reject_hidden_corrupt_band_and_wrong_total(self):
        self.manifest["electronic"]["nbnd"] = 330
        self.manifest["electronic"]["band_window"] = [301, 320]
        self.write("pipeline.json", json.dumps(self.manifest))
        blocks = [f"0 {band}\n0.2 {band+.1}\n0.4 {band+.2}\n\n"
                  for band in range(1, 331)]
        blocks[99] = "0 100\n0.3 100.1\n0.4 100.2\n\n"
        self.write("bands.dat.gnu", "".join(blocks))
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            electronic.collect(self.root)
        blocks[99] = "0 100\n0.2 100.1\n0.4 100.2\n\n"
        self.write("bands.dat.gnu", "".join(blocks[:-1]))
        with self.assertRaisesRegex(ValueError, "band count differs"):
            electronic.collect(self.root)

    def test_p14_invalid_windows_and_unbounded_raw_scan_rejected(self):
        settings = self.manifest["electronic"]
        settings["nbnd"] = 800
        self.write("pipeline.json", json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, "window required"):
            pipeline.load_manifest(self.root)
        for window in ([0, 20], [301, 300], [201, 501], [701, 801],
                       [True, 20], ["301", 380], [301]):
            with self.subTest(window=window):
                settings["band_window"] = window
                self.write("pipeline.json", json.dumps(self.manifest))
                with self.assertRaisesRegex(ValueError, "invalid one-based band window"):
                    pipeline.load_manifest(self.root)
        settings["band_window"] = [1, 30]
        settings["nbnd"] = 8001
        settings["path"][0]["segments"] = 500
        self.write("pipeline.json", json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, "4 million"):
            pipeline.load_manifest(self.root)

    def test_real_qe_spin_dos_fixture_is_not_treated_as_unpolarized(self):
        # Real QE 6.7MaX output committed independently by the spin acceptance
        # cohort; this parser deliberately fails on four numeric DOS columns.
        fixture = (TOOLS.parent /
                   "validation-results/qe-spin-si-20261030-main-7f38e9e" /
                   "pipeline/dos.dat")
        self.assertTrue(fixture.is_file())
        with self.assertRaisesRegex(ValueError, "spin/noncollinear"):
            electronic.parse_dos(fixture)

    def test_reject_spin_and_nonfinite_columns(self):
        self.write("dos.dat", "# DOS up down integral\n-1 .1 .2 .3\n0 .3 .4 .5\n")
        with self.assertRaisesRegex(ValueError, "spin/noncollinear"):
            electronic.collect(self.root)
        self.write("dos.dat", "-1 0.5 0.1\n0 NaN .4\n1 1.5 1\n")
        with self.assertRaisesRegex(ValueError, "Nonfinite"):
            electronic.collect(self.root)

    def test_reject_bad_pdos_energy_and_missing_atom_orbitals(self):
        self.write("pdos.pdos_tot", "-1 .5 .2\n0.01 1 .4\n1 1.5 .5\n")
        with self.assertRaisesRegex(ValueError, "energy axes"):
            electronic.collect(self.root)
        self.write("pdos.pdos_tot", "-1 .5 .2\n0 1 .4\n1 1.5 .5\n")
        (self.root / "pdos.pdos_atm#2(Si)_wfc#1(p)").unlink()
        with self.assertRaisesRegex(ValueError, "reconcile"):
            electronic.collect(self.root)

    def test_reject_inconsistent_kaxis_or_nbnd(self):
        self.write("bands.dat.gnu",
                   "0 -2\n.2 -1\n.4 0\n\n0 1\n.3 2\n.4 3\n")
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            electronic.collect(self.root)
        self.write("bands.dat.gnu", "0 -2\n.2 -1\n.4 0\n")
        with self.assertRaisesRegex(ValueError, "nbnd"):
            electronic.collect(self.root)
        self.write("bands.dat.gnu",
                   "0 -2\n.2 -1\n.4 0\n\n0 1\n.2 2\n.4 3\n")
        self.manifest["electronic"]["path"][0]["segments"] = 5
        self.write("pipeline.json", json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, "k-point count differs from declared crystal_b path"):
            electronic.collect(self.root)

    def test_tampering_and_missing_receipt_fail_closed(self):
        self.write("electronic.py", b"tampered")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            electronic.collect(self.root)
        self.write("electronic.py", (TOOLS / "qe_hpc_electronic.py").read_bytes())
        (self.root / "reports/bands.json").unlink()
        with self.assertRaisesRegex(ValueError, "Required safe file"):
            electronic.collect(self.root)

    def test_reject_symlink_file_and_converter_without_pins(self):
        path = self.root / "dos.dat"
        path.unlink()
        path.symlink_to(self.root / "structure.in")
        with self.assertRaisesRegex(ValueError, "Required safe file|unsafe QE numeric"):
            electronic.collect(self.root)
        path.unlink()
        self.write("dos.dat", "-1 0.5 0.1\n0 1.0 0.4\n1 1.5 1.0\n")
        del self.manifest["file_sha256"]["qe_pdos.py"]
        self.write("pipeline.json", json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            electronic.collect(self.root)


if __name__ == "__main__":
    unittest.main()
