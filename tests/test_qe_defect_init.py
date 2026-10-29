"""D5 initialization-only contract, using synthetic text and fake Docker processes."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import qe_defect_init as init


class DefectInitializationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.case=json.loads((ROOT/'validation-results/qe-mos2-d5-preparation-20261029/preparation.json').read_text())['cases'][0]
        cls.raw='Program PWSCF v.6.7MaX\nnumber of atoms/cell = 48\nnumber of electrons = 416.0\nnumber of Kohn-Sham states=416\nEstimated max dynamical RAM per process > 1234 MB\nJOB DONE.\n'

    def test_only_nstep_zero_input_is_generated_without_relaxation(self):
        profile={el:{'file':el+'.UPF'} for el in ('Mo','S')}
        text=init.initialization_input(self.case,profile)
        self.assertIn('nstep=0,',text);self.assertIn('nbnd=416,',text)
        self.assertIn("calculation='scf'",text);self.assertIn("pseudo_dir='/pseudos'",text)
        self.assertNotIn('&IONS',text);self.assertNotIn('forc_conv_thr',text)
        self.assertIn('nat=48',text);self.assertIn('120.00000000',text)

    def test_initialized_counts_are_not_reported_as_a_converged_calculation(self):
        r=init.initialization_proof(self.raw,self.case,0,False)
        self.assertEqual(r['status'],'initialized');self.assertEqual(r['electrons'],416)
        self.assertFalse(r['calculation_performed']);self.assertFalse(r['scf_converged'])
        self.assertFalse(r['full_scf_memory_or_walltime_validated'])

    def test_energy_or_convergence_output_cannot_be_called_initialization_only(self):
        for addition in ('! total energy = -100 Ry\n','convergence has been achieved in 3 iterations\n'):
            with self.subTest(addition=addition),self.assertRaisesRegex(ValueError,'Unexpected SCF'):
                init.initialization_proof(self.raw+addition,self.case,0,False)

    def test_bad_exit_oom_or_inconsistent_counts_are_rejected(self):
        for raw,code,oom in ((self.raw,137,True),(self.raw,1,False),
                            (self.raw.replace('416.0','410.0'),0,False),
                            (self.raw.replace('states=416','states=128'),0,False),
                            (self.raw.replace('PWSCF','different'),0,False)):
            with self.subTest(code=code,oom=oom),self.assertRaises(ValueError):
                init.initialization_proof(raw,self.case,code,oom)

    def test_timeout_kills_and_removes_its_container_and_keeps_raw_artifacts(self):
        calls=[]
        def command(argv):
            calls.append(argv[:2])
            if argv[1]=='create':return b'fake-id\n'
            if argv[1]=='inspect':return json.dumps([{'HostConfig':{'Memory':init.MEMORY,
                'MemorySwap':init.MEMORY,'NanoCpus':2_000_000_000,'NetworkMode':'none','ReadonlyRootfs':True},
                'State':{'ExitCode':137,'OOMKilled':False}}]).encode()
            return b''
        class Process:
            count=0
            def __init__(self,*a,**k):pass
            def wait(self,timeout):
                self.count+=1
                if self.count==1:raise subprocess.TimeoutExpired('fake-docker',timeout)
                return 137
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/'pristine';folder.mkdir();(folder/'initialization.in').write_text('nstep=0')
            with patch.object(init,'command',side_effect=command),patch.object(init.subprocess,'Popen',Process):
                report=init.run_case('sha256:'+'0'*64,Path(tmp),Path(tmp),self.case)
            self.assertEqual(report['status'],'failed');self.assertTrue(report['timed_out'])
            self.assertTrue(report['container_removed']);self.assertIn(['docker','kill'],calls)
            self.assertIn(['docker','rm'],calls)
            self.assertEqual(len(report['artifact_sha256']),3)


if __name__=='__main__':unittest.main()
