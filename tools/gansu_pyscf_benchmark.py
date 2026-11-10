#!/usr/bin/env python3
"""P0.3: independently compute PySCF references for pinned GANSU browser SCF.

NO lookup tables or fabricated energies. Both solvers use identical
molecular coordinates, electron count, STO-3G and nominated XC functional.
Differences are recorded in Hartree and milli-Hartree. A preregistered
20 mHa exploratory acceptance limit is intentionally *not* a chemical-
accuracy claim; tighter functional/grid validation is separate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "kristalyapi.gansu-pyscf-p03-comparison.v1"
PYSCF_VERSION = "2.15.0"
XC = {"PBE": "PBE", "SVWN": "LDA,VWN"}


def parse_xyz(xyz: str):
    lines = xyz.strip().splitlines()
    if len(lines) < 3:
        raise ValueError("XYZ needs a count, comment and atom rows")
    try:
        count = int(lines[0])
    except ValueError as exc:
        raise ValueError("Invalid atom count") from exc
    if count < 1 or count > 12 or len(lines) != count + 2:
        raise ValueError("Unsupported XYZ count")
    atoms = []
    for line in lines[2:]:
        parts = line.split()
        if len(parts) != 4:
            raise ValueError("Bad XYZ atom row")
        atom = parts[0]
        if atom not in {"H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Si"}:
            raise ValueError("Unsupported atomic number")
        pos = tuple(float(x) for x in parts[1:])
        if not all(math.isfinite(x) for x in pos):
            raise ValueError("Non-finite atom position")
        atoms.append((atom, pos))
    return atoms


def validate_fixture(fixture):
    if fixture.get("schema") != "kristalyapi.gansu-pyscf-p03-fixtures.v1":
        raise ValueError("Unknown P0.3 fixture schema")
    if fixture.get("basis") != "sto-3g" or fixture.get("pyscfVersion") != PYSCF_VERSION:
        raise ValueError("PySCF version or basis drifted")
    limit = fixture.get("validationLimitHartree")
    if not isinstance(limit, (float, int)) or not 0 < limit <= 0.02:
        raise ValueError("Acceptance criterion must not be broadened")
    ids = set()
    for case in fixture["cases"]:
        if case["id"] in ids:
            raise ValueError("Duplicate case id")
        ids.add(case["id"])
        if case["functional"] not in XC:
            raise ValueError("Unsupported XC function")
        if case["grid"] != "medium":
            raise ValueError("P0.3 references require medium GANSU grid")
        atoms = parse_xyz(case["xyz"])
        if not isinstance(case["charge"], int) or not isinstance(case["multiplicity"], int):
            raise ValueError("Charge and spin must be integer")
        if not atoms:
            raise ValueError("Empty molecule")
    if "sih4-pbe" not in ids or "sih4-svwn" not in ids:
        raise ValueError("P0.3 must include both silicon functional cases")
    return limit


def compare_results(fixture, gansu, references):
    """Pure Python verifier, independent of the PySCF package."""
    limit = validate_fixture(fixture)
    if gansu.get("schema") != "kristalyapi.gansu-p03-browser-results.v1":
        raise ValueError("Browser SCF provenance schema missing")
    if gansu.get("upstreamCommit") != fixture["upstreamGansuCommit"]:
        raise ValueError("GANSU upstream code version mismatch")
    runs = gansu.get("cases")
    if not isinstance(runs, dict) or set(runs) != {c["id"] for c in fixture["cases"]}:
        raise ValueError("GANSU results must cover precisely the preregistered cases")
    if set(references) != set(runs):
        raise ValueError("Independent PySCF results must cover identical cases")
    rows = []
    for case in fixture["cases"]:
        key = case["id"]
        g = runs[key]
        p = references[key]
        for field, expected in (
            ("functional", case["functional"]),
            ("grid", case["grid"]),
            ("charge", case["charge"]),
            ("multiplicity", case["multiplicity"]),
            ("basis", "STO-3G"),
            ("backend", "WASM"),
        ):
            if g.get(field) != expected:
                raise ValueError(f"{key}: GANSU provenance mismatch: {field}")
        if g.get("upstreamCommit") != fixture["upstreamGansuCommit"]:
            raise ValueError(f"{key}: GANSU hash differs")
        if g.get("atoms") != [a[0] for a in parse_xyz(case["xyz"])]:
            raise ValueError(f"{key}: atom identities or order differ")
        if not p.get("converged"):
            raise ValueError(f"{key}: PySCF did not converge")
        e_g = g.get("energyHartree")
        e_p = p.get("energyHartree")
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in (e_g, e_p)):
            raise ValueError(f"{key}: non-finite energies")
        delta = e_g-e_p
        rows.append({
            "id": key,
            "molecule": case["label"],
            "functional": case["functional"],
            "pyscfXC": p["xc"],
            "gansuHartree": e_g,
            "pyscfHartree": e_p,
            "signedDifferenceMilliHartree": delta*1000,
            "absoluteDifferenceMilliHartree": abs(delta)*1000,
            "pass": abs(delta) <= limit,
            "toleranceMilliHartree": limit*1000,
            "gansuIterations": g.get("iterations"),
            "pyscfIterations": p.get("cycles"),
        })
    return rows


def independent_pyscf(case):
    from pyscf import __version__ as version, gto, dft, lib

    if version != PYSCF_VERSION:
        raise RuntimeError(f"PySCF version drift: expected {PYSCF_VERSION}, got {version}")
    lib.num_threads(2)
    atoms = parse_xyz(case["xyz"])
    mol = gto.M(atom=atoms, basis="sto-3g", charge=case["charge"],
                spin=case["multiplicity"]-1, unit="Angstrom", verbose=0)
    method = dft.UKS(mol) if mol.spin else dft.RKS(mol)
    method.xc = XC[case["functional"]]
    method.grids.level = 3
    method.conv_tol = 1e-9
    method.max_cycle = 100
    energy = float(method.kernel())
    if not math.isfinite(energy):
        raise RuntimeError("PySCF yielded non-finite energy")
    return {
        "energyHartree": energy,
        "converged": bool(method.converged),
        "xc": method.xc,
        "grid": "PySCF level=3 / LibXC (not identical to GANSU medium grid)",
        "basis": "STO-3G",
        "method": "UKS" if mol.spin else "RKS",
        "electronCount": int(mol.nelectron),
        "cycles": int(getattr(method, "cycles", 0)),
        "pyscfVersion": version,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", default="tests/fixtures/gansu/p03-molecules.json")
    parser.add_argument("--gansu", required=True, help="Real Chromium results JSON")
    parser.add_argument("--out", required=True, help="Comparison JSON report")
    args = parser.parse_args()

    fixture_bytes = Path(args.fixtures).read_bytes()
    fixture = json.loads(fixture_bytes)
    validate_fixture(fixture)
    gansu = json.loads(Path(args.gansu).read_text(encoding="utf-8"))
    refs = {case["id"]: independent_pyscf(case) for case in fixture["cases"]}
    rows = compare_results(fixture, gansu, refs)
    report = {
        "schema": SCHEMA,
        "scientificScope": "finite molecular KS-DFT; no crystalline silicon bands",
        "reference": "PySCF 2.15.0 + LibXC, STO-3G, grid level 3",
        "gansuUpstreamCommit": fixture["upstreamGansuCommit"],
        "fixtureSha256": hashlib.sha256(fixture_bytes).hexdigest(),
        "energyLimitHartree": fixture["validationLimitHartree"],
        "warning": "20 mHa is a preliminary numerical agreement gate, not chemical accuracy; XC recipes and grids differ",
        "passed": all(row["pass"] for row in rows),
        "cases": rows,
        "pyscfReferences": refs,
    }
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    for row in rows:
        print(f"{row['id']:<15} GANSU {row['gansuHartree']:>17.9f} Ha"
              f"  PySCF {row['pyscfHartree']:>17.9f} Ha"
              f"  |Δ|={row['absoluteDifferenceMilliHartree']:>10.5f} mHa"
              f"  {'PASS' if row['pass'] else 'FAIL'}")
    if not report["passed"]:
        raise SystemExit("P0.3 PySCF acceptance gate FAILED; see JSON, do not claim parity")


if __name__ == "__main__":
    main()
