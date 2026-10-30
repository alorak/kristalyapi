#!/usr/bin/env python3
"""Reproducible local Quantum ESPRESSO electronic workflow (no web service).

A conservative pipeline: relax(optional) -> scf -> bands/bands.x(optional) ->
nscf -> dos.x/projwfc.x(optional). All PW steps share ONE outdir and prefix.
No default band path is inferred for an arbitrary CIF.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

from qe_run import parse_pw_input, stage, sha256_file, summarize_output
from qe_pdos import parse_atom_orbital_pdos, parse_atom_symbols, exact_energy_window
# Local CLI sources keep the pure validator in server/; the Docker image
# places these modules together in /app. No request-controlled import paths.
if (Path(__file__).resolve().parents[1]/'server').is_dir():
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from qe_post_settings import canonical_dos_settings
import qe_checkpoint as checkpoint
import qe_run,qe_pdos,qe_post_settings

NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?"
STEPS = ("relax", "scf", "bands", "bands_pp", "bands_pp_up", "bands_pp_down", "nscf", "dos", "projwfc")
MAX_TEXT = 8_000_000


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def output_text(path):
    if path.stat().st_size > MAX_TEXT:
        raise ValueError("Text output exceeds 8 MB inspection limit: " + path.name)
    return path.read_text(encoding="utf-8", errors="replace")


def load_band_path(path):
    """ASCII: label kx ky kz number_of_segments_to_next (last weight 1)."""
    if path is None:
        return None
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 10000:
        raise ValueError("Band path must be a regular text file <= 10 KB")
    points = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 5 or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,15}", parts[0]):
            raise ValueError("Band path rows must be: LABEL kx ky kz N")
        try:
            k = [float(x) for x in parts[1:4]]
            n = int(parts[4])
        except ValueError as exc:
            raise ValueError("Invalid band path point") from exc
        if not all(math.isfinite(v) and abs(v) <= 2 for v in k) or not (1 <= n <= 500):
            raise ValueError("Band path coordinate/segment limit exceeded")
        points.append((parts[0], k, n))
    if not (2 <= len(points) <= 32):
        raise ValueError("Band path must have 2-32 reference points")
    if points[-1][2] != 1:
        raise ValueError("Last band-path weight must be 1")
    return points


def change_calculation(original, name):
    if name not in ("scf", "bands", "nscf"):
        raise ValueError("Unsupported calculation type")
    updated, count = re.subn(
        r"(?im)^(\s*calculation\s*=\s*)['\"](?:relax|scf)['\"]",
        lambda match: match.group(1) + "'" + name + "'",
        original, count=1)
    if count != 1:
        raise ValueError("Input calculation declaration not found")
    # QE ignores &IONS for scf, but explicitly remove it for reproducibility.
    updated = re.sub(r"(?ims)^\s*&IONS\b.*?^\s*/\s*\n?", "\n", updated)
    return updated


def use_relaxed_positions(source, relax_output, nat):
    """Accept fixed-cell QE relaxation with fractional output only."""
    matches = list(re.finditer(
        r"(?is)Begin final coordinates(.*?)End final coordinates", relax_output))
    if not matches:
        raise ValueError("Completed relaxation missing final coordinates")
    block = matches[-1].group(1)
    if re.search(r"(?im)^\s*CELL_PARAMETERS\b", block):
        raise ValueError("Variable-cell relaxation is not supported")
    section = re.search(
        r"(?ims)^\s*ATOMIC_POSITIONS\s+\(?crystal\)?\s*\n(.*)$", block)
    if not section:
        raise ValueError("Only QE fractional final coordinates are supported")
    original = re.search(
        r"(?ims)^ATOMIC_POSITIONS\s+crystal\s*\n(.*?)^K_POINTS\s+automatic\s*$", source)
    if original is None:
        raise ValueError("Expected frontend fractional positions")
    before = [row.split()[0] for row in original.group(1).splitlines() if row.strip()]
    rows = []
    for line in section.group(1).splitlines():
        fields = line.split()
        if len(fields) < 4:
            break
        if not re.fullmatch(r"[A-Z][a-z]?", fields[0]):
            break
        try:
            xyz = [float(part.replace("D", "E")) for part in fields[1:4]]
        except ValueError as exc:
            raise ValueError("Invalid final atom coordinates") from exc
        if any(not math.isfinite(n) for n in xyz):
            raise ValueError("Nonfinite final coordinate")
        rows.append((fields[0], xyz))
    if len(rows) != nat or [s for s, _ in rows] != before:
        raise ValueError("Relaxed atom count/order differs from source; refusing to chain")
    positions = "\n".join(
        " ".join([symbol] + [f"{x % 1:.12f}" for x in xyz])
        for symbol, xyz in rows)
    return source[:original.start()] + "ATOMIC_POSITIONS crystal\n" + positions + "\nK_POINTS automatic\n" + source[original.end():].lstrip("\r\n")


def insert_nbnd(source, nbnd):
    if nbnd is None or not (1 <= nbnd <= 10000):
        raise ValueError("1 <= nbnd <= 10000 required for electronic steps")
    if re.search(r"(?i)\bnbnd\s*=", source):
        raise ValueError("Source must not already define nbnd")
    updated, n = re.subn(
        r"(?im)^(\s*ntyp\s*=\s*\d+\s*,?\s*)$",
        lambda m: m.group(1) + "\n nbnd = " + str(nbnd) + ",",
        source, count=1)
    if n != 1:
        raise ValueError("Unable to add nbnd to &SYSTEM")
    return updated


def replace_kpoints(source, card):
    updated, n = re.subn(
        r"(?ims)^K_POINTS\s+automatic\s*\n\s*\d+\s+\d+\s+\d+\s+[01]\s+[01]\s+[01]\s*$",
        lambda _: card.rstrip() + "\n",
        source, count=1)
    if n != 1:
        raise ValueError("Expected exactly one automatic k-point card")
    return updated


def bands_input(scf_source, points, nbnd):
    source = insert_nbnd(change_calculation(scf_source, "bands"), nbnd)
    card = "K_POINTS crystal_b\n" + str(len(points)) + "\n"
    card += "\n".join(
        " ".join([*(f"{v:.10f}" for v in k), str(weight)]) + " ! " + name
        for name, k, weight in points) + "\n"
    return replace_kpoints(source, card)


def nscf_input(scf_source, nbnd, kmesh):
    if not (2 <= kmesh <= 48):
        raise ValueError("NSCF k mesh must be 2-48")
    source = insert_nbnd(change_calculation(scf_source, "nscf"), nbnd)
    source = replace_kpoints(source, "K_POINTS automatic\n"
                             + f"{kmesh} {kmesh} 1 0 0 0")
    return source


def post_input(kind, dos_settings=None):
    if kind in ('bands_pp_up','bands_pp_down'):
        channel=1 if kind.endswith('_up') else 2
        return post_input('bands_pp').replace("filband='bands.dat'",f"filband='bands_{'up' if channel==1 else 'down'}.dat'").replace(" lsym=",f" spin_component={channel},\n lsym=")
    if kind == "bands_pp":
        return "&BANDS\n prefix='kristalyapi',\n outdir='./tmp',\n filband='bands.dat',\n lsym=.false.,\n/\n"
    if dos_settings is not None:
        p=canonical_dos_settings(dos_settings)
        if kind not in ('dos','projwfc'):raise ValueError('Unknown postprocessor')
        header="&DOS" if kind=='dos' else "&PROJWFC"
        filename=" fildos='dos.dat',\n" if kind=='dos' else " filpdos='pdos',\n"
        return (header+"\n prefix='kristalyapi',\n outdir='./tmp',\n"+filename+
                f" DeltaE={p['delta_e_ev']:.12g},\n ngauss=0,\n degauss={p['degauss_ry']:.12g},\n"+
                f" Emin={p['energy_min_ev']:.12g},\n Emax={p['energy_max_ev']:.12g},\n/\n")
    if kind == "dos":
        return ("&DOS\n prefix='kristalyapi',\n outdir='./tmp',\n fildos='dos.dat',\n"
                " DeltaE=0.02,\n degauss=0.01,\n/\n")
    if kind == "projwfc":
        return ("&PROJWFC\n prefix='kristalyapi',\n outdir='./tmp',\n filpdos='pdos',\n"
                " DeltaE=0.02,\n degauss=0.01,\n/\n")
    raise ValueError("Unknown postprocessor")


def read_numeric_columns(path, mincols, maxrows=30000):
    if not path.is_file() or path.stat().st_size > 8_000_000:
        raise ValueError("Required output missing/oversized: " + path.name)
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        values = line.split()
        if len(values) < mincols:
            raise ValueError("Short numeric row in " + path.name)
        try:
            nums = [float(v.replace("D", "E")) for v in values]
        except ValueError as exc:
            raise ValueError("Bad numeric row in " + path.name) from exc
        if not all(math.isfinite(v) for v in nums):
            raise ValueError("Nonfinite numeric data in " + path.name)
        rows.append(nums)
        if len(rows) > maxrows:
            raise ValueError("Result exceeds point limit")
    if len(rows) < 2:
        raise ValueError("At least two numeric rows required: " + path.name)
    return rows


def parse_bands_gnu(path,band_window=None):
    if not path.is_file() or path.stat().st_size > 8_000_000:
        raise ValueError("Missing/oversized bands.dat.gnu")
    blocks, block = [], []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            if block:
                blocks.append(block)
                block = []
            continue
        if line.lstrip().startswith("#"):
            continue
        fields = line.split()
        if len(fields) != 2:
            raise ValueError("Expected k-distance and band energy")
        try:
            pair = [float(v.replace("D", "E")) for v in fields]
        except ValueError as exc:
            raise ValueError("Non-numeric band data") from exc
        if not all(math.isfinite(v) for v in pair):
            raise ValueError("Nonfinite band data")
        block.append(pair)
    if block:
        blocks.append(block)
    if not blocks or len(blocks[0]) < 2 or len(blocks) > 10000:
        raise ValueError("No usable bands")
    distance = [row[0] for row in blocks[0]]
    if len(distance) > 30000 or any(a > b for a, b in zip(distance, distance[1:])):
        raise ValueError("Invalid band k-distance grid")
    for block in blocks:
        if len(block) != len(distance) or any(abs(row[0] - x) > 1e-5 for row, x in zip(block, distance)):
            raise ValueError("Inconsistent band k-distance")
    count=len(blocks);metadata={}
    if band_window is not None:
        first,last=band_window
        if any(type(v) is not int for v in band_window) or not 1<=first<=last<=count or last-first+1>300:
            raise ValueError('Invalid one-based band display window')
        blocks=blocks[first-1:last];metadata={'band_index_start':first,'total_bands':count}
    return {"distance": distance, "energies_ev": [[row[1] for row in block] for block in blocks],
            "reference": "raw QE eigenvalue energy zero (not vacuum/experimental PL)",**metadata}


def checked_k_path_nodes(source, points, distance):
    """Map user-provided crystal_b nodes onto *sampled* bands.x x coordinates.

    Fail closed: QE point count and fractional reciprocal-space segment-length
    ratios must agree with the lattice geometry and the crystal_b weights.
    Labels are supplied by the operator and are not symmetry classifications.
    """
    if not points or not distance:
        return None
    weights = [n for _, _, n in points[:-1]]
    if len(distance) != sum(weights) + 1 or points[-1][2] != 1:
        return None
    match = re.search(r"(?im)^\s*CELL_PARAMETERS\s+(?:\{)?angstrom(?:\})?\s*$", source)
    if match is None:
        return None
    rows = source[match.end():].lstrip("\r\n").splitlines()[:3]
    if len(rows) != 3:
        return None
    try:
        cell = [[float(x.replace('D', 'E').replace('d', 'e')) for x in line.split()] for line in rows]
    except ValueError:
        return None
    if any(len(row) != 3 or any(not math.isfinite(x) for x in row) for row in cell):
        return None
    a, b, c = cell
    cross = lambda u, v: [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    dot = lambda u, v: sum(x*y for x, y in zip(u, v))
    volume = dot(a, cross(b, c))
    if not math.isfinite(volume) or abs(volume) < 1e-8:
        return None
    reciprocal = [[v / volume for v in cross(u, w)] for u, w in ((b, c), (c, a), (a, b))]
    mapped = [[sum(k[i]*reciprocal[i][j] for i in range(3)) for j in range(3)]
              for _, k, _ in points]
    lengths = [math.dist(left, right) for left, right in zip(mapped, mapped[1:])]
    expected = sum(lengths)
    actual = distance[-1]-distance[0]
    if not all(math.isfinite(x) and x > 1e-9 for x in lengths) or expected <= 0 or actual <= 0:
        return None
    indices = [0]
    for n in weights:
        indices.append(indices[-1]+n)
    scale = actual / expected
    tolerance = max(1e-4, actual*0.002)
    nodes = []
    for i, (label, _, _) in enumerate(points):
        index = indices[i]
        value = distance[index]
        if i:
            predicted = distance[0] + scale*sum(lengths[:i])
            if abs(value-predicted) > tolerance or value <= nodes[-1]["distance"]:
                return None
            start, count = indices[i-1], weights[i-1]
            for step in range(count+1):
                expected_x = distance[start]+(value-distance[start])*step/count
                if abs(distance[start+step]-expected_x)>tolerance:
                    return None
        nodes.append({"label": label, "distance": value})
    return nodes


def parse_dos(path):
    rows = read_numeric_columns(path, 3)
    if any(len(row) != 3 for row in rows):
        raise ValueError("Spin-polarized/noncollinear DOS columns unsupported")
    energy = [r[0] for r in rows]
    if any(a >= b for a, b in zip(energy, energy[1:])):
        raise ValueError("DOS energy grid must strictly increase")
    return {"energy_ev": energy, "dos_states_per_ev": [r[1] for r in rows],
            "integrated_states": [r[2] for r in rows],
            "reference": "raw QE eigenvalue energy zero"}


def parse_pdos_total(path, dos):
    rows = read_numeric_columns(path, 3)
    if any(len(row) != 3 for row in rows):
        raise ValueError("Spin-polarized/noncollinear PDOS columns unsupported")
    energies = dos["energy_ev"]
    source_points = len(rows)
    rows = exact_energy_window(rows, energies, "DOS and projected DOS energy axes mismatch")
    return {"energy_ev": energies, "total_dos_states_per_ev": [r[1] for r in rows],
            "sum_projected_states_per_ev": [r[2] for r in rows],
            "grid_selection": {"policy":"exact DOS window; no interpolation or energy shift",
                               "source_points":source_points,"selected_points":len(rows),
                               "discarded_outside_window":source_points-len(rows)}}


def run_pipeline(input_file, pseudo_dir, workdir, *, execute=False, pw="pw.x",
                 bands_x="bands.x", dos_x="dos.x", projwfc_x="projwfc.x",
                 band_path=None, nbnd=None, nscf_k=12, pdos=False, timeout=14400,dos_settings=None,pause_file=None,resume=False,expected_checkpoint_sha=None,band_window=None,spin_polarized=False):
    if (resume or pause_file is not None) and not execute:
        raise ValueError("Checkpoint pause/resume requires actual execution")
    if dos_settings is not None:
        dos_settings=canonical_dos_settings(dos_settings)
        if not pdos:raise ValueError('DOS settings require the DOS/PDOS pipeline')
    path = load_band_path(band_path)
    if band_window is not None and (not path or not isinstance(band_window,(list,tuple)) or len(band_window)!=2 or
            any(type(x) is not int for x in band_window) or nbnd is None or not 1<=band_window[0]<=band_window[1]<=nbnd or band_window[1]-band_window[0]+1>300):
        raise ValueError('Band window requires 1-300 existing one-based path bands')
    if band_window is not None:band_window=list(band_window)
    if not (1 <= timeout <= 604800):
        raise ValueError("Timeout must be 1 second to 7 days")
    if (path or pdos) and nbnd is None:
        raise ValueError("--nbnd required for electronic bands/DOS")
    if not (2 <= nscf_k <= 48):
        raise ValueError("Invalid dense k-point mesh")
    commands = {"relax": pw, "scf": pw, "bands": pw, "nscf": pw,
                "bands_pp": bands_x, "bands_pp_up":bands_x,"bands_pp_down":bands_x,"dos": dos_x, "projwfc": projwfc_x}
    needed = {"scf"}
    if path:
        needed.update({"bands", "bands_pp_up", "bands_pp_down"} if spin_polarized else {"bands", "bands_pp"})
    if pdos:
        needed.update({"nscf", "dos", "projwfc"})
    source = input_file.read_text(encoding="utf-8")
    model = parse_pw_input(source)
    from qe_spin import validate_spin_input
    validate_spin_input(source,spin_polarized)
    if spin_polarized and (not path or not pdos or dos_settings is None or model['calculation']!='scf'):
        raise ValueError('Collinear spin requires SCF, band path and explicit DOS/PDOS settings')
    if model["calculation"] == "relax":
        needed.add("relax")
    if execute:
        for step in needed:
            if not shutil.which(commands[step]):
                raise ValueError("Executable not available for " + step + ": " + commands[step])
    identity=None
    if pause_file is not None or resume:
        identity=checkpoint.contract(input_file,pseudo_dir,model,
            {'nbnd':nbnd,'nscf_k':nscf_k,'dos_settings':dos_settings,'pdos':pdos,
             'band_path':band_path.read_text() if band_path else None,'band_window':band_window,**({'spin_polarized':True} if spin_polarized else {})},
            {name:shutil.which(commands[name]) for name in needed},
            [Path(__file__),Path(checkpoint.__file__),Path(qe_run.__file__),Path(qe_pdos.__file__),Path(qe_post_settings.__file__),*([Path(__file__).with_name('qe_spin.py')] if spin_polarized else [])])
    result = checkpoint.load(workdir,identity,expected_checkpoint_sha) if resume else stage(input_file, pseudo_dir, workdir)
    if not resume:result["steps"]={}
    if spin_polarized:result['spin_mode']='collinear-polarized'
    result["schema"] = "kristalyapi.qe-pipeline.v1"
    result["requested"] = list(step for step in STEPS if step in needed)
    result["band_path"] = [name for name, _, _ in path] if path else None
    if dos_settings is not None:result['dos_settings']=dos_settings
    result["notes"].append("Raw QE eigenvalue energy zeros are NOT experimental emission energies.")
    if not execute:
        result["notes"].append("Prepare-only geometry is provisional: subsequent inputs cannot yet incorporate relaxed positions.")
    result["status"] = "prepared"
    manifest = workdir / "pipeline.json"

    def persist():
        result["updated_at"] = timestamp()
        manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        active=next(reversed(result["steps"]),None)
        (workdir/"progress.json").write_text(json.dumps({"status":result["status"],"active_stage":active})+"\n",encoding="utf-8")

    def step_run(name, content, *, post=False):
        previous=result['steps'].get(name)
        if resume and previous and previous['status']=='completed':
            if previous['input_sha256']!=hashlib.sha256(content.encode()).hexdigest() or previous['stdout_sha256']!=sha256_file(workdir/(name+'.out')):
                raise ValueError('Completed checkpoint stage does not match requested input/output: '+name)
            return output_text(workdir/(name+'.out'))
        if execute and pause_file is not None and pause_file.exists():
            result['status']='paused';persist();checkpoint.save(workdir,identity,result)
            raise checkpoint.Paused()
        infile = workdir / (name + ".in")
        outfile = workdir / (name + ".out")
        infile.write_text(content, encoding="utf-8")
        entry = {"status": "prepared", "input": infile.name, "input_sha256": sha256_file(infile)}
        result["steps"][name] = entry
        persist()
        if not execute:
            return None
        entry["status"] = "running"
        entry["started_at"] = timestamp()
        persist()
        began = time.monotonic()
        try:
            with infile.open("rb") as inp, outfile.open("wb") as out, \
                    (workdir / (name + ".stderr.txt")).open("wb") as err:
                proc = subprocess.run([str(shutil.which(commands[name])), "-in", infile.name],
                                      cwd=workdir, stdin=inp, stdout=out, stderr=err,
                                      timeout=timeout, check=False)
            txt = output_text(outfile)
            done = proc.returncode == 0 and not re.search(r"Error in routine|%%%%", txt, re.I)
            if post:
                success = done
                entry.update({"status": "completed" if success else "failed",
                              "returncode": proc.returncode, "stdout": outfile.name})
            elif name in ("relax", "scf"):
                summary = summarize_output(txt, name, proc.returncode)
                success = summary["status"] == "completed"
                entry.update(summary)
            else:
                success = done and bool(re.search(r"\bJOB\s+DONE\.", txt, re.I))
                entry.update({"status": "completed" if success else "failed",
                              "returncode": proc.returncode, "job_done": success})
            entry["stdout_sha256"] = sha256_file(outfile)
        except subprocess.TimeoutExpired:
            success = False
            entry["status"] = "timeout"
        except (OSError, ValueError) as exc:
            success = False
            entry["status"] = "error"
            entry["error"] = str(exc)
        entry["finished_at"] = timestamp()
        entry["duration_seconds"] = round(time.monotonic() - began, 3)
        persist()
        if not success:
            raise RuntimeError(name + " failed; later calculations were not run")
        return txt

    try:
        working = source
        if "relax" in needed:
            relax_output = step_run("relax", source)
            if execute:
                working = use_relaxed_positions(source, relax_output, model["nat"])
        scf_source = change_calculation(working, "scf") if model["calculation"] == "relax" else working
        scf_output = step_run("scf", insert_nbnd(scf_source,nbnd) if spin_polarized else scf_source)
        if execute:
            if not (workdir / "tmp" / "kristalyapi.save").is_dir():
                raise RuntimeError("SCF did not preserve shared tmp/kristalyapi.save data")
        if path:
            band_text = bands_input(scf_source, path, nbnd)
            step_run("bands", band_text)
            if spin_polarized:
                for channel in ('up','down'):step_run('bands_pp_'+channel,post_input('bands_pp_'+channel),post=True)
            else:step_run("bands_pp", post_input("bands_pp"), post=True)
            if execute:
                if spin_polarized:result['spin_bands']={c:parse_bands_gnu(workdir/('bands_'+c+'.dat.gnu'),band_window) for c in ('up','down')}
                else:result["bands"] = parse_bands_gnu(workdir / "bands.dat.gnu",band_window)
                # Only use the actual bands.x sampled distance grid; reject
                # inferred symmetry ticks when the geometry/count fails.
                candidates = result['spin_bands'].values() if spin_polarized else [result['bands']]
                for bands in candidates:
                    nodes = checked_k_path_nodes(scf_source, path, bands['distance'])
                    if nodes is not None:
                        bands['k_path_nodes'] = nodes
                persist()
        if pdos:
            step_run("nscf", nscf_input(scf_source, nbnd, nscf_k))
            step_run("dos", post_input("dos",dos_settings), post=True)
            step_run("projwfc", post_input("projwfc",dos_settings), post=True)
            if execute and not spin_polarized:
                dos = parse_dos(workdir / "dos.dat")
                pdos_path = workdir / "pdos.pdos_tot"
                total = parse_pdos_total(pdos_path, dos)
                orbital = parse_atom_orbital_pdos(
                    workdir, dos["energy_ev"], total["sum_projected_states_per_ev"],
                    parse_atom_symbols(scf_source))
                result["dos"] = dos
                result["pdos_total"] = total
                result["pdos_atoms"] = orbital
                persist()
        result["status"] = "completed" if execute else "prepared"
    except checkpoint.Paused:
        result['status']='paused'
    except (RuntimeError, ValueError, OSError) as exc:
        result["status"] = "failed"
        result["error"] = str(exc)
    persist()
    if execute and result["status"] == "completed":
        electronic = {
            "schema": "kristalyapi.qe-electronic.v1",
            "source": "Quantum ESPRESSO, local pw.x calculation",
            "input_sha256": result["input_sha256"],
            "pseudopotentials": result["pseudopotentials"],
            "energy_zero": "QE internal; no Fermi/vacuum alignment performed",
            "band_path_labels": result["band_path"],
            "bands": result.get("bands"), "dos": result.get("dos"),
            "pdos_total": result.get("pdos_total"),
            "pdos_atoms": result.get("pdos_atoms"),
            "limitations": [
                "Not an optical transition or single-photon emission measurement.",
                "Spin-polarized/SOC and band-unfolding interpretations are not supported.",
                "Atomic and orbital PDOS projections depend on pseudopotentials and do not establish optical transitions.",
                "DFT numerical convergence must be established independently."
            ]
        }
        if spin_polarized:
            from qe_spin import spin_electronic_result
            try:electronic=spin_electronic_result(workdir,electronic,result['spin_bands'],scf_source,scf_output)
            except (OSError,ValueError) as exc:
                result.update(status='failed',error=str(exc));persist();return result
        (workdir / "electronic-results.json").write_text(
            json.dumps(electronic, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--pseudo-dir", required=True, type=Path)
    parser.add_argument("--workdir", required=True, type=Path)
    parser.add_argument("--pw", default="pw.x")
    parser.add_argument("--bands-x", default="bands.x")
    parser.add_argument("--dos-x", default="dos.x")
    parser.add_argument("--projwfc-x", default="projwfc.x")
    parser.add_argument("--band-path", type=Path, help="Explicit crystal_b k-path: LABEL kx ky kz N")
    parser.add_argument("--nbnd", type=int)
    parser.add_argument("--band-first",type=int)
    parser.add_argument("--band-last",type=int)
    parser.add_argument("--nscf-k", type=int, default=12)
    parser.add_argument("--pdos", action="store_true")
    parser.add_argument("--spin-polarized",action="store_true")
    parser.add_argument('--pause-file',type=Path)
    parser.add_argument('--resume',action='store_true')
    parser.add_argument('--expected-checkpoint-sha')
    parser.add_argument('--dos-delta-e',type=float)
    parser.add_argument('--dos-degauss',type=float)
    parser.add_argument('--dos-emin',type=float)
    parser.add_argument('--dos-emax',type=float)
    parser.add_argument("--timeout", type=int, default=14400)
    parser.add_argument("--run", action="store_true", help="Execute actual QE; default is prepare-only")
    args = parser.parse_args(argv)
    try:
        if (args.band_first is None)!=(args.band_last is None):raise ValueError('Both band window bounds are required')
        band_window=[args.band_first,args.band_last] if args.band_first is not None else None
        values=[args.dos_delta_e,args.dos_degauss,args.dos_emin,args.dos_emax]
        settings=None
        if any(x is not None for x in values):
            if any(x is None for x in values):raise ValueError('All four DOS grid/width arguments are required together')
            settings=canonical_dos_settings(dict(zip(
                ('delta_e_ev','degauss_ry','energy_min_ev','energy_max_ev'),values)))
        result = run_pipeline(args.input, args.pseudo_dir, args.workdir, execute=args.run,
                              pw=args.pw, bands_x=args.bands_x, dos_x=args.dos_x,
                              projwfc_x=args.projwfc_x, band_path=args.band_path,
                              nbnd=args.nbnd, nscf_k=args.nscf_k, pdos=args.pdos,
                              timeout=args.timeout,dos_settings=settings,pause_file=args.pause_file,
                              resume=args.resume,expected_checkpoint_sha=args.expected_checkpoint_sha,band_window=band_window,spin_polarized=args.spin_polarized)
        print(json.dumps({"status": result["status"], "manifest": str(args.workdir / "pipeline.json")},
                         ensure_ascii=False))
        return 75 if result["status"]=="paused" else 0 if result["status"] in ("prepared", "completed") else 1
    except (OSError, ValueError, UnicodeError) as exc:
        print("QE pipeline: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
