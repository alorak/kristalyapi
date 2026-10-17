# Package 10.8.6 — Independent upstream volumetric files and VESTA protocol

**Status:** the actual browser CUBE, CHGCAR, and XSF readers are compared to
the unrelated [ASE 3.26.0](https://wiki.fysik.dtu.dk/ase/) implementations.
**VESTA itself was not executed.** This is a reproducible format/scalar/Å-frame
gate plus a *manual VESTA comparison protocol*, not a VESTA screenshot result.

## Independent source data (pinned, no repackaged CCP4)

Source repository: [materialsproject/pymatgen-core](https://github.com/materialsproject/pymatgen-core),
commit [`7b8595f6`](https://github.com/materialsproject/pymatgen-core/commit/7b8595f6d526382343ad831872802486dc62a388),
MIT-licensed upstream test corpus. The CI fetches each original file from that
**immutable commit**, verifies its *compressed-byte* SHA-256 **before**
decompressing, and rejects source fields over the app's 24 MB limit.

| Field | Source path below `test-files/` | SHA-256 | Provenance / limitation |
| --- | --- | --- | --- |
| CHGCAR | `io/vasp/outputs/CHGCAR.nospin.gz` | `1d0f7cab991845fb6b5576839727948d189d339e908c5908ea8ffd935337a715` | Real Li VASP charge-density fixture, 32³; divide CHGCAR scalars by cell volume to obtain e/Å³ |
| CUBE | `command_line/bader/elec.cube.gz` | `4d3e32d374920e2a1210ebc718ad2f358751ea1861190281fce2ad4d2a0fb8df` | Upstream generated electron-density field, 23×23×24; source scalar units are **not independently guaranteed** |
| XSF | `io/xcrysden/datagrid_3d.xsf` | `c0a8ec512661c1ffa4c20fb922f52972ee825c01078976e2ee076729b60972c5` | Genuine upstream **format fixture** but a synthetic 2³ `0…7` field, **not** measured physical density |

The browser parser is loaded directly from `crystal-app.js` in a Node VM;
the mesher is loaded directly from `volume-iso-worker.js`, with the same
75,000-triangle safety cap. The bridge exports original Float32 scalars and the
**original Å affine grid**, not a reimplemented copy of the parser.

ASE independently opens the VASP charge file, Gaussian CUBE, and XSF
DATAGRID_3D. All x/y/z-indexed voxels, three central slices, origin, per-voxel
skew axes, atom count, and periodic/open semantics are checked. Scalar tolerance
is `atol=1e-6`, `rtol=2e-6`; coordinate tolerance is `atol=1e-5 Å`,
`rtol=2e-6`. Size mismatches, NaN, wrong scalar scale, order, or affine basis
fail CI. CHGCAR's periodic integrated electron count is recorded for both.
The pinned one-Li valence CHGCAR additionally **must integrate to 1 electron**
within `1e-5 e` in each implementation (measured 0.9999999935 e).

For each **same, gap-selected absolute isovalue**, the production Worker
marching tetrahedra and independent scikit-image 0.25.2 Lewiner marching cubes
have their Å² areas measured in the same physical basis. The periodic CHGCAR
adds *one* wrap plane along each axis for both; open CUBE/XSF do not. A relative
area disagreement over **20% is an alert**, never a false claim of VESTA
equivalence. Empty, nonfinite, or budget-truncated production surfaces fail.

## Initial local measurements

| Source | Grid voxels | Mismatched voxels | Maximum absolute scalar error | Triangle-area method difference |
| --- | ---: | ---: | ---: | ---: |
| CHGCAR | 32,768 | **0** | 1.86×10⁻⁹ | 0.21% |
| CUBE | 12,696 | **0** | 1.18×10⁻⁷ | 8.55% |
| XSF | 8 | **0** | 0 | ≈0% |

**Known structural gap:** The CUBE contains **nine atoms**, which ASE imports;
Kristal Yapı's `readCube` currently imports **only the scalar grid**. This is
`pass-with-known-gap` for volumetric data and a visible `atomImportGap` alert,
not a passed assertion of CUBE structure parity. The XSF 2³ surface is solely a
parser/mapping smoke reference and does not establish realistic isosurface
precision. The corpus is still too small for general format-conformance claims.

## How to do the VESTA **manual** side-by-side check

VESTA's [official format list](https://jp-minerals.org/vesta/en/) confirms
Gaussian CUBE, VASP, and XCrySDen XSF support. This test suite cannot assume a
licensed or GUI-capable VESTA executable is available in CI.

1. Download **exactly the three pinned source URLs above** (the JSON report
   includes full links), validate SHA-256 and decompress `.gz` files without
   changing numeric text. Record the VESTA version and operating system.
2. Open each original file in **VESTA**, then **Kristal Yapı**. Record whether
   the grid dimensions, atoms, Cartesian origin and lattice/cell agree. For
   the CUBE, note that the current browser does *not* load the atom list.
3. Verify displayed **scalar units before typing thresholds**. For CHGCAR,
   compare e/Å³ values after the `raw/V_cell` conversion; for CUBE/XSF compare
   raw source numbers until their physical definitions are known. Do **not**
   assume VESTA applies the same normalization without checking its display.
4. Use the **same numerical isolevel** printed in the archived JSON report:
   CHGCAR `0.05433526448905468` e/Å³, CUBE `0.1673400029540062` source
   units, XSF `3.5` source units for these source versions. Match the displayed
   unit-cell window, periodic repeats, camera, visibility and opacity.
5. Compare x/y/z midpoint slices, where available, at an explicitly recorded
   physical position. Capture screenshots and a signed contour check; record
   VESTA's rendered threshold, the result, and any unsupported control.
6. Keep **visual appearance differences** distinct from scalar/coordinate
   differences and algorithms' 3D surface-area differences. Do not label an
   unexecuted comparison as a pass. Store dated screenshots externally, not
   fabricated values in this JSON.

## Local / CI reproduction

```sh
python -m pip install ase==3.26.0 numpy==2.1.3 scipy==1.15.3 scikit-image==0.25.2
python -m unittest discover -s tests/validation -p 'test_volume_vesta_formats.py' -v
python tests/validation/volume_vesta_formats_reference.py
```

The latter fetches pinned original files, then writes
`validation-results/volume-vesta-formats-10-8-6.json`. The same report is
archived in `.github/workflows/pages.yml` alongside P10.8.1–10.8.5 scientific
diagnostics. This CI code has **no dependency in the deployed offline app**.

**Next:** P10.9 should address the observed CUBE atom-import gap, expand genuine
physical CUBE/XSF variants, obtain actual VESTA GUI captures, and gate the
performance/quality tradeoff before a high-resolution optional display mode.
