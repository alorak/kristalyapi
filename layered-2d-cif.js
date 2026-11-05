/* CPU-only 2D drawing of the active, symmetry-expanded P1 crystal.
 * Layer detection is geometric, not a crystallographic phase/cleavage proof.
 * Never silently classify a dense 3D structure as a monolayer.
 */
const TAU=Math.PI*2,rad=d=>d*Math.PI/180;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const fmt=n=>Number(n.toFixed(3));
const vec=(a,b,c)=>[a,b,c],plus=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/norm(a)),mod1=a=>((a%1)+1)%1;
const PALETTE=['#d58e9d','#198a63','#4b80c5','#e6a141','#876db1','#168cab','#a68561','#b8698e'];
const RADIUS={H:.31,B:.85,C:.76,N:.71,O:.66,F:.57,Si:1.11,P:1.07,S:1.05,Cl:1.02,Se:1.20,Te:1.38,Mo:1.54,W:1.62,Fe:1.32,Ni:1.24,Co:1.26,Zn:1.22,Ti:1.36,Al:1.21,Ga:1.22,As:1.19,Cu:1.32};
function checkInt(x,min,max,name){const n=Number(x);if(!Number.isInteger(n)||n<min||n>max)throw Error(name+' '+min+'–'+max+' arasında olmalı.');return n;}
function cellBasis(cell){
 const {a,b,c,alpha,beta,gamma}=cell||{};
 if([a,b,c,alpha,beta,gamma].some(v=>!Number.isFinite(Number(v))))throw Error('Geçerli hücre parametreleri bulunamadı.');
 const [A,B,C]=[a,b,c].map(Number);
 const [al,be,ga]=[alpha,beta,gamma].map(x=>rad(Number(x)));
 if([A,B,C].some(x=>x<=0||x>1000)||[al,be,ga].some(x=>x<.01||x>Math.PI-.01))throw Error('Hücre uzunluğu/açısı geçersiz.');
 const ca=Math.cos(al),cb=Math.cos(be),cg=Math.cos(ga),sg=Math.sin(ga);
 const cz2=1-cb*cb-((ca-cb*cg)/sg)**2;
 if(cz2<=1e-9)throw Error('Tekil veya geçersiz kristal örgüsü.');
 return [[A,0,0],[B*cg,B*sg,0],[C*cb,C*(ca-cb*cg)/sg,C*Math.sqrt(cz2)]];
}
function context(structure,axis){
 const lattice=cellBasis(structure.cell);
 const order={a:[1,2,0],b:[2,0,1],c:[0,1,2]}[axis];
 if(!order)throw Error('Tabaka normali a, b veya c olmalıdır.');
 const [ai,bi,ni]=order;
 const u=unit(lattice[ai]),n=unit(cross(lattice[ai],lattice[bi])),v=cross(n,u);
 const height=dot(lattice[ni],n);
 if(!Number.isFinite(height)||height<=.01)throw Error('Tabaka normalinin periyodu geçersiz.');
 const xy=f=>lattice.reduce((p,V,i)=>plus(p,mul(V,f[i])),[0,0,0]);
 return {lattice,ai,bi,ni,axis,u,v,n,height,xy};
}
function normalizeSites(structure,ctx){
 if(!Array.isArray(structure.sites)||structure.sites.length===0||structure.sites.length>1200)throw Error('1–1200 atomlu açık P1 yapı gerekli.');
 return structure.sites.map((s,i)=>{
  const f=[Number(s.x),Number(s.y),Number(s.z)];
  if(f.some(x=>!Number.isFinite(x)||Math.abs(x)>100))throw Error('Atom konumu geçersiz: '+(i+1));
  const element=String(s.symbol||'').trim();
  if(!/^[A-Z][a-z]?$/.test(element))throw Error('Atom sembolü geçersiz: '+(i+1));
  if(s.occupancy!==undefined&&Math.abs(Number(s.occupancy)-1)>1e-5)
   throw Error('Kısmi doluluklu atomlar P0 2B figürde desteklenmiyor.');
  f[ctx.ni]=mod1(f[ctx.ni]);
  return {id:i,element,f,h:f[ctx.ni]*ctx.height};
 });
}
/** Find periodic gaps in the direction normal to a chosen lattice plane.
 * Each gap >= threshold separates candidate layers. A single wide vacuum
 * produces one complete candidate; two gaps produce two separate layers.
 * This does NOT establish whether interlayer bonds are absent.
 */
export function analyzeCifLayers(structure,{axis='c',minGap=2.2}={}){
 if(!Number.isFinite(Number(minGap))||minGap<.5||minGap>15)throw Error('Boşluk eşiği 0,5–15 Å olmalıdır.');
 const ctx=context(structure,axis),sites=normalizeSites(structure,ctx);
 const sorted=[...sites].sort((a,b)=>a.h-b.h);
 const gaps=sorted.map((atom,i)=>i===sorted.length-1?sorted[0].h+ctx.height-atom.h:sorted[i+1].h-atom.h);
 const boundaries=gaps.map((gap,i)=>({gap,i})).filter(x=>x.gap>=minGap);
 if(!boundaries.length)throw Error('Bu doğrultuda '+Number(minGap).toFixed(2)+' Å veya daha geniş ayırıcı boşluk bulunamadı. Normal yönünü ya da eşiği değiştirin; bulk yapıdan otomatik tek katman çıkarılmaz.');
 const cuts=new Set(boundaries.map(x=>x.i)),groups=[],start=(boundaries[0].i+1)%sorted.length;
 let group=[],position=start;
 do{
  group.push(sorted[position]);
  if(cuts.has(position)){groups.push(group);group=[];}
  position=(position+1)%sorted.length;
 }while(position!==start);
 if(group.length)groups.push(group);
 const layerGroups=groups.map((group,index)=>{
  const beginning=group[0].h;
  const unwrapped=group.map(site=>{
   const shift=site.h+1e-8<beginning?1:0;
   const f=[...site.f];f[ctx.ni]+=shift;
   return {...site,f,h:site.h+shift*ctx.height};
  });
  return {index,sites:unwrapped,atomCount:unwrapped.length,thickness:Math.max(...unwrapped.map(s=>s.h))-Math.min(...unwrapped.map(s=>s.h))};
 });
 return {axis,height:ctx.height,groups:layerGroups,
  gaps:boundaries.map(g=>fmt(g.gap)).sort((a,b)=>b-a),context:ctx};
}
function figureAtoms(data,na,nb){
 const {context:ctx}=data,selected=data.group,atoms=[],maxCount=2500;
 if(selected.sites.length*na*nb>maxCount)throw Error('Figür sınırı: 2500 atom. Tekrar sayısını küçültün.');
 for(let i=0;i<na;i++)for(let j=0;j<nb;j++)for(const s of selected.sites){
  const f=[...s.f];f[ctx.ai]+=i;f[ctx.bi]+=j;
  const p=ctx.xy(f);
  atoms.push({id:atoms.length,element:s.element,p,u:dot(p,ctx.u),v:dot(p,ctx.v),h:dot(p,ctx.n)});
 }
 return atoms;
}
function findBonds(atoms){
 const side=3.5,spatial=new Map(),bonds=[];
 const key=(x,y,z)=>[x,y,z].join('/');
 for(const a of atoms){
  const xyz=a.p.map(v=>Math.floor(v/side));
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const near=spatial.get(key(xyz[0]+dx,xyz[1]+dy,xyz[2]+dz))||[];
   for(const b of near){
    const d=norm(a.p.map((x,i)=>x-b.p[i])),limit=Math.min(3.4,(RADIUS[a.element]||1.15)+(RADIUS[b.element]||1.15)+.35);
    if(d>=.7&&d<=limit)bonds.push([a.id,b.id]);
   }
  }
  const bucket=key(...xyz);if(!spatial.has(bucket))spatial.set(bucket,[]);spatial.get(bucket).push(a);
 }
 return bonds;
}
function region(atoms,view){
 return atoms.map(a=>view==='top'?{x:a.u,y:-a.v}: {x:a.u,y:-a.h});
}
function limits(points){
 return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
  minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
function text(x,y,s,size=14,color='#2b445c',weight=500,anchor='start'){
 return '<text x="'+fmt(x)+'" y="'+fmt(y)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" fill="'+color+'" font-weight="'+weight+'" text-anchor="'+anchor+'">'+esc(s)+'</text>';
}
function line(a,b,color='#96a6b6',width=1.8,dash=''){
 return '<line x1="'+fmt(a.x)+'" y1="'+fmt(a.y)+'" x2="'+fmt(b.x)+'" y2="'+fmt(b.y)+'" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
}
function panel(draw,{x,y,width,height,view,showBonds,showCell,colors}){
 const points=region(draw.atoms,view),bounds=limits(points);
 const pad=42,scale=Math.min((width-pad*2)/Math.max(1,bounds.maxX-bounds.minX),
  (height-pad*2-12)/Math.max(1,bounds.maxY-bounds.minY),32);
 const xy=p=>({x:x+width/2+(p.x-(bounds.minX+bounds.maxX)/2)*scale,
  y:y+height/2+(p.y-(bounds.minY+bounds.maxY)/2)*scale+12});
 const pts=points.map(xy),out=[
  '<g class="cif-panel" data-view="'+view+'"><rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" rx="10" fill="#fff" stroke="#dce5ed"/>',
  text(x+18,y+27,view==='top'?'Üstten görünüm':'Yandan görünüm',16,'#2c5270',700)
 ];
 if(showCell){
  const base=[0,0,0],v0=draw.ctx.lattice[draw.ctx.ai],v1=draw.ctx.lattice[draw.ctx.bi];
  if(view==='top'){
   const corners=[base,mul(v0,draw.na),plus(mul(v0,draw.na),mul(v1,draw.nb)),mul(v1,draw.nb)];
   const cornerPts=corners.map(p=>xy({x:dot(p,draw.ctx.u),y:-dot(p,draw.ctx.v)}));
   // Projections must use the same origin as the atoms, including fractional offset.
   for(let k=0;k<4;k++)out.push(line(cornerPts[k],cornerPts[(k+1)%4],'#7c94a7',1.2,'5 4'));
  }else{
   const p1=xy({x:bounds.minX,y:bounds.minY}),p2=xy({x:bounds.maxX,y:bounds.maxY});
   out.push('<rect x="'+fmt(p1.x-8)+'" y="'+fmt(p1.y-8)+'" width="'+fmt(p2.x-p1.x+16)+'" height="'+fmt(p2.y-p1.y+16)+'" fill="none" stroke="#7c94a7" stroke-width="1.2" stroke-dasharray="5 4"/>');
  }
 }
 if(showBonds)for(const [a,b] of draw.bonds)out.push(line(pts[a],pts[b],'#a0aebd',2));
 const order=[...draw.atoms.keys()].sort((a,b)=>view==='top'?draw.atoms[a].h-draw.atoms[b].h:draw.atoms[a].v-draw.atoms[b].v);
 for(const i of order){
  const p=pts[i],a=draw.atoms[i],color=colors[a.element];
  out.push('<circle cx="'+fmt(p.x)+'" cy="'+fmt(p.y)+'" r="6.4" fill="'+color+'" stroke="#fff" stroke-width="1.3"/>');
 }
 out.push('</g>');
 return out.join('');
}
export function buildCifLayerFigure({structure,axis='c',minGap=2.2,layerIndex=0,na=4,nb=4,
 mode='compare',showBonds=true,showCell=true,showLegend=true}={}){
 if(!['compare','top','side'].includes(mode))throw Error('Görünüm türü geçersiz.');
 na=checkInt(na,1,6,'a tekrarı');nb=checkInt(nb,1,6,'b tekrarı');
 const data=analyzeCifLayers(structure,{axis,minGap});
 layerIndex=checkInt(layerIndex,0,data.groups.length-1,'Tabaka sırası');
 const selected=data.groups[layerIndex],atoms=figureAtoms({...data,group:selected},na,nb);
 const distinct=[...new Set(atoms.map(a=>a.element))].sort();
 if(distinct.length>16)throw Error('Figürde en fazla 16 farklı element desteklenir.');
 const colors=Object.fromEntries(distinct.map((el,i)=>[el,PALETTE[i%PALETTE.length]]));
 const bonds=showBonds?findBonds(atoms):[];
 const draw={atoms,bonds,ctx:data.context,na,nb};
 const views=mode==='compare'?['top','side']:[mode],panelHeight=view=>view==='top'?365:215;
 const width=640,height=95+views.reduce((a,v)=>a+panelHeight(v)+18,0)+78;
 const cleanName=String(structure.name||'Aktif kristal').slice(0,90);
 const parts=['<svg xmlns="http://www.w3.org/2000/svg" version="1.1" role="img" aria-label="CIF katmanlı kristal figürü" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'">',
  '<rect width="'+width+'" height="'+height+'" fill="#f3f7fb"/>',
  text(27,41,cleanName+' · seçilen katman',20,'#254459',700),
  text(27,65,axis+' normali · katman '+(layerIndex+1)+'/'+data.groups.length+' · '+na+'×'+nb+'×1 · '+atoms.length+' atom',12,'#688097')];
 let y=87;
 for(const view of views){const h=panelHeight(view);parts.push(panel(draw,{x:27,y,width:586,height:h,view,showBonds,showCell,colors}));y+=h+18;}
 if(showLegend){
  let lx=33;
  for(const el of distinct.slice(0,6)){
   parts.push('<circle cx="'+lx+'" cy="'+(height-51)+'" r="7" fill="'+colors[el]+'"/>');
   parts.push(text(lx+13,height-46,el,13));
   lx+=Math.max(63,26+el.length*11);
  }
  if(distinct.length>6)parts.push(text(lx,height-46,'+'+(distinct.length-6),12));
 }
 parts.push(text(width-25,height-19,'Kaynak koordinatları · bağlar yaklaşık · katman seçimi geometrik',10,'#75889b',400,'end'),'</svg>');
 return {svg:parts.join(''),width,height,panels:views.map(view=>({phase:'CIF',view})),
  atomsPerPhase:atoms.length,layerCount:data.groups.length,selectedLayer:layerIndex+1,
  gapAngstrom:data.gaps,source:cleanName};
}
