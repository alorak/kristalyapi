# Package 10.9 — CUBE atoms, independent ASE-written XSF, 40/64 cost audit

**Scope:** Real Gaussian CUBE molecules can now import their atom table along
with the scalar field. The original scalar voxels, affine Å basis and origin
are not modified. The package also adds one larger computed-field XSF variant
and a diagnostic-only Worker performance comparison. **This is not a claim
that the program matches VESTA screenshots or all CUBE/XSF features.**

## Imported CUBE atom frame

- Read all ordinary CUBE atom rows (atomic number, nuclear charge, and three
  positions); respect the positive-grid-size Bohr or negative-grid-size Å
  coordinate convention. Nine atoms from the pinned upstream electron CUBE
  match independent **ASE 3.26.0** positions and atomic numbers.
- CUBE does **not** intrinsically specify a periodic unit cell. For files
  with 1–1,000 atoms, construct a *display-only*, nonperiodic orthorhombic
  box enclosing all eight physical grid corners and atoms with padding.
  Save its Cartesian offset with the nonperiodic sites, so scene positions
  stay exactly in the density grid's native Å coordinate system.
- Do not show a fabricated physical cell or physical cell volume. Default
  bonding is nonperiodic; restore the display offset through project JSON
  and local recent-structure persistence. No automatic crystal-space-group
  inference is implied. If atom loading is unchecked, retain the user's
  structure instead of replacing it.
- CUBE orbital index arrays, multi-dataset fields and structures exceeding
  1,000 sites are **not** newly supported by this change; the usual volumetric
  size/security checks still apply.

## Independent larger XSF source

The [pinned pymatgen-core fixture](https://github.com/materialsproject/pymatgen-core/commit/7b8595f6d526382343ad831872802486dc62a388)
is a 23×23×24 computed electron CUBE, compressed-source SHA-256
`4d3e32d374920e2a1210ebc718ad2f358751ea1861190281fce2ad4d2a0fb8df`.
The independent ASE `write_xsf` writer converts its **unchanged 12,696
source scalar samples** to XSF. This is a **derived encoding of the same
computed field**, not an independently acquired physical XSF measurement.
ASE emits `BEGIN_DATAGRID_3Dgrid#1` without the previously required
underscore; the real browser XSF reader now accepts this legal label.

Direct original-CUBE ↔ ASE-generated-XSF comparisons:

| Quantity | Result | Failure condition |
| --- | --- | --- |
| XSF-to-CUBE scalars | **0 / 12,696 mismatches**; max 5.01×10⁻⁷ source units | Absolute tolerance 2×10⁻⁶, relative 3×10⁻⁶ |
| XSF ↔ independent ASE XSF reader | **0 mismatches** | Prior strict array comparator |
| XSF affine voxel axes | **0 / 9 mismatches** | Å tolerance 10⁻⁵ |
| XSF vs CUBE Cartesian origin | **0 / 3 mismatches** | Å tolerance 10⁻⁵ |
| Original CUBE atoms | **9 positions and atomic numbers preserved** | Coordinate Å tolerance 10⁻⁵ |

The tiny 2³ upstream XSF remains in the P10.8.6 independent original-format
gate. The new 23×23×24 XSF adds physical field complexity but **is still
not an independent XSF simulation source**. XSF `ATOMS` records are not newly
imported as crystal sites in this package.

## Production 40 vs research-only full 64 intervals

For the pinned original 32³ CHGCAR and computed CUBE, plus derived XSF,
the benchmark uses the **actual** production trilinear resampler and Worker
isosurface code at 32³, 48³ and 64³. An absolute isolevel is selected once
from the original source's 97th-percentile distinct-scalar gap and held fixed
across resampling. Each source grid runs:

- **production-40:** current Worker maximum of 40 intervals/axis;
- **research-64:** diagnostic only, maximum of 64 intervals/axis, no silent
  decimation; both obey the original **75,000-triangle cap**.

| Real-source family | Full-resolution 48³ → 64³ Å² area change | Example 64³ triangles, 40 / 64 | Example 64³ duration, 40 / 64 |
| --- | ---: | ---: | ---: |
| Li CHGCAR | **7.27%** | 9,264 / 35,200 | 120 / 895 ms |
| Computed CUBE | **1.09%** | 7,874 / 31,804 | 119 / 1,088 ms |
| ASE-written XSF of that CUBE | **1.09%** | 7,874 / 31,804 | 120 / 880 ms |

The timings are **one local Node CPU run**, rounded and *not* browser
frame times, GPU timings or device-independent performance guarantees. The
full run produces roughly four times as many mesh triangles; on this runner,
it took roughly 7–9× as long as the 40-interval path for 64³ inputs.
The CI report includes input/sample bytes, mesh bytes, elapsed times and
observed RSS, with **no hard milliseconds/RSS budget gate**. A >10% full
48→64 area change sets an *alert* rather than passing convergence. The
existing experimental 5wkd map still exhibited much larger sensitivity in
P10.8.4/5, so **no high-accuracy UI setting is enabled** in P10.9.
Even small area change cannot prove topological or physical convergence.

## Reproduce and verify

```sh
python -m pip install ase==3.26.0 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2
node --test tests/core.test.cjs
python tests/validation/volume_vesta_formats_reference.py
python tests/validation/volume_109_reference.py
node tests/browser/visual.test.mjs  # after installing local Playwright + Moyo WASM
```

The immutable downloaded fixture is SHA-256 checked and not vendored into
the app. `volume_109_reference.py` creates its converted XSF in a temporary
directory and archives the numeric/cost report to
`validation-results/volume-109-real-format-and-cost.json` in GitHub Actions.
The browser screenshot test proves the display-only box is hidden and that
atoms and density retain their offset in the real WebGL scene; it is **not
a VESTA GUI capture**.

**Still open:** Automated side-by-side VESTA GUI rendering is unavailable
here, different source families and orbital CUBE variants need larger
coverage, and convincing convergence/device profiles are prerequisites for
user-selectable high-resolution volumetric surfaces.

**Next package 11:** More format/project interoperability, CUBE and XSF
advanced cases, provenance-conscious VESTA project/setting compatibility.
**Then package 12:** Advanced coordination, bond-valence and crystal
chemistry/reference validation.
