/* Excel-style XRD indexing worksheet; fit only for user-assigned hkl. */
import {TITANIUM_PEAKS,TITANIUM_WAVELENGTH,observedPeak,fitPowderPeaks,
 parsePeakCsv,peakCsv} from './powder-indexing-core.js';

const $=id=>document.getElementById(id);
const english=()=>window.CrystalI18n?.language==='en'||document.documentElement.lang==='en';
const tr=(a,b)=>english()?b:a;
const number=(n,digits=4)=>Number.isFinite(n)?Number(n).toLocaleString(
 english()?'en-US':'tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
const valueOrBlank=(n,digits=4)=>Number.isFinite(n)?number(n,digits):'—';
const editFields=['twoTheta','h','k','l'];
const outputFields=['thetaDeg','dObserved','sinSquared','twoThetaCalculated','deltaTwoTheta'];
const initial=()=>TITANIUM_PEAKS.map(p=>({...p}));

function makeRow(peak,index){
 const row=document.createElement('tr');
 row.dataset.index=String(index);
 const numberCell=document.createElement('td');
 numberCell.textContent=String(index+1);
 row.append(numberCell);
 for(const field of ['twoTheta']){
  const td=document.createElement('td'),input=document.createElement('input');
  input.type='text';input.inputMode='decimal';input.value=String(peak[field]);
  input.dataset.field=field;input.autocomplete='off';
  input.setAttribute('aria-label',tr('Pik '+(index+1)+' 2θ','Peak '+(index+1)+' 2theta'));
  td.append(input);row.append(td);
 }
 for(const field of outputFields.slice(0,3)){
  const cell=document.createElement('td');cell.dataset.output=field;
  cell.className='pi-computed';cell.textContent='—';row.append(cell);
 }
 for(const field of ['h','k','l']){
  const td=document.createElement('td'),input=document.createElement('input');
  input.type='text';input.inputMode='numeric';input.value=String(peak[field]);
  input.dataset.field=field;input.autocomplete='off';
  input.setAttribute('aria-label',tr('Pik '+(index+1)+' '+field,'Peak '+(index+1)+' '+field));
  td.append(input);row.append(td);
 }
 for(const field of outputFields.slice(3)){
  const cell=document.createElement('td');cell.dataset.output=field;
  cell.className='pi-computed';cell.textContent='—';row.append(cell);
 }
 const action=document.createElement('td');
 const button=document.createElement('button');button.type='button';
 button.className='pi-remove';button.dataset.action='remove';
 button.title=tr('Piki sil','Remove peak');
 button.setAttribute('aria-label',tr('Pik '+(index+1)+' sil','Remove peak '+(index+1)));
 button.textContent='×';action.append(button);row.append(action);
 return row;
}
function displayError(message){
 if(!message)return '';
 const peak=/^Peak (\d+): (.*)$/.exec(message);
 if(peak)return tr('Pik '+peak[1]+': ','Peak '+peak[1]+': ')+displayError(peak[2]);
 if(message.startsWith('At least ')){
  const n=/\d+/.exec(message)?.[0]||'3';
  return tr('Hesaplama için en az '+n+' atanmış pik gerekli.','At least '+n+' assigned peaks are required.');
 }
 if(message.includes('independently constrain'))return tr(
  'Seçilen (hkl) değerleri a ve c parametrelerini bağımsız belirleyemiyor; l≠0 ve hk≠00 yansımalarını çeşitlendirin.',
  'Assigned reflections do not independently constrain a and c; include independent basal and axial reflections.');
 if(message.includes('2theta must'))return tr('2θ, 0° ile 180° arasında olmalı.','2theta must lie between 0° and 180°.');
 if(message.includes('h, k, l'))return tr(
  'h, k, l tam sayı olmalı; (000) kullanılamaz.','h, k, l must be integers; (000) is invalid.');
 if(message.includes('Wavelength'))return tr('Dalga boyu 0–10 Å aralığında pozitif olmalı.','Wavelength must be positive, up to 10 Å.');
 if(message.includes('Non-positive'))return tr('Uyum fiziksel olmayan örgü katsayıları üretti.','Fit produced non-physical lattice coefficients.');
 return message;
}
export function initPowderIndexingPage(){
 const root=$('pwIndexingPage');
 if(!root)return null;
 const table=$('piRows'),system=$('piSystem'),lambda=$('piLambda');
 const results=$('piMetrics'),status=$('piStatus'),importInput=$('piImport');
 let peaks=initial(),lastFit=null;
 const setMessage=(message,invalid=false)=>{
  status.textContent=message;status.dataset.state=invalid?'invalid':'ready';
 };
 function translate(){
  root.querySelectorAll('[data-pi-tr][data-pi-en]').forEach(el=>{
   el.textContent=el.getAttribute(english()?'data-pi-en':'data-pi-tr');
  });
  root.querySelectorAll('[data-pi-title-tr][data-pi-title-en]').forEach(el=>{
   el.title=el.getAttribute(english()?'data-pi-title-en':'data-pi-title-tr');
  });
 }
 function drawRows(){
  const fragment=document.createDocumentFragment();
  peaks.forEach((peak,i)=>fragment.append(makeRow(peak,i)));
  table.replaceChildren(fragment);
  calculate();
 }
 function clearResults(){
  results.querySelectorAll('[data-metric]').forEach(el=>el.textContent='—');
  table.querySelectorAll('[data-output]').forEach(el=>el.textContent='—');
  lastFit=null;
 }
 function calculate(){
  clearResults();
  const wavelength=String(lambda.value).trim().replace(',','.');
  const numeric=peaks.map(p=>Object.fromEntries(editFields.map(f=>[f,String(p[f]).trim().replace(',','.')])));
  const measured=numeric.map(p=>{try{return observedPeak(p,wavelength);}catch{return null;}});
  for(const [i,row] of Array.from(table.rows).entries()){
   const o=measured[i];
   for(const field of ['thetaDeg','dObserved','sinSquared']){
    const el=row.querySelector('[data-output="'+field+'"]');
    if(el)el.textContent=o?number(o[field],field==='thetaDeg'?3:field==='sinSquared'?6:5):'—';
   }
   row.classList.toggle('pi-row-invalid',!o);
  }
  try{
   const fit=fitPowderPeaks({peaks:numeric,wavelength,system:system.value});
   lastFit=fit;
   const values={a:fit.a,b:fit.b,c:fit.c,ratio:fit.cOverA,
    rmse:fit.rmseTwoTheta,rmseSin:fit.rmseSinSquared};
   results.querySelectorAll('[data-metric]').forEach(el=>{
    const key=el.dataset.metric;
    el.textContent=key==='n'?String(fit.n):
     valueOrBlank(values[key],key==='rmse'||key==='rmseSin'?6:4);
   });
   for(const [i,row] of Array.from(table.rows).entries()){
    for(const field of ['twoThetaCalculated','deltaTwoTheta']){
     const el=row.querySelector('[data-output="'+field+'"]');
     el.textContent=valueOrBlank(fit.rows[i][field],4);
    }
   }
   setMessage(tr('Uyum tamamlandı: '+fit.n+' pik, '+(system.value==='cubic'?'kübik':'hekzagonal')+
    ' örgü. Bu işlem hkl indislerini otomatik bulmaz.',
    'Fit complete: '+fit.n+' peaks, '+system.value+' lattice. This does not automatically determine hkl.'));
  }catch(error){
   setMessage(displayError(error.message),true);
  }
 }
 table.addEventListener('input',event=>{
  const target=event.target,field=target.dataset.field;
  if(!editFields.includes(field))return;
  const idx=Number(target.closest('tr')?.dataset.index);
  if(!Number.isInteger(idx)||!peaks[idx])return;
  peaks[idx][field]=target.value;
  calculate();
 });
 table.addEventListener('click',event=>{
  if(!event.target.closest('[data-action="remove"]'))return;
  const row=event.target.closest('tr');
  peaks.splice(Number(row.dataset.index),1);
  drawRows();
 });
 $('piAdd').addEventListener('click',()=>{
  if(peaks.length>=500){setMessage(tr('En fazla 500 pik girilebilir.','At most 500 peaks are supported.'),true);return;}
  peaks.push({twoTheta:'',h:'',k:'',l:''});drawRows();
  table.lastElementChild?.querySelector('input')?.focus();
 });
 $('piTitanium').addEventListener('click',()=>{
  peaks=initial();system.value='hexagonal';lambda.value=String(TITANIUM_WAVELENGTH);
  drawRows();
 });
 $('piClear').addEventListener('click',()=>{
  peaks=[{twoTheta:'',h:'',k:'',l:''},{twoTheta:'',h:'',k:'',l:''},{twoTheta:'',h:'',k:'',l:''}];
  drawRows();
 });
 system.addEventListener('change',calculate);
 lambda.addEventListener('input',calculate);
 $('piImportButton').addEventListener('click',()=>importInput.click());
 importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];if(!file)return;
  try{
   if(file.size>120000)throw new RangeError('CSV file is too large.');
   peaks=parsePeakCsv(await file.text());
   drawRows();
  }catch(error){setMessage(tr('CSV okunamadı: ','Could not read CSV: ')+displayError(error.message),true);}
  finally{importInput.value='';}
 });
 $('piExport').addEventListener('click',()=>{
  try{
   const csv=peakCsv(peaks,lastFit);
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='kristalyapi_pik_indisleme.csv';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setMessage(displayError(error.message),true);}
 });
 window.addEventListener('crystal-language-change',()=>{
  translate();drawRows();
 });
 translate();drawRows();
 return {get peaks(){return peaks.map(p=>({...p}));},
  get fit(){return lastFit;},refresh:calculate};
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPowderIndexingPage,{once:true});
 else initPowderIndexingPage();
}
