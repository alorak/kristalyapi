"""P1 XRD acceptance tests contain synthetic *fixture* measurements only."""
import hashlib
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from xrd_acceptance import assess, extract_peaks, scan_rows, positions

class XrdReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.files = []
        self.data = {"schema": "kristalyapi.xrd-experimental-cohort.v1",
                     "criteria": {"max_abs_peak_error_deg": .12,
                                  "minimum_matched_standard_peaks": 3},
                     "datasets": []}
        for instrument in ("device-A", "device-B"):
            reference = self.root / (instrument + "-standard.txt")
            reference.write_text("SYNTHETIC INDEPENDENT-REFERENCE MOCK FOR TESTS ONLY")
            for kind in ("reference-standard", "blind-sample"):
                name = instrument + "-" + kind
                scan = self.root / (name + ".csv")
                lines = ["2theta_deg,intensity"]
                for i in range(1201):
                    angle = i * .05
                    y = 1 + sum(100 * math.exp(-.5 * ((angle - center) / .1) ** 2)
                                for center in (20, 30, 40))
                    lines.append(f"{angle:.2f},{y:.6f}")
                scan.write_text("\n".join(lines)+"\n")
                item = {"id":name,"kind":kind,"instrument_id":instrument,
                        "sample_id":"sample-test", "operator_id":"synthetic-runner",
                        "acquired_at":"2026-11-01","wavelength_angstrom":1.5406,
                        "two_theta_unit":"deg","calibration_ref":"synthetic standard",
                        "synthetic":False,  # deliberately malicious declaration: not proof of reality
                        "scan":{"path":scan.name,"sha256":hashlib.sha256(scan.read_bytes()).hexdigest()}}
                if kind=="reference-standard":
                    item.update(reference_document={
                        "path":reference.name,"sha256":hashlib.sha256(reference.read_bytes()).hexdigest()},
                        reference_peaks_two_theta_deg=[20,30,40],
                        reference_source_claim="synthetic fixture; not a real certification")
                self.data["datasets"].append(item)
        self.manifest = self.root/"manifest.json"
        self.save()

    def tearDown(self):
        self.tmp.cleanup()

    def save(self):
        self.manifest.write_text(json.dumps(self.data))

    def test_structural_review_never_becomes_scientific_acceptance(self):
        outcome = assess(self.manifest)
        self.assertTrue(outcome["two_device_standard_and_blind_design_present"])
        self.assertTrue(outcome["numeric_position_gates_passed"])
        self.assertEqual(outcome["status"], "review-required")
        self.assertFalse(outcome["scientific_acceptance"])
        self.assertFalse(outcome["datasets"][0]["independent_calibration_verified"])

    def test_one_device_is_insufficient(self):
        self.data["datasets"] = [x for x in self.data["datasets"] if x["instrument_id"]=="device-A"]
        self.save()
        report = assess(self.manifest)
        self.assertFalse(report["two_device_standard_and_blind_design_present"])
        self.assertFalse(report["scientific_acceptance"])

    def test_stale_digest_fails_closed(self):
        scan = self.root/self.data["datasets"][0]["scan"]["path"]
        scan.write_text(scan.read_text()+"\n2.0,100\n")
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            assess(self.manifest)

    def test_path_traversal_and_missing_real_data_are_rejected(self):
        self.data["datasets"][0]["scan"]["path"]="../outside.csv"
        self.save()
        with self.assertRaisesRegex(ValueError,"Unsafe"):
            assess(self.manifest)
        self.data["datasets"][0]["scan"]["path"]="missing.csv"
        self.save()
        with self.assertRaisesRegex(ValueError,"missing"):
            assess(self.manifest)

    def test_synthetic_self_declaration_blocks_review(self):
        self.data["datasets"][0]["synthetic"]=True
        self.save()
        with self.assertRaisesRegex(ValueError,"Synthetic"):
            assess(self.manifest)

    def test_position_mismatch_keeps_numerical_gate_closed(self):
        self.data["datasets"][0]["reference_peaks_two_theta_deg"]=[20,30,50]
        self.save()
        report=assess(self.manifest)
        self.assertFalse(report["numeric_position_gates_passed"])
        self.assertFalse(report["datasets"][0]["numerical_position_gate_passed"])

    def test_peaks_and_bad_scans(self):
        peaks=extract_peaks([(19.9,1),(20,10),(20.1,1),(30,1)])
        self.assertEqual(len(peaks),1)
        matched,missing=positions([20,30],peaks,.2)
        self.assertEqual(len(matched),1)
        self.assertEqual(missing,[30])
        scan=self.root/"bad.csv"
        scan.write_text("2theta_deg,intensity\n20,1\n19,2\n21,3\n")
        with self.assertRaisesRegex(ValueError,"increase"):
            scan_rows(scan)


if __name__=="__main__":
    unittest.main()
