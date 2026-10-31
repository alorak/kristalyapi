/* V19 scene controls: per-site appearance, (hkl) clipping planes and
 * publication label placement. Pure functions; the editor applies them.
 *
 * Clipping is a display operation only: hidden atoms stay in the structure,
 * in symmetry, BVS and every export of coordinates. */

export const LABEL_TEXT_MAX=24;
export const LABEL_OFFSET_MAX=6; // em, in each direction
export const MAX_CLIP_PLANES=6;
export const CLIP_INTEGRITY=['cut','bonded','molecule'];
const MAX_INDEX=8,MAX_DISTANCE=1000;

/* Site fields added by V19 beside visualColor/visualScale/polyColor/polyOpacity. */
export const SITE_APPEARANCE_KEYS=['visualOpacity','visualHidden','labelText','labelOffset','labelHidden'];

export function validatedSiteAppearance(site){
 const out={};
 if(site.visualOpacity!==undefined){
  const n=Number(site.visualOpacity);
  if(!Number.isFinite(n)||n<.05||n>1)throw Error('Atom opaklığı 0,05–1 aralığında olmalı.');
  out.visualOpacity=n;
 }
 if(site.visualHidden!==undefined){
  if(typeof site.visualHidden!=='boolean')throw Error('Atom gizleme değeri geçersiz.');
  if(site.visualHidden)out.visualHidden=true;
 }
 if(site.labelText!==undefined){
  const text=String(site.labelText).trim();
  // Printable text only: labels are drawn as glyph outlines, never as markup.
  if(text.length>LABEL_TEXT_MAX||/[\u0000-\u001f\u007f<>&]/.test(text))
   throw Error('Etiket metni en çok '+LABEL_TEXT_MAX+' yazdırılabilir karakter olmalı (<, >, & olmadan).');
  if(text)out.labelText=text;
 }
 if(site.labelOffset!==undefined){
  const offset=site.labelOffset;
  if(!Array.isArray(offset)||offset.length!==2||offset.some(v=>!Number.isFinite(Number(v))||Math.abs(Number(v))>LABEL_OFFSET_MAX))
   throw Error('Etiket ofseti iki sayı olmalı ve ±'+LABEL_OFFSET_MAX+' em içinde kalmalı.');
  const pair=offset.map(Number);
  if(pair.some(v=>v!==0))out.labelOffset=pair;
 }
 if(site.labelHidden!==undefined){
  if(typeof site.labelHidden!=='boolean')throw Error('Etiket gizleme değeri geçersiz.');
  if(site.labelHidden)out.labelHidden=true;
 }
 return out;
}

/* The text a site's label shows: its own text, else the site label or symbol. */
export function siteLabelText(site,mode='symbol'){
 if(site?.labelText)return site.labelText;
 return mode==='site'?String(site?.label||site?.symbol||''):String(site?.symbol||'');
}

export function validatedClipPlane(plane){
 const hkl=['h','k','l'].map(key=>Number(plane?.[key]));
 if(hkl.some(v=>!Number.isInteger(v)||Math.abs(v)>MAX_INDEX))throw Error('Kesme düzlemi indisleri −8…8 aralığında tam sayı olmalı.');
 if(hkl.every(v=>v===0))throw Error('Kesme düzlemi (000) olamaz.');
 const distance=Number(plane.distance);
 if(!Number.isFinite(distance)||Math.abs(distance)>MAX_DISTANCE)throw Error('Kesme düzlemi uzaklığı ±1000 Å içinde olmalı.');
 if(!['below','above'].includes(plane.keep))throw Error('Kesme düzleminde korunacak taraf geçersiz.');
 return {h:hkl[0],k:hkl[1],l:hkl[2],distance,keep:plane.keep,enabled:plane.enabled!==false};
}

/* Saved settings: invalid planes are dropped rather than failing the project. */
export function normalizedClipSettings(raw){
 const planes=[];
 for(const plane of Array.isArray(raw?.planes)?raw.planes.slice(0,MAX_CLIP_PLANES):[]){
  try{planes.push(validatedClipPlane(plane));}catch(error){/* skipped */}
 }
 return {planes,integrity:CLIP_INTEGRITY.includes(raw?.integrity)?raw.integrity:'cut'};
}

/* Signed distance (Å) from the plane h·x+k·y+l·z = distance/d to a fractional
 * point, along the plane normal: (h·x+k·y+l·z)·d − distance, where d is the
 * interplanar spacing of (hkl). Positive values lie on the "above" side. */
export function clipSignedDistance(frac,plane,dSpacing){
 return (plane.h*frac[0]+plane.k*frac[1]+plane.l*frac[2])*dSpacing-plane.distance;
}
export function insideClipPlanes(frac,planes,dSpacings,tolerance=1e-7){
 return planes.every((plane,i)=>{
  if(!plane.enabled)return true;
  const s=clipSignedDistance(frac,plane,dSpacings[i]);
  return plane.keep==='below'?s<=tolerance:s>=-tolerance;
 });
}

/* Which atoms stay visible after clipping.
 *  cut      – exactly the atoms inside every plane;
 *  bonded   – also each atom bonded to an inside atom (complete first shell,
 *             so coordination polyhedra keep all their vertices);
 *  molecule – every bonded component with at least one inside atom.
 * pairs are [i,j] bonds between displayed atoms. */
export function clipKeepMask(inside,pairs,mode='cut'){
 const keep=inside.map(Boolean);
 if(mode==='bonded'){
  for(const [i,j] of pairs){if(inside[i])keep[j]=true;if(inside[j])keep[i]=true;}
 }else if(mode==='molecule'){
  const parent=inside.map((_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const [i,j] of pairs){const a=find(i),b=find(j);if(a!==b)parent[a]=b;}
  const touched=new Set();inside.forEach((value,i)=>{if(value)touched.add(find(i));});
  inside.forEach((_,i)=>{if(touched.has(find(i)))keep[i]=true;});
 }else if(mode!=='cut')throw Error('Kesme bütünlüğü seçeneği geçersiz.');
 return keep;
}

/* Place atom labels without overlap. Each label: {x,y,r,width,height,
 * depth,offset?} with (x,y,r) the projected atom disc and width/height the
 * text box (height = cap height; the anchor is the baseline centre).
 * A label with an explicit offset (in em = height units) is placed there and
 * never moved. Others try above, right, left, below and the four diagonals
 * and take the first position that overlaps no placed label and stays in the
 * frame, preferring positions that also do not cover another atom centre.
 * Front atoms (smaller depth) are placed first. Returns, in input order,
 * {x,y,moved,overlap}. */
export function placeLabels(labels,{width,height,gap=.3}={}){
 const placed=[],out=new Array(labels.length);
 const centres=labels.map(l=>[l.x,l.y]);
 const order=labels.map((l,i)=>i).sort((a,b)=>(labels[a].depth??0)-(labels[b].depth??0));
 const box=(cx,by,w,h)=>[cx-w/2,by-h,cx+w/2,by+.25*h]; // descenders below the baseline
 const overlaps=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
 const clampX=(cx,w)=>Math.min(width-w/2,Math.max(w/2,cx));
 const clampY=(by,h)=>Math.min(height-.25*h,Math.max(h,by));
 for(const index of order){
  const l=labels[index],w=l.width,h=l.height,p=gap*h,r=Math.max(0,l.r||0),d=.7071*r;
  if(Array.isArray(l.offset)){
   const cx=clampX(l.x+l.offset[0]*h,w),by=clampY(l.y-r-p-l.offset[1]*h,h),b=box(cx,by,w,h);
   out[index]={x:cx,y:by,moved:false,overlap:placed.some(q=>overlaps(q,b))};placed.push(b);continue;
  }
  const candidates=[
   [l.x,l.y-r-p],[l.x+r+p+w/2,l.y+h/2],[l.x-r-p-w/2,l.y+h/2],[l.x,l.y+r+p+h],
   [l.x+d+p+w/2,l.y-d-p],[l.x-d-p-w/2,l.y-d-p],[l.x+d+p+w/2,l.y+d+p+h],[l.x-d-p-w/2,l.y+d+p+h]
  ].map(([cx,by])=>{const x=clampX(cx,w),y=clampY(by,h);return {x,y,b:box(x,y,w,h)};});
  const free=candidates.filter(c=>!placed.some(q=>overlaps(q,c.b)));
  const coversAtom=c=>centres.some(([x,y],j)=>j!==index&&x>c.b[0]&&x<c.b[2]&&y>c.b[1]&&y<c.b[3]);
  const best=free.find(c=>!coversAtom(c))||free[0];
  const chosen=best||candidates[0];
  out[index]={x:chosen.x,y:chosen.y,moved:chosen!==candidates[0],overlap:!best};
  placed.push(chosen.b);
 }
 return out;
}

/* ---- V19 P2: bond pair styles, dot surface and moment arrows ---- */

const SYMBOL=/^[A-Za-z]{1,2}$/;
const capital=symbol=>symbol.charAt(0).toUpperCase()+symbol.slice(1).toLowerCase();
export const bondPairKey=(a,b)=>[capital(String(a)),capital(String(b))].sort().join('-');

/* One rule per line (or ';'): "Si-O #ff0000" colours, "Si-Si gizle"/"hide"
 * hides that element pair's bonds. Display only: bond search, coordination
 * and measurements are unchanged. */
export function parseBondPairStyles(text){
 const out=new Map();
 const lines=String(text||'').split(/[\n;]+/).map(line=>line.trim()).filter(Boolean);
 if(lines.length>60)throw Error('En çok 60 bağ çifti stili girilebilir.');
 for(const line of lines){
  const match=line.match(/^([A-Za-z]{1,2})\s*-\s*([A-Za-z]{1,2})\s+(#[0-9A-Fa-f]{6}|gizle|hide)$/i);
  if(!match||!SYMBOL.test(match[1])||!SYMBOL.test(match[2]))
   throw Error('Bağ çifti stili "'+line.slice(0,40)+'" okunamadı; örn. Si-O #ff0000 veya Si-Si gizle.');
  const key=bondPairKey(match[1],match[2]);
  if(out.has(key))throw Error(key+' bağ çifti iki kez tanımlanmış.');
  out.set(key,/^#/.test(match[3])?{color:match[3].toLowerCase()}:{hidden:true});
 }
 return out;
}

/* n nearly uniform unit vectors (Fibonacci / golden-angle spiral). */
export function fibonacciSphere(n){
 if(!Number.isInteger(n)||n<1)throw Error('Nokta sayısı pozitif tam sayı olmalı.');
 const golden=Math.PI*(3-Math.sqrt(5)),out=[];
 for(let i=0;i<n;i++){
  const z=1-2*(i+.5)/n,r=Math.sqrt(Math.max(0,1-z*z)),phi=i*golden;
  out.push([r*Math.cos(phi),r*Math.sin(phi),z]);
 }
 return out;
}

export const DOT_SURFACE_DEFAULTS=Object.freeze({enabled:false,scale:1,density:3});
export function normalizedDotSurface(raw){
 const n=(value,min,max,fallback)=>{const v=Number(value);return Number.isFinite(v)&&v>=min&&v<=max?v:fallback;};
 return {enabled:raw?.enabled===true,scale:n(raw?.scale,.5,1.5,1),density:n(raw?.density,.5,8,3)};
}

/* van der Waals dot surface: points on each sphere (radius = scale × vdW)
 * with a density in dots per Å², keeping only points outside every other
 * sphere — the solvent-free envelope of the displayed atoms.
 * spheres: [{center:[x,y,z], radius, color}]. */
export function dotSurfacePoints(spheres,{density=3,maxPoints=80000}={}){
 if(!(density>0))throw Error('Nokta yoğunluğu pozitif olmalı.');
 const maxR=Math.max(0,...spheres.map(s=>s.radius)),size=Math.max(1e-6,2*maxR);
 const cell=p=>p.map(v=>Math.floor(v/size)),key=c=>c.join(',');
 const grid=new Map();
 spheres.forEach((s,i)=>{const k=key(cell(s.center));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});
 const points=[],colors=[],owners=[],templates=new Map();
 let truncated=false;
 for(let i=0;i<spheres.length&&!truncated;i++){
  const s=spheres[i],count=Math.max(12,Math.round(density*4*Math.PI*s.radius*s.radius));
  if(!templates.has(count))templates.set(count,fibonacciSphere(count));
  const near=[],[cx,cy,cz]=cell(s.center);
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
   for(const j of grid.get(key([cx+x,cy+y,cz+z]))||[])if(j!==i)near.push(spheres[j]);
  for(const u of templates.get(count)){
   const p=[0,1,2].map(k=>s.center[k]+s.radius*u[k]);
   if(near.some(o=>(p[0]-o.center[0])**2+(p[1]-o.center[1])**2+(p[2]-o.center[2])**2<o.radius*o.radius-1e-9))continue;
   if(points.length>=maxPoints){truncated=true;break;}
   points.push(p);colors.push(s.color);owners.push(i);
  }
 }
 return {points,colors,owners,truncated};
}

/* Magnetic moment arrows. "auto" keeps the earlier readable length
 * (0.4 + 0.28·|μ| Å, at most 1.8 Å); "linear" draws scale·|μ| Å so lengths
 * compare between sites. The direction is always the moment direction. */
export const MOMENT_STYLE_DEFAULTS=Object.freeze({mode:'auto',scale:.5,color:'#d7698b'});
export const MAX_MOMENT_ARROW=8;
export function normalizedMomentStyle(raw){
 const scale=Number(raw?.scale);
 return {mode:raw?.mode==='linear'?'linear':'auto',scale:Number.isFinite(scale)&&scale>=.05&&scale<=2?scale:.5,
  color:/^#[0-9a-f]{6}$/i.test(String(raw?.color))?String(raw.color).toLowerCase():MOMENT_STYLE_DEFAULTS.color};
}
export function momentArrowLength(norm,style){
 if(!(norm>=0))throw Error('Moment büyüklüğü geçersiz.');
 if(style.mode==='linear'){const length=style.scale*norm;return {length:Math.min(MAX_MOMENT_ARROW,length),capped:length>MAX_MOMENT_ARROW};}
 return {length:Math.min(1.8,.4+.28*norm),capped:false};
}
