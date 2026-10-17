#!/usr/bin/env python3
"""P10.8.3 full-res/production parity and topology scientific gate.

Use the genuine 5i55 CCP4 and an independent pinned Gemmi FFT of real C2
5wkd MTZ refinement/difference coefficients. Preview octree is untouched.
"""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
import tempfile
import gemmi

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tests/validation/volume-highres-gate.cjs"
OUTPUT = ROOT / "validation-results" / "volume-highres-10-8-3.json"


def run_node(*args: str) -> dict:
    completed = subprocess.run(
        ["node", str(SCRIPT), *args], cwd=ROOT,
        capture_output=True, text=True, timeout=240)
    if completed.returncode:
        raise RuntimeError(
            f"P10.8.3 native scientific gate returned {completed.returncode}:\n"
            f"{completed.stderr}\n{completed.stdout}")
    return json.loads(completed.stdout)


def verified_real(path: Path, description: str) -> dict:
    result = run_node(str(path))
    if result["type"] != "real-highres" or len(result["series"]) != 3:
        raise AssertionError(f"{description}: incomplete real-map result")
    for n, row in zip((32, 48, 64), result["series"]):
        if row["size"] != n:
            raise AssertionError(f"{description}: unexpected resolution")
        if row["full"]["stride"] != 1:
            raise AssertionError(f"{description}: full reference has been decimated")
        for mode in ("production", "full"):
            mesh = row[mode]
            if mesh["triangles"] > 75000:
                raise AssertionError(f"{description}: triangle budget bypassed")
            if mesh["interiorOpenEdges"] or mesh["nonmanifoldEdges"]:
                raise AssertionError(f"{description}: cracked/non-manifold mesh")
    pair = result["differences"][-1]
    print(f"{description}: level={result['isovalue']:.6g}, "
          f"Δarea(48→64)={pair['relativeAreaChange']:.2%}, "
          f"Δvoxel-volume={pair['relativeOccupiedVolumeChange']:.2%}, "
          f"production64 stride={result['series'][-1]['production']['stride']} "
          f"vs full64 stride=1")
    if result["resolutionSensitivityAlert"]:
        print("  SCIENTIFIC WARNING: substantial real-map resolution sensitivity; "
              "do not label this map converged.")
    return {"name": description, **result}


def main() -> None:
    seam = run_node()
    if seam["type"] != "periodic-synthetic" or seam["openEdges"]:
        raise AssertionError("Periodic skew signed-sphere topology did not close")
    print(f"Periodic skew seam: {seam['triangles']} triangles, "
          "all unpaired periodic edges matched.")

    reports = [verified_real(
        ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4",
        "5i55 partial real monoclinic CCP4")]
    mtz = gemmi.read_mtz_file(
        str(ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"))
    if mtz.spacegroup.number != 5 or mtz.nreflections != 367:
        raise AssertionError("Independent 5wkd MTZ provenance changed")
    with tempfile.TemporaryDirectory(prefix="p1083-independent-") as folder:
        for amp, phase, label in (
            ("FWT", "PHWT", "5wkd weighted C2 density"),
            ("DELFWT", "PHDELWT", "5wkd signed difference density"),
        ):
            grid = mtz.transform_f_phi_to_map(
                amp, phase, exact_size=[64, 64, 64])
            export = gemmi.Ccp4Map()
            export.grid = grid
            export.update_ccp4_header()
            p = Path(folder) / f"real-{amp}.ccp4"
            export.write_ccp4_map(str(p))
            reports.append(verified_real(p, label))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "package": "10.8.3",
        "production_grid_interval_limit": 40,
        "full_grid_research_interval_limit": 64,
        "max_triangles_per_surface": 75000,
        "periodic_seam": seam,
        "real_sources": reports,
        "limitations": [
            "Only source CCP4/MRC maps and Gemmi-derived independent MTZ "
            "Fourier densities; no independent CHGCAR/CUBE/XSF sources.",
            "Full 64-cell interval mode is validation-only, not the "
            "current renderer default.",
            "Partial maps can have open boundary edges; only interior holes "
            "and non-manifold edges fail.",
            "Orientation conflicts are reported and not silently repaired.",
            "Reported threshold occupancy is voxel quadrature, not "
            "topologically proven enclosed mesh volume.",
            "Signed real density levels isolate sparse peaks under the "
            "existing 75k triangle safety budget.",
            "Resolution changes are not a rigorous Hausdorff bound or a "
            "guarantee that real maps have converged.",
        ],
    }, indent=2), encoding="utf-8")
    print(f"P10.8.3 numerical report: {OUTPUT}")
    print("P10.8.3 independent high-resolution and topology gate passed.")


if __name__ == "__main__":
    main()
