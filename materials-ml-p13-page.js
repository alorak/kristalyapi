/* P1.3 audit UI, distinct from P1.2 point predictions. */
import {runP13Validation} from './materials-ml-p13-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const el=(tag,text='',klass='')=>{const o=document.createElement(tag);o.textContent=text;if(klass)o.className=klass;return o;};
const fmt=n=>Number(n).toFixed(3);
export function initMaterialsMlP13(download){
 const run=$('materialsMlP13Run'),save=$('materialsMlP13Export');
 const status=$('materialsMlP13Status'),result=$('materialsMlP13Result');
 let report=null,busy=false;
 function render(){
  result.replaceChildren();save.disabled=!report;
  if(!report)return;
  const q=report.quality;
  result.append(el('p',t('Kaynak kayıt ','Source records ')+q.sourceRecords+
   ' · '+t('kabul ','accepted ')+q.accepted+' · '+t('ret ','rejected ')+q.rejected+
   ' · '+q.formulas+' '+t('formül','formulas')+' · '+q.multiSGFormulas+
   ' '+t('çok-SG formülü','multi-SG formulas'),'materials-ml-detail'));
  result.append(el('p',t('Farklı SG, benzer kaba geometri şüphesi: ',
   'Different-SG near-duplicate descriptor warning: ')+q.nearDescriptorMatchesAcrossSG+
   '. '+t('Yapısal eşdeğerlik kanıtı değildir.','Not a structure equivalence proof.'),
   'materials-ml-detail'));
  const table=el('table','','materials-ml-p13-table');
  const head=el('tr');
  for(const v of [t('Hedef','Target'),t('Geometri MAE','Geometry MAE'),
    t('Temel MAE','Baseline MAE'),t('İyileşme','Improvement'),t('Bootstrap %95','Bootstrap 95%')])
   head.append(el('th',v));
  table.append(head);
  for(const [key,unit]of [['targetGapEV','eV'],['targetFormationEVPerAtom','eV/atom']]){
   const x=report.targets[key],tr=el('tr');
   const ci=x.clusteredBootstrap95;
   for(const value of [key==='targetGapEV'?t('OptB88vdW bant','OptB88vdW gap'):
    t('Oluşum enerjisi','Formation energy'),
    fmt(x.structuralMAE)+' '+unit,fmt(x.baselineMAE)+' '+unit,
    fmt(x.improvement)+' '+unit,'['+fmt(ci.low)+', '+fmt(ci.high)+']'])
    tr.append(el('td',value));
   table.append(tr);
  }
  result.append(table);
  result.append(el('p',t('Dört tekrarlı formül/uzay grubu ayrımlı fold; her foldun model ağırlıkları yalnız iç doğrulamada seçilir. Pozitif iyileşme geometri modelinin lehinedir. Aynı kristaller farklı foldlarda tekrarlanabilir; aralıklar bağımsız dış test veya tahmin kapsamı değildir.',
   'Four rotating formula/space-group-held-out folds; each fold tunes only on its inner validation. Positive improvement favors geometry. Records may recur across folds; intervals are neither external evidence nor predictive coverage.'),'materials-ml-caution'));
  const details=el('details');details.append(el('summary',t('Fold ayrıntıları','Fold details')));
  for(const key of Object.keys(report.targets)){
   const x=report.targets[key];details.append(el('p',key));
   for(const fold of x.folds)details.append(el('p','Fold '+fold.fold+
    ' · n='+fold.structural.n+' · MAE '+fmt(fold.structural.mae)+
    ' / '+fmt(fold.baseline.mae)+' · bond '+fold.selected.bond+' · coord '+fold.selected.coord));
  }
  result.append(details);
 }
 run.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;run.disabled=true;save.disabled=true;result.replaceChildren();report=null;
  status.textContent=t('Kaynak geometri ve faz-gruplu çapraz doğrulama çalışıyor…',
   'Auditing structures and grouped cross-validation…');
  try{
   const response=await fetch(new URL('./models/jarvis-polymorph-p12-source.json',import.meta.url));
   if(!response.ok)throw Error('JARVIS source missing: HTTP '+response.status);
   const raw=await response.text();
   if(raw.length>200000)throw Error('Kaynak veri sınırı aşıldı.');
   const source=JSON.parse(raw);
   if(typeof Worker==='undefined')report=runP13Validation(source);
   else report=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./materials-ml-p13-worker.js',import.meta.url),{type:'module'});
    let done=false;
    const stop=()=>{done=true;worker.terminate();};
    worker.onmessage=e=>{
     if(done)return;
     stop();e.data?.ok?resolve(e.data.report):reject(Error(e.data?.message||'P1.3 worker failed'));
    };
    worker.onerror=()=>{if(done)return;stop();reject(Error('P1.3 worker load failed'));};
    worker.postMessage(source);
   });
   status.textContent=t('Veri kalite ve çapraz doğrulama raporu hazır.',
    'Data-quality and grouped validation report complete.');
  }catch(error){report=null;status.textContent=t('P1.3 denetimi başarısız: ','P1.3 audit failed: ')+error.message;}
  finally{busy=false;run.disabled=false;render();}
 });
 save.addEventListener('click',()=>{if(report)download('materials-ml-p13-validation.json',
  JSON.stringify(report,null,2)+'\n','application/json');});
 window.addEventListener('crystal-language-change',()=>{if(report)render();});
 return {};
}
