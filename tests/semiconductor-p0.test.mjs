import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES,KB,bandParameters,carrierEquilibrium,fermiProbability,materialForStructure,lowFieldHall,nearestNeighbors,angleDegrees} from '../semiconductor-physics-p0-core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const approx=(x,y,tolerance=.01)=>assert.ok(Math.abs(x-y)<=tolerance, x+' should be near '+y);
const cell={a:5.431,b:5.431,c:5.431,alpha:90,beta:90,gamma:90};
const fcc=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]];
const diamond=[...fcc,...fcc.map(v=>v.map(x=>(x+.25)%1))].map(([x,y,z],i)=>({symbol:'Si',label:'Si'+i,x,y,z}));
test('material detection only uses supported whole-crystal compositions',()=>{
 assert.equal(materialForStructure({sites:diamond}),'Si');
 assert.equal(materialForStructure({sites:[{symbol:'Si'},{symbol:'B'},{symbol:'P'}]}),'Si');
 assert.equal(materialForStructure({sites:[{symbol:'Ge'}]}),'Ge');
 assert.equal(materialForStructure({sites:[{symbol:'Ga'},{symbol:'As'}]}),'GaAs');
 assert.equal(materialForStructure({sites:[{symbol:'Ga'}]}),null);
 assert.equal(materialForStructure({sites:[{symbol:'Cu'},{symbol:'O'}]}),null);
});
test('Si Ge GaAs reference gaps follow the Varshni 300 K values',()=>{
 approx(bandParameters('Si',300).eg,1.1245,.01);
 approx(bandParameters('Ge',300).eg,.663,.01);
 approx(bandParameters('GaAs',300).eg,1.424,.01);
 assert.ok(bandParameters('Si',600).eg<bandParameters('Si',300).eg);
 assert.ok(bandParameters('Si',300).ni<bandParameters('Ge',300).ni);
});
test('intrinsic Si has n=p and Fermi not assumed exactly midgap',()=>{
 const c=carrierEquilibrium('Si',300);
 approx(c.n/c.holes,1,1e-9);
 approx(c.n/c.ni,1,1e-9);
 assert.ok(Math.abs(c.ef-c.eg/2)>1e-3);
 approx(fermiProbability(c.ef,c.ef,300),.5,1e-15);
});
test('Si:P and Si:B incomplete ionization obey charge neutrality and mass action',()=>{
 for(const [nd,na] of [[1e16,0],[0,1e16],[1e16,7e15],[1e16,1e16]]){
  const c=carrierEquilibrium('Si',300,nd,na);
  const scale=Math.max(c.n,c.holes,c.positiveDonors,c.negativeAcceptors,1);
  assert.ok(Math.abs(c.neutrality)/scale<1e-11,'charge must be neutral');
  assert.ok(Math.abs(c.n*c.holes/(c.ni*c.ni)-1)<1e-9,'n p = ni²');
  assert.ok(c.positiveDonors<=nd&&c.negativeAcceptors<=na);
 }
 assert.ok(carrierEquilibrium('Si',300,1e16,0).n>carrierEquilibrium('Si',300).n);
 assert.ok(carrierEquilibrium('Si',300,0,1e16).holes>carrierEquilibrium('Si',300).holes);
 assert.throws(()=>carrierEquilibrium('GaAs',300,1e16,0),/yalnız Si/);
});
test('at lower T freeze-out gives lower ionized donor fraction',()=>{
 const warm=carrierEquilibrium('Si',300,1e16,0);
 const cold=carrierEquilibrium('Si',100,1e16,0);
 assert.ok(cold.positiveDonors/1e16<warm.positiveDonors/1e16);
});
test('low-field Hall sign switches between majority electrons and holes',()=>{
 const n=carrierEquilibrium('Si',300,1e16,0),p=carrierEquilibrium('Si',300,0,1e16);
 const hn=lowFieldHall(n,PROFILES.Si.mun,PROFILES.Si.mup,.001,.5,.0005);
 const hp=lowFieldHall(p,PROFILES.Si.mun,PROFILES.Si.mup,.001,.5,.0005);
 assert.ok(hn.coefficientM3C<0&&hn.voltageV<0);
 assert.ok(hp.coefficientM3C>0&&hp.voltageV>0);
 approx(lowFieldHall(n,1350,480,.001,0,.0005).voltageV,0,1e-12);
});
test('diamond Si has 4 tetrahedral nearest neighbors with 2.35 Angstrom spacing',()=>{
 const ns=nearestNeighbors({cell,sites:diamond},0,8);
 assert.equal(ns.filter(n=>n.distance<2.37).length,4);
 ns.slice(0,4).forEach(n=>approx(n.distance,5.431*Math.sqrt(3)/4,1e-5));
 approx(angleDegrees(ns[0].vector,ns[1].vector),109.4712,.001);
});
test('tab integration preserves General markup, supports Atom/Material and selected editor atom',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'semiconductor-p0.js'),'utf8');
 for(const id of ['scGeneralPane','scAtomPane','scMaterialPane','scLessonTabs'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const id of ['scChainAtoms','scDopingExponent','scPnAcceptors','scRealVoltage','scFermi'])assert.match(html,new RegExp('id="'+id+'"'),'General experiment must be retained');
 assert.match(app,/semiconductorP0=initSemiconductorP0\(host\)/);
 assert.match(app,/selectedAtom\(\)/);
 assert.match(ui,/aria-selected/);
 assert.match(ui,/switchTab\('general'\)/);
 assert.ok(!ui.includes('state.sites['),'P0 previews should not modify CIF atoms');
});
