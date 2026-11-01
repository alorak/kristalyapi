"""Synthetic candidate reference/standard XRD tests; no physical acquisition."""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"tools"),str(ROOT/"tests")]
import test_xrd_acceptance as fixture
from xrd_candidate_review import review_candidates

class XrdCandidateReviewTests(unittest.TestCase):
    def setUp(self):
        self.base=fixture.XrdReviewTests("test_structural_review_never_becomes_scientific_acceptance")
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.data=self.base.data
        self.root=self.base.root
        self.manifest=self.base.manifest
        self.doc=self.root/"candidate.txt"
        self.doc.write_text("SYNTHETIC CANDIDATE REFERENCE FOR TESTS ONLY")
        self.record={"path":self.doc.name,
          "sha256":hashlib.sha256(self.doc.read_bytes()).hexdigest()}
        self.data["reference_candidates"]=[
         {"id":"candidate-A","source_reference":"synthetic A",
          "reference_document":self.record,
          "wavelength_angstrom":1.5406,
          "reference_peaks_two_theta_deg":[20.05,30.05,40.05]},
         {"id":"candidate-B","source_reference":"synthetic B",
          "reference_document":self.record,
          "wavelength_angstrom":1.5406,
          "reference_peaks_two_theta_deg":[21,31,41]}]
        self.save()
    def save(self):self.base.save()
    def test_per_candidate_residuals_and_zero_shift_remain_diagnostics(self):
        report=review_candidates(self.manifest)
        self.assertEqual(report["status"],"position-screen-only-independent-physical-review-required")
        self.assertFalse(report["phaseIdentified"])
        self.assertFalse(report["scientificAcceptance"])
        self.assertFalse(report["instrumentCalibrated"])
        self.assertEqual(len(report["samples"]),2)
        first=report["samples"][0]["candidateScreens"][0]
        self.assertEqual(first["matchedReferencePeakCount"],3)
        self.assertAlmostEqual(first["medianSignedPositionOffsetDeg"],-.05)
        self.assertAlmostEqual(first["medianAbsoluteDeviationDeg"],0)
        self.assertFalse(first["zeroShiftCertified"])
        self.assertEqual(report["samples"][0]["candidateScreens"][1]["matchedReferencePeakCount"],0)
    def test_mismatched_wavelength_blocks_candidate(self):
        self.data["reference_candidates"][0]["wavelength_angstrom"]=1.5415
        self.save()
        report=review_candidates(self.manifest)
        self.assertEqual(report["samples"][0]["candidateScreens"][0]["status"],"skipped-wavelength-incompatible")
    def test_reference_file_mutation_is_refused(self):
        self.doc.write_text("tampered candidate evidence")
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            review_candidates(self.manifest)
    def test_no_standard_acceptance_no_candidate_screening(self):
        self.data["datasets"][0]["reference_peaks_two_theta_deg"]=[20,30,50]
        self.save()
        report=review_candidates(self.manifest)
        self.assertFalse(report["cohortStandardNumericGatePassed"])
        self.assertEqual(report["samples"],[])
    def test_duplicate_candidate_ids_or_bad_peaks_fail_closed(self):
        self.data["reference_candidates"][1]["id"]="candidate-A"
        self.save()
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            review_candidates(self.manifest)
        self.data["reference_candidates"][1]["id"]="candidate-B"
        self.data["reference_candidates"][1]["reference_peaks_two_theta_deg"]=[40,30,20]
        self.save()
        with self.assertRaisesRegex(ValueError,"strictly increasing"):
            review_candidates(self.manifest)

if __name__=="__main__":unittest.main()
