"""V15.1 operator capture workflow unit tests (all screenshots SYNTHETIC)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_15_visual as v15
import vesta_15_capture as capture


class CaptureWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="v15-capture-")
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.folder = self.base / "private"
        self.scene = dict(v15.pinned_cases()[0])
        self.scene["settings"] = {**self.scene["settings"], "outputPixels": [24, 16]}
        self.commit = "f" * 40
        capture.prepare(self.folder, self.commit, cases=[self.scene])
        self.manifest = self.folder / "capture.json"

    def fake_image(self, path):
        w, h = 24, 16
        data = bytes([200, 50, 80] * (w*h))
        v15.png_write(path, w, h, data)

    def fake_both(self):
        id = self.scene["id"]
        for name in ("vesta", "kristalyapi"):
            self.fake_image(self.folder / (id + "-" + name + ".png"))

    def test_prepared_manifest_remains_unattested(self):
        doc = json.loads(self.manifest.read_text())
        self.assertFalse(doc["vestaGuiExecuted"])
        self.assertEqual(doc["cases"][0]["sourceSha256"], self.scene["sourceSha256"])
        self.assertIn("REPLACE", doc["operator"])
        self.assertFalse(capture.status(self.folder, [self.scene])["cases"][0]["readyForAudit"])

    def test_prepare_refuses_overwriting_evidence(self):
        with self.assertRaisesRegex(ValueError, "new or empty"):
            capture.prepare(self.folder, self.commit, cases=[self.scene])

    def test_seal_pins_png_sha_without_claiming_gui(self):
        self.fake_both()
        record = capture.seal(self.folder, [self.scene])
        self.assertEqual(record["sealedImages"], 2)
        self.assertFalse(record["attestedGuiExecuted"])
        data = json.loads(self.manifest.read_text())
        self.assertFalse(data["vestaGuiExecuted"])
        self.assertEqual(data["cases"][0]["vesta"]["sha256"],
                         v15.digest((self.folder / (self.scene["id"] + "-vesta.png")).read_bytes()))
        self.assertIn("capture date missing", " ".join(capture.status(self.folder, [self.scene])["cases"][0]["blockers"]))

    def test_seal_rejects_modified_locked_capture(self):
        self.fake_both()
        capture.seal(self.folder, [self.scene])
        self.fake_image(self.folder / (self.scene["id"] + "-vesta.png"))
        # Force a different, but valid, pixel payload.
        p = self.folder / (self.scene["id"] + "-vesta.png")
        v15.png_write(p, 24, 16, bytes([12, 25, 50] * (24 * 16)))
        with self.assertRaisesRegex(ValueError, "pinned PNG"):
            capture.seal(self.folder, [self.scene])

    def test_seal_rejects_attestation_and_wrong_source(self):
        self.fake_both()
        data = json.loads(self.manifest.read_text())
        data["vestaGuiExecuted"] = True
        self.manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "attest manually"):
            capture.seal(self.folder, [self.scene])
        data["vestaGuiExecuted"] = False
        data["cases"][0]["sourceSha256"] = "0" * 64
        self.manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "source/settings"):
            capture.seal(self.folder, [self.scene])

    def test_status_prechecks_dont_claim_scientific_parity(self):
        self.fake_both()
        capture.seal(self.folder, [self.scene])
        data = json.loads(self.manifest.read_text())
        data["vestaGuiExecuted"] = True  # synthetic fixture, NOT actual GUI
        data["operator"] = "Synthetic test fixture"
        data["platform"] = "Synthetic test"
        for record in data["cases"]:
            for side in ("vesta", "kristalyapi"):
                record[side]["captureDate"] = "2026-10-30"
        self.manifest.write_text(json.dumps(data))
        result = capture.status(self.folder, [self.scene])
        self.assertEqual(result["ready"], 1)
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")

    def test_escapes_and_missing_files_never_pass(self):
        data = json.loads(self.manifest.read_text())
        data["cases"][0]["vesta"]["path"] = "../outside.png"
        self.manifest.write_text(json.dumps(data))
        result = capture.status(self.folder, [self.scene])
        self.assertTrue(result["cases"][0]["blockers"])
        with self.assertRaisesRegex(ValueError, "outside"):
            capture.seal(self.folder, [self.scene])


if __name__ == "__main__":
    unittest.main()
