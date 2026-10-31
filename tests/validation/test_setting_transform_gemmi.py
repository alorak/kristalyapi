"""V18.3: setting transformations checked against Gemmi's own symmetry tables.

For every space group with two tabulated settings in the editor:
1. each editor setting equals exactly one Gemmi setting (same operation set);
2. the editor's (P, p), applied to *Gemmi's* operations of the source setting
   (W' = P^-1 W P, w' = P^-1 (w + (W - I) p)), gives Gemmi's target operations;
3. a general-position atom transformed by the editor and expanded with Gemmi
   in both settings has the same interatomic distances (rigid invariant) and
   the cell volume scales by det P;
4. anisotropic U keeps its Cartesian eigenvalues (Gemmi orthogonalisation).
"""
from __future__ import annotations

from fractions import Fraction
import json
from pathlib import Path
import subprocess
import unittest

import gemmi
import numpy as np


ROOT = Path(__file__).resolve().parents[2]

BRIDGE = r"""
import fs from 'node:fs';
import {findSettingTransform,transformStructure} from './setting-transform.js';
const app=fs.readFileSync('crystal-app.js','utf8');
const SG=JSON.parse(app.match(/^const SPACE_GROUPS=(\{.*\});$/m)[1]);
const pairs=k=>{const [c,o]=SG[k];return o.flatMap(op=>c.map(t=>[op,t]));};
const groups={};for(const k of Object.keys(SG)){const n=k.split('-')[0];(groups[n]=groups[n]||[]).push(k);}
const cellFor=k=>{const n=Number(k.split('-')[0]);
 if(k.endsWith('rhombohedral'))return {a:5.2,b:5.2,c:5.2,alpha:55,beta:55,gamma:55};
 if(n>=143&&n<=194)return {a:4.9,b:4.9,c:13.1,alpha:90,beta:90,gamma:120};
 if(n>=195)return {a:7.1,b:7.1,c:7.1,alpha:90,beta:90,gamma:90};
 if(n>=75)return {a:6.3,b:6.3,c:9.7,alpha:90,beta:90,gamma:90};
 if(n>=16)return {a:5.1,b:6.7,c:8.9,alpha:90,beta:90,gamma:90};
 return k.endsWith('-c')?{a:5.1,b:6.7,c:8.9,alpha:90,beta:90,gamma:104.5}:{a:5.1,b:6.7,c:8.9,alpha:90,beta:104.5,gamma:90};};
const site={symbol:'Fe',label:'Fe1',x:.1234,y:.2871,z:.4119,occupancy:1,adp:[.012,.018,.025,.002,-.004,.003]};
const out=[];
for(const keys of Object.values(groups)){if(keys.length!==2)continue;
 for(const [from,to] of [[keys[0],keys[1]],[keys[1],keys[0]]]){
  const t=findSettingTransform(pairs(from),pairs(to)),cell=cellFor(from),moved=transformStructure(cell,[site],t);
  out.push({from,to,P:t.P,p:t.p,cell,site,newCell:moved.cell,newSite:moved.sites[0],
   fromOps:pairs(from),toOps:pairs(to)});
 }}
process.stdout.write(JSON.stringify(out));
"""


def editor_cases():
    run = subprocess.run(["node", "--input-type=module", "-e", BRIDGE], cwd=ROOT, text=True,
                         capture_output=True, timeout=300, check=True)
    return json.loads(run.stdout)


def frac(value):
    return Fraction(value).limit_denominator(48)


def op_key(rot, tran):
    return (tuple(tuple(frac(v) for v in row) for row in rot), tuple(frac(v) % 1 for v in tran))


def gemmi_ops(sg):
    keys = set()
    for op in sg.operations():
        rot = [[Fraction(v, op.DEN) for v in row] for row in op.rot]
        tran = [Fraction(v, op.DEN) for v in op.tran]
        keys.add(op_key(rot, tran))
    return keys


def editor_ops(pairs):
    keys = set()
    for xyz, shift in pairs:
        op = gemmi.Op(xyz)
        centring = [Fraction(s) for s in shift.split(",")]
        rot = [[Fraction(v, op.DEN) for v in row] for row in op.rot]
        tran = [Fraction(v, op.DEN) + c for v, c in zip(op.tran, centring)]
        keys.add(op_key(rot, tran))
    return keys


def gemmi_settings(number):
    return [sg for sg in gemmi.spacegroup_table() if sg.number == number]


def unit_cell(c):
    return gemmi.UnitCell(c["a"], c["b"], c["c"], c["alpha"], c["beta"], c["gamma"])


def matching_setting(number, pairs):
    wanted = editor_ops(pairs)
    return [sg for sg in gemmi_settings(number) if gemmi_ops(sg) == wanted]


def expand(sg, position):
    return sg.operations().sym_ops and [
        np.array(position) for position in
        {tuple(round(v % 1.0, 9) % 1.0 for v in np.array(op.apply_to_xyz(position)))
         for op in sg.operations()}
    ]


def distances(cell, atoms, reach=7.0):
    """Sorted distances from the first atom to all images within `reach` Å."""
    origin = cell.orthogonalize(gemmi.Fractional(*atoms[0]))
    out = []
    span = [int(np.ceil(reach / length)) + 1 for length in (cell.a, cell.b, cell.c)]
    for atom in atoms:
        for i in range(-span[0], span[0] + 1):
            for j in range(-span[1], span[1] + 1):
                for k in range(-span[2], span[2] + 1):
                    p = cell.orthogonalize(gemmi.Fractional(atom[0] + i, atom[1] + j, atom[2] + k))
                    d = p.dist(origin)
                    if 1e-6 < d < reach:
                        out.append(d)
    return np.array(sorted(out))


def u_cartesian(cell, u):
    frac_to_cart = np.array(cell.orth.mat.tolist())
    rec = cell.reciprocal()
    n = np.diag([rec.a, rec.b, rec.c])
    m = np.array([[u[0], u[5], u[4]], [u[5], u[1], u[3]], [u[4], u[3], u[2]]])
    return frac_to_cart @ n @ m @ n @ frac_to_cart.T


class SettingTransformGemmi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = editor_cases()

    def test_each_editor_setting_is_one_gemmi_setting(self):
        seen = set()
        for case in self.cases:
            for key, pairs in ((case["from"], case["fromOps"]), (case["to"], case["toOps"])):
                if key in seen:
                    continue
                seen.add(key)
                number = int(key.split("-")[0])
                with self.subTest(setting=key):
                    # Gemmi lists some identical operation sets under two symbols
                    # (e.g. C c c a :1 and C c c b :1); one operation set is what matters.
                    matches = matching_setting(number, pairs)
                    self.assertGreaterEqual(len(matches), 1)
                    self.assertEqual(len({frozenset(gemmi_ops(sg)) for sg in matches}), 1)
        self.assertEqual(len(seen), 88)

    def test_editor_transform_maps_gemmi_operations_onto_gemmi_target(self):
        for case in self.cases:
            with self.subTest(case=case["from"] + "->" + case["to"]):
                number = int(case["from"].split("-")[0])
                source = matching_setting(number, case["fromOps"])[0]
                target = matching_setting(number, case["toOps"])[0]
                P = [[frac(v) for v in row] for row in case["P"]]
                p = [frac(v) for v in case["p"]]
                P_np = np.array([[float(v) for v in row] for row in P])
                Pi = [[frac(v) for v in row] for row in np.linalg.inv(P_np).tolist()]

                def mul(a, b):
                    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]

                mapped = set()
                for op in source.operations():
                    W = [[Fraction(v, op.DEN) for v in row] for row in op.rot]
                    w = [Fraction(v, op.DEN) for v in op.tran]
                    W2 = mul(mul(Pi, W), P)
                    shifted = [w[i] + sum(W[i][j] * p[j] for j in range(3)) - p[i] for i in range(3)]
                    w2 = [sum(Pi[i][j] * shifted[j] for j in range(3)) for i in range(3)]
                    mapped.add(op_key(W2, w2))
                target_ops = gemmi_ops(target)
                self.assertTrue(mapped <= target_ops)
                det = float(np.linalg.det(P_np))
                self.assertAlmostEqual(len(target_ops), len(source.operations()) * det, places=6)
                self.assertEqual(round(len(mapped) * max(1.0, det)), len(target_ops))

    def test_transformed_atom_is_the_same_crystal(self):
        for case in self.cases:
            with self.subTest(case=case["from"] + "->" + case["to"]):
                number = int(case["from"].split("-")[0])
                source = matching_setting(number, case["fromOps"])[0]
                target = matching_setting(number, case["toOps"])[0]
                old_cell, new_cell = unit_cell(case["cell"]), unit_cell(case["newCell"])
                det = float(np.linalg.det(np.array(case["P"])))
                self.assertAlmostEqual(new_cell.volume, old_cell.volume * det, places=4)
                s, t = case["site"], case["newSite"]
                before = expand(source, [s["x"], s["y"], s["z"]])
                after = expand(target, [t["x"], t["y"], t["z"]])
                self.assertEqual(len(after), round(len(before) * det))
                # Same multiset of distances (Å) away from the cut-off edge; coordinates are
                # exchanged with 1e-10 precision, so 1e-6 Å is far tighter than any physical change.
                d0, d1 = distances(old_cell, before), distances(new_cell, after)
                d0, d1 = d0[d0 < 6.5], d1[d1 < 6.5]
                self.assertEqual(len(d0), len(d1))
                np.testing.assert_allclose(d0, d1, atol=1e-6)
                u0 = np.linalg.eigvalsh(u_cartesian(old_cell, s["adp"]))
                u1 = np.linalg.eigvalsh(u_cartesian(new_cell, t["adp"]))
                np.testing.assert_allclose(u0, u1, atol=1e-9)


if __name__ == "__main__":
    unittest.main()
