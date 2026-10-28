"""D3 fixed-cell relax -> independent SCF contracts and raw QE checks."""
from __future__ import annotations

import copy
import math
import re

from job_core import ALLOWED_TOP, canonical_request, make_pw_input, num
from qe_run import summarize_output

SCHEMA = "kristalyapi.qe-relax-scf-job.v1"
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?"


class NotConverged(ValueError):
    pass


def number(value):
    value = float(value.replace("D", "E").replace("d", "e"))
    if not math.isfinite(value):
        raise ValueError("Nonfinite QE output number")
    return value


def scf_request(request, structure=None):
    result = {key: copy.deepcopy(request[key]) for key in ALLOWED_TOP}
    result["schema"] = "kristalyapi.qe-scf-job.v1"
    result["parameters"]["calculation"] = "scf"
    if structure is not None:
        result["structure"] = copy.deepcopy(structure)
    return canonical_request(result)


def canonical_relax_request(data):
    if set(data) != ALLOWED_TOP | {"relaxation"}:
        raise ValueError("Relaxation requires exact structured fields")
    if not isinstance(data["parameters"], dict) or data["parameters"].get("calculation") != "relax-scf":
        raise ValueError("D3 supports only fixed-cell relax-scf")
    settings = data["relaxation"]
    if not isinstance(settings, dict) or set(settings) != {
            "max_steps", "force_threshold_ry_bohr", "energy_threshold_ry"}:
        raise ValueError("Invalid relaxation settings")
    steps = settings["max_steps"]
    if type(steps) is not int or not 1 <= steps <= 60:
        raise ValueError("Relaxation max_steps must be an integer in [1,60]")
    force = num(settings["force_threshold_ry_bohr"], 1e-5, 5e-3, "force threshold")
    energy = num(settings["energy_threshold_ry"], 1e-8, 1e-3, "ionic energy threshold")
    result, fingerprint = scf_request(data)
    result["schema"] = SCHEMA
    result["parameters"]["calculation"] = "relax-scf"
    result["relaxation"] = {"max_steps": steps, "force_threshold_ry_bohr": force,
                            "energy_threshold_ry": energy}
    return result, fingerprint


def make_relax_input(request, upf):
    scf, _ = scf_request(request)
    source = make_pw_input(scf, upf)
    r = request["relaxation"]
    source = source.replace("calculation='scf'", "calculation='relax'", 1)
    source = source.replace("outdir='./tmp'", "outdir='./relax-tmp'", 1)
    source = source.replace(" tprnfor=.true.,", " nstep="+str(r["max_steps"])+",\n"
                            +f" etot_conv_thr={r['energy_threshold_ry']:.12g},\n"
                            +f" forc_conv_thr={r['force_threshold_ry_bohr']:.12g},\n"
                            +" tprnfor=.true.,", 1)
    return source.replace("ATOMIC_SPECIES", "&IONS\n ion_dynamics='bfgs',\n/\nATOMIC_SPECIES", 1)


def final_forces(raw, structure):
    sections = re.split(r"(?im)^\s*Forces acting on atoms", raw)
    if len(sections) < 2:
        raise ValueError("Missing final atomic forces")
    block = re.split(r"(?im)^\s*Total force\s*=", sections[-1], maxsplit=1)[0]
    pattern = re.compile(r"^\s*atom\s+(\d+)\s+type\s+(\d+)\s+force\s*=\s*"
                         +"\s+".join(["("+NUMBER+")"]*3)+r"\s*$", re.I)
    rows = []
    # verbosity='high' prints force contribution blocks after the first, total
    # atomic-force block. Never combine their repeated atom indices with it.
    for line in block.splitlines():
        match = pattern.fullmatch(line)
        if match:
            rows.append(match.groups())
        elif rows and line.strip():
            break
    atoms = structure["atoms"]
    if len(rows) != len(atoms):
        raise ValueError("Final atomic force count mismatch")
    species = sorted({a["element"] for a in atoms})
    forces = []
    for index, (row, atom) in enumerate(zip(rows, atoms), 1):
        if int(row[0]) != index or int(row[1]) != species.index(atom["element"])+1:
            raise ValueError("Final atomic force identity mismatch")
        forces.append([number(x) for x in row[2:]])
    return {"forces_ry_bohr": forces,
            "max_force_component_ry_bohr": max(abs(x) for row in forces for x in row),
            "max_force_norm_ry_bohr": max(math.sqrt(sum(x*x for x in row)) for row in forces)}


def checked_scf(raw, returncode, request, calculation="scf"):
    proof = summarize_output(raw, calculation, returncode)
    if proof["status"] != "completed" or "convergence NOT achieved" in raw:
        raise NotConverged("QE "+calculation+" did not converge and finish")
    if proof["energy_ry"] is None or not math.isfinite(proof["energy_ry"]) or not proof["qe_version"]:
        raise ValueError("Missing finite QE energy/version")
    accuracy = re.findall(r"estimated scf accuracy\s*<\s*("+NUMBER+r")\s*Ry", raw)
    if not accuracy or not 0 <= number(accuracy[-1]) <= 1e-8:
        raise NotConverged("Final SCF error exceeds 1e-8 Ry")
    proof["last_scf_accuracy_ry"] = number(accuracy[-1])
    proof.update(final_forces(raw, request["structure"]))
    if proof["max_force_component_ry_bohr"] > request["relaxation"]["force_threshold_ry_bohr"]+1e-8:
        raise NotConverged("Final force component exceeds the requested threshold")
    return proof


def relaxed_structure(request, raw):
    blocks = re.findall(r"(?is)Begin final coordinates(.*?)End final coordinates", raw)
    if not blocks or re.search(r"(?im)^\s*CELL_PARAMETERS\b", blocks[-1]):
        raise ValueError("Missing fixed-cell final coordinates")
    match = re.search(r"(?im)^\s*ATOMIC_POSITIONS\s+\(?crystal\)?\s*\n", blocks[-1])
    if not match:
        raise ValueError("Final coordinates must be fractional crystal coordinates")
    rows = [line.split() for line in blocks[-1][match.end():].strip().splitlines() if line.strip()]
    atoms = request["structure"]["atoms"]
    if len(rows) != len(atoms) or any(len(row) != 4 or row[0] != atom["element"]
                                    for row, atom in zip(rows, atoms)):
        raise ValueError("Relaxed atom count/order differs from the source")
    structure = copy.deepcopy(request["structure"])
    structure["atoms"] = [{"element":row[0], "fractional":[number(x) for x in row[1:]]}
                          for row in rows]
    result, fingerprint = scf_request(request, structure)
    return result["structure"], fingerprint


def checked_relaxation(request, raw, returncode):
    proof = checked_scf(raw, returncode, request, "relax")
    energies = [number(x) for x in re.findall(r"(?m)^\s*!\s*total energy\s*=\s*("+NUMBER+r")\s*Ry", raw)]
    delta = abs(energies[-1]-energies[-2]) if len(energies) >= 2 else None
    if delta is not None and delta > request["relaxation"]["energy_threshold_ry"]+2e-8:
        raise NotConverged("Last ionic energy change exceeds the requested threshold")
    proof["last_ionic_energy_change_ry"] = delta
    structure, fingerprint = relaxed_structure(request, raw)
    proof["structure_hash"] = fingerprint
    return structure, proof
