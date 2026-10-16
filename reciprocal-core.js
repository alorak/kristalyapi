/* Kristal Yapı · Reciprocal-space core (dependency-free ES module).
 *
 * Two reciprocal conventions are used on purpose and never mixed silently:
 *  - Crystallographic (diffraction):  a_i · b_j = δ_ij,   |G| = 1/d      [Å⁻¹]
 *  - Solid-state physics (bands/BZ):  a_i · b_j = 2π δ_ij, |G| = 2π/d    [Å⁻¹]
 * Diffraction functions take the conventional (possibly centred) cell so that
 * centring appears as systematic absences; Brillouin-zone functions take the
 * primitive lattice found from pure translations.
 *
 * Kinematic (single-scattering) model only. No dynamical diffraction, double
 * diffraction, absorption or real band-structure (pseudopotential/DFT) physics.
 */

export const HBAR2_2ME_EV_A2=3.80998208; // ħ²/(2mₑ) in eV·Å² (CODATA 2018)
export const BOHR_A=0.529177210903;
/* Mott–Bethe prefactor for s = sinθ/λ in Å⁻¹, giving fₑ in Å:
   fₑ(s) = 2/(a₀(4π)²) · (Z − fₓ(s)) / s²  = 0.023934 · (Z − fₓ)/s². */
export const MOTT_BETHE_A=2/(BOHR_A*16*Math.PI*Math.PI);
const TAU=2*Math.PI;

/* ---------- small vector helpers (plain arrays) ---------- */
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const norm=a=>Math.hypot(a[0],a[1],a[2]);
export const det3=(A)=>dot(A[0],cross(A[1],A[2]));
const combo=(n,B)=>[0,1,2].map(i=>n[0]*B[0][i]+n[1]*B[1][i]+n[2]*B[2][i]);
const wrap=v=>{const w=v-Math.floor(v);return w>1-1e-9?0:w;};

/* Same orientation convention as the editor's basis(): a ∥ x, b in the xy plane. */
export function cellVectors(cell){
 const {a,b,c}=cell,al=cell.alpha*Math.PI/180,be=cell.beta*Math.PI/180,ga=cell.gamma*Math.PI/180;
 if(![a,b,c,al,be,ga].every(Number.isFinite)||a<=0||b<=0||c<=0)throw Error('Geçersiz hücre parametresi.');
 const cx=c*Math.cos(be),cy=c*(Math.cos(al)-Math.cos(be)*Math.cos(ga))/Math.sin(ga);
 const cz2=c*c-cx*cx-cy*cy;
 if(!(cz2>1e-12))throw Error('Hücre açıları geometrik olarak tutarsız.');
 return [[a,0,0],[b*Math.cos(ga),b*Math.sin(ga),0],[cx,cy,Math.sqrt(cz2)]];
}

/* Rows bᵢ with aᵢ·bⱼ = δᵢⱼ (twoPi=false) or 2πδᵢⱼ (twoPi=true). */
export function reciprocalVectors(A,{twoPi=false}={}){
 const V=det3(A);
 if(!Number.isFinite(V)||Math.abs(V)<1e-12)throw Error('Tekil örgü: karşı örgü tanımsız.');
 const f=(twoPi?TAU:1)/V;
 return [scale(cross(A[1],A[2]),f),scale(cross(A[2],A[0]),f),scale(cross(A[0],A[1]),f)];
}
export function gVector(hkl,Bstar){return combo(hkl,Bstar);}
export function dSpacing(hkl,Bstar){
 const g=norm(gVector(hkl,Bstar));
 if(!(g>0))throw Error('000 için d tanımsızdır.');
 return 1/g;
}
const angleDeg=(u,v)=>Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(norm(u)*norm(v)))))*180/Math.PI;
export function reciprocalCellParameters(A){
 const B=reciprocalVectors(A);
 return {a:norm(B[0]),b:norm(B[1]),c:norm(B[2]),
  alpha:angleDeg(B[1],B[2]),beta:angleDeg(B[0],B[2]),gamma:angleDeg(B[0],B[1]),
  volume:Math.abs(det3(B)),realVolume:Math.abs(det3(A))};
}

/* Polygons of the (hkl) plane family h·x+k·y+l·z = t (integer t) inside the
   unit cell [0,1]³ (fractional). Degenerate corner/edge touches are skipped. */
export function planeCellPolygons(hkl,A,maxPlanes=16){
 const [h,k,l]=hkl;
 if(![h,k,l].every(Number.isInteger)||!(h||k||l))throw Error('Geçersiz Miller indisi.');
 const corners=[];for(let i=0;i<8;i++)corners.push([i>>2&1,i>>1&1,i&1]);
 const val=f=>h*f[0]+k*f[1]+l*f[2];
 const vals=corners.map(val),lo=Math.min(...vals),hi=Math.max(...vals);
 const edges=[];
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
  const diff=corners[i].reduce((n,v,d)=>n+(v!==corners[j][d]),0);
  if(diff===1)edges.push([i,j]);
 }
 const polygons=[];
 for(let t=Math.ceil(lo);t<=Math.floor(hi)&&polygons.length<maxPlanes;t++){
  const pts=[];
  const push=p=>{if(!pts.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<1e-9))pts.push(p);};
  for(const [i,j] of edges){
   const fa=vals[i]-t,fb=vals[j]-t;
   if(Math.abs(fa)<1e-12)push(corners[i]);
   if(Math.abs(fb)<1e-12)push(corners[j]);
   if(fa*fb<0){const s=fa/(fa-fb);push(corners[i].map((v,d)=>v+s*(corners[j][d]-v)));}
  }
  if(pts.length<3)continue;
  const cart=pts.map(f=>combo(f,A));
  const center=scale(cart.reduce((s,p)=>add(s,p),[0,0,0]),1/cart.length);
  const n=gVector(hkl,reciprocalVectors(A)),u=sub(cart[0],center);
  if(norm(u)<1e-12)continue;
  const e1=scale(u,1/norm(u)),e2=cross(scale(n,1/norm(n)),e1);
  cart.sort((p,q)=>Math.atan2(dot(sub(p,center),e2),dot(sub(p,center),e1))-
   Math.atan2(dot(sub(q,center),e2),dot(sub(q,center),e1)));
  polygons.push({t,points:cart});
 }
 return polygons;
}

/* All reciprocal points with 0 < |G| ≤ gMax (crystallographic, 1/d units). */
export function reciprocalPoints(A,gMax,{limit=6000}={}){
 if(!(gMax>0))throw Error('Geçersiz karşı uzay yarıçapı.');
 const Bs=reciprocalVectors(A),bounds=A.map(a=>Math.floor(norm(a)*gMax+1e-9));
 const count=bounds.reduce((n,b)=>n*(2*b+1),1);
 if(count>limit*8)throw Error('Bu yarıçapta çok fazla karşı örgü noktası var; d_min değerini büyütün.');
 const out=[];
 for(let h=-bounds[0];h<=bounds[0];h++)for(let k=-bounds[1];k<=bounds[1];k++)for(let l=-bounds[2];l<=bounds[2];l++){
  if(!(h||k||l))continue;
  const G=gVector([h,k,l],Bs),g=norm(G);
  if(g<=gMax+1e-12)out.push({h,k,l,G,g});
 }
 if(out.length>limit)throw Error('Karşı örgü noktası sınırı ('+limit+') aşıldı; d_min değerini büyütün.');
 return out.sort((p,q)=>p.g-q.g||p.h-q.h||p.k-q.k||p.l-q.l);
}

/* ---------- Ewald construction and electron diffraction ---------- */

/* Relativistic electron wavelength in Å for accelerating voltage in kV. */
export function electronWavelength(kV){
 if(!(kV>0&&kV<=3000))throw Error('Hızlandırma gerilimi 0–3000 kV olmalı.');
 const h=6.62607015e-34,m=9.1093837015e-31,e=1.602176634e-19,c=299792458,V=kV*1e3;
 return h/Math.sqrt(2*m*e*V*(1+e*V/(2*m*c*c)))*1e10;
}
export function relativisticGamma(kV){return 1+kV*1e3/510998.95;}
/* Electron scattering amplitude (Å) from the X-ray factor via Mott–Bethe. */
export function mottBethe(Z,fx,s,gamma=1){
 if(!(s>1e-6))throw Error('Mott–Bethe s → 0 sınırında tanımsızdır.');
 return gamma*MOTT_BETHE_A*(Z-fx)/(s*s);
}
export function excitationError(k,G){
 const kk=norm(k);return (kk*kk-dot(add(k,G),add(k,G)))/(2*kk);
}
/* Kinematic thin-crystal shape factor sinc²(π t s); t in Å, s in Å⁻¹. */
export function shapeFactor(s,tA){
 const x=Math.PI*tA*s;return Math.abs(x)<1e-9?1:(Math.sin(x)/x)**2;
}
export function zoneAxisDirection(uvw,A){
 const r=combo(uvw,A),n=norm(r);
 if(!uvw.every(Number.isInteger)||!(n>0))throw Error('Geçersiz bölge ekseni [uvw].');
 return scale(r,1/n);
}
/* Zero-order Laue zone of zone axis [uvw]: hu+kv+lw = 0, with an in-plane
   orthonormal frame (e1 along the shortest zone vector, e2 = n × e1). */
export function zoneAxisReflections(A,uvw,gMax,{limit=4000}={}){
 const [u,v,w]=uvw,n=zoneAxisDirection(uvw,A);
 const pts=reciprocalPoints(A,gMax,{limit:limit*6}).filter(p=>p.h*u+p.k*v+p.l*w===0);
 if(!pts.length)throw Error('Bu yarıçapta bölge ekseni düzleminde yansıma yok.');
 if(pts.length>limit)throw Error('Bölge deseninde çok fazla yansıma var; yarıçapı küçültün.');
 const e1=scale(pts[0].G,1/pts[0].g),e2=cross(n,e1);
 return {normal:n,e1,e2,points:pts.map(p=>({...p,x:dot(p.G,e1),y:dot(p.G,e2)}))};
}
/* 2D Ewald section in a plane containing the beam. Lattice points are given
   in plane coordinates (x,y); beam direction angle ω (deg) in that plane. */
export function ewaldSection(points,lambda,omegaDeg,tol=.004){
 if(!(lambda>0))throw Error('Geçersiz dalgaboyu.');
 const R=1/lambda,w=omegaDeg*Math.PI/180,kin=[R*Math.cos(w),R*Math.sin(w)],C=[-kin[0],-kin[1]];
 const out=points.map(p=>{
  const dist=Math.hypot(p.x-C[0],p.y-C[1]),g=Math.hypot(p.x,p.y);
  const arg=lambda*g/2;
  return {...p,distance:dist,deviation:dist-R,onSphere:Math.abs(dist-R)<=tol,
   twoTheta:arg<=1?2*Math.asin(arg)*180/Math.PI:NaN};
 });
 return {radius:R,center:C,kin,points:out,limitingRadius:2*R};
}
/* Crystal rotations ω (deg, [0,360)) that bring each in-plane point exactly
   onto the Ewald circle. |k₀+G| = |k₀| ⇔ k₀·G = −g²/2 ⇔ cos∠(k₀,G) = −λg/2.
   The drawing uses beam angle = −ω, hence ω = −(φ_G ± arccos(−λg/2)). */
export function braggRotations(points,lambda){
 const out=[];
 for(const p of points){
  const g=Math.hypot(p.x,p.y),c=-lambda*g/2;
  if(!(g>0)||c<-1)continue;
  const phi=Math.atan2(p.y,p.x)*180/Math.PI,delta=Math.acos(c)*180/Math.PI;
  for(const beam of [phi+delta,phi-delta]){
   const omega=((-beam)%360+360)%360;
   out.push({omega,h:p.h,k:p.k,l:p.l});
  }
 }
 return out.sort((a,b)=>a.omega-b.omega);
}
export function nextBraggRotation(points,lambda,current){
 const all=braggRotations(points,lambda);if(!all.length)return null;
 return all.find(r=>r.omega>current+1e-3)||all[0];
}
/* Powder: a shell |G| = g meets the Ewald circle (centre C, radius R through
   the origin) in two points; their scattering angle is 2θ = 2 asin(λg/2). */
export function powderShellIntersections(lambda,omegaDeg,g){
 const R=1/lambda;if(!(g>0)||g>2*R)return [];
 const w=omegaDeg*Math.PI/180,C=[-R*Math.cos(w),-R*Math.sin(w)];
 const a=g*g/(2*R);                 // distance from origin along OC to the chord
 const h=Math.sqrt(Math.max(0,g*g-a*a));
 const ux=C[0]/R,uy=C[1]/R,px=a*ux,py=a*uy;
 return [[px-h*uy,py+h*ux],[px+h*uy,py-h*ux]];
}
/* Kinematic structure factor with a caller-supplied scattering amplitude
   function amp(site, s) that already includes occupancy and Debye–Waller. */
export function kinematicF(sites,hkl,Bstar,amp){
 const g=norm(gVector(hkl,Bstar)),s=g/2;let re=0,im=0;
 for(const site of sites){
  const a=amp(site,s),ph=TAU*(hkl[0]*site.x+hkl[1]*site.y+hkl[2]*site.z);
  re+=a*Math.cos(ph);im+=a*Math.sin(ph);
 }
 return {real:re,imag:im,intensity:re*re+im*im,s};
}

/* ---------- pure translations, primitive lattice, Bravais type ---------- */

const speciesKey=s=>String(s.symbol)+'|'+Math.round(Number(s.occupancy??1)*1e4);
/* Fractional translations t ≠ 0 mapping the whole structure onto itself. */
export function pureTranslations(sites,{tol=2e-3}={}){
 if(!Array.isArray(sites)||!sites.length)throw Error('Öteleme araması için atom gerekli.');
 const f=sites.map(s=>({key:speciesKey(s),p:[wrap(+s.x),wrap(+s.y),wrap(+s.z)]}));
 const groups=new Map();for(const a of f){if(!groups.has(a.key))groups.set(a.key,[]);groups.get(a.key).push(a.p);}
 let ref=null;for(const g of groups.values())if(!ref||g.length<ref.length)ref=g;
 const cell=.05,n=Math.ceil(1/cell),bucket=new Map();
 const bkey=(key,i,j,k)=>key+'#'+((i%n+n)%n)+','+((j%n+n)%n)+','+((k%n+n)%n);
 for(const a of f){const b=a.p.map(v=>Math.floor(v/cell));const kk=bkey(a.key,...b);
  if(!bucket.has(kk))bucket.set(kk,[]);bucket.get(kk).push(a.p);}
 const near=(p,q)=>p.every((v,i)=>{const d=Math.abs(v-q[i]);return Math.min(d,1-d)<tol;});
 const has=(key,p)=>{const b=p.map(v=>Math.floor(v/cell));
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++)for(let dk=-1;dk<=1;dk++){
   const list=bucket.get(bkey(key,b[0]+di,b[1]+dj,b[2]+dk));
   if(list&&list.some(q=>near(p,q)))return true;}
  return false;};
 const out=[];
 for(const p of ref){
  const t=p.map((v,i)=>wrap(v-ref[0][i]));
  if(t.every(v=>Math.min(v,1-v)<tol))continue;
  if(out.some(q=>near(q,t)))continue;
  if(f.every(a=>has(a.key,a.p.map((v,i)=>wrap(v+t[i])))))out.push(t.map(v=>Math.min(v,1-v)<tol?0:v));
 }
 return out;
}
/* Shortest primitive basis of the lattice generated by A and translations. */
export function primitiveLattice(A,translations=[]){
 const V=Math.abs(det3(A)),Vp=V/(1+translations.length),cand=[];
 const shifts=[[0,0,0],...translations];
 for(const t of shifts)for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){
  const v=combo([i+t[0],j+t[1],k+t[2]],A);if(norm(v)>1e-9)cand.push(v);
 }
 cand.sort((p,q)=>norm(p)-norm(q));
 const pool=cand.slice(0,Math.min(60,cand.length));
 let best=null;
 for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
  if(norm(cross(pool[i],pool[j]))<1e-6*norm(pool[i])*norm(pool[j]))continue;
  for(let k=j+1;k<pool.length;k++){
   const d=det3([pool[i],pool[j],pool[k]]);
   if(Math.abs(Math.abs(d)-Vp)>1e-6*Vp)continue;
   const len=norm(pool[i])+norm(pool[j])+norm(pool[k]);
   if(!best||len<best.len-1e-9)best={len,vectors:[pool[i],pool[j],d<0?scale(pool[k],-1):pool[k]]};
  }
 }
 if(!best)throw Error('Primitive örgü bazı bulunamadı.');
 return {vectors:best.vectors,volume:Vp,latticePoints:1+translations.length};
}
const close=(x,y,rel=2e-3)=>Math.abs(x-y)<=rel*Math.max(Math.abs(x),Math.abs(y),1);
const setMatch=(T,ref,tol=3e-3)=>T.length===ref.length&&ref.every(r=>T.some(t=>t.every((v,i)=>{
 const d=Math.abs(v-r[i]);return Math.min(d,1-d)<tol;})));
/* Bravais type for k-path labelling, from a CONVENTIONAL cell and its pure
   translations. Returns null when the cell is not a recognised standard one. */
export function bravaisType(cell,translations){
 const {a,b,c,alpha,beta,gamma}=cell,r=x=>close(x,90,1e-3),T=translations;
 const I=[[.5,.5,.5]],F=[[0,.5,.5],[.5,0,.5],[.5,.5,0]],R=[[2/3,1/3,1/3],[1/3,2/3,2/3]];
 if(r(alpha)&&r(beta)&&r(gamma)){
  if(close(a,b)&&close(b,c)){
   if(!T.length)return 'CUB';if(setMatch(T,I))return 'BCC';if(setMatch(T,F))return 'FCC';return null;
  }
  if(close(a,b)&&!close(a,c)){if(!T.length)return 'TET';if(setMatch(T,I))return 'BCT';return null;}
  if(!close(a,b)&&!close(b,c)&&!close(a,c)&&!T.length)return 'ORC';
  return null;
 }
 if(close(a,b)&&r(alpha)&&r(beta)&&close(gamma,120,1e-3)){
  if(!T.length)return 'HEX';if(setMatch(T,R))return 'RHL';return null;
 }
 return null;
}

/* High-symmetry points in FRACTIONAL coordinates of the conventional
   reciprocal basis (bᵢ·aⱼ = 2πδᵢⱼ), following Setyawan & Curtarolo,
   Comput. Mater. Sci. 49, 299 (2010). Labels follow the user's a, b, c axes. */
export const KPATHS={
 CUB:{points:{'Γ':[0,0,0],X:[0,.5,0],M:[.5,.5,0],R:[.5,.5,.5]},
  path:[['Γ','X','M','Γ','R','X'],['M','R']]},
 FCC:{points:{'Γ':[0,0,0],X:[0,1,0],W:[.5,1,0],K:[.75,.75,0],L:[.5,.5,.5],U:[.25,1,.25]},
  path:[['Γ','X','W','K','Γ','L','U','W','L','K'],['U','X']]},
 BCC:{points:{'Γ':[0,0,0],H:[0,0,1],N:[.5,.5,0],P:[.5,.5,.5]},
  path:[['Γ','H','N','Γ','P','H'],['P','N']]},
 TET:{points:{'Γ':[0,0,0],X:[0,.5,0],M:[.5,.5,0],Z:[0,0,.5],R:[0,.5,.5],A:[.5,.5,.5]},
  path:[['Γ','X','M','Γ','Z','R','A','Z'],['X','R'],['M','A']]},
 ORC:{points:{'Γ':[0,0,0],X:[.5,0,0],Y:[0,.5,0],Z:[0,0,.5],S:[.5,.5,0],U:[.5,0,.5],T:[0,.5,.5],R:[.5,.5,.5]},
  path:[['Γ','X','S','Y','Γ','Z','U','R','T','Z'],['Y','T'],['U','X'],['S','R']]},
 HEX:{points:{'Γ':[0,0,0],M:[.5,0,0],K:[1/3,1/3,0],A:[0,0,.5],L:[.5,0,.5],H:[1/3,1/3,.5]},
  path:[['Γ','M','K','Γ','A','L','H','A'],['L','M'],['K','H']]}
};
export function kPath(type,Aconv){
 const def=KPATHS[type];if(!def)return null;
 const B=reciprocalVectors(Aconv,{twoPi:true}),points={};
 for(const [label,f] of Object.entries(def.points))points[label]=combo(f,B);
 return {type,points,fractional:def.points,path:def.path};
}
/* Sample a k-path; segments separated by '|' are joined without a gap. */
export function sampleKPath(path,{density=60,maxSamples=1200}={}){
 const legs=[];
 for(const seg of path.path)for(let i=0;i<seg.length-1;i++)legs.push([seg[i],seg[i+1]]);
 const total=legs.reduce((s,[p,q])=>s+norm(sub(path.points[q],path.points[p])),0);
 const step=Math.max(total/maxSamples,1/density);
 const samples=[],ticks=[];let x=0;
 path.path.forEach((seg,si)=>{
  for(let i=0;i<seg.length-1;i++){
   const P=path.points[seg[i]],Q=path.points[seg[i+1]],L=norm(sub(Q,P)),n=Math.max(2,Math.ceil(L/step));
   if(i===0){const label=si>0?ticks.pop().label+'|'+seg[0]:seg[0];ticks.push({x,label});}
   for(let j=(i===0?0:1);j<=n;j++)samples.push({k:add(P,scale(sub(Q,P),j/n)),x:x+L*j/n,segment:si});
   x+=L;ticks.push({x,label:seg[i+1]});
  }
 });
 return {samples,ticks,length:x};
}
/* Free-electron ("empty lattice") bands E = ħ²|k+G|²/(2m*), folded into the BZ. */
export function emptyLatticeBands(samples,Bprim,{nBands=8,mass=1,range=3}={}){
 if(!(mass>0))throw Error('Etkin kütle pozitif olmalı.');
 const Gs=[];for(let i=-range;i<=range;i++)for(let j=-range;j<=range;j++)for(let k=-range;k<=range;k++)Gs.push(combo([i,j,k],Bprim));
 const c=HBAR2_2ME_EV_A2/mass;
 return samples.map(({k})=>{
  const e=Gs.map(G=>{const q=add(k,G);return c*dot(q,q);});
  e.sort((p,q)=>p-q);return e.slice(0,nBands);
 });
}

/* Wigner–Seitz cell of the lattice with basis rows B (here the 2π reciprocal
   primitive basis → first Brillouin zone). */
export function wignerSeitzCell(B){
 const build=planes=>{
  const verts=[];
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
   const M=[planes[i].G,planes[j].G,planes[k].G],D=det3(M);
   if(Math.abs(D)<1e-10)continue;
   const r=[planes[i].h,planes[j].h,planes[k].h];
   const x=[det3([[r[0],M[0][1],M[0][2]],[r[1],M[1][1],M[1][2]],[r[2],M[2][1],M[2][2]]]),
    det3([[M[0][0],r[0],M[0][2]],[M[1][0],r[1],M[1][2]],[M[2][0],r[2],M[2][2]]]),
    det3([[M[0][0],M[0][1],r[0]],[M[1][0],M[1][1],r[1]],[M[2][0],M[2][1],r[2]]])].map(v=>v/D);
   const scaleTol=1e-7*Math.max(1,norm(x));
   if(planes.every(p=>dot(p.G,x)<=p.h+scaleTol*norm(p.G))&&!verts.some(v=>norm(sub(v,x))<1e-6*Math.max(1,norm(x))))verts.push(x);
  }
  return verts;
 };
 const all=[];for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)for(let k=-3;k<=3;k++){
  if(!(i||j||k))continue;const G=combo([i,j,k],B);all.push({G,h:dot(G,G)/2,n:[i,j,k]});}
 all.sort((p,q)=>p.h-q.h);
 let planes=all.filter(p=>p.n.every(v=>Math.abs(v)<=1));
 let verts=build(planes);
 for(let pass=0;pass<3;pass++){ // add every plane that can still cut the cell
  const R=Math.max(...verts.map(norm));
  const needed=all.filter(p=>norm(p.G)/2<R*(1+1e-9));
  if(needed.length===planes.length)break;
  planes=needed;verts=build(planes);
 }
 const faces=[];
 for(const p of planes){
  const on=verts.filter(v=>Math.abs(dot(p.G,v)-p.h)<=1e-6*Math.max(1,p.h));
  if(on.length<3)continue;
  const c=scale(on.reduce((s,v)=>add(s,v),[0,0,0]),1/on.length),nrm=scale(p.G,1/norm(p.G));
  const e1=scale(sub(on[0],c),1/norm(sub(on[0],c))),e2=cross(nrm,e1);
  on.sort((u,v)=>Math.atan2(dot(sub(u,c),e2),dot(sub(u,c),e1))-Math.atan2(dot(sub(v,c),e2),dot(sub(v,c),e1)));
  let area=0;for(let i=0;i<on.length;i++)area+=dot(cross(sub(on[i],c),sub(on[(i+1)%on.length],c)),nrm)/2;
  faces.push({G:p.G,n:p.n,vertices:on,area:Math.abs(area)});
 }
 const volume=faces.reduce((s,f)=>s+f.area*norm(f.G)/2/3,0);
 return {vertices:verts,faces,volume};
}
/* Is k on (≈0), inside (<0) or outside (>0) the cell? Returns max violation. */
export function wignerSeitzMargin(cell,k){
 return Math.max(...cell.faces.map(f=>(dot(f.G,k)-dot(f.G,f.G)/2)/norm(f.G)));
}

/* One-call analysis for the Brillouin-zone section. */
export function brillouinAnalysis(cell,sites){
 const A=cellVectors(cell),T=pureTranslations(sites),prim=primitiveLattice(A,T);
 const Bp=reciprocalVectors(prim.vectors,{twoPi:true}),zone=wignerSeitzCell(Bp);
 const type=bravaisType(cell,T),path=type?kPath(type,A):null;
 return {A,translations:T,primitive:prim,reciprocalPrimitive:Bp,zone,type,path,
  zoneVolumeExpected:Math.abs(det3(Bp))};
}
