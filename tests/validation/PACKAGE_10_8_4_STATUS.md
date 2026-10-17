# Package 10.8.4 — Independent algorithm, iso-threshold and fragmentation diagnostics

## Scientific question

The previous full-grid measurements showed substantial changes from 48³ to 64³ for both Gemmi-derived 5wkd FWT and DELFWT density. Are these primarily due to **voxel resolution / unresolved density peaks**, or are they artifacts of the particular **marching-tetrahedra triangulator**?

The comparison uses the *identical scalar voxels* on each grid and the same affine Å coordinate frame for both algorithms:
- **Kristal Yapı:** unmodified production Worker `isoTriangles` with the pre-existing P10.8.3 *research-only* `maxAxisIntervals=64` override, still under **75,000 triangles**.
- **Independent algorithm:** pinned `scikit-image==0.25.2` Lewiner marching cubes (with pinned `scipy==1.15.3` and `numpy==2.1.3`).

The source maps are a real Gemmi 5i55 partial CCP4 map plus two independent FFT maps calculated with `gemmi==0.7.5` from the actual real 5wkd C2 refinement MTZ (367 reflections). These are **real-source-derived electron densities**, not independent raw experimental CUBE/XSF/CHGCAR files.

## Design / quantities

- For **each source**, select two near-peak signed percentiles from gaps strictly **between all sampled voxel values** across source/32³/48³/64³ grids; avoid the isovalue equals a grid node singularity that previously generated degenerate triangles. For the difference density, use negative peaks. Both algorithms use identical levels, with their numeric scalar units deliberately unspecified.
- Compare **two thresholds × three grids × three sources = 18 identical-input paired meshes**.
- `surfaceAreaA2`: actual triangle area in Cartesian Å², computed independently in Python. Same-grid method disagreement does **not** equal an error against an analytically known surface.
- `vertexSnappedComponents`: number of connected mesh components after rounding vertices to **0.0005 voxel-index units**; this is explicitly tolerance-dependent. Connected-component counts of the **source thresholded voxel grid** use **nonperiodic 6-connectivity**, as a separate indicator of input-field fragmentation.
- `symmetricNearestVertexP50A / P95A / MaxA`: *sampled* nearest-**vertex** distances from each method to the other, both directions, over at most 12,000 deterministic vertices per surface. **NOT** exact nearest-triangle distance, Hausdorff bound or global accuracy guarantee.
- `nativeAreaChange48to64` / `independentAreaChange48to64`: isolate whether **both different algorithms** show marked changes on successively sampled voxels. Where they do, voxel field / resolution / topology is a plausible contributor, **not a definitive causal explanation**.
- `methodDisagreementAlert`: same-grid surface area difference exceeds **10%**; `bothMethodsSensitiveOver10Percent`: both methods change area by >**10%** from 48³ to 64³. These are research **alerts only**, not pass/fail thresholds, and do not claim scientific convergence when absent.

## Hard CI gates

- All 18 comparisons must execute: no missing, truncated (>75k triangle), non-finite or geometrically degenerate native surfaces.
- Independent marching cubes must produce finite, non-empty triangles on the same grid and threshold.
- Both meshes must be in the same grid's physical coordinate domain.
- Sampled 95th-percentile nearest-vertex mismatch must not exceed a deliberately **loose catastrophic-misregistration guard: five maximum voxel step lengths**. This is a smoke guard, **not scientific surface error certification**.
- Python/Node nonzero exit code fails PR CI. All numerical tables are retained in `validation-results/volume-independent-10-8-4.json`; no research threshold is silently promoted to a scientific pass.
- The production UI, mesh extraction default, maximum voxel budget, and safety limits **are unchanged**.

## Local execution

```sh
python -m pip install gemmi==0.7.5 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2
python tests/validation/volume_independent_reference.py
```

## Measured result (PR CI run 39061733464)

All values below compare 48³→64³ **full-grid** native/independent surface areas at a shared threshold and shared Float32 voxel field:

| Source and quantile | Native Δarea 48→64 | Independent Δarea 48→64 | Native/independent 64³ area difference | 64³ snapped components: native/ref |
| --- | ---: | ---: | ---: | ---: |
| 5i55 partial CCP4, q=.990 | 5.84% | 5.88% | 0.09% | 3 / 3 |
| 5i55 partial CCP4, q=.995 | 9.88% | 9.92% | 0.22% | 4 / 4 |
| 5wkd weighted FWT/PHWT, q=.990 | **62.33%** | **62.42%** | 4.58% | 68 / 72 |
| 5wkd weighted FWT/PHWT, q=.995 | **87.72%** | **88.01%** | 6.29% | 30 / 30 |
| 5wkd signed DELFWT/PHDELWT, q=.005 | **47.21%** | **47.20%** | 1.72% | 32 / 32 |
| 5wkd signed DELFWT/PHDELWT, q=.010 | **52.71%** | **53.01%** | 1.79% | 64 / 66 |

**Interpretation:** at identical input grids and scalar levels, two independent triangulation algorithms show nearly identical *changes between grid sizes*, but nonidentical absolute areas and fragment counts. This is strong evidence that the very large 5wkd 48→64 area changes are largely **sampled-field/resolution/effective feature-scale** sensitivity rather than exclusively a marching-tetrahedra artifact. It is **not** a proof that the FWT source map is physically converged, nor evidence that a different algorithm fixes it. For 5wkd FWT at q=.995 the observed change is almost 88% in both methods; no automatic high-accuracy switch is scientifically justified yet.

## Remaining research

The independent extractor is **not** a gold-standard physical surface. Robust accuracy claims would require known analytic fields and point-to-triangle distances, voxel/surface error bounds, more independent real samples (including CHGCAR/CUBE/XSF), and source-map physical-quantity/unit provenance. An optional “high accuracy” UI mode is **deferred** until error vs performance is quantified and the 75k triangle budget can be upheld for target large datasets.
