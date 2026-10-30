#!/usr/bin/env python3
"""Reverify one archived real Si collinear functional smoke without executing QE."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'server'),str(ROOT/'tools')]
from job_core import canonical_request,make_pw_input
from electronic_core import scf_request
from qe_pipeline import parse_bands_gnu,post_input,bands_input,nscf_input,insert_nbnd,load_band_path
from qe_spin import spin_electronic_result
from qe_run import summarize_output


def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(value,message):
 if not value:raise ValueError(message)


def verify(folder):
 folder=Path(folder);summary=json.loads((folder/'summary.json').read_text())
 request=json.loads((folder/'request.json').read_text());result=json.loads((folder/'result.json').read_text())
 canonical,fingerprint=canonical_request(request)
 check(canonical==request,'Noncanonical archived request')
 check(request['schema']=='kristalyapi.qe-electronic-job.v2' and request['parameters']['starting_magnetization']=={'Si':.1},'Unexpected spin smoke protocol')
 check(request['parameters']['ecutwfc_ry']==45 and request['parameters']['ecutrho_ry']==360 and request['parameters']['kpoints']==[2,2,1] and request['electronic']['nbnd']==8 and request['electronic']['nscf_k']==2,'Unexpected functional smoke size')
 check(result['structure_hash']==fingerprint and result['schema']=='kristalyapi.qe-electronic-job-result.v2','Result source/schema mismatch')
 source=(folder/'source.in').read_text();check(source==make_pw_input(scf_request(request)[0],result['pseudopotentials']),'SCF input is not derived from request')
 check(digest(folder/'source.in')==result['input_sha256'],'Source input hash mismatch')
 raw=folder/'pipeline';manifest=json.loads((raw/'pipeline.json').read_text());electronic=json.loads((raw/'electronic-results.json').read_text())
 check(manifest['status']=='completed' and manifest['dos_settings']==request['electronic']['dos'],'Pipeline incomplete/settings mismatch')
 expected={'scf','bands','bands_pp_up','bands_pp_down','nscf','dos','projwfc'}
 check(set(manifest['steps'])==expected and manifest['steps']==result['pipeline_steps'],'Seven pipeline stages must match API proof')
 for name,proof in result['pipeline_steps'].items():
  check(proof['status']=='completed' and proof['input_sha256']==digest(raw/(name+'.in')) and proof['stdout_sha256']==digest(raw/(name+'.out')),'Stage hash/status mismatch: '+name)
  check('JOB DONE.' in (raw/(name+'.out')).read_text(),'Missing JOB DONE: '+name)
 for name,expected_hash in result['artifact_sha256'].items():
  check(Path(name).name==name and digest(raw/name)==expected_hash,'Artifact hash mismatch: '+name)
 check((raw/'scf.in').read_text()==insert_nbnd(source,8),'Spin SCF band count/input mismatch')
 path=load_band_path(folder/'band-path.txt')
 check((raw/'bands.in').read_text()==bands_input(source,path,8) and (raw/'nscf.in').read_text()==nscf_input(source,8,2),'Band/NSCF input mismatch')
 for name in ('bands_pp_up','bands_pp_down','dos','projwfc'):
  check((raw/(name+'.in')).read_text()==post_input(name,request['electronic']['dos'] if name in ('dos','projwfc') else None),'Postprocessing input mismatch: '+name)
 scf=(raw/'scf.out').read_text();proof=summarize_output(scf,'scf',0)
 check(proof['status']=='completed' and proof['energy_ry']==result['energy_ry'],'SCF did not converge')
 accuracy=re.findall(r'estimated scf accuracy\s*<\s*([0-9.eEdD+-]+)\s*Ry',scf)
 check(accuracy and 0<=float(accuracy[-1].replace('D','E'))<=1e-8 and 'convergence NOT achieved' not in scf,'SCF accuracy failed')
 check(digest(raw/'scf.out')==result['output_sha256'],'SCF output hash mismatch')
 bands={c:parse_bands_gnu(raw/('bands_'+c+'.dat.gnu')) for c in ('up','down')}
 check(all(len(b['energies_ev'])==8 for b in bands.values()),'Eight bands per spin required')
 parsed=spin_electronic_result(raw,electronic,bands,(raw/'scf.in').read_text(),scf)
 check(parsed==electronic==result['electronic'],'Reparsed spin curves differ from API/raw export')
 check(result['magnetization']==parsed['magnetization'],'Magnetization mismatch')
 preflight=json.loads((folder/'preflight.json').read_text())
 check(preflight['structure_hash']==fingerprint,'Preflight structure mismatch')
 for element,meta in result['pseudopotentials'].items():
  check(preflight['upf_sha256'][element]==meta['sha256']==manifest['pseudopotentials'][element]['sha256'],'UPF proof mismatch')
 check(result['pseudopotentials']['Si']['sha256']=='669fb75395a9d26973b0ea1ce8223bbcb30d3396c5d48bf5e794d1243c52375a','Wrong pinned Si UPF')
 check(summary['status']=='passed' and summary['image_source_verified'] is True and summary['source_dirty'] is False,'Source/image receipt incomplete')
 check(re.fullmatch('[a-f0-9]{40}',summary['source_commit']) is not None,'Missing committed source')
 for name,expected_hash in summary['source_sha256'].items():
  check(not Path(name).is_absolute() and '..' not in Path(name).parts,'Unsafe source path')
  blob=subprocess.check_output(['git','show',summary['source_commit']+':'+name],cwd=ROOT)
  check(hashlib.sha256(blob).hexdigest()==expected_hash,'Committed source proof differs: '+name)
 return {'status':'passed','scope':'Si collinear functional integration only; no physical or magnetic ground-state acceptance',
  'job_id':result['job_id'],'source_commit':summary['source_commit'],'structure_hash':fingerprint,'scf_accuracy_ry':float(accuracy[-1].replace('D','E')),
  'energy_ry':result['energy_ry'],'magnetization':result['magnetization'],'bands_per_spin':8,
  'dos_points_per_spin':len(parsed['channels']['up']['dos']['energy_ev']),'stages':7,'calculations_executed_by_verifier':False}

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--verify',type=Path,required=True)
 print(json.dumps(verify(parser.parse_args().verify),indent=2))
