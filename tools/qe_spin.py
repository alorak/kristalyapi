"""Bounded QE 6.7 scalar collinear LSDA reader; no SOC or energy shifts.

Column contract: QEF/q-e qe-6.7.0 PP/src/{dos,partialdos}.f90.
Atomic columns are E, LDOSup, LDOSdown, m1up, m1down, ... .
The final DOS integral column is shared across BOTH spin channels.
"""
import math
import re
from qe_pdos import _numeric_rows,exact_energy_window,parse_atom_orbital_pdos,parse_atom_symbols

NUMBER=r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][+-]?\d+)?'


def validate_spin_input(source,enabled):
    text='\n'.join(line.split('!',1)[0] for line in source.splitlines())
    if re.search(r'(?i)\b(?:noncolin|lspinorb)\s*=\s*\.true\.',text):
        raise ValueError('SOC/noncollinear input is not supported')
    spins=re.findall(r'(?i)\bnspin\s*=\s*(\d+)',text)
    if not enabled:
        if spins and spins!=['1']:raise ValueError('Spin-polarized input requires explicit --spin-polarized')
        return
    if spins!=['2']:raise ValueError('Collinear polarized input requires nspin=2 exactly once')
    if re.search(r'(?i)\b(?:tot_magnetization|constrained_magnetization|tot_charge)\s*=',text):
        raise ValueError('Only neutral unconstrained collinear spin is supported')
    for key,value in [('occupations','smearing'),('smearing','gaussian')]:
        found=re.findall(r'(?i)\b'+key+r"\s*=\s*['\"]([^'\"]+)['\"]",text)
        if found!=[value]:raise ValueError('Collinear workflow requires Gaussian smearing')
    widths=re.findall(r'(?i)\bdegauss\s*=\s*('+NUMBER+')',text)
    if len(widths)!=1 or not .001<=float(widths[0].replace('d','e').replace('D','E'))<=.05:
        raise ValueError('SCF spin smearing must be .001-.05 Ry')
    ntyp=re.search(r'(?i)\bntyp\s*=\s*(\d+)',text)
    seeds=re.findall(r'(?i)\bstarting_magnetization\s*\(\s*(\d+)\s*\)\s*=\s*('+NUMBER+')',text)
    if not ntyp or sorted(int(i) for i,v in seeds)!=list(range(1,int(ntyp[1])+1)):
        raise ValueError('Starting magnetization must cover each species exactly once')
    values=[float(v.replace('D','E').replace('d','e')) for i,v in seeds]
    if not any(values) or any(not math.isfinite(v) or abs(v)>1 for v in values):
        raise ValueError('Starting spin seeds must be bounded fractions, at least one nonzero')


def magnetization(raw):
    result={}
    for label,key in [('total','total_mu_b_per_cell'),('absolute','absolute_mu_b_per_cell')]:
        matches=re.findall(label+r'\s+magnetization\s*=\s*('+NUMBER+r')\s+Bohr mag/cell',raw,re.I)
        if not matches:raise ValueError('Missing final '+label+' collinear magnetization')
        value=float(matches[-1].replace('D','E').replace('d','e'))
        if not math.isfinite(value) or key.startswith('absolute') and value<0:raise ValueError('Invalid magnetization')
        result[key]=value
    if abs(result['total_mu_b_per_cell'])>result['absolute_mu_b_per_cell']+.011:
        raise ValueError('Inconsistent total/absolute magnetization')
    result['acceptance']='Functional evidence only; not magnetic ground-state or spin-convergence acceptance'
    return result


def spin_electronic_result(folder,metadata,bands,scf_source,scf_raw):
    dos=_numeric_rows(folder/'dos.dat',4)
    energy=[r[0] for r in dos]
    if any(a>=b for a,b in zip(energy,energy[1:])):raise ValueError('Spin DOS grid must increase')
    if any(b[3]<a[3]-1e-5 for a,b in zip(dos,dos[1:])):raise ValueError('Spin total integrated DOS must increase')
    projected=_numeric_rows(folder/'pdos.pdos_tot',5)
    source_points=len(projected)
    projected=exact_energy_window(projected,energy,'Spin DOS/PDOS grid')
    if bands['up']['distance']!=bands['down']['distance'] or len(bands['up']['energies_ev'])!=len(bands['down']['energies_ev']):
        raise ValueError('Spin band path/count mismatch')
    channels={}
    symbols=parse_atom_symbols(scf_source)
    for column,channel in enumerate(('up','down'),1):
        values=[r[column] for r in dos]
        pvalues=[r[column+2] for r in projected]
        ptotal={'energy_ev':energy,'total_dos_states_per_ev':[r[column] for r in projected],
                'sum_projected_states_per_ev':pvalues,'grid_selection':{'policy':'exact DOS window; no interpolation or energy shift',
                    'source_points':source_points,'selected_points':len(energy),'discarded_outside_window':source_points-len(energy)}}
        # QE DOS and projwfc DOS must describe the same spin channel at this grid.
        if any(abs(a-b)>.01+.02*max(a,b) for a,b in zip(values,ptotal['total_dos_states_per_ev'])):
            raise ValueError('Spin DOS and projwfc total DOS disagree: '+channel)
        channels[channel]={'schema':'kristalyapi.qe-spin-channel.v1','spin_mode':'collinear-polarized','spin_channel':channel,
            'bands':bands[channel],'dos':{'energy_ev':energy,'dos_states_per_ev':values},'pdos_total':ptotal,
            'pdos_atoms':parse_atom_orbital_pdos(folder,energy,pvalues,symbols,spin_channel=channel)}
    return {key:metadata[key] for key in ('source','input_sha256','pseudopotentials','energy_zero','band_path_labels')}|{
        'schema':'kristalyapi.qe-electronic.v2','spin_mode':'collinear-polarized','channels':channels,
        'integrated_dos_total':{'energy_ev':energy,'states':[r[3] for r in dos],
            'scope':'Total integrated states across both spins; not a separate integral per channel'},
        'magnetization':magnetization(scf_raw),'limitations':[
            'Neutral scalar collinear spin only; no SOC/noncollinear, charged cells or AFM sublattice species.',
            'Starting polarization is per element; does not constrain final magnetic moments.',
            'Functional pipeline evidence is not magnetic ground-state, physical convergence or optical acceptance.']}
