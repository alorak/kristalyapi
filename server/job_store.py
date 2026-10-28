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
            db.execute("""CREATE TABLE IF NOT EXISTS jobs(
                id TEXT PRIMARY KEY, created TEXT NOT NULL, updated TEXT NOT NULL,
                status TEXT NOT NULL, request_json TEXT NOT NULL,
                structure_hash TEXT NOT NULL, profile_id TEXT NOT NULL,
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                result_json TEXT, error TEXT,
                input_sha256 TEXT, output_sha256 TEXT
            )""")
            db.execute("CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs(status,created)")

    def submit(self,payload,structure_hash,max_pending=10):
        job_id=uuid4().hex
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            pending=db.execute(
                "SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]
            if pending>=max_pending:
                raise ValueError("QE job queue is full")
            t=now()
            db.execute("INSERT INTO jobs (id,created,updated,status,request_json,structure_hash,profile_id) "
                       "VALUES (?,?,?,?,?,?,?)",
                       (job_id,t,t,"queued",json.dumps(payload,separators=(",",":")),
                        structure_hash,payload["profile_id"]))
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
            return self.get(row["id"])

    def set_result(self,job_id,status,*,result=None,error=None,input_sha=None,output_sha=None):
        if status not in ("completed","not_converged","failed","timed_out","cancelled"):
            raise ValueError("Not a terminal state")
        with self.conn() as db:
            db.execute("UPDATE jobs SET status=?,updated=?,result_json=?,error=?,"
                       "input_sha256=?,output_sha256=? WHERE id=? AND status='running'",
                       (status,now(),json.dumps(result) if result is not None else None,
                        error,input_sha,output_sha,job_id))

    def cancel(self,job_id):
        with self.conn() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT status FROM jobs WHERE id=?",(job_id,)).fetchone()
            if row is None:
                return None
            if row["status"]=="queued":
                db.execute("UPDATE jobs SET status='cancelled',cancel_requested=1,updated=? WHERE id=?",
                           (now(),job_id))
            elif row["status"]=="running":
                db.execute("UPDATE jobs SET cancel_requested=1,updated=? WHERE id=?",
                           (now(),job_id))
        return self.get(job_id)

    def interrupted(self):
        with self.conn() as db:
            db.execute("UPDATE jobs SET status='failed',error=?,updated=? WHERE status='running'",
                       ("Worker restarted: interrupted job not resumed automatically",now()))
