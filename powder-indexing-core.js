/* Powder XRD peak assignment and lattice-parameter refinement (P0).
 * Angles are 2theta in degrees, lengths in angstrom. This fits assigned (hkl);
 * it does NOT determine unknown Miller indices, phase purity or extinctions.
 * All reflections have equal weight; 2theta zero-shift is not fitted. */
export const TITANIUM_PEAKS = Object.freeze([
 {twoTheta:35.10,h:1,k:0,l:0},
 {twoTheta:38.39,h:0,k:0,l:2},
 {twoTheta:40.17,h:1,k:0,l:1},
 {twoTheta:53.00,h:1,k:0,l:2},
 {twoTheta:62.94,h:1,k:1,l:0},
 {twoTheta:70.65,h:1,k:0,l:3},
 {twoTheta:74.17,h:2,k:0,l:0}
].map(row=>Object.freeze(row)));
export const TITANIUM_WAVELENGTH = 1.540562;
const DEGREES = 180/Math.PI;
const radians = degrees => degrees/DEGREES;
const toFinite = value => {
 if(typeof value==='string' && !value.trim())return NaN;
 const number=Number(typeof value==='string'?value.trim().replace(',', '.'):value);
 return Number.isFinite(number)?number:NaN;
};
export function observedPeak(peak,wavelength){
 const lambda=toFinite(wavelength),twoTheta=toFinite(peak?.twoTheta);
 if(!(lambda>0&&lambda<=10))throw new RangeError('Wavelength must be > 0 and <= 10 Å.');
 if(!(twoTheta>0&&twoTheta<180))throw new RangeError('2theta must be between 0 and 180 degrees.');
 const hkl=['h','k','l'].map(key=>toFinite(peak?.[key]));
 if(!hkl.every(n=>Number.isInteger(n)&&Math.abs(n)<=30)||hkl.every(n=>n===0))
  throw new RangeError('h, k, l must be integers within [-30,30], excluding (000).');
 const [h,k,l]=hkl,theta=radians(twoTheta/2),sinTheta=Math.sin(theta);
 const sinSquared=sinTheta*sinTheta;
 return {twoTheta,h,k,l,thetaDeg:twoTheta/2,
  dObserved:lambda/(2*sinTheta),sinSquared,qObserved:4*sinSquared/(lambda*lambda),
  cubicIndex:h*h+k*k+l*l,hexIndex:h*h+h*k+k*k,axialIndex:l*l};
}
export function fitPowderPeaks({peaks,wavelength=TITANIUM_WAVELENGTH,system='hexagonal'}){
 if(!['hexagonal','cubic'].includes(system))throw new RangeError('Only cubic and hexagonal fits are supported.');
 if(!Array.isArray(peaks)||peaks.length>(500))throw new RangeError('Peak count must be at most 500.');
 const lambda=toFinite(wavelength);
 if(!(lambda>0&&lambda<=10))throw new RangeError('Wavelength must be > 0 and <= 10 Å.');
 const minCount=system==='hexagonal'?3:2;
 if(peaks.length<minCount)throw new RangeError('At least '+minCount+' assigned peaks are required.');
 const rows=peaks.map((p,i)=>{
  try{return observedPeak(p,lambda);}
  catch(error){throw new RangeError('Peak '+(i+1)+': '+error.message);}
 });
 let alpha,beta=null,a,c;
 if(system==='cubic'){
  const xx=rows.reduce((s,p)=>s+p.cubicIndex**2,0);
  alpha=rows.reduce((s,p)=>s+p.cubicIndex*p.qObserved,0)/xx;
  if(!(alpha>0))throw new RangeError('A positive cubic lattice parameter cannot be fitted.');
  a=1/Math.sqrt(alpha);c=a;
 }else{
  // 1/d^2 = alpha (h^2+hk+k^2) + beta l^2,
  // alpha = 4/(3a^2), beta = 1/c^2.
  const xx=rows.reduce((s,p)=>s+p.hexIndex**2,0);
  const zz=rows.reduce((s,p)=>s+p.axialIndex**2,0);
  const xz=rows.reduce((s,p)=>s+p.hexIndex*p.axialIndex,0);
  const xy=rows.reduce((s,p)=>s+p.hexIndex*p.qObserved,0);
  const zy=rows.reduce((s,p)=>s+p.axialIndex*p.qObserved,0);
  const determinant=xx*zz-xz*xz;
  if(!(xx>0&&zz>0&&determinant>1e-10*xx*zz))
   throw new RangeError('Hexagonal reflections do not independently constrain a and c.');
  alpha=(xy*zz-zy*xz)/determinant;
  beta=(zy*xx-xy*xz)/determinant;
  if(!(alpha>0&&beta>0))throw new RangeError('Non-positive reciprocal lattice coefficients.');
  a=Math.sqrt(4/(3*alpha));c=1/Math.sqrt(beta);
 }
 const fitted=rows.map(row=>{
  const qCalculated=system==='cubic'?alpha*row.cubicIndex:
   alpha*row.hexIndex+beta*row.axialIndex;
  const sinSquaredCalculated=lambda*lambda*qCalculated/4;
  const accessible=sinSquaredCalculated>0&&sinSquaredCalculated<=1;
  const twoThetaCalculated=accessible?2*Math.asin(Math.sqrt(sinSquaredCalculated))*DEGREES:null;
  return {...row,qCalculated,sinSquaredCalculated,
   dCalculated:qCalculated>0?1/Math.sqrt(qCalculated):null,twoThetaCalculated,
   deltaTwoTheta:twoThetaCalculated===null?null:row.twoTheta-twoThetaCalculated,
   deltaSinSquared:row.sinSquared-sinSquaredCalculated};
 });
 const rmseSinSquared=Math.sqrt(fitted.reduce((s,p)=>s+p.deltaSinSquared**2,0)/fitted.length);
 const predicted=fitted.filter(p=>p.deltaTwoTheta!==null);
 const rmseTwoTheta=predicted.length===fitted.length?
  Math.sqrt(predicted.reduce((s,p)=>s+p.deltaTwoTheta**2,0)/predicted.length):null;
 return {system,wavelength:lambda,n:fitted.length,a,b:system==='cubic'?a:a,c,cOverA:c/a,
  alpha,beta,rmseSinSquared,rmseTwoTheta,rows:fitted,
  degreesOfFreedom:fitted.length-(system==='cubic'?1:2)};
}
function parseCells(line,delimiter){
 // Preserve quoted commas/semicolons, including doubled quotes.
 const cells=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){
   if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
  }else if(ch===delimiter&&!quoted){cells.push(value.trim());value='';}
  else value+=ch;
 }
 if(quoted)throw new RangeError('Unterminated quoted CSV field.');
 cells.push(value.trim());return cells;
}
export function parsePeakCsv(content){
 if(typeof content!=='string'||content.length>120000)throw new RangeError('CSV text is missing or too large.');
 const lines=content.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 if(!lines.length)throw new RangeError('CSV is empty.');
 const delimiter=lines[0].includes(';')?';':',';
 const headers=parseCells(lines[0],delimiter).map(x=>x.toLowerCase().replace(/[\s_°()]/g,''));
 const headerPresent=Number.isNaN(toFinite(headers[0]));
 const angleColumn=headerPresent?headers.findIndex(x=>['2theta','2θ','twotheta','angle','2thetadeg'].includes(x)) :0;
 const hColumn=headerPresent?headers.indexOf('h'):1;
 const kColumn=headerPresent?headers.indexOf('k'):2;
 const lColumn=headerPresent?headers.indexOf('l'):3;
 if([angleColumn,hColumn,kColumn,lColumn].some(x=>x<0))throw new RangeError('CSV needs 2theta,h,k,l columns.');
 const dataLines=lines.slice(headerPresent?1:0);
 if(!dataLines.length||dataLines.length>500)throw new RangeError('CSV must contain 1 to 500 peak rows.');
 return dataLines.map((line,i)=>{
  const cells=parseCells(line,delimiter);
  if(Math.max(angleColumn,hColumn,kColumn,lColumn)>=cells.length)
   throw new RangeError('CSV row '+(i+1)+' has missing columns.');
  const p={twoTheta:toFinite(cells[angleColumn]),h:toFinite(cells[hColumn]),k:toFinite(cells[kColumn]),l:toFinite(cells[lColumn])};
  if(!Object.values(p).every(Number.isFinite))throw new RangeError('CSV row '+(i+1)+' has invalid numbers.');
  return p;
 });
}
export function peakCsv(peaks,fit=null,wavelength=fit?.wavelength??TITANIUM_WAVELENGTH){
 const header=['2theta_deg','h','k','l','theta_deg','d_observed_A','sin2theta','twoTheta_calculated_deg','delta_twoTheta_deg'];
 const lines=peaks.map((p,i)=>{
  const o=observedPeak(p,wavelength);
  const f=fit?.rows[i];
  return [o.twoTheta,o.h,o.k,o.l,o.thetaDeg,o.dObserved,o.sinSquared,
   f?.twoThetaCalculated??'',f?.deltaTwoTheta??''].map(v=>typeof v==='number'?Number(v.toFixed(9)):v).join(',');
 });
 return [header.join(','),...lines].join('\n')+'\n';
}
