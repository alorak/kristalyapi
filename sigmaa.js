/* V20: σA-weighted map coefficients from Fo, Fc and model phases
 * (Read, Acta Cryst. A42 (1986) 140–149).
 *
 * In resolution shells of equal size (by 1/d²) the observed and calculated
 * amplitudes are normalised, E² = F² / (ε ⟨F²/ε⟩), and σA is the value that
 * maximises the likelihood of the observed |E_o| given |E_c|:
 *   acentric  p(E_o) = 2E_o/(1−σA²) · exp(−(E_o²+σA²E_c²)/(1−σA²)) · I₀(X)
 *   centric   p(E_o) = √(2/(π(1−σA²))) · exp(−(E_o²+σA²E_c²)/(2(1−σA²))) · cosh(X/2)
 * with X = 2σA E_o E_c/(1−σA²). Then
 *   m = I₁(X)/I₀(X) (acentric), tanh(X/2) (centric),   D = σA·√(Σ_o/Σ_c),
 *   main: 2mFo − DFc (acentric), mFo (centric);   difference: mFo − DFc,
 * all with the model phase φc. σA is constant within a shell (no smoothing)
 * and no bulk-solvent or anisotropic scaling is done here: use Fc that
 * already contains them (e.g. Refmac FC_ALL/PHIC_ALL). */

/* Modified Bessel functions scaled by e^{−x} (Abramowitz & Stegun 9.8.1–9.8.4,
 * relative error < 2·10⁻⁷), x ≥ 0. */
export function besselI0e(x){
 if(x<3.75){const t=(x/3.75)**2;return Math.exp(-x)*(1+t*(3.5156229+t*(3.0899424+t*(1.2067492+t*(.2659732+t*(.0360768+t*.0045813))))));}
 const t=3.75/x;
 return (.39894228+t*(.01328592+t*(.00225319+t*(-.00157565+t*(.00916281+t*(-.02057706+t*(.02635537+t*(-.01647633+t*.00392377))))))))/Math.sqrt(x);
}
export function besselI1e(x){
 if(x<3.75){const t=(x/3.75)**2;return Math.exp(-x)*x*(.5+t*(.87890594+t*(.51498869+t*(.15084934+t*(.02658733+t*(.00301532+t*.00032411))))));}
 const t=3.75/x;
 return (.39894228+t*(-.03988024+t*(-.00362018+t*(.00163801+t*(-.01031555+t*(.02282967+t*(-.02895312+t*(.01787654-t*.00420059))))))))/Math.sqrt(x);
}
const logCosh=x=>{const a=Math.abs(x);return a+Math.log1p(Math.exp(-2*a))-Math.LN2;};

/* Reciprocal metric for 1/d² from cell parameters (Å, degrees). */
export function inverseDSquared(cell){
 const r=Math.PI/180,[ca,cb,cg]=[cell.alpha,cell.beta,cell.gamma].map(v=>Math.cos(v*r)),[sa,sb,sg]=[cell.alpha,cell.beta,cell.gamma].map(v=>Math.sin(v*r));
 const V=cell.a*cell.b*cell.c*Math.sqrt(1-ca*ca-cb*cb-cg*cg+2*ca*cb*cg);
 const as=cell.b*cell.c*sa/V,bs=cell.a*cell.c*sb/V,cs=cell.a*cell.b*sg/V;
 const cas=(cb*cg-ca)/(sb*sg),cbs=(ca*cg-cb)/(sa*sg),cgs=(ca*cb-cg)/(sa*sb);
 return (h,k,l)=>h*h*as*as+k*k*bs*bs+l*l*cs*cs+2*k*l*bs*cs*cas+2*h*l*as*cs*cbs+2*h*k*as*bs*cgs;
}

/* ε (operations whose rotation leaves h unchanged) and centricity (some
 * rotation sends h to −h), from the rotation parts R (x' = R x + t) of the
 * space-group operations. Indices transform as h' = h R. */
export function epsilonCentric(h,rotations){
 const seen=new Set();let epsilon=0,centric=false;
 for(const R of rotations){
  const key=R.flat().join(',');if(seen.has(key))continue;seen.add(key); // centring repeats rotations
  const m=[0,1,2].map(j=>h[0]*R[0][j]+h[1]*R[1][j]+h[2]*R[2][j]);
  if(m[0]===h[0]&&m[1]===h[1]&&m[2]===h[2])epsilon++;
  if(m[0]===-h[0]&&m[1]===-h[1]&&m[2]===-h[2])centric=true;
 }
 return {epsilon,centric};
}

function logLikelihood(s,Eo,Ec,centric){
 const a=1-s*s;let sum=0;
 for(let n=0;n<Eo.length;n++){
  const eo=Eo[n],ec=Ec[n],X=2*s*eo*ec/a,q=eo*eo+s*s*ec*ec;
  sum+=centric[n]?.5*Math.log(2/(Math.PI*a))-q/(2*a)+logCosh(X/2)
   :Math.log(2*eo/a)-q/a+Math.log(besselI0e(X))+X;
 }
 return sum;
}
/* Golden-section maximisation of the shell likelihood on [0.001, 0.999]. */
export function maximumLikelihoodSigmaA(Eo,Ec,centric){
 let a=.001,b=.999;const g=(Math.sqrt(5)-1)/2;
 let c=b-g*(b-a),d=a+g*(b-a),fc=logLikelihood(c,Eo,Ec,centric),fd=logLikelihood(d,Eo,Ec,centric);
 for(let it=0;it<80&&b-a>1e-8;it++){
  if(fc>fd){b=d;d=c;fd=fc;c=b-g*(b-a);fc=logLikelihood(c,Eo,Ec,centric);}
  else{a=c;c=d;fc=fd;d=a+g*(b-a);fd=logLikelihood(d,Eo,Ec,centric);}
 }
 return (a+b)/2;
}

/* reflections: [{h,k,l,fo,fc,phase(deg), free?}] (unique, merged).
 * Returns per-reflection {m, D, centric, epsilon, main, difference} (signed
 * amplitudes along φc) and the shell table. Reflections with the excluded
 * free-flag value do not take part in the σA estimate (they still get
 * weights from their shell). */
export function sigmaAWeights(reflections,cell,rotations,{bins=null,freeFlagValue=null}={}){
 const rows=reflections.filter(r=>Number.isFinite(r.fo)&&r.fo>0&&Number.isFinite(r.fc)&&r.fc>0&&Number.isFinite(r.phase)&&(r.h||r.k||r.l));
 if(rows.length<20)throw Error('σA tahmini için en az 20 Fo/Fc yansıması gerekli.');
 const s2=inverseDSquared(cell);
 const data=rows.map(r=>({r,s2:s2(r.h,r.k,r.l),...epsilonCentric([r.h,r.k,r.l],rotations)}));
 if(data.some(x=>!(x.epsilon>=1)))throw Error('Yansıma ε çarpanı hesaplanamadı.');
 data.sort((x,y)=>x.s2-y.s2);
 const nb=bins??Math.max(1,Math.min(20,Math.round(data.length/60)));
 if(!Number.isInteger(nb)||nb<1||nb>50)throw Error('σA kabuk sayısı 1–50 olmalı.');
 const out=new Map(),shells=[];
 for(let b=0;b<nb;b++){
  const shell=data.slice(Math.floor(b*data.length/nb),Math.floor((b+1)*data.length/nb));
  const work=shell.filter(x=>freeFlagValue===null||x.r.free!==freeFlagValue);
  if(work.length<5)throw Error('σA kabuğunda yeterli yansıma yok; kabuk sayısını azaltın.');
  const So=work.reduce((s,x)=>s+x.r.fo**2/x.epsilon,0)/work.length,Sc=work.reduce((s,x)=>s+x.r.fc**2/x.epsilon,0)/work.length;
  const E=(x,F,S)=>F/Math.sqrt(x.epsilon*S);
  const sigmaA=maximumLikelihoodSigmaA(work.map(x=>E(x,x.r.fo,So)),work.map(x=>E(x,x.r.fc,Sc)),work.map(x=>x.centric));
  const D=sigmaA*Math.sqrt(So/Sc);
  for(const x of shell){
   const eo=E(x,x.r.fo,So),ec=E(x,x.r.fc,Sc),X=2*sigmaA*eo*ec/(1-sigmaA*sigmaA);
   const m=x.centric?Math.tanh(X/2):besselI1e(X)/besselI0e(X);
   out.set(x.r,{m,D,centric:x.centric,epsilon:x.epsilon,
    main:x.centric?m*x.r.fo:2*m*x.r.fo-D*x.r.fc,difference:m*x.r.fo-D*x.r.fc});
  }
  shells.push({dMax:1/Math.sqrt(shell[0].s2),dMin:1/Math.sqrt(shell[shell.length-1].s2),n:shell.length,work:work.length,sigmaA,D,
   meanM:shell.reduce((s,x)=>s+out.get(x.r).m,0)/shell.length});
 }
 return {weights:out,shells,used:rows.length};
}

/* Map coefficient rows (non-negative amplitude, phase in degrees) for the
 * existing Fourier summation: a negative signed amplitude is the same
 * coefficient with φc + 180°. */
export function sigmaACoefficients(result,kind){
 if(!['main','difference'].includes(kind))throw Error('σA harita türü geçersiz.');
 return [...result.weights].map(([r,w])=>{
  const value=w[kind];
  return {h:r.h,k:r.k,l:r.l,fo:Math.abs(value),fc:NaN,phase:r.phase+(value<0?180:0),sigma:r.sigma,fom:w.m,free:r.free};
 });
}
