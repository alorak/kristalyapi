/* Separate opt-in P1.2 pilot: CIF bond/coordination weights are learned, unlike P1.
 * Never silently replace the larger, better-covered P1 model. */
import {structureDescriptorsP1} from './materials-ml-p1-core.js';
import {prepareP12Model,predictP12,rankP12,polymorphPairwise} from './materials-ml-p12-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const el=(tag,content='',className='')=>{const node=document.createElement(tag);node.textContent=content;if(className)node.className=className;return node;};
const number=x=>Number(x).toFixed(3);
const fingerprint=s=>JSON.stringify([s.name,s.nonPeriodic,s.cell,s.sites?.map(x=>[x.symbol,x.x,x.y,x.z,x.occupancy])]);
function structureOf(row){
 const cell=Object.fromEntries(['a','b','c','alpha','beta','gamma'].map((k,i)=>[k,row[3][i]]));
 const sites=row[4].map(([symbol,x,y,z])=>({symbol,x,y,z}));
 return {name:row[0],cell,sites,nonPeriodic:false};
}
export function initMaterialsMlP12(host,download){
 const run=$('materialsMlP12Run'),exportBtn=$('materialsMlP12Export'),
  status=$('materialsMlP12Status'),result=$('materialsMlP12Result'),
  check=$('materialsMlP12Check'),checkStatus=$('materialsMlP12CheckStatus'),
  checkResult=$('materialsMlP12CheckResult');
 let modelTask=null,polyTask=null,record=null,busy=false;
 const loadModel=()=>modelTask||(modelTask=(async()=>{
  const response=await fetch(new URL('./models/p12/learned-knn.json',import.meta.url));
  if(!response.ok)throw Error('P1.2 model not available.');
  const body=await response.text();if(body.length>100000)throw Error('P1.2 model too large.');
  return prepareP12Model(JSON.parse(body));
 })().catch(e=>{modelTask=null;throw e;}));
 const loadPolymorph=()=>polyTask||(polyTask=(async()=>{
  const response=await fetch(new URL('./models/p12/tio2-polymorphs.json',import.meta.url));
  if(!response.ok)throw Error('TiO2 independent data unavailable.');
  const body=await response.text();if(body.length>40000)throw Error('Polymorph file too large.');
  const data=JSON.parse(body);
  if(data.schema!=='kristalyapi.p12-tio2-polymorph-independent.v1'||data.rows?.length!==8)
   throw Error('Polymorph cohort mismatch.');
  return data;
 })().catch(e=>{polyTask=null;throw e;}));
 const reset=(msg)=>{
  record=null;result.replaceChildren();exportBtn.disabled=true;status.textContent=msg;
 };
 function draw(){
  result.replaceChildren();exportBtn.disabled=!record||busy;
  if(!record)return;
  const {features,prediction,model}=record;
  result.append(el('p',t('Eğitilmiş P1.2 girdileri: ','Learned P1.2 features: ')+
   'V/atom '+number(features.volumePerAtomA3)+' Å³ · '+
   t('ortalama kısa bağ ','mean nearest bond ')+number(features.meanClosestBondA)+' Å · '+
   t('koordinasyon ','coordination ')+number(features.meanCoordination),'materials-ml-detail'));
  if(prediction.status==='out-of-domain')result.append(el('strong',
   t('Eğitim aralığı dışında: tahmin gösterilmedi.','Outside the training domain: no prediction.'),
   'materials-ml-value'));
  else{
   const lookup=prediction.status==='training-reference';
   result.append(el('p',lookup?t('Eğitim kaydı (tahmin değil)','Training reference (not a prediction)'):
    t('Araştırma modeli P1.2 tahmini','Research P1.2 estimate'),'materials-ml-label'));
   const cards=el('div','','materials-ml-p1-values');
   for(const [name,value,unit] of [
    [t('Hibrit-DFT doğrudan bant aralığı','Hybrid-DFT direct band gap'),prediction.hybridDirectGapEV,'eV'],
    [t('DFT oluşum enerjisi','DFT formation energy'),prediction.formationEnergyEVPerAtom,'eV/atom']
   ]){const card=el('div','','materials-ml-p1-metric');card.append(el('span',name),el('strong',number(value)+' '+unit));cards.append(card);}
   result.append(cards);
  }
  const m=model.metrics;
  result.append(el('p',t('Aynı 37 test yapısı üzerindeki karşılaştırma: ',
    'Matched evaluation on the same 37 held-out structures: ')+
   t('bant MAE ','gap MAE ')+number(m.gap.testBaselineMae)+' → '+number(m.gap.testP12Mae)+
   ' eV · '+t('oluşum MAE ','formation MAE ')+number(m.formation.testBaselineMae)+
   ' → '+number(m.formation.testP12Mae)+' eV/atom. '+
   t('Test verisi ağırlık seçimine katılmadı.','Test structures were excluded from weight selection.'),
   'materials-ml-detail'));
  const details=el('details');details.append(el('summary',t('En yakın öğrenilmiş örnekler','Nearest learned examples')));
  const list=el('ul');for(const match of prediction.nearest)list.append(el('li',
   match.id+' · '+match.formula+' · d²='+number(match.distance)+
   ' · '+number(match.bond)+' Å · CN '+number(match.coord)));
  details.append(list);result.append(details);
  result.append(el('p',t('Deneysel prototip: 170 CIF'in yalnız 133'ü model referansıdır. Dış TiO₂ polimorf kontrolü daha iyi sonuç vermedi. Varsayılan P1 yerine geçmez.',
   'Research prototype: only 133 of 170 CIFs are used as model references. The external TiO₂ polymorph test did not improve. Does not replace default P1.'),'materials-ml-caution'));
 }
 run.addEventListener('click',async()=>{
  if(busy)return;let key;
  try{
   const structure=host.structure();key=fingerprint(structure);
   busy=true;run.disabled=true;reset(t('P1.2 hesaplanıyor…','Running P1.2…'));
   const features=structureDescriptorsP1(structure);
   const model=await loadModel(),prediction=predictP12(model,features);
   if(key!==fingerprint(host.structure()))throw Error(t('Kristal değişti.','Crystal changed.'));
   record={key,features,model,prediction};
   status.textContent=prediction.status==='out-of-domain'?
    t('P1.2 eğitim alanı dışında.','Outside the P1.2 training domain.'):
    t('P1.2 araştırma tahmini hazır.','Research P1.2 estimate ready.');
  }catch(error){reset(t('P1.2 hatası: ','P1.2 failed: ')+error.message);}
  finally{busy=false;run.disabled=false;draw();}
 });
 exportBtn.addEventListener('click',()=>{
  if(!record||record.key!==fingerprint(host.structure())){reset(t('Kristal değişti; yeniden çalıştırın.','Crystal changed; rerun.'));return;}
  const {features,prediction,model}=record;
  download('materials-ml-p12-research.json',JSON.stringify({
   schema:'kristalyapi.materials-ml-p12-result.v1',modelId:model.modelId,
   status:prediction.status,prediction:{directGapEV:prediction.hybridDirectGapEV,
    formationEnergyEVPerAtom:prediction.formationEnergyEVPerAtom},
   descriptors:features,neighborEvidence:prediction.nearest,metrics:model.metrics,
   disclaimer:'Pilot model, not independently verified for polymorph ranking; do not use to certify materials.'
  },null,2)+'\n','application/json');
 });
 check.addEventListener('click',async()=>{
  if(busy)return;busy=true;check.disabled=true;checkResult.replaceChildren();
  checkStatus.textContent=t('Bağımsız TiO₂ yapılarına aynı model uygulanıyor…',
   'Evaluating the same model on external TiO₂ polymorphs…');
  try{
   const model=await loadModel(),source=await loadPolymorph(),entries=[];
   for(const row of source.rows){
    const features=structureDescriptorsP1(structureOf(row));
    const baseline=rankP12(model,features,'formation',{ablation:true});
    const learned=rankP12(model,features,'formation');
    entries.push({id:row[0],name:row[1],truth:row[2],baseline:baseline.rawValue,
     learned:learned.rawValue,ood:baseline.status==='out-of-domain'||learned.status==='out-of-domain'});
   }
   const ablation=polymorphPairwise(entries.map(v=>({truth:v.truth,prediction:v.baseline})));
   const enhanced=polymorphPairwise(entries.map(v=>({truth:v.truth,prediction:v.learned})));
   checkStatus.textContent=t('TiO₂: 8 eğitim dışı polimorf, 28 ikili karşılaştırma.',
    'TiO₂: 8 external polymorphs, 28 pairwise comparisons.');
   const table=el('table','','materials-ml-p12-table');
   const thead=el('thead'),head=el('tr');
   for(const x of [t('Polimorf','Polymorph'),t('E_hull (eV/atom)','E_hull (eV/atom)'),
    t('Temel Δ için ham tahmin','Baseline raw energy'),t('P1.2 ham enerji','P1.2 raw energy')])
    head.append(el('th',x));
   thead.append(head);table.append(thead);
   const body=el('tbody');
   for(const item of entries){const tr=el('tr');for(const x of [item.id+' / '+item.name,number(item.truth),
     number(item.baseline),number(item.learned)])tr.append(el('td',x));body.append(tr);}
   table.append(body);checkResult.append(table);
   checkResult.append(el('p',t('Enerji farklarının ikili MAE değeri: ','Pairwise energy-difference MAE: ')+
    number(ablation.pairwiseMae)+' → '+number(enhanced.pairwiseMae)+' eV/atom · '+
    t('doğru sıralama ','ranking agreement ')+number(100*ablation.rankAgreement)+
    '% → '+number(100*enhanced.rankAgreement)+'%.','materials-ml-detail'));
   const worsened=enhanced.pairwiseMae>=ablation.pairwiseMae;
   checkResult.append(el('p',worsened?t(
    'Bağımsız polimorf kontrolünde İYİLEŞME YOK. Aynı hedef/işlevsel ile hesaplanmış mutlak oluşum enerjileri bulunmadığı için yalnız aynı formül içindeki enerji farkları kıyaslanır.',
    'NO IMPROVEMENT in external polymorph evaluation. Only same-composition energy differences are compared; reference absolute formation energies use different computational settings.'):t(
    'Dış sıralama yalnız küçük bir TiO₂ örneğidir; genel doğrulama ve güven aralığı değildir.',
    'This small TiO₂ external ranking check is not broad validation or a confidence interval.'),'materials-ml-caution'));
   if(entries.some(x=>x.ood))checkResult.append(el('p',t('Dikkat: bazı dış yapılar eğitim alanı dışında. Sıralama yalnız tanısal ham tahminleri gösterir.',
    'Warning: some external structures are out of domain. Ranking uses diagnostic raw extrapolations only.'),'materials-ml-caution'));
  }catch(error){checkStatus.textContent=t('Dış doğrulama hatası: ','External check failed: ')+error.message;}
  finally{busy=false;check.disabled=false;}
 });
 window.addEventListener('crystal-language-change',()=>{if(record)draw();});
 reset(t('P1.2 deneysel modeli etkin kristalle değerlendirin.','Evaluate the P1.2 research model on the active crystal.'));
 checkStatus.textContent=t('Bağımsız polimorf deneyi henüz çalıştırılmadı.',
  'External polymorph check has not run.');
 return {setVisible(visible){if(visible&&record&&record.key!==fingerprint(host.structure()))
  reset(t('Kristal değişti; P1.2 sonucu temizlendi.','Crystal changed; cleared P1.2 result.'));}};
}