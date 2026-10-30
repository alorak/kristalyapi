#!/usr/bin/env python3
"""D5.3 single-case, operator-opt-in resource pilot (QE nstep=0 ONLY).

Default is plan-only and NEVER starts Docker/QE. --execute and
--acknowledge-resource-risk are both required for a real operator run.
No relaxation, SCF energy, convergence or scientific acceptance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import time

import qe_defect_init as old
import qe_defect_prepare as prep
import qe_defect_resource_review as review

SCHEMA = "kristalyapi.qe-d5-metered-init-pilot.v1"
IMAGE = re.compile(r"sha256:[a-f0-9]{64}\Z")
SHA = re.compile(r"[a-f0-9]{64}\Z")
CASE_IDS = review.IDS
# The container reads cgroup-v2 metrics. If unavailable, status remains
# incomplete_evidence; no observed peak is fabricated from Docker output.
WRAPPER = r'''
import json,os,resource,subprocess,time
from pathlib import Path

root=Path("/sys/fs/cgroup")
def number(name):
    try:
        raw=(root/name).read_text().strip()
        return int(raw) if raw.isdigit() else None
    except (OSError,ValueError):return None
def cpu_usage():
    try:
        for line in (root/"cpu.stat").read_text().splitlines():
            if line.startswith("usage_usec "):return int(line.split()[1])
    except (OSError,ValueError):pass
    return None
def scratch_used():
    try:
        s=os.statvfs("/work")
        return (s.f_blocks-s.f_bfree)*s.f_frsize
    except OSError:return None
def events():
    try:
        return dict((k,int(v)) for k,v in (line.split() for line in
            (root/"memory.events").read_text().splitlines()) if v.isdigit())
    except (OSError,ValueError):return {}

start=time.monotonic()
before=events();before_cpu=cpu_usage()
base_scratch=scratch_used();max_scratch=base_scratch
peak=number("memory.peak");limit=number("memory.max");swap=number("memory.swap.max")
os.mkdir("/work/tmp")
with open("/evidence/initialization.out","wb") as stdout,open("/evidence/initialization.stderr","wb") as stderr:
    child=subprocess.Popen(["pw.x","-in","/inputs/initialization.in"],
                           cwd="/work",stdout=stdout,stderr=stderr,
                           env={**os.environ,"OMP_NUM_THREADS":os.environ["OMP_NUM_THREADS"]})
    while child.poll() is None:
        p=number("memory.peak");peak=max([v for v in (p,peak) if v is not None],default=None)
        used=scratch_used()
        if used is not None:max_scratch=max(max_scratch or 0,used)
        time.sleep(.2)
    rc=child.wait()
peak=max([v for v in (number("memory.peak"),peak) if v is not None],default=None)
used=scratch_used()
if used is not None:max_scratch=max(max_scratch or 0,used)
after=events();after_cpu=cpu_usage()
metrics={
 "schema":"kristalyapi.qe-d5-container-metrics.v1",
 "measurement":"cgroup v2 memory.peak includes container processes/page cache and tmpfs; not QE process RSS",
 "memory_peak_bytes":peak,"memory_limit_bytes":limit,"swap_limit_bytes":swap,
 "oom_kill_delta":max(0,after.get("oom_kill",0)-before.get("oom_kill",0)) if
    "oom_kill" in before and "oom_kill" in after else None,
 "cpu_usage_usec_delta":after_cpu-before_cpu if before_cpu is not None and after_cpu is not None else None,
 "scratch_used_peak_bytes":max_scratch-base_scratch if
    max_scratch is not None and base_scratch is not None else None,
 "elapsed_seconds":round(time.monotonic()-start,3),
 "qe_returncode":rc
}
with open("/evidence/container-metrics.json","x",encoding="utf-8") as f:
    json.dump(metrics,f,allow_nan=False)
raise SystemExit(rc)
'''


def sha(data):
    return hashlib.sha256(data).hexdigest()


def command(args, timeout=90):
    return subprocess.check_output(args, stderr=subprocess.STDOUT, timeout=timeout)


def checked_settings(case, image, architecture, memory_gib, scratch_gib, cpus, timeout_seconds):
    if case not in CASE_IDS:
        raise ValueError("Choose one pinned D5 case")
    if not isinstance(image,str) or not IMAGE.fullmatch(image):
        raise ValueError("Exact local image SHA-256 required (no tag/pull)")
    if architecture not in ("arm64","amd64"):
        raise ValueError("Explicit expected Docker image architecture required")
    if (type(memory_gib) is not int or not 16 <= memory_gib <= 512 or
        type(scratch_gib) is not int or not 1 <= scratch_gib <= 64 or
        scratch_gib * 2 >= memory_gib or
        type(cpus) is not int or not 1 <= cpus <= 32 or
        type(timeout_seconds) is not int or not 30 <= timeout_seconds <= 900):
        raise ValueError("Unsafe/unbounded memory, tmpfs, CPU or timeout")
    return {"case":case,"image_id":image,"architecture":architecture,
            "memory_bytes":memory_gib * 1024**3,
            "scratch_tmpfs_bytes":scratch_gib * 1024**3,
            "cpus":cpus,"timeout_seconds":timeout_seconds,
            "nbnd":old.NBND, "nstep":0,
            "execution_scope":"one QE initialization-only case; no SCF/relaxation"}


def pinned_input(case, prepared=review.PREPARED, plan_path=review.PLAN):
    # Verify the earlier frozen source and the prepared output before
    # generating any new input or contacting Docker.
    reviewed=review.verify_and_plan()
    plan=json.loads(Path(plan_path).read_text())
    reference=prep.load_reference(plan)
    prep.verify_bundle(Path(prepared),plan,reference)
    bundle=json.loads((Path(prepared)/"preparation.json").read_text())
    cases={c["id"]:c for c in bundle["cases"]}
    selected=cases[case]
    profile=json.loads((Path(prepared)/"operator-profile.json").read_text())["elements"]
    pseudos={e:profile[e] for e in {atom["element"] for atom in selected["sites"]}}
    rendered=old.initialization_input(selected,pseudos)
    return rendered,pseudos,selected,reviewed


def checked_pseudos(path, pseudos):
    path=Path(path)
    if path.is_symlink() or not path.is_dir():
        raise ValueError("Unsafe UPF directory")
    found={}
    for element,info in sorted(pseudos.items()):
        name=info["file"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}[.]UPF",name) or ".." in name:
            raise ValueError("Invalid pinned UPF name")
        file=path/name
        if file.is_symlink() or not file.is_file() or not 20<=file.stat().st_size<=20_000_000:
            raise ValueError("Missing/unsafe pinned UPF: "+element)
        digest=sha(file.read_bytes())
        if digest!=info["sha256"]:
            raise ValueError("UPF SHA-256 mismatched: "+element)
        found[element]={"filename":name,"sha256":digest}
    return found


def inspect_image(image, arch, memory_bytes, cpus):
    items=json.loads(command(["docker","image","inspect",image]))
    if len(items)!=1 or items[0].get("Id")!=image or items[0].get("Architecture")!=arch:
        raise ValueError("Docker image ID or CPU architecture changed")
    info=json.loads(command(["docker","info","--format","{{json .}}"]))
    # Docker Desktop/remote Engine capacity, not an assertion of memory
    # availability. Real admissions must be checked again by Docker.
    if type(info.get("MemTotal")) is not int or info["MemTotal"]<memory_bytes or (
        type(info.get("NCPU")) is not int or info["NCPU"]<cpus):
        raise ValueError("Docker Engine cannot expose requested memory/CPU budget")
    return {"image_id":items[0]["Id"],"architecture":items[0]["Architecture"],
            "daemon_memory_total_bytes":info["MemTotal"],"daemon_cpus":info["NCPU"],
            "capacity_is_not_free_memory":True}


def make_docker_create(settings, evidence, inputs, pseudos, name):
    # Caller owns an empty, new output directory. All user-controllable
    # paths are Docker argv values, never shell strings.
    return ["docker","create","--name",name,"--network","none",
        "--read-only","--no-healthcheck",
        "--memory",str(settings["memory_bytes"]),
        "--memory-swap",str(settings["memory_bytes"]),
        "--cpus",str(settings["cpus"]),"--pids-limit","128",
        "--security-opt","no-new-privileges:true","--cap-drop","ALL",
        "--tmpfs","/tmp:rw,nosuid,noexec,size=64m",
        "--tmpfs","/work:rw,nosuid,size="+str(settings["scratch_tmpfs_bytes"])+",mode=1777",
        "--workdir","/work",
        "--user",str(os.getuid())+":"+str(os.getgid()),
        "--mount",f"type=bind,src={inputs},dst=/inputs,readonly",
        "--mount",f"type=bind,src={pseudos},dst=/pseudos,readonly",
        "--mount",f"type=bind,src={evidence},dst=/evidence",
        "--env","OMP_NUM_THREADS="+str(settings["cpus"]),"--env","PYTHONDONTWRITEBYTECODE=1",
        "--env","HOME=/tmp",settings["image_id"],"python3","-c",WRAPPER]


def check_container_config(info, settings):
    config=info.get("HostConfig") or {}
    state=info.get("State") or {}
    if (config.get("Memory")!=settings["memory_bytes"] or
        config.get("MemorySwap")!=settings["memory_bytes"] or
        config.get("NanoCpus")!=settings["cpus"]*10**9 or
        config.get("NetworkMode")!="none" or config.get("ReadonlyRootfs") is not True or
        config.get("PidsLimit")!=128 or
        state.get("ExitCode") is None or type(state.get("OOMKilled")) is not bool):
        raise ValueError("Actual container resources/isolation differ from pinned settings")
    return {"exit_code":state["ExitCode"],"oom_killed":state["OOMKilled"],
            "docker_started_at":state.get("StartedAt"),
            "docker_finished_at":state.get("FinishedAt"),
            "memory_bytes":config["Memory"],"memory_swap_bytes":config["MemorySwap"],
            "nano_cpus":config["NanoCpus"],"network":config["NetworkMode"],
            "read_only":True,"pids_limit":128}


def evaluated_status(report, output, metrics, prepared_case):
    if report.get("timed_out"):
        return "timed_out"
    if report.get("oom_killed") or (metrics or {}).get("oom_kill_delta",0)>0:
        return "oom_observed"
    if report.get("exit_code")!=0:
        return "failed"
    try:
        old.initialization_proof(output,prepared_case,report["exit_code"],False)
    except ValueError:
        return "invalid_initialization_proof"
    if (not isinstance(metrics,dict) or
        metrics.get("schema")!="kristalyapi.qe-d5-container-metrics.v1" or
        type(metrics.get("memory_peak_bytes")) is not int or
        not 0<metrics["memory_peak_bytes"]<=report["memory_bytes"] or
        metrics.get("memory_limit_bytes")!=report["memory_bytes"] or
        metrics.get("swap_limit_bytes")!=0 or
        type(metrics.get("cpu_usage_usec_delta")) is not int or
        metrics["cpu_usage_usec_delta"]<0 or
        type(metrics.get("scratch_used_peak_bytes")) is not int or
        metrics["scratch_used_peak_bytes"]<0 or
        type(metrics.get("elapsed_seconds")) not in (int,float) or
        not 0<=metrics["elapsed_seconds"]<=report["timeout_seconds"]+5 or
        metrics.get("qe_returncode")!=0 or
        metrics.get("oom_kill_delta") not in (None,0)):
        return "incomplete_resource_evidence"
    return "initialized_only_metered"


def run_pilot(settings, target, pseudos_dir, rendered, pseudo_hashes, selected, daemon):
    output=Path(target).resolve()
    if output.exists() or output.is_symlink():
        raise ValueError("New output directory required; refusing overwrite")
    output.mkdir(parents=True)
    inputs=output/"inputs";evidence=output/"evidence"
    inputs.mkdir();evidence.mkdir()
    (inputs/"initialization.in").write_text(rendered,encoding="utf-8")
    name="kristalyapi-d5-meter-"+secrets.token_hex(8)
    report={"schema":SCHEMA,"settings":settings,"source_preparation_sha256":review.PREPARED_SHA,
        "source_pilot_commit":review.PILOT_COMMIT,
        "daemon":daemon,"upf_sha256":pseudo_hashes,"calculation_performed":False,
        "scientific_convergence_accepted":False,"full_scf_resource_validated":False,
        "initialization_only":True,"container_removed":False,"status":"failed",
        "cgroup_memory_peak_bytes":None,"timeout_seconds":settings["timeout_seconds"],
        "runner_script_sha256":sha(Path(__file__).read_bytes())}
    container=None;process=None
    try:
        argv=make_docker_create(settings,evidence,inputs,pseudos_dir,name)
        container=command(argv).decode().strip()
        if not re.fullmatch(r"[a-f0-9]{64}",container):
            raise ValueError("Unrecognized Docker created container ID")
        start=time.monotonic()
        with (evidence/"docker-start.stdout").open("wb") as out,(
                evidence/"docker-start.stderr").open("wb") as err:
            process=subprocess.Popen(["docker","start","-a",container],stdout=out,stderr=err)
            try:
                process.wait(timeout=settings["timeout_seconds"])
            except subprocess.TimeoutExpired:
                report["timed_out"]=True
                command(["docker","kill",container],timeout=20)
                process.wait(timeout=20)
        report["operator_elapsed_seconds"]=round(time.monotonic()-start,3)
        inspected=json.loads(command(["docker","inspect",container]))[0]
        evidence_record=check_container_config(inspected,settings)
        report.update(evidence_record)
        metrics_path=evidence/"container-metrics.json"
        metrics=None
        if metrics_path.is_file() and not metrics_path.is_symlink() and metrics_path.stat().st_size<=8192:
            metrics=json.loads(metrics_path.read_text())
        report["resource_measurements"]=metrics
        stdout_path=evidence/"initialization.out"
        text=stdout_path.read_text(errors="replace") if stdout_path.is_file() and stdout_path.stat().st_size<2_000_000 else ""
        report["raw_qe_diagnostics"]=old.initialization_diagnostics(text)
        report["calculation_performed"]=any(report["raw_qe_diagnostics"][field] for field in
                                           ("has_energy","has_scf_convergence","scf_started"))
        report["status"]=evaluated_status(report,text,metrics,selected)
        report["cgroup_memory_peak_bytes"]=metrics.get("memory_peak_bytes") if (
            isinstance(metrics,dict) and type(metrics.get("memory_peak_bytes")) is int) else None
        if report["calculation_performed"]:
            report["status"]="unexpected_scf_execution"
    except (OSError,ValueError,TypeError,KeyError,subprocess.SubprocessError) as exc:
        report["error"]=str(exc)[:400]
        report["status"]="failed"
    finally:
        if process is not None and process.poll() is None:
            try: command(["docker","kill",container],timeout=20)
            except (OSError,subprocess.SubprocessError):pass
            try: process.wait(timeout=20)
            except (OSError,subprocess.SubprocessError):pass
        if container is not None:
            try:
                command(["docker","rm","-f",container],timeout=30)
                report["container_removed"]=True
            except (OSError,subprocess.SubprocessError) as exc:
                report["cleanup_error"]=str(exc)[:200]
        if not report["container_removed"]:
            report["status"]="cleanup_unverified"
        report["artifact_sha256"]={}
        for folder in (inputs,evidence):
            for file in folder.iterdir():
                if file.is_symlink() or not file.is_file() or file.stat().st_size>2_000_000:
                    report["status"]="evidence_unsafe_or_oversized"
                    continue
                report["artifact_sha256"][str(file.relative_to(output))]=sha(file.read_bytes())
        (output/"report.json").write_text(json.dumps(report,indent=2,allow_nan=False)+"\n")
    return report


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case",choices=CASE_IDS,default="pristine")
    parser.add_argument("--memory-gib",type=int,
                        help="Hypothetical unless --execute is given; NOT proven sufficient")
    parser.add_argument("--scratch-gib",type=int,default=4)
    parser.add_argument("--cpus",type=int,default=2)
    parser.add_argument("--timeout-seconds",type=int,default=180)
    parser.add_argument("--image")
    parser.add_argument("--architecture",choices=("arm64","amd64"))
    parser.add_argument("--pseudo-dir",type=Path)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--execute",action="store_true")
    parser.add_argument("--acknowledge-resource-risk",action="store_true")
    args=parser.parse_args(argv)
    try:
        settings=checked_settings(args.case,
                                  args.image if args.image is not None else review.IMAGE_ID,
                                  args.architecture if args.architecture is not None else "arm64",
                                  args.memory_gib if args.memory_gib is not None else 96,
                                  args.scratch_gib,args.cpus,args.timeout_seconds)
        rendered,profile,candidate,old_review=pinned_input(args.case)
        planned={"schema":SCHEMA,"status":"plan_only","settings":settings,
            "initialization_input_sha256":sha(rendered.encode()),
            "original_oom_at_6_gib":True,
            "review_source_schema":old_review["schema"],
            "source_preparation_sha256":review.PREPARED_SHA,
            "no_qe_or_docker_executed":True,
            "full_scf_resource_validated":False}
        if not args.execute:
            if args.acknowledge_resource_risk:
                raise ValueError("Acknowledgement without --execute is invalid")
            print(json.dumps(planned,indent=2))
            return 0
        if (not args.acknowledge_resource_risk or args.output is None or
            args.pseudo_dir is None or args.memory_gib is None or
            args.image is None or args.architecture is None):
            raise ValueError("--execute requires explicit risk acknowledgement, output, UPFs, memory GiB, image SHA and architecture")
        pseudo_dir=args.pseudo_dir.resolve()
        verified=checked_pseudos(pseudo_dir,profile)
        if args.output.exists() or args.output.is_symlink():
            raise ValueError("Output already exists; must be new")
        daemon=inspect_image(args.image,args.architecture,settings["memory_bytes"],args.cpus)
        outcome=run_pilot(settings,args.output,pseudo_dir,rendered,verified,candidate,daemon)
        print(json.dumps({"status":outcome["status"],"output":str(args.output),
                          "initialization_only":True,"calculation_performed":outcome["calculation_performed"]}))
        return 0 if outcome["status"]=="initialized_only_metered" else 1
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        parser.exit(1,"D5.3 pilot rejected: "+str(exc)+"\n")


if __name__=="__main__":
    raise SystemExit(main())
