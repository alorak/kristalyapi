#!/usr/bin/env python3
"""Explicit opt-in bounded local Quantum ESPRESSO bulk SCF/bands runner.

This is NOT a sandbox. Only run a trusted local pw.x binary in an operator-owned
isolated environment. Results undergo independent raw-file re-verification and
NEVER gain scientific acceptance automatically.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import signal
import subprocess
import time
from pathlib import Path

from qe_bulk_validation import artifact, qe_input, verify, require

PLAN = "kristalyapi.qe-bulk-run-plan.v1"
STAGES = ("baseline", "ecut-refined", "k-refined", "bands")
CONFIG = {
    "prefix": "bulk",
    "pseudo_dir": "./pseudo",
    "outdir": "./scratch",
}
MAX_STDOUT = 8_000_000
MAX_PLAN = 150_000


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exact_control(input_text, key, value):
    # Match only explicit &CONTROL assignments; never allow prefix/outdir/pseudo
    # to refer to arbitrary host paths or stored jobs from unrelated workflows.
    block = re.search(r"&CONTROL\s*(.*?)/", input_text, re.I | re.S)
    require(block is not None, "QE input must contain explicit &CONTROL")
    found = re.findall(r"\b" + re.escape(key) + r"\s*=\s*['\"]([^'\"]*)['\"]",
                       block.group(1), re.I)
    require(len(found) == 1 and found[0] == value,
            "QE &CONTROL " + key + " must be exactly " + value)


def prepare(plan_path):
    plan_path = Path(plan_path).resolve()
    require(plan_path.is_file() and plan_path.stat().st_size <= MAX_PLAN,
            "Invalid or oversized bulk execution plan")
    data = json.loads(plan_path.read_text(encoding="utf8"))
    require(data.get("schema") == PLAN, "Unrecognized QE bulk run plan")
    require(data.get("material") in ("GaN", "AlN", "SiC"), "GaN/AlN/SiC only")
    require(isinstance(data.get("polytype_claim"), str) and data["polytype_claim"].strip(),
            "Polytype claim must be declared")
    root = plan_path.parent
    structure = artifact(root, data.get("structure_reference"))
    pseudo = data.get("pseudopotentials")
    expected = {"GaN":{"Ga","N"},"AlN":{"Al","N"},"SiC":{"Si","C"}}[data["material"]]
    require(isinstance(pseudo, dict) and set(pseudo) == expected, "Missing binary-material UPF")
    originals = {element:artifact(root,ref) for element,ref in pseudo.items()}
    filenames = [path.name for path in originals.values()]
    require(len(set(filenames)) == len(filenames) and
            all(re.fullmatch(r"[A-Za-z0-9._-]{1,110}\.upf",name,re.I) for name in filenames),
            "UPF basenames must be unique safe files")
    runs = data.get("runs")
    require(isinstance(runs,dict) and set(runs)==set(STAGES),
            "All SCF and band stages must be specified")
    parsed = {}
    sources = {}
    for name in STAGES:
        config=runs[name]
        require(isinstance(config,dict) and set(config)=={"input"},
                "Each stage must contain only an input file reference")
        source=artifact(root,config["input"])
        text=source.read_text(encoding="utf8")
        stage="bands" if name=="bands" else "scf"
        parsed[name]=qe_input(text,stage)
        require(parsed[name]["atomic_species_pseudos"] ==
                {element:path.name for element,path in originals.items()},
                "Input pseudopotentials do not match pinned UPF filenames")
        for key,value in CONFIG.items():
            exact_control(text,key,value)
        sources[name]=source
    baseline=parsed["baseline"]
    require(all(p["geometry_text"]==baseline["geometry_text"] for p in parsed.values()),
            "Bulk structures differ between stages")
    require(all(p["nat"]==baseline["nat"] for p in parsed.values()),
            "Bulk nat differs between stages")
    refined=parsed["ecut-refined"]
    dense=parsed["k-refined"]
    bands=parsed["bands"]
    require(refined["mesh"]==baseline["mesh"] and
            refined["cutoffs_ry"]["ecutwfc"]>baseline["cutoffs_ry"]["ecutwfc"] and
            dense["cutoffs_ry"]==baseline["cutoffs_ry"] and
            dense["mesh"]!=baseline["mesh"] and
            all(k>=b for k,b in zip(dense["mesh"],baseline["mesh"])) and
            bands["cutoffs_ry"]==baseline["cutoffs_ry"],
            "Incomplete independent cutoff/3D k-mesh refinement design")
    thresholds=data.get("criteria")
    require(isinstance(thresholds,dict), "Preregistered numerical criteria required")
    tolerance=thresholds.get("max_energy_delta_mev_per_atom")
    residual=thresholds.get("max_scf_accuracy_ry")
    require(type(tolerance) in (float,int) and math.isfinite(tolerance) and 0<tolerance<=20 and
            type(residual) in (float,int) and math.isfinite(residual) and 0<residual<=1e-4,
            "Invalid preregistered convergence criteria")
    return {"plan":data,"planPath":plan_path,"structure":structure,
            "pseudopotentials":originals,"inputs":sources}


def stop_process(process):
    try:
        os.killpg(process.pid,signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def bounded_pw(binary,workdir,source,target,deadline):
    with source.open("rb") as input_stream, target.open("xb") as output:
        process=subprocess.Popen([str(binary)],cwd=workdir,stdin=input_stream,
                                  stdout=output,stderr=subprocess.STDOUT,
                                  start_new_session=True,close_fds=True,
                                  env={**os.environ,"OMP_NUM_THREADS":"1",
                                       "ESPRESSO_PSEUDO":str(workdir/"pseudo"),
                                       "ESPRESSO_TMPDIR":str(workdir/"scratch")})
        try:
            while process.poll() is None:
                if time.monotonic()>deadline:
                    raise TimeoutError("QE bulk run exceeded total wall-clock limit")
                if target.stat().st_size > MAX_STDOUT:
                    raise ValueError("QE bulk output exceeded 8 MB limit")
                time.sleep(.1)
            code=process.wait()
        except BaseException:
            stop_process(process)
            raise
        require(code==0,"QE subprocess failed with exit status "+str(code))
    require(target.stat().st_size<=MAX_STDOUT,"QE output exceeds 8 MB limit")
    output=target.read_text(encoding="utf8",errors="replace")
    require("JOB DONE." in output and "Error in routine" not in output and
            "convergence NOT achieved" not in output,
            "QE step did not finish successfully")


def execute(plan_path,output_dir,qe_binary,timeout_seconds,enabled=False):
    require(enabled,"Local QE execution requires the explicit --execute flag")
    require(type(timeout_seconds) in (int,float) and math.isfinite(timeout_seconds) and
            1<=timeout_seconds<=14400,"Total wall time must be within 1–14400 seconds")
    source=prepare(plan_path)
    output_dir=Path(output_dir).resolve()
    require(not output_dir.exists() and not output_dir.is_symlink(),
            "Output must be a fresh directory; existing data are never overwritten")
    binary=Path(qe_binary).resolve()
    require(binary.is_file() and os.access(binary,os.X_OK),
            "QE binary must be an explicitly supplied executable file")
    require(output_dir != source["planPath"].parent and
            not source["planPath"].is_relative_to(output_dir),
            "Unsafe output directory")
    out=source["plan"]
    output_dir.mkdir(parents=True,mode=0o700)
    (output_dir/"stages").mkdir()
    (output_dir/"pseudo").mkdir()
    (output_dir/"scratch").mkdir()
    (output_dir/"reference").mkdir()
    original=source["structure"]
    shutil.copyfile(original,output_dir/"reference"/original.name)
    pseudoref={}
    for element,path in source["pseudopotentials"].items():
        destination=output_dir/"pseudo"/path.name
        shutil.copyfile(path,destination)
        pseudoref[element]={"path":"pseudo/"+path.name,
                           "sha256":digest(destination)}
    manifest={"schema":"kristalyapi.qe-bulk-evidence.v1",
              "material":out["material"],"polytype_claim":out["polytype_claim"],
              "criteria":out["criteria"],
              "structure_reference":{"path":"reference/"+original.name,
                                     "sha256":digest(output_dir/"reference"/original.name)},
              "pseudopotentials":pseudoref,"runs":{}}
    for name in STAGES:
        src=source["inputs"][name]
        path=output_dir/"stages"/(name+".in")
        shutil.copyfile(src,path)
        manifest["runs"][name]={"input":{"path":"stages/"+name+".in","sha256":digest(path)},
                                "output":{"path":"stages/"+name+".out","sha256":""}}
    deadline=time.monotonic()+timeout_seconds
    for name in STAGES:
        input_path=output_dir/"stages"/(name+".in")
        output_path=output_dir/"stages"/(name+".out")
        bounded_pw(binary,output_dir,input_path,output_path,deadline)
        manifest["runs"][name]["output"]["sha256"]=digest(output_path)
    manifest_path=output_dir/"manifest.json"
    manifest_path.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
    report=verify(manifest_path)
    report["localExecution"]={"executedBinarySha256":digest(binary),
       "declaredExecutablePath":str(binary),
       "sourcePlanSha256":digest(source["planPath"]),
       "realQeBinaryIdentityAuthenticated":False,
       "independentScientificReproduction":False,
       "note":"Execution of user-selected binary was observed; this does not authenticate it as genuine Quantum ESPRESSO."}
    (output_dir/"review.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan",type=Path,required=True)
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--qe-binary",type=Path,required=True)
    parser.add_argument("--timeout-seconds",type=float,default=3600)
    parser.add_argument("--execute",action="store_true",
                        help="Explicitly opt into running the selected local binary")
    args=parser.parse_args()
    report=execute(args.plan,args.output_dir,args.qe_binary,args.timeout_seconds,args.execute)
    print(json.dumps({"status":report["status"],
       "softwareNumericGatesPassed":report["software_numeric_gates_passed"],
       "scientificAcceptance":report["scientific_acceptance"],
       "review":str(args.output_dir.resolve()/"review.json")},indent=2))
    return 0 if report["software_numeric_gates_passed"] else 2


if __name__=="__main__":
    raise SystemExit(main())
