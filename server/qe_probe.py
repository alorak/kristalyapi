"""D0: inspect installed QE binaries and launch pw.x with *empty* input.

A nonzero pw.x exit status is expected: no UPF or actual DFT job is supplied.
Only a trustworthy Program PWSCF banner indicates binary startup.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess

_REQUIRED = ("pw.x", "bands.x", "dos.x", "projwfc.x")
_BANNER = re.compile(r"\bProgram\s+PWSCF\s+v?\.?([0-9][A-Za-z0-9_.-]*)", re.I)


def inspect_qe(*, which=shutil.which, run=subprocess.run, timeout=8):
    """Never execute a scientific computation; validate executable startup only."""
    binaries = {name: bool(which(name)) for name in _REQUIRED}
    version = None
    banner_ok = False
    timed_out = False
    if binaries["pw.x"]:
        try:
            result = run(
                [which("pw.x"), "-in", "/dev/null"],
                input=b"", stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                timeout=max(1, min(int(timeout), 20)), check=False,
                env={**os.environ, "OMP_NUM_THREADS": "1"}
            )
            # Do not return full stderr; version metadata is sufficient.
            output = result.stdout.decode("utf-8", errors="replace")[:100000]
            match = _BANNER.search(output)
            if match:
                banner_ok = True
                version = match.group(1)
        except (subprocess.TimeoutExpired, OSError, ValueError):
            timed_out = True
    ready = all(binaries.values()) and banner_ok
    return {
        "ready": ready, "qe_version": version,
        "binary_smoke": "pwscf_banner" if banner_ok else ("timeout_or_error" if timed_out else "unverified"),
        "binaries": binaries,
        "scientific_calculation_performed": False
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--require", action="store_true", help="exit nonzero without a working QE banner")
    args = parser.parse_args()
    details = inspect_qe(timeout=int(os.getenv("QE_PROBE_TIMEOUT", "8")))
    print(json.dumps(details, sort_keys=True))
    return 0 if details["ready"] or not args.require else 1


if __name__ == "__main__":
    raise SystemExit(main())
