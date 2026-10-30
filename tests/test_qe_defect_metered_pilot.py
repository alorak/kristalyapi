"""D5.3 controlled single-candidate metered initialization — no real QE execution in CI."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import qe_defect_metered_pilot as d5


class MeteredPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import qe_defect_resource_review as review
        cls.case=json.loads((review.PREPARED/"preparation.json").read_text())["cases"][0]

    def test_plan_only_uses_real_preparation_and_never_calls_docker(self):
        with patch.object(d5,"command",side_effect=AssertionError("Docker must not run")):
            self.assertEqual(d5.main(["--case","V_S"]),0)
        expected,upf,candidate,review=d5.pinned_input("V_S")
        self.assertEqual(candidate["id"],"V_S")
        self.assertIn(" nstep=0,",expected)
        self.assertIn(" nbnd=416,",expected)
        self.assertEqual(set(upf),{"Mo","S"})
        self.assertEqual(review["original_oom_case_count"],4)

    def test_execution_requires_two_explicit_flags_and_pinned_local_inputs(self):
        # Reject a possible accidental resource-heavy action before any
        # subprocess, Docker Engine or network access.
        for args in (
            ["--execute"],
            ["--execute","--acknowledge-resource-risk"],
            ["--execute","--acknowledge-resource-risk","--pseudo-dir","/tmp/nonexistent"],
            ["--acknowledge-resource-risk"],
        ):
            with self.subTest(args=args), patch.object(
                d5,"command",side_effect=AssertionError("should not run")):
                with self.assertRaises(SystemExit):
                    d5.main(args)
        for case in ("../escape","O_2","Si"):
            with self.assertRaises(ValueError):
                d5.checked_settings(case,d5.review.IMAGE_ID,"arm64",96,4,2,180)

    def test_bounded_config_and_argv_no_shell_or_network(self):
        cfg=d5.checked_settings("pristine",d5.review.IMAGE_ID,"arm64",96,4,2,180)
        args=d5.make_docker_create(cfg,Path("/safe/output/evidence"),
                                   Path("/safe/output/inputs"),Path("/safe/pseudos"),
                                   "kristalyapi-d5-test")
        self.assertEqual(args[0:2],["docker","create"])
        self.assertNotIn("sh",args)
        self.assertNotIn("-c",args[:args.index("python3")])
        self.assertIn("none",args)
        self.assertIn("--read-only",args)
        self.assertIn("--cap-drop",args)
        self.assertIn("ALL",args)
        self.assertIn("--memory-swap",args)
        self.assertEqual(args[args.index("--memory-swap")+1],str(96*1024**3))
        self.assertIn("PYTHONDONTWRITEBYTECODE=1",args)
        self.assertIn("--user",args)
        self.assertEqual(args[-3], "python3")
        self.assertEqual(args[-2], "-c")
        self.assertIn("memory.peak",args[-1])
        self.assertIn("cpu.stat",args[-1])
        self.assertIn("oom_kill",args[-1])
        for settings in ((6,4,2,180),(16,9,2,180),(96,4,0,180),
                         (96,4,2,901),(513,4,2,180)):
            with self.subTest(settings=settings),self.assertRaises(ValueError):
                d5.checked_settings("pristine",d5.review.IMAGE_ID,"arm64",*settings)
        with self.assertRaises(ValueError):
            d5.checked_settings("pristine","qe:latest","arm64",96,4,2,180)

    def test_actual_inspection_checks_memory_cpu_network_and_readonly(self):
        cfg=d5.checked_settings("pristine",d5.review.IMAGE_ID,"arm64",96,4,2,180)
        info={"HostConfig":{"Memory":cfg["memory_bytes"],"MemorySwap":cfg["memory_bytes"],
              "NanoCpus":2*10**9,"NetworkMode":"none","ReadonlyRootfs":True,
              "PidsLimit":128},
              "State":{"ExitCode":0,"OOMKilled":False}}
        result=d5.check_container_config(info,cfg)
        self.assertEqual(result["memory_bytes"],96*1024**3)
        for field,value in [("MemorySwap",0),("NanoCpus",3*10**9),("NetworkMode","bridge"),
                            ("ReadonlyRootfs",False),("PidsLimit",0)]:
            info["HostConfig"][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):
                d5.check_container_config(info,cfg)
            info["HostConfig"][field]={"MemorySwap":cfg["memory_bytes"],
                "NanoCpus":2*10**9,"NetworkMode":"none","ReadonlyRootfs":True,
                "PidsLimit":128}[field]

    def test_measured_qualification_never_claims_scf_and_rejects_missing_cgroup(self):
        case=self.case
        raw=("Program PWSCF v.6.7MaX\nnumber of atoms/cell = 48\n"
             "number of electrons = 416.0\nnumber of Kohn-Sham states=416\n"
             "JOB DONE.\n")
        report={"memory_bytes":96*1024**3,"timeout_seconds":180,"exit_code":0,
                "oom_killed":False}
        metrics={"schema":"kristalyapi.qe-d5-container-metrics.v1",
                 "memory_peak_bytes":2*1024**3,"memory_limit_bytes":96*1024**3,
                 "swap_limit_bytes":0,"cpu_usage_usec_delta":12000,
                 "scratch_used_peak_bytes":1024,"elapsed_seconds":2,
                 "qe_returncode":0,"oom_kill_delta":0}
        self.assertEqual(d5.evaluated_status(report,raw,metrics,case),"initialized_only_metered")
        self.assertEqual(d5.evaluated_status(report,raw,None,case),"incomplete_resource_evidence")
        for change in (
            {"memory_peak_bytes":None},{"memory_limit_bytes":4*1024**3},
            {"swap_limit_bytes":5},{"cpu_usage_usec_delta":None},
            {"scratch_used_peak_bytes":-1},{"qe_returncode":1},
        ):
            broken={**metrics,**change}
            with self.subTest(change=change):
                self.assertEqual(d5.evaluated_status(report,raw,broken,case),
                                 "incomplete_resource_evidence")
        self.assertEqual(d5.evaluated_status({...report,"oom_killed":True},raw,metrics,case),
                         "oom_observed")
        self.assertEqual(d5.evaluated_status({...report,"timed_out":True},raw,metrics,case),
                         "timed_out")
        self.assertEqual(d5.evaluated_status(report,raw+"! total energy = -9 Ry",metrics,case),
                         "invalid_initialization_proof")
        self.assertEqual(d5.evaluated_status({...report,"exit_code":137},raw,metrics,case),
                         "failed")

    def test_image_and_pseudopotential_checks_fail_closed(self):
        import qe_defect_resource_review as review
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            upf={"Mo":{"file":"Mo.UPF","sha256":d5.sha(b"something"*4)}}
            (folder/"Mo.UPF").write_bytes(b"something"*4)
            self.assertEqual(d5.checked_pseudos(folder,upf)["Mo"]["sha256"],upf["Mo"]["sha256"])
            (folder/"Mo.UPF").write_bytes(b"mismatch"*4)
            with self.assertRaisesRegex(ValueError,"mismatched"):
                d5.checked_pseudos(folder,upf)
            (folder/"Mo.UPF").unlink()
            (folder/"Mo.UPF").symlink_to(Path(tmp)/"random")
            with self.assertRaisesRegex(ValueError,"Missing/unsafe"):
                d5.checked_pseudos(folder,upf)
        with patch.object(d5,"command",side_effect=[
            json.dumps([{"Id":review.IMAGE_ID,"Architecture":"arm64"}]).encode(),
            json.dumps({"MemTotal":128*1024**3,"NCPU":8}).encode()
        ]) as cmd:
            facts=d5.inspect_image(review.IMAGE_ID,"arm64",96*1024**3,2)
            self.assertEqual(facts["daemon_cpus"],8)
            self.assertEqual(cmd.call_count,2)
        with patch.object(d5,"command",return_value=json.dumps([
            {"Id":review.IMAGE_ID,"Architecture":"amd64"}]).encode()):
            with self.assertRaisesRegex(ValueError,"architecture changed"):
                d5.inspect_image(review.IMAGE_ID,"arm64",96*1024**3,2)


if __name__=="__main__":unittest.main()
