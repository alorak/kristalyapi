"""Fail-closed P14 VESTA evidence and independent analytical geometry checks."""
import json
from pathlib import Path
import tempfile
import unittest

from vesta_14_manual_reference import audit_gui_evidence, bond_geometry


class VestaManualReferenceTests(unittest.TestCase):
    def test_regular_octahedron_has_sixfold_econ_and_zero_baur_distortion(self):
        distances = [2.0] * 6
        records = {(i,): {'distance': d} for i, d in enumerate(distances)}
        result = bond_geometry(records)
        self.assertEqual(result['count'], 6)
        self.assertAlmostEqual(result['meanDistance'], 2)
        self.assertAlmostEqual(result['baurDistortion'], 0)
        self.assertAlmostEqual(result['hoppeEcon'], 6)

    def test_screenshot_template_must_not_claim_vesta_execution(self):
        template = Path(__file__).with_name('vesta_14_gui_capture_template.json')
        self.assertFalse(json.loads(template.read_text())['vestaGuiExecuted'])
        with self.assertRaises(AssertionError):
            audit_gui_evidence(template, [])

    def test_unversioned_or_unrecorded_gui_evidence_rejected(self):
        with tempfile.TemporaryDirectory() as location:
            example = Path(location) / 'capture.json'
            example.write_text(json.dumps({
                'vestaGuiExecuted': True, 'version': 'unknown',
                'platform': 'test', 'cases': [{'id': 'invented'}]
            }))
            with self.assertRaises(AssertionError):
                audit_gui_evidence(example, [])
            example.write_text(json.dumps({
                'vestaGuiExecuted': True, 'version': '3.5.8',
                'platform': 'test', 'cases': []
            }))
            with self.assertRaises(AssertionError):
                audit_gui_evidence(example, [])


if __name__ == '__main__':
    unittest.main()
