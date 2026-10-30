# D0-D2: fixed QE baseline, SCF worker isolated from HTTP request execution.
FROM debian:trixie-slim
ARG QE_DEB_VERSION=6.7-3+b1
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 python3-fastapi python3-uvicorn \
      "quantum-espresso=${QE_DEB_VERSION}" \
    && test "$(dpkg-query -W -f='${Version}' quantum-espresso)" = "${QE_DEB_VERSION}" \
    && for tool in pw.x bands.x dos.x projwfc.x; do command -v "$tool"; done \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin qeapi \
    && mkdir -p /var/lib/qe && chown -R 10001:10001 /var/lib/qe
WORKDIR /app
COPY --chown=10001:10001 server/api.py server/qe_probe.py server/job_core.py \
     server/job_store.py server/job_diagnostics.py server/worker.py server/relax_core.py server/relax_worker.py \
     server/electronic_core.py server/electronic_worker.py server/qe_post_settings.py ./
COPY --chown=10001:10001 tools/qe_run.py tools/qe_pipeline.py tools/qe_pdos.py ./
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 QE_PROBE_TIMEOUT=8 \
    QE_JOBS_ROOT=/var/lib/qe QE_PROFILES_DIR=/profiles QE_PSEUDOS_DIR=/pseudos
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=3)" || exit 1
CMD ["python3","-m","uvicorn","api:app","--host","0.0.0.0","--port","8000","--workers","1"]
