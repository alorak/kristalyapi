"""Bounded worker diagnostics. A kill exit code alone never proves an OOM."""
from contextvars import ContextVar
from functools import wraps
import json
import math
from pathlib import Path
import resource
import time

_ACTIVE = ContextVar('qe_job_diagnostics', default=None)
SCHEMA = 'kristalyapi.qe-job-diagnostics.v1'
STAGES = ('relax', 'scf', 'bands', 'bands_pp', 'bands_pp_up', 'bands_pp_down', 'nscf', 'dos', 'projwfc')
CGROUP = Path('/sys/fs/cgroup')


def cgroup_path():
    try:
        for line in Path('/proc/self/cgroup').read_text().splitlines():
            if line.startswith('0::'):
                parts=Path(line[3:]).parts
                if '..' not in parts:
                    candidate=CGROUP/line[3:].lstrip('/')
                    if candidate.is_dir():return candidate
    except OSError:pass
    return CGROUP


def read_cgroup(root=None):
    root=cgroup_path() if root is None else root
    def value(name):
        try:
            text = (root/name).read_text()[:4096].strip()
            return int(text) if text.isdigit() else None
        except OSError: return None
    events = {}
    try:
        for line in (root/'memory.events').read_text()[:4096].splitlines():
            key, count = line.split()
            if count.isdigit(): events[key] = int(count)
    except (OSError, ValueError): pass
    return {'current': value('memory.current'), 'memory_limit': value('memory.max'),
            'swap_limit': value('memory.swap.max'), 'oom_kill': events.get('oom_kill')}


def classify(status, error, returncodes, oom_delta):
    text = str(error or '').lower()
    if status == 'completed': return 'completed'
    if status in ('queued', 'running'): return 'in_progress'
    if status == 'paused': return 'paused_at_stage_boundary'
    if status == 'cancelled': return 'cancelled'
    if status == 'timed_out': return 'wall_time_limit'
    if oom_delta is not None and oom_delta > 0: return 'cgroup_oom_kill'
    if 'worker restarted' in text: return 'worker_interrupted'
    if 'no space left' in text or 'disk quota exceeded' in text: return 'disk_full'
    if status == 'not_converged' or any(x in text for x in ('convergence not achieved', 'scf accuracy failed', 'not_converged')):
        return 'scf_not_converged'
    if 'energy axes mismatch' in text: return 'dos_grid_mismatch'
    if any(x in text for x in ('cannot allocate memory', 'failed to allocate', 'insufficient memory')):
        return 'memory_allocation_failed'
    if any(x in (-9, 137, -15, 143) for x in returncodes): return 'process_killed_unconfirmed'
    if 'binary unavailable' in text: return 'solver_unavailable'
    if 'resource profile' in text:return 'resource_policy_rejected'
    if 'checkpoint' in text and ('changed' in text or 'refusing resume' in text): return 'input_evidence_mismatch'
    if 'hash mismatch' in text or 'upf' in text and ('changed' in text or 'mismatch' in text):
        return 'input_evidence_mismatch'
    return 'solver_or_pipeline_failed'


def _json(path, maximum):
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > maximum: return None
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else None
    except (OSError, ValueError): return None


def stage_details(folder):
    manifest = _json(folder/'pipeline/pipeline.json', 32_000_000) or _json(folder/'pipeline.json', 100_000) or {}
    stages = []
    steps = manifest.get('steps', {})
    for name, entry in (steps.items() if isinstance(steps, dict) else []):
        if name not in STAGES or not isinstance(entry, dict): continue
        duration = entry.get('duration_seconds')
        if duration is None and entry.get('started_at') and entry.get('finished_at'):
            from datetime import datetime
            try: duration = (datetime.fromisoformat(entry['finished_at'])-datetime.fromisoformat(entry['started_at'])).total_seconds()
            except (TypeError, ValueError): pass
        stages.append({'name': name, 'status': str(entry.get('status', 'unknown'))[:30],
                       'duration_seconds': round(duration, 3) if type(duration) in (int, float) and math.isfinite(duration) and duration >= 0 else None,
                       'returncode': entry.get('returncode') if type(entry.get('returncode')) is int else None})
    progress = _json(folder/'pipeline/progress.json', 4096) or {}
    active = progress.get('active_stage')
    return stages, active if active in STAGES else None


class Recorder:
    def __init__(self, store, job):
        self.store, self.jid = store, job['id']
        self.attempt=1+job.get('resume_count',0)
        self.folder = store.root/'runs'/self.jid
        self.path = store.root/'diagnostics'/(self.jid+'.json')
        self.began = time.monotonic(); self.last_write = -1
        self.before = read_cgroup(); self.maximum = self.before['current']; self.samples = 0
        r = resource.getrusage(resource.RUSAGE_CHILDREN); self.cpu_before = r.ru_utime+r.ru_stime
        self.returncodes = []; self.phase = None; self.phase_started = {}; self.phase_details = {}
        self.tick()

    def tick(self, process=None, final=False, stage=None, done=False):
        changed = stage in STAGES and stage != self.phase
        if stage in STAGES:
            self.phase = stage
            if stage not in self.phase_started:
                self.phase_started[stage] = time.monotonic()
                self.phase_details[stage] = {'name': stage, 'status': 'running', 'duration_seconds': None, 'returncode': None}
            if done and process is not None:
                self.phase_details[stage].update(status='process_exited', returncode=process.returncode,
                    duration_seconds=round(time.monotonic()-self.phase_started[stage],3))
        if process is not None and process.returncode is not None and process.returncode not in self.returncodes:
            self.returncodes.append(process.returncode)
        elapsed = time.monotonic()-self.began
        if not final and not changed and elapsed-self.last_write < 1: return
        self.last_write = elapsed; current = read_cgroup(); self.samples += 1
        if current['current'] is not None: self.maximum = max(self.maximum or 0, current['current'])
        row = self.store.get(self.jid)
        if row is None: return
        stages, active = stage_details(self.folder)
        if not stages and self.phase_details:
            stages = list(self.phase_details.values()) if final else []
            if final and self.phase in self.phase_details:
                self.phase_details[self.phase]['status'] = row['status']
        active = active or self.phase
        delta = (max(0, current['oom_kill']-self.before['oom_kill']) if
                 current['oom_kill'] is not None and self.before['oom_kill'] is not None else None)
        r = resource.getrusage(resource.RUSAGE_CHILDREN)
        value = {'schema': SCHEMA, 'job_id': self.jid, 'availability': 'recorded', 'status': row['status'], 'execution_attempt': self.attempt,
                 'elapsed_seconds': round(elapsed, 3), 'active_stage': active if active in STAGES else None,
                 'reason_code': classify(row['status'], row['error'], self.returncodes+[s['returncode'] for s in stages], delta),
                 'process_returncodes': self.returncodes, 'stages': stages,
                 'resources': {'sampled_worker_memory_max_bytes': self.maximum, 'memory_samples': self.samples,
                               'memory_limit_bytes': current['memory_limit'], 'swap_limit_bytes': current['swap_limit'],
                               'cgroup_oom_kill_delta': delta,
                               'child_cpu_seconds': round(max(0, r.ru_utime+r.ru_stime-self.cpu_before), 3) if final else None},
                 'measurement': 'Sampled worker cgroup memory.current includes page cache and worker; not process RSS or a guaranteed peak. One worker/job at a time.'}
        try:
            self.path.parent.mkdir(exist_ok=True); temporary = self.path.with_suffix('.tmp')
            temporary.write_text(json.dumps(value, allow_nan=False)); temporary.replace(self.path)
        except OSError: pass  # Telemetry storage failure must not replace a scientific result.


def sample_job(process=None, stage=None, done=False):
    recorder = _ACTIVE.get()
    if recorder is not None:
        recorder.tick(process,stage=stage,done=done)


def record_job(function):
    @wraps(function)
    def wrapped(store, job, *args, **kwargs):
        if _ACTIVE.get() is not None: return function(store, job, *args, **kwargs)
        recorder = Recorder(store, job); token = _ACTIVE.set(recorder)
        try:
            from resource_policy import for_job,scope
            try:profile=for_job(job,store.root)
            except (OSError,ValueError) as exc:
                store.set_result(job['id'],'failed',error='Resource profile admission failed: '+str(exc)[:300]);return
            if 'timeout' in kwargs:kwargs['timeout']=min(kwargs['timeout'],profile['max_wall_seconds'])
            with scope(profile):return function(store, job, *args, **kwargs)
        finally:
            try: recorder.tick(final=True)
            finally: _ACTIVE.reset(token)
    return wrapped


def read_diagnostics(store, row):
    value = _json(store.root/'diagnostics'/(row['id']+'.json'), 65536)
    if value and value.get('schema') == SCHEMA and value.get('job_id') == row['id']:
        value['status'] = row['status']
        if value.get('reason_code') == 'in_progress' and row['status'] not in ('queued', 'running'):
            value['reason_code'] = classify(row['status'], row['error'], [], None)
        return value
    return {'schema': SCHEMA, 'job_id': row['id'], 'status': row['status'], 'availability': 'unavailable',
            'reason_code': classify(row['status'], row['error'], [], None), 'active_stage': None,
            'elapsed_seconds': None, 'resources': None, 'stages': []}
