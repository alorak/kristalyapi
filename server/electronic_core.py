"""D4 strictly structured 2D band/DOS/PDOS jobs; no raw inputs or paths."""
import copy
import re

from job_core import ALLOWED_TOP, canonical_request, num

SCHEMA="kristalyapi.qe-electronic-job.v1"


def scf_request(data):
    result={key:copy.deepcopy(data[key]) for key in ALLOWED_TOP}
    result["schema"]="kristalyapi.qe-scf-job.v1"
    result["parameters"]["calculation"]="scf"
    return canonical_request(result)


def canonical_electronic_request(data):
    if set(data)!=ALLOWED_TOP|{"electronic"}:
        raise ValueError("Electronic jobs require exact structured fields")
    if not isinstance(data["parameters"],dict) or data["parameters"].get("calculation")!="electronic":
        raise ValueError("Invalid electronic calculation type")
    settings=data["electronic"]
    if not isinstance(settings,dict) or set(settings)!={"nbnd","nscf_k","band_path"}:
        raise ValueError("Expected explicit bands, dense mesh and band path")
    nbnd,mesh=settings["nbnd"],settings["nscf_k"]
    if type(nbnd) is not int or not 1<=nbnd<=128 or type(mesh) is not int or not 2<=mesh<=24:
        raise ValueError("nbnd must be 1-128 and dense 2D k mesh 2-24")
    path=settings["band_path"]
    if not isinstance(path,list) or not 2<=len(path)<=16:
        raise ValueError("An explicit 2-16 point crystal_b path is required")
    points=[]
    for point in path:
        if not isinstance(point,dict) or set(point)!={"label","k","segments"}:
            raise ValueError("Band point requires label, k and segments")
        if not isinstance(point["label"],str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,15}",point["label"]):
            raise ValueError("Invalid band point label")
        if not isinstance(point["k"],list) or len(point["k"])!=3:
            raise ValueError("Band point requires three reciprocal coordinates")
        k=[num(x,-2,2,"band coordinate") for x in point["k"]]
        n=point["segments"]
        if k[2]!=0 or type(n) is not int or not 1<=n<=100:
            raise ValueError("D4 supports bounded paths in the kz=0 plane")
        points.append({"label":point["label"],"k":k,"segments":n})
    if points[-1]["segments"]!=1 or sum(x["segments"] for x in points)>300:
        raise ValueError("Last path weight must be 1; total segments must not exceed 300")
    result,fingerprint=scf_request(data)
    if result["parameters"]["kpoints"][2]!=1:
        raise ValueError("D4 supports 2D slab meshes with kz=1")
    result["schema"]=SCHEMA;result["parameters"]["calculation"]="electronic"
    result["electronic"]={"nbnd":nbnd,"nscf_k":mesh,"band_path":points}
    return result,fingerprint


def path_text(request):
    return "\n".join(point["label"]+" "+" ".join(f"{x:.12g}" for x in point["k"])+
                     " "+str(point["segments"]) for point in request["electronic"]["band_path"])+"\n"
