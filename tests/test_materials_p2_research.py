"""P2 numerical prototype tests: all inputs are synthetic and nonphysical."""
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from materials_p2_research import evaluate,defect_formation,phonon_screen,interface_screen,surrogate_calibration

SOURCE={"kind":"synthetic","sha256":"a"*64,"reference":"unit-test only, no experiment"}
def request(mode,parameters):
    return {"schema":"kristalyapi.materials-research-input.v1","source":SOURCE,
            "mode":mode,"parameters":parameters}

class P2ResearchTests(unittest.TestCase):
    def defect(self,charge=0):
        return {"defect_energy_ev":-7,"bulk_energy_ev":-10,
                "delta_atoms":{"N":-1},"chemical_potentials_ev":{"N":-2},
                "charge":charge,"fermi_relative_ev":.5,"vbm_ev":1,
                "potential_alignment_ev":.1 if charge else 0,
                "finite_size_correction_ev":.2 if charge else 0,
                "correction_method":"operator supplied, unverified",
                "dielectric_reference":"no real source"}
    def test_defect_neutral_energy_and_charge_correction(self):
        neutral=defect_formation(self.defect())
        self.assertAlmostEqual(neutral["formation_energy_ev"],1)
        charged=defect_formation(self.defect(1))
        self.assertAlmostEqual(charged["formation_energy_ev"],2.8)
        self.assertAlmostEqual(charged["charge_fermi_vbm_alignment_term_ev"],1.6)
        without=self.defect(1);without.pop("dielectric_reference")
        with self.assertRaisesRegex(ValueError,"dielectric"):defect_formation(without)
        bad=self.defect();bad["potential_alignment_ev"]=1
        with self.assertRaisesRegex(ValueError,"Neutral"):defect_formation(bad)
    def test_phonon_negative_mode_screen_not_thermal_validation(self):
        good=phonon_screen({"frequencies_thz":[0,-.04,1.2,2.3],"imaginary_tolerance_thz":.1})
        self.assertTrue(good["negative_mode_screen_passed"])
        bad=phonon_screen({"frequencies_thz":[-1.1,0,4],"imaginary_tolerance_thz":.1})
        self.assertFalse(bad["negative_mode_screen_passed"])
        self.assertEqual(bad["modes_below_negative_tolerance"],[0])
        self.assertIn("thermal conductivity",bad["limits"][2])
    def test_interface_mismatch_and_reject_degenerate_cells(self):
        result=interface_screen({"material_a_inplane_angstrom":[[3,0],[0,3]],
                                 "material_b_inplane_angstrom":[[3.03,0],[0,3.06]]})
        self.assertAlmostEqual(result["individual_vector_length_mismatch_percent"][0],1)
        self.assertAlmostEqual(result["individual_vector_length_mismatch_percent"][1],2)
        self.assertAlmostEqual(result["inplane_angle_difference_deg"],0)
        with self.assertRaisesRegex(ValueError,"Degenerate"):
            interface_screen({"material_a_inplane_angstrom":[[3,0],[6,0]],
                              "material_b_inplane_angstrom":[[3,0],[0,3]]})
    def test_split_conformal_finite_sample_and_unbounded_case(self):
        observations=[i for i in range(19)]
        forecasts=[i+.5 for i in range(19)]
        result=surrogate_calibration({"calibration_observed":observations,
                                     "calibration_predicted":forecasts,
                                     "candidate_predictions":[0,5],"alpha":.1})
        self.assertEqual(result["quantile_rank"],18)
        self.assertAlmostEqual(result["absolute_residual_radius"],.5)
        self.assertEqual(result["prediction_intervals"][0],{"lower":-.5,"upper":.5})
        short=surrogate_calibration({"calibration_observed":[1]*10,
                                     "calibration_predicted":[2]*10,
                                     "candidate_predictions":[5],"alpha":.05})
        self.assertFalse(short["finite_interval_available"])
        self.assertIsNone(short["prediction_intervals"])
    def test_provenance_does_not_authenticate_or_accept_physics(self):
        result=evaluate(request("defect-formation",self.defect(1)))
        self.assertFalse(result["scientific_acceptance"])
        self.assertFalse(result["source"]["source_bytes_reverified"])
        self.assertEqual(result["source"]["kind"],"synthetic")
        invalid=request("phonon-screen",{"frequencies_thz":[1]})
        invalid["source"]["sha256"]="bad"
        with self.assertRaisesRegex(ValueError,"SHA-256"):evaluate(invalid)
        with self.assertRaisesRegex(ValueError,"Unknown evidence"):
            evaluate({**request("phonon-screen",{"frequencies_thz":[1]}),
                      "source":{**SOURCE,"kind":"verified-physics"}})

if __name__=="__main__":unittest.main()
