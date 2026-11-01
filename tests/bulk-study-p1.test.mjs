import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkStudyPreparation} from '../bulk-study-preparation.js';
const make=(sites,cell={a:3.19,b:3.19,c:5.19,alpha:90,beta:90,gamma:120})=>({
 name:'Experimental candidate',symmetry:'P63mc',cell,sites});
test('GaN/AlN/SiC bulk input produces 3D metric but remains non-executable',()=>{
 for(const [mat,elements] of [['GaN',['Ga','N']],['AlN',['Al','N']],['SiC',['Si','C']]]){
  const prepared=bulkStudyPreparation(make(elements.map((symbol,i)=>({symbol,x:0,y:0,z:i/2}))),{material:mat,kmesh:[8,8,8]});
  assert.equal(prepared.checks.stoichiometric,true);
  assert.equal(prepared.executable,false);assert.equal(prepared.scientificallyAccepted,false);
  assert.equal(prepared.checks.existingApiSupports3DBulk,false);
  assert.ok(prepared.crystal.latticeVectorsAngstrom[2][2]>0);
 }
});
test('invalid occupancies, wrong stoichiometry and mesh cannot masquerade as accepted',()=>{
 const wrong=bulkStudyPreparation(make([{symbol:'Ga',x:0,y:0,z:0},{symbol:'N',x:.5,y:.5,z:.5,occupancy:.5}]),{material:'GaN'});
 assert.equal(wrong.checks.stoichiometric,false);
 assert.equal(wrong.checks.fullOccupancy,false);
 assert.throws(()=>bulkStudyPreparation(make([{symbol:'Ga',x:0,y:0,z:0}]),{material:'GaN',kmesh:[8,8,1]}));
 assert.throws(()=>bulkStudyPreparation(make([{symbol:'Ga',x:0,y:0,z:0}]),{material:'ZnO'}));
});
