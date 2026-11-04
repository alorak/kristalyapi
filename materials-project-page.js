/* Materials Project library UI. The user's key is held in this module's memory only.
 * No localStorage, sessionStorage, indexedDB, telemetry or URL credentials. */
import {mpSearchUrl,mpStructureUrl,normalizeMpResponse,mpStructureToCif,mpApiGet,mpCompareRows} from './materials-project-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const node=(tag,value='',cls='')=>{
 const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;
};
const number=(value,digits=4)=>value===null||value===undefined?'—':Number(value).toLocaleString(
 window.CrystalI18n?.language==='en'?'en-US':'tr-TR',{maximumFractionDigits:digits});
export function initMaterialsProjectPage({onImport,onMissingKey}={}){
 let apiKey='',results=[],selected=new Map(),busy=false,searchAbort=null;
 const status=(id,text,kind='')=>{
  const el=$(id);el.textContent=text;el.dataset.state=kind;
 };
 const keyStatus=()=>status('mpKeyStatus',apiKey?
  t('Anahtar bu açık sayfanın belleğinde tanımlı; henüz doğrulanmadı.','Key configured in this page memory; not yet verified.'):
  t('API anahtarı girilmedi.','API key not configured.'),apiKey?'ready':'');
 $('mpKeySave').addEventListener('click',()=>{
  const key=$('mpApiKey').value.trim();
  if(!key||key.length>512){status('mpKeyStatus',t('1–512 karakterlik bir API anahtarı girin.','Enter an API key of 1–512 characters.'),'error');return;}
  apiKey=key;
  $('mpApiKey').value='';
  keyStatus();
 });
 $('mpKeyClear').addEventListener('click',()=>{
  apiKey='';
  $('mpApiKey').value='';
  searchAbort?.abort();
  results=[];selected.clear();renderResults();renderCompare();keyStatus();
  status('mpSearchStatus',t('Anahtar silindi, arama sonuçları temizlendi.','Key erased; search results cleared.'));
 });
 $('mpKeyReveal').addEventListener('change',()=>{
  $('mpApiKey').type=$('mpKeyReveal').checked?'text':'password';
 });
 function renderCompare(){
  const host=$('mpCompare');host.replaceChildren();
  if(!selected.size){
   host.append(node('p',t('Karşılaştırma için arama sonuçlarından en çok dört malzeme seçin.',
    'Select up to four materials from results for comparison.'),'hint'));return;
  }
  const scroll=node('div','','materials-table-scroll'),table=document.createElement('table');
  const header=document.createElement('tr');
  header.append(node('th',t('Özellik','Property')));
  [...selected.values()].forEach(r=>header.append(node('th',r.formula+' · '+r.materialId)));
  const head=document.createElement('thead');head.append(header);table.append(head);
  const body=document.createElement('tbody');
  for(const row of mpCompareRows([...selected.values()])){
   const tr=document.createElement('tr');
   tr.append(node('th',row.label+(row.unit?' ('+row.unit+')':'')));
   row.values.forEach(value=>tr.append(node('td',
    typeof value==='boolean'?(value?t('Evet','Yes'):t('Hayır','No')):
    typeof value==='number'?number(value,6):value===null?'—':String(value))));
   body.append(tr);
  }
  table.append(body);scroll.append(table);host.append(scroll);
  host.append(node('p',t('Bant aralıkları ve enerjiler MP hesaplama verileridir; deneysel ölçüm veya QE hesabınızın doğrulaması değildir.',
   'Gaps and energies are MP computational data, not experimental measurements or validation of your QE calculation.'),'hint'));
 }
 function setBusy(value){
  busy=value;$('mpSearchSubmit').disabled=value;
  $('mpSearchSubmit').textContent=value?t('İşleniyor…','Working…'):t('Materials Project üzerinde ara','Search Materials Project');
  $('mpKeySave').disabled=value;
 }
 async function loadRecord(record,openPowder){
  if(busy)return;
  if(!apiKey){onMissingKey?.();status('mpSearchStatus',t('Önce Materials Project Ayarları bölümünden anahtar girin.','Enter a key in Materials Project Settings first.'),'error');return;}
  const activeKey=apiKey;
  setBusy(true);status('mpSearchStatus',record.materialId+t(' yapısı getiriliyor…',' structure loading…'));
  const controller=new AbortController();searchAbort=controller;
  try{
   const response=await mpApiGet(mpStructureUrl(record.materialId),activeKey,{signal:controller.signal});
   const raw=response.data.find(r=>r?.material_id===record.materialId);
   if(!raw)throw Error('MP yanıtında seçilen malzeme yok.');
   const cif=mpStructureToCif(raw,record.materialId);
   if(controller.signal.aborted||apiKey!==activeKey)throw Error('İstek iptal edildi.');
   await onImport({cif,summary:record,openPowder});
   status('mpSearchStatus',record.materialId+t(' aktif çalışma alanına yüklendi.',' loaded into active workspace.'),'ready');
  }catch(error){
   if(!controller.signal.aborted)status('mpSearchStatus',t('Yapı alınamadı: ','Structure import failed: ')+error.message,'error');
  }finally{if(searchAbort===controller)searchAbort=null;setBusy(false);}
 }
 function renderResults(){
  const host=$('mpResults');host.replaceChildren();
  if(!results.length){
   host.append(node('p',t('Henüz sonuç yok. Kimyasal formül, element sistemi veya MP kimliği ile arayın.',
    'No results yet. Search by formula, chemical system, or MP ID.'),'hint'));return;
  }
  for(const record of results){
   const card=node('article','','mp-result-card'),title=node('h4',record.formula||record.materialId);
   const link=document.createElement('a');
   link.href='https://materialsproject.org/materials/'+record.materialId;
   link.target='_blank';link.rel='noopener noreferrer';link.textContent=record.materialId;
   const details=node('p',record.spacegroup+' · '+number(record.sites)+' '+
    t('atom konumu','sites')+' · Eg '+number(record.bandGap)+' eV · E_hull '+
    number(record.hull,6)+' eV/atom','hint');
   const actions=node('div','','mp-actions');
   const importButton=node('button',t('Kristalde aç','Open crystal'));importButton.type='button';
   importButton.addEventListener('click',()=>loadRecord(record,false));
   const xrdButton=node('button',t('Toz XRD ile aç','Open powder XRD'));xrdButton.type='button';
   xrdButton.addEventListener('click',()=>loadRecord(record,true));
   const checkLabel=document.createElement('label'),check=document.createElement('input');
   check.type='checkbox';check.checked=selected.has(record.materialId);
   check.addEventListener('change',()=>{
    if(check.checked){
     if(selected.size>=4){check.checked=false;status('mpSearchStatus',t('En fazla dört malzeme seçilebilir.','Select at most four materials.'),'error');return;}
     selected.set(record.materialId,record);
    }else selected.delete(record.materialId);
    renderCompare();
   });
   checkLabel.append(check,document.createTextNode(' '+t('Karşılaştır','Compare')));
   actions.append(importButton,xrdButton,checkLabel);
   card.append(title,link,details,actions);host.append(card);
  }
 }
 $('mpSearchForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(!apiKey){onMissingKey?.();status('mpSearchStatus',t('Önce Materials Project Ayarları bölümünden anahtar girin.','Enter a key in Materials Project Settings first.'),'error');return;}
  let url;
  try{url=mpSearchUrl($('mpQuery').value);}
  catch(error){status('mpSearchStatus',error.message,'error');return;}
  setBusy(true);const controller=new AbortController();searchAbort=controller;
  const activeKey=apiKey;
  status('mpSearchStatus',t('MP veritabanında aranıyor…','Searching Materials Project…'));
  try{
   const json=await mpApiGet(url,activeKey,{signal:controller.signal});
   if(controller.signal.aborted||apiKey!==activeKey)return;
   results=normalizeMpResponse(json);
   selected.clear();renderResults();renderCompare();
   status('mpSearchStatus',results.length+
    t(' hesaplanmış malzeme bulundu.',' computed material records found.'),'ready');
  }catch(error){
   if(!controller.signal.aborted)status('mpSearchStatus',
    t('Arama başarısız: ','Search failed: ')+error.message+
    (error instanceof TypeError?t(' · CORS veya ağ erişimini kontrol edin.',' · Check CORS/network access.'):''),
    'error');
  }finally{if(searchAbort===controller)searchAbort=null;setBusy(false);}
 });
 $('mpCompareClear').addEventListener('click',()=>{
  selected.clear();renderResults();renderCompare();
 });
 document.querySelectorAll('[data-mp-example]').forEach(b=>b.addEventListener('click',()=>{
  $('mpQuery').value=b.dataset.mpExample;
  $('mpQuery').focus();
 }));
 window.addEventListener('beforeunload',()=>{apiKey='';searchAbort?.abort();});
 keyStatus();renderResults();renderCompare();
 return {clearKey(){apiKey='';$('mpApiKey').value='';keyStatus();}};
}
