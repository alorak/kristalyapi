"""P1 strict semantic-science gate uses synthetic text fixtures only, not real QE."""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"tools"),str(ROOT/"tests")]
import test_qe_bulk_validation as fixture
from qe_bulk_semantic_gate import review


class BulkSemanticGateTests(unittest.TestCase):
    def setUp(self):
        self.base=fixture.BulkEvidenceTests("test_4_stage_3d_and_hash_consistency_do_not_certify_science")
        self.base.setUp()
        self.addCleanup(self.base.tearDown)
        self.root=self.base.root
        self.data=self.base.data
        self.manifest=self.base.manifest
        for element in ("Ga","N"):
            path=self.root/(element+".upf")
            path.write_text('<UPF version="2.0.1"><PP_HEADER element="'+element+
                            '" functional="PBE" z_valence="4.0" /></UPF>\n'
                            '<!-- SYNTHETIC, NOT REAL PP -->')
            self.data["pseudopotentials"][element]=self.base.record(path.name)
        for stage in ("baseline","ecut-refined","k-refined","bands"):
            path=self.root/(stage+".in")
            text=path.read_text()
            text=text.replace("&SYSTEM\n","&SYSTEM\n input_dft='PBE', occupations='fixed', nbnd=20,\n")
            text=text.replace("ATOMIC_SPECIES",
                              "&ELECTRONS\n conv_thr=1.0d-9\n/\nATOMIC_SPECIES")
            if stage=="ecut-refined":
                text=text.replace("ecutrho=360","ecutrho=440")
            path.write_text(text)
            self.data["runs"][stage]["input"]=self.base.record(path.name)
        self.reference=self.root/"independent-transcription.json"
        self.typed={
            "schema":"kristalyapi.bulk-geometry-reference.v1",
            "material":"GaN",
            "source_file_sha256":self.data["structure_reference"]["sha256"],
            "source_identifier":"unverified synthetic source ID",
            "cell_unit":"angstrom",
            "coordinates":"fractional",
            "cell_vectors_angstrom":[[3.19,0,0],[-1.595,2.763,0],[0,0,5.18]],
            "sites":[
                {"element":"Ga","fractional":[0,0,0]},
                {"element":"N","fractional":[.333333,.666667,.375]},
                {"element":"Ga","fractional":[0,0,.5]},
                {"element":"N","fractional":[.666667,.333333,.875]}
            ]
        }
        self.save()
    def save(self):
        self.base.save()
        self.reference.write_text(json.dumps(self.typed))
    def edit_stage(self,stage,original,replacement):
        name=stage+".in"
        contents=(self.root/name).read_text()
        self.assertIn(original,contents)
        (self.root/name).write_text(contents.replace(original,replacement))
        self.data["runs"][stage]["input"]=self.base.record(name)
        self.save()

    def test_successful_software_gates_never_authenticate_source_or_physics(self):
        report=review(self.manifest,self.reference)
        self.assertTrue(report["qe_input_geometry_matches_declared_reference"])
        self.assertTrue(report["software_semantic_gates_passed"])
        self.assertTrue(report["underlying_numeric_gate_passed"])
        self.assertFalse(report["reference_transcription_independently_verified"])
        self.assertFalse(report["scientific_acceptance"])
        self.assertEqual(report["geometry_units"]["cell"],"angstrom")
        self.assertEqual(report["pseudopotential_header_consistency"]["Ga"]["xc_declared"],"PBE")

    def test_source_and_qe_structure_mismatch_fails(self):
        self.typed["sites"][0]["fractional"][0]=.25
        self.save()
        with self.assertRaisesRegex(ValueError,"atomic positions"):
            review(self.manifest,self.reference)

    def test_source_hash_does_not_allow_unrelated_reference(self):
        self.typed["source_file_sha256"]="a"*64
        self.save()
        with self.assertRaisesRegex(ValueError,"not linked"):
            review(self.manifest,self.reference)

    def test_lattice_unit_and_lattice_mismatch_block(self):
        self.typed["cell_unit"]="bohr"
        self.save()
        with self.assertRaisesRegex(ValueError,"angstrom"):
            review(self.manifest,self.reference)
        self.typed["cell_unit"]="angstrom"
        self.typed["cell_vectors_angstrom"][0][0]=3.40
        self.save()
        with self.assertRaisesRegex(ValueError,"lattice differs"):
            review(self.manifest,self.reference)

    def test_upf_pbe_and_valence_header_required(self):
        path=self.root/"N.upf"
        value=path.read_text().replace('functional="PBE"','functional="LDA"')
        path.write_text(value)
        self.data["pseudopotentials"]["N"]=self.base.record("N.upf")
        self.save()
        with self.assertRaisesRegex(ValueError,"functional"):
            review(self.manifest,self.reference)

    def test_changed_nbnd_across_runs_is_not_a_convergence_test(self):
        self.edit_stage("ecut-refined","nbnd=20","nbnd=24")
        with self.assertRaisesRegex(ValueError,"nbnd"):
            review(self.manifest,self.reference)

    def test_changed_rho_ratio_is_not_isolated_cutoff(self):
        self.edit_stage("ecut-refined","ecutrho=440","ecutrho=400")
        with self.assertRaisesRegex(ValueError,"ecutrho/ecutwfc"):
            review(self.manifest,self.reference)

    def test_reject_unaccounted_spin_and_hubbard(self):
        self.edit_stage("bands","nbnd=20","nbnd=20, noncolin=.true.")
        with self.assertRaisesRegex(ValueError,"Unsupported spin"):
            review(self.manifest,self.reference)

    def test_reference_site_permutation_is_ignored(self):
        self.typed["sites"]=list(reversed(self.typed["sites"]))
        self.save()
        self.assertTrue(review(self.manifest,self.reference)["software_semantic_gates_passed"])


if __name__=="__main__":
    unittest.main()
