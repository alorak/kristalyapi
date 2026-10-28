#!/usr/bin/env python3
"""Compare independently calculated MoS2 defect PDOS without inventing energy alignment.

Usage: python3 tools/qe_defect_compare.py --config series.json --output result.json
The config points to completed QE pipeline directories and explicitly identifies
the physical defect center in fractional coordinates in each structure.
Energy alignment is disabled unless EVERY case has an externally established
vacuum potential reference and a nonempty evidence identifier.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import sys

SCHEMA = "kristalyapi.mos2-defect-comparison.v1"
CONFIG_SCHEMA = "kristalyapi.mos2-defect-series-config.v1"
KINDS = ("pristine", "V_S", "V_2S", "O_S", "O2_at_VS")
MAX_FILE_SIZE = 24_000_000


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def read_json(path: Path):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_FILE_SIZE:
        raise ValueError("Missing, symlinked, or too large JSON: " + path.name)
    return json.loads(path.read_text(encoding="utf-8"))


def safe_run_dir(root: Path, item):
    if not isinstance(item, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_./-]{0,160}", item):
        raise ValueError("Unsafe relative run_dir path")
    if any(part in (".", "..") for part in Path(item).parts) or Path(item).is_absolute():
        raise ValueError("run_dir must be a relative subdirectory")
    path = (root / item).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_dir():
        raise ValueError("run_dir is missing or outside config directory: " + item)
    return path


def read_scf_structure(source: str):
    """The supported workflow always writes an explicit QE Angstrom cell."""
    cell_match = re.search(
        r"(?im)^\s*CELL_PARAMETERS\s+(?:angstrom|\(\s*angstrom\s*\))\s*$", source)
    atom_match = re.search(r"(?im)^\s*ATOMIC_POSITIONS\s+crystal\s*$", source)
    k_match = re.search(r"(?im)^\s*K_POINTS\s+automatic\s*$", source)
    if not cell_match or not atom_match or not k_match or cell_match.end() >= atom_match.start():
        raise ValueError("Expected explicit CELL_PARAMETERS angstrom / ATOMIC_POSITIONS crystal")
    cell_rows = [line.strip().split() for line in source[cell_match.end():atom_match.start()].splitlines()
                 if line.strip()]
    if len(cell_rows) != 3 or any(len(row) != 3 for row in cell_rows):
        raise ValueError("Expected three cell vectors in Angstrom")
    try:
        cell = [[float(x) for x in row] for row in cell_rows]
    except ValueError as exc:
        raise ValueError("Invalid cell vectors") from exc
    atoms = []
    for line in source[atom_match.end():k_match.start()].splitlines():
        if not line.strip():
            continue
        tokens = line.split()
        if len(tokens) not in (4, 7) or not re.fullmatch(r"[A-Z][a-z]?", tokens[0]):
            raise ValueError("Invalid explicit SCF atom row")
        try:
            frac = [float(v) for v in tokens[1:4]]
        except ValueError as exc:
            raise ValueError("Invalid fractional coordinates") from exc
        if any(not finite(x) for x in frac):
            raise ValueError("Nonfinite fractional coordinates")
        atoms.append({"index": len(atoms) + 1, "element": tokens[0],
                      "fractional": [x % 1 for x in frac]})
    if not 1 <= len(atoms) <= 1000:
        raise ValueError("Atom count exceeds supported range")
    if any(not finite(x) for row in cell for x in row):
        raise ValueError("Nonfinite cell vector")
    # QE cell vectors are rows; physical volume must be nonzero.
    a, b, c = cell
    triple = sum(a[i] * (b[(i + 1) % 3] * c[(i + 2) % 3] -
                         b[(i + 2) % 3] * c[(i + 1) % 3]) for i in range(3))
    if abs(triple) < 1e-6:
        raise ValueError("Degenerate cell")
    return cell, atoms


def periodic_distance(point, atom_frac, cell):
    diff = [atom_frac[i] - point[i] for i in range(3)]
    best = math.inf
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in (-1, 0, 1):
                offsets = (diff[0] + i, diff[1] + j, diff[2] + k)
                cart = [sum(offsets[q] * cell[q][d] for q in range(3)) for d in range(3)]
                best = min(best, math.sqrt(sum(v * v for v in cart)))
    return best


def protocol(source):
    sysblock = re.search(r"(?ims)^\s*&SYSTEM\b(.*?)^\s*/\s*$", source)
    if not sysblock:
        raise ValueError("Missing SYSTEM namelist")
    block = sysblock.group(1)
    def field(name):
        m = re.search(r"(?i)\b" + name + r"\s*=\s*(['\"]?)([^,'\"\n]+)\1", block)
        return m.group(2).strip().lower() if m else None
    mesh = re.search(r"(?im)^\s*K_POINTS\s+automatic\s*\n\s*(\d+)\s+(\d+)\s+(\d+)\s+([01])\s+([01])\s+([01])", source)
    if not mesh:
        raise ValueError("Missing automatic k mesh in final SCF input")
    keys = ("ecutwfc", "ecutrho", "occupations", "smearing", "degauss", "input_dft",
            "nspin", "noncolin", "lspinorb", "tot_charge", "vdw_corr",
            "assume_isolated")
    values = {key: field(key) for key in keys}
    # Do not assert PBE when the functional is not explicitly provided.
    values["k_mesh_and_shifts"] = [int(x) for x in mesh.groups()]
    if values["nspin"] not in (None, "1") or values["noncolin"] not in (None, ".false.") or \
       values["lspinorb"] not in (None, ".false."):
        raise ValueError("Spin/SOC calculation needs a different comparison workflow")
    if values["ecutwfc"] is None or values["ecutrho"] is None:
        raise ValueError("SCF cutoffs must be explicit")
    if values["tot_charge"] is not None and float(values["tot_charge"].replace("d", "e")) != 0:
        raise ValueError("Charged defects require separate electrostatic corrections")
    return values


def checked_step_input(directory, pipeline, step):
    file = directory / (step + ".in")
    if file.is_symlink() or not file.is_file() or file.stat().st_size > 2_000_000:
        raise ValueError("Required QE step input missing or unsafe: " + file.name)
    expected_sha = pipeline["steps"][step].get("input_sha256")
    if expected_sha != hashlib.sha256(file.read_bytes()).hexdigest():
        raise ValueError(step + ".in checksum mismatch")
    return file.read_text(encoding="utf-8")


def pdos_protocol(directory, pipeline, scf_source):
    """Require equivalent NSCF bands/k sampling and DOS broadening settings."""
    base = protocol(scf_source)
    nscf = checked_step_input(directory, pipeline, "nscf")
    nscf_settings = protocol(nscf)
    block = re.search(r"(?ims)^\s*&SYSTEM\b(.*?)^\s*/\s*$", nscf)
    nbnd = re.search(r"(?i)\bnbnd\s*=\s*(\d+)", block.group(1)) if block else None
    if not nbnd:
        raise ValueError("NSCF nbnd must be explicit")
    expected = {k: v for k, v in base.items() if k != "k_mesh_and_shifts"}
    actual = {k: v for k, v in nscf_settings.items() if k != "k_mesh_and_shifts"}
    if expected != actual:
        raise ValueError("SCF/NSCF physics settings differ within a case")
    post = {}
    for step in ("dos", "projwfc"):
        text = checked_step_input(directory, pipeline, step)
        # The official generated inputs use deterministic names and order.
        # Whitespace-only changes are ignored; substantive settings are not.
        post[step] = " ".join(text.casefold().split())
    return {"scf": base, "nscf_kmesh": nscf_settings["k_mesh_and_shifts"],
            "nscf_nbnd": int(nbnd.group(1)), "postprocessors": post}


def expected_stoichiometry(kind, counts):
    mo, s, oxygen = counts.get("Mo", 0), counts.get("S", 0), counts.get("O", 0)
    if not mo or set(counts) - {"Mo", "S", "O"}:
        raise ValueError("Only Mo/S/O material models are supported")
    expected = {
        "pristine": (0, 0), "V_S": (1, 0), "V_2S": (2, 0),
        "O_S": (1, 1), "O2_at_VS": (1, 2)
    }[kind]
    if (2 * mo - s, oxygen) != expected:
        raise ValueError(f"{kind} composition mismatches MoS2 defect hypothesis")
    # Compositional match does not establish O2 chemisorption or V2S adjacency.
    return {"Mo": mo, "S": s, "O": oxygen}


def curve_from_atoms(pdos, selected_indices, size):
    groups = defaultdict(lambda: defaultdict(lambda: [0.0] * size))
    counts = Counter()
    for atom in pdos:
        if atom["atom_index"] not in selected_indices:
            continue
        element = atom["element"]
        counts[element] += 1
        for orbital, values in atom["orbitals"].items():
            if len(values) != size or any(not finite(v) or v < 0 for v in values):
                raise ValueError("Malformed per-atom orbital PDOS")
            row = groups[element][orbital]
            for i, value in enumerate(values):
                row[i] += value
    return {
        element: {"atom_count": counts[element],
                  "orbitals_mean_per_atom": {
                      orbital: [round(v / counts[element], 9) for v in values]
                      for orbital, values in by_orbital.items()
                  }}
        for element, by_orbital in groups.items()
    }


def map_reference_atoms(reference, target, cell, tolerance=0.65):
    """Greedy bijection for retained same-element atoms, with ambiguous sites omitted.

    Not suitable to infer the missing sulfur site, substitution chemistry,
    charged defect states or a rigorous atom correspondence after reconstruction.
    """
    candidates = []
    for tar in target:
        for ref in reference:
            if tar["element"] != ref["element"]:
                continue
            distance = periodic_distance(ref["fractional"], tar["fractional"], cell)
            if distance <= tolerance:
                candidates.append((distance, tar["index"], ref["index"]))
    candidates.sort()
    paired_target, paired_ref = set(), set()
    matches = []
    for d, ti, ri in candidates:
        if ti in paired_target or ri in paired_ref:
            continue
        matches.append({"case_atom_index": ti, "pristine_atom_index": ri,
                        "distance_angstrom": round(d, 5)})
        paired_target.add(ti)
        paired_ref.add(ri)
    return {"matches": matches, "unmatched_case_indices":
            [a["index"] for a in target if a["index"] not in paired_target],
            "max_matching_distance_angstrom": tolerance,
            "method": "same-element nearest minimum-image pairing; provisional, no defect inference"}


def prepare_case(config, root, radius):
    kind, name = config["kind"], config["id"]
    directory = safe_run_dir(root, config["run_dir"])
    result_path = directory / "electronic-results.json"
    data = read_json(result_path)
    pipeline = read_json(directory / "pipeline.json")
    if data.get("schema") != "kristalyapi.qe-electronic.v1" or \
       pipeline.get("schema") != "kristalyapi.qe-pipeline.v1" or pipeline.get("status") != "completed":
        raise ValueError(name + ": requires a completed QE electronic pipeline")
    for stage in ("scf", "nscf", "dos", "projwfc"):
        if pipeline.get("steps", {}).get(stage, {}).get("status") != "completed":
            raise ValueError(name + ": incomplete required step " + stage)
    if data.get("input_sha256") != pipeline.get("input_sha256") or \
       data.get("pseudopotentials") != pipeline.get("pseudopotentials"):
        raise ValueError(name + ": electronic/pipeline provenance mismatch")
    scf_file = directory / "scf.in"
    if scf_file.is_symlink() or not scf_file.is_file() or scf_file.stat().st_size > 2_000_000:
        raise ValueError(name + ": missing or unsafe scf.in")
    if pipeline["steps"]["scf"].get("input_sha256") != hashlib.sha256(scf_file.read_bytes()).hexdigest():
        raise ValueError(name + ": scf.in checksum mismatch")
    text = scf_file.read_text(encoding="utf-8")
    cell, atoms = read_scf_structure(text)
    counts = Counter(atom["element"] for atom in atoms)
    composition = expected_stoichiometry(kind, counts)
    detailed = data.get("pdos_atoms")
    dos = data.get("dos")
    if not detailed or not dos or detailed.get("spin_mode") != "collinear-unpolarized":
        raise ValueError(name + ": only non-spin-polarized detailed PDOS is supported")
    energy = detailed["energy_ev"]
    if not isinstance(energy, list) or not 2 <= len(energy) <= 15000 or \
       any(not finite(v) for v in energy) or \
       any(a >= b for a, b in zip(energy, energy[1:])) or \
       energy != dos.get("energy_ev"):
        raise ValueError(name + ": invalid DOS energy axis")
    all_atoms = detailed.get("atoms", [])
    if len(all_atoms) != len(atoms) or \
       {a.get("atom_index") for a in all_atoms} != {a["index"] for a in atoms}:
        raise ValueError(name + ": per-atom PDOS list does not match final SCF atom indices")
    for atom in all_atoms:
        if atoms[atom["atom_index"] - 1]["element"] != atom.get("element"):
            raise ValueError(name + ": atom PDOS element mismatch")
    center = config.get("defect_center_fractional")
    if not isinstance(center, list) or len(center) != 3 or any(not finite(v) or v < 0 or v >= 1 for v in center):
        raise ValueError(name + ": explicitly provide three fractional defect/anchor coordinates")
    distances = {atom["index"]: periodic_distance(center, atom["fractional"], cell) for atom in atoms}
    near_indices = sorted(index for index, d in distances.items() if d <= radius)
    far_indices = sorted(index for index, d in distances.items() if d > radius)
    if not near_indices:
        raise ValueError(name + ": no atoms within local radius")
    groups = {
        "near": curve_from_atoms(all_atoms, set(near_indices), len(energy)),
        "far": curve_from_atoms(all_atoms, set(far_indices), len(energy))
    }
    record = {
        "id": name, "kind": kind, "label": config.get("label", name)[:100],
        "counts": composition, "energy_ev_raw": energy,
        "local_radius_angstrom": radius, "center_fractional": center,
        "near_atom_indices": near_indices, "far_atom_indices": far_indices,
        "near_distances_angstrom": {str(k): round(distances[k], 4) for k in near_indices},
        "pdos": groups, "protocol": pdos_protocol(directory, pipeline, text),
        "upf": {k: v["sha256"] for k, v in data["pseudopotentials"].items()},
        "cell_angstrom": cell, "atoms": atoms,
        "reference_energy_ev": config.get("reference_energy_ev"),
        "reference_evidence": config.get("reference_evidence"),
        "input_sha256": data["input_sha256"]
    }
    return record


def generate(config_path: Path):
    cfg = read_json(config_path)
    if cfg.get("schema") != CONFIG_SCHEMA:
        raise ValueError("Wrong series config schema")
    cases = cfg.get("cases")
    if not isinstance(cases, list) or not 2 <= len(cases) <= 5:
        raise ValueError("Two to five cases required")
    ids = [c.get("id") for c in cases if isinstance(c, dict)]
    if len(ids) != len(cases) or len(set(ids)) != len(ids) or \
       any(kind not in KINDS for kind in ids):
        raise ValueError("Case IDs must be unique canonical defect types")
    if "pristine" not in ids:
        raise ValueError("Pristine reference case required")
    radius = cfg.get("near_radius_angstrom", 3.6)
    if not finite(radius) or not 0.5 <= radius <= 8:
        raise ValueError("Near radius must be 0.5..8 Å")
    for c in cases:
        if c.get("kind") != c.get("id"):
            raise ValueError("Case kind must match canonical ID")
        if not isinstance(c.get("label", c["id"]), str):
            raise ValueError("Case label must be text")
    records = [prepare_case(c, config_path.parent, radius) for c in cases]
    reference = next(x for x in records if x["id"] == "pristine")
    common_mo = reference["counts"]["Mo"]
    cell = reference["cell_angstrom"]
    prot = reference["protocol"]
    for record in records:
        if record["counts"]["Mo"] != common_mo:
            raise ValueError("Mo atom count differs: use the SAME supercell dimensions")
        if any(abs(cell[i][j] - record["cell_angstrom"][i][j]) > 1e-3
               for i in range(3) for j in range(3)):
            raise ValueError("Cell vectors differ: this comparison requires the same fixed supercell")
        if record["protocol"] != prot:
            raise ValueError("QE SCF protocol differs; do not compare unmatched settings")
        for element in ("Mo", "S"):
            if record["upf"].get(element) != reference["upf"].get(element):
                raise ValueError("Mo/S UPF hash differs across cases")
    for idx, a in enumerate(records):
        for b in records[idx + 1:]:
            if "O" in a["upf"] and "O" in b["upf"] and a["upf"]["O"] != b["upf"]["O"]:
                raise ValueError("O UPF hash differs across cases")
    aligned = [r["reference_energy_ev"] is not None for r in records]
    if any(aligned) and not all(aligned):
        raise ValueError("Energy alignment must be supplied for ALL cases or NONE")
    energy_status = "unaligned"
    if all(aligned):
        if cfg.get("alignment_method") != "vacuum_potential":
            raise ValueError("Only explicitly supplied vacuum-potential lineups are supported")
        for r in records:
            if not finite(r["reference_energy_ev"]) or \
               not isinstance(r["reference_evidence"], str) or \
               not r["reference_evidence"].strip():
                raise ValueError("All external vacuum references require numeric values and evidence")
            r["energy_ev_aligned"] = [round(e - r["reference_energy_ev"], 9)
                                      for e in r["energy_ev_raw"]]
        energy_status = "user_supplied_vacuum_alignment_unverified"
    else:
        for r in records:
            r["energy_ev_aligned"] = None
    # Preserve pristine atom coordinates until every case has been mapped.
    # The pristine record itself may occur first in the user-provided series.
    reference_atoms = reference["atoms"]
    for r in records:
        r["reference_mapping"] = map_reference_atoms(reference_atoms, r["atoms"], cell)
    for r in records:
        del r["atoms"]
    return {
        "schema": SCHEMA, "reference": "ACS Nano 2022 10.1021/acsnano.2c09209",
        "alignment_status": energy_status,
        "alignment_method": cfg.get("alignment_method") if all(aligned) else None,
        "alignment_note": (
            "E_plot = E_QE - user-supplied E_vac. Evidence is recorded, not verified by this software."
            if all(aligned) else
            "Raw QE eigenvalue zeros are NOT comparable between independent calculations. No overlay."
        ),
        "near_radius_angstrom": radius,
        "cases": records,
        "warnings": [
            "Stoichiometry does not prove V2S adjacency or O2@VS chemical adsorption.",
            "Proximity and nearest-element pairing do not prove structural atom identity after reconstruction.",
            "Only collinear unpolarized calculations were accepted; open-shell defect physics may require spin.",
            "Converged computation and pseudopotential consistency do not establish DFT accuracy.",
            "Projected DOS does not establish optical emission or antibunching."
        ]
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args(argv)
    try:
        result = generate(args.config)
        if args.output.is_symlink() or args.output.exists():
            raise ValueError("Output must be new and must not overwrite existing data")
        args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n",
                               encoding="utf-8")
        print(json.dumps({"output": str(args.output), "cases": len(result["cases"]),
                          "alignment": result["alignment_status"]}))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print("Defect comparison: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
