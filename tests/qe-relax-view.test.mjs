import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRelaxationResult} from '../qe-relax-view.js';
import {parseQeBandPath} from '../qe-api-client.js';

const hash='a'.repeat(64),final='b'.repeat(64);
function fixture(){
 const structure={periodic:true,cell_angstrom:[[5,0,0],[0,5,0],[0,0,5]],
  atoms:[{element:'Si',fractional:[.99,.2,.2]},{element:'Si',fractional:[.25,.25,.25]}]};
 const proof={job_done:true,scf_converged:true,last_scf_accuracy_ry:1e-9,max_force_component_ry_bohr:1e-5};
 const result={schema:'kristalyapi.qe-relax-scf-result.v1',engine:'quantum-espresso',
  structure_hash:hash,final_structure_hash:final,scf_converged:true,geometry_converged:true,job_done:true,
  initial_structure:structure,final_structure:structuredClone(structure),energy_ry:-8,energy_ev:-8*13.605693122994,
  relaxation_settings:{force_threshold_ry_bohr:1e-4},
  stages:{relax:{...proof,geometry_converged:true,has_final_coordinates:true},scf:{...proof,structure_hash:final}}};
 result.final_structure.atoms[0].fractional[0]=.01;return result;
}
test('D3 comparison preserves source data and wraps a boundary crossing',()=>{
 const data=fixture(),before=JSON.stringify(data),result=parseRelaxationResult(data,hash);
 assert.ok(Math.abs(result.rows[0].deltaAngstrom-.1)<1e-12);
 assert.equal(JSON.stringify(data),before);
 assert.equal(result.maxForceComponent,1e-5);
 assert.equal(result.before.atoms[0].fractional[0],.99);
 assert.equal(result.after.atoms[0].fractional[0],.01);
 assert.ok(Math.abs(result.rows[0].alignedAfterFractional[0]-1.01)<1e-12);
});
test('ionic history preserves raw paired steps and excludes independent SCF energy',()=>{
 const raw=fixture(),hash='c'.repeat(64);
 raw.stages.relax.energy_ry=-8;
 raw.stages.relax.total_force_ry_bohr=.00002;
 raw.relaxation_settings.max_steps=20;
 raw.artifact_sha256={'relax.out':hash};
 raw.ionic_history={schema:'kristalyapi.qe-ionic-history.v1',source:'relax.out',
  stdout_sha256:hash,steps:[
   {step:1,energy_ry:-7.99,total_force_ry_bohr:.00005},
   {step:2,energy_ry:-8,total_force_ry_bohr:.00002}
  ]};
 const before=JSON.stringify(raw),parsed=parseRelaxationResult(raw,'a'.repeat(64));
 assert.equal(parsed.ionicHistory.steps.length,2);
 assert.equal(parsed.ionicHistory.steps[0].energy_ry,-7.99);
 assert.equal(JSON.stringify(raw),before);
 for(const change of [
  x=>x.ionic_history.stdout_sha256='d'.repeat(64),
  x=>x.ionic_history.steps[1].energy_ry=-7.9,
  x=>x.ionic_history.steps[1].total_force_ry_bohr=3,
  x=>x.ionic_history.steps[1].step=3,
  x=>x.ionic_history.steps[0].total_force_ry_bohr=-1,
  x=>x.ionic_history.steps.push({...x.ionic_history.steps[1],step:3})
 ]){
  const broken=structuredClone(raw);change(broken);
  assert.throws(()=>parseRelaxationResult(broken,'a'.repeat(64)),/İyonik adım/);
 }
 assert.equal(parseRelaxationResult(fixture(),'a'.repeat(64)).ionicHistory,null);
});
test('D3 rejects stale source, changed cell/order and nonfinite positions',()=>{
 assert.throws(()=>parseRelaxationResult(fixture(),'c'.repeat(64)),/kaynak/);
 for(const edit of [d=>d.final_structure.cell_angstrom[0][0]=6,
  d=>d.final_structure.atoms[0].element='S',d=>d.final_structure.atoms[0].fractional[0]=NaN,
  d=>d.stages.scf.structure_hash='c'.repeat(64)]){
  const d=fixture();edit(d);assert.throws(()=>parseRelaxationResult(d,hash));
 }
});
test('D3 rejects unconverged stages, excessive forces and inconsistent energy units',()=>{
 for(const edit of [d=>d.stages.relax.geometry_converged=false,d=>d.stages.scf.last_scf_accuracy_ry=1e-5,
  d=>d.stages.scf.max_force_component_ry_bohr=1e-3,d=>d.energy_ev=-1,d=>d.scf_converged=false]){
  const d=fixture();edit(d);assert.throws(()=>parseRelaxationResult(d,hash));
 }
});
test('D3 form sends the selected operation and explicit bounded ionic settings',()=>{
 const source=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 const func=source.match(/function qeJobPayload\(\)\{[\s\S]+?\n\}\nasync function qeJobPreflight/)[0]
  .replace(/\nasync function qeJobPreflight$/,'');
 const values={qeJobWorkflow:'relax-scf',qeCalcType:'relax',qeOccupation:'fixed',qeJobProfile:'si-pbe',qeKx:2,qeKy:2,qeKz:2,
  qeEcutwfc:45,qeEcutrho:360,qeFreezeBottom:0,qeJobMaxSteps:30,qeForceThreshold:.0001,qeJobEnergyThreshold:.000001};
 const run=()=>Function('$','state','qeCalculationStructure','basis','validateCell','const qeResourceProfile=null,normalizeQeApiUrl=x=>x;return ('+func+')()')(
  id=>({value:values[id]??'',checked:false}),{},()=>({cell:{},sites:[{symbol:'Si',x:0,y:0,z:0}]}),
  ()=>[[5,0,0],[0,5,0],[0,0,5]].map(row=>({toArray:()=>row})),x=>x);
 const relaxed=run();assert.equal(relaxed.schema,'kristalyapi.qe-relax-scf-job.v1');
 assert.equal(relaxed.parameters.calculation,'relax-scf');assert.equal(relaxed.relaxation.max_steps,30);
 values.qeFreezeBottom=1;assert.throws(run,/tüm atomlar serbest/);
 values.qeFreezeBottom=0;values.qeJobWorkflow='scf';const scf=run();
 assert.equal(scf.schema,'kristalyapi.qe-scf-job.v1');assert.equal(scf.parameters.calculation,'scf');
 assert.equal(scf.relaxation,undefined);
});
test('D4 explicitly selected final geometry is submitted without changing the active structure',()=>{
 const source=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 const func=source.match(/function qeJobPayload\(\)\{[\s\S]+?\n\}\nasync function qeJobPreflight/)[0].replace(/\nasync function qeJobPreflight$/,'');
 const chosen={structure:fixture().final_structure,hash:final},before=JSON.stringify(chosen);
 const values={qeJobWorkflow:'electronic',qeCalcType:'relax',qeOccupation:'fixed',qeJobProfile:'si-pbe',
  qeKx:2,qeKy:2,qeKz:1,qeEcutwfc:45,qeEcutrho:360,qeElectronicNbnd:8,qeElectronicMesh:2,
  qeElectronicPath:'Gamma 0 0 0 3\nX .5 0 0 1'};
 const run=Function('$','state','qeCalculationStructure','basis','validateCell','qeElectronicSource','parseQeBandPath','const qeResourceProfile=null,normalizeQeApiUrl=x=>x;return ('+func+')()');
 const result=run(id=>({value:values[id]??'',checked:false}),{},()=>{throw Error('active geometry must not be used');},null,null,chosen,parseQeBandPath);
 assert.equal(result.schema,'kristalyapi.qe-electronic-job.v1');assert.equal(result.parameters.calculation,'electronic');
 assert.equal(result.electronic.nbnd,8);assert.deepEqual(result.structure,chosen.structure);
 assert.equal(JSON.stringify(chosen),before);assert.equal(result.relaxation,undefined);
});
