"""Offline falsification tests for the D2.1 verifier; these excerpts are not run evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('qe_scf_acceptance', ROOT/'tools/qe_scf_acceptance.py')
acceptance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acceptance)


class AcceptanceEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads(acceptance.PLAN.read_text())
        self.request = acceptance.make_request(self.plan, {'ecutwfc_ry':45, 'ecutrho_ry':360, 'kpoints':[2,2,2]})
        self.input = b"""&CONTROL
 calculation='scf',
/
&SYSTEM
 nat=2,
 ecutwfc=45.00000000,
 ecutrho=360.00000000,
 input_dft='PBE',
 occupations='fixed',
/
&ELECTRONS
 conv_thr=1.0d-8,
/
CELL_PARAMETERS angstrom
0 2.7155 2.7155
2.7155 0 2.7155
2.7155 2.7155 0
ATOMIC_POSITIONS crystal
Si 0 0 0
Si .25 .25 .25
K_POINTS automatic
2 2 2 0 0 0
"""
        self.output = b"""Program PWSCF v.6.7MaX starts
!    total energy = -22.65199852 Ry
estimated scf accuracy < 3.9E-09 Ry
convergence has been achieved in 10 iterations
JOB DONE.
"""
        self.result = {'engine':'quantum-espresso', 'engine_version':'6.7MaX',
                       'scf_converged':True, 'job_done':True, 'energy_ry':-22.65199852,
                       'energy_ev':-22.65199852*acceptance.RY_TO_EV,
                       'input_sha256':acceptance.sha(self.input), 'output_sha256':acceptance.sha(self.output),
                       'pseudopotentials':{'Si':{'sha256':self.plan['pseudopotential']['sha256']}}}

    def check(self):
        return acceptance.check_case(self.request,self.result,self.input,self.output,self.plan)

    def test_raw_and_api_evidence_agree(self):
        proof=self.check()
        self.assertEqual(proof['scf_iterations'],10)
        self.assertEqual(proof['last_scf_accuracy_ry'],3.9e-9)

    def test_tampered_output_hash_rejected(self):
        self.output+=b'changed'
        with self.assertRaisesRegex(ValueError,'Output hash'):self.check()

    def test_api_energy_cannot_override_raw_output(self):
        self.result['energy_ry']=-20
        with self.assertRaisesRegex(ValueError,'API/raw energy'):self.check()

    def test_completed_flags_without_job_done_rejected(self):
        self.output=self.output.replace(b'JOB DONE.',b'')
        self.result['output_sha256']=acceptance.sha(self.output)
        with self.assertRaisesRegex(ValueError,'Incomplete'):self.check()

    def test_missing_raw_scf_convergence_rejected(self):
        self.output=self.output.replace(b'convergence has been achieved',b'no SCF evidence')
        self.result['output_sha256']=acceptance.sha(self.output)
        with self.assertRaisesRegex(ValueError,'convergence evidence'):self.check()

    def test_excessive_scf_residual_rejected_even_with_completed_flags(self):
        self.output=self.output.replace(b'3.9E-09',b'3.9E-04')
        self.result['output_sha256']=acceptance.sha(self.output)
        with self.assertRaisesRegex(ValueError,'residual exceeds'):self.check()

    def test_wrong_upf_rejected(self):
        self.result['pseudopotentials']['Si']['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'UPF hash'):self.check()

    def test_different_generated_kmesh_rejected(self):
        self.input=self.input.replace(b'2 2 2 0 0 0',b'3 3 3 0 0 0')
        self.result['input_sha256']=acceptance.sha(self.input)
        with self.assertRaisesRegex(ValueError,'k mesh'):self.check()

    def test_different_generated_structure_rejected(self):
        self.input=self.input.replace(b'Si .25 .25 .25',b'Si .2 .25 .25')
        self.result['input_sha256']=acceptance.sha(self.input)
        with self.assertRaisesRegex(ValueError,'atoms mismatch'):self.check()

    def test_wrong_ev_units_rejected(self):
        self.result['energy_ev']=self.result['energy_ry']
        with self.assertRaisesRegex(ValueError,'Ry/eV'):self.check()

    def test_failed_finite_sensitivity_is_not_passed(self):
        rows=[{'id':case['id'],'proof':{'energy_ry':-22.0}} for case in self.plan['cases']]
        self.assertTrue(all(c['passed'] for c in acceptance.sensitivity(rows,self.plan)))
        rows[1]['proof']['energy_ry']+=.001
        checks=acceptance.sensitivity(rows,self.plan)
        self.assertFalse(checks[0]['passed'])
        self.assertTrue(checks[1]['passed'])


if __name__=='__main__':unittest.main()
