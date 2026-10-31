/* Crystallographic geometry tables: bond lengths, angles and torsion angles
 * with CIF symmetry codes (n_klm) and standard uncertainties propagated from
 * the CIF e.s.d.s of the cell and the atom coordinates.
 *
 * s.u.s neglect covariances between parameters (only the CIF e.s.d.s are
 * known); refinement programs with the full variance-covariance matrix can
 * give smaller or larger values. Pure functions: plain arrays and numbers. */

const EPS=1e-6;
const round6=v=>Math.round(v*1e6)/1e6;

/* ---- Symmetry operations ------------------------------------------------ */

/** Parses "x-y+1/2,-y,z" into {R (rows), t}. */
export function parseSymop(text){
 const parts=String(text).replace(/['"\s]/g,'').toLowerCase().split(',');
 if(parts.length!==3)throw Error('Simetri işlemi üç bileşen içermeli: '+text);
 const R=[],t=[];
 for(const part of parts){
  const row=[0,0,0];let shift=0;
  const terms=part.match(/[+-]?[^+-]+/g);
  if(!terms)throw Error('Simetri işlemi okunamadı: '+text);
  for(const term of terms){
   const m=/^([+-]?)(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)?\*?([xyz])?$/.exec(term);
   if(!m||(!m[2]&&!m[3]))throw Error('Simetri işlemi okunamadı: '+text);
   const sign=m[1]==='-'?-1:1;
   let value=1;
   if(m[2]){const [n,d]=m[2].split('/');value=Number(n)/(d?Number(d):1);}
   if(!Number.isFinite(value))throw Error('Simetri işlemi okunamadı: '+text);
   if(m[3])row['xyz'.indexOf(m[3])]+=sign*value;else shift+=sign*value;
  }
  R.push(row);t.push(shift);
 }
 return {R,t};
}
const fraction=v=>{
 for(const d of [1,2,3,4,6,8,12]){const n=Math.round(v*d);if(Math.abs(n/d-v)<1e-6)return d===1?String(n):n+'/'+d;}
 return String(round6(v));
};
/** Formats {R,t} as an x,y,z string such as "-x+1/2,y,z". */
export function formatSymop({R,t}){
 return R.map((row,i)=>{
  let s='';
  row.forEach((c,j)=>{
   if(Math.abs(c)<EPS)return;
   const v='xyz'[j],k=Math.abs(c);
   s+=(c<0?'-':s?'+':'')+(Math.abs(k-1)<EPS?'':fraction(k))+v;
  });
  const shift=t[i];
  if(Math.abs(shift)>EPS)s+=(shift<0?'-':s?'+':'')+fraction(Math.abs(shift));
  return s||'0';
 }).join(',');
}
const apply=({R,t},x)=>R.map((row,i)=>row[0]*x[0]+row[1]*x[1]+row[2]*x[2]+t[i]);
const same=(a,b)=>a.every((row,i)=>row.every((v,j)=>Math.abs(v-b[i][j])<EPS));
const multiply=(A,B)=>A.map(row=>[0,1,2].map(j=>row[0]*B[0][j]+row[1]*B[1][j]+row[2]*B[2][j]));
const wrap=v=>{const w=v-Math.floor(v);return w>1-EPS?0:w;};

/** Operations from the editor's [op, centring shift] list, translations reduced to [0,1). */
export function symmetryOperations(pairs){
 const ops=pairs.map(([op,shift])=>{
  const base=parseSymop(op),centring=String(shift||'0,0,0').split(',').map(s=>{const [n,d]=s.split('/');return Number(n)/(d?Number(d):1);});
  return {R:base.R,t:base.t.map((v,i)=>wrap(v+centring[i]))};
 });
 if(!ops.length||!same(ops[0].R,[[1,0,0],[0,1,0],[0,0,1]])||ops[0].t.some(v=>Math.abs(v)>EPS))
  throw Error('İlk simetri işlemi birim işlem (x,y,z) olmalı.');
 return ops;
}
/** Index and lattice translation of the operation R·x + t in the list. */
function findOperation(ops,R,t){
 for(let n=0;n<ops.length;n++){
  if(!same(ops[n].R,R))continue;
  const d=t.map((v,i)=>v-ops[n].t[i]);
  if(d.every(v=>Math.abs(v-Math.round(v))<1e-5))return {op:n,shift:d.map(Math.round)};
 }
 throw Error('Simetri işlemlerinin bileşimi listede yok; grup kapalı değil.');
}
/** CIF symmetry code n_klm (klm = 5 + lattice translation), or '.' for 1_555. */
export function symmetryCode(op,shift){
 if(op===0&&shift.every(v=>v===0))return '.';
 if(shift.some(v=>Math.abs(v)>4))throw Error('Simetri kodu ötelemesi ±4 sınırını aşıyor.');
 return (op+1)+'_'+shift.map(v=>5+v).join('');
}

/* ---- Cell metric -------------------------------------------------------- */

function cellMatrix({a,b,c,alpha,beta,gamma}){
 const r=Math.PI/180,ca=Math.cos(alpha*r),cb=Math.cos(beta*r),cg=Math.cos(gamma*r),sg=Math.sin(gamma*r);
 const cx=c*cb,cy=c*(ca-cb*cg)/sg,cz2=c*c-cx*cx-cy*cy;
 if(!(cz2>0)||!(sg>0))throw Error('Hücre parametreleri geçersiz.');
 return [[a,0,0],[b*cg,b*sg,0],[cx,cy,Math.sqrt(cz2)]];
}
const toCartesian=(M,f)=>[0,1,2].map(k=>f[0]*M[0][k]+f[1]*M[1][k]+f[2]*M[2][k]);
const sub=(u,v)=>u.map((x,i)=>x-v[i]);
const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
const length=u=>Math.sqrt(dot(u,u));
const degrees=v=>v*180/Math.PI;

export function bondLength(p){return length(sub(p[1],p[0]));}
export function bondAngle(p){
 const u=sub(p[0],p[1]),v=sub(p[2],p[1]);
 return degrees(Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(length(u)*length(v))))));
}
/** IUPAC torsion A–B–C–D in (−180°, 180°]. */
export function torsionAngle(p){
 const b1=sub(p[1],p[0]),b2=sub(p[2],p[1]),b3=sub(p[3],p[2]);
 const n1=cross(b1,b2),n2=cross(b2,b3),m=cross(n1,b2.map(v=>v/length(b2)));
 const angle=-degrees(Math.atan2(dot(m,n2),dot(n1,n2)));
 // ±180° are the same conformation; report +180 within rounding noise.
 return angle<=-180+1e-7?180:angle;
}

/* ---- Neighbour search ---------------------------------------------------- */

/** Placement of an atom: site index, operation index and lattice translation. */
const place=(ops,sites,{site,op,shift})=>apply(ops[op],[sites[site].x,sites[site].y,sites[site].z]).map((v,i)=>v+shift[i]);

/** Neighbours of every site at its own (identity) position within
 * range(symbolA, symbolB) → [min, max] Å. skip(siteA, siteB, distance)
 * may reject pairs such as alternative disorder positions. */
export function neighbourLists(sites,cell,ops,range,{skip=()=>false,limit=20000,periodic=true}={}){
 const M=cellMatrix(cell),lists=sites.map(()=>[]);
 const equivalents=[];
 for(let j=0;j<sites.length;j++){
  const seen=new Set();
  for(let n=0;n<ops.length;n++){
   // A molecule (no periodicity) keeps its own coordinates and only the identity.
   if(!periodic&&n>0)break;
   const raw=place(ops,sites,{site:j,op:n,shift:[0,0,0]}),wrapped=periodic?raw.map(wrap):raw;
   const key=wrapped.map(v=>Math.round(v*1e5)%100000).join(':');
   if(seen.has(key))continue;seen.add(key);
   equivalents.push({site:j,op:n,base:wrapped.map((v,i)=>Math.round(v-raw[i]))});
  }
 }
 // Perpendicular cell widths bound the lattice translations to search.
 const vol=Math.abs(dot(M[0],cross(M[1],M[2]))),widths=[[1,2],[2,0],[0,1]].map(([i,j])=>vol/length(cross(M[i],M[j])));
 let count=0;
 for(let i=0;i<sites.length;i++){
  const origin=[sites[i].x,sites[i].y,sites[i].z],oc=toCartesian(M,origin);
  for(const e of equivalents){
   const [min,max]=range(sites[i].symbol,sites[e.site].symbol);
   const raw=place(ops,sites,{site:e.site,op:e.op,shift:e.base});
   const n=periodic?widths.map(w=>Math.ceil(max/w)+1):[0,0,0],centre=periodic?origin.map((v,k)=>Math.round(v-raw[k])):[0,0,0];
   for(let x=centre[0]-n[0];x<=centre[0]+n[0];x++)for(let y=centre[1]-n[1];y<=centre[1]+n[1];y++)for(let z=centre[2]-n[2];z<=centre[2]+n[2];z++){
    const shift=[e.base[0]+x,e.base[1]+y,e.base[2]+z];
    const d=length(sub(toCartesian(M,place(ops,sites,{site:e.site,op:e.op,shift})),oc));
    if(d<Math.max(min,1e-4)-1e-6||d>max+1e-6||skip(i,e.site,d))continue;
    if(++count>limit)throw Error('Geometri tablosu '+limit+' komşu sınırını aşıyor; bağ eşiğini düşürün.');
    lists[i].push({site:e.site,op:e.op,shift,distance:d});
   }
  }
  lists[i].sort((a,b)=>a.distance-b.distance||a.site-b.site);
 }
 return lists;
}

/* ---- Standard uncertainties ------------------------------------------- */

const CELL_KEYS=['a','b','c','alpha','beta','gamma'];
/** s.u. of a geometric quantity from uncorrelated cell and coordinate e.s.d.s.
 * Returns null when no involved parameter has an e.s.d. */
function propagate(quantity,placements,sites,cell,ops,cellSu){
 const params=[];
 for(const k of CELL_KEYS)if(cellSu?.[k]>0)params.push({cell:k,su:cellSu[k]});
 for(const s of new Set(placements.map(p=>p.site)))
  for(const [axis,k] of [['x',0],['y',1],['z',2]])if(sites[s].su?.[axis]>0)params.push({site:s,k,su:sites[s].su[axis]});
 if(!params.length)return null;
 const evaluate=(change)=>{
  const c={...cell},local=sites.map(s=>({x:s.x,y:s.y,z:s.z}));
  if(change?.cell)c[change.cell]+=change.delta;
  if(change&&change.site!==undefined)local[change.site]['xyz'[change.k]]+=change.delta;
  const M=cellMatrix(c);
  return quantity(placements.map(p=>toCartesian(M,place(ops,local,p))));
 };
 let variance=0;
 for(const p of params){
  const h=p.su*1e-2;
  let up=evaluate({...p,delta:h}),down=evaluate({...p,delta:-h});
  if(quantity===torsionAngle){
   // Torsions wrap at ±180°: take the short way round.
   let d=up-down;d-=360*Math.round(d/360);variance+=(d/(2*h)*p.su)**2;
  }else variance+=((up-down)/(2*h)*p.su)**2;
 }
 return Math.sqrt(variance);
}

/** Bonds, angles and (optionally) torsions for every site.
 * sites: [{label, symbol, x, y, z, su?:{x,y,z}}]; cell: {a..gamma}; cellSu: same keys or null.
 * ops: symmetryOperations(...). Bonds are listed once; angles and torsions
 * around each site, as in CIF _geom loops. */
export function geometryTable(sites,cell,ops,range,{cellSu=null,skip,torsions=false,maxRows=5000,periodic=true}={}){
 if(!Array.isArray(sites)||!sites.length)throw Error('Geometri tablosu için atom yok.');
 const lists=neighbourLists(sites,cell,ops,range,{skip,periodic});
 const M=cellMatrix(cell),identity={op:0,shift:[0,0,0]};
 const position=p=>toCartesian(M,place(ops,sites,p));
 const code=p=>symmetryCode(p.op,p.shift);
 const label=p=>sites[p.site].label;
 const rows={bonds:[],angles:[],torsions:[]};
 const add=(list,quantity,placements,extra)=>{
  if(rows.bonds.length+rows.angles.length+rows.torsions.length>=maxRows){rows.truncated=true;return;}
  const value=quantity(placements.map(position));
  list.push({labels:placements.map(label),codes:placements.map(code),value,
   su:propagate(quantity,placements,sites,cell,ops,cellSu),...extra});
 };
 // Bond i–j once: i<j. For i=j the bond to the image at −v is the same
 // bond moved by a lattice/symmetry translation only when −v is also a
 // neighbour (e.g. ±a in a primitive cubic cell); then keep one of the pair.
 for(let i=0;i<sites.length;i++){
  const a={site:i,...identity},origin=position(a);
  const vectors=lists[i].filter(n=>n.site===i).map(n=>sub(position(n),origin));
  for(const n of lists[i]){
   if(n.site<i)continue;
   if(n.site===i){
    const v=sub(position(n),origin),first=v.find(x=>Math.abs(x)>1e-6)??0;
    if(first<0&&vectors.some(w=>length(sub(w,v.map(x=>-x)))<1e-4))continue;
   }
   add(rows.bonds,bondLength,[a,n]);
  }
 }
 for(let i=0;i<sites.length;i++){
  const centre={site:i,...identity},list=lists[i];
  for(let p=0;p<list.length;p++)for(let q=p+1;q<list.length;q++)add(rows.angles,bondAngle,[list[p],centre,list[q]]);
 }
 if(torsions){
  // A–B–C–D with B at identity, C a neighbour of B and D a neighbour of C
  // placed by C's operation: D = C∘(neighbour of site C at identity).
  // A–B–C–D and D–C–B–A are one torsion; the first one found is kept.
  // Keys use site indices and vectors relative to the second atom, so a
  // lattice translation of the same torsion is recognised as well.
  // The 0.37 offset keeps bins away from x.5 values that crystal coordinates
  // such as 1/4 and 1/8 hit exactly, where rounding noise would split one key.
  const quantize=v=>Math.round(v*1000+.37);
  const seen=new Set(),key=(ids,points)=>ids.join(',')+'|'+points.map(p=>sub(p,points[1]).map(quantize).join(',')).join(';');
  for(let b=0;b<sites.length;b++)for(const c of lists[b]){
   const B={site:b,...identity};
   const cOp=ops[c.op];
   for(const a of lists[b]){
    if(a===c)continue;
    for(const d0 of lists[c.site]){
     const R=multiply(cOp.R,ops[d0.op].R),t=apply(cOp,ops[d0.op].t);
     const found=findOperation(ops,R,t),shift=apply({R:cOp.R,t:[0,0,0]},d0.shift).map((v,k)=>Math.round(v+c.shift[k]+found.shift[k]));
     const D={site:d0.site,op:found.op,shift};
     const points=[a,B,c,D].map(position);
     if(length(sub(points[3],points[1]))<1e-4||length(sub(points[3],points[0]))<1e-4)continue;
     const ids=[a,B,c,D].map(p=>p.site),forward=key(ids,points),backward=key([...ids].reverse(),[...points].reverse());
     if(seen.has(forward)||seen.has(backward))continue;
     seen.add(forward);
     add(rows.torsions,torsionAngle,[a,B,c,D]);
    }
   }
  }
 }
 return rows;
}

/* ---- Output ---------------------------------------------------------- */

/** Crystallographic notation: 2.3517(4) with one or two s.u. digits (rule of 19). */
export function formatWithSu(value,su,{decimals=4}={}){
 if(!Number.isFinite(value))throw Error('Biçimlenecek değer sonlu olmalı.');
 if(!(su>0))return value.toFixed(decimals);
 let places=-Math.floor(Math.log10(su));
 if(Math.round(su*10**(places+1))<=19)places+=1;
 places=Math.max(0,places);
 let digits=Math.round(su*10**places);
 if(digits>=100){places=Math.max(0,places-1);digits=Math.round(su*10**places);}
 return value.toFixed(places)+'('+digits+')';
}
const csvCell=v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
export function geometryCsv(rows){
 const lines=['type,atoms,symmetry_codes,value,su,unit'];
 const push=(type,list,unit)=>{for(const r of list)lines.push([type,r.labels.join('-'),r.codes.join(' '),r.value.toFixed(6),r.su==null?'':r.su.toExponential(3),unit].map(String).map(csvCell).join(','));};
 push('bond',rows.bonds,'angstrom');push('angle',rows.angles,'degree');push('torsion',rows.torsions,'degree');
 for(const r of rows.hbonds||[])for(const [type,key,unit] of [['hbond_DH','dh','angstrom'],['hbond_HA','ha','angstrom'],['hbond_DA','da','angstrom'],['hbond_DHA','angle','degree']])
  lines.push([type,r.labels.join('-'),r.codes.join(' '),r[key].toFixed(6),r.su[key]==null?'':r.su[key].toExponential(3),unit].map(String).map(csvCell).join(','));
 return lines.join('\n')+'\n';
}
const cifValue=v=>/^[^\s'"_#$;[\]][^\s]*$/.test(v)?v:"'"+v.replace(/'/g,'')+"'";
/** CIF block with the symmetry operations the codes refer to and _geom loops. */
export function geometryCif(rows,ops,{name='structure',spaceGroup='',note=''}={}){
 const out=['data_'+String(name).replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,60)+'_geom',
  "_audit_creation_method 'Kristal Yapi geometry table'"];
 if(spaceGroup)out.push('_space_group_name_H-M_alt '+cifValue(spaceGroup));
 // CIF text field: a line starting with ';' opens it and a lone ';' closes it.
 if(note)out.push('_audit_comment',';'+String(note).replace(/\n;/g,'\n ;'),';');
 out.push('','loop_','_space_group_symop_id','_space_group_symop_operation_xyz');
 ops.forEach((op,i)=>out.push((i+1)+' '+cifValue(formatSymop(op))));
 const loop=(list,fields,format)=>{
  if(!list.length)return;
  out.push('','loop_',...fields);
  for(const r of list)out.push(format(r).map(cifValue).join(' '));
 };
 loop(rows.bonds,['_geom_bond_atom_site_label_1','_geom_bond_atom_site_label_2','_geom_bond_distance','_geom_bond_site_symmetry_2','_geom_bond_publ_flag'],
  r=>[r.labels[0],r.labels[1],formatWithSu(r.value,r.su),r.codes[1],'?']);
 loop(rows.angles,['_geom_angle_atom_site_label_1','_geom_angle_atom_site_label_2','_geom_angle_atom_site_label_3','_geom_angle','_geom_angle_site_symmetry_1','_geom_angle_site_symmetry_3','_geom_angle_publ_flag'],
  r=>[...r.labels,formatWithSu(r.value,r.su,{decimals:2}),r.codes[0],r.codes[2],'?']);
 loop(rows.torsions,['_geom_torsion_atom_site_label_1','_geom_torsion_atom_site_label_2','_geom_torsion_atom_site_label_3','_geom_torsion_atom_site_label_4','_geom_torsion','_geom_torsion_site_symmetry_1','_geom_torsion_site_symmetry_2','_geom_torsion_site_symmetry_3','_geom_torsion_site_symmetry_4','_geom_torsion_publ_flag'],
  r=>[...r.labels,formatWithSu(r.value,r.su,{decimals:2}),...r.codes,'?']);
 if(rows.hbonds?.length)out.push(hydrogenBondCifLoop(rows.hbonds).trimEnd());
 return out.join('\n')+'\n';
}

/* ---- Hydrogen bonds --------------------------------------------------------- */

/* Common geometric criteria; every value can be changed by the caller.
   D–H is a covalent bond to a donor; H···A, D···A and the D–H···A angle
   follow widely used limits (e.g. Jeffrey, An Introduction to Hydrogen
   Bonding, 1997; IUPAC Recommendations 2011 ask for an angle above 110°). */
export const HBOND_DEFAULTS=Object.freeze({donors:['N','O','F'],acceptors:['N','O','F','S','Cl'],
 maxDH:1.2,maxHA:2.5,maxDA:3.5,minAngle:120});
/** D–H···A hydrogen bonds around every H site at its identity position.
 * Rows: labels [D,H,A], codes [D,H,A], distances dh/ha/da, angle, with s.u.s. */
export function hydrogenBonds(sites,cell,ops,options={}){
 const o={...HBOND_DEFAULTS,...options};
 if(!(o.maxDH>0&&o.maxHA>o.maxDH&&o.maxDA>0&&o.minAngle>=90&&o.minAngle<180))throw Error('Hidrojen bağı ölçütleri geçersiz.');
 const donors=new Set(o.donors),acceptors=new Set(o.acceptors);
 const range=(a,b)=>a==='H'&&(donors.has(b)||acceptors.has(b))?[.5,o.maxHA]:[0,0];
 const lists=neighbourLists(sites,cell,ops,range,{skip:o.skip,periodic:o.periodic!==false});
 const M=cellMatrix(cell),position=p=>toCartesian(M,place(ops,sites,p)),code=p=>symmetryCode(p.op,p.shift);
 const rows=[];
 for(let h=0;h<sites.length;h++){
  if(sites[h].symbol!=='H')continue;
  const H={site:h,op:0,shift:[0,0,0]},list=lists[h];
  const donor=list.filter(n=>donors.has(sites[n.site].symbol)&&n.distance<=o.maxDH)[0];
  if(!donor)continue;
  for(const a of list){
   if(a===donor||!acceptors.has(sites[a.site].symbol)||a.distance<=o.maxDH)continue;
   const placements=[donor,H,a],points=placements.map(position);
   const da=bondLength([points[0],points[2]]),angle=bondAngle(points);
   if(da>o.maxDA||angle<o.minAngle)continue;
   const su=quantity=>propagate(quantity,placements,sites,cell,ops,o.cellSu);
   rows.push({labels:placements.map(p=>sites[p.site].label),codes:placements.map(code),
    dh:donor.distance,ha:a.distance,da,angle,
    su:{dh:su(p=>bondLength([p[0],p[1]])),ha:su(p=>bondLength([p[1],p[2]])),da:su(p=>bondLength([p[0],p[2]])),angle:su(bondAngle)}});
  }
 }
 return rows;
}
/** CIF _geom_hbond loop for hydrogenBonds rows (codes refer to the block's symop list). */
export function hydrogenBondCifLoop(rows){
 if(!rows.length)return '';
 const lines=['','loop_','_geom_hbond_atom_site_label_D','_geom_hbond_atom_site_label_H','_geom_hbond_atom_site_label_A',
  '_geom_hbond_distance_DH','_geom_hbond_distance_HA','_geom_hbond_distance_DA','_geom_hbond_angle_DHA',
  '_geom_hbond_site_symmetry_D','_geom_hbond_site_symmetry_H','_geom_hbond_site_symmetry_A','_geom_hbond_publ_flag'];
 for(const r of rows)lines.push([...r.labels,formatWithSu(r.dh,r.su.dh,{decimals:3}),formatWithSu(r.ha,r.su.ha,{decimals:3}),
  formatWithSu(r.da,r.su.da,{decimals:3}),formatWithSu(r.angle,r.su.angle,{decimals:1}),...r.codes,'?'].map(cifValue).join(' '));
 return lines.join('\n')+'\n';
}
