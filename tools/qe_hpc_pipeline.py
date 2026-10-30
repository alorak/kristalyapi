#!/usr/bin/env python3
"""Strict offline QE/SLURM pipeline stage preparation, evidence and summary.

Only the generated fixed workflow is supported: optional fixed-cell relax,
SCF, bands/bands.x, NSCF, DOS and projected DOS. This tool never submits jobs,
executes shell commands (except operator-invoked read-only sacct accounting),
downloads pseudopotentials or infers a k-path.
Requires Python 3.9+ standard library only.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

SCHEMA = "kristalyapi.truba-qe-pipeline.v1"
REPORT_SCHEMA = "kristalyapi.truba-qe-stage.v1"
SUMMARY_SCHEMA = "kristalyapi.truba-qe-pipeline-summary.v1"
SHA = re.compile(r"[0-9a-f]{64}\Z")
UPF = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf\Z", re.I)
NUM = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[dDeE][+-]?\d+)?"
STAGES = ("relax", "scf", "bands", "bands_pp", "nscf", "dos", "projwfc")
STAGE_OUTPUTS = {
    "relax": ("relax.out", ()),
    "scf": ("scf.out", ()),
    "bands": ("bands.out", ()),
    "bands_pp": ("bands_pp.out", ("bands.dat.gnu",)),
    "nscf": ("nscf.out", ()),
    "dos": ("dos.out", ("dos.dat",)),
    "projwfc": ("projwfc.out", ("pdos.pdos_tot",)),
}
MAX_FILE = 1024 * 1024 * 1024
MAX_MANIFEST = 128 * 1024


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def file_at(root: Path, rel: str, size_limit: int = MAX_FILE) -> Path:
    if (not isinstance(rel, str) or rel.startswith("/") or "\\" in rel or
            any(part in ("", ".", "..") for part in rel.split("/"))):
        raise ValueError("Invalid relative path")
    path = root / rel
    if path.is_symlink() or not path.is_file() or path.stat().st_size > size_limit:
        raise ValueError("Required safe file missing or oversized: " + rel)
    if not path.resolve().is_relative_to(root):
        raise ValueError("File escapes pipeline root")
    return path


def require_hash(root: Path, rel: str, digest: str, limit: int = MAX_FILE) -> Path:
    if not isinstance(digest, str) or not SHA.fullmatch(digest):
        raise ValueError("Invalid expected hash: " + rel)
    path = file_at(root, rel, limit)
    if sha256(path) != digest:
        raise ValueError("SHA-256 mismatch: " + rel)
    return path


def atomic_json(path: Path, value: dict) -> None:
    if path.is_symlink() or path.exists():
        raise ValueError("Refusing to overwrite existing evidence: " + path.name)
    encoded = (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False,
                          allow_nan=False) + "\n").encode("utf-8")
    if len(encoded) > MAX_MANIFEST:
        raise ValueError("Evidence JSON too large")
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".qe-stage-",
                                     delete=False) as stream:
        temp = Path(stream.name)
        stream.write(encoded)
    try:
        if path.exists() or path.is_symlink():
            raise ValueError("Refusing to replace evidence")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def load_manifest(root: Path) -> dict:
    value = json.loads(file_at(root, "pipeline.json", MAX_MANIFEST).read_text("utf-8"))
    if not isinstance(value, dict) or value.get("schema") != SCHEMA:
        raise ValueError("Unsupported pipeline.json schema")
    plan = value.get("stages")
    calc = value.get("calculation")
    expected = list(STAGES) if calc == "relax" else list(STAGES[1:])
    if plan != expected:
        raise ValueError("Invalid or unsupported stage plan")
    pins = value.get("file_sha256")
    if not isinstance(pins, dict):
        raise ValueError("Missing package file hashes")
    for rel in ("structure.in", "pipeline.py", "submit.sh",
                *("stages/" + step + ".slurm" for step in plan)):
        require_hash(root, rel, pins.get(rel), MAX_MANIFEST if rel != "structure.in" else 4 * 1024 * 1024)
    if "resume.sh" in pins:
        require_hash(root, "resume.sh", pins["resume.sh"], MAX_MANIFEST)
    # Legacy P1.2 packages remain valid; new P1.3 ZIPs must pin BOTH
    # converter and PDOS parser before any stage starts.
    pinned_converter = "electronic.py" in pins
    pinned_pdos = "qe_pdos.py" in pins
    if pinned_converter != pinned_pdos:
        raise ValueError("Incomplete electronic converter provenance")
    if pinned_converter:
        for rel in ("electronic.py", "qe_pdos.py"):
            require_hash(root, rel, pins[rel], MAX_MANIFEST)
    pseudos = value.get("pseudopotentials")
    if not isinstance(pseudos, list) or not 1 <= len(pseudos) <= 118:
        raise ValueError("Invalid pseudopotential list")
    names = set()
    for pseudo in pseudos:
        if not isinstance(pseudo, dict) or not isinstance(pseudo.get("file"), str):
            raise ValueError("Invalid pseudopotential record")
        name = pseudo["file"]
        if not UPF.fullmatch(name) or name.lower() in names:
            raise ValueError("Unsafe or duplicate UPF filename")
        names.add(name.lower())
        path = file_at(root, "pseudo/" + name, 24 * 1024 * 1024)
        if path.stat().st_size == 0:
            raise ValueError("Empty UPF: " + name)
        expected_sha = pseudo.get("sha256")
        if expected_sha is not None:
            require_hash(root, "pseudo/" + name, expected_sha, 24 * 1024 * 1024)
    opts = value.get("electronic")
    if not isinstance(opts, dict) or not isinstance(opts.get("path"), list):
        raise ValueError("Missing electronic setup")
    if not isinstance(opts.get("nbnd"), int) or not 1 <= opts["nbnd"] <= 10000:
        raise ValueError("Invalid nbnd")
    mesh = opts.get("mesh")
    if not isinstance(mesh, list) or len(mesh) != 3 or any(
            not isinstance(n, int) or not 1 <= n <= 48 for n in mesh):
        raise ValueError("Invalid NSCF mesh")
    path = opts["path"]
    if not 2 <= len(path) <= 32:
        raise ValueError("Invalid band path length")
    for p in path:
        if (not isinstance(p, dict) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,15}",
                str(p.get("label", ""))) or not isinstance(p.get("k"), list)
                or len(p["k"]) != 3 or any(type(n) not in (float, int)
                or not math.isfinite(n) or abs(n) > 2 for n in p["k"])
                or type(p.get("segments")) is not int or not 1 <= p["segments"] <= 500):
            raise ValueError("Invalid band path record")
    if path[-1]["segments"] != 1:
        raise ValueError("Last band-path segment must be 1")
    # P1.4 display selection never changes pw.x nbnd. All raw bands are
    # inspected by the converter, but only the selected curves are exported.
    samples = 1 + sum(p["segments"] for p in path[:-1])
    window = opts.get("band_window")
    if pinned_converter:
        if opts["nbnd"] * samples > 4_000_000:
            raise ValueError("P1.4 raw band scan exceeds 4 million samples")
        if window is None:
            if opts["nbnd"] > 300:
                raise ValueError("P1.4 explicit band window required above 300 bands")
            selected = opts["nbnd"]
        else:
            if (not isinstance(window, list) or len(window) != 2 or
                    any(type(n) is not int for n in window) or
                    not 1 <= window[0] <= window[1] <= opts["nbnd"] or
                    window[1] - window[0] + 1 > 300):
                raise ValueError("P1.4 invalid one-based band window")
            selected = window[1] - window[0] + 1
        if selected * samples > 120_000:
            raise ValueError("P1.4 band window exceeds 120000 frontend plot samples")
    elif window is not None:
        raise ValueError("P1.4 plot window requires pinned electronic converter")

    for name in ("emin", "emax", "delta_e", "degauss"):
        v = opts.get(name)
        if type(v) not in (int, float) or not math.isfinite(v):
            raise ValueError("Invalid DOS parameter: " + name)
    if (opts["emin"] >= opts["emax"] or not 0.005 <= opts["delta_e"] <= 0.5
            or not 0.0001 <= opts["degauss"] <= 0.1):
        raise ValueError("DOS parameter range invalid")
    return value


def unique_replace(text: str, pattern: str, replacement: str, flags: int = re.M | re.I) -> str:
    result, n = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    if n != 1:
        raise ValueError("Expected source QE card missing: " + pattern[:35])
    return result


def change_calc(source: str, calc: str) -> str:
    source = unique_replace(source, r"^\s*calculation\s*=\s*['\"](?:scf|relax)['\"]",
                            " calculation = '" + calc + "'")
    # &IONS must be absent in non-relaxation calculations.
    source = re.sub(r"(?ims)^\s*&IONS\b.*?^\s*/\s*$", "", source)
    return source


def change_kpoints(source: str, card: str) -> str:
    return unique_replace(source, r"^K_POINTS\s+automatic\s*\n\s*\d+\s+\d+\s+\d+\s+[01]\s+[01]\s+[01]\s*$",
                          card.rstrip() + "\n", re.M | re.I)


def apply_nbnd(source: str, nbnd: int) -> str:
    if re.search(r"(?im)^\s*nbnd\s*=", source):
        raise ValueError("Input already declares nbnd")
    match = re.search(r"(?im)^[ \t]*ntyp[ \t]*=[ \t]*(\d+)[ \t]*,?[ \t]*$", source)
    if not match:
        raise ValueError("Source ntyp missing")
    return source[:match.end()] + "\n nbnd = " + str(nbnd) + "," + source[match.end():]


def relaxed_positions(source: str, relax_output: str) -> str:
    if not re.search(r"(?i)\bJOB\s+DONE\.", relax_output):
        raise ValueError("Relax output not finished")
    if not re.search(r"(?i)\bbfgs\s+converged\b", relax_output):
        raise ValueError("Relax was not geometry converged")
    blocks = list(re.finditer(r"(?is)Begin final coordinates(.*?)End final coordinates", relax_output))
    if not blocks:
        raise ValueError("Relax output lacks final coordinates")
    block = blocks[-1].group(1)
    if re.search(r"(?im)^\s*CELL_PARAMETERS\b", block):
        raise ValueError("Variable-cell relaxation not supported")
    m = re.search(r"(?im)^\s*ATOMIC_POSITIONS\s*\(?crystal\)?\s*$", block)
    if not m:
        raise ValueError("Final QE positions must use crystal fractional coordinates")
    source_positions = re.search(
        r"(?ims)^ATOMIC_POSITIONS\s+crystal\s*\n(.*?)^K_POINTS\s+automatic\s*$",
        source)
    if not source_positions:
        raise ValueError("Source must use fractional ATOMIC_POSITIONS")
    originals = [line.split()[0] for line in source_positions.group(1).splitlines()
                 if line.strip()]
    if not originals or len(originals) > 1000:
        raise ValueError("Invalid source atom count")
    new_rows = []
    for line in block[m.end():].splitlines():
        row = line.split()
        if len(row) < 4 or not re.fullmatch(r"[A-Z][a-z]?", row[0]):
            if new_rows:
                break
            continue
        try:
            xyz = [float(v.replace("D", "E").replace("d", "e")) for v in row[1:4]]
        except ValueError as exc:
            raise ValueError("Invalid relaxed coordinates") from exc
        if not all(math.isfinite(v) for v in xyz):
            raise ValueError("Nonfinite relaxed coordinates")
        new_rows.append(row[0] + " " + " ".join(f"{v % 1.0:.12f}" for v in xyz))
    if [r.split()[0] for r in new_rows] != originals:
        raise ValueError("Relax changed atom order/number; rejecting chained SCF")
    return (source[:source_positions.start()] + "ATOMIC_POSITIONS crystal\n"
            + "\n".join(new_rows) + "\nK_POINTS automatic\n"
            + source[source_positions.end():].lstrip("\r\n"))


def generate_input(root: Path, stage: str, config: dict) -> tuple[str, str]:
    source = file_at(root, "structure.in", 4 * 1024 * 1024).read_text("utf-8")
    elec = config["electronic"]
    if stage == "relax":
        return "structure.in", source
    if stage == "scf":
        if config["calculation"] == "relax":
            relax_text = file_at(root, "relax.out", 32 * 1024 * 1024).read_text("utf-8", errors="replace")
            source = relaxed_positions(source, relax_text)
        return "scf.in", change_calc(source, "scf")
    if stage in ("bands", "nscf"):
        source = file_at(root, "scf.in", 4 * 1024 * 1024).read_text("utf-8")
        source = apply_nbnd(change_calc(source, stage), elec["nbnd"])
        if stage == "bands":
            path = elec["path"]
            card = "K_POINTS crystal_b\n" + str(len(path)) + "\n"
            card += "\n".join(" ".join(f"{v:.12g}" for v in p["k"]) + " "
                              + str(p["segments"]) + " ! " + p["label"] for p in path)
        else:
            card = ("K_POINTS automatic\n"
                    + " ".join(str(v) for v in elec["mesh"]) + " 0 0 0")
        return stage + ".in", change_kpoints(source, card)
    if stage == "bands_pp":
        return "bands_pp.in", ("&BANDS\n prefix='kristalyapi',\n outdir='./tmp',"
                               "\n filband='bands.dat',\n lsym=.false.,\n/\n")
    if stage in ("dos", "projwfc"):
        project = stage == "projwfc"
        return stage + ".in", (
            ("&PROJWFC" if project else "&DOS") + "\n"
            + " prefix='kristalyapi',\n outdir='./tmp',\n"
            + (" filpdos='pdos',\n" if project else " fildos='dos.dat',\n")
            + " DeltaE=" + str(elec["delta_e"]) + ",\n"
            + " ngauss=0,\n degauss=" + str(elec["degauss"]) + ",\n"
            + " Emin=" + str(elec["emin"]) + ",\n"
            + " Emax=" + str(elec["emax"]) + ",\n/\n")
    raise ValueError("Unknown stage")


def previous_report(root: Path, plan: list[str], stage: str, check_save: bool = True) -> dict | None:
    index = plan.index(stage)
    if index == 0:
        return None
    prior = plan[index - 1]
    value = json.loads(file_at(root, "reports/" + prior + ".json", MAX_MANIFEST).read_text("utf-8"))
    if (not isinstance(value, dict) or value.get("schema") != REPORT_SCHEMA or
            value.get("stage") != prior or value.get("status") != "completed"):
        raise ValueError("Prior stage not completed: " + prior)
    for rel, digest in value.get("hashes", {}).items():
        # Validate previous XML BEFORE the new stage; pw.x may then rewrite
        # prefix.save while executing. At finish, historical XML is immutable
        # evidence in the report, not the current saved-state content.
        if rel == "tmp/kristalyapi.save/data-file-schema.xml" and not check_save:
            continue
        require_hash(root, rel, digest)
    if not value.get("hashes") or "tmp/kristalyapi.save/data-file-schema.xml" not in value["hashes"]:
        raise ValueError("Previous stage lacks restart XML evidence")
    return value


def preflight(root: Path) -> dict:
    """Verify pinned offline package before any Slurm queue submission.

    No SSH, SLURM submission, QE solver or network operation happens here.
    The submit script independently calls sbatch --test-only for every stage.
    """
    config = load_manifest(root)
    if (root / 'submissions.txt').exists() or (root / '.submission-lock').exists():
        raise ValueError('Already submitted; new run requires a clean directory')
    for name in ('reports', 'logs', 'tmp'):
        path = root / name
        if path.is_symlink() or (path.exists() and not path.is_dir()):
            raise ValueError('Unsafe work directory: ' + name)
    reports = root / 'reports'
    if reports.exists() and any(reports.iterdir()):
        raise ValueError('Existing stage evidence; use a clean work directory')
    resources = config.get('resources')
    if resources is not None:
        if not isinstance(resources, dict) or resources.get('partition') != 'orfoz' or resources.get('ntasks') not in (56, 112) or resources.get('nodes') != 1:
            raise ValueError('Unsupported TRUBA orfoz resource allocation')
    return {'status': 'preflight-ok', 'stages': config['stages'],
            'slurm_submission_performed': False, 'scientific_convergence_verified': False}


def resume_check(root: Path, stage: str) -> dict:
    """Permit only unstarted/clean serial postprocessors after verified parents.

    Never automatically rerun a pw.x stage after partial writes to prefix.save.
    Original Slurm jobs must be inactive, checked separately by resume.sh.
    No outputs or evidence are overwritten; operator archives failures first.
    """
    config = load_manifest(root)
    plan = config["stages"]
    if stage not in ("bands_pp", "dos", "projwfc") or stage not in plan:
        raise ValueError("Only safe serial postprocessor stages can be resumed")
    if (root / ".resume-lock").exists() or (root / "resubmissions.txt").exists():
        raise ValueError("Resume already submitted; only one manual retry is allowed")
    original = file_at(root, "submissions.txt", MAX_MANIFEST)
    submissions = [line.strip().split() for line in original.read_text("utf-8").splitlines() if line.strip()]
    if not submissions or len(submissions) > len(plan) or any(
            len(row) != 2 or row[0] != plan[i] or
            not re.fullmatch(r"[0-9]{1,18}", row[1])
            for i, row in enumerate(submissions)):
        raise ValueError("Untrusted or inconsistent original Slurm submission records")
    index = plan.index(stage)
    if index == 0:
        raise ValueError("Resume stage requires a verified parent")
    # Ensure all previous reports and immutable artifacts still match.
    for prior in plan[:index]:
        report = json.loads(file_at(root, "reports/" + prior + ".json", MAX_MANIFEST).read_text("utf-8"))
        if (not isinstance(report, dict) or report.get("schema") != REPORT_SCHEMA
                or report.get("stage") != prior or report.get("status") != "completed"):
            raise ValueError("Unverified prior stage: " + prior)
        hashes = report.get("hashes")
        if not isinstance(hashes, dict) or not hashes:
            raise ValueError("Missing prior stage hashes: " + prior)
        for rel, expected in hashes.items():
            # Subsequent PW stages may rewrite the shared XML.
            if rel == "tmp/kristalyapi.save/data-file-schema.xml" and prior != plan[index - 1]:
                continue
            require_hash(root, rel, expected)
    # Refuse reports and partial output files from the restart stage onward.
    # A failed postprocessor's outputs must be archived manually, not discarded.
    for current in plan[index:]:
        if (root / "reports" / (current + ".json")).exists():
            raise ValueError("Stage already has completion evidence: " + current)
        if current != stage and (root / "reports" / (current + ".failure.json")).exists():
            raise ValueError("Later stage unexpectedly ran: " + current)
        output_name, artifacts = STAGE_OUTPUTS[current]
        for name in (output_name, *artifacts):
            if (root / name).exists() or (root / name).is_symlink():
                raise ValueError("Archive existing failed output before resuming: " + name)
        if current == "projwfc" and any(root.glob("pdos.pdos_atm*")):
            raise ValueError("Archive existing partial atom PDOS before resuming")
        if current == "projwfc" and (root / "electronic-results.json").exists():
            raise ValueError("Archive existing electronic JSON before resuming")
    return {"status": "resume-ready", "resume_from": stage, "stages_to_submit": plan[index:],
            "previous_completed": plan[:index], "scientific_convergence_verified": False,
            "slurm_submission_performed": False}


def prepare(root: Path, stage: str) -> None:
    config = load_manifest(root)
    plan = config["stages"]
    if stage not in plan:
        raise ValueError("Stage not in package")
    file_at(root, "stages/" + stage + ".slurm", MAX_MANIFEST)
    if (root / "reports" / (stage + ".json")).exists():
        raise ValueError("Stage already completed; refusing automatic overwrite")
    previous_report(root, plan, stage)
    name, content = generate_input(root, stage, config)
    if name != "structure.in":
        target = root / name
        if target.exists() or target.is_symlink():
            if target.is_symlink() or target.read_text("utf-8") != content:
                raise ValueError("Existing stage input differs; refusing overwrite")
        else:
            target.write_text(content, encoding="utf-8")
    print("Prepared stage:", stage, "input:", name)


def scan_output(path: Path, stage: str) -> None:
    if path.stat().st_size < 1:
        raise ValueError("Empty QE stage output: " + stage)
    done = False
    scf = False
    bfgs = False
    with path.open("r", encoding="utf-8", errors="replace") as stream:
        while line := stream.readline(1024 * 1024 + 1):
            if len(line) > 1024 * 1024:
                raise ValueError("QE output line exceeds limit")
            if re.search(r"\bJOB\s+DONE\.", line, re.I):
                done = True
            if re.search(r"^\s*iteration\s*#", line, re.I):
                scf = False
            if re.search(r"convergence\s+NOT\s+achieved", line, re.I):
                scf = False
            elif re.search(r"convergence\s+has\s+been\s+achieved", line, re.I):
                scf = True
            if re.search(r"\bbfgs\s+converged\b", line, re.I):
                bfgs = True
    if stage in ("relax", "scf", "bands", "nscf") and not done:
        raise ValueError(stage + ": missing JOB DONE")
    if stage in ("relax", "scf") and not scf:
        raise ValueError(stage + ": SCF not converged")
    if stage == "relax" and not bfgs:
        raise ValueError("Relax geometry not converged")


def finish(root: Path, stage: str) -> None:
    config = load_manifest(root)
    plan = config["stages"]
    if stage not in plan:
        raise ValueError("Stage not in package")
    previous_report(root, plan, stage, check_save=False)
    name, content = generate_input(root, stage, config)
    input_path = file_at(root, name, 4 * 1024 * 1024)
    if input_path.read_text("utf-8") != content:
        raise ValueError("Stage input content changed")
    output_name, artifacts = STAGE_OUTPUTS[stage]
    if stage == "projwfc" and "electronic.py" in config["file_sha256"]:
        artifacts = artifacts + ("electronic-results.json",)
    output_path = file_at(root, output_name)
    scan_output(output_path, stage)
    hashes = {name: sha256(input_path), output_name: sha256(output_path)}
    for artifact in artifacts:
        path = file_at(root, artifact)
        if path.stat().st_size == 0:
            raise ValueError("Empty stage artifact: " + artifact)
        hashes[artifact] = sha256(path)
    xml = file_at(root, "tmp/kristalyapi.save/data-file-schema.xml")
    hashes["tmp/kristalyapi.save/data-file-schema.xml"] = sha256(xml)
    report = {"schema": REPORT_SCHEMA, "stage": stage, "status": "completed",
              "completed_utc": datetime.now(timezone.utc).isoformat(),
              "slurm_job_id": (os.environ.get("SLURM_JOB_ID") or None),
              "hashes": hashes, "previous_stage": (
                  plan[plan.index(stage) - 1] if plan.index(stage) else None),
              "scientific_convergence_verified": False}
    if (root / "reports").is_symlink():
        raise ValueError("Unsafe reports directory")
    (root / "reports").mkdir(exist_ok=True)
    atomic_json(root / "reports" / (stage + ".json"), report)
    print("Stage completed:", stage, "hashes:", len(hashes))


def fail(root: Path, stage: str, exit_code: int) -> None:
    if stage not in STAGES:
        raise ValueError("Unknown stage")
    if (root / "reports").is_symlink():
        raise ValueError("Unsafe reports directory")
    (root / "reports").mkdir(exist_ok=True)
    target = root / "reports" / (stage + ".failure.json")
    if target.exists():
        return
    atomic_json(target, {"schema": REPORT_SCHEMA, "stage": stage,
                         "status": "failed", "exit_code": exit_code,
                         "utc": datetime.now(timezone.utc).isoformat()})


def accounting(root: Path, runner=None) -> dict:
    """Operator-only, read-only sacct inspection; no sbatch, shell or QE run.

    Slurm job rows and step-level MaxRSS are kept separately; accounting
    presence is NOT proof of scientific convergence or successful execution.
    """
    config = load_manifest(root)
    plan = config["stages"]
    jobs = []
    for filename, attempt in (("submissions.txt", "original"),
                              ("resubmissions.txt", "manual-resume")):
        path = root / filename
        if not path.exists() and not path.is_symlink():
            if attempt == "original":
                raise ValueError("Missing original Slurm submissions")
            continue
        lines = file_at(root, filename, MAX_MANIFEST).read_text("utf-8").splitlines()
        records = [line.strip().split() for line in lines if line.strip()]
        if not records or len(records) > len(plan):
            raise ValueError("Invalid Slurm submission record count")
        previous_index = -1
        for row in records:
            if (len(row) != 2 or row[0] not in plan or
                    not re.fullmatch(r"[0-9]{1,18}", row[1]) or
                    plan.index(row[0]) != previous_index + 1 and
                    not (previous_index == -1 and attempt == "manual-resume")):
                raise ValueError("Invalid or unsorted Slurm job receipts")
            previous_index = plan.index(row[0])
            jobs.append({"stage": row[0], "job_id": row[1], "attempt": attempt})
    identifiers = [item["job_id"] for item in jobs]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Duplicate Slurm job IDs")
    args = ["sacct", "--parsable2", "--noheader", "--jobs", ",".join(identifiers),
            "--format=JobIDRaw,State,ExitCode,ElapsedRaw,AllocCPUS,ReqMem,MaxRSS,MaxDiskRead,MaxDiskWrite,NodeList"]
    try:
        if runner is None:
            runner = subprocess.run
        result = runner(args, capture_output=True, text=True, timeout=20, check=True)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValueError("sacct unavailable or failed") from exc
    if not isinstance(result.stdout, str) or len(result.stdout.encode("utf-8")) > 512 * 1024:
        raise ValueError("Oversized or invalid sacct response")
    by_id = {item["job_id"]: {"job": None, "steps": []} for item in jobs}
    fields = ("job_id_raw", "state", "exit_code", "elapsed_raw", "alloc_cpus",
              "requested_memory", "max_rss", "disk_read", "disk_write", "nodelist")
    for raw in result.stdout.splitlines():
        if not raw.strip():
            continue
        values = raw.split("|")
        if len(values) != len(fields) or any(len(v) > 512 for v in values):
            raise ValueError("Malformed sacct accounting row")
        raw_id = values[0]
        root_id = raw_id.split(".", 1)[0]
        if root_id not in by_id or not re.fullmatch(re.escape(root_id) + r"(?:[.][A-Za-z0-9_-]{1,20})?", raw_id):
            raise ValueError("Unexpected Slurm job/step ID in accounting")
        record = dict(zip(fields, values))
        if root_id == raw_id:
            if by_id[root_id]["job"] is not None:
                raise ValueError("Duplicate sacct job row")
            by_id[root_id]["job"] = record
        else:
            if len(by_id[root_id]["steps"]) >= 32:
                raise ValueError("Excessive Slurm step records")
            by_id[root_id]["steps"].append(record)
    return {"schema": "kristalyapi.truba-qe-accounting.v1",
            "source": "operator-invoked-sacct", "scientific_convergence_verified": False,
            "status": "collected" if all(x["job"] is not None for x in by_id.values()) else "partial",
            "pipeline_manifest_sha256": sha256(file_at(root, "pipeline.json", MAX_MANIFEST)),
            "jobs": [{**item, **by_id[item["job_id"]]} for item in jobs],
            "notice": "MaxRSS may be missing on job rows; inspect step records. No resource sufficiency or physical convergence is asserted."}


def summary(root: Path) -> None:
    config = load_manifest(root)
    records = []
    for name in config["stages"]:
        path = root / "reports" / (name + ".json")
        if not path.is_file() or path.is_symlink():
            records.append({"stage": name, "status": "missing"})
            continue
        report = json.loads(file_at(root, "reports/" + name + ".json", MAX_MANIFEST).read_text("utf-8"))
        valid = (report.get("schema") == REPORT_SCHEMA and
                 report.get("stage") == name and report.get("status") == "completed")
        if valid:
            try:
                for rel, digest in report["hashes"].items():
                    # QE rewrites prefix.save XML during later PW stages;
                    # historical XML digests are evidence, not immutable files.
                    if rel == "tmp/kristalyapi.save/data-file-schema.xml" and name != config["stages"][-1]:
                        continue
                    require_hash(root, rel, digest)
            except (ValueError, KeyError):
                valid = False
        records.append({"stage": name, "status": "completed" if valid else "invalid",
                        "job_id": report.get("slurm_job_id"),
                        "file_count": len(report.get("hashes", {}))})
    report = {
        "schema": SUMMARY_SCHEMA, "status": "completed" if all(
            r["status"] == "completed" for r in records) else "incomplete",
        "scientific_convergence_verified": False,
        "all_upfs_pinned": all(p.get("sha256") for p in config["pseudopotentials"]),
        "stages": records,
        "structure_in_sha256": config["file_sha256"]["structure.in"],
        "pipeline_manifest_sha256": sha256(file_at(root, "pipeline.json", MAX_MANIFEST)),
        "note": "Stage completion and hashes are not a band-gap, DOS or physical-convergence proof."
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    dest = root / "pipeline-summary.json"
    if dest.is_symlink():
        raise ValueError("Refusing symlink output")
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("preflight", "resume-check", "prepare", "finish", "fail", "summary", "accounting"))
    parser.add_argument("stage", nargs="?")
    parser.add_argument("code", nargs="?", type=int)
    args = parser.parse_args(argv)
    try:
        root = Path.cwd().resolve()
        if args.action not in ("summary", "preflight", "accounting") and args.stage not in STAGES:
            raise ValueError("Stage name required")
        if args.action == "preflight":
            print(json.dumps(preflight(root), indent=2))
        elif args.action == "resume-check":
            print(json.dumps(resume_check(root, args.stage), indent=2))
        elif args.action == "accounting":
            print(json.dumps(accounting(root), indent=2))
        elif args.action == "prepare":
            prepare(root, args.stage)
        elif args.action == "finish":
            finish(root, args.stage)
        elif args.action == "fail":
            fail(root, args.stage, args.code or 1)
        else:
            summary(root)
        return 0
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print("TRUBA pipeline refused:", exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
