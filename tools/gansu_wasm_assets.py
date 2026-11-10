#!/usr/bin/env python3
"""Install only pinned upstream GANSU Lite WASM binaries for same-origin use.

The JS worker, STO-3G basis and license are committed and SHA-pinned in Git.
The two ~0.5 MB WASM binaries are fetched from the immutable upstream commit
only during site/test build, not during scientific calculations.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

UPSTREAM_COMMIT = "58237bc616e9795f393b3d5272805ecef6d377ad"
BASE_URL = (
    "https://raw.githubusercontent.com/Yasuaki-Ito/GANSU-Lite/"
    + UPSTREAM_COMMIT + "/docs/wasm/"
)
ASSETS = {
    "wasm_eri_bg.wasm": ("00622ef17da091692d6ddb298f1433ba3ea36eb1", 492780),
    "wasm_eri_simd_bg.wasm": ("820eeafbd8dc701659217c5781b9341f91e3b9e3", 499944),
}
STATIC_BLOBS = {
    "scf-worker.js": "12abad7da0324589d51b96698e1ee4ff765ca763",
    "basis/sto-3g.gbs": "2c6b503c18c6f344a3afd5b0df492fbaabd60884",
    "LICENSE": "61618c53386a9834e13107cfcd521b65dab154a3",
}


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def verified_bytes(data: bytes, sha: str, size: int | None = None) -> None:
    if size is not None and len(data) != size:
        raise ValueError(f"Unexpected binary length: {len(data)} bytes, wanted {size}")
    actual = git_blob_sha(data)
    if actual != sha:
        raise ValueError(f"GANSU asset SHA-1 mismatch: expected {sha}, got {actual}")


def install(root: Path, *, offline: bool) -> None:
    root = root.resolve()
    for name, sha in STATIC_BLOBS.items():
        p = root / name
        verified_bytes(p.read_bytes(), sha)

    dest = root / "wasm"
    dest.mkdir(parents=True, exist_ok=True)
    for name, (sha, length) in ASSETS.items():
        output = dest / name
        if output.exists():
            try:
                verified_bytes(output.read_bytes(), sha, length)
                print(f"GANSU WASM verified: {output} ({length} bytes)")
                continue
            except ValueError:
                if offline:
                    raise
        if offline:
            raise FileNotFoundError(f"Missing pinned GANSU WASM binary: {output}")
        url = BASE_URL + name
        req = Request(url, headers={"User-Agent": "kristalyapi-pinned-gansu-binary-fetch/1"})
        try:
            with urlopen(req, timeout=40) as response:
                if response.status != 200 or response.geturl() != url:
                    raise ValueError("Unexpected GANSU download response/redirect")
                data = response.read(length + 1)
        except (HTTPError, URLError) as exc:
            raise RuntimeError("Pinned upstream WASM download failed; cannot deploy GANSU") from exc
        verified_bytes(data, sha, length)
        if data[:4] != b"\x00asm":
            raise ValueError("Invalid WebAssembly binary magic")
        fd, tmp = tempfile.mkstemp(prefix=".gansu-wasm-", dir=str(dest))
        try:
            with os.fdopen(fd, "wb") as out:
                out.write(data)
            os.replace(tmp, output)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
        print(f"GANSU WASM installed: {output} ({length} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="vendor/gansu-lite")
    parser.add_argument("--offline", action="store_true", help="Verify all files without network")
    args = parser.parse_args()
    install(Path(args.root), offline=args.offline)
