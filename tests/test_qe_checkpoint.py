"""Synthetic stage-boundary pause, safe resume and API state regression tests."""
import json
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'tools'),str(ROOT/'server')]
import qe_pipeline as pipeline
import qe_checkpoint as checkpoint
import test_qe_pipeline as fixtures
import test_qe_electronic_jobs as electronic
from job_core import canonical_request
from electronic_worker import execute_electronic
from worker import _limits,_kill_group


class StageCheckpointTests(unittest.TestCase):
    def prepare(self):
        f=fixtures.PipelineTest();f.setUp();self.addCleanup(f.doCleanups)
        f.executable=f.root/'fake-qe';f.executable.write_text('SYNTHETIC binary identity')
        f.pause=f.root/'pause.request';f.output=f.root/'paused';f.calls=[]
        original=f.mocked_process(f.calls)
        def process(*args,**kwargs):
            result=original(*args,**kwargs)
            (kwargs['cwd']/'tmp/kristalyapi.save/wfc.dat').write_text('SYNTHETIC scratch')
            if Path(args[0][-1]).stem=='scf':f.pause.write_text('pause')
            return result
        with patch.object(pipeline.shutil,'which',return_value=str(f.executable)),patch.object(pipeline.subprocess,'run',side_effect=process):
            f.result=pipeline.run_pipeline(f.infile,f.pseudos,f.output,execute=True,band_path=f.kpath,nbnd=25,pdos=True,pause_file=f.pause)
        return f

    def resume(self,f):
        f.pause.unlink()
        with patch.object(pipeline.shutil,'which',return_value=str(f.executable)),patch.object(pipeline.subprocess,'run',side_effect=f.mocked_process(f.calls)):
            return pipeline.run_pipeline(f.infile,f.pseudos,f.output,execute=True,band_path=f.kpath,nbnd=25,pdos=True,
                pause_file=f.pause,resume=True,expected_checkpoint_sha=checkpoint.digest(f.output/'checkpoint.json'))

    def test_completed_stage_reused_without_reexecuting_scf_or_publishing_partial_results(self):
        f=self.prepare();self.assertEqual(f.result['status'],'paused');self.assertEqual(f.calls,['relax','scf'])
        self.assertFalse((f.output/'electronic-results.json').exists())
        before=checkpoint.digest(f.output/'scf.out');result=self.resume(f)
        self.assertEqual(result['status'],'completed',result.get('error'));self.assertEqual(result['resume_count'],1)
        self.assertEqual(f.calls,['relax','scf','bands','bands_pp','nscf','dos','projwfc'])
        self.assertEqual(before,checkpoint.digest(f.output/'scf.out'))

    def test_corrupt_scratch_source_upf_or_solver_cannot_resume(self):
        for target in ('scratch','source','upf','binary'):
            f=self.prepare()
            path={'scratch':f.output/'tmp/kristalyapi.save/wfc.dat','source':f.infile,'upf':f.pseudos/'Mo.UPF','binary':f.executable}[target]
            path.write_text(path.read_text()+('\n! changed\n' if target=='source' else '\nchanged'))
            with self.subTest(target=target),self.assertRaisesRegex(ValueError,'changed'):self.resume(f)
            self.assertFalse((f.output/'electronic-results.json').exists())

    def test_stored_checkpoint_digest_and_symlink_rejection(self):
        f=self.prepare();data=json.loads((f.output/'checkpoint.json').read_text())
        with self.assertRaisesRegex(ValueError,'SHA-256 changed'):checkpoint.load(f.output,data['contract'],'a'*64)
        (f.output/'escape').symlink_to(f.infile)
        with self.assertRaisesRegex(ValueError,'symlink'):checkpoint.load(f.output,data['contract'])


class PauseApiTests(unittest.TestCase):
    def setUp(self):
        self.f=electronic.ElectronicJobTests();self.f.setUp();self.addCleanup(self.f.doCleanups)
        self.binary=self.f.binary(sleep='scf');self.binary.write_text(self.binary.read_text().replace('time.sleep(10)','time.sleep(.6)'))

    def execute(self):
        f=self.f;task=f.store.claim()
        execute_electronic(f.store,task,qe_binary=str(self.binary),bands_x=str(self.binary),dos_x=str(self.binary),projwfc_x=str(self.binary),
            profiles_dir=f.profiles,pseudo_dir=f.pseudo,timeout=15,limits=_limits,kill=_kill_group)

    def paused_job(self):
        f=self.f;p,h=canonical_request(electronic.request());jid=f.store.submit(p,h)
        thread=threading.Thread(target=self.execute);thread.start()
        try:
            limit=time.monotonic()+5
            while not (f.jobs/'runs'/jid/'pipeline/scf.in').exists():
                self.assertLess(time.monotonic(),limit);time.sleep(.01)
            url='/api/v1/calculations/'+jid+'/pause'
            self.assertEqual(f.client.post(url).status_code,401)
            r=f.client.post(url,headers=f.auth);self.assertEqual(r.status_code,200,r.text)
        finally:thread.join(timeout=6)
        self.assertFalse(thread.is_alive());self.assertEqual(f.store.get(jid)['status'],'paused',f.store.get(jid)['error'])
        self.assertEqual(f.client.get('/api/v1/calculations/'+jid+'/results',headers=f.auth).status_code,409)
        return jid

    def test_pause_resume_keeps_job_identity_and_all_completed_raw_stage_hashes(self):
        f=self.f;jid=self.paused_job();path=f.jobs/'runs'/jid/'pipeline/scf.out';before=checkpoint.digest(path)
        endpoint='/api/v1/calculations/'+jid+'/resume'
        self.assertEqual(f.client.post(endpoint,headers=f.auth).status_code,200)
        self.assertEqual(f.client.post(endpoint,headers=f.auth).status_code,409)
        self.execute();row=f.store.get(jid);self.assertEqual(row['status'],'completed',row['error'])
        self.assertEqual(checkpoint.digest(path),before)
        self.assertEqual(f.client.get('/api/v1/calculations/'+jid+'/results',headers=f.auth).json()['job_id'],jid)

    def test_scratch_tampering_fails_after_queue_without_publishing_a_result(self):
        f=self.f;jid=self.paused_job();path=f.jobs/'runs'/jid/'pipeline/scf.out';path.write_text('tampered')
        self.assertEqual(f.client.post('/api/v1/calculations/'+jid+'/resume',headers=f.auth).status_code,200)
        self.execute();self.assertEqual(f.store.get(jid)['status'],'failed')
        self.assertIn('changed',f.store.get(jid)['error'])
        self.assertEqual(f.client.get('/api/v1/calculations/'+jid+'/results',headers=f.auth).status_code,409)

    def test_cancel_request_wins_race_with_pause_commit(self):
        f=self.f;p,h=canonical_request(electronic.request());jid=f.store.submit(p,h);f.store.claim()
        f.store.cancel(jid);f.store.set_result(jid,'paused',checkpoint_sha='a'*64)
        self.assertEqual(f.store.get(jid)['status'],'cancelled')
        self.assertIsNone(f.store.get(jid)['checkpoint_sha256'])
        self.assertEqual(f.client.post('/api/v1/calculations/'+jid+'/resume',headers=f.auth).status_code,409)

    def test_cancelled_pause_cannot_resume(self):
        f=self.f;jid=self.paused_job();f.store.cancel(jid)
        self.assertEqual(f.client.post('/api/v1/calculations/'+jid+'/resume',headers=f.auth).status_code,409)
        self.assertIsNone(f.store.claim())


if __name__=='__main__':unittest.main()
