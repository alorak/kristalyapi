#!/usr/bin/env python3
"""Export a bounded D4.2 view only after recomputing the D4.1 raw cohort report."""
import argparse
import json
from pathlib import Path

import qe_electronic_convergence as d41
from qe_scf_acceptance import require, sha, write_json


def export_view(directory):
    derived = d41.report(directory)
    comparison = (directory/'comparison.json').read_text()
    require(json.loads(comparison) == derived, 'Stored comparison differs from recomputed raw evidence')
    plan_text = (directory/'plan.json').read_text(); plan = json.loads(plan_text)
    curves, evidence = [], []
    cases = {'reference-d4': dict(plan['electronic'], degauss_ry=.01)}
    cases.update({case['id']: case for case in plan['cases']})
    for name, case in cases.items():
        if name not in derived['cases']:
            continue
        path = (d41.ROOT/plan['reference']['evidence_path']/'cases/electronic' if name == 'reference-d4'
                else directory/'case-bundles'/name/'cases'/name)
        data = d41.read_data(path, case, plan)
        energy = data['electronic']['dos']['energy_ev']
        step = plan['comparison']['legacy_reference_grid_ev'] if name == 'reference-d4' else plan['comparison']['grid_ev']
        def selected(values): return d41.sample_curve(energy, values, plan, step)
        count = round((plan['comparison']['energy_max_ev']-plan['comparison']['energy_min_ev'])/step)+1
        curves.append({'id': name, 'energy_ev': [round(plan['comparison']['energy_min_ev']+i*step, 8) for i in range(count)],
                       'dos': selected(data['electronic']['dos']['dos_states_per_ev']),
                       'mo_d': selected(d41.orbital(data, 'Mo-d')), 's_p': selected(d41.orbital(data, 'S-p'))})
        evidence.append({'id': name, 'result_sha256': sha((path/'result.json').read_bytes()),
                         'nscf_stdout_sha256': sha((path/'pipeline/nscf.out').read_bytes()),
                         'path': str(path.relative_to(d41.ROOT)) if name == 'reference-d4'
                                 else 'case-bundles/'+name+'/cases/'+name})
    spectra = json.dumps({'curves': curves, 'evidence': evidence}, separators=(',', ':'))
    return {'schema': 'kristalyapi.qe-electronic-convergence-view.v1',
            'plan_json': plan_text, 'comparison_json': comparison,
            'proof': {'raw_report_recomputed': True, 'plan_sha256': sha(plan_text.encode()),
                      'comparison_sha256': sha(comparison.encode()), 'spectra_sha256': sha(spectra.encode()),
                      'verification_command': 'python tools/qe_electronic_convergence.py --verify <evidence-directory>'},
            'spectra_json': spectra}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path); parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(); result = export_view(args.directory)
    write_json(args.output, result)
    print('D4.2 view exported; reported cohort status:', json.loads(result['comparison_json'])['status'])


if __name__ == '__main__': main()
