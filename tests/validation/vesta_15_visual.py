#!/usr/bin/env python3
"""Paket V15: operator-supplied VESTA vs Kristal Yapı PNG morphology audit.

NO VESTA binary is downloaded, executed or redistributed. This does not
establish scientific equivalence, even if every visual metric is identical.
"""
from __future__ import annotations

import argparse
import csv
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CASES = Path(__file__).with_name("vesta_15_cases.json")
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_PIXELS = 4_000_000
MAX_BYTES = 30 * 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def safe_file(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute() or "\\" in value:
        raise ValueError("Evidence/source path must be a relative POSIX file path")
    base = root.resolve()
    path = (base / value).resolve()
    if not path.is_relative_to(base) or not path.is_file():
        raise ValueError("Evidence/source path missing or outside the permitted directory")
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Evidence/source exceeds size limit")
    return path


def pinned_cases(manifest: Path = DEFAULT_CASES) -> list[dict]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if data.get("schema") != "kristalyapi.vesta15.visual-cases.v1":
        raise ValueError("Unknown V15 scene manifest schema")
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("No V15 scenes declared")
    ids = set()
    for case in cases:
        cid = case.get("id")
        if not isinstance(cid, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,79}", cid) or cid in ids:
            raise ValueError("Duplicate/invalid case ID")
        ids.add(cid)
        raw = safe_file(ROOT, case["source"]).read_bytes()
        if git_blob(raw) != case["sourceGitBlobSha1"]:
            raise ValueError(f"Source Git blob SHA-1 changed: {cid}")
        case["sourceSha256"] = digest(raw)
        settings = case["settings"]
        if (settings.get("projection") != "orthographic"
                or settings.get("outputPixels") != [1024, 768]
                or settings.get("backgroundRGB") != [255, 255, 255]):
            raise ValueError(f"Unexpected V15 canonical camera/export settings: {cid}")
    return cases


def png_rgb(path: Path, background: tuple[int, int, int]) -> tuple[int, int, bytes]:
    """Strict bounded RGB/RGBA 8-bit non-interlaced PNG reader, pure stdlib."""
    source = path.read_bytes()
    if len(source) < 50 or len(source) > MAX_BYTES or not source.startswith(PNG_MAGIC):
        raise ValueError("Missing/oversized PNG")
    off = 8
    width = height = channels = None
    payload = []
    saw_end = False
    while off + 12 <= len(source):
        length = struct.unpack_from(">I", source, off)[0]
        if length > MAX_BYTES or off + 12 + length > len(source):
            raise ValueError("Broken PNG chunk length")
        tag = source[off + 4:off + 8]
        chunk = source[off + 8:off + 8 + length]
        checksum = struct.unpack_from(">I", source, off + 8 + length)[0]
        if zlib.crc32(tag + chunk) & 0xffffffff != checksum:
            raise ValueError("PNG CRC mismatch")
        off += length + 12
        if tag == b"IHDR":
            if width is not None or length != 13:
                raise ValueError("Duplicate/malformed PNG IHDR")
            width, height, depth, color, comp, filt, interlace = struct.unpack(">IIBBBBB", chunk)
            if (not width or not height or width * height > MAX_PIXELS or depth != 8
                    or color not in (2, 6) or (comp, filt, interlace) != (0, 0, 0)):
                raise ValueError("Only bounded 8-bit RGB/RGBA non-interlaced PNG is supported")
            channels = 3 if color == 2 else 4
        elif tag == b"IDAT":
            if width is None:
                raise ValueError("PNG IDAT before IHDR")
            payload.append(chunk)
        elif tag == b"IEND":
            saw_end = True
            break
        elif tag[0] & 32 == 0 and tag not in (b"PLTE",):
            raise ValueError("Unsupported critical PNG chunk")
    if not saw_end or off != len(source) or not payload:
        raise ValueError("PNG truncated/trailing data")
    pitch = width * channels
    expected = height * (pitch + 1)
    inflater = zlib.decompressobj()
    raw = inflater.decompress(b"".join(payload), expected + 1)
    if len(raw) != expected or not inflater.eof or inflater.unused_data or inflater.unconsumed_tail:
        raise ValueError("PNG decompression size mismatch")
    previous = bytearray(pitch)
    rgb = bytearray(width * height * 3)
    ptr = dest = 0
    for _ in range(height):
        kind = raw[ptr]
        ptr += 1
        scan = bytearray(raw[ptr:ptr + pitch])
        ptr += pitch
        if kind > 4:
            raise ValueError("Unsupported PNG filter")
        for i in range(pitch):
            a = scan[i - channels] if i >= channels else 0
            b = previous[i]
            c = previous[i - channels] if i >= channels else 0
            if kind == 1:
                predict = a
            elif kind == 2:
                predict = b
            elif kind == 3:
                predict = (a + b) // 2
            elif kind == 4:
                p = a + b - c
                distances = (abs(p - a), abs(p - b), abs(p - c))
                predict = (a, b, c)[distances.index(min(distances))]
            else:
                predict = 0
            scan[i] = (scan[i] + predict) & 255
        for i in range(0, pitch, channels):
            if channels == 3:
                rgb[dest:dest + 3] = scan[i:i + 3]
            else:
                alpha = scan[i + 3]
                for c in range(3):
                    rgb[dest + c] = (scan[i + c] * alpha + background[c] * (255 - alpha) + 127) // 255
            dest += 3
        previous = scan
    return width, height, bytes(rgb)


def crop(image: tuple[int, int, bytes], area: list[int]) -> tuple[int, int, bytes]:
    width, height, rgb = image
    if (not isinstance(area, list) or len(area) != 4
            or any(type(n) is not int for n in area)):
        raise ValueError("ROI must be [x,y,width,height] integers")
    x, y, w, h = area
    if min(x, y) < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
        raise ValueError("ROI outside PNG image")
    return w, h, b"".join(rgb[((y + j) * width + x) * 3:
                              ((y + j) * width + x + w) * 3] for j in range(h))


def png_write(path: Path, w: int, h: int, rgb: bytes) -> None:
    """Write a deterministic no-metadata RGB comparison triptych."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    stride = 3 * w
    data = b"".join(b"\0" + rgb[y * stride:(y + 1) * stride] for y in range(h))
    path.write_bytes(PNG_MAGIC + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(data, level=6)) + chunk(b"IEND", b""))


def metrics(vesta: tuple[int, int, bytes], app: tuple[int, int, bytes],
            background: tuple[int, int, int], threshold: int = 24) -> tuple[dict, bytes]:
    if vesta[:2] != app[:2]:
        raise ValueError("VESTA and Kristal Yapı ROI dimensions differ")
    w, h, left = vesta
    right = app[2]
    if not 0 <= threshold <= 255:
        raise ValueError("Mask threshold out of range")
    ma = [max(abs(left[i + c] - background[c]) for c in range(3)) > threshold
          for i in range(0, len(left), 3)]
    mb = [max(abs(right[i + c] - background[c]) for c in range(3)) > threshold
          for i in range(0, len(right), 3)]
    n_a, n_b = sum(ma), sum(mb)
    if not n_a or not n_b:
        raise ValueError("A comparison image has an empty foreground mask")
    intersection = sum(a and b for a, b in zip(ma, mb))
    union = sum(a or b for a, b in zip(ma, mb))
    def box(mask: list[bool]) -> list[int]:
        indexes = [i for i, value in enumerate(mask) if value]
        xs = [i % w for i in indexes]
        ys = [i // w for i in indexes]
        return [min(xs), min(ys), max(xs) + 1, max(ys) + 1]
    a_box, b_box = box(ma), box(mb)
    delta = bytes(abs(a - b) for a, b in zip(left, right))
    # Absolute pixel differences describe rendering/layout deviations only;
    # shading, AA, typography and RGB choice can dominate these metrics.
    mae = sum(delta) / len(delta)
    triptych = bytearray()
    for y in range(h):
        i = y * w * 3
        triptych.extend(left[i:i + 3 * w])
        triptych.extend(right[i:i + 3 * w])
        triptych.extend(delta[i:i + 3 * w])
    return {
        "roiPixels": [w, h],
        "foregroundPixels": {"vesta": n_a, "kristalyapi": n_b},
        "foregroundIoU": round(intersection / union, 6),
        "bboxXYXY": {"vesta": a_box, "kristalyapi": b_box},
        "bboxCenterShiftPx": [round((b_box[i] + b_box[i + 2] - a_box[i] - a_box[i + 2]) / 2, 3)
                              for i in range(2)],
        "meanAbsoluteRGBDifference255": round(mae, 5),
        "comparisonPanels": ["VESTA crop", "Kristal Yapı crop", "absolute RGB difference"],
        "warning": "Descriptive raster metric, NOT a physical, structural, volumetric or VESTA GUI parity decision",
    }, bytes(triptych)


def audited_capture(root: Path, item: dict, bg: tuple[int, int, int], expected_size: list[int]) -> tuple[int, int, bytes]:
    if not isinstance(item.get("captureMethod"), str) or len(item["captureMethod"].strip()) < 5:
        raise ValueError("Document the actual screenshot export method")
    path = safe_file(root, item.get("path"))
    content = path.read_bytes()
    stated = item.get("sha256")
    if not isinstance(stated, str) or not re.fullmatch(r"[0-9a-f]{64}", stated) or digest(content) != stated:
        raise ValueError("Actual PNG SHA-256 missing/mismatched")
    image = png_rgb(path, bg)
    if list(image[:2]) != expected_size:
        raise ValueError("Actual PNG canvas size differs from fixed outputPixels; crop exported viewer content, not browser UI")
    capture_date = item.get("captureDate")
    if not isinstance(capture_date, str) or not re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", capture_date):
        raise ValueError("Capture date missing, expected YYYY-MM-DD")
    try:
        date.fromisoformat(capture_date)
    except ValueError as exc:
        raise ValueError("Invalid calendar capture date") from exc
    return crop(image, item.get("roi"))


def link_p14_report(file: Path, cases: list[dict]) -> dict:
    """Cross-reference an external P14 audit snapshot with matching source bytes.

    The report is not cryptographically signed; a user-supplied P14 snapshot
    still requires independent provenance and human review.
    """
    if not file.is_file() or file.stat().st_size > MAX_BYTES:
        raise ValueError("Missing or oversized P14 audit report")
    payload = json.loads(file.read_text(encoding="utf-8"))
    audit = payload.get("vestaGuiEvidenceAudit")
    if (payload.get("protocol") != "package14-vesta3-manual-equations-real-cif"
            or payload.get("vestaGuiExecuted") is not True
            or payload.get("vestaGuiStatus") != "captured-human-evidence"
            or payload.get("manualScientificGate") != "PASS"
            or not isinstance(audit, dict) or audit.get("version") != "3.5.8"):
        raise ValueError("P14 must be a completed, separately GUI-audited source report")
    observed = audit.get("cases")
    if not isinstance(observed, list) or not observed:
        raise ValueError("No genuine P14 GUI measurement entries in report")
    source_manifest = json.loads((ROOT / "tests/validation/bvs_13_sources.json").read_text())
    source_index = {src["id"]: src for src in source_manifest["sources"]}
    report_index = {row["id"]: row for row in payload.get("cases", [])}
    ids = set()
    linked = []
    for row in observed:
        id_ = row.get("id")
        if id_ in ids or id_ not in report_index:
            raise ValueError("Duplicated or unknown P14 case")
        ids.add(id_)
        measure = report_index[id_]
        if (measure.get("vestaGuiStatus") != "captured-human-evidence"
                or row.get("capturedFromGui") is not True
                or not re.fullmatch(r"[0-9a-f]{64}", str(row.get("screenshotSha256")))
                or not re.fullmatch(r"[0-9a-f]{64}", str(row.get("consoleTextSha256")))):
            raise ValueError("P14 report missing authentic screenshot/transcript digest metadata")
        error = row.get("maxDistanceErrorA")
        if not isinstance(error, (int, float)) or not math.isfinite(error) or not 0 <= error <= .03:
            raise ValueError("P14 geometry error outside independently checked tolerance")
        source = source_index.get(measure.get("source"))
        if not source:
            raise ValueError("Unknown P14 source")
        for case in cases:
            if case["source"] == source["path"]:
                if case["sourceSha256"] != source["sha256"]:
                    raise ValueError("V15 source differs from P14 source SHA-256")
                linked.append({"v15Scene": case["id"], "p14Case": id_,
                               "maxDistanceErrorA": error,
                               "p14ScreenshotSha256": row["screenshotSha256"],
                               "p14TextSha256": row["consoleTextSha256"]})
    if not linked:
        raise ValueError("No V15 scene uses the submitted P14 reference sources")
    return {"status": "USER_SUPPLIED_P14_AUDIT_SNAPSHOT_HUMAN_REVIEW_REQUIRED",
            "p14ReportSha256": digest(file.read_bytes()), "linkedMeasurements": linked,
            "warning": "Report metadata/digests and known source pin cross-checked; original P14 GUI and its recorded measurements were not re-executed here."}


def run(cases: list[dict], evidence_file: Path | None, output_dir: Path,
        require_all: bool = False, p14_report: Path | None = None) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    case_index = {case["id"]: case for case in cases}
    captured = {}
    if evidence_file is not None:
        evidence = json.loads(evidence_file.read_text(encoding="utf-8"))
        if evidence.get("vestaGuiExecuted") is not True:
            raise ValueError("Real VESTA GUI execution must be explicitly asserted")
        if evidence.get("vestaVersion") != "3.5.8":
            raise ValueError("VESTA version mismatch")
        for label in ("operator", "platform", "kristalyapiCommit"):
            value = evidence.get(label)
            if not isinstance(value, str) or len(value.strip()) < 4 or value.startswith("REPLACE"):
                raise ValueError("Unfilled operator/environment/commit provenance")
        if not re.fullmatch(r"[0-9a-f]{40}", evidence["kristalyapiCommit"]):
            raise ValueError("Need full Kristal Yapı Git commit SHA")
        rows = evidence.get("cases")
        if not isinstance(rows, list) or not rows:
            raise ValueError("Evidence must contain real captured cases")
        for row in rows:
            cid = row.get("id")
            if cid not in case_index or cid in captured:
                raise ValueError("Unknown/duplicate V15 scene")
            captured[cid] = row
    statuses = []
    for case in cases:
        cid = case["id"]
        row = captured.get(cid)
        record = {"id": cid, "kind": case["kind"], "source": case["source"],
                  "sourceSha256": case["sourceSha256"], "vestaGuiStatus": "NOT_RUN",
                  "scientificParity": "NOT_ESTABLISHED", "visualMetrics": None}
        if row is not None:
            if row.get("sourceSha256") != case["sourceSha256"] or row.get("settings") != case["settings"]:
                raise ValueError(f"Unmatched source or camera/view/volume settings for {cid}")
            if case["kind"] == "volume" and case["settings"].get("isoLevel") is None:
                raise ValueError("Volumetric V15 scene requires a pinned physical scalar isolevel before real capture")
            root = evidence_file.resolve().parent
            bg = tuple(case["settings"]["backgroundRGB"])
            expected_size = case["settings"]["outputPixels"]
            left = audited_capture(root, row["vesta"], bg, expected_size)
            right = audited_capture(root, row["kristalyapi"], bg, expected_size)
            if row["vesta"].get("roi") != row["kristalyapi"].get("roi"):
                raise ValueError("Both application exports must use the identical ROI coordinates and dimensions")
            numerical, triptych = metrics(left, right, bg)
            triptych_path = output_dir / (cid + "-comparison.png")
            png_write(triptych_path, left[0] * 3, left[1], triptych)
            record.update(vestaGuiStatus="CAPTURED_HUMAN_REVIEW_REQUIRED",
                          visualMetrics=numerical,
                          comparisonPng=triptych_path.name,
                          vestaPngSha256=row["vesta"]["sha256"],
                          kristalyapiPngSha256=row["kristalyapi"]["sha256"])
        statuses.append(record)
    complete = all(row["vestaGuiStatus"] != "NOT_RUN" for row in statuses)
    result = {"schema": "kristalyapi.vesta15.visual-audit.v1",
              "vestaGuiStatus": "CAPTURED_HUMAN_REVIEW_REQUIRED" if captured else "NOT_RUN",
              "scientificParity": "NOT_ESTABLISHED",
              "evidenceComplete": complete,
              "capturedCases": len(captured), "requiredCases": len(cases),
              "cases": statuses,
              "interpretation": "Differences in camera registration, AA and lighting are descriptive. No automatic VESTA equivalence/pass.",
              "realVestaBinaryDistributed": False,
              "p14CrossReference": link_p14_report(p14_report, cases) if p14_report else None}
    (output_dir / "report.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n",
                                            encoding="utf-8")
    with (output_dir / "metrics.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["case", "status", "foreground_iou", "rgb_mae_255", "scientific_parity"])
        for row in statuses:
            m = row["visualMetrics"] or {}
            writer.writerow([row["id"], row["vestaGuiStatus"],
                             m.get("foregroundIoU", ""), m.get("meanAbsoluteRGBDifference255", ""),
                             "NOT_ESTABLISHED"])
    if require_all and not complete:
        raise ValueError("Missing actual screenshot evidence for one or more V15 scenes; scientific parity NOT established")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, help="Optional real GUI capture JSON (never bundled)")
    parser.add_argument("--out-dir", type=Path, default=ROOT / "validation-results" / "vesta15")
    parser.add_argument("--p14-report", type=Path,
                        help="Optional report from P14's own audited run; metadata cross-reference only")
    parser.add_argument("--require-all", action="store_true",
                        help="Fail until all real VESTA/app capture pairs are audited")
    args = parser.parse_args(argv)
    try:
        result = run(pinned_cases(), args.evidence, args.out_dir,
                     args.require_all, args.p14_report)
    except (ValueError, KeyError, OSError, json.JSONDecodeError, zlib.error) as exc:
        print(f"V15 evidence validation failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({k: result[k] for k in
                      ("vestaGuiStatus", "capturedCases", "requiredCases", "scientificParity")},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
