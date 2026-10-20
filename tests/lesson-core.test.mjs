import test from 'node:test';
import assert from 'node:assert/strict';
import {braggTwoTheta,braggInterference,twoWaveBands,tightBindingChainLevels,
 tightBindingBandEnergy,twoOrbitalBands,twoOrbitalBandGap,twoOrbitalWeights,fermiDirac,edgeStateOccupancies,KB_EV_K} from '../lesson-core.js';

test('Si (111) first-order Bragg peak is near 28.44 degrees for Cu K alpha',()=>{
 const d=5.431/Math.sqrt(3);
 const angle=braggTwoTheta(d,1.5406);
 assert.ok(Math.abs(angle-28.44)<0.03,angle);
 assert.equal(braggTwoTheta(1,3),null,'unreachable Bragg condition');
 assert.throws(()=>braggTwoTheta(0,1));
});

test('two-plane Bragg phase has maxima at integral path difference and cancellation at half-order',()=>{
 const d=5.431/Math.sqrt(3),lambda=1.5406;
 const theta=braggTwoTheta(d,lambda)/2;
 const peak=braggInterference(d,lambda,theta);
 assert.ok(Math.abs(peak.pathDifference-lambda)<1e-12);
 assert.ok(Math.abs(peak.phaseRadians-2*Math.PI)<1e-12);
 assert.ok(Math.abs(peak.relativeIntensity-1)<1e-12);
 const destructive=braggInterference(d,lambda,Math.asin(.5*lambda/(2*d))*180/Math.PI);
 assert.ok(destructive.relativeIntensity<1e-12,'half-wavelength path difference cancels');
 const thirdHalf=braggInterference(d,lambda,Math.asin(1.5*lambda/(2*d))*180/Math.PI);
 assert.ok(thirdHalf.relativeIntensity<1e-12,'1.5 wavelength path difference cancels');
 assert.throws(()=>braggInterference(0,lambda,theta));
 assert.throws(()=>braggInterference(d,lambda,90));
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

test('open tight-binding chain splits one level into exactly N eigenlevels',()=>{
 const t=0.8;
 assert.deepEqual(tightBindingChainLevels(1,t),[0]);
 const two=tightBindingChainLevels(2,t);
 assert.ok(Math.abs(two[0]+t)<1e-12&&Math.abs(two[1]-t)<1e-12);
 const three=tightBindingChainLevels(3,t);
 assert.ok(Math.abs(three[0]+Math.SQRT2*t)<1e-12);
 assert.ok(Math.abs(three[1])<1e-12&&Math.abs(three[2]-Math.SQRT2*t)<1e-12);
 for(const N of [1,2,3,8,64]){
  const levels=tightBindingChainLevels(N,t);
  assert.equal(levels.length,N);
  assert.ok(levels.every((e,i)=>Number.isFinite(e)&&(i===0||e>=levels[i-1])));
  assert.ok(levels.every(e=>Math.abs(e)<2*t+1e-12));
 }
 assert.deepEqual(tightBindingChainLevels(3,0),[0,0,0]);
 assert.throws(()=>tightBindingChainLevels(0,t));
 assert.throws(()=>tightBindingChainLevels(129,t));
 assert.throws(()=>tightBindingChainLevels(8,-1));
});

test('infinite periodic tight-binding band has 4t width and is k-even',()=>{
 const t=0.75;
 assert.ok(Math.abs(tightBindingBandEnergy(0,t)+2*t)<1e-12);
 assert.ok(Math.abs(tightBindingBandEnergy(1,t)-2*t)<1e-12);
 assert.ok(Math.abs(tightBindingBandEnergy(-1,t)-2*t)<1e-12);
 assert.equal(tightBindingBandEnergy(0.4,t),tightBindingBandEnergy(-0.4,t));
 const finite=tightBindingChainLevels(64,t);
 assert.ok(finite.at(-1)-finite[0]<4*t);
 assert.ok(finite.at(-1)-finite[0]>3.99*t,'open chain approaches periodic band width');
 assert.throws(()=>tightBindingBandEnergy(1.1,t));
});

test('equal two-orbital bonds and equal on-site energies close the gap at the zone boundary',()=>{
 const bands=twoOrbitalBands(1,1,1,0);
 assert.ok(Math.abs(bands.valence)<1e-12&&Math.abs(bands.conduction)<1e-12);
 assert.ok(twoOrbitalBandGap(1,1,0)<1e-12);
 const middle=twoOrbitalBands(0,1,1,0);
 assert.ok(Math.abs(middle.valence+2)<1e-12&&Math.abs(middle.conduction-2)<1e-12);
});

test('bond dimerization and orbital detuning separately open an exact forbidden gap',()=>{
 assert.ok(Math.abs(twoOrbitalBandGap(1.2,.8,0)-.8)<1e-12);
 assert.ok(Math.abs(twoOrbitalBandGap(1,1,1.2)-1.2)<1e-12);
 assert.ok(Math.abs(twoOrbitalBandGap(1.2,.8,1.2)-Math.hypot(.8,1.2))<1e-12);
 assert.ok(Math.abs(twoOrbitalBandGap(0,0,1.5)-1.5)<1e-12);
});

test('two-orbital valence/conduction branches stay ordered and gap is global minimum',()=>{
 const t1=1.25,t2=.75,delta=.65,gap=twoOrbitalBandGap(t1,t2,delta);
 for(let i=0;i<=200;i++){
  const k=-1+i/100;
  const b=twoOrbitalBands(k,t1,t2,delta);
  assert.ok(b.valence<=b.conduction);
  assert.ok(b.conduction-b.valence>=gap-1e-12);
  assert.deepEqual(b,twoOrbitalBands(-k,t1,t2,delta));
 }
 const offset=twoOrbitalBands(.5,t1,t2,delta,3);
 const standard=twoOrbitalBands(.5,t1,t2,delta);
 assert.ok(Math.abs(offset.valence-standard.valence-3)<1e-12);
 assert.throws(()=>twoOrbitalBands(1.01,1,1,0));
 assert.throws(()=>twoOrbitalBands(0,-1,1,0));
 assert.throws(()=>twoOrbitalBandGap(1,-1,0));
 assert.throws(()=>twoOrbitalBands(0,1,1,Number.NaN));
});

test('two-orbital wavefunction weights normalize and exchange between bands',()=>{
 const atomic=twoOrbitalWeights(0,0,0,2);
 assert.deepEqual(atomic,{degenerate:false,valence:{A:0,B:1},conduction:{A:1,B:0}});
 const balanced=twoOrbitalWeights(.5,1.2,.8,0);
 assert.equal(balanced.valence.A,.5);
 assert.equal(balanced.conduction.B,.5);
 for(const k of [-1,-.7,0,.3,1]){
  const weights=twoOrbitalWeights(k,1.2,.8,1.1);
  assert.equal(weights.degenerate,false);
  for(const band of ['valence','conduction']){
   assert.ok(weights[band].A>=0&&weights[band].B>=0);
   assert.ok(Math.abs(weights[band].A+weights[band].B-1)<1e-12);
  }
  assert.ok(Math.abs(weights.valence.A+weights.conduction.A-1)<1e-12);
 }
 assert.deepEqual(twoOrbitalWeights(1,1,1,0),{degenerate:true,valence:null,conduction:null});
 assert.throws(()=>twoOrbitalWeights(2,1,1,0));
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

test('ideal band-edge electron and hole probabilities obey thermal and Fermi limits',()=>{
 const cold=edgeStateOccupancies(1.1,0,100);
 const room=edgeStateOccupancies(1.1,0,300);
 const hot=edgeStateOccupancies(1.1,0,600);
 assert.ok(cold.electronProbability<room.electronProbability);
 assert.ok(room.electronProbability<hot.electronProbability);
 assert.ok(Math.abs(room.electronProbability-room.holeProbability)<1e-18,
  'mid-gap Fermi level is particle/hole symmetric in this ideal edge model');
 assert.ok(room.electronLog10<0&&hot.electronLog10>room.electronLog10);
 const offset=edgeStateOccupancies(1.1,0.2,300);
 assert.ok(offset.electronProbability>room.electronProbability);
 assert.ok(offset.holeProbability<room.holeProbability);
 assert.ok(offset.electronProbability>offset.holeProbability,
  'moving EF away from mid-gap removes edge-state electron/hole equality');
 const touching=edgeStateOccupancies(0,0,300);
 assert.equal(touching.electronProbability,0.5);
 assert.equal(touching.holeProbability,0.5);
 const tiny=edgeStateOccupancies(3,0,100);
 assert.ok(tiny.electronProbability>0&&Number.isFinite(tiny.electronLog10),
  'small probability remains measurable on logarithmic scale');
 assert.throws(()=>edgeStateOccupancies(-1,0,300));
 assert.throws(()=>edgeStateOccupancies(1,0,0));
 assert.throws(()=>edgeStateOccupancies(1,Number.NaN,300));
});
