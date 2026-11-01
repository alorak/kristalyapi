# P1 · Bulk GaN / AlN / SiC Quantum ESPRESSO evidence verification

**Current scientific status:** no new physical GaN/AlN/SiC QE calculation was run. This PR adds a verifier that **requires already executed raw outputs** and refuses missing or inconsistent evidence. The existing hosted QE electronic API remains **2D/slab-only**; the verifier is an offline Python tool and does not change server permissions or start jobs.

## What to supply

The manifest must live alongside the files it references, which are pinned by lowercase SHA-256. Only relative in-directory paths are permitted. Expected schema: `kristalyapi.qe-bulk-evidence.v1`.

- `material`: `GaN`, `AlN` or `SiC`.
- `polytype_claim`: human-declared reference (e.g. `wurtzite 2H candidate`), **not independently verified**.
- `structure_reference: {path,sha256}`: independent source CIF/POSCAR/canonical structure export whose bytes are pinned.
- `pseudopotentials: {Ga: {path,sha256}, N: ...}` or the corresponding Al/N and Si/C pair. Real UPFs are **not shipped**; the operator must select and license appropriate XC-compatible UPFs.
- `criteria: {max_energy_delta_mev_per_atom: 1.0, max_scf_accuracy_ry: 1e-6}` (tolerances must be preregistered; these are **illustrative**, not universal physical acceptance criteria).
- `runs` must contain **exactly** `baseline`, `ecut-refined`, `k-refined`, `bands`; every one has `input: {path,sha256}` and `output: {path,sha256}`.

## Numerical validation

The tool parses real QE-like `pw.x` input/output syntax; it requires complete `Program PWSCF` stage logs, `JOB DONE.`, SCF convergence, total energies, SCF residuals and a documented QE version. It checks that:

1. All SCF stages use **3D** `K_POINTS automatic` with `k_x,k_y,k_z ≥ 2`, two species, bounded atom count and explicit geometry.
2. Cutoff-refined SCF keeps the base grid but increases `ecutwfc`; k-mesh-refined SCF keeps cutoffs but increases grid sampling.
3. Geometry blocks and QE version are unchanged across compared calculations. The bands step has an explicit `K_POINTS crystal_b` path including **nonzero** reciprocal `k_z`, with matching structure and baseline cutoffs.
4. All raw files and UPFs match the hashes written in the manifest.
5. `|E_{refine}-E_{base}|/N_{atoms}` is compared in meV/atom with the declared tolerances, and SCF accuracy is bounded.

The tool checks text and arithmetic. It does **not** prove that a log came from authentic QE, that structure and pseudopotential metadata truly match physical species, that the `k` path is symmetry-correct, that the phase/polytype claim holds, that a property is experimentally credible, or that these convergence tests alone suffice. More comprehensive acceptance would require lattice relaxations, reference-vs-relaxed geometries, carefully selected k paths, SOC/spin where relevant, pseudopotential/functional consistency, higher-cutoff comparison, repetitions, and independent scientific review.

## Run

```sh
python tools/qe_bulk_validation.py --manifest /private/bulk/manifest.json --output /private/bulk/bulk-review.json
python -m unittest discover -s tests -p 'test_qe_bulk_validation.py' -v
```

Exit status 0 means **software numeric gates** pass; exit 2 means they fail; invalid/missing input raises an error. Regardless, every report explicitly sets `scientific_acceptance: false`.

**Test provenance:** committed test fixtures are generated as synthetic textual QE outputs with fake UPF files, solely to validate rejection and parser semantics. They are not scientific data and must never be used as physical material properties. The tool makes no network call and never invokes `pw.x` or other solvers.

## Next physical experiment

Run real Quantum ESPRESSO on validated GaN, AlN and SiC polymorphs in an appropriately configured scientific environment. Archive all raw inputs and outputs, UPFs, software/container identifiers, operator procedure, comparative references and convergence evidence. Then review the tool's results **plus** independent physical/experimental evidence. Until then, no 3D bulk DFT acceptance has occurred.
