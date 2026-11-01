#!/usr/bin/env python3
"""Download *only fixed* official PSlibrary 1.0.0 PBE ultrasoft UPF names.
Requires operator-pre-reviewed SHA-256; aborts on any mismatch or redirect.
This script never creates trusted hashes or performs DFT.
"""
import argparse
import hashlib
import re
import urllib.request
from pathlib import Path

FILES={
    "Ga":"Ga.pbe-dn-rrkjus_psl.1.0.0.UPF",
    "Al":"Al.pbe-n-rrkjus_psl.1.0.0.UPF",
    "N":"N.pbe-n-rrkjus_psl.1.0.0.UPF",
    "Si":"Si.pbe-n-rrkjus_psl.1.0.0.UPF",
    "C":"C.pbe-n-rrkjus_psl.1.0.0.UPF",
}
URL="https://pseudopotentials.quantumespresso.org/upf_files/"


def fetch_pp(element,pin,target):
    if element not in FILES or not re.fullmatch(r"[0-9a-f]{64}",pin):
        raise ValueError("Valid official PP name and prereviewed lowercase SHA-256 are required")
    if target.exists():
        raise ValueError("Destination must not exist")
    url=URL+FILES[element]
    request=urllib.request.Request(url,headers={"User-Agent":"KristalYapi-QE-Bulk-Evidence/1"})
    with urllib.request.urlopen(request,timeout=75) as response:
        if response.geturl()!=url:
            raise ValueError("Unexpected UPF source redirect")
        data=response.read(8_000_001)
    if len(data)>8_000_000 or b"<UPF" not in data[:500] or b"PP_HEADER" not in data[:10000]:
        raise ValueError("Missing or oversize official UPF bytes")
    if not re.search(rb'element\s*=\s*["\']'+element.encode()+rb'["\']',data[:10000]):
        raise ValueError("UPF header has unexpected element")
    digest=hashlib.sha256(data).hexdigest()
    if digest!=pin:
        raise ValueError("UPF did not match operator-pre-reviewed SHA-256: "+element)
    target.write_bytes(data)
    return {"element":element,"filename":FILES[element],"sha256":digest,
            "source":url,"bytes":len(data),"originAuthenticatedBySignature":False}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--element",choices=tuple(FILES),required=True)
    p.add_argument("--sha256",required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    result=fetch_pp(args.element,args.sha256,args.output)
    print(result)


if __name__=="__main__":
    main()
