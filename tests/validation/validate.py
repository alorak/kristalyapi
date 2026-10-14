#!/usr/bin/env python3
"""Compare production JavaScript CIF structures with independent pinned Gemmi.
Measurements are reported; --strict enables blocking failures explicitly.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import gemmi

BASE=Path(__file__).resolve().parent
ROOT=BASE.parent.parent
TAGS=("_atom_site_fract_x","_atom_site_fract_y","_atom_site_fract_z")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def volume(c):
    x,y,z=(math.cos(math.radians(c[k])) for k in ("alpha","beta","gamma"))
    return c["a"]*c["b"]*c["c"]*math.sqrt(max(0,1+2*x*y*z-x*x-y*y-z*z))

def gemmi_reference(entry):
    path=(BASE/entry["path"]).resolve()
    if not path.is_relative_to(BASE/"fixtures"):
        raise ValueError("Fixture path escapes fixtures directory")
    record={"id":entry["id"],"sha256":sha(path),"engine":"Gemmi "+gemmi.__version__}
    try:
        block=gemmi.cif.read_file(str(path)).sole_block()
        missing=[tag for tag in TAGS if not block.find_values(tag)]
        if missing: raise ValueError("Missing coordinates: "+", ".join(missing))
        s=gemmi.make_small_structure_from_block(block)
        c=s.cell
        lengths=[c.a,c.b,c.c]
        angles=[c.alpha,c.beta,c.gamma]
        if any(not math.isfinite(v) or v<=0 for v in lengths):
            raise ValueError("Non-positive lattice length")
        if any(not math.isfinite(v) or v<=0 or v>=180 for v in angles):
            raise ValueError("Invalid lattice angle")
        if not math.isfinite(c.volume) or c.volume<=1e-8:
            raise ValueError("Degenerate lattice")
        if not s.sites: raise ValueError("No structural atom sites")
        sites=s.get_all_unit_cell_sites()
        if len(sites)>6000: raise ValueError("Reference too large")
        record.update(result="parsed",cell=dict(zip(("a","b","c","alpha","beta","gamma"),lengths+angles)),
          volume=c.volume,spacegroup=s.spacegroup_hm,spacegroup_number=s.spacegroup_number or None,
          asymmetric_sites=len(s.sites),
          sites=[dict(element=v.element.name,x=float(v.fract.x),y=float(v.fract.y),
                      z=float(v.fract.z),occupancy=float(v.occ)) for v in sites])
    except Exception as ex:
        record.update(result="error",error=(type(ex).__name__+": "+str(ex))[:500])
    return record

def periodic_distance(a,b,c):
    aa,bb,cc=c["a"],c["b"],c["c"]
    co=[math.cos(math.radians(c[k])) for k in ("alpha","beta","gamma")]
    dx,dy,dz=(a[k]-b[k] for k in ("x","y","z"))
    best=math.inf
    for i in (-1,0,1):
        x=dx+i
        for j in (-1,0,1):
            y=dy+j
            for k in (-1,0,1):
                z=dz+k
                d=(aa*x)**2+(bb*y)**2+(cc*z)**2
                d+=2*aa*bb*co[2]*x*y+2*aa*cc*co[1]*x*z+2*bb*cc*co[0]*y*z
                best=min(best,d)
    return math.sqrt(max(best,0))

def groups(sites):
    result=defaultdict(list)
    for s in sites:
        if not all(math.isfinite(float(s[k])) for k in ("x","y","z","occupancy")):
            raise ValueError("Nonfinite atomic coordinate/occupancy")
        result[(str(s["element"]),round(float(s["occupancy"])/0.001))].append(s)
    return result

def bipartite(a,b,cell,tol):
    # A perfect matching is needed: duplicate/partly occupied positions
    # must not be counted multiple times by a greedy nearest-site search.
    edges=[]
    residual={}
    for i,s in enumerate(a):
        options=[]
        for j,t in enumerate(b):
            d=periodic_distance(s,t,cell)
            if d<=tol:
                options.append(j)
                residual[(i,j)]=d
        edges.append(options)
    allocated=[-1]*len(b)
    def find(i,seen):
        for j in edges[i]:
            if j in seen: continue
            seen.add(j)
            if allocated[j]<0 or find(allocated[j],seen):
                allocated[j]=i
                return True
        return False
    matched=sum(bool(find(i,set())) for i in range(len(a)))
    worst=max((residual[(i,j)] for j,i in enumerate(allocated) if i>=0),default=0.)
    return matched==len(a)==len(b),matched,worst

def compare_sites(bsites,rsites,cell,tol):
    bg,rg=groups(bsites),groups(rsites)
    if set(bg)!=set(rg):
        return dict(success=False,reason="element/occupancy-group mismatch",
          browser_groups={str(k):len(v) for k,v in bg.items()},
          gemmi_groups={str(k):len(v) for k,v in rg.items()})
    for k in bg:
        if len(bg[k])!=len(rg[k]):
            return dict(success=False,reason="multiplicity mismatch",
                        group=str(k),browser=len(bg[k]),gemmi=len(rg[k]))
    def attempt(shift):
        worst=0.
        for k,b in bg.items():
            shifted=[dict(s,x=s["x"]+shift[0],y=s["y"]+shift[1],z=s["z"]+shift[2]) for s in b]
            success,matched,error=bipartite(shifted,rg[k],cell,tol)
            if not success:return False,matched,worst
            worst=max(worst,error)
        return True,len(bsites),worst
    success,n,worst=attempt([0,0,0])
    if success:return dict(success=True,matched=n,max_error_A=worst,origin_shift=[0,0,0])
    if bg:
        rare=min(bg,key=lambda k:len(bg[k]))
        anchor=bg[rare][0]
        for site in rg[rare][:24]:
            shift=[site[k]-anchor[k] for k in ("x","y","z")]
            success,n,worst=attempt(shift)
            if success:
                return dict(success=True,matched=n,max_error_A=worst,
                            origin_shift=[round(v,6) for v in shift])
    return dict(success=False,reason="periodic coordinate mismatch",matched=n,total=len(bsites))

def measure(entry,js,ref,tol):
    row=dict(id=entry["id"],kind=entry["kind"],path=entry["path"],expect=entry["expect"],
             sha256=ref["sha256"],browser_result=js["result"],
             gemmi_result=ref["result"],issues=[],measurements={})
    problems=row["issues"]
    if js.get("sha256")!=ref["sha256"]:
        row["status"]="error";problems.append("CIF SHA-256 mismatch between JS and Gemmi")
        return row
    if entry["expect"]=="reject":
        row["status"]="pass" if js["result"]==ref["result"]=="error" else "fail"
        if row["status"]=="fail":problems.append("An intentionally invalid CIF was accepted")
        else:row["measurements"]["rejection"]="both readers rejected"
        return row
    if ref["result"]!="parsed":
        row["status"]="inconclusive"
        problems.append("Gemmi reference unavailable: "+ref.get("error",""))
        return row
    if js["result"]!="parsed":
        row["status"]="fail"
        problems.append("JS rejected Gemmi-readable CIF: "+js.get("error",""))
        return row
    left,right=js["cell"],ref["cell"]
    keys=("a","b","c","alpha","beta","gamma")
    deltas={k:abs(left[k]-right[k]) for k in keys}
    v=abs(volume(left)-volume(right))/right["a"]/right["b"]/right["c"]
    # Use the Gemmi reference volume as denominator for a unit-independent relative error.
    v=abs(volume(left)-ref["volume"])/ref["volume"]
    row["measurements"].update(cell_errors=deltas,volume_relative_error=v,
      browser_sites=len(js["sites"]),gemmi_sites=len(ref["sites"]),
      reference_spacegroup=ref.get("spacegroup"),browser_spacegroup=js.get("spacegroup"),
      browser_assumption=js.get("assumption",""))
    bad=[k for k in keys if deltas[k]>tol["cell_length_A" if k in ("a","b","c") else "cell_angle_deg"]]
    if v>tol["volume_relative"]:bad.append("volume")
    if bad:
        row["status"]="inconclusive" if v<=tol["volume_relative"] else "fail"
        problems.append("Cell metric differs: "+", ".join(bad))
        return row
    try:
        positions=compare_sites(js["sites"],ref["sites"],right,tol["coordinate_A"])
        row["measurements"]["positions"]=positions
        row["status"]="pass" if positions["success"] else "fail"
        if not positions["success"]:problems.append(positions.get("reason","site mismatch"))
        elif any(abs(x)>1e-7 for x in positions["origin_shift"]):
            problems.append("Equivalent atom positions after global origin shift")
    except Exception as ex:
        row["status"]="error"
        problems.append("Comparison error: "+str(ex))
    return row

def report_markdown(rows,counts,manifest):
    lines=["# CIF doğrulama: Kristal Yapı / Gemmi","",
      f"**{len(rows)} fixtures** | Başarılı: **{counts.get('pass',0)}** | "
      f"Başarısız: **{counts.get('fail',0)}** | "
      f"Belirsiz: **{counts.get('inconclusive',0)}** | "
      f"Ölçüm hatası: **{counts.get('error',0)}**","",
      "Referans: Gemmi "+gemmi.__version__+". Kaynak dosyalar repoya sabitlenmiştir.",
      "Eşleşme: hücre, hacim, atom türü, doluluk, eşdeğer konum sayısı, periyodik koordinatlar.",
      "Global orijin kaymasıyla tam atom eşleşmesi varsa eşdeğer kabul edilir.",
      "Belirsiz bir kayıt başarılı sayılmaz. Atom sınırı/bond çizim sayısı referans değildir.","",
      "| CIF | Tür | Sonuç | JS atom | Gemmi atom | Sorun |",
      "|---|---|---|---:|---:|---|"]
    for r in rows:
        m=r["measurements"]
        issue=("; ".join(r["issues"]) or "Birim hücre ve konumlar uyumlu")
        issue=issue.replace("|","/").replace("\n"," ")[:200]
        lines.append(f"| {r['id']} | {r['kind']} | **{r['status']}** | "+
          f"{m.get('browser_sites','—')} | {m.get('gemmi_sites','—')} | {issue} |")
    lines+=["","## Eşikler",""]
    lines.extend("- "+str(k)+": "+str(v) for k,v in manifest["tolerances"].items())
    lines+=["","report.json ve reference.json içinde her fixture SHA-256 özeti ve ölçüm ayrıntıları bulunur.",
            "Bu hat, uyumsuzlukları raporlar; uygulamanın CIF kodunu değiştirmez.",""]
    return "\n".join(lines)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out-dir",default=str(ROOT/"validation-results"))
    p.add_argument("--strict",action="store_true")
    args=p.parse_args()
    output=Path(args.out_dir).resolve()
    output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((BASE/"manifest.json").read_text(encoding="utf8"))
    entries=manifest["cases"]
    if len(entries)!=40 or sum(x["kind"]=="real" for x in entries)!=30:
        raise ValueError("Exactly 30 real and 10 synthetic fixtures required")
    if len(set(x["id"] for x in entries))!=len(entries):
        raise ValueError("Duplicate case identifiers")
    subprocess.run(["node",str(BASE/"js_cif_runner.cjs"),str(output/"browser.json")],
                   cwd=ROOT,check=True,timeout=90)
    measured=json.loads((output/"browser.json").read_text(encoding="utf8"))["cases"]
    if len(measured)!=len(entries):raise ValueError("JS runner case count mismatch")
    by_id={row["id"]:row for row in measured}
    reference=[gemmi_reference(entry) for entry in entries]
    (output/"reference.json").write_text(json.dumps(dict(
        engine="Gemmi "+gemmi.__version__,cases=reference),indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    rows=[measure(entry,by_id[entry["id"]],ref,manifest["tolerances"])
          for entry,ref in zip(entries,reference)]
    counts=dict(Counter(row["status"] for row in rows))
    result=dict(generated_utc=datetime.now(timezone.utc).isoformat(),
                engine="Gemmi "+gemmi.__version__,count=len(rows),counts=counts,
                tolerances=manifest["tolerances"],cases=rows)
    (output/"report.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    md=report_markdown(rows,counts,manifest)
    (output/"report.md").write_text(md,encoding="utf8")
    print(md)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf8") as fh:fh.write(md)
    if counts.get("error"):return 2
    if args.strict and (counts.get("fail") or counts.get("inconclusive")):return 1
    return 0

if __name__=="__main__":
    sys.exit(main())
