/* Dedicated WebGL-free UI for reproducible ideal monolayer MX2 figures. */
import {buildLayeredFigure,MX2_SOURCE} from './layered-2d-figure.js';

const $=id=>document.getElementById(id);
function downloadSvg(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download='MoS2_1H_1T_2B_figuru.svg';
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function initLayered2dPage(){
 const root=$('layered2dPage');
 if(!root)return;
 const host=$('layered2dPreview'),status=$('layered2dStatus'),save=$('layered2dSvgDownload');
 const controls=['layered2dPhase','layered2dMode','layered2dNa','layered2dNb','layered2dBonds','layered2dCell','layered2dLegend'];
 let current=null;
 function render(){
  try{
   const options={
    phase:$('layered2dPhase').value,mode:$('layered2dMode').value,
    na:Number($('layered2dNa').value),nb:Number($('layered2dNb').value),
    showBonds:$('layered2dBonds').checked,showCell:$('layered2dCell').checked,
    showLegend:$('layered2dLegend').checked
   };
   current=buildLayeredFigure(options);
   // SVG markup is produced exclusively from bounded fixed structural primitives
   // in layered-2d-figure.js. No user-entered HTML or API response is injected.
   host.innerHTML=current.svg;
   save.disabled=false;
   status.dataset.state='ready';
   status.textContent=current.panels.length+' panel · '+current.atomsPerPhase+
    ' atom/faz · '+current.width+' × '+current.height+' SVG · GPU kullanılmadı';
  }catch(error){
   current=null;host.replaceChildren();save.disabled=true;
   status.dataset.state='error';status.textContent='Figür oluşturulamadı: '+error.message;
  }
 }
 for(const id of controls){
  const element=$(id);
  element.addEventListener(element.type==='checkbox'?'change':'input',render);
 }
 save.addEventListener('click',()=>{if(current)downloadSvg(current.svg);});
 $('layered2dSource').href=MX2_SOURCE.reference;
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initLayered2dPage,{once:true});
else initLayered2dPage();
