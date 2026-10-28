"""D2: strictly structured, single-user Quantum ESPRESSO SCF requests.

The server only compiles validated scalar/coordinate data, never accepts
QE namelists, file paths, executables, filenames or shell commands from HTTP.
Actual UPFs are *operator-provided*, read-only, SHA-256 verified at execution.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

RY_TO_EV = 13.605693122994
SYMBOL = re.compile(r"^[A-Z][a-z]?$")
UPF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.+-]*[.]upf$", re.I)
PROFILE = re.compile(r"^[a-z][a-z0-9_-]{1,39}$")
ATOMIC_MASS = {"H":1.008,"C":12.011,"N":14.007,"O":15.999,"Si":28.085,
               "S":32.06,"Mo":95.95}
ALLOWED_TOP = {"schema","structure","parameters","profile_id"}
ALLOWED_STRUCT = {"cell_angstrom","atoms","periodic"}
ALLOWED_PARAMS = {"calculation","functional","ecutwfc_ry","ecutrho_ry","kpoints","spin"}


def num(value, low, high, label):
    if type(value) not in (float,int) or not math.isfinite(value) or not low<=value<=high:
        raise ValueError(label+" must be a finite number in the permitted range")
    return float(value)


def canonical_request(data):
    if not isinstance(data,dict) or set(data)!=ALLOWED_TOP:
        raise ValueError("Missing or unsupported top-level calculation fields")
    if data["schema"]!="kristalyapi.qe-scf-job.v1":
        raise ValueError("Unsupported job schema")
    structure=data["structure"]
    settings=data["parameters"]
    if not isinstance(structure,dict) or set(structure)!=ALLOWED_STRUCT:
        raise ValueError("Invalid structure fields")
    if not isinstance(settings,dict) or set(settings)!=ALLOWED_PARAMS:
        raise ValueError("Invalid parameters fields")
    if structure["periodic"] is not True:
        raise ValueError("Only fully 3D periodic P1 cells are accepted (2D slab uses explicit vacuum)")
    raw_cell=structure["cell_angstrom"]
    if not isinstance(raw_cell,list) or len(raw_cell)!=3 or any(not isinstance(x,list) or len(x)!=3 for x in raw_cell):
        raise ValueError("Expected 3x3 cell vectors in Angstrom")
    cell=[[num(v,-200,200,"cell component") for v in row] for row in raw_cell]
    if any(math.sqrt(sum(v*v for v in row))<1 for row in cell):
        raise ValueError("Cell vectors must each be >=1 Angstrom")
    a,b,c=cell
    volume=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])
    if abs(volume)<1:
        raise ValueError("Degenerate or too small cell")
    raw_atoms=structure["atoms"]
    if not isinstance(raw_atoms,list) or not 1<=len(raw_atoms)<=64:
        raise ValueError("D2 accepts 1-64 fully occupied explicit atoms")
    atoms=[]
    for row in raw_atoms:
        if not isinstance(row,dict) or set(row)!={"element","fractional"}:
            raise ValueError("Atom must provide element and fractional coordinates only")
        sp=row["element"]
        xyz=row["fractional"]
        if not isinstance(sp,str) or not SYMBOL.fullmatch(sp) or sp not in ATOMIC_MASS:
            raise ValueError("Unsupported element: "+str(sp))
        if not isinstance(xyz,list) or len(xyz)!=3:
            raise ValueError("Three fractional coordinates required")
        frac=[num(v,-100,100,"fractional coordinate")%1 for v in xyz]
        atoms.append({"element":sp,"fractional":frac})
    # Reject duplicate/overlapping atomic sites under periodic minimum-image distance.
    for j, atom in enumerate(atoms):
        for other in atoms[:j]:
            delta=[atom["fractional"][k]-other["fractional"][k] for k in range(3)]
            delta=[v-round(v) for v in delta]
            cart=[sum(delta[k]*cell[k][axis] for k in range(3)) for axis in range(3)]
            if math.sqrt(sum(v*v for v in cart))<0.35:
                raise ValueError("Overlapping or duplicate atomic sites in periodic cell")
    if settings["calculation"]!="scf" or settings["functional"]!="PBE" or settings["spin"]!="unpolarized":
        raise ValueError("D2 only supports PBE, unpolarized single-point SCF")
    ecutwfc=num(settings["ecutwfc_ry"],10,200,"ecutwfc")
    ecutrho=num(settings["ecutrho_ry"],ecutwfc,1600,"ecutrho")
    mesh=settings["kpoints"]
    if not isinstance(mesh,list) or len(mesh)!=3 or any(type(x)!=int or not 1<=x<=16 for x in mesh):
        raise ValueError("K point mesh must be three integers in [1,16]")
    p=data["profile_id"]
    if not isinstance(p,str) or not PROFILE.fullmatch(p):
        raise ValueError("Only operator-declared pseudopotential profile ids are supported")
    result={
        "schema":data["schema"],"profile_id":p,
        "structure":{"periodic":True,"cell_angstrom":cell,"atoms":atoms},
        "parameters":{"calculation":"scf","functional":"PBE",
                      "ecutwfc_ry":ecutwfc,"ecutrho_ry":ecutrho,
                      "kpoints":mesh,"spin":"unpolarized"},
    }
    fingerprint=hashlib.sha256(json.dumps(result["structure"],sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return result,fingerprint


def load_profile(request, profiles_dir:Path, pseudo_dir:Path):
    path=profiles_dir/(request["profile_id"]+".json")
    if path.is_symlink() or not path.is_file() or path.stat().st_size>100000:
        raise ValueError("Operator UPF profile not found")
    cfg=json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cfg,dict) or set(cfg)!={"schema","id","functional","elements"} or \
       cfg["schema"]!="kristalyapi.upf-profile.v1" or cfg["id"]!=request["profile_id"] or cfg["functional"]!="PBE":
        raise ValueError("UPF profile schema or functional mismatch")
    wanted={row["element"] for row in request["structure"]["atoms"]}
    entries=cfg["elements"]
    if not isinstance(entries,dict) or not wanted.issubset(entries):
        raise ValueError("UPF profile does not cover every atom")
    validated={}
    for element in sorted(wanted):
        meta=entries[element]
        if not isinstance(meta,dict) or set(meta)!={"file","sha256","source","license","functional"}:
            raise ValueError("UPF profile entry requires exact metadata")
        filename=meta["file"]
        if not isinstance(filename,str) or not UPF.fullmatch(filename) or ".." in filename:
            raise ValueError("Unsafe UPF file name")
        if meta["functional"]!="PBE" or not isinstance(meta["source"],str) or not meta["source"].strip() or \
           not isinstance(meta["license"],str) or not meta["license"].strip():
            raise ValueError("UPF provenance/license/functional missing")
        if not isinstance(meta["sha256"],str) or not re.fullmatch(r"[a-fA-F0-9]{64}",meta["sha256"]):
            raise ValueError("UPF hash missing")
        file=pseudo_dir/filename
        if file.is_symlink() or not file.is_file() or not 20<=file.stat().st_size<=20_000_000:
            raise ValueError("Missing/empty/symlink/oversized operator UPF for "+element)
        # This verifies only operator-supplied bytes and declared provenance, not physical suitability.
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        if digest.lower()!=meta["sha256"].lower():
            raise ValueError("UPF SHA-256 mismatch for "+element)
        if b"<UPF" not in file.read_bytes()[:4096] and b"Generated using" not in file.read_bytes()[:4096]:
            raise ValueError("UPF header not recognized for "+element)
        validated[element]={"file":filename,"sha256":digest,"source":meta["source"],
                             "license":meta["license"],"functional":meta["functional"]}
    return validated


def make_pw_input(request,upf):
    p=request["parameters"];s=request["structure"];atoms=s["atoms"]
    species=sorted({a["element"] for a in atoms})
    lines=[
        "&CONTROL"," calculation='scf',"," prefix='kristalyapi',",
        " pseudo_dir='./pseudo',"," outdir='./tmp',",
        " tprnfor=.true.,"," verbosity='high',","/",
        "&SYSTEM"," ibrav=0,"," nat="+str(len(atoms))+",",
        " ntyp="+str(len(species))+",",
        " ecutwfc="+f'{p["ecutwfc_ry"]:.8f}'+",",
        " ecutrho="+f'{p["ecutrho_ry"]:.8f}'+",",
        " input_dft='PBE',"," occupations='fixed',","/",
        "&ELECTRONS"," conv_thr=1.0d-8,"," mixing_beta=0.3,"," electron_maxstep=150,","/",
        "ATOMIC_SPECIES"]
    for sp in species:
        lines.append(sp+" "+f"{ATOMIC_MASS[sp]:.5f}"+" "+upf[sp]["file"])
    lines.append("CELL_PARAMETERS angstrom")
    for row in s["cell_angstrom"]:
        lines.append(" ".join(f"{v:.10f}" for v in row))
    lines.append("ATOMIC_POSITIONS crystal")
    for atom in atoms:
        lines.append(atom["element"]+" "+" ".join(f"{v:.10f}" for v in atom["fractional"]))
    lines.extend(["K_POINTS automatic"," ".join(map(str,p["kpoints"]))+" 0 0 0",""])
    return "\n".join(lines)
