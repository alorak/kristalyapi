"""KristalYapı D0-D2 API. Discovery is public; real SCF jobs are opt-in/authenticated.

Only a single trusted operator/token is supported (not multi-user isolation).
For authenticated requests, use HTTPS or loopback; do not expose WAN HTTP.
"""
from __future__ import annotations

import hmac
import json
import os
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from job_core import canonical_request,load_profile
from job_store import JobStore
from qe_probe import inspect_qe

API_VERSION="0.2.0"
JOB_ID=re.compile(r"^[a-f0-9]{32}$")


def comma_values(value):
    return [x.strip() for x in value.split(",") if x.strip()]


def create_app(*,probe=None,allowed_origins=None,allowed_hosts=None,
               jobs_enabled=None,api_token=None,job_root=None,
               profiles_dir=None,pseudo_dir=None):
    origins=allowed_origins if allowed_origins is not None else comma_values(
        os.getenv("QE_ALLOWED_ORIGINS","https://alorak.github.io"))
    hosts=allowed_hosts if allowed_hosts is not None else comma_values(
        os.getenv("QE_ALLOWED_HOSTS","localhost,127.0.0.1"))
    if not origins or any(not v.startswith(("https://","http://")) or "*" in v for v in origins):
        raise ValueError("QE_ALLOWED_ORIGINS must be explicit HTTP(S) origins")
    if not hosts or any(not v or "*" in v or "/" in v for v in hosts):
        raise ValueError("QE_ALLOWED_HOSTS must be explicit hosts/IPs")

    enabled=jobs_enabled if jobs_enabled is not None else os.getenv("QE_JOBS_ENABLED","0")=="1"
    token=api_token if api_token is not None else os.getenv("QE_API_TOKEN","")
    if enabled and (len(token)<32 or len(token)>256 or any(ch.isspace() for ch in token)):
        raise ValueError("A strong >=32-character QE_API_TOKEN is mandatory for jobs")
    store=JobStore(job_root or os.getenv("QE_JOBS_ROOT","/var/lib/qe")) if enabled else None
    profiles=Path(profiles_dir or os.getenv("QE_PROFILES_DIR","/profiles"))
    pseudo=Path(pseudo_dir or os.getenv("QE_PSEUDOS_DIR","/pseudos"))
    status=probe if probe is not None else inspect_qe(
        timeout=int(os.getenv("QE_PROBE_TIMEOUT","8")))
    app=FastAPI(title="KristalYapı QE API",version=API_VERSION,
                docs_url=None,redoc_url=None,openapi_url=None)
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=hosts)
    app.add_middleware(CORSMiddleware,allow_origins=origins,
                       allow_methods=["GET","POST"] if enabled else ["GET"],
                       allow_headers=["Authorization","Content-Type"] if enabled else [],
                       allow_credentials=False)

    @app.middleware("http")
    async def no_store(request,call_next):
        response=await call_next(request)
        response.headers["Cache-Control"]="no-store"
        response.headers["X-Content-Type-Options"]="nosniff"
        response.headers["Referrer-Policy"]="no-referrer"
        return response

    @app.get("/api/health")
    def health():
        return JSONResponse(status_code=200 if status["ready"] else 503,content={
            "status":"ready" if status["ready"] else "degraded",
            "api_version":API_VERSION,"engine":"quantum-espresso",
            "binary_smoke":status["binary_smoke"],"read_only":not enabled})

    @app.get("/api/capabilities")
    def capabilities():
        return {
            "api_version":API_VERSION,
            "engine":{"id":"quantum-espresso","version":status["qe_version"],
                      "available":status["ready"]},
            "binaries":status["binaries"],
            "supported_operations":(["health","capabilities","scf","status","results","cancel"]
                                   if enabled else ["health","capabilities"]),
            "job_submission_enabled":enabled,
            "calculations_executed_by_api":False,
            "binary_smoke":status["binary_smoke"],
            "scientific_calculation_performed":False
        }

    async def authorized(request:Request):
        if not enabled:
            raise HTTPException(status_code=404,detail="Job API disabled")
        if request.url.scheme!="https" and request.url.hostname not in ("localhost","127.0.0.1","::1"):
            raise HTTPException(status_code=403,detail="Authenticated jobs require HTTPS or loopback")
        supplied=request.headers.get("Authorization","")
        if not supplied.startswith("Bearer ") or not hmac.compare_digest(supplied[7:],token):
            raise HTTPException(status_code=401,detail="Invalid API token")
        return True

    async def validated(request:Request):
        await authorized(request)
        if not status["ready"]:
            raise HTTPException(status_code=503,detail="QE engine unavailable")
        if "application/json" not in request.headers.get("Content-Type","").lower():
            raise HTTPException(status_code=415,detail="JSON Content-Type required")
        data=bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data)>65536:
                raise HTTPException(status_code=413,detail="Calculation exceeds 64 KiB")
        try:
            raw=json.loads(data.decode("utf-8"))
            payload,structure_hash=canonical_request(raw)
            upf=load_profile(payload,profiles,pseudo)
        except (ValueError,TypeError,KeyError,UnicodeError,OSError) as exc:
            raise HTTPException(status_code=422,detail=str(exc)[:300]) from exc
        return payload,structure_hash,upf

    @app.get("/api/v1/engines")
    async def engines(request:Request):
        await authorized(request)
        return {"engines":[{"id":"quantum-espresso","available":status["ready"],
                             "version":status["qe_version"],"jobs_enabled":enabled}]}

    @app.post("/api/v1/calculations/validate")
    async def validate(request:Request):
        payload,fingerprint,upf=await validated(request)
        return {"valid":True,"structure_hash":fingerprint,"atoms":len(payload["structure"]["atoms"]),
                "profile_id":payload["profile_id"],"upf_sha256":{k:v["sha256"] for k,v in upf.items()},
                "calculation":"scf","notice":"Validation is not a DFT convergence study"}

    @app.post("/api/v1/calculations",status_code=202)
    async def submit(request:Request):
        payload,fingerprint,_=await validated(request)
        try:
            job_id=store.submit(payload,fingerprint,max_pending=10)
        except ValueError as exc:
            raise HTTPException(status_code=429,detail=str(exc)) from exc
        return {"job_id":job_id,"status":"queued","structure_hash":fingerprint}

    def public_job(row):
        return {"job_id":row["id"],"status":row["status"],"created":row["created"],
                "updated":row["updated"],"structure_hash":row["structure_hash"],
                "profile_id":row["profile_id"],"cancel_requested":bool(row["cancel_requested"]),
                "error":row["error"]}

    async def lookup(request,job_id):
        await authorized(request)
        if not JOB_ID.fullmatch(job_id):
            raise HTTPException(status_code=404,detail="No such job")
        row=store.get(job_id)
        if row is None:
            raise HTTPException(status_code=404,detail="No such job")
        return row

    @app.get("/api/v1/calculations")
    async def listing(request:Request):
        await authorized(request)
        return {"jobs":[public_job(r) for r in store.list_recent()]}

    @app.get("/api/v1/calculations/{job_id}")
    async def get_job(request:Request,job_id:str):
        return public_job(await lookup(request,job_id))

    @app.get("/api/v1/calculations/{job_id}/results")
    async def get_result(request:Request,job_id:str):
        row=await lookup(request,job_id)
        if row["status"]!="completed" or row["result_json"] is None:
            raise HTTPException(status_code=409,detail="No converged result for this job")
        return json.loads(row["result_json"])

    @app.get("/api/v1/calculations/{job_id}/logs")
    async def get_logs(request:Request,job_id:str):
        await lookup(request,job_id)
        path=store.root/"runs"/job_id/"structure.out"
        if not path.is_file() or path.is_symlink():
            return {"text":"","truncated":False}
        # Never return a full unbounded log or arbitrary file path.
        size=path.stat().st_size
        with path.open("rb") as f:
            f.seek(max(0,size-12000))
            data=f.read(12000)
        return {"text":data.decode("utf-8",errors="replace"),"truncated":size>12000}

    @app.post("/api/v1/calculations/{job_id}/cancel")
    async def cancel_job(request:Request,job_id:str):
        await lookup(request,job_id)
        return public_job(store.cancel(job_id))

    return app


app=create_app()
