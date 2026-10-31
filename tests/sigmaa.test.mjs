import test from 'node:test';
import assert from 'node:assert/strict';
import {besselI0e,besselI1e,inverseDSquared,epsilonCentric,maximumLikelihoodSigmaA,sigmaAWeights,sigmaACoefficients} from '../sigmaa.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
function rng(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)+.5)/2**32;}
function gaussian(random){return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());}
const fact=n=>{let f=1;for(let i=2;i<=n;i++)f*=i;return f;};
const seriesI=(x,n)=>{let s=0;for(let k=0;k<90;k++)s+=Math.pow(x/2,2*k+n)/(fact(k)*fact(k+n));return s*Math.exp(-x);};

test('scaled Bessel functions agree with their power series',()=>{
 for(const x of [0,.05,.5,1,2,3.7,3.8,5,8,15,30]){
  close(besselI0e(x)/seriesI(x,0),1,3e-7);
  if(x>0)close(besselI1e(x)/seriesI(x,1),1,3e-7);
 }
});

test('ε and centricity follow the point group (P2₁, C2, P-1)',()=>{
 const E=[[1,0,0],[0,1,0],[0,0,1]],twoY=[[-1,0,0],[0,1,0],[0,0,-1]],inv=[[-1,0,0],[0,-1,0],[0,0,-1]];
 assert.deepEqual(epsilonCentric([0,3,0],[E,twoY]),{epsilon:2,centric:false},'0k0 lies on the 2-fold axis');
 assert.deepEqual(epsilonCentric([2,0,1],[E,twoY]),{epsilon:1,centric:true},'h0l is centric in point group 2');
 assert.deepEqual(epsilonCentric([1,2,3],[E,twoY]),{epsilon:1,centric:false});
 assert.deepEqual(epsilonCentric([1,2,3],[E,twoY,E,twoY]),{epsilon:1,centric:false},'C centring repeats rotations');
 assert.deepEqual(epsilonCentric([1,2,3],[E,inv]),{epsilon:1,centric:true},'everything is centric with an inversion');
 // 1/d² of a cubic cell and of a monoclinic cell (direct formula).
 close(inverseDSquared({a:4,b:4,c:4,alpha:90,beta:90,gamma:90})(1,1,0),2/16,1e-15);
 const b=101.73*Math.PI/180,mono={a:50.347,b:4.777,c:14.746,alpha:90,beta:101.73,gamma:90};
 const expected=(1/Math.sin(b)**2)*(1/mono.a**2+Math.sin(b)**2/mono.b**2*1+1/mono.c**2*4-2*1*2*Math.cos(b)/(mono.a*mono.c));
 close(inverseDSquared(mono)(1,1,2),expected,1e-14);
});

// Simulate normalised structure factors with a known σA (acentric Wilson statistics):
// Eo = σA·Ec + √(1−σA²)·noise, all complex Gaussian.
function simulate(n,sigmaA,seed,centricFraction=0){
 const random=rng(seed),Eo=[],Ec=[],centric=[];
 for(let i=0;i<n;i++){
  const isCentric=random()<centricFraction;
  const c=isCentric?[gaussian(random),0]:[gaussian(random)/Math.SQRT2,gaussian(random)/Math.SQRT2];
  const e=isCentric?[gaussian(random),0]:[gaussian(random)/Math.SQRT2,gaussian(random)/Math.SQRT2];
  const o=[sigmaA*c[0]+Math.sqrt(1-sigmaA**2)*e[0],sigmaA*c[1]+Math.sqrt(1-sigmaA**2)*e[1]];
  Eo.push(Math.hypot(...o));Ec.push(Math.hypot(...c));centric.push(isCentric);
 }
 return {Eo,Ec,centric};
}

test('maximum likelihood recovers the σA used to simulate the data',()=>{
 for(const [sigmaA,frac] of [[.3,0],[.6,0],[.85,0],[.7,.3],[.95,.1]]){
  const {Eo,Ec,centric}=simulate(4000,sigmaA,Math.round(sigmaA*1000)+7,frac);
  const estimate=maximumLikelihoodSigmaA(Eo,Ec,centric);
  assert.ok(Math.abs(estimate-sigmaA)<.03,sigmaA+' → '+estimate);
 }
});

test('weights, coefficients and phases for a shell of reflections',()=>{
 const random=rng(3),cell={a:20,b:20,c:20,alpha:90,beta:90,gamma:90},E=[[1,0,0],[0,1,0],[0,0,1]];
 const reflections=[];
 for(let h=1;h<=8;h++)for(let k=-4;k<=4;k++)for(let l=0;l<=3;l++){
  const fc=1+9*random();reflections.push({h,k,l,fc,fo:Math.max(.01,fc*(.8+.4*random())),phase:360*random(),free:l===0?0:1});
 }
 const result=sigmaAWeights(reflections,cell,[E],{bins:3,freeFlagValue:0});
 assert.equal(result.shells.length,3);
 assert.ok(result.shells.every(s=>s.sigmaA>.5&&s.sigmaA<1&&s.work<s.n),'free reflections do not enter σA');
 for(const [r,w] of result.weights){
  assert.ok(w.m>0&&w.m<1);close(w.main,2*w.m*r.fo-w.D*r.fc,1e-12);close(w.difference,w.m*r.fo-w.D*r.fc,1e-12);
 }
 const diff=sigmaACoefficients(result,'difference');
 for(const c of diff){
  const r=reflections.find(x=>x.h===c.h&&x.k===c.k&&x.l===c.l),w=result.weights.get(r);
  assert.ok(c.fo>=0);close(c.phase,r.phase+(w.difference<0?180:0),1e-12);close(c.fo,Math.abs(w.difference),1e-12);
 }
 assert.throws(()=>sigmaAWeights(reflections.slice(0,10),cell,[E]),/en az 20/);
 assert.throws(()=>sigmaACoefficients(result,'both'),/geçersiz/);
});
