# DFT workspace

Open **DFT** in the top navigation (`#dft`). The editor's DFT rail icon opens the same workspace. All routes work on GitHub Pages without server-side routing:

| Address | Contents |
| --- | --- |
| `#dft` or `#dft/hazirlik` | Active structure summary, explicit server connection check, UPF profile and electronic settings, input parameters and `.in` export |
| `#dft/isler` | Settings review, preflight, confirmed submission, refresh, pause/resume, cancellation, history and resource diagnostics |
| `#dft/sonuclar` | Server relaxation comparison and electronic plots; local `.out` and electronic JSON readers |
| `#dft/yakinsama` | D4.1 convergence/evidence viewer |
| `#dft/kusurlar` | MoS₂ defect comparison and protocol guidance |

Changing routes keeps the same mounted QE controls and result containers. Input values, selected files, plots, active job and memory-only token survive navigation to other pages and back in the same tab. Reloading the document clears these transient values as before. Navigation itself does not contact the compute server or start calculations. Refreshing a completed server job loads its results into the Results page. The original structure/hash checks, explicit submission confirmation and pause/resume conditions still apply.

The structure summary uses the same symmetry expansion and supercell preparation as the QE export. A rejected structure is shown as needing preparation. It is not an automatic server preflight or evidence of physical convergence. A selected relaxed structure for a subsequent electronic job is identified separately in the preparation and job settings. A displayed JSON file is not automatically matched to the active crystal.

The dedicated stylesheet is staged in the Pages artifact and cached with the versioned offline shell. Turkish/English labels, keyboard focus, browser back/forward, narrow screens, and the existing result readers are supported. Large D5 calculations remain a separate resource/protocol preparation task; opening this page never launches one.

Validation: `node --test tests/*.test.* tests/validation/test_runner.cjs`; real-browser regression `node tests/browser/dft-workspace.test.mjs` (pinned Playwright/Chromium in CI). The latter checks desktop/mobile bounds, route visibility, form/file/plot persistence, and absence of automatic API calls. Its committed real MoS₂ file is used only to test rendering, not as a new scientific acceptance run.

## Live job tracking

After explicit submission or opening a history item, Jobs can refresh the selected job every five seconds while that page and the browser tab are visible. The checkbox disables automatic reads. Completed, paused and terminal jobs stop the timer; resume or an explicit refresh updates the state. A single in-flight reader serializes manual and timer refreshes, and responses for a superseded job cannot publish results. Three failed reads stop automatic refresh with a manual recovery message; retry delays are 5/10/20 seconds. GET requests have a 15-second deadline. No mutation is automatically retried.

The stage list uses the canonical job operation and observed worker stage records. Stage counts are not a time estimate. Completed results are linked only after the result structure hash matches the selected job; the Results page includes the real total energy as well as relaxation or electronic plots. Paused jobs do not expose incomplete results. Operational progress does not grant scientific acceptance.

## Spectra and exports

Electronic results provide a display-only energy window. Bands and DOS can share the same vertical raw-energy range side by side; individual orbital plots use the same selected energy interval. Curves are clipped geometrically without shifting, interpolation, resampling or changing stored samples. The raw full range can be restored. The selected PDOS contribution survives redraws.

Band and DOS/PDOS CSV downloads include every loaded sample, original band indices, element/atom totals and orbitals, energy-reference text and input hash. A selected display window does not truncate CSV. A later explicitly bounded server band window is labelled by its original indices. SVG and PNG exports capture the displayed range and contain source/energy/input metadata; PNG uses a bounded local canvas. Exporting does not contact the API or modify the crystal.

## Evidence-backed protocol templates

Preparation includes **Si functional smoke** and **MoS₂ D4.1 finite band/mesh acceptance** templates. Both embed the exact recorded request, request-file SHA-256, source/evidence commits, engine version, structure hash and UPF identities. Si is only an operational test, and MoS₂ scope is limited to the fixed D3 geometry/PBE/scalar/unpolarized protocol; DOS broadening remains sensitivity only.

Selecting a template only displays its provenance. Applying settings preserves the current structure. Preparing a reference creates a separate workspace and keeps the exact reference cell vectors for submission, independent of display orientation. Neither action contacts the server, downloads UPFs or starts jobs. The UPF profile is still operator-managed.

Changing settings removes a template match. A matching request remains pending until explicit server preflight confirms the structure and exact UPF hashes. An unchanged selected template cannot be submitted with mismatched UPFs. The server address, credentials, workspace and request must remain unchanged while preflight is in progress. Matching a template is not acceptance of a new calculation's result.
