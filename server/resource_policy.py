"""Operator-only limits. HTTP requests cannot choose policy paths or budgets."""
from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import json
import os
from pathlib import Path
import re
import shutil

DEFAULT = {'schema':'kristalyapi.qe-resource-profile.v1','id':'local-default',
           'max_atoms':64,'max_bands':128,'max_nscf_k':24,'threads':2,
           'memory_required_bytes':0,'scratch_required_bytes':0,'max_wall_seconds':604800,'execution_enabled':True}
_CURRENT = ContextVar('qe_resource_policy',default=DEFAULT)


def parse_profile(data):
    if not isinstance(data,dict) or set(data)!=set(DEFAULT) or data['schema']!=DEFAULT['schema']:
        raise ValueError('Invalid resource profile fields/schema')
    if not isinstance(data['id'],str) or not re.fullmatch(r'[a-z][a-z0-9-]{1,39}',data['id']):
        raise ValueError('Invalid resource profile id')
    for key,low,high in [('max_atoms',1,512),('max_bands',1,2048),('max_nscf_k',2,48),
                         ('threads',1,64),('memory_required_bytes',0,2*1024**4),('scratch_required_bytes',0,4*1024**4),('max_wall_seconds',1,604800)]:
        if type(data[key]) is not int or not low<=data[key]<=high:raise ValueError('Invalid resource profile '+key)
    if type(data['execution_enabled']) is not bool:raise ValueError('Invalid resource profile execution flag')
    if data!=DEFAULT and (data['memory_required_bytes']<1024**3 or data['scratch_required_bytes']<1024**3):
        raise ValueError('Custom resource profiles require an explicit memory and scratch minima >=1 GiB')
    return data.copy()


def load_operator_profile():
    filename=os.getenv('QE_RESOURCE_PROFILE_FILE','')
    if not filename:return DEFAULT.copy()
    p=Path(filename)
    if p.is_symlink() or not p.is_file() or p.stat().st_size>16384:raise ValueError('Invalid operator resource profile file')
    return parse_profile(json.loads(p.read_text()))


def digest(profile):
    return hashlib.sha256(json.dumps(profile,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def current():return _CURRENT.get()


@contextmanager
def scope(profile):
    token=_CURRENT.set(profile)
    try:yield
    finally:_CURRENT.reset(token)


def physical_admission(profile,scratch_root=None):
    if not profile['execution_enabled']:raise ValueError('Resource profile is preparation-only; execution disabled')
    if profile==DEFAULT:return
    from job_diagnostics import read_cgroup,cgroup_path,CGROUP
    cgroup=read_cgroup();limits=[]
    path=cgroup_path();hierarchy=[path]
    try:
        path.relative_to(CGROUP)
        while path!=CGROUP:
            path=path.parent;hierarchy.append(path)
    except ValueError:pass
    for folder in hierarchy:
        try:
            value=(folder/'memory.max').read_text().strip()
            if value.isdigit():limits.append(int(value))
        except OSError:pass
    if cgroup['memory_limit'] is not None:limits.append(cgroup['memory_limit'])
    try:limits.append(os.sysconf('SC_PHYS_PAGES')*os.sysconf('SC_PAGE_SIZE'))
    except (OSError,ValueError,AttributeError):pass
    if not limits or min(limits)<profile['memory_required_bytes']:
        raise ValueError('Resource profile memory minimum exceeds observed worker/node capacity')
    if scratch_root is not None and shutil.disk_usage(scratch_root).free<profile['scratch_required_bytes']:
        raise ValueError('Resource profile scratch minimum exceeds available disk')
    cpus=os.cpu_count() or 1
    if hasattr(os,'sched_getaffinity'):cpus=min(cpus,len(os.sched_getaffinity(0)))
    for folder in hierarchy:
        try:
            quota,period=(folder/'cpu.max').read_text().split()
            if quota!='max':cpus=min(cpus,int(quota)/int(period))
        except (OSError,ValueError,ZeroDivisionError):pass
    if cpus<profile['threads']:raise ValueError('Resource profile threads exceed observed CPU quota')


def for_job(job,scratch_root=None):
    profile=load_operator_profile();pinned=job.get('resource_profile_sha256')
    if (pinned is not None and (not isinstance(pinned,str) or not re.fullmatch(r'[a-f0-9]{64}',pinned) or pinned!=digest(profile))) or (pinned is None and profile!=DEFAULT):
        raise ValueError('Resource profile changed since job admission')
    physical_admission(profile,scratch_root)
    return profile
