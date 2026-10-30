"""D5.2 offline evidence reviewer regression tests; no QE, Docker, Slurm, or network."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import qe_defect_resource_review as review


class D5ResourceReviewTests(unittest.TestCase):
    def test_actual_committed_oom_evidence_and_budget_labels(self):
        result = review.verify_and_plan()
        self.assertEqual(result["schema"], review.SCHEMA)
        self.assertEqual(result["original_oom_case_count"], 4)
        self.assertEqual(result["status"], "execution_blocked_resource_evidence_incomplete")
        self.assertFalse(result["calculation_performed_by_review"])
        self.assertFalse(result["new_experiments_executed"])
        self.assertFalse(result["scientific_convergence_accepted"])
        self.assertFalse(result["api_limits_changed"])
        cases = result["cases"]
        self.assertEqual([c["case_id"] for c in cases], list(review.IDS))
        self.assertEqual([c["neutral_valence_electrons"] for c in cases],
                         [416, 410, 404, 416])
        self.assertEqual([c["minimum_occupied_bands_unpolarized"] for c in cases],
                         [208, 205, 202, 208])
        self.assertEqual([c["qe_printed_estimate"]["static_gt_decimal_gb"] for c in cases],
                         [24.76, 24.62, 33.85, 25.02])
        self.assertEqual([c["qe_printed_estimate"]["max_gt_decimal_gb"] for c in cases],
                         [72.41, 71.76, 80.49, 72.16])
        for case in cases:
            self.assertTrue(case["actual_oom_killed_at_6_gib"])
            self.assertIsNone(case["observed_peak_memory_bytes"])
            self.assertEqual(case["resource_budgets"][0]["assessment"],
                             "observed_oom_at_this_exact_pilot_configuration")
            self.assertFalse(any(b["experiment_executed"] for b in case["resource_budgets"]))
            self.assertTrue(all(b["sufficient_for_full_scf"] is None for b in case["resource_budgets"]))
        self.assertEqual(cases[0]["resource_budgets"][1]["assessment"],
                         "below_qe_printed_max_lower_bound")
        self.assertEqual(cases[0]["resource_budgets"][-1]["assessment"],
                         "not_excluded_by_printed_lower_bounds_unverified")

    def test_exact_estimate_semantics_and_budget_validation(self):
        self.assertEqual(review.budgets_checked("6, 32,128"), [6, 32, 128])
        for bad in ("", "6,,32", "0", "32,32", "513", "6.5", "x", "1,2,3,4,5,6,7,8,9"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                review.budgets_checked(bad)
        self.assertEqual(review.estimate_pair(
            "Estimated static dynamical RAM per process >  3.33 GB\n"
            "Estimated max dynamical RAM per process >  10.33 GB\n")["observed_peak_bytes"], None)
        for text in (
            "Estimated max dynamical RAM per process > 10 GB",
            "Estimated static dynamical RAM per process > 1 GB\n"
            "Estimated max dynamical RAM per process > 0.1 GB",
            "Estimated static dynamical RAM per process > 1 GB\n"
            "Estimated max dynamical RAM per process > 2 GB\n"
            "Estimated max dynamical RAM per process > 3 GB",
        ):
            with self.assertRaises(ValueError):
                review.estimate_pair(text)

    def test_modified_stdout_manifest_and_oom_claims_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "pilot"
            shutil.copytree(review.PILOT, folder)
            raw = folder / "pristine/initialization.out"
            raw.write_bytes(raw.read_bytes() + b"\n! total energy = -200 Ry\n")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                review.verify_and_plan(pilot=folder)
            raw.write_bytes((review.PILOT / "pristine/initialization.out").read_bytes())
            path = folder / "summary.json"
            data = json.loads(path.read_text())
            data["cases"][0]["oom_killed"] = False
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "inspection and summary disagree"):
                review.verify_and_plan(pilot=folder)
            path.write_bytes((review.PILOT / "summary.json").read_bytes())
            old = folder / "V_2S/initialization.in"
            old.write_bytes(old.read_bytes().replace(b"nbnd=416", b"nbnd=208"))
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                review.verify_and_plan(pilot=folder)

    def test_preparation_identity_and_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "prepared"
            folder.mkdir()
            p = folder / "preparation.json"
            p.write_bytes((review.PREPARED / "preparation.json").read_bytes() + b" ")
            with self.assertRaisesRegex(ValueError, "identity mismatch"):
                review.verify_and_plan(prepared=folder)
            p.unlink()
            p.symlink_to(review.PREPARED / "preparation.json")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                review.verify_and_plan(prepared=folder)

    def test_cli_new_output_and_no_subprocess(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "d5-review.json"
            with patch("subprocess.Popen", side_effect=AssertionError("should not run")), \
                 patch("subprocess.run", side_effect=AssertionError("should not run")):
                self.assertEqual(review.main(["--output", str(out), "--budgets-gib", "6,64,128"]), 0)
            data = json.loads(out.read_text())
            self.assertEqual(data["cases"][0]["resource_budgets"][1]["budget_gib"], 64)
            with self.assertRaises(SystemExit) as caught:
                review.main(["--output", str(out)])
            self.assertEqual(caught.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
