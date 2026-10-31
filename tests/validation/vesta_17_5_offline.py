#!/usr/bin/env python3
"""V17.5 GUI-FREE structural preflight of a V17.4 .vesta + loss manifest.

This verifies independent Python read-back of the JavaScript P1 writer and
SHA-256-bound scientific omissions, NOT VESTA desktop rendering or loadability.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

from vesta_17_5_acceptance import compare_structure, parse_p1_project
from vesta_16_orientation import lattice_vectors

HEX = re.compile(r"[a-f0-9]{64}")
SAFE_LABEL = re.compile(r"[A-Za-z0-9_.'()+-]{1,80}")


def bounded_file(path: Path, suffix: str, limit: int = 4_000_000) -> bytes:
    if path.is_symlink() or not path.is_file() or path.suffix.lower() != suffix or path.stat().st_size > limit:
        raise ValueError("Missing/symlinked/oversized " + suffix + " evidence file")
    return path.read_bytes()


def _rgb_rows(lines: list[str], labels: set[str]) -> dict[str, dict]:
    indices = [i for i, line in enumerate(lines) if line.strip() == "SITET"]
    if len(indices) != 1:
        raise ValueError("Expected exactly one SITET block")
    styles = {}
    finished = False
    for line in lines[indices[0] + 1:]:
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "0":
            finished = True
            break
        if len(parts) < 6 or not parts[0].isdigit() or not SAFE_LABEL.fullmatch(parts[1]):
            raise ValueError("Malformed VESTA site-style row")
        label = parts[1]
        if label not in labels or label in styles:
            raise ValueError("Unknown/duplicate VESTA site-style label")
        try:
            radius = float(parts[2])
            channels = [int(v) for v in parts[3:6]]
        except ValueError as e:
            raise ValueError("Invalid VESTA site radius/RGB") from e
        if not math.isfinite(radius) or not 0 < radius <= 10 or any(not 0 <= v <= 255 for v in channels):
            raise ValueError("VESTA sphere radius or RGB outside bounds")
        styles[label] = {"radiusA_displayHypothesis": radius, "rgb": channels}
    if not finished or set(styles) != labels:
        raise ValueError("VESTA SITET block missing termination or site coverage")
    return styles


def _check_manifest(manifest: dict, data: bytes, filename: str, count: int) -> dict:
    if (manifest.get("schema") != "kristalyapi.vesta17.4.loss-manifest.v1"
            or manifest.get("exportFormat") != "VESTA_3.5_P1_LIMITED"
            or manifest.get("status") != "LOSSY_NONVERIFIED"
            or manifest.get("scientificParity") != "NOT_ESTABLISHED"
            or manifest.get("vestaGuiStatus") != "NOT_RUN"):
        raise ValueError("Unsupported V17.4 loss-manifest contract")
    if manifest.get("generatedVestaFile") != filename or manifest.get("vestaSha256") != hashlib.sha256(data).hexdigest():
        raise ValueError("Export text/name SHA-256 does not match loss manifest")
    if manifest.get("exportSiteCount") != count:
        raise ValueError("Manifest and P1 atom counts differ")
    entries = manifest.get("entries")
    if not isinstance(entries, list):
        raise ValueError("Loss manifest entries missing")
    keyed = {item["field"]: item["status"] for item in entries
             if isinstance(item, dict) and isinstance(item.get("field"), str)
             and isinstance(item.get("status"), str)}
    for field, status in (("symmetry", "FORCED_P1"), ("SITET/ATOMT", "APPROXIMATED"),
                          ("SCENE/PROJT/LMATRIX/LIGHT", "DROPPED"),
                          ("THERI", "DROPPED"), ("VESTA_GUI", "NOT_RUN")):
        if keyed.get(field) != status:
            raise ValueError("Missing/false loss-manifest field: " + field)
    if not isinstance(manifest.get("externalFiles"), list) or any(
        not isinstance(item, dict) or item.get("path") is not None
        or item.get("sha256") is not None
        for item in manifest["externalFiles"]
    ):
        raise ValueError("Cannot fabricate external density files or binary hashes")
    return keyed


def offline_check(vesta_path: Path, manifest_path: Path, reference: Path | None = None) -> dict:
    data = bounded_file(vesta_path, ".vesta")
    report_bytes = bounded_file(manifest_path, ".json", limit=2_000_000)
    try:
        manifest = json.loads(report_bytes.decode("utf-8"))
        text = data.decode("utf-8")
    except (ValueError, UnicodeError) as e:
        raise ValueError("Invalid UTF-8 evidence") from e
    if not isinstance(manifest, dict):
        raise ValueError("Loss report must be an object")
    # The independent structural parser lives in V17.5, not in browser JS.
    structure = parse_p1_project(vesta_path)
    keyed = _check_manifest(manifest, data, vesta_path.name, len(structure["sites"]))
    lines = text.splitlines()
    for field in ("IMPORT_DENSITY", "IMPORT_STRUCTURE", "IMPORT_TEXTURE", "IMPORT_ORFFE",
                  "VECTR", "THERI", "SCENE", "LMATRIX"):
        if re.search(r"(?m)^\s*" + field + r"(?:\s|$)", text):
            raise ValueError("Claimed-dropped field unexpectedly exported: " + field)
    styles = _rgb_rows(lines, set(structure["sites"]))
    _, _, _, volume = lattice_vectors(structure["cell"])
    result = {
        "schema": "kristalyapi.vesta17.5.gui-free-check.v1",
        "status": "OFFLINE_STRUCTURAL_CONTRACT_CHECKED_HUMAN_REVIEW_REQUIRED",
        "desktopVesta": "NOT_RUN",
        "scientificParity": "NOT_ESTABLISHED",
        "visualParity": "NOT_ESTABLISHED",
        "vestaSha256": hashlib.sha256(data).hexdigest(),
        "lossManifestSha256": hashlib.sha256(report_bytes).hexdigest(),
        "atomCount": len(structure["sites"]),
        "cellVolumeA3": round(volume, 10),
        "compositionByElement": {},
        "occupancyByElement": {},
        "siteVisualStyleCount": len(styles),
        "lossStatuses": keyed,
        "referenceComparison": None,
        "warnings": [
            "An independent Python parser read this P1 subset; VESTA desktop was NOT executed.",
            "Display radii are approximate and camera, ADP, vector, grid and polyhedron fidelity are NOT proven."
        ],
    }
    for atom in structure["sites"].values():
        sym = atom["symbol"]
        result["compositionByElement"][sym] = result["compositionByElement"].get(sym, 0) + 1
        result["occupancyByElement"][sym] = round(
            result["occupancyByElement"].get(sym, 0.0) + atom["occ"], 6)
    if reference is not None:
        bounded_file(reference, ".vesta")
        result["referenceComparison"] = compare_structure(parse_p1_project(reference), structure)
        # Reference only checks geometry and occupancy, not a VESTA GUI scene.
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vesta", required=True, type=Path)
    parser.add_argument("--loss-report", required=True, type=Path)
    parser.add_argument("--reference-vesta", type=Path,
                        help="Optional independent P1 .vesta baseline for numerical comparison")
    parser.add_argument("--report-out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.report_out.exists() or args.report_out.is_symlink():
            raise ValueError("Never overwrite an existing GUI-free report")
        result = offline_check(args.vesta, args.loss_report, args.reference_vesta)
        with args.report_out.open("x", encoding="utf-8") as file:
            json.dump(result, file, ensure_ascii=False, indent=2)
            file.write("\n")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, UnicodeError, IndexError, TypeError, KeyError) as e:
        print("V17.5 GUI-free preflight failed: " + str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
