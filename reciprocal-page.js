/* Kristal Yapı · "Karşı Uzay ve Kırınım" concept page.
 * UI only: all physics lives in reciprocal-core.js (unit-tested) or comes
 * from the editor through the host object (structure, F(hkl), f₀, powder). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import * as R from './reciprocal-core.js';

const $=id=>document.getElementById(id);
const SVGNS='http://www.w3.org/2000/svg';
const TABS=['lattice','ewald','zone','bz'];
const fmt=(v,d=4)=>Number.isFinite(v)?Number(v).toFixed(d):'—';
const hklText=(h,k,l)=>'('+[h,k,l].map(v=>v<0?'−'+(-v):String(v)).join(' ')+')';
/* Conventional family label for powder lines. Only for orthogonal cells:
   there ±h, ±k, ±l (and permutations of equal axes) share one d-spacing.
   Hexagonal/monoclinic cells keep the computed member, which is always valid. */
function familyLabel(hkl,cell){
 const ortho=[cell.alpha,cell.beta,cell.gamma].every(a=>Math.abs(a-90)<1e-6);
 if(!ortho)return hklText(...hkl);
 const v=hkl.map(Math.abs),eq=(x,y)=>Math.abs(x-y)<1e-6*Math.max(x,y);
 if(eq(cell.a,cell.b)&&eq(cell.b,cell.c))v.sort((x,y)=>y-x);
 else if(eq(cell.a,cell.b)&&v[1]>v[0])[v[0],v[1]]=[v[1],v[0]];
 return hklText(...v);
}
const BRAVAIS_NAMES={CUB:'Basit kübik (cP)',FCC:'Yüzey merkezli kübik (cF)',BCC:'Hacim merkezli kübik (cI)',
 TET:'Basit tetragonal (tP)',BCT:'Hacim merkezli tetragonal (tI)',ORC:'Basit ortorombik (oP)',
 HEX:'Hegzagonal (hP)',RHL:'Rombohedral (hR)'};

function svg(tag,attrs={},text){
 const el=document.createElementNS(SVGNS,tag);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
 if(text!==undefined&&text!==null)el.textContent=text;
 return el;
}
function arrowHead(group,x1,y1,x2,y2,color,size=8){
 const a=Math.atan2(y2-y1,x2-x1),p=(t)=>[x2-size*Math.cos(a+t),y2-size*Math.sin(a+t)];
 const [l,r]=[p(.42),p(-.42)];
 group.append(svg('polygon',{points:`${x2},${y2} ${l[0]},${l[1]} ${r[0]},${r[1]}`,fill:color}));
}
function svgArrow(group,x1,y1,x2,y2,color,width=2,head=8){
 const len=Math.hypot(x2-x1,y2-y1);if(len<1e-6)return;
 group.append(svg('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-linecap':'round'}));
 arrowHead(group,x1,y1,x2,y2,color,Math.min(head,len*.6));
}
function readout(dl,rows){
 dl.replaceChildren();
 for(const [label,value] of rows){
  dl.append(Object.assign(document.createElement('dt'),{textContent:label}),
   Object.assign(document.createElement('dd'),{textContent:value}));
 }
}
function table(host,headers,rows){
 host.replaceChildren();if(!rows.length)return;
 const t=document.createElement('table');t.className='rs-table';
 const tr=document.createElement('tr');
 for(const h of headers)tr.append(Object.assign(document.createElement('th'),{textContent:h}));
 const thead=document.createElement('thead');thead.append(tr);t.append(thead);
 const body=document.createElement('tbody');
 for(const row of rows){const r=document.createElement('tr');
  for(const cell of row)r.append(Object.assign(document.createElement('td'),{textContent:cell}));body.append(r);}
 t.append(body);host.append(t);
}
function status(id,message='',error=false){
 const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle('error',!!error);
}
const intInput=(id,lo,hi)=>{const v=Number($(id).value);if(!Number.isInteger(v)||v<lo||v>hi)throw Error('Tam sayı gerekli; izin verilen aralık: '+lo+'…'+hi);return v;};
const numInput=(id,lo,hi,name)=>{const v=Number($(id).value);if(!Number.isFinite(v)||v<lo||v>hi)throw Error(name+' · izin verilen aralık: '+lo+'–'+hi);return v;};

/* ---------- small Three.js viewer (renders on demand) ---------- */
function labelSprite(text,color='#1d3550',height=1){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
 const ctx=canvas.getContext('2d');ctx.font='600 54px Inter, system-ui, sans-serif';
 ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,50);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false,transparent:true}));
 sprite.scale.set(height*2.67,height,1);sprite.renderOrder=10;return sprite;
}
function makeViewer(container){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.AmbientLight(0xffffff,.9));
 const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(4,-6,9);scene.add(light);
 const camera=new THREE.PerspectiveCamera(32,1,.001,1000);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);
 const root=new THREE.Group();scene.add(root);
 const render=()=>renderer.render(scene,camera);
 controls.addEventListener('change',render);
 const resize=()=>{
  const w=container.clientWidth,h=container.clientHeight;if(w<2||h<2)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();
 };
 new ResizeObserver(resize).observe(container);
 return {renderer,camera,controls,root,render,resize,
  clear(){
   for(const obj of root.children.slice()){
    root.remove(obj);
    obj.traverse(x=>{x.geometry?.dispose?.();const m=x.material;
     for(const mat of Array.isArray(m)?m:m?[m]:[]){mat.map?.dispose?.();mat.dispose?.();}});
   }
  },
  fit(radius,center=[0,0,0],direction=[1.5,-2.4,1.25]){
   const n=Math.hypot(...direction),r=Math.max(radius,1e-6);
   controls.target.set(...center);
   camera.position.set(...center.map((c,i)=>c+direction[i]/n*r*3.4));
   camera.near=r/200;camera.far=r*200;camera.updateProjectionMatrix();controls.update();resize();
  },
  dispose(){renderer.dispose();controls.dispose();}
 };
}
function lineSegments(points,color,opacity=1){
 const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
 return new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
}
function arrow(from,to,color,headScale=.08){
 const dir=new THREE.Vector3(...R.sub(to,from)),len=dir.length();if(len<1e-9)return null;
 return new THREE.ArrowHelper(dir.normalize(),new THREE.Vector3(...from),len,color,len*headScale*2.2,len*headScale*1.3);
}
function cellEdges(A,color=0x5a6f86){
 const pts=[],c=(f)=>R.add(R.add(R.scale(A[0],f[0]),R.scale(A[1],f[1])),R.scale(A[2],f[2]));
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
  const a=[i>>2&1,i>>1&1,i&1],b=[j>>2&1,j>>1&1,j&1];
  if(a.reduce((n,v,d)=>n+(v!==b[d]),0)===1)pts.push(c(a),c(b));
 }
 return lineSegments(pts,color,.9);
}

export function initReciprocalPage(host){
 const viewers={};
 let visible=false,activeTab='lattice',cache=null,ewaldAligned=false,ewaldAllowed=null;
 const dirty=new Set(TABS);

 function viewer(id){
  if(!viewers[id])viewers[id]=makeViewer($(id));
  return viewers[id];
 }
 function structure(){
  if(cache)return cache;
  const s=host.structure();
  const A=R.cellVectors(s.cell);
  cache={...s,A,Bstar:R.reciprocalVectors(A)};
  return cache;
 }
 function sourceBanner(){
  try{
   const s=structure();
   $('rsSourceName').textContent=s.name||'—';
   $('rsSourceDetail').textContent=[s.workspace,s.symmetry,s.sites.length+' atom',
    'a='+fmt(s.cell.a,3)+' b='+fmt(s.cell.b,3)+' c='+fmt(s.cell.c,3)+' Å',
    'α='+fmt(s.cell.alpha,2)+' β='+fmt(s.cell.beta,2)+' γ='+fmt(s.cell.gamma,2)+'°'].filter(Boolean).join(' · ');
  }catch(error){$('rsSourceName').textContent='—';$('rsSourceDetail').textContent=error.message;}
 }

 /* ===== 1. Real ↔ reciprocal lattice + phasor ===== */
 function renderLattice(){
  const s=structure(),A=s.A,Bs=s.Bstar;
  let h,k,l,dmin;
  try{h=intInput('rsH',-8,8);k=intInput('rsK',-8,8);l=intInput('rsL',-8,8);
   if(!(h||k||l))throw Error('(000) bir düzlem ailesi değildir.');
   dmin=numInput('rsDmin',.4,10,'d_min');}
  catch(error){status('rsLatticeStatus',error.message,true);return;}
  const F=host.structureFactor(h,k,l,s.sites,s.cell,'xray');
  const G=R.gVector([h,k,l],Bs),g=R.norm(G),phase=Math.atan2(F.imag,F.real)*180/Math.PI;
  const totalAmp=s.sites.reduce((sum,site)=>{const c=host.structureFactor(h,k,l,[site],s.cell,'xray');return sum+Math.hypot(c.real,c.imag);},0);
  const extinct=F.intensity<=1e-8*Math.max(1,totalAmp*totalAmp);
  const arg=1.5406*g/2,rp=R.reciprocalCellParameters(A);
  readout($('rsLatticeReadout'),[
   ['Düzlemler arası uzaklık d',fmt(1/g,5)+' Å'],
   ['|G| = 1/d',fmt(g,5)+' Å⁻¹'],
   ['|F(hkl)|',fmt(Math.sqrt(F.intensity),3)+' e'],
   ['Faz φ',extinct?'—':fmt(phase,1)+'°'],
   ['Durum',extinct?'Sistematik sönüm (F = 0)':'İzinli yansıma'],
   ['2θ (Cu Kα1)',arg<1?fmt(2*Math.asin(arg)*180/Math.PI,3)+'°':'erişilemez'],
   ['a*, b*, c*',[rp.a,rp.b,rp.c].map(v=>fmt(v,4)).join(', ')+' Å⁻¹'],
   ['α*, β*, γ*',[rp.alpha,rp.beta,rp.gamma].map(v=>fmt(v,2)).join(', ')+'°'],
   ['V* = 1/V',fmt(rp.volume,6)+' Å⁻³']
  ]);
  status('rsLatticeStatus','');
  drawRealSpace(s,[h,k,l],G);
  try{drawReciprocal(s,[h,k,l],G,dmin);}catch(error){status('rsLatticeStatus',error.message,true);}
  drawPhasor(s,[h,k,l],F,extinct);
 }
 function drawRealSpace(s,hkl,G){
  const v=viewer('rsRealView');v.clear();const A=s.A;
  v.root.add(cellEdges(A));
  const minLen=Math.min(...A.map(R.norm)),r=minLen*.055;
  const sphere=new THREE.SphereGeometry(1,18,12);
  const groups=new Map();
  for(const site of s.sites.slice(0,1200)){
   const f=[site.x,site.y,site.z].map(x=>x-Math.floor(x));
   const p=R.add(R.add(R.scale(A[0],f[0]),R.scale(A[1],f[1])),R.scale(A[2],f[2]));
   if(!groups.has(site.symbol))groups.set(site.symbol,[]);groups.get(site.symbol).push(p);
  }
  for(const [symbol,points] of groups){
   const mesh=new THREE.InstancedMesh(sphere,new THREE.MeshStandardMaterial({color:host.elementColor(symbol),roughness:.4}),points.length);
   const m=new THREE.Matrix4();
   points.forEach((p,i)=>{m.makeScale(r,r,r).setPosition(...p);mesh.setMatrixAt(i,m);});
   v.root.add(mesh);
  }
  const polys=R.planeCellPolygons(hkl,A,16);
  for(const poly of polys){
   const pts=poly.points;
   const geo=new THREE.BufferGeometry(),pos=[];
   for(let i=1;i<pts.length-1;i++)pos.push(...pts[0],...pts[i],...pts[i+1]);
   geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   v.root.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xe2843b,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false})));
   const edge=[];for(let i=0;i<pts.length;i++)edge.push(pts[i],pts[(i+1)%pts.length]);
   v.root.add(lineSegments(edge,0xc4621c,.9));
  }
  const center=R.scale(R.add(R.add(A[0],A[1]),A[2]),.5),diag=R.norm(R.add(R.add(A[0],A[1]),A[2]));
  const middle=polys[Math.floor(polys.length/2)];
  const mid=middle?R.scale(middle.points.reduce((sum,p)=>R.add(sum,p),[0,0,0]),1/middle.points.length):center;
  const n=R.scale(G,1/R.norm(G)),tip=R.add(mid,R.scale(n,diag*.38));
  const ar=arrow(mid,tip,0xc4621c,.07);if(ar)v.root.add(ar);
  const lab=labelSprite('G'+hklText(...hkl),'#a24c12',diag*.07);lab.position.set(...R.add(tip,R.scale(n,diag*.05)));v.root.add(lab);
  v.fit(diag*.62,center);
 }
 function drawReciprocal(s,hkl,G,dmin){
  const v=viewer('rsRecipView');v.clear();
  const gMax=1/dmin,pts=R.reciprocalPoints(s.A,gMax,{limit:5000});
  if(pts.length*s.sites.length>4e6)throw Error('Karşı örgü için hesap bütçesi aşıldı; d_min değerini büyütün.');
  const I=pts.map(p=>host.structureFactor(p.h,p.k,p.l,s.sites,s.cell,'xray').intensity);
  const Imax=Math.max(...I,1e-30),weighted=$('rsWeighted').checked,base=gMax*.022;
  const sphere=new THREE.SphereGeometry(1,14,10),m=new THREE.Matrix4();
  const allowed=[],forbidden=[];
  pts.forEach((p,i)=>(I[i]>1e-8*Imax?allowed:forbidden).push(i));
  const mk=(list,color,size)=>{
   if(!list.length)return;
   const mesh=new THREE.InstancedMesh(sphere,new THREE.MeshStandardMaterial({color,roughness:.45}),list.length);
   list.forEach((idx,j)=>{const r=size(idx);m.makeScale(r,r,r).setPosition(...pts[idx].G);mesh.setMatrixAt(j,m);});
   v.root.add(mesh);
  };
  mk(allowed,0x2f74b5,idx=>weighted?base*(.35+1.65*Math.sqrt(I[idx]/Imax)):base);
  mk(forbidden,0xb9c4d0,()=>base*.28);
  const origin=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({color:0x1a2433}));origin.scale.setScalar(base*1.2);v.root.add(origin);
  const axisColors=[0xd94b5c,0x2e9e62,0x3b6fd8];
  s.Bstar.forEach((b,i)=>{
   const ar=arrow([0,0,0],b,axisColors[i],.09);if(ar)v.root.add(ar);
   const lab=labelSprite(['a*','b*','c*'][i],['#c23447','#24804f','#2f5cbf'][i],gMax*.13);
   lab.position.set(...R.scale(b,1.12));v.root.add(lab);
  });
  const sel=arrow([0,0,0],G,0xe2843b,.06);if(sel)v.root.add(sel);
  const hi=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({color:0xe2843b,emissive:0x5a2a08}));
  hi.scale.setScalar(base*1.6);hi.position.set(...G);v.root.add(hi);
  const lab=labelSprite(hklText(...hkl),'#a24c12',gMax*.13);lab.position.set(...R.scale(G,1.1));v.root.add(lab);
  v.fit(Math.max(gMax,R.norm(G))*.95);
 }
 function drawPhasor(s,hkl,F,extinct){
  const svgEl=$('rsPhasor');svgEl.replaceChildren();
  let terms=s.sites.map((site,i)=>{const c=host.structureFactor(...hkl,[site],s.cell,'xray');
   return {label:site.label||site.symbol+(i+1),symbol:site.symbol,x:site.x,y:site.y,z:site.z,re:c.real,im:c.imag,group:site.sourceSiteIndex??i,count:1};});
  let grouped=false;
  if(terms.length>48){
   grouped=true;const map=new Map();
   for(const t of terms){const g=map.get(t.group);
    if(g){g.re+=t.re;g.im+=t.im;g.count++;}else map.set(t.group,{...t});}
   terms=[...map.values()];
  }
  const path=[[0,0]];for(const t of terms)path.push([path.at(-1)[0]+t.re,path.at(-1)[1]+t.im]);
  const xs=path.map(p=>p[0]),ys=path.map(p=>p[1]);
  const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),1e-9);
  const W=520,H=380,pad=40,sc=Math.min((W-2*pad)/span,(H-2*pad)/span);
  const cx=(W-sc*(Math.max(...xs)+Math.min(...xs)))/2,cy=(H+sc*(Math.max(...ys)+Math.min(...ys)))/2;
  const X=x=>cx+x*sc,Y=y=>cy-y*sc;
  const axes=svg('g',{stroke:'#c9d4e1','stroke-width':1});
  axes.append(svg('line',{x1:0,y1:Y(0),x2:W,y2:Y(0)}),svg('line',{x1:X(0),y1:0,x2:X(0),y2:H}));
  svgEl.append(axes,svg('text',{x:W-34,y:Y(0)-6,fill:'#7a8ca1','font-size':12},'Re'),svg('text',{x:X(0)+6,y:14,fill:'#7a8ca1','font-size':12},'Im'));
  const g=svg('g');svgEl.append(g);
  terms.forEach((t,i)=>{const [x1,y1]=path[i],[x2,y2]=path[i+1];
   svgArrow(g,X(x1),Y(y1),X(x2),Y(y2),host.elementColor(t.symbol),2.2,9);});
  const end=path.at(-1);
  if(!extinct)svgArrow(g,X(0),Y(0),X(end[0]),Y(end[1]),'#1b2a3d',3.4,12);
  g.append(svg('circle',{cx:X(0),cy:Y(0),r:4,fill:'#1b2a3d'}));
  svgEl.append(svg('rect',{x:6,y:H-34,width:250,height:26,rx:6,fill:'rgba(255,255,255,.88)'}));
  svgEl.append(svg('text',{x:12,y:H-15,fill:'#1b2a3d','font-size':14,'font-weight':650},'F'+hklText(...hkl)+' = '+fmt(F.real,2)+(F.imag<0?' − ':' + ')+fmt(Math.abs(F.imag),2)+'i'));
  if(extinct)svgEl.append(svg('text',{x:12,y:H-42,fill:'#b0461d','font-size':13},'Kapalı çokgen: yansıma söner'));
  if(grouped)svgEl.append(svg('text',{x:W-8,y:16,fill:'#6d8197','font-size':11,'text-anchor':'end'},'Oklar asimetrik siteye göre gruplandı'));
  table($('rsPhasorTable'),['Atom','x','y','z','Faz (°)','|f·T|'],
   terms.slice(0,60).map(t=>[(grouped?t.label+' ×'+t.count:t.label),fmt(t.x,3),fmt(t.y,3),fmt(t.z,3),
    fmt(((Math.atan2(t.im,t.re)*180/Math.PI)+360)%360,1),fmt(Math.hypot(t.re,t.im),3)]));
 }

 /* ===== 2. Ewald construction + powder ===== */
 function ewaldInputs(){
  const lambda=numInput('rsLambda',.2,5,'λ');
  const uvw=[intInput('rsEwU',-6,6),intInput('rsEwV',-6,6),intInput('rsEwW',-6,6)];
  if(!uvw.some(Boolean))throw Error('[000] bir bölge ekseni değildir.');
  return {lambda,uvw,omega:Number($('rsOmega').value),mode:$('rsEwaldMode').value,tol:numInput('rsTol',.0005,.05,'Tolerans')};
 }
 function renderEwald(){
  const s=structure();let inp;
  try{inp=ewaldInputs();}catch(error){status('rsEwaldStatus',error.message,true);return;}
  $('rsOmegaOut').textContent=fmt(inp.omega,1)+'°';
  const Rr=1/inp.lambda,gLimit=2*Rr;
  let powder=null;
  try{powder=host.powderPattern(s.cell,s.sites,{wavelength:inp.lambda,maxAngle:150,scattering:'xray',lorentzPolarization:true});}
  catch(error){status('rsEwaldStatus',error.message,true);}
  const out=$('rsEwaldSvg');out.replaceChildren();
  const W=600,mid=W/2,sc=(W/2-26)/(gLimit*1.04);
  const X=x=>mid+x*sc,Y=y=>mid-y*sc;
  // Rotating the crystal by +ω is drawn as the beam rotating by −ω in the
  // fixed reciprocal-lattice frame (the two are physically equivalent).
  const beamAngle=-inp.omega,C=R.ewaldSection([],inp.lambda,beamAngle).center;
  out.append(svg('circle',{cx:mid,cy:mid,r:gLimit*sc,fill:'none',stroke:'#b9c6d4','stroke-dasharray':'5 5'}));
  out.append(svg('circle',{cx:X(C[0]),cy:Y(C[1]),r:Rr*sc,fill:'rgba(64,140,210,.05)',stroke:'#3b82c4','stroke-width':1.6}));
  const beams=svg('g');out.append(beams);
  svgArrow(beams,X(C[0]),Y(C[1]),X(0),Y(0),'#3b82c4',2.2,11);
  out.append(svg('text',{x:X(C[0]/2)+6,y:Y(C[1]/2)-8,fill:'#2f6eaa','font-size':13},'k₀'));
  const listRows=[];
  if(inp.mode==='powder'){
   if(powder){
    const groups=powder.groups.filter(gr=>1/gr.d<=gLimit);
    const top=Math.max(...groups.map(gr=>gr.relative),1);
    for(const gr of groups){
     const gg=1/gr.d,alpha=.18+.72*Math.sqrt(gr.relative/top);
     out.append(svg('circle',{cx:mid,cy:mid,r:gg*sc,fill:'none',stroke:`rgba(226,132,59,${alpha.toFixed(3)})`,'stroke-width':1+2*gr.relative/top}));
     for(const P of R.powderShellIntersections(inp.lambda,beamAngle,gg)){
      beams.append(svg('line',{x1:X(C[0]),y1:Y(C[1]),x2:X(P[0]),y2:Y(P[1]),stroke:`rgba(196,98,28,${alpha.toFixed(3)})`,'stroke-width':1.2}));
      out.append(svg('circle',{cx:X(P[0]),cy:Y(P[1]),r:3,fill:'#c4621c'}));
     }
     listRows.push([familyLabel(gr.hkl,s.cell),fmt(gr.d,4),fmt(gr.angle,3),fmt(gr.relative,1)]);
    }
   }
   table($('rsEwaldList'),['hkl','d (Å)','2θ (°)','I (%)'],listRows.slice(0,40));
   status('rsEwaldStatus',listRows.length+' halka · ω yalnız kesiti döndürür; toz deseni yönelimden bağımsızdır.');
  }else{
   let zone;
   try{zone=R.zoneAxisReflections(s.A,inp.uvw,gLimit,{limit:6000});}
   catch(error){status('rsEwaldStatus',error.message,true);return;}
   if(zone.points.length*s.sites.length>4e6){status('rsEwaldStatus','Hesap bütçesi aşıldı; daha uzun dalgaboyu seçin.',true);return;}
   const I=zone.points.map(p=>host.structureFactor(p.h,p.k,p.l,s.sites,s.cell,'xray').intensity);
   const Imax=Math.max(...I,1e-30);
   ewaldAllowed={lambda:inp.lambda,points:zone.points.filter((p,i)=>I[i]>1e-8*Imax)};
   // First visit: rotate to the nearest Bragg position so the construction is never empty.
   if(!ewaldAligned){ewaldAligned=true;
    const touching=ewaldAllowed.points.some(p=>Math.abs(Math.hypot(p.x-C[0],p.y-C[1])-Rr)<=inp.tol);
    const next=touching?null:R.nextBraggRotation(ewaldAllowed.points,inp.lambda,inp.omega);
    if(next){$('rsOmega').value=String(next.omega);return renderEwald();}
   }
   const sect=R.ewaldSection(zone.points,inp.lambda,beamAngle,inp.tol),Cc=sect.center;
   const dots=svg('g');out.append(dots);
   sect.points.forEach((p,i)=>{
    const rel=I[i]/Imax,forbidden=rel<=1e-8;
    const r=forbidden?1.6:1.8+5.2*Math.sqrt(rel);
    dots.append(svg('circle',{cx:X(p.x),cy:Y(p.y),r,fill:p.onSphere&&!forbidden?'#e2843b':forbidden?'none':'#2f74b5',
     stroke:forbidden?'#b9c4d0':'none','stroke-width':1}));
    if(p.onSphere&&!forbidden){
     beams.append(svg('line',{x1:X(Cc[0]),y1:Y(Cc[1]),x2:X(p.x),y2:Y(p.y),stroke:'#c4621c','stroke-width':1.5}));
     dots.append(svg('text',{x:X(p.x)+7,y:Y(p.y)-6,fill:'#a24c12','font-size':12},hklText(p.h,p.k,p.l)));
     listRows.push([hklText(p.h,p.k,p.l),fmt(1/p.g,4),fmt(p.twoTheta,3),fmt(100*rel,1)]);
    }
   });
   dots.append(svg('circle',{cx:mid,cy:mid,r:4,fill:'#1b2a3d'}));
   table($('rsEwaldList'),['hkl','d (Å)','2θ (°)','|F|² (%)'],listRows);
   status('rsEwaldStatus',listRows.length?listRows.length+' yansıma küre üzerinde.':'Bu yönelimde küreye değen izinli yansıma yok; ω değerini değiştirin.');
  }
  drawRings(powder,inp.lambda,s.cell);
 }
 function drawRings(powder,lambda,cell){
  const rings=$('rsRingsSvg'),stick=$('rsStickSvg');rings.replaceChildren();stick.replaceChildren();
  if(!powder)return;
  const D=100,maxTwoTheta=70,W=400,mid=W/2,scale=(W/2-10)/(D*Math.tan(maxTwoTheta*Math.PI/180));
  rings.append(svg('rect',{x:0,y:0,width:W,height:W,fill:'#0c1426'}));
  const top=Math.max(...powder.groups.map(g=>g.relative),1);
  const labelled=powder.groups.filter(g=>g.angle<=maxTwoTheta).sort((a,b)=>b.relative-a.relative).slice(0,6);
  for(const g of powder.groups){
   if(g.angle>maxTwoTheta)continue;
   const r=D*Math.tan(g.angle*Math.PI/180)*scale,rel=g.relative/top;
   rings.append(svg('circle',{cx:mid,cy:mid,r,fill:'none',stroke:`rgba(255,240,214,${(.2+.8*Math.sqrt(rel)).toFixed(3)})`,'stroke-width':.8+3.2*rel}));
  }
  // Labels sit just above the top of each ring, so they never leave the detector.
  labelled.forEach(g=>{const r=D*Math.tan(g.angle*Math.PI/180)*scale;
   rings.append(svg('text',{x:mid,y:mid-r-5,fill:'#ffd79a','font-size':11,'text-anchor':'middle'},familyLabel(g.hkl,cell)));});
  rings.append(svg('circle',{cx:mid,cy:mid,r:6,fill:'#000',stroke:'#4a5c74'}));
  rings.append(svg('text',{x:10,y:W-10,fill:'#8fa4bf','font-size':11},'D = 100 mm · 2θ ≤ 70°'));
  const SW=640,SH=260,l=44,r=14,t=14,b=34,max2t=Math.min(150,Math.max(...powder.groups.map(g=>g.angle),40)+5);
  const X=a=>l+a/max2t*(SW-l-r),Y=v=>SH-b-v/100*(SH-t-b);
  stick.append(svg('line',{x1:l,y1:SH-b,x2:SW-r,y2:SH-b,stroke:'#8193a8'}),svg('line',{x1:l,y1:t,x2:l,y2:SH-b,stroke:'#8193a8'}));
  for(let a=0;a<=max2t;a+=Math.max(10,Math.round(max2t/60)*10)){
   stick.append(svg('line',{x1:X(a),y1:SH-b,x2:X(a),y2:SH-b+4,stroke:'#8193a8'}),svg('text',{x:X(a)-8,y:SH-b+17,fill:'#6d8197','font-size':10},String(a)));
  }
  stick.append(svg('text',{x:SW/2-16,y:SH-4,fill:'#6d8197','font-size':11},'2θ (°)'),svg('text',{x:4,y:t+8,fill:'#6d8197','font-size':10},'100%'));
  for(const g of powder.groups){
   const rel=100*g.relative/top;
   stick.append(svg('line',{x1:X(g.angle),y1:SH-b,x2:X(g.angle),y2:Y(rel),stroke:'#2b74af','stroke-width':1.6}));
   if(rel>15)stick.append(svg('text',{x:X(g.angle)-12,y:Y(rel)-4,fill:'#345b80','font-size':9},familyLabel(g.hkl,cell)));
  }
  stick.append(svg('text',{x:SW-r-120,y:t+10,fill:'#6d8197','font-size':10},'λ = '+fmt(lambda,4)+' Å'));
 }

 /* ===== 3. Zone-axis (SAED) pattern ===== */
 function renderZone(){
  const s=structure();let uvw,kV,tNm,dmin;
  try{uvw=[intInput('rsZoneU',-9,9),intInput('rsZoneV',-9,9),intInput('rsZoneW',-9,9)];
   if(!uvw.some(Boolean))throw Error('[000] bir bölge ekseni değildir.');
   kV=numInput('rsKv',20,1000,'Gerilim');tNm=numInput('rsThickness',1,1000,'Kalınlık');dmin=numInput('rsZoneDmin',.3,5,'d_min');}
  catch(error){status('rsZoneStatus',error.message,true);return;}
  const electron=$('rsZoneRadiation').value==='electron';
  $('rsKv').disabled=!electron;$('rsThickness').disabled=!electron;
  let zone;
  try{zone=R.zoneAxisReflections(s.A,uvw,1/dmin,{limit:3000});}
  catch(error){status('rsZoneStatus',error.message,true);$('rsZoneSvg').replaceChildren();return;}
  if(zone.points.length*s.sites.length>4e6){status('rsZoneStatus','Hesap bütçesi aşıldı; d_min değerini büyütün.',true);return;}
  const lambda=R.electronWavelength(kV),gamma=R.relativisticGamma(kV),k0=R.scale(zone.normal,1/lambda);
  const Ucache=new Map();
  const U=site=>{const key=site;if(!Ucache.has(key))Ucache.set(key,host.isotropicU(site,s.cell));return Ucache.get(key);};
  const amp=(site,sv)=>{
   const d=1/(2*sv),fx=host.scatteringFactor(site.symbol,d,'xray'),occ=Number(site.occupancy??1);
   const dw=Math.exp(-8*Math.PI*Math.PI*U(site)*sv*sv);
   return occ*dw*(electron?R.mottBethe(host.atomicNumber(site.symbol),fx,sv,gamma):fx);
  };
  const spots=zone.points.map(p=>{
   const F=R.kinematicF(s.sites,[p.h,p.k,p.l],s.Bstar,amp);
   const sg=R.excitationError(k0,p.G),shape=electron?R.shapeFactor(sg,tNm*10):1;
   return {...p,F2:F.intensity,I:F.intensity*shape,sg};
  });
  const Imax=Math.max(...spots.map(p=>p.I),1e-30),F2max=Math.max(...spots.map(p=>p.F2),1e-30);
  const out=$('rsZoneSvg');out.replaceChildren();
  const W=600,mid=W/2,sc=(W/2-30)/(1/dmin);
  const X=x=>mid+x*sc,Y=y=>mid-y*sc;
  out.append(svg('rect',{x:0,y:0,width:W,height:W,fill:'#070d18'}));
  const labels=$('rsZoneLabels').checked,showForbidden=$('rsZoneForbidden').checked;
  let shown=0,forbiddenCount=0,labelCount=0;
  const sorted=spots.slice().sort((a,b)=>a.I-b.I);
  for(const p of sorted){
   const forbidden=p.F2<=1e-8*F2max;
   if(forbidden){forbiddenCount++;
    if(showForbidden)out.append(svg('circle',{cx:X(p.x),cy:Y(p.y),r:3.2,fill:'none',stroke:'rgba(255,170,120,.55)','stroke-width':1,'stroke-dasharray':'2 2'}));
    continue;}
   const rel=p.I/Imax,r=1.6+7.5*Math.pow(rel,.35);
   out.append(svg('circle',{cx:X(p.x),cy:Y(p.y),r,fill:`rgba(255,255,255,${(.25+.75*Math.pow(rel,.3)).toFixed(3)})`}));
   shown++;
  }
  out.append(svg('circle',{cx:mid,cy:mid,r:10,fill:'#fff'}));
  if(labels){
   const strong=spots.filter(p=>p.F2>1e-8*F2max).sort((a,b)=>a.g-b.g).slice(0,36);
   for(const p of strong){out.append(svg('text',{x:X(p.x)+6,y:Y(p.y)-6,fill:'#8fd3ff','font-size':10.5},hklText(p.h,p.k,p.l)));labelCount++;}
  }
  const bar=.5*sc;
  out.append(svg('line',{x1:W-30-bar,y1:W-24,x2:W-30,y2:W-24,stroke:'#fff','stroke-width':3}),
   svg('text',{x:W-30-bar,y:W-32,fill:'#d6e3f3','font-size':11},'0.5 Å⁻¹ = 5 nm⁻¹'),
   svg('text',{x:14,y:24,fill:'#d6e3f3','font-size':13,'font-weight':650},'['+uvw.join(' ')+']'),
   svg('text',{x:14,y:W-14,fill:'#8fa4bf','font-size':11},electron?'λ = '+fmt(lambda,5)+' Å · '+kV+' kV · t = '+tNm+' nm':'X-ışını · sıfırıncı Laue bölgesi'));
  readout($('rsZoneReadout'),[
   ['Elektron dalgaboyu λ',electron?fmt(lambda,5)+' Å':'—'],
   ['Ewald yarıçapı 1/λ',electron?fmt(1/lambda,1)+' Å⁻¹':'—'],
   ['Görünen yansıma',String(shown)],
   ['Kinematik sönük konum',String(forbiddenCount)],
   ['En büyük |s|',electron?fmt(Math.max(...spots.map(p=>Math.abs(p.sg))),4)+' Å⁻¹':'—']
  ]);
  status('rsZoneStatus',zone.points.length+' yansıma sıfırıncı Laue bölgesinde · kinematik model.');
 }

 /* ===== 4. Brillouin zone + empty-lattice bands ===== */
 let bzCache=null;
 function renderBz(){
  const s=structure();
  if(!bzCache||bzCache.key!==s){
   try{bzCache={key:s,data:R.brillouinAnalysis(s.cell,s.sites)};}
   catch(error){status('rsBzStatus',error.message,true);return;}
  }
  const r=bzCache.data,z=r.zone;
  readout($('rsBzReadout'),[
   ['Bravais örgüsü',r.type?BRAVAIS_NAMES[r.type]:'Standart olmayan / tanımlanamadı'],
   ['Hücre başına örgü noktası',String(r.primitive.latticePoints)],
   ['Primitive hücre hacmi',fmt(r.primitive.volume,4)+' Å³'],
   ['Brillouin bölgesi hacmi',fmt(z.volume,5)+' Å⁻³'],
   ['(2π)³ / V_prim',fmt(r.zoneVolumeExpected,5)+' Å⁻³'],
   ['Yüz · köşe sayısı',z.faces.length+' · '+z.vertices.length],
   ['Yüksek simetri yolu',r.path?r.path.path.map(seg=>seg.join('–')).join(' | '):'—']
  ]);
  if(r.path)table($('rsBzPoints'),['Nokta','Kesirli (2π/a, b*, c*)','|k| (Å⁻¹)'],
   Object.entries(r.path.points).map(([label,k])=>[label,r.path.fractional[label].map(v=>fmt(v,3)).join(', '),fmt(R.norm(k),4)]));
  else $('rsBzPoints').replaceChildren();
  status('rsBzStatus',r.path?'Etiketler Setyawan–Curtarolo (2010) kuralına göre, a, b, c eksenlerinize göre yönlendirilmiştir.':
   r.type?'Bu örgü türü için standart yol henüz eklenmedi; bölge doğru çizilir.':
   'Hücre standart konvansiyonel değil; bölge doğru çizilir ancak yol etiketlenmez. Örgü dönüşümü panelinden konvansiyonel hücreye geçebilirsiniz.',!r.path&&!r.type);
  const v=viewer('rsBzView');v.clear();
  const verts=z.vertices.map(p=>new THREE.Vector3(...p));
  v.root.add(new THREE.Mesh(new ConvexGeometry(verts),new THREE.MeshStandardMaterial({color:0x6aa7dc,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide})));
  const edges=[];for(const f of z.faces)for(let i=0;i<f.vertices.length;i++)edges.push(f.vertices[i],f.vertices[(i+1)%f.vertices.length]);
  v.root.add(lineSegments(edges,0x2b5f91,.85));
  const size=Math.max(...z.vertices.map(R.norm));
  r.reciprocalPrimitive.forEach((b,i)=>{
   const ar=arrow([0,0,0],b,[0xd94b5c,0x2e9e62,0x3b6fd8][i],.06);if(ar)v.root.add(ar);
   const lab=labelSprite('b'+(i+1),['#c23447','#24804f','#2f5cbf'][i],size*.12);lab.position.set(...R.scale(b,1.08));v.root.add(lab);
  });
  const dot=new THREE.SphereGeometry(size*.022,14,10);
  const gamma=new THREE.Mesh(dot,new THREE.MeshStandardMaterial({color:0x1b2a3d}));v.root.add(gamma);
  if(r.path){
   const pathPts=[];for(const seg of r.path.path)for(let i=0;i<seg.length-1;i++)pathPts.push(r.path.points[seg[i]],r.path.points[seg[i+1]]);
   v.root.add(lineSegments(pathPts,0xd8661d,1));
   for(const [label,k] of Object.entries(r.path.points)){
    const m=new THREE.Mesh(dot,new THREE.MeshStandardMaterial({color:0xd8661d}));m.position.set(...k);v.root.add(m);
    const lab=labelSprite(label,'#9c3f0b',size*.13);lab.position.set(...R.add(k,R.scale(R.norm(k)>1e-9?R.scale(k,1/R.norm(k)):[0,0,1],size*.12)));v.root.add(lab);
   }
  }
  // Frame the zone together with the full primitive reciprocal vectors b1–b3.
  v.fit(Math.max(size,...r.reciprocalPrimitive.map(R.norm))*1.08);
  drawBands(r);
 }
 function drawBands(r){
  const out=$('rsBandSvg');out.replaceChildren();
  if(!r.path){out.append(svg('text',{x:20,y:40,fill:'#6d8197','font-size':13},'Bant diyagramı için standart yüksek simetri yolu gerekir.'));return;}
  let nBands,mass;
  try{nBands=intInput('rsBands',2,24);mass=numInput('rsMass',.05,10,'Etkin kütle');}
  catch(error){status('rsBzStatus',error.message,true);return;}
  const sampled=R.sampleKPath(r.path,{density:80,maxSamples:900});
  const E=R.emptyLatticeBands(sampled.samples,r.reciprocalPrimitive,{nBands,mass,range:3});
  const Emax=Math.max(...E.map(row=>row[row.length-1]))*1.03;
  const W=760,H=360,l=56,rr=14,t=14,b=34;
  const X=x=>l+x/sampled.length*(W-l-rr),Y=e=>H-b-e/Emax*(H-t-b);
  out.append(svg('line',{x1:l,y1:H-b,x2:W-rr,y2:H-b,stroke:'#8193a8'}),svg('line',{x1:l,y1:t,x2:l,y2:H-b,stroke:'#8193a8'}));
  const step=Emax>40?10:Emax>16?5:Emax>6?2:1;
  for(let e=0;e<=Emax;e+=step)out.append(svg('line',{x1:l-4,y1:Y(e),x2:l,y2:Y(e),stroke:'#8193a8'}),svg('text',{x:l-8,y:Y(e)+4,fill:'#6d8197','font-size':10,'text-anchor':'end'},String(e)));
  out.append(svg('text',{x:14,y:H/2,fill:'#6d8197','font-size':11,transform:`rotate(-90 14 ${H/2})`,'text-anchor':'middle'},'E (eV)'));
  for(const tick of sampled.ticks){
   out.append(svg('line',{x1:X(tick.x),y1:t,x2:X(tick.x),y2:H-b,stroke:'#d5dee8'}),
    svg('text',{x:X(tick.x),y:H-b+18,fill:'#2c425b','font-size':12,'text-anchor':'middle'},tick.label));
  }
  const palette=['#1f6fb5','#d0612a','#2e9e62','#8a55c4','#c23447','#2b9aa3','#b28a14','#5b6f86'];
  for(let n=0;n<nBands;n++){
   let d='',prevSeg=-1;
   sampled.samples.forEach((p,i)=>{d+=(p.segment!==prevSeg?' M':' L')+X(p.x).toFixed(1)+' '+Y(E[i][n]).toFixed(1);prevSeg=p.segment;});
   out.append(svg('path',{d,fill:'none',stroke:palette[n%palette.length],'stroke-width':1.6,opacity:.9}));
  }
 }

 function renderActive(){
  if(!visible||!dirty.has(activeTab))return;
  dirty.delete(activeTab);
  sourceBanner();
  try{
   if(activeTab==='lattice')renderLattice();
   else if(activeTab==='ewald')renderEwald();
   else if(activeTab==='zone')renderZone();
   else renderBz();
  }catch(error){
   const id={lattice:'rsLatticeStatus',ewald:'rsEwaldStatus',zone:'rsZoneStatus',bz:'rsBzStatus'}[activeTab];
   status(id,error.message,true);console.warn('Karşı uzay:',error);
  }
 }
 function setTab(tab){
  if(!TABS.includes(tab))return;
  activeTab=tab;
  for(const button of document.querySelectorAll('[data-rs-tab]')){
   const on=button.dataset.rsTab===tab;
   button.classList.toggle('selected',on);button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;
  }
  const panes={lattice:'rsPaneLattice',ewald:'rsPaneEwald',zone:'rsPaneZone',bz:'rsPaneBz'};
  for(const [name,id] of Object.entries(panes))$(id).hidden=name!==tab;
  renderActive();
  requestAnimationFrame(()=>Object.values(viewers).forEach(v=>v.resize()));
 }
 const rerender=tab=>()=>{dirty.add(tab);if(activeTab===tab)renderActive();};
 for(const button of document.querySelectorAll('[data-rs-tab]'))button.addEventListener('click',()=>setTab(button.dataset.rsTab));
 $('rsPaneLattice').parentElement.querySelector('[role=tablist]').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const next=TABS[(TABS.indexOf(activeTab)+(event.key==='ArrowRight'?1:TABS.length-1))%TABS.length];
  setTab(next);document.querySelector(`[data-rs-tab="${next}"]`)?.focus();
 });
 for(const id of ['rsH','rsK','rsL','rsDmin','rsWeighted'])$(id).addEventListener('change',rerender('lattice'));
 for(const id of ['rsLambda','rsEwU','rsEwV','rsEwW','rsEwaldMode','rsTol'])$(id).addEventListener('change',rerender('ewald'));
 $('rsOmega').addEventListener('input',rerender('ewald'));
 $('rsNextBragg').addEventListener('click',()=>{
  if($('rsEwaldMode').value!=='single'){$('rsEwaldMode').value='single';}
  if(!ewaldAllowed){rerender('ewald')();if(!ewaldAllowed)return;}
  const next=R.nextBraggRotation(ewaldAllowed.points,ewaldAllowed.lambda,Number($('rsOmega').value));
  if(!next){status('rsEwaldStatus','Bu dalgaboyunda erişilebilir izinli yansıma yok.',true);return;}
  $('rsOmega').value=String(next.omega);rerender('ewald')();
 });
 $('rsSource').addEventListener('change',()=>{
  const v=$('rsSource').value;if(v!=='custom')$('rsLambda').value=v;rerender('ewald')();
 });
 $('rsLambda').addEventListener('input',()=>{$('rsSource').value=[...$('rsSource').options].some(o=>o.value===$('rsLambda').value)?$('rsLambda').value:'custom';});
 for(const id of ['rsZoneU','rsZoneV','rsZoneW','rsZoneRadiation','rsKv','rsThickness','rsZoneDmin','rsZoneLabels','rsZoneForbidden'])$(id).addEventListener('change',rerender('zone'));
 for(const id of ['rsBands','rsMass'])$(id).addEventListener('change',rerender('bz'));

 return {
  get visible(){return visible;},
  setVisible(on){
   visible=!!on;
   if(visible){cache=null;bzCache=null;ewaldAllowed=null;TABS.forEach(t=>dirty.add(t));setTab(activeTab);}
  },
  refresh(){cache=null;bzCache=null;ewaldAllowed=null;TABS.forEach(t=>dirty.add(t));if(visible)renderActive();}
 };
}
