"""D4 raw/API evidence regression fixtures are SYNTHETIC, not DFT results."""
from pathlib import Path
import copy
import json
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'tools'),str(ROOT/'server')]
import test_qe_relax_acceptance as fixtures
import qe_electronic_acceptance as d4
from job_core import make_pw_input
from qe_pipeline import bands_input,nscf_input,post_input,parse_bands_gnu,parse_dos,parse_pdos_total
from qe_pdos import parse_atom_orbital_pdos,parse_atom_symbols


class ElectronicAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.RelaxAcceptanceTests();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        f=self.fixture;self.root=f.root;self.plan=d4.load_plan()
        self.old=f.request;self.ref={'final_structure':f.final,'energy_ry':-10.01,'job_id':'1'*32}
        self.request=d4.make_request(self.plan,self.old,self.ref)
        self.path=self.root/'cases/electronic';self.path.mkdir();self.folder=self.path/'pipeline';self.folder.mkdir()
        source_request=copy.deepcopy(self.request);source_request['parameters']['calculation']='scf'
        source=make_pw_input(source_request,f.upf)
        (self.path/'source.in').write_text(source)
        points=[(x['label'],x['k'],x['segments']) for x in self.plan['electronic']['band_path']]
        for name in d4.STEPS:
            text=source if name=='scf' else bands_input(source,points,26) if name=='bands' else nscf_input(source,26,16) if name=='nscf' else post_input(name)
            (self.folder/(name+'.in')).write_text(text)
            (self.folder/(name+'.out')).write_text(f.output(-10.01))
        (self.folder/'bands.dat.gnu').write_text('\n\n'.join('\n'.join(f'{i*.01:.6f} {j+i*.001:.6f}' for i in range(61)) for j in range(26))+'\n')
        (self.folder/'dos.dat').write_text('-.02 .1 0\n0 .5 26\n.02 .2 52\n')
        (self.folder/'pdos.pdos_tot').write_text('-.02 .1 .08\n0 .5 .30\n.02 .2 .12\n')
        for index,element,orbital,ldos in [(1,'Mo','d',[.04,.15,.06]),(2,'S','p',[.02,.08,.03]),(3,'S','p',[.02,.07,.03])]:
            zeros=' 0 0 0 0' if orbital=='d' else ' 0 0'
            text='\n'.join(f'{e} {v} {v}'+zeros for e,v in zip([-.02,0,.02],ldos))+'\n'
            (self.folder/f'pdos.pdos_atm#{index}({element})_wfc#1({orbital})').write_text(text)
        bands=parse_bands_gnu(self.folder/'bands.dat.gnu');dos=parse_dos(self.folder/'dos.dat');pdos=parse_pdos_total(self.folder/'pdos.pdos_tot',dos)
        atoms=parse_atom_orbital_pdos(self.folder,dos['energy_ev'],pdos['sum_projected_states_per_ev'],parse_atom_symbols(source))
        electronic={'schema':'kristalyapi.qe-electronic.v1','bands':bands,'dos':dos,'pdos_total':pdos,'pdos_atoms':atoms,
            'band_path_labels':[p[0] for p in points]}
        (self.folder/'electronic-results.json').write_text(json.dumps(electronic))
        result=f.result(self.request,'3'*32,-10.01)
        result.update(schema='kristalyapi.qe-electronic-job-result.v1',electronic=electronic,
            input_sha256=d4.sha((self.path/'source.in').read_bytes()),output_sha256=d4.sha((self.folder/'scf.out').read_bytes()),
            pipeline_steps={name:{'status':'completed','input_sha256':d4.sha((self.folder/(name+'.in')).read_bytes()),
                'stdout_sha256':d4.sha((self.folder/(name+'.out')).read_bytes())} for name in d4.STEPS},
            artifact_sha256={p.name:d4.sha(p.read_bytes()) for p in self.folder.iterdir()})
        f.save(self.path,self.request,result)

    def derive(self):return d4.derive(self.root,self.plan,self.old,self.ref)

    def test_all_raw_band_dos_pdos_data_match_the_fixed_plan_and_api(self):
        result=self.derive();self.assertTrue(all(x['passed'] for x in result['gates']))
        self.assertEqual(result['band_count'],26);self.assertEqual(result['kpath_points'],61)
        self.assertEqual(result['pdos_atoms'],3)

    def test_wrong_reference_or_incomplete_stage_is_rejected(self):
        path=self.path/'result.json';r=json.loads(path.read_text());r['pipeline_steps']['projwfc']['status']='failed';path.write_text(json.dumps(r))
        with self.assertRaisesRegex(ValueError,'Incomplete raw solver'):self.derive()
        with patch.object(d4,'reference',side_effect=ValueError('D3 not passed')),patch.object(d4,'Runtime') as runtime:
            with self.assertRaisesRegex(ValueError,'D3 not passed'):d4.run(self.root/'not-started')
            runtime.assert_not_called()

    def test_spectra_or_stage_input_tampering_is_rejected(self):
        p=self.folder/'bands.in';p.write_text(p.read_text().replace('0.5000000000','0.4000000000'))
        with self.assertRaisesRegex(ValueError,'hash mismatch'):self.derive()


if __name__=='__main__':unittest.main()
