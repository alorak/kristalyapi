#!/usr/bin/env python3
"""D5.2: inspect frozen MoS2 QE initialization evidence, without execution.

Only reads a previously recorded 4x4, 416-band, nstep=0 Docker OOM
pilot. It does NOT call Docker, pw.x, Slurm, the network, or any API.
QE's printed '>' memory estimates are neither RSS nor observed peak.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re

import qe_defect_init as init

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "validation-results/qe-mos2-d5-init-first-20261029-arm64"
PREPARED = ROOT / "validation-results/qe-mos2-d5-preparation-20261029"
PLAN = ROOT / "tests/fixtures/qe/mos2-defect-preparation.json"
IDS = ("pristine", "V_S", "V_2S", "O_S")
LIMIT_BYTES = 6 * 1024**3
PREPARED_SHA = "7dd710427f25552718f5b92bc287173cd56c90032c1101f800c27974113df759"
PILOT_COMMIT = "4f9173b122383068a1c40cec596fc895ebb0d558"
IMAGE_ID = "sha256:21d4887dfe9a0fd2123beda7ba9847166b1b39b36fc448e498cb3ba9c2660f00"
SCHEMA = "kristalyapi.qe-d5-resource-review.v1"
HEX64 = re.compile(r"[a-f0-9]{64}\Z")
# QE writes these as *per process* decimal GB with a greater-than sign.
STATIC = re.compile(r"(?im)^\s*Estimated static dynamical RAM per process\s*>\s*([0-9]+(?:\.[0-9]+)?)\s+GB\s*$")
MAXIMUM = re.compile(r"(?im)^\s*Estimated max dynamical RAM per process\s*>\s*([0-9]+(?:\.[0-9]+)?)\s+GB\s*$")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_checked(base, relative, max_bytes):
    base = Path(base)
    if base.is_symlink() or not base.is_dir():
        raise ValueError("Invalid evidence directory")
    path = base / relative
    if path.is_symlink() or not path.resolve().is_relative_to(base.resolve()):
        raise ValueError("Symlink or escaped evidence path: " + str(relative))
    if not path.is_file() or not 0 <= path.stat().st_size <= max_bytes:
        raise ValueError("Missing or oversized evidence: " + str(relative))
    return path.read_bytes()


def json_checked(base, relative, limit):
    try:
        data = json.loads(read_checked(base, relative, limit))
    except (ValueError, UnicodeError) as exc:
        raise ValueError("Unusable evidence JSON: " + str(relative)) from exc
    if not isinstance(data, dict):
        raise ValueError("Evidence document must be an object")
    return data


def estimate_pair(text):
    static = STATIC.findall(text)
    dynamic = MAXIMUM.findall(text)
    if len(static) != 1 or len(dynamic) != 1:
        raise ValueError("QE per-process static/max printed memory estimates missing or ambiguous")
    values = [float(static[0]), float(dynamic[0])]
    if not all(math.isfinite(x) and x > 0 for x in values) or values[1] < values[0]:
        raise ValueError("Contradictory QE memory estimates")
    return {"static_gt_decimal_gb": values[0], "max_gt_decimal_gb": values[1],
            "unit": "decimal GB per process, QE printed > lower bounds",
            "observed_peak_bytes": None}


def budgets_checked(budgets):
    if isinstance(budgets, str):
        try:
            items = [int(x.strip()) for x in budgets.split(",")]
        except ValueError as exc:
            raise ValueError("Budget list must be integer GiB values") from exc
    else:
        items = list(budgets)
    if not 1 <= len(items) <= 8 or len(set(items)) != len(items) or any(
            type(x) is not int or x < 1 or x > 512 for x in items):
        raise ValueError("Provide 1–8 distinct memory budgets from 1 to 512 GiB")
    return items


def assessment(case, gib):
    capacity = gib * 1024**3
    estimates = case["qe_printed_estimate"]
    if estimates["static_gt_decimal_gb"] * 10**9 >= capacity:
        verdict = "below_qe_printed_static_lower_bound"
    elif estimates["max_gt_decimal_gb"] * 10**9 >= capacity:
        verdict = "below_qe_printed_max_lower_bound"
    else:
        verdict = "not_excluded_by_printed_lower_bounds_unverified"
    if gib == 6:
        verdict = "observed_oom_at_this_exact_pilot_configuration"
    return {"budget_gib": gib, "budget_bytes": capacity, "assessment": verdict,
            "experiment_executed": False, "sufficient_for_full_scf": None}


def verify_and_plan(pilot=PILOT, prepared=PREPARED, plan_path=PLAN, budgets=(6, 32, 64, 96, 128)):
    pilot, prepared, plan_path = Path(pilot), Path(prepared), Path(plan_path)
    budgets = budgets_checked(budgets)
    summary_bytes = read_checked(pilot, "summary.json", 100_000)
    summary = json.loads(summary_bytes)
    independent = json_checked(pilot, "independent-inspection.json", 100_000)
    preparation_bytes = read_checked(prepared, "preparation.json", 2_000_000)
    preparation = json.loads(preparation_bytes)
    plan = json.loads(read_checked(plan_path.parent, plan_path.name, 100_000))
    if summary.get("schema") != "kristalyapi.mos2-defect-initialization-pilot.v1" or (
        preparation.get("schema") != "kristalyapi.mos2-defect-preparation.v1" or
        plan.get("schema") != "kristalyapi.mos2-defect-preparation-plan.v1"):
        raise ValueError("Unsupported D5 evidence schema")
    if summary.get("source_commit") != PILOT_COMMIT or summary.get("image_id") != IMAGE_ID or (
        summary.get("preparation_sha256") != PREPARED_SHA or
        sha256(preparation_bytes) != PREPARED_SHA or
        summary.get("architecture") != "arm64"):
        raise ValueError("Recorded D5 baseline source/image/preparation identity mismatch")
    limit = summary.get("limits", {})
    if limit != {"memory_bytes": LIMIT_BYTES, "cpus": 2, "timeout_seconds_per_case": 120, "nbnd": 416}:
        raise ValueError("Pilot memory, CPU, time or band limit changed")
    if summary.get("status") != "failed" or summary.get("calculation_performed") is not False or (
        summary.get("initialization_only") is not True):
        raise ValueError("Failed initialization cannot be reclassified as a scientific result")
    pseudos = summary.get("pseudopotential_sha256", {})
    if pseudos != {k: v["reviewed_sha256"] for k, v in plan["pseudopotentials"].items()}:
        raise ValueError("Pinned pseudopotential identities mismatch")
    if (not isinstance(preparation.get("cases"), list) or
        not isinstance(summary.get("cases"), list) or
        not isinstance(independent.get("cases"), list)):
        raise ValueError("D5 cases missing")
    def indexed(items):
        names = [row.get("id") for row in items if isinstance(row, dict)]
        if len(names) != len(items) or names != list(IDS):
            raise ValueError("D5 case IDs/order changed")
        return {row["id"]: row for row in items}
    prepared_cases = indexed(preparation["cases"])
    pilot_cases = indexed(summary["cases"])
    independently_checked = indexed(independent["cases"])
    if independent.get("scope") != "Post-run raw/OOM inspection; original failed pilot files kept unchanged" or (
        not independent.get("source_hashes_checked_against_recorded_commit") or
        not all(independent["source_hashes_checked_against_recorded_commit"].values())):
        raise ValueError("Independent inspection does not claim all recorded source checks")
    reviewed = []
    for name in IDS:
        candidate, record, cross = prepared_cases[name], pilot_cases[name], independently_checked[name]
        artifact = record.get("artifact_sha256")
        if not isinstance(artifact, dict) or set(artifact) != {
                "initialization.in", "initialization.out", "initialization.stderr"} or (
                not all(isinstance(v, str) and HEX64.fullmatch(v) for v in artifact.values())):
            raise ValueError("Incomplete/invalid raw artifact SHA set for " + name)
        files = {}
        for filename, digest in artifact.items():
            content = read_checked(pilot, name + "/" + filename, 256_000)
            if sha256(content) != digest:
                raise ValueError("Raw pilot artifact hash mismatch: " + name + "/" + filename)
            files[filename] = content
        inspection = json_checked(pilot, name + "/inspection.json", 20_000)
        for key in ("id", "status", "resources", "exit_code", "oom_killed",
                    "container_removed", "artifact_sha256", "initialization_only", "calculation_performed"):
            if inspection.get(key) != record.get(key):
                raise ValueError("Per-case inspection and summary disagree: " + name + "/" + key)
        resources = record.get("resources", {})
        if (record.get("id") != name or record.get("status") != "failed" or
            record.get("initialization_only") is not True or
            record.get("calculation_performed") is not False or
            record.get("exit_code") != 137 or record.get("oom_killed") is not True or
            record.get("container_removed") is not True or
            resources != {"memory_bytes": LIMIT_BYTES, "memory_swap_bytes": LIMIT_BYTES,
                          "nano_cpus": 2_000_000_000, "network": "none", "read_only": True}):
            raise ValueError("Original Docker failure/isolation proof changed: " + name)
        text = files["initialization.out"].decode("utf-8", errors="replace")
        diagnostics = init.initialization_diagnostics(text)
        if any(diagnostics[k] for k in ("has_energy", "has_scf_convergence", "scf_started")):
            raise ValueError("Unexpected SCF or physical-result evidence in initialization pilot")
        if diagnostics["qe_version"] != "6.7MaX" or any(
            diagnostics[k] != cross[k] for k in
            ("atoms", "electrons", "bands", "qe_version", "has_energy",
             "has_scf_convergence", "scf_started", "raw_memory_estimate_lines")) or any(
            cross.get(k) != val for k, val in
            (("docker_oom_killed", True), ("exit_code", 137), ("container_removed", True))):
            raise ValueError("Independent diagnostic evidence differs from raw QE output: " + name)
        counts = candidate["capacity"]
        if (diagnostics["atoms"] != len(candidate["sites"]) or
            diagnostics["electrons"] != counts["neutral_valence_electrons"] or
            diagnostics["bands"] != 416 or
            counts["minimum_unpolarized_occupied_bands"] !=
              math.ceil(counts["neutral_valence_electrons"] / 2)):
            raise ValueError("Actual QE atom/electron/band counts do not match pinned candidate")
        if (b"nstep=0" not in files["initialization.in"] or
            b"nbnd=416" not in files["initialization.in"]):
            raise ValueError("Initialization input no longer fixes nstep=0 and 416 bands")
        estimates = estimate_pair(text)
        reviewed.append({"case_id": name, "atom_count": len(candidate["sites"]),
            "neutral_valence_electrons": counts["neutral_valence_electrons"],
            "minimum_occupied_bands_unpolarized": counts["minimum_unpolarized_occupied_bands"],
            "pilot_bands": 416, "qe_version": diagnostics["qe_version"],
            "qe_printed_estimate": estimates, "actual_oom_killed_at_6_gib": True,
            "exit_code": 137, "observed_peak_memory_bytes": None,
            "raw_stdout_sha256": artifact["initialization.out"],
            "resource_budgets": [assessment({"qe_printed_estimate": estimates}, b) for b in budgets]})
    return {
        "schema": SCHEMA, "basis": "frozen actual 2026-10-29 ARM64 QE initialization failure evidence",
        "calculation_performed_by_review": False, "new_experiments_executed": False,
        "pilot_source_commit": PILOT_COMMIT,
        "pilot_summary_sha256": sha256(summary_bytes),
        "preparation_sha256": sha256(preparation_bytes),
        "image_id": IMAGE_ID, "original_limit_gib": 6,
        "original_oom_case_count": 4, "case_count": len(reviewed),
        "cases": reviewed,
        "status": "execution_blocked_resource_evidence_incomplete",
        "scientific_convergence_accepted": False,
        "api_limits_changed": False,
        "evidence_qualification": ("SHA consistency and previously recorded source inspection checked; "
            "not independent cryptographic attestation of all Git history or physical correctness. "
            "QE decimal-GB per-process '>' figures are lower-bound printed estimates, "
            "not an observed peak or a guaranteed RAM requirement."),
        "open_gates": [
            "Operator must approve a separately isolated, pinned higher-memory nstep=0 pilot; no execution in this tool.",
            "Before a new run verify actual host/cgroup RAM, scratch, CPU/MPI topology and QE/UPF/image hashes.",
            "Re-measure per-case peak cgroup memory, wall time, QE diagnostics and OOM rather than extrapolating from the printed estimates.",
            "Determine physically justified occupied plus empty bands and spin/occupation for each defect before an SCF/DOS series.",
            "Keep 128-band/64-atom API defaults unchanged until a separately tested resource profile and safe policy are approved.",
            "Defect relaxation, independent SCF, cutoff/k-mesh/supercell and spin convergence remain unperformed."
        ]
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pilot", type=Path, default=PILOT)
    ap.add_argument("--prepared", type=Path, default=PREPARED)
    ap.add_argument("--plan", type=Path, default=PLAN)
    ap.add_argument("--budgets-gib", default="6,32,64,96,128",
                    help="Comma-separated planning budgets; NEVER runs an experiment")
    ap.add_argument("--output", type=Path, help="New JSON report path; refuses overwrite")
    args = ap.parse_args(argv)
    try:
        data = verify_and_plan(args.pilot, args.prepared, args.plan,
                               budgets_checked(args.budgets_gib))
        text = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.output is not None:
            if args.output.is_symlink():
                raise ValueError("Output symlinks forbidden")
            with args.output.open("x", encoding="utf-8") as stream:
                stream.write(text)
        else:
            print(text, end="")
    except (ValueError, OSError, KeyError, TypeError) as exc:
        ap.exit(1, "D5 offline resource review failed: " + str(exc) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
