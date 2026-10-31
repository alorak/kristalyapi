/* V18.3 space-group setting transformations (ITA Vol. A, §1.5).
 *
 * A change of setting is a basis matrix P and an origin shift p:
 *   (a', b', c') = (a, b, c) P,   the new origin at p (old fractional),
 *   x' = P⁻¹ (x − p),
 *   W' = P⁻¹ W P,   w' = P⁻¹ (w + (W − I) p).
 * The transformation between two tabulated settings of the same group is
 * found by search (identity / signed axis permutations / obverse
 * hexagonal↔rhombohedral matrices, with origin shifts on a 1/24 grid) and
 * is accepted only when the transformed operations reproduce the target
 * setting exactly: every transformed operation is in the target list
 * (mod lattice translations) and |target| = |source|·det P.
 * Nothing is inferred from the cell metric alone. */

import {symmetryOperations} from './geometry-table.js';

const EPS=1e-6;
const I3=[[1,0,0],[0,1,0],[0,0,1]];
const mul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,v,i)=>s+v*b[i][j],0)));
const mulVec=(m,v)=>m.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
const transpose=m=>m[0].map((_,i)=>m.map(row=>row[i]));
export function det3(m){
 const [a,b,c]=m;return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
}
export function inv3(m){
 const [a,b,c]=m,d=det3(m);
 if(Math.abs(d)<1e-12)throw Error('Ayar dönüşüm matrisi tekil.');
 return [[b[1]*c[2]-b[2]*c[1],a[2]*c[1]-a[1]*c[2],a[1]*b[2]-a[2]*b[1]],
  [b[2]*c[0]-b[0]*c[2],a[0]*c[2]-a[2]*c[0],a[2]*b[0]-a[0]*b[2]],
  [b[0]*c[1]-b[1]*c[0],a[1]*c[0]-a[0]*c[1],a[0]*b[1]-a[1]*b[0]]].map(row=>row.map(v=>v/d));
}
const wrap=v=>{const r=v-Math.floor(v);return r>1-EPS?0:r<EPS?0:r;};
const clean=v=>Math.abs(v-Math.round(v))<1e-9?Math.round(v):v;

/* Operation {R,t} in the new setting. */
export function transformOperation(op,P,p){
 const Pi=inv3(P),R=mul(mul(Pi,op.R),P).map(row=>row.map(clean));
 const shifted=op.t.map((v,i)=>v+op.R[i].reduce((s,x,j)=>s+x*p[j],0)-p[i]);
 return {R,t:mulVec(Pi,shifted).map(wrap)};
}
const opKey=op=>op.R.flat().map(v=>Math.round(v)).join(',')+'|'+op.t.map(v=>Math.round(wrap(v)*24)%24).join(',');
function keySet(ops){
 const keys=new Set();
 for(const op of ops){
  if(op.R.flat().some(v=>Math.abs(v-Math.round(v))>1e-6))return null; // not a lattice operation
  if(op.t.some(v=>Math.abs(v*24-Math.round(v*24))>1e-5))return null;   // translations are k/24 in ITA settings
  keys.add(opKey(op));
 }
 return keys;
}
/* True when (P, p) maps the source operations exactly onto the target ones. */
export function settingTransformValid(source,target,P,p){
 const d=det3(P);
 if(!(d>EPS))return false;
 const expected=source.length*d;
 if(Math.abs(expected-target.length)>1e-6)return false;
 const targetKeys=keySet(target);
 const mapped=keySet(source.map(op=>transformOperation(op,P,p)));
 if(!targetKeys||!mapped||targetKeys.size!==target.length)return false;
 for(const key of mapped)if(!targetKeys.has(key))return false;
 // A larger new cell adds centring translations that no source operation
 // produces, so the source image is a subset of size |target| / det P.
 return Math.abs(mapped.size-target.length/Math.max(1,d))<1e-6;
}

/* Signed permutation matrices with det +1 (identity first), then the
 * obverse hexagonal ↔ rhombohedral pair (ITA Table 5.1.3.1). */
const HEX_TO_RHOMB=[[2/3,-1/3,-1/3],[1/3,1/3,-2/3],[1/3,1/3,1/3]];
const RHOMB_TO_HEX=[[1,0,1],[-1,1,1],[0,-1,1]];
function candidateMatrices(){
 const out=[I3];
 const perms=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];
 for(const perm of perms)for(let s=0;s<8;s++){
  const signs=[s&1?-1:1,s&2?-1:1,s&4?-1:1];
  const P=[0,1,2].map(i=>[0,1,2].map(j=>perm[j]===i?signs[j]:0));
  if(det3(P)>0&&!P.every((row,i)=>row.every((v,j)=>v===I3[i][j])))out.push(P);
 }
 out.push(HEX_TO_RHOMB,RHOMB_TO_HEX);
 return out;
}
function originCandidates(){
 const values=[];for(let k=0;k<24;k++)values.push(k/24);
 const out=[];
 for(const x of values)for(const y of values)for(const z of values)out.push([x,y,z]);
 // Prefer no shift, then the smallest shift (then lexicographic).
 const size=v=>v.reduce((s,x)=>s+Math.min(x,1-x)**2,0);
 return out.sort((a,b)=>size(a)-size(b)||a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
}
let ORIGINS=null;

/* Transformation from one tabulated setting to another, or null. The
 * search keeps the simplest matrix (identity, then axis permutations) and
 * the smallest origin shift. Each setting is given as its (operation,
 * centring) pairs. */
export function findSettingTransform(fromPairs,toPairs){
 const source=symmetryOperations(fromPairs),target=symmetryOperations(toPairs);
 ORIGINS??=originCandidates();
 for(const P of candidateMatrices()){
  const d=det3(P);
  if(Math.abs(source.length*d-target.length)>1e-6)continue;
  // Rotation parts must match before any origin shift is tried.
  const targetRotations=new Set(target.map(op=>op.R.flat().join(',')));
  const Pi=inv3(P);
  if(!source.every(op=>targetRotations.has(mul(mul(Pi,op.R),P).flat().map(v=>Math.round(clean(v)*1e6)/1e6).join(','))))continue;
  for(const p of ORIGINS)if(settingTransformValid(source,target,P,p))return {P:P.map(r=>r.slice()),p:p.slice(),det:d};
 }
 return null;
}

/* Cell parameters from a metric tensor G (Å², degrees). */
function cellFromMetric(G){
 const len=[0,1,2].map(i=>Math.sqrt(G[i][i]));
 const angle=(i,j)=>Math.acos(Math.max(-1,Math.min(1,G[i][j]/(len[i]*len[j]))))*180/Math.PI;
 const r=v=>Number(v.toFixed(8));
 return {a:r(len[0]),b:r(len[1]),c:r(len[2]),alpha:r(angle(1,2)),beta:r(angle(0,2)),gamma:r(angle(0,1))};
}
/* Same convention as the editor: a along x, b in the xy plane (rows a, b, c). */
export function cellBasis(c){
 const rad=Math.PI/180,al=c.alpha*rad,be=c.beta*rad,ga=c.gamma*rad;
 const cx=c.c*Math.cos(be),cy=c.c*(Math.cos(al)-Math.cos(be)*Math.cos(ga))/Math.sin(ga);
 return [[c.a,0,0],[c.b*Math.cos(ga),c.b*Math.sin(ga),0],[cx,cy,Math.sqrt(Math.max(0,c.c*c.c-cx*cx-cy*cy))]];
}
const columns=rows=>transpose(rows);
/* Columns e_i = a_i·|a*_i| (Cartesian), so U_cart = E U E^T for CIF Uij. */
function adpColumns(A){
 const Ai=inv3(A); // rows of Ai are the reciprocal vectors
 return [0,1,2].map(k=>[0,1,2].map(i=>A[k][i]*Math.hypot(...Ai[i])));
}
const uMatrix=u=>[[u[0],u[5],u[4]],[u[5],u[1],u[3]],[u[4],u[3],u[2]]];
const uComponents=m=>[m[0][0],m[1][1],m[2][2],(m[1][2]+m[2][1])/2,(m[0][2]+m[2][0])/2,(m[0][1]+m[1][0])/2];

/* Re-express a structure in a new setting. sites keep labels, elements and
 * occupancies; coordinates, anisotropic Uij and Cartesian magnetic moments
 * are transformed; coordinate s.u.s are permuted for signed permutation
 * matrices and dropped otherwise (noted). */
export function transformStructure(cell,sites,{P,p}){
 const oldRows=cellBasis(cell),A=columns(oldRows);       // columns a, b, c
 const Anew=mul(A,P);                                     // new basis, old Cartesian frame
 const newCell=cellFromMetric(mul(transpose(Anew),Anew));
 const AnewStd=columns(cellBasis(newCell));               // new basis, new standard frame
 const rotation=mul(AnewStd,inv3(Anew));                  // old frame → new frame
 const Pi=inv3(P),notes=[];
 const permutation=P.every(row=>row.filter(v=>v!==0).length===1&&row.every(v=>v===0||Math.abs(v)===1));
 const Eold=adpColumns(A),Enew=adpColumns(Anew),EnewInv=inv3(Enew);
 let droppedSu=0;
 const out=sites.map(site=>{
  const x=[site.x,site.y,site.z].map(Number);
  const moved=mulVec(Pi,x.map((v,i)=>v-p[i])).map(v=>Number(wrap(clean(v*1e9)/1e9).toFixed(10)));
  const next={...site,x:moved[0],y:moved[1],z:moved[2]};
  if(Array.isArray(site.adp)){
   const cart=mul(mul(Eold,uMatrix(site.adp)),transpose(Eold));
   next.adp=uComponents(mul(mul(EnewInv,cart),transpose(EnewInv))).map(v=>Number(v.toPrecision(10)));
  }
  if(Array.isArray(site.magneticMoment))next.magneticMoment=mulVec(rotation,site.magneticMoment).map(v=>Number(v.toPrecision(12)));
  if(site.coordSu){
   if(permutation){
    // x'_i = ±x_k: the s.u. of x'_i is that of x_k.
    const su=['x','y','z'].map((_,i)=>{const k=Pi[i].findIndex(v=>v!==0);return site.coordSu[['x','y','z'][k]];});
    next.coordSu={x:su[0],y:su[1],z:su[2],ref:moved.slice()};
   }else{delete next.coordSu;droppedSu++;}
  }
  return next;
 });
 if(droppedSu)notes.push(droppedSu+' konumun koordinat s.u. değeri bu dönüşümde korunmadı (kovaryans gerekir).');
 return {cell:newCell,sites:out,notes,rotation};
}

/* "a' = …" description of a basis matrix and origin shift, for the UI and provenance. */
export function describeSettingTransform({P,p}){
 const names=['a','b','c'],fmt=v=>{
  const n=Math.round(v*24);const g=(x,y)=>y?g(y,x%y):x,d=g(Math.abs(n),24)||1;
  return n%24===0?String(n/24):(n/d)+'/'+(24/d);
 };
 const vector=j=>{
  const terms=[0,1,2].filter(i=>Math.abs(P[i][j])>1e-9).map(i=>{const v=P[i][j],s=v<0?'−':'+',m=Math.abs(v);
   return s+(Math.abs(m-1)<1e-9?'':fmt(m))+names[i];});
  return terms.join('').replace(/^\+/,'');
 };
 const shift=p.some(v=>Math.abs(v)>1e-9)?' · yeni orijin ('+p.map(fmt).join(', ')+')':'';
 return "a' = "+vector(0)+", b' = "+vector(1)+", c' = "+vector(2)+shift;
}

/* Reduce a P1 atom list to the asymmetric unit of a setting. Every
 * operation must map every atom onto an atom of the same element and
 * occupancy within `tolerance` Å (periodic distance); otherwise the
 * structure does not have that symmetry in that setting and an error names
 * the first mismatch. One representative (the first listed) is kept per
 * orbit. Returns {sites, multiplicities, operations}. */
export function asymmetricUnit(cell,sites,pairs,{tolerance=.01}={}){
 if(!(tolerance>0&&tolerance<=.5))throw Error('Simetri toleransı 0–0,5 Å aralığında olmalı.');
 const ops=symmetryOperations(pairs),rows=cellBasis(cell);
 const cart=d=>[0,1,2].map(k=>d[0]*rows[0][k]+d[1]*rows[1][k]+d[2]*rows[2][k]);
 const frac=sites.map(s=>[s.x,s.y,s.z].map(v=>wrap(Number(v))));
 const kind=s=>String(s.symbol)+'|'+Number(s.occupancy??1).toFixed(3);
 // Bucket atoms on a fractional grid no finer than the tolerance allows.
 const lengths=rows.map(r=>Math.hypot(...r));
 const n=lengths.map(L=>Math.max(1,Math.min(40,Math.floor(L/(4*tolerance)))));
 const cellKey=f=>f.map((v,i)=>Math.floor(wrap(v)*n[i])%n[i]);
 const buckets=new Map();
 frac.forEach((f,i)=>{const k=cellKey(f).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);});
 const find=(f,type)=>{
  const c=cellKey(f);let best=-1,bestD=tolerance;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   const k=[(c[0]+x+n[0])%n[0],(c[1]+y+n[1])%n[1],(c[2]+z+n[2])%n[2]].join(',');
   for(const j of buckets.get(k)||[]){
    if(kind(sites[j])!==type)continue;
    const d=frac[j].map((v,i)=>{const e=f[i]-v;return e-Math.round(e);}),dist=Math.hypot(...cart(d));
    if(dist<=bestD){bestD=dist;best=j;}
   }
  }
  return best;
 };
 const parent=sites.map((_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<sites.length;i++){
  const type=kind(sites[i]);
  for(let k=0;k<ops.length;k++){
   const op=ops[k],image=op.R.map((row,r)=>row.reduce((s,v,c)=>s+v*frac[i][c],0)+op.t[r]);
   const j=find(image,type);
   if(j<0)throw Error((sites[i].label||sites[i].symbol)+' atomunun '+(k+1)+'. simetri işlemi altındaki görüntüsü yapıda yok (tolerans '+tolerance+' Å).');
   const a=root(i),b=root(j);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);
  }
 }
 const groups=new Map();sites.forEach((_,i)=>{const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);});
 const representatives=[...groups.values()].map(members=>members[0]).sort((a,b)=>a-b);
 return {sites:representatives.map(i=>({...sites[i],x:frac[i][0],y:frac[i][1],z:frac[i][2]})),
  multiplicities:representatives.map(i=>groups.get(root(i)).length),operations:ops.length};
}
