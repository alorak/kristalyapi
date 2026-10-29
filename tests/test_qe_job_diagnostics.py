"""Synthetic operational telemetry, not scientific memory/convergence claims."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server'),str(ROOT/'tools')]
import job_diagnostics as diag
import test_qe_jobs as fixtures
import test_qe_electronic_jobs as electronic
from job_core import canonical_request
from worker import execute


class JobDiagnosticTests(unittest.TestCase):
    def test_exit_137_alone_never_claims_oom_and_explicit_outcomes_take_priority(self):
        self.assertEqual(diag.classify('failed',None,[137],None),'process_killed_unconfirmed')
        self.assertEqual(diag.classify('failed',None,[-9],0),'process_killed_unconfirmed')
        self.assertEqual(diag.classify('failed',None,[-9],1),'cgroup_oom_kill')
        for status,expected in [('completed','completed'),('timed_out','wall_time_limit'),('cancelled','cancelled')]:
            self.assertEqual(diag.classify(status,None,[-9],1),expected)

    def test_grid_convergence_and_worker_interrupt_are_distinguished(self):
        for status,error,code in [('failed','DOS and projected DOS energy axes mismatch','dos_grid_mismatch'),
            ('not_converged','finite residual too large','scf_not_converged'),
            ('failed','Worker restarted: interrupted job','worker_interrupted')]:
            self.assertEqual(diag.classify(status,error,[],None),code)

    def test_reading_cgroup_uses_observations_and_keeps_unavailable_limits_null(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'memory.events').write_text('oom 2\noom_kill 1\n')
            (p/'memory.current').write_text('12345');(p/'memory.max').write_text('max')
            (p/'memory.swap.max').write_text('0')
            result=diag.read_cgroup(p)
            self.assertEqual(result,{'oom_kill':1,'current':12345,'memory_limit':None,'swap_limit':0})

    def fixture(self):
        f=fixtures.D2Tests();f.setUp();self.addCleanup(f.doCleanups);return f

    def test_authenticated_diagnostics_fallback_for_old_or_queued_jobs(self):
        f=self.fixture();p,h=canonical_request(fixtures.payload());jid=f.store.submit(p,h)
        endpoint='/api/v1/calculations/'+jid+'/diagnostics'
        self.assertEqual(f.client.get(endpoint).status_code,401)
        result=f.client.get(endpoint,headers=f.auth)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['availability'],'unavailable')
        self.assertEqual(result.json()['reason_code'],'in_progress')
        self.assertIsNone(result.json()['resources'])
        self.assertEqual(f.client.get('/api/v1/calculations/'+'f'*32+'/diagnostics',headers=f.auth).status_code,404)

    def test_real_child_killed_without_cgroup_evidence_is_not_reported_as_oom(self):
        f=self.fixture();p,h=canonical_request(fixtures.payload());jid=f.store.submit(p,h)
        binary=f.root/'fake-killed';binary.write_text('#!/usr/bin/env python3\nimport os,signal\nos.kill(os.getpid(),signal.SIGKILL)\n');binary.chmod(0o700)
        with patch.object(diag,'read_cgroup',return_value={'current':None,'memory_limit':None,'swap_limit':None,'oom_kill':None}):
            execute(f.store,f.store.claim(),qe_binary=str(binary),profiles_dir=f.profiles,pseudo_dir=f.pseudo,timeout=3)
        result=f.client.get('/api/v1/calculations/'+jid+'/diagnostics',headers=f.auth).json()
        self.assertEqual(result['reason_code'],'process_killed_unconfirmed')
        self.assertEqual(result['process_returncodes'],[-9]);self.assertGreaterEqual(result['elapsed_seconds'],0)
        self.assertEqual(result['stages'][0]['name'],'scf')
        self.assertIsNone(result['resources']['sampled_worker_memory_max_bytes'])
        self.assertEqual(f.client.get('/api/v1/calculations/'+jid+'/results',headers=f.auth).status_code,409)

    def test_electronic_stage_timings_and_failure_survive_via_http(self):
        f=electronic.ElectronicJobTests();f.setUp();self.addCleanup(f.doCleanups)
        jid,row=f.execute(fail='bands')
        result=f.client.get('/api/v1/calculations/'+jid+'/diagnostics',headers=f.auth).json()
        self.assertEqual(row['status'],'failed');self.assertEqual(result['status'],'failed')
        self.assertEqual([s['name'] for s in result['stages']],['scf','bands'])
        self.assertTrue(all(s['duration_seconds']>=0 for s in result['stages']))
        self.assertEqual(result['stages'][-1]['returncode'],1)

    def test_recorder_uses_oom_counter_delta_and_ignores_prior_oom_events(self):
        f=self.fixture()
        for final_count,expected in [(10,'process_killed_unconfirmed'),(11,'cgroup_oom_kill')]:
            p,h=canonical_request(fixtures.payload());jid=f.store.submit(p,h);job=f.store.claim()
            values=[{'current':100,'memory_limit':1000,'swap_limit':0,'oom_kill':n} for n in (10,10,final_count)]
            @diag.record_job
            def synthetic(store,job):
                class P: returncode=-9
                diag.sample_job(P())
                store.set_result(job['id'],'failed',error='Killed')
            with patch.object(diag,'read_cgroup',side_effect=values):synthetic(f.store,job)
            value=diag.read_diagnostics(f.store,f.store.get(jid))
            self.assertEqual(value['reason_code'],expected)
            self.assertEqual(value['resources']['cgroup_oom_kill_delta'],final_count-10)

    def test_sidecar_symlinks_cannot_return_arbitrary_operator_files(self):
        f=self.fixture();p,h=canonical_request(fixtures.payload());jid=f.store.submit(p,h)
        path=f.jobs/'diagnostics';path.mkdir();target=f.root/'outside.json'
        target.write_text(json.dumps({'schema':diag.SCHEMA,'job_id':jid,'secret':'not exposed'}))
        (path/(jid+'.json')).symlink_to(target)
        value=f.client.get('/api/v1/calculations/'+jid+'/diagnostics',headers=f.auth).json()
        self.assertEqual(value['availability'],'unavailable');self.assertNotIn('secret',value)


if __name__=='__main__':unittest.main()
