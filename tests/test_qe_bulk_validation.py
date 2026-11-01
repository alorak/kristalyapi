"""Synthetic QE text fixtures check parser safety; never treated as real DFT evidence."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/"tools"))
from qe_bulk_validation import verify, qe_input, qe_output

class BulkEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.data={"schema":"kristalyapi.qe-bulk-evidence.v1",
                   "material":"GaN","polytype_claim":"synthetic wurtzite mock; unverified",
                   "criteria":{"max_energy_delta_mev_per_atom":1,
                               "max_scf_accuracy_ry":1e-6},
                   "runs":{}}
        self.write("crystal.cif","data_mock\n_cell_length_a 3.19\n")
        self.data["structure_reference"]=self.record("crystal.cif")
        self.data["pseudopotentials"]={}
        for element in ("Ga","N"):
            name=element+".upf"
            self.write(name,'<UPF version="2.0.1"><PP_HEADER element="'+element+'"/></UPF>\n<!-- SYNTHETIC ONLY -->')
            self.data["pseudopotentials"][element]=self.record(name)
        for kind,ecut,mesh,energy in [
           ("baseline",45,(8,8,8),-100.0),
           ("ecut-refined",55,(8,8,8),-100.00003),
           ("k-refined",45,(10,10,10),-100.00004),
           ("bands",45,None,None)]:
            calculation="bands" if kind=="bands" else "scf"
            text=f"""&CONTROL
 calculation='{calculation}'
/
&SYSTEM
 ibrav=0, nat=4, ntyp=2, ecutwfc={ecut}, ecutrho=360
/
ATOMIC_SPECIES
Ga 69.723 Ga.upf
N 14.007 N.upf
CELL_PARAMETERS angstrom
3.19 0 0
-1.595 2.763 0
0 0 5.18
ATOMIC_POSITIONS crystal
Ga 0 0 0
N 0.333333 0.666667 0.375
Ga 0 0 0.5
N 0.666667 0.333333 0.875
"""
            if mesh:
                text+="K_POINTS automatic\n"+" ".join(map(str,mesh))+" 0 0 0\n"
            else:
                text+="K_POINTS crystal_b\n4\n0 0 0 15\n0.5 0 0 15\n0 0 0.5 15\n0 0 0 1\n"
            output="Program PWSCF v.7.2\n"
            if energy is not None:
                output+=f"convergence has been achieved in 8 iterations\n! total energy = {energy:.9f} Ry\nestimated scf accuracy < 1.0E-9 Ry\n"
            output+="JOB DONE.\n"
            self.write(kind+".in",text)
            self.write(kind+".out",output)
            self.data["runs"][kind]={"input":self.record(kind+".in"),"output":self.record(kind+".out")}
        self.manifest=self.root/"manifest.json"
        self.save()
    def tearDown(self):self.tmp.cleanup()
    def write(self,name,contents): (self.root/name).write_text(contents)
    def record(self,name):
        return {"path":name,"sha256":hashlib.sha256((self.root/name).read_bytes()).hexdigest()}
    def save(self):self.manifest.write_text(json.dumps(self.data))
    def test_4_stage_3d_and_hash_consistency_do_not_certify_science(self):
        report=verify(self.manifest)
        self.assertTrue(report["software_numeric_gates_passed"])
        self.assertFalse(report["scientific_acceptance"])
        self.assertEqual(report["status"],"review-required")
        self.assertEqual(report["runs"]["baseline"]["mesh"],[8,8,8])
        self.assertIn("Ga",report["upf_file_sha256_verified"])
    def test_pseudo_tampering_fails_sha(self):
        self.write("N.upf","tampered")
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            verify(self.manifest)
    def test_invalid_two_dimensional_bulk_is_rejected(self):
        bad=(self.root/"baseline.in").read_text().replace("8 8 8 0 0 0","8 8 1 0 0 0")
        self.write("baseline.in",bad)
        self.data["runs"]["baseline"]["input"]=self.record("baseline.in")
        self.save()
        with self.assertRaisesRegex(ValueError,"Bulk k mesh"):
            verify(self.manifest)
    def test_swapped_structure_breaks_convergence_comparison(self):
        bad=(self.root/"ecut-refined.in").read_text().replace("3.19 0 0","3.22 0 0")
        self.write("ecut-refined.in",bad)
        self.data["runs"]["ecut-refined"]["input"]=self.record("ecut-refined.in")
        self.save()
        with self.assertRaisesRegex(ValueError,"different declared structure"):
            verify(self.manifest)
    def test_cutoff_energy_convergence_can_fail_with_complete_fake_logs(self):
        self.write("ecut-refined.out",(self.root/"ecut-refined.out").read_text().replace("-100.000030000","-100.050000000"))
        self.data["runs"]["ecut-refined"]["output"]=self.record("ecut-refined.out")
        self.save()
        report=verify(self.manifest)
        self.assertFalse(report["software_numeric_gates_passed"])
        self.assertFalse(report["scientific_acceptance"])
    def test_input_pseudo_name_must_match_hashed_upf(self):
        text=(self.root/"bands.in").read_text().replace("Ga.upf","different.upf")
        self.write("bands.in",text)
        self.data["runs"]["bands"]["input"]=self.record("bands.in")
        self.save()
        with self.assertRaisesRegex(ValueError,"pseudopotential filenames"):
            verify(self.manifest)

    def test_incomplete_log_and_non_3d_path_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"complete"):
            qe_output("Program PWSCF v.7.2\n", "scf")
        text=(self.root/"bands.in").read_text().replace("0 0 0.5 15","0 0 0 15")
        with self.assertRaisesRegex(ValueError,"nonzero kz"):
            qe_input(text,"bands")
    def test_path_traversal_is_rejected(self):
        self.data["structure_reference"]["path"]="../outside.cif"
        self.save()
        with self.assertRaisesRegex(ValueError,"Unsafe"):
            verify(self.manifest)

if __name__=="__main__": unittest.main()
