#!/usr/bin/env python3
"""Run one trusted KristalYapı-generated QE pw.x input outside the browser.

Strictly local adapter: no network/API/daemon, no shell command execution,
no pseudopotential downloads and no claim of DFT unless pw.x actually finishes.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

RY_TO_EV = 13.605693122994
FLOAT = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][+-]?\d+)?"
SAFE_UPF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf$", re.I)


def sha256_file(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_pw_input(source: str) -> dict:
    """Only accept the conservative pw.x subset exported by KristalYapı."""
    if len(source.encode("utf-8")) > 2_000_000:
        raise ValueError("QE input exceeds 2 MB limit")
    cleaned = "\n".join(line.split("!", 1)[0] for line in source.splitlines())
    control = re.search(r"(?ims)^\s*&CONTROL\b(.*?)^\s*/\s*$", cleaned)
    system = re.search(r"(?ims)^\s*&SYSTEM\b(.*?)^\s*/\s*$", cleaned)
    if control is None or system is None:
        raise ValueError("Missing QE &CONTROL or &SYSTEM namelist")

    def quoted(section: str, key: str) -> str:
        found = re.search(r"(?i)\b" + re.escape(key) + r"\s*=\s*['\"]([^'\"]+)['\"]", section)
        if not found:
            raise ValueError(f"Missing quoted {key}")
        return found.group(1)

    calculation = quoted(control.group(1), "calculation")
    prefix = quoted(control.group(1), "prefix")
    pseudo_dir = quoted(control.group(1), "pseudo_dir")
    outdir = quoted(control.group(1), "outdir")
    if calculation not in {"scf", "relax"}:
        raise ValueError("Only QE scf or relax inputs are supported")
    if prefix != "kristalyapi" or pseudo_dir not in ("./pseudo", "pseudo") or outdir not in ("./tmp", "tmp"):
        raise ValueError("Input must use KristalYapı's fixed prefix, ./pseudo and ./tmp")
    nat = re.search(r"(?i)\bnat\s*=\s*(\d+)", system.group(1))
    ntyp = re.search(r"(?i)\bntyp\s*=\s*(\d+)", system.group(1))
    if not nat or not ntyp or not (1 <= int(nat.group(1)) <= 1000) or not (1 <= int(ntyp.group(1)) <= 118):
        raise ValueError("Invalid nat/ntyp parameters")
    match = re.search(r"(?im)^\s*ATOMIC_SPECIES\s*$", cleaned)
    if not match:
        raise ValueError("Missing ATOMIC_SPECIES block")
    species = {}
    lines = cleaned[match.end():].splitlines()
    for row in lines:
        if not row.strip():
            continue
        fields = row.split()
        if len(fields) != 3:
            break
        symbol, mass, upf = fields
        if not re.fullmatch(r"[A-Z][a-z]?", symbol) or not SAFE_UPF.fullmatch(upf) or ".." in upf:
            raise ValueError("Invalid pseudopotential name or element in ATOMIC_SPECIES")
        try:
            if float(mass.replace("D", "E")) <= 0:
                raise ValueError
        except ValueError as exc:
            raise ValueError("Invalid atomic mass") from exc
        if symbol in species or upf in species.values():
            raise ValueError("Duplicate species or pseudopotential filename")
        species[symbol] = upf
    if len(species) != int(ntyp.group(1)):
        raise ValueError("ATOMIC_SPECIES does not match ntyp")
    atom_match = re.search(r"(?im)^\s*ATOMIC_POSITIONS\s+crystal\s*$", cleaned)
    k_match = re.search(r"(?im)^\s*K_POINTS\s+automatic\s*$", cleaned)
    if not atom_match or not k_match or atom_match.start() >= k_match.start():
        raise ValueError("Expected fractional ATOMIC_POSITIONS and automatic K_POINTS")
    atom_lines = [line.strip() for line in cleaned[atom_match.end():k_match.start()].splitlines() if line.strip()]
    if len(atom_lines) != int(nat.group(1)):
        raise ValueError("ATOMIC_POSITIONS count does not match nat")
    for atom in atom_lines:
        fields = atom.split()
        if len(fields) not in (4, 7) or fields[0] not in species:
            raise ValueError("Invalid atomic position")
        try:
            if any(not (float(v) == float(v) and abs(float(v)) < 1e10) for v in fields[1:4]):
                raise ValueError
        except ValueError as exc:
            raise ValueError("Invalid fractional coordinates") from exc
        if len(fields) == 7 and fields[4:] != ["0", "0", "0"]:
            raise ValueError("Only fully frozen atom position flags are supported")
    mesh_lines = [line.strip() for line in cleaned[k_match.end():].splitlines() if line.strip()]
    if len(mesh_lines) != 1 or not re.fullmatch(r"\d+\s+\d+\s+\d+\s+[01]\s+[01]\s+[01]", mesh_lines[0]):
        raise ValueError("Invalid K_POINTS automatic mesh")
    kmesh = list(map(int, mesh_lines[0].split()))
    if any(not (1 <= value <= 24) for value in kmesh[:3]):
        raise ValueError("Unsupported k-point mesh")
    return {"calculation": calculation, "prefix": prefix, "nat": int(nat.group(1)),
            "ntyp": int(ntyp.group(1)), "kmesh": kmesh, "pseudopotentials": species}


def summarize_output(source: str, calculation: str, returncode: int) -> dict:
    energies = re.findall(r"(?im)^\s*(?:!\s*)?(?:total energy|Final energy)\s*=\s*(" + FLOAT + r")\s*Ry\b", source)
    forces = re.findall(r"(?im)\bTotal force\s*=\s*(" + FLOAT + r")", source)
    def number(value: str) -> float:
        return float(value.replace("D", "E").replace("d", "e"))
    energy = number(energies[-1]) if energies else None
    force = number(forces[-1]) if forces else None
    done = bool(re.search(r"\bJOB\s+DONE\.", source, re.I))
    scf = bool(re.search(r"convergence has been achieved in\s+\d+\s+iterations", source, re.I))
    relaxed = bool(re.search(r"\bbfgs converged\b|convergence has been achieved in\s+\d+\s+steps", source, re.I))
    final_coords = bool(re.search(r"Begin final coordinates[\s\S]*?End final coordinates", source, re.I))
    version = re.search(r"Program\s+PWSCF\s+v\.?(\S+)", source, re.I)
    completed = returncode == 0 and done and energy is not None and scf and (
        calculation == "scf" or (relaxed and final_coords))
    return {"status": "completed" if completed else "not_converged_or_incomplete",
            "returncode": returncode, "job_done": done, "scf_converged": scf,
            "geometry_converged": relaxed if calculation == "relax" else None,
            "has_final_coordinates": final_coords if calculation == "relax" else None,
            "energy_ry": energy, "energy_ev": energy * RY_TO_EV if energy is not None else None,
            "total_force_ry_bohr": force, "qe_version": version.group(1) if version else None}


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def stage(input_file: Path, pp_dir: Path, workdir: Path) -> dict:
    if not input_file.is_file() or input_file.is_symlink():
        raise ValueError("The QE input file must be a regular non-symlink file")
    model = parse_pw_input(input_file.read_text(encoding="utf-8"))
    if not pp_dir.is_dir():
        raise ValueError("Missing pseudopotential directory")
    resolved = []
    for symbol, filename in model["pseudopotentials"].items():
        path = pp_dir / filename
        if not path.is_file() or path.is_symlink() or path.stat().st_size == 0:
            raise ValueError(f"Missing/empty/unsafe UPF: {symbol} = {filename}")
        resolved.append((symbol, filename, path))
    if workdir.exists() and any(workdir.iterdir()):
        raise ValueError("Work directory must be new or empty; existing results are never overwritten")
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / "pseudo").mkdir()
    (workdir / "tmp").mkdir()
    dest = workdir / "structure.in"
    shutil.copyfile(input_file, dest)
    upf = {}
    for symbol, filename, path in resolved:
        shutil.copyfile(path, workdir / "pseudo" / filename)
        upf[symbol] = {"filename": filename, "sha256": sha256_file(path)}
    return {"schema": "kristalyapi.qe-run.v1", "status": "prepared", "started_at": utcnow(),
            "input_sha256": sha256_file(dest), "pseudopotentials": upf, "model": model,
            "artifacts": {"input": "structure.in", "stdout": "structure.out",
                          "stderr": "structure.stderr.txt", "scratch": "tmp/"},
            "calculation": None, "notes": [
                "No DFT result exists unless status=completed and output contains convergence evidence.",
                "DFT convergence does not establish accuracy, single-photon emission or experimental UV irradiation.",
            ]}


def run_job(input_file: Path, pp_dir: Path, workdir: Path, *, pw: str = "pw.x",
            execute: bool = False, timeout: int = 3600) -> dict:
    executable = shutil.which(pw) if execute else None
    if execute and not executable:
        raise ValueError(f"QE executable not found: {pw}")
    if not (1 <= timeout <= 604800):
        raise ValueError("Timeout must be between 1 second and 7 days")
    result = stage(input_file, pp_dir, workdir)
    manifest = workdir / "run.json"
    if execute:
        began = time.monotonic()
        try:
            with (workdir / "structure.out").open("wb") as out, (workdir / "structure.stderr.txt").open("wb") as err:
                with (workdir / "structure.in").open("rb") as inp:
                    finished = subprocess.run([str(executable), "-in", "structure.in"], cwd=workdir,
                                              stdin=inp, stdout=out, stderr=err, timeout=timeout, check=False)
            summary = summarize_output((workdir / "structure.out").read_text(encoding="utf-8", errors="replace"),
                                       result["model"]["calculation"], finished.returncode)
            result["status"] = summary["status"]
            result["calculation"] = summary
        except subprocess.TimeoutExpired:
            result["status"] = "timeout"
            result["calculation"] = {"status": "timeout", "timeout_seconds": timeout}
        except OSError as exc:
            result["status"] = "execution_error"
            result["calculation"] = {"status": "execution_error", "message": str(exc)}
        result["duration_seconds"] = round(time.monotonic() - began, 4)
        result["executable"] = str(executable)
    result["finished_at"] = utcnow()
    manifest.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="KristalYapı QE .in file")
    parser.add_argument("--pseudo-dir", type=Path, required=True, help="Directory of actual *.UPF files")
    parser.add_argument("--workdir", type=Path, required=True, help="NEW/EMPTY working directory")
    parser.add_argument("--pw", default="pw.x", help="Trusted pw.x path or executable in PATH")
    parser.add_argument("--timeout", type=int, default=3600, help="Maximum wall time in seconds")
    parser.add_argument("--run", action="store_true", help="Actually execute pw.x; default only stages inputs")
    args = parser.parse_args(argv)
    try:
        result = run_job(args.input, args.pseudo_dir, args.workdir, pw=args.pw,
                         execute=args.run, timeout=args.timeout)
        print(json.dumps({"status": result["status"], "manifest": str(args.workdir / 'run.json')}, ensure_ascii=False))
        return 0 if result["status"] in ("prepared", "completed") else 1
    except (OSError, ValueError, UnicodeError) as exc:
        print(f"QE runner: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
