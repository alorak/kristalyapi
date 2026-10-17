"""Package 7.3/7.4: independent scientific invariants using pinned Gemmi."""
import math
import unittest
import gemmi

class IndependentScientificReference(unittest.TestCase):
    def test_adp_cartesian_tensor_positive_definite(self):
        # Independent tensor criterion; application ADP roundtrip is exercised in core.test.cjs.
        matrix=((.04,.002,-.001),(.002,.03,.003),(-.001,.003,.02))
        a,b,c=matrix
        determinant=(a[0]*(b[1]*c[2]-b[2]*c[1])
                     -a[1]*(b[0]*c[2]-b[2]*c[0])
                     +a[2]*(b[0]*c[1]-b[1]*c[0]))
        self.assertGreater(a[0],0)
        self.assertGreater(a[0]*b[1]-a[1]*b[0],0)
        self.assertGreater(determinant,0)

    def test_triclinic_metric_is_not_orthogonal_approximation(self):
        cell=gemmi.UnitCell(4,5,6,73,81,64)
        f=gemmi.Fractional(.25,.5,.75)
        cart=cell.orthogonalize(f)
        self.assertNotAlmostEqual(cart.length(),math.hypot(1,2.5,4.5),places=2)
        back=cell.fractionalize(cart)
        for actual,expected in zip((back.x,back.y,back.z),(.25,.5,.75)):
            self.assertAlmostEqual(actual,expected,places=12)

    def test_structure_factor_bcc_extinction_independent_phase_sum(self):
        # Identical scattering sites at (0,0,0), (1/2,1/2,1/2).
        for hkl,expected in [((1,0,0),0),((1,1,0),2),((1,1,1),0),((2,0,0),2)]:
            phase=math.pi*sum(hkl)
            amplitude=complex(1+math.cos(phase),math.sin(phase))
            self.assertAlmostEqual(abs(amplitude),expected,places=12)

    def test_bragg_angle_from_independent_gemmi_d_spacing(self):
        cell=gemmi.UnitCell(4,4,4,90,90,90)
        d=cell.calculate_d((1,1,0))
        wavelength=1.5406
        theta=math.asin(wavelength/(2*d))
        self.assertAlmostEqual(2*math.degrees(theta),31.588,delta=.05)

if __name__=='__main__':
    unittest.main()
