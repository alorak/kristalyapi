#!/usr/bin/env python3
"""Dump monoclinic cell-choice settings (ITA cell choices 2 and 3, unique axis
b and c) from Gemmi's symmetry tables for tools/build_monoclinic_settings.mjs.

Output: tools/monoclinic_settings.json with, per setting, the centring
translations, the operations (x,y,z first) and the full and short H-M symbols.
Gemmi (MPL-2.0) tabulates the settings of International Tables Vol. A.

Usage: python3 tools/build_monoclinic_settings.py   (requires gemmi)
"""
import json
from fractions import Fraction
from pathlib import Path

import gemmi

GROUPS = [5, 7, 8, 9, 12, 13, 14, 15]          # groups with cell choices 1–3
QUALIFIERS = ["b1", "b2", "b3", "c1", "c2", "c3"]


def fraction_text(value):
    f = Fraction(value, gemmi.Op.DEN)
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


def main():
    out = {"source": "gemmi " + gemmi.__version__ + " spacegroup_table (International Tables Vol. A settings)",
           "settings": []}
    for number in GROUPS:
        for qualifier in QUALIFIERS:
            sg = next(s for s in gemmi.spacegroup_table() if s.number == number and s.qualifier == qualifier)
            ops = sg.operations()
            sym = [op.triplet() for op in ops.sym_ops]
            assert sym[0] == "x,y,z"
            centring = [",".join(fraction_text(v) for v in c) for c in ops.cen_ops]
            out["settings"].append({"number": number, "qualifier": qualifier, "hm": sg.hm,
                                    "short": sg.short_name(), "centring": centring, "operations": sym})
    path = Path(__file__).resolve().parent / "monoclinic_settings.json"
    path.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
