import test from 'node:test';
import assert from 'node:assert/strict';
import {braggTwoTheta,braggInterference,twoWaveBands,tightBindingChainLevels,
 tightBindingBandEnergy,twoOrbitalBands,twoOrbitalBandGap,twoOrbitalWeights,fermiDirac,edgeStateOccupancies,idealDopedCarriers,idealPnJunction,pnJunctionProfile,idealDiodeState,idealDiodeMinorityProfile,KB_EV_K} from '../lesson-core.js';

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

test('P1 ideal doping preserves charge neutrality and mass-action equilibrium',()=>{
 const pure=idealDopedCarriers();
 assert.equal(pure.electronsCm3,pure.holesCm3);
 assert.equal(pure.electronsCm3,pure.intrinsicCm3);
 assert.equal(pure.fermiShiftEV,0);
 assert.equal(pure.majority,'intrinsic');
 const n=idealDopedCarriers({donorsCm3:1e16});
 const p=idealDopedCarriers({acceptorsCm3:1e16});
 for(const [state,imbalance] of [[n,1e16],[p,-1e16]]){
  assert.ok(Math.abs((state.electronsCm3-state.holesCm3-imbalance)/1e16)<1e-12,
   'free carrier difference must balance ionized dopants');
  assert.ok(Math.abs((state.electronsCm3*state.holesCm3)/
   (state.intrinsicCm3**2)-1)<1e-12,'np must equal ni squared');
  assert.equal(state.nondegenerate,true);
 }
 assert.equal(n.majority,'electrons');
 assert.equal(p.majority,'holes');
 assert.ok(n.fermiShiftEV>0&&p.fermiShiftEV<0);
 assert.ok(n.holesCm3>0&&p.electronsCm3>0,'minority carriers never disappear');
});

test('P1 compensated doping, temperature and input limits',()=>{
 const compensated=idealDopedCarriers({donorsCm3:5e15,acceptorsCm3:5e15});
 assert.ok(Math.abs(compensated.fermiShiftEV)<1e-12);
 assert.ok(Math.abs(compensated.electronsCm3-compensated.holesCm3)<1e-4);
 const cold=idealDopedCarriers({temperatureK:250});
 const hot=idealDopedCarriers({temperatureK:450});
 assert.ok(hot.intrinsicCm3>cold.intrinsicCm3);
 assert.ok(hot.ncCm3>cold.ncCm3&&hot.nvCm3>cold.nvCm3);
 const dense=idealDopedCarriers({donorsCm3:1e18,temperatureK:450});
 assert.ok(Number.isFinite(dense.fermiEV));
 assert.throws(()=>idealDopedCarriers({donorsCm3:-1}));
 assert.throws(()=>idealDopedCarriers({acceptorsCm3:NaN}));
 assert.throws(()=>idealDopedCarriers({temperatureK:0}));
 assert.throws(()=>idealDopedCarriers({temperatureK:500}));
});

test('P2 PN junction neutral charge, field direction and integrated barrier',()=>{
 const j=idealPnJunction();
 assert.ok(j.builtInPotentialV>0.6&&j.builtInPotentialV<0.9);
 assert.ok(Math.abs(j.pWidthCm-j.nWidthCm)<1e-16);
 assert.ok(Math.abs(j.acceptorsCm3*j.pWidthCm-
  j.donorsCm3*j.nWidthCm)/(j.acceptorsCm3*j.pWidthCm)<1e-12,
  'fixed acceptor and donor sheet charges must balance');
 const left=pnJunctionProfile(j,-j.pWidthCm);
 const middle=pnJunctionProfile(j,0);
 const right=pnJunctionProfile(j,j.nWidthCm);
 const pInner=pnJunctionProfile(j,-j.pWidthCm/2);
 const nInner=pnJunctionProfile(j,j.nWidthCm/2);
 assert.equal(left.fieldVcm,0);
 assert.equal(right.fieldVcm,0);
 assert.ok(pInner.chargeCcm3<0&&nInner.chargeCcm3>0);
 assert.ok(pInner.fieldVcm<0&&middle.fieldVcm<0&&nInner.fieldVcm<0,
  'E must point from n to p (negative x)');
 assert.ok(Math.abs(middle.fieldVcm+j.peakFieldVcm)<1e-9);
 assert.equal(left.potentialV,0);
 assert.ok(Math.abs(right.potentialV-j.barrierV)<1e-12);
 assert.ok(middle.potentialV>0&&middle.potentialV<j.barrierV);
 let integral=0;
 for(let i=0;i<2000;i++){
  const x0=-j.pWidthCm+j.depletionWidthCm*i/2000;
  const x1=-j.pWidthCm+j.depletionWidthCm*(i+1)/2000;
  integral+=-(pnJunctionProfile(j,x0).fieldVcm+
   pnJunctionProfile(j,x1).fieldVcm)/2*(x1-x0);
 }
 assert.ok(Math.abs(integral-j.barrierV)/j.barrierV<1e-6,
  'integral of -E dx must equal barrier voltage');
});

test('P2 forward/reverse bias and one-sided doping alter the depletion width',()=>{
 const equilibrium=idealPnJunction();
 const forward=idealPnJunction({appliedBiasV:0.3});
 const reverse=idealPnJunction({appliedBiasV:-0.4});
 assert.ok(forward.depletionWidthCm<equilibrium.depletionWidthCm);
 assert.ok(reverse.depletionWidthCm>equilibrium.depletionWidthCm);
 assert.ok(forward.peakFieldVcm<equilibrium.peakFieldVcm);
 assert.ok(reverse.peakFieldVcm>equilibrium.peakFieldVcm);
 const asym=idealPnJunction({acceptorsCm3:1e15,donorsCm3:1e18});
 assert.ok(asym.pWidthCm>asym.nWidthCm*900);
 const dense=idealPnJunction({acceptorsCm3:1e18,donorsCm3:1e18});
 assert.ok(dense.depletionWidthCm<equilibrium.depletionWidthCm);
 assert.throws(()=>idealPnJunction({acceptorsCm3:0}));
 assert.throws(()=>idealPnJunction({donorsCm3:-1}));
 assert.throws(()=>idealPnJunction({appliedBiasV:10}));
 assert.throws(()=>idealPnJunction({temperatureK:0}));
 assert.throws(()=>pnJunctionProfile(null,0));
 assert.throws(()=>pnJunctionProfile(equilibrium,NaN));
});

test('P3 ideal Shockley diode has zero, exponential forward and reverse saturation current',()=>{
 const zero=idealDiodeState({appliedBiasV:0});
 assert.equal(zero.currentA,0);
 assert.ok(zero.saturationCurrentA>0);
 assert.equal(zero.boundaryFactor,1);
 const forward=idealDiodeState({appliedBiasV:.3});
 const higher=idealDiodeState({appliedBiasV:.4});
 const reverse=idealDiodeState({appliedBiasV:-.3});
 assert.ok(forward.currentA>0&&higher.currentA>forward.currentA);
 assert.ok(reverse.currentA<0);
 assert.ok(Math.abs(reverse.currentA/reverse.saturationCurrentA+1)<1e-4);
 const shockley=Math.expm1(.3/(KB_EV_K*300));
 assert.ok(Math.abs(forward.currentA/forward.saturationCurrentA-shockley)/shockley<1e-12,
  'Shockley exponential factor');
 assert.ok(forward.junction.depletionWidthCm<zero.junction.depletionWidthCm);
 assert.ok(reverse.junction.depletionWidthCm>zero.junction.depletionWidthCm);
 assert.equal(forward.lowInjection,true);
});

test('P3 diode area and dopant density affect current through physical Is',()=>{
 const a=idealDiodeState({appliedBiasV:.4,areaMm2:1});
 const triple=idealDiodeState({appliedBiasV:.4,areaMm2:3});
 assert.ok(Math.abs(triple.currentA/a.currentA-3)<1e-12);
 assert.ok(Math.abs(triple.saturationCurrentA/a.saturationCurrentA-3)<1e-12);
 const lightlyDoped=idealDiodeState({acceptorsCm3:1e15,
  donorsCm3:1e15,appliedBiasV:.4});
 assert.ok(lightlyDoped.saturationCurrentA>a.saturationCurrentA,
  'less doping means more equilibrium minority carriers and larger Is in this model');
 const hotForward=idealDiodeState({acceptorsCm3:1e15,
  donorsCm3:1e15,appliedBiasV:.55});
 assert.equal(hotForward.lowInjection,false);
 assert.equal(hotForward.depletionValid,false);
 assert.throws(()=>idealDiodeState({areaMm2:0}));
 assert.throws(()=>idealDiodeState({donorsCm3:-1}));
 assert.throws(()=>idealDiodeState({appliedBiasV:2}));
});

test('P3 minority injection and extraction obey the diffusion-length exponential',()=>{
 const forward=idealDiodeState({appliedBiasV:.25});
 for(const [side,length] of [['p',forward.electronDiffusionLengthCm],
  ['n',forward.holeDiffusionLengthCm]]){
  const edge=idealDiodeMinorityProfile(forward,side,0);
  const step=idealDiodeMinorityProfile(forward,side,length);
  assert.ok(edge.excessCm3>0&&step.excessCm3>0);
  assert.ok(Math.abs(step.excessCm3/edge.excessCm3-Math.exp(-1))<1e-12);
  assert.ok(edge.concentrationCm3>edge.equilibriumCm3);
 }
 const reverse=idealDiodeState({appliedBiasV:-.3});
 for(const side of ['p','n']){
  const edge=idealDiodeMinorityProfile(reverse,side,0);
  assert.ok(edge.concentrationCm3>0);
  assert.ok(edge.concentrationCm3<edge.equilibriumCm3);
  assert.ok(edge.excessCm3<0);
 }
 const noBias=idealDiodeMinorityProfile(idealDiodeState(), 'p',0);
 assert.equal(noBias.excessCm3,0);
 assert.throws(()=>idealDiodeMinorityProfile(forward,'bad',0));
 assert.throws(()=>idealDiodeMinorityProfile(forward,'p',-1));
});
