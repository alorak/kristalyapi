#!/usr/bin/env python3
"""Verify D5.3 operator output from recorded bytes, with no Docker/QE execution.

This checks internal reproducibility, not externally signed/remote attestation.
"""
import argparse
import json
from pathlib import Path

import qe_defect_init as init
import qe_defect_metered_pilot as pilot
import qe_defect_resource_review as review

SCHEMA="kristalyapi.qe-d5-metered-verification.v1"
ALLOWED={
    "inputs/initialization.in",
    "evidence/initialization.out","evidence/initialization.stderr",
    "evidence/docker-start.stdout","evidence/docker-start.stderr",
    "evidence/container-metrics.json"
}
REQUIRED={"inputs/initialization.in",
          "evidence/docker-start.stdout","evidence/docker-start.stderr"}


def verify(folder):
    folder=Path(folder)
    report=review.json_checked(folder,"report.json",120_000)
    settings=report.get("settings")
    if report.get("schema")!=pilot.SCHEMA or not isinstance(settings,dict):
        raise ValueError("Unrecognized D5.3 pilot result")
    checked=pilot.checked_settings(
        settings.get("case"),settings.get("image_id"),settings.get("architecture"),
        settings.get("memory_bytes",0)//1024**3 if type(settings.get("memory_bytes")) is int and
            settings["memory_bytes"]%1024**3==0 else None,
        settings.get("scratch_tmpfs_bytes",0)//1024**3 if type(settings.get("scratch_tmpfs_bytes")) is int and
            settings["scratch_tmpfs_bytes"]%1024**3==0 else None,
        settings.get("cpus"),settings.get("timeout_seconds"))
    if settings!=checked or report.get("source_preparation_sha256")!=review.PREPARED_SHA or (
        report.get("source_pilot_commit")!=review.PILOT_COMMIT) or (
        report.get("scientific_convergence_accepted") is not False) or (
        report.get("full_scf_resource_validated") is not False) or (
        report.get("initialization_only") is not True):
        raise ValueError("Changed settings, source or scientific-acceptance claims")
    files=report.get("artifact_sha256")
    if not isinstance(files,dict) or not REQUIRED<=set(files) or set(files)-ALLOWED:
        raise ValueError("Missing or unexpected artifact paths")
    all_found={}
    for directory in ("inputs","evidence"):
        path=folder/directory
        if path.is_symlink() or not path.is_dir():
            raise ValueError("Unsafe evidence directory")
        for item in path.iterdir():
            rel=item.relative_to(folder).as_posix()
            if item.is_symlink() or not item.is_file() or rel not in files:
                raise ValueError("Untracked evidence file or symlink")
            if not 0<=item.stat().st_size<=2_000_000 or (
                not isinstance(files[rel],str) or
                not review.HEX64.fullmatch(files[rel])):
                raise ValueError("Oversized artifact or malformed hash")
            data=review.read_checked(folder,rel,2_000_000)
            if pilot.sha(data)!=files[rel]:
                raise ValueError("Recorded evidence SHA-256 mismatch: "+rel)
            all_found[rel]=data
    if set(all_found)!=set(files):
        raise ValueError("Missing recorded evidence")
    rendered,_,selected,_=pilot.pinned_input(settings["case"])
    if all_found["inputs/initialization.in"]!=rendered.encode("utf-8"):
        raise ValueError("Input does not match pinned D5.1/D5.2 preparation")
    raw=all_found.get("evidence/initialization.out",b"").decode("utf-8",errors="replace")
    diag=init.initialization_diagnostics(raw)
    if diag!=report.get("raw_qe_diagnostics"):
        raise ValueError("Raw QE diagnostics differ from report")
    if any(diag[k] for k in ("has_energy","has_scf_convergence","scf_started")) or (
        report.get("calculation_performed") is not False):
        raise ValueError("Unexpected SCF/energy claimed in an initialization-only pilot")
    metrics=None
    if "evidence/container-metrics.json" in all_found:
        metrics=json.loads(all_found["evidence/container-metrics.json"])
    if metrics!=report.get("resource_measurements"):
        raise ValueError("cgroup evidence differs from report")
    status=report.get("status")
    if status=="initialized_only_metered":
        if report.get("container_removed") is not True or (
            report.get("oom_killed") is not False) or (
            report.get("exit_code")!=0):
            raise ValueError("Successful initialization contradicts container inspection")
        expected=pilot.evaluated_status(report,raw,metrics,selected)
        if expected!=status or report.get("cgroup_memory_peak_bytes")!=metrics["memory_peak_bytes"]:
            raise ValueError("Initialization success cannot be proven from recorded output")
    else:
        if status not in ("oom_observed","timed_out","failed",
                          "invalid_initialization_proof","incomplete_resource_evidence",
                          "unexpected_scf_execution","cleanup_unverified",
                          "evidence_unsafe_or_oversized"):
            raise ValueError("Unsupported/untrusted pilot status")
        # The verifier will never upgrade failed/partial cases.
    return {"schema":SCHEMA,"case":settings["case"],
            "recorded_status":status,"artifact_count":len(all_found),
            "artifacts_sha256_verified":True,
            "input_matches_pinned_preparation":True,
            "source_hash_consistency_checked":True,
            "cgroup_peak_bytes":metrics.get("memory_peak_bytes") if isinstance(metrics,dict) else None,
            "initialization_only_accepted":status=="initialized_only_metered",
            "full_scf_resource_validated":False,
            "scientific_convergence_accepted":False,
            "qualification":"Self-reported Docker status is not an independent signed attestation."}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True,help="Existing D5.3 pilot output directory to verify")
    args=parser.parse_args(argv)
    try:
        print(json.dumps(verify(args.output),ensure_ascii=False,indent=2))
    except (OSError,ValueError,TypeError,KeyError,UnicodeError) as exc:
        parser.exit(1,"D5.3 verification failed: "+str(exc)+"\n")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
