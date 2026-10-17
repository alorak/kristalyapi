#!/usr/bin/env python3
"""P10.8.5: diagnose REAL-map sampling, sparse peaks and isolevel sensitivity.

Uses the application's actual CCP4 reader/trilinear resampler, independently
measures the resulting Float32 grids with NumPy/SciPy/scikit-image, and keeps
scientific non-convergence as a *reported finding*, never a false CI pass.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import gemmi
import numpy as np
import scipy
import skimage
from scipy import ndimage
from skimage.measure import marching_cubes, mesh_surface_area

ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "tests/validation/volume-sampling-grid.cjs"
OUT = ROOT / "validation-results/volume-sampling-10-8-5.json"
RESOLUTIONS = (32, 48, 64)
UPPER_TAIL_QUANTILES = (.99, .995)
RELATIVE_LEVEL_SHIFT = .02  # of source peak-minus-median *scalar* contrast
RESEARCH_ALERT = .10
NEAR_NYQUIST_FRACTION = .70
SIX_CONNECTED = ndimage.generate_binary_structure(3, 1)


def relative_change(a: float, b: float) -> float:
    return abs(a - b) / max(abs(a), abs(b), 1e-12)


def source_gap_levels(source_score: np.ndarray) -> list[dict]:
    """Source-fixed levels, *not* a separately drifting percentile per grid.

    Choose an actual distinct-value gap adjacent to the empirical quantile;
    mid-gap levels avoid exactly coincident contour vertices. Unlike P10.8.4's
    largest-nearby-gap choice this does not search for an unusually wide gap.
    """
    ordered = np.sort(source_score.ravel().astype(np.float64))
    if not np.isfinite(ordered).all() or ordered[-1] <= ordered[0]:
        raise AssertionError("Source contains nonfinite/constant density")
    answer = []
    for q in UPPER_TAIL_QUANTILES:
        anchor = ordered[int(np.floor((len(ordered) - 1) * q))]
        right = int(np.searchsorted(ordered, anchor, side="right"))
        if right < len(ordered):
            low, high = anchor, ordered[right]
        else:
            left = int(np.searchsorted(ordered, anchor, side="left"))
            if left == 0:
                raise AssertionError("No distinct samples at upper-tail contour")
            low, high = ordered[left - 1], anchor
        level = low + (high - low) / 2
        if not ordered[0] < level < ordered[-1]:
            raise AssertionError("Upper-tail level outside source range")
        answer.append({"upperTailQuantile": q, "scoreLevel": float(level),
                       "sourceLevelGap": float(high - low)})
    return answer


def nyquist_band_fraction(score: np.ndarray, periodic: bool) -> float:
    """Fraction of grid-index FFT energy near Nyquist, not physical alias proof.

    Taper open map boundaries to reduce endpoint discontinuities; periodic maps
    remain untapered. The diagnostic's index-frequency meaning *changes* as
    spatial grid spacing changes, so compare with this qualification only.
    """
    centered = score.astype(np.float64) - float(np.mean(score))
    if not periodic:
        for axis, n in enumerate(score.shape):
            window = np.hanning(n)
            shape = [1, 1, 1]
            shape[axis] = n
            centered = centered * window.reshape(shape)
    power = np.abs(np.fft.fftn(centered)) ** 2
    total = float(power.sum())
    if total <= 1e-24:
        return 0.0
    frequency = [np.abs(np.fft.fftfreq(n)) for n in score.shape]
    near_edge = ((frequency[0][:, None, None] >= .5 * NEAR_NYQUIST_FRACTION)
                 | (frequency[1][None, :, None] >= .5 * NEAR_NYQUIST_FRACTION)
                 | (frequency[2][None, None, :] >= .5 * NEAR_NYQUIST_FRACTION))
    fraction = float(power[near_edge].sum() / total)
    if not 0 <= fraction <= 1 + 1e-12:
        raise AssertionError("Invalid spectral energy fraction")
    return min(1.0, fraction)


def isolevel_metrics(score: np.ndarray, level: float, axes: np.ndarray,
                     origin: np.ndarray, periodic: bool) -> dict:
    """Tail occupancy and nonperiodic 6-neighbor fragmentation are *proxies*."""
    mask = score >= level
    count = int(np.count_nonzero(mask))
    voxels = int(mask.size)
    components, labels = 0, None
    if count:
        labels, components = ndimage.label(mask, structure=SIX_CONNECTED)
    largest = (int(np.bincount(labels.ravel())[1:].max()) if components else 0)
    result = {"occupiedNodes": count, "occupiedNodeFraction": count / voxels,
              "voxelComponents6ConnectedNonperiodic": int(components),
              "largestComponentNodeFraction": largest / max(count, 1),
              "surfaceAreaA2": None, "surfaceState": "crossing"}
    if count in (0, voxels):
        result["surfaceState"] = "empty" if count == 0 else "full"
        return result

    # The same original Float32 voxels and oblique Å basis feed the independent
    # extractor. A periodic grid needs an additional wrapped end plane.
    field = np.pad(score, ((0, 1),) * 3, mode="wrap") if periodic else score
    vertices, faces, _normals, _values = marching_cubes(
        field.astype(np.float32), level=float(level),
        step_size=1, allow_degenerate=False, method="lewiner")
    world = origin + vertices @ axes
    area = float(mesh_surface_area(world, faces))
    if not np.isfinite(area) or area <= 0:
        raise AssertionError("Nonfinite/degenerate independent isosurface area")
    result["surfaceAreaA2"] = area
    return result


def measure_grid(values: np.ndarray, sign: int, axes: np.ndarray,
                 origin: np.ndarray, periodic: bool, base: float,
                 delta: float) -> dict:
    if sign not in (-1, 1):
        raise ValueError("Only positive or negative tail is supported")
    score = sign * values.astype(np.float64)
    shifts = [("below", base - delta), ("baseline", base),
              ("above", base + delta)]
    measured = {name: {"signedSourceLevel": float(sign * level),
                       **isolevel_metrics(score, level, axes, origin, periodic)}
                for name, level in shifts}
    base_area = measured["baseline"]["surfaceAreaA2"]
    sensitivity = {
        name: (relative_change(base_area, value["surfaceAreaA2"])
               if base_area is not None and value["surfaceAreaA2"] is not None
               else None)
        for name, value in measured.items() if name != "baseline"
    }
    peak_idx = np.unravel_index(int(np.argmax(score)), score.shape)
    peak_world = origin + np.array(peak_idx) @ axes
    return {
        "signedTail": "positive" if sign == 1 else "negative",
        "sourceScalePeakScore": float(score.max()),
        "peakGridIndex": list(map(int, peak_idx)),
        "peakCartesianA": peak_world.tolist(),
        "nearNyquistIndexEnergyFraction": nyquist_band_fraction(score, periodic),
        "stepLengthsA": np.linalg.norm(axes, axis=1).tolist(),
        "levels": measured, "thresholdAreaSensitivity": sensitivity,
        "thresholdSensitivityAlert": any(
            x is None or x > RESEARCH_ALERT for x in sensitivity.values()),
    }


def read_grid(folder: Path, row: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    shape = tuple(row["dims"])
    if len(shape) != 3 or any(n < 2 for n in shape):
        raise AssertionError("Invalid source or resampled shape")
    data = np.fromfile(folder / row["file"], dtype="<f4")
    if data.size != int(np.prod(shape)) or not np.isfinite(data).all():
        raise AssertionError("Truncated or nonfinite source-derived voxel grid")
    axes = np.asarray(row["axes"], dtype=np.float64)
    origin = np.asarray(row["origin"], dtype=np.float64)
    if axes.shape != (3, 3) or origin.shape != (3,):
        raise AssertionError("Incorrect Cartesian voxel frame")
    if not np.isfinite(axes).all() or not np.isfinite(origin).all():
        raise AssertionError("Nonfinite physical grid frame")
    if abs(float(np.linalg.det(axes))) <= 1e-12:
        raise AssertionError("Singular voxel frame")
    return data.reshape(shape), axes, origin


def check_extents(source_row: dict, row: dict) -> None:
    """Reject sampling that silently changes the physical source domain."""
    def extent(item: dict) -> np.ndarray:
        cells = np.asarray(item["dims"], dtype=np.float64)
        if not item["periodic"]:
            cells -= 1
        return np.asarray(item["axes"], dtype=np.float64) * cells[:, None]
    if bool(source_row["periodic"]) != bool(row["periodic"]):
        raise AssertionError("Source/sampled periodicity changed")
    a, b = extent(source_row), extent(row)
    if not np.allclose(a, b, atol=2e-5, rtol=2e-6):
        raise AssertionError("Resampling changed physical source domain")
    if not np.allclose(source_row["origin"], row["origin"], atol=1e-6):
        raise AssertionError("Resampling changed physical origin")


def analyze_source(source_path: Path, label: str, sign: int,
                   folder: Path) -> dict:
    task = subprocess.run(
        ["node", str(BRIDGE), str(source_path), str(folder), label,
         "positive" if sign == 1 else "negative"],
        capture_output=True, text=True, timeout=150, cwd=ROOT)
    if task.returncode:
        raise AssertionError(f"Native resampling failed: {task.stderr}\n{task.stdout}")
    manifest = json.loads((folder / f"{label}-sampling.json").read_text())
    if manifest["protocol"] != "p10.8.5-source-and-resampling":
        raise AssertionError("Unexpected sampling bridge protocol")
    if [r["n"] for r in manifest["sampled"]] != list(RESOLUTIONS):
        raise AssertionError("Missing scientific sampling resolutions")
    raw, source_axes, source_origin = read_grid(folder, manifest["original"])
    score = sign * raw.astype(np.float64)
    peak = float(score.max())
    median = float(np.median(score))
    contrast = peak - median
    if not contrast > 0:
        raise AssertionError("No signed real-map peak above source median")
    delta = RELATIVE_LEVEL_SHIFT * contrast
    original_peak_index = np.unravel_index(int(np.argmax(score)), score.shape)
    original_peak = source_origin + np.asarray(original_peak_index) @ source_axes
    levels = source_gap_levels(score)
    source_tail = []
    for level in levels:
        mask = score >= level["scoreLevel"]
        _labels, components = ndimage.label(mask, structure=SIX_CONNECTED)
        source_tail.append({
            "upperTailQuantile": level["upperTailQuantile"],
            "occupiedNodes": int(mask.sum()),
            "occupiedNodeFraction": float(mask.mean()),
            "voxelComponents6ConnectedNonperiodic": int(components),
        })
    grids = []
    for row in manifest["sampled"]:
        check_extents(manifest["original"], row)
        values, axes, origin = read_grid(folder, row)
        measured = [measure_grid(values, sign, axes, origin,
                                 bool(row["periodic"]), level["scoreLevel"], delta)
                    for level in levels]
        grid_peak = max(x["sourceScalePeakScore"] for x in measured)
        if grid_peak > peak + max(1e-5, abs(peak) * 1e-5):
            raise AssertionError("Trilinear resampling exceeded source peak")
        grids.append({
            "size": row["n"],
            "peakRetentionRelativeToSourceContrast": (grid_peak - median) / contrast,
            "sourcePeakCartesianA": original_peak.tolist(),
            "peakLocationShiftA": float(np.linalg.norm(
                np.asarray(measured[0]["peakCartesianA"]) - original_peak)),
            "thresholds": measured,
        })

    comparisons = []
    for i, level in enumerate(levels):
        earlier, later = grids[1]["thresholds"][i], grids[2]["thresholds"][i]
        a, b = (entry["levels"]["baseline"] for entry in (earlier, later))
        # Surface disappearance is meaningful data, not a numerical failure.
        area_delta = (relative_change(a["surfaceAreaA2"], b["surfaceAreaA2"])
                      if a["surfaceAreaA2"] is not None
                      and b["surfaceAreaA2"] is not None else None)
        occupancy_delta = relative_change(a["occupiedNodeFraction"],
                                          b["occupiedNodeFraction"])
        comparisons.append({
            "upperTailQuantile": level["upperTailQuantile"],
            "absoluteSourceScalarThreshold": float(sign * level["scoreLevel"]),
            "surfaceAreaChange48to64": area_delta,
            "occupiedNodeFractionChange48to64": occupancy_delta,
            "componentCounts48to64": [
                a["voxelComponents6ConnectedNonperiodic"],
                b["voxelComponents6ConnectedNonperiodic"]],
            "areaResolutionAlert": area_delta is None or area_delta > RESEARCH_ALERT,
            "occupancyResolutionAlert": occupancy_delta > RESEARCH_ALERT,
            "thresholdSensitivityAt64": later["thresholdAreaSensitivity"],
            "thresholdSensitivityAlertAt64": later["thresholdSensitivityAlert"],
        })
    print(f"{label}: source peak={peak:.6g}, contrast={contrast:.6g}; "
          f"retention 32/48/64=" + "/".join(
              f"{r['peakRetentionRelativeToSourceContrast']:.3f}" for r in grids))
    for row in comparisons:
        print(f"  q={row['upperTailQuantile']:.3f}: "
              f"48→64 Δarea={row['surfaceAreaChange48to64']!s}, "
              f"Δoccupied={row['occupiedNodeFractionChange48to64']:.2%}, "
              f"components={row['componentCounts48to64']}")
    return {
        "source": label, "sourceFile": source_path.name,
        "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "sourceDims": list(raw.shape), "periodic": bool(manifest["original"]["periodic"]),
        "signedTail": "positive" if sign == 1 else "negative",
        "sourceScalarUnit": manifest["scalarUnits"],
        "sourcePeakScore": peak, "sourceMedianScore": median,
        "sourcePeakContrast": contrast,
        "sourcePeakCartesianA": original_peak.tolist(),
        "sourceNearNyquistIndexEnergyFraction": nyquist_band_fraction(
            score, bool(manifest["original"]["periodic"])),
        "originalSourceThresholdOccupancy": source_tail,
        "scalarPerturbationMagnitude": delta,
        "thresholds": levels, "grids": grids, "comparisons48to64": comparisons,
    }


def main() -> None:
    mtz = gemmi.read_mtz_file(str(
        ROOT / "tests/fixtures/gemmi-5wkd_phases.mtz.gz"))
    if mtz.nreflections != 367 or mtz.spacegroup.number != 5:
        raise AssertionError("Pinned real experimental 5wkd MTZ changed")

    with tempfile.TemporaryDirectory(prefix="p1085-sampling-") as temporary:
        folder = Path(temporary)
        sources = [analyze_source(
            ROOT / "tests/fixtures/gemmi-5i55_tiny.ccp4",
            "5i55-ccp4", 1, folder)]
        for amp, phase, name, sign in (
            ("FWT", "PHWT", "5wkd-FWT", 1),
            ("DELFWT", "PHDELWT", "5wkd-DELFWT", -1),
        ):
            grid = mtz.transform_f_phi_to_map(
                amp, phase, exact_size=[64, 64, 64])
            ccp4 = gemmi.Ccp4Map()
            ccp4.grid = grid
            ccp4.update_ccp4_header()
            path = folder / f"{name}.ccp4"
            ccp4.write_ccp4_map(str(path))
            sources.append(analyze_source(path, name, sign, folder))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "package": "10.8.5",
        "type": "real-source-sampling-and-isolevel-sensitivity",
        "referenceVersions": {
            "gemmi": gemmi.__version__, "numpy": np.__version__,
            "scipy": scipy.__version__, "scikitImage": skimage.__version__,
        },
        "gridResolutions": list(RESOLUTIONS),
        "sourceFixedUpperTailQuantiles": list(UPPER_TAIL_QUANTILES),
        "thresholdPerturbation": "±2% of ORIGINAL source signed peak-minus-median contrast",
        "alertOnlyAreaOrOccupancyChange": RESEARCH_ALERT,
        "nearNyquistIndexBand": ">=70% of index-space Nyquist in at least one axis",
        "scientificStatus": "diagnostic only; no convergence or accuracy certification",
        "sources": sources,
        "limitations": [
            "Three real-source-derived maps, not broad independent CHGCAR/CUBE/XSF validation.",
            "Source thresholds use adjacent distinct-value gaps and remain fixed across grids.",
            "Occupied NODE fraction is not electron-count or calibrated physical volume.",
            "Nonperiodic 6-neighbor components split structures crossing periodic seams.",
            "Near-Nyquist index-energy proxy with open-boundary Hann taper is not "
            "an aliasing proof, a physical reciprocal-space cutoff or band-limited reconstruction.",
            "Peak retention and peak-location shift do not establish local extrema convergence.",
            "Marching cubes is an independent geometric extractor, not a physical reference.",
            "Empty/full shifted contours are recorded rather than forced to look converged.",
            "Source physical quantity/scalar unit is not independently established.",
            "Real-map changes over 32/48/64 are research alerts, not pass/fail tolerances.",
            "No production render mode, data limits, or scientific mesh algorithm changed.",
        ],
    }, indent=2), encoding="utf-8")
    print(f"P10.8.5 diagnostic JSON: {OUT}")
    print("P10.8.5 data/provenance/invariant gates passed; convergence NOT certified.")


if __name__ == "__main__":
    main()
