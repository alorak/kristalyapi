# Operator resource profiles and HPC preparation

Default API limits remain **64 atoms, 128 bands, 24×24 NSCF mesh and two threads**. An HTTP request cannot select a resource file or override budgets. Operators may configure `QE_RESOURCE_PROFILE_FILE` to a regular JSON file, mounted at the same path in API and worker. This resource profile is separate from the UPF profile selected by `profile_id`.

The example `tests/fixtures/qe/hpc-resource-profile.json` allows 128 atoms/512 bands with eight threads, a 128 GiB capacity minimum, 64 GiB free scratch minimum and a four-hour upper wall-time bound. **Execution is disabled.** These are preparation budgets, not measured D5 requirements or a sufficiency guarantee. The prior QE 71.76–80.49 GB printed figures were estimates, and a 6 GiB initialization pilot failed; no successful large-cell SCF follows from this profile.

The API advertises configured limits and the canonical profile SHA-256. Each queued job pins that digest. Before starting QE, the worker rejects changed profiles, preparation-only configurations or insufficient observed physical/cgroup RAM, free scratch, CPU affinity or inherited CPU quota. Custom admission checks include ancestor cgroup limits, which can matter for nested scheduler steps. Existing unpinned jobs are accepted only under the unchanged default policy. The worker clamps wall time and uses the configured threads. These checks cannot predict the actual memory consumption of a full SCF calculation.

Large electronic requests require an explicit DOS window and, above 300 computed bands, a one-based `electronic.band_window` selecting at most 300 plotted bands. All bands are computed and the complete GNU file is retained. Result metadata and CSV identify original band indices; the view does not imply that omitted bands were absent. Atom/energy, path-band and UPF atomic-wavefunction sample budgets are checked before execution. The same UPF hashes are rechecked in worker preflight.

## Portable initialization package

The native tools require Python 3.11+, GNU time, Slurm and the pinned QE executable.

This command verifies the existing D5 preparation and exports four fixed candidates with audited source copies, input/source/UPF hashes, license metadata, an execution-disabled resource profile and Slurm initialization scripts:

```sh
python tools/qe_hpc_prepare.py \
  --preparation validation-results/qe-mos2-d5-preparation-20261029 \
  --resource-profile tests/fixtures/qe/hpc-resource-profile.json \
  --output /tmp/qe-hpc-package
python /tmp/qe-hpc-package/tools/qe_hpc_init.py --bundle /tmp/qe-hpc-package --inspect
```

Export and inspection never call `sbatch`, start QE or download UPFs. Modified/uncommitted source exports are marked dirty and cannot execute initialization. Output folders must be new. Package file hashes and symlinks are checked on inspection.

When an appropriate Linux/Slurm environment is available, an operator can copy the reviewed UPFs into `pseudo/`, inspect the package, and **from the package root** explicitly request an initialization:

```sh
cd /tmp/qe-hpc-package
QE_HPC_INITIALIZATION=1 sbatch cases/pristine/init.slurm
```

The generated script uses `SLURM_SUBMIT_DIR`, because Slurm transfers the script rather than the surrounding package. Paths are quoted and resource directives are validated numeric values. It requests one task with the configured OpenMP threads; initialization is bounded to at most ten minutes. See the [Slurm sbatch reference](https://slurm.schedmd.com/sbatch.html).

The native runner additionally requires Linux, an active Slurm allocation, committed sources, the pinned QE version, matching UPFs and observed capacity. It runs only `nstep=0`, retains raw stdout/stderr, GNU time MaxRSS in KiB and a cgroup OOM counter delta, and rejects output that began SCF/energy iteration. Timeout/failure terminates its process group. Initialization evidence is **not** full SCF memory/time or physical convergence acceptance. The full D5 comparison protocol, including dense electronic meshes and any spin treatment, must be frozen separately before production calculations.
