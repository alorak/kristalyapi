"""D4 executes the existing QE pipeline in one cancellable process group."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from job_core import canonical_request,load_profile,make_pw_input
from electronic_core import scf_request,path_text,checked_band_capacity
from relax_worker import digest,Stopped


def execute_electronic(store,job,*,qe_binary,profiles_dir,pseudo_dir,timeout,limits,kill,
                       bands_x="bands.x",dos_x="dos.x",projwfc_x="projwfc.x"):
    jid=job["id"];root=store.root/"runs"/jid
    process=None;status="failed";result=None;error=None;input_sha=None;output_sha=None
    try:
        if store.get(jid)["cancel_requested"]:raise Stopped("cancelled","Electronic job cancelled")
        request,fingerprint=canonical_request(json.loads(job["request_json"]))
        if fingerprint!=job["structure_hash"]:raise ValueError("Electronic source hash mismatch")
        upf=load_profile(request,Path(profiles_dir),Path(pseudo_dir))
        capacity=checked_band_capacity(request,upf,Path(pseudo_dir))
        root.mkdir(parents=True,exist_ok=False);(root/"pseudo").mkdir()
        for meta in upf.values():
            target=root/"pseudo"/meta["file"];shutil.copyfile(Path(pseudo_dir)/meta["file"],target)
            if digest(target)!=meta["sha256"]:raise ValueError("Staged electronic UPF mismatch")
        source,_=scf_request(request)
        (root/"source.in").write_text(make_pw_input(source,upf),encoding="utf-8")
        (root/"band-path.txt").write_text(path_text(request),encoding="ascii")
        input_sha=digest(root/"source.in")
        script=Path(__file__).resolve().parent/"qe_pipeline.py"
        if not script.exists():script=Path(__file__).resolve().parents[1]/"tools/qe_pipeline.py"
        argv=[sys.executable,str(script),"--input",str(root/"source.in"),"--pseudo-dir",str(root/"pseudo"),
              "--workdir",str(root/"pipeline"),"--band-path",str(root/"band-path.txt"),
              "--nbnd",str(request["electronic"]["nbnd"]),"--nscf-k",str(request["electronic"]["nscf_k"]),
              "--pw",qe_binary,"--bands-x",bands_x,"--dos-x",dos_x,"--projwfc-x",projwfc_x,
              "--timeout",str(max(1,int(timeout))),"--pdos","--run"]
        if 'dos' in request['electronic']:
            p=request['electronic']['dos']
            for flag,key in [('--dos-delta-e','delta_e_ev'),('--dos-degauss','degauss_ry'),
                             ('--dos-emin','energy_min_ev'),('--dos-emax','energy_max_ev')]:
                argv.extend([flag,str(p[key])])
        with (root/"pipeline.stdout").open("wb") as out,(root/"pipeline.stderr").open("wb") as err:
            process=subprocess.Popen(argv,cwd=root,stdout=out,stderr=err,start_new_session=True,
                env={**os.environ,"OMP_NUM_THREADS":"2"},preexec_fn=limits)
            deadline=time.monotonic()+timeout
            while process.poll() is None:
                if store.get(jid)["cancel_requested"]:raise Stopped("cancelled","Electronic pipeline cancelled")
                if time.monotonic()>=deadline:raise Stopped("timed_out",f"Electronic pipeline exceeded its {timeout:g} s wall-time limit")
                time.sleep(.2)
            if process.wait(timeout=10)!=0:
                failure=root/"pipeline/pipeline.json"
                detail="inspect retained stage logs"
                if failure.is_file() and failure.stat().st_size<=32_000_000:
                    detail=str(json.loads(failure.read_text()).get("error",detail))[:300]
                raise ValueError("Electronic pipeline failed: "+detail)
        manifest_path=root/"pipeline/pipeline.json";data_path=root/"pipeline/electronic-results.json"
        if manifest_path.stat().st_size>32_000_000 or data_path.stat().st_size>24_000_000:
            raise ValueError("Electronic result exceeds bounded API size")
        manifest=json.loads(manifest_path.read_text());electronic=json.loads(data_path.read_text())
        if manifest.get('dos_settings')!=request['electronic'].get('dos'):
            raise ValueError('Pipeline DOS settings differ from the validated request')
        required={"scf","bands","bands_pp","nscf","dos","projwfc"}
        if manifest["status"]!="completed" or set(manifest["steps"])!=required or any(
                step["status"]!="completed" for step in manifest["steps"].values()):
            raise ValueError("Electronic pipeline incomplete")
        for element,meta in upf.items():
            if manifest["pseudopotentials"][element]["sha256"]!=meta["sha256"]:
                raise ValueError("Pipeline UPF provenance mismatch")
        scf_raw=(root/"pipeline/scf.out").read_text(errors="replace")
        errors=re.findall(r"estimated scf accuracy\s*<\s*([0-9.eEdD+-]+)\s*Ry",scf_raw)
        if not errors or not 0<=float(errors[-1].replace('D','E').replace('d','e'))<=1e-8 or 'convergence NOT achieved' in scf_raw:
            raise ValueError("Electronic source SCF accuracy failed")
        proof=manifest["steps"]["scf"]
        output_sha=digest(root/"pipeline/scf.out")
        artifacts={p.name:digest(p) for p in (root/"pipeline").iterdir()
                   if p.is_file() and (p.suffix in {".in",".out",".txt",".dat",".gnu",".json"} or p.name.startswith("pdos."))}
        result={"schema":"kristalyapi.qe-electronic-job-result.v1","job_id":jid,"structure_hash":fingerprint,
            "structure":request["structure"],"engine":"quantum-espresso","engine_version":proof["qe_version"],
            "scf_converged":True,"job_done":True,"energy_ry":proof["energy_ry"],"energy_ev":proof["energy_ev"],
            "total_force_ry_bohr":proof["total_force_ry_bohr"],"pseudopotentials":upf,
            "input_sha256":input_sha,"output_sha256":output_sha,"electronic_settings":request["electronic"],
            "pipeline_steps":manifest["steps"],"artifact_sha256":artifacts,"electronic":electronic,
            "electronic_preflight":capacity,
            "scientific_convergence_study_completed":False}
        status="completed"
    except Stopped as exc:status,error=exc.status,str(exc)
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        status,error="failed",str(exc)[:500]
    finally:
        if process is not None and process.poll() is None:
            kill(process)
            try:process.wait(timeout=10)
            except subprocess.SubprocessError:pass
        store.set_result(jid,status,result=result,error=error,input_sha=input_sha,output_sha=output_sha)
