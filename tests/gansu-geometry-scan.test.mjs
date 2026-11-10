import test from 'node:test';
import assert from 'node:assert/strict';
import {geometryScanPlan,runGansuGeometryScan,SCAN_DEFAULTS} from '../gansu-geometry-scan.js';
import {GANSU_UPSTREAM_COMMIT,parseGansuXyz} from '../gansu-local-engine.js';
const xyz={
 H2:'2\nH2\nH 0 0 0\nH 0 0 0.74',
 H2O:'3\nH2O\nO 0 0 0\nH 0.757 0.586 0\nH -0.757 0.586 0',
 SiH4:'5\nSiH4\nSi 0 0 0\nH 0.85448 0.85448 0.85448\nH -0.85448 -0.85448 0.85448\nH -0.85448 0.85448 -0.85448\nH 0.85448 -0.85448 -0.85448'
};
const settings=m=>({xyz:xyz[m],functional:'PBE',grid:'medium',charge:0,multiplicity:1});
test('real P0.3 geometry templates have correct radial scan bonds and atom identities',()=>{
 for(const molecule of Object.keys(xyz)){
  const p=geometryScanPlan(settings(molecule),{...SCAN_DEFAULTS[molecule],points:5});
  assert.equal(p.molecule,molecule);
  assert.equal(p.samples.length,5);
  for(const {bondA,xyz:sample} of p.samples){
   const atoms=parseGansuXyz(sample);const center=atoms.find(a=>a.symbol!=='H')?.xyz||atoms[0].xyz;
   for(const a of atoms.filter(x=>x.symbol==='H').slice(molecule==='H2'?1:0))
    assert.ok(Math.abs(Math.hypot(...a.xyz.map((v,k)=>v-center[k]))-bondA)<1e-7);
  }
 }
});
test('fail closed for unsupported species, pathological and uneven geometry, bad grids',()=>{
 assert.throws(()=>geometryScanPlan({...settings('H2O'),xyz:'3\nweird\nO 0 0 0\nH 1 0 0\nH 0 1.2 0'},{startA:0.7,endA:1.2}),/eşit değil/);
 assert.throws(()=>geometryScanPlan({...settings('H2'),xyz:'2\nLiH\nLi 0 0 0\nH 0 0 1.5'},{startA:0.7,endA:1.2}),/Yalnız/);
 for(const args of [{startA:1,endA:0.7},{startA:0.5,endA:2.8},{startA:0.6,endA:1,points:10},{startA:0.7,endA:0.71,points:5}])
  assert.throws(()=>geometryScanPlan(settings('H2'),args));
});
test('SCF calls are sequential, all curves are real WASM results, minimum sampled only',async()=>{
 const plan=geometryScanPlan(settings('H2'),{startA:0.60,endA:1.0,points:5});
 const called=[],updates=[];
 const result=await runGansuGeometryScan(plan,{engine:async s=>{
  assert.equal(s.functional,'PBE');assert.equal(s.grid,'medium');
  const bond=Math.abs(parseGansuXyz(s.xyz)[1].xyz[2]);
  called.push(bond);
  return {backend:'WASM',upstreamCommit:GANSU_UPSTREAM_COMMIT,energyHartree:-1+(bond-0.8)**2,iterations:7};
 },onProgress:v=>updates.push(v.completed)});
 assert.equal(called.length,5);assert.deepEqual(updates,[1,2,3,4,5]);
 assert.equal(result.minimumSampledBondA,0.8);
 assert.equal(result.points[2].relativeEnergyEv,0);
 assert.ok(result.points[0].relativeEnergyEv>0);
 assert.equal(result.periodic,false);
});
test('backend fallback, non-finite energies and cancellation cannot produce an accepted scan',async()=>{
 const plan=geometryScanPlan(settings('H2'),{startA:0.6,endA:1.2,points:3});
 const engine=async()=>({backend:'JS',upstreamCommit:GANSU_UPSTREAM_COMMIT,energyHartree:-1,iterations:3});
 await assert.rejects(runGansuGeometryScan(plan,{engine}),/WASM/);
 const ctrl=new AbortController();ctrl.abort();
 let called=false;
 await assert.rejects(runGansuGeometryScan(plan,{engine:async()=>{called=true;},signal:ctrl.signal}),/AbortError/);
 assert.equal(called,false);
});
