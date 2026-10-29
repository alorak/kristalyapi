#!/usr/bin/env python3
"""D4.1 preregistered finite band/mesh acceptance and DOS-width sensitivity."""
import argparse
import copy
from datetime import datetime, timezone
from functools import lru_cache
import json
import math
from pathlib import Path
import re
import subprocess

import qe_electronic_acceptance as d4
from qe_acceptance_runtime import Runtime
from qe_scf_acceptance import require, sha, write_json
from qe_post_settings import canonical_dos_settings

ROOT = d4.ROOT
PLAN = ROOT/'tests/fixtures/qe/mos2-electronic-convergence.json'
NUMBER = r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][+-]?\d+)?'
ERRORS = (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError)


def load_plan():
    plan = json.loads(PLAN.read_text())
    require(plan['schema'] == 'kristalyapi.qe-electronic-convergence-plan.v1', 'Wrong D4.1 plan')
    cases = plan['cases']
    ids = [c['id'] for c in cases]
    require(len(ids) == len(set(ids)) == 6 and all(re.fullmatch(r'[a-z0-9-]{1,80}', x) for x in ids),
            'Expected six unique safe case IDs')
    for c in cases:
        require(type(c['nbnd']) is int and 24 <= c['nbnd'] <= 128 and
                type(c['nscf_k']) is int and 2 <= c['nscf_k'] <= 24, 'Invalid band/mesh settings')
        canonical_dos_settings(dict(plan['dos'], degauss_ry=c['degauss_ry']))
    settings = {c['id']: c for c in cases}
    settings['reference-d4'] = dict(plan['electronic'], degauss_ry=.01)
    for pair in plan['decision_pairs'] + plan['diagnostic_pairs']:
        a, b = settings[pair['from']], settings[pair['to']]
        axis = {'nbnd': 'nbnd', 'nscf_k': 'nscf_k', 'dos_width': 'degauss_ry'}.get(pair['axis'])
        require(axis is not None, 'Unknown comparison axis')
        require(b[axis] < a[axis] if axis == 'degauss_ry' else a[axis] < b[axis],
                'Invalid comparison direction')
        require(all(a[k] == b[k] for k in ('nbnd', 'nscf_k', 'degauss_ry') if k != axis),
                'Comparison changes multiple physical parameters')
        require(not pair.get('gated') or axis != 'degauss_ry', 'Width is sensitivity only')
    require([(p['axis'], p['gated']) for p in plan['decision_pairs']] ==
            [('nbnd', True), ('nscf_k', True), ('dos_width', False)], 'Missing preregistered decision axes')
    return plan


def case_plan(plan, case):
    result = copy.deepcopy(d4.load_plan())
    result.update(criteria=copy.deepcopy(plan['criteria']), limits=copy.deepcopy(plan['limits']))
    result['electronic'] = dict(copy.deepcopy(plan['electronic']), nbnd=case['nbnd'], nscf_k=case['nscf_k'],
                                dos=canonical_dos_settings(dict(plan['dos'], degauss_ry=case['degauss_ry'])))
    return result


def read_nscf(text, nbnd, occupied=13):
    """Parse the complete fixed-occupation QE 6.7 NSCF table, including 1/0 occupations."""
    require('JOB DONE.' in text and 'Error in routine' not in text, 'Incomplete NSCF output')
    def header(pattern):
        matches = re.findall(pattern, text)
        require(len(matches) == 1, 'Missing/ambiguous NSCF header')
        return float(matches[0])
    require(header(r'number of electrons\s*=\s*([\d.]+)') == 2*occupied, 'Wrong NSCF electron count')
    require(header(r'number of Kohn-Sham states\s*=\s*(\d+)') == nbnd, 'Wrong NSCF band count')
    nk = int(header(r'number of k points\s*=\s*(\d+)'))
    require(1 <= nk <= 24*24, 'Unexpected NSCF point count')
    blocks = list(re.finditer(r'^\s*k\s*=([^\n]*?)\([^\n]*\)\s+bands \(ev\):\s*$', text, re.M | re.I))
    require(len(blocks) == nk, 'Incomplete/duplicate NSCF eigenvalue blocks')
    spectra, coords = [], []
    def numeric_block(lines):
        values = []
        for line in lines:
            if not line.strip() and not values:
                continue
            if not re.fullmatch(r'\s*'+NUMBER+r'(?:\s+'+NUMBER+r')*\s*', line):
                break
            values.extend(float(x.replace('D', 'E').replace('d', 'e')) for x in line.split())
        require(len(values) == nbnd and all(math.isfinite(x) for x in values), 'Truncated/nonfinite NSCF numeric block')
        return values
    for i, block in enumerate(blocks):
        coord = [float(x.replace('D', 'E')) for x in re.findall(NUMBER, block[1])]
        require(len(coord) == 3 and all(math.isfinite(x) for x in coord), 'Invalid NSCF coordinates')
        section = text[block.end():blocks[i+1].start() if i+1 < nk else len(text)]
        parts = re.split(r'\boccupation numbers\s*\n', section)
        require(len(parts) == 2, 'Missing/ambiguous NSCF occupations')
        energies = numeric_block(parts[0].splitlines())
        occupations = numeric_block(parts[1].splitlines())
        states = sorted(zip(energies, occupations))
        require(all(abs(o-(1 if j < occupied else 0)) <= 1e-6 for j, (_, o) in enumerate(states)),
                'NSCF requires normalized fixed 1/0 occupations, not fractional/metallic filling')
        coords.append(coord)
        spectra.append([e for e, _ in states])
    require(len({tuple(c) for c in coords}) == nk, 'Duplicate NSCF coordinates')
    vbm = max(row[occupied-1] for row in spectra)
    cbm = min(row[occupied] for row in spectra)
    require(cbm > vbm, 'Sampled NSCF gap must be positive')
    return {'coordinates': coords, 'eigenvalues_ev': spectra, 'vbm_ev': vbm, 'cbm_ev': cbm,
            'gap_ev': cbm-vbm, 'kpoints': nk, 'bands': nbnd, 'occupied_bands': occupied}


def read_data(path, case, plan):
    result = json.loads((path/'result.json').read_text())
    spectrum = read_nscf((path/'pipeline/nscf.out').read_text(), case['nbnd'], plan['comparison']['occupied_bands'])
    return {'settings': case, 'electronic': result['electronic'], 'nscf': spectrum,
            'job_id': result['job_id'], 'engine_version': result['engine_version'], 'input_sha256': result['input_sha256']}


def reference(plan):
    path = ROOT/plan['reference']['evidence_path']
    d4.verify(path)
    expected = plan['reference']
    require(sha((path/'summary.json').read_bytes()) == expected['summary_sha256'] and
            sha((path/'cases/electronic/result.json').read_bytes()) == expected['result_sha256'], 'Pinned D4 evidence changed')
    summary = json.loads((path/'summary.json').read_text())
    require(summary['provenance']['git_commit'] == expected['source_commit'], 'Wrong reference source commit')
    old, result, _ = d4.reference(d4.load_plan())
    require(result['final_structure_hash'] == expected['structure_hash'], 'Wrong D3 geometry')
    base = read_data(path/'cases/electronic', dict(plan['electronic'], degauss_ry=.01), plan)
    return old, result, base


def sample_curve(energy, values, plan, step):
    c = plan['comparison']
    require(len(energy) == len(values) and all(math.isfinite(x) for x in energy+values) and
            all(v >= 0 for v in values) and all(b > a for a, b in zip(energy, energy[1:])), 'Invalid spectrum curve')
    count = round((c['energy_max_ev']-c['energy_min_ev'])/step)
    chosen = {}
    for e, value in zip(energy, values):
        index = round((e-c['energy_min_ev'])/step)
        if 0 <= index <= count and abs(e-(c['energy_min_ev']+index*step)) <= c['energy_grid_tolerance_ev']:
            require(index not in chosen, 'Duplicate common energy sample')
            chosen[index] = value
    require(len(chosen) == count+1, 'Missing/misaligned common energy grid; interpolation is forbidden')
    return [chosen[i] for i in range(count+1)]


def relative_l1(left, right, minimum, step):
    require(len(left) == len(right) and len(left) >= 2, 'Mismatched comparison vectors')
    # Uniform grid spacing cancels. fsum makes offline verification stable across Python versions.
    def area(y):
        return math.fsum((a+b)/2 for a, b in zip(y, y[1:]))
    denominator = area(right)
    require(denominator*step >= minimum, 'Missing/zero projected spectral area')
    return area([abs(b-a) for a, b in zip(left, right)])/denominator


def orbital(data, group):
    element, name = group.split('-')
    matches = [e for e in data['electronic']['pdos_atoms']['elements'] if e['element'] == element]
    require(len(matches) == 1 and name in matches[0]['orbitals'], 'Missing/duplicate orbital group '+group)
    return matches[0]['orbitals'][name]


def compare(left, right, pair, plan):
    c, limits = plan['comparison'], plan['criteria']
    a, b = left['electronic']['bands'], right['electronic']['bands']
    require(len(a['distance']) == len(b['distance']) == 61 and
            all(abs(x-y) <= 1e-6 for x, y in zip(a['distance'], b['distance'])), 'Changed explicit band path')
    n = c['common_lowest_bands']
    require(min(len(a['energies_ev']), len(b['energies_ev'])) >= n and
            all(len(row) == 61 and all(math.isfinite(x) for x in row) for row in a['energies_ev']+b['energies_ev']),
            'Incomplete common band spectra')
    band_delta = max(abs(x-y) for rows in zip(zip(*a['energies_ev']), zip(*b['energies_ev']))
                     for x, y in zip(sorted(rows[0])[:n], sorted(rows[1])[:n]))
    edge_delta = {k: abs(right['nscf'][k]-left['nscf'][k]) for k in ('vbm_ev', 'cbm_ev', 'gap_ev')}
    step = c['legacy_reference_grid_ev'] if pair['from'] == 'reference-d4' else c['grid_ev']
    def selected(data, values):
        return sample_curve(data['electronic']['dos']['energy_ev'], values, plan, step)
    dos_l1 = relative_l1(selected(left, left['electronic']['dos']['dos_states_per_ev']),
                         selected(right, right['electronic']['dos']['dos_states_per_ev']), limits['min_curve_area'], step)
    pdos_l1 = {g: relative_l1(selected(left, orbital(left, g)), selected(right, orbital(right, g)),
                              limits['min_curve_area'], step) for g in c['orbital_groups']}
    checks = []
    def gate(name, value, limit):
        checks.append({'quantity': name, 'value': value, 'limit': limit, 'passed': math.isfinite(value) and value <= limit})
    width = pair['axis'] == 'dos_width'
    spectrum_delta = None
    if width:
        require(left['nscf']['coordinates'] == right['nscf']['coordinates'] and
                left['nscf']['bands'] == right['nscf']['bands'], 'Width pair changed the NSCF mesh or band count')
        spectrum_delta = max(abs(x-y) for arow, brow in zip(left['nscf']['eigenvalues_ev'], right['nscf']['eigenvalues_ev'])
                             for x, y in zip(arow, brow))
        gate('underlying_nscf_spectrum_integrity_ev', spectrum_delta, limits['max_common_band_delta_ev'])
        gate('unchanged_explicit_path_integrity_ev', band_delta, limits['max_common_band_delta_ev'])
    else:
        gate('common_lowest_path_bands_ev', band_delta, limits['max_common_band_delta_ev'])
        for name, value in edge_delta.items():
            gate('sampled_nscf_'+name, value, limits['max_edge_delta_ev'])
        gate('dos_relative_l1', dos_l1, limits['max_dos_relative_l1'])
        for group, value in pdos_l1.items():
            gate(group+'_relative_l1', value, limits['max_pdos_relative_l1'])
    return dict(pair, common_path_band_delta_ev=band_delta, sampled_nscf_edge_deltas_ev=edge_delta,
                dos_relative_l1=dos_l1, pdos_relative_l1=pdos_l1, comparison_grid_ev=step,
                underlying_nscf_spectrum_delta_ev=spectrum_delta, sensitivity_only=width, checks=checks,
                convergence_passed=None if width else all(g['passed'] for g in checks),
                integrity_passed=all(g['passed'] for g in checks) if width else True)


@lru_cache(maxsize=512)
def committed_sha(commit, name):
    require(re.fullmatch(r'[0-9a-f]{40}', commit) is not None and not Path(name).is_absolute() and
            '..' not in Path(name).parts, 'Unsafe source provenance')
    return sha(subprocess.check_output(['git', 'show', commit+':'+name], cwd=ROOT, stderr=subprocess.DEVNULL))


def source_proof(provenance):
    required = {'server/qe_post_settings.py', 'server/electronic_worker.py', 'server/electronic_core.py',
                'tools/qe_pipeline.py', 'tools/qe_pdos.py', 'tools/qe_electronic_acceptance.py',
                'tools/qe_electronic_convergence.py', 'tools/qe_acceptance_runtime.py', str(PLAN.relative_to(ROOT))}
    digests = provenance['source_sha256']
    require(required <= set(digests), 'Incomplete source provenance')
    require(all(committed_sha(provenance['git_commit'], p) == digest for p, digest in digests.items()),
            'Recorded source differs from committed source; dirty calculations are rejected')


def verify_case(directory, plan, case, old, ref, baseline):
    cp = case_plan(plan, case)
    require(json.loads((directory/'plan.json').read_text()) == cp, 'Case plan changed')
    derived = d4.derive(directory, cp, old, ref, case_name=case['id'])
    require(all(g['passed'] for g in derived['gates']), 'Case finite D4 gates failed')
    summary = json.loads((directory/'summary.json').read_text())
    require(summary['status'] == 'completed' and summary['case_id'] == case['id'] and summary['derived'] == derived and
            summary['resources_removed'] is True and not summary['cleanup_errors'], 'Case summary/cleanup differs from raw evidence')
    p = summary['provenance']; memory = plan['limits']['docker_worker_memory_bytes']
    require(p['worker_resources'] == {'memory_bytes': memory, 'memory_swap_bytes': memory} and
            p['worker_nano_cpus'] == plan['limits']['docker_worker_nano_cpus'], 'Case resources changed')
    require(p['docker_arch'] == 'x86_64', 'D4.1 comparison cohort requires x86_64, matching accepted D4')
    source_proof(p)
    data = read_data(directory/'cases'/case['id'], case, plan)
    energy = data['electronic']['dos']['energy_ev']
    require(len(energy) == round((plan['dos']['energy_max_ev']-plan['dos']['energy_min_ev'])/plan['dos']['delta_e_ev'])+1 and
            abs(energy[0]-plan['dos']['energy_min_ev']) <= 2e-4 and
            abs(energy[-1]-plan['dos']['energy_max_ev']) <= 2e-4, 'Explicit full DOS window changed')
    require(data['engine_version'] == baseline['engine_version'] and data['input_sha256'] == baseline['input_sha256'],
            'Case QE version or source SCF input differs from accepted D4')
    return data, summary


def report(directory):
    plan = load_plan()
    require(json.loads((directory/'plan.json').read_text()) == plan, 'Cohort plan changed')
    old, ref, baseline = reference(plan)
    data = {'reference-d4': baseline}; summaries = {}; errors = {}
    for case in plan['cases']:
        try:
            data[case['id']], summaries[case['id']] = verify_case(directory/'case-bundles'/case['id'], plan, case, old, ref, baseline)
        except ERRORS as exc:
            errors[case['id']] = str(exc)
    pairs = []
    for pair in plan['decision_pairs'] + plan['diagnostic_pairs']:
        if pair['from'] in data and pair['to'] in data:
            try:
                pairs.append(compare(data[pair['from']], data[pair['to']], pair, plan))
            except ERRORS as exc:
                errors[pair['from']+'->'+pair['to']] = str(exc)
    provenance = [s['provenance'] for s in summaries.values()]
    if provenance and any(p['git_commit'] != provenance[0]['git_commit'] or
                          p['source_sha256'] != provenance[0]['source_sha256'] for p in provenance):
        errors['source_cohort'] = 'Mixed source revisions in the cohort'
    ids = [d['job_id'] for d in data.values()]
    if len(set(ids)) != len(ids):
        errors['job_identity'] = 'Cases must be independent jobs'
    passed = not errors and len(summaries) == len(plan['cases']) and all(
        p['convergence_passed'] is True if p.get('gated') else p['integrity_passed'] for p in pairs)
    return {'schema': 'kristalyapi.qe-electronic-convergence.v1', 'status': 'passed' if passed else 'failed',
            'scope': plan['scope'], 'reference': plan['reference'], 'errors': errors,
            'source_commit': provenance[0]['git_commit'] if provenance else None,
            'cases': {key: {'job_id': d['job_id'], 'sampled_nscf': {k: v for k, v in d['nscf'].items()
                       if k not in ('coordinates', 'eigenvalues_ev')}} for key, d in data.items()},
            'pairs': pairs, 'broadening_converged': None, 'energy_alignment': plan['comparison']['energy_alignment']}


def run_case(directory, case_id):
    plan = load_plan(); old, ref, baseline = reference(plan)
    matches = [c for c in plan['cases'] if c['id'] == case_id]
    require(len(matches) == 1, 'Unknown D4.1 case')
    directory.mkdir(parents=True, exist_ok=True)
    if (directory/'plan.json').exists():
        require(json.loads((directory/'plan.json').read_text()) == plan, 'Cannot mix cohort plans')
    write_json(directory/'plan.json', plan)
    case = matches[0]; cp = case_plan(plan, case); output = directory/'case-bundles'/case_id
    require(not output.exists(), 'Case output must be new')
    output.mkdir(parents=True); write_json(output/'plan.json', cp)
    sources = [*sorted((ROOT/'tools').glob('qe_*.py')), PLAN]
    runtime = Runtime(cp, output, sources)
    summary = {'schema': 'kristalyapi.qe-electronic-convergence-case.v1', 'status': 'failed',
               'started_at': datetime.now(timezone.utc).isoformat(), 'case_id': case_id}
    try:
        with runtime:
            source_proof(runtime.report['provenance'])  # Reject dirty source before submitting a scientific job.
            require(runtime.report['provenance']['docker_arch'] == 'x86_64', 'Use x86_64 for the D4.1 cohort')
            runtime.job(d4.make_request(cp, old, ref), case_id)
            summary['derived'] = d4.derive(output, cp, old, ref, case_name=case_id)
            require(all(g['passed'] for g in summary['derived']['gates']), 'Finite D4 case gate failed')
            data = read_data(output/'cases'/case_id, case, plan)
            require(data['input_sha256'] == baseline['input_sha256'] and
                    data['engine_version'] == baseline['engine_version'], 'Changed source SCF or QE version')
            summary['status'] = 'completed'
    except ERRORS as exc:
        summary['error'] = str(exc)
    finally:
        summary.update(runtime.report)
        if summary.get('cleanup_errors'):
            summary['status'] = 'failed'
        summary['finished_at'] = datetime.now(timezone.utc).isoformat()
        write_json(output/'summary.json', summary)
    print(case_id, summary['status'], flush=True)
    return 0 if summary['status'] == 'completed' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--run-case'); modes.add_argument('--report', type=Path)
    modes.add_argument('--verify', type=Path); modes.add_argument('--preflight', action='store_true')
    parser.add_argument('--output', type=Path); args = parser.parse_args()
    if args.preflight:
        plan = load_plan(); reference(plan)
        print('D4.1 plan and pinned D4/D3/raw reference verified; no new solver jobs run.'); return 0
    if args.run_case:
        if args.output is None:
            parser.error('--run-case requires --output')
        return run_case(args.output.resolve(), args.run_case)
    directory = args.report or args.verify
    result = report(directory)
    if args.verify:
        require(json.loads((directory/'comparison.json').read_text()) == result, 'Comparison report differs from raw evidence')
        require(result['status'] == 'passed', 'D4.1 incomplete or failed; no finite convergence acceptance')
    else:
        write_json(directory/'comparison.json', result)
    print('D4.1', result['status'], '; broadening is sensitivity only')
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
