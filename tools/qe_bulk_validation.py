#!/usr/bin/env python3
"""Verify externally executed 3D Quantum ESPRESSO SCF/bands evidence.

Does NOT run QE, infer polytypes, certify accuracy or accept simulated logs.
All path/digest and numeric checks are necessary, not sufficient.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

RY_MEV = 13605.693122994
SCHEMA = "kristalyapi.qe-bulk-evidence.v1"
SHA = re.compile(r"^[0-9a-f]{64}$")
MATERIALS = {"GaN": {"Ga", "N"}, "AlN": {"Al", "N"}, "SiC": {"Si", "C"}}
ENERGY = re.compile(r"!\s+total energy\s*=\s*([+-]?[0-9.]+(?:[Ee][+-]?\d+)?)\s+Ry")
ACCURACY = re.compile(r"estimated scf accuracy\s*<\s*([0-9.]+(?:[Ee][+-]?\d+)?)\s+Ry", re.I)
ECUT = re.compile(r"\b(ecutwfc|ecutrho)\s*=\s*([0-9.]+)", re.I)
CALC = re.compile(r"\bcalculation\s*=\s*['\"]([^'\"]+)['\"]", re.I)
NAT = re.compile(r"\bnat\s*=\s*(\d+)", re.I)
NTYP = re.compile(r"\bntyp\s*=\s*(\d+)", re.I)
AUTOMATIC = re.compile(r"K_POINTS\s+(?:\{|\()?automatic(?:\}|\))?\s*\n\s*(\d+)\s+(\d+)\s+(\d+)\s+[01]\s+[01]\s+[01]", re.I)
BANDS = re.compile(r"K_POINTS\s+(?:\{|\()?crystal_b(?:\}|\))?\s*\n\s*(\d+)\s*\n", re.I)


def require(ok, why):
    if not ok:
        raise ValueError(why)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def artifact(root, value):
    require(isinstance(value, dict), "Artifact path and SHA are required")
    rel, digest = value.get("path"), value.get("sha256")
    require(isinstance(rel, str) and 0 < len(rel) <= 255 and not Path(rel).is_absolute()
            and ".." not in Path(rel).parts, "Unsafe artifact relative path")
    require(isinstance(digest, str) and SHA.fullmatch(digest), "SHA-256 must be lowercase hex")
    p = root / rel
    require(p.resolve().is_relative_to(root.resolve()) and p.is_file(),
            "Missing or escaped artifact: " + rel)
    require(p.stat().st_size <= 8_000_000, "Artifact exceeds 8 MB limit: " + rel)
    require(sha(p) == digest, "SHA-256 mismatch: " + rel)
    return p


def match_unique(pattern, source, field):
    found = pattern.findall(source)
    require(len(found) == 1, "Expected exactly one " + field)
    return found[0]


def qe_input(source, stage):
    calculation = match_unique(CALC, source, "calculation").lower()
    require(calculation == ("bands" if stage == "bands" else "scf"), "Unexpected QE calculation type")
    require("CELL_PARAMETERS" in source and "ATOMIC_POSITIONS" in source
            and "ATOMIC_SPECIES" in source,
            "QE input must define explicit cell, atomic species and positions")
    nat, ntyp = int(match_unique(NAT, source, "nat")), int(match_unique(NTYP, source, "ntyp"))
    require(1 <= nat <= 512 and ntyp == 2, "Invalid nat/ntyp for binary bulk")
    cuts = {name.lower(): float(value) for name, value in ECUT.findall(source)}
    require(set(cuts) == {"ecutwfc", "ecutrho"} and
            15 <= cuts["ecutwfc"] <= 500 and
            cuts["ecutwfc"] <= cuts["ecutrho"] <= 6000, "Invalid cutoffs")
    # First-stage fail-closed extraction. Real QE validation must later compare
    # all variable cell positions, occupations, functional and atom labels.
    block = source.split("CELL_PARAMETERS", 1)[1].split("K_POINTS", 1)[0]
    require(len(block.strip()) > 10, "Missing cell/atomic structure content")
    species_section = source.split("ATOMIC_SPECIES", 1)[1].split("CELL_PARAMETERS", 1)[0]
    species_rows = [line.split() for line in species_section.splitlines() if line.strip()]
    require(len(species_rows) == ntyp and all(len(parts) == 3 for parts in species_rows),
            "Invalid ATOMIC_SPECIES rows")
    species = {parts[0]: Path(parts[2]).name for parts in species_rows}
    require(len(species) == ntyp, "Duplicate atomic species")
    if stage == "bands":
        m = BANDS.search(source)
        require(m and 4 <= int(m.group(1)) <= 200, "Explicit crystal_b band path required")
        n = int(m.group(1))
        entries = [line.split() for line in source[m.end():].splitlines() if line.strip()][:n]
        require(len(entries) == n and all(len(x) >= 4 for x in entries), "Invalid crystal_b entries")
        points = []
        for row in entries:
            p = [float(v) for v in row[:3]]
            require(all(math.isfinite(v) and -1.01 <= v <= 1.01 for v in p), "Invalid k point")
            require(row[3].isdigit() and int(row[3]) >= 1, "Invalid band interpolation count")
            points.append(p)
        require(any(abs(k[2]) > 1e-7 for k in points), "3D bulk band path must contain nonzero kz")
        mesh = None
    else:
        m = AUTOMATIC.search(source)
        require(m, "K_POINTS automatic is required")
        mesh = [int(v) for v in m.groups()]
        require(all(2 <= v <= 64 for v in mesh), "Bulk k mesh must sample all three dimensions")
    return {"calculation": calculation, "nat": nat, "ntyp": ntyp, "cutoffs_ry": cuts,
            "mesh": mesh, "atomic_species_pseudos": species,
            "geometry_text": re.sub(r"\s+", " ", block.strip())}


def qe_output(source, stage):
    require(re.search(r"Program\s+PWSCF\s+v\S+", source), "QE PWSCF version missing")
    require("JOB DONE." in source and "Error in routine" not in source and
            "convergence NOT achieved" not in source, "QE output was not complete")
    version = re.search(r"Program\s+PWSCF\s+(v\S+)", source).group(1)
    if stage == "bands":
        return {"qe_version": version, "finished": True}
    require("convergence has been achieved" in source, "SCF convergence not reported")
    energy = float(match_unique(ENERGY, source, "SCF total energy"))
    accuracy = float(match_unique(ACCURACY, source, "SCF estimated accuracy"))
    require(math.isfinite(energy) and math.isfinite(accuracy) and accuracy >= 0,
            "SCF numeric result invalid")
    return {"qe_version": version, "energy_ry": energy, "scf_accuracy_ry": accuracy, "finished": True}


def verify(manifest_path):
    manifest_path = Path(manifest_path).resolve()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(data.get("schema") == SCHEMA, "Invalid bulk evidence schema")
    material = data.get("material")
    require(material in MATERIALS, "GaN, AlN or SiC required")
    require(isinstance(data.get("polytype_claim"), str) and data["polytype_claim"].strip(),
            "Explicit operator polytype claim required")
    root = manifest_path.parent
    structure = artifact(root, data.get("structure_reference"))
    upfs = data.get("pseudopotentials")
    require(isinstance(upfs, dict) and set(upfs) == MATERIALS[material],
            "One UPF for each element is required")
    pseudo_evidence = {element: sha(artifact(root, desc)) for element, desc in upfs.items()}
    runs = data.get("runs")
    require(isinstance(runs, dict) and set(runs) == {"baseline", "ecut-refined", "k-refined", "bands"},
            "Four pinned SCF/bands runs required")
    records = {}
    for key, stage in (("baseline", "scf"), ("ecut-refined", "scf"),
                       ("k-refined", "scf"), ("bands", "bands")):
        value = runs[key]
        require(isinstance(value, dict), "Invalid run evidence")
        inp = artifact(root, value.get("input")).read_text(encoding="utf-8")
        out = artifact(root, value.get("output")).read_text(encoding="utf-8")
        parsed_input = qe_input(inp, stage)
        expected_species = {element: Path(value["path"]).name for element, value in upfs.items()}
        require(parsed_input["atomic_species_pseudos"] == expected_species,
                "QE ATOMIC_SPECIES pseudopotential filenames differ from pinned UPFs")
        parsed_output = qe_output(out, stage)
        require(parsed_input["nat"] == qe_input(artifact(root, runs["baseline"]["input"]).read_text(encoding="utf-8"), "scf")["nat"],
                "Atom count changed between runs")
        records[key] = {**parsed_input, **parsed_output,
                        "input_sha256": value["input"]["sha256"],
                        "output_sha256": value["output"]["sha256"]}
    base, ecut, kmesh, bands = (records[key] for key in
                              ("baseline", "ecut-refined", "k-refined", "bands"))
    require(all(item["geometry_text"] == base["geometry_text"] for item in records.values()),
            "Electronic runs have different declared structure geometry")
    require(all(item["qe_version"] == base["qe_version"] for item in records.values()),
            "Solver versions differ across runs")
    require(ecut["mesh"] == base["mesh"] and
            ecut["cutoffs_ry"]["ecutwfc"] > base["cutoffs_ry"]["ecutwfc"] and
            kmesh["cutoffs_ry"] == base["cutoffs_ry"] and
            all(a >= b for a, b in zip(kmesh["mesh"], base["mesh"])) and
            kmesh["mesh"] != base["mesh"], "Reference runs do not isolate ecut and 3D k convergence")
    require(bands["cutoffs_ry"] == base["cutoffs_ry"], "Bands cutoff must match baseline")
    criteria = data.get("criteria", {})
    limit = criteria.get("max_energy_delta_mev_per_atom", 1)
    accuracy_ry = criteria.get("max_scf_accuracy_ry", 1e-6)
    require(type(limit) in (float, int) and 0 < limit <= 20 and
            type(accuracy_ry) in (float, int) and 0 < accuracy_ry <= 1e-4,
            "Invalid pre-registered tolerance")
    ecut_delta = abs(ecut["energy_ry"] - base["energy_ry"]) * RY_MEV / base["nat"]
    mesh_delta = abs(kmesh["energy_ry"] - base["energy_ry"]) * RY_MEV / base["nat"]
    precision = all(records[key]["scf_accuracy_ry"] <= accuracy_ry for key in
                    ("baseline", "ecut-refined", "k-refined"))
    numeric_ok = ecut_delta <= limit and mesh_delta <= limit and precision
    return {"schema": "kristalyapi.qe-bulk-review.v1", "material": material,
            "polytype_claim": data["polytype_claim"], "manifest_sha256": sha(manifest_path),
            "structure_file_sha256": sha(structure), "upf_file_sha256_verified": pseudo_evidence,
            "runs": {k: {field: value for field, value in v.items() if field != "geometry_text"}
                     for k, v in records.items()},
            "energy_delta_mev_per_atom": {"ecut_refinement": ecut_delta,
                                          "k_mesh_refinement": mesh_delta},
            "software_numeric_gates_passed": numeric_ok,
            "scientific_acceptance": False, "status": "review-required" if numeric_ok else "numeric-convergence-failed",
            "limitations": ("Externally supplied solver stdout and file hashes are internally consistent only; "
                            "no QE was executed, no PP functional/polytype/experimental identity certified, "
                            "no independent band physics, phonon, SOC, cell relaxation or device performance verified.")}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--output", type=Path)
    args = p.parse_args()
    result = verify(args.manifest)
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        require(args.output.resolve() != args.manifest.resolve(), "Do not overwrite manifest")
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0 if result["software_numeric_gates_passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
