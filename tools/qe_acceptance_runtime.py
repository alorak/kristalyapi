"""Local Docker/API acceptance runtime; fixed paths, reviewed UPFs, no fake solver."""
from __future__ import annotations

import json
import os
from pathlib import Path
import platform
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request

from qe_scf_acceptance import Api, require, sha, write_json
from qe_mos2_acceptance import ROOT, validate_upf_metadata


class Runtime:
    def __init__(self, plan, output, extra_sources=()):
        self.plan,self.output,self.extra_sources=plan,output,extra_sources
        self.report={"cleanup_errors":[]}
        self.started=False
        self.temp=None
        self.api=None
        self.env={k:v for k,v in os.environ.items() if not k.startswith(("QE_","COMPOSE_"))}

    def command(self,args,timeout=1800):
        result=subprocess.run(args,cwd=ROOT,env=self.env,stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,timeout=timeout)
        if result.returncode:
            with (self.output/"docker.log").open("ab") as stream:stream.write(result.stdout)
            raise ValueError("Docker command failed; inspect docker.log")
        return result.stdout

    def __enter__(self):
        self.temp=tempfile.TemporaryDirectory(prefix="kristalyapi-acceptance-")
        work=Path(self.temp.name)
        try:
            for name in ("profiles","pseudos"):(work/name).mkdir()
            profile={"schema":"kristalyapi.upf-profile.v1","id":"mos2-pbe",
                     "functional":"PBE","elements":{}}
            for element,meta in self.plan["pseudopotentials"].items():
                with urllib.request.urlopen(meta["url"],timeout=90) as response:
                    data=response.read(20_000_001)
                require(1000<=len(data)<=20_000_000 and sha(data)==meta["reviewed_sha256"],
                        "Reviewed "+element+" UPF SHA-256 mismatch")
                validate_upf_metadata(data,element)
                (work/"pseudos"/meta["filename"]).write_bytes(data)
                profile["elements"][element]={"file":meta["filename"],"sha256":meta["reviewed_sha256"],
                    "functional":"PBE","source":meta["url"],"license":meta["license"]+"; "+meta["license_url"]}
            write_json(work/"profiles/mos2-pbe.json",profile)
            write_json(self.output/"upf-profile.json",profile)
            with socket.socket() as sock:
                sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
            token=secrets.token_urlsafe(40)
            (work/".env").write_text(f"QE_API_PORT={port}\nQE_API_BIND_IP=127.0.0.1\n"
                f"QE_JOBS_ENABLED=1\nQE_API_TOKEN={token}\nQE_PROFILE_DIR={work/'profiles'}\n"
                f"QE_PSEUDO_DIR={work/'pseudos'}\nQE_JOB_TIMEOUT={self.plan['limits']['max_seconds_per_job']}\n")
            (work/".env").chmod(0o600)
            memory=self.plan["limits"]["docker_worker_memory_bytes"]
            write_json(work/"resources.json",{"services":{"qe-worker":{"mem_limit":memory,"memswap_limit":memory}}})
            self.compose=["docker","compose","--env-file",str(work/".env"),"-p",
                "kristalyapi-acceptance-"+secrets.token_hex(5),"-f",str(ROOT/"compose.qe.yml"),
                "-f",str(work/"resources.json"),"--profile","compute"]
            sources=[ROOT/"compose.qe.yml",ROOT/"server/Dockerfile",Path(__file__).resolve(),
                     ROOT/"tools/qe_run.py",ROOT/"tools/qe_mos2_acceptance.py",ROOT/"tools/qe_scf_acceptance.py",
                     *sorted((ROOT/"server").glob("*.py")),*self.extra_sources]
            self.report["provenance"]={"git_commit":self.command(["git","rev-parse","HEAD"]).decode().strip(),
                "host_machine":platform.machine(),"docker_arch":self.command(["docker","info","--format","{{.Architecture}}"]).decode().strip(),
                "source_sha256":{str(p.relative_to(ROOT)):sha(p.read_bytes()) for p in sources}}
            self.command(self.compose+["config","--quiet"])
            print("Acceptance: building real QE Docker image",flush=True)
            self.command(self.compose+["build"])
            self.started=True
            self.command(self.compose+["up","-d","--no-build"])
            self.api=Api(port,token)
            deadline=time.monotonic()+90
            while True:
                try:
                    health=self.api.request("/api/health",auth=False)
                    require(health["status"]=="ready" and health["read_only"] is False,"Compute API not ready")
                    break
                except (OSError,ValueError):
                    require(time.monotonic()<deadline,"Compute API health deadline exceeded")
                    time.sleep(.5)
            self.container=self.command(self.compose+["ps","-q","qe-api"]).decode().strip()
            worker=self.command(self.compose+["ps","-q","qe-worker"]).decode().strip()
            info=json.loads(self.command(["docker","inspect",worker]))[0]
            config=info["HostConfig"]
            require(config["Memory"]==config["MemorySwap"]==memory,"Worker resources differ from fixed plan")
            self.report["provenance"].update(image_id=info["Image"],worker_resources={
                "memory_bytes":config["Memory"],"memory_swap_bytes":config["MemorySwap"]})
            return self
        except Exception:
            self.__exit__(None,None,None)
            raise

    def job(self,request,name):
        require(re.fullmatch(r"[a-z0-9-]{1,80}",name) is not None,"Invalid evidence case name")
        path=self.output/"cases"/name;path.mkdir(parents=True,exist_ok=False)
        write_json(path/"request.json",request)
        valid=self.api.request("/api/v1/calculations/validate","POST",request)
        submitted=self.api.request("/api/v1/calculations","POST",request,expected=202)
        jid=submitted["job_id"];require(re.fullmatch(r"[a-f0-9]{32}",jid) is not None,"Invalid job identity")
        print("Acceptance:",name,"submitted",jid,flush=True)
        deadline=time.monotonic()+self.plan["limits"]["max_seconds_per_job"]+90
        while True:
            terminal=self.api.request("/api/v1/calculations/"+jid)
            if terminal["status"] not in ("queued","running"):break
            require(time.monotonic()<deadline,"Job polling deadline exceeded")
            time.sleep(1)
        trace={"validation":valid,"submitted":submitted,"terminal":terminal}
        write_json(path/"api.json",trace)
        names=["structure.in","structure.out","structure.stderr"]
        if request["schema"]=="kristalyapi.qe-relax-scf-job.v1":
            names=["relax.in","relax.out","relax.stderr","pipeline.json"]+names
        electronic=request["schema"]=="kristalyapi.qe-electronic-job.v1"
        if electronic:names=["source.in","band-path.txt","pipeline.stdout","pipeline.stderr"]
        missing=[]
        for filename in names:
            try:self.command(["docker","cp",self.container+":/var/lib/qe/runs/"+jid+"/"+filename,str(path/filename)])
            except ValueError:missing.append(filename)
        if missing:write_json(path/"missing-artifacts.json",missing)
        if electronic:
            try:
                filenames=json.loads(self.command(["docker","exec",self.container,"python3","-c",
                    "import pathlib,json,sys;p=pathlib.Path('/var/lib/qe/runs')/sys.argv[1]/'pipeline';print(json.dumps([x.name for x in p.iterdir() if x.is_file()]))",jid]))
            except ValueError:
                if terminal["status"]=="completed":raise
                filenames=[]
            (path/"pipeline").mkdir()
            for filename in filenames:
                require(re.fullmatch(r"[A-Za-z0-9_.#()+-]+",filename) is not None,"Unexpected pipeline artifact name")
                self.command(["docker","cp",self.container+":/var/lib/qe/runs/"+jid+"/pipeline/"+filename,str(path/"pipeline"/filename)])
        require(terminal["status"]=="completed",name+" ended "+terminal["status"]+": "+str(terminal.get("error")))
        require(not missing,"Completed job lacks raw evidence")
        trace["staged_upf_sha256"]={}
        for element in ("Mo","S"):
            digest=self.command(["docker","exec",self.container,"python3","-c",
                "import hashlib,sys;print(hashlib.sha256(open('/var/lib/qe/runs/'+sys.argv[1]+sys.argv[3]+'/pseudo/'+sys.argv[2]+'.UPF','rb').read()).hexdigest())",jid,element,"/pipeline" if electronic else ""]).decode().strip()
            trace["staged_upf_sha256"][element]=digest
        result=self.api.request("/api/v1/calculations/"+jid+"/results")
        write_json(path/"api.json",trace);write_json(path/"result.json",result)
        write_json(self.output/"api-audit.json",self.api.audit)
        print("Acceptance:",name,"completed",result["energy_ry"],"Ry",flush=True)
        return result

    def __exit__(self,*_):
        if self.api is not None:
            try:write_json(self.output/"api-audit.json",self.api.audit)
            except OSError as exc:self.report["cleanup_errors"].append(str(exc))
        if self.started:
            try:(self.output/"container.log").write_bytes(self.command(self.compose+["logs","--no-color"]))
            except (OSError,ValueError,subprocess.SubprocessError) as exc:self.report["cleanup_errors"].append(str(exc))
            try:
                self.command(self.compose+["down","--volumes"]);self.report["resources_removed"]=True
            except (OSError,ValueError,subprocess.SubprocessError) as exc:self.report["cleanup_errors"].append(str(exc))
        if self.temp is not None:
            try:self.temp.cleanup()
            except OSError as exc:self.report["cleanup_errors"].append(str(exc))
        return False
