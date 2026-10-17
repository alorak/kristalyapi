#!/usr/bin/env python3
"""P9.1: genuinely independent Gemmi/CCP4 verification of native browser reader.

Uses project-gemmi/gemmi tests/5i55_tiny.ccp4 (monoclinic P 1 21 1,
permuted Y/X/Z axes, negative and >unit-cell starts, 160-byte symmetry).
Also writes a *real crystallographic FFT map* from an unrelated 5wkd MTZ
with Gemmi C++ and checks its native voxel and Cartesian coordinate mapping.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import subprocess
import tempfile

import gemmi

ROOT = Path(__file__).resolve().parents[2]


def check(path: Path, label: str) -> None:
    native = json.loads(subprocess.check_output(
        ["node", str(ROOT / "tests/validation/ccp4-map-export.cjs"), str(path)],
        cwd=ROOT, text=True
    ))
    reference = gemmi.read_ccp4_map(str(path), setup=False)
    header_i = reference.header_i32
    header_f = reference.header_float
    file_shape = [reference.grid.nu, reference.grid.nv, reference.grid.nw]
    mapping = [header_i(i) for i in (17, 18, 19)]
    starts = [header_i(i) for i in (5, 6, 7)]
    intervals = [header_i(i) for i in (8, 9, 10)]
    dims = [file_shape[mapping.index(i)] for i in (1, 2, 3)]
    cell = reference.grid.unit_cell
    if native["dims"] != dims:
        raise AssertionError(f"{label}: axis dimensions: {native['dims']} != {dims}")
    if native["meta"]["counts"] != file_shape or native["meta"]["mapping"] != mapping:
        raise AssertionError(f"{label}: header axes disagree with Gemmi")
    if native["meta"]["starts"] != starts or native["meta"]["sampling"] != intervals:
        raise AssertionError(f"{label}: signed starts/sampling disagree with Gemmi")
    if native["meta"]["ispg"] != header_i(23):
        raise AssertionError(f"{label}: space-group metadata mismatch")
    assert native["periodic"] == (dims == intervals)

    mapped_start = [starts[mapping.index(i)] / intervals[i-1] for i in (1, 2, 3)]
    world = cell.orthogonalize(gemmi.Fractional(*mapped_start))
    for got, expected in zip(native["origin"], (world.x, world.y, world.z)):
        if abs(got - expected) > 5e-5:
            raise AssertionError(f"{label}: Cartesian shifted origin {got} != {expected}")
    for xyz_axis in range(3):
        unit = [0., 0., 0.]
        unit[xyz_axis] = 1. / intervals[xyz_axis]
        step = cell.orthogonalize(gemmi.Fractional(*unit))
        for got, expected in zip(native["axes"][xyz_axis], (step.x, step.y, step.z)):
            if abs(got - expected) > 5e-6:
                raise AssertionError(f"{label}: lattice voxel {got} != {expected}")

    differences = []
    for probe in native["probes"]:
        xyz = probe["xyz"]
        file_ijk = [xyz[mapping[i]-1] for i in range(3)]
        expected = float(reference.grid.get_value(*file_ijk))
        actual = float(probe["value"])
        diff = abs(actual - expected)
        if not math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-6):
            raise AssertionError(f"{label}: {xyz} -> {file_ijk}, native={actual}, Gemmi={expected}")
        differences.append(diff)

    # Independently let Gemmi perform MAPC/MAPR/MAPS reordering, without
    # symmetry filling or changing the source map's partial extent.
    reference.setup(float('nan'), gemmi.MapSetup.ReorderOnly)
    if [reference.grid.nu, reference.grid.nv, reference.grid.nw] != dims:
        raise AssertionError(f"{label}: Gemmi ReorderOnly dimensions mismatch")
    for probe in native["probes"]:
        xyz = probe["xyz"]
        expected = float(reference.grid.get_value(*xyz))
        if not math.isclose(float(probe["value"]), expected, rel_tol=1e-6, abs_tol=1e-6):
            raise AssertionError(f"{label}: Gemmi reordered voxel mismatch at {xyz}")

    print(f"{label}: {len(native['probes'])} voxels, "
          f"max |Δ|={max(differences):.3g}, map {dims}, "
          f"periodic={native['periodic']}, group={native['meta']['ispg']}")


check(ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4", "Gemmi real partial monoclinic map")
mtz = gemmi.read_mtz_file(str(ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"))
if mtz.nreflections != 367 or mtz.spacegroup.number != 5:
    raise AssertionError("Unexpected real 5wkd reflection provenance")
grid = mtz.transform_f_phi_to_map("FWT", "PHWT", exact_size=[32, 32, 32])
ccp4 = gemmi.Ccp4Map()
ccp4.grid = grid
ccp4.update_ccp4_header()
with tempfile.TemporaryDirectory(prefix="p91-gemmi-") as folder:
    filename = Path(folder) / "gemmi-5wkd-fft.ccp4"
    ccp4.write_ccp4_map(str(filename))
    check(filename, "Gemmi 5wkd experimental MTZ → independent FFT map")
print("P9.1 CCP4/MRC independent Gemmi verification passed.")
