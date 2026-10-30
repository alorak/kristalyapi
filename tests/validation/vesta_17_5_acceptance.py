#!/usr/bin/env python3
"""V17.5 operator-led VESTA 3.5.8 desktop acceptance and loss-audit harness.

Only the operator can run the real VESTA GUI. No binary, screenshots, sidecars
or scientific PASS are created by this script. Tests use SYNTHETIC PNGs.
"""
from __future__ import annotations

import argparse
import csv
from datetime import date
import json
import math
from pathlib import Path
import re
import sys

from vesta_15_visual import (
    audited_capture, crop, digest, metrics, pinned_cases, png_rgb, png_write, safe_file,
)
from vesta_16_orientation import lattice_vectors

SCHEMA = "kristalyapi.vesta17.5.desktop-evidence.v1"
COMMIT = re.compile(r"[0-9a-f]{40}")
SHA256 = re.compile(r"[0-9a-f]{64}")
SUITES = {
    "nacl-001-structure": "P1_EXPORT_ROUNDTRIP",
    "rutile-110-polyhedron": "P1_EXPORT_ROUNDTRIP",
    "iucr-mixed-occupancy-adp": "P1_EXPORT_ROUNDTRIP",
    "5i55-ccp4-isosurface": "VOLUME_LOSS_GATE",
}
FIELDS = ("a", "b", "c", "alpha", "beta", "gamma")


def selected_cases(cases=None):
    cases = pinned_cases() if cases is None else cases
    by_id = {c["id"]: c for c in cases}
    if not set(SUITES).issubset(by_id) or len(by_id) != len(cases):
        raise ValueError("V17.5 requires three pinned CIF cases and one CCP4 case")
    return [by_id[key] for key in SUITES]


def json_file(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 2_000_000:
        raise ValueError("JSON manifest absent, symlinked or oversized")
    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        raise ValueError("Expected JSON object")
    return doc


def image_slot(cid, stage, size):
    return {
        "path": cid + "-" + stage + ".png", "sha256": "REPLACE_WITH_REAL_SHA256",
        "roi": [0, 0, *size], "captureDate": "REPLACE_WITH_YYYY-MM-DD",
        "captureMethod": "REPLACE_AFTER_REAL_GUI_SCREENSHOT",
    }


def artifact_slot(cid, name, suffix):
    return {"path": cid + "-" + name + suffix, "sha256": "REPLACE_WITH_REAL_SHA256"}


def prepare(folder: Path, commit: str, cases=None):
    if not COMMIT.fullmatch(commit):
        raise ValueError("Full 40-character KristalYapı commit SHA required")
    cases = selected_cases(cases)
    if folder.is_symlink() or (folder.exists() and (not folder.is_dir() or any(folder.iterdir()))):
        raise ValueError("Evidence folder must be new/empty")
    folder.mkdir(parents=True, exist_ok=True)
    rows = []
    for scene in cases:
        cid = scene["id"]
        structure = SUITES[cid] == "P1_EXPORT_ROUNDTRIP"
        rows.append({
            "id": cid, "suite": SUITES[cid], "sourceSha256": scene["sourceSha256"],
            "settings": scene["settings"],
            "exportedProject": artifact_slot(cid, "app-export", ".vesta") if structure else None,
            "lossReport": artifact_slot(cid, "app-export", ".vesta.loss.json") if structure else None,
            "desktopResavedProject": artifact_slot(cid, "vesta-resaved", ".vesta") if structure else None,
            "volumeCompanion": artifact_slot(cid, "operator-selected", ".ccp4") if not structure else None,
            "screenshots": {
                key: image_slot(cid, key, scene["settings"]["outputPixels"])
                for key in (("vestaOpened", "kristalyapiOpened", "kristalyapiReopened")
                            if structure else ("vestaOpened", "kristalyapiOpened"))
            },
        })
    payload = {
        "schema": SCHEMA, "vestaVersion": "3.5.8", "vestaGuiExecuted": False,
        "operator": "REPLACE_WITH_REAL_OPERATOR", "platform": "REPLACE_WITH_OS_AND_VESTA_BUILD",
        "kristalyapiCommit": commit, "cases": rows,
        "warning": "UNATTESTED TEMPLATE. Hash sealing does not prove GUI execution or scientific equivalence.",
    }
    with (folder / "evidence.json").open("x", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return payload


def _artifact(folder: Path, slot: dict, *, allow_missing=False):
    if not isinstance(slot, dict):
        raise ValueError("Required evidence artifact slot missing")
    name = slot.get("path")
    try:
        path = safe_file(folder, name)
    except ValueError:
        if allow_missing and isinstance(name, str) and not Path(name).is_absolute() and ".." not in Path(name).parts:
            return None
        raise
    data = path.read_bytes()
    recorded = slot.get("sha256")
    if not SHA256.fullmatch(str(recorded)) or digest(data) != recorded:
        raise ValueError("Pinned evidence SHA-256 missing/mismatch for " + str(name))
    return path


def _validate_header(evidence: dict, cases: list[dict], *, require_operator: bool):
    if evidence.get("schema") != SCHEMA or evidence.get("vestaVersion") != "3.5.8":
        raise ValueError("Unsupported evidence schema or VESTA desktop version")
    if not COMMIT.fullmatch(str(evidence.get("kristalyapiCommit", ""))):
        raise ValueError("Unpinned full KristalYapı source commit")
    if require_operator:
        if evidence.get("vestaGuiExecuted") is not True:
            raise ValueError("Real VESTA GUI execution not operator-attested")
        for field in ("operator", "platform"):
            item = evidence.get(field)
            if not isinstance(item, str) or len(item.strip()) < 5 or item.startswith("REPLACE"):
                raise ValueError("Unfilled VESTA operator/platform provenance")
    rows = evidence.get("cases")
    if not isinstance(rows, list) or len(rows) != len(cases):
        raise ValueError("Missing or duplicated V17.5 scene entries")
    seen = set()
    by_id = {c["id"]: c for c in cases}
    for row in rows:
        cid = row.get("id")
        if cid not in by_id or cid in seen or row.get("suite") != SUITES[cid]:
            raise ValueError("Unknown/duplicate case or incorrect V17.5 suite")
        seen.add(cid)
        scene = by_id[cid]
        if row.get("sourceSha256") != scene["sourceSha256"] or row.get("settings") != scene["settings"]:
            raise ValueError("Source SHA-256 or canonical V15 camera/volume settings changed: " + cid)
        required = ("exportedProject", "lossReport", "desktopResavedProject")
        if SUITES[cid] == "VOLUME_LOSS_GATE" and any(row.get(k) is not None for k in required):
            raise ValueError("Volume loss gate cannot claim V17.4 embedded/grid export")
        if (SUITES[cid] == "VOLUME_LOSS_GATE") != (row.get("volumeCompanion") is not None):
            raise ValueError("Only the volume gate may require a real selected CCP4 companion")
        needed = ("vestaOpened", "kristalyapiOpened", "kristalyapiReopened") if SUITES[cid] == "P1_EXPORT_ROUNDTRIP" else ("vestaOpened", "kristalyapiOpened")
        if not isinstance(row.get("screenshots"), dict) or set(row["screenshots"]) != set(needed):
            raise ValueError("Incorrect screenshot stages for " + cid)
    return {r["id"]: r for r in rows}


def seal(folder: Path, cases=None):
    """Bind existing local evidence bytes; NEVER modify the GUI attestation."""
    cases = selected_cases(cases)
    file = folder / "evidence.json"
    evidence = json_file(file)
    _validate_header(evidence, cases, require_operator=False)
    if evidence.get("vestaGuiExecuted") is not False:
        raise ValueError("Seal while vestaGuiExecuted=false; attest only after real GUI run")
    count = 0
    by_id = {c["id"]: c for c in cases}
    for row in evidence["cases"]:
        cid = row["id"]
        slots = [row[k] for k in ("exportedProject", "lossReport", "desktopResavedProject", "volumeCompanion")
                 if row[k] is not None] + list(row["screenshots"].values())
        for slot in slots:
            name = slot["path"]
            path = None
            try:
                path = safe_file(folder, name)
            except ValueError:
                if not isinstance(name, str) or Path(name).is_absolute() or "\\" in name or ".." in Path(name).parts:
                    raise
                continue
            data = path.read_bytes()
            old = slot.get("sha256")
            if old not in ("REPLACE_WITH_REAL_SHA256", digest(data)):
                raise ValueError("Previously sealed evidence was altered: " + name)
            if name.endswith(".png"):
                dims = png_rgb(path, tuple(by_id[cid]["settings"]["backgroundRGB"]))[:2]
                if list(dims) != by_id[cid]["settings"]["outputPixels"]:
                    raise ValueError("PNG dimensions differ from canonical 1024x768 capture")
            slot["sha256"] = digest(data)
            count += 1
    # Atomic, no symlink overwrite of evidence.json.
    temp = folder / "evidence.json.new"
    with temp.open("x", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)
        f.write("\n")
    temp.replace(file)
    return {"sealedFiles": count, "vestaGuiExecuted": False, "scientificParity": "NOT_ESTABLISHED"}


def parse_p1_project(path: Path):
    """Read a deliberately tiny structural subset; never claim full VESTA parsing."""
    if path.suffix.lower() != ".vesta":
        raise ValueError("Round-trip artifact must be .vesta")
    text = path.read_text(encoding="utf-8-sig")
    if len(text) > 4_000_000 or not re.search(r"^#VESTA_FORMAT_VERSION\s+3\.\d+", text, re.M):
        raise ValueError("Missing VESTA 3.x project header or size exceeded")
    lines = text.splitlines()
    def section(name):
        indices = [i for i, v in enumerate(lines) if v.strip() == name]
        if len(indices) != 1:
            raise ValueError("Expected one VESTA " + name + " block")
        return indices[0]
    group = lines[section("GROUP") + 1].split()
    if group[:2] != ["1", "1"]:
        raise ValueError("Round-trip requires explicit P1 group 1 setting")
    cell_values = lines[section("CELLP") + 1].split()
    if len(cell_values) < 6:
        raise ValueError("Incomplete VESTA cell")
    cell = dict(zip(FIELDS, map(float, cell_values[:6])))
    lattice_vectors(cell)
    idx = section("STRUC") + 1
    sites = {}
    finished = False
    for line in lines[idx:]:
        p = line.split()
        if not p:
            continue
        # A STRUC displacement continuation can start with 0.000000; only
        # the five-integer zero row terminates the list.
        if len(p) >= 5 and all(token == "0" for token in p[:5]):
            finished = True
            break
        if not re.fullmatch(r"[1-9]\d*", p[0]):
            continue  # e.g. indented STRUC displacement continuation
        if len(p) < 7 or not re.fullmatch(r"[A-Z][a-z]?", p[1]):
            raise ValueError("Malformed VESTA STRUC atom row")
        label = p[2]
        if not re.fullmatch(r"[A-Za-z0-9_.'()+-]{1,80}", label) or label in sites:
            raise ValueError("Duplicate or unsupported VESTA site label")
        obs = [float(p[3]), *(float(x) for x in p[4:7])]
        if not all(math.isfinite(n) for n in obs) or not 0 <= obs[0] <= 1 or any(abs(x) > 1000 for x in obs[1:]):
            raise ValueError("Nonphysical occupancy/coordinates in VESTA resave")
        sites[label] = {"symbol": p[1], "occ": obs[0], "frac": obs[1:]}
        if len(sites) > 1000:
            raise ValueError("VESTA site count exceeds 1000")
    if not finished or not sites:
        raise ValueError("Incomplete VESTA site list")
    return {"cell": cell, "sites": sites}


def compare_structure(first, later):
    """Geometric differences, not physical/visual VESTA equivalence."""
    if first["sites"].keys() != later["sites"].keys() or any(
        first["sites"][k]["symbol"] != later["sites"][k]["symbol"] for k in first["sites"]
    ):
        return {"status": "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED",
                "reason": "Different site labels or chemical species", "errors": None}
    A, B, C, _ = lattice_vectors(first["cell"])
    max_angstrom = 0.
    for label, a in first["sites"].items():
        b = later["sites"][label]
        delta = [b["frac"][i] - a["frac"][i] for i in range(3)]
        delta = [n - round(n) for n in delta]
        cart = [A[i] * delta[0] + B[i] * delta[1] + C[i] * delta[2] for i in range(3)]
        max_angstrom = max(max_angstrom, math.sqrt(sum(x*x for x in cart)))
    errors = {
        "maxCellLengthErrorA": max(abs(first["cell"][k] - later["cell"][k]) for k in ("a", "b", "c")),
        "maxCellAngleErrorDegrees": max(abs(first["cell"][k] - later["cell"][k]) for k in ("alpha", "beta", "gamma")),
        "maxSiteCartesianPeriodicShiftA": max_angstrom,
        "maxOccupancyError": max(abs(first["sites"][k]["occ"] - later["sites"][k]["occ"]) for k in first["sites"]),
    }
    thresholds = {"maxCellLengthErrorA": 1e-4, "maxCellAngleErrorDegrees": 1e-4,
                  "maxSiteCartesianPeriodicShiftA": .01, "maxOccupancyError": 1e-4}
    within = all(errors[k] <= limit + 1e-12 for k, limit in thresholds.items())
    return {"status": "WITHIN_TOLERANCE_HUMAN_REVIEW_REQUIRED" if within
            else "OUT_OF_TOLERANCE_HUMAN_REVIEW_REQUIRED",
            "errors": errors, "thresholds": thresholds}


def _capture(folder, slot, scene):
    # Reuses V15 strict PNG SHA-256, CRC, calendar date, ROI and capture method.
    return audited_capture(folder, slot, tuple(scene["settings"]["backgroundRGB"]),
                           scene["settings"]["outputPixels"])


def audit(folder: Path, out_dir: Path, cases=None, *, require_all=False):
    cases = selected_cases(cases)
    if out_dir.is_symlink() or (out_dir.exists() and any(out_dir.iterdir())):
        raise ValueError("Output folder must be new or empty; never overwrite evidence")
    evidence = json_file(folder / "evidence.json")
    rows = _validate_header(evidence, cases, require_operator=False)
    if evidence.get("vestaGuiExecuted") is True:
        _validate_header(evidence, cases, require_operator=True)
    elif evidence.get("vestaGuiExecuted") is not False:
        raise ValueError("VESTA GUI attestation must be explicitly true/false")
    captured = 0
    reports = []
    images = []
    for scene in cases:
        cid = scene["id"]
        row = rows[cid]
        report = {"id": cid, "suite": SUITES[cid], "sourceSha256": scene["sourceSha256"],
                  "vestaGuiStatus": "NOT_RUN", "scientificParity": "NOT_ESTABLISHED",
                  "roundtrip": None, "visualMetrics": None, "omittedByV17_4": None}
        structure = SUITES[cid] == "P1_EXPORT_ROUNDTRIP"
        if structure:
            needed = [row["exportedProject"], row["lossReport"], row["desktopResavedProject"]]
        else:
            needed = [row["volumeCompanion"]]
            report["omittedByV17_4"] = "VOLUME_GRID_NOT_EXPORTED; UNKNOWN_SOURCE_PHYSICAL_UNITS"
        slots = [*needed, *row["screenshots"].values()]
        found = []
        for slot in slots:
            try:
                found.append(_artifact(folder, slot))
            except ValueError as exc:
                if (("missing" in str(exc) or "outside" in str(exc))
                        and evidence["vestaGuiExecuted"] is False):
                    found.append(None)
                else:
                    raise
        if evidence["vestaGuiExecuted"] is True and any(item is None for item in found):
            raise ValueError("GUI attested but required artifact is missing: " + cid)
        if evidence["vestaGuiExecuted"] is False:
            reports.append(report)
            continue
        if structure:
            exported, loss_report, resaved = found[:3]
            manifest = json_file(loss_report)
            if (manifest.get("schema") != "kristalyapi.vesta17.4.loss-manifest.v1"
                    or manifest.get("exportFormat") != "VESTA_3.5_P1_LIMITED"
                    or manifest.get("status") != "LOSSY_NONVERIFIED"
                    or manifest.get("scientificParity") != "NOT_ESTABLISHED"
                    or manifest.get("vestaGuiStatus") != "NOT_RUN"
                    or manifest.get("vestaSha256") != digest(exported.read_bytes())
                    or manifest.get("generatedVestaFile") != exported.name):
                raise ValueError("V17.4 export manifest provenance/hash mismatch: " + cid)
            if not isinstance(manifest.get("externalFiles", []), list) or any(
                not isinstance(item, dict) or item.get("path") is not None or item.get("sha256") is not None
                for item in manifest.get("externalFiles", [])
            ):
                raise ValueError("External volume file path/hash may not be fabricated")
            entries = manifest.get("entries")
            if not isinstance(entries, list) or not any(
                isinstance(item, dict) and item.get("field") == "SCENE/PROJT/LMATRIX/LIGHT"
                and item.get("status") == "DROPPED" for item in entries
            ):
                raise ValueError("Missing explicit V17.4 camera/light loss disclosure")
            if cid == "iucr-mixed-occupancy-adp" and not any(
                isinstance(item, dict) and item.get("field") == "ADP"
                and item.get("status") == "DROPPED" for item in entries
            ):
                raise ValueError("IUCr ADP loss must be explicit")
            a, b = parse_p1_project(exported), parse_p1_project(resaved)
            if manifest.get("exportSiteCount") != len(a["sites"]):
                raise ValueError("Export manifest site count does not match VESTA structure")
            report["roundtrip"] = compare_structure(a, b)
            report["exportedVestaSha256"] = digest(exported.read_bytes())
            report["desktopResavedSha256"] = digest(resaved.read_bytes())
            report["v17_4LossManifestSha256"] = digest(loss_report.read_bytes())
        else:
            companion = found[0]
            if digest(companion.read_bytes()) != scene["sourceSha256"]:
                raise ValueError("Selected GUI CCP4 sidecar differs from source-pinned binary")
            report["operatorSelectedCcp4Sha256"] = digest(companion.read_bytes())
            if scene["settings"].get("isoLevel") != 1 or scene["settings"].get("isoLevelUnits") != "source-map-units":
                raise ValueError("Native CCP4 +1.0 isolevel and UNKNOWN units must remain pinned")
        capture = {name: _capture(folder, shot, scene)
                   for name, shot in row["screenshots"].items()}
        if len({tuple(item["roi"]) for item in row["screenshots"].values()}) != 1:
            raise ValueError("All V17.5 screenshots must use the same ROI")
        bg = tuple(scene["settings"]["backgroundRGB"])
        first, second = capture["vestaOpened"], capture["kristalyapiOpened"]
        comparisons = [("initial", second)]
        if structure:
            comparisons.append(("reopened", capture["kristalyapiReopened"]))
        report["visualMetrics"] = {}
        for label, right in comparisons:
            results, picture = metrics(first, right, bg)
            name = cid + "-" + label + "-comparison.png"
            report["visualMetrics"][label] = results
            images.append((name, first[0] * 3, first[1], picture))
        report["vestaGuiStatus"] = "CAPTURED_HUMAN_REVIEW_REQUIRED"
        captured += 1
        reports.append(report)
    complete = captured == len(cases)
    result = {
        "schema": "kristalyapi.vesta17.5.desktop-audit.v1", "requiredCases": len(cases),
        "capturedCases": captured, "evidenceComplete": complete,
        "vestaGuiStatus": "CAPTURED_HUMAN_REVIEW_REQUIRED" if captured else "NOT_RUN",
        "scientificParity": "NOT_ESTABLISHED", "manualScientificAcceptance": "REQUIRED",
        "vestaBinaryExecutedByScript": False, "cases": reports,
        "warning": "Operator-attested local artifacts, not verified GUI origin. Visual IoU is descriptive; even numerical within-tolerance is NOT automatic VESTA scientific parity.",
    }
    if require_all and not complete:
        raise ValueError("V17.5 acceptance incomplete: missing genuine GUI captures")
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, w, h, pixels in images:
        png_write(out_dir / name, w, h, pixels)
    with (out_dir / "report.json").open("x", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with (out_dir / "matrix.csv").open("x", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["case", "suite", "gui", "roundtrip", "cell_a_max", "site_shift_a_max",
                         "occupancy_max", "initial_iou", "reopened_iou", "scientific_parity"])
        for row in reports:
            diffs = (row["roundtrip"] or {}).get("errors") or {}
            initial = (row["visualMetrics"] or {}).get("initial") or {}
            reopened = (row["visualMetrics"] or {}).get("reopened") or {}
            writer.writerow([row["id"], row["suite"], row["vestaGuiStatus"],
                             (row["roundtrip"] or {}).get("status", "NOT_RUN"),
                             diffs.get("maxCellLengthErrorA", ""), diffs.get("maxSiteCartesianPeriodicShiftA", ""),
                             diffs.get("maxOccupancyError", ""), initial.get("foregroundIoU", ""),
                             reopened.get("foregroundIoU", ""), "NOT_ESTABLISHED"])
    return result


def main(argv=None):
    cli = argparse.ArgumentParser(description=__doc__)
    actions = cli.add_subparsers(dest="action", required=True)
    prep = actions.add_parser("prepare")
    prep.add_argument("--dir", type=Path, required=True)
    prep.add_argument("--commit", required=True)
    seal_cli = actions.add_parser("seal")
    seal_cli.add_argument("--dir", type=Path, required=True)
    check = actions.add_parser("audit")
    check.add_argument("--dir", type=Path, required=True)
    check.add_argument("--out-dir", type=Path, required=True)
    check.add_argument("--require-all", action="store_true")
    args = cli.parse_args(argv)
    try:
        result = (prepare(args.dir, args.commit) if args.action == "prepare" else
                  seal(args.dir) if args.action == "seal" else
                  audit(args.dir, args.out_dir, require_all=args.require_all))
        print(json.dumps(result if args.action != "prepare" else {
            "scenes": [r["id"] for r in result["cases"]], "vestaGuiExecuted": False,
            "scientificParity": "NOT_ESTABLISHED"}, indent=2, ensure_ascii=False))
        return 0
    except (OSError, KeyError, ValueError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        print("V17.5 desktop acceptance failed: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
