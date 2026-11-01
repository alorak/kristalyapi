"""P1 real-UPF download gate tests use mock network data only."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from qe_bulk_download_upf import fetch_pp,URL,FILES


class FakeResponse:
    def __init__(self,body,url):
        self.body=body
        self.url=url
    def __enter__(self):return self
    def __exit__(self,*_):return False
    def geturl(self):return self.url
    def read(self,_):return self.body


class PinnedPseudopotentialTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.bytes=b'<UPF version="2.0.1"><PP_HEADER element="N" functional="PBE" /></UPF>\n'
        self.good=hashlib.sha256(self.bytes).hexdigest()
    def test_operator_pinned_exact_bytes_only(self):
        url=URL+FILES["N"]
        with patch("qe_bulk_download_upf.urllib.request.urlopen",
                   return_value=FakeResponse(self.bytes,url)):
            report=fetch_pp("N",self.good,self.root/"N.UPF")
        self.assertEqual(report["sha256"],self.good)
        self.assertFalse(report["originAuthenticatedBySignature"])
        self.assertEqual((self.root/"N.UPF").read_bytes(),self.bytes)
    def test_digest_failure_never_writes_a_file(self):
        url=URL+FILES["N"]
        with patch("qe_bulk_download_upf.urllib.request.urlopen",
                   return_value=FakeResponse(self.bytes,url)):
            with self.assertRaisesRegex(ValueError,"did not match"):
                fetch_pp("N","0"*64,self.root/"N.UPF")
        self.assertFalse((self.root/"N.UPF").exists())
    def test_redirect_and_wrong_element_fail_closed(self):
        url=URL+FILES["N"]
        with patch("qe_bulk_download_upf.urllib.request.urlopen",
                   return_value=FakeResponse(self.bytes,"https://untrusted.invalid/example.upf")):
            with self.assertRaisesRegex(ValueError,"redirect"):
                fetch_pp("N",self.good,self.root/"N.UPF")
        with patch("qe_bulk_download_upf.urllib.request.urlopen",
                   return_value=FakeResponse(self.bytes,URL+FILES["Ga"])):
            with self.assertRaisesRegex(ValueError,"element"):
                fetch_pp("Ga",self.good,self.root/"Ga.UPF")
    def test_no_unknown_potential_or_unpinned_hash(self):
        with self.assertRaisesRegex(ValueError,"Valid official"):
            fetch_pp("Fe","0"*64,self.root/"Fe.UPF")
        with self.assertRaisesRegex(ValueError,"Valid official"):
            fetch_pp("N","not-a-reviewed-pin",self.root/"N.UPF")


if __name__=="__main__":
    unittest.main()
