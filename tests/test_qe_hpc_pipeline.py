"""Synthetic P1.2 TRUBA stage acceptance tests; no QE binary or SLURM required."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "qe_hpc_pipeline.py"
spec = importlib.util.spec_from_file_location("qe_hpc_pipeline", SCRIPT)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class TestStagedTruba(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        for dirname in ("pseudo", "stages", "reports", "tmp/kristalyapi.save"):
            (self.root / dirname).mkdir(parents=True)
        self.input_text = (
            "&CONTROL\n calculation = 'scf',\n prefix = 'kristalyapi',"
            "\n pseudo_dir = './pseudo',\n outdir = './tmp',\n/\n"
            "&SYSTEM\n ibrav = 0,\n nat = 2,\n ntyp = 1,\n"
            " ecutwfc = 50.0,\n ecutrho = 400.0,\n/\n"
            "&ELECTRONS\n conv_thr = 1.0d-8,\n/\n"
            "ATOMIC_SPECIES\nSi 28.0855 Si.UPF\n"
            "CELL_PARAMETERS angstrom\n5 0 0\n0 5 0\n0 0 5\n"
            "ATOMIC_POSITIONS crystal\nSi 0 0 0\nSi 0.25 0.25 0.25\n"
            "K_POINTS automatic\n4 4 4 0 0 0\n"
        )
        (self.root / "structure.in").write_text(self.input_text)
        (self.root / "pseudo/Si.UPF").write_bytes(b"<UPF version='2'>Si</UPF>")
        (self.root / "submit.sh").write_text("mock sbatch", encoding="utf-8")
        (self.root / "pipeline.py").write_bytes(SCRIPT.read_bytes())
        self.plan = list(pipeline.STAGES[1:])
        for step in self.plan:
            (self.root / "stages" / (step + ".slurm")).write_text("mock "+step)
        pinned = {rel: sha((self.root / rel).read_bytes())
                  for rel in ("structure.in", "submit.sh", "pipeline.py",
                              *("stages/" + s + ".slurm" for s in self.plan))}
        self.manifest = {
            "schema": pipeline.SCHEMA, "calculation": "scf", "stages": self.plan,
            "file_sha256": pinned,
            "pseudopotentials": [{"element": "Si", "file": "Si.UPF",
                                  "sha256": sha((self.root / "pseudo/Si.UPF").read_bytes())}],
            "electronic": {
                "nbnd": 16, "mesh": [8, 8, 8], "emin": -10.0, "emax": 10.0,
                "delta_e": 0.02, "degauss": 0.01,
                "path": [
                    {"label": "G", "k": [0., 0., 0.], "segments": 20},
                    {"label": "X", "k": [0.5, 0., 0.], "segments": 1}
                ]
            }
        }
        self.write_manifest()
        self.xml = self.root / "tmp/kristalyapi.save/data-file-schema.xml"
        self.xml.write_text("xml scf", encoding="utf-8")

    def write_manifest(self):
        (self.root / "pipeline.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def complete(self, stage):
        pipeline.prepare(self.root, stage)
        stdout, artifacts = pipeline.STAGE_OUTPUTS[stage]
        content = "QE stage complete\n"
        if stage in ("scf", "bands", "nscf"):
            content += "  JOB DONE.\n"
        if stage == "scf":
            content += " convergence has been achieved in 8 iterations\n"
        (self.root / stdout).write_text(content, encoding="utf-8")
        for artifact in artifacts:
            (self.root / artifact).write_text("data from " + stage, encoding="utf-8")
        if stage in ("scf", "bands", "nscf"):
            self.xml.write_text("xml now " + stage, encoding="utf-8")
        pipeline.finish(self.root, stage)
        self.assertTrue((self.root / "reports" / (stage + ".json")).exists())

    def test_electronic_chain_preserves_order_and_artifacts(self):
        for stage in self.plan:
            self.complete(stage)
        pipeline.summary(self.root)
        report = json.loads((self.root / "pipeline-summary.json").read_text())
        self.assertEqual(report["status"], "completed")
        self.assertFalse(report["scientific_convergence_verified"])
        self.assertEqual([s["stage"] for s in report["stages"]], self.plan)
        self.assertIn("K_POINTS crystal_b", (self.root / "bands.in").read_text())
        self.assertIn("nbnd = 16", (self.root / "bands.in").read_text())
        self.assertIn("K_POINTS automatic\n8 8 8 0 0 0", (self.root / "nscf.in").read_text())
        self.assertIn("ngauss=0", (self.root / "dos.in").read_text())
        self.assertTrue((self.root / "pdos.pdos_tot").exists())

    def test_uncompleted_parent_blocks_child(self):
        with self.assertRaisesRegex((ValueError, OSError), "Required safe file|Prior"):
            pipeline.prepare(self.root, "bands")
        self.complete("scf")
        (self.root / "scf.out").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            pipeline.prepare(self.root, "bands")

    def test_stage_completion_requires_qe_success_and_artifacts(self):
        pipeline.prepare(self.root, "scf")
        (self.root / "scf.out").write_text("JOB DONE. but not converged")
        with self.assertRaisesRegex(ValueError, "SCF not converged"):
            pipeline.finish(self.root, "scf")
        (self.root / "scf.out").write_text("convergence has been achieved\nJOB DONE.")
        pipeline.finish(self.root, "scf")
        pipeline.prepare(self.root, "bands")
        (self.root / "bands.out").write_text("JOB DONE.")
        pipeline.finish(self.root, "bands")
        pipeline.prepare(self.root, "bands_pp")
        (self.root / "bands_pp.out").write_text("postproc complete")
        with self.assertRaisesRegex(ValueError, "Required safe file"):
            pipeline.finish(self.root, "bands_pp")

    def test_reject_changed_package_inputs_and_pseudopotentials(self):
        self.manifest["electronic"]["nbnd"] = -3
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "nbnd"):
            pipeline.load_manifest(self.root)
        self.manifest["electronic"]["nbnd"] = 16
        self.write_manifest()
        (self.root / "pseudo/Si.UPF").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            pipeline.load_manifest(self.root)

    def test_fixed_cell_relax_uses_verified_final_positions(self):
        self.manifest["calculation"] = "relax"
        self.plan = list(pipeline.STAGES)
        self.manifest["stages"] = self.plan
        self.input_text = self.input_text.replace("calculation = 'scf'", "calculation = 'relax'")
        (self.root / "structure.in").write_text(self.input_text)
        (self.root / "stages/relax.slurm").write_text("mock relax")
        self.manifest["file_sha256"]["stages/relax.slurm"] = sha(b"mock relax")
        self.manifest["file_sha256"]["structure.in"] = sha(self.input_text.encode())
        self.write_manifest()
        pipeline.prepare(self.root, "relax")
        (self.root / "relax.out").write_text(
            "convergence has been achieved\nbfgs converged in 3 scf cycles\n"
            "Begin final coordinates\nATOMIC_POSITIONS (crystal)\n"
            "Si 0 0 0\nSi 0.26 0.25 0.25\nEnd final coordinates\nJOB DONE.\n")
        pipeline.finish(self.root, "relax")
        pipeline.prepare(self.root, "scf")
        self.assertIn("Si 0.260000000000 0.250000000000 0.250000000000",
                      (self.root / "scf.in").read_text())
        self.assertNotIn("calculation = 'relax'", (self.root / "scf.in").read_text())

    def test_refuse_variable_cell_output_and_symlink_reports(self):
        self.manifest["calculation"] = "relax"
        self.manifest["stages"] = list(pipeline.STAGES)
        self.input_text = self.input_text.replace("calculation = 'scf'", "calculation = 'relax'")
        (self.root / "structure.in").write_text(self.input_text)
        (self.root / "stages/relax.slurm").write_text("mock relax")
        self.manifest["file_sha256"]["stages/relax.slurm"] = sha(b"mock relax")
        self.manifest["file_sha256"]["structure.in"] = sha(self.input_text.encode())
        self.write_manifest()
        pipeline.prepare(self.root, "relax")
        (self.root / "relax.out").write_text(
            "bfgs converged\nconvergence has been achieved\n"
            "Begin final coordinates\nCELL_PARAMETERS angstrom\n1 0 0\n"
            "ATOMIC_POSITIONS (crystal)\nSi 0 0 0\nSi 0.25 0.25 0.25\n"
            "End final coordinates\nJOB DONE.\n")
        pipeline.finish(self.root, "relax")
        with self.assertRaisesRegex(ValueError, "Variable-cell"):
            pipeline.prepare(self.root, "scf")


if __name__ == "__main__":
    unittest.main()
