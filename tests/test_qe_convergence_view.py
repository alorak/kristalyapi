"""D4.2 export fails closed on forged reports; no new solver work."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import qe_electronic_convergence as d41
from qe_convergence_view import export_view


class ConvergenceViewTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);self.root=Path(temp.name)
        (self.root/'plan.json').write_text(json.dumps(d41.load_plan()))
        self.report=d41.report(self.root)
        (self.root/'comparison.json').write_text(json.dumps(self.report))

    def test_incomplete_real_reference_exports_only_existing_curves_and_keeps_failed_status(self):
        view=export_view(self.root);data=json.loads(view['spectra_json'])
        self.assertEqual(json.loads(view['comparison_json'])['status'],'failed')
        self.assertEqual([c['id'] for c in data['curves']],['reference-d4'])
        self.assertEqual(len(data['curves'][0]['energy_ev']),701)
        self.assertEqual(view['proof']['spectra_sha256'],d41.sha(view['spectra_json'].encode()))

    def test_forged_pass_does_not_export(self):
        self.report['status']='passed';(self.root/'comparison.json').write_text(json.dumps(self.report))
        with self.assertRaisesRegex(ValueError,'recomputed raw evidence'):export_view(self.root)


if __name__=='__main__':unittest.main()
