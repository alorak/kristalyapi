"""All XRD scan and native acquisition bytes in this suite are SYNTHETIC."""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"tools"),str(ROOT/"tests")]
import test_xrd_acceptance as fixture
from xrd_device_custody_gate import custody_review


def record(path):
    return {"path":path.name,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}


class XrdCustodyTests(unittest.TestCase):
    def setUp(self):
        self.base=fixture.XrdReviewTests("test_structural_review_never_becomes_scientific_acceptance")
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.root=self.base.root
        self.cohort=self.base.manifest
        self.custody=self.root/"custody.json"
        records=[]
        for dataset in self.base.data["datasets"]:
            id_=dataset["id"]
            # Tag the synthetic CSV with a unique comment to test reused-byte
            # detection without falsifying the numerical peak fixture.
            scan=self.root/dataset["scan"]["path"]
            scan.write_text("# synthetic acquisition "+id_+"\n"+scan.read_text())
            dataset["scan"]=record(scan)
            native=self.root/(id_+".xrdml")
            native.write_text("NOT REAL DEVICE BYTES -- SYNTHETIC "+id_)
            calibration=self.root/(dataset["instrument_id"]+"-calibration.txt")
            calibration.write_text("SYNTHETIC UNVERIFIED CALIBRATION "+dataset["instrument_id"])
            row={"dataset_id":id_,"sample_id":dataset["sample_id"],
                 "operator_id":dataset["operator_id"],
                 "instrument_serial":"SERIAL-"+dataset["instrument_id"],
                 "instrument_make_model":"fictional synthetic XRD",
                 "acquired_at_utc":"2026-11-01T01:02:03Z",
                 "wavelength_angstrom":dataset["wavelength_angstrom"],
                 "xray_source":"Cu-Kalpha",
                 "kalpha2_handling":"not-characterized",
                 "conversion_software":"synthetic converter 0.0",
                 "native_raw_file":record(native),
                 "calibration_document":record(calibration),
                 "standard_or_blind_protocol_id":"synthetic test protocol"}
            if dataset["kind"]=="reference-standard":
                row["standard_batch_id"]="synthetic-standard-001"
            else:
                blind=self.root/(id_+"-blind.txt")
                blind.write_text("SYNTHETIC BLIND LABEL "+id_)
                row["blind_protocol"]=record(blind)
            records.append(row)
        self.base.save()
        self.data={"schema":"kristalyapi.xrd-device-custody.v1",
                   "cohort_manifest_sha256":hashlib.sha256(self.cohort.read_bytes()).hexdigest(),
                   "records":records}
        self.save()
    def save(self):
        self.custody.write_text(json.dumps(self.data))
    def test_four_unique_acquisitions_are_only_internally_consistent(self):
        report=custody_review(self.cohort,self.custody)
        self.assertEqual(report["claimed_instrument_count"],2)
        self.assertTrue(report["numerical_standard_position_gate_passed"])
        self.assertTrue(report["unique_acquisition_file_hashes"])
        self.assertFalse(report["physical_device_independence_confirmed"])
        self.assertFalse(report["calibration_certificates_authenticated"])
        self.assertFalse(report["scientific_acceptance"])
    def test_reused_native_scan_under_separate_device_labels_is_rejected(self):
        r=self.data["records"]
        r[2]["native_raw_file"]=r[0]["native_raw_file"]
        self.save()
        with self.assertRaisesRegex(ValueError,"reused"):
            custody_review(self.cohort,self.custody)
    def test_duplicate_scan_csv_bytes_under_different_ids_is_rejected(self):
        first=self.base.data["datasets"][0]["scan"]["sha256"]
        other=self.base.data["datasets"][1]
        other["scan"]["sha256"]=first
        # Reuse actual CSV path and digest, so base hashes still match.
        other["scan"]["path"]=self.base.data["datasets"][0]["scan"]["path"]
        self.base.save()
        self.data["cohort_manifest_sha256"]=hashlib.sha256(self.cohort.read_bytes()).hexdigest()
        self.save()
        with self.assertRaisesRegex(ValueError,"reused"):
            custody_review(self.cohort,self.custody)
    def test_same_instrument_serial_declared_for_both_devices_fails(self):
        self.data["records"][2]["instrument_serial"]="SERIAL-device-A"
        self.save()
        with self.assertRaisesRegex(ValueError,"Same instrument serial"):
            custody_review(self.cohort,self.custody)
    def test_calibration_document_hash_is_rechecked(self):
        name=self.data["records"][0]["calibration_document"]["path"]
        (self.root/name).write_text("tampered")
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            custody_review(self.cohort,self.custody)
    def test_wrong_material_sample_id_fails(self):
        self.data["records"][0]["sample_id"]="different-sample"
        self.save()
        with self.assertRaisesRegex(ValueError,"sample ID"):
            custody_review(self.cohort,self.custody)
    def test_unpinned_blind_file_fails(self):
        self.data["records"][1].pop("blind_protocol")
        self.save()
        with self.assertRaisesRegex(ValueError,"File evidence"):
            custody_review(self.cohort,self.custody)
    def test_custody_manifest_requires_exact_cohort_hash(self):
        self.data["cohort_manifest_sha256"]="f"*64
        self.save()
        with self.assertRaisesRegex(ValueError,"not pinned"):
            custody_review(self.cohort,self.custody)


if __name__=="__main__":
    unittest.main()
