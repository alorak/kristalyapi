#!/usr/bin/env python3
"""P10.8.6: pinned upstream CHGCAR/CUBE/XSF vs ASE and actual browser reader.

VESTA is a GUI-only *comparison target*, not the independent numeric oracle
used here. No claim is made that this script ran or measured VESTA itself.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from ase.calculators.vasp import VaspChargeDensity
from ase.io.cube import read_cube
from ase.io.xsf import read_xsf
from skimage.measure import marching_cubes, mesh_surface_area

ROOT = Path(__file__).resolve().parents[2]
COMMIT = "7b8595f6d526382343ad831872802486dc62a388"
UPSTREAM = f"https://raw.githubusercontent.com/materialsproject/pymatgen-core/{COMMIT}/test-files"
OUT = ROOT / "validation-results" / "volume-vesta-formats-10-8-6.json"
SOURCES = {
    "chgcar": {
        "path": "io/vasp/outputs/CHGCAR.nospin.gz",
        "sha256": "1d0f7cab991845fb6b5576839727948d189d339e908c5908ea8ffd935337a715",
        "sourceType": "VASP charge density / Li (actual calculation fixture)",
        "unit": "e/Å³ (raw CHGCAR / cell volume)",
    },
    "cube": {
        "path": "command_line/bader/elec.cube.gz",
        "sha256": "4d3e32d374920e2a1210ebc718ad2f358751ea1861190281fce2ad4d2a0fb8df",
        "sourceType": "Gaussian cube electron-density field (actual upstream fixture)",
        "unit": "source cube numbers, not presumed e/Å³",
    },
    "xsf": {
        "path": "io/xcrysden/datagrid_3d.xsf",
        "sha256": "c0a8ec512661c1ffa4c20fb922f52972ee825c01078976e2ee076729b60972c5",
        "sourceType": "upstream XSF parser fixture (2³ synthetic scalar, not measured density)",
        "unit": "arbitrary source units",
    },
}


def fetch_pinned(name: str, temporary: Path) -> tuple[Path, dict]:
    entry = SOURCES[name]
    url = f"{UPSTREAM}/{entry['path']}"
    with urllib.request.urlopen(url, timeout=60) as response:
        compressed = response.read()
    digest = hashlib.sha256(compressed).hexdigest()
    if digest != entry["sha256"]:
        raise ValueError(f"{name}: upstream SHA-256 mismatch: {digest}")
    payload = gzip.decompress(compressed) if entry["path"].endswith(".gz") else compressed
    if len(payload) > 24_000_000:
        raise ValueError(f"{name}: browser's 24 MB input cap exceeded")
    filename = {"chgcar": "CHGCAR", "cube": "elec.cube", "xsf": "datagrid_3d.xsf"}[name]
    target = temporary / filename
    target.write_bytes(payload)
    return target, {"url": url, "sha256": digest, "sourceBytes": len(payload),
                    "sourceType": entry["sourceType"], "scalarUnitInterpretation": entry["unit"]}


def independent_grid(name: str, source: Path) -> dict:
    """No JS-layout re-decoding here; ASE implements a separate reader."""
    if name == "chgcar":
        reader = VaspChargeDensity(str(source))
        values = np.asarray(reader.chg[-1], dtype=np.float64)
        atoms = reader.atoms[-1]
        vectors = np.asarray(atoms.cell, dtype=float)
        axes = vectors / np.asarray(values.shape)[:, None]
        return {"values": values, "origin": np.zeros(3), "axes": axes,
                "atoms": len(atoms), "periodic": True}
    if name == "cube":
        with source.open("r", encoding="utf8") as file:
            output = read_cube(file)
        return {"values": np.asarray(output["data"], dtype=np.float64),
                "origin": np.asarray(output["origin"], dtype=float),
                "axes": np.asarray(output["spacing"], dtype=float),
                "atoms": len(output["atoms"]), "atomicNumbers": output["atoms"].numbers.tolist(),
                "atomPositionsA": np.asarray(output["atoms"].positions,dtype=float),
                "periodic": False}
    if name == "xsf":
        with source.open("r", encoding="utf8") as file:
            values, origin, spans, atoms = read_xsf(file, read_data=True)
        data = np.asarray(values, dtype=np.float64)
        axes = np.asarray(spans, dtype=float) / (np.asarray(data.shape)[:, None] - 1)
        return {"values": data, "origin": np.asarray(origin, dtype=float),
                "axes": axes, "atoms": len(atoms), "periodic": False}
    raise ValueError(f"Unknown format: {name}")


def compare_array(actual: np.ndarray, expected: np.ndarray, rtol=2e-6, atol=1e-6) -> dict:
    if actual.shape != expected.shape:
        raise AssertionError(f"shape mismatch {actual.shape} vs {expected.shape}")
    if not np.isfinite(actual).all() or not np.isfinite(expected).all():
        raise AssertionError("Non-finite value in source grid")
    absolute = np.abs(actual - expected)
    tolerance = atol + rtol * np.abs(expected)
    failures = int(np.count_nonzero(absolute > tolerance))
    return {"maxAbsoluteError": float(absolute.max()),
            "rmsError": float(np.sqrt(np.mean(absolute**2))),
            "failingVoxels": failures, "voxelCount": actual.size,
            "tolerances": {"rtol": rtol, "atol": atol}}


def independent_surface(data: np.ndarray, axes: np.ndarray, level: float,
                        periodic: bool) -> dict:
    # The periodic CHGCAR includes a one-cell wrap; the raw XSF fixture and
    # CUBE are open maps. World positions use *the actual skew voxel basis*.
    field = np.pad(data, [(0, 1)] * 3, mode="wrap") if periodic else data
    verts, triangles, _, _ = marching_cubes(field.astype(np.float32), level,
                                            method="lewiner", allow_degenerate=False)
    world = verts @ axes
    area = float(mesh_surface_area(world, triangles))
    if not np.isfinite(area) or area <= 0:
        raise AssertionError("Independent surface has invalid Å² area")
    return {"algorithm": "scikit-image Lewiner marching cubes", "areaA2": area,
            "triangles": len(triangles), "periodicWrap": periodic}


def evaluate(name: str, source: Path, output_dir: Path) -> dict:
    proc = subprocess.run(["node", str(ROOT / "tests/validation/volume-vesta-format-bridge.cjs"),
                           str(source), name, str(output_dir)],
                          cwd=ROOT, check=True, capture_output=True, text=True)
    metadata = json.loads((output_dir / f"{name}-bridge.json").read_text())
    actual = np.fromfile(output_dir / metadata["gridFile"], dtype="<f4")
    actual = actual.reshape(metadata["dims"]).astype(np.float64)
    reference = independent_grid(name, source)
    ref_grid = reference["values"]
    values = compare_array(actual, ref_grid)
    # These checks are hard gates, not merely printed diagnostic flags.
    assert not values["failingVoxels"], f"{name}: {values['failingVoxels']} misordered/scaled voxels"
    actual_frame = np.asarray(metadata["axes"], dtype=float)
    reference_frame = np.asarray(reference["axes"], dtype=float)
    frame = compare_array(actual_frame, reference_frame, rtol=2e-6, atol=1e-5)
    origin = compare_array(np.asarray(metadata["origin"]), reference["origin"],
                           rtol=2e-6, atol=1e-5)
    assert not frame["failingVoxels"] and not origin["failingVoxels"], f"{name}: Å frame drift"
    assert metadata["periodic"] == reference["periodic"], f"{name}: periodicity differs"
    # 10.9 resolves the scalar-only CUBE import gap: atom positions must also
    # be exact in the density map's *unshifted native Cartesian Å frame*.
    atom_gap = metadata["siteCount"] != reference["atoms"]
    if atom_gap:
        raise AssertionError(f"{name}: atom count mismatch")
    atom_comparison = None
    if name == "cube":
        assert metadata["displayStructure"]["nonPeriodic"]
        assert not metadata["displayStructure"]["displayCell"]
        atom_comparison = compare_array(
            np.asarray(metadata["displayStructure"]["atomPositionsA"]),
            reference["atomPositionsA"], rtol=2e-6, atol=1e-5)
        assert atom_comparison["failingVoxels"] == 0, "CUBE display offsets changed native Å atoms"
        assert [a["atomicNumber"] for a in metadata["atoms"]] == reference["atomicNumbers"]
    if name == "chgcar":
        assert metadata["quantity"] == "density" and metadata["units"].startswith("e/Å³")
    else:
        assert metadata["quantity"] == "unknown", f"{name}: unproven physical units"

    # Check *all* values, plus three differently oriented physical slices.
    slices = {}
    for axis, letter in enumerate("xyz"):
        at = ref_grid.shape[axis] // 2
        slices[letter] = compare_array(np.take(actual, at, axis=axis),
                                       np.take(ref_grid, at, axis=axis))
        assert slices[letter]["failingVoxels"] == 0
    measured = independent_surface(ref_grid, reference_frame,
                                   metadata["surface"]["isovalue"], reference["periodic"])
    production_area = float(metadata["surface"]["areaA2"])
    area_difference = abs(production_area-measured["areaA2"]) / measured["areaA2"]
    # Different triangle meshes are compared for diagnostics, not treated as
    # identical. Only nonfinite/empty/truncated geometry fails in this package.
    assert metadata["surface"]["triangles"] > 0 and not metadata["surface"]["truncated"]
    assert np.isfinite(production_area) and production_area > 0
    integral = None
    if name == "chgcar":
        cell = reference_frame * np.asarray(ref_grid.shape)[:, None]
        volume = float(abs(np.linalg.det(cell)))
        integral = {"cellVolumeA3": volume,
                    "integralElectronsReference": float(ref_grid.mean()*volume),
                    "integralElectronsBrowser": float(actual.mean()*volume)}
        # This pinned one-Li valence-density fixture integrates to one
        # electron. Cross-reader agreement alone cannot replace this physical
        # sanity check (both readers could otherwise share a scaling error).
        assert abs(integral["integralElectronsReference"]-1.0) < 1e-5
        assert abs(integral["integralElectronsBrowser"]-1.0) < 1e-5
    return {"source": name, "status": "pass-with-known-gap" if atom_gap else "pass",
            "dimensions": metadata["dims"], "browserSiteCount": metadata["siteCount"],
            "referenceAtomCount": reference["atoms"], "atomImportGap": atom_gap,
            "atomCoordinateComparison": atom_comparison,
            "periodic": metadata["periodic"],
            "geometryA": {"origin": metadata["origin"], "voxelAxes": metadata["axes"],
                          "frame": frame, "originError": origin},
            "voxelComparison": values, "orthogonalMidSlices": slices,
            "chargeIntegral": integral, "isolevel": metadata["surface"]["isovalue"],
            "surface": {"production": metadata["surface"], "independent": measured,
                        "relativeAreaDifference": area_difference,
                        "areaDisagreementAlert": area_difference > .2},
            "parserStdout": proc.stdout.strip()}


def main() -> int:
    report = {"protocol": "p10.8.6-upstream-format-independent-Ase-reference",
              "reference": "ASE 3.26.0 format readers; scikit-image 0.25.2 Lewiner meshes",
              "sourceCommit": COMMIT, "vestaExecuted": False,
              "scope": "Independent numeric reader/physical frames, NOT an automated VESTA GUI match",
              "cases": [], "alerts": [], "failures": []}
    with tempfile.TemporaryDirectory(prefix="kristal-vesta-1086-") as directory:
        temporary = Path(directory)
        for name in SOURCES:
            try:
                source, provenance = fetch_pinned(name, temporary)
                case = evaluate(name, source, temporary)
                case["provenance"] = provenance
                report["cases"].append(case)
                if case["surface"]["areaDisagreementAlert"]:
                    report["alerts"].append(f"{name}: mesher-dependent surface area >20% apart")
                if case["atomImportGap"]:
                    report["alerts"].append(f"{name}: source has atoms but browser only loads scalar field")
                print(f"PASS {name}: {case['dimensions']}, max error "
                      f"{case['voxelComparison']['maxAbsoluteError']:.3g}, "
                      f"area diff {case['surface']['relativeAreaDifference']:.1%}")
            except Exception as error:
                report["cases"].append({"source": name, "status": "fail", "reason": str(error)})
                report["failures"].append(f"{name}: {error}")
                print(f"FAIL {name}: {error}", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}. VESTA GUI was not executed.")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
