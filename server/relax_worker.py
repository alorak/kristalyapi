"""D3 bounded fixed-cell relaxation followed by an independent final SCF."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import os
import shutil
import subprocess
import time

from job_core import canonical_request, load_profile, make_pw_input
from relax_core import NotConverged, checked_relaxation, checked_scf, make_relax_input, scf_request


class Stopped(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda:stream.read(1048576),b""):
            value.update(block)
    return value.hexdigest()


def read_output(path):
    if path.stat().st_size > 16_000_000:
        raise ValueError("QE output exceeds 16 MB parser limit")
    return path.read_text(encoding="utf-8", errors="replace")


def execute_relax_scf(store, job, *, qe_binary, profiles_dir, pseudo_dir, timeout, limits, kill):
    jid = job["id"]
    root = store.root/"runs"/jid
    status, result, error = "failed", None, None
    input_sha, output_sha = None, None
    stage = "relax"
    deadline = time.monotonic()+timeout

    def stopped():
        if store.get(jid)["cancel_requested"]:
            raise Stopped("cancelled", "Calculation cancelled during "+stage)
        if time.monotonic() >= deadline:
            raise Stopped("timed_out", f"QE relax-scf exceeded its {timeout:g} s wall-time limit during "+stage)

    def run(input_name, output_name, stderr_name):
        stopped()
        process = None
        try:
            with (root/input_name).open("rb") as stdin, (root/output_name).open("wb") as stdout, \
                    (root/stderr_name).open("wb") as stderr:
                process = subprocess.Popen([binary,"-in",input_name],cwd=root,
                    stdin=stdin,stdout=stdout,stderr=stderr,start_new_session=True,
                    env={**os.environ,"OMP_NUM_THREADS":"2"},preexec_fn=limits)
                while process.poll() is None:
                    stopped()
                    time.sleep(.2)
                return process.wait(timeout=10)
        finally:
            if process is not None and process.poll() is None:
                kill(process)
                process.wait(timeout=10)

    try:
        stopped()
        request, fingerprint = canonical_request(json.loads(job["request_json"]))
        if fingerprint != job["structure_hash"]:
            raise ValueError("Stored source structure hash mismatch")
        upf = load_profile(request, Path(profiles_dir), Path(pseudo_dir))
        root.mkdir(parents=True, exist_ok=False)
        for name in ("pseudo","tmp","relax-tmp"):
            (root/name).mkdir()
        for meta in upf.values():
            dest = root/"pseudo"/meta["file"]
            shutil.copyfile(Path(pseudo_dir)/meta["file"], dest)
            if digest(dest) != meta["sha256"]:
                raise ValueError("UPF bytes changed while staging")
        binary = shutil.which(qe_binary)
        if not binary:
            raise ValueError("Configured QE binary unavailable")
        (root/"relax.in").write_text(make_relax_input(request,upf),encoding="utf-8")
        code = run("relax.in","relax.out","relax.stderr")
        if code != 0:
            raise ValueError("QE relaxation exited with code "+str(code))
        final_structure, relax = checked_relaxation(request,read_output(root/"relax.out"),code)
        stage = "scf"
        stopped()
        for meta in upf.values():
            if digest(root/"pseudo"/meta["file"]) != meta["sha256"]:
                raise ValueError("Staged UPF changed before final SCF")
        final_request, final_hash = scf_request(request,final_structure)
        (root/"structure.in").write_text(make_pw_input(final_request,upf),encoding="utf-8")
        input_sha = digest(root/"structure.in")
        code = run("structure.in","structure.out","structure.stderr")
        if code != 0:
            raise ValueError("Final QE SCF exited with code "+str(code))
        proof_request = {**request,"structure":final_structure}
        scf = checked_scf(read_output(root/"structure.out"),code,proof_request)
        output_sha = digest(root/"structure.out")
        if relax["qe_version"] != scf["qe_version"]:
            raise ValueError("QE version changed between stages")
        artifacts = {name: digest(root/name) for name in (
            "relax.in","relax.out","relax.stderr","structure.in","structure.out","structure.stderr")}
        result = {"schema":"kristalyapi.qe-relax-scf-result.v1","job_id":jid,
            "structure_hash":fingerprint,"initial_structure":request["structure"],
            "final_structure":final_structure,"final_structure_hash":final_hash,
            "engine":"quantum-espresso","engine_version":scf["qe_version"],
            "energy_ry":scf["energy_ry"],"energy_ev":scf["energy_ev"],
            "total_force_ry_bohr":scf["total_force_ry_bohr"],
            "max_force_component_ry_bohr":scf["max_force_component_ry_bohr"],
            "scf_converged":True,"geometry_converged":True,"job_done":True,
            "functional_declared":"PBE","pseudopotentials":upf,
            "input_sha256":input_sha,"output_sha256":output_sha,
            "relaxation_settings":request["relaxation"],
            "stages":{"relax":relax,"scf":{**scf,"structure_hash":final_hash}},
            "artifact_sha256":artifacts,"scientific_convergence_study_completed":False}
        status = "completed"
    except Stopped as exc:
        status, error = exc.status, str(exc)
    except NotConverged as exc:
        status, error = "not_converged", str(exc)
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        status, error = "failed", (str(exc) or type(exc).__name__)[:500]
    finally:
        try:
            if root.is_dir():
                failure = {"stage":stage,"status":status,"error":error,
                           "artifact_sha256":{p.name:digest(p) for p in root.iterdir()
                               if p.name in {"relax.in","relax.out","relax.stderr","structure.in",
                                             "structure.out","structure.stderr"} and p.is_file()}}
                (root/"pipeline.json").write_text(json.dumps(failure,indent=2)+"\n",encoding="utf-8")
        except OSError as exc:
            status, result, error = "failed", None, "Cannot retain pipeline evidence: "+str(exc)[:300]
        store.set_result(jid,status,result=result,error=error,input_sha=input_sha,output_sha=output_sha)
