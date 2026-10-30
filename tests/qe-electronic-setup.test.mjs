import test from 'node:test';
import assert from 'node:assert/strict';
import {slabAnalysis,suggestBandPath,bandCapacityAdvice,bandCapacityFrom} from '../qe-electronic-setup.js';
import {protocolById} from '../qe-protocol-templates.js';
import {parseQeBandPath} from '../qe-api-client.js';

const mos2=protocolById('mos2-d41').request.structure;
const siCubic=[[5.43,0,0],[0,5.43,0],[0,0,5.43]];
const siAtoms=[[0,0,0],[.25,.25,.25],[.5,.5,0],[.75,.75,.25],[.5,0,.5],[.75,.25,.75],[0,.5,.5],[.25,.75,.75]].map(fractional=>({fractional}));

test('vacuum along c separates 2D layers from bulk crystals',()=>{
 const layer=slabAnalysis(mos2.cell_angstrom,mos2.atoms);
 assert.equal(layer.isSlab,true);assert.ok(layer.vacuumAngstrom>20&&layer.vacuumAngstrom<21);
 const bulk=slabAnalysis(siCubic,siAtoms);
 assert.equal(bulk.isSlab,false);assert.ok(Math.abs(bulk.vacuumAngstrom-1.3575)<1e-9);
 // Periodic wrap: atoms near z=0 and z=1 belong to one layer.
 assert.equal(slabAnalysis([[3,0,0],[0,3,0],[0,0,20]],[{fractional:[0,0,.98]},{fractional:[0,0,.02]}]).isSlab,true);
 assert.throws(()=>slabAnalysis(mos2.cell_angstrom,[]),/boş/);
});

test('suggested paths follow the 2D Bravais lattice and are valid server paths',()=>{
 const hex=suggestBandPath(mos2.cell_angstrom);
 assert.equal(hex.lattice,'hexagonal');
 assert.deepEqual(parseQeBandPath(hex.path).map(p=>[p.label,p.k[0],p.k[1]]),
  [['Gamma',0,0],['M',.5,0],['K',.333333333333,.333333333333],['Gamma',0,0]]);
 assert.equal(parseQeBandPath(hex.path).at(-1).segments,1);
 // γ=60° cells place the M-adjacent K at (2/3, 1/3).
 assert.match(suggestBandPath([[3,0,0],[1.5,2.598076211,0],[0,0,20]]).path,/^K 0\.666666666667 0\.333333333333 0 /m);
 assert.deepEqual(parseQeBandPath(suggestBandPath([[3,0,0],[0,3,0],[0,0,20]]).path).map(p=>p.label),['Gamma','X','M','Gamma']);
 assert.deepEqual(parseQeBandPath(suggestBandPath([[3,0,0],[0,4,0],[0,0,20]]).path).map(p=>p.label),['Gamma','X','S','Y','Gamma']);
 assert.deepEqual(suggestBandPath([[3,0,0],[1,4,0],[0,0,20]]),{lattice:'oblique',path:null});
 // Samples are spaced by reciprocal length, not split evenly.
 const counts=parseQeBandPath(hex.path).map(p=>p.segments);
 assert.ok(counts[2]>counts[0]&&counts[0]>counts[1],'|KΓ| > |ΓM| > |MK|');
});

test('band capacity comes from server UPF valence, with a few empty bands',()=>{
 assert.deepEqual(bandCapacityFrom({electronic_preflight:{neutral_valence_electrons:26,minimum_nbnd:13}}),{electrons:26,minimum:13});
 assert.deepEqual(bandCapacityFrom('nbnd=26 cannot hold 256 neutral valence electrons; this spin workflow requires at least 128 bands per channel'),{electrons:256,minimum:128});
 assert.equal(bandCapacityFrom('UPF changed during electronic preflight: Mo'),null);
 assert.equal(bandCapacityFrom({valid:true}),null);
 assert.deepEqual(bandCapacityAdvice({electrons:26,minimum:13}),{electrons:26,minimum:13,suggested:17,fits:true});
 assert.equal(bandCapacityAdvice({electrons:256,minimum:128}).suggested,128,'resource limit caps the suggestion');
 assert.equal(bandCapacityAdvice({electrons:512,minimum:256},128).fits,false);
});
