#!/usr/bin/env python3
"""D5.1: source-fixed initial candidates and resource preflight, never DFT results.

No Docker, API submission, automatic O2 placement, or energy comparison is done.
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
import hashlib
import itertools
import json
import math
from pathlib import Path
import sys
import tempfile

import qe_relax_acceptance as d3
from qe_defect_compare import periodic_distance, expected_stoichiometry

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'server'))
from job_core import canonical_request
from relax_core import make_relax_input

PLAN = ROOT / 'tests/fixtures/qe/mos2-defect-preparation.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_reference(plan, directory=None):
    ref = plan['reference']
    directory = Path(directory) if directory is not None else ROOT / ref['evidence_path']
    d3.verify(directory)
    summary_bytes = (directory / 'summary.json').read_bytes()
    result_bytes = (directory / 'cases/relax-scf/result.json').read_bytes()
    summary, result = json.loads(summary_bytes), json.loads(result_bytes)
    if (summary['provenance']['git_commit'] != ref['source_commit'] or
            digest(summary_bytes) != ref['summary_sha256'] or
            digest(result_bytes) != ref['selected_result_sha256'] or
            result['final_structure_hash'] != ref['final_structure_hash']):
        raise ValueError('D3 reference identity/hash differs from the fixed D5 plan')
    return result['final_structure']


def site_id(translation, basis):
    return 't' + '-'.join(map(str, translation)) + '-b' + str(basis)


def supercell(structure, repeats):
    if (not isinstance(repeats, list) or len(repeats) != 3 or
            any(type(n) is not int for n in repeats) or
            not 2 <= repeats[0] <= 4 or not 2 <= repeats[1] <= 4 or repeats[2] != 1):
        raise ValueError('Only explicit 2–4 by 2–4 by 1 slabs are supported')
    if [a['element'] for a in structure['atoms']] != ['Mo', 'S', 'S']:
        raise ValueError('Expected accepted three-site Mo/S/S reference ordering')
    if structure['periodic'] is not True:
        raise ValueError('Periodic accepted reference required')
    cell = [[v * repeats[k] for v in row] for k, row in enumerate(structure['cell_angstrom'])]
    sites = []
    for translation in itertools.product(*(range(n) for n in repeats)):
        for basis, atom in enumerate(structure['atoms'], 1):
            sites.append({'id': site_id(translation, basis), 'element': atom['element'],
                'fractional': [(v + shift) / n for v, shift, n in zip(atom['fractional'], translation, repeats)],
                'source_basis_index': basis, 'source_translation': list(translation)})
    return cell, sites


def structure_of(cell, sites):
    return {'periodic': True, 'cell_angstrom': copy.deepcopy(cell),
            'atoms': [{'element': a['element'], 'fractional': a['fractional'][:]} for a in sites]}


def candidate_request(structure, plan):
    p = plan['candidate_protocol']
    # Canonical validation also rejects collisions, malformed cells and >64 atoms.
    req, fingerprint = canonical_request({'schema': 'kristalyapi.qe-scf-job.v1',
        'profile_id': 'mos2-d5-reviewed', 'structure': structure,
        'parameters': {k: copy.deepcopy(p[k]) for k in
                       ('functional', 'spin', 'ecutwfc_ry', 'ecutrho_ry', 'kpoints')} | {'calculation': 'scf'}})
    req.update(schema='kristalyapi.qe-relax-scf-job.v1', relaxation=copy.deepcopy(d3.load_plan()['relaxation']))
    req['parameters']['calculation'] = 'relax-scf'
    canonical_request(req)
    return req, fingerprint


def capacity(sites, plan):
    counts = Counter(a['element'] for a in sites)
    electrons = sum(plan['pseudopotentials'][el]['z_valence'] * n for el, n in counts.items())
    occupied = math.ceil(electrons / 2)
    # Checked against the current API validator, rather than a duplicated 128 limit.
    from electronic_core import canonical_electronic_request
    structure = structure_of([[10, 0, 0], [0, 10, 0], [0, 0, 24]],
                             [{'element': 'Mo', 'fractional': [0, 0, .5]}])
    probe = {'schema': 'kristalyapi.qe-electronic-job.v1', 'profile_id': 'mos2-d5-reviewed',
        'structure': structure, 'parameters': {'calculation': 'electronic', 'functional': 'PBE',
        'spin': 'unpolarized', 'ecutwfc_ry': 120, 'ecutrho_ry': 960, 'kpoints': [4, 4, 1]},
        'electronic': {'nbnd': occupied, 'nscf_k': 4, 'band_path': [
            {'label': 'Gamma', 'k': [0, 0, 0], 'segments': 1},
            {'label': 'M', 'k': [.5, 0, 0], 'segments': 1}]}}
    try:
        canonical_electronic_request(probe)
        supported, reason = True, None
    except ValueError as exc:
        supported, reason = False, str(exc)
    return {'neutral_valence_electrons': electrons, 'minimum_unpolarized_occupied_bands': occupied,
            'proposed_common_nbnd': plan['electronic_candidate_nbnd'],
            'current_api_accepts_minimum_nbnd': supported, 'api_rejection': reason,
            'runtime_memory_and_walltime_validated': False,
            'basis': 'Pinned UPF valence counts, neutral unpolarized planning only; no spin acceptance.'}


def build(plan, reference, o2_positions=None):
    cell, pristine = supercell(reference, plan['supercell'])
    selected = {}
    for key, meta in plan['vacancy_sites'].items():
        identity = site_id(meta['translation'], meta['basis_index'])
        rows = [a for a in pristine if a['id'] == identity and a['element'] == 'S']
        if len(rows) != 1:
            raise ValueError('Vacancy site must identify exactly one original sulfur: ' + key)
        selected[key] = rows[0]
    primary, secondary = selected['primary'], selected['secondary']
    if primary['id'] == secondary['id']:
        raise ValueError('Two distinct original S sites are required')
    if primary['source_basis_index'] != secondary['source_basis_index']:
        raise ValueError('V_2S sites must belong to the same source sulfur layer')
    center = primary['fractional'][:]
    separation = periodic_distance(center, secondary['fractional'], cell)
    nearest = min(periodic_distance(center, a['fractional'], cell) for a in pristine
                  if a['element'] == 'S' and a['source_basis_index'] == primary['source_basis_index']
                  and a['id'] != primary['id'])
    if abs(separation - nearest) > 1e-7:
        raise ValueError('The preregistered V_2S sites must be same-layer nearest neighbors')
    definitions = [('pristine', [], None), ('V_S', [primary['id']], None),
                   ('V_2S', [primary['id'], secondary['id']], None), ('O_S', [], primary['id'])]
    if o2_positions is not None:
        if (not isinstance(o2_positions, list) or len(o2_positions) != 2 or
                any(not isinstance(row, list) or len(row) != 3 for row in o2_positions) or
                any(type(x) not in (int, float) or not math.isfinite(x) or not 0 <= x < 1
                    for row in o2_positions for x in row)):
            raise ValueError('O2 candidate requires two explicit fractional positions in [0,1)')
        definitions.append(('O2_at_VS', [primary['id']], None))
    cases = []
    for kind, removed, replacement in definitions:
        sites = copy.deepcopy([a for a in pristine if a['id'] not in removed])
        changes = []
        for row in sites:
            if row['id'] == replacement:
                row['element'] = 'O'
                changes.append({'id': row['id'], 'from': 'S', 'to': 'O'})
        if kind == 'O2_at_VS':
            sites += [{'id': 'added-O-' + str(i), 'element': 'O', 'fractional': xyz[:],
                       'source_basis_index': None, 'source_translation': None}
                      for i, xyz in enumerate(o2_positions, 1)]
        structure = structure_of(cell, sites)
        request, fingerprint = candidate_request(structure, plan)
        counts = expected_stoichiometry(kind, Counter(a['element'] for a in sites))
        minimum = min(periodic_distance(a['fractional'], b['fractional'], cell)
                      for i, a in enumerate(sites) for b in sites[:i])
        case = {'id': kind, 'kind': kind, 'status': 'initial-candidate-only', 'calculation_performed': False,
                'structure': structure, 'structure_hash': fingerprint, 'sites': sites, 'counts': counts,
                'removed_source_site_ids': removed, 'substitutions': changes,
                'defect_center_fractional': center[:], 'minimum_pair_distance_angstrom': minimum,
                'capacity': capacity(sites, plan), 'candidate_relax_request': request}
        if kind == 'V_2S':
            case['vacancy_pair'] = {'same_source_layer': True, 'distance_angstrom': separation,
                                    'nearest_same_layer_s_distance_angstrom': nearest}
        if kind == 'O2_at_VS':
            case['oxygen_placement'] = 'explicit user input in supercell fractional coordinates; no chemical-bond claim'
        cases.append(case)
    return {'schema': 'kristalyapi.mos2-defect-preparation.v1', 'scope': plan['scope'],
            'reference': copy.deepcopy(plan['reference']), 'supercell': plan['supercell'][:],
            'candidate_protocol': copy.deepcopy(plan['candidate_protocol']),
            'calculation_performed': False, 'ready_for_scientific_comparison': False,
            'execution_blockers': ['D4 accepted source evidence required before electronic comparison',
                'Defect spin/occupation, cutoff, k-mesh and supercell-size convergence require separate acceptance',
                '4x4 occupied band count exceeds the current electronic API bound',
                'Large-cell memory/walltime and atom count dependent SCF CPU limits have not been validated',
                'O UPF bytes/header were checked, oxygen defect physical suitability remains unaccepted'],
            'pending_cases': [] if o2_positions is not None else [
                {'id': 'O2_at_VS', 'reason': 'Two explicit O positions are required; no automatic molecular placement'}],
            'cases': cases}


def cif_text(structure, name):
    cell = structure['cell_angstrom']
    length = lambda v: math.sqrt(sum(x*x for x in v))
    angle = lambda a, b: math.degrees(math.acos(max(-1, min(1, sum(x*y for x, y in zip(a, b))/(length(a)*length(b))))))
    a, b, c = cell
    rows = ['data_D5_' + name, "_symmetry_space_group_name_H-M 'P 1'", '_symmetry_Int_Tables_number 1']
    rows += [f'_cell_length_{key} {length(v):.12g}' for key, v in zip('abc', cell)]
    rows += [f'_cell_angle_{key} {angle(x,y):.12g}' for key,x,y in [('alpha',b,c),('beta',a,c),('gamma',a,b)]]
    rows += ['loop_', '_space_group_symop_operation_xyz', "'x,y,z'", 'loop_', '_atom_site_label',
             '_atom_site_type_symbol', '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z', '_atom_site_occupancy']
    for i, atom in enumerate(structure['atoms'], 1):
        rows.append(atom['element']+str(i)+' '+atom['element']+' '+' '.join(f'{x:.12g}' for x in atom['fractional'])+' 1')
    return '\n'.join(rows)+'\n'


def write_bundle(output, manifest, plan):
    # Fail before creating anything if the target exists, including a symlink.
    if output.exists() or output.is_symlink():
        raise ValueError('Output directory must be new')
    output.mkdir(parents=True)
    write = lambda p, data: p.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')
    write(output/'preparation.json', manifest)
    write(output/'plan.json', plan)
    profile = {'schema': 'kristalyapi.upf-profile.v1', 'id': 'mos2-d5-reviewed', 'functional': 'PBE',
        'elements': {el: {'file': meta['filename'], 'sha256': meta['reviewed_sha256'],
            'source': meta['url'], 'license': meta['license'], 'functional': 'PBE'}
            for el, meta in plan['pseudopotentials'].items()}}
    write(output/'operator-profile.json', profile)
    for case in manifest['cases']:
        folder = output/case['id'];folder.mkdir()
        write(folder/'structure.json', case['structure'])
        write(folder/'candidate-relax-request.json', case['candidate_relax_request'])
        # Operator-reviewable QE input; generation does not authorize execution.
        elements={a['element'] for a in case['sites']}
        upf={el:profile['elements'][el] for el in elements}
        (folder/'candidate-relax.in').write_text(make_relax_input(case['candidate_relax_request'],upf))
        write(folder/'site-map.json', {k:case[k] for k in ('sites','removed_source_site_ids','substitutions','defect_center_fractional')})
        (folder/'initial.cif').write_text(cif_text(case['structure'], case['id']))
    files = {str(p.relative_to(output)): digest(p.read_bytes()) for p in sorted(output.rglob('*')) if p.is_file()}
    write(output/'files-sha256.json', files)


def verify_bundle(directory, plan, reference):
    """Rebuild source-derived candidates and compare every export byte/hash."""
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('A regular preparation directory is required')
    manifest = json.loads((directory/'preparation.json').read_text())
    oxygen = next((c for c in manifest['cases'] if c['id']=='O2_at_VS'), None)
    positions = [s['fractional'] for s in oxygen['sites'] if s['id'].startswith('added-O-')] if oxygen else None
    expected = build(plan, reference, positions)
    if manifest != expected:
        raise ValueError('Preparation differs from the fixed reference/plan')
    with tempfile.TemporaryDirectory() as tmp:
        rebuilt = Path(tmp)/'rebuilt'
        write_bundle(rebuilt, expected, plan)
        files = {p.relative_to(rebuilt) for p in rebuilt.rglob('*') if p.is_file()}
        observed = {p.relative_to(directory) for p in directory.rglob('*') if p.is_file() or p.is_symlink()}
        if files != observed or any((directory/p).is_symlink() or
                (directory/p).read_bytes() != (rebuilt/p).read_bytes() for p in files):
            raise ValueError('Export file list, bytes or hashes differ from source-derived candidates')
    return len(expected['cases'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--output', type=Path)
    target.add_argument('--verify', type=Path)
    parser.add_argument('--reference', type=Path, help='Accepted, fixed-hash D3 evidence directory')
    parser.add_argument('--o2-positions', type=Path, help='JSON array of two explicit supercell fractional O positions')
    args = parser.parse_args()
    try:
        plan = json.loads(PLAN.read_text())
        if plan['schema'] != 'kristalyapi.mos2-defect-preparation-plan.v1':
            raise ValueError('Unsupported preparation plan')
        reference = load_reference(plan, args.reference)
        if args.verify:
            if args.o2_positions:
                raise ValueError('--o2-positions is only valid when generating a new bundle')
            count = verify_bundle(args.verify, plan, reference)
            print(f'D5 verified {count} source-derived initial candidates; no DFT result claimed')
            return 0
        positions = json.loads(args.o2_positions.read_text()) if args.o2_positions else None
        result = build(plan, reference, positions)
        write_bundle(args.output, result, plan)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, 'D5 preparation failed: '+str(exc)+'\n')
    print(f'D5 prepared {len(result["cases"])} initial candidates; no calculation performed: {args.output}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
