"""Pure bounded DOS/projwfc settings shared by the API and operator CLI."""
import math


def canonical_dos_settings(data):
    keys={'delta_e_ev','degauss_ry','energy_min_ev','energy_max_ev'}
    if not isinstance(data,dict) or set(data)!=keys:
        raise ValueError('DOS settings require delta_e_ev, degauss_ry, energy_min_ev, energy_max_ev')
    bounds={'delta_e_ev':(.005,.2),'degauss_ry':(.001,.05),
            'energy_min_ev':(-500,500),'energy_max_ev':(-500,500)}
    result={}
    for key,(low,high) in bounds.items():
        value=data[key]
        if type(value) not in (int,float) or not math.isfinite(value) or not low<=value<=high:
            raise ValueError('DOS '+key+' is outside its finite permitted range')
        result[key]=float(value)
    steps=(result['energy_max_ev']-result['energy_min_ev'])/result['delta_e_ev']
    if not 1<=steps<=10000 or abs(steps-round(steps))>1e-7:
        raise ValueError('DOS range must have 2–10001 points and an integer number of energy steps')
    return result
