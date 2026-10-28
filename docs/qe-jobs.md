# D2 — Docker Quantum ESPRESSO SCF job API (experimental single-user)

This stage extends [D0–D1 discovery](qe-docker-api.md) to a **real, opt-in
Quantum ESPRESSO `pw.x` single-point SCF worker**. It is not an exposed
multi-user research cluster, and no scientifically converged Si/MoS₂
reference calculation has been demonstrated by the mock tests.

## 1. Trust model and prerequisites

- Trusted personal Linux VM; **bind to 127.0.0.1** unless behind a private
  HTTPS proxy. Do not port-forward to the public internet.
- A long random token; one owner, one API container, one worker. Token
  authenticates all job operations; CORS alone does not authenticate anything.
- Real pseudopotential **UPF** files you obtained lawfully and verified for
  physical suitability, source, licensing and XC compatibility. The server
  checks declared metadata and SHA-256, but does **not** independently
  certify that a UPF is correct for a given element/function.
- Supported prototype: 3D periodic explicit P1 cell (2D models use a
  sufficiently large explicit vacuum), 1–64 atoms, elements
  H/C/N/O/Si/S/Mo, PBE, no spin, occupations='fixed', single-point SCF.
  **Do not use this to infer spin state of charged/open-shell MoS₂ vacancies.**

## 2. Host directories and verified UPF profile

```text
kristalyapi/
  qe-local/
    profiles/
      si-pbe.json
    pseudos/
      Si.UPF
  compose.qe.yml
```

A `qe-local/` folder is intentionally **not checked into source control**.
The following manifest has placeholders, **not usable pseudopotentials**:

```json
{
  "schema": "kristalyapi.upf-profile.v1",
  "id": "si-pbe",
  "functional": "PBE",
  "elements": {
    "Si": {
      "file": "Si.UPF",
      "sha256": "REPLACE_WITH_ACTUAL_64_HEX_SHA256",
      "source": "REPLACE_WITH_DATASET_URL_AND_VERSION",
      "license": "REPLACE_WITH_ACTUAL_UPF_LICENSE",
      "functional": "PBE"
    }
  }
}
```

Replace these fields using the real dataset metadata. Compute hash:

```bash
sha256sum qe-local/pseudos/Si.UPF
```

A MoS₂ job needs another distinct profile with actual Mo and S UPFs.
The browser never uploads arbitrary UPF bytes, paths, executable names,
shell commands or raw QE namelists.

## 3. Enable authenticated compute explicitly

```bash
python3 -c "import secrets;print(secrets.token_urlsafe(32))"
```

Create `.env` in the root directory (set mode 0600). Do not commit it:

```text
QE_JOBS_ENABLED=1
QE_API_TOKEN=REPLACE_WITH_RANDOM_TOKEN_FROM_ABOVE
QE_API_BIND_IP=127.0.0.1
QE_ALLOWED_HOSTS=localhost,127.0.0.1
```

```bash
chmod 600 .env
docker compose -f compose.qe.yml --profile compute up -d --build
curl -s http://127.0.0.1:8000/api/capabilities
```

The worker shares a persistent named Docker volume `qe-state` with
SQLite and work files. Host UPFs/profiles are mounted **read-only**.
The worker runs under a non-root user, with Docker CPU/RAM/process limits,
individual job timeouts and one queued worker. The API does not perform
computations in HTTP request handlers. **Removing the volume destroys
the job history and scientific outputs**; use a documented backup policy.

The D0/D1 default remains safe: without `QE_JOBS_ENABLED=1`, the
service exposes only its discovery endpoints.

## 4. Browser interface and API

KristalYapı → DFT → set API address, choose **SCF** (not relax),
select fixed occupation, provide your server's UPF profile ID, enter the
token and select **Aktif yapıyı ön kontrol et**. Press
**Gerçek SCF işini gönder** and confirm the calculation. You can
refresh status or request cancellation. Token is not written to
localStorage or the crystal project file.

**Security:** Authenticated browser requests are rejected for
`http://192.168.x.x` and other non-loopback HTTP addresses. Use
`http://localhost:8000` on the same computer or a configured
HTTPS reverse proxy on the LAN. A proxy must forward the real scheme
through a **trusted** proxy setting; otherwise the API refuses jobs.
Your browser may still require Local Network Access permission.
For a reverse proxy that terminates HTTPS, set `QE_TRUSTED_PROXY_IPS` to
**only** the proxy IP as seen by Uvicorn. Do not set it to `*`; untrusted
`X-Forwarded-Proto` headers must not bypass the HTTP token restriction.
The proxy must forward HTTPS scheme and be separately secured.

| Operation | API |
| --- | --- |
| Discover solver | `GET /api/health`, `GET /api/capabilities` |
| List available engine | `GET /api/v1/engines` |
| Validate against UPF profile | `POST /api/v1/calculations/validate` |
| Queue SCF, return job ID | `POST /api/v1/calculations` (202) |
| List recent jobs | `GET /api/v1/calculations` |
| Job status | `GET /api/v1/calculations/{id}` |
| Converged result only | `GET /api/v1/calculations/{id}/results` |
| Capped raw `pw.x` log tail | `GET /api/v1/calculations/{id}/logs` |
| Cancel queued/running job | `POST /api/v1/calculations/{id}/cancel` |

Every job API endpoint requires
`Authorization: Bearer <QE_API_TOKEN>`. The v1 SCF JSON schema carries
explicit `cell_angstrom`, `atoms` (element/fractional position),
`periodic:true`, selected `profile_id`, numerical `ecutwfc_ry`,
`ecutrho_ry`, and integer `kpoints`. Unsupported fields or
spin/metal/smearing jobs fail validation.

## 5. Durability, safety and limitations

- Jobs are persisted in SQLite. One worker claims jobs atomically;
  previously running jobs are classified as **failed after restart**,
  never incorrectly resumed or called completed.
- Queued jobs can be cancelled immediately. Running jobs are killed
  by the worker's process-group shutdown after it notices the request.
- The queue caps pending/running jobs at 10. One CPU worker is the
  intended deployment; multiple workers, multi-user authorization,
  project quotas, retry and retention policies are **not yet delivered**.
- Results are only `completed` when real `pw.x` returns successfully
  and output includes `JOB DONE`, SCF convergence and total energy.
  A result is not a numerical cutoff/k-mesh/vacuum convergence study.
- Energy is stored both Ry and eV with input/output/UPF hashes.
  Results are explicitly linked to a source structure hash; they
  are **not applied** to a different active crystal.
- This stage has no bands/PDOS job submission, relaxation, GPU/HPC
  scheduler, many-body/optical processing or ML training.
  Existing offline file import, band and PDOS visualizers remain intact.

## 6. Tests and staged acceptance

```bash
python3 -m pip install fastapi==0.115.11 httpx==0.28.1
python3 -m unittest discover -s tests -p test_qe_api.py -v
python3 -m unittest discover -s tests -p test_qe_jobs.py -v
node --test tests/qe-api-client.test.mjs
docker compose -f compose.qe.yml config --quiet
```

The unit tests use **fake UPF metadata and an intentionally synthetic
`pw.x` executable**. They test queue/auth/parser behavior, not the
scientific validity of energy values.

For scientific acceptance, separately use real UPF files and run Si
SCF on the installed Docker image, then an independently checked
MoS₂ SCF and (later) relaxation with sensitivity studies. Preserve the
UPF source/licenses, hashes, QE version, full settings and logs.

**After D2:** scientific PBE reference validation, relaxation and
bands/DOS/PDOS job workflow, rigorous convergence reporting, local
site/atom matching, multi-user controls, AiiDA/Kubernetes and
only subsequently calibrated ML surrogate models.
