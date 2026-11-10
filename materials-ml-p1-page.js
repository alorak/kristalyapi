/* P1: separate, source-labelled hybrid-DFT screening. P0 experimental gap remains unchanged. */
import {structureDescriptorsP1,prepareStructuralModel,predictStructuralProperties} from './materials-ml-p1-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const el=(tag,text,className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const fmt=n=>Number(n).toFixed(3);
const keyOf=s=>JSON.stringify([s.name,s.workspace,s.nonPeriodic,s.cell,s.sites?.map(x=>[x.symbol,x.x,x.y,x.z,x.occupancy])]);
export function initMaterialsMlP1(host,download){
 const run=$('materialsMlP1Run'),exportButton=$('materialsMlP1Export'),
  status=$('materialsMlP1Status'),result=$('materialsMlP1Result');
 let pending=null,record=null,busy=false;
 const model=()=>pending||(pending=(async()=>{
  const url=new URL('./models/zebra-structural-p1.json',import.meta.url);
  const response=await fetch(url.href,{cache:'default'});
  if(!response.ok)throw Error(t('Yapısal model dosyası bulunamadı.','Structural model file unavailable.'));
  const text=await response.text();
  if(text.length>250000)throw Error('P1 model boyutu sınır dışında.');
  return prepareStructuralModel(JSON.parse(text));
 })().catch(e=>{pending=null;throw e;}));
 function clear(message){
  record=null;exportButton.disabled=true;result.replaceChildren();status.textContent=message;
 }
 function draw(){
  result.replaceChildren();exportButton.disabled=!record||busy;
  if(!record)return;
  const {features,prediction,model}=record;
  result.append(el('p',t('Yapı tanımlayıcıları: ','Structure descriptors: ')+
   'V/atom='+fmt(features.volumePerAtomA3)+' Å³ · '+t('yoğunluk ','density ')+fmt(features.densityGcm3)+
   ' g/cm³ · '+t('ortalama en yakın bağ ','mean shortest neighbor ')+fmt(features.meanClosestBondA)+
   ' Å · '+t('yakın komşuluk ','near-neighbor count ')+fmt(features.meanCoordination),'materials-ml-detail'));
  if(prediction.status==='out-of-domain'){
   result.append(el('strong',t('Tahmin reddedildi: yeterince benzer eğitim bileşimi ve hacmi bulunamadı.',
    'No prediction: no sufficiently close training composition and volume.'),'materials-ml-value'));
  }else{
   const lookup=prediction.status==='training-reference';
   result.append(el('p',lookup?t('Eğitim kaydı: bağımsız tahmin değildir.','Training-set lookup: not an independent prediction.'):
    t('P1 yapısal kNN tahmini','P1 structural kNN estimate'),'materials-ml-label'));
   const values=el('div','','materials-ml-p1-values');
   for(const [label,value,unit] of [
    [t('Hibrit-DFT doğrudan bant aralığı','Hybrid-DFT direct band gap'),prediction.hybridDirectGapEV,'eV'],
    [t('DFT oluşum enerjisi','DFT formation energy'),prediction.formationEnergyEVPerAtom,'eV/atom']
   ]){
    const card=el('div','','materials-ml-p1-metric');
    card.append(el('span',label),el('strong',fmt(value)+' '+unit));values.append(card);
   }
   result.append(values);
  }
  const metrics=model.meta;
  result.append(el('p',t('Bağımsız test: ','Held-out test: ')+metrics.test+
   ' · '+t('doğrudan aralık MAE ','direct-gap MAE ')+fmt(metrics.gap.maeEV)+
   ' eV · '+t('oluşum enerjisi MAE ','formation-energy MAE ')+fmt(metrics.formation.maeEV)+
   ' eV/atom · '+t('kapsama ','coverage ')+fmt(metrics.acceptance.coverage*100)+
   '%. '+t('Belirsizlik aralığı değildir.','Not a confidence interval.'),'materials-ml-detail'));
  const details=document.createElement('details');
  details.append(el('summary',t('En yakın eğitim yapıları','Nearest training structures')));
  const list=document.createElement('ul');
  for(const match of prediction.neighbors)list.append(el('li',match.formula+' · '+match.id+
   ' · V/atom '+fmt(match.vpa)+' Å³ · d²='+fmt(match.distance)));
  details.append(list);result.append(details);
  result.append(el('p',t(
   'Eğitimde kullanılan girdiler: element kesirleri ve atom başına hacim. Periyodik komşuluk/bağ uzunlukları ayrı doğrulama ve bilgilendirme içindir; bu P1 modelinin öğrenilmiş girdisi değildir. Aynı bileşimli ve eşit hacimli polimorflar ayırt edilmez.',
   'Training inputs are elemental fractions and volume per atom. Periodic neighbors and bond lengths are audited separately, not learned inputs of this P1 model. Polymorphs of identical composition and volume remain indistinguishable.'),'materials-ml-caution'));
 }
 run.addEventListener('click',async()=>{
  if(busy)return;
  try{
   const structure=host.structure(),key=keyOf(structure);
   busy=true;run.disabled=true;clear(t('Periyodik komşuluklar inceleniyor…','Analyzing periodic neighbors…'));
   const features=structureDescriptorsP1(structure);
   const trained=await model(),prediction=predictStructuralProperties(trained,features);
   if(key!==keyOf(host.structure())){
    clear(t('Etkin yapı değişti; yeniden çalıştırın.','Structure changed; rerun screening.'));return;
   }
   record={key,features,prediction,model:trained};
   status.textContent=prediction.status==='out-of-domain'?
    t('Yapısal eğitim aralığı dışında. Sayısal sonuç gösterilmedi.','Out of structural training domain. No numeric estimate.'):
    t('P1 sonuçları hazır; bunlar hesaplanmış eğitim hedeflerinin ML kestirimidir.','P1 ready: ML estimates of computational reference targets.');
  }catch(error){clear(t('P1 tahmin hatası: ','P1 prediction failed: ')+error.message);}
  finally{busy=false;run.disabled=false;draw();}
 });
 exportButton.addEventListener('click',()=>{
  if(!record||record.key!==keyOf(host.structure())){clear(t('Kristal değişti; tahmin geçersiz.','Crystal changed; estimate invalid.'));return;}
  const {key,features,prediction,model:trained}=record;
  const resultJSON={
   schema:'kristalyapi.materials-ml-structure-p1.v1',
   modelId:trained.modelId,targets:{hybridDftDirectGapEV:prediction.hybridDirectGapEV,
    formationEnergyEVPerAtom:prediction.formationEnergyEVPerAtom},
   status:prediction.status,geometry:{...features},nearest:prediction.neighbors,
   validation:prediction.evaluation,source:'ZEBRA-dataset (CC BY 4.0), Yamamoto et al. 2026',
   disclaimer:'Not experimental, no calibrated uncertainty; PBC bonds are not a supervised model feature.'
  };
  download('materials-ml-structure-p1.json',JSON.stringify(resultJSON,null,2)+'\n','application/json');
 });
 window.addEventListener('crystal-language-change',()=>{if(record)draw();});
 clear(t('Etkin periyodik CIF yapısını P1 ile incelemek için hesaplamayı başlatın.','Run P1 structural screening on the active periodic CIF.'));
 return {setVisible(visible){if(visible&&record&&record.key!==keyOf(host.structure()))
  clear(t('Etkin yapı değişti; önceki P1 sonuçları temizlendi.','Structure changed; previous P1 results cleared.'));}};
}
