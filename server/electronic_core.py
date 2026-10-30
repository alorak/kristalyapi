"""D4 strictly structured 2D band/DOS/PDOS jobs; no raw inputs or paths."""
import copy
import hashlib
import math
import re
import xml.etree.ElementTree as ET

from job_core import ALLOWED_TOP, canonical_request, num
from qe_post_settings import canonical_dos_settings
from resource_policy import current as resource_limits,DEFAULT

SCHEMA="kristalyapi.qe-electronic-job.v1"


def scf_request(data):
    result={key:copy.deepcopy(data[key]) for key in ALLOWED_TOP}
    result["schema"]="kristalyapi.qe-scf-job.v1"
    spin=result['parameters'].get('spin')=='polarized'
    extra={key:result['parameters'].pop(key) for key in ('starting_magnetization','degauss_ry') if key in result['parameters']}
    result["parameters"]["calculation"]="scf"
    result['parameters']['spin']='unpolarized'
    canonical,fingerprint=canonical_request(result)
    if spin:canonical['parameters'].update(spin='polarized',**extra)
    return canonical,fingerprint


def canonical_electronic_request(data):
    if set(data)!=ALLOWED_TOP|{"electronic"}:
        raise ValueError("Electronic jobs require exact structured fields")
    if not isinstance(data["parameters"],dict) or data["parameters"].get("calculation")!="electronic":
        raise ValueError("Invalid electronic calculation type")
    polarized=data.get('schema')=='kristalyapi.qe-electronic-job.v2'
    params=data['parameters']
    if polarized:
        from job_core import ALLOWED_PARAMS
        if set(params)!=ALLOWED_PARAMS|{'starting_magnetization','degauss_ry'} or params.get('spin')!='polarized':
            raise ValueError('Electronic v2 requires explicit collinear polarized parameters')
        seeds=params['starting_magnetization']
        if not isinstance(data.get('structure'),dict) or not isinstance(data['structure'].get('atoms'),list):raise ValueError('Invalid spin structure')
        species={a.get('element') for a in data.get('structure',{}).get('atoms',[]) if isinstance(a,dict)}
        if not isinstance(seeds,dict) or set(seeds)!=species:
            raise ValueError('Starting magnetization must cover every element exactly')
        seeds={sp:num(value,-1,1,'starting magnetization') for sp,value in sorted(seeds.items())}
        if not any(seeds.values()):raise ValueError('At least one nonzero starting polarization is required')
        width=num(params['degauss_ry'],.001,.05,'SCF Gaussian smearing (Ry)')
    elif params.get('spin')!='unpolarized' or set(params)!={'calculation','functional','ecutwfc_ry','ecutrho_ry','kpoints','spin'}:
        raise ValueError('Electronic v1 only supports unpolarized parameters')
    settings=data["electronic"]
    required={"nbnd","nscf_k","band_path"}
    if not isinstance(settings,dict) or not required<=set(settings) or set(settings)-required-{'dos','band_window'}:
        raise ValueError("Expected explicit bands, dense mesh and band path")
    nbnd,mesh=settings["nbnd"],settings["nscf_k"]
    if type(nbnd) is not int or not 1<=nbnd<=resource_limits()["max_bands"] or type(mesh) is not int or not 2<=mesh<=resource_limits()["max_nscf_k"]:
        raise ValueError("nbnd must be 1-"+str(resource_limits()["max_bands"])+" and dense 2D k mesh 2-"+str(resource_limits()["max_nscf_k"]))
    path=settings["band_path"]
    if not isinstance(path,list) or not 2<=len(path)<=16:
        raise ValueError("An explicit 2-16 point crystal_b path is required")
    points=[]
    for point in path:
        if not isinstance(point,dict) or set(point)!={"label","k","segments"}:
            raise ValueError("Band point requires label, k and segments")
        if not isinstance(point["label"],str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,15}",point["label"]):
            raise ValueError("Invalid band point label")
        if not isinstance(point["k"],list) or len(point["k"])!=3:
            raise ValueError("Band point requires three reciprocal coordinates")
        k=[num(x,-2,2,"band coordinate") for x in point["k"]]
        n=point["segments"]
        if k[2]!=0 or type(n) is not int or not 1<=n<=100:
            raise ValueError("D4 supports bounded paths in the kz=0 plane")
        points.append({"label":point["label"],"k":k,"segments":n})
    if points[-1]["segments"]!=1 or sum(x["segments"] for x in points)>300:
        raise ValueError("Last path weight must be 1; total segments must not exceed 300")
    result,fingerprint=scf_request(data)
    if result["parameters"]["kpoints"][2]!=1:
        raise ValueError("D4 supports 2D slab meshes with kz=1")
    result["schema"]='kristalyapi.qe-electronic-job.v2' if polarized else SCHEMA
    result["parameters"]["calculation"]="electronic"
    if polarized:
        result['parameters'].update(starting_magnetization=seeds,degauss_ry=width)
        if 'dos' not in settings:raise ValueError('Polarized jobs require explicit DOS settings')
    result["electronic"]={"nbnd":nbnd,"nscf_k":mesh,"band_path":points}
    if 'dos' in settings:result['electronic']['dos']=canonical_dos_settings(settings['dos'])
    if 'band_window' in settings:
        w=settings['band_window']
        if not isinstance(w,list) or len(w)!=2 or any(type(n) is not int for n in w) or not 1<=w[0]<=w[1]<=nbnd or w[1]-w[0]+1>300:
            raise ValueError('Band window must select 1-300 existing bands using one-based indices')
        result['electronic']['band_window']=w.copy()
    if resource_limits()!=DEFAULT and (len(result['structure']['atoms'])>64 or nbnd>128):
        if 'dos' not in result['electronic'] or nbnd>300 and 'band_window' not in result['electronic']:
            raise ValueError('Large electronic jobs require explicit DOS and a bounded band window')
        p=result['electronic']['dos'];points=round((p['energy_max_ev']-p['energy_min_ev'])/p['delta_e_ev'])+1
        if nbnd*sum(q['segments'] for q in result['electronic']['band_path'])>120000:
            raise ValueError('Large electronic raw band grid exceeds point budget')
        if len(result['structure']['atoms'])*points>400000:
            raise ValueError('Large electronic view exceeds atom/energy sample budget')
    return result,fingerprint


def path_text(request):
    return "\n".join(point["label"]+" "+" ".join(f"{x:.12g}" for x in point["k"])+
                     " "+str(point["segments"]) for point in request["electronic"]["band_path"])+"\n"


def checked_band_capacity(request, upf, pseudo_dir):
    """Necessary band-count check from the actual pinned UPF v2 headers.

    It cannot select a suitable empty-band count or establish spin/convergence.
    """
    valence = {};wfc_counts={}
    large=resource_limits()!=DEFAULT and (len(request["structure"]["atoms"])>64 or request["electronic"]["nbnd"]>128)
    for element, meta in upf.items():
        raw = (pseudo_dir/meta['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta['sha256']:
            raise ValueError('UPF changed during electronic preflight: '+element)
        match = re.search(br'<PP_HEADER\b[^>]*>',raw[:131072])
        if match is None:
            raise ValueError('Electronic band preflight requires a UPF v2 PP_HEADER: '+element)
        tag = match[0]
        if not tag.endswith(b'/>'):tag = tag[:-1]+b'/>'
        try:
            header = ET.fromstring(tag).attrib
            value = float(header['z_valence'].replace('D','E').replace('d','e'))
            if header['element'].strip() != element or not math.isfinite(value) or not 0 < value <= 100:
                raise ValueError('Element or valence mismatch')
        except (ET.ParseError,KeyError,ValueError) as exc:
            raise ValueError('Invalid electronic UPF element/z_valence header: '+element) from exc
        if request['parameters']['spin']=='polarized' and header.get('has_so','').strip().lower() not in ('f','false'):
            raise ValueError('Spin workflow requires explicit scalar UPF has_so=false: '+element)
        valence[element] = value
        if large:
            count=header.get('number_of_wfc','')
            if not re.fullmatch(r'[0-9]+',count) or not 1<=int(count)<=20:
                raise ValueError('Large PDOS preflight requires a bounded UPF number_of_wfc: '+element)
            wfc_counts[element]=int(count)
    electrons = sum(valence[a['element']] for a in request['structure']['atoms'])
    if abs(electrons-round(electrons)) > 1e-7:
        raise ValueError('Fractional neutral electron counts require a different electronic workflow')
    electrons = round(electrons)
    # Conservative capacity for unconstrained collinear spin occupations: each
    # spin band can hold one electron; this is not an empty-band convergence test.
    polarized=request['parameters']['spin']=='polarized'
    minimum = electrons if polarized else math.ceil(electrons/2)
    requested = request['electronic']['nbnd']
    if requested < minimum:
        raise ValueError(f'nbnd={requested} cannot hold {electrons} neutral valence electrons; '
                         f'this spin workflow requires at least {minimum} bands per channel')
    view={}
    if large:
        p=request['electronic']['dos'];points=round((p['energy_max_ev']-p['energy_min_ev'])/p['delta_e_ev'])+1
        samples=sum(wfc_counts[a['element']] for a in request['structure']['atoms'])*points*(2 if polarized else 1)
        if samples>750000:raise ValueError('Large PDOS view exceeds atomic-wavefunction sample budget')
        view={'view_preflight':{'energy_points':points,'atomic_wfc_samples':samples,'upf_wfc_counts':wfc_counts}}
    return {**view,'neutral_valence_electrons':electrons,'minimum_nbnd':minimum,'requested_nbnd':requested,
            'upf_valence_electrons':valence,
            'scope':'Necessary capacity only; empty-band, spin and physical convergence acceptance are separate'}
