/* Browser-local, opt-in ML screening for the active CIF/P1 crystal. */
import {compositionFromStructure,prepareGapModel,predictExperimentalGap} from './materials-ml-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const make=(tag,value,className='')=>{
 const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;
};
const format=value=>Number(value).toFixed(3);
function fingerprint(s){
 return JSON.stringify([s.name,s.workspace,s.nonPeriodic,s.cell,
  s.sites?.map(site=>[site.symbol,site.x,site.y,site.z,site.occupancy])]);
}
export function initMaterialsMl(host,download){
 const run=$('materialsMlRun'),exportButton=$('materialsMlExport');
 const status=$('materialsMlStatus'),result=$('materialsMlResult');
 let modelPromise=null,record=null,busy=false;
 const loadModel=()=>{
  if(!modelPromise)modelPromise=(async()=>{
   const url=new URL('./models/matbench-expt-gap-knn-p0.json',import.meta.url);
   const response=await fetch(url.href);
   if(!response.ok)throw Error(t('Paketli ML modeli bulunamadı.','Bundled ML model is unavailable.'));
   const body=await response.text();
   if(body.length>150000)throw Error('ML modeli boyut sınırı aşıldı.');
   return prepareGapModel(JSON.parse(body));
  })().catch(error=>{modelPromise=null;throw error;});
  return modelPromise;
 };
 const reset=message=>{
  record=null;exportButton.disabled=true;result.replaceChildren();
  status.textContent=message;
 };
 function render(){
  exportButton.disabled=!record||busy;
  result.replaceChildren();
  if(!record)return;
  const {prediction,composition,model,structureName}=record;
  result.append(make('p',t('Etkin yapı: ','Active structure: ')+structureName+
   ' · '+composition.map(([el,v])=>el+' '+(v*100).toFixed(1)+'%').join(', '),'materials-ml-composition'));
  if(prediction.status==='out-of-domain'){
   result.append(make('strong',t('Tahmin üretilmedi: bileşim eğitim örneklerinden uzak.','No prediction: composition is far from training examples.'),'materials-ml-value'));
  }else{
   const label=prediction.status==='training-reference'?
    t('Eğitim kümesindeki kayıt (bağımsız tahmin değil)','Training-set lookup (not an independent prediction)'):
    t('ML deneysel bant aralığı tahmini','ML experimental band-gap estimate');
   result.append(make('p',label,'materials-ml-label'));
   result.append(make('strong',format(prediction.gapEV)+' eV','materials-ml-value'));
  }
  result.append(make('p',
   t('Matbench iç doğrulama: ','Matbench internal holdout: ')+model.validation.samples+
   ' '+t('örnek · MAE ','samples · MAE ')+format(model.validation.maeEV)+
   ' eV. '+t('Bu değer bir güven aralığı değildir.','This is not a confidence interval.'),
   'materials-ml-detail'));
  const details=document.createElement('details'),summary=make('summary',t('En yakın eğitim bileşimleri','Nearest training compositions'));
  details.append(summary);
  const list=document.createElement('ul');
  for(const n of prediction.nearest)list.append(make('li',n.formula+' · '+format(n.gapEV)+' eV · d²='+format(n.distanceSquared)));
  details.append(list);result.append(details);
  result.append(make('p',t(
   'Bileşim tabanlı kNN; simetri, polimorf, atom konumları, sıcaklık ve doğrudan/dolaylı aralık bilgisi kullanılmaz. Oluşum enerjisi P0 kapsamında tahmin edilmez. QE/DFT veya deney sonucu değildir.',
   'Composition-only kNN; symmetry, polymorph, atom coordinates, temperature and direct/indirect gap are ignored. Formation energy is not predicted in P0. Not QE/DFT or a measurement.'),'materials-ml-caution'));
 }
 run.addEventListener('click',async()=>{
  if(busy)return;
  let snapshot;
  try{
   snapshot=host.structure();
   const composition=compositionFromStructure(snapshot);
   const key=fingerprint(snapshot);
   busy=true;run.disabled=true;reset(t('Yerel eğitim verisi okunuyor ve tahmin hazırlanıyor…','Loading local training data and preparing prediction…'));
   const model=await loadModel(),prediction=predictExperimentalGap(model,composition);
   if(key!==fingerprint(host.structure())){
    reset(t('Etkin kristal değişti; tahmin geçersiz kılındı.','Active crystal changed; prediction invalidated.'));return;
   }
   record={key,composition,prediction,model,structureName:String(snapshot.name||snapshot.workspace||'Crystal').slice(0,140)};
   status.textContent=prediction.status==='out-of-domain'?
    t('Model eğitim alanı dışında: değer gösterilmiyor.','Outside model domain: no value shown.'):
    prediction.status==='training-reference'?
    t('Aynı bileşim eğitim verisinde: referans kaydı gösteriliyor.','Composition appears in training: showing a reference lookup.'):
    t('Bileşim tabanlı deneysel bant aralığı tahmini hazır.','Composition-based experimental band-gap estimate ready.');
  }catch(error){reset(t('ML tahmini yapılamadı: ','ML screening failed: ')+error.message);}
  finally{busy=false;run.disabled=false;render();}
 });
 exportButton.addEventListener('click',()=>{
  if(!record||record.key!==fingerprint(host.structure())){reset(t('Etkin yapı değişti; yeniden hesaplayın.','Structure changed; run again.'));return;}
  const {prediction,composition,model,structureName}=record;
  download('materials-ml-gap-p0.json',JSON.stringify({
   schema:'kristalyapi.materials-ml-result.v1',property:'experimental_band_gap_eV',
   modelId:model.modelId,structureName,composition,
   bandGapEV:prediction.gapEV,status:prediction.status,nearest:prediction.nearest,
   validation:model.validation,source:'Matbench v0.1 / Zhuo et al. 2018',
   disclaimer:'Composition-only experimental-gap kNN baseline; not DFT, not a confidence interval.'
  },null,2)+'\n','application/json');
 });
 window.addEventListener('crystal-language-change',()=>{if(record)render();});
 reset(t('Etkin periyodik kristali analiz etmek için tahmini başlatın.','Run screening on the active periodic crystal.'));
 return {setVisible(visible){
  if(visible&&record&&record.key!==fingerprint(host.structure()))
   reset(t('Etkin kristal değişti; önceki tahmin temizlendi.','Active crystal changed; previous estimate cleared.'));
 }};
}
