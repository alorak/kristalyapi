#!/usr/bin/env python3
"""Independent real-MTZ comparison: Gemmi/CCP4-compatible MTZ parser + FFT.

5wkd: deposited model-phased reflection test fixture from project-gemmi/gemmi.
Unlike synthetic fixtures, the FWT/PHWT and DELFWT/PHDELWT coefficients were
not computed by Kristal Yapı. This reference uses Gemmi's C++ FFT.
"""
import json
import math
from pathlib import Path
import subprocess
import sys

import gemmi

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"
mtz = gemmi.read_mtz_file(str(FIXTURE))
if mtz.spacegroup.number != 5 or mtz.nreflections != 367:
    raise AssertionError("Unexpected real C2 fixture provenance")
native = json.loads(subprocess.check_output(
    ["node", str(ROOT / "tests/validation/mtz-gemmi-export.cjs")],
    cwd=ROOT, text=True
))
if native["spaceGroup"] != mtz.spacegroup.number or native["nref"] != mtz.nreflections:
    raise AssertionError("Native header does not match Gemmi MTZ metadata")
labels = list(mtz.column_labels())
expected_names = ["H", "K", "L", "FP", "FC", "PHIC", "SIGFP", "FOM", "FREE"]
for col in expected_names:
    if labels.count(col) != 1:
        raise AssertionError(f"Ambiguous/missing Gemmi reference column {col}")
if len(native["reflections"]) != len(mtz.array):
    raise AssertionError("Native reader silently skipped valid measured data")
for i, (got, ref) in enumerate(zip(native["reflections"], mtz.array)):
    for k, label in enumerate(expected_names):
        expected = float(ref[labels.index(label)])
        if not math.isclose(got[k], expected, rel_tol=2e-6, abs_tol=2e-5):
            raise AssertionError(f"Reflection {i} {label}: native={got[k]}, Gemmi={expected}")
print(f"Gemmi MTZ independent column/reference check: {len(mtz.array)} real C2 reflections")

# Verify quality gates against Gemmi's column values, retaining explicit FREE=1.
excluded_free = 0
excluded_signal = 0
for row in mtz.array:
    free = float(row[labels.index("FREE")])
    fp = float(row[labels.index("FP")])
    sigma = float(row[labels.index("SIGFP")])
    if free == 1:
        excluded_free += 1
    elif not math.isfinite(sigma) or sigma <= 0 or fp / sigma < 2:
        excluded_signal += 1
q = native["quality"]
if q["skippedFree"] != excluded_free or q["skippedSignal"] != excluded_signal or q["skippedMissingQuality"]:
    raise AssertionError(f"Native Fo/sigma and FREE gates disagree with Gemmi rows: {q} vs {(excluded_free, excluded_signal)}")
print(f"Gemmi FREE=1/Fo-sigma quality check: {excluded_free} FREE, {excluded_signal} below SNR")

# Gemmi expands C2 symmetry and samples a 64^3 electron-density grid directly
# from the ORIGINAL refinement coefficients, not our own Fourier implementation.
for kind, amp, phase in (
    ("weighted-main", "FWT", "PHWT"),
    ("weighted-difference", "DELFWT", "PHDELWT"),
):
    reference = mtz.transform_f_phi_to_map(amp, phase, exact_size=[64, 64, 64])
    native_map = native["maps"][kind]
    deltas = []
    for ijk, actual in zip(native["sampleLocations"], native_map["samples"]):
        wanted = float(reference.get_value(*ijk))
        delta = abs(actual - wanted)
        deltas.append(delta)
        if delta > 0.003 + abs(wanted) * 0.003:
            raise AssertionError(
                f"{kind} at {ijk}: native={actual:.8g}, Gemmi={wanted:.8g}, "
                f"absolute error={delta:.8g}"
            )
    print(f"Gemmi independent FFT map {amp}/{phase}: "
          f"{len(deltas)} samples, max absolute error={max(deltas):.7g}")
print("Independent Gemmi real-MTZ validation passed.")
