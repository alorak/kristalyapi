/* V18.1 CIF2 explicit fractional symmetry group integrity check.
 * A cell metric alone cannot establish the correct IT setting/origin.
 * Validate the given rotation matrices as lattice isometries and ensure
 * the explicit affine operator list is a closed finite group mod Z^3.
 * Do not infer/force origin shifts or transform atom coordinates.
 */
const mod1=n=>((n%1)+1)%1;
const integer=(n,tol=1e-7)=>Number.isFinite(n)&&Math.abs(n-Math.round(n))<=tol;
const eq=(a,b,tol=1e-7)=>Math.abs(a-b)<=tol;
const determinant=R=>R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])-R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])+R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);
const key=(R,t)=>R.flat().join(',')+':'+t.map(v=>Math.round(mod1(v)*1000000)%1000000).join(',');
function gram(cell){
 const length=[cell.a,cell.b,cell.c],ang=[cell.alpha,cell.beta,cell.gamma];
 if([...length,...ang].some(n=>typeof n!=='number'||!Number.isFinite(n))||
    length.some(n=>n<=0)||ang.some(n=>n<=0||n>=180))
  throw Error('CIF2 symmetry requires a nondegenerate finite cell');
 const deg=Math.PI/180;
 const cA=Math.cos(ang[0]*deg),cB=Math.cos(ang[1]*deg),cG=Math.cos(ang[2]*deg);
 const volume=1+2*cA*cB*cG-cA*cA-cB*cB-cG*cG;
 if(volume<=1e-9)throw Error('CIF2 invalid cell metric');
 return [[length[0]**2,length[0]*length[1]*cG,length[0]*length[2]*cB],
         [length[0]*length[1]*cG,length[1]**2,length[1]*length[2]*cA],
         [length[0]*length[2]*cB,length[1]*length[2]*cA,length[2]**2]];
}
export function validateCif2Symmetry(operations,cell,applySymmetry){
 if(!Array.isArray(operations)||!operations.length||operations.length>192||
    typeof applySymmetry!=='function')
  throw Error('CIF2 explicit symmetry requires 1..192 operations');
 const G=gram(cell),elements=[],keys=new Set();
 for(const op of operations){
  if(typeof op!=='string'||op.length>200)throw Error('Invalid CIF2 symmetry operation');
  const t=applySymmetry(op,[0,0,0]);
  const columns=[[1,0,0],[0,1,0],[0,0,1]].map(point=>
    applySymmetry(op,point).map((value,i)=>value-t[i]));
  const R=[0,1,2].map(i=>columns.map(col=>col[i]));
  if([...t,...R.flat()].some(v=>!Number.isFinite(v))||
     R.flat().some(v=>!integer(v)))throw Error('CIF2 symmetry rotation must have integer coefficients');
  const rounded=R.map(row=>row.map(Math.round)),det=determinant(rounded);
  if(Math.abs(det)!==1)throw Error('CIF2 symmetry determinant must be ±1');
  // Check G ≈ R^T G R; normalized against entry scale, not arbitrary
  // fractional scalar distances. CIF experimental lattice may be rounded.
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   let transformed=0;
   for(let a=0;a<3;a++)for(let b=0;b<3;b++)
    transformed+=rounded[a][i]*G[a][b]*rounded[b][j];
   const scale=Math.max(1,Math.abs(G[i][j]),Math.sqrt(G[i][i]*G[j][j]));
   if(Math.abs(transformed-G[i][j])/scale>1e-3)
    throw Error('CIF2 explicit symmetry rotation incompatible with cell metric');
  }
  const sig=key(rounded,t);
  if(keys.has(sig))throw Error('CIF2 duplicate equivalent symmetry operators');
  keys.add(sig);elements.push({R:rounded,t:t.map(mod1),raw:op});
 }
 const I=[[1,0,0],[0,1,0],[0,0,1]];
 if(!keys.has(key(I,[0,0,0])))throw Error('CIF2 explicit symmetry missing identity operation');
 for(const a of elements)for(const b of elements){
  const R=a.R.map(row=>b.R[0].map((_,j)=>row.reduce((v,x,k)=>v+x*b.R[k][j],0)));
  const t=a.R.map((row,i)=>mod1(a.t[i]+row.reduce((v,x,k)=>v+x*b.t[k],0)));
  if(!keys.has(key(R,t)))
   throw Error('CIF2 explicit symmetry list is not closed under composition');
 }
 return {count:elements.length,metricPreserved:true,groupClosed:true,
  originSetting:'EXPLICIT_OPERATORS_ONLY_NOT_RECONCILED_WITH_IT_NUMBER'};
}
