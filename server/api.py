"""D1 read-only QE discovery service: NO job submission or shell/paths from HTTP."""
from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from qe_probe import inspect_qe

API_VERSION = "0.1.0"


def comma_values(value):
    return [item.strip() for item in value.split(",") if item.strip()]


def create_app(*, probe=None, allowed_origins=None, allowed_hosts=None):
    origins = allowed_origins
    if origins is None:
        origins = comma_values(os.getenv("QE_ALLOWED_ORIGINS", "https://alorak.github.io"))
    hosts = allowed_hosts
    if hosts is None:
        hosts = comma_values(os.getenv("QE_ALLOWED_HOSTS", "localhost,127.0.0.1"))
    if not origins or any(not s.startswith(("https://", "http://")) or "*" in s for s in origins):
        raise ValueError("QE_ALLOWED_ORIGINS must contain exact HTTP(S) origins; wildcards forbidden")
    if not hosts or any(not s or "*" in s or "/" in s for s in hosts):
        raise ValueError("QE_ALLOWED_HOSTS must contain exact hostnames/IPs; wildcards forbidden")

    app = FastAPI(
        title="KristalYapı QE discovery API", version=API_VERSION,
        docs_url=None, redoc_url=None, openapi_url=None
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"],
                       allow_headers=[], allow_credentials=False)
    # Probe at creation once. Do not spawn pw.x on every HTTP request.
    status = probe if probe is not None else inspect_qe(
        timeout=int(os.getenv("QE_PROBE_TIMEOUT", "8")))

    @app.middleware("http")
    async def no_store(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/api/health")
    def health():
        return JSONResponse(
            status_code=200 if status["ready"] else 503,
            content={
                "status": "ready" if status["ready"] else "degraded",
                "api_version": API_VERSION,
                "engine": "quantum-espresso",
                "binary_smoke": status["binary_smoke"],
                "read_only": True,
            }
        )

    @app.get("/api/capabilities")
    def capabilities():
        return {
            "api_version": API_VERSION,
            "engine": {"id": "quantum-espresso", "version": status["qe_version"],
                       "available": status["ready"]},
            "binaries": status["binaries"],
            "supported_operations": ["health", "capabilities"],
            "job_submission_enabled": False,
            "calculations_executed_by_api": False,
            "binary_smoke": status["binary_smoke"],
            "scientific_calculation_performed": False
        }

    return app


app = create_app()
