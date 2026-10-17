#!/usr/bin/env python3
"""P10.8.4: independent algorithm/threshold/fragmentation diagnostics.

Scientific comparator: pinned scikit-image Lewiner marching cubes on EXACTLY
the same trilinearly resampled Gemmi-derived voxel grid as production
marching tetrahedra. Comparing two mesh algorithms is not experimental truth.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import gemmi
import numpy as np
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes, mesh_surface_area

ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "tests/validation/volume-independent-mesh.cjs"
OUT = ROOT / "validation-results" / "volume-independent-10-8-4.json"
RESOLUTIONS = (32, 48, 64)
ALERT_AREA_CHANGE = .10
ALERT_METHOD_AREA_DISAGREEMENT = .10
MAX_SAMPLE_VERTICES = 12000


def components(vertices_index, faces, tolerance=5e-4) -> int:
    """Proxy: connected triangle components after 5e-4 voxel index snapping."""
    if faces.size == 0:
        return 0
    keys = np.rint(vertices_index / tolerance).astype(np.int64)
    _unique, vertex_index = np.unique(keys, axis=0, return_inverse=True)
    remapped = vertex_index[faces]
    n = int(vertex_index.max()) + 1
    edges = np.concatenate([
        remapped[:, (0, 1)], remapped[:, (1, 2)], remapped[:, (2, 0)]])
    graph = coo_matrix((
        np.ones(edges.shape[0] * 2, dtype=np.int8),
        (np.concatenate((edges[:, 0], edges[:, 1])),
         np.concatenate((edges[:, 1], edges[:, 0])))), shape=(n, n)).tocsr()
    count, _ = connected_components(graph, directed=False)
    return int(count)


def sample(vertices: np.ndarray) -> np.ndarray:
    if len(vertices) <= MAX_SAMPLE_VERTICES:
        return vertices
    return vertices[np.linspace(
        0, len(vertices) - 1, MAX_SAMPLE_VERTICES, dtype=np.int64)]


def nearest_vertex_proxy(a: np.ndarray, b: np.ndarray) -> dict:
    """Nearest *vertices* in Å; NOT a point-triangle Hausdorff distance."""
    a, b = sample(a), sample(b)
    da = cKDTree(b).query(a, workers=1)[0]
    db = cKDTree(a).query(b, workers=1)[0]
    d = np.concatenate((da, db))
    return dict(
        sampledVerticesA=len(a), sampledVerticesB=len(b),
        symmetricNearestVertexP50A=float(np.percentile(d, 50)),
        symmetricNearestVertexP95A=float(np.percentile(d, 95)),
        symmetricNearestVertexMaxA=float(d.max()))


def triangle_surface(vertices: np.ndarray, faces: np.ndarray) -> float:
    a, b, c = (vertices[faces[:, i]] for i in range(3))
    areas = .5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    if np.any(~np.isfinite(areas)) or np.any(areas < 1e-12):
        raise AssertionError("Zero-area or nonfinite triangle in comparison mesh")
    return float(areas.sum())


def analyze_case(directory: Path, row: dict, item: dict) -> dict:
    n = row["n"]
    shape = tuple(row["dims"])
    grid = np.fromfile(directory / row["gridFile"], dtype="<f4")
    if grid.size != n ** 3:
        raise AssertionError("Wrong native scientific voxel file length")
    grid = grid.reshape(shape)
    axes = np.asarray(row["axes"], dtype=np.float64)
    origin = np.asarray(row["origin"], dtype=np.float64)
    spacing = np.linalg.norm(axes, axis=1)
    if not (spacing.min() > 0 and np.isfinite(spacing).all()):
        raise AssertionError("Invalid Cartesian Angstrom voxel basis")
    level = item["level"]
    effective = np.pad(grid, ((0, 1),) * 3, mode="wrap") if row["periodic"] else grid
    if not (effective.min() < level < effective.max()):
        raise AssertionError(
            f"No isosurface at {n}^3: lost feature at level {level:.8g}")

    # Independent Lewiner marching cubes works in regular INDEX coordinates.
    # Both models are transformed with the same real skew Cartesian Å basis.
    reference_index, reference_faces, _normals, _values = marching_cubes(
        effective, level=float(level), step_size=1, allow_degenerate=False,
        method="lewiner", gradient_direction="descent")
    reference_world = origin + reference_index @ axes
    native_buffer = np.fromfile(directory / item["meshFile"], dtype="<f4")
    if native_buffer.size != 9 * item["triangleCount"]:
        raise AssertionError("Native mesh file has a truncated triangle buffer")
    native_world = native_buffer.reshape(-1, 3).astype(np.float64)
    native_faces = np.arange(len(native_world), dtype=np.int32).reshape(-1, 3)
    native_index = (native_world - origin) @ np.linalg.inv(axes)

    native_area = triangle_surface(native_world, native_faces)
    ref_area = float(mesh_surface_area(reference_world, reference_faces))
    if not np.isfinite(ref_area) or ref_area <= 0:
        raise AssertionError("Independent marching-cubes surface invalid")
    method_disagreement = abs(native_area - ref_area) / max(native_area, ref_area)
    distances = nearest_vertex_proxy(native_world, reference_world)
    if distances["symmetricNearestVertexP95A"] > 5 * max(spacing):
        raise AssertionError("Catastrophic spatial disagreement (5 voxel steps)")
    bound = n if row["periodic"] else n - 1
    if (np.any(native_index < -1e-3)
            or np.any(native_index > bound + 1e-3)
            or np.any(~np.isfinite(native_world))):
        raise AssertionError("Native surface escaped source voxel domain")

    # A sampled voxel-component count helps separate disconnected REAL input
    # density peaks from mesh algorithm fragmentation. Connectivity=6.
    mask = effective >= level
    voxels, _ = ndimage.label(mask, structure=ndimage.generate_binary_structure(3, 1))
    # Without periodic adjacency, this is a nonperiodic-label proxy even for
    # periodic maps, explicitly distinguished in the JSON metadata.
    return {
        "size": n,
        "level": level,
        "quantile": item["targetQuantile"],
        "native": {
            "triangles": int(item["triangleCount"]),
            "areaA2": native_area,
            "vertexSnappedComponents": components(native_index, native_faces),
        },
        "independent": {
            "triangles": len(reference_faces),
            "areaA2": ref_area,
            "vertexSnappedComponents": components(reference_index, reference_faces),
        },
        "thresholdVoxelComponents6Connected": int(_),
        "methodRelativeAreaDisagreement": method_disagreement,
        "methodDisagreementAlert": method_disagreement > ALERT_METHOD_AREA_DISAGREEMENT,
        "distances": distances,
        "stepLengthsA": spacing.tolist(),
    }


def report_source(filepath: Path, label: str, directory: Path) -> dict:
    command = subprocess.run(
        ["node", str(BRIDGE), str(filepath), str(directory), label],
        text=True, capture_output=True, timeout=150)
    if command.returncode:
        raise AssertionError(
            "P10.8.4 native bridge failed:\n" +
            command.stderr + "\n" + command.stdout)
    manifest = json.loads((directory / (label + ".json")).read_text())
    if manifest["type"] != "p10.8.4-matched-input":
        raise AssertionError("Unexpected native bridge protocol")
    if [x["n"] for x in manifest["results"]] != list(RESOLUTIONS):
        raise AssertionError("Missing 32/48/64 matched grid")
    data = []
    for row in manifest["results"]:
        for item in row["meshes"]:
            data.append(analyze_case(directory, row, item))
    if len(data) != 6:
        raise AssertionError("Expected 2 signed peak thresholds x 3 resolutions")
    series = []
    for quantile in sorted({x["quantile"] for x in data}):
        cases = sorted((x for x in data if x["quantile"] == quantile),
                       key=lambda row: row["size"])
        native = [x["native"]["areaA2"] for x in cases]
        ref = [x["independent"]["areaA2"] for x in cases]
        native_delta = abs(native[2] - native[1]) / max(native[2], native[1])
        ref_delta = abs(ref[2] - ref[1]) / max(ref[2], ref[1])
        series.append({
            "quantile": quantile,
            "nativeAreaChange48to64": native_delta,
            "independentAreaChange48to64": ref_delta,
            "bothMethodsSensitiveOver10Percent": (
                native_delta > ALERT_AREA_CHANGE
                and ref_delta > ALERT_AREA_CHANGE),
            "bothMethodsAreaChangeDifferentDirections": (
                (native[2] - native[1]) * (ref[2] - ref[1]) < 0),
            "cases": cases,
        })
        print(
            f"  q={quantile:.3f}: Δarea(48→64): "
            f"native={native_delta:.2%} independent={ref_delta:.2%}; "
            f"components64={cases[-1]['native']['vertexSnappedComponents']}/"
            f"{cases[-1]['independent']['vertexSnappedComponents']}, "
            f"method Δarea64={cases[-1]['methodRelativeAreaDisagreement']:.2%}")
    source_hash = hashlib.sha256(filepath.read_bytes()).hexdigest()
    return {
        "source": label,
        "sha256": source_hash,
        "sourceFile": filepath.name,
        "nativeDims": manifest["sourceDims"],
        "periodic": manifest["sourcePeriodic"],
        "thresholdSeries": series,
    }


def main() -> None:
    checks = []
    mtz_path = ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"
    mtz = gemmi.read_mtz_file(str(mtz_path))
    if mtz.nreflections != 367 or mtz.spacegroup.number != 5:
        raise AssertionError("Pinned experimental Gemmi 5wkd MTZ changed")

    with tempfile.TemporaryDirectory(prefix="p1084-mesher-") as folder:
        temporary = Path(folder)
        checks.append(report_source(
            ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4",
            "5i55-ccp4", temporary))
        for amp, phi, label in (
            ("FWT", "PHWT", "5wkd-FWT"),
            ("DELFWT", "PHDELWT", "5wkd-DELFWT"),
        ):
            grid = mtz.transform_f_phi_to_map(
                amp, phi, exact_size=[64, 64, 64])
            file = gemmi.Ccp4Map()
            file.grid = grid
            file.update_ccp4_header()
            location = temporary / (label + ".ccp4")
            file.write_ccp4_map(str(location))
            print(label + ":")
            checks.append(report_source(location, label, temporary))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "package": "10.8.4",
        "methods": [
            "actual production Worker marching tetrahedra on full grid",
            "independent scikit-image 0.25.2 Lewiner marching cubes",
        ],
        "matchedInput": "same Float32 grid and world-coordinate basis",
        "sources": checks,
        "limitations": [
            "An independent numerical mesher is not a ground truth.",
            "Matched-input method discrepancies isolate triangulation, "
            "not Fourier-map convergence.",
            "Nearest-vertex distances are sampled geometric proxies, not "
            "point-to-triangle Hausdorff distance or error bound.",
            "Connected-component counts use 0.0005 voxel index snapping; "
            "near-touching features can merge by definition.",
            "Voxel 6-connectivity is not periodic boundary aware.",
            "Resolution/threshold area changes are observations; a passing "
            "CI does not certify convergence of real density maps.",
            "No browser UI high-accuracy mode was enabled.",
        ]}, indent=2), encoding="utf-8")
    print(f"P10.8.4 research report: {OUT}")
    print("P10.8.4 independent-mesher diagnostic quality gate passed.")


if __name__ == "__main__":
    main()
