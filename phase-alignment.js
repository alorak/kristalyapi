/* V21: atom-to-atom alignment of two periodic phases.
 *
 * The two structures must describe the same crystal setting: same
 * composition per cell, the same cell axes (lattice parameters within a
 * tolerance) and fully occupied sites. The overlay is moved by a fractional
 * origin shift t (and optionally inverted, x → −x) so that every overlay atom
 * is paired with a primary atom of the same element; pairs come from the
 * optimal assignment (Hungarian algorithm) of periodic distances and t is
 * refined by least squares (mean displacement). Distances use the primary
 * cell metric. Nothing is matched across different elements and nothing is
 * forced: incompatible inputs are refused with the reason. */

const wrapHalf=v=>v-Math.round(v);

export const ALIGNMENT_LIMITS=Object.freeze({atoms:400,lengthRatio:.1,angleDegrees:5});

function rowsOf(cell){
 const rad=Math.PI/180,al=cell.alpha*rad,be=cell.beta*rad,ga=cell.gamma*rad;
 const cx=cell.c*Math.cos(be),cy=cell.c*(Math.cos(al)-Math.cos(be)*Math.cos(ga))/Math.sin(ga);
 return [[cell.a,0,0],[cell.b*Math.cos(ga),cell.b*Math.sin(ga),0],[cx,cy,Math.sqrt(Math.max(0,cell.c*cell.c-cx*cx-cy*cy))]];
}
const cartesian=(rows,d)=>[0,1,2].map(k=>d[0]*rows[0][k]+d[1]*rows[1][k]+d[2]*rows[2][k]);
const volumeOf=rows=>Math.abs(rows[0][0]*(rows[1][1]*rows[2][2]-rows[1][2]*rows[2][1])-rows[0][1]*(rows[1][0]*rows[2][2]-rows[1][2]*rows[2][0])+rows[0][2]*(rows[1][0]*rows[2][1]-rows[1][1]*rows[2][0]));

/* Minimum-cost perfect matching on a square cost matrix (Kuhn–Munkres,
 * O(n³)). Returns assignment[row] = column. */
export function hungarian(cost){
 const n=cost.length;
 if(!n)return [];
 if(cost.some(row=>row.length!==n))throw Error('Eşleme maliyet matrisi kare olmalı.');
 const INF=Infinity,u=new Float64Array(n+1),v=new Float64Array(n+1),p=new Int32Array(n+1),way=new Int32Array(n+1);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const minv=new Float64Array(n+1).fill(INF),used=new Uint8Array(n+1);
  do{
   used[j0]=1;const i0=p[j0];let delta=INF,j1=0;
   for(let j=1;j<=n;j++)if(!used[j]){
    const cur=cost[i0-1][j-1]-u[i0]-v[j];
    if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
    if(minv[j]<delta){delta=minv[j];j1=j;}
   }
   for(let j=0;j<=n;j++){if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;}
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
 }
 const assignment=new Array(n);
 for(let j=1;j<=n;j++)assignment[p[j]-1]=j-1;
 return assignment;
}

/* Reasons two phases cannot be aligned atom by atom, or [] when they can. */
export function alignmentRefusals(primary,overlay,limits=ALIGNMENT_LIMITS){
 const reasons=[];
 for(const [name,s] of [['Ana yapı',primary],['Ek faz',overlay]]){
  if(!s.sites.length||s.sites.length>limits.atoms)reasons.push(name+' 1–'+limits.atoms+' atom içermeli.');
  if(s.sites.some(site=>Math.abs(Number(site.occupancy??1)-1)>1e-3))reasons.push(name+' kısmi dolu konum içeriyor; atom eşlemesi düzensiz yapılarda yapılmaz.');
 }
 const count=sites=>{const m=new Map();for(const s of sites)m.set(s.symbol,(m.get(s.symbol)||0)+1);return m;};
 const a=count(primary.sites),b=count(overlay.sites);
 const keys=new Set([...a.keys(),...b.keys()]);
 const differ=[...keys].filter(k=>(a.get(k)||0)!==(b.get(k)||0));
 if(differ.length)reasons.push('Hücre başına bileşim farklı: '+differ.map(k=>k+' '+(a.get(k)||0)+'/'+(b.get(k)||0)).join(', ')+'. Önce aynı ayara/süperhücreye dönüştürün.');
 for(const k of ['a','b','c'])if(Math.abs(overlay.cell[k]/primary.cell[k]-1)>limits.lengthRatio)
  reasons.push(k+' ekseni %'+Math.round(100*limits.lengthRatio)+' sınırından fazla farklı ('+primary.cell[k]+' / '+overlay.cell[k]+' Å); eksenler aynı ayarda olmayabilir.');
 for(const k of ['alpha','beta','gamma'])if(Math.abs(overlay.cell[k]-primary.cell[k])>limits.angleDegrees)
  reasons.push(k+' açısı '+limits.angleDegrees+'° sınırından fazla farklı.');
 return reasons;
}

/* Pair every overlay atom with a primary atom for a given shift; returns
 * pairs, displacements (Å, primary metric) and the least-squares shift. */
function matchForShift(primary,overlay,rows,shift,sign){
 const pairs=[];
 const bySymbol=new Map();
 primary.sites.forEach((s,i)=>{if(!bySymbol.has(s.symbol))bySymbol.set(s.symbol,{p:[],o:[]});bySymbol.get(s.symbol).p.push(i);});
 overlay.sites.forEach((s,i)=>bySymbol.get(s.symbol).o.push(i));
 const moved=i=>{const s=overlay.sites[i];return [sign*s.x+shift[0],sign*s.y+shift[1],sign*s.z+shift[2]];};
 for(const {p,o} of bySymbol.values()){
  const diff=(i,j)=>{const x=moved(j),s=primary.sites[i];return [x[0]-s.x,x[1]-s.y,x[2]-s.z].map(wrapHalf);};
  const cost=p.map(i=>o.map(j=>{const c=cartesian(rows,diff(i,j));return c[0]*c[0]+c[1]*c[1]+c[2]*c[2];}));
  const assignment=hungarian(cost);
  p.forEach((i,r)=>{const j=o[assignment[r]];pairs.push({primary:i,overlay:j,frac:diff(i,j)});});
 }
 const mean=[0,1,2].map(k=>pairs.reduce((s,q)=>s+q.frac[k],0)/pairs.length);
 return {pairs,mean};
}
function score(pairs,rows){
 const d=pairs.map(q=>Math.hypot(...cartesian(rows,q.frac)));
 return {rmsd:Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length),max:Math.max(...d),distances:d};
}

/* Align overlay onto primary. Options: allowInversion tries x → −x as well
 * (the enantiomorph / opposite polarity choice). Returns the shift t (the
 * overlay atom at x appears at sign·x + t in primary fractional
 * coordinates), pairs with displacements, RMSD and cell differences. */
export function alignPhases(primary,overlay,{allowInversion=false,iterations=6}={}){
 const refusals=alignmentRefusals(primary,overlay);
 if(refusals.length)throw Error(refusals.join(' '));
 const rows=rowsOf(primary.cell);
 // Candidate shifts superpose one atom of the rarest element on each partner.
 const counts=new Map();for(const s of primary.sites)counts.set(s.symbol,(counts.get(s.symbol)||0)+1);
 const rare=[...counts].sort((a,b)=>a[1]-b[1]||(a[0]<b[0]?-1:1))[0][0];
 const anchor=primary.sites.find(s=>s.symbol===rare);
 let best=null;
 for(const sign of allowInversion?[1,-1]:[1]){
  for(const partner of overlay.sites.filter(s=>s.symbol===rare)){
   let shift=[anchor.x-sign*partner.x,anchor.y-sign*partner.y,anchor.z-sign*partner.z];
   let result=matchForShift(primary,overlay,rows,shift,sign);
   for(let k=0;k<iterations;k++){
    // Least squares: remove the mean displacement, then re-pair.
    shift=shift.map((v,i)=>v-result.mean[i]);
    const next=matchForShift(primary,overlay,rows,shift,sign);
    const settled=next.mean.every(v=>Math.abs(v)<1e-12);
    result=next;if(settled)break;
   }
   const s=score(result.pairs,rows);
   if(!best||s.rmsd<best.rmsd-1e-12)best={sign,shift:shift.map(v=>v-Math.floor(v)),pairs:result.pairs,...s};
  }
 }
 const primaryVolume=volumeOf(rows),overlayVolume=volumeOf(rowsOf(overlay.cell));
 return {
  inverted:best.sign<0,shift:best.shift,rmsd:best.rmsd,maxDisplacement:best.max,
  pairs:best.pairs.map((q,i)=>({primary:primary.sites[q.primary].label||primary.sites[q.primary].symbol,
   overlay:overlay.sites[q.overlay].label||overlay.sites[q.overlay].symbol,symbol:primary.sites[q.primary].symbol,
   primaryIndex:q.primary,overlayIndex:q.overlay,displacement:best.distances[i],
   vector:cartesian(rows,q.frac)})).sort((a,b)=>a.primaryIndex-b.primaryIndex),
  cell:{deltas:Object.fromEntries(['a','b','c','alpha','beta','gamma'].map(k=>[k,overlay.cell[k]-primary.cell[k]])),
   volumeChange:(overlayVolume-primaryVolume)/primaryVolume}
 };
}

export function alignmentCsv(result){
 const f=v=>Number(v).toFixed(6);
 return 'primary,overlay,element,displacement_A,dx_A,dy_A,dz_A\n'+result.pairs.map(p=>
  [p.primary,p.overlay,p.symbol,f(p.displacement),...p.vector.map(f)].map(v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')).join('\n')+'\n';
}
