"""D2.2 negative evidence tests, all outputs SYNTHETIC (not QE results)."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
sys.path.insert(0,str(ROOT/"server"))

spec = importlib.util.spec_from_file_location("qe_mos2_acceptance",ROOT/"tools/qe_mos2_acceptance.py")
mos2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mos2)
from job_core import make_pw_input


class MoS2PlanAndEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.plan=mos2.locked_plan("a"*64,"b"*64)
        self.case=self.plan["cases"][0]
        self.request=mos2.make_request(self.plan,self.case)
        mock_upf={"Mo":{"file":"Mo.UPF"},"S":{"file":"S.UPF"}}
        self.raw_input=make_pw_input(self.request,mock_upf).encode("utf-8")
        self.raw_output=(
            "Program PWSCF v.6.7MaX starts\n"
            "convergence has been achieved in 8 iterations\n"
            "!    total energy = -12.34567890 Ry\n"
            "estimated scf accuracy < 2.2E-09 Ry\n"
            "JOB DONE.\n"
        ).encode("utf-8")
        jobid="f"*32
        h=mos2.structure_hash(self.request["structure"])
        self.result={"job_id":jobid,"structure_hash":h,
                     "input_sha256":mos2.sha(self.raw_input),
                     "output_sha256":mos2.sha(self.raw_output),
                     "pseudopotentials":{"Mo":{"sha256":"a"*64},"S":{"sha256":"b"*64}},
                     "engine":"quantum-espresso","engine_version":"6.7MaX",
                     "scf_converged":True,"job_done":True,
                     "energy_ry":-12.34567890,
                     "energy_ev":-12.34567890*mos2.RY_TO_EV}
        self.trace={"validation":{"valid":True,"structure_hash":h},
                    "submitted":{"job_id":jobid,"status":"queued","structure_hash":h},
                    "terminal":{"job_id":jobid,"status":"completed","structure_hash":h},
                    "staged_upf_sha256":{"Mo":"a"*64,"S":"b"*64}}

    def check(self):
        return mos2.check_case(self.plan,self.case,self.request,self.result,
                               self.raw_input,self.raw_output,self.trace)

    def test_predefined_plan_has_hexagonal_three_atom_geometry_and_2d_mesh(self):
        self.assertEqual(len(self.plan["cases"]),7)
        for item in self.plan["cases"]:
            structure=mos2.structure(self.plan,item)
            self.assertEqual([x["element"] for x in structure["atoms"]],["Mo","S","S"])
            self.assertEqual(item["kpoints"][-1],1)
            self.assertEqual(structure["cell_angstrom"][2][2],item["vacuum_cell_c_angstrom"])
            top,bottom=structure["atoms"][1:3]
            self.assertAlmostEqual(
                (top["fractional"][2]-bottom["fractional"][2])*item["vacuum_cell_c_angstrom"],3.12)
        self.assertEqual(len(self.plan["criteria"]["comparisons"]),3)

    def test_locked_hashes_mandatory_before_real_run(self):
        for mo,s in (("","b"*64),("wrong","b"*64),("a"*64,None)):
            with self.assertRaisesRegex(ValueError,"SHA-256"):
                mos2.locked_plan(mo,s)

    def test_mock_complete_evidence_contract(self):
        got=self.check()
        self.assertAlmostEqual(got["energy_ry"],-12.34567890)
        self.assertEqual(got["scf_iterations"],8)
        self.assertEqual(got["structure_hash"],self.result["structure_hash"])

    def test_reject_mutated_output_hash_and_fabricated_energy(self):
        self.result["output_sha256"]="0"*64
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            self.check()
        self.result["output_sha256"]=mos2.sha(self.raw_output)
        self.result["energy_ry"]=-10
        with self.assertRaisesRegex(ValueError,"energy differs"):
            self.check()

    def test_reject_wrong_upf_and_structure(self):
        self.trace["staged_upf_sha256"]["Mo"]="f"*64
        with self.assertRaisesRegex(ValueError,"staged UPF"):
            self.check()
        self.trace["staged_upf_sha256"]["Mo"]="a"*64
        self.request["structure"]["atoms"][0]["fractional"]=[.1,0,.5]
        with self.assertRaisesRegex(ValueError,"Request is inconsistent"):
            self.check()

    def test_reject_missing_scf_accuracy_and_incomplete_job(self):
        self.raw_output=self.raw_output.replace(b"estimated scf accuracy < 2.2E-09 Ry",b"")
        self.result["output_sha256"]=mos2.sha(self.raw_output)
        with self.assertRaisesRegex(ValueError,"Missing raw QE"):
            self.check()
        self.raw_output+=b"estimated scf accuracy < 9.0E-08 Ry\n"
        self.result["output_sha256"]=mos2.sha(self.raw_output)
        with self.assertRaisesRegex(ValueError,"SCF accuracy failed"):
            self.check()
        self.result["scf_converged"]=False
        with self.assertRaisesRegex(ValueError,"Solver status"):
            self.check()

    def test_reject_incorrect_k_mesh_and_vacuum_cell(self):
        modified=self.raw_input.replace(b"K_POINTS automatic\n8 8 1 0 0 0",
                                        b"K_POINTS automatic\n8 8 8 0 0 0")
        self.raw_input=modified
        self.result["input_sha256"]=mos2.sha(self.raw_input)
        with self.assertRaisesRegex(ValueError,"2D gamma-centered"):
            self.check()
        self.raw_input=self.raw_input.replace(b"K_POINTS automatic\n8 8 8 0 0 0",
                                              b"K_POINTS automatic\n8 8 1 0 0 0")
        self.raw_input=self.raw_input.replace(b"0.0000000000 0.0000000000 24.0000000000",
                                              b"0.0000000000 0.0000000000 10.0000000000")
        self.result["input_sha256"]=mos2.sha(self.raw_input)
        with self.assertRaisesRegex(ValueError,"cell differs"):
            self.check()

    def test_comparison_threshold_predeclared_and_fail_closed(self):
        items=[]
        for case in self.plan["cases"]:
            proof={"energy_ry":-12.0}
            items.append({**case,"proof":proof})
        differences=mos2.comparisons(items,self.plan)
        self.assertTrue(all(x["passed"] for x in differences))
        items[2]["proof"]["energy_ry"]=-11.0
        differences=mos2.comparisons(items,self.plan)
        self.assertFalse(differences[0]["passed"])

    def test_offline_verify_rejects_missing_or_modified_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with self.assertRaises((FileNotFoundError,ValueError)):
                mos2.verify_evidence(root)
            data=copy.deepcopy(self.plan)
            data["geometry"]["a_angstrom"]=4.2
            (root/"plan.json").write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,"source-fixed"):
                mos2.verify_evidence(root)


if __name__=="__main__":
    unittest.main()
