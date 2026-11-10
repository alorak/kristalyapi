/* Excel-style XRD indexing worksheet; fit only for user-assigned hkl. */
import {TITANIUM_PEAKS,TITANIUM_WAVELENGTH,observedPeak,fitPowderPeaks,
 parsePeakCsv,peakCsv} from './powder-indexing-core.js';
import {autoIndexPowder,parseMeasuredAngles} from './powder-auto-index-core.js';

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
 let peaks=initial(),lastFit=null,lastAuto=null,autoRevision=0;

 // Auto indexing operates on 2theta only. Existing hkl values are not used for
 // candidate generation, preserving the manual worksheet as a separate workflow.
 const autoPanel=$('piAutoPanel'),autoStatus=$('piAutoStatus');
 const autoResults=$('piAutoResults'),autoCenter=$('piAutoCenter');
 const autoFields=['piAutoTolerance','piAutoAmin','piAutoAmax','piAutoCmin','piAutoCmax'];
 function autoMessage(message,invalid=false){
  autoStatus.textContent=message;autoStatus.dataset.state=invalid?'invalid':'ready';
 }
 function clearAuto(){
  ++autoRevision;lastAuto=null;autoResults.replaceChildren();
  autoMessage(tr('Arama için açıları girip Adayları hesapla seçin.',
   'Enter angles and select Calculate candidates.'));
 }
 function autoError(error){
  const text=String(error?.message||error);
  if(text.includes('5–40'))return tr('Otomatik indisleme 5–40 deneysel pik gerektirir.','Automatic indexing requires 5–40 measured peaks.');
  if(text.includes('Invalid 2theta'))return tr('2θ değerleri 3°–150° arasında olmalı.','2theta must be between 3° and 150°.');
  if(text.includes('Repeated or unresolved'))return tr('Tekrarlanan/üst üste binen pikleri kontrol edin.','Review repeated or overlapping peaks.');
  if(text.includes('search range'))return tr('Örgü parametresi aralığını kontrol edin.','Check the lattice-parameter bounds.');
  if(text.includes('Tolerance'))return tr('Açı toleransı 0,05°–0,6° olmalı.','Angle tolerance must be 0.05°–0.6°.');
  return text;
 }
 function autoVisibility(){
  const hex=system.value==='hexagonal';
  $('piAutoCenterWrap').hidden=hex;
  root.querySelectorAll('.pi-hex-field').forEach(el=>el.hidden=!hex);
 }
 function autoText(tag,content,classname=''){
  const node=document.createElement(tag);
  if(classname)node.className=classname;
  node.textContent=content;
  return node;
 }
 function renderAuto(){
  autoResults.replaceChildren();
  if(!lastAuto)return;
  if(!lastAuto.candidates.length){
   autoMessage(tr('Belirtilen aralık ve toleransla güvenilir aday bulunamadı. Daha fazla pik ekleyin veya arama sınırlarını kontrol edin.',
    'No candidates passed the search bounds and tolerance. Add peaks or review the search limits.'),true);
   return;
  }
  autoMessage(tr(lastAuto.candidates.length+' aday bulundu. En düşük RMSE tek başına doğru indislemeyi kanıtlamaz.',
   lastAuto.candidates.length+' candidates found. Low RMSE alone does not prove correct indexing.'));
  lastAuto.candidates.forEach((candidate,rank)=>{
   const card=autoText('article','', 'pi-auto-candidate');
   const top=autoText('div','', 'pi-auto-candidate-top');
   const heading=autoText('strong',
    '#'+(rank+1)+' · '+(candidate.system==='cubic'?
     tr('Kübik ','Cubic ')+candidate.centering:tr('Hekzagonal','Hexagonal')));
   const summary=autoText('span',
    'a '+number(candidate.a,4)+' Å'+(candidate.system==='hexagonal'?
     ' · c '+number(candidate.c,4)+' Å':'')+
    ' · '+candidate.matched.length+'/'+lastAuto.peakCount+' '+tr('eşleşme','matched')+
    ' · RMSE '+number(candidate.rmse,4)+'°');
   top.append(heading,summary);
   const details=document.createElement('details');
   if(rank===0)details.open=true;
   const disclose=autoText('summary',tr('hkl atamalarını ve açıklanamayan pikleri göster',
    'Show hkl assignments and unmatched peaks'));
   details.append(disclose);
   const holder=autoText('div','', 'pi-auto-table-scroll');
   const table=document.createElement('table');
   const thead=document.createElement('thead'),header=document.createElement('tr');
   for(const title of ['2θ (°)','hkl',tr('2θ hesap (°)','2θ calc (°)'),'Δ2θ (°)'])
    header.append(autoText('th',title));
   thead.append(header);table.append(thead);
   const tbody=document.createElement('tbody');
   for(const match of candidate.matched){
    const row=document.createElement('tr');
    for(const value of [number(match.twoTheta,3),
     '('+[match.h,match.k,match.l].join(' ')+')',
     number(match.predictedTwoTheta,3),number(match.deltaTwoTheta,4)])
     row.append(autoText('td',value));
    tbody.append(row);
   }
   for(const unassigned of candidate.unmatched){
    const row=document.createElement('tr');row.className='pi-auto-unmatched';
    for(const value of [number(unassigned.twoTheta,3),'—','—',tr('Eşleşmedi','Unmatched')])
     row.append(autoText('td',value));
    tbody.append(row);
   }
   table.append(tbody);holder.append(table);details.append(holder);
   const note=autoText('p',
    tr('Ölçüm aralığında eşleşmeyen kuramsal çizgi: ','Unmatched theoretical lines in scan range: ')+
     candidate.unpredicted+'. '+tr('Faz ve yoğunluk doğrulaması yapılmadı.',
      'Phase and intensities are unverified.'),'pi-auto-small');
   details.append(note);
   const apply=document.createElement('button');apply.type='button';
   apply.textContent=tr('hkl atamalarını manuel tabloya aktar','Apply hkl assignments to manual table');
   const complete=candidate.matched.length===lastAuto.peakCount;
   apply.disabled=!complete;
   if(!complete)apply.title=tr('Eşleşmeyen ölçüm pikleri varken manuel tabloya otomatik atama yapılamaz.',
    'Partial indexing cannot be applied to the manual worksheet.');
   apply.addEventListener('click',()=>{
    const byIndex=new Map(candidate.matched.map(m=>[m.rowIndex,m]));
    peaks=peaks.map((p,i)=>({...p,h:byIndex.get(i).h,k:byIndex.get(i).k,l:byIndex.get(i).l}));
    drawRows();
    $('piModeManual').click();
    setMessage(tr('Otomatik hkl atamaları manuel tabloya aktarıldı; örgü parametreleri yeniden hesaplandı.',
     'Candidate hkl assignments applied; the lattice parameters were refitted.'));
   });
   details.append(apply);
   card.append(top,details);
   autoResults.append(card);
  });
 }
 function runAuto(){
  const revision=++autoRevision;
  autoMessage(tr('Aday örgüler aranıyor…','Searching candidate lattices…'));
  autoResults.replaceChildren();lastAuto=null;
  $('piAutoRun').disabled=true;
  // Yield once to paint the pending status before a bounded synchronous search.
  setTimeout(()=>{
   if(revision!==autoRevision){$('piAutoRun').disabled=false;return;}
   try{
    lastAuto=autoIndexPowder({
     peaks:peaks.map(p=>({twoTheta:p.twoTheta})),
     wavelength:lambda.value,system:system.value,centering:autoCenter.value,
     toleranceDeg:$('piAutoTolerance').value,
     aMin:$('piAutoAmin').value,aMax:$('piAutoAmax').value,
     cMin:$('piAutoCmin').value,cMax:$('piAutoCmax').value,
     limit:8
    });
    renderAuto();
   }catch(error){
    autoMessage(autoError(error),true);
   }finally{$('piAutoRun').disabled=false;}
  },0);
 }
 function setAutoMode(auto){
  $('piModeManual').setAttribute('aria-pressed',String(!auto));
  $('piModeAuto').setAttribute('aria-pressed',String(auto));
  autoPanel.hidden=!auto;
  if(auto)autoVisibility();
 }
 $('piModeManual').addEventListener('click',()=>setAutoMode(false));
 $('piModeAuto').addEventListener('click',()=>setAutoMode(true));
 $('piAutoRun').addEventListener('click',runAuto);
 $('piAutoLoadAngles').addEventListener('click',()=>{
  try{
   peaks=parseMeasuredAngles($('piAutoAngles').value)
    .map(p=>({twoTheta:p.twoTheta,h:'',k:'',l:''}));
   drawRows();clearAuto();
   autoMessage(tr(peaks.length+' adet 2θ değeri tabloya eklendi; hkl atamaları henüz yapılmadı.',
    peaks.length+' measured angles loaded; hkl assignments are pending.'));
  }catch(error){autoMessage(autoError(error),true);}
 });
 for(const id of ['piAutoTolerance','piAutoAmin','piAutoAmax','piAutoCmin','piAutoCmax']){
  $(id).addEventListener('change',clearAuto);
 }
 autoCenter.addEventListener('change',clearAuto);

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
  // d, theta and sin²theta are observable from 2theta alone. Do not require
  // hkl before auto indexing; a neutral dummy triple is used for Bragg only.
  const measured=numeric.map(p=>{try{return observedPeak({...p,h:1,k:0,l:0},wavelength);}catch{return null;}});
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
  calculate();clearAuto();
 });
 table.addEventListener('click',event=>{
  if(!event.target.closest('[data-action="remove"]'))return;
  const row=event.target.closest('tr');
  peaks.splice(Number(row.dataset.index),1);
  drawRows();clearAuto();
 });
 $('piAdd').addEventListener('click',()=>{
  if(peaks.length>=500){setMessage(tr('En fazla 500 pik girilebilir.','At most 500 peaks are supported.'),true);return;}
  peaks.push({twoTheta:'',h:'',k:'',l:''});drawRows();
  clearAuto();table.lastElementChild?.querySelector('input')?.focus();
 });
 $('piTitanium').addEventListener('click',()=>{
  peaks=initial();system.value='hexagonal';lambda.value=String(TITANIUM_WAVELENGTH);
  drawRows();clearAuto();
 });
 $('piClear').addEventListener('click',()=>{
  peaks=[{twoTheta:'',h:'',k:'',l:''},{twoTheta:'',h:'',k:'',l:''},{twoTheta:'',h:'',k:'',l:''}];
  drawRows();clearAuto();
 });
 system.addEventListener('change',()=>{calculate();clearAuto();autoVisibility();});
 lambda.addEventListener('input',()=>{calculate();clearAuto();});
 $('piImportButton').addEventListener('click',()=>importInput.click());
 importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];if(!file)return;
  try{
   if(file.size>120000)throw new RangeError('CSV file is too large.');
   peaks=parsePeakCsv(await file.text());
   drawRows();clearAuto();
  }catch(error){setMessage(tr('CSV okunamadı: ','Could not read CSV: ')+displayError(error.message),true);}
  finally{importInput.value='';}
 });
 $('piExport').addEventListener('click',()=>{
  try{
   const csv=peakCsv(peaks,lastFit,lambda.value);
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='kristalyapi_pik_indisleme.csv';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setMessage(displayError(error.message),true);}
 });
 window.addEventListener('crystal-language-change',()=>{
  translate();drawRows();renderAuto();
 });
 translate();drawRows();autoVisibility();clearAuto();
 return {get peaks(){return peaks.map(p=>({...p}));},
  get fit(){return lastFit;},refresh:calculate};
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPowderIndexingPage,{once:true});
 else initPowderIndexingPage();
}
