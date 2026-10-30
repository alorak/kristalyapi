"""Synthetic offline tests for the portable TRUBA result collector (no QE run)."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "qe_hpc_collect.py"
spec = importlib.util.spec_from_file_location("qe_hpc_collect", MODULE_PATH)
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class TestTrubaCollector(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "pseudo").mkdir()
        self.raw = b"&CONTROL\n calculation='relax'\n/\n"
        self.upf = b"<UPF version='2.0'><PP_HEADER element='Si'/></UPF>\n"
        self.slurm = b"#!/bin/bash\n#SBATCH --job-name=si\n"
        (self.root / "structure.in").write_bytes(self.raw)
        (self.root / "run.slurm").write_bytes(self.slurm)
        (self.root / "pseudo" / "Si.UPF").write_bytes(self.upf)
        self.manifest = {
            "schema": "kristalyapi.truba-qe-slurm-package.v1",
            "calculation": "relax",
            "structure_in_sha256": sha(self.raw),
            "run_slurm_sha256": sha(self.slurm),
            "pseudopotentials": [
                {"element": "Si", "file": "Si.UPF", "included": True, "sha256": sha(self.upf)}
            ],
        }
        self.write_manifest()
        self.write_output()

    def write_manifest(self):
        (self.root / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def write_output(self, converged=True, geometry=True, done=True):
        lines = [
            "  Program PWSCF v.7.4 starts",
            "    iteration #  1",
            "    convergence has been achieved in 7 iterations" if converged else
              "    convergence NOT achieved after 200 iterations",
            " ! total energy              =    -31.12560012 Ry",
            "    Forces acting on atoms (cartesian axes, Ry/au):",
            "     atom    1 type  1   force =   0.0000123  -0.0000345  0.0000789",
            "     Total force = 0.0000900     Total SCF correction = 0.000001",
        ]
        if geometry:
            lines.append("    bfgs converged in 3 scf cycles")
        if done:
            lines.append("     JOB DONE.")
        (self.root / "structure.out").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_valid_relax_metrics_and_hashes(self):
        result = collector.collect(self.root, 0)
        self.assertEqual(result["status"], "completed")
        self.assertFalse(result["scientific_convergence_verified"])
        self.assertEqual(result["qe"]["energy_ry"], -31.12560012)
        self.assertAlmostEqual(result["qe"]["total_force_ry_bohr"], 0.00009)
        self.assertAlmostEqual(result["qe"]["max_force_component_ry_bohr"], 0.0000789)
        self.assertTrue(result["qe"]["geometry_converged"])
        self.assertEqual(result["qe"]["energy_observation_count"], 1)
        self.assertTrue(result["integrity"]["all_pinned_upfs_match"])
        self.assertTrue(result["integrity"]["slurm_script_matches"])

    def test_scientific_failure_not_accepted(self):
        self.write_output(converged=False)
        self.assertEqual(collector.collect(self.root)["status"], "not_converged")
        self.write_output(geometry=False)
        self.assertEqual(collector.collect(self.root)["status"], "not_converged")
        self.write_output(done=False)
        self.assertEqual(collector.collect(self.root)["status"], "incomplete")
        self.write_output()
        self.assertEqual(collector.collect(self.root, 1)["status"], "failed")

    def test_fail_closed_after_mutating_provenance(self):
        (self.root / "structure.in").write_text("changed", encoding="utf-8")
        result = collector.collect(self.root)
        self.assertEqual(result["status"], "invalid")
        self.assertFalse(result["integrity"]["input_matches"])
        (self.root / "structure.in").write_bytes(self.raw)
        (self.root / "pseudo" / "Si.UPF").write_text("wrong", encoding="utf-8")
        self.assertEqual(collector.collect(self.root)["status"], "invalid")
        (self.root / "pseudo" / "Si.UPF").unlink()
        self.assertEqual(collector.collect(self.root)["status"], "invalid")
        (self.root / "pseudo" / "Si.UPF").write_bytes(self.upf)
        (self.root / "run.slurm").write_text("modified", encoding="utf-8")
        self.assertEqual(collector.collect(self.root)["status"], "invalid")

    def test_unpinned_manually_provided_upf_does_not_claim_verified(self):
        self.manifest["pseudopotentials"][0]["sha256"] = None
        self.write_manifest()
        result = collector.collect(self.root)
        self.assertEqual(result["status"], "unverified")
        self.assertFalse(result["integrity"]["all_upfs_pinned"])
        self.assertIsNone(result["integrity"]["pseudopotentials"][0]["matches_pinned_hash"])

    def test_refuse_symlink_and_unsafe_manifest(self):
        (self.root / "structure.out").unlink()
        (self.root / "structure.out").symlink_to(self.root / "structure.in")
        self.assertEqual(collector.collect(self.root)["status"], "incomplete")
        self.manifest["pseudopotentials"][0]["file"] = "../Si.UPF"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "Unsafe UPF name"):
            collector.collect(self.root)

    def test_compact_json_written_without_qe_execution(self):
        rc = collector.main(["--bundle", str(self.root), "--exit-code", "0"])
        self.assertEqual(rc, 0)
        report = json.loads((self.root / "summary.json").read_text(encoding="utf-8"))
        self.assertEqual(report["schema"], "kristalyapi.truba-qe-summary.v1")
        self.assertEqual(report["status"], "completed")
        self.assertLess((self.root / "summary.json").stat().st_size, 100000)


if __name__ == "__main__":
    unittest.main()
