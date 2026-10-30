#!/usr/bin/env python3
"""V16.1: independent crystallographic camera-frame reference for V15 scenes.

Pure stdlib; reads six cell parameters from SHA-pinned real CIF files. Does
not run VESTA, compare pixels, infer GUI camera handedness, or certify parity.
The view [uvw] is a direct-lattice vector; up (hkl)* is a reciprocal-lattice
normal. The two must satisfy h*u + k*v + l*w = 0.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import sys

from vesta_15_visual import pinned_cases

FIELDS = ("a", "b", "c", "alpha", "beta", "gamma")
_TAGS = {
    "a": "_cell_length_a", "b": "_cell_length_b", "c": "_cell_length_c",
    "alpha": "_cell_angle_alpha", "beta": "_cell_angle_beta",
    "gamma": "_cell_angle_gamma",
}
_NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\(\d+\))?(?:[eE][+-]?\d+)?")
_DIRECTION = re.compile(r"^\[\s*([+-]?\d)\s*([+-]?\d)\s*([+-]?\d)\s*\]$")
_DIRECTION_SEPARATED = re.compile(
    r"^\[\s*([+-]?\d+)\s*[, ]\s*([+-]?\d+)\s*[, ]\s*([+-]?\d+)\s*\]$"
)


def read_cif_cell(path: Path) -> dict[str, float]:
    """Read scalar six cell tags; no full CIF interpretation is implied."""
    if path.suffix.lower() != ".cif" or not path.is_file() or path.stat().st_size > 1_000_000:
        raise ValueError("Expected a bounded local CIF file")
    text = path.read_text(encoding="utf-8")
    found: dict[str, float] = {}
    tag_to_field = {tag: field for field, tag in _TAGS.items()}
    for line in text.splitlines():
        if not line.lstrip().startswith("_cell_"):
            continue
        tokens = line.strip().split(maxsplit=1)
        if len(tokens) != 2 or tokens[0].lower() not in tag_to_field:
            continue
        field = tag_to_field[tokens[0].lower()]
        literal = tokens[1].split("#", 1)[0].strip().strip("'\"")
        if not _NUMBER.fullmatch(literal):
            raise ValueError("Malformed CIF cell scalar: " + field)
        value = float(literal.split("(")[0]) if "(" in literal else float(literal)
        if not math.isfinite(value):
            raise ValueError("Non-finite CIF cell scalar: " + field)
        if field in found and abs(found[field] - value) > 1e-10:
            raise ValueError("Ambiguous duplicate CIF cell scalar: " + field)
        found[field] = value
    if set(found) != set(FIELDS):
        raise ValueError("Missing CIF cell parameters: " + ", ".join(sorted(set(FIELDS) - set(found))))
    if any(found[k] <= 0 for k in ("a", "b", "c")):
        raise ValueError("Cell lengths must be positive")
    if any(not 0 < found[k] < 180 for k in ("alpha", "beta", "gamma")):
        raise ValueError("Cell angles must lie strictly between 0 and 180 degrees")
    return found


def direction(label: str) -> tuple[int, int, int]:
    """Accept standard three single-digit indices or comma/space-separated indices."""
    if not isinstance(label, str):
        raise ValueError("Crystallographic direction must be a bracketed string")
    match = _DIRECTION.fullmatch(label) or _DIRECTION_SEPARATED.fullmatch(label)
    if not match:
        raise ValueError("Use [uvw] (one digit each) or [u,v,w] for extended/negative indices")
    indices = tuple(map(int, match.groups()))
    if indices == (0, 0, 0):
        raise ValueError("The zero Miller/direction vector is invalid")
    return indices


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def add3(a, b, c, coefficients):
    return tuple(coefficients[0] * a[i] + coefficients[1] * b[i] + coefficients[2] * c[i]
                 for i in range(3))


def unit(v: tuple[float, float, float]) -> tuple[float, float, float]:
    magnitude = math.sqrt(dot(v, v))
    if magnitude < 1e-12 or not math.isfinite(magnitude):
        raise ValueError("Degenerate crystallographic basis/direction")
    return tuple(x / magnitude for x in v)


def lattice_vectors(cell: dict[str, float]) -> tuple[tuple, tuple, tuple, float]:
    """Cartesian direct basis in Angstrom, using the conventional a along X."""
    if set(cell) != set(FIELDS):
        raise ValueError("Cell must specify exactly a,b,c,alpha,beta,gamma")
    a, b, c = (cell[k] for k in ("a", "b", "c"))
    alpha, beta, gamma = (math.radians(cell[k]) for k in ("alpha", "beta", "gamma"))
    if not all(math.isfinite(n) for n in (a, b, c, alpha, beta, gamma)):
        raise ValueError("Non-finite cell")
    if min(a, b, c) <= 0 or any(not 0 < angle < math.pi for angle in (alpha, beta, gamma)):
        raise ValueError("Nonphysical cell lengths/angles")
    sg = math.sin(gamma)
    if sg < 1e-9:
        raise ValueError("Degenerate gamma angle")
    A = (a, 0., 0.)
    B = (b * math.cos(gamma), b * sg, 0.)
    cx = c * math.cos(beta)
    cy = c * (math.cos(alpha) - math.cos(beta) * math.cos(gamma)) / sg
    cz2 = c * c - cx * cx - cy * cy
    if cz2 <= max(1e-12, 1e-12 * c * c):
        raise ValueError("Cell metric is singular or non-positive")
    C = (cx, cy, math.sqrt(cz2))
    volume = dot(A, cross(B, C))
    if volume <= 1e-10 or not math.isfinite(volume):
        raise ValueError("Invalid right-handed cell volume")
    return A, B, C, volume


def camera_frame(cell: dict[str, float], uvw: tuple[int, int, int],
                 hkl: tuple[int, int, int]) -> dict:
    """Compute an orthonormal frame: right, screen-up, outward view normal.

    The sign of VESTA's displayed camera eye is deliberately not inferred.
    """
    if not all(type(x) is int for x in (*uvw, *hkl)):
        raise ValueError("Miller indices must be integers")
    if uvw == (0, 0, 0) or hkl == (0, 0, 0):
        raise ValueError("Zero direction/plane indices")
    hdotu = sum(x * y for x, y in zip(uvw, hkl))
    if hdotu != 0:
        raise ValueError("Up reciprocal vector is not perpendicular to direct view: h*u+k*v+l*w != 0")
    A, B, C, volume = lattice_vectors(cell)
    direct_view = add3(A, B, C, uvw)
    astar = tuple(n / volume for n in cross(B, C))
    bstar = tuple(n / volume for n in cross(C, A))
    cstar = tuple(n / volume for n in cross(A, B))
    reciprocal_up = add3(astar, bstar, cstar, hkl)
    view = unit(direct_view)
    up = unit(reciprocal_up)
    cosine = dot(view, up)
    if abs(cosine) > 1e-10:
        raise ValueError("Direct-reciprocal camera axes are not orthogonal numerically")
    right = unit(cross(up, view))
    up = unit(cross(view, right))
    handedness = dot(cross(right, up), view)
    if abs(handedness - 1) > 1e-10:
        raise ValueError("Camera frame unexpectedly left-handed")
    return {
        "cellVolumeA3": round(volume, 12),
        "rightCartesian": [round(x, 12) for x in right],
        "screenUpCartesian": [round(x, 12) for x in up],
        "outwardViewNormalCartesian": [round(x, 12) for x in view],
        "viewAndUpDot": round(cosine, 12),
        "handednessDeterminant": round(handedness, 12),
        "directionPlanePairing": {"uvw": list(uvw), "hkl": list(hkl), "hDotU": hdotu},
        "convention": "a // +X, b in +XY half-plane; right = up cross outward-view; NOT a VESTA GUI camera sign assertion",
    }


def run() -> dict:
    from vesta_15_visual import ROOT
    output = []
    for case in pinned_cases():
        if not case["source"].lower().endswith(".cif"):
            output.append({"id": case["id"], "status": "NOT_COMPUTED_NON_CIF",
                           "reason": "Volume header/cell and absolute iso-level require separate CCP4 audit"})
            continue
        cell = read_cif_cell(ROOT / case["source"])
        settings = case["settings"]
        frame = camera_frame(cell, direction(settings["viewDirection"]),
                             direction(settings["upDirection"]))
        output.append({"id": case["id"], "sourceSha256": case["sourceSha256"],
                       "cellParameters": cell, "frame": frame, "status": "REFERENCE_COMPUTED_GUI_NOT_RUN"})
    return {
        "schema": "kristalyapi.vesta16.camera-reference.v1", "referenceVestaVersion": "3.5.8",
        "scientificParity": "NOT_ESTABLISHED", "vestaGuiStatus": "NOT_RUN",
        "cases": output,
        "warning": "Pure Cartesian reference; actual VESTA rendering, camera sign, light, clipping and images must be operator-validated.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="Write local reference JSON (default: stdout)")
    args = parser.parse_args(argv)
    try:
        result = run()
        rendered = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
        if args.out:
            if args.out.is_symlink():
                raise ValueError("Refusing symlink output")
            args.out.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
    except (ValueError, KeyError, OSError) as exc:
        print("V16.1 orientation reference failed: " + str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
