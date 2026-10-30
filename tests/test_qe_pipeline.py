"""Mock-executable (NOT scientific) tests for local QE electronic workflow."""
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from qe_pipeline import (bands_input, change_calculation, insert_nbnd, load_band_path,
                         nscf_input, parse_bands_gnu, parse_dos, parse_pdos_total,
                         post_input, run_pipeline, use_relaxed_positions)
from test_qe_runner import INPUT, fake_output


class PipelineTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.infile = self.root / "mos2.in"
        self.infile.write_text(INPUT, encoding="utf-8")
        self.pseudos = self.root / "source"
        self.pseudos.mkdir()
        (self.pseudos / "Mo.UPF").write_text('<UPF version="2.0"/>')
        (self.pseudos / "S.UPF").write_text('<UPF version="2.0"/>')
        self.kpath = self.root / "kpath.txt"
        self.kpath.write_text("Gamma 0 0 0 12\nM 0.5 0 0 12\nK 0.3333333 0.3333333 0 12\nGamma 0 0 0 1\n")

    def test_band_path_comes_from_user_not_inferred(self):
        points = load_band_path(self.kpath)
        self.assertEqual(len(points), 4)
        self.assertEqual(points[-1][-1], 1)
        self.kpath.write_text("Gamma 0 0 0 6\nM 0.5 0 0 12\n")
        with self.assertRaisesRegex(ValueError, "Last band-path weight"):
            load_band_path(self.kpath)

    def test_fixed_cell_relax_to_scf_preserves_fractional_coordinates_and_kmesh(self):
        output = fake_output()
        result = use_relaxed_positions(INPUT, output, nat=3)
        self.assertIn("K_POINTS automatic\n4 4 1", result)
        self.assertIn("Mo 0.000000000000 0.000000000000 0.500000000000", result)
        scf = change_calculation(result, "scf")
        self.assertIn("calculation = 'scf'", scf)
        self.assertNotIn("&IONS", scf)
        self.assertEqual(scf.count("K_POINTS automatic"), 1)
        self.assertIn("ATOMIC_POSITIONS crystal", scf)

    def test_untrusted_changed_atom_order_or_missing_final_positions_rejected(self):
        output = fake_output().replace("Mo 0 0 0.5", "S 0 0 0.5")
        with self.assertRaisesRegex(ValueError, "atom count/order"):
            use_relaxed_positions(INPUT, output, nat=3)
        with self.assertRaisesRegex(ValueError, "missing final coordinates"):
            use_relaxed_positions(INPUT, "JOB DONE.", nat=3)

    def test_band_and_dense_nscf_inputs_share_prefix(self):
        scf = change_calculation(INPUT, "scf")
        path = load_band_path(self.kpath)
        bands = bands_input(scf, path, nbnd=25)
        self.assertIn("calculation = 'bands'", bands)
        self.assertIn("nbnd = 25", bands)
        self.assertIn("K_POINTS crystal_b\n4\n", bands)
        self.assertNotIn("&IONS", bands)
        dense = nscf_input(scf, 25, 12)
        self.assertIn("calculation = 'nscf'", dense)
        self.assertIn("12 12 1 0 0 0", dense)
        self.assertIn("filpdos='pdos'", post_input("projwfc"))
        with self.assertRaisesRegex(ValueError, "NSCF k mesh"):
            nscf_input(scf, 25, 1)

    def test_band_path_nodes_follow_sampled_distances_without_guessing(self):
        from qe_pipeline import band_path_nodes
        archive = Path(__file__).resolve().parents[1] / "validation-results/qe-mos2-d4-20261029-amd64/cases/electronic/pipeline"
        distance = json.loads((archive / "electronic-results.json").read_text())["bands"]["distance"]
        path = [("Gamma", [0, 0, 0], 20), ("M", [.5, 0, 0], 20), ("K", [1/3, 1/3, 0], 20), ("Gamma", [0, 0, 0], 1)]
        nodes = band_path_nodes(path, distance)
        self.assertEqual([n["label"] for n in nodes], ["Gamma", "M", "K", "Gamma"])
        self.assertEqual([n["distance"] for n in nodes], [distance[0], distance[20], distance[40], distance[60]])
        self.assertIsNone(band_path_nodes(path[:-1] + [("Gamma", [0, 0, 0], 2)], distance))
        self.assertIsNone(band_path_nodes([("A", [0, 0, 0], 1), ("B", [0, 0, 0], 1)], [0.0, 0.0]))

    def test_parse_band_dos_and_projected_dos_without_fabricated_fermi(self):
        bands = self.root / "bands.dat.gnu"
        bands.write_text("0  -1\n1 0\n2 1\n\n0 2\n1 3\n2 4\n")
        data = parse_bands_gnu(bands)
        self.assertEqual(data["energies_ev"], [[-1, 0, 1], [2, 3, 4]])
        self.assertIn("raw QE", data["reference"])
        dos = self.root / "dos.dat"
        dos.write_text("# E DOS Integrated\n-1 0.1 0.1\n0 0.5 0.5\n1 0.2 0.8\n")
        values = parse_dos(dos)
        projected = self.root / "pdos.pdos_tot"
        projected.write_text("# E DOS PDOS\n-1 0.1 0.08\n0 0.5 0.3\n1 0.2 0.12\n")
        self.assertEqual(parse_pdos_total(projected, values)["sum_projected_states_per_ev"], [.08, .3, .12])
        projected.write_text("# E DOS PDOS\n-1.1 .1 .08\n0 .5 .3\n1 .2 .12\n")
        with self.assertRaisesRegex(ValueError, "energy axes mismatch"):
            parse_pdos_total(projected, values)

    def test_prepare_only_stages_inputs_without_computation(self):
        dest = self.root / "prepare"
        result = run_pipeline(self.infile, self.pseudos, dest, band_path=self.kpath,
                              pdos=True, nbnd=25, execute=False)
        self.assertEqual(result["status"], "prepared")
        self.assertEqual(len(result["steps"]), 7)
        self.assertFalse((dest / "electronic-results.json").exists())
        self.assertFalse((dest / "relax.out").exists())
        self.assertTrue((dest / "scf.in").exists())
        self.assertEqual(result["steps"]["dos"]["status"], "prepared")

    def test_total_pdos_extra_endpoint_preserves_exact_common_grid(self):
        path=self.root/'pdos.pdos_tot'
        path.write_text('-1 .1 .08\n0 .5 .3\n1 .2 .12\n2 0 0\n')
        result=parse_pdos_total(path,{'energy_ev':[-1,0,1]})
        self.assertEqual(result['sum_projected_states_per_ev'],[.08,.3,.12])
        self.assertEqual(result['grid_selection']['discarded_outside_window'],1)
        path.write_text('-1 .1 .08\n.01 .5 .3\n1 .2 .12\n2 0 0\n')
        with self.assertRaisesRegex(ValueError,'axes mismatch'):
            parse_pdos_total(path,{'energy_ev':[-1,0,1]})

    def mocked_process(self, calls, fail_stage=None):
        def fake(cmd, *, cwd, stdin, stdout, stderr, timeout, check):
            step = Path(cmd[-1]).stem
            calls.append(step)
            (cwd / "tmp" / "kristalyapi.save").mkdir(parents=True, exist_ok=True)
            if step == "relax":
                content = fake_output()
            elif step == "scf":
                content = fake_output(ionic=False)
            elif step in {"bands", "nscf"}:
                content = "Program PWSCF v.7.5\nJOB DONE.\n"
            else:
                content = "Postprocessing success\n"
            if step == fail_stage:
                content = "Error in routine\n"
            if step == "bands_pp":
                (cwd / "bands.dat.gnu").write_text("0 -2\n1 -1\n\n0 1\n1 2\n")
            elif step == "dos":
                (cwd / "dos.dat").write_text("# E DOS Integrated\n-1 0.1 0.1\n0 0.5 0.5\n1 0.2 0.8\n")
            elif step == "projwfc":
                (cwd / "pdos.pdos_tot").write_text("# E DOS PDOS\n-1 0.1 0.08\n0 0.5 0.3\n1 0.2 0.12\n")
                for idx, element, densities in [
                    (1, "Mo", (0.04, 0.15, 0.06)),
                    (2, "S", (0.02, 0.08, 0.03)),
                    (3, "S", (0.02, 0.07, 0.03)),
                ]:
                    lines = ["# E LDOS p1 p2 p3"]
                    for energy, ldos in zip((-1, 0, 1), densities):
                        lines.append(f"{energy} {ldos} {ldos} 0 0")
                    (cwd / f"pdos.pdos_atm#{idx}({element})_wfc#1(p)").write_text(
                        "\n".join(lines) + "\n")
            stdout.write(content.encode())
            return types.SimpleNamespace(returncode=0)
        return fake

    def test_mocked_workflow_stops_on_failure_and_preserves_metadata(self):
        calls = []
        with patch("qe_pipeline.shutil.which", return_value="/mock/qe.x"), \
             patch("qe_pipeline.subprocess.run", side_effect=self.mocked_process(calls, fail_stage="bands")):
            result = run_pipeline(self.infile, self.pseudos, self.root / "failed",
                                  execute=True, band_path=self.kpath, pdos=True, nbnd=25)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(calls, ["relax", "scf", "bands"])
        self.assertFalse((self.root / "failed" / "electronic-results.json").exists())
        self.assertEqual(result["steps"]["bands"]["status"], "failed")

    def test_mocked_workflow_exports_electronic_json_only_on_complete(self):
        calls = []
        with patch("qe_pipeline.shutil.which", return_value="/mock/qe.x"), \
             patch("qe_pipeline.subprocess.run", side_effect=self.mocked_process(calls)):
            result = run_pipeline(self.infile, self.pseudos, self.root / "complete",
                                  execute=True, band_path=self.kpath, pdos=True, nbnd=25)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(calls, list(("relax", "scf", "bands", "bands_pp", "nscf", "dos", "projwfc")))
        electronic = (self.root / "complete" / "electronic-results.json")
        self.assertTrue(electronic.exists())
        import json
        data = json.loads(electronic.read_text())
        self.assertEqual(data["schema"], "kristalyapi.qe-electronic.v1")
        self.assertEqual(len(data["bands"]["energies_ev"]), 2)
        self.assertIn("Fermi", data["energy_zero"])
        self.assertEqual(data["dos"]["dos_states_per_ev"], [.1, .5, .2])
        self.assertEqual(len(data["pdos_atoms"]["atoms"]), 3)
        self.assertEqual(len(data["pdos_atoms"]["elements"]), 2)
        self.assertFalse((self.root / "complete" / "structure.out").exists())

    def test_reject_missing_band_configuration_and_spin_input(self):
        with self.assertRaisesRegex(ValueError, "nbnd"):
            run_pipeline(self.infile, self.pseudos, self.root / "missing", band_path=self.kpath)
        self.infile.write_text(INPUT.replace("ibrav = 0,", "ibrav = 0,\n nspin=2,"))
        with self.assertRaisesRegex(ValueError, "Spin-polarized"):
            run_pipeline(self.infile, self.pseudos, self.root / "spin")


if __name__ == "__main__":
    unittest.main()
