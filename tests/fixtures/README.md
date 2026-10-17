# Real crystallographic MTZ regression fixtures

These small, original, *non-synthetic* MTZ reflection files come from the public
[Gemmi test corpus](https://github.com/project-gemmi/gemmi/tree/master/tests),
distributed here only for reproducible scientific compatibility testing:

| Local fixture | Upstream source | Git blob SHA-1 | Crystal / reflections |
| --- | --- | --- | --- |
| `gemmi-5e5z.mtz` | [5e5z.mtz](https://github.com/project-gemmi/gemmi/blob/master/tests/5e5z.mtz) | `508b7a962f78a76343c5e9bc8b65c5c7a2cd09cf` | P21 (#4), 441 records, 403 complete FP/SIGFP/FREE |
| `gemmi-5wkd_phases.mtz.gz` | [5wkd_phases.mtz.gz](https://github.com/project-gemmi/gemmi/blob/master/tests/5wkd_phases.mtz.gz) | `937d3f4fd0f8b22733b07cd5dc6b5a325aa6e011` | C2 (#5), 367 records, FC/PHIC, FWT/PHWT, DELFWT/PHDELWT, FOM, SIGFP, FREE |

Original projects: [PDB 5e5z](https://www.rcsb.org/structure/5E5Z) and
[PDB 5wkd](https://www.rcsb.org/structure/5WKD); see Gemmi repository for
provenance and its MPL-2.0 software license. The raw fixture bytes have not
been modified or regenerated; the compressed MTZ is decompressed only in tests.

The native parser does not claim general MTZ/CCP4 support. An independent CI
validation runs **Gemmi 0.7.5** to check every measured/model/quality column
in 5wkd and compare actual 64³ grid samples of FWT and DELFWT maps.
This uses Gemmi's own Fourier routines; the proprietary CCP4 FFT executable is
not required or claimed to have been executed.
