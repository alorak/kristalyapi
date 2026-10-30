"""D2 offline tests. Fake UPF metadata and fake pw.x are NOT DFT calculations."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"server"))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))

from api import create_app
from job_core import canonical_request,load_profile,make_pw_input
from job_store import JobStore
from worker import execute

TOKEN="a"*48
READY={"ready":True,"qe_version":"6.7","binary_smoke":"pwscf_banner",
       "binaries":{"pw.x":True,"bands.x":True,"dos.x":True,"projwfc.x":True},
       "scientific_calculation_performed":False}


def payload():
    return {"schema":"kristalyapi.qe-scf-job.v1","profile_id":"si-pbe",
            "structure":{"periodic":True,
                         "cell_angstrom":[[5.43,0,0],[0,5.43,0],[0,0,5.43]],
                         "atoms":[{"element":"Si","fractional":[0,0,0]},
                                  {"element":"Si","fractional":[.25,.25,.25]}]},
            "parameters":{"calculation":"scf","functional":"PBE","spin":"unpolarized",
                          "ecutwfc_ry":45,"ecutrho_ry":360,"kpoints":[2,2,2]}}


class D2Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.pseudo=self.root/"pseudos";self.pseudo.mkdir()
        self.profiles=self.root/"profiles";self.profiles.mkdir()
        content=b"<UPF version='2.0.1'>\nSi fake fixture NOT actual DFT"
        self.upf=self.pseudo/"Si.UPF";self.upf.write_bytes(content)
        self.meta={"file":"Si.UPF","sha256":hashlib.sha256(content).hexdigest(),
                   "source":"synthetic unit-test fixture","license":"test-only",
                   "functional":"PBE"}
        cfg={"schema":"kristalyapi.upf-profile.v1","id":"si-pbe",
             "functional":"PBE","elements":{"Si":self.meta}}
        (self.profiles/"si-pbe.json").write_text(json.dumps(cfg))
        self.jobs=self.root/"jobs"
        self.store=JobStore(self.jobs)
        app=create_app(probe=READY,allowed_origins=["https://alorak.github.io"],
                       allowed_hosts=["localhost","192.168.1.50"],jobs_enabled=True,
                       api_token=TOKEN,job_root=self.jobs,
                       profiles_dir=self.profiles,pseudo_dir=self.pseudo)
        self.client=TestClient(app,base_url="http://localhost")
        self.auth={"Authorization":"Bearer "+TOKEN}

    def test_auth_required_and_http_lan_token_denied(self):
        self.assertEqual(self.client.post("/api/v1/calculations",json=payload()).status_code,401)
        bad=self.client.post("/api/v1/calculations",json=payload(),
                             headers={"Authorization":"Bearer bad"})
        self.assertEqual(bad.status_code,401)
        remote=TestClient(self.client.app,base_url="http://192.168.1.50")
        self.assertEqual(remote.post("/api/v1/calculations",json=payload(),
                                    headers=self.auth).status_code,403)
        self.assertEqual(self.client.get("/api/capabilities").json()["job_submission_enabled"],True)

    def test_preflight_and_submission_with_fixed_operator_upf(self):
        valid=self.client.post("/api/v1/calculations/validate",json=payload(),headers=self.auth)
        self.assertEqual(valid.status_code,200,valid.text)
        self.assertEqual(valid.json()["atoms"],2)
        queued=self.client.post("/api/v1/calculations",json=payload(),headers=self.auth)
        self.assertEqual(queued.status_code,202,queued.text)
        id=queued.json()["job_id"]
        self.assertEqual(len(id),32)
        self.assertEqual(self.client.get("/api/v1/calculations/"+id,headers=self.auth).json()["status"],"queued")
        self.assertEqual(self.client.get("/api/v1/calculations/"+id+"/results",headers=self.auth).status_code,409)
        self.assertEqual(self.client.get("/api/v1/calculations",headers=self.auth).json()["jobs"][0]["job_id"],id)
        self.assertEqual(self.client.get("/api/v1/calculations/"+id+"/logs",headers=self.auth).json()["text"],"")

    def test_cancel_queued_and_worker_restart_recovery(self):
        p,f=canonical_request(payload())
        id=self.store.submit(p,f)
        cancelled=self.client.post("/api/v1/calculations/"+id+"/cancel",headers=self.auth)
        self.assertEqual(cancelled.json()["status"],"cancelled")
        self.assertEqual(self.store.claim(),None)
        id2=self.store.submit(p,f)
        self.assertEqual(self.store.claim()["id"],id2)
        self.store.interrupted()
        self.assertEqual(self.store.get(id2)["status"],"failed")

    def test_fake_solver_process_termination_and_convergence_contract(self):
        p,f=canonical_request(payload())
        binary=self.root/"fake-pw.x"
        binary.write_text("#!/usr/bin/env python3\nprint('Program PWSCF v.7.5')\n"
                          "print('convergence has been achieved in 3 iterations')\n"
                          "print('!    total energy = -8.0 Ry')\n"
                          "print('Total force = 0.02 Ry/Bohr')\nprint('JOB DONE.')\n")
        binary.chmod(0o700)
        jid=self.store.submit(p,f)
        claimed=self.store.claim()
        execute(self.store,claimed,qe_binary=str(binary),
                profiles_dir=self.profiles,pseudo_dir=self.pseudo,timeout=30)
        record=self.store.get(jid)
        self.assertEqual(record["status"],"completed",record["error"])
        result=json.loads(record["result_json"])
        self.assertAlmostEqual(result["energy_ry"],-8.0)
        self.assertFalse(result["scientific_convergence_study_completed"])
        self.assertEqual(result["structure_hash"],f)
        self.assertEqual(result["pseudopotentials"]["Si"]["sha256"],self.meta["sha256"])
        fetched=self.client.get("/api/v1/calculations/"+jid+"/results",headers=self.auth)
        self.assertEqual(fetched.status_code,200)
        self.assertEqual(fetched.json()["engine_version"],"7.5")
        self.assertIn("JOB DONE",self.client.get("/api/v1/calculations/"+jid+"/logs",
                                                headers=self.auth).json()["text"])

    def test_incomplete_mock_output_is_not_converged(self):
        p,f=canonical_request(payload())
        binary=self.root/"incomplete"
        binary.write_text("#!/usr/bin/env python3\nprint('!    total energy = -8.0 Ry')\n")
        binary.chmod(0o700)
        jid=self.store.submit(p,f)
        execute(self.store,self.store.claim(),qe_binary=str(binary),
                profiles_dir=self.profiles,pseudo_dir=self.pseudo,timeout=30)
        self.assertEqual(self.store.get(jid)["status"],"not_converged")
        self.assertEqual(self.client.get("/api/v1/calculations/"+jid+"/results",
                                         headers=self.auth).status_code,409)

    def test_reject_untrusted_qe_parameters_and_profiles(self):
        for edit in [
            lambda p:p["parameters"].update({"calculation":"relax"}),
            lambda p:p["parameters"].update({"spin":"polarized"}),
            lambda p:p["parameters"].update({"ecutwfc_ry":"NaN"}),
            lambda p:p["structure"]["atoms"].append({"element":";rm -rf /","fractional":[0,0,0]}),
            lambda p:p.update({"profile_id":"../fake"}),
            lambda p:p["structure"].update({"cell_angstrom":[[1,0,0],[2,0,0],[0,0,5]]}),
        ]:
            with self.subTest(edit=edit):
                item=payload()
                edit(item)
                response=self.client.post("/api/v1/calculations/validate",
                                          json=item,headers=self.auth)
                self.assertEqual(response.status_code,422,response.text)
        self.meta["sha256"]="0"*64
        profile=self.profiles/"si-pbe.json"
        cfg=json.loads(profile.read_text());cfg["elements"]["Si"]=self.meta
        profile.write_text(json.dumps(cfg))
        fail=self.client.post("/api/v1/calculations/validate",json=payload(),
                              headers=self.auth)
        self.assertEqual(fail.status_code,422,fail.text)

    def test_structure_hash_tracks_geometry_not_numerical_cutoff(self):
        p=payload()
        _,geometry_hash=canonical_request(p)
        p["parameters"]["ecutwfc_ry"]=55
        _,same_hash=canonical_request(p)
        self.assertEqual(geometry_hash,same_hash)
        p["structure"]["atoms"][1]["fractional"]=[.2,.2,.2]
        _,different=canonical_request(p)
        self.assertNotEqual(geometry_hash,different)

    def test_duplicate_periodic_sites_rejected(self):
        p=payload()
        p["structure"]["atoms"][1]["fractional"]=[1,0,0]
        response=self.client.post("/api/v1/calculations/validate",json=p,headers=self.auth)
        self.assertEqual(response.status_code,422)
        self.assertIn("Overlapping",response.text)

    def test_running_process_cancellation_is_terminal_and_no_result(self):
        import threading
        import time
        p,f=canonical_request(payload())
        binary=self.root/"slow-pw.x"
        binary.write_text("#!/usr/bin/env python3\nimport time\ntime.sleep(10)\n")
        binary.chmod(0o700)
        jid=self.store.submit(p,f)
        task=self.store.claim()
        thread=threading.Thread(
            target=execute,args=(self.store,task),
            kwargs={"qe_binary":str(binary),"profiles_dir":self.profiles,
                    "pseudo_dir":self.pseudo,"timeout":30},daemon=True)
        thread.start()
        time.sleep(0.2)
        self.store.cancel(jid)
        thread.join(timeout=8)
        self.assertFalse(thread.is_alive(),"cancelled worker did not terminate")
        self.assertEqual(self.store.get(jid)["status"],"cancelled")
        self.assertIsNone(self.store.get(jid)["result_json"])

    def test_worker_timeout_explains_limit_and_never_publishes_partial_results(self):
        p,f=canonical_request(payload())
        binary=self.root/"timeout-pw.x"
        binary.write_text("#!/usr/bin/env python3\nimport time\n"
                          "print('Program PWSCF v.7.5',flush=True)\n"
                          "print('convergence has been achieved in 3 iterations',flush=True)\n"
                          "print('!    total energy = -8.0 Ry',flush=True)\n"
                          "print('JOB DONE.',flush=True)\ntime.sleep(10)\n")
        binary.chmod(0o700)
        jid=self.store.submit(p,f)
        execute(self.store,self.store.claim(),qe_binary=str(binary),
                profiles_dir=self.profiles,pseudo_dir=self.pseudo,timeout=1)
        record=self.store.get(jid)
        self.assertEqual(record["status"],"timed_out")
        self.assertIn("1 s wall-time limit",record["error"])
        self.assertIsNone(record["result_json"])
        response=self.client.get("/api/v1/calculations/"+jid,headers=self.auth)
        self.assertEqual(response.json()["error"],record["error"])
        self.assertEqual(self.client.get("/api/v1/calculations/"+jid+"/results",
                                         headers=self.auth).status_code,409)
        logs=self.client.get("/api/v1/calculations/"+jid+"/logs",headers=self.auth)
        self.assertIn("JOB DONE.",logs.json()["text"])

    def test_auth_and_body_size_and_missing_job_id(self):
        self.assertEqual(self.client.get("/api/v1/calculations/"+("a"*32)).status_code,401)
        response=self.client.post("/api/v1/calculations",headers={
            **self.auth,"Content-Type":"application/json"},content=b"x"*70000)
        self.assertEqual(response.status_code,413)
        missing=self.client.get("/api/v1/calculations/"+("a"*32),headers=self.auth)
        self.assertEqual(missing.status_code,404)

    def test_job_history_names_paging_filters_and_access_control(self):
        p,h=canonical_request(payload())
        ids=[self.store.submit(p,h,max_pending=30) for _ in range(24)]
        self.assertEqual(self.client.get("/api/v1/calculations",headers=self.auth).json()["total"],24)
        self.assertEqual(len(self.client.get("/api/v1/calculations",headers=self.auth).json()["jobs"]),20)
        page=self.client.get("/api/v1/calculations?limit=10&offset=20",headers=self.auth).json()
        self.assertEqual(len(page["jobs"]),4)
        self.assertFalse(page["has_more"])
        self.assertEqual(self.client.get("/api/v1/calculations?limit=10&offset=20").status_code,401)
        saved=self.client.post("/api/v1/calculations/"+ids[0]+"/label",
            headers=self.auth,json={"label":"MoS2 pristine Δ • <unsafe>"})
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertEqual(saved.json()["name"],"MoS2 pristine Δ • <unsafe>")
        results=self.client.get("/api/v1/calculations?q=pristine",headers=self.auth).json()
        self.assertEqual(results["total"],1)
        self.assertEqual(results["jobs"][0]["job_id"],ids[0])
        for query in ("?limit=1000","?offset=-1","?status=garbage","?calculation=vc-relax",
                      "?q="+("x"*65),"?limit=1&unexpected=1"):
            self.assertEqual(self.client.get("/api/v1/calculations"+query,headers=self.auth).status_code,422,query)
        self.assertEqual(self.client.post("/api/v1/calculations/"+ids[0]+"/label",
            headers=self.auth,json={"label":"bad\nname"}).status_code,422)
        self.assertEqual(self.client.post("/api/v1/calculations/"+ids[0]+"/label",
            headers=self.auth,json={"label":"x"*61}).status_code,422)
        self.assertEqual(self.client.post("/api/v1/calculations/"+ids[0]+"/label",
            json={"label":"outside"}).status_code,401)
        self.assertEqual(self.client.post("/api/v1/calculations/"+ids[0]+"/label",
            headers={**self.auth,"Content-Type":"application/json"},content=b"x"*700).status_code,413)
        self.assertEqual(self.store.get(ids[0])["structure_hash"],h)
        # Reopening the SQLite store retains labels and older snapshot rows.
        reloaded=JobStore(self.jobs)
        self.assertEqual(reloaded.get(ids[0])["label"],"MoS2 pristine Δ • <unsafe>")

    def test_versioned_summary_has_no_fabricated_unfinished_result(self):
        p,h=canonical_request(payload());jid=self.store.submit(p,h)
        url="/api/v1/calculations/"+jid+"/summary"
        self.assertEqual(self.client.get(url).status_code,401)
        pending=self.client.get(url,headers=self.auth).json()
        self.assertEqual(pending["schema"],"kristalyapi.calculation-summary.v1")
        self.assertEqual(pending["structure_hash"],h)
        self.assertEqual(pending["request"]["kpoints"],[2,2,2])
        self.assertEqual(pending["evidence_status"],"unavailable")
        self.assertIsNone(pending["result"])
        self.assertNotIn("pseudopotentials",pending["request"])
        # Synthetic evidence tests serialization ONLY, not physics acceptance.
        proof={"schema":"kristalyapi.qe-scf-result.v1","structure_hash":h,
            "engine":"quantum-espresso","engine_version":"6.7",
            "job_done":True,"scf_converged":True,"energy_ry":-1.,
            "energy_ev":-13.605693122994,
            "input_sha256":"a"*64,"output_sha256":"b"*64,
            "pseudopotentials":{"Si":{"file":"Si.UPF","sha256":"c"*64,
             "functional":"PBE","license":"test"}}}
        with self.store.conn() as db:
            db.execute("UPDATE jobs SET status='completed',result_json=? WHERE id=?",(json.dumps(proof),jid))
        done=self.client.get(url,headers=self.auth).json()
        self.assertEqual(done["evidence_status"],"matched")
        self.assertEqual(done["result"]["energy_ev"],-13.605693122994)
        self.assertEqual(done["result"]["pseudopotentials"]["Si"]["sha256"],"c"*64)
        self.assertFalse(done["result"]["scientific_convergence_study_completed"])
        proof["structure_hash"]="d"*64
        with self.store.conn() as db:
            db.execute("UPDATE jobs SET result_json=? WHERE id=?",(json.dumps(proof),jid))
        mismatch=self.client.get(url,headers=self.auth).json()
        self.assertEqual(mismatch["evidence_status"],"mismatch")
        self.assertIsNone(mismatch["result"])

    def test_legacy_sqlite_migration_preserves_request_snapshot(self):
        import sqlite3
        p,h=canonical_request(payload())
        # Database shape prior to pagination and naming.
        old_root=self.root/"legacy";old_root.mkdir()
        conn=sqlite3.connect(old_root/"jobs.sqlite3")
        conn.execute("""CREATE TABLE jobs (
            id TEXT PRIMARY KEY,created TEXT NOT NULL,updated TEXT NOT NULL,
            status TEXT NOT NULL,request_json TEXT NOT NULL,
            structure_hash TEXT NOT NULL,profile_id TEXT NOT NULL,
            cancel_requested INTEGER NOT NULL DEFAULT 0,result_json TEXT,error TEXT,
            input_sha256 TEXT,output_sha256 TEXT
        )""")
        conn.execute("INSERT INTO jobs(id,created,updated,status,request_json,structure_hash,profile_id) VALUES(?,?,?,?,?,?,?)",
            ("a"*32,"2026-10-01","2026-10-01","completed",json.dumps(p),h,p["profile_id"]))
        conn.commit();conn.close()
        migrated=JobStore(old_root)
        row=migrated.get("a"*32)
        self.assertEqual(row["calculation"],"scf")
        self.assertEqual(row["label"],"")
        self.assertEqual(json.loads(row["request_json"]),p)
        self.assertEqual(migrated.list_page(calculation="scf")[1],1)

    def test_expected_compiler_has_no_user_paths_and_fixed_header(self):
        p,_=canonical_request(payload())
        parsed=load_profile(p,self.profiles,self.pseudo)
        text=make_pw_input(p,parsed)
        self.assertIn("calculation='scf'",text)
        self.assertIn("pseudo_dir='./pseudo'",text)
        self.assertNotIn("system(",text)
        self.assertIn("Si.UPF",text)


if __name__=="__main__":
    unittest.main()
