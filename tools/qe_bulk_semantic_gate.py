#!/usr/bin/env python3
"""Strict P1.1/P1.3 semantic gates for externally supplied 3D QE bulk evidence.

Checks a separately supplied typed structure-reference transcription against
every raw QE input, and checks XC/UPF/electronic-settings consistency. No solver
is executed and no reference, signature or physical science is authenticated.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from qe_bulk_validation import MATERIALS, artifact, qe_input, require, verify

REFERENCE_SCHEMA = "kristalyapi.bulk-geometry-reference.v1"
REPORT_SCHEMA = "kristalyapi.qe-bulk-semantic-review.v1"
STAGES = ("baseline", "ecut-refined", "k-refined", "bands")
SHA = re.compile(r"^[0-9a-f]{64}$")


def number(x, name, minimum=None, maximum=None):
    require(type(x) in (float, int) and math.isfinite(x), "Invalid finite "+name)
    if minimum is not None:
        require(x >= minimum, name+" below minimum")
    if maximum is not None:
        require(x <= maximum, name+" above maximum")
    return float(x)


def normalized_sites(sites, expected_elements, count):
    require(isinstance(sites, list) and len(sites) == count and 1 <= count <= 512,
            "Reference/QE site count mismatch")
    result=[]
    for site in sites:
        require(isinstance(site, dict) and set(site)=={"element", "fractional"},
                "Invalid site geometry schema")
        require(site["element"] in expected_elements and isinstance(site["fractional"], list)
                and len(site["fractional"])==3, "Invalid material or fractional site")
        coordinates=tuple(number(x,"fractional coordinate",-1.0,2.0)%1 for x in site["fractional"])
        result.append((site["element"],coordinates))
    require({el for el,_ in result} == expected_elements,"Missing element in crystal structure")
    counts=[sum(el==kind for el,_ in result) for kind in sorted(expected_elements)]
    require(counts[0]==counts[1],"Binary bulk has non-1:1 stoichiometry")
    return result


def matrix(values):
    require(isinstance(values, list) and len(values)==3 and
            all(isinstance(row,list) and len(row)==3 for row in values),
            "Expected a 3×3 lattice matrix in Å")
    arr=[[number(x,"cell vector in angstrom",-1000,1000) for x in row] for row in values]
    ax,ay,az=arr
    volume=(ax[0]*(ay[1]*az[2]-ay[2]*az[1])
            -ax[1]*(ay[0]*az[2]-ay[2]*az[0])
            +ax[2]*(ay[0]*az[1]-ay[1]*az[0]))
    require(abs(volume)>1 and abs(volume)<1e8,"Degenerate or implausible cell")
    return arr


def source_reference(manifest, reference_file, root):
    reference_file=Path(reference_file).resolve()
    require(reference_file.is_file() and reference_file.stat().st_size <= 64_000,
            "Separate typed reference geometry file required")
    data=json.loads(reference_file.read_text(encoding="utf-8"))
    require(data.get("schema")==REFERENCE_SCHEMA, "Invalid reference geometry schema")
    material=manifest["material"]
    require(data.get("material")==material,"Reference material differs")
    require(data.get("cell_unit")=="angstrom" and data.get("coordinates")=="fractional",
            "Explicit Å cell / fractional coordinates are required")
    require(data.get("source_file_sha256")==manifest["structure_reference"]["sha256"],
            "Typed geometry is not linked to raw source-reference file SHA-256")
    # A hash link and source claim do not prove accurate transcription of a CIF.
    require(isinstance(data.get("source_identifier"),str)
            and 3 <= len(data["source_identifier"].strip()) <= 250,
            "Independent source/reference identifier must be declared")
    require(data.get("transcription_reviewed_by") is None or
            (isinstance(data["transcription_reviewed_by"],str)
             and 3<=len(data["transcription_reviewed_by"])<=250),
            "Invalid operator-reported transcription reviewer")
    raw_source=artifact(root,manifest["structure_reference"])
    require(hashlib.sha256(raw_source.read_bytes()).hexdigest()==data["source_file_sha256"],
            "Reference source raw bytes mismatch")
    expected=MATERIALS[material]
    lattice=matrix(data.get("cell_vectors_angstrom"))
    sites=normalized_sites(data.get("sites"),expected,len(data.get("sites",[])))
    return data,lattice,sites


def cleaned(text):
    return "\n".join(line.split("!",1)[0] for line in text.splitlines())


def qe_geometry(source,expected,expected_sites):
    text=cleaned(source)
    m=re.search(r"(?im)^\s*CELL_PARAMETERS\s+(?:\{)?angstrom(?:\})?\s*$",text)
    require(m is not None,"QE CELL_PARAMETERS must explicitly use angstrom")
    lines=[row.split() for row in text[m.end():].splitlines() if row.strip()][:3]
    require(len(lines)==3 and all(len(row)==3 for row in lines),
            "QE 3D lattice matrix requires exactly three vectors")
    lattice=matrix([[float(v) for v in row] for row in lines])
    a=re.search(r"(?im)^\s*ATOMIC_POSITIONS\s+(?:\{)?crystal(?:\})?\s*$",text)
    require(a is not None,"QE ATOMIC_POSITIONS must explicitly use crystal/fractional")
    rows=[row.split() for row in text[a.end():].splitlines() if row.strip()][:expected_sites]
    require(len(rows)==expected_sites and all(len(row)==4 for row in rows),
            "QE fractional atom site rows incomplete or ambiguous")
    sites=normalized_sites([
        {"element":row[0],"fractional":[float(v) for v in row[1:4]]} for row in rows
    ],expected,expected_sites)
    return lattice,sites


def site_equal(a,b,tolerance=1e-5):
    return a[0]==b[0] and all(min(abs(x-y),1-abs(x-y))<=tolerance
                              for x,y in zip(a[1],b[1]))


def verify_geometry(reference_cell,reference_sites,actual_cell,actual_sites):
    require(all(abs(x-y)<=5e-4 for ar,br in zip(reference_cell,actual_cell)
                for x,y in zip(ar,br)),
            "QE lattice differs from typed external source in angstrom")
    remaining=list(actual_sites)
    for expected in reference_sites:
        match=next((i for i,x in enumerate(remaining) if site_equal(expected,x)),None)
        require(match is not None,"QE atomic positions/species differ from typed reference")
        remaining.pop(match)
    require(not remaining,"QE has extra unmatched sites")


def param(text,name):
    expr=r"\b"+re.escape(name)+r"\s*=\s*([^,\n/]+)"
    matches=re.findall(expr,cleaned(text),re.I)
    require(len(matches)==1,"Expected exactly one QE parameter "+name)
    return matches[0].strip().strip("\"'").lower()


def system_settings(text):
    # Explicitly limit supported material calculations instead of silently
    # comparing energies from different Hubbard/spin/smearing conventions.
    require(re.search(r"(?im)^\s*ATOMIC_SPECIES\s*$",text) is not None,
            "Atomic species section required")
    scrub=cleaned(text)
    require(not re.search(r"(?im)^\s*(HUBBARD|CONSTRAINTS|OCCUPATIONS)\b",scrub)
            and not re.search(r"(?i)\b(lda_plus_u|noncolin|lspinorb|starting_magnetization|tot_magnetization)\s*=",scrub),
            "Unsupported spin, Hubbard or non-collinear setting; require a separate physical protocol")
    require(param(scrub,"ibrav")=="0","Only ibrav=0 explicit lattice is supported")
    require(param(scrub,"input_dft")=="pbe","Explicit PBE functional required")
    require(param(scrub,"occupations")=="fixed","Only fixed occupations supported")
    nbnd=int(param(scrub,"nbnd"))
    require(2<=nbnd<=512,"Invalid nbnd")
    threshold=float(param(scrub,"conv_thr").replace("d","e"))
    number(threshold,"electron convergence threshold",1e-13,1e-5)
    parsed=qe_input(text,"bands" if re.search(r"\bcalculation\s*=\s*['\"]bands",text,re.I) else "scf")
    require(parsed["nat"] == len(re.findall(r"(?m)^\s*[A-Z][a-z]?\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*$",
                                            scrub.split("ATOMIC_POSITIONS",1)[-1].split("K_POINTS",1)[0])),
            "QE nat and explicit atomic rows differ")
    return {"input_dft":"PBE","occupations":"fixed","nbnd":nbnd,"conv_thr":threshold,
            "ecutwfc_ry":parsed["cutoffs_ry"]["ecutwfc"],
            "ecutrho_ry":parsed["cutoffs_ry"]["ecutrho"],
            "ecutrho_ratio":parsed["cutoffs_ry"]["ecutrho"]/parsed["cutoffs_ry"]["ecutwfc"]}


def pseudo_header(raw,element):
    require(len(raw)<=8_000_000,"Oversized UPF")
    # Only a bounded PP_HEADER metadata check, not cryptographic vendor attestation.
    prefix=raw[:65536].decode("utf-8",errors="replace")
    start=re.search(r"<PP_HEADER\b[^>]*>",prefix,re.I|re.S)
    require(start is not None,"Missing UPF PP_HEADER")
    attrs=dict((a.lower(),b) for a,b in
               re.findall(r"([a-zA-Z_]+)\s*=\s*['\"]([^'\"]+)['\"]",start[0]))
    require(attrs.get("element")==element,"UPF element does not match")
    functional=attrs.get("functional","").upper().split()
    require("PBE" in functional and not any(x in functional for x in ("LDA","PZ","BLYP")),
            "UPF functional is not clearly PBE")
    valence=number(float(attrs.get("z_valence","nan")),"UPF z_valence",.1,60)
    return {"element":element,"xc_declared":attrs["functional"],
            "valence_electrons":valence}


def review(manifest_path,geometry_reference):
    manifest_path=Path(manifest_path).resolve()
    manifest=json.loads(manifest_path.read_text(encoding="utf8"))
    preflight=verify(manifest_path)
    root=manifest_path.parent
    reference,cell,sites=source_reference(manifest,geometry_reference,root)
    headers={element:pseudo_header(artifact(root,desc).read_bytes(),element)
             for element,desc in manifest["pseudopotentials"].items()}
    settings={}
    for name in STAGES:
        source=artifact(root,manifest["runs"][name]["input"]).read_text(encoding="utf8")
        actual_cell,actual_sites=qe_geometry(source,MATERIALS[manifest["material"]],len(sites))
        verify_geometry(cell,sites,actual_cell,actual_sites)
        settings[name]=system_settings(source)
    base=settings["baseline"]
    for name in STAGES[1:]:
        for key in ("input_dft","occupations","nbnd","conv_thr"):
            require(settings[name][key]==base[key],
                    "Scientific QE setting changed across convergence stages: "+key)
    for name in ("baseline","ecut-refined","k-refined"):
        require(settings[name]["ecutrho_ratio"] >=4,
                "QE ecutrho/ecutwfc below documented density cutoff ratio")
    require(abs(settings["ecut-refined"]["ecutrho_ratio"]-base["ecutrho_ratio"])<=1e-5,
            "ecut-refined run changed ecutrho/ecutwfc ratio; not an isolated wavefunction cutoff test")
    require(settings["k-refined"]["ecutrho_ry"]==base["ecutrho_ry"],
            "k-refined run changed ecutrho")
    require(settings["bands"]["ecutrho_ry"]==base["ecutrho_ry"],
            "bands stage cutoff differs from baseline")
    # Independent source transcription and real scientific reviewer not authenticated.
    return {"schema":REPORT_SCHEMA,"material":manifest["material"],
            "input_manifest_sha256":hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            "typed_reference_sha256":hashlib.sha256(Path(geometry_reference).read_bytes()).hexdigest(),
            "source_reference_sha256":reference["source_file_sha256"],
            "reference_identifier_claim":reference["source_identifier"],
            "geometry_units":{"cell":"angstrom","atomic_positions":"fractional"},
            "qe_input_geometry_matches_declared_reference":True,
            "pseudopotential_header_consistency":headers,
            "per_stage_electronic_settings":settings,
            "software_semantic_gates_passed":True,
            "underlying_numeric_gate_passed":preflight["software_numeric_gates_passed"],
            "scientific_acceptance":False,
            "reference_transcription_independently_verified":False,
            "UPF_supplier_identity_authenticated":False,
            "reviewer_signature_verified":False,
            "limitations":"No real device or solver execution; typed source is operator-transcribed. Requires independent CIF parsing, UPF source authentication, converged force/cell/k-path and signed external scientific review."}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest",type=Path,required=True)
    parser.add_argument("--geometry-reference",type=Path,required=True)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    result=review(args.manifest,args.geometry_reference)
    value=json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+"\n"
    if args.output:
        require(args.output.resolve()!=args.manifest.resolve() and
                args.output.resolve()!=args.geometry_reference.resolve(),
                "Do not overwrite review inputs")
        args.output.write_text(value,encoding="utf8")
    else:
        print(value,end="")
    return 0 if result["underlying_numeric_gate_passed"] else 2


if __name__=="__main__":
    raise SystemExit(main())
