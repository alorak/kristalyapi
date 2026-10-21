import {braggTwoTheta,braggInterference,twoWaveBands,tightBindingChainLevels,
 tightBindingBandEnergy,twoOrbitalBands,twoOrbitalBandGap,twoOrbitalWeights,fermiDirac,edgeStateOccupancies,idealDopedCarriers,idealPnJunction,pnJunctionProfile,idealDiodeState,idealDiodeMinorityProfile,realDiodeState,KB_EV_K} from './lesson-core.js';
import {createPowderPlanesView} from './powder-planes-view.js';
import {xrdFactorStructure,xrdFactorResult,xrdFactorCompare} from './xrd-factor-core.js';

const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const number=(value,digits=2)=>Number(value).toLocaleString(
 window.CrystalI18n?.language==='en'?'en-US':'tr-TR',
 {minimumFractionDigits:digits,maximumFractionDigits:digits});

function svgNode(parent,tag,attrs={},value=null){
 const item=document.createElementNS(NS,tag);
 for(const [key,val] of Object.entries(attrs))item.setAttribute(key,String(val));
 if(value!==null)item.textContent=String(value);
 parent.appendChild(item);
 return item;
}
function clearChart(element,title){
 element.replaceChildren();
 svgNode(element,'title',{},title);
}
function linePath(points,project){
 return points.map((item,index)=>{
  const [x,y]=project(item);
  return `${index?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;
 }).join(' ');
}
function plotFrame(svg,{xMin,xMax,yMin=0,yMax=100,xTitle,yTitle,yTicks=4}){
 const bounds={left:65,top:20,right:875,bottom:272};
 const X=x=>bounds.left+(x-xMin)/(xMax-xMin)*(bounds.right-bounds.left);
 const Y=y=>bounds.bottom-(y-yMin)/(yMax-yMin)*(bounds.bottom-bounds.top);
 for(let i=0;i<=5;i++){
  const x=xMin+(xMax-xMin)*i/5;
  svgNode(svg,'line',{x1:X(x),x2:X(x),y1:bounds.top,y2:bounds.bottom,stroke:'#e6edf5','stroke-width':1});
  svgNode(svg,'text',{x:X(x),y:bounds.bottom+21,'text-anchor':'middle',fill:'#64748b','font-size':13},number(x,xMax>10?0:1));
 }
 for(let i=0;i<=yTicks;i++){
  const y=yMin+(yMax-yMin)*i/yTicks;
  svgNode(svg,'line',{x1:bounds.left,x2:bounds.right,y1:Y(y),y2:Y(y),stroke:'#e6edf5','stroke-width':1});
  svgNode(svg,'text',{x:bounds.left-12,y:Y(y)+4,'text-anchor':'end',fill:'#64748b','font-size':13},number(y,yMax>10?0:1));
 }
 svgNode(svg,'text',{x:(bounds.left+bounds.right)/2,y:315,'text-anchor':'middle',fill:'#38506b','font-size':15},xTitle);
 svgNode(svg,'text',{x:18,y:160,transform:'rotate(-90 18 160)','text-anchor':'middle',fill:'#38506b','font-size':14},yTitle);
 return {X,Y};
}
function setSource(nameId,detailId,structure){
 $(nameId).textContent=structure.name||'İsimsiz kristal';
 $(detailId).textContent=`${structure.sites.length} atom · a = ${number(structure.cell.a,3)} Å · ${structure.symmetry}`;
}
function metric(label,value){
 const item=document.createElement('div');
 item.className='lesson-metric';
 const heading=document.createElement('span');heading.textContent=label;
 const strong=document.createElement('strong');strong.textContent=value;
 item.append(heading,strong);
 return item;
}

/* Bragg's two-plane path difference is shown next to a two-wave interference
 * trace. Unlike the computed powder profile this never claims real intensity. */
function braggWaveDiagram(svg,theta,values){
 const english=window.CrystalI18n?.language==='en';
 clearChart(svg,'Two coherent waves from consecutive lattice planes');
 const title=(tr,en)=>english?en:tr;
 const line=(x1,y1,x2,y2,color,width=2,extra={})=>svgNode(svg,'line',
  {x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-linecap':'round',...extra});
 const label=(x,y,value,color='#526b83',size=13)=>svgNode(svg,'text',
  {x,y,fill:color,'font-size':size,'font-weight':600},value);
 function arrow(x1,y1,x2,y2,color){
  line(x1,y1,x2,y2,color,4);
  const a=Math.atan2(y2-y1,x2-x1),s=12;
  svgNode(svg,'polygon',{points:`${x2},${y2} ${x2-s*Math.cos(a-.4)},${y2-s*Math.sin(a-.4)} ${x2-s*Math.cos(a+.4)},${y2-s*Math.sin(a+.4)}`,fill:color});
 }
 label(26,28,title('Ardışık düzlemler ve ışın yönleri','Successive planes and ray directions'));
 line(55,115,740,115,'#abbacb',2);
 line(55,161,740,161,'#cbd5e1',2,{'stroke-dasharray':'7 5'});
 label(615,105,title('Düzlem 1','Plane 1'));label(615,153,title('Düzlem 2','Plane 2'));
 line(76,115,76,161,'#64748b',1.8);
 line(69,115,83,115,'#64748b');line(69,161,83,161,'#64748b');label(89,143,'d','#334155',15);
 const radians=theta*Math.PI/180,cx=318,cy=115,length=90;
 arrow(cx-length*Math.cos(radians),cy-length*Math.sin(radians),cx,cy,'#1674c4');
 arrow(cx,cy,cx+length*Math.cos(radians),cy-length*Math.sin(radians),'#dc6948');
 label(cx-154*Math.cos(radians)-22,Math.max(39,cy-124*Math.sin(radians)),title('Gelen','Incident'),'#1674c4');
 label(cx+110*Math.cos(radians),Math.max(39,cy-110*Math.sin(radians)),title('Saçılan','Diffracted'),'#b64f32');
 label(cx+18,cy+27,`θ = ${number(theta,1)}°`,'#485e74');
 line(36,190,754,190,'#dbe6f1',1);
 label(26,214,title('Aynı noktadaki dalga karşılaştırması','Two waves at a shared observation point'));
 const traces=[
  {baseline:252,label:title('Dalga 1','Wave 1'),color:'#1674c4'},
  {baseline:298,label:title('Dalga 2','Wave 2'),color:'#dd7942'},
  {baseline:331,label:title('Toplam','Sum'),color:'#148a74'}
 ];
 const paths=[];
 for(const trace of traces){
  line(156,trace.baseline,750,trace.baseline,'#d9e4ef',1,{'stroke-dasharray':'4 5'});
  label(27,trace.baseline+4,trace.label,trace.color,13);
  paths.push(svgNode(svg,'path',{stroke:trace.color,'stroke-width':2.5,fill:'none'}));
 }
 return (time=0)=>{
  for(let j=0;j<3;j++){
   const points=[];
   for(let i=0;i<=150;i++){
    const x=156+594*i/150,k=5*Math.PI*i/150-time;
    const a=Math.sin(k),b=Math.sin(k+values.phaseRadians);
    const y=traces[j].baseline-(j===0?a*14:j===1?b*14:(a+b)*17);
    points.push(`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`);
   }
   paths[j].setAttribute('d',points.join(' '));
  }
 };
}

/* The discrete spectrum uses OPEN boundaries; the smooth E(k) curve beside it
 * is the infinite PERIODIC chain, not the eigenvalues of that finite chain. */
function tightBindingDiagram(svg,count,hopping,period){
 const english=window.CrystalI18n?.language==='en';
 const tr=(turkish,en)=>english?en:turkish;
 clearChart(svg,'Atomic levels becoming one tight-binding band');
 const txt=(x,y,value,color='#536b84',size=14,weight=600,anchor='start')=>svgNode(svg,'text',
  {x,y,fill:color,'font-size':size,'font-weight':weight,'text-anchor':anchor},value);
 const line=(x1,y1,x2,y2,color='#d6e3ee',width=1,other={})=>svgNode(svg,'line',
  {x1,y1,x2,y2,stroke:color,'stroke-width':width,...other});
 txt(24,30,tr('Bir atom → ayrık seviyelerin çoğalması','One atom → splitting into discrete levels'),'#284a6b',16,700);
 const start=150,end=845,atomsY=79;
 line(start,atomsY,end,atomsY,'#c8d8e8',2);
 for(let i=0;i<count;i++){
  const x=count===1?(start+end)/2:start+(end-start)*i/(count-1);
  svgNode(svg,'circle',{cx:x,cy:atomsY,r:count>48?4:count>24?5.7:8,
   fill:'#5c9ed5',stroke:'#fff','stroke-width':1.4,'data-chain-atom':i});
 }
 txt(24,83,`${count} ${tr('atom','atoms')}`,'#23689d',14,700);
 line(449,114,449,365,'#dbe6f1',1);
 txt(24,133,tr('Sonlu açık zincir: N enerji seviyesi','Finite open chain: N energy levels'),'#284a6b',15,700);
 txt(487,133,tr('Sonsuz periyodik zincir: E(k)','Infinite periodic chain: E(k)'),'#284a6b',15,700);
 const scale=Math.max(.22,2*hopping)*1.19;
 const Y=energy=>274-energy/scale*93;
 const yTop=Y(2*hopping),yBottom=Y(-2*hopping);
 svgNode(svg,'rect',{x:196,y:yTop,width:218,height:Math.max(1,yBottom-yTop),
  fill:'#e8f2fd','fill-opacity':.7});
 for(const e of [2*hopping,0,-2*hopping]){
  const y=Y(e);
  line(189,y,419,y,e===0?'#aec3d8':'#ceddeb',1,{'stroke-dasharray':'4 5'});
  txt(179,y+4,`${e>=0?'+':''}${number(e,1)}`, '#62758c',11,500,'end');
 }
 const levels=tightBindingChainLevels(count,hopping);
 for(const [i,energy] of levels.entries())line(214,Y(energy),398,Y(energy),
  '#1f6da8',count>=32?1.4:2.8,{'stroke-opacity':count>=32?.76:.95,'data-energy-level':i});
 txt(203,374,tr('Enerji E (eV)','Energy E (eV)'),'#71849c',11,500);
 const x0=493,x1=847,mid=(x0+x1)/2;
 line(x0,274,x1,274,'#c1d1e0');
 line(mid,159,mid,359,'#dce7f1',1,{'stroke-dasharray':'5 5'});
 const points=Array.from({length:181},(_,i)=>{
  const kr=-1+2*i/180;
  return [x0+(x1-x0)*i/180,tightBindingBandEnergy(kr,hopping)];
 });
 svgNode(svg,'path',{d:linePath(points,p=>[p[0],Y(p[1])]),fill:'none',
  stroke:'#c7782d','stroke-width':3.5,'stroke-linejoin':'round'});
 for(const [x,label] of [[x0,'−π/a'],[mid,'0'],[x1,'π/a']]){
  line(x,356,x,362,'#73879b');txt(x,377,label,'#536b83',12,600,'middle');
 }
 txt(486,168,`π/a = ${number(Math.PI/period,3)} Å⁻¹`,'#7e5e34',12,600);
}

/* A/B orbitals per cell: two Bloch eigenvalues at every wave vector. The
 * highlighted energy interval is globally forbidden in this ideal model. */
function twoOrbitalDiagram(svg,intra,inter,delta,period,selectedK){
 const english=window.CrystalI18n?.language==='en';
 const tr=(turkish,en)=>english?en:turkish;
 clearChart(svg,'Two-orbital tight-binding valence/conduction bands and gap');
 const txt=(x,y,value,color='#536b84',size=13,weight=600,anchor='start')=>svgNode(svg,'text',
  {x,y,fill:color,'font-size':size,'font-weight':weight,'text-anchor':anchor},value);
 const line=(x1,y1,x2,y2,color='#d6e3ee',width=1,extra={})=>svgNode(svg,'line',
  {x1,y1,x2,y2,stroke:color,'stroke-width':width,...extra});
 txt(24,28,tr('Bir hücre: A ve B orbitalleri','One cell: A and B orbitals'),'#284a6b',16,700);
 const xStart=156,step=54,yAtoms=72;
 for(let i=0;i<11;i++){
  const internal=i%2===0;
  line(xStart+i*step,yAtoms,xStart+(i+1)*step,yAtoms,internal?'#2563a9':'#cc8752',
   2.2+2.5*(internal?intra:inter)/2,{'data-dual-bond':internal?'intra':'inter'});
 }
 for(let i=0;i<12;i++){
  svgNode(svg,'circle',{cx:xStart+i*step,cy:yAtoms,r:10.5,fill:i%2?'#f3aa65':'#6daadc',
   stroke:'#fff','stroke-width':1.8,'data-dual-atom':i});
 }
 txt(xStart,yAtoms+27,'A','#23689d',11,700,'middle');
 txt(xStart+step,yAtoms+27,'B','#bd6a31',11,700,'middle');
 txt(xStart+step/2,yAtoms-17,'t₁','#2563a9',12,700,'middle');
 txt(xStart+step*1.5,yAtoms-17,'t₂','#bd6a31',12,700,'middle');
 line(36,116,860,116,'#dae5f0');
 txt(25,137,tr('İki Bloch bandı · periyodik sonsuz A/B zinciri','Two Bloch bands · infinite periodic A/B chain'),
  '#284a6b',15,700);
 const x0=96,x1=838,ymid=258;
 const ymax=Math.max(.35,Math.hypot(delta/2,intra+inter))*1.2;
 const X=k=>x0+(k+1)/2*(x1-x0),Y=e=>ymid-90*e/ymax;
 const gap=twoOrbitalBandGap(intra,inter,delta),halfGap=gap/2;
 // Neither Bloch band has states in this energy interval (in this model).
 if(gap>1e-9)svgNode(svg,'rect',{x:x0,y:Y(halfGap),width:x1-x0,height:Y(-halfGap)-Y(halfGap),
  fill:'#c7ead6','fill-opacity':0.5,'data-gap-region':'true'});
 for(const k of [-1,0,1])line(X(k),153,X(k),352,'#e1eaf3',1,{'stroke-dasharray':k===0?'5 4':'3 6'});
 line(x0,ymid,x1,ymid,'#c3d2e2',1,{'stroke-dasharray':'4 5'});
 const samples=Array.from({length:241},(_,i)=>{
  const k=-1+2*i/240;return {k,...twoOrbitalBands(k,intra,inter,delta)};
 });
 svgNode(svg,'path',{d:linePath(samples,p=>[X(p.k),Y(p.valence)]),fill:'none',
  stroke:'#2675b7','stroke-width':3.3,'data-dual-band':'valence'});
 svgNode(svg,'path',{d:linePath(samples,p=>[X(p.k),Y(p.conduction)]),fill:'none',
  stroke:'#e58c42','stroke-width':3.3,'data-dual-band':'conduction'});
 const selection=twoOrbitalBands(selectedK,intra,inter,delta);
 line(X(selectedK),148,X(selectedK),352,'#8b5cf6',2,{'stroke-dasharray':'5 5','data-dual-k':'true'});
 for(const [band,color] of [['valence','#2675b7'],['conduction','#e58c42']]){
  svgNode(svg,'circle',{cx:X(selectedK),cy:Y(selection[band]),r:6.5,fill:color,
   stroke:'#fff','stroke-width':2.5,'data-selected-band':band});
 }
 txt(117,Y(samples[120].conduction)-11,tr('İletim bandı','Conduction band'),'#b96526',13,700);
 txt(117,Y(samples[120].valence)+19,tr('Değerlik bandı','Valence band'),'#225e96',13,700);
 const gx=x1-16,g1=Y(halfGap),g2=Y(-halfGap);
 if(gap>1e-9){
  line(gx,g1,gx,g2,'#24946c',2.5);
  line(gx-7,g1,gx+7,g1,'#24946c',2);
  line(gx-7,g2,gx+7,g2,'#24946c',2);
 }
 txt(x1-22,ymid-6,gap<1e-9?tr('E₍g₎ = 0 · temas','E₍g₎ = 0 · touching'):
  `E₍g₎ = ${number(gap,2)} eV`,'#177d59',13,700,'end');
 for(const [k,label] of [[-1,'−π/a'],[0,'0'],[1,'π/a']])
  txt(X(k),370,label,'#576f88',12,600,'middle');
 txt(25,164,`π/a = ${number(Math.PI/period,3)} Å⁻¹`,'#6e8196',12,600);
}

/* A physically calculated polygon of complex per-site X-ray amplitudes.
 * The final arrow always uses the full sum, including any grouped sites. */
function structurePhasorDiagram(svg,host,structure,hkl){
 const english=window.CrystalI18n?.language==='en';
 const tr=(turkish,en)=>english?en:turkish;
 clearChart(svg,'Atom-resolved X-ray structure-factor phasors');
 const [h,k,l]=hkl,{sites,cell}=structure;
 const total=host.structureFactor(h,k,l,sites,cell,'xray');
 const visibleSites=sites.slice(0,30);
 const terms=visibleSites.map((site,index)=>{
  const {real,imag}=host.structureFactor(h,k,l,[site],cell,'xray');
  return {real,imag,label:`${index+1}. ${site.symbol||'?'}`};
 });
 if(sites.length>30){
  const partial=terms.reduce((sum,p)=>({real:sum.real+p.real,imag:sum.imag+p.imag}),{real:0,imag:0});
  terms.push({real:total.real-partial.real,imag:total.imag-partial.imag,
   label:tr(`${sites.length-30} diğer atom`,`${sites.length-30} other atoms`)});
 }
 const points=[{real:0,imag:0}];
 for(const term of terms){const last=points.at(-1);points.push({real:last.real+term.real,imag:last.imag+term.imag});}
 const extrema={minX:Math.min(0,...points.map(p=>p.real)),maxX:Math.max(0,...points.map(p=>p.real)),
  minY:Math.min(0,...points.map(p=>p.imag)),maxY:Math.max(0,...points.map(p=>p.imag))};
 const span=Math.max(extrema.maxX-extrema.minX,extrema.maxY-extrema.minY,1);
 const scale=Math.min(690/(extrema.maxX-extrema.minX+span*.24),270/(extrema.maxY-extrema.minY+span*.24));
 const centerX=(extrema.minX+extrema.maxX)/2,centerY=(extrema.minY+extrema.maxY)/2;
 const X=x=>450+(x-centerX)*scale,Y=y=>195-(y-centerY)*scale;
 const line=(a,b,color,width,extra={})=>svgNode(svg,'line',{
  x1:X(a.real),y1:Y(a.imag),x2:X(b.real),y2:Y(b.imag),stroke:color,
  'stroke-width':width,'stroke-linecap':'round',...extra});
 const defs=svgNode(svg,'defs');
 for(const [id,color] of [['term','#397dbc'],['group','#d48948'],['result','#238867']]){
  const marker=svgNode(defs,'marker',{id:`pw-${id}-arrow`,markerWidth:8,markerHeight:8,
   refX:7,refY:3,orient:'auto',markerUnits:'strokeWidth'});
  svgNode(marker,'path',{d:'M0 0 L7 3 L0 6 Z',fill:color});
 }
 const zero={real:0,imag:0};
 line({real:extrema.minX-span*.15,imag:0},{real:extrema.maxX+span*.15,imag:0},'#cbd8e7',1);
 line({real:0,imag:extrema.minY-span*.15},{real:0,imag:extrema.maxY+span*.15},'#cbd8e7',1);
 svgNode(svg,'text',{x:22,y:28,'font-size':16,fill:'#294965','font-weight':700},
  `F(${h} ${k} ${l}) = Σ fⱼ exp(2πi · hkl·rⱼ)`);
 svgNode(svg,'text',{x:22,y:368,'font-size':13,fill:'#5c7088'},tr('Re F → · Im F ↑','Re F → · Im F ↑'));
 const small=Math.max(1e-7,Math.hypot(total.real,total.imag)*1e-8);
 terms.forEach((term,i)=>{
  const grouped=i===30,color=grouped?'#d48948':'#397dbc';
  if(Math.hypot(term.real,term.imag)<small)return;
  const segment=line(points[i],points[i+1],color,2.8,{
   'marker-end':`url(#pw-${grouped?'group':'term'}-arrow)`,'data-phasor-arrow':i});
  svgNode(segment,'title',{},`${term.label}: ${number(term.real,3)} + ${number(term.imag,3)}i`);
 });
 const magnitude=Math.hypot(total.real,total.imag);
 if(magnitude>=1e-7)line(zero,total,'#238867',4,
  {'marker-end':'url(#pw-result-arrow)','data-phasor-result':'true'});
 svgNode(svg,'circle',{cx:X(total.real),cy:Y(total.imag),r:5.5,fill:'#238867',stroke:'#fff','stroke-width':2});
 svgNode(svg,'circle',{cx:X(0),cy:Y(0),r:3.3,fill:'#64748b'});
 svgNode(svg,'text',{x:870,y:28,'text-anchor':'end',fill:'#238867','font-size':16,'font-weight':700},
  `|F| = ${number(magnitude,3)}`);
 return total;
}

export function initPowderLesson(host){
 let visible=false,selectedIndex=0,lastPattern=null,planeViewer=null,planeMetrics=null;
 let selectedWave=null,thetaOverride=null,waveDrawing=null,waveFrame=0,wavePlaying=false,lastWavePaint=0;
 const chart=$('pwChart'),list=$('pwPeaks'),summary=$('pwSummary'),bragg=$('pwBragg');
 function updatePhasors(){
  const values=['pwFh','pwFk','pwFl'].map(id=>$(id).value.trim());
  const hkl=values.map(Number),output=$('pwPhasorSummary');
  const valid=values.every(value=>value!=='')&&hkl.every(value=>Number.isInteger(value)&&Math.abs(value)<=12)&&hkl.some(Boolean);
  if(!valid){
   clearChart($('pwPhasorSvg'),'Geçerli ve sıfırdan farklı (hkl) gerekli.');
   output.replaceChildren(metric('Yansıma','Geçerli (hkl) seçin'));
   $('pwFactorCompareRows').replaceChildren();
   $('pwFactorInsight').textContent='(000) kırınım yansıması değildir; geçerli h, k, l girin.';
   return;
  }
  try{
   const material=$('pwMaterial').value;
   const baseline=xrdFactorStructure(material,host.structure());
   const occupancy=Number($('pwOccupancy').value)/100,shift=Number($('pwShift').value);
   const result=xrdFactorResult(host.structureFactor,baseline,hkl,
    {occupancy,shift,lambda:Number($('pwLambda').value)});
   $('pwOccupancyValue').textContent=number(100*occupancy,0)+'%';
   $('pwShiftValue').textContent=number(shift,2);
   $('pwMaterialTitle').textContent=baseline.name;
   $('pwStructureNote').textContent=baseline.lessonTarget+
    ' · '+baseline.sites.length+' konum · '+baseline.symmetry+
    (material==='active'?' · açık kristalin ilk konumu kontrol edilir.':' · örnek konvansiyonel hücre.');
   structurePhasorDiagram($('pwPhasorSvg'),host,result.structure,hkl);
   const normalized=result.relative220;
   const outcome=result.extinct?'F ≈ 0 · sönme':'F ≠ 0 · yansıma mümkün';
   output.replaceChildren(metric('Yansıma',`(${hkl.join(' ')})`),
    metric('|Fc(hkl)|',number(result.amplitude,3)),
    metric('|Fc|²',number(result.intensity,3)),
    metric('(220) referansı',normalized===null?'—':number(normalized,1)+'%'),
    metric('Hesaplanan 2θ',result.twoTheta===null?'Bragg erişilemez':number(result.twoTheta,2)+'°'),
    metric('Yorum',outcome));
   const referenceRows=xrdFactorCompare(host.structureFactor,hkl);
   const tbody=$('pwFactorCompareRows');tbody.replaceChildren();
   for(const sample of referenceRows){
    const row=document.createElement('tr');
    row.className=sample.id===material?'xrd-factor-selected':'';
    const values=[sample.name,`(${hkl.join(' ')})`,
     number(sample.amplitude,2),number(sample.intensity,2),
     sample.relative220===null?'—':number(sample.relative220,1)+'%',
     sample.extinct?'Sönüm / yokluk':'İzinli (bu modelde)'];
    for(const [index,value] of values.entries()){
     const cell=document.createElement(index===0?'th':'td');
     if(index===0)cell.scope='row';
     cell.textContent=value;
     if(index===5)cell.className=sample.extinct?'xrd-factor-extinct':'xrd-factor-allowed';
     row.appendChild(cell);
    }
    tbody.appendChild(row);
   }
   const [h,k,l]=hkl;
   const isMixedParity=!(Math.abs(h)%2===Math.abs(k)%2&&Math.abs(k)%2===Math.abs(l)%2);
   let insight='';
   if(material==='fe'&&occupancy===1&&shift===0&&((h+k+l)%2!==0))
    insight='BCC Fe: köşedeki ve gövde merkezindeki Fe saçılması zıt fazlıdır. h+k+l tek olduğundan merkezleme sönümü oluşur.';
   else if(material==='si'&&occupancy===1&&shift===0&&result.extinct)
    insight='Si: FCC merkezleme ve elmas yapının (¼, ¼, ¼) ikinci atom bazı birlikte seçilim kuralları oluşturur. Bu (hkl) katkıları söndürür.';
   else if(material==='nacl'&&occupancy===1&&shift===0&&isMixedParity)
    insight='NaCl: FCC merkezleme nedeniyle karışık tek/çift Miller indisleri sistematik yokluk verir.';
   else if(occupancy!==1||shift!==0)
    insight='Düşünce deneyi: seçili alt grubun doluluğu/konumu değiştiği için girişim de değişir. Bu, gerçek kristalin simetrisi veya deneysel kırınımı olarak yorumlanmamalı.';
   else
    insight='Bu (hkl) için fazörlerin toplamı '+(result.extinct?'sıfıra yakındır; nedenini atom fazlarından kontrol edin.':'sıfır değildir; açısal erişim ve diğer pik etkileri ayrıca incelenmelidir.');
   $('pwFactorInsight').textContent=insight+
    ' Karşılaştırma tablosundaki üç satır, ayarlarla değiştirilmeyen tam dolu referans modellerdir.';
  }catch(error){
   clearChart($('pwPhasorSvg'),'Yapı faktörü hesaplanamadı');
   output.replaceChildren(metric('Hesaplama hatası',error.message||String(error)));
   $('pwFactorCompareRows').replaceChildren();
   $('pwFactorInsight').textContent='Hesaplama tamamlanamadı: '+(error.message||String(error));
  }
 }
 function useHkl(hkl){if(!hkl)return;['pwFh','pwFk','pwFl'].forEach((id,i)=>$(id).value=String(hkl[i]));updatePhasors();}
 function setWavePlaying(playing){
  wavePlaying=!!playing&&!!selectedWave&&visible;
  cancelAnimationFrame(waveFrame);
  $('pwWavePlay').setAttribute('aria-pressed',String(wavePlaying));
  $('pwWavePlay').textContent=wavePlaying?'Animasyonu durdur':'Animasyonu oynat';
  if(wavePlaying)waveFrame=requestAnimationFrame(function tick(now){
   if(!wavePlaying||!visible)return;
   if(now-lastWavePaint>=40){waveDrawing?.(now/550);lastWavePaint=now;}
   waveFrame=requestAnimationFrame(tick);
  });
 }
 function redrawBraggLab(){
  if(!selectedWave)return;
  const {d,lambda,braggAngle}=selectedWave;
  const theta=thetaOverride===null?braggAngle:thetaOverride;
  const values=braggInterference(d,lambda,theta);
  $('pwTheta').value=String(theta);
  $('pwThetaOutput').textContent=number(theta,2)+'°';
  $('pwPhaseReadout').replaceChildren(
   metric('Bragg açısı θB',number(braggAngle,3)+'°'),
   metric('Yol farkı ΔL',number(values.pathDifference,4)+' Å'),
   metric('Faz farkı Δφ',number(values.phaseRadians/Math.PI,3)+'π rad'),
   metric('İki-dalga I/Imax',number(values.relativeIntensity*100,1)+'%'));
  waveDrawing=braggWaveDiagram($('pwWaveSvg'),theta,values);
  waveDrawing(wavePlaying?performance.now()/550:0);
  planeViewer?.setAngle?.(theta);
 }
 function disableBraggLab(){
  selectedWave=null;setWavePlaying(false);waveDrawing=null;
  $('pwPhaseReadout').replaceChildren();
  clearChart($('pwWaveSvg'),'Bragg yansıması seçilmedi');
  $('pwThetaOutput').textContent='—';
  $('pwMatchBragg').disabled=true;$('pwWavePlay').disabled=true;$('pwTheta').disabled=true;
 }
 function highlightPlanes(structure,chosen){
  if(!chosen){
   planeViewer?.clear?.();
   planeMetrics=null;
   $('pwPlaneHkl').textContent='—';
   $('pwPlaneStats').textContent='Bir yansıma seçin.';
   return;
  }
  const hkl=chosen.hkl;
  $('pwPlaneHkl').textContent=`(${hkl.join(' ')})`;
  try{
   if(!planeViewer)planeViewer=createPowderPlanesView($('pwCrystal3d'),{elementColor:host.elementColor});
   const result=planeViewer.update(structure,hkl);
   if(result)planeMetrics=result;
   if(planeMetrics){
    const english=window.CrystalI18n?.language==='en';
    $('pwPlaneStats').textContent=english?
     `${planeMetrics.planes} clipped planes · ${planeMetrics.atoms} atoms${planeMetrics.limited?' (first 1200)':''}${planeMetrics.planeLimited?' (up to 16 planes)':''}`:
     `${planeMetrics.planes} hücre-içi düzlem · ${planeMetrics.atoms} atom${planeMetrics.limited?' (ilk 1200)':''}${planeMetrics.planeLimited?' (en fazla 16 düzlem)':''}`;
   }
  }catch(error){planeMetrics=null;$('pwPlaneStats').textContent='3B çizim kullanılamıyor: '+(error.message||String(error));}
 }
 function choose(index){selectedIndex=index;thetaOverride=null;
  const hkl=lastPattern?.groups?.[index]?.hkl;
  if(hkl)['pwFh','pwFk','pwFl'].forEach((id,i)=>$(id).value=String(hkl[i]));
  render();}
 function render(){
  if(!visible)return;
  const structure=host.structure();
  setSource('pwSourceName','pwSourceDetail',structure);
  const lambda=Number($('pwLambda').value),maxAngle=Number($('pwMaxAngle').value);
  const width=Number($('pwWidth').value);
  $('pwLambdaOutput').textContent=number(lambda,4)+' Å';
  $('pwAngleOutput').textContent=number(maxAngle,0)+'°';
  $('pwWidthOutput').textContent=number(width,2)+'°';
  try{
   lastPattern=host.powderPattern(structure.cell,structure.sites,
    {wavelength:lambda,maxAngle,scattering:'xray',lorentzPolarization:$('pwLp').checked});
   const profile=host.powderProfile(lastPattern,{U:0,V:0,W:width*width,eta:0.5,step:0.05,kalpha2:false});
   const groups=lastPattern.groups;
   if(selectedIndex>=groups.length)selectedIndex=0;
   $('pwStatus').textContent=`${groups.length} ayırt edilebilir pik grubu · ${lastPattern.reflections.length} yansıma · varsayımsal profil`;
   clearChart(chart,'Seçili kristalin hesaplanan toz kırınım profili');
   const axes=plotFrame(chart,{xMin:0,xMax:maxAngle,yMax:100,xTitle:'2θ (derece)',yTitle:'Göreli şiddet (%)'});
   svgNode(chart,'path',{d:linePath(profile.angles.map((angle,i)=>[angle,profile.relative[i]]),
    ([angle,intensity])=>[axes.X(angle),axes.Y(intensity)]),stroke:'#1674c4','stroke-width':2.2,fill:'none'});
   // Large, keyboard-focusable hit strips allow direct selection on the XRD
   // graph; the same index is used by the reflection list and 3D viewer.
   groups.forEach((group,index)=>{
    const x=axes.X(group.angle);
    const hit=svgNode(chart,'rect',{x:x-7,y:20,width:14,height:252,
     fill:'#f59e0b','fill-opacity':0,'class':'lesson-peak-hit',
     'data-peak-index':index,role:'button',tabindex:0,
     'aria-pressed':String(index===selectedIndex),
     'aria-label':`(${group.hkl.join(' ')}) · ${number(group.angle)}°`});
    svgNode(hit,'title',{},`(${group.hkl.join(' ')}) · ${number(group.angle)}°`);
    hit.addEventListener('click',()=>choose(index));
    hit.addEventListener('keydown',event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(index);}
    });
   });
   if(groups.length){
    const chosen=groups[selectedIndex];
    svgNode(chart,'line',{x1:axes.X(chosen.angle),x2:axes.X(chosen.angle),y1:20,y2:272,
     stroke:'#f59e0b','stroke-width':2,'stroke-dasharray':'6 5'});
    svgNode(chart,'text',{x:Math.min(axes.X(chosen.angle)+9,780),y:32,fill:'#9a5a05','font-weight':700,'font-size':14},
     `(${chosen.hkl.join(' ')})`);
   }
   summary.replaceChildren(metric('En güçlü pik',groups.length?`${number(groups.reduce((p,c)=>p.relative>c.relative?p:c).angle)}°`:'—'),
    metric('Kullanılan λ',number(lambda,4)+' Å'),metric('Model genişliği',number(width)+'°'));
   const strongest=groups.length?groups.reduce((best,g)=>g.intensity>best.intensity?g:best):null;
   $('pwStrongestExplanation').textContent=strongest?
    'En güçlü model piki: ('+strongest.hkl.join(' ')+') · 2θ = '+number(strongest.angle,2)+'° · d = '+
    number(strongest.d,4)+' Å. Açı Bragg koşulu (2d sinθ = λ) ile bulunur. Şiddet, atomların IT92 yapı faktöründen |Fc|², eşdeğer yansıma katkıları ve '+
    ($('pwLp').checked?'Lorentz–polarizasyon düzeltmesi':'seçili düzeltmesiz model')+
    ' üzerinden hesaplanır. En yüksek hesaplanan gruba %100 atanır; deneysel pik veritabanından alınmaz.':
    'Seçilen dalga boyunda ve 2θ aralığında izinli model yansıması bulunmadı.';
   list.replaceChildren();
   if(!groups.length)list.textContent='Bu dalga boyu ve açı aralığında yansıma bulunamadı.';
   groups.slice(0,28).forEach((group,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='lesson-peak'+(index===selectedIndex?' chosen':'');
    button.setAttribute('aria-pressed',String(index===selectedIndex));
    button.textContent=`(${group.hkl.join(' ')})  ·  ${number(group.angle)}°  ·  ${number(group.relative,1)}%`;
    button.addEventListener('click',()=>choose(index));
    list.appendChild(button);
   });
   bragg.replaceChildren();
   if(groups.length){
    const chosen=groups[selectedIndex];
    highlightPlanes(structure,chosen);
    selectedWave={d:chosen.d,lambda,braggAngle:chosen.angle/2};
    $('pwMatchBragg').disabled=false;$('pwWavePlay').disabled=false;$('pwTheta').disabled=false;
    redrawBraggLab();
    bragg.append(metric('Miller indisleri',`(${chosen.hkl.join(' ')})`),
     metric('Düzlem aralığı',number(chosen.d,4)+' Å'),
     metric('Bragg açısı θ',number(chosen.angle/2,3)+'°'),
     metric('Dedektör açısı 2θ',number(chosen.angle,3)+'°'));
    const value=braggTwoTheta(chosen.d,lambda);
    if(value!==null&&Math.abs(value-chosen.angle)>0.001)
     $('pwStatus').textContent='Bragg model tutarlılığı kontrol edilemedi.';
   }else{
    highlightPlanes(structure,null);
    disableBraggLab();
    bragg.textContent='Düzlem seçmek için açı sınırını veya dalga boyunu değiştirin.';
   }
   updatePhasors();
  }catch(error){
   lastPattern=null;
   clearChart(chart,'Hesaplama hatası');summary.replaceChildren();list.replaceChildren();bragg.replaceChildren();
   planeViewer?.clear?.();planeMetrics=null;$('pwPlaneHkl').textContent='—';$('pwPlaneStats').textContent='—';
   disableBraggLab();
   $('pwStatus').textContent=error.message||'Hesaplama yapılamadı.';
  }
 }
 for(const id of ['pwLambda','pwMaxAngle','pwWidth','pwLp'])$(id).addEventListener('input',()=>{selectedIndex=0;thetaOverride=null;render();});
 $('pwTheta').addEventListener('input',()=>{thetaOverride=Number($('pwTheta').value);redrawBraggLab();});
 $('pwMatchBragg').addEventListener('click',()=>{thetaOverride=null;redrawBraggLab();});
 $('pwWavePlay').addEventListener('click',()=>setWavePlaying(!wavePlaying));
 for(const id of ['pwFh','pwFk','pwFl'])$(id).addEventListener('input',()=>{if(visible)updatePhasors();});
 for(const id of ['pwMaterial','pwOccupancy','pwShift'])
  $(id).addEventListener('input',()=>{if(visible)updatePhasors();});
 $('pwResetFactor').addEventListener('click',()=>{
  $('pwOccupancy').value='100';$('pwShift').value='0';
  if(visible)updatePhasors();
 });
 $('pwUsePeak').addEventListener('click',()=>useHkl(lastPattern?.groups?.[selectedIndex]?.hkl));
 for(const [id,hkl] of [['pwF100',[1,0,0]],['pwF200',[2,0,0]],['pwF220',[2,2,0]]])
  $(id).addEventListener('click',()=>useHkl(hkl));
 window.addEventListener('crystal-language-change',render);
 return {get visible(){return visible;},setVisible(value){visible=!!value;if(visible){render();planeViewer?.resize();}else{setWavePlaying(false);planeViewer?.suspend?.();}},refresh:render};
}

/* Six sample k/spin states: one promoted electron leaves exactly one hole
 * at the SAME k. This is not a density-of-states calculation or to scale. */
function electronHoleDiagram(svg,pairs,gapEV){
 clearChart(svg,'Elektron–hol çiftlerinin aynı k durumlarında şematik gösterimi');
 const label=(x,y,value,color='#415b75',size=13,anchor='start')=>svgNode(svg,'text',
  {x,y,fill:color,'font-size':size,'font-weight':600,'text-anchor':anchor},value);
 const open=gapEV>1e-9,upperY=open?86:144,lowerY=open?213:166;
 label(24,28,'Her sütun: aynı k ve aynı spin · geçişler dikey', '#294965',16);
 svgNode(svg,'rect',{x:218,y:50,width:575,height:208,rx:12,
  fill:'#f7fbff',stroke:'#dbe7f3'});
 if(open)svgNode(svg,'rect',{x:220,y:upperY+17,width:571,height:lowerY-upperY-34,
  fill:'#e4f4e9','fill-opacity':'.75','data-carrier-gap':'true'});
 for(const [y,color] of [[upperY,'#e5a050'],[lowerY,'#337db7']])
  svgNode(svg,'line',{x1:250,x2:772,y1:y,y2:y,stroke:color,'stroke-width':3});
 label(14,upperY+4,'İletim bandı','#a66a27',14);
 label(14,lowerY+4,'Değerlik bandı','#22649a',14);
 label(505,open?153:118,open?'E₍g₎ = '+number(gapEV,2)+' eV':'E₍g₎ = 0 · bant teması',
  '#277b5d',14,'middle');
 for(let i=0;i<6;i++){
  const x=279+i*91,excited=i<pairs;
  label(x,282,'k'+(i+1),'#71859b',12,'middle');
  if(excited){
   svgNode(svg,'line',{x1:x,y1:lowerY-17,x2:x,y2:upperY+16,
    stroke:'#7e76ba','stroke-width':2,'stroke-dasharray':'4 4','data-carrier-pair':String(i)});
   svgNode(svg,'circle',{cx:x,cy:upperY,r:12,fill:'#227ac2',stroke:'#fff',
    'stroke-width':2,'data-carrier-electron':String(i)});
   label(x,upperY+4,'e⁻','#fff',10,'middle');
   svgNode(svg,'circle',{cx:x,cy:lowerY,r:12,fill:'#fff',stroke:'#dc813d',
    'stroke-width':3,'data-carrier-hole':String(i)});
   label(x,lowerY+4,'h⁺','#ad5c23',10,'middle');
  }else{
   svgNode(svg,'circle',{cx:x,cy:upperY,r:11,fill:'#fff',stroke:'#a9bacb',
    'stroke-width':2,'data-carrier-empty':String(i)});
   svgNode(svg,'circle',{cx:x,cy:lowerY,r:11,fill:'#227ac2',stroke:'#fff',
    'stroke-width':2,'data-carrier-valence':String(i)});
  }
 }
 label(236,300,'Dolu ●   Boş ○   Hol ◉ · seçili örnek durumlar','#59738c',11);
}

export function initSemiconductorLesson(host){
 let visible=false;
 const chart=$('scBandChart'),fermiChart=$('scFermiChart');
 const chainChart=$('scChainChart'),chainStages=[1,2,4,8,16,32,64];
 const dualChart=$('scDualChart');
 const dualPresets={metal:[1,1,0],dimer:[1.2,.8,0],ionic:[1,1,1.2]};
 const dualButtons={metal:'scDualMetal',dimer:'scDualDimer',ionic:'scDualIonic'};
 let dualPreset='dimer';
 let carrierPairs=0,guideStep=-1;
 let chainTimer=0,chainRunning=false;
 function stopChain(){
  clearInterval(chainTimer);chainTimer=0;chainRunning=false;
  $('scChainPlay').textContent='1 atomdan 64 atoma canlandır';
  $('scChainPlay').setAttribute('aria-pressed','false');
 }
 function renderChain(){
  if(!visible)return;
  const count=Number($('scChainAtoms').value),hopping=Number($('scChainHopping').value);
  const period=Number($('scPeriod').value);
  const levels=tightBindingChainLevels(count,hopping);
  $('scChainAtomsOutput').textContent=String(count);
  $('scChainHoppingOutput').textContent=number(hopping,2)+' eV';
  $('scChainSummary').replaceChildren(
   metric('Ayrık enerji seviyesi',String(levels.length)),
   metric('Sonlu enerji aralığı',number(levels.at(-1)-levels[0],3)+' eV'),
   metric('Sonsuz bant genişliği',number(4*hopping,3)+' eV'),
   metric('Zincir periyodu a',number(period,2)+' Å'));
  tightBindingDiagram(chainChart,count,hopping,period);
 }
 $('scChainAtoms').addEventListener('input',()=>{stopChain();renderChain();});
 $('scChainHopping').addEventListener('input',()=>{stopChain();renderChain();});
 $('scChainPlay').addEventListener('click',()=>{
  if(chainRunning){stopChain();return;}
  chainRunning=true;
  $('scChainPlay').textContent='Animasyonu durdur';
  $('scChainPlay').setAttribute('aria-pressed','true');
  let stage=0;
  const next=()=>{
   if(stage>=chainStages.length){stopChain();return;}
   $('scChainAtoms').value=String(chainStages[stage++]);
   renderChain();
  };
  next();chainTimer=setInterval(next,700);
 });
 function renderDual(){
  if(!visible)return;
  const intra=Number($('scDualIntra').value),inter=Number($('scDualInter').value);
  const delta=Number($('scDualDelta').value),period=Number($('scPeriod').value);
  const selectedK=Number($('scDualK').value);
  const gap=twoOrbitalBandGap(intra,inter,delta);
  $('scDualIntraOutput').textContent=number(intra,2)+' eV';
  $('scDualInterOutput').textContent=number(inter,2)+' eV';
  $('scDualDeltaOutput').textContent=number(delta,2)+' eV';
  $('scDualKOutput').textContent=number(selectedK,2);
  $('scDualSummary').replaceChildren(
   metric('Yasak bant aralığı Eg',number(gap,3)+' eV'),
   metric('Değerlik bandı üstü Ev',number(-gap/2,3)+' eV'),
   metric('İletim bandı altı Ec',number(gap/2,3)+' eV'),
   metric('BZ sınırı |k|',number(Math.PI/period,3)+' Å⁻¹'));
  for(const [key,id] of Object.entries(dualButtons))
   $(id).setAttribute('aria-pressed',String(dualPreset===key));
  twoOrbitalDiagram(dualChart,intra,inter,delta,period,selectedK);
  const weights=twoOrbitalWeights(selectedK,intra,inter,delta);
  const target=$('scDualWeights');target.replaceChildren();
  const heading=document.createElement('strong');heading.textContent='Seçili k için A/B orbital karakteri';
  target.appendChild(heading);
  if(weights.degenerate){
   const note=document.createElement('p');note.textContent='Bant temasında orbital karakteri tekil değildir.';
   target.appendChild(note);
  }else{
   for(const [band,title] of [['valence','Değerlik bandı'],['conduction','İletim bandı']]){
    const item=document.createElement('div');item.className='lesson-orbital-row';
    const label=document.createElement('span');label.textContent=title;
    const bar=document.createElement('div');bar.className='lesson-orbital-bar';
    bar.setAttribute('role','img');
    bar.setAttribute('aria-label',`${title}: A ${number(weights[band].A*100,1)}%, B ${number(weights[band].B*100,1)}%`);
    const a=document.createElement('span');a.className='lesson-orbital-A';a.style.width=(weights[band].A*100)+'%';
    const b=document.createElement('span');b.className='lesson-orbital-B';b.style.width=(weights[band].B*100)+'%';
    bar.append(a,b);
    const detail=document.createElement('small');detail.textContent=`A ${number(weights[band].A*100,1)}% · B ${number(weights[band].B*100,1)}%`;
    item.append(label,bar,detail);target.appendChild(item);
   }
  }
  renderCarrier();
 }
 for(const id of ['scDualIntra','scDualInter','scDualDelta'])
  $(id).addEventListener('input',()=>{dualPreset=null;renderDual();});
 $('scDualK').addEventListener('input',renderDual);
 dualChart.addEventListener('click',event=>{
  const point=dualChart.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
  const matrix=dualChart.getScreenCTM();if(!matrix)return;
  const local=point.matrixTransform(matrix.inverse());
  if(local.y<148||local.y>352)return;
  const selectedK=Math.max(-1,Math.min(1,(local.x-96)/(838-96)*2-1));
  $('scDualK').value=String(Math.round(selectedK*100)/100);
  renderDual();
 });
 for(const [key,id] of Object.entries(dualButtons))$(id).addEventListener('click',()=>{
  dualPreset=key;
  ['scDualIntra','scDualInter','scDualDelta'].forEach((input,i)=>$(input).value=String(dualPresets[key][i]));
  renderDual();
 });
 function renderCarrier(){
  if(!visible)return;
  const gap=twoOrbitalBandGap(Number($('scDualIntra').value),
   Number($('scDualInter').value),Number($('scDualDelta').value));
  electronHoleDiagram($('scCarrierChart'),carrierPairs,gap);
  $('scCarrierSummary').replaceChildren(
   metric('Üst banttaki elektron',String(carrierPairs)),
   metric('Alt banttaki hol',String(carrierPairs)),
   metric('Net uyarma yükü','0 · çiftler dengeli'),
   metric('Model E₍g₎',number(gap,3)+' eV'));
  $('scExcite').disabled=carrierPairs>=6;
  $('scRecombine').disabled=carrierPairs<=0;
 }
 $('scExcite').addEventListener('click',()=>{carrierPairs=Math.min(6,carrierPairs+1);renderCarrier();});
 $('scRecombine').addEventListener('click',()=>{carrierPairs=Math.max(0,carrierPairs-1);renderCarrier();});

 // A separate bulk carrier-density model: it intentionally does not inherit the
 // one-state Fermi slider, tight-binding band gap or currently opened CIF.
 let dopingKind='intrinsic';
 const dopingButtons={intrinsic:'scDopingIntrinsic',n:'scDopingN',p:'scDopingP'};
 const superscript=value=>String(value).replace(/[-0-9]/g,d=>({
  '-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'
 })[d]);
 const formatDensity=value=>{
  if(value===0)return '0 cm⁻³';
  const exponent=Math.floor(Math.log10(value));
  return number(value/10**exponent,2)+' × 10'+superscript(exponent)+' cm⁻³';
 };
 const dopingAnswer=()=>dopingKind==='n'?'electrons':dopingKind==='p'?'holes':'intrinsic';
 function renderDoping(){
  if(!visible)return;
  const temperatureK=Number($('scDopingTemp').value);
  const magnitude=10**Number($('scDopingExponent').value);
  const result=idealDopedCarriers({
   donorsCm3:dopingKind==='n'?magnitude:0,
   acceptorsCm3:dopingKind==='p'?magnitude:0,
   temperatureK
  });
  $('scDopingTempOutput').textContent=temperatureK+' K';
  $('scDopingConcentrationOutput').textContent=dopingKind==='intrinsic'?
   '0 cm⁻³ (saf)':formatDensity(magnitude);
  $('scDopingExponent').disabled=dopingKind==='intrinsic';
  Object.entries(dopingButtons).forEach(([kind,id])=>
   $(id).setAttribute('aria-pressed',String(dopingKind===kind)));
  $('scDopingSummary').replaceChildren(
   metric('Elektron · n',formatDensity(result.electronsCm3)),
   metric('Hol · p',formatDensity(result.holesCm3)),
   metric('Saf denge · nᵢ',formatDensity(result.intrinsicCm3)),
   metric('Fermi kayması · EF − Ei',
    (result.fermiShiftEV>=0?'+':'')+number(result.fermiShiftEV,3)+' eV'));
  $('scDopingExplanation').textContent=dopingKind==='intrinsic'?
   'Saf denge: termal üretilen her elektronun bir hol eşi vardır; n = p = nᵢ. Fermi seviyesi Ei yakınındadır.':
   dopingKind==='n'?
    'Donörler fazladan elektron sağlar: n artar, p azalır ve EF iletim bandına yaklaşır. Holler yok olmaz; azınlık taşıyıcı olarak kalır.':
    'Akseptörler elektron kabul ettiğinde değerlik bandında hareketli holler çoğalır: p artar, n azalır ve EF değerlik bandına yaklaşır.';
  $('scDopingValidity').textContent=result.nondegenerate?
   'Model bu ayarda bant kenarlarından en az 3 kBT uzakta: Boltzmann yaklaşımı için öğretici kullanım aralığında.':
   'Dikkat: EF bant kenarına 3 kBT’den fazla yaklaştı. Dejenere durumlarda Fermi–Dirac integralleri gerekir; verilen değerler yalnızca yaklaşık eğilimdir.';
  const svg=$('scDopingChart');
  clearChart(svg,'Donör ve akseptörlerin taşıyıcı dengesi ve Fermi seviyesine etkisi');
  const txt=(x,y,value,color='#4a6780',size=14,anchor='start')=>
   svgNode(svg,'text',{x,y,fill:color,'font-size':size,
    'font-weight':600,'text-anchor':anchor},value);
  const line=(x1,y1,x2,y2,color,width=2,extra={})=>
   svgNode(svg,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...extra});
  txt(20,30,'Enerji diyagramı','#244b6e',16);
  txt(500,30,'Taşıyıcı yoğunluğu (log ölçek)','#244b6e',16);
  line(470,50,470,325,'#dce7f1',1);
  const top=68,base=308,span=1.25;
  const Y=energy=>top+(result.ecEV+.065-energy)/span*(base-top);
  const ecY=Y(result.ecEV),evY=Y(result.evEV);
  svgNode(svg,'rect',{x:92,y:53,width:320,height:ecY-53,fill:'#dbeafe'});
  svgNode(svg,'rect',{x:92,y:evY,width:320,height:314-evY,fill:'#fff0df'});
  line(92,ecY,412,ecY,'#227ac2',4,{'data-doping-band':'conduction'});
  line(92,evY,412,evY,'#d98236',4,{'data-doping-band':'valence'});
  txt(25,ecY+5,'Ec','#226b9e',14);
  txt(25,evY+5,'Ev','#b96726',14);
  txt(254,ecY-10,'İletim bandı','#226b9e',12,'middle');
  txt(254,evY+22,'Değerlik bandı','#b96726',12,'middle');
  const efY=Y(result.fermiEV),eiY=Y(result.intrinsicFermiEV);
  if(dopingKind!=='intrinsic'){
   line(102,eiY,223,eiY,'#64748b',2,
    {'stroke-dasharray':'4 6','data-doping-intrinsic':'true'});
   txt(96,eiY-6,'Ei','#64748b',12);
  }
  line(205,efY,414,efY,'#b02956',3,
   {'stroke-dasharray':'9 5','data-doping-fermi':'true'});
  txt(414,efY+5,dopingKind==='intrinsic'?'EF = Ei':'EF','#a61d4d',14,'end');
  line(74,56,74,320,'#9badbf',1.5);
  svgNode(svg,'polygon',{points:'74,51 68,62 80,62',fill:'#9badbf'});
  txt(34,344,'Enerji E ↑','#58738c',12);
  const lx=566,rx=847,lo=6,hi=20,X=log=>lx+(log-lo)/(hi-lo)*(rx-lx);
  for(const exp of [6,8,10,12,14,16,18,20]){
   const x=X(exp);
   line(x,67,x,309,'#e7edf4',1);
   txt(x,334,String(exp),'#607890',11,'middle');
  }
  txt(720,359,'log₁₀(cm⁻³)','#58738c',13,'middle');
  for(const [kind,value,y,color,description] of [
   ['electrons',result.electronsCm3,129,'#227ac2','n · elektron'],
   ['holes',result.holesCm3,230,'#d98236','p · hol']]){
   const xEnd=Math.max(lx,Math.min(rx,X(Math.log10(value))));
   txt(505,y-28,description,color,14);
   svgNode(svg,'rect',{x:lx,y,width:xEnd-lx,height:33,rx:6,fill:color,
    opacity:.9,'data-doping-carrier':kind,'data-log10':Math.log10(value).toFixed(5)});
   svgNode(svg,'circle',{cx:xEnd,cy:y+16.5,r:4,fill:'#fff',stroke:color,'stroke-width':2});
   txt(lx,y+54,formatDensity(value),color,13);
  }
  const niX=X(Math.log10(result.intrinsicCm3));
  line(niX,70,niX,306,'#6b7280',1.6,
   {'stroke-dasharray':'3 5','data-doping-ni':'true'});
  txt(niX,63,'nᵢ','#6b7280',12,'middle');
 }
 for(const [kind,id] of Object.entries(dopingButtons)){
  $(id).addEventListener('click',()=>{
   dopingKind=kind;
   $('scDopingPrediction').value='';
   $('scDopingFeedback').textContent='';
   $('scDopingFeedback').removeAttribute('data-result');
   renderDoping();
  });
 }
 for(const id of ['scDopingExponent','scDopingTemp'])
  $(id).addEventListener('input',renderDoping);
 $('scDopingCheck').addEventListener('click',()=>{
  const selection=$('scDopingPrediction').value,answer=dopingAnswer();
  if(!selection){$('scDopingFeedback').textContent='Önce tahminini seç.';return;}
  const correct=selection===answer;
  const detail=dopingKind==='intrinsic'?
   'Saf dengede termal oluşan elektron ve hol yoğunluğu eşittir: n = p = nᵢ.':
   dopingKind==='n'?
    'Donörler elektronları çoğunluk taşıyıcı yapar; n − p = ND ve n·p = nᵢ².':
    'Akseptörler holleri çoğunluk taşıyıcı yapar; p − n = NA ve n·p = nᵢ².';
  $('scDopingFeedback').textContent=(correct?'Doğru! ':'Henüz değil. ')+detail;
  $('scDopingFeedback').setAttribute('data-result',correct?'correct':'retry');
 });

 // P2: static 1D PN depletion approximation; the first two steps explicitly
 // illustrate ideas only, not a time-dependent drift-diffusion solution.
 let pnPhase='steady';
 const pnPhaseIds={separate:'scPnSeparate',diffuse:'scPnDiffuse',steady:'scPnSteady'};
 function renderPn(){
  if(!visible)return;
  const acceptorsCm3=10**Number($('scPnAcceptors').value);
  const donorsCm3=10**Number($('scPnDonors').value);
  const voltage=Number($('scPnBias').value);
  const effectiveBias=pnPhase==='steady'?voltage:0;
  const j=idealPnJunction({acceptorsCm3,donorsCm3,
   appliedBiasV:effectiveBias,temperatureK:300});
  $('scPnAcceptorsOutput').textContent=formatDensity(acceptorsCm3);
  $('scPnDonorsOutput').textContent=formatDensity(donorsCm3);
  $('scPnBiasOutput').textContent=(voltage>0?'+':'')+number(voltage,2)+' V';
  $('scPnBias').disabled=pnPhase!=='steady';
  $('scPnPrediction').disabled=pnPhase!=='steady';
  $('scPnCheck').disabled=pnPhase!=='steady';
  Object.entries(pnPhaseIds).forEach(([phase,id])=>
   $(id).setAttribute('aria-pressed',String(phase===pnPhase)));
  const unitWidth=cm=>number(cm*1e4,3)+' µm';
  if(pnPhase==='separate'){
   $('scPnSummary').replaceChildren(
    metric('Aşama','Temas öncesi'),metric('Tükenim bölgesi','Henüz oluşmadı'));
   $('scPnExplanation').textContent='İki parça temas etmiyor. p bölgesinde holler, n bölgesinde elektronlar çoğunluktadır. Henüz ortak bir PN geçiş bölgesi ve ona ait yerleşik alan yoktur.';
  }else if(pnPhase==='diffuse'){
   $('scPnSummary').replaceChildren(
    metric('Elektron difüzyonu','n → p'),metric('Hol difüzyonu','p → n'));
   $('scPnExplanation').textContent='İlk anda elektronlar n’den p’ye, holler p’den n’ye yayılır. Geride kalan A⁻ ve D⁺ sabit iyonları alan oluşturur. Bu şema bir zaman çözümü değildir; nihai genişliği görmek için 3. adımı seç.';
  }else{
   $('scPnSummary').replaceChildren(
    metric('Yerleşik potansiyel Vbi',number(j.builtInPotentialV,3)+' V'),
    metric('Etkin bariyer Vbi − Va',number(j.barrierV,3)+' V'),
    metric('Tükenim genişliği W',unitWidth(j.depletionWidthCm)),
    metric('p tarafı · xp',unitWidth(j.pWidthCm)),
    metric('n tarafı · xn',unitWidth(j.nWidthCm)),
    metric('En büyük |E|',number(j.peakFieldVcm/1000,1)+' kV/cm'));
   $('scPnExplanation').textContent=voltage===0?
    'Termal dengede difüzyon ve sürüklenme akımları birbirini dengeler; toplam akım sıfırdır fakat tükenim bölgesinde elektrik alan vardır. Sabit A⁻ solda, D⁺ sağdadır; E alanı n’den p’ye yönelir.':
    voltage>0?
     'İleri öngerilim, eklem bariyerini azaltır ve tükenim bölgesini daraltır. Taşıyıcı enjeksiyonu ve diyot akımı bu elektrostatik modelin dışındadır.':
     'Ters öngerilim, bariyeri büyütür ve tükenim bölgesini genişletir. Sızıntı ve kırılma mekanizmaları bu modelde çözülmez.';
  }
  const charge=$('scPnChargeChart');
  clearChart(charge,'p solda, n sağda; iyonlaşmış katkılar ve PN eklemi');
  const textAt=(svg,x,y,value,color='#476681',size=14,align='start')=>
   svgNode(svg,'text',{x,y,fill:color,'font-size':size,
    'font-weight':650,'text-anchor':align},value);
  const drawLine=(svg,x1,y1,x2,y2,color='#93a8bd',width=1.5,extra={})=>
   svgNode(svg,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...extra});
  svgNode(charge,'rect',{x:34,y:48,width:416,height:140,rx:12,fill:'#fff1e5'});
  svgNode(charge,'rect',{x:450,y:48,width:416,height:140,rx:12,fill:'#e5f2ff'});
  textAt(charge,55,32,'p-tipi · holler','#af6b2f',17);
  textAt(charge,845,32,'n-tipi · elektronlar','#236b9c',17,'end');
  drawLine(charge,450,41,450,206,'#617a94',1.8,{'stroke-dasharray':'5 5'});
  textAt(charge,450,222,'x = 0 · metalürjik eklem','#506984',12,'middle');
  const domain=2,scale=416/domain;
  let pEdge=450,nEdge=450;
  if(pnPhase==='steady'){
   pEdge=Math.max(35,450-j.pWidthCm*1e4*scale);
   nEdge=Math.min(865,450+j.nWidthCm*1e4*scale);
   svgNode(charge,'rect',{x:pEdge,y:48,width:450-pEdge,height:140,fill:'#fbd8c4',
    'data-pn-depletion':'p'});
   svgNode(charge,'rect',{x:450,y:48,width:nEdge-450,height:140,fill:'#c9e1fa',
    'data-pn-depletion':'n'});
   for(const [start,end,sign,color,side] of [
    [pEdge,450,'−','#bc6331','acceptor'],
    [450,nEdge,'+','#226eb0','donor']]){
    const width=end-start,n=Math.max(0,Math.min(20,Math.floor(width/20)));
    for(let i=0;i<n;i++){
     const x=start+width*(i+.5)/n;
     const y=70+(i%3)*42;
     svgNode(charge,'circle',{cx:x,cy:y,r:9,fill:'#fff',stroke:color,
      'stroke-width':2,'data-pn-ion':side});
     textAt(charge,x,y+4,sign,color,13,'middle');
    }
   }
   drawLine(charge,pEdge,194,pEdge,206,'#8b9db0',1);
   drawLine(charge,nEdge,194,nEdge,206,'#8b9db0',1);
   textAt(charge,238,233,'xp = '+unitWidth(j.pWidthCm),'#a55e2a',12,'middle');
   textAt(charge,675,233,'xn = '+unitWidth(j.nWidthCm),'#246a9c',12,'middle');
   drawLine(charge,572,247,340,247,'#8a3360',3.5,{'data-pn-field-arrow':'n-to-p'});
   svgNode(charge,'polygon',{points:'326,247 345,239 345,255',fill:'#8a3360'});
   textAt(charge,450,261,'E: n → p (←)','#8a3360',12,'middle');
  }else if(pnPhase==='diffuse'){
   for(const [x,dir,label,color] of [
    [560,-1,'e⁻ : n → p','#256ba1'],[340,1,'h⁺ : p → n','#bc7838']]){
    drawLine(charge,x,119,x+dir*170,119,color,4,
     {'data-pn-diffusion':dir<0?'electron':'hole'});
    const tip=x+dir*170;
    svgNode(charge,'polygon',{points:dir<0?
     (tip-12)+',119 '+(tip+9)+',111 '+(tip+9)+',127':
     (tip+12)+',119 '+(tip-9)+',111 '+(tip-9)+',127',fill:color});
    textAt(charge,x,106,label,color,14,'middle');
   }
   textAt(charge,450,232,'Geçici yayılma · nitel anlatım','#596f85',13,'middle');
  }else{
   drawLine(charge,442,48,442,188,'#fff',10);
   textAt(charge,450,237,'Temas henüz yok','#596f85',13,'middle');
  }
  // Mobile carriers are drawn only outside the indicated depletion widths.
  const pSpan=Math.max(0,pEdge-52),nSpan=Math.max(0,847-nEdge);
  for(let i=0;i<5;i++){
   const y=75+(i%2)*60;
   if(pSpan>32){
    const x=52+pSpan*(i+.5)/5;
    svgNode(charge,'circle',{cx:x,cy:y,r:8,fill:'#fff',
     stroke:'#c47c38','stroke-width':2,'data-pn-mobile':'hole'});
    textAt(charge,x,y+4,'+','#ba783a',12,'middle');
   }
   if(nSpan>32){
    const nx=nEdge+nSpan*(i+.5)/5;
    svgNode(charge,'circle',{cx:nx,cy:y,r:8,fill:'#227ac2',
     stroke:'#fff','stroke-width':1.5,'data-pn-mobile':'electron'});
    textAt(charge,nx,y+4,'−','#fff',12,'middle');
   }
  }
  const field=$('scPnFieldChart');
  clearChart(field,'Tükenim yaklaşımında elektrik alan ve potansiyel profili');
  if(pnPhase!=='steady'){
   textAt(field,450,175,'Nicel profil yalnızca 3. aşamada gösterilir.','#516d86',18,'middle');
   textAt(field,450,205,'İlk difüzyon geçici bir süreçtir; burada Poisson-difüzyon zaman çözümü yapılmıyor.','#647b90',13,'middle');
  }else{
   const left={start:80,end:425},right={start:530,end:868};
   const X=(panel,um)=>panel.start+(um+domain)/(2*domain)*(panel.end-panel.start);
   const yE=e=>102+Math.min(1.04,-e/j.peakFieldVcm)*169;
   const yPhi=v=>282-v/j.barrierV*180;
   textAt(field,18,28,'Elektrik alan E(x) · n → p','#9d3d63',16);
   textAt(field,488,28,'Elektrostatik potansiyel φ(x)','#286c9e',16);
   for(const [panel,yBase] of [[left,102],[right,282]]){
    drawLine(field,panel.start,54,panel.start,304,'#93a8bd',1.2);
    drawLine(field,panel.start,yBase,panel.end,yBase,'#93a8bd',1.2);
    for(const microns of [-2,-1,0,1,2]){
     const x=X(panel,microns);
     drawLine(field,x,54,x,304,'#edf1f5',1);
     textAt(field,x,325,String(microns),'#70859a',11,'middle');
    }
   }
   textAt(field,248,352,'x (µm) · p ← 0 → n','#668099',12,'middle');
   textAt(field,700,352,'x (µm) · p ← 0 → n','#668099',12,'middle');
   const samples=Array.from({length:241},(_,i)=>{
    const xUm=-domain+2*domain*i/240;
    return {xUm,...pnJunctionProfile(j,xUm*1e-4)};
   });
   svgNode(field,'path',{d:linePath(samples,p=>[
    X(left,p.xUm),yE(p.fieldVcm)]),fill:'none',stroke:'#b02f64',
    'stroke-width':3.5,'data-pn-field-curve':'true'});
   svgNode(field,'path',{d:linePath(samples,p=>[
    X(right,p.xUm),yPhi(p.potentialV)]),fill:'none',stroke:'#227ac2',
    'stroke-width':3.5,'data-pn-potential-curve':'true'});
   svgNode(field,'circle',{cx:X(left,0),cy:yE(-j.peakFieldVcm),r:5,
    fill:'#b02f64','data-pn-peak':'true'});
   textAt(field,88,72,'E = 0','#7a8899',12);
   textAt(field,90,291,'−'+number(j.peakFieldVcm/1000,1)+' kV/cm','#9b3460',12);
   textAt(field,544,291,'0 V','#657e96',12);
   textAt(field,544,96,number(j.barrierV,3)+' V','#216b9c',12);
  }
  $('scPnValidity').textContent=pnPhase!=='steady'?
   'Bu aşama hareketin yönünü anlatır; sayısal Poisson çözümü yalnızca üçüncü aşamanın statik tükenim profili içindir.':
   (voltage===0?'Termal denge, uygulanan gerilim sıfırdır.':
    'Dış gerilim altında termal denge varsayılmaz; burada yalnızca durağan tükenim genişliği yaklaştırması kullanılır.')+
   ' Grafikler x ekseninde ±2 µm sabit fiziksel ölçeklidir; çok dar tükenim bölgeleri ince görünebilir.';
 }
 for(const [phase,id] of Object.entries(pnPhaseIds))
  $(id).addEventListener('click',()=>{
   pnPhase=phase;
   $('scPnPrediction').value='';
   $('scPnFeedback').textContent='';
   $('scPnFeedback').removeAttribute('data-result');
   renderPn();
  });
 for(const id of ['scPnAcceptors','scPnDonors','scPnBias'])
  $(id).addEventListener('input',renderPn);
 $('scPnCheck').addEventListener('click',()=>{
  const selected=$('scPnPrediction').value;
  if(!selected){$('scPnFeedback').textContent='Önce bir yanıt seç.';return;}
  const correct=selected==='n-to-p';
  $('scPnFeedback').textContent=(correct?'Doğru! ':'Bir daha düşün: ')+
   'Tükenimde n tarafında pozitif D⁺, p tarafında negatif A⁻ iyonları kalır. Alan pozitiften negatife, yani n’den p’ye (sola) yönelir. Elektronların elektriksel sürüklenme yönü ise alanın tersidir. Katkılama laboratuvarında A⁻/D⁺ kökenini tekrar inceleyebilirsin.';
  $('scPnFeedback').setAttribute('data-result',correct?'correct':'retry');
 });

 // P3 ideal Shockley diode. Current and minority profiles share the SAME Is
 // and junction electrostatics, but this is a low-injection teaching model.
 let diodePreset='forward';
 const diodePresets={reverse:['scDiodeReverse',-.3],
  zero:['scDiodeZero',0],forward:['scDiodeForward',.45]};
 const currentText=amps=>{
  const abs=Math.abs(amps),sign=amps<0?'−':'';
  if(abs<1e-9)return sign+number(abs*1e12,3)+' pA';
  if(abs<1e-6)return sign+number(abs*1e9,3)+' nA';
  if(abs<1e-3)return sign+number(abs*1e6,3)+' µA';
  return sign+number(abs*1e3,3)+' mA';
 };
 function clearDiodePrediction(){
  $('scDiodePrediction').value='';
  $('scDiodeFeedback').textContent='';
  $('scDiodeFeedback').removeAttribute('data-result');
 }
 function renderDiode(){
  if(!visible)return;
  const voltage=Number($('scDiodeVoltage').value),
   areaMm2=Number($('scDiodeArea').value),
   acceptorsCm3=10**Number($('scDiodeAcceptors').value),
   donorsCm3=10**Number($('scDiodeDonors').value);
  const s=idealDiodeState({acceptorsCm3,donorsCm3,
   appliedBiasV:voltage,areaMm2});
  $('scDiodeVoltageOutput').textContent=(voltage>0?'+':'')+number(voltage,3)+' V';
  $('scDiodeAreaOutput').textContent=number(areaMm2,1)+' mm²';
  $('scDiodeAcceptorsOutput').textContent=formatDensity(acceptorsCm3);
  $('scDiodeDonorsOutput').textContent=formatDensity(donorsCm3);
  Object.entries(diodePresets).forEach(([key,[id]])=>
   $(id).setAttribute('aria-pressed',String(diodePreset===key)));
  $('scDiodeSummary').replaceChildren(
   metric('Diyot akımı · I',currentText(s.currentA)),
   metric('Ters doyma · Is',currentText(s.saturationCurrentA)),
   metric('Bariyer · Vbi − Va',number(s.junction.barrierV,3)+' V'),
   metric('Tükenim genişliği',number(s.junction.depletionWidthCm*1e4,3)+' µm'),
   metric('p tarafı azınlık nₚ(kenar)',
    formatDensity(s.electronMinorityP0Cm3*s.boundaryFactor)),
   metric('n tarafı azınlık pₙ(kenar)',
    formatDensity(s.holeMinorityN0Cm3*s.boundaryFactor)));
  $('scDiodeExplanation').textContent=voltage>0?
   'İleri kutuplamada bariyer azalır. p tarafına elektron, n tarafına hol enjekte edilir; kenar yoğunlukları exp(V/VT) ile artar. Nötr bölgelerde fazla taşıyıcılar difüzyon ve yeniden birleşmeyle azalır, akım üstel büyür.':
   voltage<0?
    'Ters kutuplamada bariyer artar; azınlık taşıyıcılar geçiş kenarından çekilir. İdeal modelde akım −Is değerine yaklaşır. Gerçekte tükenim bölgesindeki üretim, sızıntı ve kırılma ek akımlar oluşturabilir.':
    'Sıfır dış gerilimde iki yönlü taşıyıcı akışı birbirini dengeler; net akım I=0, kenardaki azınlık yoğunlukları denge değerlerindedir.';
  const problems=[];
  if(!s.lowInjection)problems.push('Yüksek enjeksiyon sınırı: kenardaki azınlık yoğunluğu çoğunluğun %10’unu aştı; Shockley yaklaşımı güvenilir değildir.');
  if(!s.depletionValid)problems.push('Bariyer 3 VT altına indi; basit tükenim yaklaşımı geçerliliğini kaybedebilir.');
  $('scDiodeValidity').textContent=problems.length?problems.join(' '):
   'Modelin seçili ayarı düşük enjeksiyon ve pozitif bariyer aralığındadır. D=25/10 cm²/s ve L=20/10 µm öğretici sabitleri gerçek Si örneği için ölçüm yerine geçmez.';
  const drawText=(svg,x,y,label,color='#4b6882',size=13,align='start')=>
   svgNode(svg,'text',{x,y,fill:color,'font-size':size,
    'font-weight':650,'text-anchor':align},label);
  const drawLine=(svg,x1,y1,x2,y2,color='#9db1c3',width=1,other={})=>
   svgNode(svg,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...other});
  const carrier=$('scDiodeCarrierChart');
  clearChart(carrier,'Azınlık elektron ve hollerin sınırdan nötr bölgeye üstel yayılımı');
  svgNode(carrier,'rect',{x:65,y:40,width:385,height:203,fill:'#fdf0e6',rx:9});
  svgNode(carrier,'rect',{x:450,y:40,width:385,height:203,fill:'#e8f4ff',rx:9});
  drawText(carrier,78,25,'p bölgesi · azınlık e⁻','#286ca0',16);
  drawText(carrier,822,25,'n bölgesi · azınlık h⁺','#be7132',16,'end');
  drawLine(carrier,450,35,450,249,'#8499ad',1.6,{'stroke-dasharray':'6 6'});
  drawLine(carrier,68,144,833,144,'#91a7bd',1.8);
  drawText(carrier,452,265,'Tükenim bölgesi sınırları · x/L ölçeği','#647d94',12,'middle');
  drawText(carrier,75,154,'Denge Δ=0','#7d8996',11);
  const sideData=[
   {side:'p',color:'#227ac2',start:75,end:450,name:'electron'},
   {side:'n',color:'#d98236',start:450,end:825,name:'hole'}
  ];
  const sense=voltage===0?0:voltage>0?1:-1;
  for(const side of sideData){
   const samples=Array.from({length:121},(_,i)=>{
    const fraction=i/120,x=side.start+(side.end-side.start)*fraction;
    const distance=side.side==='p'?(1-fraction)*4.5:fraction*4.5;
    const profile=idealDiodeMinorityProfile(s,side.side,
     distance*(side.side==='p'?s.electronDiffusionLengthCm:s.holeDiffusionLengthCm));
    const excess=profile.excessCm3;
    const edgeExcess=(side.side==='p'?s.electronMinorityP0Cm3:s.holeMinorityN0Cm3)*s.relativeExcess;
    const relative=edgeExcess===0?0:excess/Math.abs(edgeExcess);
    return [x,144-relative*78];
   });
   svgNode(carrier,'path',{d:linePath(samples,p=>p),fill:'none',
    stroke:side.color,'stroke-width':4,
    'data-diode-minority':side.name,'data-bias-sign':String(sense)});
  }
  if(sense!==0){
   const arrow=(x1,x2,y,color,ident)=>{
    drawLine(carrier,x1,y,x2,y,color,3.5,{'data-diode-flow':ident});
    const d=x2>x1?1:-1;
    svgNode(carrier,'polygon',{points:
     (x2+d*11)+','+y+' '+(x2-d*7)+','+(y-7)+' '+(x2-d*7)+','+(y+7),fill:color});
   };
   const forward=voltage>0;
   arrow(forward?385:265,forward?265:385,66,'#227ac2','electron');
   arrow(forward?515:635,forward?635:515,66,'#d98236','hole');
   drawText(carrier,450,230,forward?
    'İleri: iki tarafta enjeksiyon ↑':'Ters: kenardan azınlık taşıyıcı çekilmesi ↓',
    '#385f7a',13,'middle');
  }else{
   drawText(carrier,450,226,'Net enjeksiyon yok · Δn = Δp = 0','#55738d',13,'middle');
  }
  const iv=$('scDiodeIvChart');
  clearChart(iv,'Şokley diyotunun ileri üstel akımı ve ters doyma akımı');
  const vT=s.thermalVoltageV,rect={top:60,bottom:302};
  const panels=[{x0:70,x1:415},{x0:537,x1:864}];
  drawText(iv,22,23,'İleri kutuplama · I (mA)','#256da4',16);
  drawText(iv,485,23,'Ters kutuplama · I / Is','#b16c35',16);
  // Two scales prevent a visually misleading vanishing reverse branch.
  const xForward=v=>panels[0].x0+v/.55*(panels[0].x1-panels[0].x0);
  const positiveMax=s.saturationCurrentA*Math.expm1(.55/vT)*1e3;
  const yForward=ampsMilli=>rect.bottom-
   ampsMilli/positiveMax*(rect.bottom-rect.top);
  const xReverse=v=>panels[1].x0+(v+.5)/.5*(panels[1].x1-panels[1].x0);
  const yReverse=ratio=>rect.bottom-(ratio+1.1)/1.2*(rect.bottom-rect.top);
  for(const [panel,name] of [[panels[0],'forward'],[panels[1],'reverse']]){
   drawLine(iv,panel.x0,rect.top,panel.x0,rect.bottom,'#879db0',1.4);
   drawLine(iv,panel.x0,rect.bottom,panel.x1,rect.bottom,'#879db0',1.4);
   for(let step=0;step<=4;step++){
    const y=rect.bottom-(rect.bottom-rect.top)*step/4;
    drawLine(iv,panel.x0,y,panel.x1,y,'#e5ecf4',1);
    const value=name==='forward'?positiveMax*step/4:-1.1+1.2*step/4;
    drawText(iv,panel.x0-8,y+4,number(value,name==='forward'?
     (positiveMax>=1?2:positiveMax>=.01?3:positiveMax>=.0001?5:7):1),
     '#73889c',11,'end');
   }
  }
  for(let i=0;i<=5;i++){
   const vf=.55*i/5,vr=-.5+i*.1;
   const xf=xForward(vf),xr=xReverse(vr);
   drawLine(iv,xf,rect.bottom,xf,rect.bottom+5);
   drawLine(iv,xr,rect.bottom,xr,rect.bottom+5);
   drawText(iv,xf,rect.bottom+21,number(vf,2),'#71869a',11,'middle');
   drawText(iv,xr,rect.bottom+21,number(vr,1),'#71869a',11,'middle');
  }
  const positive=Array.from({length:111},(_,i)=>{
   const v=.55*i/110;
   return {v,currentMilli:s.saturationCurrentA*Math.expm1(v/vT)*1e3};
  });
  svgNode(iv,'path',{d:linePath(positive,p=>[
   xForward(p.v),yForward(p.currentMilli)]),fill:'none',stroke:'#227ac2',
   'stroke-width':3.7,'data-diode-iv-forward':'true'});
  const negative=Array.from({length:101},(_,i)=>{
   const v=-.5+i*.005;
   return {v,ratio:Math.expm1(v/vT)};
  });
  svgNode(iv,'path',{d:linePath(negative,p=>[
   xReverse(p.v),yReverse(p.ratio)]),fill:'none',stroke:'#d98236',
   'stroke-width':3.5,'data-diode-iv-reverse':'true'});
  if(voltage>=0){
   const dotY=yForward(s.currentA*1e3);
   svgNode(iv,'circle',{cx:xForward(voltage),cy:dotY,r:6,fill:'#227ac2',
    stroke:'#fff','stroke-width':2.5,'data-diode-point':'forward'});
  }else{
   svgNode(iv,'circle',{cx:xReverse(voltage),cy:yReverse(s.relativeExcess),
    r:6,fill:'#d98236',stroke:'#fff','stroke-width':2.5,
    'data-diode-point':'reverse'});
  }
  drawText(iv,244,361,'Uygulanan gerilim Va (V)','#5b748c',13,'middle');
  drawText(iv,701,361,'Uygulanan gerilim Va (V)','#5b748c',13,'middle');
  drawText(iv,733,51,'I → −Is (ters doyma)','#ac703b',11,'middle');
 }
 for(const [key,[id,voltage]] of Object.entries(diodePresets))
  $(id).addEventListener('click',()=>{
   diodePreset=key;
   $('scDiodeVoltage').value=String(voltage);
   clearDiodePrediction();renderDiode();
  });
 for(const id of ['scDiodeVoltage','scDiodeArea','scDiodeAcceptors','scDiodeDonors'])
  $(id).addEventListener('input',()=>{
   diodePreset=null;clearDiodePrediction();renderDiode();
  });
 $('scDiodeUsePn').addEventListener('click',()=>{
  $('scDiodeAcceptors').value=$('scPnAcceptors').value;
  $('scDiodeDonors').value=$('scPnDonors').value;
  clearDiodePrediction();renderDiode();
 });
 $('scDiodeCheck').addEventListener('click',()=>{
  const selected=$('scDiodePrediction').value;
  if(!selected){$('scDiodeFeedback').textContent='Önce bir yanıt seç.';return;}
  const applied=Number($('scDiodeVoltage').value);
  const expected=applied>0?'positive':applied<0?'negative':'zero';
  const correct=selected===expected;
  const why=applied>0?
   'İleri gerilim bariyeri azaltır; sınırdaki azınlık yoğunlukları e^(V/VT) ile artar ve ideal difüzyon akımı pozitiftir.':
   applied<0?
    'Ters gerilim kenardaki azınlıkları çeker; ideal Shockley akımı yaklaşık −Is ile sınırlanır. Gerçek diyotta sızıntı veya kırılma olabilir.':
    'V=0 için difüzyon ve sürüklenme katkıları dengelenir; net akım tam sıfırdır.';
  $('scDiodeFeedback').textContent=(correct?'Doğru! ':'Birlikte düzeltelim: ')+why+
   ' İlgili grafik ve P2 tükenim bölümündeki bariyer açıklamasına bakabilirsin.';
  $('scDiodeFeedback').setAttribute('data-result',correct?'correct':'retry');
 });

 // P4: two forward current mechanisms, ohmic leakage and terminal series drop.
 // Reuse P3's diffusion Is so removing all nonidealities recovers P3 exactly.
 const realEnabled={recombination:true,series:true,shunt:true};
 const realSwitchIds={recombination:'scRealRecombination',
  series:'scRealSeries',shunt:'scRealShunt'};
 function resetRealFeedback(){
  $('scRealPrediction').value='';
  $('scRealFeedback').textContent='';
  $('scRealFeedback').removeAttribute('data-result');
 }
 function realDiodeOptions(bias=null){
  return {acceptorsCm3:10**Number($('scRealAcceptors').value),
   donorsCm3:10**Number($('scRealDonors').value),
   areaMm2:Number($('scRealArea').value),
   appliedBiasV:bias===null?Number($('scRealVoltage').value):bias,
   recombinationRatio:10**Number($('scRealRecombinationRatio').value),
   seriesOhms:Number($('scRealSeriesOhms').value),
   shuntOhms:10**Number($('scRealShuntOhmsLog').value),
   includeRecombination:realEnabled.recombination,
   includeSeries:realEnabled.series,includeShunt:realEnabled.shunt};
 }
 const realText=(svg,x,y,value,color='#526c84',size=12,anchor='start')=>
  svgNode(svg,'text',{x,y,fill:color,'font-size':size,
   'font-weight':650,'text-anchor':anchor},value);
 const realLine=(svg,x1,y1,x2,y2,color='#dbe5ef',weight=1,attrs={})=>
  svgNode(svg,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':weight,...attrs});
 function renderRealDiode(){
  if(!visible)return;
  const options=realDiodeOptions(),s=realDiodeState(options);
  $('scRealVoltageOutput').textContent=(options.appliedBiasV>0?'+':'')+
   number(options.appliedBiasV,3)+' V';
  $('scRealRecombinationOutput').textContent='10^'+number(Math.log10(options.recombinationRatio),1);
  $('scRealSeriesOutput').textContent=number(options.seriesOhms,0)+' Ω';
  $('scRealShuntOutput').textContent='10^'+number(Math.log10(options.shuntOhms),1)+' Ω';
  $('scRealAcceptorsOutput').textContent=formatDensity(options.acceptorsCm3);
  $('scRealDonorsOutput').textContent=formatDensity(options.donorsCm3);
  $('scRealAreaOutput').textContent=number(options.areaMm2,1)+' mm²';
  for(const [key,id] of Object.entries(realSwitchIds))
   $(id).setAttribute('aria-pressed',String(realEnabled[key]));
  $('scRealIdeal').setAttribute('aria-pressed',String(!Object.values(realEnabled).some(Boolean)));
  $('scRealAll').setAttribute('aria-pressed',String(Object.values(realEnabled).every(Boolean)));
  $('scRealSummary').replaceChildren(
   metric('P4 toplam akım',currentText(s.currentA)),
   metric('P3 ideal akım',currentText(s.idealCurrentA)),
   metric('Difüzyon · n ≈ 1',currentText(s.diffusionCurrentA)),
   metric('Yeniden birleşme · n ≈ 2',currentText(s.recombinationCurrentA)),
   metric('Paralel kaçak',currentText(s.shuntCurrentA)),
   metric('Eklem gerilimi Vj',number(s.junctionVoltageV,4)+' V'),
   metric('Seri düşüm I·Rs',number(s.seriesVoltageV,4)+' V'),
   metric('Etkili n · yalnız iki üstel kol',
    s.junctionVoltageV>.12&&options.includeRecombination?
     number(s.effectiveIdeality,2):'Bu gerilimde yorumlanmaz'));
  const activeEffects=Object.entries(realEnabled).filter(([,yes])=>yes).map(([key])=>({
   recombination:'tükenimde yeniden birleşme',series:'seri gerilim düşümü',
   shunt:'paralel kaçak'}[key]));
  const condition=options.appliedBiasV<0?
   'Ters kutuplamada Rsh yolundan akan negatif akım, P3’ün −Is sınırını aşabilir; kırılma burada yoktur.':
   options.appliedBiasV===0?
   'Sıfır kutuplamada her iki üstel akım ve kaçak kolu sıfırdır: denge akımı sıfır kalır.':
   'İleri kutuplamada n≈2 terimi özellikle düşük-orta akımda belirgin olabilir; daha büyük akımda I·Rs gerilim düşümü artar.';
  $('scRealExplanation').textContent=(activeEffects.length?
   'Açık mekanizmalar: '+activeEffects.join(', ')+'. ':
   'Tüm ek etkiler kapalı: P3’ün Shockley diyotu aynen elde edilir. ')+condition;
  const warnings=[];
  if(!s.lowInjection)warnings.push('Düşük enjeksiyon varsayımı zayıfladı (azınlık/çoğunluk > %10).');
  if(!s.depletionValid)warnings.push('Eklem bariyeri 3VT düzeyinin altına düştü.');
  if(options.appliedBiasV<0)warnings.push('Ters kırılma (Zener/avalanş) ve yüzey akımları bu modelde bulunmaz.');
  $('scRealValidity').textContent=warnings.length?
   'Dikkat: '+warnings.join(' '):
   'Geçerli öğretici örnek: sabit 300 K, P3’le ortak difüzyon Is ve seçilebilir ikinci üstel kol. Parametreler ölçümle kalibre edilmedi.';

  // Two signed-current panels: forward log10|I|, reverse linear with
  // dynamically labelled unit. Never plot reverse signed current on a log axis.
  const iv=$('scRealIvChart');
  clearChart(iv,'P3 ideal / P4 gerçek diyot karşılaştırmalı I–V eğrileri');
  const fw={x0:76,x1:424},rv={x0:536,x1:865};
  const top=61,bottom=301,span=bottom-top;
  const fwSamples=Array.from({length:61},(_,i)=>{
   const voltage=.55*i/60;return {voltage,...realDiodeState(realDiodeOptions(voltage))};
  });
  const rvSamples=Array.from({length:51},(_,i)=>{
   const voltage=-.5+i*.5/50;return {voltage,...realDiodeState(realDiodeOptions(voltage))};
  });
  const maxForward=Math.max(1e-11,...fwSamples.map(p=>Math.max(p.currentA,p.idealCurrentA)));
  const logMin=-14,logMax=Math.max(-10,Math.ceil(Math.log10(maxForward)));
  const xf=v=>fw.x0+v/.55*(fw.x1-fw.x0);
  const yf=a=>bottom-(Math.log10(Math.max(Math.abs(a),10**logMin))-logMin)/
   (logMax-logMin)*span;
  const peakReverse=Math.max(1e-12,...rvSamples.map(p=>Math.abs(p.currentA)),
   ...rvSamples.map(p=>Math.abs(p.idealCurrentA)));
  const revMultiplier=peakReverse>=1e-6?1e6:peakReverse>=1e-9?1e9:1e12;
  const revUnit=revMultiplier===1e6?'µA':revMultiplier===1e9?'nA':'pA';
  const maxReverse=peakReverse*revMultiplier*1.08;
  const xr=v=>rv.x0+(v+.5)/.5*(rv.x1-rv.x0);
  const yr=a=>top+Math.abs(a)*revMultiplier/maxReverse*span;
  for(const panel of [fw,rv]){
   realLine(iv,panel.x0,top,panel.x0,bottom,'#90a3b6',1.4);
   realLine(iv,panel.x0,bottom,panel.x1,bottom,'#90a3b6',1.4);
  }
  realText(iv,20,27,'İleri · log₁₀ |I/A|','#335b80',15);
  realText(iv,494,27,'Ters · I ('+revUnit+')','#7e578d',15);
  realText(iv,248,361,'Va (V)','#566c82',12,'middle');
  realText(iv,705,361,'Va (V)','#566c82',12,'middle');
  for(let i=0;i<=4;i++){
   const y=top+i*span/4;
   const decade=logMax-(logMax-logMin)*i/4;
   realLine(iv,fw.x0,y,fw.x1,y);
   realText(iv,fw.x0-8,y+4,'10^'+number(decade,1),'#60788d',11,'end');
   realLine(iv,rv.x0,y,rv.x1,y);
   realText(iv,rv.x0-9,y+4,number(-maxReverse*i/4,maxReverse<.01?3:2),'#60788d',11,'end');
  }
  for(let i=0;i<=5;i++){
   const v=.11*i;
   realText(iv,xf(v),324,number(v,2),'#60788d',11,'middle');
   const reverseV=-.5+.1*i;
   realText(iv,xr(reverseV),324,number(reverseV,1),'#60788d',11,'middle');
  }
  for(const [field,color,name] of [
   ['idealCurrentA','#227ac2','ideal'],['currentA','#8753ad','actual']]){
   svgNode(iv,'path',{d:linePath(fwSamples,p=>[xf(p.voltage),yf(p[field])]),
    fill:'none',stroke:color,'stroke-width':3,
    'data-real-iv-forward':name});
   svgNode(iv,'path',{d:linePath(rvSamples,p=>[xr(p.voltage),yr(p[field])]),
    fill:'none',stroke:color,'stroke-width':3,
    'data-real-iv-reverse':name});
   if(options.appliedBiasV>0){
    svgNode(iv,'circle',{cx:xf(options.appliedBiasV),cy:yf(s[field]),r:5.3,
     fill:color,stroke:'#fff','stroke-width':2,'data-real-point':name});
   }else if(options.appliedBiasV<0){
    svgNode(iv,'circle',{cx:xr(options.appliedBiasV),cy:yr(s[field]),r:5.3,
     fill:color,stroke:'#fff','stroke-width':2,'data-real-point':name});
   }
  }
  const selectPanel=options.appliedBiasV>=0?fw:rv;
  const markerX=options.appliedBiasV>=0?xf(options.appliedBiasV):xr(options.appliedBiasV);
  realLine(iv,markerX,top,markerX,bottom,'#b7a0c9',1.3,{'stroke-dasharray':'4 5'});
  realText(iv,selectPanel.x0+9,48,'Seçili Va: '+
   number(options.appliedBiasV,3)+' V','#80569d',12);

  // Log-scaled magnitude bars visualise individual signed contributions
  // without suggesting that they add as graphic lengths.
  const branchChart=$('scRealBranchesChart');
  clearChart(branchChart,'Seçili gerilimde fiziksel akım yolları ve seri gerilim düşümü');
  const contributions=[
   {name:'Difüzyon n≈1',value:s.diffusionCurrentA,color:'#227ac2',id:'diffusion'},
   {name:'Yeniden birleşme n≈2',value:s.recombinationCurrentA,color:'#8753ad',id:'recombination'},
   {name:'Paralel kaçak Rsh',value:s.shuntCurrentA,color:'#d18a39',id:'shunt'}
  ];
  const logFloor=-16,logCeiling=Math.max(-8,
   Math.ceil(Math.log10(Math.max(1e-16,...contributions.map(p=>Math.abs(p.value))))));
  realText(branchChart,22,25,'Seçili Va için akım katkıları', '#385b79',16);
  realText(branchChart,878,25,'(çubuk: log ölçek)', '#7a8496',12,'end');
  for(const [i,c] of contributions.entries()){
   const y=65+51*i;
   realText(branchChart,25,y,c.name,'#445f78',13);
   svgNode(branchChart,'rect',{x:248,y:y-19,width:405,height:21,rx:7,fill:'#edf2f8'});
   const magnitude=Math.abs(c.value),length=magnitude===0?0:
    Math.max(2,405*(Math.log10(Math.max(10**logFloor,magnitude))-logFloor)/
     (logCeiling-logFloor));
   svgNode(branchChart,'rect',{x:248,y:y-19,width:length,height:21,
    rx:6,fill:c.color,'data-real-branch':c.id});
   realText(branchChart,669,y-3,currentText(c.value),'#405a74',12);
  }
  realLine(branchChart,25,206,875,206,'#e2e8f0',1.5);
  realText(branchChart,25,235,'Va = Vj + I·Rs', '#385b79',13);
  realText(branchChart,252,235,number(s.appliedBiasV,4)+' V = '+
   number(s.junctionVoltageV,4)+' V + '+
   number(s.seriesVoltageV,4)+' V','#724c91',13);
 }
 for(const [key,id] of Object.entries(realSwitchIds))
  $(id).addEventListener('click',()=>{
   realEnabled[key]=!realEnabled[key];
   resetRealFeedback();renderRealDiode();
  });
 $('scRealIdeal').addEventListener('click',()=>{
  Object.keys(realEnabled).forEach(key=>realEnabled[key]=false);
  resetRealFeedback();renderRealDiode();
 });
 $('scRealAll').addEventListener('click',()=>{
  Object.keys(realEnabled).forEach(key=>realEnabled[key]=true);
  resetRealFeedback();renderRealDiode();
 });
 for(const id of ['scRealVoltage','scRealRecombinationRatio','scRealSeriesOhms',
  'scRealShuntOhmsLog','scRealAcceptors','scRealDonors','scRealArea']){
  $(id).addEventListener('input',()=>{resetRealFeedback();renderRealDiode();});
 }
 $('scRealUseDiode').addEventListener('click',()=>{
  for(const [target,source] of [['scRealVoltage','scDiodeVoltage'],
   ['scRealAcceptors','scDiodeAcceptors'],['scRealDonors','scDiodeDonors'],
   ['scRealArea','scDiodeArea']])$(target).value=$(source).value;
  resetRealFeedback();renderRealDiode();
 });
 $('scRealCheck').addEventListener('click',()=>{
  const selected=$('scRealPrediction').value;
  if(!selected){$('scRealFeedback').textContent='Önce bir yanıt seç.';return;}
  const correct=selected==='series';
  $('scRealFeedback').textContent=(correct?'Doğru! ':'Birlikte düzeltelim: ')+
   'Seri dirençten geçen toplam akım, IRs kadar gerilim düşürür; bu yüzden '+
   'yüksek akımda ekleme ulaşan gerilim Va’dan küçük kalır. Yeniden birleşme '+
   'ikinci (n≈2) üstel akım kanalıdır; paralel kaçak ise ekleme paralel ek bir '+
   'iletim yoludur. Önce yalnız Rs açıkken ve sonra diğer etkileri açarak '+
   'P3’ün ideal eğrisiyle farkı gözlemle.';
  $('scRealFeedback').setAttribute('data-result',correct?'correct':'retry');
 });

 const guideStages=[
  {title:'1 · Tek atom: ayrık seviye',
   explanation:'Bir atomun tek orbitali bu modelde tek enerji seviyesi verir. Önce tahminini seç, sonra grafiği güncelle.',
   prompt:'Tek atom ve tek orbital varsa kaç enerji seviyesi vardır?',
   choices:[['one','1 seviye'],['two','2 seviye'],['continuum','Sürekli bir bant']],
   correct:'one',feedback:'Bir orbital → bir enerji özdeğeri. Spin sayılmıyor.'},
  {title:'2 · Çok atom: seviyeler sıklaşır',
   explanation:'N = 16 atom ve sonlu komşu bağlaşımı seçilecek. Sağdaki sürekli eğri sonsuz periyodik sınırdır; soldaki 16 çizgi sonlu zincirdir.',
   prompt:'Tek-orbital 16 atomlu açık zincirde kaç ayrık enerji seviyesi oluşur?',
   choices:[['one','1 seviye'],['sixteen','16 seviye'],['thirtytwo','32 seviye']],
   correct:'sixteen',feedback:'N orbital, N enerji seviyesi üretir. N arttıkça çizgiler sıklaşarak bant görünümü kazanır.'},
  {title:'3 · İki orbital: yasak aralık',
   explanation:'Bu adımda farklı bir modele, iki-orbitalli A/B birim hücresine geçiyoruz. t₁ = 1,2 eV ve t₂ = 0,8 eV seçilecek.',
   prompt:'Hücre içi ve hücreler arası bağlaşım farklıysa bant kenarında ne olur?',
   choices:[['gap','Bir yasak enerji aralığı açılır'],['no_gap','İki bant mutlaka temas eder'],['one_band','Bant sayısı bire düşer']],
   correct:'gap',feedback:'İki orbital iki bant verir; t₁ ≠ t₂ olduğunda bu ideal modelde Eg = 2|t₁−t₂| = 0,8 eV olur.'}
 ];
 const guideButtons=['scGuideOne','scGuideMany','scGuideGap'];
 function chooseGuideStep(step){
  guideStep=Math.max(0,Math.min(2,step));
  const stage=guideStages[guideStep],selector=$('scGuidePrediction');
  guideButtons.forEach((id,i)=>$(id).setAttribute('aria-pressed',String(i===guideStep)));
  $('scGuideTitle').textContent=stage.title;
  $('scGuideExplanation').textContent=stage.explanation;
  $('scGuidePrompt').textContent=stage.prompt;
  selector.replaceChildren();
  const placeholder=document.createElement('option');
  placeholder.value='';placeholder.textContent='Önce tahminini seç';selector.appendChild(placeholder);
  for(const [value,label] of stage.choices){
   const option=document.createElement('option');option.value=value;option.textContent=label;
   selector.appendChild(option);
  }
  selector.disabled=false;
  $('scGuideCheck').disabled=false;
  $('scGuideFeedback').textContent='';
  $('scGuideFeedback').removeAttribute('data-result');
  $('scGuideNext').textContent=guideStep===2?'Başa dön ↺':'Sonraki adım →';
 }
 function applyGuideStage(){
  if(guideStep===2){
   dualPreset='dimer';
   ['scDualIntra','scDualInter','scDualDelta'].forEach((id,i)=>
    $(id).value=String(dualPresets.dimer[i]));
   $('scDualK').value='1';
   renderDual();
  }else{
   stopChain();
   $('scChainAtoms').value=guideStep===0?'1':'16';
   $('scChainHopping').value='0.8';
   renderChain();
  }
 }
 guideButtons.forEach((id,i)=>$(id).addEventListener('click',()=>chooseGuideStep(i)));
 $('scGuideNext').addEventListener('click',()=>chooseGuideStep(guideStep>=2?0:guideStep+1));
 $('scGuidePrediction').addEventListener('change',()=>{
  $('scGuideFeedback').textContent='';$('scGuideFeedback').removeAttribute('data-result');
 });
 $('scGuideCheck').addEventListener('click',()=>{
  if(guideStep<0)return;
  const selected=$('scGuidePrediction').value;
  if(!selected){$('scGuideFeedback').textContent='Önce bir yanıt seç.';return;}
  applyGuideStage();
  const correct=selected===guideStages[guideStep].correct;
  $('scGuideFeedback').setAttribute('data-result',correct?'correct':'retry');
  $('scGuideFeedback').textContent=(correct?'Doğru! ':'Birlikte düşünelim: ')+
   guideStages[guideStep].feedback+' İlgili grafiği aşağıda inceleyebilirsin.';
 });
 const params=[
  ['scPeriod','scPeriodOutput',2,' Å'],['scPotential','scPotentialOutput',2,' eV'],
  ['scMass','scMassOutput',2,''],['scTemperature','scTemperatureOutput',0,' K'],
  ['scFermi','scFermiOutput',2,' eV'],['scGap','scGapOutput',2,' eV']
 ];
 function render(){
  if(!visible)return;
  const structure=host.structure();
  setSource('scSourceName','scSourceDetail',structure);
  renderChain();
  renderDual();
  renderDoping();
  renderPn();
  renderDiode();
  renderRealDiode();
  for(const [input,output,digits,unit] of params)$(output).textContent=number($(input).value,digits)+unit;
  const period=Number($('scPeriod').value),potential=Number($('scPotential').value);
  const mass=Number($('scMass').value);
  const samples=Array.from({length:241},(_,i)=>{
   const k=-1+2*i/240;
   return {k,...twoWaveBands(k,period,mass,potential)};
  });
  const maxEnergy=Math.max(0.5,...samples.map(p=>p.upper))*1.08;
  const minEnergy=Math.min(0,...samples.map(p=>p.lower))-0.12;
  clearChart(chart,'1B iki düzlem dalgalı yaklaşık serbest elektron modeli');
  const axes=plotFrame(chart,{xMin:-1,xMax:1,yMin:minEnergy,yMax:maxEnergy,xTitle:'k / (π/a)',yTitle:'Enerji (eV)'});
  const lower=linePath(samples,p=>[axes.X(p.k),axes.Y(p.lower)]);
  const upper=linePath(samples,p=>[axes.X(p.k),axes.Y(p.upper)]);
  svgNode(chart,'path',{d:lower,stroke:'#2563eb','stroke-width':3,fill:'none'});
  svgNode(chart,'path',{d:upper,stroke:'#f59e0b','stroke-width':3,fill:'none'});
  $('scBandSummary').replaceChildren(metric('Bölge sınırında ayrılma',number(2*potential,2)+' eV'),
   metric('Bölge sınırı |k|',number(Math.PI/period,3)+' Å⁻¹'),
   metric('Model','1B · iki dalga'));
  const temperature=Number($('scTemperature').value),ef=Number($('scFermi').value),gap=Number($('scGap').value);
  clearChart(fermiChart,'Fermi Dirac dağılımı; işaretlenen bant kenarları ideal bir örnektir');
  const fAxes=plotFrame(fermiChart,{xMin:-1.8,xMax:1.8,yMax:1,xTitle:'Enerji E (eV)',yTitle:'Doluluk f(E)',yTicks:4});
  const leftEnd=fAxes.X(-gap/2),rightStart=fAxes.X(gap/2);
  svgNode(fermiChart,'rect',{x:fAxes.X(-1.8),y:20,width:leftEnd-fAxes.X(-1.8),height:252,fill:'#bfdbfe','fill-opacity':0.45});
  svgNode(fermiChart,'rect',{x:rightStart,y:20,width:fAxes.X(1.8)-rightStart,height:252,fill:'#fde68a','fill-opacity':0.42});
  svgNode(fermiChart,'line',{x1:fAxes.X(ef),x2:fAxes.X(ef),y1:20,y2:272,stroke:'#d97706','stroke-width':2,'stroke-dasharray':'6 5'});
  const fSamples=Array.from({length:361},(_,i)=>{
   const energy=-1.8+i*.01;
   return [energy,fermiDirac(energy,ef,temperature)];
  });
  svgNode(fermiChart,'path',{d:linePath(fSamples,p=>[fAxes.X(p[0]),fAxes.Y(p[1])]),
   stroke:'#0e7490','stroke-width':3,fill:'none'});
  $('scFermiSummary').replaceChildren(metric('f(E = EF)','0,500'),
   metric('f(Ec)',number(fermiDirac(gap/2,ef,temperature),4)),
   metric('kBT',number(KB_EV_K*temperature,4)+' eV'));
  const edge=edgeStateOccupancies(gap,ef,temperature);
  const probabilityText=value=>value<.0001?value.toExponential(2):number(value,6);
  $('scEdgeSummary').replaceChildren(
   metric('Ec: elektron olasılığı',probabilityText(edge.electronProbability)),
   metric('Ev: hol olasılığı',probabilityText(edge.holeProbability)),
   metric('Fermi konumu',Math.abs(ef)<1e-12?'Bant ortası · simetrik':'Kaydırılmış · bağımsız'));
  const points=Array.from({length:101},(_,i)=>{
   const T=100+i*5;
   return {T,...edgeStateOccupancies(gap,ef,T)};
  });
  const minLog=Math.floor(Math.min(-1,...points.map(p=>p.electronLog10),
   ...points.map(p=>p.holeLog10))/10)*10;
  const thermalChart=$('scThermalChart');
  clearChart(thermalChart,'Bant kenarlarında sıcaklığa göre tek-durum olasılıkları');
  const tAxes=plotFrame(thermalChart,{xMin:100,xMax:600,yMin:minLog,yMax:0,
   xTitle:'Sıcaklık T (K)',yTitle:'log₁₀(olasılık)'});
  for(const [field,color,name] of [
   ['electronLog10','#227ac2','Elektron: f(Ec)'],
   ['holeLog10','#d98236','Hol: 1−f(Ev)']]){
   svgNode(thermalChart,'path',{d:linePath(points,p=>[tAxes.X(p.T),tAxes.Y(p[field])]),
    fill:'none',stroke:color,'stroke-width':3,'data-thermal-curve':field});
   svgNode(thermalChart,'circle',{cx:tAxes.X(temperature),cy:tAxes.Y(edge[field]),
    r:6,fill:color,stroke:'#fff','stroke-width':2,'data-thermal-selected':field});
  }
  svgNode(thermalChart,'line',{x1:tAxes.X(temperature),x2:tAxes.X(temperature),
   y1:20,y2:272,stroke:'#64748b','stroke-width':1.5,'stroke-dasharray':'5 5'});
  svgNode(thermalChart,'text',{x:675,y:16,fill:'#227ac2','font-size':12,'font-weight':700},
   '● f(Ec) elektron');
  svgNode(thermalChart,'text',{x:675,y:32,fill:'#d98236','font-size':12,'font-weight':700},
   '● 1−f(Ev) hol');
 }
 params.forEach(([id])=>$(id).addEventListener('input',render));
 $('scUseCell').addEventListener('click',()=>{
  const value=Number(host.structure().cell.a);
  if(Number.isFinite(value)&&value>=2&&value<=8){$('scPeriod').value=String(value);render();}
  else {const original=$('scUseCell').textContent;$('scUseCell').textContent='a, 2–8 Å model aralığı dışında';setTimeout(()=>$('scUseCell').textContent=original,2400);}
 });
 window.addEventListener('crystal-language-change',render);
 return {get visible(){return visible;},setVisible(value){visible=!!value;if(visible)render();else stopChain();},refresh:render};
}
