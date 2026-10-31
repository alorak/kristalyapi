"""V17.5 GUI-free verifier: synthetic data, NO VESTA GUI use in tests."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent / "validation"))
import vesta_17_5_offline as preflight


def sample_vesta(frac_x=0, occ=.75):
    return "\n".join([
        "#VESTA_FORMAT_VERSION 3.5.0", "", "CRYSTAL", "", "TITLE",
        "Synthetic NaCl P1", "", "GROUP", " 1 1 P 1", "SYMOP",
        " 0.000000 0.000000 0.000000 1 0 0 0 1 0 0 0 1 1",
        "CELLP", " 5.640000 5.640000 5.640000 90 90 90",
        " 0 0 0 0 0", "STRUC",
        " 1 Na Na1 1.0000 0 0 0 1a 1",
        " 0.000000 0.000000 0.000000 0.00",
        " 2 Cl Cl1 " + str(occ) + " " + str(frac_x) + " 0.5 0.5 1a 1",
        " 0.000000 0.000000 0.000000 0.00",
        " 0 0 0 0 0", "BOUND", " 0 1 0 1 0 1", " 0 0 0 0 0",
        "SITET", " 1 Na1 0.500000 120 120 120 120 120 120 204 0",
        " 2 Cl1 0.500000 50 100 150 50 100 150 204 0",
        " 0 0 0 0 0 0", "ATOMT",
        " 1 Na 0.500000 120 120 120 120 120 120 204",
        " 2 Cl 0.500000 50 100 150 50 100 150 204",
        " 0 0 0 0 0", "STYLE", "BONDS 1", "POLYP",
        " 204 1 1.000 80 160 220", "ISURF", " 0 0 0 0", "",
    ])


def loss(text, filename):
    return {
        "schema": "kristalyapi.vesta17.4.loss-manifest.v1",
        "exportFormat": "VESTA_3.5_P1_LIMITED",
        "status": "LOSSY_NONVERIFIED",
        "scientificParity": "NOT_ESTABLISHED",
        "vestaGuiStatus": "NOT_RUN",
        "vestaSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "generatedVestaFile": filename,
        "exportSiteCount": 2,
        "externalFiles": [],
        "entries": [
            {"field": "symmetry", "status": "FORCED_P1"},
            {"field": "SITET/ATOMT", "status": "APPROXIMATED"},
            {"field": "SCENE/PROJT/LMATRIX/LIGHT", "status": "DROPPED"},
            {"field": "THERI", "status": "DROPPED"},
            {"field": "VESTA_GUI", "status": "NOT_RUN"},
        ],
    }


class OfflinePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="vesta175-offline-synthetic-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.vesta = self.root / "sample.vesta"
        self.report = self.root / "sample.vesta.loss.json"
        self.rewrite(sample_vesta())

    def rewrite(self, text, changes=None):
        self.vesta.write_text(text, encoding="utf-8")
        manifest = loss(text, self.vesta.name)
        if changes:
            changes(manifest)
        self.report.write_text(json.dumps(manifest), encoding="utf-8")

    def test_independent_p1_parser_and_loss_contract_without_desktop(self):
        result = preflight.offline_check(self.vesta, self.report)
        self.assertEqual(result["atomCount"], 2)
        self.assertAlmostEqual(result["cellVolumeA3"], 5.64**3, places=6)
        self.assertEqual(result["siteVisualStyleCount"], 2)
        self.assertEqual(result["occupancyByElement"]["Cl"], .75)
        self.assertEqual(result["desktopVesta"], "NOT_RUN")
        self.assertEqual(result["scientificParity"], "NOT_ESTABLISHED")
        self.assertIn("HUMAN_REVIEW", result["status"])

    def test_tampered_vesta_hash_rejected(self):
        self.vesta.write_text(self.vesta.read_text() + " ", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            preflight.offline_check(self.vesta, self.report)

    def test_missing_loss_disclosure_rejected(self):
        self.rewrite(sample_vesta(), changes=lambda m: m["entries"].pop(-2))
        with self.assertRaisesRegex(ValueError, "Missing/false loss-manifest field"):
            preflight.offline_check(self.vesta, self.report)

    def test_false_density_import_rejected_even_with_recomputed_digest(self):
        self.rewrite(sample_vesta() + "IMPORT_DENSITY\n  /tmp/data.ccp4\n")
        with self.assertRaisesRegex(ValueError, "Claimed-dropped field"):
            preflight.offline_check(self.vesta, self.report)

    def test_bad_rgb_and_missing_site_style_rejected(self):
        self.rewrite(sample_vesta().replace("50 100 150", "999 100 150"))
        with self.assertRaisesRegex(ValueError, "sphere radius or RGB"):
            preflight.offline_check(self.vesta, self.report)
        self.rewrite(sample_vesta().replace(" 2 Cl1 0.500000 50 100 150 50 100 150 204 0\n", ""))
        with self.assertRaisesRegex(ValueError, "missing termination or site coverage"):
            preflight.offline_check(self.vesta, self.report)

    def test_occupancy_and_non_p1_group_are_rejected(self):
        self.rewrite(sample_vesta(occ=1.2))
        with self.assertRaisesRegex(ValueError, "Nonphysical occupancy"):
            preflight.offline_check(self.vesta, self.report)
        self.rewrite(sample_vesta().replace(" 1 1 P 1", " 225 1 F m -3 m"))
        with self.assertRaisesRegex(ValueError, "requires explicit P1"):
            preflight.offline_check(self.vesta, self.report)

    def test_reference_comparison_uses_geometry_not_visual_parity(self):
        reference = self.root / "reference.vesta"
        reference.write_text(sample_vesta(frac_x=.5), encoding="utf-8")
        result = preflight.offline_check(self.vesta, self.report, reference)
        self.assertEqual(result["referenceComparison"]["status"],
                         "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED")
        self.assertEqual(result["visualParity"], "NOT_ESTABLISHED")
        reference.write_text(sample_vesta(frac_x=1.0), encoding="utf-8")
        result2 = preflight.offline_check(self.vesta, self.report, reference)
        self.assertEqual(result2["referenceComparison"]["status"],
                         "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED")

    def test_no_symlink_input_or_overwrite_report(self):
        target = self.root / "link.vesta"
        target.symlink_to(self.vesta)
        with self.assertRaisesRegex(ValueError, "symlinked"):
            preflight.offline_check(target, self.report)
        self.assertEqual(preflight.main([
            "--vesta", str(self.vesta), "--loss-report", str(self.report),
            "--report-out", str(self.root / "offline.json")]), 0)
        self.assertEqual(preflight.main([
            "--vesta", str(self.vesta), "--loss-report", str(self.report),
            "--report-out", str(self.root / "offline.json")]), 2)


if __name__ == "__main__":
    unittest.main()
