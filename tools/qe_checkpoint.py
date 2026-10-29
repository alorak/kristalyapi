"""Verified completed-stage checkpoints; never resume interrupted QE scratch."""
import hashlib
import json
from pathlib import Path

NAME = 'checkpoint.json'
IGNORED = {NAME, 'pipeline.json', 'progress.json'}


class Paused(Exception):
    pass


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1048576),b''):h.update(block)
    return h.hexdigest()


def inventory(root):
    files={};total=0
    for path in sorted(root.rglob('*')):
        if path.is_symlink():raise ValueError('Checkpoint contains an unsafe symlink')
        if not path.is_file() or path.parent==root and path.name in IGNORED:continue
        total+=path.stat().st_size
        if len(files)>=20000 or total>64*1024**3:raise ValueError('Checkpoint exceeds file/disk verification budget')
        files[str(path.relative_to(root))]=digest(path)
    return files


def contract(input_file,pseudo_dir,model,settings,commands,source_files):
    binaries={};seen={}
    for name,path in sorted(commands.items()):
        path=str(Path(path).resolve())
        if path not in seen:seen[path]=digest(path)
        binaries[name]=seen[path]
    return {'input_sha256':digest(input_file),
            'pseudopotentials':{name:digest(pseudo_dir/file) for name,file in model['pseudopotentials'].items()},
            'settings':settings,'binaries_sha256':binaries,
            'code_sha256':{Path(p).name:digest(p) for p in source_files}}


def save(root,identity,manifest):
    if any(x.get('status')!='completed' for x in manifest['steps'].values()):
        raise ValueError('Only completely finished stages may be checkpointed')
    value={'schema':'kristalyapi.qe-stage-checkpoint.v1','contract':identity,
           'manifest':manifest,'files_sha256':inventory(root)}
    target=root/NAME
    target.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False)+'\n')
    return digest(target)


def load(root,identity,expected_sha=None):
    path=root/NAME
    if path.is_symlink() or not path.is_file() or path.stat().st_size>32_000_000:
        raise ValueError('Missing/unsafe stage checkpoint')
    checkpoint_sha=digest(path)
    if expected_sha is not None and checkpoint_sha!=expected_sha:
        raise ValueError('Stored checkpoint SHA-256 changed')
    data=json.loads(path.read_text())
    if data['schema']!='kristalyapi.qe-stage-checkpoint.v1' or data['contract']!=identity:
        raise ValueError('Checkpoint input/UPF/settings/code/solver contract changed')
    if inventory(root)!=data['files_sha256']:
        raise ValueError('Checkpoint scratch/artifact hashes changed; refusing resume')
    result=data['manifest']
    if result['status']!='paused' or any(s.get('status')!='completed' for s in result['steps'].values()):
        raise ValueError('Only a clean stage-boundary pause may resume')
    count=result.get('resume_count',0)
    if type(count) is not int or not 0<=count<20:raise ValueError('Checkpoint resume budget exceeded')
    result['resume_count']=count+1;result['resumed_from_checkpoint_sha256']=checkpoint_sha
    return result
