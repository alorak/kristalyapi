#!/usr/bin/env python3
"""D4 actual MoS2 electronic outputs, gated on the independently verified D3."""
import argparse
import copy
from datetime import datetime,timezone
import json
from pathlib import Path
import math
import re
import subprocess

from qe_scf_acceptance import require,sha,write_json
from qe_acceptance_runtime import Runtime
import qe_relax_acceptance as d3
from qe_pipeline import bands_input,nscf_input,post_input,parse_bands_gnu,parse_dos,parse_pdos_total
from qe_pdos import parse_atom_symbols,parse_atom_orbital_pdos

ROOT=d3.ROOT
PLAN=ROOT/'tests/fixtures/qe/mos2-electronic-acceptance.json'
STEPS=('scf','bands','bands_pp','nscf','dos','projwfc')


def load_plan():
    plan=json.loads(PLAN.read_text())
    require(plan['schema']=='kristalyapi.qe-mos2-electronic-acceptance-plan.v1','Wrong D4 plan')
    return plan


def reference(plan,directory=None):
    directory=directory or ROOT/plan['reference']['evidence_path']
    require((directory/'summary.json').is_file(),'Passed D3 evidence is required before D4')
    d3.verify(directory)
    result=json.loads((directory/'cases/relax-scf/result.json').read_text())
    request=json.loads((directory/'cases/relax-scf/request.json').read_text())
    metadata={'summary_sha256':sha((directory/'summary.json').read_bytes()),
        'selected_result_sha256':sha((directory/'cases/relax-scf/result.json').read_bytes()),
        'final_structure_hash':result['final_structure_hash']}
    return request,result,metadata


def make_request(plan,old,result):
    request={key:copy.deepcopy(old[key]) for key in ('profile_id','parameters')}
    request.update(schema='kristalyapi.qe-electronic-job.v1',structure=copy.deepcopy(result['final_structure']),
                   electronic=copy.deepcopy(plan['electronic']))
    request['parameters']['calculation']='electronic'
    return request


def derive(directory,plan,old,reference_result,case_name='electronic',state_count_dos=None):
    require(re.fullmatch(r'[a-z0-9-]{1,80}',case_name) is not None,'Invalid evidence case name')
    path=directory/'cases'/case_name;folder=path/'pipeline'
    request=make_request(plan,old,reference_result)
    require(json.loads((path/'request.json').read_text())==request,'Electronic request differs from fixed D3 reference')
    result=d3.identity(path,request,plan)
    require(result['schema']=='kristalyapi.qe-electronic-job-result.v1' and result['job_id']!=reference_result['job_id'],
            'Electronic job must be a new completed job')
    scf_request=copy.deepcopy(request);scf_request['parameters']['calculation']='scf'
    proof=d3.raw_proof(folder,scf_request,'scf',plan)
    require(result['input_sha256']==sha((path/'source.in').read_bytes())==proof['input_sha256'] and
            result['output_sha256']==proof['output_sha256'] and abs(result['energy_ry']-proof['energy_ry'])<=1e-8 and
            abs(result['energy_ev']-proof['energy_ry']*d3.RY_TO_EV)<=1e-7 and
            result['engine_version']==proof['qe_version'],'Electronic SCF raw/API/hash mismatch')
    require(set(result['pipeline_steps'])==set(STEPS),'Missing electronic stages')
    for name in STEPS:
        entry=result['pipeline_steps'][name]
        require(entry['status']=='completed' and 'JOB DONE.' in (folder/(name+'.out')).read_text(),
                'Incomplete raw solver stage '+name)
        require(entry['input_sha256']==sha((folder/(name+'.in')).read_bytes()) and
                entry['stdout_sha256']==sha((folder/(name+'.out')).read_bytes()),'Stage hash mismatch '+name)
    for name,digest in result['artifact_sha256'].items():
        require(Path(name).name==name and sha((folder/name).read_bytes())==digest,'Electronic artifact hash mismatch')
    settings=plan['electronic'];source=(folder/'scf.in').read_text()
    points=[(p['label'],p['k'],p['segments']) for p in settings['band_path']]
    require((folder/'bands.in').read_text()==bands_input(source,points,settings['nbnd']),'Raw explicit band path differs from plan')
    require((folder/'nscf.in').read_text()==nscf_input(source,settings['nbnd'],settings['nscf_k']),'Raw NSCF input differs from plan')
    for name in ('bands_pp','dos','projwfc'):
        require((folder/(name+'.in')).read_text()==post_input(name,settings.get('dos')),'Raw postprocessor settings differ from plan')
    for name in ('bands','nscf'):
        text=(folder/(name+'.out')).read_text()
        require('convergence NOT achieved' not in text and 'Error in routine' not in text,'Invalid electronic PW stage')
        match=re.search(r'number of electrons\s*=\s*([0-9.]+)',text)
        require(match is not None and float(match[1])==26,'Electronic stage electron count differs')
        version=re.search(r'Program\s+PWSCF\s+v\.?(\S+)',text)
        require(version is not None and version[1]==proof['qe_version'],'Electronic PW version differs')
    bands=parse_bands_gnu(folder/'bands.dat.gnu');dos=parse_dos(folder/'dos.dat')
    projected=parse_pdos_total(folder/'pdos.pdos_tot',dos)
    atomic=parse_atom_orbital_pdos(folder,dos['energy_ev'],projected['sum_projected_states_per_ev'],parse_atom_symbols(source))
    electronic=json.loads((folder/'electronic-results.json').read_text())
    require(electronic==result['electronic'] and electronic['bands']==bands and electronic['dos']==dos and
        electronic['pdos_total']==projected and electronic['pdos_atoms']==atomic,'Raw spectra differ from API curves')
    require(len(bands['energies_ev'])==settings['nbnd'] and len(bands['distance'])==sum(p['segments'] for p in settings['band_path']),
            'Band or k-path point count differs from plan')
    require(electronic['band_path_labels']==[p['label'] for p in settings['band_path']],'Band labels differ')
    require(all(abs((b-a)-plan['criteria']['dos_step_ev'])<=2e-4 for a,b in zip(dos['energy_ev'],dos['energy_ev'][1:])),
            'DOS grid spacing differs from plan')
    require(all(x>=0 for x in dos['dos_states_per_ev']) and all(a<=b for a,b in zip(dos['integrated_states'],dos['integrated_states'][1:])),
            'Invalid DOS/integrated-state values')
    require(len(atomic['atoms'])==3 and {p['element'] for p in atomic['elements']}=={'Mo','S'} and
        any(p['element']=='Mo' and 'd' in p['orbitals'] for p in atomic['elements']) and
        any(p['element']=='S' and 'p' in p['orbitals'] for p in atomic['elements']),'Missing Mo-d or S-p atomic projections')
    counted_dos=dos if state_count_dos is None else state_count_dos
    c=plan['criteria'];values={'reference_energy_difference_ry':abs(proof['energy_ry']-reference_result['energy_ry']),
        'max_final_force_component_ry_bohr':proof['max_force_component_ry_bohr'],
        'integrated_state_count_error':abs((counted_dos['integrated_states'][-1]-counted_dos['integrated_states'][0])-2*settings['nbnd'])}
    limits={'reference_energy_difference_ry':c['max_reference_energy_difference_ry'],
        'max_final_force_component_ry_bohr':c['max_final_force_component_ry_bohr'],
        'integrated_state_count_error':c['max_integrated_state_count_error']}
    return {'source_scf':proof,'band_count':len(bands['energies_ev']),'kpath_points':len(bands['distance']),
        'dos_points':len(dos['energy_ev']),'pdos_atoms':len(atomic['atoms']),
        'grid_selection':projected['grid_selection'],'max_projection_reconciliation_error':atomic['max_projection_reconciliation_error'],
        'gates':[{'axis':key,'value':value,'limit':limits[key],'passed':math.isfinite(value) and value<=limits[key]} for key,value in values.items()]}


def verify(directory,reference_directory=None):
    plan=load_plan();require(json.loads((directory/'plan.json').read_text())==plan,'D4 plan changed')
    old,result,ref=reference(plan,reference_directory);derived=derive(directory,plan,old,result)
    summary=json.loads((directory/'summary.json').read_text())
    require(summary['status']=='passed' and summary['reference']==ref and summary['derived']==derived and
        all(g['passed'] for g in derived['gates']),'D4 summary/gates differ from raw evidence')
    memory=plan['limits']['docker_worker_memory_bytes']
    require(summary['provenance']['worker_resources']=={'memory_bytes':memory,'memory_swap_bytes':memory} and
        summary['resources_removed'] is True and not summary['cleanup_errors'],'D4 runtime resources/cleanup mismatch')
    return derived


def run(output,reference_directory=None):
    plan=load_plan();old,result,ref=reference(plan,reference_directory)
    require(not output.exists(),'Output directory must be new');output.mkdir(parents=True)
    write_json(output/'plan.json',plan)
    report={'schema':'kristalyapi.qe-mos2-electronic-acceptance.v1','status':'failed','reference':ref,
        'scope':plan['scope'],'started_at':datetime.now(timezone.utc).isoformat()}
    runtime=Runtime(plan,output,[Path(__file__).resolve(),PLAN,ROOT/'tools/qe_pipeline.py',ROOT/'tools/qe_pdos.py'])
    try:
        with runtime:
            runtime.job(make_request(plan,old,result),'electronic')
            report['derived']=derive(output,plan,old,result)
            require(all(g['passed'] for g in report['derived']['gates']),'D4 finite acceptance gate failed')
            report['status']='passed'
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        report['status']='failed';report['error']=str(exc)
    finally:
        report.update(runtime.report)
        if report.get('cleanup_errors'):report['status']='failed'
        report['finished_at']=datetime.now(timezone.utc).isoformat();write_json(output/'summary.json',report)
    print('D4 acceptance:',report['status'],output,flush=True)
    return 0 if report['status']=='passed' else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    choice=parser.add_mutually_exclusive_group(required=True);choice.add_argument('--run',action='store_true');choice.add_argument('--verify',type=Path)
    parser.add_argument('--output',type=Path);parser.add_argument('--reference',type=Path);args=parser.parse_args()
    if args.verify:print(json.dumps(verify(args.verify,args.reference),indent=2));return 0
    if args.output is None:parser.error('--run requires --output')
    return run(args.output.resolve(),args.reference)


if __name__=='__main__':raise SystemExit(main())
