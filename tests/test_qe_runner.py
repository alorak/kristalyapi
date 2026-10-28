"""Offline runner regression tests; the executable in tests is NOT Quantum ESPRESSO."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

RUNNER = Path(__file__).resolve().parents[1] / 'tools' / 'qe_run.py'
spec = importlib.util.spec_from_file_location('qe_run', RUNNER)
qe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qe)

INPUT = """! KristalYapi frontend export
&CONTROL
 calculation = 'relax',
 prefix = 'kristalyapi',
 pseudo_dir = './pseudo',
 outdir = './tmp',
 tprnfor = .true.,
/
&SYSTEM
 ibrav = 0,
 nat = 3,
 ntyp = 2,
 ecutwfc = 60.00,
 ecutrho = 480.00,
/
&ELECTRONS
 conv_thr = 1.0d-8,
/
&IONS
 ion_dynamics = 'bfgs',
/
ATOMIC_SPECIES
Mo 95.95000 Mo.UPF
S 32.06000 S.UPF
CELL_PARAMETERS angstrom
3.16 0 0
-1.58 2.73 0
0 0 22
ATOMIC_POSITIONS crystal
Mo 0 0 0.5
S 0.3333 0.6667 0.55
S 0.3333 0.6667 0.45
K_POINTS automatic
4 4 1 0 0 0
"""
SCF = INPUT.replace("'relax'", "'scf'").replace("&IONS\n ion_dynamics = 'bfgs',\n/\n", "")


def fake_output(*, converge=True, ionic=True, done=True):
    return ("Program PWSCF v.7.5 starts on 28Oct2026\n" +
            ("convergence has been achieved in 7 iterations\n" if converge else "convergence NOT achieved\n") +
            "!    total energy = -123.456789 Ry\nTotal force = 0.001 Ry/Bohr\n" +
            ("bfgs converged in 2 scf cycles and 2 bfgs steps\n" if ionic else "") +
            "Begin final coordinates\nATOMIC_POSITIONS (crystal)\nMo 0 0 0.5\nS .333 .666 .55\nS .333 .666 .45\nEnd final coordinates\n" +
            ("JOB DONE.\n" if done else ""))


class TestQeRun(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.infile = self.root / 'mos2.in'
        self.infile.write_text(INPUT, encoding='utf-8')
        self.pseudo = self.root / 'source-pp'
        self.pseudo.mkdir()
        for file in ('Mo.UPF', 'S.UPF'):
            (self.pseudo / file).write_text('<UPF version="2.0.1"/>\n', encoding='utf-8')

    def fake_executable(self, output):
        exe = self.root / 'fake-pw.x'
        # This fixture tests process handling, not scientific computation.
        exe.write_text(f'#!{sys.executable}\nimport sys\nprint({output!r})\n', encoding='utf-8')
        exe.chmod(0o700)
        return str(exe)

    def test_preparation_has_no_computed_result(self):
        run = qe.run_job(self.infile, self.pseudo, self.root / 'job')
        self.assertEqual(run['status'], 'prepared')
        self.assertIsNone(run['calculation'])
        self.assertEqual(run['model']['nat'], 3)
        self.assertEqual(set(run['pseudopotentials']), {'Mo', 'S'})
        self.assertTrue((self.root / 'job' / 'run.json').exists())
        self.assertFalse((self.root / 'job' / 'structure.out').exists())

    def test_successful_relaxation_records_energy_provenance_and_raw_output(self):
        pw = self.fake_executable(fake_output())
        run = qe.run_job(self.infile, self.pseudo, self.root / 'relax', pw=pw, execute=True)
        self.assertEqual(run['status'], 'completed')
        self.assertAlmostEqual(run['calculation']['energy_ry'], -123.456789)
        self.assertTrue(run['calculation']['geometry_converged'])
        self.assertEqual(run['calculation']['qe_version'], '7.5')
        self.assertIn('JOB DONE.', (self.root / 'relax' / 'structure.out').read_text())

    def test_incomplete_output_even_with_energy_cannot_pass(self):
        for label, text in [('no-job', fake_output(done=False)),
                            ('no-scf', fake_output(converge=False)),
                            ('no-ionic', fake_output(ionic=False))]:
            with self.subTest(label=label):
                run = qe.run_job(self.infile, self.pseudo, self.root / label,
                                 pw=self.fake_executable(text), execute=True)
                self.assertEqual(run['status'], 'not_converged_or_incomplete')

    def test_scf_does_not_require_bfgs_ionic_convergence(self):
        self.infile.write_text(SCF)
        run = qe.run_job(self.infile, self.pseudo, self.root / 'scf',
                         pw=self.fake_executable(fake_output(ionic=False)), execute=True)
        self.assertEqual(run['status'], 'completed')
        self.assertIsNone(run['calculation']['geometry_converged'])

    def test_missing_pseudo_or_invalid_paths_do_not_stage(self):
        (self.pseudo / 'S.UPF').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing/empty/unsafe'):
            qe.run_job(self.infile, self.pseudo, self.root / 'missing')
        self.assertFalse((self.root / 'missing').exists())
        self.infile.write_text(INPUT.replace("'./tmp'", "'../../outside'"))
        with self.assertRaisesRegex(ValueError, 'fixed prefix'):
            qe.run_job(self.infile, self.pseudo, self.root / 'unsafe')

    def test_already_populated_job_is_not_overwritten(self):
        job = self.root / 'existing'; job.mkdir()
        (job / 'important.txt').write_text('keep')
        with self.assertRaisesRegex(ValueError, 'new or empty'):
            qe.run_job(self.infile, self.pseudo, job)
        self.assertEqual((job / 'important.txt').read_text(), 'keep')

    def test_nonnumeric_and_wrong_nat_rejected(self):
        with self.assertRaisesRegex(ValueError, 'nat'):
            qe.parse_pw_input(INPUT.replace('nat = 3', 'nat = 4'))
        with self.assertRaisesRegex(ValueError, 'coordinates'):
            qe.parse_pw_input(INPUT.replace('Mo 0 0 0.5', 'Mo oops 0 0.5'))
        with self.assertRaisesRegex(ValueError, 'pseudopotential'):
            qe.parse_pw_input(INPUT.replace('S.UPF', '../S.UPF'))


if __name__ == '__main__':
    unittest.main()
