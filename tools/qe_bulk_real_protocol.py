#!/usr/bin/env python3
"""Prepare honest, reproducible 3D bulk QE *input candidates* for a real pw.x run.

No computed result, COD match, experimentally certified lattice, or phase
identity is claimed. Every source file and pseudopotential is byte-pinned.
"""
import argparse
import hashlib
import json
import math
import re
import shutil
from pathlib import Path

MATERIALS = {
    "GaN": {"elements": ("Ga", "N"), "polytype": "wurtzite-candidate",
            "mass": (69.723, 14.007), "a": 3.189, "c": 5.185, "u": .377},
    "AlN": {"elements": ("Al", "N"), "polytype": "wurtzite-candidate",
            "mass": (26.9815385, 14.007), "a": 3.112, "c": 4.982, "u": .382},
    "SiC": {"elements": ("Si", "C"), "polytype": "3C-zincblende-candidate",
            "mass": (28.085, 12.011), "a": 4.3596, "c": None, "u": None},
}
SHA = re.compile(r"^[0-9a-f]{64}$")


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite(value, low, high):
    return type(value) in (float, int) and math.isfinite(value) and low <= value <= high


def geometry(material, a, c, u):
    if material in ("GaN", "AlN"):
        require(finite(a, 2, 7) and finite(c, 3, 12) and finite(u, .2, .5),
                "Invalid declared wurtzite lattice parameters")
        matrix = [(a, 0, 0), (-a/2, a*math.sqrt(3)/2, 0), (0, 0, c)]
        sites = [
            (MATERIALS[material]["elements"][0], 1/3, 2/3, 0),
            (MATERIALS[material]["elements"][0], 2/3, 1/3, .5),
            ("N", 1/3, 2/3, u),
            ("N", 2/3, 1/3, (.5+u)%1),
        ]
        # Reciprocal fractional coordinates, candidate high-symmetry nodes.
        # These are NOT a seekpath/spglib symmetry-certified k-path.
        path = [(0,0,0), (.5,0,0), (1/3,1/3,0),
                (0,0,0), (0,0,.5), (.5,0,.5), (1/3,1/3,.5), (0,0,.5)]
    else:
        require(finite(a, 3, 6), "Invalid 3C-SiC candidate lattice parameter")
        require(c is None and u is None, "3C-SiC does not use wurtzite c/u")
        matrix = [(0,a/2,a/2), (a/2,0,a/2), (a/2,a/2,0)]
        sites = [("Si",0,0,0), ("C",.25,.25,.25)]
        # For fcc *primitive reciprocal basis*: G, X, W, L, G.
        path = [(0,0,0), (0,.5,.5), (.25,.5,.75), (.5,.5,.5), (0,0,0)]
    return matrix, sites, path


def build(material, source_file, pseudo_dir, output, hashes,
          *, a=None, c=None, u=None, ecutwfc=60, ecutrho_ratio=8,
          k_base=4, k_refined=6, max_energy_delta=1, max_scf_accuracy=1e-6):
    require(material in MATERIALS, "GaN, AlN and SiC are supported")
    require(not output.exists() and not output.is_symlink(), "Output directory must not exist")
    require(source_file.is_file() and source_file.stat().st_size <= 4_000_000,
            "Independent reference must be a real local source file")
    require(20 <= ecutwfc <= 180 and 4 <= ecutrho_ratio <= 12 and
            2 <= k_base < k_refined <= 16, "Invalid bounded convergence settings")
    require(finite(max_energy_delta, .01, 20) and
            finite(max_scf_accuracy, 1e-12, 1e-4),
            "Preregistered energy and SCF thresholds required")
    meta = MATERIALS[material]
    matrix, sites, path = geometry(material, a or meta["a"], c if c is not None else meta["c"],
                                    u if u is not None else meta["u"])
    files={}
    for element in meta["elements"]:
        pp = pseudo_dir / (element+".UPF")
        expected = hashes[element]
        require(pp.is_file() and pp.stat().st_size <= 8_000_000 and
                SHA.fullmatch(expected) and sha(pp) == expected,
                "UPF bytes do not match pinned digest for "+element)
        header = pp.read_bytes()[:10000]
        require(b"<UPF" in header and b"PP_HEADER" in header and
                re.search(rb'element\s*=\s*["\']'+element.encode()+rb'["\']',header),
                "UPF header does not name "+element)
        files[element]=pp
    output.mkdir(parents=True,mode=0o700)
    (output/"input").mkdir()
    for element,path0 in files.items():
        shutil.copyfile(path0,output/"input"/(element+".UPF"))
        require(sha(output/"input"/(element+".UPF")) == hashes[element],
                "UPF changed during staging")
    shutil.copyfile(source_file,output/"input"/"structure-reference.dat")
    require(sha(output/"input"/"structure-reference.dat") == sha(source_file),
            "Structure source changed during staging")

    def fmt(value):
        return f"{value:.10f}" if isinstance(value,float) else str(value)

    cell="\n".join("  "+" ".join(fmt(x) for x in row) for row in matrix)
    positions="\n".join("  "+name+" "+" ".join(fmt(x) for x in (x,y,z))
                        for name,x,y,z in sites)
    species="\n".join("  "+name+" "+fmt(mass)+" "+name+".UPF"
                      for name,mass in zip(meta["elements"],meta["mass"]))

    def input_text(stage,cutoff,mesh):
        calc = "bands" if stage=="bands" else "scf"
        kpoints = (f"K_POINTS automatic\n{mesh} {mesh} {mesh} 0 0 0\n"
                   if stage!="bands" else
                   "K_POINTS crystal_b\n"+str(len(path))+"\n"+
                   "\n".join(" ".join(fmt(x) for x in v)+(" 12" if i<len(path)-1 else " 1")
                             for i,v in enumerate(path))+"\n")
        return ("&CONTROL\n"
                " calculation='"+calc+"', prefix='bulk',\n"
                " pseudo_dir='./pseudo', outdir='./scratch',\n"
                " tprnfor=.true.,\n"
                "/\n"
                "&SYSTEM\n"
                f" ibrav=0, nat={len(sites)}, ntyp=2,\n"
                f" ecutwfc={cutoff}, ecutrho={int(cutoff*ecutrho_ratio)},\n"
                " input_dft='PBE', occupations='fixed', nbnd=48,\n"
                "/\n"
                "&ELECTRONS\n"
                " conv_thr=1.0d-9, mixing_beta=0.3,\n"
                "/\n"
                "ATOMIC_SPECIES\n"+species+"\n"
                "CELL_PARAMETERS angstrom\n"+cell+"\n"
                "ATOMIC_POSITIONS crystal\n"+positions+"\n"+kpoints)

    params=[("baseline",ecutwfc,k_base),
            ("ecut-refined",int(math.ceil(ecutwfc*1.25)),k_base),
            ("k-refined",ecutwfc,k_refined),("bands",ecutwfc,None)]
    runs={}
    for stage,cutoff,mesh in params:
        rel="input/"+stage+".in"
        filename=output/rel
        filename.write_text(input_text(stage,cutoff,mesh),encoding="utf8")
        runs[stage]={"input":{"path":rel,"sha256":sha(filename)}}
    plan={
        "schema":"kristalyapi.qe-bulk-run-plan.v1","material":material,
        "polytype_claim":meta["polytype"]+"; operator-selected, not independently verified",
        "structure_reference":{"path":"input/structure-reference.dat",
                               "sha256":sha(output/"input"/"structure-reference.dat")},
        "pseudopotentials":{el:{"path":"input/"+el+".UPF","sha256":hashes[el]}
                            for el in meta["elements"]},
        "criteria":{"max_energy_delta_mev_per_atom":max_energy_delta,
                    "max_scf_accuracy_ry":max_scf_accuracy},
        "runs":runs}
    (output/"run-plan.json").write_text(json.dumps(plan,indent=2)+"\n",encoding="utf8")
    provenance={"schema":"kristalyapi.bulk-protocol-provenance.v1",
        "material":material,"source_sha256":plan["structure_reference"]["sha256"],
        "lattice_angstrom":matrix,"fractional_sites":sites,
        "source_semantically_checked":False,
        "polytype_independently_verified":False,
        "band_path_symmetry_certified":False,
        "upf_digests_checked":True,
        "pseudopotential_functional_certified":False,
        "generated_not_executed":True,
        "scientific_acceptance":False,
        "warning":"These structural parameters are unverified candidates; no independent CIF or physical relaxation comparison is performed."}
    (output/"protocol-provenance.json").write_text(json.dumps(provenance,indent=2)+"\n",encoding="utf8")
    return plan


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--material",choices=tuple(MATERIALS),required=True)
    parser.add_argument("--source-file",type=Path,required=True)
    parser.add_argument("--pseudo-dir",type=Path,required=True)
    parser.add_argument("--output-dir",type=Path,required=True)
    for el in ("ga","al","n","si","c"):
        parser.add_argument("--"+el+"-sha256",default=None)
    parser.add_argument("--a",type=float)
    parser.add_argument("--c-axis",type=float)
    parser.add_argument("--u",type=float)
    parser.add_argument("--ecutwfc",type=int,default=60)
    parser.add_argument("--ecutrho-ratio",type=int,default=8)
    parser.add_argument("--k-base",type=int,default=4)
    parser.add_argument("--k-refined",type=int,default=6)
    args=parser.parse_args()
    digests={el:vars(args)[el.lower()+"_sha256"]
             for el in MATERIALS[args.material]["elements"]}
    build(args.material,args.source_file,args.pseudo_dir,args.output_dir,digests,
          a=args.a,c=args.c_axis,u=args.u,ecutwfc=args.ecutwfc,
          ecutrho_ratio=args.ecutrho_ratio,k_base=args.k_base,k_refined=args.k_refined)


if __name__=="__main__":
    main()
