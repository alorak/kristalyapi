#!/usr/bin/env python3
"""P10.9 physical CUBE -> independent ASE XSF cross-format and 40/64 audit.

The XSF is *derived from a pinned real CUBE* by an independent ASE writer;
it is not represented as independently measured/generated electronic data.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from ase.io.cube import read_cube
from ase.io.xsf import write_xsf

from volume_vesta_formats_reference import ROOT, compare_array, fetch_pinned, independent_grid

OUT = ROOT / "validation-results" / "volume-109-real-format-and-cost.json"
BRIDGE = ROOT / "tests/validation/volume-vesta-format-bridge.cjs"
BENCHMARK = ROOT / "tests/validation/volume-109-benchmark.cjs"


def run_bridge(source: Path, kind: str, work: Path) -> tuple[dict, np.ndarray]:
    result = subprocess.run(["node", str(BRIDGE), str(source), kind, str(work)],
                            cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise AssertionError(f"Browser {kind} bridge failed:\n{result.stderr}")
    metadata = json.loads((work / f"{kind}-bridge.json").read_text())
    data = np.fromfile(work / metadata["gridFile"], dtype="<f4").reshape(metadata["dims"])
    return metadata, data.astype(float)


def main() -> int:
    report = {"protocol": "p10.9-derived-real-cube-to-xsf-and-worker40-64",
              "vestaExecuted": False, "experimentalModeEnabled": False,
              "cases": [], "failures": []}
    try:
        with tempfile.TemporaryDirectory(prefix="kristal-109-") as directory:
            work = Path(directory)
            original_chgcar, _ = fetch_pinned("chgcar", work)
            original_cube, provenance = fetch_pinned("cube", work)
            run_bridge(original_chgcar, "chgcar", work)
            cube_meta, cube_data = run_bridge(original_cube, "cube", work)
            with original_cube.open("r", encoding="utf8") as handle:
                decoded = read_cube(handle)
            # CUBE's physically defined Cartesian Å grid, including its skew
            # basis and offset, is preserved; only the file encoding changes.
            original_spacing = np.asarray(decoded["spacing"], dtype=float)
            span = original_spacing * (np.asarray(cube_data.shape)[:, None] - 1)
            generated_xsf = work / "cube-generated-real-field.xsf"
            with generated_xsf.open("w", encoding="utf8") as handle:
                write_xsf(handle, [decoded["atoms"]], data=decoded["data"],
                          origin=decoded["origin"], span_vectors=span)
            xsf_meta, xsf_data = run_bridge(generated_xsf, "xsf", work)
            xsf_reference = independent_grid("xsf", generated_xsf)
            value_parity = compare_array(xsf_data, cube_data, rtol=3e-6, atol=2e-6)
            ase_xsf_parity = compare_array(xsf_data, xsf_reference["values"])
            axes_parity = compare_array(np.asarray(xsf_meta["axes"]),
                                        np.asarray(cube_meta["axes"]), atol=1e-5)
            origin_parity = compare_array(np.asarray(xsf_meta["origin"]),
                                          np.asarray(cube_meta["origin"]), atol=1e-5)
            for check in [value_parity, ase_xsf_parity, axes_parity, origin_parity]:
                assert check["failingVoxels"] == 0, "Independent XSF roundtrip changed scalar/frame"
            assert cube_meta["siteCount"] == 9, "Real CUBE must preserve all nine atoms"
            assert xsf_data.size >= 10_000, "XSF physical fixture too small"
            report["cases"].append({"source": "real-cube-independent-ase-xsf",
                                     "sourceUrl": provenance["url"],
                                     "sourceSha256": provenance["sha256"],
                                     "derivedXsf": True, "dims": xsf_meta["dims"],
                                     "units": "original CUBE source scalar (unscaled)",
                                     "cubeAtomCount": cube_meta["siteCount"],
                                     "sourceVoxels": xsf_data.size,
                                     "scalarComparison": value_parity,
                                     "xsfReaderComparison": ase_xsf_parity,
                                     "voxelAxesA": axes_parity, "originA": origin_parity,
                                     "surfaceCUBE": cube_meta["surface"],
                                     "surfaceXSF": xsf_meta["surface"],
                                     "status": "pass"})
            print("PASS ASE-written XSF from original computed CUBE:", xsf_meta["dims"])
            subprocess.run(["node", str(BENCHMARK), str(work), str(work / "bench.json")],
                           cwd=ROOT, check=True, capture_output=True, text=True)
            benchmark = json.loads((work / "bench.json").read_text())
            report["benchmark"] = benchmark
            print("40/64 research area changes:",
                  [(case["label"], round(case["full48To64AreaChange"], 4))
                   for case in benchmark["cases"]])
    except Exception as error:
        report["failures"].append(str(error))
        print(f"P10.9 validation failed: {error}", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
