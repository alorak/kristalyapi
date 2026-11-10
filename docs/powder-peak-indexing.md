# Toz Kırınımı → Pik İndisleme (P0)

The **Pik İndisleme / Peak Indexing** tab at `#toz-kirinimi/pik-indisleme` offers a local, editable XRD worksheet. It does **not** solve an unknown pattern's (hkl) indices: the user must supply them before lattice refinement.

## Workflow

1. Open **Toz Kırınımı → Pik İndisleme**.
2. Select **Kübik / Cubic** or **Hekzagonal / Hexagonal** and enter the wavelength in Å. The initial example uses Cu Kα (`1.540562 Å`).
3. Enter each **measured** `2θ` (degrees) and integer **h, k, l** in the table. `θ`, `d` and `sin²θ` update immediately.
4. Review the fitted **a, b, c**, **c/a**, calculated `2θ`, residuals `Δ2θ = 2θ_meas - 2θ_calc`, and RMSE values.
5. Use **Load Ti example**, **Add peak**, **Clear worksheet**, **Import CSV** and **Export CSV** as needed.

The embedded seven-line α-Ti example (in degrees) is:

| 2θ | hkl |
|---:|:---|
| 35.10 | 100 |
| 38.39 | 002 |
| 40.17 | 101 |
| 53.00 | 102 |
| 62.94 | 110 |
| 70.65 | 103 |
| 74.17 | 200 |

With `λ=1.540562 Å`, the unweighted fit gives approximately `a=2.950 Å`, `c=4.684 Å`, `c/a=1.588`, allowing for rounded peak angles. The example is based on the hexagonal titanium peak-indisleme calculation in the user's educational powder-diffraction PDF. Reference values in that text use rounded intermediate coefficients and may differ slightly.

## Calculations

Bragg relation, first order: `2d sin θ = λ`, with `θ = (2θ)/2`.

- Cubic: `1/d² = (h² + k² + l²) / a²`.
- Hexagonal: `1/d² = [4(h² + hk + k²)]/(3a²) + l²/c²`.

The engine computes `q_meas = 1/d²` for each entered peak and fits the corresponding linear reciprocal-space coefficients through the origin by **ordinary least squares**. For hexagonal, `alpha = 4/(3a²)` and `beta = 1/c²`; for cubic, `alpha = 1/a²`. It then reconstructs predicted Bragg angles and residuals. No optimization server, DFT engine or network request is required.

### Validation and scientific scope

- `0 < 2θ < 180°`, `0 < λ ≤ 10 Å`, and all Miller indices are integers in `[-30, 30]` except `000`.
- At least **two** assigned cubic peaks, or **three** assigned hexagonal peaks are needed. Hexagonal assignments must have sufficient independent basal and axial information to determine both `a` and `c`.
- The fit is **unweighted**, assumes a **single phase**, treats `2θ` as calibrated, and does not estimate standard errors. `RMSE` is a descriptive residual, **not** a confidence interval or proof of correct indexing.
- This release does **not** provide automatic Miller-index assignment, systematic extinction checks, Bragg peak detection/deconvolution, zero-shift/refraction/specimen displacement refinement, instrumental profiles or multiphase fitting.
- Unexpected/poor fits should prompt checking the radiation wavelength, phase, assigned hkl and instrument calibration.

## CSV schema

The parser supports UTF-8 comma-separated files with **`2theta,h,k,l`** or **`2theta_deg,h,k,l`** headers, plus optional trailing calculated columns. Semicolon-delimited files can use decimal commas. Headerless four-column files are also accepted. For example:

```csv
2theta,h,k,l
35.10,1,0,0
38.39,0,0,2
40.17,1,0,1
```

The export adds `theta_deg`, `d_observed_A`, `sin2theta`, `twoTheta_calculated_deg`, and `delta_twoTheta_deg`. Missing computed values remain empty. Exported files contain experimental entries, not a CIF revision.

## Technical files and checks

- `powder-indexing-core.js` — scientific calculations and CSV utilities.
- `powder-indexing-page.js` — editable worksheet, localization and export.
- `powder-indexing.css` — responsive presentation.
- `tests/powder-indexing.test.mjs` — titanium fixture, ideal cubic values, limits, singular fits, CSV and route checks.

Run `node --test tests/powder-indexing.test.mjs tests/pages-assets.test.mjs`. Pages staging and service-worker cache must include all three assets.

**Planned P1:** independent automatic hkl candidate generation, systematic absence filtering from CIF/space group, ranking by indexing figures of merit, peak assignment review, optional weighted fitting and zero-shift calibration.


## P1.1 / P1.2: automatic **candidate** indexing

The worksheet now has **Manual hkl** and **Automatic hkl · P1** modes. The automatic mode uses **only measured 2θ**, wavelength and search limits: existing manual hkl fields are not used as priors. Five to forty distinct diffraction peaks are supported, in the input order or any order. To load a plain peak list (no hkl columns), paste one `2θ` per line or a CSV headed `2theta` (optional intensity column), then click **Load angles into table**.

- Select **Cubic** for P1.1. Search primitive (`P`), body-centered (`I`) and face-centered (`F`) Bravais lattices, or restrict the search to one of them. These are **centering** rules only; no basis-dependent forbidden reflections are asserted.
- Select **Hexagonal** for P1.2. The search uses `1/d² = 4(h²+hk+k²)/(3a²) + l²/c²` with positive `a,c`; it makes **no space-group extinction assumptions**, including any `00l` screw-axis selection rules.
- Choose the **2θ tolerance** (default 0.20°, allowed 0.05–0.6°), `a` bounds (default 2–10 Å) and for hexagonal `c` bounds (default 2–15 Å). These bounded ranges prevent enormous brute-force searches; outside-range or heavily overlapped patterns may have no candidate.
- Click **Calculate candidates**, inspect the ranked list and expand each to view **measured 2θ, hkl, calculated 2θ, Δ2θ**, unexplained measured peaks and expected lines within the measurement range that had no match.
- **Apply hkl assignments** is enabled only when **all measured peaks** have a one-to-one candidate match. This preserves the original data when a phase has extra or spurious peaks. Applying a complete candidate fills the P0 worksheet and recomputes its linear least-squares lattice fit.

### Scientific model and algorithm

The search estimates `q = 1/d² = 4sin²θ/λ²`. For cubic `q = N/a²` with `N=h²+k²+l²`; the P/I/F selection functions restrict candidate integer triples. For hexagonal `q = α(h²+hk+k²)+βl²`, `α=4/(3a²)` and `β=1/c²`. Deterministic low-angle seeding proposes candidate coefficients; predicted reflections are matched one-to-one to observed peaks within tolerance; only the leading bounded candidates are refitted using the existing P0 least-squares engine.

Candidates are ranked by a **heuristic**, balancing matched peaks, unmatched measured peaks, unexplained theoretical lines within the measured angular span and angle RMSE. **The score is not a probability, de Wolff M20 figure of merit, or verified confidence value.** Missing theoretical peaks are a weak penalty because their intensities and structure-factor extinctions have not been computed.

### Validation fixture and limitations

The seven experimental α-Ti peak positions listed above, **without any hkl input**, should produce the expected `100,002,101,102,110,103,200` assignments as a top hexagonal candidate with `a≈2.950 Å` and `c≈4.684 Å`. Synthetic cubic-F, cubic-I and general hexagonal reference datasets verify other lattice candidates. Because powder peak positions alone do not uniquely identify a phase, equivalent primitive/supercell choices may fit equally well; their presence in the candidate list is not a bug.

This is a **bounded teaching/research screening tool, not full professional indexing**. It does not model instrumental zero shift, doublets, whole-profile fitting, impurity mixtures, preferred orientation, space-group glide/screw extinctions, structure factors or uncertainty propagation. Peaks absent due to weak intensity may change the ranking. A candidate must be compared with independent structure, chemistry, systematic absences and experimental calibration before claiming crystallographic identification.

Core implementation: `powder-auto-index-core.js`. Regression tests: `tests/powder-auto-index.test.mjs`. To run locally:

```sh
node --test tests/powder-indexing.test.mjs tests/powder-auto-index.test.mjs tests/pages-assets.test.mjs
```
