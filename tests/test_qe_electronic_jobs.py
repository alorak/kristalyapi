"""D4 fake-process API tests. These fixtures are not real electronic results."""
from pathlib import Path
import sys
import json
import hashlib
import threading
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server'),str(ROOT/'tools')]
import test_qe_jobs as fixtures
from job_core import canonical_request
from electronic_core import path_text,checked_band_capacity
from electronic_worker import execute_electronic
from worker import _limits,_kill_group


def request():
    p=fixtures.payload();p['schema']='kristalyapi.qe-electronic-job.v1'
    p['parameters']['calculation']='electronic';p['parameters']['kpoints']=[2,2,1]
    p['electronic']={'nbnd':8,'nscf_k':2,'band_path':[
        {'label':'Gamma','k':[0,0,0],'segments':3},{'label':'X','k':[.5,0,0],'segments':1}]}
    return p


class ElectronicJobTests(unittest.TestCase):
    def setUp(self):
        fixtures.D2Tests.setUp(self)
        self.set_header('Si','4')

    def set_header(self,element,valence,header=True):
        raw=(f'<UPF version="2.0.1"><PP_HEADER element="{element}" z_valence="{valence}"/>'
             '<!-- SYNTHETIC, not a real pseudopotential -->' if header else
             '<UPF version="2.0.1">synthetic missing header').encode()
        self.upf.write_bytes(raw);self.meta['sha256']=hashlib.sha256(raw).hexdigest()
        profile=self.profiles/'si-pbe.json';data=json.loads(profile.read_text())
        data['elements']['Si']=self.meta;profile.write_text(json.dumps(data))

    def binary(self,fail='',sleep=''):
        path=self.root/'fake-electronic'
        source='''#!/usr/bin/env python3
from pathlib import Path
import sys,time
step=Path(sys.argv[-1]).stem
if step==FAIL:print('Error in routine');sys.exit(1)
if step==SLEEP:time.sleep(10)
Path('tmp/kristalyapi.save').mkdir(parents=True,exist_ok=True)
if step=='scf':
 print('Program PWSCF v.6.7MaX\\nconvergence has been achieved in 3 iterations\\n! total energy = -8 Ry\\nestimated scf accuracy < 1e-9 Ry\\nTotal force = 0\\nJOB DONE.')
elif step in ('bands','nscf'):print('Program PWSCF v.6.7MaX\\nJOB DONE.')
else:print('Postprocessing success')
if step=='bands_pp':Path('bands.dat.gnu').write_text('0 -2\\n1 -1\\n\\n0 1\\n1 2\\n')
if step=='dos':Path('dos.dat').write_text('# E DOS Int\\n-1 .1 .1\\n0 .5 .5\\n1 .2 .8\\n')
if step=='projwfc':
 Path('pdos.pdos_tot').write_text('# E DOS PDOS\\n-1 .1 .08\\n0 .5 .3\\n1 .2 .12\\n')
 for index in (1,2):Path(f'pdos.pdos_atm#{index}(Si)_wfc#1(p)').write_text('# E LDOS p1 p2 p3\\n-1 .04 .04 0 0\\n0 .15 .15 0 0\\n1 .06 .06 0 0\\n')
'''.replace('FAIL',repr(fail)).replace('SLEEP',repr(sleep))
        path.write_text(source);path.chmod(0o700);return path

    def execute(self,*,fail='',sleep='',timeout=10):
        p,h=canonical_request(request());jid=self.store.submit(p,h);job=self.store.claim()
        binary=str(self.binary(fail,sleep))
        execute_electronic(self.store,job,qe_binary=binary,bands_x=binary,dos_x=binary,projwfc_x=binary,
            profiles_dir=self.profiles,pseudo_dir=self.pseudo,timeout=timeout,limits=_limits,kill=_kill_group)
        return jid,self.store.get(jid)

    def test_only_explicit_bounded_2d_paths_are_accepted(self):
        p,h=canonical_request(request());self.assertIn('Gamma 0 0 0 3',path_text(p))
        self.assertEqual(len(h),64)
        for edit in [lambda p:p['electronic'].update(nbnd=True),lambda p:p['electronic'].update(nbnd=129),
                     lambda p:p['electronic'].update(nscf_k=25),lambda p:p['parameters'].update(kpoints=[2,2,2]),
                     lambda p:p['electronic']['band_path'][0].update(label='../file'),
                     lambda p:p['electronic']['band_path'][0].update(k=[0,0,.5]),
                     lambda p:p['electronic']['band_path'][-1].update(segments=2),
                     lambda p:p['electronic'].update(executable='arbitrary')]:
            bad=request();edit(bad)
            with self.assertRaises(ValueError):canonical_request(bad)

    def test_real_child_pipeline_process_returns_all_parsed_curves_and_provenance(self):
        jid,row=self.execute()
        self.assertEqual(row['status'],'completed',row['error'])
        result=self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).json()
        self.assertEqual(result['schema'],'kristalyapi.qe-electronic-job-result.v1')
        self.assertEqual(set(result['pipeline_steps']),{'scf','bands','bands_pp','nscf','dos','projwfc'})
        self.assertEqual(len(result['electronic']['pdos_atoms']['atoms']),2)
        self.assertTrue(any(name.startswith('pdos.pdos_atm#') for name in result['artifact_sha256']))
        self.assertEqual(len(result['electronic']['bands']['energies_ev']),2)
        self.assertIn('Postprocessing',self.client.get('/api/v1/calculations/'+jid+'/logs',headers=self.auth).json()['text'])

    def test_failed_bands_blocks_nscf_and_result_publication(self):
        jid,row=self.execute(fail='bands')
        self.assertEqual(row['status'],'failed')
        self.assertIn('bands failed',row['error'])
        self.assertIsNone(row['result_json'])
        self.assertFalse((self.jobs/'runs'/jid/'pipeline/nscf.in').exists())
        self.assertEqual(self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).status_code,409)

    def test_timeout_kills_the_pipeline_before_dos(self):
        jid,row=self.execute(sleep='nscf',timeout=.7)
        self.assertEqual(row['status'],'timed_out',row['error'])
        self.assertIsNone(row['result_json'])
        self.assertFalse((self.jobs/'runs'/jid/'pipeline/dos.in').exists())

    def test_api_preflight_validates_electronic_without_running_jobs(self):
        r=self.client.post('/api/v1/calculations/validate',json=request(),headers=self.auth)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['calculation'],'electronic')
        self.assertEqual(r.json()['electronic_preflight']['neutral_valence_electrons'],8)
        self.assertEqual(r.json()['electronic_preflight']['minimum_nbnd'],4)
        self.assertIn('electronic',self.client.get('/api/capabilities').json()['supported_operations'])
        self.assertFalse((self.jobs/'runs').exists())

    def test_insufficient_bands_fail_both_http_paths_before_queue_or_execution(self):
        p=request();p['electronic']['nbnd']=3
        for endpoint in ('/validate',''):
            result=self.client.post('/api/v1/calculations'+endpoint,json=p,headers=self.auth)
            self.assertEqual(result.status_code,422,result.text)
            self.assertIn('at least 4 bands',result.text)
        self.assertIsNone(self.store.claim())
        self.assertFalse((self.jobs/'runs').exists())

    def test_worker_rechecks_capacity_for_a_previously_queued_request(self):
        p=request();p['electronic']['nbnd']=3;p,h=canonical_request(p)
        jid=self.store.submit(p,h);job=self.store.claim()
        execute_electronic(self.store,job,qe_binary='must-not-run',profiles_dir=self.profiles,
            pseudo_dir=self.pseudo,timeout=10,limits=_limits,kill=_kill_group)
        result=self.store.get(jid)
        self.assertEqual(result['status'],'failed');self.assertIn('at least 4 bands',result['error'])
        self.assertFalse((self.jobs/'runs').exists())

    def test_missing_mismatched_or_nonfinite_header_is_not_an_accepted_electron_count(self):
        for element,valence,header in [('O','4',True),('Si','nan',True),('Si','inf',True),
                                      ('Si','-1',True),('Si','4',False)]:
            self.set_header(element,valence,header)
            result=self.client.post('/api/v1/calculations/validate',json=request(),headers=self.auth)
            self.assertEqual(result.status_code,422,result.text)

    def test_valence_is_taken_from_pinned_bytes_and_mutation_is_rejected(self):
        self.set_header('Si','6')
        result=self.client.post('/api/v1/calculations/validate',json=request(),headers=self.auth)
        self.assertEqual(result.json()['electronic_preflight']['minimum_nbnd'],6)
        p,h=canonical_request(request())
        meta={'Si':self.meta.copy()}
        self.upf.write_bytes(self.upf.read_bytes().replace(b'z_valence="6"',b'z_valence="4"'))
        with self.assertRaisesRegex(ValueError,'UPF changed'):
            checked_band_capacity(p,meta,self.pseudo)

    def test_cancelled_child_pipeline_does_not_publish_or_continue(self):
        p,h=canonical_request(request());jid=self.store.submit(p,h);job=self.store.claim()
        binary=str(self.binary(sleep='bands'))
        thread=threading.Thread(target=execute_electronic,args=(self.store,job),kwargs={
            'qe_binary':binary,'bands_x':binary,'dos_x':binary,'projwfc_x':binary,
            'profiles_dir':self.profiles,'pseudo_dir':self.pseudo,'timeout':30,'limits':_limits,'kill':_kill_group})
        thread.start()
        try:
            deadline=time.monotonic()+4
            while not (self.jobs/'runs'/jid/'pipeline/bands.in').exists() and time.monotonic()<deadline:
                time.sleep(.02)
            self.store.cancel(jid)
        finally:thread.join(timeout=5)
        self.assertFalse(thread.is_alive())
        self.assertEqual(self.store.get(jid)['status'],'cancelled')
        self.assertIsNone(self.store.get(jid)['result_json'])
        self.assertFalse((self.jobs/'runs'/jid/'pipeline/nscf.in').exists())


if __name__=='__main__':unittest.main()
