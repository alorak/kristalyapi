"""D3 contracts/process tests. Synthetic solver text is NOT real DFT evidence."""
import json
from pathlib import Path
import sys
import threading
import time
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"server"))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import test_qe_jobs as fixtures
from job_core import canonical_request, make_pw_input
from relax_core import (SCHEMA, NotConverged, checked_relaxation, checked_scf,
                        final_forces, make_relax_input, relaxed_structure, scf_request, parse_ionic_history)
from worker import execute


def request():
    p=fixtures.payload();p["schema"]=SCHEMA;p["parameters"]["calculation"]="relax-scf"
    p["relaxation"]={"max_steps":20,"force_threshold_ry_bohr":1e-4,"energy_threshold_ry":1e-6}
    return p


def raw(relax=False):
    text="Program PWSCF v.6.7MaX\n"
    if relax:
        text+="! total energy = -8.00000000 Ry\n"
    text+=("convergence has been achieved in 3 iterations\n"
           "! total energy = -8.00000050 Ry\nestimated scf accuracy < 1.0E-9 Ry\n"
           "Forces acting on atoms (cartesian axes, Ry/au):\n"
           " atom 1 type 1 force = 0.00000000 0.00000000 0.00001000\n"
           " atom 2 type 1 force = 0.00000000 0.00000000 -0.00001000\n"
           " Total force = 0.00002000\n")
    if relax:
        text+=("bfgs converged in 2 scf cycles and 1 bfgs steps\n"
               "Begin final coordinates\nATOMIC_POSITIONS (crystal)\n"
               "Si 0.0 0.0 0.0\nSi 0.24 0.25 0.25\nEnd final coordinates\n")
    return text+"JOB DONE.\n"


class RelaxationTests(unittest.TestCase):
    def setUp(self):
        fixtures.D2Tests.setUp(self)

    def run_job(self,relax_text=None,scf_text=None,*,sleep=0,scf_sleep=0,timeout=10):
        source="#!/usr/bin/env python3\nimport sys,time\n"
        source+="if 'relax.in' in sys.argv:\n print("+repr(raw(True) if relax_text is None else relax_text)+",flush=True)\n"
        source+=f" time.sleep({sleep})\nelse:\n print("+repr(raw() if scf_text is None else scf_text)+",flush=True)\n"
        source+=f" time.sleep({scf_sleep})\n"
        binary=self.root/"d3-fake-pw";binary.write_text(source);binary.chmod(0o700)
        p,f=canonical_request(request());jid=self.store.submit(p,f)
        execute(self.store,self.store.claim(),qe_binary=str(binary),profiles_dir=self.profiles,
                pseudo_dir=self.pseudo,timeout=timeout)
        return jid,self.store.get(jid)

    def test_schema_preserves_source_identity_and_compiles_only_fixed_cell(self):
        p,h=canonical_request(request());scf,original=scf_request(p)
        self.assertEqual(h,original)
        upf={"Si":{"file":"Si.UPF"}}
        text=make_relax_input(p,upf)
        self.assertIn("calculation='relax'",text)
        self.assertIn("ion_dynamics='bfgs'",text)
        self.assertIn("nstep=20",text)
        self.assertIn("forc_conv_thr=0.0001",text)
        self.assertIn("outdir='./relax-tmp'",text)
        self.assertNotIn("&CELL",text)
        self.assertIn("outdir='./tmp'",make_pw_input(scf,upf))
        for change in [lambda p:p["parameters"].update(calculation="vc-relax"),
                       lambda p:p["relaxation"].update(max_steps=True),
                       lambda p:p["relaxation"].update(max_steps=61),
                       lambda p:p["relaxation"].update(force_threshold_ry_bohr=float('nan')),
                       lambda p:p["relaxation"].update(energy_threshold_ry=0),
                       lambda p:p["relaxation"].update(command="pwd")]:
            bad=request();change(bad)
            with self.assertRaises(ValueError):canonical_request(bad)

    def test_raw_relax_checks_structure_force_accuracy_and_energy(self):
        p,_=canonical_request(request());structure,proof=checked_relaxation(p,raw(True),0)
        self.assertEqual(structure["atoms"][1]["fractional"][0],.24)
        self.assertEqual(structure["cell_angstrom"],p["structure"]["cell_angstrom"])
        self.assertEqual(proof["max_force_component_ry_bohr"],1e-5)
        for text in [raw(True).replace('bfgs converged','bfgs stopped'),
                     raw(True).replace('0.00001000','0.00100000'),
                     raw(True).replace('1.0E-9','1.0E-5'),
                     raw(True).replace('-8.00000000','-7.00000000'),
                     raw(True)+'convergence NOT achieved\n']:
            with self.assertRaises(NotConverged):checked_relaxation(p,text,0)

    def test_relaxed_coordinates_and_force_identity_cannot_be_forged(self):
        p,_=canonical_request(request())
        for text in [raw(True).replace('Si 0.24','S 0.24'),
                     raw(True).replace('(crystal)','(angstrom)'),
                     raw(True).replace('Si 0.24 0.25 0.25','Si NaN 0.25 0.25'),
                     raw(True).replace('ATOMIC_POSITIONS','CELL_PARAMETERS\nATOMIC_POSITIONS'),
                     raw(True).replace('Si 0.24 0.25 0.25','Si 0.0 0.0 0.0')]:
            with self.assertRaises(ValueError):relaxed_structure(p,text)
        for text in [raw().replace('atom 2 type 1','atom 1 type 1'),
                     raw().replace('atom 2 type 1','atom 2 type 2'),
                     raw()+'Forces acting on atoms\n atom 1 type 1 force = 0 0 0\nTotal force = 0\n']:
            with self.assertRaises(ValueError):final_forces(text,p["structure"])

    def test_worker_api_chains_final_geometry_and_retains_stage_hashes(self):
        jid,row=self.run_job()
        self.assertEqual(row["status"],"completed",row["error"])
        result=self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).json()
        self.assertEqual(result["schema"],"kristalyapi.qe-relax-scf-result.v1")
        self.assertNotEqual(result["structure_hash"],result["final_structure_hash"])
        self.assertEqual(result["stages"]["scf"]["structure_hash"],result["final_structure_hash"])
        self.assertEqual(len(result["artifact_sha256"]),6)
        self.assertIn('Si 0.2400000000', (self.jobs/'runs'/jid/'structure.in').read_text())
        self.assertEqual(result["initial_structure"]["atoms"][1]["fractional"][0],.25)

    def test_high_verbosity_force_contributions_are_not_extra_total_force_rows(self):
        p,_=canonical_request(request())
        text=raw().replace(' Total force =',
            ' The non-local contrib.  to forces\n'
            ' atom 1 type 1 force = 0.5 0.5 0.5\n'
            ' atom 2 type 1 force = -0.5 -0.5 -0.5\n Total force =')
        proof=final_forces(text,p['structure'])
        self.assertEqual(len(proof['forces_ry_bohr']),2)
        self.assertEqual(proof['max_force_component_ry_bohr'],1e-5)

    def test_ionic_history_requires_every_energy_to_have_one_total_force(self):
        digest="a"*64
        paired=raw(True).replace("! total energy = -8.00000000 Ry\n",
            "! total energy = -8.00000000 Ry\nTotal force = 0.00005000\n")
        history=parse_ionic_history(paired,digest)
        self.assertEqual(len(history["steps"]),2)
        self.assertEqual(history["stdout_sha256"],digest)
        self.assertAlmostEqual(history["steps"][-1]["energy_ry"],-8.0000005)
        self.assertIsNone(parse_ionic_history(raw(True),digest),
                          "single final force cannot prove the earlier ionic force")
        self.assertIsNone(parse_ionic_history(paired.replace("0.00005000","NaN"),digest))
        self.assertIsNone(parse_ionic_history(paired.replace("0.00005000","-0.1"),digest))
        with self.assertRaises(ValueError):parse_ionic_history(paired,"not-sha")

    def test_worker_emits_only_complete_ionic_history_bound_to_raw_hash(self):
        paired=raw(True).replace("! total energy = -8.00000000 Ry\n",
            "! total energy = -8.00000000 Ry\nTotal force = 0.00005000\n")
        jid,row=self.run_job(relax_text=paired)
        self.assertEqual(row["status"],"completed",row["error"])
        result=self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).json()
        history=result["ionic_history"]
        self.assertEqual(history["schema"],"kristalyapi.qe-ionic-history.v1")
        self.assertEqual(len(history["steps"]),2)
        self.assertEqual(history["stdout_sha256"],result["artifact_sha256"]["relax.out"])
        self.assertNotEqual(history["steps"][0]["energy_ry"],result["energy_ry"],
                            "separate final SCF must not contaminate ionic history")
        jid,other=self.run_job()
        old=self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).json()
        self.assertNotIn("ionic_history",old,"incomplete pairing must never be published")

    def test_unconverged_relaxation_never_starts_scf_or_publishes_result(self):
        jid,row=self.run_job(relax_text=raw(True).replace('bfgs converged','bfgs stopped'))
        self.assertEqual(row["status"],"not_converged")
        self.assertIsNone(row["result_json"])
        self.assertFalse((self.jobs/'runs'/jid/'structure.in').exists())
        self.assertEqual(self.client.get('/api/v1/calculations/'+jid+'/results',headers=self.auth).status_code,409)
        self.assertIn('bfgs stopped',self.client.get('/api/v1/calculations/'+jid+'/logs',headers=self.auth).json()['text'])

    def test_independent_scf_force_failure_is_not_a_successful_pipeline(self):
        jid,row=self.run_job(scf_text=raw().replace('0.00001000','0.00100000'))
        self.assertEqual(row["status"],"not_converged")
        self.assertIsNone(row["result_json"])
        self.assertTrue((self.jobs/'runs'/jid/'structure.out').is_file())

    def test_timeout_during_relaxation_is_terminal_and_never_chains(self):
        jid,row=self.run_job(sleep=10,timeout=.5)
        self.assertEqual(row["status"],"timed_out",row["error"])
        self.assertIn('during relax',row['error'])
        self.assertIsNone(row["result_json"])
        self.assertFalse((self.jobs/'runs'/jid/'structure.in').exists())
        proof=json.loads((self.jobs/'runs'/jid/'pipeline.json').read_text())
        self.assertEqual(proof["stage"],"relax")

    def test_api_validates_relax_schema_without_executing(self):
        response=self.client.post('/api/v1/calculations/validate',headers=self.auth,json=request())
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['calculation'],'relax-scf')
        self.assertFalse((self.jobs/'runs').exists())
        self.assertIn('relax-scf',self.client.get('/api/capabilities').json()['supported_operations'])

    def test_timeout_during_final_scf_preserves_both_stage_outputs(self):
        jid,row=self.run_job(scf_sleep=10,timeout=.5)
        self.assertEqual(row['status'],'timed_out',row['error'])
        self.assertIn('during scf',row['error'])
        self.assertIsNone(row['result_json'])
        self.assertTrue((self.jobs/'runs'/jid/'relax.out').is_file())
        self.assertTrue((self.jobs/'runs'/jid/'structure.out').is_file())

    def test_cancellation_during_relaxation_kills_process_and_blocks_scf(self):
        binary=self.root/'cancel-pw'
        binary.write_text('#!/usr/bin/env python3\nimport time\nprint("partial relax",flush=True)\ntime.sleep(10)\n')
        binary.chmod(0o700)
        p,f=canonical_request(request());jid=self.store.submit(p,f)
        task=self.store.claim()
        thread=threading.Thread(target=execute,args=(self.store,task),kwargs={
            'qe_binary':str(binary),'profiles_dir':self.profiles,'pseudo_dir':self.pseudo,'timeout':30})
        thread.start()
        try:
            deadline=time.monotonic()+4
            while not (self.jobs/'runs'/jid/'relax.out').exists() and time.monotonic()<deadline:
                time.sleep(.02)
            self.store.cancel(jid)
        finally:
            thread.join(timeout=5)
        self.assertFalse(thread.is_alive())
        self.assertEqual(self.store.get(jid)['status'],'cancelled')
        self.assertIsNone(self.store.get(jid)['result_json'])
        self.assertFalse((self.jobs/'runs'/jid/'structure.in').exists())


if __name__=='__main__':unittest.main()
