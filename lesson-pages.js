import {braggTwoTheta,braggInterference,twoWaveBands,tightBindingChainLevels,
 tightBindingBandEnergy,twoOrbitalBands,twoOrbitalBandGap,twoOrbitalWeights,fermiDirac,KB_EV_K} from './lesson-core.js';
import {createPowderPlanesView} from './powder-planes-view.js';

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
 function updatePhasors(structure=host.structure()){
  const values=['pwFh','pwFk','pwFl'].map(id=>$(id).value.trim());
  const hkl=values.map(Number),output=$('pwPhasorSummary');
  const valid=values.every(value=>value!=='')&&hkl.every(value=>Number.isInteger(value)&&Math.abs(value)<=12)&&hkl.some(Boolean);
  if(!valid){clearChart($('pwPhasorSvg'),'Geçerli ve sıfırdan farklı (hkl) gerekli.');
   output.replaceChildren(metric('Yansıma','Geçerli (hkl) seçin'));return;}
  try{
   const result=structurePhasorDiagram($('pwPhasorSvg'),host,structure,hkl);
   const magnitude=Math.hypot(result.real,result.imag);
   output.replaceChildren(metric('Yansıma',`(${hkl.join(' ')})`),
    metric('|F(hkl)|',number(magnitude,3)),metric('|F|²',number(result.intensity,3)),
    metric('Sayısal sonuç',result.intensity<1e-8?'F ≈ 0 · sönme':'F ≠ 0 · katkı var'));
  }catch(error){clearChart($('pwPhasorSvg'),'Yapı faktörü hesaplanamadı');
   output.replaceChildren(metric('Hesaplama hatası',error.message||String(error)));}
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
   updatePhasors(structure);
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
 $('pwUsePeak').addEventListener('click',()=>useHkl(lastPattern?.groups?.[selectedIndex]?.hkl));
 for(const [id,hkl] of [['pwF100',[1,0,0]],['pwF200',[2,0,0]],['pwF220',[2,2,0]]])
  $(id).addEventListener('click',()=>useHkl(hkl));
 window.addEventListener('crystal-language-change',render);
 return {get visible(){return visible;},setVisible(value){visible=!!value;if(visible){render();planeViewer?.resize();}else{setWavePlaying(false);planeViewer?.suspend?.();}},refresh:render};
}

export function initSemiconductorLesson(host){
 let visible=false;
 const chart=$('scBandChart'),fermiChart=$('scFermiChart');
 const chainChart=$('scChainChart'),chainStages=[1,2,4,8,16,32,64];
 const dualChart=$('scDualChart');
 const dualPresets={metal:[1,1,0],dimer:[1.2,.8,0],ionic:[1,1,1.2]};
 const dualButtons={metal:'scDualMetal',dimer:'scDualDimer',ionic:'scDualIonic'};
 let dualPreset='dimer';
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
