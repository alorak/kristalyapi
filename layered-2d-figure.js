/*
 * WebGL-free, deterministic 2D projection of ideal 1H/1T monolayer MoS2.
 * One layer = S(top)-Mo-S(bottom), NOT bulk 2H stacking.
 *
 * Structural references: RSC Nanoscale Horizons doi:10.1039/C7NH00137A;
 * RSC Advances doi:10.1039/D0RA10443D; Sci Rep doi:10.1038/srep29734.
 * P0 ideal geometry a=3.166 Å; S plane separation=3.092 Å.
 * These are illustrative, non-relaxed positions, not a CIF or DFT result.
 * No browser, THREE, canvas or GPU dependency.
 */
export const MX2_SOURCE=Object.freeze({
 formula:'MoS₂',latticeA:3.166,planeSeparation:3.092,
 reference:'https://doi.org/10.1038/srep29734',
 note:'İdealize edilmiş tek katman · deneysel ölçüm veya DFT relaksasyonu değildir.'
});
const TAU=Math.PI*2, SQRT3=Math.sqrt(3);
const COLORS=Object.freeze({metal:'#dd9bad',upper:'#169447',lower:'#086d35',bond:'#8795a5',cell:'#8495a8'});
const esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const round=value=>Number(value.toFixed(3));
function finiteInteger(value,min,max,label){
 const n=Number(value);
 if(!Number.isInteger(n)||n<min||n>max)throw Error(label+' '+min+'–'+max+' arasında tam sayı olmalıdır.');
 return n;
}
export function idealMx2Monolayer(phase='1H'){
 if(!['1H','1T'].includes(phase))throw Error('Desteklenmeyen MX₂ fazı: '+phase);
 const a=MX2_SOURCE.latticeA,c=20,z=MX2_SOURCE.planeSeparation/2/c;
 const top=[1/3,2/3],bottom=phase==='1H'?top:[2/3,1/3];
 return {
  phase,formula:'MoS₂',kind:phase==='1H'?'trigonal-prismatic':'octahedral',
  cell:{a,b:a,c,alpha:90,beta:90,gamma:120},
  sites:[
   {symbol:'Mo',layer:'metal',f:[0,0,.5]},
   {symbol:'S',layer:'upper',f:[top[0],top[1],.5+z]},
   {symbol:'S',layer:'lower',f:[bottom[0],bottom[1],.5-z]}
  ],
  provenance:'Illustrative single-layer coordinates; no structural relaxation'
 };
}
function point(model,f){
 const a=model.cell.a;
 return {x:a*(f[0]-f[1]/2),y:a*SQRT3*f[1]/2,z:model.cell.c*(f[2]-.5)};
}
export function mx2Supercell(phase='1H',na=5,nb=5){
 na=finiteInteger(na,1,6,'a tekrarı');
 nb=finiteInteger(nb,1,6,'b tekrarı');
 const model=idealMx2Monolayer(phase),atoms=[];
 for(let i=0;i<na;i++)for(let j=0;j<nb;j++)for(let k=0;k<model.sites.length;k++){
  const site=model.sites[k],f=[site.f[0]+i,site.f[1]+j,site.f[2]];
  atoms.push({id:phase+'-'+i+'-'+j+'-'+k,symbol:site.symbol,layer:site.layer,
   f,p:point(model,f)});
 }
 const bonds=[],maxBond=2.62;
 // Both S planes are considered. Do not synthesize hidden atoms or fake periodic bonds.
 for(const metal of atoms.filter(x=>x.layer==='metal')){
  for(const sulfur of atoms.filter(x=>x.symbol==='S')){
   const dx=metal.p.x-sulfur.p.x,dy=metal.p.y-sulfur.p.y,dz=metal.p.z-sulfur.p.z;
   const d=Math.hypot(dx,dy,dz);
   if(d>=2&&d<=maxBond)bonds.push({from:metal.id,to:sulfur.id,length:d});
  }
 }
 return {model,na,nb,atoms,bonds};
}
function position(atom,view){
 if(view==='top')return {x:atom.p.x,y:-atom.p.y,depth:atom.p.z};
 if(view==='side')return {x:atom.p.x,y:-atom.p.z,depth:atom.p.y};
 throw Error('Geçersiz görünüm: '+view);
}
function extent(points){
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function svgLine(x1,y1,x2,y2,color,width,dash=''){
 return '<line x1="'+round(x1)+'" y1="'+round(y1)+'" x2="'+round(x2)+'" y2="'+round(y2)+
  '" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round"'+
  (dash?' stroke-dasharray="'+dash+'"':'')+'/>';
}
function svgCircle(x,y,r,fill,stroke='#ffffff',sw=1.2){
 return '<circle cx="'+round(x)+'" cy="'+round(y)+'" r="'+r+'" fill="'+fill+
  '" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
}
function svgText(x,y,text,size=15,fill='#314861',weight=500,anchor='start'){
 return '<text x="'+round(x)+'" y="'+round(y)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+
  '" font-weight="'+weight+'" text-anchor="'+anchor+'" fill="'+fill+'">'+esc(text)+'</text>';
}
function layoutFor(phases,mode){
 const isCompare=mode==='compare',viewList=isCompare?['top','side']:[mode];
 const colCount=phases.length,cols=colCount===2?2:1;
 const pw=500, gap=22, left=32, top=isCompare?90:90;
 const heights=isCompare?[318,186]:mode==='top'?[390]:[235];
 const width=left*2+pw*cols+gap*(cols-1);
 const rows=[],panels=[];
 let y=top;
 for(let vi=0;vi<viewList.length;vi++){
  rows.push({view:viewList[vi],y,height:heights[vi]});
  for(let col=0;col<cols;col++){
   panels.push({phase:phases[col],view:viewList[vi],x:left+col*(pw+gap),y,w:pw,h:heights[vi]});
  }
  y+=heights[vi]+16;
 }
 return {width,height:y+78,panels,rows};
}
function frameCorners(model,na,nb){
 const f=[[0,0,.5],[na,0,.5],[na,nb,.5],[0,nb,.5]];
 return f.map(v=>point(model,v));
}
function panelSvg(panel,cell,opts,scale,globalBounds){
 const p=panel,top=p.view==='top',projected=cell.atoms.map(a=>({...a,...position(a,p.view)}));
 const byId=new Map(projected.map(a=>[a.id,a]));
 const bounds=globalBounds.get(p.view);
 const x0=p.x+p.w/2-scale*(bounds.minX+bounds.maxX)/2;
 const y0=p.y+p.h/2-scale*(bounds.minY+bounds.maxY)/2+14;
 const toScreen=atom=>({x:x0+atom.x*scale,y:y0+atom.y*scale});
 const label=p.phase==='1H'?'1H · üçgen prizmatik':'1T · oktahedral';
 const parts=[
  '<g class="mx2-panel" data-phase="'+p.phase+'" data-view="'+p.view+'">',
  '<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="12" fill="#ffffff" stroke="#dce5ee"/>',
  svgText(p.x+18,p.y+28,label,16,'#25475b',700),
  svgText(p.x+p.w-18,p.y+28,top?'Üstten':'Yandan',13,'#647d94',500,'end')
 ];
 if(opts.showCell){
  if(top){
   const points=frameCorners(cell.model,cell.na,cell.nb).map(a=>toScreen(position({p:a},p.view)));
   for(let i=0;i<4;i++)parts.push(svgLine(points[i].x,points[i].y,points[(i+1)%4].x,points[(i+1)%4].y,COLORS.cell,1.25,'5 4'));
  }else{
   const geom=extent(projected),min=toScreen({x:geom.minX,y:geom.minY}),max=toScreen({x:geom.maxX,y:geom.maxY});
   parts.push('<rect x="'+round(min.x-8)+'" y="'+round(min.y-8)+'" width="'+round(max.x-min.x+16)+
    '" height="'+round(max.y-min.y+16)+'" rx="3" fill="none" stroke="'+COLORS.cell+
    '" stroke-dasharray="5 4" stroke-width="1.2"/>');
  }
 }
 if(opts.showBonds){
  for(const bond of cell.bonds){
   const a=byId.get(bond.from),b=byId.get(bond.to);
   const ap=toScreen(a),bp=toScreen(b);
   parts.push(svgLine(ap.x,ap.y,bp.x,bp.y,COLORS.bond,2.2));
  }
 }
 // Layer order is explicit. In 1H the aligned bottom S remains visible as a ring.
 const layerOrder=top?['lower','metal','upper']:['lower','metal','upper'];
 for(const layer of layerOrder)for(const atom of projected.filter(a=>a.layer===layer)){
  const q=toScreen(atom);
  const color=COLORS[layer];
  parts.push(svgCircle(q.x,q.y,layer==='metal'?7.5:layer==='lower'?7.9:6.1,color,'#ffffff',1.15));
  if(layer==='upper')parts.push(svgCircle(q.x-1.7,q.y-1.8,1.1,'#d8ffd5','none',0));
 }
 parts.push('</g>');
 return parts.join('');
}
export function buildLayeredFigure(options={}){
 const mode=options.mode||'compare';
 if(!['compare','top','side'].includes(mode))throw Error('Desteklenmeyen figür düzeni: '+mode);
 const choice=options.phase||'both';
 if(!['both','1H','1T'].includes(choice))throw Error('Geçersiz faz seçimi: '+choice);
 const na=finiteInteger(options.na??5,1,6,'a tekrarı');
 const nb=finiteInteger(options.nb??5,1,6,'b tekrarı');
 const opts={showBonds:options.showBonds!==false,showCell:options.showCell!==false,showLegend:options.showLegend!==false};
 const phases=choice==='both'?['1H','1T']:[choice];
 const cells=Object.fromEntries(phases.map(phase=>[phase,mx2Supercell(phase,na,nb)]));
 const {width,height,panels,rows}=layoutFor(phases,mode);
 const globalBounds=new Map(),scales=new Map();
 for(const row of rows){
  const view=row.view,points=phases.flatMap(phase=>cells[phase].atoms.map(a=>position(a,view)));
  const bounds=extent(points);globalBounds.set(view,bounds);
  const spanX=Math.max(.01,bounds.maxX-bounds.minX),spanY=Math.max(.01,bounds.maxY-bounds.minY);
  // Each phase uses the same Å-to-pixel scale; preserve true side-view layer height.
  scales.set(view,Math.min((500-62)/spanX,(row.height-78)/spanY,35));
 }
 const parts=[
  '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" role="img" aria-label="MoS2 1H 1T tek katman 2B yapı figürü" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'">',
  '<rect width="'+width+'" height="'+height+'" fill="#f3f7fb"/>',
  svgText(32,40,'MoS₂ · tek katman yapısal karşılaştırma',23,'#193950',700),
  svgText(width-32,40,na+' × '+nb+' × 1 · ideal model',13,'#637b91',500,'end')
 ];
 for(const p of panels)parts.push(panelSvg(p,cells[p.phase],opts,scales.get(p.view),globalBounds));
 if(opts.showLegend){
  const y=height-48;
  parts.push(svgCircle(43,y,7,COLORS.metal));
  parts.push(svgText(58,y+5,'Mo · metal',13));
  parts.push(svgCircle(188,y,7,COLORS.upper));
  parts.push(svgText(204,y+5,'S · üst tabaka',13));
  parts.push(svgCircle(374,y,7,COLORS.lower));
  parts.push(svgText(390,y+5,'S · alt tabaka',13));
 }
 parts.push(svgText(width-32,height-18,'İdeal koordinatlar · relakse edilmemiş · 1H tek katman ≠ bulk 2H',11,'#6f8194',400,'end'));
 parts.push('</svg>');
 return {svg:parts.join(''),width,height,panels:panels.map(p=>({phase:p.phase,view:p.view})),
  atomsPerPhase:na*nb*3,bondsPerPhase:Object.fromEntries(phases.map(phase=>[phase,cells[phase].bonds.length])),
  source:MX2_SOURCE.reference,mode,phases};
}
