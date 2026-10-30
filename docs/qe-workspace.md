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

## Calculation preparation and readiness

The **Hesap hazırlığı** page separates two explicit destinations:

- **Sunucuda hesapla:** choose **SCF**, **fixed-cell relaxation → SCF**, or **SCF → bands → DOS/PDOS** with a single server job-type selector. The server always uses its own approved UPF profile and supported occupation rules. Select the QE API endpoint and authentication in **Ayarlar**; local `.in` occupations, freeze-layer and pseudopotential file fields never change a server job.
- **QE .in dosyası oluştur:** choose the local `pw.x` calculation type and occupations, map local UPF filenames, optionally freeze a bottom layer, and download an input file without sending network requests or starting a job.

The shared cutoff/k-mesh fields apply to both destinations. Force tolerance is shown only for relaxation; the server's ionic step and energy-tolerance fields are shown only for server relaxation. Switching destinations never itself submits a job or discards form values. Evidence-backed protocols select the server destination automatically.

The Jobs tab unlocks only when the API reports an available QE solver, job submission enabled, a resource profile that permits execution, and a syntactically valid 32–256-character API key. A reachable but read-only/degraded/preparation-only server remains visible in settings and cannot unlock Jobs.

Preflight status has its own notice, separate from an active job's status. Changes to structure, connection, or job parameters mark an earlier preflight as stale; actual submissions still perform fresh server preflight and require explicit confirmation. A successful preflight is not physical convergence.

## Live job tracking

After explicit submission or opening a history item, Jobs can refresh the selected job every five seconds while that page and the browser tab are visible. The checkbox disables automatic reads. Completed, paused and terminal jobs stop the timer; resume or an explicit refresh updates the state. A single in-flight reader serializes manual and timer refreshes, and responses for a superseded job cannot publish results. Three failed reads stop automatic refresh with a manual recovery message; retry delays are 5/10/20 seconds. GET requests have a 15-second deadline. No mutation is automatically retried.

The stage list uses the canonical job operation and observed worker stage records. Stage counts are not a time estimate. Completed results are linked only after the result structure hash matches the selected job; the Results page includes the real total energy as well as relaxation or electronic plots. Paused jobs do not expose incomplete results. Operational progress does not grant scientific acceptance.

## Spectra and exports

Electronic results provide a display-only energy window. Bands and DOS can share the same vertical raw-energy range side by side; individual orbital plots use the same selected energy interval. Curves are clipped geometrically without shifting, interpolation, resampling or changing stored samples. The raw full range can be restored. The selected PDOS contribution survives redraws.

Band and DOS/PDOS CSV downloads include every loaded sample, original band indices, element/atom totals and orbitals, energy-reference text and input hash. A selected display window does not truncate CSV. A later explicitly bounded server band window is labelled by its original indices. SVG and PNG exports capture the displayed range and contain source/energy/input metadata; PNG uses a bounded local canvas. Exporting does not contact the API or modify the crystal.

## Result visualization UX (no new solver or scientific claims)

The electronic spectrum viewer now shows all ordinary Kohn–Sham band curves with the same stroke color, while DOS and projected DOS have distinct series colors. The source and unshifted QE energy reference remain prominently visible. The viewer does not estimate a Fermi level, vacuum reference, band gap, optical transition or emission spectrum.

A band-result payload **may optionally** contain `bands.k_path_nodes`, a list of `{label, distance}` objects matching `band_path_labels` in order and lying on the sampled `bands.distance` grid. Only verified explicit nodes produce vertical high-symmetry lines on the graph. Older `electronic-results.json` files still render normally: their ordered labels are shown as text, with **no guessed x-axis locations**. This is a read-only display extension; it does not infer values from counts or filenames or alter the producer schema. Multi-spin channels apply the same constraints per channel.

Relaxation comparison keeps the existing two synchronized 3D views and adds an opt-in overlay on the **final** view. Initial positions appear as faint gray points and true-scale minimum-image displacement segments appear in turquoise, without geometric exaggeration. Summary text reports maximum and mean atomic displacement in Å and the validated maximum force component. The atom table can be ordered by displacement while retaining original atom IDs. These are geometric diagnostics, not convergence extrapolation or physical trajectory reconstruction; the accepted final positions and source hashes are unchanged.

A browser regression uses a **synthetic** 5 Å periodic wrap case solely to test UI behavior; it does not constitute an additional real Quantum ESPRESSO calculation or acceptance result.

## Measured ionic-step traces (optional)
The completed D3 relax→SCF API result may include a `kristalyapi.qe-ionic-history.v1` object with the actual ionic `relax.out` stdout SHA-256 and a bounded ordered list of **paired** final-SCF ionic-step energy (Ry) and total force (Ry/Bohr). The parser omits the whole history if a step lacks either value. The JSON viewer cross-checks the stdout hash against existing artifact evidence and matches final ionic numbers to the accepted relax stage. Plots use separate axes/units and do not include the later independent final SCF energy or invent missing points. Legacy results without history render their original side-by-side geometry comparison.

## Evidence-backed protocol templates

Preparation includes **Si functional smoke** and **MoS₂ D4.1 finite band/mesh acceptance** templates. Both embed the exact recorded request, request-file SHA-256, source/evidence commits, engine version, structure hash and UPF identities. Si is only an operational test, and MoS₂ scope is limited to the fixed D3 geometry/PBE/scalar/unpolarized protocol; DOS broadening remains sensitivity only.

Selecting a template only displays its provenance. Applying settings preserves the current structure. Preparing a reference creates a separate workspace and keeps the exact reference cell vectors for submission, independent of display orientation. Neither action contacts the server, downloads UPFs or starts jobs. The UPF profile is still operator-managed.

Changing settings removes a template match. A matching request remains pending until explicit server preflight confirms the structure and exact UPF hashes. An unchanged selected template cannot be submitted with mismatched UPFs. The server address, credentials, workspace and request must remain unchanged while preflight is in progress. Matching a template is not acceptance of a new calculation's result.

## Job history and versioned calculation summary (D-UX P3)

The authenticated `GET /api/v1/calculations` endpoint now supports server-side
`limit` (1–50), `offset` (0–10000), `status`, `calculation` and
`q` (literal name/ID/profile/structure hash substring) filters and returns
`total` and `has_more` alongside the backward-compatible `jobs` list.
Only the configured operator token can access job data. The default unfiltered
response still includes the latest 20 items. Saved jobs retain their original
identifiers and request JSON during SQLite migration.

An authenticated `POST /api/v1/calculations/{id}/label` with a bounded
`{"label":"..."}` body updates a display name, not the scientific request,
its original hash or an execution parameter. Old unlabeled jobs remain
accessible. No token, job, name or evidence is saved in browser storage.

`GET /api/v1/calculations/{id}/summary` returns a read-only
`kristalyapi.calculation-summary.v1` object. The result includes immutable
input parameters and source hash, resource-profile SHA (when recorded), timestamps,
and **only if source identities and completion flags match** result energy,
force, QE version, UPF identifiers and artifact hashes. Missing or conflicting
evidence is explicitly flagged, not reconstructed or called a physical
convergence study. A job error or cancellation has no fabricated result.
This is an operator-local single-owner interface, **not** multi-user tenancy
or independent scientific evidence attestation.

The frontend offers filters, pagination, job naming, and a source-safe detail
panel with bounded JSON. These are read-only except for the explicit naming
action; they neither start computations nor replay jobs.
