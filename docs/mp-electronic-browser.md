# Materials Project electronic spectra → browser reference (P0)

## Source and scientific boundary

The Materials Project summary REST endpoint contains gap and structural summary fields, **not** full k-resolved bands or DOS arrays. The official Python mp-api client obtains actual electronic arrays using separate electronic-structure data access (including delta-table backed data in current versions). This integration never fabricates curves from summary band gaps.

The official Python client exports *actual MP-calculated* line-mode bands and total DOS into validated JSON, which the browser reads locally. **GitHub Pages cannot fetch raw electronic curves directly in this version.** A trusted backend would be needed for one-click live retrieval. Quantum ESPRESSO is not changed.

## Retrieve real MP data

Python 3.11+ and your own Materials Project API key are required.

```bash
python -m pip install mp-api
export MP_API_KEY='your-personal-key'
python tools/mp_electronic_export.py --mp-id mp-149 --output mp-149-electronic.json
```

Use --first-band 51 --band-count 80 to request a bounded band window. The exporter limits display to 300 bands per spin, 2,000 k samples, 120,000 points per spin, and 20,000 DOS energies. Unsupported or unavailable band/DOS sections are reported, not replaced by invented results. An 8 MB export limit applies.

1. Open **Kütüphane → Materials Project** and select **Bant/DOS JSON** for an MP record, or use the standalone import field.
2. Import the JSON exported by the official mp-api client; the Library shows MP bands and DOS as separate electronic plots with source material ID, optional task IDs and retrieval timestamp.
3. Open **DFT → Tarayıcı hesapları**. The same MP reference is displayed next to the independently computed graphene Tight-Binding curves; the plotted curves are **not** overlaid or numerically equated.
4. The export remains only in memory, not in localStorage or service worker. Refresh clears it. No API key is stored in the exported file or sent to the static application during export.

## Scientific interpretation

- Each MP band curve is displayed as E minus its own band Fermi energy. Each DOS trace uses E minus its own DOS Fermi energy. These zeros are *not* mutually aligned or matched to any QE/TB source.
- Spin-up and spin-down are displayed separately when supplied. DOS units refer to electronic states/(eV·cell).
- Line-mode bands default to Setyawan–Curtarolo k path. High-symmetry ticks are taken from actual exported sampled k positions.
- MP can have different band/DOS k meshes and tasks. The MP band gap from summary may differ from a DOS-derived or line-mode gap.
- The local graphene calculation is a two-band pz Tight-Binding model and not DFT; arbitrary C phases or differing k paths must not be interpreted as the same material. GANSU Lite is finite-molecule DFT and has no direct periodic spectrum comparison.
- Input JSON provenance is declared by the user/exporter. Schema validation cannot prove origin authenticity; retain the MP source page and task IDs and verify the reference independently.

## Validation

```bash
node --test tests/mp-electronic.test.mjs tests/materials-project.test.mjs
python -m py_compile tools/mp_electronic_export.py
```

These are format/algorithm tests. Live end-to-end acceptance requires a personal MP key and actual download for mp-149. No actual MP download is bundled in the repository.

## Official references

- https://github.com/materialsproject/public-docs/blob/main/downloading-data/using-the-api/examples.md
- https://materialsproject.github.io/api/_modules/mp_api/client/routes/materials/electronic_structure.html
- https://docs.materialsproject.org/methodology/materials-methodology/electronic-structure
