#!/usr/bin/env python3
"""Bounded XRD evidence assessor. No real-device measurement is bundled.
All science and instrument identities remain independently unverified.
Usage: python tools/xrd_acceptance.py --manifest manifest.json --output report.json
"""
import argparse
import csv
import hashlib
import json
import math
import re
from pathlib import Path

SCHEMA = "kristalyapi.xrd-experimental-cohort.v1"
REPORT = "kristalyapi.xrd-experimental-review.v1"
SHA = re.compile(r"^[a-f0-9]{64}$")
KINDS = {"reference-standard", "blind-sample"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_file(root, entry):
    require(isinstance(entry, dict), "File evidence object is required")
    rel = entry.get("path")
    digest = entry.get("sha256")
    require(isinstance(rel, str) and 0 < len(rel) <= 250
            and not Path(rel).is_absolute() and not any(p in ("..", "") for p in Path(rel).parts),
            "Unsafe evidence relative path")
    require(isinstance(digest, str) and SHA.fullmatch(digest), "Pinned lowercase SHA-256 required")
    path = root / rel
    require(path.resolve().is_relative_to(root.resolve()) and path.is_file(),
            "Evidence path is missing or outside its manifest directory: " + rel)
    require(path.stat().st_size <= 4_000_000, "Evidence exceeds 4 MB limit: " + rel)
    require(sha(path) == digest, "Evidence bytes SHA-256 mismatch: " + rel)
    return path


def scan_rows(path):
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row or (row[0].strip().startswith("#")):
                continue
            if len(row) != 2:
                raise ValueError("XRD CSV requires exactly two columns: 2theta_deg,intensity")
            if not rows and row[0].strip().lower() == "2theta_deg":
                require(row[1].strip().lower() == "intensity", "Invalid scan header")
                continue
            try:
                angle, intensity = (float(v.strip()) for v in row)
            except (ValueError, TypeError) as exc:
                raise ValueError("Non-numeric XRD point") from exc
            require(math.isfinite(angle) and math.isfinite(intensity)
                    and 0 <= angle <= 180 and intensity >= 0, "Invalid XRD coordinates")
            require(not rows or angle > rows[-1][0], "2theta angles must increase strictly")
            rows.append((angle, intensity))
            require(len(rows) <= 50_000, "XRD has more than 50,000 samples")
    require(len(rows) >= 3 and max(v for _, v in rows) > 0, "XRD scan requires 3+ nonzero samples")
    return rows


def extract_peaks(rows, relative_floor=8.0, prominence_floor=4.0, window=16):
    require(0 <= relative_floor <= 100 and 0 <= prominence_floor <= 100, "Invalid peak thresholds")
    require(isinstance(window, int) and 2 <= window <= 100, "Invalid peak window")
    max_intensity = max(y for _, y in rows)
    result = []
    for i in range(1, len(rows) - 1):
        angle, y = rows[i]
        if y <= rows[i - 1][1] or y < rows[i + 1][1]:
            continue
        rel = 100 * y / max_intensity
        if rel < relative_floor:
            continue
        lower_left = min(v for _, v in rows[max(0, i - window):i])
        lower_right = min(v for _, v in rows[i + 1:min(len(rows), i + window + 1)])
        prominence = 100 * (y - max(lower_left, lower_right)) / max_intensity
        if prominence >= prominence_floor:
            result.append({"two_theta_deg":angle, "relative_percent":rel, "prominence_percent":prominence})
    return result[:1000]


def positions(reference, measured, tolerance):
    """Greedy one-to-one position comparison. Not instrument profile fitting."""
    used, matches, unmatched = set(), [], []
    for expected in reference:
        choices = [(abs(expected - p["two_theta_deg"]), j)
                   for j, p in enumerate(measured) if j not in used and
                   abs(expected - p["two_theta_deg"]) <= tolerance]
        if not choices:
            unmatched.append(expected)
            continue
        distance, j = min(choices)
        used.add(j)
        matches.append({"reference_two_theta_deg":expected,
                        "measured_two_theta_deg":measured[j]["two_theta_deg"],
                        "error_deg":round(measured[j]["two_theta_deg"] - expected, 6)})
    return matches, unmatched


def assess(manifest_path):
    manifest_path = Path(manifest_path).resolve()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(data.get("schema") == SCHEMA, "Invalid XRD cohort schema")
    datasets = data.get("datasets")
    require(isinstance(datasets, list) and 1 <= len(datasets) <= 40, "Cohort size must be 1–40")
    criteria = data.get("criteria", {})
    tolerance = criteria.get("max_abs_peak_error_deg", 0.2)
    require(type(tolerance) in (float, int) and 0.005 <= tolerance <= 1.0, "Invalid tolerance")
    min_matches = criteria.get("minimum_matched_standard_peaks", 3)
    require(type(min_matches) is int and 2 <= min_matches <= 20, "Invalid minimum peak count")
    cohort = []
    instruments = set()
    standards = set()
    blinds = set()
    identifiers = set()
    all_numeric_pass = True
    root = manifest_path.parent
    for item in datasets:
        require(isinstance(item, dict), "Invalid dataset record")
        identifier = item.get("id")
        kind = item.get("kind")
        device = item.get("instrument_id")
        sample = item.get("sample_id")
        operator = item.get("operator_id")
        when = item.get("acquired_at")
        wavelength = item.get("wavelength_angstrom")
        require(isinstance(identifier, str) and re.fullmatch(r"[A-Za-z0-9_-]{2,80}", identifier)
                and identifier not in identifiers, "Missing or duplicate dataset ID")
        identifiers.add(identifier)
        require(kind in KINDS, "Unknown dataset kind")
        require(all(isinstance(value, str) and value.strip() and len(value) <= 160
                    for value in (device, sample, operator, when)), "Missing instrument/sample/operator/date")
        require(type(wavelength) in (float, int) and math.isfinite(wavelength)
                and 0.2 <= wavelength <= 5, "Invalid declared wavelength")
        require(item.get("two_theta_unit") == "deg", "Only measured 2theta degrees supported")
        require(isinstance(item.get("calibration_ref"), str)
                and item["calibration_ref"].strip(), "Calibration record reference required")
        instruments.add(device)
        require(item.get("synthetic") is False, "Synthetic data cannot be reported as a real cohort")
        scan = safe_file(root, item.get("scan"))
        points = scan_rows(scan)
        measured = extract_peaks(points, window=criteria.get("peak_window_samples", 16))
        result = {"id": identifier, "kind": kind, "instrument_id": device, "sample_id": sample,
                  "scan_sha256_verified": True, "sample_count": len(points),
                  "observed_peak_count": len(measured), "raw_file_digest": item["scan"]["sha256"],
                  "operator_identity_verified": False, "instrument_identity_verified": False,
                  "independent_calibration_verified": False}
        if kind == "reference-standard":
            standards.add(device)
            reference = safe_file(root, item.get("reference_document"))
            peaks = item.get("reference_peaks_two_theta_deg")
            require(isinstance(peaks, list) and min_matches <= len(peaks) <= 100
                    and all(type(p) in (int, float) and math.isfinite(p) and 0 < p < 180 for p in peaks)
                    and all(b > a for a, b in zip(peaks, peaks[1:])), "Invalid independently supplied reference positions")
            matches, unmatched = positions(peaks, measured, tolerance)
            errors = [abs(m["error_deg"]) for m in matches]
            passed = len(matches) >= min_matches and not unmatched
            all_numeric_pass &= passed
            result.update({"reference_document_sha256_verified": True,
                           "reference_source_claim": item.get("reference_source_claim", ""),
                           "reference_peaks": len(peaks), "matched_peaks": len(matches),
                           "unmatched_reference_peaks": unmatched, "peak_position_error_deg": errors,
                           "maximum_absolute_error_deg": max(errors, default=None),
                           "numerical_position_gate_passed": passed})
        else:
            blinds.add(device)
            result["numerical_position_gate_passed"] = None
            result["blind_result_not_unblinded"] = True
        cohort.append(result)
    layout_ok = len(instruments) >= 2 and standards == instruments and blinds == instruments
    return {"schema": REPORT, "manifest_sha256": sha(manifest_path),
            "datasets": cohort, "independent_instruments_claimed": len(instruments),
            "two_device_standard_and_blind_design_present": layout_ok,
            "numeric_position_gates_passed": bool(all_numeric_pass and layout_ok),
            "status": "review-required" if layout_ok and all_numeric_pass else "incomplete-or-numerical-failure",
            "scientific_acceptance": False,
            "why_not_accepted": ("File bytes and declared positions are internally checked; "
                                 "physical acquisition, reference authenticity, calibration, "
                                 "blind selection and device identities require independent attestation."),
            "limits": {"position_tolerance_deg": tolerance, "minimum_matched_standard_peaks": min_matches}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = assess(args.manifest)
    encoded = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        if args.output.resolve() == args.manifest.resolve():
            raise ValueError("Report must not overwrite the input manifest")
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")
    return 0 if result["two_device_standard_and_blind_design_present"] and result["numeric_position_gates_passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
