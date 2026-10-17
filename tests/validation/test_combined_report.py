"""Scientific report aggregation regression tests."""
import unittest
from combined_report import combine

class CombinedReportTest(unittest.TestCase):
    def test_uncertainty_is_not_success(self):
        result=combine({'count':3,'counts':{'pass':2,'inconclusive':1},
                        'gate':{'unexpected':[]}},None)
        self.assertEqual(result['scientific']['status'],'inconclusive')
        self.assertEqual(result['visual']['status'],'not_run')

    def test_failures_block(self):
        result=combine({'count':2,'counts':{'pass':1,'fail':1},
                        'gate':{'unexpected':['bad']}},{'screenshots':1})
        self.assertEqual(result['scientific']['status'],'fail')
        self.assertEqual(result['visual']['status'],'inconclusive')

    def test_explicit_visual_status(self):
        science={'count':1,'counts':{'pass':1}}
        self.assertEqual(combine(science,{'status':'pass'})['visual']['status'],'pass')
        self.assertEqual(combine(science,{'status':'fail'})['visual']['status'],'fail')

    def test_missing_fixture_is_error(self):
        with self.assertRaises(ValueError):
            combine({'count':40,'counts':{'pass':39}},None)

if __name__=='__main__':
    unittest.main()
