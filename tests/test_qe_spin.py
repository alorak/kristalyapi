"""Synthetic spin/channel regressions; fixtures are not physical results."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server'),str(ROOT/'tools')]
import test_qe_jobs as base
import test_qe_electronic_jobs as electronic_tests
unpolarized=electronic_tests.request
from job_core import canonical_request,make_pw_input,load_profile
from electronic_core import scf_request,checked_band_capacity
from qe_pipeline import run_pipeline,post_input
from qe_spin import validate_spin_input,spin_electronic_result,magnetization
from qe_pdos import parse_atom_orbital_pdos
from electronic_worker import execute_electronic
from worker import _limits,_kill_group


def request():
 p=unpolarized();p['schema']='kristalyapi.qe-electronic-job.v2'
 p['parameters'].update(spin='polarized',starting_magnetization={'Si':.1},degauss_ry=.01)
 p['electronic']['dos']={'delta_e_ev':.01,'degauss_ry':.005,'energy_min_ev':-4,'energy_max_ev':10}
 return p


class SpinTests(unittest.TestCase):
 def setUp(self):
  base.D2Tests.setUp(self)
  electronic_tests.ElectronicJobTests.set_header(self,'Si','4')
  raw=self.upf.read_text().replace('z_valence="4"','z_valence="4" has_so="F"');self.upf.write_text(raw)
  import hashlib
  self.meta['sha256']=hashlib.sha256(self.upf.read_bytes()).hexdigest()
  file=self.profiles/'si-pbe.json';cfg=json.loads(file.read_text());cfg['elements']['Si']=self.meta;file.write_text(json.dumps(cfg))
 def tearDown(self):base.D2Tests.tearDown(self)
 def test_explicit_version_validation_and_unpolarized_structure_identity(self):
  p,h=canonical_request(request());old,oldh=canonical_request(unpolarized());self.assertEqual(h,oldh)
  self.assertEqual(canonical_request(p),(p,h));self.assertEqual(p['parameters']['starting_magnetization'],{'Si':.1})
  edits=[lambda p:p.update(schema='kristalyapi.qe-electronic-job.v1'),lambda p:p['parameters'].update(spin='unpolarized'),
    lambda p:p['parameters'].update(starting_magnetization={'Si':0}),lambda p:p['parameters'].update(starting_magnetization={'Mo':.1}),
    lambda p:p['parameters'].update(starting_magnetization={'Si':True}),lambda p:p['parameters'].update(starting_magnetization={'Si':1.1}),
    lambda p:p['parameters'].update(degauss_ry=float('nan')),lambda p:p['parameters'].update(tot_charge=1),lambda p:p['electronic'].pop('dos')]
  for edit in edits:
   p=request();edit(p)
   with self.assertRaises((ValueError,TypeError)):canonical_request(p)
 def test_spin_input_matches_sorted_species_and_conservative_capacity(self):
  p,h=canonical_request(request());u=load_profile(p,self.profiles,self.pseudo)
  cap=checked_band_capacity(p,u,self.pseudo);self.assertEqual(cap['minimum_nbnd'],8)
  p['electronic']['nbnd']=7
  with self.assertRaisesRegex(ValueError,'at least 8'):checked_band_capacity(p,u,self.pseudo)
  source=make_pw_input(scf_request(request())[0],u);validate_spin_input(source,True)
  self.assertIn('starting_magnetization(1)=0.1',source);self.assertIn("smearing='gaussian'",source)
  with self.assertRaises(ValueError):validate_spin_input(source,False)
  for text in [source.replace('nspin=2','nspin=4'),source.replace("nspin=2,","nspin=2,\n noncolin=.true.,"),source.replace('.01,','.1,'),source.replace('starting_magnetization(1)=0.1','starting_magnetization(1)=0')]:
   with self.assertRaises(ValueError):validate_spin_input(text,True)
  self.assertIn('spin_component=1',post_input('bands_pp_up'));self.assertIn('spin_component=2',post_input('bands_pp_down'))
 def test_interleaved_orbital_channels_are_not_summed_together(self):
  self.root.joinpath('pdos.pdos_atm#1(Si)_wfc#1(p)').write_text('0 6 60 1 10 2 20 3 30\n1 12 120 2 20 4 40 6 60\n')
  for channel,total in [('up',[6,12]),('down',[60,120])]:
   parsed=parse_atom_orbital_pdos(self.root,[0,1],total,['Si'],spin_channel=channel)
   self.assertEqual(parsed['atoms'][0]['orbitals']['p'],total);self.assertEqual(parsed['spin_channel'],channel)
  with self.assertRaises(ValueError):parse_atom_orbital_pdos(self.root,[0,1],[66,132],['Si'])
  with self.assertRaises(ValueError):parse_atom_orbital_pdos(self.root,[0,1],[60,120],['Si'],spin_channel='up')
 def test_magnetization_requires_final_finite_consistent_values(self):
  self.assertEqual(magnetization('total magnetization = -0.1 Bohr mag/cell\nabsolute magnetization = 0.2 Bohr mag/cell')['total_mu_b_per_cell'],-.1)
  for raw in ['','total magnetization = 1 Bohr mag/cell\nabsolute magnetization = 0.2 Bohr mag/cell']:
   with self.assertRaises(ValueError):magnetization(raw)
 def test_api_spin_admission_status_pause_and_rejection_without_queue(self):
  route='/api/v1/calculations'
  self.assertEqual(self.client.post(route,json=request()).status_code,401)
  preflight=self.client.post(route+'/validate',json=request(),headers=self.auth)
  self.assertEqual(preflight.status_code,200,preflight.text)
  response=self.client.post(route,json=request(),headers=self.auth);self.assertEqual(response.status_code,202,response.text)
  jid=response.json()['job_id'];self.store.claim()
  state=self.client.get(route+'/'+jid,headers=self.auth).json()
  self.assertEqual(state['spin'],'polarized');self.assertTrue(state['can_pause'])
  self.assertEqual(self.client.post(route+'/'+jid+'/pause',headers=self.auth).status_code,200)
  bad=request();bad['parameters']['starting_magnetization']={'Si':2}
  self.assertEqual(self.client.post(route,json=bad,headers=self.auth).status_code,422)
  self.assertEqual(len(self.store.list_recent()),1)
  p,h=canonical_request(request());upf=load_profile(p,self.profiles,self.pseudo)
  # Rehashed full-relativistic metadata still cannot enter this scalar workflow.
  import hashlib
  self.upf.write_text(self.upf.read_text().replace('has_so="F"','has_so="T"'))
  upf['Si']['sha256']=hashlib.sha256(self.upf.read_bytes()).hexdigest()
  with self.assertRaisesRegex(ValueError,'has_so=false'):checked_band_capacity(p,upf,self.pseudo)
 def test_archived_real_spin_reverifies_without_qe_or_docker(self):
  from qe_spin_acceptance import verify
  proof=verify(ROOT/'validation-results/qe-spin-si-20261030-arm64')
  self.assertEqual(proof['status'],'passed');self.assertFalse(proof['calculations_executed_by_verifier'])
 def test_raw_spin_path_nodes_are_recomputed_and_legacy_receipts_stay_unchanged(self):
  from qe_spin_acceptance import reparse_spin_bands
  from qe_pipeline import checked_k_path_nodes,load_band_path
  folder=ROOT/'validation-results/qe-spin-si-20261030-arm64';raw=folder/'pipeline'
  electronic=json.loads((raw/'electronic-results.json').read_text());source=(folder/'source.in').read_text()
  path=load_band_path(folder/'band-path.txt')
  bands=reparse_spin_bands(raw,source,path,electronic)
  self.assertNotIn('k_path_nodes',bands['up'])
  for channel in ('up','down'):
   electronic['channels'][channel]['bands']['k_path_nodes']=checked_k_path_nodes(source,path,bands[channel]['distance'])
  parsed=reparse_spin_bands(raw,source,path,electronic)
  self.assertEqual(parsed['up']['k_path_nodes'],electronic['channels']['up']['bands']['k_path_nodes'])
  electronic['channels']['down']['bands']['k_path_nodes'][0]['label']='Forged'
  with self.assertRaisesRegex(ValueError,'path nodes differ'):reparse_spin_bands(raw,source,path,electronic)
 def test_latest_main_real_spin_with_path_metadata_reverifies(self):
  from qe_spin_acceptance import verify
  proof=verify(ROOT/'validation-results/qe-spin-si-20261030-main-7f38e9e')
  self.assertEqual(proof['source_commit'],'7f38e9e31c018a431863e594301ca6eeec61ee3a')
  self.assertEqual(proof['status'],'passed');self.assertEqual(proof['stages'],7)
 def binary(self):
  p=self.root/'fake-spin'
  p.write_text('''#!/usr/bin/env python3
from pathlib import Path
import sys
step=Path(sys.argv[-1]).stem
Path('tmp/kristalyapi.save').mkdir(parents=True,exist_ok=True)
if step=='scf':print('Program PWSCF v.6.7MaX\\nconvergence has been achieved in 3 iterations\\n! total energy = -8 Ry\\nestimated scf accuracy < 1e-9 Ry\\nTotal force = 0\\ntotal magnetization = 0.1 Bohr mag/cell\\nabsolute magnetization = 0.2 Bohr mag/cell')
if step.startswith('bands_pp_'):Path('bands_'+step[9:]+'.dat.gnu').write_text('\\n\\n'.join(f'0 {i}\\n1 {i+.1}' for i in range(8))+'\\n')
if step=='dos':Path('dos.dat').write_text('0 1 2 .03\\n1 2 4 .09\\n')
if step=='projwfc':
 Path('pdos.pdos_tot').write_text('0 1 2 .8 1.6\\n1 2 4 1.6 3.2\\n')
 for i in (1,2):Path(f'pdos.pdos_atm#{i}(Si)_wfc#1(s)').write_text('0 .4 .8 .4 .8\\n1 .8 1.6 .8 1.6\\n')
print('JOB DONE.')
''');p.chmod(0o700);return str(p)
 def test_worker_two_bands_postprocessors_and_both_result_channels(self):
  p,h=canonical_request(request());jid=self.store.submit(p,h);job=self.store.claim();exe=self.binary()
  execute_electronic(self.store,job,qe_binary=exe,bands_x=exe,dos_x=exe,projwfc_x=exe,profiles_dir=self.profiles,pseudo_dir=self.pseudo,timeout=15,limits=_limits,kill=_kill_group)
  row=self.store.get(jid);self.assertEqual(row['status'],'completed',row['error'])
  result=json.loads(row['result_json']);e=result['electronic']
  self.assertEqual(result['schema'],'kristalyapi.qe-electronic-job-result.v2');self.assertEqual(len(result['pipeline_steps']),7)
  self.assertEqual(e['channels']['up']['dos']['dos_states_per_ev'],[1,2]);self.assertEqual(e['channels']['down']['dos']['dos_states_per_ev'],[2,4])
  self.assertEqual(e['integrated_dos_total']['states'],[.03,.09]);self.assertNotIn('integrated_states',e['channels']['up']['dos'])
  folder=self.store.root/'runs'/jid/'pipeline';self.assertIn('nbnd = 8',(folder/'scf.in').read_text())
  # Missing/wrong-channel raw evidence fails closed on independent reparse.
  (folder/'pdos.pdos_tot').write_text('0 1 2 1.6 .8\n1 2 4 3.2 1.6\n')
  with self.assertRaises(ValueError):spin_electronic_result(folder,e,{c:e['channels'][c]['bands'] for c in ('up','down')},(folder/'scf.in').read_text(),(folder/'scf.out').read_text())
