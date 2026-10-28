"""Synthetic manifests only: structure/energy/provenance comparisons without QE simulation."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from qe_defect_compare import generate, periodic_distance, read_scf_structure

CONFIG = "kristalyapi.mos2-defect-series-config.v1"
TYPES = ("pristine", "V_S", "V_2S", "O_S", "O2_at_VS")
CENTER = [1/3, 2/3, .55]


def atoms(kind):
    values = [
        ("Mo", 0, 0, .5), ("Mo", .5, .5, .5),
        ("S", 1/3, 2/3, .55), ("S", 1/3, 2/3, .45),
        ("S", 5/6, 1/6, .55), ("S", 5/6, 1/6, .45),
    ]
    if kind == "V_S":
        values.pop(2)
    if kind == "V_2S":
        values.pop(3)
        values.pop(2)
    if kind == "O_S":
        values[2] = ("O", *values[2][1:])
    if kind == "O2_at_VS":
        values.pop(2)
        values.extend([("O", 1/3, 2/3, .58), ("O", 1/3, 2/3, .62)])
    return values


def scf_source(values, ecut=60, cell_c=20):
    return ("&CONTROL\n calculation='scf',\n prefix='kristalyapi',\n"
            " pseudo_dir='./pseudo', outdir='./tmp',\n/\n"
            "&SYSTEM\n ibrav=0,\n nat="+str(len(values))+",\n ntyp=3,\n"
            f" ecutwfc={ecut},\n ecutrho=480,\n occupations='fixed',\n/\n"
            "&ELECTRONS\n conv_thr=1.d-8,\n/\n"
            "ATOMIC_SPECIES\nMo 95 Mo.UPF\nS 32 S.UPF\nO 16 O.UPF\n"
            "CELL_PARAMETERS angstrom\n6.32 0 0\n-3.16 5.473 0\n0 0 "
            f"{cell_c}\n"
            "ATOMIC_POSITIONS crystal\n"
            + "\n".join(f"{sp} {x:.9f} {y:.9f} {z:.9f}" for sp, x, y, z in values)
            + "\nK_POINTS automatic\n4 4 1 0 0 0\n")


def build_run(root, kind):
    folder = root / kind
    folder.mkdir()
    values = atoms(kind)
    text = scf_source(values)
    (folder / "scf.in").write_text(text)
    input_sha = hashlib.sha256(text.encode()).hexdigest()
    pp = {"Mo": {"filename": "Mo.UPF", "sha256": "a" * 64},
          "S": {"filename": "S.UPF", "sha256": "b" * 64}}
    if any(x[0] == "O" for x in values):
        pp["O"] = {"filename": "O.UPF", "sha256": "c" * 64}
    nscf = text.replace("calculation='scf'", "calculation='nscf'").replace(
        " ntyp=3,\n", " ntyp=3,\n nbnd=24,\n").replace(
        "4 4 1 0 0 0", "12 12 1 0 0 0")
    dos = "&DOS\n prefix='kristalyapi',\n outdir='./tmp',\n fildos='dos.dat',\n DeltaE=0.02,\n degauss=0.01,\n/\n"
    projwfc = "&PROJWFC\n prefix='kristalyapi',\n outdir='./tmp',\n filpdos='pdos',\n DeltaE=0.02,\n degauss=0.01,\n/\n"
    step_files = {"nscf": nscf, "dos": dos, "projwfc": projwfc}
    for step, content in step_files.items():
        (folder / (step + ".in")).write_text(content)
    pipeline = {"schema": "kristalyapi.qe-pipeline.v1", "status": "completed",
                "input_sha256": input_sha, "pseudopotentials": pp,
                "steps": {"scf": {"status": "completed", "input_sha256": input_sha},
                          **{name: {"status": "completed",
                                    "input_sha256": hashlib.sha256(content.encode()).hexdigest()}
                             for name, content in step_files.items()}}}
    energy = [-1., 0., 1.]
    pdos_atoms = []
    per_atom = [0.01, 0.02, 0.03]
    for ix, (element, *_) in enumerate(values, 1):
        channel = "d" if element == "Mo" else "p"
        pdos_atoms.append({"atom_index": ix, "element": element,
                           "orbitals": {channel: per_atom},
                           "total_dos_states_per_ev": per_atom})
    n = len(values)
    d = {"schema": "kristalyapi.qe-electronic.v1",
         "input_sha256": input_sha, "pseudopotentials": pp,
         "dos": {"energy_ev": energy, "dos_states_per_ev": [.2,.3,.4]},
         "pdos_atoms": {"spin_mode": "collinear-unpolarized",
                        "energy_ev": energy, "atoms": pdos_atoms},
         "pdos_total": {"energy_ev": energy,
                        "sum_projected_states_per_ev": [v*n for v in per_atom]}}
    (folder / "pipeline.json").write_text(json.dumps(pipeline))
    (folder / "electronic-results.json").write_text(json.dumps(d))


class DefectSeriesTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        for kind in TYPES:
            build_run(self.root, kind)
        self.config = {"schema": CONFIG, "near_radius_angstrom": 3.4,
                       "cases": [{"id": kind, "kind": kind, "label": kind,
                                  "run_dir": kind,
                                  "defect_center_fractional": CENTER}
                                 for kind in TYPES]}
        self.config_file = self.root / "series.json"
        self.save()

    def save(self):
        self.config_file.write_text(json.dumps(self.config))

    def test_all_five_defects_compared_unaligned_without_implicit_overlay(self):
        result = generate(self.config_file)
        self.assertEqual(result["schema"], "kristalyapi.mos2-defect-comparison.v1")
        self.assertEqual(result["alignment_status"], "unaligned")
        self.assertEqual(len(result["cases"]), 5)
        self.assertTrue(all(item["energy_ev_aligned"] is None for item in result["cases"]))
        for record in result["cases"]:
            self.assertTrue(record["near_atom_indices"])
            self.assertTrue(record["pdos"]["near"])
            self.assertEqual(record["counts"]["Mo"], 2)
            self.assertTrue(record["reference_mapping"]["matches"])
        self.assertEqual(next(x for x in result["cases"] if x["id"] == "O_S")["counts"]["O"], 1)
        self.assertEqual(next(x for x in result["cases"] if x["id"] == "O2_at_VS")["counts"]["O"], 2)

    def test_explicit_external_vacuum_alignment_and_provenance(self):
        self.config["alignment_method"] = "vacuum_potential"
        for ix, case in enumerate(self.config["cases"]):
            case.update({"reference_energy_ev": -4.0 + ix/10.,
                         "reference_evidence": f"manually reviewed average planar potential #{ix}"})
        self.save()
        data = generate(self.config_file)
        self.assertEqual(data["alignment_status"], "user_supplied_vacuum_alignment_unverified")
        self.assertAlmostEqual(data["cases"][0]["energy_ev_aligned"][0], 3.0)
        self.assertIn("unverified", data["alignment_status"])

    def test_partial_alignment_and_unsupported_alignment_method_rejected(self):
        self.config["cases"][0]["reference_energy_ev"] = -4.0
        self.config["cases"][0]["reference_evidence"] = "potential.dat"
        self.save()
        with self.assertRaisesRegex(ValueError, "ALL cases"):
            generate(self.config_file)
        self.config["alignment_method"] = "fermi_level"
        for case in self.config["cases"]:
            case["reference_energy_ev"] = -4.0
            case["reference_evidence"] = "some chart"
        self.save()
        with self.assertRaisesRegex(ValueError, "vacuum-potential"):
            generate(self.config_file)

    def test_reject_invalid_stoichiometry_or_mislabel(self):
        self.config["cases"][1]["kind"] = "O_S"
        self.save()
        with self.assertRaisesRegex(ValueError, "Case kind"):
            generate(self.config_file)
        self.config["cases"][1]["kind"] = "V_S"
        self.config["cases"][1]["run_dir"] = "pristine"
        self.save()
        with self.assertRaisesRegex(ValueError, "composition mismatches"):
            generate(self.config_file)

    def test_nscf_mesh_and_dos_broadening_must_agree(self):
        nscf_file = self.root / "V_S" / "nscf.in"
        altered = nscf_file.read_text().replace("12 12 1 0 0 0", "10 10 1 0 0 0")
        nscf_file.write_text(altered)
        pipeline_file = self.root / "V_S" / "pipeline.json"
        pipeline = json.loads(pipeline_file.read_text())
        pipeline["steps"]["nscf"]["input_sha256"] = hashlib.sha256(altered.encode()).hexdigest()
        pipeline_file.write_text(json.dumps(pipeline))
        self.save()
        with self.assertRaisesRegex(ValueError, "protocol differs"):
            generate(self.config_file)
        nscf_file.write_text(altered.replace("10 10 1 0 0 0", "12 12 1 0 0 0"))
        baseline = nscf_file.read_text()
        pipeline["steps"]["nscf"]["input_sha256"] = hashlib.sha256(baseline.encode()).hexdigest()
        pipeline_file.write_text(json.dumps(pipeline))
        dos_file = self.root / "V_S" / "dos.in"
        changed = dos_file.read_text().replace("DeltaE=0.02", "DeltaE=0.04")
        dos_file.write_text(changed)
        pipeline["steps"]["dos"]["input_sha256"] = hashlib.sha256(changed.encode()).hexdigest()
        pipeline_file.write_text(json.dumps(pipeline))
        with self.assertRaisesRegex(ValueError, "protocol differs"):
            generate(self.config_file)

    def test_reject_mismatched_ecut_cell_and_upf(self):
        folder = self.root / "V_S"
        scf = folder / "scf.in"
        original = scf.read_text()
        # Hash must agree with pipeline, so refresh that as well.
        modified = scf_source(atoms("V_S"), ecut=70)
        scf.write_text(modified)
        nscf_file = folder / "nscf.in"
        original_nscf = nscf_file.read_text()
        changed_nscf = original_nscf.replace("ecutwfc=60", "ecutwfc=70")
        nscf_file.write_text(changed_nscf)
        pipeline_file = folder / "pipeline.json"
        pipeline = json.loads(pipeline_file.read_text())
        pipeline["steps"]["scf"]["input_sha256"] = hashlib.sha256(modified.encode()).hexdigest()
        pipeline["steps"]["nscf"]["input_sha256"] = hashlib.sha256(changed_nscf.encode()).hexdigest()
        pipeline_file.write_text(json.dumps(pipeline))
        self.save()
        with self.assertRaisesRegex(ValueError, "protocol differs"):
            generate(self.config_file)
        scf.write_text(original)
        nscf_file.write_text(original_nscf)
        pipeline["steps"]["scf"]["input_sha256"] = hashlib.sha256(original.encode()).hexdigest()
        pipeline["steps"]["nscf"]["input_sha256"] = hashlib.sha256(original_nscf.encode()).hexdigest()
        pipeline_file.write_text(json.dumps(pipeline))
        pp_file = folder / "electronic-results.json"
        electronic = json.loads(pp_file.read_text())
        electronic["pseudopotentials"]["S"]["sha256"] = "f" * 64
        pipeline["pseudopotentials"]["S"]["sha256"] = "f" * 64
        pp_file.write_text(json.dumps(electronic))
        pipeline_file.write_text(json.dumps(pipeline))
        with self.assertRaisesRegex(ValueError, "UPF hash"):
            generate(self.config_file)

    def test_fail_on_unsafe_directory_incomplete_job_and_missing_pdos(self):
        self.config["cases"][1]["run_dir"] = "../outside"
        self.save()
        with self.assertRaisesRegex(ValueError, "relative"):
            generate(self.config_file)
        self.config["cases"][1]["run_dir"] = "V_S"
        folder = self.root / "V_S"
        pipeline_file = folder / "pipeline.json"
        pipeline = json.loads(pipeline_file.read_text())
        pipeline["steps"]["projwfc"]["status"] = "failed"
        pipeline_file.write_text(json.dumps(pipeline))
        self.save()
        with self.assertRaisesRegex(ValueError, "incomplete"):
            generate(self.config_file)
        pipeline["steps"]["projwfc"]["status"] = "completed"
        pipeline_file.write_text(json.dumps(pipeline))
        electronic_file = folder / "electronic-results.json"
        electronic = json.loads(electronic_file.read_text())
        electronic["pdos_atoms"] = None
        electronic_file.write_text(json.dumps(electronic))
        with self.assertRaisesRegex(ValueError, "detailed PDOS"):
            generate(self.config_file)

    def test_atom_assignment_is_periodic_and_one_to_one(self):
        cell, at = read_scf_structure(scf_source(atoms("pristine")))
        self.assertAlmostEqual(periodic_distance([0.01, 0.2, 0.3],
                                                  [.99, .2, .3], cell), .1264, places=3)
        result = generate(self.config_file)
        ref = next(r for r in result["cases"] if r["id"] == "pristine")
        ids = [p["pristine_atom_index"] for p in ref["reference_mapping"]["matches"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_geometry_center_mandatory_and_non_spin_only(self):
        self.config["cases"][2].pop("defect_center_fractional")
        self.save()
        with self.assertRaisesRegex(ValueError, "defect/anchor"):
            generate(self.config_file)
        self.config["cases"][2]["defect_center_fractional"] = CENTER
        f = self.root / "V_2S" / "electronic-results.json"
        v = json.loads(f.read_text())
        v["pdos_atoms"]["spin_mode"] = "collinear-spin-polarized"
        f.write_text(json.dumps(v))
        self.save()
        with self.assertRaisesRegex(ValueError, "non-spin-polarized"):
            generate(self.config_file)


if __name__ == "__main__":
    unittest.main()
