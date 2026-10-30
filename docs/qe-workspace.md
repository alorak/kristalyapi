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
