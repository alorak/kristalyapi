"""D0-D1 contract tests use mocked Quantum ESPRESSO; no scientific result."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from api import create_app
from qe_probe import inspect_qe

READY = {
    "ready": True, "qe_version": "6.7", "binary_smoke": "pwscf_banner",
    "binaries": {"pw.x": True, "bands.x": True, "dos.x": True, "projwfc.x": True},
    "scientific_calculation_performed": False,
}
DOWN = {
    **READY, "ready": False, "qe_version": None, "binary_smoke": "unverified",
    "binaries": {**READY["binaries"], "pw.x": False},
}


class QeDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            probe=READY, allowed_origins=["https://alorak.github.io"],
            allowed_hosts=["localhost", "127.0.0.1", "192.168.1.50"]
        )
        self.client = TestClient(self.app)

    def test_health_and_capabilities_read_only_contract(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ready")
        self.assertTrue(response.json()["read_only"])
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        caps = self.client.get("/api/capabilities")
        self.assertEqual(caps.status_code, 200)
        self.assertEqual(caps.json()["engine"]["version"], "6.7")
        self.assertFalse(caps.json()["job_submission_enabled"])
        self.assertFalse(caps.json()["scientific_calculation_performed"])
        self.assertEqual(caps.json()["supported_operations"], ["health", "capabilities"])

    def test_degraded_binary_not_reported_as_ready(self):
        app = create_app(probe=DOWN, allowed_origins=["https://alorak.github.io"],
                         allowed_hosts=["localhost"])
        client = TestClient(app)
        self.assertEqual(client.get("/api/health").status_code, 503)
        self.assertEqual(client.get("/api/capabilities").json()["engine"]["available"], False)

    def test_cors_only_explicit_app_origin_and_get(self):
        ok = self.client.get("/api/health", headers={"Origin": "https://alorak.github.io"})
        self.assertEqual(ok.headers.get("access-control-allow-origin"), "https://alorak.github.io")
        evil = self.client.get("/api/health", headers={"Origin": "https://untrusted.example"})
        self.assertNotIn("access-control-allow-origin", evil.headers)
        preflight = self.client.options("/api/capabilities", headers={
            "Origin": "https://alorak.github.io",
            "Access-Control-Request-Method": "GET"})
        self.assertEqual(preflight.status_code, 200)
        disallowed = self.client.options("/api/capabilities", headers={
            "Origin": "https://alorak.github.io",
            "Access-Control-Request-Method": "POST"})
        self.assertEqual(disallowed.status_code, 400)

    def test_disallow_unconfigured_host_and_no_job_submission(self):
        host = self.client.get("/api/health", headers={"Host": "attacker.example"})
        self.assertEqual(host.status_code, 400)
        self.assertEqual(self.client.post("/api/jobs", json={}).status_code, 404)
        self.assertEqual(self.client.get("/docs").status_code, 404)
        self.assertEqual(self.client.get("/openapi.json").status_code, 404)

    def test_wildcard_origin_and_host_rejected(self):
        with self.assertRaisesRegex(ValueError, "wildcards"):
            create_app(probe=READY, allowed_origins=["*"], allowed_hosts=["localhost"])
        with self.assertRaisesRegex(ValueError, "wildcards"):
            create_app(probe=READY, allowed_origins=["https://alorak.github.io"],
                       allowed_hosts=["*"])

    def test_pwscf_binary_banner_can_return_nonzero_without_being_dft(self):
        calls = []
        def fake_which(name):
            return "/usr/bin/" + name
        def fake_run(argv, **kwargs):
            calls.append((argv, kwargs))
            return SimpleNamespace(returncode=1, stdout=b"Program PWSCF v.6.7 starts\nError reading input")
        result = inspect_qe(which=fake_which, run=fake_run)
        self.assertTrue(result["ready"])
        self.assertEqual(result["qe_version"], "6.7")
        self.assertFalse(result["scientific_calculation_performed"])
        self.assertEqual(calls[0][0][-2:], ["-in", "/dev/null"])
        self.assertNotIn("shell", calls[0][1])

    def test_no_pw_or_no_banner_stays_unavailable(self):
        result = inspect_qe(which=lambda x: None)
        self.assertFalse(result["ready"])
        no_banner = inspect_qe(which=lambda x: "/usr/bin/" + x,
            run=lambda *a, **k: SimpleNamespace(returncode=0, stdout=b"unrecognized executable"))
        self.assertFalse(no_banner["ready"])


if __name__ == "__main__":
    unittest.main()
