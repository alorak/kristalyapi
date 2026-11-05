/* Standalone WebGL-free ideal and active-CIF 2D figure page. */
import {buildLayeredFigure,MX2_SOURCE} from './layered-2d-figure.js';
import {analyzeCifLayers,buildCifLayerFigure} from './layered-2d-cif.js';
import {figurePng,figurePdf,saveBlob} from './layered-2d-export.js';

const $=id=>document.getElementById(id);
const filename=s=>String(s||'Kristal').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,65)||'Kristal';
export function initLayered2dPage(){
 const root=$('layered2dPage');if(!root)return;
 const preview=$('layered2dPreview'),status=$('layered2dStatus');
 const buttons=['layered2dSvgDownload','layered2dPngDownload','layered2dPdfDownload'].map($);
 const ids=['layered2dSourceMode','layered2dPhase','layered2dMode','layered2dNa','layered2dNb',
  'layered2dBonds','layered2dCell','layered2dLegend','layered2dAxis','layered2dMinGap','layered2dLayerIndex'];
 let current=null,active=null,busy=false;
 const isCif=()=>$('layered2dSourceMode').value==='cif';
 const setButtons=enabled=>{for(const b of buttons)b.disabled=!enabled||busy;};
 function getActiveStructure(){
  const host=window.KristalLayeredHost;
  if(!host||typeof host.structure!=='function')throw Error('Aktif çalışma alanı henüz hazır değil.');
  return host.structure();
 }
 function refreshLayers(){
  if(!isCif())return;
  try{
   active=getActiveStructure();
   const data=analyzeCifLayers(active,{axis:$('layered2dAxis').value,minGap:Number($('layered2dMinGap').value)});
   const select=$('layered2dLayerIndex'),previous=Number(select.value);
   select.replaceChildren(...data.groups.map((g,i)=>{
    const o=document.createElement('option');o.value=String(i);
    o.textContent='Katman '+(i+1)+' · '+g.atomCount+' atom · '+g.thickness.toFixed(2)+' Å';
    return o;
   }));
   select.value=String(previous<data.groups.length?previous:0);
   $('layered2dActiveName').textContent=(active.workspace?active.workspace+' · ':'')+(active.name||'Aktif yapı')+
    ' · '+active.sites.length+' atom (P1) · '+data.groups.length+' olası katman';
  }catch(error){
   $('layered2dLayerIndex').replaceChildren();
   $('layered2dActiveName').textContent=error.message;
   throw error;
  }
 }
 function render({reRead=false}={}){
  $('layered2dIdealControls').hidden=isCif();
  $('layered2dCifControls').hidden=!isCif();
  try{
   const options={
    phase:$('layered2dPhase').value,mode:$('layered2dMode').value,
    na:Number($('layered2dNa').value),nb:Number($('layered2dNb').value),
    showBonds:$('layered2dBonds').checked,showCell:$('layered2dCell').checked,
    showLegend:$('layered2dLegend').checked
   };
   if(isCif()){
    if(reRead||!active||!$('layered2dLayerIndex').options.length)refreshLayers();
    current=buildCifLayerFigure({structure:active,axis:$('layered2dAxis').value,
     minGap:Number($('layered2dMinGap').value),layerIndex:Number($('layered2dLayerIndex').value),...options});
   }else current=buildLayeredFigure(options);
   // Both generators escape source titles, clamp counts and emit fixed SVG primitives.
   preview.innerHTML=current.svg;
   status.dataset.state='ready';
   status.textContent=current.panels.length+' panel · '+current.atomsPerPhase+
    (isCif()?' atom · katman '+current.selectedLayer+'/'+current.layerCount:' atom/faz')+
    ' · '+current.width+' × '+current.height+' · SVG (GPU gerekmez)';
   setButtons(true);
  }catch(error){
   current=null;preview.replaceChildren();
   status.dataset.state='error';
   status.textContent='Figür oluşturulamadı: '+error.message;
   setButtons(false);
  }
 }
 function stem(){
  return filename(isCif()?current?.source:'MoS2_1H_1T')+'_2B';
 }
 async function exportFigure(kind){
  if(!current||busy)return;
  busy=true;setButtons(false);
  status.textContent=kind.toUpperCase()+' hazırlanıyor…';
  try{
   if(kind==='svg')saveBlob(new Blob([current.svg],{type:'image/svg+xml;charset=utf-8'}),stem()+'.svg');
   else if(kind==='png')saveBlob(await figurePng(current.svg,current.width,current.height),stem()+'.png');
   else if(kind==='pdf')saveBlob(await figurePdf(current.svg,current.width,current.height),stem()+'.pdf');
   status.dataset.state='ready';status.textContent=kind.toUpperCase()+' dosyası oluşturuldu.';
  }catch(error){
   status.dataset.state='error';status.textContent=kind.toUpperCase()+' dışa aktarılamadı: '+error.message;
  }finally{busy=false;setButtons(!!current);}
 }
 $('layered2dSourceMode').addEventListener('change',()=>{active=null;render({reRead:true});});
 for(const id of ids.slice(1)){
  $(id).addEventListener(['layered2dAxis','layered2dMinGap'].includes(id)?'change':
   $(id).type==='checkbox'?'change':'input',
   ()=>render({reRead:isCif()&&['layered2dAxis','layered2dMinGap'].includes(id)}));
 }
 $('layered2dRefresh').addEventListener('click',()=>render({reRead:true}));
 window.addEventListener('crystal:layered2d-structure',()=>{if(isCif())render({reRead:true});});
 for(const kind of ['svg','png','pdf']){
  $('layered2d'+kind[0].toUpperCase()+kind.slice(1)+'Download').onclick=()=>exportFigure(kind);
 }
 $('layered2dSource').href=MX2_SOURCE.reference;
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initLayered2dPage,{once:true});
else initLayered2dPage();
