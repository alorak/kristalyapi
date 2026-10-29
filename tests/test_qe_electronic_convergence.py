"""D4.1 parser/comparison failures with SYNTHETIC spectra, not new DFT results."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import shutil
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'tools'), str(ROOT/'server')]
import qe_electronic_convergence as d41


def nscf_text():
    energies = ' '.join(str(i) for i in range(32))
    occupations = ' '.join(['1']*13+['0']*19)
    return ('number of electrons = 26\nnumber of Kohn-Sham states=32\nnumber of k points=2\n'+
            ''.join(f'k = {k} ( 100 PWs) bands (ev):\n\n{energies}\n\noccupation numbers\n{occupations}\n\n'
                    for k in ('0.0000 0.0000 0.0000', '0.0000-0.5774 0.0000'))+'JOB DONE.\n')


def data(plan):
    energy = [round(-8+i*.01, 4) for i in range(1401)]
    curve = [1.0]*len(energy)
    return {'electronic': {'bands': {'distance': [i*.01 for i in range(61)],
               'energies_ev': [[float(i)]*61 for i in range(32)]},
               'dos': {'energy_ev': energy, 'dos_states_per_ev': curve},
               'pdos_atoms': {'elements': [{'element': 'Mo', 'orbitals': {'d': curve}},
                                          {'element': 'S', 'orbitals': {'p': curve}}]}},
            'nscf': d41.read_nscf(nscf_text(), 32)}


class ConvergenceTests(unittest.TestCase):
    def setUp(self):
        self.plan = d41.load_plan(); self.left = data(self.plan); self.right = copy.deepcopy(self.left)
        self.pair = self.plan['decision_pairs'][0]

    def compare(self, pair=None):
        return d41.compare(self.left, self.right, pair or self.pair, self.plan)

    def test_preregistered_plan_and_real_reference_preflight(self):
        _, ref, baseline = d41.reference(self.plan)
        self.assertEqual(ref['final_structure_hash'], self.plan['reference']['structure_hash'])
        self.assertEqual(baseline['nscf']['kpoints'], 30)
        self.assertEqual(baseline['nscf']['occupied_bands'], 13)
        self.assertGreater(baseline['nscf']['gap_ev'], 0)

    def test_fixed_occupations_parse_adjacent_signed_coordinates_and_gap(self):
        parsed = d41.read_nscf(nscf_text(), 32)
        self.assertEqual(parsed['coordinates'][1], [0, -.5774, 0])
        self.assertEqual((parsed['vbm_ev'], parsed['cbm_ev'], parsed['gap_ev']), (12, 13, 1))

    def test_incomplete_duplicate_wrong_filling_and_missing_eigenvalues_rejected(self):
        source = nscf_text()
        bad = [source.replace('occupation numbers', 'missing', 1), source.replace('JOB DONE.', ''),
               source.replace('number of k points=2', 'number of k points=3'),
               source.replace('0.0000-0.5774', '0.0000 0.0000'),
               source.replace('1 1 1 1', '.5 1 1 1', 1), source.replace('30 31\n', '30\n', 1),
               source.replace('26\n', '28\n', 1)]
        for text in bad:
            with self.subTest(text=text[:90]), self.assertRaises(ValueError): d41.read_nscf(text, 32)

    def test_identical_finite_data_passes_but_energy_shift_does_not(self):
        self.assertTrue(self.compare()['convergence_passed'])
        for band in self.right['electronic']['bands']['energies_ev']:
            band[:] = [x+.02 for x in band]
        self.assertFalse(self.compare()['convergence_passed'])

    def test_mesh_gate_uses_nscf_edges_even_when_path_is_unchanged(self):
        self.right['nscf']['cbm_ev'] += .03; self.right['nscf']['gap_ev'] += .03
        result = self.compare(self.plan['decision_pairs'][1])
        self.assertEqual(result['common_path_band_delta_ev'], 0)
        self.assertFalse(result['convergence_passed'])

    def test_common_band_selection_sorts_at_each_path_point(self):
        self.right['electronic']['bands']['energies_ev'].reverse()
        self.assertTrue(self.compare()['convergence_passed'])

    def test_curve_shape_or_projected_shape_failure_is_not_hidden(self):
        self.right['electronic']['dos']['dos_states_per_ev'] = [2.0]*1401
        result = self.compare(); self.assertEqual(result['dos_relative_l1'], .5)
        self.assertFalse(result['convergence_passed'])
        self.right = copy.deepcopy(self.left)
        self.right['electronic']['pdos_atoms']['elements'][1]['orbitals']['p'] = [2.0]*1401
        self.assertFalse(self.compare()['convergence_passed'])

    def test_phase_shift_missing_point_negative_nonfinite_and_zero_area_rejected(self):
        for change in ('phase', 'missing', 'negative', 'nonfinite', 'zero'):
            self.right = copy.deepcopy(self.left); dos = self.right['electronic']['dos']
            if change == 'phase': dos['energy_ev'] = [e+.005 for e in dos['energy_ev']]
            if change == 'missing': dos['energy_ev'].pop(); dos['dos_states_per_ev'].pop()
            if change == 'negative': dos['dos_states_per_ev'][0] = -1
            if change == 'nonfinite': dos['dos_states_per_ev'][0] = float('nan')
            if change == 'zero': self.right['electronic']['pdos_atoms']['elements'][0]['orbitals']['d'] = [0.0]*1401
            with self.subTest(change=change), self.assertRaises(ValueError): self.compare()

    def test_legacy_comparison_selects_existing_common_points_without_interpolation(self):
        self.left['electronic']['dos']['energy_ev'] = self.left['electronic']['dos']['energy_ev'][::2]
        self.left['electronic']['dos']['dos_states_per_ev'] = [1.0]*701
        for element in self.left['electronic']['pdos_atoms']['elements']:
            for key in element['orbitals']: element['orbitals'][key] = [1.0]*701
        result = self.compare(self.plan['diagnostic_pairs'][0])
        self.assertEqual(result['comparison_grid_ev'], .02); self.assertTrue(result['convergence_passed'])

    def test_width_is_sensitivity_and_does_not_invent_a_convergence_pass(self):
        self.right['electronic']['dos']['dos_states_per_ev'] = [2.0]*1401
        result = self.compare(self.plan['decision_pairs'][2])
        self.assertIsNone(result['convergence_passed']); self.assertTrue(result['sensitivity_only'])
        self.assertTrue(result['integrity_passed']); self.assertEqual(result['dos_relative_l1'], .5)
        self.right['nscf']['eigenvalues_ev'][0][20] += .1
        self.assertFalse(self.compare(self.plan['decision_pairs'][2])['integrity_passed'])

    def test_dirty_committed_source_is_rejected(self):
        p = {'git_commit': 'a'*40, 'source_sha256': {}}
        with self.assertRaisesRegex(ValueError, 'Incomplete source'): d41.source_proof(p)
        names = ['server/qe_post_settings.py', 'server/electronic_worker.py', 'server/electronic_core.py',
                 'tools/qe_pipeline.py', 'tools/qe_pdos.py', 'tools/qe_electronic_acceptance.py',
                 'tools/qe_electronic_convergence.py', 'tools/qe_acceptance_runtime.py',
                 str(d41.PLAN.relative_to(ROOT))]
        p['source_sha256'] = {n: 'b'*64 for n in names}
        with patch.object(d41, 'committed_sha', return_value='c'*64), self.assertRaisesRegex(ValueError, 'dirty'):
            d41.source_proof(p)

    def test_missing_or_failed_cases_never_produce_overall_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'plan.json').write_text(json.dumps(self.plan))
            baseline = dict(self.left, job_id='1'*32)
            with patch.object(d41, 'reference', return_value=({}, {}, baseline)):
                result = d41.report(root)
            self.assertEqual(result['status'], 'failed'); self.assertEqual(len(result['errors']), 6)
            self.assertIsNone(result['broadening_converged'])

    def cohort(self, mutation=None):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'plan.json').write_text(json.dumps(self.plan))
            baseline = dict(copy.deepcopy(self.left), job_id='0'*32)
            def fake_case(directory, plan, case, old, ref, base):
                index = [c['id'] for c in plan['cases']].index(case['id'])
                d = dict(copy.deepcopy(self.left), job_id=f'{index+1:032x}')
                summary = {'provenance': {'git_commit': 'a'*40, 'source_sha256': {'synthetic': 'b'*64}}}
                if mutation: mutation(index, d, summary)
                return d, summary
            with patch.object(d41, 'reference', return_value=({}, {}, baseline)), patch.object(d41, 'verify_case', side_effect=fake_case):
                return d41.report(root)

    def test_complete_synthetic_cohort_and_separate_width_reporting(self):
        result = self.cohort()
        self.assertEqual(result['status'], 'passed')
        self.assertEqual(len(result['pairs']), 6)
        self.assertIsNone(result['broadening_converged'])
        self.assertIsNone(result['pairs'][2]['convergence_passed'])

    def test_primary_pair_failure_is_not_replaced_by_other_passed_pairs(self):
        def change(index, d, summary):
            if index == 1: d['electronic']['bands']['energies_ev'][10][20] += .1
        self.assertEqual(self.cohort(change)['status'], 'failed')

    def test_mixed_source_and_width_integrity_fail_closed(self):
        def mixed(index, d, summary):
            if index == 5: summary['provenance']['git_commit'] = 'c'*40
        self.assertIn('source_cohort', self.cohort(mixed)['errors'])
        def spectrum(index, d, summary):
            if index == 5: d['nscf']['eigenvalues_ev'][0][20] += .1
        self.assertEqual(self.cohort(spectrum)['status'], 'failed')

    def test_real_si_full_dos_proof_and_corrupted_raw_integral_are_checked(self):
        # Functional Si fixture, deliberately not a MoS2 convergence assertion.
        source = ROOT/'validation-results/qe-d41-si-smoke-20261029-arm64'
        counted = d41.full_dos_proof(source, self.plan)
        self.assertLess(abs(counted['integrated_states'][-1]-counted['integrated_states'][0]-16), .2)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'si'; shutil.copytree(source, path)
            raw = path/'state-count/state-count.dat'; raw.write_text(raw.read_text().replace('30.000', '30.001'))
            with self.assertRaisesRegex(ValueError, 'hash mismatch'): d41.full_dos_proof(path, self.plan)

    def test_full_dos_cannot_be_borrowed_from_another_nscf_job(self):
        source = ROOT/'validation-results/qe-d41-si-smoke-20261029-arm64'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'si'; shutil.copytree(source, path)
            proof = path/'state-count/provenance.json'; value = json.loads(proof.read_text())
            value['job_id'] = 'f'*32; proof.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, 'identity mismatch'): d41.full_dos_proof(path, self.plan)

    def test_invalid_reference_blocks_runtime_before_any_job(self):
        with patch.object(d41, 'reference', side_effect=ValueError('Pinned reference changed')), patch.object(d41, 'Runtime') as runtime:
            with self.assertRaisesRegex(ValueError, 'Pinned'): d41.run_case(Path('/unused'), self.plan['cases'][0]['id'])
            runtime.assert_not_called()


if __name__ == '__main__': unittest.main()
