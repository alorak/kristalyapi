#!/usr/bin/env python3
"""Export audited D5 initialization-only Slurm packages; never submits a job."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from resource_policy import parse_profile,scope,digest as policy_digest
import qe_defect_prepare as prep
from qe_defect_init import initialization_input,NBND


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def make_bundle(preparation,profile,output):
    profile=parse_profile(profile)
    if profile['execution_enabled']:raise ValueError('HPC preparation package requires an execution-disabled profile')
    plan=json.loads(prep.PLAN.read_text());reference=prep.load_reference(plan)
    prep.verify_bundle(preparation,plan,reference)
    data=json.loads((preparation/'preparation.json').read_text())
    operator=json.loads((preparation/'operator-profile.json').read_text())
    if output.exists() or output.is_symlink():raise ValueError('Output must be new')
    if profile['max_bands']<NBND or max(len(c['sites']) for c in data['cases'])>profile['max_atoms']:
        raise ValueError('Prepared candidates exceed the selected resource profile')
    output.mkdir(parents=True);(output/'cases').mkdir();(output/'pseudo').mkdir()
    sources=[*sorted((ROOT/'tools').glob('qe_*.py')),*sorted((ROOT/'server').glob('*.py')),
             *sorted((ROOT/'tests/fixtures/qe').glob('*.json'))]
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
    committed=True
    for source in sources:
        name=source.relative_to(ROOT);target=output/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        try:
            original=subprocess.check_output(['git','show',commit+':'+str(name)],cwd=ROOT,stderr=subprocess.DEVNULL)
            if hashlib.sha256(original).hexdigest()!=digest(source):committed=False
        except subprocess.SubprocessError:committed=False
    (output/'resource-profile.json').write_text(json.dumps(profile,indent=2)+'\n')
    cases=[]
    for case in data['cases']:
        name=case['id']
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,50}',name):raise ValueError('Unsafe fixed candidate id')
        folder=output/'cases'/name;folder.mkdir()
        with scope(profile):text=initialization_input(case,operator['elements']).replace("pseudo_dir='/pseudos'","pseudo_dir='./pseudo'")
        (folder/'init.in').write_text(text)
        (folder/'case.json').write_text(json.dumps(case,indent=2)+'\n')
        script=f'''#!/bin/bash
#SBATCH --job-name=qe-init-{name}
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task={profile['threads']}
#SBATCH --mem={(profile['memory_required_bytes']+1048575)//1048576}M
#SBATCH --time={max(1,(min(profile['max_wall_seconds'],600)+59)//60)}
set -euo pipefail
if [ "${{QE_HPC_INITIALIZATION:-}}" != "1" ]; then
  echo 'Preparation only. Explicit QE_HPC_INITIALIZATION=1 is required for nstep=0.' >&2
  exit 64
fi
bundle="${{SLURM_SUBMIT_DIR:?Submit from the package root}}"
cd -- "$bundle"
export PYTHONDONTWRITEBYTECODE=1
python3 "$bundle/tools/qe_hpc_init.py" --bundle "$bundle" --case {name} --pseudo-dir "$bundle/pseudo" --execute-initialization
'''
        (folder/'init.slurm').write_text(script)
        cases.append(name)
    (output/'pseudo/README.md').write_text('Copy the reviewed UPF files here. SHA-256 is checked before initialization; no files are downloaded automatically.\n')
    (output/'README.md').write_text('Preparation only: no job submitted. Inspect with python3 tools/qe_hpc_init.py --bundle . --inspect.\n'
        'Submit from the package root: QE_HPC_INITIALIZATION=1 sbatch cases/pristine/init.slurm. The reviewed UPFs must be in pseudo/.\n'
        'The resource minimum is an operator budget, not proof of sufficiency. nstep=0 cannot accept SCF or relaxation.\n')
    files={str(p.relative_to(output)):digest(p) for p in sorted(output.rglob('*')) if p.is_file()}
    manifest={'schema':'kristalyapi.qe-hpc-initialization-package.v1','source_commit':commit if committed else None,
              'source_dirty':not committed,'resource_profile_sha256':policy_digest(profile),'cases':cases,
              'reference':plan['reference'],'pseudopotentials':operator['elements'],'required_qe_version':'6.7MaX',
              'execution_scope':'initialization-only nstep=0; no SCF/relaxation/full-run acceptance',
              'calculation_performed':False,'files_sha256':files}
    (output/'package.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preparation',type=Path,required=True);parser.add_argument('--resource-profile',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    result=make_bundle(args.preparation,json.loads(args.resource_profile.read_text()),args.output)
    print('Prepared',len(result['cases']),'initialization-only HPC candidates; no job submitted.')


if __name__=='__main__':main()
