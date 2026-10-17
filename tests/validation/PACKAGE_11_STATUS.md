# Package 11 — Multi-channel CUBE/XSF and VESTA setting provenance

## What changed

1. **Gaussian CUBE:** Support positive `NATOMS` with an optional fifth
   `NVAL` header parameter (1–5 scalar values per voxel). Support negative
   `NATOMS` with the mandatory post-atom `DSET_IDS` count and orbital IDs,
   including IDs split over multiple lines. Store channels separately,
   preserving the original CUBE ordering: X outer, Y middle, Z inner,
   **channel innermost**. Keep original atoms, nuclear charge, affine Å
   origin/axes and nonperiodic display-frame offset. The `NVAL` and
   `DSET_IDS` conventions may not be combined.
2. **XCrySDen XSF:** Read up to five named 3D DATAGRID sections, rejecting
   inconsistent resolutions and shifted/skewed Cartesian frames. Translate
   source X-fastest voxel storage into the app's Z-fastest internal order.
   Interpret an `ATOMS` section as nonperiodic Cartesian Å molecules, not
   as an implicit crystallographic unit cell; preserve Å coordinates in
   scene, project history and recent files. Existing periodic
   `PRIMVEC`/`PRIMCOORD` support remains.
3. **Shared interface:** Imported channels appear as independent labelled
   layers in the existing density selector, contour controls, isosurfaces,
   numerical sections and exports. The total **five-layer safety bound**
   includes preexisting and newly loaded fields. Multi-channel files may
   not masquerade as single-field direct potential maps or a single VESTA
   `IMPORT_DENSITY`/`ISURF` reference.
4. **VESTA 3.x:** Retain source `GROUP` number, setting code and symbol,
   plus detection/provenance for custom `SYMOP`/`TRANM`. Unknown alternative
   setting codes or explicit transformations **do not get interpreted as
   proven standard-setting symmetry operations**. Import listed positions
   as P1 and tell the user that expansion is unavailable. The internal
   preferred setting still carries an explicit equivalence warning even
   when no custom transform is detected.

## Independent scientific verification

`python tests/validation/volume_11_reference.py` is a required GitHub
Actions gate, using pinned **ASE 3.26.0**, **NumPy 2.1.3** and the actual
browser JavaScript reader + production isosurface Worker.

The starting point is the real computed 23×23×24, nine-atom Gaussian CUBE
from the immutable upstream `pymatgen-core` commit
[`7b8595f6`](https://github.com/materialsproject/pymatgen-core/commit/7b8595f6d526382343ad831872802486dc62a388),
compressed-file SHA-256
`4d3e32d374920e2a1210ebc718ad2f358751ea1861190281fce2ad4d2a0fb8df`.
The same SHA-256 check from Package 10.8.6 runs *before* any derived file is
created. Nothing is presented as independently computed new density:

| Input variant | Independent reference | Required pass conditions |
| --- | --- | --- |
| `NVAL=2` CUBE, channels `ρ` and `−0.5ρ` | ASE `read_cube(...)["datas"]` | Both complete 12,696-sample arrays, Å grid basis/origin and nine Å atom coordinates |
| `NATOMS<0`, `DSET_IDS=1 17` CUBE | Original ASE-decoded CUBE scalar | Orbital label 17, 12,696 samples, source Å frame and nine atoms |
| ASE-written molecular XSF with added `0.25ρ` DATAGRID | ASE `write_xsf`/`read_xsf`, original CUBE array | Both complete 12,696-sample arrays, nonperiodic `ATOMS`, original Å frame and nine atoms |

The comparator requires **zero failures** under combined relative `2×10⁻⁶`
and absolute `1×10⁻⁵` Å/frame or scalar tolerance (the source is converted
to `Float32`). Every input must also yield a finite, nonempty, uncapped
production Worker isosurface. The extra scalar fields are **mathematical
derivations** from one genuine electronic-density fixture; this is
format/interleaving and coordinate validation, **not** an independent
multi-orbital wavefunction simulation or an experiment with multiple sources.

Supplementary native regression tests reject malformed CUBE field counts,
duplicate orbital IDs, incompatible XSF data grids and AXSF animations,
and test VESTA custom-setting warnings/P1 fallback. A Chromium/WebGL smoke
test loads both types of two-field dataset, selects the second layer and
checks the molecule's native Å coordinates.

## Reproduce

```sh
node --test tests/core.test.cjs tests/volume-worker.test.cjs tests/offline.test.mjs tests/worker.test.mjs tests/reciprocal.test.mjs tests/coordination-reference.test.cjs tests/validation/test_runner.cjs
python -m pip install ase==3.26.0 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2
python tests/validation/volume_11_reference.py
node tests/browser/visual.test.mjs  # after local Playwright/Chromium and Moyo setup
```

The JSON evidence is archived in the CI artifact as
`validation-results/volume-11-multifield-scientific.json`.

## Honest limitations / VESTA comparison

- **No VESTA GUI automation or visual parity claim.** Although numeric
  frames are cross-checked against ASE, a screenshot/isosurface comparison
  with desktop VESTA and an independent suite of VESTA project settings
  are still untested.
- **P1 fallback is deliberate, not a transformation engine.** When a
  source VESTA project uses an explicit nonstandard origin/setting, the
  program does not know the exact affine transform and cannot prove that
  its preferred internal symmetry operations are equivalent. Keeping the
  given asymmetric sites is safer than fabricating transformed atoms.
- **AXSF animation trajectories, arbitrary XSF multi-frame datasets,
  more than five volume fields, mixed-grid multi-block files** and
  wavefunction orbital rendering beyond a scalar isovalue are out of scope.
- CUBE does not inherently prove that its scalars are `e/Å³`, nor does XSF
  generally assign a universal physical quantity; unit interpretations
  remain explicit user choices. The real-source fields were compared in
  their native scalar units.
- The validated production isosurface remains within its existing
  resolution/triangle safety policy. Packages 10.8.4–10.9 identified
  significant real-map convergence and device-cost limitations; Package
  11 does not enable a high-accuracy UI mode.

**Next Package 12:** independently validated crystallographic coordination
and bond valence with mixed occupancies, element/pair reference datasets
and clear distinction between geometrically visualized and chemically
substantiated bonds. A larger genuinely independent multi-orbital corpus
and desktop VESTA cross-check remain explicit follow-up items.
