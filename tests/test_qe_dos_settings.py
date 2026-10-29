"""Bounded DOS controls: synthetic subprocess/API tests, not physical acceptance."""
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'tools'), str(ROOT/'server')]
from qe_post_settings import canonical_dos_settings
from qe_pipeline import post_input, run_pipeline
import test_qe_pipeline as pipeline
import test_qe_electronic_jobs as jobs

SETTINGS = {'delta_e_ev': .01, 'degauss_ry': .005, 'energy_min_ev': -65, 'energy_max_ev': 30}


class DosSettingsTests(unittest.TestCase):
    def test_units_match_between_dos_and_projwfc(self):
        for kind in ('dos', 'projwfc'):
            text = post_input(kind, SETTINGS)
            for expected in ('DeltaE=0.01', 'degauss=0.005', 'Emin=-65', 'Emax=30', 'ngauss=0'):
                self.assertIn(expected, text)
        self.assertEqual(post_input('bands_pp'), post_input('bands_pp', SETTINGS))

    def test_invalid_nonfinite_partial_excessive_and_off_grid_ranges_rejected(self):
        for key, value in [('delta_e_ev', True), ('delta_e_ev', .001), ('degauss_ry', float('nan')),
                           ('degauss_ry', float('inf')), ('degauss_ry', .1), ('energy_min_ev', -501),
                           ('energy_max_ev', -65), ('energy_max_ev', 35.01), ('energy_max_ev', 30.005)]:
            bad = dict(SETTINGS); bad[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                canonical_dos_settings(bad)
        for bad in ({}, dict(SETTINGS, executable='pw.x')):
            with self.assertRaises(ValueError): canonical_dos_settings(bad)

    def test_explicit_settings_reach_both_prepared_inputs_and_manifest(self):
        f = pipeline.PipelineTest(); f.setUp(); self.addCleanup(f.doCleanups)
        result = run_pipeline(f.infile, f.pseudos, f.root/'explicit', band_path=f.kpath,
                              pdos=True, nbnd=32, execute=False, dos_settings=SETTINGS)
        self.assertEqual(result['dos_settings'], SETTINGS)
        for kind in ('dos', 'projwfc'):
            self.assertEqual((f.root/'explicit'/(kind+'.in')).read_text(), post_input(kind, SETTINGS))

    def test_http_rejects_invalid_settings_before_queue_or_execution(self):
        f = jobs.ElectronicJobTests(); f.setUp(); self.addCleanup(f.doCleanups)
        request = jobs.request(); request['electronic']['dos'] = dict(SETTINGS, degauss_ry=True)
        for suffix in ('/validate', ''):
            response = f.client.post('/api/v1/calculations'+suffix, json=request, headers=f.auth)
            self.assertEqual(response.status_code, 422, response.text)
        self.assertIsNone(f.store.claim())
        self.assertFalse((f.jobs/'runs').exists())

    def test_worker_child_process_preserves_explicit_dos_request(self):
        f = jobs.ElectronicJobTests(); f.setUp(); self.addCleanup(f.doCleanups)
        request = jobs.request(); request['electronic']['dos'] = copy.deepcopy(SETTINGS)
        with patch.object(jobs, 'request', return_value=request):
            jid, row = f.execute()
        self.assertEqual(row['status'], 'completed', row['error'])
        folder = f.jobs/'runs'/jid/'pipeline'
        self.assertEqual((folder/'dos.in').read_text(), post_input('dos', SETTINGS))
        self.assertEqual((folder/'projwfc.in').read_text(), post_input('projwfc', SETTINGS))
        self.assertEqual(json.loads((folder/'pipeline.json').read_text())['dos_settings'], SETTINGS)


if __name__ == '__main__': unittest.main()
