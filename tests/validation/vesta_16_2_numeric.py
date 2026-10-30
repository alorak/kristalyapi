#!/usr/bin/env python3
"""V16.2: source-pinned numerical difference matrix for VESTA vs KristalYapi.

Gemmi supplies independent crystallographic site/ADP references. Real VESTA
and app numbers are NEVER invented: only a separately audited V15 capture
plus operator-transcribed measurements can populate those columns.
Matching numeric results are human-review-required, NOT scientific parity.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import itertools
import json
import math
from pathlib import Path
import re
import sys

import gemmi

from vesta_15_visual import ROOT, audited_capture, pinned_cases
from vesta_16_orientation import (
    cross, dot, lattice_vectors, read_cif_cell, unit,
)
from vesta_15_ccp4_reference import inspect_ccp4

SCHEMA = "kristalyapi.vesta16.2.numeric-evidence.v1"
COMMIT = re.compile(r"[0-9a-f]{40}")
SHA = re.compile(r"[0-9a-f]{64}")
MAX_JSON_BYTES = 2_000_000
MAX_SITES = 256


def read_json(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_JSON_BYTES:
        raise ValueError("JSON evidence is missing, symlinked or oversized")
    result = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(result, dict):
        raise ValueError("Expected JSON object")
    return result


def scalar(key: str, value: float, unit: str, tolerance: float,
           *, kind: str = "scalar", cell: dict | None = None) -> dict:
    if kind == "scalar":
        if type(value) not in (float, int) or not math.isfinite(value):
            raise ValueError("Invalid numerical reference: " + key)
    else:
        if not isinstance(value, list) or len(value) != 3 or any(
            type(n) not in (int, float) or not math.isfinite(n) for n in value
        ):
            raise ValueError("Invalid reference 3-vector: " + key)
    return {"key": key, "kind": kind, "reference": value, "unit": unit,
            "tolerance": tolerance, "cell": cell if kind == "fractional" else None}


def _gemmi_sites(cif: Path) -> list:
    blocks = gemmi.cif.read_file(str(cif))
    structural = [block for block in blocks if block.find_value("_cell_length_a")]
    if len(structural) != 1:
        raise ValueError("Ambiguous CIF structural blocks")
    model = gemmi.make_small_structure_from_block(structural[0])
    sites = list(model.sites)
    if not 0 < len(sites) <= MAX_SITES:
        raise ValueError("Unexpected CIF asymmetric-site count")
    labels = [site.label for site in sites]
    if len(set(labels)) != len(labels):
        raise ValueError("Ambiguous CIF asymmetric-site labels")
    return model, sites


def _nearest_pair(model, species_a: str, species_b: str, maximum: float) -> float:
    """Minimum periodic distance over expanded physical sites (explicit ±1 images).

    Only used for the pinned cubic NaCl and tetragonal rutile systems,
    where ±1 conventional-cell images suffice; not a general skew-cell engine.
    """
    sites = list(model.get_all_unit_cell_sites())
    centers = [s for s in sites if s.element.name == species_a]
    ligands = [s for s in sites if s.element.name == species_b]
    if not centers or not ligands:
        raise ValueError("Expected atom species absent from pinned CIF")
    distances = []
    for center in centers:
        for ligand in ligands:
            for shift in itertools.product((-1, 0, 1), repeat=3):
                diff = gemmi.Fractional(
                    ligand.fract.x + shift[0] - center.fract.x,
                    ligand.fract.y + shift[1] - center.fract.y,
                    ligand.fract.z + shift[2] - center.fract.z,
                )
                orth = model.cell.orthogonalize(diff)
                length = math.sqrt(orth.x ** 2 + orth.y ** 2 + orth.z ** 2)
                if 1e-6 < length < maximum:
                    distances.append(length)
    if not distances:
        raise ValueError("No periodic bond candidate in reference")
    return min(distances)


def _miller(cell: dict, hkl: tuple[int, int, int]) -> tuple[float, list[float]]:
    A, B, C, volume = lattice_vectors(cell)
    astar = [v / volume for v in cross(B, C)]
    bstar = [v / volume for v in cross(C, A)]
    cstar = [v / volume for v in cross(A, B)]
    normal = [sum(hkl[j] * (astar, bstar, cstar)[j][i] for j in range(3))
              for i in range(3)]
    reciprocal_length = math.sqrt(dot(normal, normal))
    if reciprocal_length <= 0:
        raise ValueError("Invalid Miller indices")
    return 1 / reciprocal_length, list(unit(tuple(normal)))


def source_references() -> list[dict]:
    """Real-file, SHA-pinned baseline. No app or VESTA GUI data used."""
    rows = []
    for scene in pinned_cases():
        path = ROOT / scene["source"]
        actual_sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if scene["sourceSha256"] != actual_sha:
            raise ValueError("Source hash changed: " + scene["id"])
        if path.suffix.lower() == ".cif":
            cell = read_cif_cell(path)
            A, B, C, volume = lattice_vectors(cell)
        elif path.suffix.lower() == ".ccp4":
            native = inspect_ccp4(path, scene["settings"]["isoLevel"])
            cell = native["cell"]
            A, B, C, volume = lattice_vectors(cell)
        else:
            raise ValueError("Unexpected pinned V16 source format")
        checks = [scalar("cell.volumeA3", volume, "A^3",
                         max(0.0001, abs(volume) * 0.0001))]
        if path.suffix.lower() == ".cif":
            model, sites = _gemmi_sites(path)
            checks.append(scalar("atom.asymmetricSiteCount", len(sites), "count", 0.0))
            for site in sites:
                key = "atom." + site.label
                checks.append(scalar(key + ".fractional", [
                    site.fract.x, site.fract.y, site.fract.z,
                ], "fractional (error measured in A)", 0.01,
                    kind="fractional", cell=cell))
                checks.append(scalar(key + ".occupancy", site.occ, "fraction", 0.001))
                if site.aniso.nonzero():
                    ueq = model.cell.calculate_u_eq(site.aniso)
                    if math.isfinite(ueq) and ueq > 0:
                        checks.append(scalar("adp." + site.label + ".UeqA2",
                                             ueq, "A^2", 0.002))
                elif math.isfinite(site.u_iso) and site.u_iso > 0:
                    checks.append(scalar("adp." + site.label + ".UeqA2",
                                         site.u_iso, "A^2", 0.002))
            if scene["id"] == "nacl-001-structure":
                checks.append(scalar("bond.nearest.Na-Cl.A",
                                     _nearest_pair(model, "Na", "Cl", 3.5),
                                     "A", 0.03))
            if scene["id"] == "rutile-110-polyhedron":
                checks.append(scalar("bond.nearest.Ti-O.A",
                                     _nearest_pair(model, "Ti", "O", 2.5),
                                     "A", 0.03))
            if scene["id"] == "graphite-001-miller":
                d, normal = _miller(cell, (0, 0, 1))
                checks += [
                    scalar("miller.001.dA", d, "A", 0.001),
                    scalar("miller.001.normal", normal, "unit Cartesian", 0.5,
                           kind="unit-direction"),
                ]
        else:
            checks.append(scalar("volume.isolevelNative",
                                 scene["settings"]["isoLevel"],
                                 "UNKNOWN physical units (native CCP4)", 1e-7))
            checks.append(scalar("volume.voxelsAboveIsolevel",
                                 native["voxelsAboveIsoLevel"], "count", 0.0))
            checks.append(scalar("volume.edgeCrossings",
                                 native["thresholdGridEdgeCrossings"], "count", 0.0))
        rows.append({"id": scene["id"], "kind": scene["kind"],
                     "source": scene["source"], "sourceSha256": actual_sha,
                     "referenceEngine": f"Gemmi {gemmi.__version__} + metric analytical geometry"
                     if path.suffix.lower() == ".cif" else "CCP4 binary header + metric analytical geometry",
                     "references": checks})
    return rows


def error_amount(spec: dict, measured) -> float:
    expected = spec["reference"]
    kind = spec["kind"]
    if kind == "scalar":
        if type(measured) not in (float, int) or not math.isfinite(measured):
            raise ValueError("Expected finite numeric measurement for " + spec["key"])
        return abs(float(measured) - float(expected))
    if not isinstance(measured, list) or len(measured) != 3 or any(
        type(v) not in (float, int) or not math.isfinite(v) for v in measured
    ):
        raise ValueError("Expected three finite coordinates for " + spec["key"])
    if kind == "unit-direction":
        a = unit(tuple(expected))
        b = unit(tuple(measured))
        return math.degrees(math.acos(max(-1., min(1., dot(a, b)))))
    if kind == "fractional":
        # Minimum translated IMAGE difference in real Cartesian Angstrom;
        # never compare fractional axes as orthogonal Euclidean coordinates.
        A, B, C, _ = lattice_vectors(spec["cell"])
        delta = [float(measured[i]) - expected[i] for i in range(3)]
        nearest = [int(round(x)) for x in delta]
        distances = []
        for shift in itertools.product((-1, 0, 1), repeat=3):
            d = [delta[i] - nearest[i] + shift[i] for i in range(3)]
            cart = [A[i] * d[0] + B[i] * d[1] + C[i] * d[2] for i in range(3)]
            distances.append(math.sqrt(dot(cart, cart)))
        return min(distances)
    raise ValueError("Unrecognized reference metric kind")


def _verified_capture(capture_file: Path, baseline: list[dict]) -> tuple[dict, set[str]]:
    """Cross-check V15 source, camera, actual PNG bytes/CRC, dates and ROI.

    This checks user-attested evidence; PNG content cannot prove its origin.
    """
    evidence = read_json(capture_file)
    if evidence.get("vestaVersion") != "3.5.8" or evidence.get("vestaGuiExecuted") is not True:
        raise ValueError("Real VESTA 3.5.8 GUI must be human-attested")
    for field in ("operator", "platform"):
        value = evidence.get(field)
        if not isinstance(value, str) or len(value.strip()) < 4 or value.startswith("REPLACE"):
            raise ValueError("Incomplete capture operator/platform")
    if not COMMIT.fullmatch(str(evidence.get("kristalyapiCommit"))):
        raise ValueError("Invalid capture commit")
    expected = {case["id"]: case for case in pinned_cases()}
    if not isinstance(evidence.get("cases"), list) or not evidence["cases"]:
        raise ValueError("No V15 capture cases")
    seen = set()
    for case in evidence["cases"]:
        cid = case.get("id")
        if cid not in expected or cid in seen:
            raise ValueError("Unknown or duplicate V15 capture case")
        seen.add(cid)
        pinned = expected[cid]
        if case.get("sourceSha256") != pinned["sourceSha256"] or case.get("settings") != pinned["settings"]:
            raise ValueError("V15 capture settings/source mismatch")
        for side in ("vesta", "kristalyapi"):
            audited_capture(capture_file.resolve().parent, case[side],
                            tuple(pinned["settings"]["backgroundRGB"]),
                            pinned["settings"]["outputPixels"])
        if case["vesta"]["roi"] != case["kristalyapi"]["roi"]:
            raise ValueError("V15 image ROI mismatch")
    return evidence, seen


def compare(baseline: list[dict], evidence_file: Path | None = None,
            capture_file: Path | None = None) -> dict:
    actual = {}
    captured = set()
    if evidence_file is not None:
        if capture_file is None:
            raise ValueError("Numerical VESTA evidence requires independently audited V15 PNG capture")
        capture, captured = _verified_capture(capture_file, baseline)
        evidence = read_json(evidence_file)
        if evidence.get("schema") != SCHEMA or evidence.get("vestaVersion") != "3.5.8":
            raise ValueError("Unsupported evidence schema/VESTA version")
        for f in ("operator", "platform", "kristalyapiCommit"):
            if evidence.get(f) != capture.get(f):
                raise ValueError("Numeric evidence provenance differs from V15 PNG capture: " + f)
        if evidence.get("vestaGuiExecuted") is not True:
            raise ValueError("Numeric evidence has no human VESTA GUI attestation")
        if not isinstance(evidence.get("cases"), list) or not evidence["cases"]:
            raise ValueError("Missing numeric evidence cases")
        lookup = {c["id"]: c for c in baseline}
        for item in evidence["cases"]:
            cid = item.get("id")
            if cid not in lookup or cid not in captured or cid in actual:
                raise ValueError("Uncaptured, unknown or duplicate numeric case")
            if item.get("sourceSha256") != lookup[cid]["sourceSha256"]:
                raise ValueError("Numeric evidence source hash differs from pinned CIF/CCP4")
            measurements = item.get("measurements")
            if not isinstance(measurements, list) or not measurements:
                raise ValueError("Missing numeric measurement rows")
            known = {m["key"] for m in lookup[cid]["references"]}
            metrics = {}
            for m in measurements:
                key = m.get("key")
                if key not in known or key in metrics or set(m) != {"key", "vesta", "kristalyapi"}:
                    raise ValueError("Unknown/duplicate/malformed numerical metric")
                metrics[key] = m
            actual[cid] = metrics
    result_cases = []
    counts = {"NOT_RUN": 0, "AWAITING_MEASUREMENT": 0,
              "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED": 0,
              "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED": 0}
    for case in baseline:
        rows = []
        for spec in case["references"]:
            key = spec["key"]
            observation = actual.get(case["id"], {}).get(key)
            status = "NOT_RUN" if case["id"] not in captured else "AWAITING_MEASUREMENT"
            errors = {"vesta": None, "kristalyapi": None}
            values = {"vesta": None, "kristalyapi": None}
            if observation is not None:
                values = {name: observation[name] for name in ("vesta", "kristalyapi")}
                errors = {name: error_amount(spec, values[name]) for name in values}
                if all(error <= spec["tolerance"] + 1e-12 for error in errors.values()):
                    status = "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED"
                else:
                    status = "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED"
            counts[status] += 1
            rows.append({key: spec[key] for key in ("key", "kind", "reference", "unit", "tolerance")} |
                        {"vesta": values["vesta"], "kristalyapi": values["kristalyapi"],
                         "absoluteError": errors, "status": status})
        result_cases.append({"id": case["id"], "sourceSha256": case["sourceSha256"],
                             "referenceEngine": case["referenceEngine"], "measurements": rows})
    return {
        "schema": "kristalyapi.vesta16.2.numeric-difference-report.v1",
        "vestaVersion": "3.5.8", "referenceData": "REAL_SHA_PINNED_CIF_OR_CCP4",
        "vestaGuiStatus": "CAPTURED_HUMAN_REVIEW_REQUIRED" if captured else "NOT_RUN",
        "scientificParity": "NOT_ESTABLISHED", "counts": counts, "cases": result_cases,
        "warning": "Human-transcribed VESTA/app data and PNG hash audit require expert verification. Matching numbers do not establish GUI or physical equivalence. CCP4 native units are UNKNOWN.",
    }


def write_reports(report: dict, directory: Path) -> None:
    if directory.is_symlink():
        raise ValueError("Refusing symlink output directory")
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "report.json").open("x", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
        file.write("\n")
    with (directory / "matrix.csv").open("x", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["scene", "metric", "unit", "reference", "vesta", "kristalyapi",
                         "tolerance", "error_vesta", "error_kristalyapi", "status"])
        for case in report["cases"]:
            for m in case["measurements"]:
                fmt = lambda value: json.dumps(value, ensure_ascii=False) if value is not None else ""
                writer.writerow([case["id"], m["key"], m["unit"], fmt(m["reference"]),
                                 fmt(m["vesta"]), fmt(m["kristalyapi"]), m["tolerance"],
                                 fmt(m["absoluteError"]["vesta"]),
                                 fmt(m["absoluteError"]["kristalyapi"]), m["status"]])


def prepare_template(baseline: list[dict], output: Path) -> None:
    """Create an explicitly unattested operator form; never fabricate results."""
    if output.is_symlink():
        raise ValueError("Refusing symlink template destination")
    payload = {
        "schema": SCHEMA,
        "vestaVersion": "3.5.8",
        "vestaGuiExecuted": False,
        "operator": "REPLACE_WITH_OPERATOR",
        "platform": "REPLACE_WITH_OS_AND_CAPTURE_METHOD",
        "kristalyapiCommit": "REPLACE_WITH_FULL_40_CHARACTER_GIT_SHA",
        "cases": [
            {"id": item["id"], "sourceSha256": item["sourceSha256"],
             "availableKeys": [metric["key"] for metric in item["references"]],
             "measurements": []}
            for item in baseline
        ],
        "instructions": (
            "Only after real VESTA 3.5.8 and app PNG captures: set attestation, "
            "copy exact V15.1 provenance, record both values per metric as "
            '{"key":"...","vesta":number_or_3vector,"kristalyapi":number_or_3vector}. '
            "Keep measurements empty for unmeasured metrics and provide "
            "--v15-capture to audit the actual matched PNGs."
        ),
    }
    with output.open("x", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)
        file.write("\n")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, help="Private numeric GUI/app measurements")
    parser.add_argument("--v15-capture", type=Path, help="Independent real V15 screenshot capture.json")
    parser.add_argument("--out-dir", type=Path, help="New/empty output directory")
    parser.add_argument("--template-out", type=Path, help="Create an explicitly unattested numeric evidence template")
    args = parser.parse_args(argv)
    try:
        if args.template_out:
            if args.out_dir or args.evidence or args.v15_capture:
                raise ValueError("--template-out cannot be mixed with audit arguments")
            prepare_template(source_references(), args.template_out)
            print("Created unattested V16.2 operator template; GUI status NOT_RUN")
            return 0
        if args.out_dir is None:
            raise ValueError("--out-dir required for report mode")
        if bool(args.evidence) != bool(args.v15_capture):
            raise ValueError("--evidence and --v15-capture must be supplied together")
        report = compare(source_references(), args.evidence, args.v15_capture)
        write_reports(report, args.out_dir)
        print(json.dumps({"vestaGuiStatus": report["vestaGuiStatus"],
                          "scientificParity": report["scientificParity"],
                          "counts": report["counts"]}, ensure_ascii=False))
        return 0
    except (ValueError, KeyError, OSError, json.JSONDecodeError, TypeError) as exc:
        print("V16.2 numeric comparison failed: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
