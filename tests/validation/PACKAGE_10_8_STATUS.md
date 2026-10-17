# Package 10.8.1–10.8.2 — Independent surface convergence status

The gate uses the **production Worker** source (`isoTriangles`) for final meshes. It does not replace or modify the production isosurface implementation.

## Source and provenance

| Source | Role | Reference |
| --- | --- | --- |
| Analytic signed-distance sphere, radius 0.63 Å | Known exact shape: physical area, enclosed volume, maximum vertex radial error | Derived directly from 4πr² and 4πr³/3; 16³, 24³ and 32³ |
| `tests/fixtures/gemmi-5i55_tiny.ccp4` | Real crystallographic, partial monoclinic map with a nontrivial axis permutation and start offset | P9.1 pinned Gemmi project fixture; header/voxel/Cartesian checks by `ccp4_gemmi_reference.py` |
| `tests/fixtures/gemmi-5wkd_phases.mtz.gz` | Real merged, C2 experimental refinement reflection data | Gemmi 0.7.5 `transform_f_phi_to_map`, using FWT/PHWT and DELFWT/PHDELWT at fixed 64³ resolution |
| CUBE and XSF copies | Check scalar values and physical Cartesian axes survive supported exports/imports | Re-encoded from the above real CCP4 maps; **not** independent measured files |

The source reflection file has **367 reflections, space group #5**. Gemmi is an independent computational implementation and is pinned by the CI workflow. The pre-existing P8.2d/P9.1 quality gates independently check reflection columns, FFT voxels, CCP4 header geometry and voxel values.

## Quantities, meaning and failure policy

- **Analytic sphere:** check final-grid vertex-position radial error <0.025 Å, final surface relative area error <8%, final enclosed-volume error <10%. All three measurements must improve from 16³ to 32³. For this *known convex sphere only*, each triangle is oriented against its known outward radial vector before evaluating the divergence-theorem volume. It is not a general-purpose volume operator for arbitrary experimental maps.
- **Real maps:** report 16³/24³/32³ triangle counts, mesh surface area in Å², 95th-percentile and maximum scalar mismatch of extracted vertices against the original full-resolution source grid, and source-threshold voxel-quadrature occupied volume in Å³. For open partial grids, the latter uses trapezoidal boundary weights. These numbers are reproducible, not alleged exact physical surface areas or enclosed mesh volumes.
- **Failure:** bad coordinates, nonfinite data, empty or budget-truncated isosurfaces, degenerate triangles, failed CUBE/XSF value-and-geometry round-trip, analytical accuracy/convergence failure or Gemmi provenance mismatch fail the required PR CI check.
- **No unsupported promise:** real maps need not converge monotonically in area, and scalar source-field residual is **not** an upper bound on surface Hausdorff distance. In particular, a thin peak may be absent from all coarse samples without being detected. CI does not claim a universal geometrical error bound or independent CHGCAR/CUBE/XSF experimental fixture coverage.
- **Octree:** the P10.7 local, 2:1-transition mesh remains preview-only. All final surfaces, voxel arrays, crystal structure data and scientific export semantics are unchanged.

## Run and artifacts

```sh
python -m pip install gemmi==0.7.5 numpy==2.1.3
python tests/validation/volume_surface_reference.py
```

The script writes `validation-results/volume-surface-10-8.json`. The `Validate and deploy crystal studio` PR workflow treats the script's nonzero exit code as a hard failure and uploads the report, where available. When a failure occurs before generating the report, the workflow logs contain the error rather than a false pass.

**Next:** a larger physically independent CUBE/XSF/CHGCAR dataset with traceable licenses and file hashes; manifold/topology and periodic-boundary checks against real maps; optional independent surface extraction for distance/area estimates; additional GPUs/OSes in the performance matrix.
