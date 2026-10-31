"""V18.2 independent structural check with Gemmi for selected CIF2 blocks.

Gemmi 0.7.4 does not parse CIF2 nested List/Table. Therefore we compare
the KristalYapı production parser's regenerated SCALAR CIF1 projection
against Gemmi, not pretend Gemmi accepted the raw compound CIF2 document.
"""
from __future__ import annotations

from pathlib import Path
import json
import subprocess
import unittest
import gemmi

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"tests/validation/fixtures/synthetic/s13_cif2_multiblock_containers.cif"
RUNNER=ROOT/"tests/validation/js_cif_runner.cjs"
SCRIPT=r"""
const fs=require('node:fs');
const {parserFromHtml}=require(process.argv[1]);
const parse=parserFromHtml('index.html');
const raw=fs.readFileSync(process.argv[2],'utf8');
const block=process.argv[3];
const data=parse(raw,block);
const scalarCif=parse.exportText({...data,symmetryEnabled:false,cifMeta:{}});
process.stdout.write(JSON.stringify({
 name:data.name,cell:data.cell,
 siteCount:data.sites.length,
 sites:data.sites.map(s=>({element:s.symbol,occ:s.occupancy,x:s.x,y:s.y,z:s.z})),
 scalarCif,
}));
"""

class V182GemmiSelectedBlock(unittest.TestCase):
    def test_two_structures_remain_separate_and_exported_cif1_matches_gemmi(self):
        for name,count,symbol,a in [("alpha",1,"C",5.0),("beta",2,"Si",4.0)]:
            with self.subTest(block=name):
                run=subprocess.run(
                    ["node","-e",SCRIPT,str(RUNNER),str(SOURCE),name],
                    cwd=ROOT,capture_output=True,text=True,timeout=30,check=True)
                value=json.loads(run.stdout)
                self.assertEqual(value["siteCount"],count)
                self.assertEqual({x["element"] for x in value["sites"]},{symbol})
                self.assertAlmostEqual(value["cell"]["a"],a,places=7)
                independent=gemmi.cif.read_string(value["scalarCif"]).sole_block()
                self.assertAlmostEqual(float(gemmi.cif.as_number(independent.find_value("_cell_length_a"))),a)
                self.assertEqual(len(list(independent.find_values("_atom_site_fract_x"))),count)
                self.assertTrue(all(x["occ"]==1 for x in value["sites"]))
                self.assertNotIn("_local_rgb_value",value["scalarCif"])
    def test_raw_compound_is_not_labeled_gemmi_verified(self):
        raw=SOURCE.read_text(encoding="utf8")
        self.assertIn("_local_model",raw)
        self.assertIn("data_alpha",raw)
        self.assertIn("data_beta",raw)
        # Compound AST is validated by the V18.2 JS parser against IUCr CIF2,
        # independent Gemmi validation is limited to scalar structure export.

if __name__=="__main__":
    unittest.main()
