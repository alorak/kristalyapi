"""V20: nearest-nucleus (Voronoi) partition of a real periodic cube field.

The pinned upstream Bader fixture (pymatgen-core test-files, Cr4O5, 23x23x24,
read with ASE) is partitioned twice:
* independently here with NumPy: every voxel centre i/n is assigned to the
  nearest nucleus over all periodic images (minimum image in Cartesian Å);
* by the editor's volume-analysis.js (block assignment, voxel-by-voxel
  refinement of boundary blocks, exact block sums).
The per-atom sums must agree to rounding, the totals must equal the grid
integral, and the editor's boundary bound must cover every voxel whose two
nearest nuclei are closer than the voxel diagonal.
Units are the cube's own numbers (not presumed e/Å³); only the partition is
compared.
"""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import urllib.error
import urllib.request

import numpy as np

try:
    from ase.io.cube import read_cube
except ImportError:  # pragma: no cover - CI installs ASE
    read_cube = None

ROOT = Path(__file__).resolve().parents[2]
URL = ("https://raw.githubusercontent.com/materialsproject/pymatgen-core/"
       "7b8595f6d526382343ad831872802486dc62a388/test-files/command_line/bader/elec.cube.gz")
SHA256 = "4d3e32d374920e2a1210ebc718ad2f358751ea1861190281fce2ad4d2a0fb8df"

BRIDGE = r"""
import fs from 'node:fs';
import {voronoiPartition} from './volume-analysis.js';
const input=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const out=[];
for(const maxBlocks of [12000,1500])
 out.push(voronoiPartition({dims:input.dims,values:Float64Array.from(input.values),periodic:true},input.rows,input.fractions,{maxBlocks}));
process.stdout.write(JSON.stringify(out));
"""


def numpy_partition(values, rows, fractions):
    n = np.array(values.shape)
    grid = np.stack(np.meshgrid(*[np.arange(k) / k for k in n], indexing="ij"), axis=-1).reshape(-1, 3)
    best = np.full(len(grid), np.inf)
    second = np.full(len(grid), np.inf)
    owner = np.full(len(grid), -1)
    for atom, f in enumerate(fractions):
        nearest = np.full(len(grid), np.inf)
        for shift in np.array(np.meshgrid([-1, 0, 1], [-1, 0, 1], [-1, 0, 1], indexing="ij")).reshape(3, -1).T:
            delta = grid - (np.asarray(f) % 1.0) - shift
            nearest = np.minimum(nearest, np.linalg.norm(delta @ rows, axis=1))
        closer = nearest < best
        second = np.where(closer, best, np.minimum(second, nearest))
        owner = np.where(closer, atom, owner)
        best = np.where(closer, nearest, best)
    volume = abs(np.linalg.det(rows))
    flat = values.reshape(-1) * volume / values.size
    charges = np.bincount(owner, weights=flat, minlength=len(fractions))
    return charges, best, second, flat


class VoronoiAgainstNumpy(unittest.TestCase):
    def test_real_cube_partition_matches_independent_numpy(self):
        if read_cube is None:
            self.skipTest("ASE is not installed")
        try:
            with urllib.request.urlopen(URL, timeout=60) as response:
                compressed = response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            self.skipTest(f"pinned fixture unavailable: {error}")
        self.assertEqual(hashlib.sha256(compressed).hexdigest(), SHA256)
        with tempfile.TemporaryDirectory() as tmp:
            cube = Path(tmp) / "elec.cube"
            cube.write_bytes(gzip.decompress(compressed))
            with cube.open("r", encoding="utf8") as handle:
                data = read_cube(handle)
            atoms, values = data["atoms"], np.asarray(data["data"], dtype=float)
            self.assertTrue(all(atoms.pbc))
            rows = np.asarray(atoms.cell, dtype=float)
            fractions = atoms.get_scaled_positions(wrap=True)
            payload = Path(tmp) / "grid.json"
            payload.write_text(json.dumps({"dims": list(values.shape), "values": values.reshape(-1).tolist(),
                                           "rows": rows.tolist(), "fractions": fractions.tolist()}))
            run = subprocess.run(["node", "--input-type=module", "-e", BRIDGE, str(payload)], cwd=ROOT,
                                 text=True, capture_output=True, timeout=300, check=True)
        editor = json.loads(run.stdout)
        charges, best, second, flat = numpy_partition(values, rows, fractions)
        total = flat.sum()
        for result in editor:
            with self.subTest(stride=result["stride"]):
                np.testing.assert_allclose(result["charges"], charges, rtol=1e-9, atol=1e-9 * abs(total))
                self.assertAlmostEqual(result["total"], total, delta=1e-9 * abs(total))
                # Voxels whose two nearest nuclei are within one voxel diagonal of each other.
                ambiguous = (second - best) <= 2 * result["voxelHalfDiagonal"]
                self.assertAlmostEqual(sum(result["uncertainty"]), 2 * np.abs(flat[ambiguous]).sum(),
                                       delta=1e-9 * abs(total))
        self.assertGreater(editor[1]["stride"], 1)
        self.assertGreater(editor[1]["refinedBlocks"], 0)


if __name__ == "__main__":
    unittest.main()
