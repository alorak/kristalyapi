"""SQLite-backed, single-owner persisted QE job queue.

One API deployment and one worker only. Restarted running jobs are marked failed.
SQLite transactions are used to atomically claim queued work.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


class JobStore:
    def __init__(self, root):
        self.root=Path(root)
        self.root.mkdir(parents=True,exist_ok=True)
        self.db=self.root/"jobs.sqlite3"
        self._init()

    def conn(self):
        db=sqlite3.connect(self.db,timeout=15)
        db.row_factory=sqlite3.Row
        db.execute("PRAGMA busy_timeout=15000")
        return db

    def _init(self):
        with self.conn() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("BEGIN IMMEDIATE")
            db.execute("""CREATE TABLE IF NOT EXISTS jobs(
                id TEXT PRIMARY KEY, created TEXT NOT NULL, updated TEXT NOT NULL,
                status TEXT NOT NULL, request_json TEXT NOT NULL,
                structure_hash TEXT NOT NULL, profile_id TEXT NOT NULL,
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                result_json TEXT, error TEXT,
                input_sha256 TEXT, output_sha256 TEXT
            )""")
            columns={row[1] for row in db.execute('PRAGMA table_info(jobs)')}
            for name,definition in [('pause_requested','INTEGER NOT NULL DEFAULT 0'),
                                    ('resume_requested','INTEGER NOT NULL DEFAULT 0'),('resume_count','INTEGER NOT NULL DEFAULT 0'),('checkpoint_sha256','TEXT'),('resource_profile_sha256','TEXT')]:
                if name not in columns:db.execute('ALTER TABLE jobs ADD COLUMN '+name+' '+definition)
            db.execute("CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs(status,created)")

    def submit(self,payload,structure_hash,max_pending=10,resource_profile_sha=None):
        job_id=uuid4().hex
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            pending=db.execute(
                "SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running','paused')").fetchone()[0]
            if pending>=max_pending:
                raise ValueError("QE job queue is full")
            t=now()
            db.execute("INSERT INTO jobs (id,created,updated,status,request_json,structure_hash,profile_id,resource_profile_sha256) "
                       "VALUES (?,?,?,?,?,?,?,?)",
                       (job_id,t,t,"queued",json.dumps(payload,separators=(",",":")),
                        structure_hash,payload["profile_id"],resource_profile_sha))
        return job_id

    def get(self,job_id):
        with self.conn() as db:
            row=db.execute("SELECT * FROM jobs WHERE id=?",(job_id,)).fetchone()
            return dict(row) if row else None

    def list_recent(self,limit=20):
        with self.conn() as db:
            return [dict(x) for x in db.execute(
                "SELECT * FROM jobs ORDER BY created DESC LIMIT ?",(limit,)).fetchall()]

    def claim(self):
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT id FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
            if row is None:
                return None
            db.execute("UPDATE jobs SET status='running',updated=? WHERE id=? AND status='queued'",
                       (now(),row["id"]))
            return dict(db.execute("SELECT * FROM jobs WHERE id=?",(row["id"],)).fetchone())

    def set_result(self,job_id,status,*,result=None,error=None,input_sha=None,output_sha=None,checkpoint_sha=None):
        if status not in ("completed","not_converged","failed","timed_out","cancelled","paused"):
            raise ValueError("Not a terminal state")
        with self.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            if status=='paused':
                row=db.execute('SELECT cancel_requested FROM jobs WHERE id=?',(job_id,)).fetchone()
                if row and row['cancel_requested']:
                    status='cancelled';checkpoint_sha=None;error='Calculation cancelled before pause was committed'
            db.execute("UPDATE jobs SET status=?,updated=?,result_json=?,error=?,"
                       "input_sha256=?,output_sha256=?,checkpoint_sha256=? WHERE id=? AND status='running'",
                       (status,now(),json.dumps(result) if result is not None else None,
                        error,input_sha,output_sha,checkpoint_sha,job_id))

    def cancel(self,job_id):
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT status FROM jobs WHERE id=?",(job_id,)).fetchone()
            if row is None:
                return None
            if row["status"] in ("queued","paused"):
                db.execute("UPDATE jobs SET status='cancelled',cancel_requested=1,updated=? WHERE id=?",
                           (now(),job_id))
            elif row["status"]=="running":
                db.execute("UPDATE jobs SET cancel_requested=1,updated=? WHERE id=?",
                           (now(),job_id))
        return self.get(job_id)

    def pause(self,job_id):
        with self.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT status,request_json,cancel_requested FROM jobs WHERE id=?',(job_id,)).fetchone()
            if row is None or row['status']!='running' or row['cancel_requested'] or json.loads(row['request_json'])['schema']!='kristalyapi.qe-electronic-job.v1':
                raise ValueError('Only running electronic jobs support stage-boundary pause')
            db.execute('UPDATE jobs SET pause_requested=1,updated=? WHERE id=?',(now(),job_id))
        return self.get(job_id)

    def resume(self,job_id):
        with self.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT status,checkpoint_sha256,resume_count FROM jobs WHERE id=?',(job_id,)).fetchone()
            if row is None or row['status']!='paused' or not row['checkpoint_sha256'] or row['resume_count']>=20:
                raise ValueError('Only a clean paused job with a checkpoint may resume')
            db.execute("UPDATE jobs SET status='queued',pause_requested=0,resume_requested=1,resume_count=resume_count+1,error=NULL,updated=? WHERE id=?",(now(),job_id))
        return self.get(job_id)

    def interrupted(self):
        with self.conn() as db:
            db.execute("UPDATE jobs SET status='failed',error=?,updated=? WHERE status='running'",
                       ("Worker restarted: interrupted job not resumed automatically",now()))
