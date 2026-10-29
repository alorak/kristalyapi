"""Synthetic transport-only tests: no Docker, UPFs or DFT calculations."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from qe_acceptance_runtime import Runtime


class RuntimeTransportTests(unittest.TestCase):
    def setUp(self):
        t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);self.root=Path(t.name)
        self.runtime=Runtime({'limits':{'max_seconds_per_job':1}},self.root)
        self.runtime.container='synthetic-container';self.commands=[]
        self.files=['scf.in','scf.out','pdos.pdos_atm#1(Mo)_wfc#1(d)']
        self.status='completed'
        parent=self
        class FakeApi:
            audit=[]
            def request(self,path,*args,**kwargs):
                if path.endswith('/validate'):return {'valid':True}
                if path.endswith('/results'):return {'energy_ry':-10.0}
                return {'job_id':'a'*32,'status':parent.status}
        self.runtime.api=FakeApi()
        def command(args,**kwargs):
            self.commands.append(args)
            if args[1]=='cp':Path(args[-1]).write_bytes(b'SYNTHETIC transport fixture');return b''
            if 'import pathlib' in args[5]:return json.dumps(self.files).encode()
            return ('b'*64).encode()
        self.runtime.command=command

    def test_electronic_artifacts_and_actual_child_upf_location_are_captured(self):
        self.runtime.job({'schema':'kristalyapi.qe-electronic-job.v1'},'electronic')
        folder=self.root/'cases/electronic'
        self.assertTrue((folder/'pipeline'/self.files[-1]).is_file())
        trace=json.loads((folder/'api.json').read_text())
        self.assertEqual(trace['staged_upf_sha256']['Mo'],'b'*64)
        hashes=[x for x in self.commands if x[1]=='exec' and 'import hashlib' in x[5]]
        self.assertTrue(all(x[-1]=='/pipeline' for x in hashes))

    def test_unexpected_artifact_name_cannot_escape_evidence_folder(self):
        self.files=['../escape']
        with self.assertRaisesRegex(ValueError,'artifact name'):
            self.runtime.job({'schema':'kristalyapi.qe-electronic-job.v1'},'electronic')
        self.assertFalse((self.root/'cases/escape').exists())


if __name__=='__main__':unittest.main()
