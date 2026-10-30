#!/usr/bin/env python3
"""V15.2: source-pinned CCP4 map header/value audit for real isolevel selection.

This validates an absolute numeric threshold in the source's NATIVE,
UNSPECIFIED units. It does NOT establish e/A^3, VESTA parity or a full-cell map.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct
import sys

from vesta_15_visual import ROOT, pinned_cases

HEADER_SIZE = 1024
MAX_VOXELS = 2_500_000
MAX_BYTES = 24 * 1024 * 1024


def inspect_ccp4(path: Path, iso_level: float) -> dict:
    if not isinstance(iso_level, (float, int)) or not math.isfinite(iso_level):
        raise ValueError("Finite absolute native-map isolevel required")
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError("Missing/oversized/linked CCP4 source")
    raw = path.read_bytes()
    if len(raw) < HEADER_SIZE or raw[208:212] != b"MAP ":
        raise ValueError("Invalid CCP4 MAP header")
    dims = struct.unpack_from("<3i", raw, 0)
    mode = struct.unpack_from("<i", raw, 12)[0]
    starts = struct.unpack_from("<3i", raw, 16)
    steps = struct.unpack_from("<3i", raw, 28)
    cell = struct.unpack_from("<6f", raw, 40)
    axes = struct.unpack_from("<3i", raw, 64)
    header_min, header_max, header_mean = struct.unpack_from("<3f", raw, 76)
    nsymbt = struct.unpack_from("<i", raw, 92)[0]
    header_rms = struct.unpack_from("<f", raw, 216)[0]
    if (any(d <= 1 for d in dims) or any(d > 1024 for d in dims)
            or math.prod(dims) > MAX_VOXELS or mode != 2
            or sorted(axes) != [1, 2, 3] or min(steps) <= 0
            or nsymbt < 0 or nsymbt > 65536 or nsymbt % 4 != 0):
        raise ValueError("Unsupported CCP4 geometry/mode/axis/symmetry layout")
    if (not all(math.isfinite(v) for v in cell)
            or min(cell[:3]) <= 0
            or not all(0 < v < 180 for v in cell[3:])):
        raise ValueError("Invalid CCP4 crystallographic cell")
    count = math.prod(dims)
    offset = HEADER_SIZE + nsymbt
    if len(raw) != offset + 4 * count:
        raise ValueError("Unexpected CCP4 voxel bytes")
    values = struct.unpack_from("<" + str(count) + "f", raw, offset)
    if not all(math.isfinite(v) for v in values):
        raise ValueError("Non-finite CCP4 samples")
    actual_min, actual_max = min(values), max(values)
    mean = sum(values) / count
    rms = math.sqrt(sum((v - mean) ** 2 for v in values) / count)
    for actual, header in ((actual_min, header_min), (actual_max, header_max),
                           (mean, header_mean), (rms, header_rms)):
        if not math.isfinite(header) or not math.isclose(actual, header, rel_tol=2e-5, abs_tol=2e-5):
            raise ValueError("CCP4 header statistics disagree with actual voxels")
    above = sum(v > iso_level for v in values)
    if not 0 < above < count:
        raise ValueError("Isolevel outside a meaningful sampled scalar range")
    nx, ny, nz = dims
    edge_crossings = 0
    # CCP4 C/R/S voxel stream has columns varying fastest in the file.
    for s in range(nz):
        for r in range(ny):
            for c in range(nx):
                idx = (s * ny + r) * nx + c
                for delta in (1 if c + 1 < nx else 0,
                              nx if r + 1 < ny else 0,
                              nx * ny if s + 1 < nz else 0):
                    if delta and (values[idx] > iso_level) != (values[idx + delta] > iso_level):
                        edge_crossings += 1
    if edge_crossings == 0:
        raise ValueError("Threshold has no internal grid crossings")
    return {
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "dimensionsCRS": list(dims),
        "mode": mode,
        "startCRS": list(starts),
        "fullGridSamplingXYZ": list(steps),
        "crsToXYZ": list(axes),
        "cell": dict(zip(("a", "b", "c", "alpha", "beta", "gamma"), cell)),
        "sampledFullCell": False,
        "sampleCount": count,
        "statisticsNativeUnits": {"min": round(actual_min, 8), "max": round(actual_max, 8),
                                  "mean": round(mean, 8), "rms": round(rms, 8)},
        "isoLevelAbsoluteNativeUnits": iso_level,
        "voxelsAboveIsoLevel": above,
        "thresholdGridEdgeCrossings": edge_crossings,
        "physicalUnits": "UNKNOWN",
        "vestaGuiStatus": "NOT_RUN",
        "scientificParity": "NOT_ESTABLISHED",
        "notice": "Valid native-map threshold ONLY; no claim of physical e/Angstrom^3 units, 3D surface topology equivalence or VESTA rendering.",
    }


def run() -> dict:
    sources = pinned_cases()
    scene = next((c for c in sources if c["id"] == "5i55-ccp4-isosurface"), None)
    if scene is None or scene["kind"] != "volume":
        raise ValueError("Pinned V15 CCP4 scene missing")
    level = scene["settings"]["isoLevel"]
    if scene["settings"]["isoLevelUnits"] != "source-map-units":
        raise ValueError("Must not assert unsupported physical CCP4 units")
    result = inspect_ccp4(ROOT / scene["source"], level)
    if result["sourceSha256"] != scene["sourceSha256"]:
        raise ValueError("CCP4 source does not match V15 source pin")
    return {"schema": "kristalyapi.vesta15.2.ccp4-native-isolevel.v1",
            "caseId": scene["id"], **result}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError) as exc:
        print("V15.2 CCP4 audit failed: " + str(exc), file=sys.stderr)
        raise SystemExit(2)
