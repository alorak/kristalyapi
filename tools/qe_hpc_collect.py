#!/usr/bin/env python3
"""Standalone, dependency-free offline TRUBA/QE SCF/relax result collector.

Run from the directory containing the exported P0/P1 manifest, pw.x input
and output. Never invokes QE, SLURM, a shell command or network service.
Processes large stdout incrementally and writes a small atomic JSON report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

SCHEMA = "kristalyapi.truba-qe-summary.v1"
MANIFEST_SCHEMA = "kristalyapi.truba-qe-slurm-package.v1"
SHA_RE = re.compile(r"^[a-f0-9]{64}$")
UPF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf$", re.I)
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][+-]?\d+)?"
ENERGY_RE = re.compile(r"^\s*!?\s*(?:total energy|Final energy)\s*=\s*(" + NUMBER + r")\s+Ry\b", re.I)
FORCE_RE = re.compile(r"Total force\s*=\s*(" + NUMBER + r")", re.I)
ATOM_FORCE_RE = re.compile(r"force\s*=\s*(" + NUMBER + r")\s+(" + NUMBER + r")\s+(" + NUMBER + r")", re.I)
MAX_OUTPUT = 1024 * 1024 * 1024
MAX_INPUT = 4 * 1024 * 1024
MAX_UPF = 24 * 1024 * 1024


def verified_file(root: Path, relative: str, limit: int | None = None) -> Path:
    path = root / relative
    if path.is_symlink() or not path.is_file():
        raise ValueError("Missing or unsafe regular file: " + relative)
    if path.resolve().parent not in (root, root / "pseudo"):
        raise ValueError("File escapes bundle: " + relative)
    if limit is not None and path.stat().st_size > limit:
        raise ValueError("File exceeds limit: " + relative)
    return path


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def parse_output(path: Path) -> dict:
    """Bounded-memory final QE metrics; no synthetic atom positions."""
    result = {
        "job_done": False,
        "scf_converged": False,
        "geometry_converged": None,
        "energy_ry": None,
        "energy_ev": None,
        "total_force_ry_bohr": None,
        "max_force_component_ry_bohr": None,
        "energy_observation_count": 0,
        "energy_tail_ry": [],
        "output_bytes": path.stat().st_size,
    }
    if result["output_bytes"] > MAX_OUTPUT:
        raise ValueError("QE output exceeds 1 GiB inspection limit")
    scf_converged = False
    geometry_converged = False
    atom_force_max = None
    in_force_block = False
    with path.open("r", encoding="utf-8", errors="replace") as stream:
        for line in iter(lambda: stream.readline(1024 * 1024 + 1), ""):
            if len(line) > 1024 * 1024 or (len(line) == 1024 * 1024 and not line.endswith("\n")):
                raise ValueError("Unexpected oversized QE line")
            if "JOB DONE." in line:
                result["job_done"] = True
            if re.search(r"^\s*iteration\s*#", line, re.I):
                scf_converged = False
            if re.search(r"convergence\s+NOT\s+achieved", line, re.I):
                scf_converged = False
            elif re.search(r"convergence\s+has\s+been\s+achieved", line, re.I):
                scf_converged = True
            if re.search(r"\bbfgs\s+converged\b", line, re.I):
                geometry_converged = True
            if re.search(r"\bbfgs\s+failed|maximum number of steps reached", line, re.I):
                geometry_converged = False
            energy = ENERGY_RE.search(line)
            if energy:
                val = float(energy.group(1).replace("D", "E").replace("d", "e"))
                if not math.isfinite(val):
                    raise ValueError("Nonfinite QE energy")
                result["energy_ry"] = val
                result["energy_observation_count"] += 1
                tail = result["energy_tail_ry"]
                tail.append(val)
                if len(tail) > 128:
                    tail.pop(0)
            total_force = FORCE_RE.search(line)
            if total_force:
                val = float(total_force.group(1).replace("D", "E").replace("d", "e"))
                if not math.isfinite(val):
                    raise ValueError("Nonfinite QE total force")
                result["total_force_ry_bohr"] = val
            if re.search(r"Forces acting on atoms", line, re.I):
                in_force_block = True
                atom_force_max = None
            elif in_force_block:
                m = ATOM_FORCE_RE.search(line)
                if m:
                    vals = [float(v.replace("D", "E").replace("d", "e")) for v in m.groups()]
                    if not all(math.isfinite(v) for v in vals):
                        raise ValueError("Nonfinite QE force vector")
                    atom_force_max = max(atom_force_max or 0, *(abs(v) for v in vals))
                elif re.search(r"Total force\s*=", line, re.I):
                    result["max_force_component_ry_bohr"] = atom_force_max
                    in_force_block = False
    result["scf_converged"] = scf_converged
    result["energy_ev"] = (result["energy_ry"] * 13.605693122994
                           if result["energy_ry"] is not None else None)
    result["_geometry_converged_detected"] = geometry_converged
    return result


def collect(bundle: Path, exit_code: int | None = None) -> dict:
    root = bundle.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Bundle must be a directory")
    manifest_file = verified_file(root, "manifest.json", MAX_INPUT)
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schema") != MANIFEST_SCHEMA:
        raise ValueError("Unsupported TRUBA manifest schema")
    calc = manifest.get("calculation")
    if calc not in ("scf", "relax"):
        raise ValueError("Unsupported calculation type")
    expected = manifest.get("structure_in_sha256")
    if not isinstance(expected, str) or not SHA_RE.fullmatch(expected):
        raise ValueError("Missing or invalid input SHA-256")
    input_hash = digest(verified_file(root, "structure.in", MAX_INPUT))
    integrity = {"input_sha256_expected": expected, "input_sha256_actual": input_hash,
                 "input_matches": input_hash == expected, "pseudopotentials": [],
                 "all_required_upfs_present": True, "all_pinned_upfs_match": True,
                 "all_upfs_pinned": True, "slurm_script_matches": None}
    script_hash = manifest.get("run_slurm_sha256")
    if script_hash is not None:
        if not isinstance(script_hash, str) or not SHA_RE.fullmatch(script_hash):
            raise ValueError("Invalid run.slurm SHA-256")
        try:
            integrity["slurm_script_matches"] = digest(
                verified_file(root, "run.slurm", MAX_INPUT)) == script_hash
        except ValueError:
            integrity["slurm_script_matches"] = False
    pseudos = manifest.get("pseudopotentials")
    if not isinstance(pseudos, list) or not (1 <= len(pseudos) <= 118):
        raise ValueError("Invalid pseudopotential manifest")
    for entry in pseudos:
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
            raise ValueError("Invalid pseudopotential entry")
        name = entry["file"]
        if not UPF_RE.fullmatch(name):
            raise ValueError("Unsafe UPF name")
        pinned = entry.get("sha256")
        if pinned is not None and (not isinstance(pinned, str) or not SHA_RE.fullmatch(pinned)):
            raise ValueError("Invalid UPF hash")
        record = {"element": entry.get("element"), "file": name,
                  "sha256_expected": pinned, "sha256_actual": None,
                  "present": False, "matches_pinned_hash": None}
        try:
            path = verified_file(root, "pseudo/" + name, MAX_UPF)
            if path.stat().st_size == 0:
                raise ValueError("Empty UPF")
            record["present"] = True
            record["sha256_actual"] = digest(path)
            record["matches_pinned_hash"] = (
                record["sha256_actual"] == pinned if pinned else None)
            if pinned and not record["matches_pinned_hash"]:
                integrity["all_pinned_upfs_match"] = False
        except ValueError:
            integrity["all_required_upfs_present"] = False
            if pinned:
                integrity["all_pinned_upfs_match"] = False
        if not pinned:
            integrity["all_upfs_pinned"] = False
        integrity["pseudopotentials"].append(record)
    output = {"job_done": False, "scf_converged": False, "geometry_converged": None,
              "energy_ry": None, "energy_ev": None, "total_force_ry_bohr": None,
              "max_force_component_ry_bohr": None, "energy_observation_count": 0,
              "energy_tail_ry": [], "output_bytes": None}
    output_hash = None
    output_error = None
    try:
        file = verified_file(root, "structure.out", MAX_OUTPUT)
        output = parse_output(file)
        output_hash = digest(file)
    except ValueError as exc:
        output_error = str(exc)
    output["geometry_converged"] = (output.pop("_geometry_converged_detected", False)
                                     if calc == "relax" else None)
    integrity_ok = (integrity["input_matches"]
                    and integrity["all_required_upfs_present"]
                    and integrity["all_pinned_upfs_match"]
                    and integrity["slurm_script_matches"] is not False)
    qe_ok = (output["job_done"] and output["scf_converged"]
             and output["energy_ry"] is not None
             and (calc != "relax" or output["geometry_converged"]))
    if not integrity_ok:
        status = "invalid"
    elif exit_code not in (None, 0):
        status = "failed"
    elif not output["job_done"] or output_error:
        status = "incomplete"
    elif not qe_ok:
        status = "not_converged"
    elif not integrity["all_upfs_pinned"] or integrity["slurm_script_matches"] is None:
        status = "unverified"
    else:
        status = "completed"
    job_id = os.environ.get("SLURM_JOB_ID", "")
    if not re.fullmatch(r"\d{1,18}", job_id):
        job_id = None
    return {
        "schema": SCHEMA, "source": "offline-truba-collector", "calculation": calc,
        "status": status, "scientific_convergence_verified": False,
        "execution": {"job_id": job_id, "slurm_exit_code": exit_code,
                      "submitted_by_collector": False,
                      "slurm_ntasks": os.environ.get("SLURM_NTASKS") if job_id else None},
        "integrity": integrity,
        "qe": output, "output_sha256": output_hash, "output_error": output_error,
        "warning": "QE completion and recorded input hashes do not prove physical convergence."
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, default=Path("."))
    parser.add_argument("--output", type=str, default="summary.json")
    parser.add_argument("--exit-code", type=int, default=None)
    args = parser.parse_args(argv)
    if args.output != "summary.json":
        parser.error("P1 collector writes only summary.json in bundle root")
    try:
        root = args.bundle.resolve(strict=True)
        record = collect(root, args.exit_code)
        dest = root / "summary.json"
        if dest.is_symlink():
            raise ValueError("Refusing symlink summary.json")
        serialized = json.dumps(record, ensure_ascii=False, sort_keys=True, indent=2,
                                allow_nan=False) + "\n"
        if len(serialized.encode("utf-8")) > 512_000:
            raise ValueError("Summary exceeds 500 KiB limit")
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=root, prefix=".qe-summary-",
                                         suffix=".tmp", delete=False) as stream:
            tmp = Path(stream.name)
            stream.write(serialized)
        os.replace(tmp, dest)
        print("Summary written:", dest, "status:", record["status"])
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("TRUBA collector refused input:", exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
