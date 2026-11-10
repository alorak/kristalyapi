/* P1.2 opt-in local training and independent space-group-held-out polymorph audit.
 * Kept separate from P0 experimental gap and P1 ZEBRA hybrid direct gap.
 */
import {trainPolymorphModel,inferPolymorphProperties} from './materials-ml-p12-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const n=(tag,txt,klass='')=>{const e=document.createElement(tag);e.textContent=txt;if(klass)e.className=klass;return e;};
const f=v=>Number(v).toFixed(3);
const stamp=s=>JSON.stringify([s.name,s.workspace,s.nonPeriodic,s.cell,
 s.sites?.map(x=>[x.symbol,x.x,x.y,x.z,x.occupancy])]);
export function initMaterialsMlP12(host,download){
 const start=$('materialsMlP12Run'),exportButton=$('materialsMlP12Export');
 const output=$('materialsMlP12Result'),status=$('materialsMlP12Status');
 let trainedPromise=null,record=null,running=false;
 const load=()=>{
  if(!trainedPromise)trainedPromise=(async()=>{
   const response=await fetch(new URL('./models/jarvis-polymorph-p12-source.json',import.meta.url));
   if(!response.ok)throw Error(t('JARVIS kaynak veri dosyası bulunamadı.','JARVIS source data unavailable.'));
   const text=await response.text();
   if(text.length>200000)throw Error('P1.2 dosyası boyut sınırını aşıyor.');
   const source=JSON.parse(text);
   if(typeof Worker==='undefined')return trainPolymorphModel(source);
   return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./materials-ml-p12-worker.js',import.meta.url),{type:'module'});
    const stop=()=>worker.terminate();
    worker.onmessage=event=>{
     stop();
     if(event.data?.ok)resolve(event.data.trained);
     else reject(Error(event.data?.message||'P1.2 worker training failed.'));
    };
    worker.onerror=event=>{stop();reject(Error('P1.2 worker initialization failed.'));};
    worker.postMessage(source);
   });
  })().catch(error=>{trainedPromise=null;throw error;});
  return trainedPromise;
 };
 const reset=text=>{record=null;output.replaceChildren();exportButton.disabled=true;status.textContent=text;};
 function render(){
  output.replaceChildren();exportButton.disabled=!record||running;
  if(!record)return;
  const {prediction,model}=record;
  const d=prediction.features;
  output.append(n('p',t('Öğrenilmiş özellikler: ','Trained descriptors: ')+
   t('en yakın bağ ','mean shortest bond ')+f(d.meanClosestBondA)+' Å · '+
   t('koordinasyon ','coordination ')+f(d.meanCoordination)+' · V/atom '+f(d.volumePerAtomA3)+' Å³',
   'materials-ml-detail'));
  const flex=n('div','','materials-ml-p1-values');
  const targets=[
   ['gap',t('JARVIS OptB88vdW bant aralığı','JARVIS OptB88vdW band gap'),'eV',
    'targetGapEV'],
   ['formation',t('JARVIS oluşum enerjisi','JARVIS formation energy'),'eV/atom',
    'targetFormationEVPerAtom']
  ];
  for(const [key,label,unit,k]of targets){
   const m=prediction.targets[key],box=n('div','','materials-ml-p1-metric');
   box.append(n('span',label));
   box.append(n('strong',m.value===null?
    t('Kapsam dışında','Out of domain'):f(m.value)+' '+unit));
   const validation=model.weights[k];
   box.append(n('small',t('Faz-gruplu test MAE: ','Phase-group held-out MAE: ')+
    f(validation.heldout.mae)+' '+unit+' · '+
    t('yalnız bileşim/hacim MAE: ','composition/volume-only MAE: ')+f(validation.baseline.mae)+' '+unit));
   if(validation.distinctGeometryHoldout)box.append(n('small',
    t('Ayrıca geometrik açıdan ayrık test: ','More distinct-geometry holdout: ')+
    validation.distinctGeometryHoldout.count+' · MAE '+f(validation.distinctGeometryHoldout.mae)+
    ' '+unit+' · '+t('temel MAE ','baseline MAE ')+
    f(validation.distinctGeometryBaseline.mae)+' '+unit));
   box.append(n('small',t('Bağ ağırlığı ','Bond weight ')+validation.selected.bond+
    ' · '+t('koordinasyon ağırlığı ','coordination weight ')+validation.selected.coord));
   flex.append(box);
  }
  output.append(flex);
  const c=model.counts;
  output.append(n('p',t('Eğitim ','Training ')+c.train+
   ' · '+t('hiperparametre doğrulaması ','hyperparameter validation ')+c.validation+
   ' · '+t('ayrılmış polimorf testi ','held-out polymorph test ')+c.test+
   ' · '+c.test+' '+t('test kaydı farklı uzay grubu içeren aynı bileşimlerden gelir.',
    'test records use same-composition, different-space-group samples.'),
   'materials-ml-detail'));
  const details=document.createElement('details');
  details.append(n('summary',t('Yakın eğitim yapıları ve uzay grupları','Nearest training structures and space groups')));
  const ul=document.createElement('ul');
  for(const item of prediction.targets.gap.nearest)
   ul.append(n('li',item.formula+' · '+item.jid+' · SG '+item.spacegroup+
    ' · d²='+f(item.distance)));
  details.append(ul);output.append(details);
  output.append(n('p',t(
   'Yöntemsel sınır: uzay grubu ile ayrılmış test, farklı polimorflar için bir vekil doğrulamadır; tam yapı eşdeğerliği test edilmedi. Az sayıdaki JARVIS formülüne özgüdür, güven aralığı değildir. Bu P1.2 değeri deneysel P0 ve hibrit-DFT P1 bant aralıklarıyla doğrudan karşılaştırılmamalıdır.',
   'Scope: space-group holdout is a proxy for distinct polymorphs; full structure equivalence was not established. Small JARVIS formula cohort; no uncertainty calibration. Do not conflate this P1.2 target with P0 experimental or P1 hybrid-DFT gaps.'),'materials-ml-caution'));
 }
 start.addEventListener('click',async()=>{
  if(running)return;
  try{
   const structure=host.structure(),key=stamp(structure);
   running=true;start.disabled=true;
   reset(t('Yapısal JARVIS eğitim verisi hazırlanıyor ve polimorf ayrımı doğrulanıyor…',
    'Training local JARVIS model and evaluating held-out polymorphs…'));
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const model=await load();
   const prediction=inferPolymorphProperties(model,structure);
   if(key!==stamp(host.structure())){
    reset(t('Etkin CIF değişti; sonuç geçersiz.','Active CIF changed; result invalidated.'));return;
   }
   record={key,model,prediction};
   status.textContent=t('Eğitim ve polimorf-gruplu değerlendirme tamamlandı.','Training and phase-group holdout evaluation completed.');
  }catch(error){reset(t('P1.2 çalıştırılamadı: ','P1.2 failed: ')+error.message);}
  finally{running=false;start.disabled=false;render();}
 });
 exportButton.addEventListener('click',()=>{
  if(!record||record.key!==stamp(host.structure())){
   reset(t('Etkin yapı değişti; P1.2 tekrar çalıştırılmalı.','Structure changed; rerun P1.2.'));return;
  }
  const {prediction,model}=record;
  download('materials-ml-polymorph-p12.json',JSON.stringify({
   schema:'kristalyapi.materials-ml-result.p12.v1',modelId:model.modelId,
   targetSource:'JARVIS OptB88vdW; CC BY 4.0',features:prediction.features,
   predictions:prediction.targets,holdout:model.weights,
   counts:model.counts,split:'formula|spacegroup; no held-out space group in train',
   sourceHashes:model.source,
   limitations:model.disclaimer
  },null,2)+'\n','application/json');
 });
 window.addEventListener('crystal-language-change',()=>{if(record)render();});
 reset(t('P1.2 modeli henüz eğitilip çalıştırılmadı.','P1.2 model has not been trained or run.'));
 return {setVisible(visible){if(visible&&record&&record.key!==stamp(host.structure()))
  reset(t('Yapı değişti; önceki sonuç temizlendi.','Structure changed; previous result cleared.'));}};
}
