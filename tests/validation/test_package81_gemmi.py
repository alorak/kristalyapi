"""Package 8.1: verify generated CIF with independent Gemmi 0.7.4 parser.

This is deliberately not a copy of the application parser. Node runs the
production import/export functions; Gemmi independently reads the emitted CIF.
"""
from __future__ import annotations

from pathlib import Path
import subprocess
import tempfile
import unittest

import gemmi


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "tests" / "validation" / "js_cif_runner.cjs"

EDIT_AND_EXPORT = r"""
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {parserFromHtml} = require(process.argv[1]);
const parse = parserFromHtml(path.join(process.cwd(), 'index.html'));
const text = fs.readFileSync(process.argv[2], 'utf8');
const original = parse(text);
const snapshot = parse.originalRecord(original, text);
const modified = {
  ...original,
  cifOriginal: snapshot,
  sites: original.sites.map((s, i) => i ? s : {...s, x: s.x + .25})
};
const exported = parse.exportPreservingSource(modified);
if(exported.original) throw Error('edited CIF must not reuse original bytes');
process.stdout.write(exported.text);
"""


class Package81GemmiReference(unittest.TestCase):
    def test_edited_cif_is_valid_to_gemmi_and_preserves_only_provenance(self):
        source = "\n".join([
            "data_pkg81",
            "_cell_length_a 5", "_cell_length_b 6", "_cell_length_c 7",
            "_cell_angle_alpha 90", "_cell_angle_beta 90", "_cell_angle_gamma 90",
            "_cod_database_code 4335507",
            "_journal_name_full 'Journal of Crystallography'",
            "_citation_title", ";",
            'A "structure" by O\'Brien',
            "with two lines of prose", ";",
            "_refine_ls_R_factor_all .028",
            "loop_", "_publ_author_name",
            "'Ada Sample'", "\"O'Brien\"",
            "loop_", "_atom_site_label", "_atom_site_type_symbol",
            "_atom_site_fract_x", "_atom_site_fract_y", "_atom_site_fract_z",
            "Si1 Si .125 .25 .375",
        ]) + "\n"
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "source.cif"
            path.write_text(source, encoding="utf-8")
            generated = subprocess.run(
                ["node", "-e", EDIT_AND_EXPORT, str(RUNNER), str(path)],
                cwd=ROOT, text=True, capture_output=True, timeout=25,
                check=True,
            ).stdout
        block = gemmi.cif.read_string(generated).sole_block()
        names = [gemmi.cif.as_string(s) for s in block.find_values("_publ_author_name")]
        self.assertEqual(names, ["Ada Sample", "O'Brien"])
        title = gemmi.cif.as_string(block.find_value("_citation_title"))
        self.assertIn('A "structure" by O\'Brien', title)
        self.assertIn("two lines of prose", title)
        self.assertEqual(gemmi.cif.as_string(block.find_value("_journal_name_full")),
                         "Journal of Crystallography")
        self.assertFalse(list(block.find_values("_cod_database_code")))
        self.assertFalse(list(block.find_values("_refine_ls_R_factor_all")))
        position = list(block.find_values("_atom_site_fract_x"))
        self.assertEqual(len(position), 1)
        self.assertAlmostEqual(float(gemmi.cif.as_number(position[0])), 0.375, places=7)


if __name__ == "__main__":
    unittest.main()
