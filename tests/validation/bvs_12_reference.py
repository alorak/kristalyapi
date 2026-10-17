#!/usr/bin/env python3
"""P12: independent ASE periodic-image and bond-valence reference gate.

The source R0/B pairs are selected rows from the IUCr's 2020 CIF dataset.
ASE independently enumerates every real-space periodic image; neither the
browser's image search nor its bond-valence loop is used as an oracle.
Idealized NaCl/MgO/SrTiO3 are analytical structures, NOT experimental data.
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from ase import Atoms
from ase.neighborlist import neighbor_list

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "validation-results/bvs-12-ase-ion-pairs.json"
BRIDGE = ROOT / "tests/validation/bvs-p12-bridge.cjs"
SOURCE = "https://www.iucr.org/__data/assets/file/0011/150779/bvparm2020.cif"

# Literal, independently curated row values from the IUCr 2020 CIF. The
# final column is the source's literature reference ID; b is per pair.
PAIRS = {
    "Na1-Cl": (2.150, .37, "b"), "Na1-O": (1.803, .37, "a"),
    "K1-O": (2.132, .37, "a"), "K1-Cl": (2.519, .37, "a"),
    "Mg2-O": (1.693, .37, "a"), "Ca2-O": (1.967, .37, "a"),
    "Sr2-O": (2.118, .37, "a"), "Ba2-O": (2.285, .37, "a"),
    "Ti3-O": (1.791, .37, "b"), "Ti4-O": (1.815, .37, "a"),
    "Fe2-O": (1.734, .37, "a"), "Fe3-O": (1.759, .37, "a"),
    "Mn2-O": (1.790, .37, "a"), "Mn3-O": (1.760, .37, "a"),
    "Mn4-O": (1.753, .37, "a"), "Zn2-O": (1.704, .37, "a"),
    "Cu2-O": (1.679, .36, "bj"), "Si4-O": (1.624, .37, "b"),
    "Al3-O": (1.651, .37, "a"),
}


def cubic(a: float) -> dict:
    return {"a": a, "b": a, "c": a, "alpha": 90, "beta": 90, "gamma": 90}


def site(symbol: str, x: float, y: float, z: float, occupancy: float = 1) -> dict:
    return {"symbol": symbol, "x": x, "y": y, "z": z, "occupancy": occupancy}


FCC = [[0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0]]


def rocksalt(cation: str) -> list[dict]:
    return [site(cation, *v) for v in FCC] + [
        site("Cl" if cation == "Na" else "O", *((n + .5) % 1 for n in v))
        for v in FCC]


def cases() -> list[dict]:
    p = [site("Sr", 0, 0, 0), site("Ti", .5, .5, .5),
         site("O", .5, .5, 0), site("O", .5, 0, .5), site("O", 0, .5, .5)]
    skew = {"a": 3, "b": math.hypot(2.85, .3), "c": 4,
            "alpha": 90, "beta": 90, "gamma": math.degrees(math.atan2(.3, 2.85))}
    mixed = [site("Na", 0, 0, 0, .5), site("K", 0, 0, 0, .5),
             site("Cl", .5, 0, 0, .6), site("O", .5, 0, 0, .4)]
    return [
        {"label": "NaCl-6", "sites": rocksalt("Na"), "centerIndex": 0,
         "cell": cubic(5.64), "pair": "Na1-Cl", "cutoff": 3.5, "periodic": True},
        {"label": "MgO-6", "sites": rocksalt("Mg"), "centerIndex": 0,
         "cell": cubic(4.212), "pair": "Mg2-O", "cutoff": 3.1, "periodic": True},
        {"label": "SrTiO3-Ti-6", "sites": p, "centerIndex": 1,
         "cell": cubic(3.905), "pair": "Ti4-O", "cutoff": 3.15, "periodic": True},
        {"label": "SrTiO3-Sr-12", "sites": p, "centerIndex": 0,
         "cell": cubic(3.905), "pair": "Sr2-O", "cutoff": 3.15, "periodic": True},
        {"label": "acute-triclinic-long-image", "sites": [site("Na", 0, 0, 0),
             site("Cl", .25, 0, 0, .7)], "centerIndex": 0,
         "cell": skew, "pair": "Na1-Cl", "cutoff": 1.4, "periodic": True},
        {"label": "exclusive-mixed-sites", "sites": mixed, "centerIndex": 0,
         "cell": cubic(5.64), "pair": "Na1-Cl", "cutoff": 3, "periodic": True},
        {"label": "molecule-no-periodic-ghosts", "sites": [site("Na", .1, .5, .5),
             site("Cl", .9, .5, .5)], "centerIndex": 0,
         "cell": cubic(6), "pair": "Na1-Cl", "cutoff": 3.5, "periodic": False},
        {"label": "Cu2-O-variable-B", "sites": [site("Cu", 0, 0, 0),
             site("O", 1.95 / 12, 0, 0)], "centerIndex": 0,
         "cell": cubic(12), "pair": "Cu2-O", "cutoff": 3, "periodic": False},
        {"label": "K1-O-cutoff-warning", "sites": [site("K", 0, 0, 0),
             site("O", 2.9 / 12, 0, 0)], "centerIndex": 0,
         "cell": cubic(12), "pair": "K1-O", "cutoff": 3, "periodic": False},
    ]


def lattice(cell: dict) -> np.ndarray:
    a, b, c = (cell[k] for k in "abc")
    alpha, beta, gamma = (math.radians(cell[k]) for k in ("alpha", "beta", "gamma"))
    row_b = np.array([b * math.cos(gamma), b * math.sin(gamma), 0.0])
    z = (math.cos(alpha) - math.cos(beta) * math.cos(gamma)) / math.sin(gamma)
    return np.array([[a, 0, 0], row_b,
                     [c * math.cos(beta), c * z,
                      c * math.sqrt(max(0, 1 - math.cos(beta)**2 - z**2))]])


def independent_neighbors(case: dict, pair: dict) -> list[dict]:
    entries = case["sites"]
    atoms = Atoms([s["symbol"] for s in entries],
                  scaled_positions=[[s["x"], s["y"], s["z"]] for s in entries],
                  cell=lattice(case["cell"]), pbc=case["periodic"])
    i, j, distances, shifts = neighbor_list("ijdS", atoms, case["cutoff"],
                                            self_interaction=False)
    center = case["centerIndex"]
    expected = []
    for src, target, d, shift in zip(i, j, distances, shifts):
        if src != center or entries[target]["symbol"] != pair["anion"]:
            continue
        occ = entries[target]["occupancy"]
        if occ <= 0 or d < 1e-6 or d > case["cutoff"] + 1e-8:
            continue
        expected.append({"index": int(target), "shift": tuple(int(v) for v in shift),
                         "distance": float(d),
                         "contribution": occ * math.exp((pair["r0"] - d) / pair["b"]),
                         "occupancy": occ})
    return sorted(expected, key=lambda n: (n["index"], n["shift"]))


def validate_one(case: dict, result: dict, parameter: dict) -> dict:
    expected = independent_neighbors(case, parameter)
    actual = sorted(result["neighbors"], key=lambda n: (n["index"], tuple(n["shift"])))
    assert len(actual) == len(expected), f"{case['label']}: image CN {len(actual)} vs {len(expected)}"
    max_distance_error = 0.0
    max_valence_error = 0.0
    for a, e in zip(actual, expected):
        assert a["index"] == e["index"] and tuple(a["shift"]) == e["shift"], (
            f"{case['label']}: wrong image {a} vs {e}")
        max_distance_error = max(max_distance_error, abs(a["distance"] - e["distance"]))
        max_valence_error = max(max_valence_error, abs(a["contribution"] - e["contribution"]))
        assert abs(a["distance"] - e["distance"]) < 1e-7
        assert abs(a["contribution"] - e["contribution"]) < 1e-7
    expected_sum = math.fsum(n["contribution"] for n in expected)
    expected_weight = math.fsum(n["occupancy"] for n in expected)
    assert abs(result["sum"] - expected_sum) < 1e-7
    assert abs(result["weightedCount"] - expected_weight) < 1e-7
    assert abs(result["valenceResidual"] -
               (expected_sum - result["referenceCharge"])) < 1e-7
    if case["label"] == "acute-triclinic-long-image":
        assert any(max(abs(v) for v in n["shift"]) > 2 for n in expected)
        assert any("belirgin fark" in message for message in result["warnings"]), (
            "Physically implausible skew-cell BVS must be flagged, not accepted as chemistry")
    if case["label"] == "exclusive-mixed-sites":
        assert result["mixedLigandSites"] == 1 and result["centerOccupancy"] == .5
        assert len(result["warnings"]) >= 2
    if case["label"] == "K1-O-cutoff-warning":
        assert result["nearCutoffContribution"] > 0 and result["warnings"]
    if case["label"] == "molecule-no-periodic-ghosts":
        assert not actual and not result["periodic"]
    if case["label"] in ("NaCl-6", "MgO-6", "SrTiO3-Ti-6", "SrTiO3-Sr-12"):
        expected_cn = 12 if case["label"].endswith("Sr-12") else 6
        assert len(expected) == expected_cn
        assert abs(expected_sum - result["referenceCharge"]) < .25, (
            f"{case['label']} ideal model BVS implausible: {expected_sum}")
    return {"case": case["label"], "status": "pass", "images": len(expected),
            "occupancyWeightedCN": expected_weight, "aseBondValenceSum": expected_sum,
            "browserBondValenceSum": result["sum"], "maxDistanceErrorA": max_distance_error,
            "maxBondValenceError": max_valence_error,
            "referenceCharge": result["referenceCharge"],
            "interpretationWarnings": result["warnings"],
            "notExperimental": True}


def main() -> int:
    report = {"protocol": "p12-ase-independent-neighbor-images-and-iucr-r0-b",
              "parameterSource": SOURCE,
              "reference": "ASE 3.26.0 periodic neighbor_list; IUCr bvparm2020 curated rows",
              "vestaExecuted": False,
              "limitations": "Ideal structures are analytical demonstrations, not independent experimental density or VESTA GUI results; partial occupancy is an ensemble estimate.",
              "cases": [], "failures": []}
    try:
        work_cases = cases()
        with tempfile.TemporaryDirectory(prefix="kristal-p12-bvs-") as directory:
            source = Path(directory) / "cases.json"
            source.write_text(json.dumps({"cases": work_cases}))
            proc = subprocess.run(["node", str(BRIDGE), str(source)], cwd=ROOT,
                                  text=True, capture_output=True)
            if proc.returncode:
                raise AssertionError(f"Production browser BVS bridge: {proc.stderr}")
            payload = json.loads(proc.stdout)
        assert len(payload["parameters"]) == len(PAIRS)
        for p in payload["parameters"]:
            assert (p["r0"], p["b"], p["ref"]) == PAIRS[p["key"]], (
                f"IUCr 2020 parameter drift: {p['key']}")
        pairs = {p["key"]: p for p in payload["parameters"]}
        assert len(payload["cases"]) == len(work_cases)
        for c, actual in zip(work_cases, payload["cases"]):
            result = validate_one(c, actual, pairs[c["pair"]])
            report["cases"].append(result)
            print(f"PASS {c['label']}: {result['images']} ASE images, "
                  f"BVS {result['aseBondValenceSum']:.5f}, max ΔÅ {result['maxDistanceErrorA']:.2g}")
    except Exception as exc:
        report["failures"].append(str(exc))
        print(f"FAIL P12 BVS reference: {exc}", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
