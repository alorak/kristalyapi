#!/usr/bin/env python3
"""V15.1 operator capture companion; prepares and seals genuine, local-only PNG evidence.

Never launches VESTA, never fabricates screenshots, never asserts GUI execution.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

from vesta_15_visual import digest, pinned_cases, png_rgb, safe_file

CASE_ID = re.compile(r"[a-z0-9][a-z0-9-]{2,79}")
COMMIT = re.compile(r"[0-9a-f]{40}")


def _manifest(path: Path) -> Path:
    return path.resolve() / "capture.json"


def _write(file: Path, payload: dict) -> None:
    # Avoid writing the private evidence manifest through a symlink.
    if file.is_symlink():
        raise ValueError("Refusing symlink evidence manifest")
    tmp = file.with_suffix(".json.tmp")
    if tmp.exists() or tmp.is_symlink():
        raise ValueError("Temporary manifest file already exists; resolve manually")
    try:
        with tmp.open("x", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        tmp.replace(file)
    finally:
        if tmp.exists():
            tmp.unlink()


def prepare(root: Path, commit: str, selected: list[str] | None = None,
            cases: list[dict] | None = None) -> dict:
    if not COMMIT.fullmatch(commit):
        raise ValueError("A full 40-character Kristal Yapı commit SHA is required")
    cases = pinned_cases() if cases is None else cases
    requested = set(selected or (case["id"] for case in cases))
    known = {case["id"] for case in cases}
    if not requested or not requested <= known:
        raise ValueError("Unknown or empty scene selection")
    root = root.resolve()
    if root.exists() and (not root.is_dir() or any(root.iterdir())):
        raise ValueError("The private capture folder must be new or empty (never overwrite evidence)")
    root.mkdir(parents=True, exist_ok=True)
    result = {"vestaGuiExecuted": False, "vestaVersion": "3.5.8",
              "operator": "REPLACE_WITH_OPERATOR", "platform": "REPLACE_WITH_OS_AND_RENDER_SETUP",
              "kristalyapiCommit": commit, "cases": []}
    for case in cases:
        if case["id"] not in requested:
            continue
        cid = case["id"]
        image_roi = [0, 0, *case["settings"]["outputPixels"]]
        record = {"id": cid, "sourceSha256": case["sourceSha256"], "settings": case["settings"],
                  "vesta": {"path": cid + "-vesta.png", "sha256": "REPLACE_WITH_PNG_SHA256",
                            "roi": image_roi, "captureMethod": "File > Export Raster Image",
                            "captureDate": "REPLACE_WITH_YYYY-MM-DD"},
                  "kristalyapi": {"path": cid + "-kristalyapi.png", "sha256": "REPLACE_WITH_PNG_SHA256",
                                  "roi": image_roi, "captureMethod": "Save > PNG",
                                  "captureDate": "REPLACE_WITH_YYYY-MM-DD"}}
        result["cases"].append(record)
    _write(_manifest(root), result)
    return result


def seal(root: Path, cases: list[dict] | None = None) -> dict:
    """Read actual PNG bytes and pin their digests; NEVER set vestaGuiExecuted."""
    cases = pinned_cases() if cases is None else cases
    file = _manifest(root)
    if file.is_symlink() or not file.is_file():
        raise ValueError("Private capture manifest missing or a symlink")
    payload = json.loads(file.read_text(encoding="utf-8"))
    if payload.get("vestaVersion") != "3.5.8" or not COMMIT.fullmatch(payload.get("kristalyapiCommit", "")):
        raise ValueError("Unsupported VESTA version / incomplete Kristal Yapı commit")
    if payload.get("vestaGuiExecuted") is not False:
        raise ValueError("Sealing requires vestaGuiExecuted=false; attest manually only after GUI capture")
    spec = {case["id"]: case for case in cases}
    records = payload.get("cases")
    if not isinstance(records, list) or not records:
        raise ValueError("No captures to seal")
    seen = set()
    changes = 0
    for record in records:
        cid = record.get("id")
        if cid not in spec or cid in seen:
            raise ValueError("Unrecognized/duplicate scene in capture")
        seen.add(cid)
        scene = spec[cid]
        if record.get("sourceSha256") != scene["sourceSha256"] or record.get("settings") != scene["settings"]:
            raise ValueError("Captured source/settings differ from immutable scene manifest")
        if scene["kind"] == "volume" and scene["settings"].get("isoLevel") is None:
            raise ValueError("Volume scene must have pinned isolevel before sealing")
        for product in ("vesta", "kristalyapi"):
            item = record.get(product)
            if not isinstance(item, dict):
                raise ValueError("Missing VESTA/Kristal Yapı image slot")
            name = item.get("path")
            if (not isinstance(name, str) or not name or Path(name).is_absolute()
                    or ".." in Path(name).parts or "\\\\" in name):
                raise ValueError("Image path outside permitted evidence folder")
            path = root.resolve() / name
            if path.exists():
                # Reject pre-existing directory links and accidental out-of-root captures.
                file_path = safe_file(root.resolve(), item["path"])
                data = file_path.read_bytes()
                w, h, _ = png_rgb(file_path, tuple(scene["settings"]["backgroundRGB"]))
                if [w, h] != scene["settings"]["outputPixels"]:
                    raise ValueError("PNG exported at the wrong canvas dimensions")
                if item.get("roi") != [0, 0, w, h]:
                    raise ValueError("Initial V15.1 capture must use uncropped full-image ROI")
                new_sha = digest(data)
                old_sha = item.get("sha256")
                if old_sha != "REPLACE_WITH_PNG_SHA256" and old_sha != new_sha:
                    raise ValueError("Existing pinned PNG SHA-256 changed: " + cid + "/" + product)
                item["sha256"] = new_sha
                changes += 1
    _write(file, payload)
    return {"scenes": len(records), "sealedImages": changes,
            "attestedGuiExecuted": False,
            "notice": "Hashes sealed; operator must perform actual VESTA capture and explicitly attest separately"}


def status(root: Path, cases: list[dict] | None = None) -> dict:
    cases = pinned_cases() if cases is None else cases
    file = _manifest(root)
    if not file.is_file():
        raise ValueError("No capture.json to audit")
    payload = json.loads(file.read_text(encoding="utf-8"))
    by_id = {case["id"]: case for case in cases}
    rows = []
    for label in ("operator", "platform"):
        value = payload.get(label)
        if not isinstance(value, str) or len(value.strip()) < 4 or value.startswith("REPLACE"):
            # The input has insufficient provenance even when both PNGs are pinned.
            global_blocker = "operator/platform provenance incomplete"
            break
    else:
        global_blocker = None
    if payload.get("vestaVersion") != "3.5.8" or not COMMIT.fullmatch(payload.get("kristalyapiCommit", "")):
        global_blocker = "VESTA version or commit identity invalid"
    for record in payload.get("cases", []):
        scene = by_id.get(record.get("id"))
        if not scene:
            raise ValueError("Unknown scene in capture manifest")
        blockers = [global_blocker] if global_blocker else []
        if record.get("sourceSha256") != scene["sourceSha256"] or record.get("settings") != scene["settings"]:
            blockers.append("source/camera settings do not match pinned scene")
        if scene["kind"] == "volume" and scene["settings"].get("isoLevel") is None:
            blockers.append("absolute isolevel not pinned")
        for product in ("vesta", "kristalyapi"):
            item = record.get(product, {})
            try:
                f = safe_file(root.resolve(), item.get("path"))
                if digest(f.read_bytes()) != item.get("sha256"):
                    blockers.append(product + " image hash mismatch")
                else:
                    dims = png_rgb(f, tuple(scene["settings"]["backgroundRGB"]))[:2]
                    if list(dims) != scene["settings"]["outputPixels"]:
                        blockers.append(product + " canvas size mismatch")
            except (KeyError, ValueError, OSError, TypeError):
                blockers.append(product + " PNG missing or invalid")
            captured = item.get("captureDate")
            if not isinstance(captured, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", captured):
                blockers.append(product + " capture date missing")
            if not isinstance(item.get("captureMethod"), str) or len(item["captureMethod"].strip()) < 5:
                blockers.append(product + " capture method missing")
            if item.get("roi") != [0, 0, *scene["settings"]["outputPixels"]]:
                blockers.append(product + " capture ROI does not match whole exported canvas")
        if payload.get("vestaGuiExecuted") is not True:
            blockers.append("real VESTA GUI execution not operator-attested")
        rows.append({"id": record["id"], "readyForAudit": not blockers, "blockers": blockers})
    return {"scientificParity": "NOT_ESTABLISHED", "cases": rows,
            "ready": sum(row["readyForAudit"] for row in rows),
            "total": len(rows)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="action", required=True)
    prepare_cli = subs.add_parser("prepare")
    prepare_cli.add_argument("--dir", type=Path, required=True)
    prepare_cli.add_argument("--commit", required=True)
    prepare_cli.add_argument("--case", action="append", default=[], dest="selected")
    seal_cli = subs.add_parser("seal")
    seal_cli.add_argument("--dir", type=Path, required=True)
    status_cli = subs.add_parser("status")
    status_cli.add_argument("--dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.action == "prepare":
            result = prepare(args.dir, args.commit, args.selected)
        elif args.action == "seal":
            result = seal(args.dir)
        else:
            result = status(args.dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (ValueError, OSError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print("V15.1 capture failed: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
