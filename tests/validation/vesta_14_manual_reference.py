#!/usr/bin/env python3
"""P14: real-CIF comparison with *documented* VESTA 3 mathematics.

Do not equate this calculation with an execution of the proprietary VESTA GUI.
An optional, independently captured GUI evidence directory can be audited
separately; all default reports explicitly mark VESTA as NOT RUN.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import subprocess

import gemmi

from bvs_13_experimental import (
    MANIFEST, ROOT, ase_images, load_reference, match_sites, near,
)


VESTA_358_2016_PARAMETER_SHA256 = '73b13e36009c89312535e934e2fe9a72b1356201d050d0e7d0b38e77414545cc'


def bond_geometry(records):
    distances = sorted(record['distance'] for record in records.values())
    if not distances:
        return {'count': 0, 'meanDistance': None, 'baurDistortion': None,
                'hoppeMean': None, 'hoppeEcon': None, 'distancesA': []}
    count = len(distances)
    shortest = distances[0]
    mean = sum(distances) / count
    baur = sum(abs(d - mean) for d in distances) / (count * mean)
    weights = [math.exp(1 - (d / shortest) ** 6) for d in distances]
    hoppe_mean = sum(d * w for d, w in zip(distances, weights)) / sum(weights)
    econ = sum(math.exp(1 - (d / hoppe_mean) ** 6) for d in distances)
    return {'count': count, 'meanDistance': mean, 'baurDistortion': baur,
            'hoppeMean': hoppe_mean, 'hoppeEcon': econ, 'distancesA': distances}


def check_vesta2016_parameters(file, parameters):
    """Optional audit against user's authentic VESTA 3.5.8 distribution.

    The VESTA installation itself is not bundled, downloaded or reproduced
    by the repository's CI. Its 2016 parameter table has its own license.
    """
    raw = file.read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    assert checksum == VESTA_358_2016_PARAMETER_SHA256, (
        'Different VESTA bundled bvparm2016.cif: pin the tested version explicitly'
    )
    doc = gemmi.cif.read_file(str(file))
    assert len(doc) == 1
    fields = [
        '_valence_param_atom_1', '_valence_param_atom_1_valence',
        '_valence_param_atom_2', '_valence_param_atom_2_valence',
        '_valence_param_Ro', '_valence_param_B', '_valence_param_ref_id',
    ]
    rows = [tuple(str(value) for value in row) for row in doc.sole_block().find(fields)]
    assert len(rows) > 500, 'Incomplete VESTA parameter list'
    comparisons = []
    for item in parameters:
        matched = [row for row in rows if row[0] == item['cation']
                   and int(row[1]) == item['charge']
                   and row[2] == item['anion']
                   and int(row[3]) == item['anionCharge']]
        assert matched, f'No VESTA parameter for {item["key"]}'
        compatible = [row for row in matched if abs(float(row[5]) - .37) < 1e-8]
        same_r0 = [row for row in compatible if abs(float(row[4]) - item['r0']) < 1e-8]
        comparisons.append({
            'pair': item['key'], 'appR0': item['r0'], 'appB': item['b'],
            'vestaBFixed': .37, 'vestaRows': len(matched),
            'vestaCompatibleRows': len(compatible), 'sameR0B37': bool(same_r0),
            'compatibleReferenceCode': same_r0[0][6] if same_r0 else None,
        })
    return {'source': 'authentic VESTA 3.5.8 bundled bvparm2016.cif',
            'sha256': checksum, 'rows': len(rows), 'parameters': comparisons,
            'unchangedVestaFileRedistributed': False}


def audit_gui_evidence(file, reference_cases):
    """User-provided screenshot+transcription; never infer GUI from formulas."""
    payload = json.loads(file.read_text())
    assert payload.get('vestaGuiExecuted') is True
    assert payload.get('version') == '3.5.8', 'Record exact VESTA version first'
    assert isinstance(payload.get('platform'), str) and payload['platform'].strip()
    observed = payload.get('cases')
    assert isinstance(observed, list) and observed, 'No captured VESTA GUI output'
    root = file.resolve().parent
    by_id = {item['id']: item for item in reference_cases}
    results = []
    for row in observed:
        case_id = row['id']
        assert case_id in by_id and case_id not in [item['id'] for item in results]
        expected = by_id[case_id]
        assert row['centerLabel'] == expected['centerLabel']
        near(row['cutoffA'], expected['cutoffA'], 1e-8, 'VESTA distance cutoff')
        near(row['r0A'], expected['selectedR0'], 1e-8, 'VESTA selected R0')
        near(row['bA'], .37, 1e-8, 'VESTA fixed B')
        distances = row['bondDistancesA']
        assert isinstance(distances, list) and len(distances) == expected['coordination']
        observed_distances = sorted(map(float, distances))
        assert all(math.isfinite(v) and v > 0 for v in observed_distances)
        for a, b in zip(observed_distances, expected['referenceDistancesA']):
            near(a, b, .03, f'GUI {case_id} source bond length')
        # Evidence path is relative to this evidence manifest's directory.
        screenshot = (root / row['screenshotPath']).resolve()
        assert screenshot.is_relative_to(root) and screenshot.is_file(), 'Missing GUI screenshot'
        png = screenshot.read_bytes()
        assert png.startswith(b'\x89PNG\r\n\x1a\n') and len(png) > 1000
        digest = hashlib.sha256(png).hexdigest()
        assert digest == row['screenshotSha256'], 'Screenshot digest changed'
        transcript = (root / row['consoleTextPath']).resolve()
        assert transcript.is_relative_to(root) and transcript.is_file(), 'Missing VESTA Text Area transcript'
        transcript_bytes = transcript.read_bytes()
        assert len(transcript_bytes) > 30
        assert hashlib.sha256(transcript_bytes).hexdigest() == row['consoleTextSha256']
        assert row['centerLabel'] in transcript_bytes.decode('utf-8'), 'Center missing from transcript'
        results.append({'id': case_id, 'screenshotSha256': digest,
                        'consoleTextSha256': row['consoleTextSha256'],
                        'maxDistanceErrorA': max(abs(a - b) for a, b in
                                                 zip(observed_distances, expected['referenceDistancesA'])),
                        'capturedFromGui': True,
                        'interpretation': 'Human-captured VESTA GUI evidence, not an automated VESTA call'})
    return {'vestaGuiExecuted': True, 'version': payload['version'],
            'platform': payload['platform'], 'capturedCases': len(results), 'cases': results,
            'complete': len(results) == len(reference_cases)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vesta-bvparm', type=Path,
                        help='Optional genuine VESTA 3.5.8 bvparm2016.cif path (not redistributed)')
    parser.add_argument('--vesta-gui-evidence', type=Path,
                        help='Optional human-captured screenshot+distance evidence JSON')
    args = parser.parse_args()
    run = subprocess.run(['node', 'tests/validation/bvs-p13-bridge.cjs'],
                         cwd=ROOT, check=True, capture_output=True, text=True)
    data = json.loads(run.stdout)
    sources = {item['id']: load_reference(item) for item in MANIFEST['sources']}
    cases = {item['id']: item for item in MANIFEST['cases']}
    report = []
    for case in data['cases']:
        spec = cases[case['id']]
        reference = sources[spec['source']]
        mapping = match_sites(case['sites'], reference['sites'])
        center = mapping[case['centerIndex']]
        neighbors = ase_images(reference, center, spec['pair'], spec['cutoff'])
        metrics = bond_geometry(neighbors)
        observed = case['vestaManualGeometry']
        assert metrics['count'] == observed['coordination'] == case['bvs']['count']
        assert observed['uniqueVertices'] == metrics['count'], 'No overlapping ligands in experimental cases'
        near(observed['weightedCoordination'], sum(x['occupancy'] for x in neighbors.values()),
             subject='coordination occupancy')
        for name, field in [('meanDistance', 'meanDistance'),
                            ('baurDistortion', 'baurDistortion'),
                            ('hoppeMean', 'hoppeMean'), ('hoppeEcon', 'hoppeEcon')]:
            near(observed[name], metrics[field], 2e-7, f'{case["id"]} VESTA geometric {name}')
        # VESTA manual §11.4.3: fixed B=0.37 A. Recalculate from ASE
        # distances; this does not invoke the actual desktop VESTA binary.
        r0 = case['bvs']['r0']
        full = sum(math.exp((r0 - r['distance']) / .37) for r in neighbors.values())
        weighted = sum(math.exp((r0 - r['distance']) / .37) * r['occupancy']
                       for r in neighbors.values())
        projection = case['vestaManualProjection']
        near(projection['fullBondSum'], full, 1e-7, 'VESTA manual full bond sum')
        near(projection['occupancyWeightedSum'], weighted, 1e-7, 'VESTA occupancy-weighted hypothetical sum')
        near(projection['deltaParameter'], case['bvs']['sum'] - weighted,
             1e-7, 'Parameter sensitivity')
        near(projection['deltaOccupancy'], weighted - full,
             1e-7, 'Occupancy convention sensitivity')
        assert projection['guiExecuted'] is False and projection['actualVestaSum'] is None
        assert projection['modelB'] == .37
        report.append({
            'id': case['id'], 'source': case['source'],
            'centerLabel': spec['centerLabel'], 'cutoffA': spec['cutoff'],
            'selectedR0': r0, 'appB': case['bvs']['b'],
            'coordination': metrics['count'], 'meanDistanceA': round(metrics['meanDistance'], 8),
            'baurD': round(metrics['baurDistortion'], 8),
            'hoppeEcon': round(metrics['hoppeEcon'], 8),
            'appBvs': round(case['bvs']['sum'], 8),
            'manualVesta37Full': round(full, 8),
            'manualVesta37OccupancyWeighted': round(weighted, 8),
            'referenceDistancesA': metrics['distancesA'],
            'actualVestaBvs': None, 'actualVestaDistanceErrorA': None,
            'vestaGuiStatus': 'not-run',
        })

    optional_parameters = (check_vesta2016_parameters(args.vesta_bvparm, data['parameters'])
                           if args.vesta_bvparm else None)
    optional_gui = (audit_gui_evidence(args.vesta_gui_evidence, report)
                    if args.vesta_gui_evidence else None)
    if optional_gui:
        for item in optional_gui['cases']:
            row = next(r for r in report if r['id'] == item['id'])
            row['actualVestaDistanceErrorA'] = item['maxDistanceErrorA']
            row['vestaGuiStatus'] = 'captured-human-evidence'
    result = {
        'protocol': 'package14-vesta3-manual-equations-real-cif',
        'manualScientificGate': 'PASS',
        'vestaGuiExecuted': optional_gui is not None,
        'vestaGuiStatus': 'captured-human-evidence' if optional_gui else 'NOT RUN',
        'vestaVersionForEquations': 'VESTA 3, official manual §11.4.3',
        'references': [
            'https://jp-minerals.org/vesta/en/doc/VESTAch11.html',
            'https://jp-minerals.org/vesta/en/download.html',
        ],
        'independentReference': ['Gemmi 0.7.5', 'ASE 3.26.0'],
        'vestaBundled2016ParameterAudit': optional_parameters,
        'vestaGuiEvidenceAudit': optional_gui,
        'cases': report,
        'limitations': [
            'VESTA manual formula projection IS NOT an executed VESTA GUI comparison.',
            'BVS comparisons reuse the application-selected R0 and exact ASE neighbor set.',
            'VESTA polyhedron selections, true GUI values and proprietary parameter selection are not inferred.',
            'Human-captured screenshots/distance transcripts require separate verification.',
        ],
    }
    output_dir = ROOT / 'validation-results'
    output_dir.mkdir(exist_ok=True)
    (output_dir / 'vesta-14-manual-reference.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    fields = ['id', 'source', 'centerLabel', 'cutoffA', 'coordination', 'meanDistanceA',
              'baurD', 'hoppeEcon', 'appB', 'appBvs', 'manualVesta37Full',
              'manualVesta37OccupancyWeighted', 'actualVestaBvs',
              'actualVestaDistanceErrorA', 'vestaGuiStatus']
    with (output_dir / 'vesta-14-difference-matrix.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows({field: row[field] for field in fields} for row in report)
    for row in report:
        print(f"PASS {row['id']}: CN {row['coordination']}, D {row['baurD']:.7f}, "
              f"ECoN {row['hoppeEcon']:.5f}; VESTA GUI {row['vestaGuiStatus']}")
    print(f'PASS P14: {len(report)} independent real-CIF VESTA-manual equation checks; '
          f'GUI={result["vestaGuiStatus"]}; actual measurements not invented')


if __name__ == '__main__':
    main()
