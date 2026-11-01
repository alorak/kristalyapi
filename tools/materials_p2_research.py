#!/usr/bin/env python3
"""P2 research postprocessing: bounded numerical models, NOT physical validation.

All values are supplied by an operator; none are inferred from a crystal visual.
Results never certify real materials, defects, thermal conductivity or device performance.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

SCHEMA = "kristalyapi.materials-research-input.v1"
MODES = ("defect-formation", "phonon-screen", "interface-screen", "surrogate-calibration")


def check(ok, message):
    if not ok:
        raise ValueError(message)


def number(value, name, low=None, high=None):
    check(type(value) in (int, float) and math.isfinite(value), "Nonfinite "+name)
    if low is not None:
        check(value >= low, name+" below minimum")
    if high is not None:
        check(value <= high, name+" above maximum")
    return float(value)


def provenance(value):
    check(isinstance(value, dict), "Source evidence descriptor is required")
    kind = value.get("kind")
    digest = value.get("sha256")
    check(kind in ("synthetic", "operator-supplied-qe", "operator-supplied-experiment"),
          "Unknown evidence source")
    check(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest),
          "Source evidence SHA-256 is required")
    check(isinstance(value.get("reference"), str) and 0 < len(value["reference"]) <= 200,
          "Source reference is required")
    return {"kind":kind, "sha256_claim":digest, "reference_claim":value["reference"],
            "source_bytes_reverified":False, "source_independently_authenticated":False}


def defect_formation(input_):
    """E_f(D^q)=E_def^q-E_bulk-Σn_i μ_i+q(E_F+E_VBM+ΔV)+E_corr."""
    for field in ("defect_energy_ev", "bulk_energy_ev", "fermi_relative_ev",
                  "vbm_ev", "potential_alignment_ev", "finite_size_correction_ev"):
        number(input_.get(field),field)
    charge = input_.get("charge")
    check(type(charge) is int and -8 <= charge <= 8, "Charge must be integer in [-8,8]")
    atoms, chemical = input_.get("delta_atoms"), input_.get("chemical_potentials_ev")
    check(isinstance(atoms, dict) and 1 <= len(atoms) <= 8 and
          isinstance(chemical, dict) and set(atoms) == set(chemical),
          "Chemical potentials must accompany each changed atomic species")
    check(all(re.fullmatch(r"[A-Z][a-z]?",s) for s in atoms),
          "Invalid element identity")
    check(all(type(n) is int and -100 <= n <= 100 for n in atoms.values()),
          "Invalid atomic difference coefficients")
    potential = sum(n*number(chemical[element], "chemical potential") for element,n in atoms.items())
    correction = input_["finite_size_correction_ev"]
    alignment = input_["potential_alignment_ev"]
    if charge != 0:
        check(isinstance(input_.get("correction_method"), str)
              and len(input_["correction_method"].strip()) >= 3,
              "Charged defects require a documented finite-size correction")
        check(isinstance(input_.get("dielectric_reference"), str)
              and len(input_["dielectric_reference"].strip()) >= 3,
              "Charged defects require a dielectric source reference")
    else:
        check(correction == 0 and alignment == 0,
              "Neutral defects should not include charged-defect correction terms")
    fermi = input_["fermi_relative_ev"]
    formation = (input_["defect_energy_ev"]-input_["bulk_energy_ev"]-potential+
                 charge*(fermi+input_["vbm_ev"]+alignment)+correction)
    return {"formation_energy_ev":formation,"chemical_potential_term_ev":-potential,
            "charge_fermi_vbm_alignment_term_ev":charge*(fermi+input_["vbm_ev"]+alignment),
            "finite_size_correction_ev":correction,
            "charge":charge,
            "limits":["No reference to defect charge transition levels or formation chemistry has been checked.",
                      "No dielectric correction was calculated; correction energies are operator supplied.",
                      "Phase stability, chemical potential constraints and charge neutrality are not assessed."]}


def phonon_screen(data):
    freqs = data.get("frequencies_thz")
    check(isinstance(freqs, list) and 1 <= len(freqs) <= 100000,
          "Expected a bounded phonon mode list in THz")
    tol=number(data.get("imaginary_tolerance_thz",.1),"imaginary tolerance",0,.5)
    values=[number(x,"phonon frequency",-1000,1000) for x in freqs]
    unstable=[i for i,x in enumerate(values) if x < -tol]
    return {"mode_count":len(values), "minimum_frequency_thz":min(values),
            "modes_below_negative_tolerance":unstable,
            "negative_mode_screen_passed":not unstable,
            "limits":["Imaginary modes need q-space, method and sampling review.",
                      "A stable frequency screen does not establish dynamical stability everywhere in the Brillouin zone.",
                      "Phonon frequencies alone do not determine thermal conductivity or thermomechanical reliability."]}


def interface_screen(data):
    a, b=data.get("material_a_inplane_angstrom"),data.get("material_b_inplane_angstrom")
    for matrix in (a,b):
        check(isinstance(matrix,list) and len(matrix)==2 and
              all(isinstance(v,list) and len(v)==2 for v in matrix),
              "Expected two in-plane 2D vectors per candidate")
    A=[[number(v,"in-plane basis") for v in row] for row in a]
    B=[[number(v,"in-plane basis") for v in row] for row in b]
    determinant=A[0][0]*A[1][1]-A[0][1]*A[1][0]
    check(abs(determinant)>1e-6, "Degenerate interface lattice")
    lengths=lambda rows:[math.hypot(*v) for v in rows]
    la,lb=lengths(A),lengths(B)
    check(all(x>0 for x in la+lb), "Zero-length interface vector")
    mismatch=[100*(lb[i]/la[i]-1) for i in range(2)]
    cosine=lambda rows:sum(x*y for x,y in zip(rows[0],rows[1]))/math.prod(lengths(rows))
    theta=lambda rows:math.degrees(math.acos(max(-1,min(1,cosine(rows)))))
    angle_difference=theta(B)-theta(A)
    return {"individual_vector_length_mismatch_percent":mismatch,
            "inplane_angle_difference_deg":angle_difference,
            "max_absolute_mismatch_percent":max(abs(x) for x in mismatch),
            "limits":["Direct basis-vector screen only: not a minimum-strain supercell search.",
                      "Twist angle, atom registry, interface chemistry, strain energy and adhesion are not determined.",
                      "This screen is not an epitaxial feasibility or fabrication acceptance result."]}


def surrogate_calibration(data):
    """Absolute-residual split conformal interval, finite-sample rank formula.
    Requires independent held-out calibration, and an exchangeable population.
    """
    observed,predicted,targets=(data.get(k) for k in
                                ("calibration_observed","calibration_predicted","candidate_predictions"))
    check(all(isinstance(x,list) for x in (observed,predicted,targets)) and
          10 <= len(observed) <= 100000 and len(predicted)==len(observed) and
          1 <= len(targets) <= 1000, "Invalid independent calibration arrays")
    alpha=number(data.get("alpha",.1),"miscoverage alpha",.001,.5)
    values=[number(x,"observed") for x in observed]
    forecasts=[number(x,"prediction") for x in predicted]
    proposals=[number(x,"candidate prediction") for x in targets]
    ordered=sorted(abs(x-y) for x,y in zip(values,forecasts))
    rank=math.ceil((len(ordered)+1)*(1-alpha))
    radius=ordered[rank-1] if rank<=len(ordered) else None
    intervals=([{"lower":pred-radius,"upper":pred+radius} for pred in proposals]
               if radius is not None else None)
    return {"calibration_size":len(ordered),"alpha":alpha,"quantile_rank":rank,
            "absolute_residual_radius":radius,"prediction_intervals":intervals,
            "finite_interval_available":radius is not None,
            "limits":["Unverified hold-out independence and exchangeability: coverage is not established.",
                      "Intervals describe a target property in the unit of the supplied observations, not a device decision.",
                      "No uncertainty, measured prediction error or coverage is inferred without real independent test data."]}


OPERATIONS={"defect-formation":defect_formation,"phonon-screen":phonon_screen,
            "interface-screen":interface_screen,"surrogate-calibration":surrogate_calibration}


def evaluate(data):
    check(isinstance(data,dict) and data.get("schema")==SCHEMA,"Invalid P2 request schema")
    mode=data.get("mode")
    check(mode in MODES,"Unsupported research mode")
    source=provenance(data.get("source"))
    result=OPERATIONS[mode](data.get("parameters",{}))
    return {"schema":"kristalyapi.materials-research-output.v1","mode":mode,
            "source":source,"derived":result,"scientific_acceptance":False,
            "status":"numeric-prototype-requires-independent-evidence",
            "note":"This output is not independently validated physics and cannot certify a material."}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",required=True,type=Path)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    file=args.input.resolve()
    check(file.is_file() and file.stat().st_size<=1_500_000,"Invalid or oversized P2 input JSON")
    input_=json.loads(file.read_text(encoding="utf-8"))
    result=evaluate(input_)
    result["input_sha256"]=hashlib.sha256(file.read_bytes()).hexdigest()
    encoded=json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+"\n"
    if args.output:
        check(args.output.resolve()!=file,"Do not overwrite the input")
        args.output.write_text(encoded,encoding="utf-8")
    else:
        print(encoded,end="")


if __name__=="__main__":
    main()
