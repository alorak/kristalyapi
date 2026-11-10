import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMpElectronic,mpReferenceCurves} from '../mp-electronic-core.js';
const fixture=()=>({schema:'kristalyapi.mp-electronic.v1',provider:'Materials Project',
 material_id:'mp-149',retrieved_at:'2026-11-10T12:00:00Z',mp_api_version:'0.test',
 path_type:'setyawan_curtarolo',provenance:{band_task_id:'mp-123',dos_task_id:'mp-124'},
 band:{efermi_ev:5,distance_inv_angstrom:[0,0.5,1],labels:[{index:0,label:'Γ'},{index:2,label:'X'}],
  first_band:1,total_bands:2,spins:{up:[[4,4.5,5],[6,6.5,7]]}},
 dos:{efermi_ev:5.2,energy_ev:[4.2,5.2,6.2],spins:{up:[0,1,2]}}});
test('real-curve schema retains separate Fermi zeros, path labels and provenance',()=>{
 const value=parseMpElectronic(fixture()),plot=mpReferenceCurves(value);
 assert.equal(value.materialId,'mp-149');
 assert.deepEqual(plot.band[0].curves[0],[-1,-0.5,0]);
 assert.deepEqual(plot.dos[0].x,[-1,0,1]);
 assert.deepEqual(plot.labels.map(x=>x.label),['Γ','X']);
 assert.equal(value.provenance.bandTask,'mp-123');
});
test('reject false origins, mismatched dimensions and missing data',()=>{
 for(const change of [
  x=>{x.provider='QE';},x=>{x.material_id='evil';},
  x=>{x.band.spins.up[0].pop();},x=>{x.dos.spins.up[1]=-2;},
  x=>{x.band.labels[1].index=0;},x=>{x.band.first_band=10;},
  x=>{x.band=null;x.dos=null;},x=>{x.dos.energy_ev=[0,0,1];}
 ]){
  const v=fixture();change(v);assert.throws(()=>parseMpElectronic(v),/MP elektronik veri/);
 }
});
test('spin-polarized reference can render channels independently',()=>{
 const v=fixture();v.band.spins.down=[[4.1,4.6,5.1],[6.1,6.6,7.1]];v.dos.spins.down=[0.1,0.2,0.3];
 const view=mpReferenceCurves(parseMpElectronic(v));
 assert.deepEqual(view.band.map(x=>x.spin),['up','down']);
 assert.deepEqual(view.dos.map(x=>x.spin),['up','down']);
});
