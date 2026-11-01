"""Synthetic-only 3D input generator unit tests; no actual QE runs."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from qe_bulk_real_protocol import build, geometry, MATERIALS
from qe_bulk_execute import prepare


class BulkRealProtocolTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.pseudos=self.root/"pseudos"
        self.pseudos.mkdir()
        self.source=self.root/"source.cif"
        self.source.write_text("data_synthetic_unreviewed\n_cell_length_a 4.0\n")
        for element in ("Ga","N","Al","Si","C"):
            (self.pseudos/(element+".UPF")).write_text(
                f'<UPF version="2.0.1"><PP_HEADER element="{element}" functional="PBE" /></UPF>\n'
                "<!-- SYNTHETIC AND NOT A PHYSICAL PSEUDOPOTENTIAL -->")
    def hashes(self,material):
        return {element:hashlib.sha256((self.pseudos/(element+".UPF")).read_bytes()).hexdigest()
                for element in MATERIALS[material]["elements"]}
    def test_generates_explicit_three_dimensional_input_for_three_materials(self):
        for material in MATERIALS:
            with self.subTest(material=material):
                path=self.root/("candidate-"+material)
                plan=build(material,self.source,self.pseudos,path,self.hashes(material))
                self.assertEqual(plan["material"],material)
                self.assertTrue((path/"run-plan.json").exists())
                self.assertEqual(len(plan["runs"]),4)
                parsed=prepare(path/"run-plan.json")
                self.assertEqual(set(parsed["inputs"]),
                                 {"baseline","ecut-refined","k-refined","bands"})
                unverified=json.loads((path/"protocol-provenance.json").read_text())
                self.assertFalse(unverified["polytype_independently_verified"])
                self.assertFalse(unverified["scientific_acceptance"])
                self.assertFalse(unverified["band_path_symmetry_certified"])
    def test_wurtzite_3c_cells_and_sites(self):
        for material in ("GaN","AlN"):
            vectors,sites,path=geometry(material,3.2,5.2,.38)
            self.assertEqual(len(sites),4)
            self.assertTrue(any(p[2]>.1 for p in path))
            self.assertEqual(sum(a[0]=="N" for a in sites),2)
        vectors,sites,path=geometry("SiC",4.3596,None,None)
        self.assertEqual(len(sites),2)
        self.assertEqual(sites[1],("C",.25,.25,.25))
        self.assertEqual(vectors[0][0],0)
    def test_reject_tampering_and_existing_directory(self):
        digests=self.hashes("GaN")
        digests["Ga"]="f"*64
        with self.assertRaisesRegex(ValueError,"digest"):
            build("GaN",self.source,self.pseudos,self.root/"bad",digests)
        path=self.root/"exists"
        path.mkdir()
        with self.assertRaisesRegex(ValueError,"must not exist"):
            build("GaN",self.source,self.pseudos,path,self.hashes("GaN"))
    def test_reject_invalid_k_cutoffs_and_structure_geometry(self):
        with self.assertRaisesRegex(ValueError,"Invalid bounded"):
            build("SiC",self.source,self.pseudos,self.root/"invalid",
                  self.hashes("SiC"),k_base=6,k_refined=4)
        with self.assertRaisesRegex(ValueError,"Invalid declared wurtzite"):
            build("AlN",self.source,self.pseudos,self.root/"invalid",
                  self.hashes("AlN"),u=.9)
        with self.assertRaisesRegex(ValueError,"3C-SiC does not use"):
            geometry("SiC",4.35,7,.4)


if __name__=="__main__":
    unittest.main()
