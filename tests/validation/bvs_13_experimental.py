#!/usr/bin/env python3
"""P13 fail-closed real-CIF validation: production JS vs Gemmi + ASE.

Sources, hashes and cases are pinned in bvs_13_sources.json. The reference
calculations here never call the application's symmetry or neighbor routines.
VESTA is not executed; this is a reproducible independent-library comparison.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import math
from pathlib import Path
import subprocess

import gemmi
import numpy as np
from ase import Atoms
from ase.neighborlist import neighbor_list


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / 'tests/validation/bvs_13_sources.json').read_text())
PARAMETERS = {
    'Na1-Cl': (2.150, 0.37, 'Cl'),
    'Ti4-O': (1.815, 0.37, 'O'),
    'K1-O': (2.132, 0.37, 'O'),
    'Na1-O': (1.803, 0.37, 'O'),
    'Ca2-O': (1.967, 0.37, 'O'),
    'Si4-O': (1.624, 0.37, 'O'),
}


def near(actual, expected, tolerance=1e-7, subject='value'):
    if not math.isclose(float(actual), float(expected), rel_tol=0, abs_tol=tolerance):
        raise AssertionError(f'{subject}: application {actual!r}, reference {expected!r}')


def canonical_frac(value):
    return np.mod(np.array(value, dtype=float), 1.0)


def load_reference(source):
    path = ROOT / source['path']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == source['sha256'], f'Source file changed: {source["id"]}'
    blocks = gemmi.cif.read_file(str(path))
    structural = [block for block in blocks if block.find_value('_cell_length_a')]
    assert len(structural) == 1, f'Expected one crystallographic block: {source["id"]}'
    structure = gemmi.make_small_structure_from_block(structural[0])
    cell = structure.cell
    cellpars = [cell.a, cell.b, cell.c, cell.alpha, cell.beta, cell.gamma]
    expanded = [
        {
            'element': site.element.name,
            'position': canonical_frac([site.fract.x, site.fract.y, site.fract.z]),
            'occupancy': site.occ,
            'label': site.label,
        }
        for site in structure.get_all_unit_cell_sites()
    ]
    atoms = Atoms(
        symbols=[site['element'] for site in expanded],
        scaled_positions=[site['position'] for site in expanded],
        cell=cellpars,
        pbc=True,
    )
    return {'cell': cellpars, 'sites': expanded, 'atoms': atoms}


def match_sites(js_sites, reference):
    assert len(js_sites) == len(reference), (
        f'Expanded-site count {len(js_sites)} != Gemmi {len(reference)}'
    )
    remaining = set(range(len(reference)))
    mapping = {}
    for i, site in enumerate(js_sites):
        p = canonical_frac([site['x'], site['y'], site['z']])
        found = []
        for j in remaining:
            expected = reference[j]
            if expected['element'] != site['element']:
                continue
            if abs(expected['occupancy'] - site['occupancy']) > 2e-5:
                continue
            diff = abs((p - expected['position'] + 0.5) % 1 - 0.5)
            if np.max(diff) <= 2e-5:
                found.append(j)
        assert len(found) == 1, f'Gemmi site match ambiguous/missing: {site}, {found}'
        mapping[i] = found[0]
        remaining.remove(found[0])
    assert not remaining
    return mapping


def ase_images(ref, center_index, pair, cutoff):
    """Independent periodic ligand image enumeration, no app functions reused."""
    r0, b, ligand = PARAMETERS[pair]
    indices_i, indices_j, distances, shifts = neighbor_list(
        'ijdS', ref['atoms'], cutoff, self_interaction=False
    )
    rows = {}
    for i, j, distance, shift in zip(indices_i, indices_j, distances, shifts):
        if int(i) != center_index or ref['sites'][int(j)]['element'] != ligand:
            continue
        if distance < 1e-6 or distance > cutoff + 1e-8:
            continue
        occ = ref['sites'][int(j)]['occupancy']
        if occ <= 0:
            continue
        key = (int(j), *map(int, shift))
        assert key not in rows
        valence = math.exp((r0 - float(distance)) / b)
        rows[key] = {
            'distance': float(distance),
            'occupancy': float(occ),
            'contribution': float(valence * occ),
            'unitValence': valence,
            'position': tuple(np.round(ref['sites'][int(j)]['position'] + shift, 5)),
        }
    return rows


def independent_distribution(rows):
    """Categorical alternatives at the same ligand image; other images independent."""
    groups = {}
    for record in rows.values():
        groups.setdefault(record['position'], []).append(record)
    mean = variance = minimum = maximum = 0.0
    uncertain = 0
    possibilities = [(0.0, 1.0)]
    for group in groups.values():
        total_occ = sum(entry['occupancy'] for entry in group)
        assert total_occ <= 1 + 1e-5
        outcomes = [(entry['unitValence'], entry['occupancy']) for entry in group]
        if total_occ < 1 - 1e-8:
            outcomes.append((0.0, 1 - total_occ))
        m = sum(val * p for val, p in outcomes)
        v = max(0.0, sum(val * val * p for val, p in outcomes) - m * m)
        mean += m
        variance += v
        minimum += min(val for val, _ in outcomes)
        maximum += max(val for val, _ in outcomes)
        uncertain += int(len(outcomes) > 1 and v > 1e-12)
        if possibilities is not None:
            if len(possibilities) * len(outcomes) > 4096:
                possibilities = None
            else:
                possibilities = [
                    (previous + value, probability * p)
                    for (previous, probability), (value, p) in itertools.product(possibilities, outcomes)
                ]
    quantiles = None
    if possibilities is not None:
        possibilities.sort()

        def quantile(target):
            probability = 0.0
            for value, p in possibilities:
                probability += p
                if probability >= target - 1e-12:
                    return value
            return possibilities[-1][0]

        quantiles = {'p05': quantile(.05), 'median': quantile(.5), 'p95': quantile(.95)}
    return {
        'mean': mean, 'standardDeviation': math.sqrt(variance),
        'minimum': minimum, 'maximum': maximum,
        'positions': len(groups), 'uncertainPositions': uncertain,
        'exactQuantiles': quantiles is not None, 'quantiles': quantiles,
    }


def check_center_alternatives(js, ref, mapping, cutoff):
    actual = js['centerAlternatives']
    center = ref['sites'][mapping[js['centerIndex']]]
    matching = [
        (j, site) for j, site in enumerate(ref['sites'])
        if np.max(abs((site['position'] - center['position'] + .5) % 1 - .5)) < 2e-5
        and site['occupancy'] > 0
    ]
    if len(matching) < 2:
        assert actual is None, f'Unexpected center mixture: {js["id"]}'
        return None
    assert actual and actual['complete'] and len(actual['scenarios']) == len(matching)
    sum_occupancy = sum(site['occupancy'] for _, site in matching)
    near(actual['totalOccupancy'], sum_occupancy, subject='center occupancies')
    means = []
    for scenario in actual['scenarios']:
        j = mapping[scenario['index']]
        site = ref['sites'][j]
        assert any(k == j for k, _ in matching)
        assert site['element'] == scenario['element']
        near(scenario['occupancy'], site['occupancy'], subject='scenario occupancy')
        rows = ase_images(ref, j, scenario['pair'], cutoff)
        distribution = independent_distribution(rows)
        near(scenario['sum'], distribution['mean'], subject='alternative species BVS')
        near(scenario['standardDeviation'], distribution['standardDeviation'], subject='alternative ligand sigma')
        means.append((scenario['occupancy'], distribution['mean'], distribution['standardDeviation']))
    mu = sum(w * value for w, value, _ in means) / sum_occupancy
    sigma = math.sqrt(sum(w * ((value - mu) ** 2 + s ** 2)
                          for w, value, s in means) / sum_occupancy)
    near(actual['conditionalMean'], mu, subject='conditional center BVS')
    near(actual['conditionalStandardDeviation'], sigma, subject='conditional center sigma')
    return {'species': len(means), 'conditionalMean': mu, 'conditionalSigma': sigma}


def main():
    bridge = subprocess.run(
        ['node', 'tests/validation/bvs-p13-bridge.cjs'],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    parsed = json.loads(bridge.stdout)['cases']
    cases = {case['id']: case for case in MANIFEST['cases']}
    assert set(cases) == {case['id'] for case in parsed}
    sources = {entry['id']: load_reference(entry) for entry in MANIFEST['sources']}
    report = []
    for js in parsed:
        spec = cases[js['id']]
        ref = sources[spec['source']]
        assert js['source'] == spec['source']
        for index, (field, number) in enumerate(zip(
            ['a', 'b', 'c', 'alpha', 'beta', 'gamma'], ref['cell']
        )):
            near(js['cell'][field], number, 2e-5, f'{js["id"]} cell[{index}]')
        mapping = match_sites(js['sites'], ref['sites'])
        center_index = mapping[js['centerIndex']]
        assert ref['sites'][center_index]['element'] == spec['element']
        assert js['bvs']['pair'] == spec['pair']
        expected_r0, expected_b, _ = PARAMETERS[spec['pair']]
        near(js['bvs']['r0'], expected_r0, subject='R0 pinned parameter')
        near(js['bvs']['b'], expected_b, subject='B pinned parameter')
        independent = ase_images(ref, center_index, spec['pair'], spec['cutoff'])
        actual = {}
        for record in js['bvs']['neighbors']:
            key = (mapping[record['index']], *record['shift'])
            assert key not in actual, f'Duplicate production periodic image: {js["id"]} {key}'
            actual[key] = record
        assert set(actual) == set(independent), (
            f'ASE/JS ligand image mismatch in {js["id"]}: '
            f'extra={set(actual) - set(independent)}, missing={set(independent) - set(actual)}'
        )
        for key, reference in independent.items():
            record = actual[key]
            near(record['distance'], reference['distance'], 2e-6, f'{js["id"]} distance {key}')
            near(record['occupancy'], reference['occupancy'], subject='ligand occupancy')
            near(record['contribution'], reference['contribution'], 1e-7, 'BVS contribution')
        distribution = independent_distribution(independent)
        near(js['bvs']['sum'], distribution['mean'], subject=js['id'] + ' total BVS')
        assert js['bvs']['count'] == len(independent)
        for field in ['mean', 'standardDeviation', 'minimum', 'maximum']:
            near(js['bvs']['occupancyDistribution'][field], distribution[field],
                 subject=f'{js["id"]} ligand {field}')
        for field in ['positions', 'uncertainPositions', 'exactQuantiles']:
            assert js['bvs']['occupancyDistribution'][field] == distribution[field]
        assert (js['bvs']['occupancyDistribution']['quantiles'] is None) == (distribution['quantiles'] is None)
        if distribution['quantiles']:
            for key, value in distribution['quantiles'].items():
                near(js['bvs']['occupancyDistribution']['quantiles'][key], value,
                     subject=f'{js["id"]} {key}')
        alt = check_center_alternatives(js, ref, mapping, spec['cutoff'])
        report.append({
            'id': js['id'], 'source': js['source'], 'expandedSites': len(ref['sites']),
            'coordinationCount': len(independent), 'bvs': round(distribution['mean'], 8),
            'ligandSigma': round(distribution['standardDeviation'], 8),
            'centerAlternatives': alt, 'matchedPeriodicImages': len(independent),
        })

    # This numerical check uses distances published in the IUCr supporting CIF,
    # separate from the Gemmi/ASE calculation above; uncertainties allow tolerance.
    k1 = next(case for case in parsed if case['id'] == 'iucr-silicate-K1')
    observed = [row['distance'] for row in k1['bvs']['neighbors']]
    literature = [2.566, 2.636, 2.721, 2.724, 2.919, 2.940, 3.060]
    for number in literature:
        assert min(abs(value - number) for value in observed) < .03, (
            f'Experimental IUCr K1–O length {number} Å not recovered'
        )

    result = {
        'protocol': MANIFEST['protocol'], 'result': 'PASS',
        'independentParsers': ['Gemmi 0.7.5', 'ASE 3.26.0'],
        'vestaExecuted': False, 'sources': MANIFEST['sources'],
        'validatedCases': len(report), 'cases': report,
        'experimentalAnchor': 'IUCr 2022 K1–O published distances, tolerance 0.03 Å',
        'modelLimitations': [
            'The BVS occupancy distribution assumes independent ligand images.',
            'Coincident species are categorical alternatives, not simultaneously present.',
            'Center-species mean and sigma are conditional on an occupied cation position.',
            'Crystallographic correlations, positional uncertainties and VESTA comparison are not established.',
        ],
    }
    target = ROOT / 'validation-results/bvs-13-experimental-cif-ase-gemmi.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    for item in report:
        print(f"PASS {item['id']}: {item['expandedSites']} sites / "
              f"{item['coordinationCount']} images / {item['bvs']:.7f} v.u.")
    print(f'PASS P13: {len(report)} experimental CIF reference cases; evidence={target.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
