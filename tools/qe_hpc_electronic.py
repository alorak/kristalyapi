#!/usr/bin/env python3
"""P1.3: strict offline QE bands/DOS/PDOS -> existing electronic-results.json.

Run inside a P1.2 TRUBA directory. No QE run, network, external packages,
Fermi shift, interpolation or invented band gap. Python 3.9+.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

from qe_pdos import parse_atom_orbital_pdos, parse_atom_symbols, exact_energy_window
import pipeline as hpc

MAX_TABLE = 8_000_000
MAX_ROWS = 20_000
MAX_PLOT_POINTS = 120_000
MAX_BAND_FILE_BYTES = 96 * 1024 * 1024
MAX_RAW_BAND_SAMPLES = 4_000_000
MAX_JSON = 16_000_000
SCHEMA = "kristalyapi.qe-electronic.v1"


def numeric_rows(path: Path, cols: int):
    """Bounded DOS/PDOS numeric table reader; band files use parse_bands streaming."""
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_TABLE:
        raise ValueError("Missing/oversized or unsafe QE numeric output: " + path.name)
    rows = []
    with path.open("r", encoding="utf-8", errors="strict") as stream:
        for line in stream:
            if len(line) > 8192:
                raise ValueError("Oversized QE numeric row")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            fields = line.split()
            if len(fields) != cols:
                raise ValueError("Unexpected spin/noncollinear or malformed columns: " + path.name)
            try:
                values = [float(v.replace("D", "E").replace("d", "e")) for v in fields]
            except ValueError as exc:
                raise ValueError("Non-numeric QE output: " + path.name) from exc
            if not all(math.isfinite(v) for v in values):
                raise ValueError("Nonfinite QE output: " + path.name)
            rows.append(values)
            if len(rows) > MAX_ROWS:
                raise ValueError("Too many DOS/PDOS samples: " + path.name)
    if len(rows) < 2:
        raise ValueError("Not enough numeric output samples: " + path.name)
    return rows


def checked_k_nodes(source: str, path: list, distances: list[float]):
    """Only label measured sampled positions when reciprocal metric supports them."""
    cell = re.search(r"(?im)^[ \t]*CELL_PARAMETERS[ \t]+angstrom[ \t]*$", source)
    if not cell:
        return None
    lines = source[cell.end():].lstrip("\r\n").splitlines()[:3]
    if len(lines) != 3:
        return None
    try:
        A = [[float(v.replace("D", "E").replace("d", "e")) for v in line.split()]
             for line in lines]
    except ValueError:
        return None
    if any(len(v) != 3 or not all(math.isfinite(t) for t in v) for v in A):
        return None
    cross = lambda a,b: [a[1]*b[2]-a[2]*b[1],
                         a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    dot = lambda a,b: sum(x*y for x,y in zip(a,b))
    a,b,c = A
    volume = dot(a,cross(b,c))
    if abs(volume) < 1e-8:
        return None
    B = [[v/volume for v in cross(x,y)] for x,y in ((b,c),(c,a),(a,b))]
    mapped = [[sum(point["k"][i]*B[i][j] for i in range(3)) for j in range(3)]
              for point in path]
    lengths = [math.dist(p,q) for p,q in zip(mapped,mapped[1:])]
    total = sum(lengths)
    actual = distances[-1] - distances[0]
    if total < 1e-9 or actual <= 0 or any(x<=1e-9 for x in lengths):
        return None
    count = [0]
    for point in path[:-1]:
        count.append(count[-1]+point["segments"])
    if count[-1] != len(distances)-1:
        return None
    tolerance = max(0.0001, actual * 0.002)
    nodes = []
    for i,point in enumerate(path):
        d = distances[count[i]]
        if i:
            predicted = distances[0] + actual * sum(lengths[:i]) / total
            if abs(d-predicted)>tolerance or d<=nodes[-1]["distance"]:
                return None
            start, stop = count[i-1],count[i]
            for j in range(start,stop+1):
                ideal = distances[start] + (d-distances[start])*(j-start)/(stop-start)
                if abs(distances[j]-ideal)>tolerance:
                    return None
        nodes.append({"label":point["label"],"distance":d})
    return nodes


def parse_bands(path: Path, config: dict):
    """Scan EVERY QE band, but retain only an explicitly selected display window.

    Band indices are 1-based, inclusive. No changes to QE nbnd, eigenvalues,
    raw output, reciprocal distance or energy reference. The file is streamed
    so 1000+ calculated bands do not require 1000+ retained Python arrays.
    """
    options = config["electronic"]
    count = options["nbnd"]
    path_nodes = options["path"]
    expected_k = 1 + sum(node["segments"] for node in path_nodes[:-1])
    window = options.get("band_window")
    if window is None:
        if count > 300:
            raise ValueError("P1.4 requires explicit band window above 300 total bands")
        first, last = 1, count
    else:
        if (not isinstance(window, list) or len(window) != 2 or
                any(type(x) is not int for x in window) or
                not 1 <= window[0] <= window[1] <= count or
                window[1]-window[0]+1 > 300):
            raise ValueError("P1.4 invalid band window")
        first, last = window
    if count * expected_k > MAX_RAW_BAND_SAMPLES:
        raise ValueError("P1.4 QE raw band scan exceeds 4 million points")
    if (last - first + 1) * expected_k > MAX_PLOT_POINTS:
        raise ValueError("P1.4 selected band window exceeds frontend plot budget")
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BAND_FILE_BYTES:
        raise ValueError("Missing, symlinked or oversized bands.dat.gnu")

    distances = []
    curves = []
    band_index = 0
    samples_in_band = 0
    current_curve = []

    def finish_band():
        nonlocal band_index, samples_in_band, current_curve
        if samples_in_band == 0:
            return
        if samples_in_band != expected_k:
            raise ValueError("QE band k-point count differs from declared crystal_b path")
        band_index += 1
        if band_index > count:
            raise ValueError("QE bands.dat.gnu contains more bands than nbnd")
        if first <= band_index <= last:
            curves.append(current_curve)
        current_curve = []
        samples_in_band = 0

    with path.open("r", encoding="utf-8", errors="strict") as stream:
        for line in stream:
            if len(line) > 8192:
                raise ValueError("QE band output line exceeds size limit")
            if not line.strip():
                finish_band()
                continue
            if line.lstrip().startswith("#"):
                continue
            fields = line.split()
            if len(fields) != 2:
                raise ValueError("Unexpected QE bands.x columns")
            try:
                kx, energy = (float(x.replace("D", "E").replace("d", "e"))
                              for x in fields)
            except ValueError as exc:
                raise ValueError("Nonnumeric QE band output") from exc
            if not math.isfinite(kx) or not math.isfinite(energy):
                raise ValueError("Nonfinite QE band output")
            if samples_in_band >= expected_k:
                raise ValueError("Too many QE k-points in a band block")
            if band_index == 0:
                if distances and kx < distances[-1]:
                    raise ValueError("Band distance must not decrease")
                distances.append(kx)
            elif abs(kx - distances[samples_in_band]) > 1e-5:
                raise ValueError("Inconsistent QE bands.x reciprocal-distance axis")
            if first <= band_index + 1 <= last:
                current_curve.append(energy)
            samples_in_band += 1
        finish_band()

    if band_index != count or len(curves) != last-first+1:
        raise ValueError("QE band count differs from explicitly requested nbnd")
    if len(distances) != expected_k or len(distances) < 2:
        raise ValueError("QE band distance grid differs from crystal_b path")

    nodes = checked_k_nodes(config.get("_final_scf_source", ""), path_nodes, distances)
    return {
        "distance": distances, "energies_ev": curves,
        "band_index_start": first, "total_bands": count,
        "selection_policy": ("explicit-one-based-inclusive" if window is not None
                             else "all-calculated-bands"),
        **({"k_path_nodes": nodes} if nodes else {}),
        "reference": "Raw QE Kohn-Sham energies; no Fermi/vacuum alignment"
    }


def parse_dos(path: Path):
    rows = numeric_rows(path, 3)
    if any(b[0] <= a[0] for a, b in zip(rows, rows[1:])):
        raise ValueError("DOS energy axis not strictly increasing")
    if any(row[1] < 0 for row in rows):
        raise ValueError("Negative total DOS")
    if len(rows) > MAX_ROWS:
        raise ValueError("DOS plot too large")
    return {"energy_ev": [row[0] for row in rows],
            "dos_states_per_ev": [row[1] for row in rows],
            "integrated_states": [row[2] for row in rows],
            "reference": "Raw QE electronic energy zero"}


def parse_pdos(path: Path, energies: list[float]):
    rows = numeric_rows(path, 3)
    if any(row[1] < 0 or row[2] < 0 for row in rows):
        raise ValueError("Negative projected density")
    selected = exact_energy_window(rows, energies, "PDOS total")
    return {"energy_ev": energies,
            "total_dos_states_per_ev": [row[1] for row in selected],
            "sum_projected_states_per_ev": [row[2] for row in selected],
            "grid_selection": {"policy": "exact DOS window, no interpolation or shift",
                               "source_points": len(rows), "selected_points": len(selected),
                               "discarded_outside_window": len(rows) - len(selected)}}


def collect(root: Path) -> dict:
    root = root.resolve(strict=True)
    config = hpc.load_manifest(root)
    if config.get("schema") != hpc.SCHEMA:
        raise ValueError("Only generated TRUBA P1.2 manifests accepted")
    pins = config["file_sha256"]
    if "electronic.py" not in pins or "qe_pdos.py" not in pins:
        raise ValueError("Unpinned P1.3 converter/helper; export a new ZIP")
    hpc.require_hash(root, "electronic.py", pins["electronic.py"], hpc.MAX_MANIFEST)
    hpc.require_hash(root, "qe_pdos.py", pins["qe_pdos.py"], hpc.MAX_MANIFEST)
    plan = config["stages"]
    if plan[-1] != "projwfc":
        raise ValueError("Unexpected terminal P1.2 stage")
    # Revalidate the immediately preceding stage including current QE save XML.
    hpc.previous_report(root, plan, "projwfc")
    # Every preceding stage must have a completed, intact receipt. Earlier
    # QE .save XML digests cannot be rechecked after the later PW steps rewrite it.
    for stage in plan[:-1]:
        receipt = json.loads(hpc.file_at(root, "reports/" + stage + ".json", hpc.MAX_MANIFEST).read_text("utf-8"))
        if (receipt.get("schema") != hpc.REPORT_SCHEMA or receipt.get("stage") != stage or
                receipt.get("status") != "completed"):
            raise ValueError("Unverified prior stage: " + stage)
        hashes = receipt.get("hashes")
        if not isinstance(hashes, dict) or not hashes:
            raise ValueError("Missing stage provenance")
        for name, digest in hashes.items():
            if name != "tmp/kristalyapi.save/data-file-schema.xml":
                hpc.require_hash(root, name, digest)
    for name in ("bands.dat.gnu", "dos.dat", "pdos.pdos_tot", "scf.in", "projwfc.out"):
        hpc.file_at(root, name, MAX_BAND_FILE_BYTES if name == "bands.dat.gnu" else MAX_TABLE)
    hpc.scan_output(hpc.file_at(root, "projwfc.out", MAX_TABLE), "projwfc")
    # Pass SCF geometry only in memory; never write inferred symmetry labels.
    config = dict(config)
    config["_final_scf_source"] = hpc.file_at(root, "scf.in", 4_000_000).read_text("utf-8")
    bands = parse_bands(hpc.file_at(root, "bands.dat.gnu", MAX_BAND_FILE_BYTES), config)
    dos = parse_dos(hpc.file_at(root, "dos.dat", MAX_TABLE))
    projected = parse_pdos(hpc.file_at(root, "pdos.pdos_tot", MAX_TABLE), dos["energy_ev"])
    atoms = parse_atom_symbols(hpc.file_at(root, "scf.in", 4_000_000).read_text("utf-8"))
    pdos = parse_atom_orbital_pdos(
        root, dos["energy_ev"], projected["sum_projected_states_per_ev"], atoms)
    if len(pdos["atoms"]) * len(dos["energy_ev"]) > 400_000:
        raise ValueError("Atom PDOS exceeds UI presentation budget")
    paths = ["structure.in", "scf.in", "bands.dat.gnu", "dos.dat", "pdos.pdos_tot"]
    paths += [item["filename"] for item in pdos["source_files"]]
    paths += ["reports/" + stage + ".json" for stage in plan[:-1]]
    provenance = {"pipeline_manifest_sha256": hpc.sha256(hpc.file_at(root, "pipeline.json", hpc.MAX_MANIFEST)),
                  "source_sha256": {path: hpc.sha256(hpc.file_at(root, path, MAX_BAND_FILE_BYTES if path == "bands.dat.gnu" else MAX_TABLE))
                                    for path in paths},
                  "all_upfs_pinned": all(p.get("sha256") for p in config["pseudopotentials"]),
                  "scientific_convergence_verified": False}
    return {
        "schema": SCHEMA,
        "source": "Quantum ESPRESSO, offline TRUBA P1.3 (pw.x / bands.x / dos.x / projwfc.x)",
        "input_sha256": pins["structure.in"],
        "energy_zero": "QE internal; no Fermi/vacuum alignment performed",
        "band_path_labels": [p["label"] for p in config["electronic"]["path"]],
        "bands": bands, "dos": dos, "pdos_total": projected, "pdos_atoms": pdos,
        "truba_provenance": provenance,
        "limitations": [
            "No automatic Fermi or vacuum alignment and no experimental/optical PL claim.",
            "Bands and PDOS are QE Kohn-Sham and orbital projection data.",
            "Stage hashes are not independent physical-convergence evidence."
        ]
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, default=Path("."))
    parser.add_argument("--output", default="electronic-results.json")
    args = parser.parse_args(argv)
    if args.output != "electronic-results.json":
        parser.error("Output must remain electronic-results.json")
    try:
        root = args.bundle.resolve(strict=True)
        result = collect(root)
        encoded = (json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
        if len(encoded) > MAX_JSON:
            raise ValueError("Serialized electronic result exceeds 16 MB")
        path = root / "electronic-results.json"
        if path.exists() or path.is_symlink():
            raise ValueError("Refusing overwrite of existing electronic result")
        # Exclusive create: no silently replaced evidence.
        with path.open("xb") as stream:
            stream.write(encoded)
        print("P1.3 converter: wrote", path, "bands", len(result["bands"]["energies_ev"]),
              "DOS points", len(result["dos"]["energy_ev"]))
        return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print("P1.3 converter refused result:", exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
