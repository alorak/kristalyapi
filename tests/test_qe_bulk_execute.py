"""Offline bulk-runner tests use a temporary fake executable, NOT Quantum ESPRESSO."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"tools"),str(ROOT/"tests")]
import test_qe_bulk_validation as fixture
from qe_bulk_execute import execute,prepare

class BulkOfflineRunnerTests(unittest.TestCase):
    def setUp(self):
        self.base=fixture.BulkEvidenceTests("test_4_stage_3d_and_hash_consistency_do_not_certify_science")
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.root=self.base.root
        # Convert the existing synthetic QC fixture to an explicit execution plan.
        data=self.base.data
        data["schema"]="kristalyapi.qe-bulk-run-plan.v1"
        for key in ("baseline","ecut-refined","k-refined","bands"):
            src=self.root/(key+".in")
            body=src.read_text()
            body=body.replace(" calculation='", " prefix='bulk', pseudo_dir='./pseudo', outdir='./scratch',\n calculation='")
            src.write_text(body)
            data["runs"][key]={"input":self.base.record(key+".in")}
        self.plan=self.root/"run-plan.json"
        self.plan.write_text(json.dumps(data))
        self.target=self.root/"completed-bulk-run"
        self.binary=self.root/"FAKE-DO-NOT-USE-AS-QE"
        self.binary.write_text("""#!/usr/bin/env python3
import sys,re
source=sys.stdin.read()
bands="calculation='bands'" in source
print("Program PWSCF v.7.2")
if not bands:
    ecut=float(re.search(r'ecutwfc=(\\d+)',source).group(1))
    mesh=re.search(r'K_POINTS automatic\\s*(\\d+) (\\d+) (\\d+)',source)
    kx=int(mesh.group(1))
    energy=-100.00003 if ecut>45 else (-100.00004 if kx>8 else -100)
    print("convergence has been achieved in 8 iterations")
    print("! total energy = %.9f Ry" % energy)
    print("estimated scf accuracy < 1.0E-9 Ry")
print("JOB DONE.")
""")
        self.binary.chmod(0o700)
    def save(self):
        self.plan.write_text(json.dumps(self.base.data))
    def test_fake_pipeline_runs_four_stages_and_verifies_raw_evidence_without_science_claim(self):
        manifest=prepare(self.plan)
        self.assertEqual(set(manifest["inputs"]),{"baseline","ecut-refined","k-refined","bands"})
        report=execute(self.plan,self.target,self.binary,20,enabled=True)
        self.assertTrue(report["software_numeric_gates_passed"])
        self.assertFalse(report["scientific_acceptance"])
        self.assertFalse(report["localExecution"]["realQeBinaryIdentityAuthenticated"])
        self.assertTrue((self.target/"manifest.json").exists())
        for key in ("baseline","ecut-refined","k-refined","bands"):
            self.assertTrue((self.target/"stages"/(key+".out")).exists())
        with self.assertRaisesRegex(ValueError,"fresh"):
            execute(self.plan,self.target,self.binary,20,enabled=True)
    def test_execution_requires_explicit_operator_consent(self):
        with self.assertRaisesRegex(ValueError,"--execute"):
            execute(self.plan,self.target,self.binary,20,enabled=False)
        self.assertFalse(self.target.exists())
    def test_reject_unsafe_pseudo_dir_even_when_all_hashes_match(self):
        src=self.root/"baseline.in"
        src.write_text(src.read_text().replace("pseudo_dir='./pseudo'","pseudo_dir='/tmp/foreign'"))
        self.base.data["runs"]["baseline"]["input"]=self.base.record("baseline.in")
        self.save()
        with self.assertRaisesRegex(ValueError,"pseudo_dir"):
            prepare(self.plan)
    def test_reject_wrong_binary_species_and_unpinned_input(self):
        src=self.root/"bands.in"
        src.write_text(src.read_text().replace("Ga.upf","untracked.upf"))
        self.base.data["runs"]["bands"]["input"]=self.base.record("bands.in")
        self.save()
        with self.assertRaisesRegex(ValueError,"pseudopotentials"):
            prepare(self.plan)
        self.base.data["runs"]["bands"]["input"]["sha256"]="b"*64
        self.save()
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            prepare(self.plan)
    def test_subprocess_failure_does_not_generate_verified_manifest(self):
        self.binary.write_text("#!/usr/bin/env python3\nprint('Program PWSCF v.7.2')\nprint('Error in routine')\n")
        self.binary.chmod(0o700)
        with self.assertRaisesRegex(ValueError,"did not finish"):
            execute(self.plan,self.target,self.binary,20,enabled=True)
        self.assertFalse((self.target/"manifest.json").exists())

if __name__=="__main__":
    unittest.main()
