"""V16.2 numeric matrix regression. Synthetic GUI numbers are NOT real VESTA evidence."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_16_2_numeric as numeric


class NumericReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = numeric.source_references()

    def ref(self, case_id, key):
        case = next(c for c in self.baseline if c["id"] == case_id)
        return next(m for m in case["references"] if m["key"] == key)

    def test_real_cif_and_ccp4_sources_are_sha_pinned(self):
        self.assertEqual(len(self.baseline), 5)
        self.assertEqual(len(set(c["id"] for c in self.baseline)), 5)
        for case in self.baseline:
            self.assertEqual(len(case["sourceSha256"]), 64)
            self.assertTrue(case["references"])
            self.assertGreater(self.ref(case["id"], "cell.volumeA3")["reference"], 0)

    def test_nacl_rutile_graphite_metric_controls(self):
        self.assertAlmostEqual(self.ref("nacl-001-structure",
                                       "bond.nearest.Na-Cl.A")["reference"], 2.81, places=3)
        self.assertAlmostEqual(self.ref("rutile-110-polyhedron",
                                       "bond.nearest.Ti-O.A")["reference"], 1.95, delta=0.08)
        self.assertAlmostEqual(self.ref("graphite-001-miller",
                                       "miller.001.dA")["reference"], 3.4, delta=0.01)
        normal = self.ref("graphite-001-miller", "miller.001.normal")
        self.assertAlmostEqual(numeric.error_amount(normal, normal["reference"]), 0.0, places=8)

    def test_independent_gemmi_adp_and_occupancy_are_exposed(self):
        reference = next(c for c in self.baseline if c["id"] == "iucr-mixed-occupancy-adp")
        self.assertTrue(any(m["key"].startswith("adp.") for m in reference["references"]))
        self.assertTrue(any(m["key"].startswith("atom.") and m["key"].endswith(".occupancy")
                            and m["reference"] < 1 for m in reference["references"]))

    def test_no_actual_gui_yields_no_numbers_or_parity_claim(self):
        report = numeric.compare(self.baseline)
        self.assertEqual(report["vestaGuiStatus"], "NOT_RUN")
        self.assertEqual(report["scientificParity"], "NOT_ESTABLISHED")
        self.assertEqual(report["counts"]["WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED"], 0)
        self.assertTrue(all(m["vesta"] is None and m["kristalyapi"] is None
                            and m["status"] == "NOT_RUN"
                            for c in report["cases"] for m in c["measurements"]))

    def test_periodic_fractional_coordinates_respect_triclinic_metric(self):
        cell = dict(a=5.6269, b=7.3728, c=11.884,
                    alpha=85.512, beta=80.428, gamma=82.1)
        spec = numeric.scalar("atom.X.fractional", [0.95, 0.1, 0.2],
                              "fractional", 0.01, kind="fractional", cell=cell)
        self.assertAlmostEqual(numeric.error_amount(spec, [-0.05, 1.1, 0.2]), 0, places=7)
        self.assertAlmostEqual(numeric.error_amount(spec, [0.96, 0.1, 0.2]), 0.056269, places=5)
        with self.assertRaises(ValueError):
            numeric.error_amount(spec, [float("nan"), 0, 0])

    def test_direction_sign_and_nonfinite_input_fail_closed(self):
        spec = numeric.scalar("normal", [0, 0, 1], "unit", .5, kind="unit-direction")
        self.assertAlmostEqual(numeric.error_amount(spec, [0, 0, -1]), 180, places=7)
        self.assertAlmostEqual(numeric.error_amount(spec, [0, 0, 100]), 0, places=7)
        with self.assertRaises(ValueError):
            numeric.error_amount(spec, [0, 0, 0])
        with self.assertRaises(ValueError):
            numeric.error_amount(numeric.scalar("n", 1., "A", .01), True)

    def synthetic_evidence(self, folder, bad_key=False, bad_source=False, delta=0):
        case = self.baseline[0]
        volume = self.ref(case["id"], "cell.volumeA3")["reference"]
        capture = {
            "operator": "Synthetic fixture operator",
            "platform": "Synthetic fixture platform",
            "kristalyapiCommit": "a" * 40,
        }
        doc = {
            "schema": numeric.SCHEMA, "vestaVersion": "3.5.8",
            "vestaGuiExecuted": True, **capture,
            "cases": [{
                "id": case["id"],
                "sourceSha256": "0" * 64 if bad_source else case["sourceSha256"],
                "measurements": [{
                    "key": "unknown.key" if bad_key else "cell.volumeA3",
                    "vesta": volume + delta,
                    "kristalyapi": volume,
                }],
            }],
        }
        path = Path(folder) / "synthetic-evidence.json"
        path.write_text(json.dumps(doc))
        return path, capture, case["id"]

    def test_evidence_requires_real_v15_audit_not_a_bare_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence, _, _ = self.synthetic_evidence(tmp)
            with self.assertRaisesRegex(ValueError, "audited V15"):
                numeric.compare(self.baseline, evidence, None)

    def test_synthetic_measurement_comparison_requires_human_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence, capture, cid = self.synthetic_evidence(tmp)
            # Patch only the outer verifier in this isolated SYNTHETIC test.
            # The CLI always calls the actual PNG+SHA+ROI verifier.
            with patch.object(numeric, "_verified_capture", return_value=(capture, {cid})):
                result = numeric.compare(self.baseline, evidence, Path(tmp) / "mock-capture.json")
                row = next(c for c in result["cases"] if c["id"] == cid)["measurements"][0]
                self.assertEqual(row["status"], "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED")
                self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")
                self.assertTrue(any(m["status"] == "AWAITING_MEASUREMENT"
                                    for c in result["cases"] if c["id"] == cid
                                    for m in c["measurements"][1:]))
                modified, capture, cid = self.synthetic_evidence(tmp, delta=30.)
                failed = numeric.compare(self.baseline, modified, Path(tmp) / "mock-capture.json")
                checked = next(c for c in failed["cases"] if c["id"] == cid)["measurements"][0]
                self.assertEqual(checked["status"], "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED")

    def test_unknown_reference_and_hash_mismatch_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            for kwargs, needle in [
                ({"bad_key": True}, "Unknown/duplicate"),
                ({"bad_source": True}, "source hash"),
            ]:
                evidence, capture, cid = self.synthetic_evidence(tmp, **kwargs)
                with patch.object(numeric, "_verified_capture", return_value=(capture, {cid})):
                    with self.assertRaisesRegex(ValueError, needle):
                        numeric.compare(self.baseline, evidence, Path(tmp) / "mock-capture.json")

    def test_json_csv_reports_never_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "report"
            report = numeric.compare(self.baseline)
            numeric.write_reports(report, path)
            self.assertTrue((path / "report.json").is_file())
            self.assertTrue((path / "matrix.csv").is_file())
            with self.assertRaises(FileExistsError):
                numeric.write_reports(report, path)


if __name__ == "__main__":
    unittest.main()
