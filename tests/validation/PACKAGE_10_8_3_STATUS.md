# Package 10.8.3 — High-resolution scientific convergence and topology

## Scope

The `tests/validation/volume_highres_reference.py` gate uses the original, traceable **Gemmi 5i55 partial monoclinic CCP4** fixture and recomputes Gemmi **5wkd C2 FWT/PHWT** and **DELFWT/PHDELWT** maps independently from real refinement coefficients. Synthetic signed-distance data are used only for a known topological reference.

| Grid | Production default | Research-only full reference |
|---|---|---|
| 32³ | current 40-interval/axis cap | 64-interval override |
| 48³ | current 40-interval/axis cap (stride may be 2) | full-grid extraction, stride 1 |
| 64³ | current 40-interval/axis cap (stride may be 2) | full-grid extraction, stride 1 |

**Safety:** The triangulator is the *same Worker implementation* in both cases. The explicit `maxAxisIntervals` parameter defaults to **40** and can be increased to **64 solely for validation**. In both cases the **75,000 triangle cap** is preserved and truncated output fails the test; no higher-resolution mode is activated in the production UI.

## Scientific checks and limitations

- Report per-grid **actual stride**, triangle count, physically measured surface area in Å², and thresholded voxel-integral occupancy volume in Å³.
- Compare 32→48 and 48→64 *full-grid* outputs. Changes >10% are flagged as research alerts, but lack of monotonicity alone does not invalidate a real experimental grid. Do not interpret these measurements as a certified Hausdorff error bound.
- Audit triangle edges after converting Cartesian Å to the grid's **true oblique index frame**. Degenerate triangles, non-manifold edges and unmatched *interior* edges fail CI. On genuinely **partial** maps open edges at the physical brick boundary are allowed and reported. Matched-edge winding conflicts are reported separately; the test does **not** claim an oriented manifold if they remain.
- For a synthetic **skew periodic** signed sphere crossing the x-face seam, map both periodic edges to their canonical equivalents and require zero unmatched edges. This is a known-topology test, not an independently observed density.
- Real CCP4 source values and MTZ-to-map geometry remain protected by P9.1 / P10.8.1–10.8.2 independent Gemmi gates. Experimentally independent CUBE/XSF/CHGCAR files, other MRC vendors, a second surface-meshing implementation, and cross-GPU performance remain unverified.

## Run

```sh
python -m pip install gemmi==0.7.5 numpy==2.1.3
python tests/validation/volume_highres_reference.py
```

GitHub Actions fails when the Python/Node processes fail. The reproducible JSON output is archived as `validation-results/volume-highres-10-8-3.json` together with the earlier P10.8 report. The test is intentionally not deployed with the frontend.
