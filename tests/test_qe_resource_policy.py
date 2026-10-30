"""Resource admission and portable preparation; synthetic requests, never real DFT."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server'),str(ROOT/'tools')]
import resource_policy as policy
import job_diagnostics as diag
import test_qe_jobs as base
import test_qe_electronic_jobs as electronic
from fastapi.testclient import TestClient
from api import create_app
from job_core import canonical_request
from qe_pipeline import parse_bands_gnu
import qe_hpc_prepare as hpc
import qe_hpc_init as init

PROFILE=json.loads((ROOT/'tests/fixtures/qe/hpc-resource-profile.json').read_text())

class ResourcePolicyTests(unittest.TestCase):
    def test_default_caps_and_context_restore(self):
        self.assertEqual((policy.current()['max_atoms'],policy.current()['max_bands']),(64,128))
        with policy.scope(PROFILE):self.assertEqual(policy.current()['max_bands'],512)
        self.assertEqual(policy.current(),policy.DEFAULT)
        for key,value in [('max_atoms',True),('max_bands',2049),('threads',65),('execution_enabled',1),('memory_required_bytes',0)]:
            p={**PROFILE,key:value}
            with self.assertRaises(ValueError):policy.parse_profile(p)
        with self.assertRaises(ValueError):policy.parse_profile({**PROFILE,'arbitrary_path':'/etc/passwd'})

    def test_large_requests_require_explicit_bounded_outputs(self):
        raw=electronic.request();raw['electronic']['nbnd']=416
        with self.assertRaises(ValueError):canonical_request(raw)
        with policy.scope(PROFILE):
            with self.assertRaisesRegex(ValueError,'explicit DOS'):canonical_request(raw)
            raw['electronic']['dos']={'delta_e_ev':.01,'degauss_ry':.01,'energy_min_ev':-8,'energy_max_ev':6}
            raw['electronic']['band_window']=[101,400]
            result,_=canonical_request(raw);self.assertEqual(result['electronic']['band_window'],[101,400])
            raw['electronic']['band_window']=[1,301]
            with self.assertRaisesRegex(ValueError,'1-300'):canonical_request(raw)

    def test_profile_change_and_disabled_execution_fail_before_compute(self):
        with patch('resource_policy.load_operator_profile',return_value=PROFILE):
            for pin in [None,'','not-a-sha',policy.digest(policy.DEFAULT)]:
                with self.assertRaisesRegex(ValueError,'changed'):policy.for_job({'resource_profile_sha256':pin})
            with self.assertRaisesRegex(ValueError,'preparation-only'):policy.for_job({'resource_profile_sha256':policy.digest(PROFILE)})

    def test_operator_profile_symlinks_and_oversize_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);real=root/'profile.json';real.write_text(json.dumps(PROFILE));link=root/'link.json';link.symlink_to(real)
            with patch.dict(os.environ,{'QE_RESOURCE_PROFILE_FILE':str(link)}):
                with self.assertRaises(ValueError):policy.load_operator_profile()
            real.write_text(' '*16385)
            with patch.dict(os.environ,{'QE_RESOURCE_PROFILE_FILE':str(real)}):
                with self.assertRaises(ValueError):policy.load_operator_profile()

    def test_physical_memory_disk_and_inherited_cpu_quota_are_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);child=root/'step';child.mkdir();(child/'cpu.max').write_text('max 100000');(root/'cpu.max').write_text('400000 100000')
            p={**PROFILE,'execution_enabled':True,'memory_required_bytes':8*1024**3,'scratch_required_bytes':1024**3}
            with patch.object(diag,'CGROUP',root),patch.object(diag,'cgroup_path',return_value=child),patch.object(diag,'read_cgroup',return_value={'memory_limit':16*1024**3}),patch('resource_policy.os.sysconf',side_effect=lambda name:4096 if name=='SC_PAGE_SIZE' else 32*1024**3//4096),patch('resource_policy.os.cpu_count',return_value=16),patch('resource_policy.os.sched_getaffinity',return_value=set(range(16)),create=True),patch('resource_policy.shutil.disk_usage',return_value=SimpleNamespace(free=10*1024**3)):
                with self.assertRaisesRegex(ValueError,'CPU quota'):policy.physical_admission(p,root)
                (root/'cpu.max').write_text('800000 100000');policy.physical_admission(p,root)
                (root/'memory.max').write_text(str(4*1024**3))
                with self.assertRaisesRegex(ValueError,'memory minimum'):policy.physical_admission(p,root)
                (root/'memory.max').unlink()
                with patch('resource_policy.shutil.disk_usage',return_value=SimpleNamespace(free=0)):
                    with self.assertRaisesRegex(ValueError,'scratch'):policy.physical_admission(p,root)

    def test_preparation_only_api_validates_large_capacity_but_never_enqueues(self):
        f=electronic.ElectronicJobTests();f.setUp();self.addCleanup(f.doCleanups)
        content=b'<UPF version="2.0.1"><PP_HEADER element="Si" z_valence="4" number_of_wfc="2"/></UPF>'
        f.upf.write_bytes(content);f.meta['sha256']=hashlib.sha256(content).hexdigest()
        path=f.profiles/'si-pbe.json';metadata=json.loads(path.read_text());metadata['elements']['Si']=f.meta;path.write_text(json.dumps(metadata))
        profile=f.root/'resources.json';profile.write_text(json.dumps(PROFILE))
        raw=electronic.request();raw['electronic'].update(nbnd=416,band_window=[1,300],dos={'delta_e_ev':.01,'degauss_ry':.01,'energy_min_ev':-8,'energy_max_ev':6})
        with patch.dict(os.environ,{'QE_RESOURCE_PROFILE_FILE':str(profile)}):
            app=create_app(probe=base.READY,allowed_origins=['https://alorak.github.io'],allowed_hosts=['localhost'],jobs_enabled=True,api_token=base.TOKEN,job_root=f.jobs,profiles_dir=f.profiles,pseudo_dir=f.pseudo)
            client=TestClient(app,base_url='http://localhost')
            caps=client.get('/api/capabilities').json();self.assertFalse(caps['job_submission_enabled']);self.assertEqual(caps['resource_profile']['max_bands'],512)
            response=client.post('/api/v1/calculations/validate',json=raw,headers=f.auth)
            self.assertEqual(response.status_code,200,response.text);self.assertIn('view_preflight',response.json()['electronic_preflight'])
            response=client.post('/api/v1/calculations',json=raw,headers=f.auth);self.assertEqual(response.status_code,409,response.text)
            self.assertIsNone(f.store.claim());self.assertFalse((f.jobs/'runs').exists())

    def test_worker_rejects_profile_drift_without_invoking_the_solver(self):
        f=base.D2Tests();f.setUp();self.addCleanup(f.doCleanups)
        raw,h=canonical_request(base.payload());jid=f.store.submit(raw,h,resource_profile_sha=policy.digest(policy.DEFAULT));job=f.store.claim()
        called=[]
        @diag.record_job
        def should_not_run(store,row):called.append(row['id'])
        with patch('resource_policy.load_operator_profile',return_value=PROFILE):should_not_run(f.store,job)
        self.assertEqual(called,[]);self.assertEqual(f.store.get(jid)['status'],'failed')
        self.assertEqual(diag.read_diagnostics(f.store,f.store.get(jid))['reason_code'],'resource_policy_rejected')
        self.assertFalse((f.jobs/'runs').exists())

    def test_large_pdos_wavefunction_budget_rejects_before_running_anything(self):
        f=electronic.ElectronicJobTests();f.setUp();self.addCleanup(f.doCleanups)
        content=b'<UPF><PP_HEADER element="Si" z_valence="4" number_of_wfc="20"/></UPF>'
        f.upf.write_bytes(content);f.meta['sha256']=hashlib.sha256(content).hexdigest()
        raw=electronic.request();raw['structure']['atoms']=[{'element':'Si','fractional':[i/6,0,0]} for i in range(6)]
        raw['electronic'].update(nbnd=416,band_window=[1,300],dos={'delta_e_ev':.005,'degauss_ry':.01,'energy_min_ev':-25,'energy_max_ev':25})
        with policy.scope(PROFILE):
            request,_=canonical_request(raw)
            with self.assertRaisesRegex(ValueError,'atomic-wavefunction sample budget'):
                electronic.checked_band_capacity(request,{'Si':f.meta},f.pseudo)
        self.assertFalse((f.jobs/'runs').exists())

    def test_band_window_retains_original_indices_and_raw_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bands.gnu';raw=''.join(f'0 {i}\n1 {i+0.1}\n\n' for i in range(416));path.write_text(raw)
            result=parse_bands_gnu(path,band_window=(101,400))
            self.assertEqual(result['band_index_start'],101);self.assertEqual(result['total_bands'],416)
            self.assertEqual(result['energies_ev'][0],[100,100.1]);self.assertEqual(len(result['energies_ev']),300);self.assertEqual(path.read_text(),raw)

class HpcPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary=tempfile.TemporaryDirectory();cls.addClassCleanup(cls.temporary.cleanup)
        cls.root=Path(cls.temporary.name);cls.original=cls.root/'original'
        hpc.make_bundle(ROOT/'validation-results/qe-mos2-d5-preparation-20261029',PROFILE,cls.original)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.bundle=Path(self.temp.name)/'bundle';shutil.copytree(self.original,self.bundle)
    def test_portable_inspection_and_slurm_script_never_submit(self):
        manifest,profile=init.verify_bundle(self.bundle);self.assertFalse(profile['execution_enabled']);self.assertFalse(manifest['calculation_performed'])
        for case in manifest['cases']:
            script=self.bundle/'cases'/case/'init.slurm';text=script.read_text();self.assertIn('SLURM_SUBMIT_DIR',text);self.assertNotIn('BASH_SOURCE',text);self.assertIn('#SBATCH --time=10',text)
            subprocess.run(['bash','-n',str(script)],check=True,capture_output=True)
        with patch.object(init.subprocess,'Popen') as process:
            result=init.run(self.bundle,manifest['cases'][0],self.bundle/'pseudo',execute=False);self.assertFalse(result['calculation_performed']);process.assert_not_called()
        result=subprocess.run([sys.executable,str(self.bundle/'tools/qe_hpc_init.py'),'--bundle',str(self.bundle),'--inspect'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_package_changes_symlinks_and_dirty_source_block_execution(self):
        manifest,_=init.verify_bundle(self.bundle);path=self.bundle/'cases'/manifest['cases'][0]/'init.in';path.write_text(path.read_text()+'\n! changed\n')
        with self.assertRaisesRegex(ValueError,'hash mismatch'):init.verify_bundle(self.bundle)
        path.unlink();path.symlink_to(self.original/'cases'/manifest['cases'][0]/'init.in')
        with self.assertRaisesRegex(ValueError,'symlink'):init.verify_bundle(self.bundle)
    def test_dirty_export_cannot_execute_even_in_a_claimed_allocation(self):
        path=self.bundle/'package.json';manifest=json.loads(path.read_text());manifest['source_dirty']=True;path.write_text(json.dumps(manifest))
        with patch.object(init.platform,'system',return_value='Linux'),patch.dict(os.environ,{'SLURM_JOB_ID':'synthetic-not-a-real-allocation'}),patch.object(init.subprocess,'Popen') as process:
            with self.assertRaisesRegex(ValueError,'committed sources'):init.run(self.bundle,manifest['cases'][0],self.bundle/'pseudo',execute=True)
            process.assert_not_called()

if __name__=='__main__':unittest.main()
