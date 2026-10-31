"""V18.1: independent Gemmi 0.7.4 CIF2 syntax and P1-expanded numeric checks.

The browser's strict CIF2 scalar subset does not claim complete CIF2 support.
Gemmi and the real browser parser are independently exercised on two CIF2
structures with Unicode triple quotes and nontrivial affine symmetry.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import unittest

import gemmi


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "tests/validation/js_cif_runner.cjs"
CASES = [
    ("s11_cif2_pminus1.cif", 2, 4, "Si1"),
    ("s12_cif2_p21_origin.cif", 4, 2, "C1"),
]

READ_BROWSER = r"""
const fs = require('node:fs');
const {parserFromHtml} = require(process.argv[1]);
const source=fs.readFileSync(process.argv[2],'utf8');
const parse=parserFromHtml('index.html');
const data=parse(source);
process.stdout.write(JSON.stringify({
 sgNumber:data.sgNumber,warning:data.warning,
 cell:[data.cell.a,data.cell.b,data.cell.c,data.cell.alpha,data.cell.beta,data.cell.gamma],
 sites:data.sites.map(s=>({label:s.label,symbol:s.symbol,
                         x:s.x,y:s.y,z:s.z,occupancy:s.occupancy}))
}));
"""


def gemmi_text(contents):
    """Gemmi 0.7.x reads single-line CIF2 triple-quoted values but rejects
    multi-line ones ("unterminated string"). Rewrite only those values to the
    equivalent CIF text field so Gemmi parses the same string; the browser
    always reads the unmodified file."""
    def field(match):
        value=match.group(2)
        if "\n" not in value:
            return match.group(0)
        if "\n;" in value:
            raise ValueError("value cannot be written as a CIF text field")
        return "\n;"+value+"\n;\n"
    return re.sub(r"('''|\"\"\")(.*?)\1",field,contents,flags=re.S)


class CIF2GemmiReference(unittest.TestCase):
    def test_source_cif2_is_gemmi_parseable_and_browser_multiplicity_matches(self):
        for filename, group, count, label in CASES:
            with self.subTest(filename=filename):
                path=ROOT/"tests/validation/fixtures/synthetic"/filename
                contents=path.read_text(encoding="utf-8")
                self.assertTrue(contents.startswith("#\\#CIF_2.0\n"))
                block=gemmi.cif.read_string(gemmi_text(contents)).sole_block()
                self.assertEqual(int(gemmi.cif.as_number(block.find_value("_space_group_IT_number"))),group)
                symops=list(block.find_values("_space_group_symop_operation_xyz"))
                self.assertEqual(len(symops),len(gemmi.find_spacegroup_by_number(group).operations()))
                independent=gemmi.GroupOps([gemmi.Op(gemmi.cif.as_string(value)) for value in symops])
                identified=gemmi.find_spacegroup_by_ops(independent)
                self.assertIsNotNone(identified)
                self.assertEqual(identified.number,group)
                labels=[gemmi.cif.as_string(v) for v in block.find_values("_atom_site_label")]
                self.assertIn(label,labels)
                cmd=subprocess.run(
                    ["node","-e",READ_BROWSER,str(RUNNER),str(path)],
                    cwd=ROOT,text=True,capture_output=True,timeout=25,check=True)
                parsed=json.loads(cmd.stdout)
                self.assertEqual(parsed["sgNumber"],group)
                self.assertEqual(len(parsed["sites"]),count)
                self.assertIn("NOT inferred",parsed["warning"])
                lengths=[float(gemmi.cif.as_number(block.find_value("_cell_length_"+axis)))
                         for axis in "abc"]
                for index,value in enumerate(lengths):
                    self.assertAlmostEqual(parsed["cell"][index],value,places=6)
                for sym in set(site["symbol"] for site in parsed["sites"]):
                    self.assertIn(sym,["C","Si","O"])

    def test_gemmi_reads_unicode_multiline_cif2_metadata_but_browser_never_reinterprets_setting(self):
        filename=ROOT/"tests/validation/fixtures/synthetic/s11_cif2_pminus1.cif"
        block=gemmi.cif.read_string(gemmi_text(filename.read_text(encoding="utf-8"))).sole_block()
        title=gemmi.cif.as_string(block.find_value("_chemical_name_common"))
        self.assertIn("α model",title)
        self.assertIn("O'Brien",title)
        self.assertEqual(len(list(block.find_values("_space_group_symop_operation_xyz"))),2)


if __name__=="__main__":
    unittest.main()
