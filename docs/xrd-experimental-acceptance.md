# P1 experimental XRD review — evidence is not a certificate

**Status:** code/test preparation complete; no instrument measurement supplied and no physical claim accepted.

`python tools/xrd_acceptance.py --manifest /private/cohort/manifest.json --output /private/cohort/review.json`

The input is a JSON object with `schema: "kristalyapi.xrd-experimental-cohort.v1"`, `criteria`, and `datasets`. Supply **four or more genuinely measured scans**: one reference standard and one blinded sample from **each of two independently identified instruments**. Every record requires `id`, `kind` (`reference-standard` or `blind-sample`), `instrument_id`, `sample_id`, `operator_id`, `acquired_at`, `wavelength_angstrom`, `two_theta_unit: "deg"`, `calibration_ref`, `synthetic: false`, and a pinned `scan: {path, sha256}`. A standard additionally requires `reference_document: {path, sha256}`, a `reference_source_claim`, and a strictly increasing list of **independently supplied** `reference_peaks_two_theta_deg`. Paths are relative to the manifest; symlinks escaping that directory are rejected.

Example skeleton (placeholders are **not** a real cohort; `sha256` must be replaced by verified raw file digests):

```json
{
  "schema": "kristalyapi.xrd-experimental-cohort.v1",
  "criteria": {"max_abs_peak_error_deg": 0.2, "minimum_matched_standard_peaks": 3},
  "datasets": [
    {
      "id": "instrumentA-standard", "kind": "reference-standard",
      "instrument_id": "instrument-A", "sample_id": "standard-001",
      "operator_id": "operator-001", "acquired_at": "YYYY-MM-DD",
      "wavelength_angstrom": 1.5406, "two_theta_unit": "deg",
      "calibration_ref": "independent-standard-document-ID",
      "synthetic": false,
      "scan": {"path": "instrumentA-standard.csv", "sha256": "replace-with-64-lowercase-hex"},
      "reference_document": {"path": "reference-standard.pdf", "sha256": "replace-with-64-lowercase-hex"},
      "reference_source_claim": "standard certificate ID (operator claim only)",
      "reference_peaks_two_theta_deg": [20.0, 30.0, 40.0]
    }
  ]
}
```

The displayed peak positions above **only demonstrate JSON syntax**; they are not a certification reference. Add the other three real recordings to run a complete cohort. The CLI checks bounded CSV scans, ordered 2θ values, 4 MB / 50,000 point limits, SHA-256 of each supplied file, local-maximum positions, unique peak matches within the selected tolerance, and presence of two instruments with both types of sample. It reports numerical differences with explicit units.

**Critical scientific boundary:** `numeric_position_gates_passed` describes internal consistency with operator-supplied peak references only. Even a numerically passing cohort always has `scientific_acceptance: false`, `status: "review-required"`, because cryptographic hashes do not independently attest instrument identity, calibration, reference-standard authenticity, blind-selection protocol, Kα₂ handling, zero shift, texture, or Rietveld/phase validity. A forged `synthetic:false` label cannot establish real evidence. The committed tests deliberately use synthetic fixtures; no measured corpus is provided by this PR.

Manual final acceptance requires an independent instrument operator and materials scientist to check signed standard certificates, calibrated/raw scans, instrument settings and separate blinded repeats. Only then may an external approval process issue a separate signed decision.

Test with `python -m unittest discover -s tests -p 'test_xrd_acceptance.py' -v`.
