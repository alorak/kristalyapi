/* Active-structure Debye–Scherrer virtual camera.
 * The only source of Bragg peaks is the editor host.powderPattern, which uses
 * the current cell, symmetry-expanded sites, occupancies and IT92 X-ray factors.
 * No sample presets are substituted for the active CIF/edited structure. */
import {CAMERA_RADIATION,cameraFromPattern,cameraFilmScale,cameraReflectionLabel} from './powder-camera-core.js';

const $=id=>document.getElementById(id);
const tr=(turkish,english)=>window.CrystalI18n?.language==='en'?english:turkish;
const fmt=(value,digits=2)=>Number(value).toLocaleString(
 window.CrystalI18n?.language==='en'?'en-US':'tr-TR',
 {minimumFractionDigits:digits,maximumFractionDigits:digits});
const MAX_ANGLE=150;

function prepareCanvas(canvas,height){
 const width=Math.max(290,Math.round(canvas.getBoundingClientRect().width||500));
 const ratio=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.clearRect(0,0,width,height);
 return {ctx,width,height};
}
function drawCamera(canvas,line){
 const view=prepareCanvas(canvas,260);
 if(!view||!line)return;
 const {ctx,width:w,height:h}=view;
 const cx=w*.51,cy=h*.50,r=Math.min(w*.28,90);
 ctx.strokeStyle='#92a7bd';ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();
 ctx.setLineDash([4,5]);ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,r-6,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#d19548';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-r-33,cy);ctx.lineTo(cx-5,cy);ctx.stroke();
 ctx.fillStyle='#d19548';ctx.beginPath();ctx.moveTo(cx-6,cy);ctx.lineTo(cx-19,cy-6);ctx.lineTo(cx-19,cy+6);ctx.fill();
 ctx.strokeStyle='#bbc8d5';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+r,cy);ctx.stroke();ctx.setLineDash([]);
 const theta=line.twoThetaDeg*Math.PI/180;
 for(const sign of [-1,1]){
  const x=cx+r*Math.cos(theta),y=cy+sign*r*Math.sin(theta);
  ctx.strokeStyle='#147ca0';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
  ctx.fillStyle='#df9b42';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle='#203b55';ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fill();
 ctx.font='12px system-ui';ctx.fillText(tr('Toz numune','Powder specimen'),cx-45,cy+23);
 ctx.fillText(tr('Silindirik film','Cylindrical film'),cx+r*.44,cy-r*.7);
 ctx.fillText(tr('Gelen X-ışını','Incident X-ray'),Math.max(6,cx-r-54),cy-16);
 ctx.fillStyle='#4c6780';ctx.fillText('2θ = '+fmt(line.twoThetaDeg,2)+'°',13,h-13);
 ctx.fillText(tr('Numune ekseni boyunca kesit','Section along the sample axis'),13,18);
}
function drawFilm(canvas,lines,beta,selected,diameterMm,rotating){
 const view=prepareCanvas(canvas,260);
 if(!view)return;
 const {ctx,width:w,height:h}=view,mid=w/2;
 const {halfFilmMm}=cameraFilmScale(diameterMm);
 const filmX=12,filmY=41,filmWidth=w-24,filmHeight=160;
 ctx.fillStyle='#172537';ctx.fillRect(filmX,filmY,filmWidth,filmHeight);
 const xFor=distance=>mid+(distance/halfFilmMm)*(filmWidth/2);
 const drawSet=(peaks,isBeta)=>{
  for(const p of peaks){
   const brightness=Math.min(1,Math.sqrt(Math.max(0,p.relative)/100));
   const opacity=isBeta?(.12+.3*brightness):(.12+.78*brightness);
   const active=!isBeta&&p===selected;
   ctx.strokeStyle=active?'rgba(246,188,100,.98)':
    isBeta?'rgba(218,154,113,'+opacity+')':'rgba(162,226,239,'+opacity+')';
   ctx.lineWidth=active?3:isBeta?1:Math.max(1,1.4*brightness);
   for(const sign of [-1,1]){
    const x=xFor(sign*p.arcMm);
    if(rotating){
     ctx.beginPath();ctx.moveTo(x,filmY+4);ctx.lineTo(x,filmY+filmHeight-4);ctx.stroke();
    }else{
     // Qualitative illustration, not a finite-grain diffraction simulation.
     for(let y=filmY+5;y<filmY+filmHeight-5;y+=19){
      const seed=Math.sin((p.twoThetaDeg+sign*37)*.37+y*.13);
      if(seed>.08){ctx.beginPath();ctx.moveTo(x+seed*1.3,y);ctx.lineTo(x+seed*1.3,y+6);ctx.stroke();}
     }
    }
   }
  }
 };
 drawSet(lines,false);drawSet(beta,true);
 ctx.fillStyle='#8297ad';ctx.fillRect(mid-2,filmY,4,filmHeight);
 ctx.font='12px system-ui';ctx.fillStyle='#213c57';
 ctx.fillText(tr('Açılmış silindirik film · çift çizgiler','Unrolled cylindrical film · paired lines'),10,20);
 ctx.textAlign='center';ctx.fillText('0',mid,h-22);
 ctx.fillText('−'+fmt(halfFilmMm,1)+' mm',filmX+33,h-22);
 ctx.fillText('+'+fmt(halfFilmMm,1)+' mm',filmX+filmWidth-33,h-22);
 ctx.font='11px system-ui';ctx.fillText(tr('Doğrudan demet referansı','Direct-beam reference'),mid,h-5);
 ctx.textAlign='start';
}
function setMetric(host,label,value){
 const card=document.createElement('div');
 const small=document.createElement('small');small.textContent=label;
 const strong=document.createElement('strong');strong.textContent=value;
 card.append(small,strong);host.append(card);
}

export function initPowderCameraPage(host){
 const panel=$('pwCameraPage');
 if(!panel)return {get visible(){return false;},setVisible(){},refresh(){}};
 const select=$('pwCameraReflection'),source=$('pwCameraSource'),diameter=$('pwCameraDiameter');
 const filtered=$('pwCameraFilter'),rotating=$('pwCameraRotation');
 let visible=false,lines=[],beta=[],selected=null,structure=null;
 function translate(){
  for(const item of panel.querySelectorAll('[data-camera-en]')){
   item.textContent=tr(item.getAttribute('data-camera-tr'),item.getAttribute('data-camera-en'));
  }
  const radiation=CAMERA_RADIATION[source.value];
  if(radiation)$('pwCameraFilterName').textContent=tr(
   radiation.filter+' filtresi · Kβ bastırma',radiation.filter+' filter · suppress Kβ');
 }
 function paint(){
  if(!visible)return;
  drawCamera($('pwCameraDiagram'),selected);
  drawFilm($('pwCameraFilm'),lines,beta,selected,Number(diameter.value),rotating.checked);
  const metrics=$('pwCameraMetrics');metrics.replaceChildren();
  if(!selected)return;
  setMetric(metrics,'dₕₖₗ',fmt(selected.d,4)+' Å');
  setMetric(metrics,'2θ',fmt(selected.twoThetaDeg,2)+'°');
  setMetric(metrics,'s = R × 2θ',fmt(selected.arcMm,2)+' mm');
  setMetric(metrics,'R',fmt(Number(diameter.value)/2,2)+' mm');
  $('pwCameraInterpretation').textContent=tr(
   'Seçili '+cameraReflectionLabel(selected.hkl)+' yansıması filmin iki tarafında ±'+fmt(selected.arcMm,2)+
   ' mm konumundadır. '+(rotating.checked?'Dönüş çizgilerin sürekliliğine yardımcı olur.':
   'Benekli çizgiler, sınırlı tane istatistiğini yalnız nitel olarak temsil eder.')+
   (!filtered.checked?' Kβ çizgileri gösteriliyor (şematik bağıl ağırlık).':''),
   'Selected '+cameraReflectionLabel(selected.hkl)+' lies at ±'+fmt(selected.arcMm,2)+
   ' mm on both sides of the unrolled film. '+(rotating.checked?'Rotation helps produce continuous lines.':
   'Spotty lines qualitatively represent limited grain statistics.')+
   (!filtered.checked?' Kβ lines are also shown with schematic relative weights.':'')
  );
 }
 function refresh(){
  if(!visible)return;
  translate();
  const status=$('pwCameraStatus');
  const previous=selected?.hkl?.join(',');
  try{
   structure=host.structure();
   if(structure.nonPeriodic)throw new Error(tr(
    'Bu araç yalnız üç boyutlu periyodik kristallerde çalışır.','This tool requires a three-dimensionally periodic crystal.'));
   if(!structure.sites?.length)throw new Error(tr('Yapıda atom konumu yok.','The structure has no atomic sites.'));
   const radiation=CAMERA_RADIATION[source.value];
   if(!radiation)throw new Error(tr('Geçersiz X-ışını kaynağı.','Invalid X-ray source.'));
   const dia=Number(diameter.value);
   const pattern=host.powderPattern(structure.cell,structure.sites,{
    wavelength:radiation.alpha,maxAngle:MAX_ANGLE,scattering:'xray',lorentzPolarization:true
   });
   lines=cameraFromPattern(pattern,dia);
   if(!lines.length)throw new Error(tr('Bu koşullarda gözlenebilir Bragg yansıması bulunamadı.','No accessible Bragg reflection for these settings.'));
   beta=[];
   if(!filtered.checked){
    const betaPattern=host.powderPattern(structure.cell,structure.sites,{
     wavelength:radiation.beta,maxAngle:MAX_ANGLE,scattering:'xray',lorentzPolarization:true
    });
    beta=cameraFromPattern(betaPattern,dia).map(x=>({...x,relative:x.relative*.2}));
   }
   const found=lines.findIndex(p=>p.hkl.join(',')===previous);
   const index=found>=0?found:0;
   select.replaceChildren();
   for(let i=0;i<lines.length;i++){
    const option=document.createElement('option');option.value=String(i);
    option.textContent=cameraReflectionLabel(lines[i].hkl)+' · 2θ '+fmt(lines[i].twoThetaDeg,2)+'°';
    select.append(option);
   }
   select.disabled=false;select.value=String(index);selected=lines[index];
   $('pwCameraStructure').textContent=(structure.name||tr('İsimsiz kristal','Unnamed crystal'))+
    ' · '+structure.sites.length+tr(' P1 atom',' P1 sites')+
    ' · '+tr('simetri','symmetry')+': '+structure.symmetry;
   const c=structure.cell;
   $('pwCameraCell').textContent='a '+fmt(c.a,3)+' · b '+fmt(c.b,3)+' · c '+fmt(c.c,3)+
    ' Å · α '+fmt(c.alpha,1)+'° · β '+fmt(c.beta,1)+'° · γ '+fmt(c.gamma,1)+'°';
   status.textContent=tr('Etkin kristalin atom konumları ve yapı faktörlerinden ',
    'From the active crystal’s atomic sites and structure factors: ')+
    lines.length+tr(' hesaplanmış Kα çizgisi',' calculated Kα lines');
   $('pwCameraStatus').dataset.state='ready';
  }catch(error){
   lines=[];beta=[];selected=null;select.replaceChildren();select.disabled=true;
   $('pwCameraMetrics').replaceChildren();
   $('pwCameraStructure').textContent=tr('Hesap yapılamadı','Calculation unavailable');
   $('pwCameraCell').textContent='';
   $('pwCameraInterpretation').textContent='';
   status.textContent=error?.message||String(error);status.dataset.state='error';
  }
  paint();
 }
 function selectPeak(){
  selected=lines[Number(select.value)]||null;
  paint();
 }
 for(const el of [source,diameter,filtered])el.addEventListener('change',refresh);
 select.addEventListener('change',selectPeak);
 rotating.addEventListener('change',paint);
 window.addEventListener('resize',()=>{if(visible)paint();},{passive:true});
 window.addEventListener('crystal-language-change',()=>{if(visible)refresh();});
 translate();
 return {
  get visible(){return visible;},
  setVisible(value){visible=!!value;if(visible)refresh();},
  refresh
 };
}
