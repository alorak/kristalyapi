"""Unit tests for the independent CIF validation mechanism (not browser behavior)."""
import json
from pathlib import Path
import unittest
import gemmi
import validate

ROOT=Path(__file__).resolve().parent
CELL={"a":5.0,"b":5.0,"c":5.0,"alpha":90,"beta":90,"gamma":90}
TOL={"cell_length_A":.001,"cell_angle_deg":.01,"volume_relative":.0001,
     "coordinate_A":.001,"occupancy":.001}

def site(element,x,y,z,occupancy=1):
    return dict(element=element,x=x,y=y,z=z,occupancy=occupancy)

class AccuracyMechanismTest(unittest.TestCase):
    def test_periodic_wrapping(self):
        c=gemmi.UnitCell(5,5,5,90,90,90)
        self.assertAlmostEqual(validate.periodic_distance(site("Si",.99,0,0),
            site("Si",.01,0,0),c),.1)

    def test_triclinic_nearest_uses_gemmi(self):
        c=gemmi.UnitCell(4,5,6,73,81,64)
        x=site("Si",.93,.11,.04)
        y=site("Si",-.07,.11,1.04)
        self.assertLess(validate.periodic_distance(x,y,c),1e-7)

    def test_order_and_wrapped_positions(self):
        b=[site("O",.01,.5,0),site("Si",.25,.25,.25)]
        r=[site("Si",.25,.25,.25),site("O",1.01,.5,0)]
        match=validate.compare_sites(b,r,CELL,.001)
        self.assertTrue(match["success"])

    def test_global_origin_shift(self):
        b=[site("Si",.1,.2,.3),site("O",.4,.5,.6)]
        r=[site("Si",.3,.2,.3),site("O",.6,.5,.6)]
        match=validate.compare_sites(b,r,CELL,.001)
        self.assertTrue(match["success"])
        self.assertAlmostEqual(match["origin_shift"][0],.2)

    def test_partial_occupancy_groups(self):
        b=[site("Fe",0,0,0,.6),site("Ni",0,0,0,.4)]
        r=[site("Fe",0,0,0,.4),site("Ni",0,0,0,.6)]
        self.assertFalse(validate.compare_sites(b,r,CELL,.001)["success"])

    def test_reference_parsing_failure_is_not_success(self):
        entry={"id":"synthetic-a","kind":"synthetic","path":"fixture",
               "expect":"compare"}
        b={"result":"parsed","sha256":"same","cell":CELL,"sites":[site("Si",0,0,0)]}
        r={"result":"error","sha256":"same","error":"no reference"}
        self.assertEqual(validate.measure(entry,b,r,TOL)["status"],"inconclusive")

    def test_expected_invalid_requires_two_rejections(self):
        entry={"id":"synthetic-invalid","kind":"synthetic","path":"fixture",
               "expect":"reject"}
        ref={"result":"error","sha256":"same"}
        browser={"result":"error","sha256":"same"}
        self.assertEqual(validate.measure(entry,browser,ref,TOL)["status"],"pass")
        browser["result"]="parsed"
        self.assertEqual(validate.measure(entry,browser,ref,TOL)["status"],"fail")

    def test_fixture_manifest_is_complete_and_pinned(self):
        manifest=json.loads((ROOT/"manifest.json").read_text())
        cases=manifest["cases"]
        self.assertEqual(len(cases),40)
        self.assertEqual(sum(x["kind"]=="real" for x in cases),30)
        self.assertEqual(sum(x["kind"]=="synthetic" for x in cases),10)
        for entry in cases:
            self.assertRegex(entry["git_blob_sha1"],r"^[a-f0-9]{40}$")
            path=ROOT/entry["path"]
            self.assertTrue(path.is_file())
            payload=path.read_bytes()
            self.assertEqual(
                validate.hashlib.sha1(("blob "+str(len(payload))+chr(0)).encode()+payload).hexdigest(),
                entry["git_blob_sha1"]
            )

if __name__=="__main__":
    unittest.main()
