# Package 10.8.5 — Source-fixed sampling and signed contour sensitivity

## Scientific question

P10.8.4 compared independent triangulators on identical real-derived Float32
fields and found large 48³→64³ area changes in 5wkd FWT/DELFWT with **both**
methods. P10.8.5 separates *source sampling*, *sparse-tail fragmentation*, and
*small scalar threshold shifts* before considering a higher-resolution UI mode.

This is a CI-only diagnostic: there is no production renderer, quality setting,
mesh algorithm, source unit interpretation, or safety-cap change.

## Reproducible method

1. Read the real **5i55 partial CCP4** and real 5wkd C2 MTZ-derived **FWT/PHWT**
   and **DELFWT/PHDELWT** maps with pinned Gemmi 0.7.5. The 5wkd MTZ contains
   367 real reflection rows. Neither generated CCP4 is an independent raw
   experimental CUBE/XSF/CHGCAR file.
2. Export the untouched original Float32 voxels and 32³/48³/64³ grids using
   the application's *actual* CCP4 parser and Worker trilinear sampler. Verify
   shape, finite values, full oblique Cartesian Å extents, origin, and periodicity.
3. Convert the DELFWT **negative tail** to a positive score by multiplication
   by −1. For each source select q=.990 and q=.995 **fixed original-source**
   upper-tail scalar thresholds between adjacent distinct samples. They remain
   *identical absolute thresholds* on 32³, 48³ and 64³. This differs from
   P10.8.4's pooled-grid nearby-largest-gap level selection, so the two
   packages' area percentages are **not numerically interchangeable**.
4. Measure peak retention relative to original peak-minus-median contrast,
   source versus resampled tail **node fraction**, nonperiodic six-neighbor
   voxel-component counts, and peak coordinates in physical Å. The node
   fraction is a sampling diagnostic—not a conserved-electron integral or
   physical enclosed volume.
5. At each fixed threshold, also measure independent Lewiner marching-cubes
   surface area after shifting the *score* threshold by ±2% of the **source**
   peak-minus-median scalar contrast. A shifted contour may genuinely vanish
   and is reported as `empty` instead of throwing or inventing a surface.
6. Report index-space FFT energy near ≥70% of the grid Nyquist in at least
   one axis. Open-boundary maps use a Hann taper on all axes; periodic maps do
   not. This is a **grid-dependent spectral proxy**, *not* a proof of aliasing,
   experimental high-frequency content, physical reciprocal-space cutoff, or
   Fourier-map convergence.

## Gate versus research alerts

**Hard CI failures:** missing/corrupted source, absent grids, nonfinite scalars,
degenerate Cartesian axes, mismatched physical extents/origin/periodicity,
interpolation overshooting the original source extrema, and invalid nonempty
independent isosurface area. Analytical unit tests cover sign symmetry,
vanishing shifted contours, source-fixed level selection, spectral constants,
and oblique-domain extent preservation.

**Research alerts only:** >10% 48³→64³ area or sampled node-fraction change,
>10% area response to ±2% source scalar-contrast level shifts, or disappearance
of a sparse contour. These are not pass/fail physical-error tolerances.

Output: `validation-results/volume-sampling-10-8-5.json`, archived with the
existing P10.8 reports in GitHub Actions. For local reproduction:

```sh
python -m pip install gemmi==0.7.5 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2
python -m unittest discover -s tests/validation -p 'test_volume_sampling.py' -v
python tests/validation/volume_sampling_reference.py
```

## Measured real-map results

Local pinned Gemmi 0.7.5 / NumPy 2.1.3 / SciPy 1.15.3 / scikit-image 0.25.2
execution yielded the following **source-fixed q=.990** results. Percentages
are descriptive changes, not physical accuracy or uncertainty bounds:

| Real source | Peak retention 32³/48³/64³ | Independent area change 48³→64³ | Tail node-fraction change 48³→64³ | ±2% scalar level area response at 64³ |
| --- | --- | ---: | ---: | --- |
| 5i55 partial CCP4 | 95.9% / 98.2% / 100% | 11.97% | 1.99% | 32.71% / 30.05% |
| 5wkd FWT/PHWT | **97.5% / 79.9% / 100%** | **58.92%** | 37.08% | 19.35% / 18.47% |
| 5wkd negative DELFWT/PHDELWT | 99.7% / 99.9% / 100% | **53.41%** | 42.68% | 18.85% / 19.68% |

At the second q=.995 source-fixed threshold, the observed 48³→64³ area
changes were **27.46% (5i55), 76.00% (FWT), and 49.37% (negative DELFWT)**.
The corresponding occupied-node fraction changes were 20.99%, 60.92%, and
37.76%. Those scalar/geometry effects remain far outside a demonstrated
resolution-convergence claim.

The non-monotone 5wkd FWT peak retention (32³ **97.5%**, 48³ **79.9%**) shows
that sampling-point placement can miss a sharp native source peak even at a
larger grid size. The 64³ map agrees at the source sample locations because
5wkd was itself generated as a 64³ map; **this does not prove experimental
continuum convergence**. Sparse fragment counts also change with resolution.
The q=.990 64³ near-Nyquist index-spectrum energy proxy was 0.003% (5i55),
3.01% (FWT) and 2.55% (DELFWT). These percentages use different physical
grid spacings and are **not an identified aliasing budget**.

The full per-threshold 32³/48³/64³ source-density, peak coordinates, source
occupancy, area, component, and spectral tables live in the archived JSON.
P10.8.4 used a different pooled-grid threshold selection: its 62.33% or
87.72% FWT area figures must **not** be presented as an identical-level A/B
comparison with the 58.92% or 76.00% obtained here.

## Interpretation and next work

The comparison can show that peak loss, fragment changes, or sensitivity to
small *scalar* level shifts plausibly contribute to the observed area changes.
It **cannot identify a unique cause** for physical non-convergence: the source
map itself is not an analytic surface reference, an FFT near-Nyquist tail does
not establish aliasing, and a higher grid can reveal new isolated features.
The native production maximum (~40 intervals/axis), 75k triangle budget, and
Worker marching-tetrahedra result remain unchanged. A "high accuracy" control
is scientifically premature until absolute-error/latency/memory A/B tests on
multiple real sources support it.

**Next P10.8.6:** truly independent measured/source-generated CHGCAR, CUBE and
XSF datasets (rather than re-encodings of CCP4), matched scalar-unit/threshold
comparisons against VESTA and another numerical reference, and reproducible
surface/contour alignment and area tests. Include a broader set of experimental
maps and boundary/origin conventions before any accuracy claim.
