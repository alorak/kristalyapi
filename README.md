# Kristal Yapı — Crystal Structure Viewer & Editor

[**English**](README.md) · [Türkçe](README.tr.md)

A browser-based, **VESTA-inspired crystal structure viewer and editor** for scientific visualization and education. Open CIF and other structure files, work with multiple crystals in a single session, explore crystallographic and geometric analyses, and export your results.

**Launch:** [GitHub Pages](https://alorak.github.io/kristalyapi/) · **UI:** [index.html](index.html) · **Application:** [crystal-app.js](crystal-app.js) · **Roadmap:** [ROADMAP.md](ROADMAP.md)

> This project is not a complete replacement for VESTA or experimental/high-accuracy computational software. See [Scientific scope and limitations](#scientific-scope-and-limitations) before interpreting quantitative results.

## Quick start

1. [Open the application](https://alorak.github.io/kristalyapi/).
2. Use **Open** to select a bookmarked structure, built-in example, or local CIF/PDB/other supported file. These options are also available in the Library.
3. Edit unit-cell dimensions, supercells, and atomic sites in the left panel; change the representation using the bottom toolbar.
4. Open measurement, bond-valence (BVS), diffraction (XRD), Miller-plane, and other analyses using the right-side tool icons.

5. Use **Save** to export a project JSON, CIF, POSCAR, XYZ, PDB, **vector SVG/PDF/EPS**, **STL**, **VRML97 (.wrl)**, **glTF 2.0 (.glb)**, TIFF, or **1×–4× high-resolution PNG**.

**MoS₂ defect-series comparison (P2 extension):** `tools/qe_defect_compare.py` prepares a local-only comparison of pristine, V_S, V_2S, O_S and O₂@V_S *candidate* structures from independently completed QE PDOS jobs, checking the supercell, pseudopotentials, calculation protocol, and periodic distance-based atom groups. Raw QE energy zeros are **never overlaid** without explicitly supplied (unverified) vacuum-potential lineups. [Methods and limitations](docs/qe-defect-comparison.md).

**Atom/orbital PDOS (P2 extension):** The strict `projwfc.x` parser validates per-atom, per-orbital s/p/d/f curves against final SCF atom order, component columns, energy grids, and the projected DOS sum. The browser offers Mo-d, S-p, O-p and single-atom orbital views. Only collinear non-spin-polarized data are supported; projections alone do not establish localized optical emission.

**Electronic QE workflow (P2 starter):** [Local pipeline and plot usage](docs/qe-electronic.md). `tools/qe_pipeline.py` can run a shared-dataset `relax → scf → bands/bands.x → nscf → dos.x/projwfc.x` workflow using actual locally installed QE executables, with an explicit user-provided k-path. Import `electronic-results.json` in the DFT panel to inspect raw band and total DOS/PDOS curves. No Fermi/vacuum alignment, orbital-resolved defect attribution or experimentally verified single-photon predictions are claimed.

**D2.2 real MoS₂ SCF acceptance:** [Protocol and recorded results](docs/qe-mos2-validation.md) for ideal pristine 1H-MoS₂ via Docker/API. Seven real SCF jobs converged with reviewed Mo/S UPFs and raw hash/API evidence. **Overall acceptance failed:** the 80→100 Ry cutoff difference is 2.374556 meV/atom against a 1 meV/atom limit; k-mesh and slab-vacuum gates passed. The threshold and original failed result remain unchanged; see the D2.2b follow-up below.

**D2.2b high-cutoff follow-up passed:** [Three real MoS₂ SCF jobs and raw evidence](docs/qe-mos2-cutoff-validation.md) at 100/120/140 Ry, fixed k=8×8×1 and c=24 Å. The preregistered 120→140 Ry difference is **0.268123 meV/atom ≤1**; 100 Ry exactly reproduced D2.2. The successful retry used a 6 GiB acceptance worker after preserving the initial timeout. The higher-cutoff k-mesh/vacuum follow-up is recorded in D2.2c below; forces and physical-reference accuracy remain separate.

**D2.2c coupled SCF reference passed:** [Six real jobs and three gates](docs/qe-mos2-kvac-validation.md) validate 120/960 Ry, 16×16×1, c=24 Å: cutoff 0.267715 ≤1, k-mesh 0.000907 ≤1, vacuum 0 at printed precision ≤2 meV/atom. This closes the finite SCF energy gates before D3; relaxation/forces and independent physical accuracy remain separate.

**D3 real MoS₂ relaxation passed:** [Raw Docker/API evidence and 3D comparison](validation-results/qe-mos2-d3-20261029-amd64/INCELEME.md), eight gates passed. Independent final SCF max force component 1.29e-5 Ry/Bohr (limit 1e-4), relaxed 120→140 Ry difference 0.267443 meV/atom. The final fixed-cell geometry is ready for the separate D4 electronic pipeline acceptance.

**D4 real MoS₂ electronic pipeline passed:** [Raw bands/DOS/orbital-PDOS evidence](validation-results/qe-mos2-d4-20261029-amd64/INCELEME.md), six QE stages, 26×61 bands, 3677 DOS points and three atom projections. This accepts the finite execution/data protocol; broader electronic convergence, SOC and optical accuracy remain separate.

**D4.1 electronic convergence prepared:** [Preregistered band/NSCF-mesh protocol and DOS-width sensitivity](docs/qe-electronic-convergence.md). Six independent manual Docker/API cases and raw-evidence comparison are ready; new MoS₂ convergence results are pending.

**D2 authenticated SCF jobs (first stage):** [Worker, UPF and HTTPS setup](docs/qe-jobs.md). A strictly validated PBE/non-spin SCF request is queued in persistent SQLite, executed by a separate QE worker with operator-pinned UPF hashes, and exposed as status, log, cancellation and energy/provenance. Job APIs are **disabled by default**, require an explicit strong token, and reject LAN HTTP transport for authenticated requests. [D2.1 real Si SCF acceptance](docs/qe-scf-validation.md) records seven Docker/API jobs, raw convergence evidence and finite cutoff/k-mesh energy checks. MoS₂ and independent physical reference validation remain separate acceptance steps.

**Docker QE discovery (D0–D1):** [Setup, local IP/port and security guide](docs/qe-docker-api.md). `compose.qe.yml` packages a pinned Debian QE 6.7 baseline and read-only FastAPI `/api/health` and `/api/capabilities`; the DFT panel tests connection only when clicked. Docker publishes on loopback by default, with explicit opt-in LAN address/host CORS settings. **This does not submit or run DFT calculations over HTTP.**

**Local QE execution (P1 starter):** [Run Quantum ESPRESSO locally or on a Linux VM](docs/qe-runner.md) using the exported `.in` file and actual UPF files. The Python standard-library runner stages and optionally executes the real `pw.x`, captures outputs and provenance, and marks incomplete/unconverged runs as non-success. It is not a hosted DFT service, a replacement for convergence studies, or evidence of MoS₂ single-photon emission.

The **Crystal Defects** tool (right toolbar) materializes display-only repetitions as explicit P1 atoms, then creates one **vacancy**, **substitution**, or **interstitial** at a time. It supports Undo and CIF/POSCAR export. The model is geometric only: no charge states, atomic relaxation, or defect formation energies are calculated. Loaded volumetric maps/comparison phases are protected from being silently discarded.

**MoS₂ paper preflight (P0):** The Crystal Defects panel now includes a geometry-only study check for the [2022 ACS Nano UV/SPE paper](https://doi.org/10.1021/acsnano.2c09209). With explicit P1 atoms it reports Mo/S/O composition, candidate V_S/V_2S/O_S/O₂-related stoichiometry, approximate Mo-plane count and c-direction empty periodic gap. It exports a stand-alone study JSON manifest recording the atoms and explicitly stating that **no DFT, UV irradiation, photoluminescence or photon-correlation measurement** was performed. This does not verify chemical adsorption, vacancy adjacency, real quantum emission or convergence; see [todo.md](todo.md#mp0--tek-katman-ve-kusur-modeli-ön-denetimi-ilk-geliştirme).

The **DFT / Quantum ESPRESSO** right-side panel generates self-contained `pw.x` input files for fixed-cell `relax` or single-point `scf`. Explicit P1 atoms are expanded from symmetries/display repetitions, with an optional fixed bottom layer (`0 0 0` motion flags). Supply actual pseudopotential `*.UPF` files under `./pseudo` and validate plane-wave cutoffs, k-points, occupation and spin. Run `pw.x -in structure_relax.in > structure_relax.out` on your own computer, then preview a completed `.out` file in the app. Energy and total-force summaries are displayed and matching final atomic coordinates can be applied with Undo. The browser never runs DFT or uploads the output.

The **Miller** panel also provides independent **bottom/top vacuum padding** (0–80 Å each). Unlike cutting a surface slab, it preserves the displayed crystal atoms, materializes them as a P1 supercell, extends the lattice vector normal to the `ab` plane, and shifts the atoms by the specified bottom padding. Use Undo or export CIF/POSCAR after the change; no relaxation or surface-energy calculation is performed.

### New teaching laboratory MVPs

- **Powder Diffraction** (`#toz-kirinimi`): a standalone page sharing the
  active structure's tested IT92 powder pattern/profile engine. Change the
  wavelength, 2θ range, empirical FWHM and Lorentz–polarization correction;
  click a peak in the plot or reflection list to highlight its indexed `(hkl)`
  plane slices and normal in a rotatable **3D unit cell**, alongside its
  d-spacing and Bragg angle. Symmetry-equivalent reflections sharing a powder
  peak are not all highlighted yet. A separate Bragg-wave teaching panel links
  a glancing-angle slider with schematic incident/diffracted 3D ray arrows,
  path difference `2d sinθ` and ideal two-wave phase interference. That
  interference trace is not the calculated powder intensity. This is neither
  calibrated instrumental profile fitting nor Rietveld refinement. A new
  **structure-factor phasor lab** accepts any nonzero `(hkl)` (even reflections
  missing from the powder peaks), draws the complex IT92 atomic contributions
  head to tail and shows `F(hkl)` and `|F|²`. Numerical cancellations are
  demonstrated without equating them automatically to symmetry absences.
- **Semiconductor Physics** (`#yariiletken-fizigi`): a standalone interactive
  **1D two-plane-wave nearly-free-electron** band demonstration and a separate
  **ideal Fermi–Dirac** occupation model. The current structure's cell parameter
  can be used only as the educational model period. These are **not** real
  electronic bands of silicon or GaAs and are not first-principles calculations.
  A linked **From Atoms to a Band** experiment shows the exactly N discrete
  tight-binding energies of an open N-atom chain (N = 1–64) alongside the
  related infinite periodic chain's one Bloch band. Its hopping strength
  is independent of the period; a one-orbital band does not generate a
  real semiconductor valence–conduction gap. A follow-on **two-orbital A/B
  unit-cell lab** shows separate valence and conduction branches. Uniform
  hoppings with equal on-site energies touch at the Brillouin-zone edge;
  unequal intra-/inter-cell hoppings or an A/B on-site detuning open the
  analytically checked gap `Eg = sqrt(delta² + 4(t1 − t2)²)`. Three presets,
  interactive sliders and a highlighted forbidden region make this visible.
  A new **k selector** on the two-orbital chart highlights both band states
  and their normalized **A/B orbital character** percentages. At an exact band
  touching those weights are left undefined; orbital weights do not represent
  carrier occupations.
  This minimal 1D model is not a computed Si/GaAs gap; the Fermi example's
  independent `Eg` parameter is intentionally unchanged.
- Both pages are included in the offline shell. See [todo.md](todo.md) for
  scientific validation, advanced lessons and follow-up tasks.

**Languages:** The application starts in **English (EN)** by default. Switch to Turkish with the **EN / TR** controls in the upper-right corner. The preference is stored in your browser. Translations are bundled locally in [translations.js](translations.js); no remote translation service is used.

The application is no longer contained in a single HTML file. [index.html](index.html) defines the UI shell, [styles.css](styles.css) the appearance, [crystal-app.js](crystal-app.js) the application/computation entry point, [translations.js](translations.js) the language strings, and [favicon.svg](favicon.svg) the icon. This is the **first modularization step**; splitting the large application module into crystal-data, rendering, analysis, and UI modules is planned. GitHub Pages serves the entire application. Basic use requires no dedicated application server, account, database, or API key. **Three.js 0.186.1**, OrbitControls, and ConvexGeometry are bundled in [`vendor/three`](vendor/three/README.md), while the Moyo WASM files used for automatic symmetry analysis are loaded from the bundled `vendor/` directory. The 3D engine no longer requires a third-party CDN. A **service worker** caches the application shell and 3D/WASM assets after a successful online installation. Local structure files are not uploaded to a remote application server; COD queries are explicitly initiated by the user.

## VESTA 3 manual-equation comparison and honest GUI evidence (Package 14)

The BVS panel now shows an explicitly **non-GUI, manual-equation projection**:
VESTA 3 documents a fixed `B = 0.37 Å`, while our source-pinned IUCr 2020
`Cu(II)–O` pair deliberately uses `B = 0.36 Å`. At the same selected `R₀`
and exact neighbor images, the panel separates the **B-parameter effect**
from **ligand occupancy weighting**. These numbers are mathematical
comparisons with the [official VESTA 3 manual](https://jp-minerals.org/vesta/en/doc/VESTAch11.html),
**not values measured from VESTA's desktop interface**.

An independent Gemmi/ASE CI gate now checks **Baur distortion D, Hoppe ECoN,
bond lengths and fixed-B BVS** in eight real experimental CIF environments,
and produces a CSV difference matrix with actual VESTA GUI columns **blank**.
We also inspected the actual VESTA 3.5.8 distribution's 2016 parameter table
locally: all 19 supported `R₀` pairs have a compatible `B = 0.37 Å` entry,
including Cu–O with a *different reference* than the application's .36 Å
entry. VESTA binaries and its copyrighted parameter file are not distributed
with this project. A VESTA GUI execution could not be completed in this
headless environment; an optional capture auditor is ready for real
screenshots and text-area measurements.
[P14 comparison protocol, precise limits and measurements](tests/validation/PACKAGE_14_STATUS.md).

## Experimental CIF and local disorder uncertainty (Package 13)

The importer now accepts a metadata-only **`data_global` CIF block** followed
by exactly one structural block, without accidentally mixing unrelated blocks;
ambiguous multiple structures remain rejected. It also prioritizes the real
`.cif` format over any **embedded SHELX refinement listing** in its appendix.
This enables the original
experimental 2022 IUCr **K/Na-disordered silicate**, including 40 symmetry-
expanded atoms and 72.2% K / 27.8% Na sharing one crystallographic site.

The BVS panel distinguishes individual center-species scenarios, reports a
**species-conditional mean and standard deviation**, and—for partially occupied
ligands—an **independent-site occupancy distribution** with physical bounds
and exact 5th/95th percentiles when its state space stays within 4096 states.
Alternatives at the same site are mutually exclusive. These are model results,
not measured uncertainties, local-disorder correlations, oxidation assignments
or proofs of chemical bonding.

The mandatory CI gate pins three raw experimental CIFs and their SHA-256:
**COD NaCl (1965), COD rutile TiO₂ (1963) and IUCr K/Na silicate (2022)**.
Eight real-structure BVS scenarios verify **every expanded atom, periodic
ligand image, distance and individual bond-valence contribution** with the
independent **Gemmi 0.7.5 + ASE 3.26.0** libraries; published IUCr K1–O
bond distances provide an additional experimental check. A true VESTA GUI
side-by-side comparison has **not** been run.
[P13 sources, evidence and explicit VESTA comparison protocol](tests/validation/PACKAGE_13_STATUS.md).

## Crystallographic coordination and bond valence (Package 12)

The BVS tool now offers **19 explicitly charged cation–anion parameter sets**
transcribed from the [IUCr 2020 bond-valence parameter compilation](https://www.iucr.org/what-we-do/digital-standards/data/datasets/bond-valence-parameters).
Both `R₀` and the **pair-specific `B`** (including Cu(II)–O with `B = 0.36 Å`)
are retained with the source reference code. Select a central atom to see only
compatible ion-pair choices. The result distinguishes **geometric coordination
number**, **occupancy-weighted coordination number**, calculated **BVS**, and
the signed mismatch with the *user-selected* formal valence. It reports
partial/mixed-site and cutoff warnings, including unusually large mismatches.
Nonperiodic CUBE/XSF molecules are not linked through their display-box walls.

A **required independent ASE 3.26.0 scientific CI gate** compares every
periodic image, shift, bond distance and weighted contribution in nine
analytical NaCl/MgO/perovskite, skew-cell, mixed-occupancy, molecular and
cutoff examples. These test geometries are **not experimental structure
determinations**. Alternative sites are treated as an **occupancy-weighted
conditional average**, not a physical claim that mutually exclusive atoms
coexist. BVS cannot establish oxidation state, bond order, or VESTA numerical
parity. [P12 validation and scope](tests/validation/PACKAGE_12_STATUS.md).

## Multi-field CUBE/XSF and safer VESTA settings (Package 11)

CUBE files can now load **up to five interleaved fields per voxel** through
`NVAL`, or orbital-labelled channels through the negative-`NATOMS` / `DSET_IDS`
form. Multiple compatible `BEGIN_DATAGRID_3D` sections in XSF become separately
selectable, named volume layers. XSF molecular `ATOMS` records retain their
original Cartesian Å positions in a hidden nonperiodic display box; they are
not incorrectly interpreted as fractional crystal coordinates. Every volume
layer still uses the shared five-layer limit, and ambiguous multi-field
potential/companion files are explicitly refused.

When importing a `.vesta` project, unknown `GROUP` settings or custom
`SYMOP`/`TRANM` transforms no longer trigger unverified standard-setting
symmetry expansion. Listed atomic sites remain as P1 with a warning; VESTA
setting equivalence is **not claimed**. An independent ASE 3.26.0 gate checks
all **12,696 voxels in each field**, the physical frame and all nine atoms,
using a SHA-pinned real CUBE and clearly labelled *derived* extra fields.
Actual VESTA GUI screenshots have still not been compared.
[P11 protocol and open limits](tests/validation/PACKAGE_11_STATUS.md).

## CUBE atom frame and real-field XSF validation (Package 10.9)

When **Use file atoms** is checked, CUBE atom positions now load in the
original density grid's **Cartesian Å frame**. Because CUBE does not require
a crystallographic lattice, the atoms use a **nonperiodic, hidden display
box**, not a physical unit cell or volume. The nine atoms in the upstream
computed CUBE are position-matched to independent ASE 3.26.0.

An independent ASE writer derives a larger **23×23×24 XSF** from the
original computed CUBE, preserving all **12,696 scalar samples** and its Å
origin/basis within strict numeric tolerances. This XSF **re-encodes the same
computed data**; it is not a second independent physical simulation.
Diagnostic full-grid 48³→64³ surface-area changes were **7.27% for Li
CHGCAR** and **1.09% for CUBE/derived XSF**. On one local CPU runner,
the research-only 64-interval path took roughly **7–9×** as long as
today's 40-interval path for 64³ input. **No optional high-resolution UI
mode is enabled** and VESTA GUI screenshots have not been captured.
[P10.9 methods, measurements and limits](tests/validation/PACKAGE_10_9_STATUS.md).

## Independent real-format cross-check (Package 10.8.6)

CI now downloads SHA-256-verified, immutable upstream **CHGCAR, CUBE and XSF**
fixtures from `pymatgen-core`, runs the actual browser volumetric readers, and
checks **every voxel, origin, skew Cartesian Å basis and three orthogonal slices**
against independent **ASE 3.26.0** decoders. The real Li CHGCAR (32³) and
electron-density CUBE (23×23×24) show **zero misread voxels** under strict
Float32 tolerances; a small upstream synthetic 2³ XSF tests x-fastest ordering.
On matching source isolevels, separate tetrahedra/cubes surface areas differ by
**0.21% CHGCAR**, **8.55% CUBE**, and approximately **0% XSF**. These are
algorithm comparisons, **not actual VESTA GUI measurements**. The CUBE's nine
atom records **were not imported as crystal atoms in Package 10.8.6**; this
gap is addressed by Package 10.9. See the
[P10.8.6 reproducible format and manual VESTA protocol](tests/validation/PACKAGE_10_8_6_STATUS.md).

## Source sampling and isolevel sensitivity (Package 10.8.5)

A new **CI-only** study examines why sparse real 5wkd Fourier-density
isosurfaces changed greatly between 48³ and 64³ even with two independent
meshing algorithms. It uses actual source voxels plus the production trilinear
resampler at 32³/48³/64³, with **fixed original-source** upper-tail scalar
thresholds, explicit negative DELFWT peaks, physical Å grid coordinates,
peak-retention and fragment diagnostics. The study measures changes in
isosurface area after **±2% of original peak-minus-median scalar contrast**
threshold shifts; it also records a near-Nyquist *index-spectrum proxy* with
open-boundary tapering. Occupied-node fractions are not physical electron
integrals and FFT-edge energy does not prove aliasing. Scientific sensitivity
is flagged, **not treated as a passing physical convergence test**. No browser
algorithm, cap, or high-accuracy mode changes. The JSON is archived by CI;
see the [P10.8.5 methodology and limitations](tests/validation/PACKAGE_10_8_5_STATUS.md).

## Independent mesher and fragmentation study (Package 10.8.4)

The scientific PR quality gate now compares the application's **actual full-grid marching-tetrahedra Worker** with the independent **scikit-image 0.25.2 Lewiner marching-cubes** extractor. Both algorithms consume the **same matched, source-derived Float32 voxels**, iso-threshold, and Cartesian Å voxel basis, so differences on one grid isolate extraction-method sensitivity rather than changes in the experimental data. The corpus is the real 5i55 partial CCP4 map and two 5wkd weighted/difference density maps recomputed independently by Gemmi 0.7.5. Per source, two sparse signed thresholds are compared at **32³, 48³, 64³** (18 independent comparisons).

Reported metrics: Å² area differences *between methods at the same grid*, each method's **48³→64³ resolution sensitivity**, snapped-mesh connected-component counts, source-threshold voxel component counts, and sampled symmetric nearest-vertex distances in Å. These geometric distance statistics are **not exact point-to-triangle Hausdorff bounds**; neither triangulator is presumed a scientific ground truth. Real maps need not exhibit monotonically converging areas or identical topology across algorithms. Budget overruns, missing reference surfaces, invalid physical coordinates, empty/degenerate triangles, and severe spatial misregistration fail CI; statistically large but finite algorithm/resolution disagreements are **flagged and published rather than silently passing as scientific convergence**. The JSON is archived in Actions; no high-accuracy UI setting is enabled pending independent evidence. **Measured finding:** for real 5wkd FWT at q=.990, 48³→64³ surface area changes are **62.33% in the production triangulator and 62.42% in independent marching cubes**; at q=.995 they are **87.72% and 88.01%**. This points toward sampled-field/resolution sensitivity rather than an error unique to one mesher; the surfaces are **not converged**. See [P10.8.4 methodology](tests/validation/PACKAGE_10_8_4_STATUS.md).

## High-resolution convergence & topology audit (Package 10.8.3)

A second required CI gate now measures **32³/48³/64³** representations of real 5i55 CCP4 and independently Gemmi-generated 5wkd FWT/DELFWT maps. The deployed renderer intentionally limits full final triangulation to about **40 intervals per axis**, so a 48³ or 64³ input **does not imply** a corresponding full-resolution rendered mesh. The CI reports both the **current default** and a **validation-only full-grid** extraction with an explicit override, retaining the same **75,000-triangle upper bound** and rejecting truncation.

Per-grid physical Å² surface area, thresholded voxel-quadrature Å³ occupancy, actual stride and triangle counts are recorded. Coarse→fine area/volume changes are *observations*, not proofs of convergence; a sensitivity alert highlights large changes without turning them into a spurious pass/fail physical threshold. Real-map topology checks distinguish permitted open edges on genuinely partial map boundaries from **unmatched interior edges/non-manifold edges**, which fail CI. A synthetic signed sphere intersecting a **skew periodic cell boundary** must close after wrapping its equivalent seam edges. Winding inconsistencies are reported separately rather than silently corrected.

The comparison uses the production Worker triangulator, with **only a test-specific grid-interval override**; the runtime default and scientific analysis remain unchanged. The 5i55 and 5wkd maps are the same traceable independent sources as in 10.8.1; independent experimental CHGCAR/CUBE/XSF datasets are still open. See [validation status](tests/validation/PACKAGE_10_8_3_STATUS.md).

## Independent volumetric convergence gate (Package 10.8.1–10.8.2)

CI now runs a **required scientific isosurface gate** against a signed-distance sphere and real Gemmi-sourced maps. The analytic sphere (16³/24³/32³ grids) has known physical area, enclosed volume, and radius, so it checks measured **surface position**, **area**, and **volume** convergence with explicit error thresholds. The production final marching-tetrahedra algorithm is invoked from the actual Worker source, rather than testing an independent implementation.

The real-map corpus includes a pinned **5i55 partial monoclinic CCP4** map and the **5wkd C2 experimental refinement** MTZ transformed by Gemmi 0.7.5 into independent **FWT/PHWT** and **DELFWT/PHDELWT** 64³ maps. Each source is resampled onto matched physical 16³/24³/32³ grids; the CI records surface area, triangle counts, 95th-percentile source-field residual, and thresholded-grid physical volume. This last quantity is **voxel-quadrature volume**, not a mesh-enclosed volume unless a closed consistently oriented mesh is proved. Real maps do not have a known exact geometric isosurface; the reported between-resolution changes are measurements, **not certified Hausdorff error bounds or arbitrary monotonicity guarantees**. Invalid/degenerate/truncated mesh results fail CI.

The same genuine CCP4 scalar arrays are round-tripped through CUBE and XSF to test interchange geometry and values; these re-encodings are **not independent experimental CUBE/XSF samples**. A broader physically independent CUBE/XSF/CHGCAR and MRC vendor corpus remains an explicit next task. The P10.7 octree path is still preview-only; **final scientific surfaces and export semantics are unchanged**. Run `python tests/validation/volume_surface_reference.py` with pinned Gemmi 0.7.5 + NumPy and Node.js 22. See [scientific status](tests/validation/PACKAGE_10_8_STATUS.md).

## Local 2:1 octree transitions and measured iso-position accuracy (Package 10.7)

For **large maps (≥200,000 voxels)**, the offline Worker now first attempts a *regional* 3D octree preview. It refines cells near sampled isosurface crossings, balances adjacent leaf depths to **2:1**, and triangulates matching fine/coarse face rectangles with a shared face-center fan. Edge breakpoints are propagated across orthogonal cell faces so an interior transition does not leave T-junctions. The preview is limited to **4,500 leaves, 75,000 triangles per requested surface**, and a sampled trilinear scalar probe tolerance of **0.5% of map range**. An over-budget or insufficiently sampled field falls back to the earlier conforming axis-grid or uniform preview. None of these fast previews change the final, validated fixed marching-tetrahedra surface or exported scientific data.

For an analytic **64³ signed-distance sphere**, native tests assert that every edge of the closed octree preview has precisely two *oppositely oriented* triangles, all faces are non-degenerate, and adjacent leaf depths differ by at most one. The largest **measured vertex radial error** is about **0.021 Å**, versus **0.123 Å** for the previous coarse regular preview on this specific test. The Performance panel and JSON report include the maximum **sampled scalar mismatch** at preview vertices and a **first-order, local normal-displacement proxy (Å)**. Those field-dependent proxies are **not a certified global Hausdorff bound**, do not guarantee features missed between probes, and do not make an open/budget-limited surface watertight.

For cross-device GPU/CPU comparisons, choose the same crystal, supercell, volume and polyhedron mode, reset the frame sample, wait for rendering to settle and use **Download JSON performance report** on each computer. Exports now include browser/OS string, reported GPU renderer/vendor, WebGL version, hardware concurrency, pixel ratio, maximum texture size, scene buffer estimates, draw groups and frame metrics. Compare **merged vs instanced** on each machine separately; do not treat CPU attribute byte totals as measured driver VRAM, frame intervals as GPU time, or informational timings as pass/fail thresholds. Only one real Chromium/WebGL environment is exercised by CI, so a multi-vendor/OS benchmark corpus still requires independently supplied captures.

## Conforming adaptive preview and polyhedron GPU A/B (Package 10.6)

The offline 3D volume Worker can now build a **conforming, nonuniform axis-grid preview** for large maps (≥200,000 voxels). It refines selected shared coordinate planes near the candidate isosurface using residuals between trilinear field samples and coarse-cell center interpolation. Each coordinate plane spans the grid, so neighboring cells share matching faces without T-junctions. Refinement is capped at **32 axis nodes per direction** and three passes. The Performance panel reports the final **sampled cell-center scalar residual**, along with whether its chosen threshold was met; an unmet threshold selects the former safe uniform preview. The sampled residual is **not** a mathematically proven global scalar error bound, a guaranteed isosurface-position error, or a full local octree with 2:1 transition templates. Open, domain-touching or triangle-limited surfaces are not claimed to be watertight.

**Crucially, the final scientific marching-tetrahedra mesh is unchanged**, including signed-value interpretation, periodic/skew coordinates, potential color, per-surface triangle budgets and export semantics. Native tests compare fixed-grid position/color buffers exactly and audit every edge of a closed signed-sphere preview for two incident triangles.

The Performance panel also includes an experimental **Polyhedron face renderer** selector: **Merged mesh (default)** or **GPU instancing**. The latter reuses each inequivalent center's local hull, translates it by instance matrices, preserves per-instance RGB and per-site opacity, and keeps outline edges merged. A real Chromium/WebGL A/B test renders 125 BaTiO₃ TiO₆ octahedra with both strategies, checking counts, coordination area/volume, CPU-side geometry-array bytes and draw groups. CPU build time and hardware GPU queries remain informational, not fixed pass/fail speed thresholds. Because the merged renderer already uses one face draw call, instancing is **opt-in** until device-specific gains and visual equivalence are better established.

Next: truly local crack-free octree transitions with rigorous geometry/error verification, and a broader GPU/device matrix (Package 10.7).

## Interactive slice Worker and scene memory accounting (Package 10.5)

For maps with **at least 75,000 voxels**, the on-screen **192×192 2D slice and signed contours**, **128×128 samples for drawn-line profiles**, and **independent 32×32 slice statistics** now run together in one local offline Worker request. Obsolete requests are terminated and rejected by a monotonically increasing version; a 12-second timeout or Worker failure safely falls back to the original synchronous algorithms. Smaller maps still update directly without Worker startup overhead. Trilinear voxel interpolation, signed levels, skew cell and Miller frames, Cartesian Å distances and scientific CSV semantics remain unchanged. The separate 3D slice texture is still created on the main thread.

The Performance panel/JSON now separates **CPU-side vertex/index/instance array storage** (deduplicating shared backing buffers), a **base-level RGBA8 texture-size estimate**, **source voxel storage**, and the existing **32 MiB surface cache**; interactive Worker time and canceled jobs are also reported. These are **not measured GPU VRAM**: driver allocations, internal formats, mipmaps and hidden copies are not observable through standard WebGL. The existing hardware GPU timer remains independent.

We deliberately **do not** switch the validated final isosurface to a spatially adaptive mesh or replace the currently merged one-draw-call polyhedron faces with naive GPU instancing. Crack-free topology transitions, error-bound validation and device A/B measurements remain open tasks in Package 10.6. Safety caps and numerical results are preserved.

## Reused polyhedron hulls and complete 2D export offload (Package 10.4)

Repeated supercell images of an inequivalent polyhedron center now **reuse one local ConvexGeometry hull and edge template**. Each instance gets translated coordinates and its own color/opacity, while coordination geometry, area, volume and merged output remain unchanged. The Performance panel reports unique templates, reuse count and their transient memory; actual face/edge output is still limited to 2,400 polyhedra.

The offline volume Worker now handles **2D PNG marching-squares contour tracing** (including signed levels, ambiguous saddles and missing-value holes) as well as raster sampling. **64×64 scientific slice CSV** also samples the full Cartesian coordinates and voxel values on the Worker, with cancellation, transfer buffers and synchronous fallback. On-screen interactive 192px previews, small statistical slices and line profiles remain on the main thread for immediate feedback. Export pixels, signs, values and units are not reinterpreted.

For large maps the initial *preview-only* stride now responds to a bounded 6³ sample of isovalue-crossing complexity; complex maps receive a finer global preview than sparse ones. This is a **uniform global heuristic**, not spatially adaptive/error-controlled meshing. The final isosurface always uses the existing verified algorithm and bounds. True local adaptive meshing (with watertight transitions), GPU memory profiling and broader device matrices remain future work.

## Progressive surfaces, polyhedron LOD and GPU timing (Package 10.3)

Large (≥200,000-voxel) uncached isosurfaces now appear first as a **coarse Worker preview**, then are replaced by the numerically unchanged final marching-tetrahedra mesh. Cancellation prevents obsolete previews or results from becoming visible; only completed final meshes enter the existing 32 MiB cache. This is a two-stage preview/refine strategy, **not** adaptive local error-controlled meshing.

Polyhedron **edge outlines** use display-only distance/count/quality LOD for dense scenes; the merged filled faces, centers, coordination neighbors, areas, volumes and exported scientific geometry remain unchanged. **High quality** preserves outlines. The 768×768 2D slice PNG samples its skew Cartesian/Miller plane values and colors in the same offline Worker; 192px interactive previews, contour tracing and scientific slice CSV remain on the main thread. If Worker processing is unavailable, PNG export falls back to the existing synchronous sampler.

Where WebGL2 provides `EXT_disjoint_timer_query_webgl2`, the Performance panel and JSON snapshot report asynchronous hardware **GPU render query time**, sample count and disjoint events, separately from CPU scene generation and frame intervals. Unsupported/disjoint devices explicitly report no valid GPU time. Absolute FPS or GPU millisecond gates are intentionally avoided; these readings depend on drivers, workload, query availability and browser. Existing voxel/surface/atom/polyhedron safety caps remain in place.

## Volume Worker and CPU profiling (Package 10.2)

For volumetric maps of at least **75,000 voxels**, uncached 3D isosurfaces are triangulated by an **offline, same-origin Web Worker**. The browser keeps the viewer responsive while the numeric marching-tetrahedra work runs in the background. Changing a surface level, dataset or visibility cancels the superseded job; returning to a previously computed surface can reuse a bounded **32 MiB in-memory geometry cache**. Original voxel arrays remain in the editor; only copied buffers are transferred to the Worker. Worker failures safely fall back to synchronous rendering rather than hiding the data.

The Performance panel now separates atom-build, bond-search and polyhedron CPU durations, the main-thread volume preparation time, Worker triangulation duration, cache hits and canceled jobs. The timings depend on hardware/browser conditions and **are not GPU timing queries**. Numerical parity is verified against the existing main-thread isosurface routine, including signed levels, skew grids, periodic boundaries and potential-color interpolation. Real browser tests check cancellation, cache reuse, Gemmi CCP4 parity and Worker operation while offline.

Package 10.2 preserved scientific voxel values and units and the 8-surface/triangle budgets; 2D raster export and supported GPU queries arrive in Package 10.3 above.

## Performance and LOD (Package 10.1)

Use the **bar-chart icon** in the viewport's upper toolbar to open the Performance panel. **Automatic LOD** chooses one of three sphere tessellation levels based on projected on-screen atom size and total atom count. **High quality** keeps detailed spheres even for large models; **Prioritize speed** uses lightweight spheres. Only the interactive sphere mesh changes: all atomic coordinates, element colors, bond topology, polyhedron geometry, selections, and scientific calculations remain intact. **PNG exports always render at full sphere detail** and then restore the interactive LOD.

The panel reports visible atom/bond instances, polyhedron count, estimated CPU scene-build and volume triangulation times, WebGL draw calls, rendered triangles, and geometry allocations. Frame intervals include browser scheduling and refresh synchronization, so **median/p95 frame intervals are not GPU execution times or hardware-independent FPS**. **Download JSON performance report** saves an on-device snapshot. The browser CI records 60 / 1,620 / 12,960-atom stress scenes and real Gemmi CCP4 surface metrics; it verifies counts and LOD transitions without flaky absolute timing limits.

Existing safety caps still apply (**20,000 atoms; 65,000 bonds; 2,400 polyhedra; 2.5 million volume voxels**). Package 10.1 does not yet add worker-based geometry generation, GPU timer queries, or unrestricted large-volume rendering.

## Interface

| Area | Main functions |
| --- | --- |
| Top bar | Hamburger menu and active workspace name/count next to the **Kristal Yapı** title, also accessible in the **Library** and **Reciprocal Space** pages. Compact **Open / Save**, undo/redo, and **EN / TR** controls. |
| Left panel / **General** | Unit-cell parameters (`a, b, c, α, β, γ`), supercell, **− / +** controls for `a/b/c`, repeat counts 1–6, and per-axis visible fractional bounds between **−1 and 2** (e.g., −0.1…1.1). |
| Left panel / **Atoms** | Asymmetric sites, Wyckoff positions, adding/removing sites, per-site **atom color/scale** and **polyhedron color/opacity**; settings persist in project files and undo/redo. |
| 3D viewport | Mouse rotation, pan, zoom, standard views, fit-to-view, perspective/orthographic projections, XYZ orientation indicator. |
| Right-side icon rail | Independent collapsible drawers for analysis and settings, expanding toward the viewport. |
| Compact bottom bar | Representation modes (**including polyhedra**), visibility controls, atom size/bond length, **single or multiple polyhedron center elements (+ button)**, polyhedron default color/opacity, neighbors, ADPs, and **Miller h/k/l**, slice thickness, and plane controls. On narrow screens the groups scroll horizontally. |

### Multiple crystal workspaces

- Use the upper-left **hamburger menu** to switch structures or choose **+ Add new structure** for up to **10 workspaces**. The badge shows the number of open structures.
- The active workspace remains visible in the Library header. Importing a crystal from the Library or Open dialog replaces **only the currently active workspace**.
- Each workspace maintains its own crystal state, camera, undo/redo history, and measurements.
- Workspaces and the active selection are restored from `localStorage`, subject to browser permissions and storage capacity. Large volumetric arrays are not persisted and must be reloaded after refreshing.
- **Undo / Redo:** top-bar buttons or `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`. Normal text-input undo is preserved when an input has focus.

### Display and Miller controls

- **Four representations:** ball-and-stick, space-filling, stick, and wireframe.
- **Eight toggles:** bonds, element-based automatic bond cutoff, unit-cell edges, boundary atoms, atom labels, in-scene crystallographic axes, auto-rotation, and thermal ellipsoids (ADPs). Button state indicates whether each is enabled.
- **Two sliders:** atom size and bond-distance cutoff. Additional settings include the ADP probability level, center species, neighbor radius, and maximum neighbor count. Neighbor settings may not change the scene immediately unless neighbor/coordination display is enabled.
- **Dedicated Miller controls:** compact `h`, `k`, `l` inputs, slice thickness, **Show Miller planes**, and **Show all parallel planes in the supercell**. No basis transformation is needed to display a plane.
- Switching between perspective and orthographic projection attempts to preserve the current target and approximate framing, although the projections are mathematically different.

### Analysis tools

Use the vertical icon rail on the right to open these tools without nested secondary tabs:

| Tool | Main capabilities |
| --- | --- |
| **Structure information** | Overview of cell, symmetry, structure, and selected source. |
| **Multi-structure / phase comparison** | Up to three additional CIF/mCIF phases alongside the main crystal; placement, visibility, transparency, and cell edges. |
| **Atom selection and measurements** | Atom picking; direct/periodic distances, angles, four-atom dihedrals; color-coded result cards. |
| **Measurement history** | Separate nearby icon, count, saved results, and CSV export. |
| **Advanced coordination / BVS** | Metric-complete periodic neighbors, coordination, partial occupancy, Baur distortion, Hoppe ECoN, quadratic elongation and angle variance for validated tetrahedral/octahedral topology, reference-pair BVS and equal-bond expected lengths. |
| **Best-fit plane / planarity** | Plane normal, RMS/maximum deviation, and angles between fitted planes. |
| **Structure factors / powder XRD / neutrons** | IT92 X-ray `f₀(s)` or coherent neutron `b`, Bragg-derived reciprocal-space coverage, `F(hkl)`, Bragg angles, optional LP/Lorentz, absorption warnings, empirical pseudo-Voigt/Caglioti profiles, Kα1/Kα2 doublet, measured-CSV comparison, model Fourier/Patterson via `d_min` + FFT, and phased SHELX `.fcf` Fo/Fo−Fc maps with cell/phase/Friedel validation and optional least-squares Fcalc scaling. |
| **Volumetric physical fields** | CUBE/CHGCAR/XSF/CCP4-MRC, collinear/noncollinear CHGCAR spin, quantity/unit selection, density/potential conversion, CUBE/XSF export, multiple isosurfaces, guarded `A + k₁B + k₂C` difference fields and `∫Δρ dV`, extrema, Miller slices, approximate Voronoi integration. |
| **Objects and layers** | Visibility, opacity, and order of atom, bond, cell, label, Miller, and volumetric layers. |
| **Element-pair bonds** | Pair-specific minimum/maximum distances and geometric suggestions; automatic molecular XYZ/PDB or periodic CIF/POSCAR modes, connectivity for up to 300 independent atoms, redundant cyclic bonds, translation-indexed bond CSV. |
| **Lattice transformations** | 3×3 basis transformations, primitive/conventional cells, Niggli and short bases, Moyo symmetry detection. |
| **Miller planes and morphology** | Independent plane layers, slices/slabs, `{hkl}` face families, geometric morphology. |
| **Crystallographic symmetry** | Space-group settings, symmetry operators, Wyckoff matches, and expansion by symmetry. |

## Reciprocal space and diffraction

The **Reciprocal Space** page (`#karsi-uzay`) is a full-width conceptual laboratory. It reads the active structure (its symmetry-expanded P1 atom list) without changing the editor and reuses the editor's IT92 `f₀(s)`, ADP, and `F(hkl)` calculations.

| Tab | Content | Scope and limitations |
| --- | --- | --- |
| **Direct ↔ reciprocal lattice** | `(hkl)` plane family and perpendicular `G(hkl)`, `d`, `|G| = 1/d`, `a*, b*, c*`, `α*, β*, γ*`, `V* = 1/V`; 3D reciprocal lattice weighted by `|F|²`; **structure-factor phasor diagram** with head-to-tail atomic contributions (closed polygon = systematic extinction). | Crystallographic duality `aᵢ·bⱼ = δᵢⱼ`; conventional cell is used, with centering represented by extinctions. |
| **Ewald sphere and powder rings** | Ewald section in selected `[uvw]` plane, crystal rotation `ω`, sphere-intersecting reflections and diffracted beams, **Next Bragg position**, reciprocal `1/d` shells in powder mode, Debye–Scherrer rings on a flat detector and an LP-aware powder pattern. | Kinematic approximation; rings follow `r = D·tan 2θ`, with `D = 100 mm` and `2θ ≤ 70°`. |
| **Zone-axis pattern (SAED)** | Zero-order Laue zone for `[uvw]`; relativistic electron wavelength, Mott–Bethe electron scattering factor, excitation error, and thickness-dependent `sinc²` shape factor. Kinematically forbidden positions are marked separately. | No dynamical or double diffraction (e.g., Si [110] (002) can appear experimentally), and no HOLZ lines. |
| **Brillouin zone and bands** | Primitive lattice from pure translations preserving the crystal, Wigner–Seitz cell of the primitive reciprocal lattice (first Brillouin zone), Bravais type, Setyawan–Curtarolo (2010) high-symmetry points/path, and **empty-lattice** (free-electron) bands. | Paths for CUB, FCC, BCC, TET, ORC, and HEX; labels refer to the user's a/b/c axes. The zero-potential empty-lattice model cannot open a band gap. |

The scientific core is [`reciprocal-core.js`](reciprocal-core.js), and the UI is [`reciprocal-page.js`](reciprocal-page.js). Tests compare dual bases, `d(hkl)`, Bragg geometry, pure translations, SC/BCC/FCC/HEX zone geometry and volume, special-point boundary placement, and empty-lattice energies with analytical references.

## Library and the Crystallography Open Database (COD)

The full-width **Library** page has four tabs:

1. **Search COD:** search criteria on the left and results on the right. Filter by COD ID, name/formula, space group, required/excluded elements, publication, volume, and number of elements. Bookmark, open as CIF, or import results. Clicking a **COD ID** opens a details dialog.
2. **Examples:** a list of seven built-in structures—Si, NaCl, CsCl, diamond, FCC Cu, BaTiO₃, and graphite—with details, favorites, and import controls. **Create new P1** is also available.
3. **Bookmarks:** locally saved COD records; search, import, and export bookmark JSON.
4. **Cloudflare Worker · COD API:** inspect the default Worker endpoint, test connectivity, or save a browser-specific override without cluttering the search page.

### COD connection methods

| Mode | Behavior |
| --- | --- |
| **Automatic** | Tries the saved custom Worker, or the default Worker when none is configured; falls back to direct COD requests if the Worker fails. Uses OPTIMADE for supported standard filters, otherwise classic COD JSON. |
| **Cloudflare Worker API only** | Uses the configured custom Worker or the default Worker, without a direct-COD fallback. |
| **Direct OPTIMADE API only** | Supports only OPTIMADE-compatible filters. |
| **Direct classic COD API / CIF only** | Uses the classic COD `result.php?format=json` API. |

Official endpoints: [classic COD JSON](https://www.crystallography.net/cod/result.php?format=json) and [COD OPTIMADE](https://www.crystallography.net/cod/optimade/v1/structures). Direct browser requests depend on the upstream server allowing **CORS**. If online import fails, download the CIF and use **Open from file**, which is independent of COD API CORS. The default Worker is `https://kristalyapi-cod-api.aoakkirman.workers.dev`. Any valid custom Worker URL stored in the browser takes priority; **Restore default** removes only that override. The Worker has a [setup, security, and deployment guide](worker/README.md). **Deploying to GitHub Pages does not automatically deploy the Worker.**

### COD metadata: classic API, OPTIMADE, and Worker

The classic COD JSON API returns fields such as `sg`, `a`, `b`, `c`, `vol`, `authors`, and `doi`. OPTIMADE exposes equivalent metadata as `attributes._cod_sg`, `_cod_a`, `_cod_vol`, `_cod_authors`, and `_cod_doi`. **`normalizeCodRecord()` maps both formats to the same fields**, whether data arrives directly through OPTIMADE or through a Cloudflare Worker. Experimental uncertainties (`siga`, `sigvol`, etc.), publication details, and refinement metadata are also supported.

For example, [COD 4335507](https://www.crystallography.net/cod/4335507.html) can display `C 1 2/m 1`, `a=16.646 ± 0.002 Å`, `b=4.419 ± 0.0006 Å`, `c=7.4834 ± 0.001 Å`, `β=106.893 ± 0.002°`, `V=526.72 ± 0.12 Å³`, and publication data.

- **COD ID dialog:** shows only available data, with separate cards for name/formula, publications/DOI, lattice metrics and uncertainties, temperature, space group, radiation, and refinement. It attempts to fetch details using the selected connection method, falling back to metadata already present in the result row. Includes **View on COD** and **Import CIF** actions.
- **Data availability:** some COD records lack fields; missing experimental numbers are never fabricated. A configured Worker must be reachable.

Regression fixtures now verify that classic COD and OPTIMADE records produce equivalent metadata, preventing false gaps from incomplete `_cod_` mapping.


## File formats

| Operation | Supported formats |
| --- | --- |
| **Import** | CIF / common structural subset of mCIF, **SHELXL `.res/.ins`**, **Quantum ESPRESSO `pw.x` `.in/.pwi`**, **CASTEP `.cell`**, VASP POSCAR/CONTCAR, simple XYZ, **PDB/ENT** (CRYST1 + first MODEL, ATOM/HETATM, ANISOU), and Kristal Yapı project JSON. |
| **Export** | Project JSON, CIF, POSCAR, XYZ (visible supercell atoms), **PDB** (P1 atoms within the unit cell), **vector structure SVG**, **STL mesh**, **colored glTF 2.0 (.glb) 3D model**, and PNG. Additional publication formats are described below. |
| **Volumetric data** | Gaussian CUBE (`.cube`/`.cub`), VASP CHGCAR/CHG, XCrySDen XSF DATAGRID_3D. |

An imported, **unmodified CIF** is re-exported with its exact original text during the same session. **Package 8.1:** when a structure is edited, safe source-attributable bibliographic scalar and loop fields (`_publ_author_*`, `_citation_*`, and `_journal_*`) are carried into the regenerated CIF within size and syntax limits. Structure-dependent `_atom_site_*`, `_geom_*`, `_refine_*`, and experimental records are not automatically copied, as they may describe the *old* structure. The old `_cod_database_code` is not reused for a modified structure. If the composition changes, the original formula and chemical names are also omitted. **Lossless round-tripping is not guaranteed for every CIF dialect or metadata field.** Exact-source preservation applies only while the original text remains in memory; project JSON and page refreshes do not preserve the original CIF byte-for-byte. Keep the original CIF separately for scientific archiving.

XYZ carries no unit-cell information, so the viewer uses a synthetic visualization box. PDB support is a **crystallographic-coordinate subset**: the asymmetric atoms are symmetry-expanded when the CRYST1 Hermann–Mauguin symbol is recognized and compatible with the metric, otherwise a warning is shown. Missing element columns are inferred from atom-name alignment with a warning (a protein `CA` atom name must not be mistaken for calcium). Chain/residue topology is not preserved. PDB fixed-width decimals impose rounding limits on positions, occupancies, and ANISOU data.

**SHELXL structural input:** `.res/.ins` files are parsed for `CELL`, `LATT`, `SYMM`, `SFAC`, `FVAR`, and atom records. Symmetry, including centering/inversion, is expanded into explicit **P1** atoms. Partial occupancy and supported `Uiso/Uij` fields are retained. `PART` disorder grouping and bonding/restraints/refinement settings are not preserved one-to-one in the project. A `.fcf` is a separate Fourier-data input, not a structure file. Unknown occupancy variables cause a load error.

**Quantum ESPRESSO input:** reads `pw.x` `&SYSTEM` and `ATOMIC_POSITIONS`. Supports `CELL_PARAMETERS` for `ibrav=0` (`alat`, `bohr`, `angstrom`), documented `ibrav=1…14` forms, negative equivalents, and `91`. Distinguishes `celldm` from `A/B/C` values in Å and converts `crystal`, `alat`, `bohr`, and `angstrom` atomic positions. `crystal_sg` is rejected because it lists only symmetry-inequivalent atoms and cannot generate the whole cell without complete space-group settings. This reader targets `pw.x` **input** files, not output files with repeated model cards, and does not retain QE calculation settings.

**CASTEP input:** reads `%BLOCK LATTICE_CART` / `LATTICE_ABC` and `%BLOCK POSITIONS_FRAC` / `POSITIONS_ABS`, including `ang`, `bohr`, and `nm` units. Symmetry-generation flags and DFT constraints are not imported. All three readers process files locally in the browser without modifying the original scientific files.

### Package 8.2 — FCF reflection integrity and Fo−Fc maps

**SHELXL LIST 6 / IUCr reflection CIF** imports use `Fo = sqrt(max(0, F²obs))`, a supplied calculated `Fc`, and the source's `φcalc` (degrees) when available. Negative measured `F²` values are counted, clipped to `Fo = 0`, and **explicitly reported**. Missing model phases are never inferred: no Fo or Fo−Fc map is generated from a phase-less FCF. When all six source cell parameters are present, they must agree with the active crystal cell or processing fails. When the FCF lacks cell data, agreement of the **active cell and origin is a user assumption**. If the crystal's scientific data is modified after loading an FCF, the FCF must be reloaded.

A Friedel pair is combined only under the **non-anomalous, real-density assumption**. Contradictory phases, observed amplitudes, or calculated amplitudes cause an error instead of being silently discarded. Equivalent duplicates and reflections excluded by `d_min` or Nyquist limits are reported separately. **P1 grid coverage** indicates what fraction of the selected FFT grid has reflection data; it is **not experimental crystallographic completeness, symmetry equivalence, or an R factor**.

Fo−Fc offers **unscaled** `Fo−Fc` by default, or an optional **least-squares Fcalc scale** `s = Σ(Fo Fc) / Σ(Fc²)` yielding `Fo−sFc`. This is a simple constant multiplier—not refinement by resolution shell, anisotropic B factor, reflection weighting, or instrument model. Maps use **model phases (`φcalc`)**, a P1 inverse Fourier transform, and relative scaling. Before interpreting them as experimental density, independently validate atomic origin, crystal symmetry, experimental scale, and reflection completeness.

**Package 8.2b — limited MTZ input:** A merged **P1 MTZ** can now provide model-phased Fo/Fo−Fc maps when unambiguous typed **FP/F/FOBS, FC, and PHIC** columns are present. The parser checks IEEE byte order, header/data lengths, P1 symmetry, dataset cells, missing-number sentinels, and negative/invalid amplitudes. Skipped incomplete rows are counted. **Other space groups, unmerged/batch files, ambiguous datasets, anomalous pairs, and pre-weighted map-coefficient columns (e.g. FWT/PHWT) are rejected**, not mapped as if they were P1 observations. The initial regression fixtures are synthetic; independent Gemmi/CCP4 real-MTZ and map benchmarks are still pending.

**Package 8.2c — bounded primitive symmetry and manual columns:** Merged, non-anomalous MTZ is now accepted for **P1 (#1), P-1 (#2), P21 (#4), P21/c (#14), and P212121 (#19)** when all real-space `SYMM` operations, primitive counts, group closure, and unit-cell metric agree. Reflections are expanded as `h' = Rᵀh` and `φ' = φ - 360° h·t`; inconsistent Friedel/symmetry-equivalent amplitudes or phases fail closed. Use the optional **Fo, Fc, phase** input labels in `datasetId:LABEL` form when a file has duplicate column names. The third map option is **raw or LSQ-scaled, model-phased `2Fo−Fc`**, explicitly **not** a σA/FOM-weighted refinement map. The bottom workbench also reserves more height, and English translation coverage and WebGL smoke navigation are restored.

**Package 8.2d — independent real MTZ validation and quality-aware maps:** Two pinned, actual Gemmi datasets are regression fixtures: unphased **5e5z (P21)** and model/refinement-phased **5wkd (C2, centering included)**. The reader accepts genuine CCP4 `COLUMN` cards and supports C2 symmetry expansion. A dedicated CI step pins Gemmi 0.7.5 to compare **all 367 real 5wkd Fo/Fc/phase, σ, FOM and FREE rows**, plus real Fourier-grid voxels for **FWT/PHWT** and **DELFWT/PHDELWT**, independently of the browser FFT. The UI imports those *already weighted* refinement coefficients directly, or applies optional measured **Fo/σ(Fo)** minimum and explicit **FREE=0/1** exclusion. Optional `×FOM` is a plainly labelled **empirical amplitude multiplier**, not σA maximum-likelihood weighting. Missing phases can be inspected but cannot create a model-phased map.

**Not yet supported:** arbitrary MTZ space groups or ASU settings, every CIF2 reflection dictionary, anomalous Friedel differences, or computing σA/m/D weights from the reflection data inside the browser. Refinement-weighted FWT/DELFWT inputs are supported, but genuine experimental phasing and full CCP4 reproducibility outside the tested subsets remain future work. See the [Package 8.2 status report](tests/validation/PACKAGE_8_2_STATUS.md) for follow-up work.

### Package 9.1 — CCP4/MRC2014 volumetric map import

The volumetric workbench now reads binary **`.map`, `.ccp4`, and `.mrc`** files in the browser (24 MB / 2.5 million voxels maximum), alongside CUBE, CHGCAR, and XSF. Supported scalar MRC2014 **MODE 0/1/2/6** data are decoded with explicit little-/big-endian machine stamps, optional extended-header offset, signed `NCSTART/NRSTART/NSSTART`, and `MAPC/MAPR/MAPS` axis permutation. Voxel origins and steps use the full crystallographic (including oblique) cell metric in Å. A complete sampled unit cell is periodic; an **incomplete map brick remains nonperiodic** and is never silently completed by space-group operations. `.mrc` files may use a nonzero Cartesian `ORIGIN` when START is zero; mixed or ambiguous origins fail closed. This is **scalar real-space import**, not a reflection-data or phase reader.

CCP4/MRC headers do not reliably state the physical quantity or units. Import defaults to **unknown**; explicitly choose electron-density/potential units only when known from the source. Complex/Fourier-transform modes, float16 MODE 12, skew transformations, missing grid/cell geometry, and 1D/2D maps are currently unsupported; handedness of arbitrary cryo-EM maps may depend on producer convention. The independent CI fixture is Gemmi's real monoclinic **5i55_tiny.ccp4** with Y/X/Z axis permutation, signed starts and a symmetry header; an additional full-cell map is generated by **Gemmi 0.7.5 FFT from the real 5wkd refinement MTZ**. Both are checked against Gemmi for Cartesian geometry and voxel values. This does not yet prove all MRC vendor variants or VESTA project compatibility.

### Package 9.3 — Bounded VESTA 3.x project import

From **Open → My computer**, choose a VESTA `.vesta` file. To restore its `IMPORT_DENSITY` isosurfaces, select the **project and its explicitly referenced local CUBE/XSF/CHGCAR/CCP4/MRC map together** in the same file dialog (multi-select). Nothing in a VESTA project is fetched from the network or read from arbitrary filesystem paths. A project alone restores its listed structure; the import reports the missing map and does not invent voxel samples.

The bounded 3.x parser validates `CELLP` (lengths/angles, including monoclinic), `STRUC` fractional atoms/occupancies (up to 1,000), standard `GROUP` when its symmetry is supported, `BOUND` fractional ranges, `SBOND` distance rules, `SITET/ATOMT` RGB colors, `BONDS/LABEL` visibility and up to **four `ISURF` signed levels/colors** per referenced map. Nonstandard `SYMOP`/transform matrices, VESTA camera/lights, per-site radius, vectors, thermal ellipsoids, polyhedral styling, textured surfaces and arbitrary external `IMPORT_*` payloads are **not transferred**; import warnings remain in the editor notice. `ISURF` transparency fields are not yet converted; the application uses its safe default opacity. Mismatched lattice vs. map dimensions produce a warning, not a fabricated resampling. A `.vesta` file is **not** a substitute for its referenced volume data; source physical units still default to **unknown** unless identified by a supported source reader. This is an intentionally limited project subset, not a lossless VESTA round-trip or full feature equivalence.

The importer was checked against a real, public VESTA 3.3 Cd/Te file (VESTA 3.x `STRUC`, `CELLP`, `SITET`, `SBOND`, `ATOMT`, `BOUND` blocks), an independent VESTA 3.5 writer's `IMPORT_DENSITY/ISURF` convention, and a synthetic 3.5 project over the **real Gemmi 5i55 monoclinic CCP4** map in the native/browser regression suite. The source file and the exact rendering options should still be visually compared inside VESTA for scientific publication.

### Package 9.2 — Signed isosurfaces and publication-oriented contour styles

Signed scalar fields (e.g. Fo−Fc difference maps or potential fields) now have a one-click **+|ρ| / −|ρ|** isosurface pair, with distinct blue/red colors and independent threshold, visibility and opacity controls afterwards. The pair requires strictly positive and negative source samples and a threshold available on **both** signs; it does not change voxel values or assert that an unlabelled CCP4 map is electron density. Existing isosurfaces remain intact, subject to the four-layer-per-dataset cap.

3D surfaces can use **smooth**, **flat-shaded**, **wireframe** or **filled+wireframe** styles (shared geometry; capped surface budget). 2D contours now support **uniform**, **zero-centered symmetric**, **positive-only**, or **negative-only** levels and **signed solid/dashed** or monochrome line styles. Symmetric levels use the smaller positive/negative magnitude so both signs are represented; when a field has only one sign, the selection falls back to a safe uniform range. The downloaded slice PNG samples an independent **768 × 768** grid, rather than upscaling the 192 × 192 interactive preview. This is higher-resolution **raster** output, not vector/PDF contours, true GPU LOD, or VESTA feature equivalence.

### Package 8.1 — ADP site-symmetry validation and CIF provenance

When importing CIF/mCIF, the anisotropic displacement tensor of an atom on a special position is compared in Cartesian covariance form under every valid symmetry operation that maps the site onto itself. Small differences from finite precision in CIF numbers are tolerated—at least **0.002 Å² or 3% of the tensor magnitude**—while preserving cell/symmetry consistency. Clear contradictions generate an **error**, rather than depicting an invalid ADP as correct. Tensor rotation at a general-position site is normal and does not generate an error.

The scientific validation gate retains **30 real + 10 synthetic CIF** cases. Additional re-import tests modify source text and coordinates in **28 pinned real CIFs** with unambiguous source/reference information; analytic tensor references cover mirror and fourfold-axis special positions. These tests do **not** establish full correctness for every special-position Wyckoff/ADP class or every experimental-source error.

## Crystallographic and numerical capabilities

### Unit cells, symmetry, atoms, and rendering

- Fractional ↔ Cartesian coordinates using the **actual lattice metric**, including oblique/triclinic cells and periodic-neighbor measurements.
- **230 space groups** and **274 settings** in bundled reference tables, with symmetry operations, asymmetric-position expansion, and Wyckoff matching.
- Automatic space-group/Hall-setting analysis with **Moyo WASM 0.21.0**, user-selected tolerance, safe matching checks, and conventional/primitive conversions.
- Unimodular short bases, canonical **Niggli reduction**, FCC/BCC, and custom 3×3 cell transformations. Physical coordinates and applicable ADP tensors transform with the basis; results can be saved as explicit **P1** atoms when necessary.
- Oriented **thermal ellipsoids** from CIF `Uiso/Biso` and `Uij/Bij`. Invalid tensors are not displayed.
- Supercell repetitions 1–6. Three.js **InstancedMesh** groups atoms by type and bonds by shared geometry. Safety limits are **20,000 visible atoms** and **65,000 bonds**; these are not FPS guarantees. GPU, WebGL, labels, ADPs, polyhedra, and scene complexity affect performance. Above **5,000 atoms**, a lower-density sphere mesh is selected.
- Per-axis visible bounds in normalized fractional coordinates, e.g., `x: −0.1…1.1`, in addition to supercell repetition. Periodic bonds with custom bounds use the displayed-atom list.
- The **polyhedron representation** is available directly in the bottom toolbar. On activation, center species with **4–8 neighbors** are prioritized (e.g., Ti rather than Ba in BaTiO₃). The **+** control allows multiple center elements simultaneously; additional species are distinguished by element colors while retaining per-site overrides. This selection persists in JSON and undo/redo. Each physical site's neighbors are computed once and copied into its supercell instances. Faces share a colored/alpha mesh and edges share line geometry. The total limit is **2,400 polyhedra** across all selected species; exceeding it, or finding no suitable coordination, produces a visible warning. These shapes do not establish electronic bond orders.
- High-resolution PNG checks **MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE, and MAX_VIEWPORT_DIMS**, as well as the actual WebGL drawing buffer; if the requested output cannot be rendered, no file is created. A **24 MP** application limit applies. Temporary depth-tested, thick cell-edge geometry prevents ordinary thin WebGL lines from shrinking to one pixel at 4× export; the normal interactive scene is unaffected.
- **Structure SVG** is composed of real vector primitives projected from the active camera: colored atom circles, bonds/cell edges, polyhedron faces/edges, and supported geometry layers, rather than an embedded raster screenshot. A transparent background is available. Perspective atom circles and painter-order overlap are approximate; SVG is not pixel-identical to WebGL depth buffering/lighting and excludes volumetric textures. Complex scenes are capped at **60,000 vector elements**.
- Binary **STL** includes triangular surfaces of atoms, bonds, polyhedra, axes, and thermal ellipsoids; instanced atom/bond geometries become separate objects. STL has no color or units, so exported coordinate numbers should be interpreted as **Å**. No single manifold solid is generated; 3D printing may require mesh joining/repair. At most **one million triangles** are exported.
- **glTF 2.0 / .glb** preserves a colored 3D scene and instanced geometry where possible. Cartesian coordinates are stored as numerical **Å values**; some glTF viewers assume meters, so set the scale explicitly. SVG/STL/glTF omit volumetric grids and isosurface textures; save those as CUBE/XSF. Official Three.js exporters are bundled for offline use.

### Geometric analysis, diffraction, and Miller planes

- Element-dependent approximate bond cutoffs, pair-specific overrides, coordination polyhedra, and periodic distances.
- Interatomic distances, angles, dihedrals; separate measurement history with CSV export.
- **Bond-valence sums (BVS)** for explicitly selected oxidation states/ion pairs, using referenced empirical `R₀` and pair-specific `B` from IUCr 2020. The application does not automatically assign ionic charges or invent missing pair parameters.
- **Best-fit plane:** least-squares plane, RMS/maximum planarity deviation, and the angle between two planes. Selected periodic images are not automatically unwrapped.
- **Miller `(hkl)` planes** and `d(hkl)` using the complete cell metric; independent plane/layer objects, all parallel planes within a finite supercell, finite-thickness visual slices, and **P1 slabs** with vacuum. Slab construction is not surface relaxation or DFT.
- **`{hkl}` face families** with point-group-equivalent Miller indices for all crystal systems (triclinic through cubic), optional ± pairing, and **geometric crystal morphology** from intersecting half-spaces, including surface area and volume. Previous project morphologies load with equivalent geometry. This is **not** surface-energy-based Wulff construction.
- **Model XRD and neutron diffraction:** Bragg angles, `F(hkl)`, `|F|²`, relative ideal reflection intensities, and CSV. Reflections are enumerated in a **reciprocal-space sphere with `d_min` derived from the 2θ cutoff**, instead of an arbitrary `maxIndex` cube, avoiding accidental rejection of reflections in hexagonal/trigonal systems and large cells. Very large scans raise an explicit computational-budget error. X-rays use **International Tables IT92 neutral-atom four-Gaussian-plus-constant `f₀(s)`** (`Z=1–98`); neutrons use coherent natural-element scattering lengths (90 known elements, fm). Occupancy, `Uiso`, and Cartesian-transformed `Uij` for oblique cells are included. Optional fixed-wavelength powder corrections apply **Lorentz–polarization** to X-rays or the **unpolarized Lorentz `1/(sin²θ cosθ)`** factor to neutrons. No TOF geometry is modeled. A warning flags **neglected complex `b` / absorption** for neutron structures with B, Cd, Sm, Eu, or Gd. No anomalous `f′/f″`, true absorption correction, isotope-resolved mixtures, or Rietveld refinement. Tables are checked against [Gemmi 0.7.4 / IT92 / Neutron92](https://gemmi.readthedocs.io/en/stable/scattering.html).
- **Empirical powder profiles:** area-normalized pseudo-Voigt Gaussian/Lorentz mixture, with `FWHM² = U tan²θ + V tanθ + W` (°²), Lorentzian fraction `η`, 0.005–0.2° sampling, and user-adjustable Cu Kα1/Kα2 defaults **1.54060/1.54443 Å** at a 2:1 ratio. The lines retain their relative contributions. Broadening is **not calibrated to an instrument**. CSV (`2theta_deg,intensity`; comma, tab, or semicolon) can be overlaid after scaling each profile to a maximum of 100. **There is no automatic fitting, background subtraction, or Rietveld refinement from measurements.** The simulated profile can be exported as CSV.

  Scientific reference for profile and peak-width conventions: [IUCr — X-ray powder diffraction in education: Bragg peak profiles](https://journals.iucr.org/j/issues/2021/06/00/gj5272/index.html).
- **Model Fourier/Patterson maps:** calculated `F(hkl)` with a spherical **`d_min` resolution cutoff in Å** and radix-2 FFT on **16³, 32³, or 64³ periodic grids**. The grid is checked against the Nyquist criterion and the computation is budget-limited. Patterson maps use `|F|²`. These are **not experimental Fobs or observed intensities**; finite reflection ranges introduce resolution/truncation artifacts.
- **SHELX `.fcf` experimental amplitudes + model phases:** Fourier maps of **Fo** and **Fo−Fc** from reflection CIF loops containing `_refln_F_squared_meas` / `_refln_F_meas`, `_refln_phase_calc`, and `_refln_F_squared_calc` / `_refln_F_calc` for differences. Measured amplitudes are combined with **calculated phases**, not direct experimentally observed phases or a complete experimental electron-density reconstruction. Phase-less FCF (including some `LIST 4` output) is rejected. Users must verify matching cells, reflection coverage, scaling, systematic absences, and symmetry. No `.mtz`, Rietveld, or density refinement.
- **Magnetic mCIF (limited visualization):** reads `_atom_site_moment.Cartn_*` and `crystalaxis_*` vectors; applies spatial rotations, axial-vector determinant, and time-reversal terms from `_space_group_symop_magn_operation.xyz` / `_space_group_symop_magn_centering.xyz`. Moments are shown as colored arrows in a separate layer (maximum **600**), stored in JSON, and can be exported with explicit P1 sites to `.mcif` after edits. **Magnetic Bragg scattering, a BNS-group catalog, k-vector/superspace operations, SAXIS transformation, and magnetic refinement are unsupported.**
- **Madelung/Ewald point-charge model:** for a neutral, fully occupied cell with manually assigned charges keyed by asymmetric-site number, unique atom label, or element species. Real-, reciprocal-, and self-interaction terms are included. Symmetry-generated ions retain the source asymmetric-site charge, and output potentials identify source site and symmetry copy. Cell energy (eV) and site potential (eV/e) are tested against the NaCl Madelung-constant reference. This does not simulate polarization, dielectric screening, or electronic structure.


### Multi-phase structures and volumetric data

- Display the main crystal together with **up to three extra phases** in a shared Cartesian Å scene. Each phase supports positioning/alignment, color, transparency, and cell boundaries. Automatic atom matching and strain analysis are not included.
- Up to **five volumetric fields** in the same spatial coordinate frame, with up to **four isosurfaces per field** and **eight simultaneously active isosurfaces** in total.
- Export any active volumetric field—including Δρ, CHGCAR spin components, and Fourier/FCF maps—as **Gaussian CUBE** (`.cube`, negative-dimension records indicating Å length) or **XCrySDen XSF DATAGRID_3D** (`.xsf`). Scalar values are not rescaled; quantity and physical units are written in comments. Internal z-fastest ordering is converted for CUBE and x-fastest ordering for XSF. Periodic XSF duplicate boundary planes are generated. Because CUBE/XSF do not strictly enforce units, check the comments and source units in other applications.

  The [XCrySDen XSF specification](https://www.xcrysden.org/doc/XSF.html) is followed for grid order and periodic boundaries.
- Trilinear sampling for skewed grid vectors; 2D slicing with color scale and CSV/PNG; **2–20-level marching-squares contour maps**; interactive line profiles with CSV; and optional coloring of surfaces or slices by a compatible second field.
- When loading a CUBE/XSF field, specify **electron density**, **potential**, or **unknown**, together with the source unit. Conversions include `e/bohr³ → e/Å³` and `Hartree/e → V`. The **first CHGCAR block** is total density. If available, subsequent collinear `m_z` or noncollinear `m_x/m_y/m_z` grids are parsed after PAW augmentation records and added as `μB/Å³` fields after division by cell volume. Spin axes depend on VASP **SAXIS**; the augmentation matrix is not separately analyzed.
- The guarded **`A + k₁B + k₂C`** operation requires compatible, known physical quantities; C is optional. Differing grid resolutions are matched through Cartesian interpolation. The resulting **`∫(A + k₁B + k₂C) dV`** is reported with units (voxel sum on periodic grids; trapezoidal integration on open-ended grids). Numerical accuracy depends on source resolution. Local 3D maxima/minima support signed `≥`/`≤` thresholds, Cartesian Å and **fractional grid coordinates**, axis-wise parabolic **sub-voxel location estimates**, and optional symmetry-equivalent merging for cell-aligned periodic fields. This is not a full 3D Hessian or critical-point classification.
- **Oblique `(hkl)` numerical slices** with multilevel contours are clipped to the actual grid extent and exported as CSV/PNG. Profile axes use real **Cartesian distance in Å**, not pixel distances; invalid out-of-grid pixels are not connected into fictitious density lines.
- Approximate **Voronoi charge integration** by sampling an `e/Å³` periodic density and assigning each sample to the nearest nucleus. Normalized CUBE/XSF densities are accepted when periodicity is declared and the cell metric agrees; repeated terminal XSF grid planes are removed. Results and CSV identify asymmetric sites and symmetry copies separately. Sampling is capped at **12,000 points** on large grids. This is **not zero-flux Bader analysis**. The UI warns that PAW/VASP CHGCAR lacks all-electron density near the nuclei and notes the relevance of **AECCAR0+AECCAR2** for Bader work. Quantitative charges need convergence testing.
- The tool **displays supplied scalar fields**; it does not calculate quantum-chemical electron density, electrostatic potentials, or **DFT**. Fields with incompatible reference frames are not silently combined.
- Large-data limits: **24 MB per file** and **2.5 million voxels**. Volumetric files must be reopened after a page refresh.

### Quantitative crystal chemistry — Package 7.9

The selected atom's coordination panel reports the **Baur bond-length distortion index** (`D`) and **Hoppe effective coordination number** (`ECoN`), separately from ordinary neighbor count. ECoN is not the same as occupancy-weighted coordination number: Hoppe weights are derived from bond distances. Where genuine tetrahedral or octahedral face topology is verified, **quadratic elongation** and **bond-angle variance** are available. A six-vertex prism is not automatically treated as an octahedron. Partial/alternative occupancy limits the result to geometrical interpretation; quantitative indices are withheld when the neighbor list was truncated to the first 24.

For BVS, the periodic images within the bond radius are enumerated using the reciprocal metric, **without a hard ±2 image restriction** in skew cells; nonperiodic molecular data excludes periodic images. The model applies **only to a selected reference ion pair** with empirical `R₀/B` parameters; it does not infer oxidation states or chemical bond order. A reference expected bond length assumes formal charge is shared equally between bonds. Earlier definitions remain in [`tests/validation/PACKAGE_7_STATUS.md`](tests/validation/PACKAGE_7_STATUS.md); the independently validated P12 model and caveats are in [`tests/validation/PACKAGE_12_STATUS.md`](tests/validation/PACKAGE_12_STATUS.md).

## Scientific scope and limitations

- **This is not feature-for-feature equivalent to VESTA.** Magnetic mCIF support covers a subset of site moments and 3D symmetry; there is no complete magnetic-group/superspace catalog, support for every CIF variant, or unrestricted selection of all Hall settings.
- If a CIF lacks explicit symmetry operators, a reference setting/origin for the recognized space group may be used. Verify structures independently when alternative settings or origins matter.
- Bond lines and coordination are **geometric interpretations**, not experimental proof of chemical bonds or bond order.
- Surface generation, BVS, model diffraction, Fourier/Patterson, empirical powder profiles, and point-ion Madelung are limited physical models. **Surface energies, Wulff equilibrium, atomic relaxation, instrument-profile refinement, anomalous scattering, and DFT** are not computed.
- Editing and re-exporting a CIF may not retain every item of experimental source metadata. Compare against the original CIF and independent scientific software.
- See [scientific CIF validation](tests/validation/README.md) and the [VESTA-oriented roadmap](ROADMAP.md) for references, test limits, and planned improvements.

### Main differences from VESTA today

- **P0 — Offline distribution:** Three.js, Moyo WASM, and application assets are served together with a versioned service worker and PWA manifest. They must first be cached online. User volumetric files, COD/Worker requests, and CIFs not downloaded previously remain unavailable offline.
- **P1 — Scientific correctness, Packages A + B:** reciprocal `d_min` spherical XRD scan; physical-quantity/unit validation for CUBE/XSF; minimum thresholds; PDB CRYST1 and element checks; symmetry site identities (A); neutron Lorentz/absorption warnings; `d_min`/FFT Fourier to 64³; three-source Δρ; PAW/AECCAR caveats; uppercased PDB element columns on export (B).
- **P1 — Physical models and experimental FCF subset:** IT92 and natural-neutron `b`, model Fourier/Patterson, phased SHELX `.fcf` Fo/Fo−Fc FFT, sampled Voronoi charges and ionic Ewald, empirical powder/measurement CSV, and volumetric CUBE/XSF export. **Still missing:** `.mtz` and phase-less FCF workflows, anomalous scattering, isotope-specific composition, true instrument profile fitting/RIETAN-FP equivalence, Bader analysis, and broad convergence benchmarks.
- **P1 — File and symmetry breadth:** PDB/ENT crystallographic coordinates with ANISOU, CHGCAR spin grids, and limited mCIF moment/symmetry visualization are present. **Still missing:** `.vesta` projects, many biomolecular/quantum-chemistry formats, full BNS/magnetic superspace groups, SAXIS corrections, and detailed alternative-setting/origin conversions.
- **P2 — Morphology and scene:** remaining gaps include some full point-group equivalents for non-cubic `{hkl}` cases, multi-phase CIF export, and VESTA-level object/per-site styling flexibility.
- **P2 — Publication and 3D export:** available formats include **1×–4× PNG up to 24 MP**, transparent backgrounds, **vector structure SVG**, **lossless RGB TIFF** (150/300/600 DPI print metadata), **A4 raster PDF**, **true Bézier-based vector PDF/EPS**, **STL**, **colored VRML97 (.wrl)**, and **glTF (.glb)**. Vector outputs exclude volumetric fields; EPS flattens transparency onto white. Pixel-equivalence with WebGL depth/lighting, manifold STL unions, 3D output of volumetric isosurfaces, and guaranteed high FPS in very large scenes remain unavailable.

For comparison, see [official VESTA features](https://jp-minerals.org/vesta/en/) and the [project roadmap](ROADMAP.md).

## Offline operation (except COD)

A **service worker and PWA manifest** are included. After the first successful HTTPS visit, the application shell, Three.js ES modules, Moyo WASM, English/Turkish translations, and Reciprocal Space page are cached together. Once installation finishes, the same URL can be reopened under the same browser profile and local scientific computations can run **without network connectivity**. Installation requires the internet; if the browser evicts the cache, revisit online.

- The service worker handles only **static same-origin app assets**. COD, user-configured Cloudflare Workers, other APIs, and external links are not cached.
- For a new deployment, increment `CACHE_NAME` in `sw.js`. The new version activates only when all required assets have downloaded successfully, generally after older open tabs close. If files are missing, the old working cache is retained.
- Volumetric file bytes are not saved with persistent projects and must be reopened after refresh. Local CIF/POSCAR/XYZ may be opened again by the user; remote COD data is not available offline.
- Test offline mode after service-worker activation using the browser's network-offline controls. The `file://` scheme is unsupported; use HTTPS or localhost.

## Local development and tests

Use **Node.js 22+** and Python 3 to run a local static server. The GitHub Pages workflow automatically bundles Moyo WASM; for local use install and copy it manually:

```sh
npm install --no-save --ignore-scripts @spglib/moyo-wasm@0.21.0
mkdir -p vendor
cp node_modules/@spglib/moyo-wasm/moyo_wasm.js vendor/
cp node_modules/@spglib/moyo-wasm/moyo_wasm_bg.wasm vendor/
python3 -m http.server 8000
```

Then open **http://localhost:8000**. Use a local HTTP server instead of opening the file directly using `file://`, since WASM and ES modules require appropriate MIME types and origins.

**Node regression tests** (no extra packages):

```sh
node --test tests/core.test.cjs tests/worker.test.mjs tests/reciprocal.test.mjs
```

**Real Chromium/WebGL visual tests** require Playwright, Three.js dependencies, and an installed browser: `node tests/browser/visual.test.mjs`. **Independent CIF accuracy validation** uses Gemmi 0.7.4 references and pinned CIF fixtures; commands and gates are documented in [tests/validation/README.md](tests/validation/README.md).

GitHub Actions workflows:

- [pages.yml](.github/workflows/pages.yml): Node tests, Moyo WASM packaging, and GitHub Pages deployment on `main`.
- [browser-visual.yml](.github/workflows/browser-visual.yml): Chromium/WebGL visual tests and screenshot artifacts on relevant `main` changes or manual invocation.
- [cif-validation.yml](.github/workflows/cif-validation.yml): independent CIF/Gemmi verification, with measurement/gating modes and optional manual `strict` mode.

Set **Settings → Pages → Build and deployment → Source: GitHub Actions** in GitHub. The optional Worker is deployed separately; see [worker/README.md](worker/README.md).

## Sources and license notes

- 3D engine: [Three.js](https://threejs.org/), version **0.186.1**, bundled as [MIT-licensed local ES modules](vendor/three/README.md).
- Automatic symmetry: [moyo-wasm](https://github.com/spglib/moyo/tree/main/moyo-wasm), version **0.21.0**; bundled [MIT](licenses/LICENSE-MOYO-MIT.txt) and [Apache-2.0](licenses/LICENSE-MOYO-APACHE.txt) notices.
- Space-group/Wyckoff reference data derived from [spglib](https://github.com/spglib/spglib) and [wyckoff](https://github.com/anoopkcn/wyckoff); attribution/license notices are included in the application source.
- COD data/API: [Crystallography Open Database](https://www.crystallography.net/cod/) and its [official REST API documentation](https://wiki.crystallography.net/RESTful_API/).
