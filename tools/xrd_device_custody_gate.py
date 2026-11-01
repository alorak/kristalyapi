#!/usr/bin/env python3
"""Additional raw-device/chain-of-custody checks for the two-instrument XRD study.

The underlying XRD numerical gate is reused. No device, signature or
calibration certificate is independently authenticated by these checks.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from xrd_acceptance import assess, safe_file, require

SCHEMA = "kristalyapi.xrd-device-custody.v1"
HEX = re.compile(r"^[0-9a-f]{64}$")


def nonempty(value,field,maximum=250):
    require(isinstance(value,str) and 2<=len(value.strip())<=maximum,
            "Missing or invalid "+field)
    return value.strip()


def timestamp(value):
    nonempty(value,"acquired_at UTC")
    require(value.endswith("Z"),"Expected UTC ISO-8601 Z timestamp")
    try:
        result=datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError as error:
        raise ValueError("Invalid UTC acquisition timestamp") from error
    require(result.tzinfo is not None,"Invalid UTC acquisition timezone")
    return value


def custody_review(cohort_manifest, custody_manifest):
    cohort_manifest=Path(cohort_manifest).resolve()
    custody_manifest=Path(custody_manifest).resolve()
    data=json.loads(custody_manifest.read_text(encoding="utf8"))
    require(data.get("schema")==SCHEMA,"Invalid XRD device custody schema")
    expected=hashlib.sha256(cohort_manifest.read_bytes()).hexdigest()
    require(data.get("cohort_manifest_sha256")==expected,
            "Custody manifest is not pinned to original cohort")
    numerical=assess(cohort_manifest)
    cohort=json.loads(cohort_manifest.read_text(encoding="utf8"))
    datasets=cohort["datasets"]
    refs=data.get("records")
    require(isinstance(refs,list) and len(refs)==len(datasets) and 4<=len(refs)<=40,
            "Every cohort scan must have its own raw acquisition record")
    by_id={row["id"]:row for row in datasets}
    claimed={row.get("dataset_id") for row in refs if isinstance(row,dict)}
    require(len(claimed)==len(refs) and claimed==set(by_id),
            "Missing/duplicate scan custody record")
    instruments={}
    serials={}
    csv_hashes=set()
    native_hashes=set()
    records=[]
    for record in refs:
        dataset=by_id[record["dataset_id"]]
        ident=dataset["instrument_id"]
        serial=nonempty(record.get("instrument_serial"),"serial number")
        make=nonempty(record.get("instrument_make_model"),"instrument make/model")
        require(serial not in serials or serials[serial]==ident,
                "Same instrument serial claimed under multiple device IDs")
        serials[serial]=ident
        identity=(serial,make)
        require(ident not in instruments or instruments[ident]==identity,
                "Device identity changed between standard and blind acquisition")
        instruments[ident]=identity
        require(nonempty(record.get("sample_id"),"sample ID")==dataset["sample_id"],
                "Measured sample ID does not bind to XRD cohort")
        nonempty(record.get("operator_id"),"operator ID")
        require(record["operator_id"]==dataset["operator_id"],
                "Recorded operator differs from cohort claim")
        timestamp(record.get("acquired_at_utc"))
        lambda_ang=record.get("wavelength_angstrom")
        require(type(lambda_ang) in (float,int) and
                abs(lambda_ang-dataset["wavelength_angstrom"])<=1e-7,
                "Source wavelength differs between custody and scan")
        line=record.get("xray_source")
        require(line in ("Cu-Kalpha","Co-Kalpha","Mo-Kalpha","Cr-Kalpha","other-declared"),
                "Explicit source anode is required")
        handling=record.get("kalpha2_handling")
        require(handling in ("recorded-doublet","optically-monochromated",
                             "software-stripped-with-protocol","not-characterized"),
                "Kalpha2 status must be explicitly reported")
        nonempty(record.get("conversion_software"),"CSV converter version")
        native=safe_file(custody_manifest.parent,record.get("native_raw_file"))
        calibration=safe_file(custody_manifest.parent,record.get("calibration_document"))
        native_digest=hashlib.sha256(native.read_bytes()).hexdigest()
        calibrated_digest=hashlib.sha256(calibration.read_bytes()).hexdigest()
        csv_digest=dataset["scan"]["sha256"]
        require(native_digest != csv_digest,
                "Native raw file must be independently preserved from derivative CSV")
        require(csv_digest not in csv_hashes and native_digest not in native_hashes,
                "A raw scan was reused for another purported acquisition")
        csv_hashes.add(csv_digest)
        native_hashes.add(native_digest)
        nonempty(record.get("standard_or_blind_protocol_id"),
                 "independent standard/blind protocol reference")
        if dataset["kind"]=="reference-standard":
            nonempty(record.get("standard_batch_id"),"certified standard batch")
            require(record.get("blind_protocol") is None,
                    "Standard is not a blind sample")
        else:
            protocol=safe_file(custody_manifest.parent,record.get("blind_protocol"))
            require(hashlib.sha256(protocol.read_bytes()).hexdigest()!=native_digest,
                    "Blind protocol and native data must be separate files")
        records.append({
            "dataset_id":record["dataset_id"],"device_id_claim":ident,
            "instrument_serial_claim":serial,
            "kind":dataset["kind"],"raw_file_sha256_verified":True,
            "csv_sha256_verified_by_cohort":True,
            "calibration_file_sha256_verified":True,
            "calibration_digest":calibrated_digest,
            "claimed_acquisition_utc":record["acquired_at_utc"],
            "source_line_claim":line,"kalpha2_handling_claim":handling,
            "raw_to_csv_conversion_physically_verified":False,
            "independent_instrument_identity_verified":False,
            "blind_selection_independently_verified":False})
    require(len(instruments)>=2,"At least two independently numbered devices required")
    return {"schema":"kristalyapi.xrd-device-custody-review.v1",
            "cohort_sha256":expected,"custody_manifest_sha256":
             hashlib.sha256(custody_manifest.read_bytes()).hexdigest(),
            "claimed_instrument_count":len(instruments),
            "unique_acquisition_file_hashes":True,
            "same_raw_bytes_reuse_rejected":True,
            "numerical_standard_position_gate_passed":
             numerical["numeric_position_gates_passed"],
            "records":records,
            "physical_device_independence_confirmed":False,
            "calibration_certificates_authenticated":False,
            "blind_randomization_verified":False,
            "scientific_acceptance":False,
            "review_required":[
                "Different instrument serial labels and hashes are not proof of two physical devices.",
                "Native-to-CSV transformation has not been independently reproduced.",
                "Instrument calibration, standard batch provenance and blind protocol require lab/reviewer signoff.",
                "Synthetic fixtures must never be represented as experimental validation."]}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cohort",required=True,type=Path)
    p.add_argument("--custody",required=True,type=Path)
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    outcome=custody_review(args.cohort,args.custody)
    value=json.dumps(outcome,ensure_ascii=False,indent=2)+"\n"
    if args.output:
        require(args.output.resolve() not in (args.cohort.resolve(),args.custody.resolve()),
                "Output cannot overwrite source input")
        args.output.write_text(value,encoding="utf8")
    else:
        print(value,end="")
    return 0 if outcome["numerical_standard_position_gate_passed"] else 2


if __name__=="__main__":
    raise SystemExit(main())
