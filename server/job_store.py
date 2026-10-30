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
                                    ('resume_requested','INTEGER NOT NULL DEFAULT 0'),('resume_count','INTEGER NOT NULL DEFAULT 0'),('checkpoint_sha256','TEXT'),('resource_profile_sha256','TEXT'),('label','TEXT NOT NULL DEFAULT \'\''),('calculation','TEXT')]:
                if name not in columns:db.execute('ALTER TABLE jobs ADD COLUMN '+name+' '+definition)
            # Historical databases predate the calculation column. Do not
            # requeue or rewrite request snapshots during migration.
            for row in db.execute("SELECT id,request_json FROM jobs WHERE calculation IS NULL"):
                calculation=json.loads(row["request_json"])["parameters"]["calculation"]
                db.execute("UPDATE jobs SET calculation=? WHERE id=?",(calculation,row["id"]))
            db.execute("CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs(status,created)")
            db.execute("CREATE INDEX IF NOT EXISTS jobs_by_recent ON jobs(created DESC,id DESC)")
            db.execute("CREATE INDEX IF NOT EXISTS jobs_by_calculation ON jobs(calculation,created DESC)")

    def submit(self,payload,structure_hash,max_pending=10,resource_profile_sha=None):
        job_id=uuid4().hex
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            pending=db.execute(
                "SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running','paused')").fetchone()[0]
            if pending>=max_pending:
                raise ValueError("QE job queue is full")
            t=now()
            db.execute("INSERT INTO jobs (id,created,updated,status,request_json,structure_hash,profile_id,resource_profile_sha256,calculation) "
                       "VALUES (?,?,?,?,?,?,?,?,?)",
                       (job_id,t,t,"queued",json.dumps(payload,separators=(",",":")),
                        structure_hash,payload["profile_id"],resource_profile_sha,payload["parameters"]["calculation"]))
        return job_id

    def get(self,job_id):
        with self.conn() as db:
            row=db.execute("SELECT * FROM jobs WHERE id=?",(job_id,)).fetchone()
            return dict(row) if row else None

    def list_page(self,limit=20,offset=0,*,status=None,calculation=None,query=""):
        if type(limit) is not int or not 1<=limit<=50 or type(offset) is not int or not 0<=offset<=10000:
            raise ValueError("Invalid history page")
        allowed_status={"queued","running","paused","completed","failed","timed_out","cancelled","not_converged"}
        if status is not None and status not in allowed_status:
            raise ValueError("Invalid job status filter")
        if calculation is not None and calculation not in {"scf","relax-scf","electronic"}:
            raise ValueError("Invalid calculation filter")
        if not isinstance(query,str) or len(query)>64 or any(ord(c)<32 for c in query):
            raise ValueError("Invalid search term")
        filters=[];args=[]
        if status:
            filters.append("status=?");args.append(status)
        if calculation:
            filters.append("calculation=?");args.append(calculation)
        if query:
            # Treat LIKE metacharacters literally, not as wildcard search.
            escaped=query.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            filters.append("(id LIKE ? ESCAPE '\\' OR label LIKE ? ESCAPE '\\' OR profile_id LIKE ? ESCAPE '\\' OR structure_hash LIKE ? ESCAPE '\\')")
            args.extend(["%"+escaped+"%"]*4)
        where=" WHERE "+" AND ".join(filters) if filters else ""
        with self.conn() as db:
            total=db.execute("SELECT COUNT(*) FROM jobs"+where,args).fetchone()[0]
            rows=[dict(x) for x in db.execute(
                "SELECT * FROM jobs"+where+" ORDER BY created DESC,id DESC LIMIT ? OFFSET ?",
                [*args,limit,offset]).fetchall()]
            return rows,total

    def list_recent(self,limit=20):
        return self.list_page(limit)[0]

    def set_label(self,job_id,label):
        if not isinstance(label,str) or len(label)>60 or any(ord(ch)<32 or ord(ch)==127 for ch in label):
            raise ValueError("Job name must be at most 60 printable characters")
        clean=label.strip()
        with self.conn() as db:
            result=db.execute("UPDATE jobs SET label=? WHERE id=?",(clean,job_id))
            if result.rowcount!=1:
                raise ValueError("No such job")
        return self.get(job_id)

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
            if row is None or row['status']!='running' or row['cancel_requested'] or json.loads(row['request_json'])['schema'] not in ('kristalyapi.qe-electronic-job.v1','kristalyapi.qe-electronic-job.v2'):
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
