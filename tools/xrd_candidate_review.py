#!/usr/bin/env python3
"""P1.2 conservative multiple-reference XRD screening.

Uses the prerequisite two-instrument cohort reviewer. Reports position
residuals only: NEVER an automatic phase identification, zero-shift correction,
Rietveld refinement, calibration or real measurement attestation.
"""
import argparse
import hashlib
import json
import math
import re
import statistics
from pathlib import Path

from xrd_acceptance import assess, safe_file, scan_rows, extract_peaks, positions, require

SCHEMA = "kristalyapi.xrd-experimental-cohort.v1"


def _candidate_record(root, candidate, criteria):
    require(isinstance(candidate, dict), "Invalid reference candidate")
    identity = candidate.get("id")
    require(isinstance(identity, str) and re.fullmatch(r"[A-Za-z0-9_-]{2,80}", identity),
            "Candidate needs a stable identifier")
    source = candidate.get("source_reference")
    require(isinstance(source, str) and 0 < len(source.strip()) <= 300,
            "Independent candidate reference required")
    reference = safe_file(root, candidate.get("reference_document"))
    wavelength = candidate.get("wavelength_angstrom")
    require(type(wavelength) in (int, float) and math.isfinite(wavelength) and
            .2 <= wavelength <= 5, "Invalid reference wavelength")
    angles = candidate.get("reference_peaks_two_theta_deg")
    minimum = criteria.get("minimum_matched_standard_peaks", 3)
    require(isinstance(angles, list) and minimum <= len(angles) <= 150 and
            all(type(v) in (int, float) and math.isfinite(v) and 0 < v < 180
                for v in angles) and all(b > a for a, b in zip(angles, angles[1:])),
            "Reference peaks require strictly increasing independent positions")
    return {"id": identity, "sourceReferenceClaim": source,
            "referenceDocumentSha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
            "wavelengthAngstrom": wavelength, "peaksTwoThetaDeg": angles}


def review_candidates(path):
    path = Path(path).resolve()
    data = json.loads(path.read_text(encoding="utf8"))
    require(data.get("schema") == SCHEMA, "Invalid XRD cohort manifest")
    cohort = assess(path)
    criteria = data.get("criteria") or {}
    tol = criteria.get("max_abs_peak_error_deg", .2)
    refs = data.get("reference_candidates")
    require(isinstance(refs, list) and 1 <= len(refs) <= 20,
            "Expected 1–20 independent reference candidates")
    candidates = [_candidate_record(path.parent, item, criteria) for item in refs]
    ids = [item["id"] for item in candidates]
    require(len(set(ids)) == len(ids), "Duplicate candidate identifiers")

    result = {"schema": "kristalyapi.xrd-candidate-position-review.v1",
              "cohortManifestSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
              "cohortStandardNumericGatePassed": cohort["numeric_position_gates_passed"],
              "candidateReferences": [{"id": c["id"], "sourceReferenceClaim": c["sourceReferenceClaim"],
                                       "referenceDocumentSha256": c["referenceDocumentSha256"]}
                                      for c in candidates],
              "samples": [], "scientificAcceptance": False, "phaseIdentified": False,
              "instrumentCalibrated": False,
              "zeroShiftAutomaticallyCorrected": False,
              "limits": [
                  "Numerical reference matching requires a complete two-device standard/blind cohort.",
                  "Sources and device identities remain operator-supplied, not certified by the program.",
                  "Median peak offset is a diagnostic, NOT a calibrated zero-shift correction.",
                  "Overlapping phases, texture, Kalpha doublets, broadening and baseline are not resolved.",
                  "Matched counts are not phase probabilities, fractions or product acceptance."]}
    if not cohort["numeric_position_gates_passed"]:
        result["status"] = "skipped-standard-numerical-gate-failed"
        return result
    root = path.parent
    for dataset in data["datasets"]:
        if dataset["kind"] != "blind-sample":
            continue
        raw = safe_file(root, dataset["scan"])
        measured = extract_peaks(scan_rows(raw), window=criteria.get("peak_window_samples", 16))
        rows = []
        for c in candidates:
            mismatch = abs(c["wavelengthAngstrom"] - dataset["wavelength_angstrom"])
            if mismatch > .0005:
                rows.append({"candidateId": c["id"], "status": "skipped-wavelength-incompatible",
                             "wavelengthDifferenceAngstrom": mismatch})
                continue
            matches, missing = positions(c["peaksTwoThetaDeg"], measured, tol)
            residual = [m["error_deg"] for m in matches]
            median = statistics.median(residual) if residual else None
            mad = statistics.median([abs(x-median) for x in residual]) if residual else None
            observed_matched = {m["measured_two_theta_deg"] for m in matches}
            rows.append({"candidateId": c["id"], "status": "position-screen-only",
                         "referencePeakCount": len(c["peaksTwoThetaDeg"]),
                         "matchedReferencePeakCount": len(matches),
                         "unmatchedReferencePeakCount": len(missing),
                         "unmatchedObservedPeakCount":
                          sum(peak["two_theta_deg"] not in observed_matched for peak in measured),
                         "medianSignedPositionOffsetDeg": median,
                         "medianAbsoluteDeviationDeg": mad,
                         "maximumAbsolutePositionResidualDeg":
                          max((abs(x) for x in residual), default=None),
                         "positionCoverageFraction": len(matches)/len(c["peaksTwoThetaDeg"]),
                         "matchedPairs": matches,
                         "zeroShiftCertified": False, "phaseIdentityCertified": False})
        result["samples"].append({"sampleId": dataset["sample_id"],
                                  "instrumentId": dataset["instrument_id"],
                                  "declaredWavelengthAngstrom": dataset["wavelength_angstrom"],
                                  "observedPeakCount": len(measured),
                                  "candidateScreens": rows})
    result["status"] = "position-screen-only-independent-physical-review-required"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = review_candidates(args.manifest)
    text = json.dumps(report, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    if args.output:
        if args.output.resolve() == args.manifest.resolve():
            raise ValueError("Output must not replace the input manifest")
        args.output.write_text(text, encoding="utf8")
    else:
        print(text, end="")
    return 0 if report["cohortStandardNumericGatePassed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
