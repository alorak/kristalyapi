#!/usr/bin/env python3
"""Operator-only, bounded QE nstep=0 initialization of prepared D5 candidates.

This is not SCF/relaxation acceptance. No HTTP jobs or API limit changes occur.
"""
import argparse
import copy
import json
from pathlib import Path
import re
import secrets
import subprocess

import qe_defect_prepare as prep
from job_core import canonical_request, make_pw_input

MEMORY = 6 * 1024**3
TIMEOUT = 120
NBND = 416


def initialization_input(candidate, profile):
    request=copy.deepcopy(candidate['candidate_relax_request'])
    request.pop('relaxation');request['schema']='kristalyapi.qe-scf-job.v1'
    request['parameters']['calculation']='scf'
    request,_=canonical_request(request)
    text=make_pw_input(request,profile)
    return (text.replace(" calculation='scf',", " calculation='scf',\n nstep=0,")
        .replace(" pseudo_dir='./pseudo',", " pseudo_dir='/pseudos',")
        .replace('&SYSTEM\n', '&SYSTEM\n nbnd='+str(NBND)+',\n'))


def initialization_proof(raw,case,exit_code,oom):
    if oom or exit_code != 0 or 'JOB DONE.' not in raw:
        raise ValueError('Initialization failed, timed out or exceeded memory')
    if re.search(r'(?m)^\s*!\s*total energy\s*=',raw) or 'convergence has been achieved' in raw:
        raise ValueError('Unexpected SCF execution in an initialization-only pilot')
    integer=lambda label:re.search(label+r'\s*=\s*([0-9.]+)',raw)
    fields={'atoms':integer('number of atoms/cell'),'electrons':integer('number of electrons'),
            'bands':integer('number of Kohn-Sham states')}
    expected={'atoms':len(case['sites']),'electrons':case['capacity']['neutral_valence_electrons'],'bands':NBND}
    if any(m is None or float(m[1])!=expected[k] for k,m in fields.items()):
        raise ValueError('Raw initialized atom/electron/band counts differ from prepared model')
    version=re.search(r'Program\s+PWSCF\s+v\.?(\S+)',raw)
    if version is None:raise ValueError('Missing actual QE version')
    estimates=re.findall(r'(?im)^.*(?:estimated.*(?:RAM|memory)|RAM.*estimated).*$',raw)
    return {'status':'initialized','qe_version':version[1],**expected,'calculation_performed':False,
            'scf_converged':False,'raw_memory_estimate_lines':estimates,
            'full_scf_memory_or_walltime_validated':False}


def command(args):
    return subprocess.check_output(args,cwd=prep.ROOT,stderr=subprocess.STDOUT,timeout=60)


def run_case(image,pseudos,output,case):
    name='kristalyapi-d5-init-'+secrets.token_hex(6)
    folder=output/case['id'];container=None;process=None
    report={'id':case['id'],'status':'failed','initialization_only':True,'calculation_performed':False}
    try:
        # Scratch is transient RAM, inputs and verified pseudopotentials are read-only.
        argv=['docker','create','--name',name,'--network','none','--read-only','--no-healthcheck',
              '--memory',str(MEMORY),'--memory-swap',str(MEMORY),'--cpus','2','--pids-limit','128',
              '--security-opt','no-new-privileges:true','--cap-drop','ALL',
              '--tmpfs','/tmp:rw,noexec,nosuid,size=64m',
              '--tmpfs','/work:rw,nosuid,size=2g,mode=1777','--workdir','/work',
              '--mount',f'type=bind,src={output},dst=/inputs,readonly',
              '--mount',f'type=bind,src={pseudos},dst=/pseudos,readonly',
              '--env','OMP_NUM_THREADS=2',image,'python3','-c',
              "import os,sys;os.mkdir('/work/tmp');os.execvp('pw.x',['pw.x','-in','/inputs/'+sys.argv[1]+'/initialization.in'])",case['id']]
        container=command(argv).decode().strip()
        with (folder/'initialization.out').open('wb') as stdout,(folder/'initialization.stderr').open('wb') as stderr:
            process=subprocess.Popen(['docker','start','-a',container],stdout=stdout,stderr=stderr)
            try:process.wait(timeout=TIMEOUT)
            except subprocess.TimeoutExpired:
                command(['docker','kill',container]);process.wait(timeout=15)
                report['timed_out']=True
        info=json.loads(command(['docker','inspect',container]))[0]
        cfg=info['HostConfig'];state=info['State']
        actual={'memory_bytes':cfg['Memory'],'memory_swap_bytes':cfg['MemorySwap'],
                'nano_cpus':cfg['NanoCpus'],'network':cfg['NetworkMode'],'read_only':cfg['ReadonlyRootfs']}
        report.update(resources=actual,exit_code=state['ExitCode'],oom_killed=state['OOMKilled'])
        if actual!={'memory_bytes':MEMORY,'memory_swap_bytes':MEMORY,'nano_cpus':2_000_000_000,
                   'network':'none','read_only':True}:
            raise ValueError('Actual initialization sandbox differs from fixed limits')
        if report.get('timed_out'):raise ValueError('Initialization-only pilot exceeded 120 seconds')
        report.update(initialization_proof((folder/'initialization.out').read_text(errors='replace'),
                                          case,state['ExitCode'],state['OOMKilled']))
    except (OSError,ValueError,subprocess.SubprocessError) as exc:
        report['error']=str(exc)[:600]
    finally:
        if container is not None:
            try:command(['docker','rm','-f',container]);report['container_removed']=True
            except (OSError,subprocess.SubprocessError) as exc:report['cleanup_error']=str(exc)
        report['artifact_sha256']={p.name:prep.digest(p.read_bytes()) for p in folder.iterdir() if p.is_file()}
        (folder/'inspection.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepared',type=Path,default=prep.ROOT/'validation-results/qe-mos2-d5-preparation-20261029')
    parser.add_argument('--pseudo-dir',type=Path,required=True)
    parser.add_argument('--image',required=True,help='Explicit existing Docker image sha256; no registry pulls')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();output=args.output.resolve();pseudos=args.pseudo_dir.resolve()
    try:
        if not re.fullmatch(r'sha256:[a-f0-9]{64}',args.image):raise ValueError('An explicit local image sha256 is required')
        if output.exists() or output.is_symlink():raise ValueError('Output directory must be new')
        plan=json.loads(prep.PLAN.read_text());reference=prep.load_reference(plan)
        prep.verify_bundle(args.prepared,plan,reference)
        manifest=json.loads((args.prepared/'preparation.json').read_text())
        image_info=json.loads(command(['docker','image','inspect',args.image]))[0]
        profile_dir=args.prepared
        rendered=[]
        for case in manifest['cases']:
            cfg=json.loads((profile_dir/'operator-profile.json').read_text())
            species={a['element'] for a in case['sites']}
            profile={el:cfg['elements'][el] for el in species}
            for el,meta in profile.items():
                file=pseudos/meta['file']
                if file.is_symlink() or not file.is_file() or not 20<=file.stat().st_size<=20_000_000 or prep.digest(file.read_bytes())!=meta['sha256']:
                    raise ValueError('Pinned initialization UPF bytes missing/mismatched: '+el)
            rendered.append((case,initialization_input(case,profile)))
        output.mkdir(parents=True)
        for case,text in rendered:
            folder=output/case['id'];folder.mkdir()
            (folder/'initialization.in').write_text(text)
        report={'schema':'kristalyapi.mos2-defect-initialization-pilot.v1','initialization_only':True,
                'calculation_performed':False,'source_commit':command(['git','rev-parse','HEAD']).decode().strip(),
                'source_sha256':{str(p.relative_to(prep.ROOT)):prep.digest(p.read_bytes()) for p in
                                 (Path(__file__).resolve(),Path(prep.__file__).resolve(),prep.PLAN,prep.ROOT/'server/job_core.py')},
                'preparation_sha256':prep.digest((args.prepared/'preparation.json').read_bytes()),
                'pseudopotential_sha256':{el:prep.digest((pseudos/meta['filename']).read_bytes())
                    for el,meta in plan['pseudopotentials'].items()},
                'image_id':image_info['Id'],'architecture':image_info['Architecture'],
                'limits':{'memory_bytes':MEMORY,'cpus':2,'timeout_seconds_per_case':TIMEOUT,'nbnd':NBND},
                'scope':'QE nstep=0 initialization only; no energies, relaxation, SCF convergence or full-run resource acceptance'}
        report['cases']=[run_case(args.image,pseudos,output,case) for case in manifest['cases']]
        report['status']='initialized' if all(x['status']=='initialized' and x.get('container_removed') and
                    not x.get('cleanup_error') for x in report['cases']) else 'failed'
        (output/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
    except (OSError,ValueError,KeyError,subprocess.SubprocessError) as exc:
        parser.exit(1,'D5 initialization pilot failed: '+str(exc)+'\n')
    print('D5 initialization pilot:',report['status'],'(no SCF performed)',output)
    return 0 if report['status']=='initialized' else 1


if __name__=='__main__':raise SystemExit(main())
