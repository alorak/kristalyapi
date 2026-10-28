# D2.1 — Real Docker/API Si SCF acceptance

Status: **passed**

7/7 completed real PBE/unpolarized Si jobs; 2 atoms, fixed diamond lattice a=5.431 Å.

| Case | Energy (Ry) | Final SCF accuracy (Ry) | Iterations |
| --- | ---: | ---: | ---: |
| ecut45-k8 | -22.83950736 | 8e-09 | 8 |
| ecut60-k8 | -22.83956744 | 3.9e-09 | 9 |
| ecut75-k8 | -22.83958475 | 2.2e-09 | 9 |
| ecut75-k4 | -22.82604899 | 3.8e-09 | 8 |
| ecut75-k6 | -22.83810997 | 8.9e-09 | 8 |
| ecut75-k10 | -22.83981736 | 6.7e-09 | 9 |
| ecut75-k12 | -22.83986004 | 4e-10 | 10 |

## Finite sensitivity checks

- cutoff: ecut60-k8 → ecut75-k8: 0.117757 meV/atom (limit 1.0; passed=True).
- kmesh: ecut75-k10 → ecut75-k12: 0.290345 meV/atom (limit 1.0; passed=True).

Raw input/output, authenticated API traces without tokens, job IDs, hashes and provenance accompany this report.
Acceptance requires every job and finite sensitivity check to pass. Its scope is this Si protocol; MoS₂, relaxed geometry, other observables and general scientific accuracy require separate validation.
