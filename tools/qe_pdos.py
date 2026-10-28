"""Strict QE projwfc.x collinear non-spin-polarized atom/orbital PDOS reader.

QE documentation: https://www.quantum-espresso.org/Doc/INPUT_PROJWFC.html
Expected filename: pdos.pdos_atm#N(X)_wfc#M(l)
Expected columns: E LDOS PDOS_m1 ... PDOS_m(2*l+1)
This module intentionally rejects spin-polarized, SOC, k-resolved and malformed data.
"""
from __future__ import annotations

from collections import defaultdict
import math
from pathlib import Path
import re

PATTERN = re.compile(
    r"^pdos\.pdos_atm#([1-9]\d*)\(([A-Z][a-z]?)\)_wfc#([1-9]\d*)\(([spdf])\)$"
)
L_COUNT = {"s": 1, "p": 3, "d": 5, "f": 7}
ORBITALS = ("s", "p", "d", "f")
MAX_FILES = 1500
MAX_ROWS = 15000
MAX_SAMPLES = 450_000
MAX_FILE_BYTES = 8_000_000
GRID_TOL_EV = 1e-4


def _numeric_rows(path: Path, expected: int):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("Missing, symlinked or oversized projected DOS: " + path.name)
    result = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) != expected:
            raise ValueError(
                f"{path.name}: expected {expected} non-spin PDOS columns, got {len(fields)}"
            )
        try:
            row = [float(v.replace("D", "E").replace("d", "e")) for v in fields]
        except ValueError as exc:
            raise ValueError(path.name + ": nonnumeric projected DOS") from exc
        if not all(math.isfinite(v) for v in row):
            raise ValueError(path.name + ": nonfinite projected DOS")
        if any(v < -1e-5 for v in row[1:]):
            raise ValueError(path.name + ": negative projected density")
        result.append(row)
        if len(result) > MAX_ROWS:
            raise ValueError(path.name + ": too many energy points")
    if len(result) < 2:
        raise ValueError(path.name + ": insufficient projected DOS rows")
    return result


def parse_atom_symbols(scf_source: str):
    """Obtain final positions/order from the SCF input, not just its species."""
    match = re.search(
        r"(?ims)^\s*ATOMIC_POSITIONS\s+crystal\s*\n(.*?)"
        r"^\s*K_POINTS\s+automatic\s*$", scf_source
    )
    if not match:
        raise ValueError("Expected final SCF fractional atomic positions")
    symbols = []
    for line in match.group(1).splitlines():
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) not in (4, 7) or not re.fullmatch(r"[A-Z][a-z]?", parts[0]):
            raise ValueError("Unrecognized SCF atom row")
        symbols.append(parts[0])
    if not (1 <= len(symbols) <= 1000):
        raise ValueError("Expected 1-1000 SCF atoms")
    return symbols


def parse_atom_orbital_pdos(
    workdir: Path, energy_ev: list[float], total_projection: list[float],
    atom_symbols: list[str]
):
    """Group all atomic wavefunctions by atom index and orbital angular momentum.

    Never extrapolate chemical bonding or quantum-emitter optical transitions
    from PDOS. Every band energy is still on the raw QE energy reference.
    """
    size = len(energy_ev)
    if not (2 <= size <= MAX_ROWS) or size != len(total_projection):
        raise ValueError("Incompatible reference DOS grid")
    if len(atom_symbols) > 1000 or not atom_symbols:
        raise ValueError("Invalid SCF atom list")
    if any(not math.isfinite(v) for v in energy_ev + total_projection):
        raise ValueError("Nonfinite DOS reference data")

    filelist = sorted(workdir.glob("pdos.pdos_atm#*"))
    if not filelist:
        raise ValueError("projwfc.x did not produce atom-resolved PDOS files")
    if len(filelist) > MAX_FILES or len(filelist) * size > MAX_SAMPLES:
        raise ValueError("Atom-resolved PDOS too large for bounded frontend export")
    unique = set()
    atom_data = {}
    element_data = {}
    provenance = []
    projection_sum = [0.0] * size

    def blank():
        return {"total": [0.0] * size, "orbitals": {}}

    for file in filelist:
        match = PATTERN.fullmatch(file.name)
        if not match:
            raise ValueError("Spin/SOC/k-resolved or unfamiliar PDOS filename: " + file.name)
        number, element, wfc, orbital = match.groups()
        idx, wfc_no = int(number), int(wfc)
        if idx > len(atom_symbols) or element != atom_symbols[idx - 1]:
            raise ValueError(file.name + ": atom index/element differs from final SCF structure")
        key = (idx, wfc_no)
        if key in unique:
            raise ValueError(file.name + ": duplicate atomic wfc index")
        unique.add(key)
        rows = _numeric_rows(file, 2 + L_COUNT[orbital])
        if len(rows) != size:
            raise ValueError(file.name + ": DOS energy-grid length mismatch")
        a = atom_data.setdefault(idx, blank())
        e = element_data.setdefault(element, blank())
        if idx not in atom_data:
            raise AssertionError("unreachable")

        # QE LDOS(E) is the sum of PDOS_m(E), not any one m channel.
        # Each atom/wfc contributes one LDOS curve. This prevents double-counting.
        for row_index, row in enumerate(rows):
            if abs(row[0] - energy_ev[row_index]) > GRID_TOL_EV:
                raise ValueError(file.name + ": DOS/PDOS energy axes mismatch")
            ldos = row[1]
            component_sum = sum(row[2:])
            # Explicit tolerance for printed-decimal truncation.
            if abs(ldos - component_sum) > 1e-3 + 1e-2 * max(abs(ldos), abs(component_sum)):
                raise ValueError(file.name + ": LDOS != sum of orbital m components")
            projection_sum[row_index] += ldos
            for group in (a, e):
                group["total"][row_index] += ldos
                orbital_curve = group["orbitals"].setdefault(orbital, [0.0] * size)
                orbital_curve[row_index] += ldos
        provenance.append({
            "filename": file.name, "atom_index": idx, "element": element,
            "wfc": wfc_no, "orbital": orbital
        })

    # The projection total in pdos.pdos_tot must agree with the sum over ALL
    # atomic-wfc LDOS curves. Fail closed if a file is missing/corrupted.
    deviations = [
        abs(actual - reference) for actual, reference
        in zip(projection_sum, total_projection)
    ]
    worst = max(deviations)
    largest = max([1.0] + [abs(x) for x in total_projection])
    if worst > 0.01 + 0.02 * largest:
        raise ValueError(
            f"Atom orbital PDOS does not reconcile with pdos.pdos_tot: max mismatch {worst:.5g}"
        )

    atoms = [
        {"atom_index": idx, "element": atom_symbols[idx - 1],
         "total_dos_states_per_ev": payload["total"],
         "orbitals": payload["orbitals"]}
        for idx, payload in sorted(atom_data.items())
    ]
    elements = [
        {"element": symbol, "total_dos_states_per_ev": payload["total"],
         "orbitals": payload["orbitals"]}
        for symbol, payload in sorted(element_data.items())
    ]
    return {
        "energy_ev": energy_ev,
        "atoms": atoms,
        "elements": elements,
        "source_files": provenance,
        "max_projection_reconciliation_error": worst,
        "spin_mode": "collinear-unpolarized",
        "units": "states/eV per simulation cell",
        "reference": "Raw QE electronic energies; no Fermi/vacuum alignment",
        "limitations": [
            "Projected DOS depends on atomic-wavefunction projections and UPF data.",
            "Atom/orbital-resolved DOS is not a direct proof of a localized optical emitter.",
            "Only non-spin-polarized collinear QE projwfc.x output is accepted."
        ]
    }
