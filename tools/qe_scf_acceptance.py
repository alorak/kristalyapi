#!/usr/bin/env python3
"""D2.1: real Docker/API Si SCF acceptance; stdlib only, no fake solver fallback."""
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
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "tests/fixtures/qe/si-scf-acceptance.json"
RY_TO_EV = 13.605693122994
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][+-]?\d+)?"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def numeric(value):
    return float(value.replace("D", "E").replace("d", "e"))


def check_case(request, result, input_bytes, output_bytes, plan):
    """Independently cross-check raw artifacts, not just the API success flags."""
    raw = output_bytes.decode("utf-8")
    inp = input_bytes.decode("utf-8")
    require(result["input_sha256"] == sha(input_bytes), "Input hash mismatch")
    require(result["output_sha256"] == sha(output_bytes), "Output hash mismatch")
    require(result["pseudopotentials"]["Si"]["sha256"] == plan["pseudopotential"]["sha256"],
            "UPF hash mismatch")
    require(result["engine"] == "quantum-espresso", "Unexpected engine")
    require(result["scf_converged"] is True and result["job_done"] is True, "API SCF flags missing")
    require("JOB DONE." in raw and "convergence NOT achieved" not in raw, "Incomplete QE output")
    convergence = re.search(r"convergence has been achieved in\s+(\d+)\s+iterations", raw)
    require(convergence is not None, "Raw SCF convergence evidence missing")
    version = re.search(r"Program\s+PWSCF\s+v\.?(\S+)", raw)
    require(version is not None and version[1] == result["engine_version"], "QE version mismatch")
    energies = re.findall(r"(?m)^\s*!\s+total energy\s*=\s*(" + NUMBER + r")\s*Ry", raw)
    accuracy = re.findall(r"estimated scf accuracy\s*<\s*(" + NUMBER + r")\s*Ry", raw)
    require(bool(energies) and bool(accuracy), "Raw final energy/SCF accuracy missing")
    energy = numeric(energies[-1])
    residual = numeric(accuracy[-1])
    criteria = plan["criteria"]
    require(math.isfinite(energy) and math.isfinite(residual), "Nonfinite QE evidence")
    require(0 <= residual <= criteria["max_scf_accuracy_ry"], "SCF residual exceeds threshold")
    require(abs(energy - result["energy_ry"]) <= criteria["api_energy_tolerance_ry"],
            "API/raw energy mismatch")
    require(abs(energy * RY_TO_EV - result["energy_ev"]) <= criteria["api_energy_tolerance_ry"] * RY_TO_EV,
            "Ry/eV conversion mismatch")
    params = request["parameters"]
    for key, value in [("ecutwfc", params["ecutwfc_ry"]), ("ecutrho", params["ecutrho_ry"]),
                       ("nat", len(request["structure"]["atoms"])), ("conv_thr", criteria["max_scf_accuracy_ry"])]:
        match = re.search(r"\b" + key + r"\s*=\s*(" + NUMBER + r")", inp)
        require(match is not None and math.isclose(numeric(match[1]), value, rel_tol=1e-12),
                "Generated input mismatch: " + key)
    require("calculation='scf'" in inp and "input_dft='PBE'" in inp and "occupations='fixed'" in inp,
            "Unexpected SCF protocol")
    require("nspin" not in inp, "Spin not supported by this acceptance plan")
    kmesh = re.search(r"K_POINTS automatic\s*\n([^\n]+)", inp)
    require(kmesh is not None and list(map(int, kmesh[1].split())) == params["kpoints"] + [0, 0, 0],
            "Generated k mesh mismatch")
    cell = re.search(r"CELL_PARAMETERS angstrom\s*\n([\s\S]+?)\nATOMIC_POSITIONS crystal\s*\n([\s\S]+?)\nK_POINTS", inp)
    require(cell is not None, "Generated cell/atoms missing")
    actual_cell = [[float(x) for x in line.split()] for line in cell[1].strip().splitlines()]
    require(actual_cell == request["structure"]["cell_angstrom"], "Generated cell mismatch")
    actual_atoms = [{"element": fields[0], "fractional": list(map(float, fields[1:]))}
                    for fields in [line.split() for line in cell[2].strip().splitlines()]]
    require(actual_atoms == request["structure"]["atoms"], "Generated atoms mismatch")
    return {"energy_ry": energy, "energy_ev": energy * RY_TO_EV,
            "last_scf_accuracy_ry": residual, "scf_iterations": int(convergence[1]),
            "engine_version": version[1], "input_sha256": sha(input_bytes),
            "output_sha256": sha(output_bytes)}


def sensitivity(cases, plan):
    energies = {case["id"]: case["proof"]["energy_ry"] for case in cases}
    atoms = len(plan["structure"]["atoms"])
    limit = plan["criteria"]["energy_sensitivity_mev_per_atom"]
    comparisons = []
    for pair in plan["criteria"]["comparisons"]:
        delta = abs(energies[pair["from"]] - energies[pair["to"]]) * RY_TO_EV * 1000 / atoms
        comparisons.append({**pair, "delta_mev_per_atom": delta,
                            "limit_mev_per_atom": limit, "passed": delta <= limit})
    return comparisons


class Api:
    def __init__(self, port, token):
        self.base = f"http://127.0.0.1:{port}"
        self.token = token
        self.audit = []

    def request(self, path, method="GET", body=None, *, expected=200, auth=True):
        headers = {"Authorization": "Bearer " + self.token} if auth else {}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            value = json.load(response)
        self.audit.append({"method": method, "path": path, "status": response.status, "response": value})
        require(response.status == expected, f"{method} {path}: HTTP {response.status}: {value}")
        return value


def make_request(plan, case):
    return {"schema": "kristalyapi.qe-scf-job.v1", "profile_id": "si-pbe",
            "structure": plan["structure"], "parameters": {
                "calculation": "scf", "functional": "PBE", "spin": "unpolarized",
                **{key: case[key] for key in ("ecutwfc_ry", "ecutrho_ry", "kpoints")}}}


def verify_evidence(output, plan):
    require((output / "plan.json").read_bytes() == PLAN.read_bytes(), "Acceptance plan changed")
    cases = []
    for case in plan["cases"]:
        directory = output / "cases" / case["id"]
        payload = json.loads((directory / "request.json").read_text())
        require(payload == make_request(plan, case), "Recorded request differs from acceptance plan")
        result = json.loads((directory / "result.json").read_text())
        trace = json.loads((directory / "api.json").read_text())
        require(trace["validation"]["valid"] is True and trace["terminal"]["status"] == "completed",
                "Job did not pass API validation/completion")
        require(re.fullmatch(r"[a-f0-9]{32}", trace["submitted"]["job_id"]) is not None, "Invalid job ID")
        require(trace["submitted"]["job_id"] == trace["terminal"]["job_id"] == result["job_id"], "Job ID mismatch")
        require(len({trace["validation"]["structure_hash"], trace["submitted"]["structure_hash"],
                     trace["terminal"]["structure_hash"], result["structure_hash"]}) == 1,
                "Structure identity mismatch")
        expected_hash = sha(json.dumps(payload["structure"], sort_keys=True, separators=(",", ":")).encode())
        require(result["structure_hash"] == expected_hash, "Source structure hash mismatch")
        require(trace["staged_upf_sha256"] == plan["pseudopotential"]["sha256"], "Staged UPF hash mismatch")
        proof = check_case(payload, result, (directory / "structure.in").read_bytes(),
                           (directory / "structure.out").read_bytes(), plan)
        cases.append({**case, "job_id": result["job_id"], "proof": proof})
    return cases, sensitivity(cases, plan)


def markdown(report):
    lines = ["# D2.1 — Real Docker/API Si SCF acceptance", "", "Status: **" + report["status"] + "**", "",
             "Five real PBE/unpolarized Si jobs; 2 atoms, fixed diamond lattice a=5.431 Å.", "",
             "| Case | Energy (Ry) | Final SCF accuracy (Ry) | Iterations |", "| --- | ---: | ---: | ---: |"]
    for case in report["cases"]:
        proof = case["proof"]
        lines.append(f'| {case["id"]} | {proof["energy_ry"]:.8f} | {proof["last_scf_accuracy_ry"]:.3g} | {proof["scf_iterations"]} |')
    lines += ["", "## Finite sensitivity checks", ""]
    for check in report.get("comparisons", []):
        lines.append(f'- {check["axis"]}: {check["from"]} → {check["to"]}: {check["delta_mev_per_atom"]:.6f} meV/atom (limit {check["limit_mev_per_atom"]}; passed={check["passed"]}).')
    lines += ["", "Raw input/output, authenticated API traces without tokens, job IDs, hashes and provenance accompany this report.",
              "This validates this Si protocol and the specified finite sensitivity checks. It does not establish MoS₂, relaxed geometry, other observables or general scientific accuracy."]
    if report.get("error"):
        lines += ["", "Failure: " + report["error"]]
    return "\n".join(lines) + "\n"


def run_acceptance(output, upf_path):
    plan = json.loads(PLAN.read_text())
    require(not output.exists(), "Output directory must be new; existing evidence is never overwritten")
    output.mkdir(parents=True)
    shutil.copyfile(PLAN, output / "plan.json")
    report = {"schema": "kristalyapi.qe-si-acceptance.v1", "status": "failed",
              "started_at": datetime.now(timezone.utc).isoformat(), "cases": [], "comparisons": [],
              "scope": "real Si SCF API acceptance and finite cutoff/k-mesh sensitivity; not general materials validation"}
    # Drop unrelated Compose/QE overrides so loopback and this isolated test are deterministic.
    environment = {key: value for key, value in os.environ.items()
                   if not key.startswith(("QE_", "COMPOSE_"))}
    with tempfile.TemporaryDirectory(prefix="kristalyapi-si-") as temporary:
        work = Path(temporary)
        project = "kristalyapi-si-" + secrets.token_hex(6)
        compose = ["docker", "compose", "--env-file", str(work / ".env"), "-p", project,
                   "-f", str(ROOT / "compose.qe.yml"), "--profile", "compute"]
        attempted_start = False

        def command(argv, *, capture=True, timeout=900):
            result = subprocess.run(argv, cwd=ROOT, env=environment, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=timeout, check=False)
            if not capture or result.returncode:
                with (output / "docker.log").open("ab") as log:
                    log.write(result.stdout)
            require(result.returncode == 0, "Command failed: " + " ".join(argv[:3]) + "; see docker.log")
            return result.stdout

        try:
            print("D2.1: verify pinned real Si PBE UPF", flush=True)
            pseudo = plan["pseudopotential"]
            if upf_path:
                upf_bytes = upf_path.read_bytes()
            else:
                with urllib.request.urlopen(pseudo["url"], timeout=60) as response:
                    upf_bytes = response.read(20_000_001)
            require(len(upf_bytes) <= 20_000_000 and sha(upf_bytes) == pseudo["sha256"], "Pinned UPF hash mismatch")
            require(b'element="Si"' in upf_bytes and b'functional="PBE"' in upf_bytes, "Unexpected UPF metadata")
            for name in ("profiles", "pseudos"):
                (work / name).mkdir()
            (work / "pseudos" / "Si.UPF").write_bytes(upf_bytes)
            profile = {"schema": "kristalyapi.upf-profile.v1", "id": "si-pbe", "functional": "PBE",
                       "elements": {"Si": {"file": "Si.UPF", "sha256": pseudo["sha256"],
                                            "source": pseudo["url"] + " (" + pseudo["library"] + ")",
                                            "license": pseudo["license"] + "; " + pseudo["license_url"], "functional": "PBE"}}}
            write_json(work / "profiles/si-pbe.json", profile)
            write_json(output / "upf-profile.json", profile)
            with socket.socket() as port_socket:
                port_socket.bind(("127.0.0.1", 0))
                port = port_socket.getsockname()[1]
            token = secrets.token_urlsafe(40)
            (work / ".env").write_text(f"QE_API_PORT={port}\nQE_API_BIND_IP=127.0.0.1\nQE_JOBS_ENABLED=1\nQE_API_TOKEN={token}\nQE_PROFILE_DIR={work / 'profiles'}\nQE_PSEUDO_DIR={work / 'pseudos'}\nQE_JOB_TIMEOUT=180\n")
            (work / ".env").chmod(0o600)
            report["provenance"] = {
                "git_commit": command(["git", "rev-parse", "HEAD"]).decode().strip(),
                "git_status": command(["git", "status", "--porcelain"]).decode().splitlines(),
                "host_platform": platform.platform(), "host_machine": platform.machine(),
                "docker_architecture": command(["docker", "info", "--format", "{{.Architecture}}"]).decode().strip(),
                "docker_version": command(["docker", "info", "--format", "{{.ServerVersion}}"]).decode().strip(),
                "plan_sha256": sha(PLAN.read_bytes()),
                "source_sha256": {str(file.relative_to(ROOT)): sha(file.read_bytes()) for file in
                                  [Path(__file__).resolve(), ROOT / "compose.qe.yml", ROOT / "server/Dockerfile",
                                   ROOT / "tools/qe_run.py", *sorted((ROOT / "server").glob("*.py"))]}}
            command(compose + ["config", "--quiet"])
            print("D2.1: build Docker image and start isolated API/worker", flush=True)
            command(compose + ["build"], capture=False)
            attempted_start = True
            command(compose + ["up", "-d", "--no-build"], capture=False)
            api = Api(port, token)
            deadline = time.monotonic() + 60
            while True:
                try:
                    health = api.request("/api/health", auth=False)
                    break
                except (OSError, ValueError):
                    require(time.monotonic() < deadline, "API did not become ready")
                    time.sleep(.5)
            require(health["status"] == "ready" and health["read_only"] is False, "Compute not ready")
            capabilities = api.request("/api/capabilities", auth=False)
            require(capabilities["job_submission_enabled"] is True, "Job API disabled")
            write_json(output / "discovery.json", {"health": health, "capabilities": capabilities})
            api.request("/api/v1/calculations", auth=False, expected=401)
            api_id = command(compose + ["ps", "-q", "qe-api"]).decode().strip()
            container = json.loads(command(["docker", "inspect", api_id]))[0]
            report["provenance"]["image_id"] = container["Image"]
            report["provenance"]["qe_debian_version"] = command(compose + ["exec", "-T", "qe-api", "dpkg-query", "-W", "-f=${Version}", "quantum-espresso"]).decode().strip()
            for case in plan["cases"]:
                directory = output / "cases" / case["id"]
                directory.mkdir(parents=True)
                payload = make_request(plan, case)
                write_json(directory / "request.json", payload)
                valid = api.request("/api/v1/calculations/validate", "POST", payload)
                submitted = api.request("/api/v1/calculations", "POST", payload, expected=202)
                jid = submitted["job_id"]
                require(re.fullmatch(r"[a-f0-9]{32}", jid) is not None, "Invalid job ID")
                print("D2.1:", case["id"], "submitted", jid, flush=True)
                deadline = time.monotonic() + 210
                while True:
                    terminal = api.request("/api/v1/calculations/" + jid)
                    if terminal["status"] not in ("queued", "running"):
                        break
                    require(time.monotonic() < deadline, "Job polling timed out")
                    time.sleep(.5)
                trace = {"validation": valid, "submitted": submitted, "terminal": terminal}
                write_json(directory / "api.json", trace)
                for filename in ("structure.in", "structure.out", "structure.stderr"):
                    command(["docker", "cp", api_id + ":/var/lib/qe/runs/" + jid + "/" + filename,
                             str(directory / filename)])
                require(terminal["status"] == "completed", f"{case['id']}: {terminal}")
                trace["staged_upf_sha256"] = command(["docker", "exec", api_id, "python3", "-c",
                    "import hashlib,sys; print(hashlib.sha256(open('/var/lib/qe/runs/'+sys.argv[1]+'/pseudo/Si.UPF','rb').read()).hexdigest())", jid]).decode().strip()
                write_json(directory / "api.json", trace)
                result = api.request("/api/v1/calculations/" + jid + "/results")
                write_json(directory / "result.json", result)
                write_json(directory / "api-log-tail.json", api.request("/api/v1/calculations/" + jid + "/logs"))
                proof = check_case(payload, result, (directory / "structure.in").read_bytes(),
                                   (directory / "structure.out").read_bytes(), plan)
                report["cases"].append({**case, "job_id": jid, "proof": proof})
                write_json(output / "api-audit.json", api.audit)
                print("D2.1:", case["id"], "SCF PASS", proof["energy_ry"], "Ry", flush=True)
            report["cases"], report["comparisons"] = verify_evidence(output, plan)
            require(all(check["passed"] for check in report["comparisons"]), "Finite energy sensitivity threshold exceeded")
            report["status"] = "passed"
        except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
            report["error"] = str(error)
        finally:
            if "api" in locals():
                write_json(output / "api-audit.json", api.audit)
            if attempted_start:
                try:
                    (output / "container.log").write_bytes(command(compose + ["logs", "--no-color"]))
                except (OSError, ValueError, subprocess.SubprocessError) as error:
                    report["log_capture_error"] = str(error)
                try:
                    command(compose + ["down", "--volumes"], capture=False)
                    report["test_resources_removed"] = True
                except (OSError, ValueError, subprocess.SubprocessError) as error:
                    report["cleanup_error"] = str(error)
                    report["status"] = "failed"
            report["finished_at"] = datetime.now(timezone.utc).isoformat()
            write_json(output / "summary.json", report)
            (output / "README.md").write_text(markdown(report), encoding="utf-8")
    print("D2.1:", report["status"], output, flush=True)
    return 0 if report["status"] == "passed" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--run", action="store_true", help="explicitly execute real Docker/QE jobs")
    action.add_argument("--verify", type=Path, help="verify an existing evidence bundle offline")
    parser.add_argument("--output", type=Path, help="new output directory for real execution")
    parser.add_argument("--upf", type=Path, help="use local bytes matching the pinned real UPF hash")
    args = parser.parse_args()
    if args.verify:
        cases, comparisons = verify_evidence(args.verify, json.loads(PLAN.read_text()))
        require(all(check["passed"] for check in comparisons), "Sensitivity checks failed")
        print(json.dumps({"verified_cases": len(cases), "comparisons": comparisons}, indent=2))
        return 0
    if args.output is None:
        parser.error("--output is required with --run")
    return run_acceptance(args.output.resolve(), args.upf)


if __name__ == "__main__":
    raise SystemExit(main())
