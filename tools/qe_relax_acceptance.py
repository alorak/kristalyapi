#!/usr/bin/env python3
"""D3 real MoS2 acceptance, gated on the passed source-fixed D2.2c evidence."""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import subprocess

from qe_scf_acceptance import require, sha, write_json, NUMBER, numeric, RY_TO_EV
import qe_mos2_acceptance as mos2
from qe_acceptance_runtime import Runtime

ROOT=mos2.ROOT
PLAN=ROOT/"tests/fixtures/qe/mos2-relax-acceptance.json"


def load_plan():
    plan=json.loads(PLAN.read_text())
    require(plan["schema"]=="kristalyapi.qe-mos2-relax-acceptance-plan.v1","Wrong D3 plan")
    return plan


def reference(plan,directory=None):
    directory=directory or ROOT/plan["reference"]["evidence_path"]
    require((directory/"summary.json").is_file(),"Passed D2.2c evidence is required before D3")
    mos2.verify_evidence(directory,plan["reference"]["protocol"])
    summary=json.loads((directory/"summary.json").read_text())
    require(summary["provenance"]["git_commit"]==plan["reference"]["source_commit"],"Wrong D2.2c source")
    selected=directory/"cases"/plan["reference"]["case"]
    req=json.loads((selected/"request.json").read_text())
    result=json.loads((selected/"result.json").read_text())
    return req,result,{"source_commit":summary["provenance"]["git_commit"],
        "summary_sha256":sha((directory/"summary.json").read_bytes()),
        "selected_result_sha256":sha((selected/"result.json").read_bytes()),
        "selected_output_sha256":result["output_sha256"]}


def make_relax_request(plan,initial):
    req=copy.deepcopy(initial)
    req["schema"]="kristalyapi.qe-relax-scf-job.v1"
    req["parameters"]["calculation"]="relax-scf"
    req["relaxation"]=copy.deepcopy(plan["relaxation"])
    return req


def expected_final_structure(request,raw):
    blocks=re.findall(r"(?is)Begin final coordinates(.*?)End final coordinates",raw)
    require(bool(blocks) and "CELL_PARAMETERS" not in blocks[-1],"Not a completed fixed-cell geometry")
    match=re.search(r"(?im)^\s*ATOMIC_POSITIONS\s+\(?crystal\)?\s*\n",blocks[-1])
    require(match is not None,"Expected fractional final coordinates")
    rows=[x.split() for x in blocks[-1][match.end():].strip().splitlines() if x.strip()]
    expected=request["structure"]["atoms"]
    require(len(rows)==len(expected) and all(len(x)==4 and x[0]==a["element"] for x,a in zip(rows,expected)),
            "Final geometry atom identity/order mismatch")
    structure=copy.deepcopy(request["structure"])
    structure["atoms"]=[{"element":row[0],"fractional":[numeric(x)%1 for x in row[1:]]} for row in rows]
    require(all(math.isfinite(x) for a in structure["atoms"] for x in a["fractional"]),"Nonfinite final geometry")
    return structure


def same_structure(a,b):
    shape=lambda s:len(s["cell_angstrom"])==3 and all(len(r)==3 for r in s["cell_angstrom"]) and all(len(x["fractional"])==3 for x in s["atoms"])
    return (shape(a) and shape(b) and a["periodic"] is b["periodic"] is True and len(a["atoms"])==len(b["atoms"]) and
        all(abs(x-y)<=1e-9 for row_a,row_b in zip(a["cell_angstrom"],b["cell_angstrom"]) for x,y in zip(row_a,row_b)) and
        all(x["element"]==y["element"] and all(abs((p-q+.5)%1-.5)<=1e-9
            for p,q in zip(x["fractional"],y["fractional"])) for x,y in zip(a["atoms"],b["atoms"])))


def raw_proof(path,request,stem,plan):
    inp=(path/(stem+".in")).read_bytes();out=(path/(stem+".out")).read_bytes()
    text=out.decode("utf-8");source=inp.decode("utf-8")
    require("JOB DONE." in text and "convergence NOT achieved" not in text and
            re.search(r"convergence has been achieved in\s+\d+\s+iterations",text) is not None,
            "Missing raw SCF completion")
    energies=re.findall(r"(?im)^\s*(?:!\s*total energy|Final energy)\s*=\s*("+NUMBER+r")\s*Ry",text)
    accuracy=re.findall(r"estimated scf accuracy\s*<\s*("+NUMBER+r")\s*Ry",text)
    electrons=re.search(r"number of electrons\s*=\s*("+NUMBER+r")",text)
    version=re.search(r"Program\s+PWSCF\s+v\.?(\S+)",text)
    require(energies and accuracy and electrons and version,"Missing raw energy/error/electron/version")
    energy,error=numeric(energies[-1]),numeric(accuracy[-1])
    require(math.isfinite(energy) and math.isfinite(error) and 0<=error<=plan["criteria"]["max_scf_accuracy_ry"] and
            numeric(electrons[1])==26,"Raw energy/error/electron gate failed")
    sections=text.rsplit("Forces acting on atoms",1)
    require(len(sections)==2,"Missing raw atom forces")
    # The first force block is total force; verbosity=high then prints contributions.
    block=re.split(r"(?m)^\s*(?:The\b|Total force\b)",sections[-1],maxsplit=1)[0]
    rows=re.findall(r"(?m)^\s*atom\s+(\d+)\s+type\s+(\d+)\s+force\s*=\s*"
        +r"\s+".join(["("+NUMBER+")"]*3)+r"\s*$",block)
    atoms=request["structure"]["atoms"];species=sorted({x["element"] for x in atoms})
    require(len(rows)==len(atoms),"Raw force atom count mismatch")
    forces=[]
    for index,(row,atom) in enumerate(zip(rows,atoms),1):
        require(int(row[0])==index and int(row[1])==species.index(atom["element"])+1,"Raw force identity mismatch")
        forces.append([numeric(x) for x in row[2:]])
    require(all(math.isfinite(x) for row in forces for x in row),"Nonfinite force")
    p=request["parameters"]
    for key,expected in [("ecutwfc",p["ecutwfc_ry"]),("ecutrho",p["ecutrho_ry"]),("nat",3),("conv_thr",1e-8)]:
        match=re.search(r"\b"+key+r"\s*=\s*("+NUMBER+r")",source)
        require(match is not None and math.isclose(numeric(match[1]),expected,rel_tol=1e-12),"Wrong raw input "+key)
    require("input_dft='PBE'" in source and "occupations='fixed'" in source and "nspin" not in source,"Wrong raw XC/spin/occupation")
    mesh=re.search(r"K_POINTS automatic\s*\n([^\n]+)",source)
    require(mesh is not None and list(map(int,mesh[1].split()))==p["kpoints"]+[0,0,0],"Raw k mesh mismatch")
    cards=re.search(r"CELL_PARAMETERS angstrom\s*\n([\s\S]+?)\nATOMIC_POSITIONS crystal\s*\n([\s\S]+?)\nK_POINTS",source)
    require(cards is not None,"Missing raw cell/atom cards")
    cell=[[numeric(x) for x in line.split()] for line in cards[1].strip().splitlines()]
    positions=[line.split() for line in cards[2].strip().splitlines()]
    observed={"periodic":True,"cell_angstrom":cell,"atoms":[{"element":row[0],"fractional":[numeric(x) for x in row[1:]]} for row in positions]}
    require(same_structure(observed,request["structure"]),"Raw input geometry differs from expected source")
    kind="relax" if stem=="relax" else "scf"
    require("calculation='"+kind+"'" in source,"Wrong calculation stage")
    if kind=="relax":
        require(re.search(r"bfgs converged",text,re.I) is not None and
                "ion_dynamics='bfgs'" in source and "&CELL" not in source,"Missing fixed-cell BFGS convergence")
        ionic=re.findall(r"(?m)^\s*!\s*total energy\s*=\s*("+NUMBER+r")\s*Ry",text)
        require(len(ionic)>=2 and abs(numeric(ionic[-1])-numeric(ionic[-2]))<=plan["relaxation"]["energy_threshold_ry"]+2e-8,
                "Last raw ionic energy change failed")
        for key,value in [("nstep",plan["relaxation"]["max_steps"]),("forc_conv_thr",plan["relaxation"]["force_threshold_ry_bohr"]),("etot_conv_thr",plan["relaxation"]["energy_threshold_ry"])]:
            match=re.search(r"\b"+key+r"\s*=\s*("+NUMBER+r")",source)
            require(match is not None and math.isclose(numeric(match[1]),value,rel_tol=1e-12),"Wrong ionic parameter "+key)
    return {"energy_ry":energy,"last_scf_accuracy_ry":error,"electrons":26,"qe_version":version[1],
        "forces_ry_bohr":forces,"max_force_component_ry_bohr":max(abs(x) for row in forces for x in row),
        "input_sha256":sha(inp),"output_sha256":sha(out)}


def identity(path,request,plan):
    result=json.loads((path/"result.json").read_text());trace=json.loads((path/"api.json").read_text())
    expected=mos2.structure_hash(request["structure"])
    jid=trace["submitted"]["job_id"]
    require(re.fullmatch(r"[a-f0-9]{32}",jid) and trace["terminal"]["job_id"]==result["job_id"]==jid,"Job identity mismatch")
    require(trace["submitted"]["status"]=="queued" and trace["terminal"]["status"]=="completed" and
            trace["validation"]["valid"] is True,"API job did not complete")
    require(all(x==expected for x in [result["structure_hash"],trace["submitted"]["structure_hash"],
        trace["terminal"]["structure_hash"],trace["validation"]["structure_hash"]]),"Source structure hash mismatch")
    for element,meta in plan["pseudopotentials"].items():
        require(result["pseudopotentials"][element]["sha256"]==trace["staged_upf_sha256"][element]==meta["reviewed_sha256"],"Staged UPF mismatch")
    require(result["engine"]=="quantum-espresso" and result["scf_converged"] is True and result["job_done"] is True,"Missing API solver status")
    return result


def derive(directory,plan,initial,initial_result):
    path=directory/"cases/relax-scf"
    request=make_relax_request(plan,initial)
    require(json.loads((path/"request.json").read_text())==request,"Relax request differs from fixed reference")
    result=identity(path,request,plan)
    require(result["schema"]=="kristalyapi.qe-relax-scf-result.v1" and result["geometry_converged"] is True,"Wrong pipeline result")
    geometry=expected_final_structure(request,(path/"relax.out").read_text())
    require(same_structure(result["initial_structure"],initial["structure"]) and same_structure(result["final_structure"],geometry),"Pipeline geometry differs from raw output")
    final_hash=mos2.structure_hash(result["final_structure"])
    require(result["final_structure_hash"]==result["stages"]["scf"]["structure_hash"]==final_hash,"Final structure hash mismatch")
    relax=raw_proof(path,request,"relax",plan)
    final_request=copy.deepcopy(initial);final_request["structure"]=result["final_structure"]
    final=raw_proof(path,final_request,"structure",plan)
    for name,digest in result["artifact_sha256"].items():
        require(name in {"relax.in","relax.out","relax.stderr","structure.in","structure.out","structure.stderr"} and
                sha((path/name).read_bytes())==digest,"Pipeline artifact hash mismatch")
    require(len(result["artifact_sha256"])==6,"Missing stage artifact hashes")
    require(result["input_sha256"]==final["input_sha256"] and result["output_sha256"]==final["output_sha256"],"Final SCF hash mismatch")
    for proof,api in [(relax,result["stages"]["relax"]),(final,result)]:
        require(abs(proof["energy_ry"]-api["energy_ry"])<=1e-8 and
            abs(proof["energy_ry"]*RY_TO_EV-api["energy_ev"])<=1e-7 and proof["qe_version"]==result["engine_version"],"Raw/API energy/version mismatch")
    for proof,api in [(relax,result["stages"]["relax"]),(final,result["stages"]["scf"])]:
        require(len(api["forces_ry_bohr"])==3 and all(len(row)==3 for row in api["forces_ry_bohr"]) and
                all(abs(x-y)<=1e-10 for r,s in zip(proof["forces_ry_bohr"],api["forces_ry_bohr"]) for x,y in zip(r,s)) and
                abs(proof["max_force_component_ry_bohr"]-api["max_force_component_ry_bohr"])<=1e-10,
                "Raw/API atomic forces mismatch")
    check_path=directory/"cases/high-cutoff-scf"
    high_request=copy.deepcopy(final_request);high_request["parameters"].update(plan["final_check"])
    require(json.loads((check_path/"request.json").read_text())==high_request,"High-cutoff request differs from fixed plan")
    high_result=identity(check_path,high_request,plan)
    high=raw_proof(check_path,high_request,"structure",plan)
    require(high["input_sha256"]==high_result["input_sha256"] and high["output_sha256"]==high_result["output_sha256"] and
        abs(high["energy_ry"]-high_result["energy_ry"])<=1e-8 and abs(high["energy_ry"]*RY_TO_EV-high_result["energy_ev"])<=1e-7 and
        high["qe_version"]==high_result["engine_version"]==result["engine_version"],"High-cutoff raw/API/hash mismatch")
    displacement=[]
    for before,after in zip(initial["structure"]["atoms"],geometry["atoms"]):
        d=[(y-x+.5)%1-.5 for x,y in zip(before["fractional"],after["fractional"])]
        cart=[sum(d[k]*geometry["cell_angstrom"][k][j] for k in range(3)) for j in range(3)]
        displacement.append(math.sqrt(sum(x*x for x in cart)))
    values={"relax_force":relax["max_force_component_ry_bohr"],"final_scf_force":final["max_force_component_ry_bohr"],
        "high_cutoff_force":high["max_force_component_ry_bohr"],
        "force_difference":max(abs(a-b) for r,s in zip(final["forces_ry_bohr"],high["forces_ry_bohr"]) for a,b in zip(r,s)),
        "relaxed_cutoff_mev_per_atom":abs(final["energy_ry"]-high["energy_ry"])*RY_TO_EV*1000/3,
        "relax_final_scf_energy_difference_ry":abs(relax["energy_ry"]-final["energy_ry"]),
        "max_displacement_angstrom":max(displacement),"energy_increase_from_reference_ry":final["energy_ry"]-initial_result["energy_ry"]}
    c=plan["criteria"]
    limits={**{key:c["max_final_force_component_ry_bohr"] for key in ("relax_force","final_scf_force","high_cutoff_force")},
        "force_difference":c["max_force_component_difference_ry_bohr"],"relaxed_cutoff_mev_per_atom":c["max_relaxed_cutoff_delta_mev_per_atom"],
        "relax_final_scf_energy_difference_ry":c["max_relax_final_scf_energy_difference_ry"],
        "max_displacement_angstrom":c["max_atom_displacement_angstrom"],"energy_increase_from_reference_ry":c["max_energy_increase_from_reference_ry"]}
    gates=[{"axis":key,"value":value,"limit":limits[key],"passed":math.isfinite(value) and value<=limits[key]+1e-12} for key,value in values.items()]
    return {"relax":relax,"final_scf":final,"high_cutoff_scf":high,"displacements_angstrom":displacement,"gates":gates}


def verify(directory,reference_directory=None):
    plan=load_plan();require(json.loads((directory/"plan.json").read_text())==plan,"D3 plan changed")
    initial,result,ref=reference(plan,reference_directory)
    derived=derive(directory,plan,initial,result)
    summary=json.loads((directory/"summary.json").read_text())
    require(summary["reference"]==ref and summary["status"]=="passed" and summary["derived"]==derived,"D3 summary differs from raw evidence")
    memory=plan["limits"]["docker_worker_memory_bytes"]
    require(summary["provenance"]["worker_resources"]=={"memory_bytes":memory,"memory_swap_bytes":memory},"Wrong actual resources")
    require(summary["resources_removed"] is True and not summary["cleanup_errors"],"Runtime cleanup incomplete")
    require(all(x["passed"] for x in derived["gates"]),"D3 physical gate failed")
    return derived


def run(output,reference_directory=None):
    plan=load_plan();initial,old_result,ref=reference(plan,reference_directory)
    require(not output.exists(),"Output directory must be new")
    output.mkdir(parents=True);write_json(output/"plan.json",plan)
    report={"schema":"kristalyapi.qe-mos2-relax-acceptance.v1","status":"failed","reference":ref,
        "started_at":datetime.now(timezone.utc).isoformat(),"scope":plan["scope"]}
    runtime=Runtime(plan,output,[Path(__file__).resolve(),PLAN])
    try:
        with runtime:
            result=runtime.job(make_relax_request(plan,initial),"relax-scf")
            high=copy.deepcopy(initial);high["structure"]=result["final_structure"]
            high["parameters"].update(plan["final_check"])
            runtime.job(high,"high-cutoff-scf")
            report["derived"]=derive(output,plan,initial,old_result)
            require(all(x["passed"] for x in report["derived"]["gates"]),"D3 scientific acceptance gate failed")
            report["status"]="passed"
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        report["status"]="failed"
        report["error"]=str(exc)
    finally:
        report.update(runtime.report)
        if report.get("cleanup_errors"):report["status"]="failed"
        report["finished_at"]=datetime.now(timezone.utc).isoformat()
        write_json(output/"summary.json",report)
    print("D3 acceptance:",report["status"],output,flush=True)
    return 0 if report["status"]=="passed" else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    choice=parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--run",action="store_true");choice.add_argument("--verify",type=Path)
    parser.add_argument("--output",type=Path);parser.add_argument("--reference",type=Path)
    args=parser.parse_args()
    if args.verify:
        print(json.dumps(verify(args.verify,args.reference),indent=2));return 0
    if args.output is None:parser.error("--run requires --output")
    return run(args.output.resolve(),args.reference)


if __name__=="__main__":raise SystemExit(main())
