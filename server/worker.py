"""D2 single-worker SCF executable. Do not run inside FastAPI request workers."""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import resource
import shutil
import signal
import subprocess
import time

from job_core import load_profile, make_pw_input, RY_TO_EV
from job_store import JobStore
# Reuse the already tested KristalYapı pw.x convergence parser.
from qe_run import summarize_output


def sha(path):
    digest=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1048576),b""):
            digest.update(block)
    return digest.hexdigest()


from job_diagnostics import record_job,sample_job
from resource_policy import current as resource_limits

@record_job
def execute(store,job,*,qe_binary="pw.x",profiles_dir=Path("/profiles"),
            pseudo_dir=Path("/pseudos"),timeout=3600):
    if json.loads(job["request_json"]).get("schema")=="kristalyapi.qe-electronic-job.v1":
        from electronic_worker import execute_electronic
        return execute_electronic(store,job,qe_binary=qe_binary,profiles_dir=profiles_dir,
            pseudo_dir=pseudo_dir,timeout=timeout,kill=_kill_group,
            limits=lambda:_limits(max(4000,math.ceil(resource_limits()["threads"]*timeout)+30)))
    if json.loads(job["request_json"]).get("schema")=="kristalyapi.qe-relax-scf-job.v1":
        from relax_worker import execute_relax_scf
        return execute_relax_scf(store,job,qe_binary=qe_binary,profiles_dir=profiles_dir,
            pseudo_dir=pseudo_dir,timeout=timeout,kill=_kill_group,
            limits=lambda:_limits(max(4000,math.ceil(resource_limits()["threads"]*timeout)+30)))
    job_id=job["id"]
    workdir=store.root/"runs"/job_id
    process=None
    input_sha=None
    output_sha=None
    result=None
    status="failed"
    error=None
    try:
        if store.get(job_id)["cancel_requested"]:
            status="cancelled"
            return
        payload=json.loads(job["request_json"])
        upf=load_profile(payload,profiles_dir,pseudo_dir)
        # Root is exclusively owned by the QE operator; every job directory is random.
        workdir.mkdir(parents=True,exist_ok=False)
        (workdir/"pseudo").mkdir()
        (workdir/"tmp").mkdir()
        for meta in upf.values():
            src=pseudo_dir/meta["file"]
            dest=workdir/"pseudo"/meta["file"]
            shutil.copyfile(src,dest)
            if sha(dest)!=meta["sha256"]:
                raise ValueError("UPF bytes changed while staging")
        input_file=workdir/"structure.in"
        input_file.write_text(make_pw_input(payload,upf),encoding="utf-8")
        input_sha=sha(input_file)
        output_file=workdir/"structure.out"
        stderr_file=workdir/"structure.stderr"
        binary=shutil.which(qe_binary)
        if not binary:
            raise ValueError("Configured QE binary unavailable")
        with input_file.open("rb") as stdin,output_file.open("wb") as stdout,stderr_file.open("wb") as stderr:
            sample_job(stage='scf')
            process=subprocess.Popen(
                [binary,"-in","structure.in"],cwd=workdir,
                stdin=stdin,stdout=stdout,stderr=stderr,
                start_new_session=True,env={**os.environ,"OMP_NUM_THREADS":str(resource_limits()["threads"])},
                preexec_fn=lambda:_limits(max(4000,math.ceil(resource_limits()["threads"]*timeout)+30))
            )
            deadline=time.monotonic()+timeout
            while process.poll() is None:
                sample_job(process)
                if store.get(job_id)["cancel_requested"]:
                    _kill_group(process)
                    status="cancelled"
                    break
                if time.monotonic()>=deadline:
                    _kill_group(process)
                    status="timed_out"
                    error=f"QE calculation exceeded its {timeout:g} s wall-time limit"
                    break
                time.sleep(.5)
            process.wait(timeout=10)
            sample_job(process,stage='scf',done=True)
        output_sha=sha(output_file)
        if status not in ("cancelled","timed_out"):
            # Partial or absent output can never be reported as completed.
            if output_file.stat().st_size>16_000_000:
                raise ValueError("QE output exceeds 16 MB safe parser limit")
            raw=output_file.read_text(encoding="utf-8",errors="replace")
            parsed=summarize_output(raw,"scf",process.returncode)
            status=("completed" if parsed["status"]=="completed" else
                    "failed" if process.returncode!=0 else "not_converged")
            result={
                "schema":"kristalyapi.qe-scf-result.v1",
                "job_id":job_id,"structure_hash":job["structure_hash"],
                "engine":"quantum-espresso",
                "engine_version":parsed["qe_version"],
                "energy_ry":parsed["energy_ry"],
                "energy_ev":parsed["energy_ev"],
                "total_force_ry_bohr":parsed["total_force_ry_bohr"],
                "scf_converged":parsed["scf_converged"],
                "job_done":parsed["job_done"],
                "functional_declared":"PBE",
                "pseudopotentials":upf,
                "input_sha256":input_sha,"output_sha256":output_sha,
                "scientific_convergence_study_completed":False
            }
    except (OSError,ValueError,subprocess.SubprocessError) as exc:
        error=(str(exc) or type(exc).__name__)[:500]
        status="failed"
        if process is not None and process.poll() is None:
            _kill_group(process)
    finally:
        store.set_result(job_id,status,result=result,error=error,
                         input_sha=input_sha,output_sha=output_sha)


def _limits(cpu_seconds=4000):
    # Container memory/cpu/disk/pid limits provide the primary isolation.
    resource.setrlimit(resource.RLIMIT_CPU,(cpu_seconds,cpu_seconds))
    resource.setrlimit(resource.RLIMIT_FSIZE,(2*1024**3,2*1024**3))
    resource.setrlimit(resource.RLIMIT_NOFILE,(256,256))


def _kill_group(process):
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid,signal.SIGKILL)
    except ProcessLookupError:
        pass


def main():
    root=Path(os.getenv("QE_JOBS_ROOT","/var/lib/qe"))
    profiles=Path(os.getenv("QE_PROFILES_DIR","/profiles"))
    pseudo=Path(os.getenv("QE_PSEUDOS_DIR","/pseudos"))
    store=JobStore(root)
    store.interrupted()
    while True:
        task=store.claim()
        if task is None:
            time.sleep(1)
            continue
        execute(store,task,profiles_dir=profiles,pseudo_dir=pseudo,
                timeout=int(os.getenv("QE_JOB_TIMEOUT","3600")))


if __name__=="__main__":
    main()
