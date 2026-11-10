/* P1.1/P1.2 bounded, deterministic powder peak auto-indexing.
 * Candidate search, NOT definitive phase/space-group identification.
 * Bravais P/I/F filtering applies ONLY for cubic; hexagonal uses P lattice.
 * Structure factors, sample displacement, doublets, impurity phases and absences
 * from screw/glide or atomic basis are not modeled. */
import {fitPowderPeaks,TITANIUM_WAVELENGTH} from './powder-indexing-core.js';
const RAD=Math.PI/180, DEG=180/Math.PI;
const positive=(n)=>Number.isFinite(n)&&n>0;
const qAt=(angle,lambda)=>4*Math.sin(angle*RAD/2)**2/(lambda*lambda);
const twoTheta=(q,lambda)=>{
 const s=lambda*Math.sqrt(q)/2;
 return s>0&&s<1?2*Math.asin(s)*DEG:null;
};
function parseNumber(value){
 if(typeof value==='string'&&!value.trim())return NaN;
 return Number(typeof value==='string'?value.trim().replace(',','.'):value);
}
export function cubicAllowed(h,k,l,centering){
 if(centering==='P')return true;
 if(centering==='I')return (h+k+l)%2===0;
 if(centering==='F')return (h%2===k%2)&&(k%2===l%2);
 throw new RangeError('Unknown cubic centering.');
}
export function cubicFamilies(centering='P',maxIndex=12){
 const byN=new Map();
 for(let h=0;h<=maxIndex;h++)for(let k=0;k<=h;k++)for(let l=0;l<=k;l++){
  const n=h*h+k*k+l*l;
  if(!n||!cubicAllowed(h,k,l,centering))continue;
  if(!byN.has(n))byN.set(n,{h,k,l,n,basal:n,axial:0});
 }
 return [...byN.values()].sort((a,b)=>a.n-b.n);
}
export function hexagonalFamilies(hmax=6,lmax=10){
 const byIndex=new Map();
 for(let h=0;h<=hmax;h++)for(let k=0;k<=h;k++)for(let l=0;l<=lmax;l++){
  const n=h*h+h*k+k*k,axial=l*l;
  if(!n&&!axial)continue;
  const key=n+':'+axial;
  if(!byIndex.has(key))byIndex.set(key,{h,k,l,n,basal:n,axial});
 }
 return [...byIndex.values()].sort((a,b)=>(a.basal+a.axial)-(b.basal+b.axial));
}
function measurementsFromAngles(peaks,lambda){
 if(!Array.isArray(peaks)||peaks.length<5||peaks.length>40)
  throw new RangeError('Auto indexing requires 5–40 measured peaks.');
 const data=peaks.map((row,i)=>{
  const angle=parseNumber(typeof row==='object'?row.twoTheta:row);
  if(!(angle>3&&angle<150))throw new RangeError('Invalid 2theta at peak '+(i+1)+'.');
  return {angle,q:qAt(angle,lambda),originalIndex:i};
 }).sort((a,b)=>a.angle-b.angle);
 for(let i=1;i<data.length;i++)if(data[i].angle-data[i-1].angle<0.03)
  throw new RangeError('Repeated or unresolved 2theta positions must be reviewed.');
 return data;
}
function predictedLines(families,system,a,c,wavelength,low,high){
 const alpha=system==='cubic'?1/(a*a):4/(3*a*a),beta=system==='cubic'?0:1/(c*c);
 const results=[];
 for(const family of families){
  const q=family.basal*alpha+family.axial*beta;
  if(!(q>0))continue;
  const angle=twoTheta(q,wavelength);
  if(angle!==null&&angle>=low&&angle<=high)results.push({...family,angle,q});
 }
 results.sort((x,y)=>x.angle-y.angle);
 return results;
}
function candidateFit(obs,predicted,tol){
 const edges=[];
 for(let p=0;p<predicted.length;p++){
  const item=predicted[p];
  for(let o=0;o<obs.length;o++){
   const diff=obs[o].angle-item.angle;
   if(Math.abs(diff)<=tol)edges.push({o,p,diff,absolute:Math.abs(diff)});
  }
 }
 edges.sort((a,b)=>a.absolute-b.absolute||a.o-b.o||a.p-b.p);
 const usedObs=new Set(),usedPred=new Set(),matched=[];
 for(const edge of edges){
  if(usedObs.has(edge.o)||usedPred.has(edge.p))continue;
  usedObs.add(edge.o);usedPred.add(edge.p);
  const assigned=predicted[edge.p],measured=obs[edge.o];
  matched.push({rowIndex:measured.originalIndex,twoTheta:measured.angle,
   h:assigned.h,k:assigned.k,l:assigned.l,predictedTwoTheta:assigned.angle,
   deltaTwoTheta:edge.diff});
 }
 matched.sort((a,b)=>a.twoTheta-b.twoTheta);
 const unmatched=obs.filter(x=>!usedObs.has(obs.indexOf(x))).map(x=>({
  rowIndex:x.originalIndex,twoTheta:x.angle
 }));
 const rmse=matched.length?Math.sqrt(matched.reduce((s,m)=>s+m.deltaTwoTheta**2,0)/matched.length):Infinity;
 const unpredicted=predicted.length-usedPred.size;
 return {matched,unmatched,rmse,unpredicted,predictedCount:predicted.length,
  score:matched.length*120-unmatched.length*130-unpredicted*3.2-rmse*75};
}
function evaluate(obs,families,system,centering,lambda,tolerance,a,c){
 const low=obs[0].angle-tolerance,high=obs.at(-1).angle+tolerance;
 const pred=predictedLines(families,system,a,c,lambda,low,high);
 const match=candidateFit(obs,pred,tolerance);
 return {...match,system,centering,a,c,cOverA:c/a,
  latticeType:system==='cubic'?centering:'hexagonal'};
}
function refine(seed,obs,families,lambda,tolerance,aMin,aMax,cMin,cMax){
 let next=seed;
 // One-to-one assignments can change after refinement; two iterations are enough
 // for the local least-squares fit while keeping evaluation bounded.
 for(let pass=0;pass<2;pass++){
  if(next.matched.length<(next.system==='hexagonal'?3:2))break;
  try{
   const fit=fitPowderPeaks({system:next.system,wavelength:lambda,peaks:next.matched});
   if(!(fit.a>=aMin&&fit.a<=aMax&&fit.c>=cMin&&fit.c<=cMax))break;
   const updated=evaluate(obs,families,next.system,next.centering,lambda,tolerance,fit.a,fit.c);
   if(updated.matched.length<next.matched.length)break;
   next=updated;
  }catch{break;}
 }
 return next;
}
function qTolerance(angle,lambda,tol){
 const q=qAt(angle,lambda);
 return Math.max(qAt(angle+tol,lambda)-q,q-qAt(angle-tol,lambda));
}
function quickMatches(obs,families,system,alpha,beta,lambda,tol){
 // Cheap screening avoids trigonometry and sorting for most hexagonal seeds.
 let count=0;
 const required=Math.max(4,Math.ceil(obs.length*.6));
 for(let i=0;i<obs.length;i++){
  const q=obs[i].q,t=qTolerance(obs[i].angle,lambda,tol);
  let found=false;
  for(const f of families){
   if(Math.abs(f.basal*alpha+f.axial*beta-q)<=t){found=true;break;}
  }
  if(found)count++;
  if(count+obs.length-1-i<required)break;
 }
 return count>=required;
}
function consider(store,proposal,limit=90){
 if(proposal.matched.length<4)return;
 store.push(proposal);
 store.sort((a,b)=>b.score-a.score||b.matched.length-a.matched.length||a.rmse-b.rmse);
 if(store.length>limit)store.pop();
}
function distinctCandidates(candidates,limit){
 const distinct=[];
 for(const candidate of candidates){
  if(distinct.some(other=>other.system===candidate.system&&other.centering===candidate.centering&&
   Math.abs(other.a-candidate.a)/candidate.a<.008&&
   Math.abs(other.c-candidate.c)/candidate.c<.008))continue;
  distinct.push(candidate);
  if(distinct.length>=limit)break;
 }
 return distinct;
}
/* 2theta-only CSV/text clipboard input, optional intensity column.
 * A delimiter is interpreted as a decimal comma only for a one-column row. */
export function parseMeasuredAngles(text){
 if(typeof text!=='string'||text.length>24000)throw new RangeError('Angle list is missing or too large.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
 if(!lines.length)throw new RangeError('Angle list is empty.');
 const first=lines[0].toLowerCase().replace(/[\s_°()]/g,'');
 const hasHeader=/^(?:2theta|2θ|twotheta|angle)(?:$|[,;])/.test(first);
 const delim=hasHeader?(first.includes(';')?';':first.includes(',')?',':null):null;
 const data=lines.slice(hasHeader?1:0);
 if(data.length<5||data.length>40)throw new RangeError('Auto indexing requires 5–40 measured peaks.');
 return data.map((line,i)=>{
  const value=(delim?line.split(delim)[0]:line.includes(';')?line.split(';')[0]:
   line.includes('.')&&line.includes(',')?line.split(',')[0]:line).trim();
  const number=parseNumber(value);
  if(!(number>3&&number<150))throw new RangeError('Invalid 2theta at peak '+(i+1)+'.');
  return {twoTheta:number};
 });
}
export function autoIndexPowder({peaks,wavelength=TITANIUM_WAVELENGTH,system='hexagonal',
 centering='all',toleranceDeg=0.20,aMin=2,aMax=10,cMin=2,cMax=15,limit=8}={}){
 const lambda=parseNumber(wavelength),tol=parseNumber(toleranceDeg);
 const amin=parseNumber(aMin),amax=parseNumber(aMax),cmin=parseNumber(cMin),cmax=parseNumber(cMax);
 if(!positive(lambda)||lambda>10)throw new RangeError('Invalid wavelength.');
 if(!['hexagonal','cubic'].includes(system))throw new RangeError('Invalid crystal system.');
 if(!(tol>=.05&&tol<=.6))throw new RangeError('Tolerance must be 0.05–0.6 degrees.');
 if(!(amin>=1.2&&amax>amin&&amax<=15))throw new RangeError('Invalid a search range.');
 if(!(cmin>=1.2&&cmax>cmin&&cmax<=22))throw new RangeError('Invalid c search range.');
 if(system==='cubic'&&!['P','I','F','all'].includes(centering))throw new RangeError('Invalid centering.');
 if(!Number.isInteger(limit)||limit<1||limit>20)throw new RangeError('Invalid candidate limit.');
 const obs=measurementsFromAngles(peaks,lambda),pool=[];
 const centerings=system==='cubic'?(centering==='all'?['P','I','F']:[centering]):['P'];
 let evaluated=0;
 if(system==='cubic'){
  for(const cent of centerings){
   const families=cubicFamilies(cent,12);
   // Search multiple low-angle anchors to tolerate absent early reflections.
   for(const measured of obs.slice(0,Math.min(4,obs.length))){
    for(const family of families){
     const a=Math.sqrt(family.n/measured.q);
     if(a<amin||a>amax)continue;
     const alpha=1/(a*a);
     if(!quickMatches(obs,families,'cubic',alpha,0,lambda,tol))continue;
     const candidate=evaluate(obs,families,'cubic',cent,lambda,tol,a,a);evaluated++;
     consider(pool,candidate);
    }
   }
  }
 }else{
  const seeds=hexagonalFamilies(3,5),families=hexagonalFamilies(6,10);
  const pairs=[];
  for(let i=0;i<Math.min(5,obs.length);i++)for(let j=i+1;j<Math.min(5,obs.length);j++)
   pairs.push([obs[i],obs[j]]);
  for(const [first,second] of pairs)for(const one of seeds)for(const two of seeds){
   const determinant=one.basal*two.axial-two.basal*one.axial;
   if(!determinant)continue;
   const alpha=(first.q*two.axial-second.q*one.axial)/determinant;
   const beta=(second.q*one.basal-first.q*two.basal)/determinant;
   if(!(alpha>0&&beta>0))continue;
   const a=Math.sqrt(4/(3*alpha)),c=1/Math.sqrt(beta);
   if(a<amin||a>amax||c<cmin||c>cmax)continue;
   if(!quickMatches(obs,families,'hexagonal',alpha,beta,lambda,tol))continue;
   const candidate=evaluate(obs,families,'hexagonal','P',lambda,tol,a,c);evaluated++;
   consider(pool,candidate);
  }
 }
 const refined=pool.map(p=>refine(p,obs,
  p.system==='cubic'?cubicFamilies(p.centering,12):hexagonalFamilies(6,10),
  lambda,tol,amin,amax,cmin,cmax));
 refined.sort((a,b)=>b.score-a.score||b.matched.length-a.matched.length||a.rmse-b.rmse);
 const candidates=distinctCandidates(refined.filter(c=>c.matched.length>=Math.max(4,Math.ceil(obs.length*.60))),limit);
 return {system,wavelength:lambda,toleranceDeg:tol,peakCount:obs.length,evaluated,
  candidates,warning:'Candidate hkl indexing only: unknown intensities, phase identity, systematic absences, zero shift and multiphase overlap are not verified.'};
}
