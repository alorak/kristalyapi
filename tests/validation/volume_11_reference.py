#!/usr/bin/env python3
"""P11: independently verify multi-channel CUBE and molecular/multi-grid XSF.

The numerical starting point is one SHA-256-pinned upstream *real* CUBE.
All added channels are deterministic transformations of that source, not new
experimental/simulation measurements. The independent reader is ASE 3.26.0.
The production reader + Worker are exercised by the Node browser-parser bridge.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from ase.io.cube import read_cube
from ase.io.xsf import read_xsf, write_xsf

from volume_vesta_formats_reference import ROOT, compare_array, fetch_pinned

OUT = ROOT / "validation-results/volume-11-multifield-scientific.json"
BRIDGE = ROOT / "tests/validation/volume-vesta-format-bridge.cjs"


def run_bridge(source: Path, kind: str, output: Path) -> tuple[dict, list[np.ndarray]]:
    output.mkdir()
    result = subprocess.run(["node", str(BRIDGE), str(source), kind, str(output)],
                            cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise AssertionError(f"Production {kind} reader/Worker failed: {result.stderr}")
    meta = json.loads((output / f"{kind}-bridge.json").read_text())
    fields = [np.fromfile(output / item["file"], dtype="<f4").reshape(meta["dims"])
              for item in meta["fields"]]
    return meta, fields


def verified(actual: np.ndarray, expected: np.ndarray, *, atol=1e-5) -> dict:
    check = compare_array(np.asarray(actual, float), np.asarray(expected, float),
                          atol=atol, rtol=2e-6)
    assert check["failingVoxels"] == 0, f"{check['failingVoxels']} samples drifted"
    return check


def format_data(values: np.ndarray) -> list[str]:
    nums = (f"{value:.10e}" for value in values)
    row, lines = [], []
    for entry in nums:
        row.append(entry)
        if len(row) == 6:
            lines.append(" ".join(row))
            row = []
    if row:
        lines.append(" ".join(row))
    return lines


def compare_coordinates(meta: dict, atoms) -> dict:
    assert meta["siteCount"] == len(atoms) == 9
    assert meta["displayStructure"]["nonPeriodic"] is True
    assert meta["displayStructure"]["displayCell"] is False
    assert [atom["atomicNumber"] for atom in meta["atoms"]] == atoms.numbers.tolist()
    return verified(meta["displayStructure"]["atomPositionsA"], atoms.positions)


def main() -> int:
    report = {"protocol": "p11-derived-real-cube-multifield-orbitals-molecular-xsf",
              "reference": "ASE 3.26.0 CUBE/XSF readers and ASE XSF writer",
              "vestaExecuted": False,
              "limitations": ["Second scalar fields are mathematically derived, not independent calculations",
                              "VESTA GUI was not executed; this is a cross-reader numeric gate"],
              "cases": [], "failures": []}
    try:
        with tempfile.TemporaryDirectory(prefix="kristal-11-") as directory:
            work = Path(directory)
            original, provenance = fetch_pinned("cube", work)
            with original.open(encoding="utf-8") as stream:
                source = read_cube(stream)
            atoms = source["atoms"]
            data = np.asarray(source["data"], dtype=float)
            shape = data.shape
            assert len(atoms) == 9 and data.size >= 10000
            frame = np.asarray(source["spacing"], float)
            origin = np.asarray(source["origin"], float)
            source_lines = original.read_text().splitlines()
            atom_count = int(source_lines[2].split()[0])
            assert atom_count == 9

            # NVAL=2: each CUBE voxel interleaves field_0, field_1; the
            # secondary field is -0.5 times the original physical source.
            multi = work / "two-fields.cube"
            first = source_lines[:6 + atom_count]
            first[2] += " 2"
            interleaved = np.stack((data, -.5 * data), axis=-1).reshape(-1)
            multi.write_text("\n".join(first + format_data(interleaved)) + "\n")
            with multi.open() as stream:
                ase_multi = read_cube(stream)
            ase_fields = np.asarray(ase_multi["datas"], dtype=float)
            assert ase_fields.shape == (2, *shape), ase_fields.shape
            meta, actual = run_bridge(multi, "cube", work / "two_cube")
            assert len(actual) == 2 and len(meta["fields"]) == 2
            cube_check = [verified(actual[i], ase_fields[i]) for i in range(2)]
            verified(meta["axes"], frame)
            verified(meta["origin"], origin)
            atom_check = compare_coordinates(meta, atoms)
            report["cases"].append({"case": "NVAL2-interleaved-real-CUBE",
                                     "status": "pass", "dims": list(shape),
                                     "channelLabels": [f["label"] for f in meta["fields"]],
                                     "source": provenance, "voxelComparisons": cube_check,
                                     "atomCoordinates": atom_check})
            print("PASS real-source NVAL=2 CUBE: all fields + nine atoms")

            # Negative NATOMS carries an orbital DSET_IDS section; a single
            # orbital retains the upstream source field, with a derived label.
            orbital = work / "orbital-17.cube"
            first = source_lines[:6 + atom_count]
            first[2] = "-" + first[2].lstrip()
            orbital.write_text("\n".join(first + ["1 17"] +
                                          format_data(data.reshape(-1))) + "\n")
            meta, actual = run_bridge(orbital, "cube", work / "orbital_cube")
            assert meta["datasetIds"] == [17]
            assert [x["label"] for x in meta["fields"]] == ["Orbital 17"]
            orbital_check = verified(actual[0], data)
            verified(meta["axes"], frame)
            compare_coordinates(meta, atoms)
            report["cases"].append({"case": "DSET_IDS-orbital-17", "status": "pass",
                                     "datasetIds": meta["datasetIds"],
                                     "voxelComparison": orbital_check})
            print("PASS negative NATOMS orbital DSET_IDS: label + real source values")

            # Ask ASE itself to serialize the exact real CUBE into molecular
            # XSF (ATOMS, not PRIMCOORD), retaining its original Cartesian Å.
            molecules = atoms.copy()
            molecules.pbc[:] = False
            single_xsf = work / "molecular-from-real-cube.xsf"
            spans = frame * (np.asarray(shape)[:, None] - 1)
            with single_xsf.open("w") as stream:
                write_xsf(stream, [molecules], data=data, origin=origin,
                          span_vectors=spans)
            xsf_body = single_xsf.read_text()
            assert "ATOMS" in xsf_body and "PRIMCOORD" not in xsf_body
            with single_xsf.open() as stream:
                reference, ref_origin, ref_spans, reference_atoms = read_xsf(stream, read_data=True)
            assert len(reference_atoms) == 9
            multi_xsf = work / "molecular-two-fields.xsf"
            lines = ["BEGIN_DATAGRID_3D_derived_quarter", " ".join(map(str, shape)),
                     " ".join(map(str, origin)),
                     *(" ".join(map(str, v)) for v in spans)]
            # XSF scalar storage: x-fastest; .ravel(order='F') does that.
            lines += format_data((.25 * data).ravel(order="F"))
            lines.append("END_DATAGRID_3D")
            assert xsf_body.count("END_BLOCK_DATAGRID_3D") == 1
            multi_xsf.write_text(xsf_body.replace("END_BLOCK_DATAGRID_3D",
                                                 "\n".join(lines) + "\nEND_BLOCK_DATAGRID_3D"))
            meta, actual = run_bridge(multi_xsf, "xsf", work / "two_xsf")
            assert len(actual) == 2
            assert meta["fields"][1]["label"] == "derived_quarter"
            assert meta["periodic"] is False
            xsf_checks = [verified(actual[0], reference), verified(actual[1], .25 * data)]
            verified(meta["origin"], ref_origin)
            verified(meta["axes"], np.asarray(ref_spans) / (np.asarray(shape)[:, None] - 1))
            xsf_atoms = compare_coordinates(meta, reference_atoms)
            report["cases"].append({"case": "ASE-ATOMS-two-XCrysDen-DATAGRIDs",
                                     "status": "pass", "dims": list(shape),
                                     "channelLabels": [f["label"] for f in meta["fields"]],
                                     "voxelComparisons": xsf_checks,
                                     "atomCoordinates": xsf_atoms})
            print("PASS ASE ATOMS XSF + second DATAGRID: voxels, Å axes, nine atoms")
    except Exception as error:
        report["failures"].append(str(error))
        print(f"P11 validation failed: {error}", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
