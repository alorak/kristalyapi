# Collinear spin electronic jobs

Use `kristalyapi.qe-electronic-job.v2` for a **neutral scalar collinear** SCF → bands → DOS/PDOS job. Version 1 and its recorded unpolarized requests/results remain unchanged. Standalone SCF and relaxation keep their existing unpolarized contracts.

In the DFT setup page select the electronic workflow and collinear spin, enter one `ELEMENT FRACTION` line for every element, and select explicit DOS settings. Preparing or changing these controls never starts a job. The API requires the existing authentication, UPF profile and explicit submission action.

Example parameter additions (all ordinary structure, cutoff, mesh, path and electronic fields are still required):

```json
{
  "spin": "polarized",
  "starting_magnetization": {"Si": 0.1},
  "degauss_ry": 0.01
}
```

The starting fractions must be finite in [−1, 1], cover the species exactly, and include at least one nonzero seed. They are **initial guesses**, not constraints or accepted magnetic moments. Species are sorted before producing the matching `starting_magnetization(i)` entries. This workflow uses `nspin=2`, Gaussian SCF smearing (0.001–0.05 Ry) and neutral unconstrained occupations. The smearing in the DOS settings remains a separate parameter. UPF SHA-256 and `PP_HEADER has_so=false` are checked before execution.

For conservative capacity admission, `nbnd` per spin must be at least the neutral valence electron count from the pinned UPF headers. This guarantees room even for fully polarized occupations; it is more restrictive than many practical calculations need and **does not establish empty-band convergence**. The SCF, band and NSCF stages all explicitly use this band count.

Seven stages are retained: `scf`, `bands`, `bands_pp_up`, `bands_pp_down`, `nscf`, `dos`, `projwfc`. `bands.x` runs separately with `spin_component=1/2`. Stage-boundary pause/resume, cancellation, limits and diagnostics apply to both spin versions. A changed source/checkpoint contract refuses resume.

Results use `kristalyapi.qe-electronic-job-result.v2` containing `kristalyapi.qe-electronic.v2`. `channels.up` and `channels.down` carry explicitly tagged `kristalyapi.qe-spin-channel.v1` band/DOS/atomic PDOS datasets. DOS is positive for both spins. There is no sign reflection, Fermi shift, interpolation or automatic ground-state interpretation. The common integrated DOS is stored **once** in `integrated_dos_total`; QE's last DOS column integrates both spins, so it must not be labeled as either channel's integral. Total/absolute SCF magnetizations are in μB per simulation cell at QE's printed precision. CSV and SVG/PNG exports name and record the selected spin channel.

The parser checks strict column counts, finite/nonnegative densities, common grids, per-channel m-component → LDOS and all-atom → total-projection sums, matching spin band paths, and DOS versus projwfc total densities with explicit printed-decimal tolerances. Source inputs, raw stage files and hashes remain available for independent verification.

Scientific scope excludes SOC/noncollinear calculations, charged defects, same-element AFM sublattice species, optical/PL claims, and magnetic ground-state acceptance. Several starting seeds and energy comparisons, tighter meshes/cutoffs/bands, smearing studies and spin convergence would be separate scientific work. The small Si smoke is a functional integration test only; no large D5 calculation is launched.

Primary format references pinned to the engine generation:

- [QE 6.7 DOS writer](https://github.com/QEF/q-e/blob/qe-6.7.0/PP/src/dos.f90): E, DOSup, DOSdown, total integrated DOS.
- [QE 6.7 partial DOS writer](https://github.com/QEF/q-e/blob/qe-6.7.0/PP/src/partialdos.f90): E, LDOSup, LDOSdown, then interleaved m-up/m-down columns.
- [bands.x spin component](https://www.quantum-espresso.org/Doc/INPUT_BANDS.html#spin_component).
- [pw.x starting magnetization](https://www.quantum-espresso.org/Doc/INPUT_PW.html#starting_magnetization).
