#!/usr/bin/env python3
"""D2.2: real 1H-MoS2 Docker/API SCF acceptance with fail-closed evidence.

No pseudopotentials or DFT energies are fabricated. --run is explicit and
requires two user-reviewed SHA-256 hashes; --verify works without Docker.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET

from qe_scf_acceptance import Api, require, write_json, sha, numeric, NUMBER, RY_TO_EV

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "tests/fixtures/qe/mos2-scf-acceptance.json"
HEX = re.compile(r"[a-fA-F0-9]{64}\Z")


def validate_upf_metadata(data, element):
    head = data[:16000]
    header = re.search(rb"<PP_HEADER\b[\s\S]*?/>", head)
    require(b"<UPF" in head and header is not None, element+" UPF header missing")
    try:
        attributes = ET.fromstring(header.group()).attrib
    except ET.ParseError as exc:
        raise ValueError(element+" UPF header is not valid XML") from exc
    # Official PSlibrary S encodes element=" S". Normalize metadata values,
    # leaving the reviewed UPF bytes and their SHA-256 entirely unchanged.
    require(attributes.get("element", "").strip() == element and
            attributes.get("functional", "").strip() == "PBE",
            element+" UPF elemental/XC metadata mismatch")


def load_plan():
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    require(plan["schema"] == "kristalyapi.qe-mos2-acceptance-plan.v1", "Wrong MoS2 plan")
    require(len(plan["cases"]) == 7 and len({x["id"] for x in plan["cases"]}) == 7,
            "Acceptance sweep changed unexpectedly")
    return plan


def locked_plan(mo_hash, s_hash):
    plan = load_plan()
    for element, h in (("Mo", mo_hash), ("S", s_hash)):
        require(isinstance(h, str) and HEX.fullmatch(h) is not None,
                element + " requires a pre-reviewed 64-character SHA-256")
        plan["pseudopotentials"][element]["sha256"] = h.lower()
    return plan


def structure(plan, case):
    g = plan["geometry"]
    a, d, c = g["a_angstrom"], g["s_plane_distance_angstrom"], case["vacuum_cell_c_angstrom"]
    # Mo z=1/2 and trigonal prismatic S atoms at matching in-plane sites.
    return {"periodic": True,
            "cell_angstrom": [[float(a), 0.0, 0.0],
                              [float(-a / 2), float(a * math.sqrt(3) / 2), 0.0],
                              [0.0, 0.0, float(c)]],
            "atoms": [
                {"element": "Mo", "fractional": [0.0, 0.0, 0.5]},
                {"element": "S", "fractional": [1 / 3, 2 / 3, 0.5 + d / c]},
                {"element": "S", "fractional": [1 / 3, 2 / 3, 0.5 - d / c]}
            ]}


def make_request(plan, case):
    return {"schema": "kristalyapi.qe-scf-job.v1", "profile_id": "mos2-pbe",
            "structure": structure(plan, case),
            "parameters": {"calculation": "scf", "functional": "PBE",
                           "spin": "unpolarized", "ecutwfc_ry": case["ecutwfc_ry"],
                           "ecutrho_ry": case["ecutrho_ry"], "kpoints": case["kpoints"]}}


def structure_hash(value):
    # server/job_core.py canonical structure sha256: JSON sorted and compact.
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def check_case(plan, case, request, result, raw_input, raw_output, trace):
    """Independently cross-check raw pw.x artifacts against request and API."""
    scf = raw_output.decode("utf-8")
    inp = raw_input.decode("utf-8")
    criteria = plan["criteria"]
    require(request == make_request(plan, case), "Request is inconsistent with locked plan")
    expected_structure = structure_hash(request["structure"])
    ids = (trace["validation"]["structure_hash"], trace["submitted"]["structure_hash"],
           trace["terminal"]["structure_hash"], result["structure_hash"])
    require(all(h == expected_structure for h in ids), "Source structure hash mismatch")
    job_id = trace["submitted"]["job_id"]
    require(re.fullmatch(r"[a-f0-9]{32}", job_id) is not None and
            trace["terminal"]["job_id"] == result["job_id"] == job_id, "Job ID mismatch")
    require(trace["validation"]["valid"] is True and
            trace["terminal"]["status"] == "completed" and
            trace["submitted"]["status"] == "queued", "API job not completed")
    require(result["input_sha256"] == sha(raw_input) and
            result["output_sha256"] == sha(raw_output), "QE input/output SHA-256 mismatch")
    for el in ("Mo", "S"):
        h = plan["pseudopotentials"][el]["sha256"]
        require(result["pseudopotentials"][el]["sha256"] == h and
                trace["staged_upf_sha256"][el] == h, "Wrong "+el+" staged UPF")
    require(result["engine"] == "quantum-espresso" and
            result["scf_converged"] is True and result["job_done"] is True,
            "Solver status/provenance mismatch")
    require("JOB DONE." in scf and "convergence NOT achieved" not in scf,
            "Raw QE job was not successfully completed")
    converged = re.search(r"convergence has been achieved in\s+(\d+)\s+iterations", scf)
    version = re.search(r"Program\s+PWSCF\s+v\.?(\S+)", scf)
    energies = re.findall(r"(?m)^\s*!\s+total energy\s*=\s*("+NUMBER+r")\s*Ry", scf)
    accuracy = re.findall(r"estimated scf accuracy\s*<\s*("+NUMBER+r")\s*Ry", scf)
    require(converged is not None and version is not None and bool(energies) and bool(accuracy),
            "Missing raw QE convergence/version/energy/accuracy")
    energy = numeric(energies[-1])
    residual = numeric(accuracy[-1])
    require(math.isfinite(energy) and math.isfinite(residual) and
            0 <= residual <= criteria["max_scf_accuracy_ry"], "SCF accuracy failed")
    require(version.group(1) == result["engine_version"], "QE version mismatch")
    require(abs(energy - result["energy_ry"]) <= criteria["api_energy_tolerance_ry"],
            "API energy differs from pw.x output")
    require(abs(energy * RY_TO_EV - result["energy_ev"]) <=
            criteria["api_energy_tolerance_ry"] * RY_TO_EV, "Ry/eV conversion mismatch")
    for key, val in (("ecutwfc", case["ecutwfc_ry"]), ("ecutrho", case["ecutrho_ry"]),
                     ("nat", 3), ("conv_thr", criteria["max_scf_accuracy_ry"])):
        match = re.search(r"\b"+key+r"\s*=\s*("+NUMBER+r")", inp)
        require(match is not None and math.isclose(numeric(match.group(1)), val, rel_tol=1e-12),
                "Unexpected QE input parameter "+key)
    require("calculation='scf'" in inp and "input_dft='PBE'" in inp and
            "occupations='fixed'" in inp and "nspin" not in inp,
            "Unexpected occupation, spin, XC or calculation type")
    match = re.search(r"K_POINTS automatic\s*\n([^\n]+)", inp)
    require(match is not None and list(map(int, match.group(1).split())) ==
            case["kpoints"] + [0, 0, 0], "Expected 2D gamma-centered k mesh")
    match = re.search(r"CELL_PARAMETERS angstrom\s*\n([\s\S]+?)\nATOMIC_POSITIONS crystal\s*\n([\s\S]+?)\nK_POINTS", inp)
    require(match is not None, "Cell/atom cards missing in QE input")
    actual_cell = [[float(x) for x in line.split()] for line in match.group(1).strip().splitlines()]
    expected_cell = request["structure"]["cell_angstrom"]
    require(len(actual_cell) == 3 and all(len(row) == 3 for row in actual_cell) and
            all(abs(actual_cell[i][j] - expected_cell[i][j]) <= 1e-8
                for i in range(3) for j in range(3)), "QE cell differs from request")
    raw_atoms = [line.split() for line in match.group(2).strip().splitlines()]
    require(len(raw_atoms) == 3, "QE atom count changed")
    for row, atom in zip(raw_atoms, request["structure"]["atoms"]):
        require(row[0] == atom["element"] and len(row) == 4 and
                all(abs(float(row[i+1]) - atom["fractional"][i]) < 1e-8 for i in range(3)),
                "QE atoms differ from source request")
    # This confirms atom positions, not a relaxed geometry or any band-gap result.
    return {"energy_ry": energy, "energy_ev": energy * RY_TO_EV,
            "last_scf_accuracy_ry": residual, "scf_iterations": int(converged.group(1)),
            "qe_version": version.group(1), "input_sha256": sha(raw_input),
            "output_sha256": sha(raw_output), "structure_hash": expected_structure}


def comparisons(cases, plan):
    energies = {c["id"]: c["proof"]["energy_ry"] for c in cases}
    result = []
    for item in plan["criteria"]["comparisons"]:
        a, b = item["from"], item["to"]
        require(a in energies and b in energies, "Missing comparison case")
        delta = abs(energies[a] - energies[b]) * RY_TO_EV * 1000 / 3
        limit = plan["criteria"]["energy_sensitivity_mev_per_atom"][item["axis"]]
        result.append({**item, "delta_mev_per_atom": delta,
                       "limit_mev_per_atom": limit, "passed": delta <= limit})
    return result


def verify_evidence(directory):
    plan = json.loads((directory/"plan.json").read_text(encoding="utf-8"))
    base = load_plan()
    for el in ("Mo", "S"):
        require(HEX.fullmatch(plan["pseudopotentials"][el]["sha256"]) is not None,
                "Invalid locked pseudopotential hash")
        del plan["pseudopotentials"][el]["sha256"]
    require(plan == base, "Evidence plan is not the source-fixed MoS2 acceptance protocol")
    plan = json.loads((directory/"plan.json").read_text(encoding="utf-8"))
    cases = []
    for case in plan["cases"]:
        path = directory/"cases"/case["id"]
        req = json.loads((path/"request.json").read_text())
        api = json.loads((path/"api.json").read_text())
        result = json.loads((path/"result.json").read_text())
        proof = check_case(plan, case, req, result,
                           (path/"structure.in").read_bytes(),
                           (path/"structure.out").read_bytes(), api)
        cases.append({**case, "id": case["id"], "proof": proof})
    deltas = comparisons(cases, plan)
    require(all(x["passed"] for x in deltas), "At least one material sensitivity gate failed")
    summary = json.loads((directory/"summary.json").read_text())
    require(summary["status"] == "passed" and len(summary["cases"]) == len(cases),
            "Acceptance summary did not report completed suite")
    require(summary["comparisons"] == deltas, "Summary comparison differs from raw QE evidence")
    return cases, deltas


def command(argv, output, environment, *, timeout=1800):
    proc = subprocess.run(argv, cwd=ROOT, env=environment, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=timeout, check=False)
    if proc.returncode:
        with (output/"docker.log").open("ab") as log:
            log.write(proc.stdout)
        raise ValueError("Command failed: "+ " ".join(argv[:3])+"; inspect docker.log")
    return proc.stdout


def run_acceptance(output, mo_hash, s_hash, mo_upf=None, s_upf=None):
    plan = locked_plan(mo_hash, s_hash)
    require(not output.exists(), "Output directory must be new")
    output.mkdir(parents=True)
    write_json(output/"plan.json", plan)
    report = {"schema": "kristalyapi.qe-mos2-acceptance.v1", "status": "failed",
              "started_at": datetime.now(timezone.utc).isoformat(), "cases": [],
              "comparisons": [], "planned_cases": len(plan["cases"]),
              "scope": "pristine idealized 1H-MoS2 neutral PBE unpolarized SCF sensitivity only"}
    env = {k: v for k, v in os.environ.items() if not k.startswith(("QE_", "COMPOSE_"))}
    with tempfile.TemporaryDirectory(prefix="kristalyapi-mos2-") as folder:
        work = Path(folder)
        (work/"profiles").mkdir()
        (work/"pseudos").mkdir()
        project = "kristalyapi-mos2-"+secrets.token_hex(6)
        compose = ["docker","compose","--env-file",str(work/".env"),"-p",project,
                   "-f",str(ROOT/"compose.qe.yml"),"--profile","compute"]
        started = False
        api = None
        try:
            profile = {"schema": "kristalyapi.upf-profile.v1", "id": "mos2-pbe",
                       "functional": "PBE", "elements": {}}
            for el, userfile in (("Mo", mo_upf), ("S", s_upf)):
                meta = plan["pseudopotentials"][el]
                if userfile:
                    data = userfile.read_bytes()
                else:
                    with urllib.request.urlopen(meta["url"], timeout=90) as response:
                        data = response.read(20_000_001)
                require(1000 <= len(data) <= 20_000_000 and sha(data) == meta["sha256"],
                        el+" UPF does not match explicitly pinned SHA-256")
                validate_upf_metadata(data, el)
                (work/"pseudos"/meta["filename"]).write_bytes(data)
                profile["elements"][el] = {
                    "file": meta["filename"], "sha256": meta["sha256"],
                    "source": meta["url"]+" ("+meta["library"]+")",
                    "license": meta["license"]+"; "+meta["license_url"], "functional": "PBE"}
            write_json(work/"profiles"/"mos2-pbe.json", profile)
            write_json(output/"upf-profile.json", profile)
            with socket.socket() as sock:
                sock.bind(("127.0.0.1",0))
                port = sock.getsockname()[1]
            token = secrets.token_urlsafe(40)
            (work/".env").write_text(
                f"QE_API_PORT={port}\nQE_API_BIND_IP=127.0.0.1\nQE_JOBS_ENABLED=1\n"
                f"QE_API_TOKEN={token}\nQE_PROFILE_DIR={work/'profiles'}\n"
                f"QE_PSEUDO_DIR={work/'pseudos'}\nQE_JOB_TIMEOUT={plan['limits']['max_seconds_per_job']}\n"
            )
            (work/".env").chmod(0o600)
            report["provenance"] = {
                "git_commit": command(["git","rev-parse","HEAD"], output, env).decode().strip(),
                "host_machine": platform.machine(), "host_platform": platform.platform(),
                "docker_arch": command(["docker","info","--format","{{.Architecture}}"],output,env).decode().strip(),
                "docker_version": command(["docker","info","--format","{{.ServerVersion}}"],output,env).decode().strip(),
                "plan_sha256": sha((output/"plan.json").read_bytes()),
                "source_sha256": {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [
                    Path(__file__).resolve(), ROOT/"compose.qe.yml", ROOT/"server/Dockerfile",
                    ROOT/"tools/qe_run.py", ROOT/"tools/qe_scf_acceptance.py",
                    *sorted((ROOT/"server").glob("*.py"))]}
            }
            command(compose+["config","--quiet"],output,env)
            print("D2.2: building QE Docker image",flush=True)
            command(compose+["build"],output,env)
            started = True
            command(compose+["up","-d","--no-build"],output,env)
            api = Api(port,token)
            deadline = time.monotonic()+90
            while True:
                try:
                    health = api.request("/api/health",auth=False)
                    break
                except (OSError,ValueError):
                    require(time.monotonic() < deadline,"API health check did not become ready")
                    time.sleep(0.5)
            require(health["status"]=="ready" and health["read_only"] is False,"QE compute mode not ready")
            caps = api.request("/api/capabilities",auth=False)
            require(caps["job_submission_enabled"] is True,"Compute endpoints disabled")
            write_json(output/"discovery.json",{"health":health,"capabilities":caps})
            api.request("/api/v1/calculations",auth=False,expected=401)
            api_container = command(compose+["ps","-q","qe-api"],output,env).decode().strip()
            info = json.loads(command(["docker","inspect",api_container],output,env))[0]
            report["provenance"]["image_id"] = info["Image"]
            for case in plan["cases"]:
                path = output/"cases"/case["id"]
                path.mkdir(parents=True)
                req = make_request(plan,case)
                write_json(path/"request.json",req)
                valid = api.request("/api/v1/calculations/validate","POST",req)
                submitted = api.request("/api/v1/calculations","POST",req,expected=202)
                jid = submitted["job_id"]
                require(re.fullmatch(r"[a-f0-9]{32}",jid) is not None,"Invalid QE job id")
                print("D2.2:",case["id"],"submitted",jid,flush=True)
                deadline = time.monotonic()+plan["limits"]["max_seconds_per_job"]+90
                while True:
                    final = api.request("/api/v1/calculations/"+jid)
                    if final["status"] not in ("queued","running"):
                        break
                    require(time.monotonic() < deadline,"QE SCF job polling timed out")
                    time.sleep(1)
                trace = {"validation":valid,"submitted":submitted,"terminal":final}
                write_json(path/"api.json",trace)
                for name in ("structure.in","structure.out","structure.stderr"):
                    command(["docker","cp",api_container+":/var/lib/qe/runs/"+jid+"/"+name,
                             str(path/name)],output,env)
                require(final["status"]=="completed",case["id"]+" SCF not completed")
                trace["staged_upf_sha256"] = {}
                for element in ("Mo","S"):
                    value = command(["docker","exec",api_container,"python3","-c",
                        "import hashlib,sys;print(hashlib.sha256(open('/var/lib/qe/runs/'+sys.argv[1]+'/pseudo/'+sys.argv[2]+'.UPF','rb').read()).hexdigest())",
                        jid,element],output,env).decode().strip()
                    trace["staged_upf_sha256"][element] = value
                result = api.request("/api/v1/calculations/"+jid+"/results")
                write_json(path/"api.json",trace)
                write_json(path/"result.json",result)
                write_json(path/"api-log-tail.json",api.request("/api/v1/calculations/"+jid+"/logs"))
                proof = check_case(plan,case,req,result,
                                   (path/"structure.in").read_bytes(),
                                   (path/"structure.out").read_bytes(),trace)
                report["cases"].append({**case,"proof":proof,"job_id":jid})
                write_json(output/"api-audit.json",api.audit)
                print("D2.2:",case["id"],proof["energy_ry"],"Ry",flush=True)
            report["comparisons"] = comparisons(report["cases"],plan)
            require(all(x["passed"] for x in report["comparisons"]),
                    "MoS2 convergence sensitivity threshold exceeded")
            report["status"] = "passed"
        except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
            report["error"] = str(exc)
        finally:
            if api is not None:
                write_json(output/"api-audit.json",api.audit)
            if started:
                try:
                    (output/"container.log").write_bytes(command(compose+["logs","--no-color"],output,env))
                except (OSError,ValueError,subprocess.SubprocessError) as e:
                    report["container_log_error"] = str(e)
                try:
                    command(compose+["down","--volumes"],output,env)
                    report["resources_removed"] = True
                except (OSError,ValueError,subprocess.SubprocessError) as e:
                    report["cleanup_error"] = str(e)
                    report["status"] = "failed"
            report["finished_at"] = datetime.now(timezone.utc).isoformat()
            write_json(output/"summary.json",report)
            (output/"README.md").write_text(
                "# MoS2 D2.2 SCF acceptance\n\nStatus: **"+report["status"]+"**\n\n"+
                "This is a non-relaxed primitive 1H-MoS2 SCF sensitivity test only.\n\n"+
                "\n".join(f"- {x['axis']}: {x['delta_mev_per_atom']:.6f} meV/atom; "
                          f"limit {x['limit_mev_per_atom']:.6f}; passed {x['passed']}"
                          for x in report["comparisons"])+"\n"+
                (("\nError: "+report["error"]+"\n") if "error" in report else ""),
                encoding="utf-8")
    print("D2.2:",report["status"],output,flush=True)
    return 0 if report["status"]=="passed" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--run",action="store_true")
    choice.add_argument("--verify",type=Path)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--mo-sha256")
    parser.add_argument("--s-sha256")
    parser.add_argument("--mo-upf",type=Path)
    parser.add_argument("--s-upf",type=Path)
    args = parser.parse_args()
    if args.verify is not None:
        cases,deltas = verify_evidence(args.verify)
        print(json.dumps({"verified_cases":len(cases),"comparisons":deltas},indent=2))
        return 0
    if args.output is None:
        parser.error("--run requires a new --output directory")
    if args.mo_sha256 is None or args.s_sha256 is None:
        parser.error("--run requires both reviewed --mo-sha256 and --s-sha256 values")
    return run_acceptance(args.output.resolve(),args.mo_sha256,args.s_sha256,
                          args.mo_upf,args.s_upf)


if __name__=="__main__":
    raise SystemExit(main())
