# Materials Project integration — Library P0/P1 starter

## Scope (2026-11-04)

The main navigation **Library → Materials Project Settings** accepts a personal
API key. **Library → Materials Project** searches formula (SrTiO3),
chemical system (Sr-Ti-O), or exact Materials Project ID (mp-149).

- **P0:** bounded summary search, computed gap/stability/density metadata,
  explicit import of a selected computed crystal into the active editor, and
  direct launch of its calculated powder diffraction page.
- **P1 starter:** compare up to four MP summary results: composition, space group,
  site count, computed band gap, direct/indirect classification, formation energy
  per atom, energy above hull and density.

Imported structures are encoded as **explicit P1 CIFs** through a strict adapter.
This is not a claim that the original symmetry setting and crystallographic
provenance of a deposited experimental CIF have been preserved. Lattice metric
and fractional positions are transferred; the imported source is marked computed.
Mixed/disordered sites, invalid lattices, >1000 sites or unsupported species are
rejected rather than approximated.

## Key handling

The personal key is a module-scoped JavaScript variable until page reload. The
password field is cleared after the user clicks Use in this page. Erase key clears
the key, results, selection and aborts requests. The key is **not** stored in
localStorage, sessionStorage, cookies, URLs, files, GitHub, logs or caches.
Requests use the fixed https://api.materialsproject.org/materials/summary/
endpoint with an X-API-KEY header; credentials are omitted, caching is disabled
and referrerPolicy is no-referrer. Responses are bounded and time out at 20 s.

Scripts sharing the same origin and browser extensions can still access a
browser page at runtime; browser memory does not equal server-side isolation.
Do not enter organization-wide or shared secrets.

Direct browser access depends on the Materials Project CORS policy. If blocked,
the UI reports an error. Do not place private keys into URLs or untrusted CORS
relays. A trusted proxy would require separate authorization and rate limits.

## Scientific limits

- Data are calculated Materials Project reference values, not experimental results.
- Different material IDs/polymorphs are not merged by formula.
- Formation energy and energy-above-hull depend on thermodynamic reference
  conventions and corrections; these do not prove synthesizability.
- Imported structures power the existing ideal powder XRD engine. They are not
  measured patterns, phase identification, calibration or Rietveld refinement.
- The P1 comparison is a summary-property comparison only, not yet real
  electronic band/DOS plots, a QE-vs-MP benchmark or phase diagrams.
- Unavailable numeric fields remain unavailable, not zero.
- Future research exports should retain MP-ID, retrieval date, task, method,
  and Materials Project source citations.

## API contract

GET /materials/summary/ with formula, chemical system or material ID, requested
fields and a hard cap of 20 records. A separate summary request with a structure
field is made only when a user explicitly chooses an import.

- https://docs.materialsproject.org/downloading-data/using-the-api/
- https://docs.materialsproject.org/downloading-data/using-the-api/querying-data
- https://api.materialsproject.org/openapi.json

## Local tests

Node: node --test tests/materials-project.test.mjs

Mocked Chromium: node tests/browser/materials-project.test.mjs

Mocked tests do not establish live access to the MP API; operator-owned credentials
and real browser CORS testing remain required for live acceptance.

## Next P1 milestones

1. Live Si/SrTiO3/Al2O3 browser/CORS acceptance with an operator-owned API key.
2. Source-aware real band/DOS import; explicit validated energy references, k
   paths, and task identity before any QE overlay.
3. Polymorph XRD overlay under consistent wavelength and profile assumptions.
4. QE-versus-MP benchmark gates covering method, structure, spin/SOC, k path,
   pseudopotential and numerical convergence.
