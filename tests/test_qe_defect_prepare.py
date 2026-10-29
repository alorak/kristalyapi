"""Geometry/provenance rejection tests; generated structures are not DFT results."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
import qe_defect_prepare as prep


class DefectPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = json.loads(prep.PLAN.read_text())
        cls.reference = {'periodic': True,
            'cell_angstrom': [[3.18,0,0],[-1.59,2.753960784034515,0],[0,0,24]],
            'atoms': [{'element':'Mo','fractional':[0,0,.5]},
                      {'element':'S','fractional':[1/3,2/3,.565]},
                      {'element':'S','fractional':[1/3,2/3,.435]}]}
        cls.result = prep.build(cls.plan, cls.reference)

    def test_four_initial_candidates_have_exact_composition_and_no_result_claim(self):
        self.assertFalse(self.result['calculation_performed'])
        self.assertFalse(self.result['ready_for_scientific_comparison'])
        self.assertEqual([c['id'] for c in self.result['cases']], ['pristine','V_S','V_2S','O_S'])
        self.assertEqual([c['counts'] for c in self.result['cases']], [
            {'Mo':16,'S':32,'O':0}, {'Mo':16,'S':31,'O':0},
            {'Mo':16,'S':30,'O':0}, {'Mo':16,'S':31,'O':1}])
        self.assertEqual(self.result['pending_cases'][0]['id'], 'O2_at_VS')

    def test_replication_preserves_cartesian_positions_and_vacuum(self):
        pristine = self.result['cases'][0]
        cell = pristine['structure']['cell_angstrom']
        self.assertEqual(cell[2], [0,0,24])
        for site in pristine['sites']:
            original = self.reference['atoms'][site['source_basis_index']-1]
            expected = [sum((original['fractional'][k]+site['source_translation'][k])*
                            self.reference['cell_angstrom'][k][j] for k in range(3)) for j in range(3)]
            actual = [sum(site['fractional'][k]*cell[k][j] for k in range(3)) for j in range(3)]
            for a,b in zip(expected,actual):self.assertAlmostEqual(a,b,places=10)

    def test_retained_site_ids_and_neighbor_pair_have_deterministic_origin(self):
        pristine, vs, v2s, oxygen = self.result['cases']
        original = {s['id']:s for s in pristine['sites']}
        for case in (vs,v2s):
            self.assertEqual(len(set(s['id'] for s in case['sites'])),len(case['sites']))
            for s in case['sites']:self.assertEqual(s,original[s['id']])
        self.assertAlmostEqual(v2s['vacancy_pair']['distance_angstrom'],3.18)
        self.assertEqual(vs['removed_source_site_ids'],[oxygen['substitutions'][0]['id']])
        for s in oxygen['sites']:
            self.assertEqual(s['fractional'],original[s['id']]['fractional'])

    def test_capacity_stops_before_current_api_band_limit_is_exceeded(self):
        rows = [c['capacity'] for c in self.result['cases']]
        self.assertEqual([c['neutral_valence_electrons'] for c in rows],[416,410,404,416])
        self.assertEqual([c['minimum_unpolarized_occupied_bands'] for c in rows],[208,205,202,208])
        self.assertTrue(all(not c['current_api_accepts_minimum_nbnd'] for c in rows))
        self.assertTrue(all('1-128' in c['api_rejection'] for c in rows))
        self.assertTrue(all(not c['runtime_memory_and_walltime_validated'] for c in rows))

    def test_explicit_o2_candidate_records_placement_without_claiming_bonding(self):
        positions = [[.58,.66,.64],[.58,.66,.70]]
        case = prep.build(self.plan,self.reference,positions)['cases'][-1]
        self.assertEqual(case['counts'],{'Mo':16,'S':31,'O':2})
        self.assertEqual([s['fractional'] for s in case['sites'][-2:]],positions)
        self.assertIn('no chemical-bond claim',case['oxygen_placement'])

    def test_automatic_or_colliding_o2_positions_are_rejected(self):
        p = self.result['cases'][0]['sites'][0]['fractional']
        for positions in ([p,p], [[0,0,.6]], [[0,0,float('nan')],[0,0,.7]],
                          [[True,0,.6],[0,0,.7]], [[0,0,1],[0,0,.7]]):
            with self.subTest(positions=positions), self.assertRaises(ValueError):
                prep.build(self.plan,self.reference,positions)

    def test_wrong_or_nonadjacent_source_sulfur_sites_are_rejected(self):
        for translation,basis in (([2,2,0],2),([0,0,0],2),([3,2,0],1)):
            plan = copy.deepcopy(self.plan)
            plan['vacancy_sites']['secondary']={'translation':translation,'basis_index':basis}
            with self.subTest(translation=translation,basis=basis), self.assertRaises(ValueError):
                prep.build(plan,self.reference)

    def test_oversized_and_non_slab_repeats_are_rejected(self):
        for repeats in ([5,4,1],[4,4,2],[True,4,1],[4,4], [1,4,1]):
            with self.subTest(repeats=repeats), self.assertRaises(ValueError):
                prep.supercell(self.reference,repeats)

    def test_reference_cannot_be_replaced_by_unaccepted_geometry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp);(root/'cases/relax-scf').mkdir(parents=True)
            (root/'summary.json').write_text('{"provenance":{"git_commit":"different"}}')
            (root/'cases/relax-scf/result.json').write_text('{}')
            with patch.object(prep.d3,'verify',return_value={}):
                with self.assertRaisesRegex(ValueError,'reference identity/hash'):
                    prep.load_reference(self.plan,root)
            with patch.object(prep.d3,'verify',side_effect=ValueError('failed D3')):
                with self.assertRaisesRegex(ValueError,'failed D3'):
                    prep.load_reference(self.plan,root)

    def test_new_bundle_contains_all_bytes_hashes_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'prepared'
            prep.write_bundle(path,self.result,self.plan)
            files = json.loads((path/'files-sha256.json').read_text())
            self.assertEqual(len(files),19)
            for name,checksum in files.items():self.assertEqual(prep.digest((path/name).read_bytes()),checksum)
            cif = (path/'V_S/initial.cif').read_text()
            self.assertIn('_cell_length_c 24\n',cif)
            self.assertEqual(sum(s.startswith(('Mo','S')) for s in cif.splitlines()),47)
            with self.assertRaisesRegex(ValueError,'must be new'):
                prep.write_bundle(path,self.result,self.plan)

    def test_offline_verifier_rejects_modified_cif_even_if_its_hash_is_updated(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'bundle';prep.write_bundle(path,self.result,self.plan)
            self.assertEqual(prep.verify_bundle(path,self.plan,self.reference),4)
            cif=path/'V_S/initial.cif';cif.write_text(cif.read_text().replace('_cell_length_c 24','_cell_length_c 25'))
            hashes=path/'files-sha256.json';data=json.loads(hashes.read_text())
            data['V_S/initial.cif']=prep.digest(cif.read_bytes());hashes.write_text(json.dumps(data,indent=2)+'\n')
            with self.assertRaisesRegex(ValueError,'Export file'):
                prep.verify_bundle(path,self.plan,self.reference)

    def test_offline_verifier_rejects_extra_file_and_fake_calculation_claim(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'bundle';prep.write_bundle(path,self.result,self.plan)
            extra=path/'fake-result.json';extra.write_text('{}')
            with self.assertRaisesRegex(ValueError,'Export file'):
                prep.verify_bundle(path,self.plan,self.reference)
            extra.unlink()
            p=path/'preparation.json';m=json.loads(p.read_text());m['calculation_performed']=True
            p.write_text(json.dumps(m))
            with self.assertRaisesRegex(ValueError,'Preparation differs'):
                prep.verify_bundle(path,self.plan,self.reference)


if __name__=='__main__':unittest.main()
