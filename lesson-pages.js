import {braggTwoTheta,twoWaveBands,fermiDirac,KB_EV_K} from './lesson-core.js';

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

export function initPowderLesson(host){
 let visible=false,selectedIndex=0,lastPattern=null;
 const chart=$('pwChart'),list=$('pwPeaks'),summary=$('pwSummary'),bragg=$('pwBragg');
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
    button.addEventListener('click',()=>{selectedIndex=index;render();});
    list.appendChild(button);
   });
   bragg.replaceChildren();
   if(groups.length){
    const chosen=groups[selectedIndex];
    bragg.append(metric('Miller indisleri',`(${chosen.hkl.join(' ')})`),
     metric('Düzlem aralığı',number(chosen.d,4)+' Å'),
     metric('Bragg açısı θ',number(chosen.angle/2,3)+'°'),
     metric('Dedektör açısı 2θ',number(chosen.angle,3)+'°'));
    const value=braggTwoTheta(chosen.d,lambda);
    if(value!==null&&Math.abs(value-chosen.angle)>0.001)
     $('pwStatus').textContent='Bragg model tutarlılığı kontrol edilemedi.';
   }else bragg.textContent='Düzlem seçmek için açı sınırını veya dalga boyunu değiştirin.';
  }catch(error){
   lastPattern=null;
   clearChart(chart,'Hesaplama hatası');summary.replaceChildren();list.replaceChildren();bragg.replaceChildren();
   $('pwStatus').textContent=error.message||'Hesaplama yapılamadı.';
  }
 }
 for(const id of ['pwLambda','pwMaxAngle','pwWidth','pwLp'])$(id).addEventListener('input',()=>{selectedIndex=0;render();});
 window.addEventListener('crystal-language-change',render);
 return {get visible(){return visible;},setVisible(value){visible=!!value;if(visible)render();},refresh:render};
}

export function initSemiconductorLesson(host){
 let visible=false;
 const chart=$('scBandChart'),fermiChart=$('scFermiChart');
 const params=[
  ['scPeriod','scPeriodOutput',2,' Å'],['scPotential','scPotentialOutput',2,' eV'],
  ['scMass','scMassOutput',2,''],['scTemperature','scTemperatureOutput',0,' K'],
  ['scFermi','scFermiOutput',2,' eV'],['scGap','scGapOutput',2,' eV']
 ];
 function render(){
  if(!visible)return;
  const structure=host.structure();
  setSource('scSourceName','scSourceDetail',structure);
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
 return {get visible(){return visible;},setVisible(value){visible=!!value;if(visible)render();},refresh:render};
}
