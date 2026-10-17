#!/usr/bin/env python3
"""Package 10.8: independently generated real crystallographic grids + native surface gate.

The experimental reflection data are taken from a pinned Gemmi fixture, not
from a synthetic crystal or a map produced by our JavaScript Fourier engine.
The 5i55 partial CCP4 fixture is another, independent real crystallographic map.
Real-map outputs are convergence MEASUREMENTS, not certified geometry truth.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile

import gemmi

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tests/validation/volume-surface-gate.cjs"
OUT = ROOT / "validation-results" / "volume-surface-10-8.json"


def node_report(*args: str) -> dict:
    completed = subprocess.run(
        ["node", str(SCRIPT), *args], cwd=ROOT,
        text=True, capture_output=True, check=False, timeout=150
    )
    if completed.returncode:
        raise AssertionError(
            f"Native volume gate failed ({completed.returncode}):\n"
            f"{completed.stderr}\n{completed.stdout}"
        )
    return json.loads(completed.stdout)


def check_real(path: Path, label: str) -> dict:
    report = node_report(str(path))
    if report["kind"] != "experimental":
        raise AssertionError(f"{label}: not an experimental-file report")
    if len(report["series"]) != 3:
        raise AssertionError(f"{label}: missing convergence levels")
    # An independently validated CCP4 reader and a full mesh calculation
    # must both finish; truncated/empty/degenerate meshes fail inside Node.
    for resolution, row in zip((16, 24, 32), report["series"]):
        if row["size"] != resolution or row["triangles"] <= 0:
            raise AssertionError(f"{label}: invalid resolution {resolution}")
    print(f"{label}: level {report['level']:.7g}, "
          f"surface-area change 16→32 = {report['areaRelativeChange16to32']:.3%}, "
          f"threshold-volume change = {report['occupancyRelativeChange16to32']:.3%}")
    return {"name": label, **report}


def main() -> None:
    # Analytic sphere measures actual physical displacement/area/volume against
    # known equations. A failure must fail CI instead of producing a green report.
    analytic = node_report()
    if analytic["kind"] != "analytic":
        raise AssertionError("Analytic sphere reference gate was not executed")
    print("Independent signed-distance sphere geometry gate passed "
          "(radius, area, enclosed volume, mesh vertex error).")

    reports = [check_real(
        ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4",
        "5i55 deposited monoclinic partial CCP4 map")]

    mtz = gemmi.read_mtz_file(str(ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"))
    if mtz.spacegroup.number != 5 or mtz.nreflections != 367:
        raise AssertionError("Pinned real MTZ provenance unexpectedly changed")

    # The independent C++ FFT is regenerated on every run using the source
    # refinement coefficients. Do not invent a 'measured' density map from
    # JavaScript model phases.
    with tempfile.TemporaryDirectory(prefix="p108-gemmi-") as folder:
        for amplitude, phase, label in (
            ("FWT", "PHWT", "5wkd Gemmi refinement-weighted map"),
            ("DELFWT", "PHDELWT", "5wkd Gemmi difference map"),
        ):
            grid = mtz.transform_f_phi_to_map(
                amplitude, phase, exact_size=[64, 64, 64])
            ccp4 = gemmi.Ccp4Map()
            ccp4.grid = grid
            ccp4.update_ccp4_header()
            file_path = Path(folder) / f"real-{amplitude}.ccp4"
            ccp4.write_ccp4_map(str(file_path))
            reports.append(check_real(file_path, label))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(
        {"package": "10.8.1+10.8.2",
         "method": "production marching tetrahedra and trilinear derived grids",
         "analytical_reference": analytic,
         "real_crystallographic_sources": reports,
         "limitations": [
             "Only the analytic sphere has a known exact geometric surface.",
             "Real-map scalar residuals compare resampled mesh vertices to "
             "the source voxel field; not a certified Hausdorff bound.",
             "Real thresholded volumes are numerical voxel quadrature, not "
             "enclosed volumes of arbitrarily oriented triangle soups.",
             "CUBE/XSF values are round trips of real CCP4 data, not "
             "independent experimental CUBE/XSF fixtures.",
             "Independent real CHGCAR and broad MRC vendor files remain open.",
             "The final scientific surface algorithm is unchanged.",
         ]}, indent=2), encoding="utf-8")
    print(f"Wrote reproducible scientific measurements: {OUT}")
    print("Package 10.8 convergence gate passed.")


if __name__ == "__main__":
    main()
