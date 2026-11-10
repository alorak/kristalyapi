#!/usr/bin/env python3
"""Export actual Materials Project BS/DOS via official mp-api (not summary data).

Requires: pip install mp-api
Usage: MP_API_KEY=... python tools/mp_electronic_export.py --mp-id mp-149 --output mp-149-electronic.json
The API key is never included in the output file.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys

ID = re.compile(r"^mp-(?:[0-9]{1,12}|[a-z]{1,16})$")


def scalar(v):
    n = float(v)
    if not math.isfinite(n):
        raise ValueError("Non-finite electronic data")
    return round(n, 9)


def vector(values, label, limit):
    values = [scalar(v) for v in values]
    if not 2 <= len(values) <= limit:
        raise ValueError(f"{label} length exceeds bounds")
    return values


def spins(data, start=0, count=None):
    """Convert pymatgen Spin enum keys and NumPy arrays to bounded JSON."""
    out = {}
    for spin, values in data.items():
        label = "up" if int(spin) == 1 else "down" if int(spin) == -1 else None
        if label is None:
            raise ValueError("Unsupported spin")
        if count is None:
            out[label] = vector(values, "DOS", 20000)
        else:
            if len(values) < start + count:
                raise ValueError("Band selection exceeds source")
            out[label] = [vector(row, "Band", 2000) for row in values[start:start + count]]
    if "up" not in out:
        raise ValueError("Spin-up data absent")
    return out



def projected_dos(dos, length):
    """Read *actual* pymatgen CompleteDos element/orbital projections if present.

    Not every MP DOS object contains site projections. Missing projections are
    represented as an empty list, never reconstructed from total DOS.
    """
    structure = getattr(dos, "structure", None)
    if structure is None or not hasattr(dos, "get_element_spd_dos"):
        return []
    composition = getattr(structure, "composition", None)
    if composition is None:
        return []
    elements = sorted(composition.elements, key=lambda el: str(el.symbol))
    entries = []
    for element in elements:
        by_orbital = dos.get_element_spd_dos(element)
        for key, partial in sorted(by_orbital.items(), key=lambda item: str(item[0])):
            orbital = str(getattr(key, "name", key)).lower()
            if orbital not in ("s", "p", "d", "f"):
                continue
            channels = spins(partial.densities)
            if set(channels) != set(spins(dos.densities)):
                raise ValueError("Projected spin channels differ from total DOS")
            if any(len(values) != length for values in channels.values()):
                raise ValueError("Projected DOS grid length differs from total DOS")
            entries.append({"element": str(element.symbol), "orbital": orbital,
                            "spins": channels})
            if len(entries) > 16:
                raise ValueError("More than 16 element/orbital PDOS groups; export total DOS only")
    return entries


def task_id(value):
    if value is None:
        return None
    value = str(value)
    return value if ID.fullmatch(value) else None


def discover_tasks(mpr, mid):
    """Only record task IDs exposed by this particular MP data release."""
    ids = {"band_task_id": None, "dos_task_id": None}
    try:
        rows = mpr.materials.electronic_structure.search(
            material_ids=[mid], fields=["bandstructure", "dos"])
        if not rows:
            return ids
        row = rows[0]
        bs = getattr(row, "bandstructure", None)
        dos = getattr(row, "dos", None)
        if bs:
            meta = bs.model_dump() if hasattr(bs, "model_dump") else bs
            ids["band_task_id"] = task_id((meta.get("setyawan_curtarolo") or {}).get("task_id"))
        if dos:
            meta = dos.model_dump() if hasattr(dos, "model_dump") else dos
            ids["dos_task_id"] = task_id(meta.get("task_id"))
    except Exception:
        # Missing metadata must never be fabricated.
        pass
    return ids


def export_data(mpr, mid, first, count):
    import importlib.metadata
    result = {
        "schema": "kristalyapi.mp-electronic.v1",
        "provider": "Materials Project",
        "material_id": mid,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "mp_api_version": importlib.metadata.version("mp-api"),
        "path_type": "setyawan_curtarolo",
        "band": None, "dos": None,
        "provenance": discover_tasks(mpr, mid),
    }
    failures = []
    try:
        bs = mpr.get_bandstructure_by_material_id(mid)
        dist = vector(bs.distance, "k path", 2000)
        total = len(next(iter(bs.bands.values())))
        if first > total:
            raise ValueError(f"First band {first} exceeds {total}")
        size = min(count, total - first + 1)
        if size * len(dist) > 120000:
            raise ValueError("Band window exceeds 120000 points")
        labels = []
        for i, k in enumerate(bs.kpoints):
            label = getattr(k, "label", None)
            if label and (not labels or dist[i] > dist[labels[-1]["index"]] + 1e-8):
                labels.append({"index": i, "label": str(label)[:24]})
        result["band"] = {
            "efermi_ev": scalar(bs.efermi), "distance_inv_angstrom": dist,
            "labels": labels[:32], "first_band": first, "total_bands": total,
            "spins": spins(bs.bands, first - 1, size),
        }
    except Exception as exc:
        failures.append("Bant: " + str(exc))
    try:
        dos = mpr.get_dos_by_material_id(mid)
        result["dos"] = {
            "efermi_ev": scalar(dos.efermi),
            "energy_ev": vector(dos.energies, "DOS energy", 20000),
            "spins": spins(dos.densities),
        }
        if any(len(values) != len(result["dos"]["energy_ev"])
               for values in result["dos"]["spins"].values()):
            raise ValueError("DOS energy/density lengths disagree")
        # A projection error must not invalidate a valid total-DOS export.
        try:
            result["dos"]["pdos"] = projected_dos(dos, len(result["dos"]["energy_ev"]))
        except (AttributeError, TypeError, ValueError) as exc:
            result["dos"]["pdos"] = []
            failures.append("PDOS unavailable: " + str(exc))
    except Exception as exc:
        result["dos"] = None
        failures.append("DOS: " + str(exc))
    if not result["band"] and not result["dos"]:
        raise ValueError("MP data unavailable; " + "; ".join(failures))
    return result, failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mp-id", required=True, help="e.g. mp-149")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--first-band", type=int, default=1)
    parser.add_argument("--band-count", type=int, default=80)
    args = parser.parse_args()
    if not ID.fullmatch(args.mp_id):
        parser.error("Invalid Materials Project ID")
    if args.first_band < 1 or not 1 <= args.band_count <= 300:
        parser.error("Invalid band window (1–300)")
    key = os.environ.get("MP_API_KEY", "").strip()
    if not 1 <= len(key) <= 512:
        parser.error("MP_API_KEY is required (never pass API key as a command argument)")
    from mp_api.client import MPRester
    with MPRester(key) as mpr:
        result, warnings = export_data(mpr, args.mp_id, args.first_band, args.band_count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"
    if len(payload.encode("utf-8")) > 8_000_000:
        raise ValueError("Export exceeds 8 MB browser import cap")
    with args.output.open("w", encoding="utf-8") as out:
        out.write(payload)
    for warning in warnings:
        print("Warning: " + warning, file=sys.stderr)
    print(f"Exported MP {args.mp_id} to {args.output} (actual mp-api arrays)")


if __name__ == "__main__":
    main()
