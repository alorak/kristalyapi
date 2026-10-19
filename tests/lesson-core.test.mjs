import test from 'node:test';
import assert from 'node:assert/strict';
import {braggTwoTheta,twoWaveBands,fermiDirac,KB_EV_K} from '../lesson-core.js';

test('Si (111) first-order Bragg peak is near 28.44 degrees for Cu K alpha',()=>{
 const d=5.431/Math.sqrt(3);
 const angle=braggTwoTheta(d,1.5406);
 assert.ok(Math.abs(angle-28.44)<0.03,angle);
 assert.equal(braggTwoTheta(1,3),null,'unreachable Bragg condition');
 assert.throws(()=>braggTwoTheta(0,1));
});

test('two-wave Hamiltonian opens exactly 2|VG| at the Brillouin-zone edge',()=>{
 for(const V of [0,0.2,0.75]){
  const left=twoWaveBands(-1,5.43,1,V),right=twoWaveBands(1,5.43,1,V);
  assert.ok(Math.abs(right.upper-right.lower-2*V)<1e-12);
  assert.deepEqual(left,right,'symmetric one-dimensional dispersion');
 }
 const zero=twoWaveBands(0,5.43,1,0);
 assert.ok(Math.abs(zero.lower)<1e-12,'free electron has E(k=0)=0');
 assert.throws(()=>twoWaveBands(0,5.43,0,0.3));
});

test('E(k) scales with effective mass and period for a free electron',()=>{
 const reference=twoWaveBands(0.5,4,1,0).lower;
 assert.ok(Math.abs(twoWaveBands(0.5,4,2,0).lower-reference/2)<1e-12);
 assert.ok(Math.abs(twoWaveBands(0.5,8,1,0).lower-reference/4)<1e-12);
});

test('Fermi Dirac at EF is 1/2, satisfies particle-hole symmetry and temperature limits',()=>{
 for(const T of [100,300,600]){
  assert.equal(fermiDirac(0.12,0.12,T),0.5);
  assert.ok(Math.abs(fermiDirac(0.12+0.05,0.12,T)+fermiDirac(0.12-0.05,0.12,T)-1)<1e-12);
 }
 assert.ok(Math.abs(fermiDirac(KB_EV_K*300,0,300)-1/(1+Math.E))<1e-12);
 assert.equal(fermiDirac(9,0,300),0);
 assert.throws(()=>fermiDirac(1,0,0));
});
