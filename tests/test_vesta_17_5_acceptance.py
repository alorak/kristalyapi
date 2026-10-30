"""V17.5 acceptance harness regression; ALL screenshots below are SYNTHETIC."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_15_visual as visual
import vesta_17_5_acceptance as v17


class Acceptance17Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="v175-synthetic-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.folder = self.base / "private"
        self.out = self.base / "out"
        self.cases = deepcopy(v17.selected_cases())
        for c in self.cases:
            c["settings"]["outputPixels"] = [24, 16]
        v17.prepare(self.folder, "f" * 40, self.cases)

    def data(self):
        return json.loads((self.folder / "evidence.json").read_text())

    def write(self, payload):
        (self.folder / "evidence.json").write_text(json.dumps(payload))

    def fake_png(self, path, shift=0):
        w, h = 24, 16
        pixels = bytearray([255] * (w * h * 3))
        for j in range(3, 10):
            for i in range(4 + shift, 12 + shift):
                off = (j * w + i) * 3
                pixels[off:off + 3] = b"\x20\x60\xce"
        visual.png_write(path, w, h, bytes(pixels))

    @staticmethod
    def project(occ=1, x=0):
        return "\n".join([
            "#VESTA_FORMAT_VERSION 3.5.0", "CRYSTAL", "TITLE",
            "Synthetic only", "GROUP", " 1 1 P 1", "SYMOP",
            " 0 0 0 1 0 0 0 1 0 0 0 1 1", "CELLP",
            " 5 5 5 90 90 90", " 0 0 0 0 0 0", "STRUC",
            f" 1 Na Na1 {occ:.4f} {x:.6f} 0 0 1a 1",
            " 0.000000 0.000000 0.000000 0.00", " 0 0 0 0 0",
            "BOUND", " 0 1 0 1 0 1", " 0 0 0 0 0",
        ]) + "\n"

    def fake_artifacts(self, modified_site=False):
        data = self.data()
        for entry in data["cases"]:
            if entry["suite"] == "P1_EXPORT_ROUNDTRIP":
                source = self.project()
                path = self.folder / entry["exportedProject"]["path"]
                path.write_text(source)
                report = {
                    "schema": "kristalyapi.vesta17.4.loss-manifest.v1",
                    "exportFormat": "VESTA_3.5_P1_LIMITED",
                    "status": "LOSSY_NONVERIFIED",
                    "scientificParity": "NOT_ESTABLISHED",
                    "vestaGuiStatus": "NOT_RUN",
                    "vestaSha256": visual.digest(path.read_bytes()),
                    "generatedVestaFile": path.name,
                    "exportSiteCount": 1,
                    "externalFiles": [],
                }
                (self.folder / entry["lossReport"]["path"]).write_text(json.dumps(report))
                resaved = self.project(x=.05 if modified_site else 0)
                (self.folder / entry["desktopResavedProject"]["path"]).write_text(resaved)
            for stage, slot in entry["screenshots"].items():
                self.fake_png(self.folder / slot["path"],
                              shift=2 if stage == "kristalyapiReopened" else 0)
        v17.seal(self.folder, self.cases)

    def attest_fake_gui(self):
        data = self.data()
        data["operator"] = "SYNTHETIC test-only operator"
        data["platform"] = "SYNTHETIC test-only desktop"
        data["vestaGuiExecuted"] = True  # SYNTHETIC UNIT TEST ONLY, not real GUI
        for entry in data["cases"]:
            for slot in entry["screenshots"].values():
                slot["captureDate"] = "2026-10-30"
                slot["captureMethod"] = "SYNTHETIC unit-test generated PNG, not VESTA GUI"
        self.write(data)

    def test_pinned_three_cifs_and_one_partial_ccp4(self):
        self.assertEqual([c["id"] for c in self.cases], list(v17.SUITES))
        self.assertEqual(len(self.cases), 4)
        self.assertEqual(self.cases[-1]["kind"], "volume")
        self.assertEqual(self.cases[-1]["settings"]["isoLevel"], 1)
        for scene in self.cases:
            self.assertEqual(len(scene["sourceSha256"]), 64)

    def test_prepared_template_does_not_attest_any_gui(self):
        doc = self.data()
        self.assertFalse(doc["vestaGuiExecuted"])
        self.assertEqual(len(doc["cases"]), 4)
        self.assertIsNone(doc["cases"][-1]["exportedProject"])
        result = v17.audit(self.folder, self.out, self.cases)
        self.assertEqual(result["vestaGuiStatus"], "NOT_RUN")
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")
        self.assertEqual(result["capturedCases"], 0)
        with self.assertRaisesRegex(ValueError, "incomplete"):
            v17.audit(self.folder, self.base / "strict", self.cases, require_all=True)

    def test_seal_real_local_bytes_but_never_claim_gui(self):
        self.fake_artifacts()
        result = v17.seal(self.folder, self.cases)
        self.assertGreater(result["sealedFiles"], 0)
        self.assertFalse(result["vestaGuiExecuted"])
        self.assertFalse(self.data()["vestaGuiExecuted"])
        self.assertEqual(self.data()["cases"][0]["screenshots"]["vestaOpened"]["sha256"],
                         visual.digest((self.folder / self.data()["cases"][0]["screenshots"]["vestaOpened"]["path"]).read_bytes()))

    def test_synthetic_complete_evidence_requires_manual_review(self):
        self.fake_artifacts()
        self.attest_fake_gui()
        outcome = v17.audit(self.folder, self.out, self.cases, require_all=True)
        self.assertEqual(outcome["capturedCases"], 4)
        self.assertTrue(outcome["evidenceComplete"])
        self.assertEqual(outcome["scientificParity"], "NOT_ESTABLISHED")
        self.assertEqual(outcome["manualScientificAcceptance"], "REQUIRED")
        self.assertEqual(outcome["cases"][0]["roundtrip"]["status"], "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED")
        self.assertEqual(outcome["cases"][-1]["omittedByV17_4"],
                         "VOLUME_GRID_NOT_EXPORTED; UNKNOWN_SOURCE_PHYSICAL_UNITS")
        self.assertEqual(outcome["cases"][-1]["roundtrip"], None)
        self.assertTrue((self.out / "matrix.csv").is_file())
        self.assertTrue((self.out / "nacl-001-structure-reopened-comparison.png").is_file())

    def test_structural_difference_reported_without_automatic_parity(self):
        self.fake_artifacts(modified_site=True)
        self.attest_fake_gui()
        result = v17.audit(self.folder, self.out, self.cases)
        self.assertEqual(result["cases"][0]["roundtrip"]["status"],
                         "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED")
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")

    def test_real_fractional_periodic_wrap_and_occupancy_limits(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / "a.vesta", Path(tmp) / "b.vesta"
            a.write_text(self.project(occ=.75, x=.99))
            b.write_text(self.project(occ=.7501, x=-.01))
            first, second = v17.parse_p1_project(a), v17.parse_p1_project(b)
            check = v17.compare_structure(first, second)
            self.assertEqual(check["status"], "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED")
            self.assertAlmostEqual(check["errors"]["maxSiteCartesianPeriodicShiftA"], 0, places=5)
            second["sites"]["Na1"]["occ"] = .8
            bad = v17.compare_structure(first, second)
            self.assertEqual(bad["status"], "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED")

    def test_manifest_exported_bytes_mismatch_is_rejected(self):
        self.fake_artifacts()
        self.attest_fake_gui()
        data = self.data()
        entry = data["cases"][0]
        report = self.folder / entry["lossReport"]["path"]
        doc = json.loads(report.read_text())
        doc["vestaSha256"] = "0" * 64
        report.write_text(json.dumps(doc))
        entry["lossReport"]["sha256"] = visual.digest(report.read_bytes())
        self.write(data)
        with self.assertRaisesRegex(ValueError, "manifest provenance/hash mismatch"):
            v17.audit(self.folder, self.out, self.cases)

    def test_tampered_screenshot_sha_is_rejected(self):
        self.fake_artifacts()
        self.attest_fake_gui()
        evidence = self.data()
        evidence["cases"][0]["screenshots"]["vestaOpened"]["sha256"] = "a" * 64
        self.write(evidence)
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            v17.audit(self.folder, self.out, self.cases)

    def test_source_pin_cannot_be_substituted(self):
        self.fake_artifacts()
        payload = self.data()
        payload["cases"][0]["sourceSha256"] = "0" * 64
        self.write(payload)
        with self.assertRaisesRegex(ValueError, "Source SHA-256"):
            v17.audit(self.folder, self.out, self.cases)

    def test_volume_gate_rejects_fake_embedded_sidecar(self):
        payload = self.data()
        payload["cases"][-1]["exportedProject"] = {
            "path": "fake.vesta", "sha256": "0" * 64
        }
        self.write(payload)
        with self.assertRaisesRegex(ValueError, "cannot claim V17.4"):
            v17.audit(self.folder, self.out, self.cases)

    def test_raster_crc_and_relative_file_paths_fail_closed(self):
        self.fake_artifacts()
        self.attest_fake_gui()
        payload = self.data()
        payload["cases"][0]["screenshots"]["vestaOpened"]["path"] = "../escape.png"
        self.write(payload)
        with self.assertRaises(ValueError):
            v17.audit(self.folder, self.out, self.cases)

    def test_outdir_never_overwrites_and_gui_flag_cannot_be_none(self):
        self.fake_artifacts()
        self.attest_fake_gui()
        v17.audit(self.folder, self.out, self.cases)
        with self.assertRaisesRegex(ValueError, "new or empty"):
            v17.audit(self.folder, self.out, self.cases)
        data = self.data()
        data["vestaGuiExecuted"] = None
        self.write(data)
        with self.assertRaisesRegex(ValueError, "attestation"):
            v17.audit(self.folder, self.base / "unset", self.cases)


if __name__ == "__main__":
    unittest.main()
