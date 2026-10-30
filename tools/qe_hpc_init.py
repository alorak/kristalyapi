#!/usr/bin/env python3
"""Explicit native-Linux nstep=0 runner for a preverified HPC preparation package."""
import argparse
import json
import os
from pathlib import Path
import platform
import signal
import re
import shutil
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from resource_policy import parse_profile,physical_admission,digest as policy_digest
from job_diagnostics import read_cgroup,classify
from qe_defect_init import initialization_proof
from qe_hpc_prepare import digest


def verify_bundle(root):
    if root.is_symlink():raise ValueError('Unsafe bundle directory')
    manifest=json.loads((root/'package.json').read_text())
    if manifest['schema']!='kristalyapi.qe-hpc-initialization-package.v1':raise ValueError('Wrong HPC package schema')
    for name,expected in manifest['files_sha256'].items():
        path=Path(name)
        if path.is_absolute() or '..' in path.parts:raise ValueError('Unsafe package file path')
        current=root/path
        cursor=root
        for part in path.parts:
            cursor=cursor/part
            if cursor.is_symlink():raise ValueError('Unsafe package symlink')
        if digest(current)!=expected:
            raise ValueError('HPC package source/input hash mismatch: '+name)
    profile=parse_profile(json.loads((root/'resource-profile.json').read_text()))
    if policy_digest(profile)!=manifest['resource_profile_sha256']:raise ValueError('Resource profile changed')
    return manifest,profile


def run(root,name,pseudo_dir,execute=False):
    manifest,profile=verify_bundle(root)
    if name not in manifest['cases']:raise ValueError('Unknown fixed HPC candidate')
    if not execute:return {'status':'prepared','case':name,'calculation_performed':False,'scope':manifest['execution_scope']}
    if platform.system()!='Linux':raise ValueError('Native HPC initialization requires Linux')
    if manifest['source_dirty'] or not re.fullmatch(r'[a-f0-9]{40}',manifest.get('source_commit') or ''):
        raise ValueError('Execution requires a package exported from committed sources')
    if not os.getenv('SLURM_JOB_ID'):raise ValueError('Execution requires an active Slurm allocation')
    physical_admission({**profile,'execution_enabled':True},root)
    binary=shutil.which('pw.x');timer=Path('/usr/bin/time')
    if not binary or not timer.is_file():raise ValueError('Native pw.x and GNU /usr/bin/time are required')
    case=json.loads((root/'cases'/name/'case.json').read_text());upf={}
    for element in {s['element'] for s in case['sites']}:
        meta=manifest['pseudopotentials'][element];source=pseudo_dir/meta['file']
        if source.is_symlink() or digest(source)!=meta['sha256']:raise ValueError('Reviewed UPF SHA-256 mismatch: '+element)
        upf[element]=source
    output=root/'runs'/name
    if output.exists():raise ValueError('Initialization output must be new')
    output.mkdir(parents=True);(output/'pseudo').mkdir()
    shutil.copyfile(root/'cases'/name/'init.in',output/'structure.in')
    for source in upf.values():shutil.copyfile(source,output/'pseudo'/source.name)
    report={'schema':'kristalyapi.qe-hpc-initialization-result.v1','status':'failed','case':name,
            'calculation_performed':False,'scf_converged':False,'source_commit':manifest['source_commit'],
            'input_sha256':digest(output/'structure.in'),'solver_sha256':digest(Path(binary)),
            'resource_profile_sha256':manifest['resource_profile_sha256']}
    before=read_cgroup();began=time.monotonic();code=None
    try:
        with (output/'qe.out').open('wb') as stdout,(output/'qe.stderr').open('wb') as stderr:
            process=subprocess.Popen([str(timer),'-v','-o','resources.txt',binary,'-in','structure.in'],cwd=output,
                stdout=stdout,stderr=stderr,start_new_session=True,
                env={**os.environ,'OMP_NUM_THREADS':str(profile['threads']),'LC_ALL':'C'})
            try:code=process.wait(timeout=min(profile['max_wall_seconds'],600))
            finally:
                if process.poll() is None or process.returncode!=0:
                    try:os.killpg(process.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                    process.wait(timeout=10)
        after=read_cgroup()
        delta=max(0,after['oom_kill']-before['oom_kill']) if after['oom_kill'] is not None and before['oom_kill'] is not None else None
        report['cgroup_oom_kill_delta']=delta
        raw=(output/'qe.out').read_text(errors='replace')
        proof=initialization_proof(raw,case,code,bool(delta))
        if proof['qe_version']!=manifest['required_qe_version']:raise ValueError('QE version differs from pinned protocol')
        report.update(status='initialized',proof=proof)
    except (OSError,ValueError,subprocess.SubprocessError) as exc:
        report['error']=str(exc)
        report['reason_code']=classify('timed_out' if isinstance(exc,subprocess.TimeoutExpired) else 'failed',str(exc),[code],report.get('cgroup_oom_kill_delta'))
    finally:
        report['elapsed_seconds']=round(time.monotonic()-began,3);report['returncode']=code
        timing=(output/'resources.txt').read_text(errors='replace') if (output/'resources.txt').exists() else ''
        match=re.search(r'Maximum resident set size \(kbytes\):\s*(\d+)',timing)
        report['gnu_time_max_rss_kib']=int(match[1]) if match else None
        report['full_scf_memory_or_walltime_validated']=False
        (output/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,required=True);parser.add_argument('--inspect',action='store_true')
    parser.add_argument('--case');parser.add_argument('--pseudo-dir',type=Path);parser.add_argument('--execute-initialization',action='store_true')
    args=parser.parse_args();root=args.bundle.resolve()
    if args.inspect:
        manifest,profile=verify_bundle(root);print(json.dumps({'cases':manifest['cases'],'profile':profile,'calculation_performed':False},indent=2));return 0
    if args.case is None or args.pseudo_dir is None:parser.error('--case and --pseudo-dir are required')
    report=run(root,args.case,args.pseudo_dir,args.execute_initialization)
    print(json.dumps(report,indent=2));return 0 if report['status'] in ('prepared','initialized') else 1


if __name__=='__main__':raise SystemExit(main())
