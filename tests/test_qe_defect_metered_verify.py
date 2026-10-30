"""Independent, offline D5.3 artifact cross-check. No QE or Docker in tests."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import qe_defect_metered_pilot as pilot
import qe_defect_metered_verify as check
import qe_defect_init as init
import qe_defect_resource_review as review


class MeteredEvidenceTests(unittest.TestCase):
    def fixture(self,path):
        inp,_,candidate,_=pilot.pinned_input("pristine")
        settings=pilot.checked_settings("pristine",review.IMAGE_ID,"arm64",96,4,2,180)
        raw=("Program PWSCF v.6.7MaX\nnumber of atoms/cell = 48\n"
             "number of electrons = 416.0\nnumber of Kohn-Sham states=416\n"
             "JOB DONE.\n")
        metrics={"schema":"kristalyapi.qe-d5-container-metrics.v1",
                 "memory_peak_bytes":3*1024**3,
                 "memory_limit_bytes":settings["memory_bytes"],
                 "swap_limit_bytes":0,
                 "cpu_usage_usec_delta":10000,
                 "scratch_used_peak_bytes":4096,
                 "elapsed_seconds":12.5,"qe_returncode":0,"oom_kill_delta":0}
        inputs=path/"inputs";inputs.mkdir()
        evidence=path/"evidence";evidence.mkdir()
        (inputs/"initialization.in").write_text(inp)
        (evidence/"initialization.out").write_text(raw)
        (evidence/"initialization.stderr").write_text("")
        (evidence/"container-metrics.json").write_text(json.dumps(metrics))
        (evidence/"docker-start.stdout").write_text("")
        (evidence/"docker-start.stderr").write_text("")
        data={"schema":pilot.SCHEMA,"settings":settings,
              "source_preparation_sha256":review.PREPARED_SHA,
              "source_pilot_commit":review.PILOT_COMMIT,
              "scientific_convergence_accepted":False,
              "full_scf_resource_validated":False,
              "initialization_only":True,"calculation_performed":False,
              "container_removed":True,"oom_killed":False,"exit_code":0,
              "raw_qe_diagnostics":init.initialization_diagnostics(raw),
              "resource_measurements":metrics,
              "cgroup_memory_peak_bytes":metrics["memory_peak_bytes"],
              "memory_bytes":settings["memory_bytes"],
              "timeout_seconds":settings["timeout_seconds"],
              "status":"initialized_only_metered"}
        data["artifact_sha256"]={
            p.relative_to(path).as_posix():pilot.sha(p.read_bytes())
            for directory in (inputs,evidence) for p in directory.iterdir()
        }
        (path/"report.json").write_text(json.dumps(data))
        return data

    def test_verified_measured_initialization_still_not_scf_acceptance(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            self.fixture(folder)
            result=check.verify(folder)
            self.assertTrue(result["initialization_only_accepted"])
            self.assertTrue(result["artifacts_sha256_verified"])
            self.assertEqual(result["artifact_count"],6)
            self.assertFalse(result["full_scf_resource_validated"])
            self.assertFalse(result["scientific_convergence_accepted"])

    def test_tampered_output_and_renamed_or_untracked_evidence_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            self.fixture(folder)
            file=folder/"evidence/initialization.out"
            file.write_text(file.read_text()+"\n! total energy = -100 Ry\n")
            with self.assertRaisesRegex(ValueError,"SHA-256 mismatch"):
                check.verify(folder)
            file.write_text("fake")
            report=json.loads((folder/"report.json").read_text())
            report["artifact_sha256"]["evidence/initialization.out"]=pilot.sha(file.read_bytes())
            (folder/"report.json").write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError,"Raw QE diagnostics"):
                check.verify(folder)
            file.unlink()
            file.symlink_to(folder/"report.json")
            with self.assertRaisesRegex(ValueError,"symlink"):
                check.verify(folder)

    def test_fake_resource_metrics_and_scientific_acceptance_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);self.fixture(folder)
            report_file=folder/"report.json"
            data=json.loads(report_file.read_text())
            data["scientific_convergence_accepted"]=True
            report_file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,"scientific-acceptance"):
                check.verify(folder)
            data["scientific_convergence_accepted"]=False
            data["cgroup_memory_peak_bytes"]=1
            report_file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,"success cannot be proven"):
                check.verify(folder)
            data["cgroup_memory_peak_bytes"]=data["resource_measurements"]["memory_peak_bytes"]
            evidence=folder/"evidence/container-metrics.json"
            metrics=json.loads(evidence.read_text())
            metrics["memory_peak_bytes"]=None
            evidence.write_text(json.dumps(metrics))
            data["artifact_sha256"]["evidence/container-metrics.json"]=pilot.sha(evidence.read_bytes())
            data["resource_measurements"]=metrics
            report_file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,"success cannot be proven"):
                check.verify(folder)


if __name__=="__main__":unittest.main()
