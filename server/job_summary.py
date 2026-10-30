"""Read-only, versioned calculation summary, grounded in persisted job evidence.

This is a display contract, not a new physical calculation or integrity proof.
Missing or conflicting evidence is never reconstructed from display data.
"""
from __future__ import annotations

import json
import math
import re

HASH = re.compile(r"^[a-f0-9]{64}$")
RY_TO_EV = 13.605693122994


def _hash(value):
    return value if isinstance(value,str) and HASH.fullmatch(value) else None


def _number(value):
    return value if type(value) in (int,float) and math.isfinite(value) else None


def calculation_summary(row):
    request=json.loads(row["request_json"])
    params=request["parameters"]
    result=json.loads(row["result_json"]) if row["status"]=="completed" and row.get("result_json") else None
    valid=bool(result and result.get("structure_hash")==row["structure_hash"] and
               result.get("job_done") is True and result.get("scf_converged") is True)
    summary={
        "schema":"kristalyapi.calculation-summary.v1",
        "job_id":row["id"],"name":row.get("label") or "",
        "status":row["status"],"created":row["created"],"updated":row["updated"],
        "structure_hash":row["structure_hash"],"profile_id":row["profile_id"],
        "resource_profile_sha256":_hash(row.get("resource_profile_sha256")),
        "request":{
            "schema":request["schema"],"calculation":params["calculation"],
            "functional":params["functional"],"spin":params["spin"],
            "ecutwfc_ry":params["ecutwfc_ry"],"ecutrho_ry":params["ecutrho_ry"],
            "kpoints":params["kpoints"],"atom_count":len(request["structure"]["atoms"]),
            "cell_angstrom":request["structure"]["cell_angstrom"],
            **({"relaxation":request["relaxation"]} if "relaxation" in request else {}),
            **({"electronic":request["electronic"]} if "electronic" in request else {})
        },
        "evidence_status":"matched" if valid else "mismatch" if result else "unavailable",
        "result":None,
        "scientific_acceptance":"Not established by a completed job alone"
    }
    if valid:
        pseudo=result.get("pseudopotentials") or {}
        summary["result"]={
            "schema":result.get("schema"),
            "engine":result.get("engine"),"engine_version":result.get("engine_version"),
            "energy_ev":_number(result.get("energy_ev")),
            "energy_ry":_number(result.get("energy_ry")),
            "total_force_ry_bohr":_number(result.get("total_force_ry_bohr")),
            "max_force_component_ry_bohr":_number(result.get("max_force_component_ry_bohr")),
            "job_done":True,"scf_converged":True,
            "geometry_converged":result.get("geometry_converged") is True,
            "input_sha256":_hash(result.get("input_sha256") or row.get("input_sha256")),
            "output_sha256":_hash(result.get("output_sha256") or row.get("output_sha256")),
            "final_structure_hash":_hash(result.get("final_structure_hash")),
            "pseudopotentials":{k:{"file":p.get("file"),"sha256":_hash(p.get("sha256")),
                "functional":p.get("functional"),"license":p.get("license")}
                for k,p in pseudo.items() if isinstance(p,dict)},
            "artifact_sha256":{k:v for k,v in (result.get("artifact_sha256") or {}).items()
                if isinstance(k,str) and len(k)<=100 and _hash(v)},
            "scientific_convergence_study_completed":result.get("scientific_convergence_study_completed") is True
        }
    return summary
