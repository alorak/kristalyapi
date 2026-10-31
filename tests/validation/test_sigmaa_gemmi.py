"""V20: σA-weighted map coefficients against Gemmi, SciPy and Refmac.

Real data: the Gemmi test-corpus MTZ 5wkd (C2, Refmac output with FP, FC_ALL,
PHIC_ALL, FWT/PHWT, DELFWT/PHDELWT and FOM).
1. ε and centricity from the editor equal Gemmi's for every reflection.
2. An independent NumPy/SciPy implementation of the same estimator (bounded
   scalar optimisation, scipy.special i0e/i1e) gives the same shell σA and the
   same coefficients as the editor's sigmaa.js.
3. The editor's 2mFo−DFc and mFo−DFc agree with Refmac's own FWT and DELFWT
   (complex correlation over all reflections). Refmac smooths σA and treats
   the free set differently, so agreement — not identity — is required.
"""
from __future__ import annotations

import gzip
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import gemmi
import numpy as np
from scipy.optimize import minimize_scalar
from scipy.special import i0e, i1e


ROOT = Path(__file__).resolve().parents[2]
MTZ = ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"
SHELLS = 6

BRIDGE = r"""
import fs from 'node:fs';
import {sigmaAWeights,epsilonCentric} from './sigmaa.js';
const input=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const result=sigmaAWeights(input.reflections,input.cell,input.rotations,{bins:input.bins});
const rows=input.reflections.map(r=>{const w=result.weights.get(r);return w?{m:w.m,D:w.D,main:w.main,difference:w.difference}:null;});
const ec=input.reflections.map(r=>epsilonCentric([r.h,r.k,r.l],input.rotations));
process.stdout.write(JSON.stringify({shells:result.shells,rows,ec}));
"""


def load():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "5wkd.mtz"
        path.write_bytes(gzip.decompress(MTZ.read_bytes()))
        mtz = gemmi.read_mtz_file(str(path))
    data = np.array(mtz.array)
    col = {c.label: i for i, c in enumerate(mtz.columns)}
    return mtz, data, col


def numpy_sigmaa(hkl, fo, fc, eps, centric, s2, shells):
    order = np.argsort(s2, kind="stable")
    out = {k: np.full(len(fo), np.nan) for k in ("m", "D", "main", "difference")}
    table = []
    # Shells of equal count by 1/d²: boundaries floor(b·n/shells), as documented in sigmaa.js.
    n = len(order)
    for b in range(shells):
        part = order[(b * n) // shells:((b + 1) * n) // shells]
        so = np.mean(fo[part] ** 2 / eps[part])
        sc = np.mean(fc[part] ** 2 / eps[part])
        eo = fo[part] / np.sqrt(eps[part] * so)
        ec = fc[part] / np.sqrt(eps[part] * sc)
        c = centric[part]

        def nll(s):
            a = 1 - s * s
            x = 2 * s * eo * ec / a
            q = eo ** 2 + s * s * ec ** 2
            acentric = np.log(2 * eo / a) - q / a + np.log(i0e(x)) + x
            centr = 0.5 * np.log(2 / (np.pi * a)) - q / (2 * a) + np.logaddexp(x / 2, -x / 2) - np.log(2)
            return -np.sum(np.where(c, centr, acentric))

        sigma = minimize_scalar(nll, bounds=(0.001, 0.999), method="bounded", options={"xatol": 1e-9}).x
        x = 2 * sigma * eo * ec / (1 - sigma ** 2)
        m = np.where(c, np.tanh(x / 2), i1e(x) / i0e(x))
        d = sigma * np.sqrt(so / sc)
        out["m"][part], out["D"][part] = m, d
        out["main"][part] = np.where(c, m * fo[part], 2 * m * fo[part] - d * fc[part])
        out["difference"][part] = m * fo[part] - d * fc[part]
        table.append(sigma)
    return out, np.array(table)


def complex_correlation(a, b):
    return float(np.real(np.vdot(a, b)) / np.sqrt(np.vdot(a, a).real * np.vdot(b, b).real))


class SigmaAAgainstGemmi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mtz, data, col = load()
        hkl = data[:, :3].astype(int)
        fo, fc = data[:, col["FP"]], data[:, col["FC_ALL"]]
        ok = np.isfinite(fo) & np.isfinite(fc) & (fo > 0) & (fc > 0) & np.any(hkl != 0, axis=1)
        cls.mtz, cls.data, cls.col, cls.ok = mtz, data, col, ok
        cls.hkl, cls.fo, cls.fc = hkl[ok], fo[ok], fc[ok]
        cls.phase = data[ok, col["PHIC_ALL"]]
        ops = mtz.spacegroup.operations()
        # Standard ε (International Tables): lattice centring is not counted.
        cls.eps = np.array([ops.epsilon_factor_without_centering(list(h)) for h in cls.hkl], float)
        cls.centric = np.array([ops.is_reflection_centric(list(h)) for h in cls.hkl])
        cls.s2 = np.array([1 / mtz.cell.calculate_d(list(h)) ** 2 for h in cls.hkl])
        # Rotation parts as x' = R x, for the editor (h' = h R).
        rotations = [[[v // gemmi.Op.DEN for v in row] for row in op.rot] for op in ops]
        cell = dict(zip(["a", "b", "c", "alpha", "beta", "gamma"], mtz.cell.parameters))
        reflections = [{"h": int(h[0]), "k": int(h[1]), "l": int(h[2]), "fo": float(a), "fc": float(b), "phase": float(p)}
                       for h, a, b, p in zip(cls.hkl, cls.fo, cls.fc, cls.phase)]
        with tempfile.TemporaryDirectory() as tmp:
            payload = Path(tmp) / "in.json"
            payload.write_text(json.dumps({"reflections": reflections, "cell": cell, "rotations": rotations, "bins": SHELLS}))
            run = subprocess.run(["node", "--input-type=module", "-e", BRIDGE, str(payload)], cwd=ROOT,
                                 text=True, capture_output=True, timeout=120, check=True)
        cls.editor = json.loads(run.stdout)

    def test_epsilon_and_centricity_match_gemmi(self):
        self.assertEqual([e["epsilon"] for e in self.editor["ec"]], self.eps.astype(int).tolist())
        self.assertEqual([e["centric"] for e in self.editor["ec"]], self.centric.tolist())
        self.assertGreater(int(self.centric.sum()), 0)

    def test_editor_equals_independent_scipy_estimator(self):
        reference, sigmas = numpy_sigmaa(self.hkl, self.fo, self.fc, self.eps, self.centric, self.s2, SHELLS)
        np.testing.assert_allclose([s["sigmaA"] for s in self.editor["shells"]], sigmas, atol=2e-5)
        # σA agrees to 2e-5; coefficients (F units, up to ~15) then agree to a few 1e-4.
        for key in ("m", "D", "main", "difference"):
            np.testing.assert_allclose([r[key] for r in self.editor["rows"]], reference[key], rtol=1e-4, atol=5e-4)

    def test_coefficients_agree_with_refmac(self):
        ok, col, data = self.ok, self.col, self.data
        phase = np.radians(self.phase)
        main = np.array([r["main"] for r in self.editor["rows"]]) * np.exp(1j * phase)
        diff = np.array([r["difference"] for r in self.editor["rows"]]) * np.exp(1j * phase)
        fwt = data[ok, col["FWT"]] * np.exp(1j * np.radians(data[ok, col["PHWT"]]))
        delfwt = data[ok, col["DELFWT"]] * np.exp(1j * np.radians(data[ok, col["PHDELWT"]]))
        keep = np.isfinite(fwt) & np.isfinite(delfwt)
        self.assertGreater(complex_correlation(main[keep], fwt[keep]), 0.98)
        self.assertGreater(complex_correlation(diff[keep], delfwt[keep]), 0.94)


if __name__ == "__main__":
    unittest.main()
