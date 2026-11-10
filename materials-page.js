/* P1 materials workspace: local, source-aware geometry and evidence records.
 * File bytes never leave this browser. Digests prove local integrity only. */
import {materialComparison,materialComparisonCsv} from './material-cards-core.js';
import {capturedMaterialCard,attachEvidenceFile,verifyEvidenceBundle} from './material-evidence-core.js';
import {bulkStudyPreparation} from './bulk-study-preparation.js';
import {initMaterialsMl} from './materials-ml-page.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const node=(tag,text='',className='')=>{
 const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;
};
const fmt=v=>typeof v==='number'?String(Number(v.toFixed(5))):String(v);
export function initMaterialsPage(host,download){
 const cards=[];let busy=false,bulkPlan=null;
 const status=text=>$('materialsEvidenceStatus').textContent=text;
 const render=()=>{
  const grid=$('materialsCards'),comparison=$('materialsComparison'),target=$('materialsEvidenceCard');
  grid.replaceChildren();comparison.replaceChildren();target.replaceChildren();
  $('materialsExportJson').disabled=cards.length===0||busy;
  $('materialsExportCsv').disabled=cards.length===0;
  $('materialsClear').disabled=cards.length===0||busy;
  $('materialsAdd').disabled=cards.length>=4||busy;
  $('materialsEvidenceChoose').disabled=cards.length===0||busy;
  $('materialsVerifyChoose').disabled=busy;
  $('materialsCount').textContent=cards.length+'/4 · '+t('Kartlar yalnız bu sekmede tutulur; çıkmadan önce dışa aktarın.','Snapshots are local to this tab; export before leaving.');
  cards.forEach((card,index)=>{
   const opt=node('option',(index+1)+'. '+card.name);opt.value=String(index);target.append(opt);
   const article=node('article','','materials-card');
   article.append(node('h3',(index+1)+'. '+card.name));
   article.append(node('p',card.formula+' · '+card.symmetry+' · '+card.siteCount+' '+t('P1 atom konumu','P1 atom sites')));
   article.append(node('p',t('Kaynak: ','Source: ')+card.source.label+(card.source.reference?' · '+card.source.reference:t(' (kaynak kimliği belirtilmedi)',' (reference not supplied)'))));
   article.append(node('p','V = '+fmt(card.volumeA3)+' Å³'+(card.partialOccupancy?t(' · kısmi doluluk',' · partial occupancies'):''),'materials-card-meta'));
   article.append(node('p','SHA-256: '+card.geometrySha256.slice(0,16)+'… · '+card.artifacts.length+
    t(' dosya kanıt kaydı',' file evidence records'),'materials-card-meta'));
   for(const item of card.artifacts){
    article.append(node('p',item.kind+': '+item.filename+' · '+item.sha256.slice(0,12)+'…','materials-card-meta'));
   }
   const remove=node('button',t('Kaldır','Remove'));remove.type='button';remove.disabled=busy;
   remove.addEventListener('click',()=>{cards.splice(index,1);render();});
   article.append(remove);grid.append(article);
  });
  if(!cards.length){comparison.append(node('p',t('Etkin kristali ekleyin, çalışma alanını değiştirip ikinci bir yapı ekleyin.','Add the active crystal, change workspace, and add another structure for comparison.')));return;}
  const scroll=node('div','','materials-table-scroll'),table=document.createElement('table');
  const head=document.createElement('thead'),first=document.createElement('tr');
  [t('Özellik','Property'),...cards.map((c,i)=>(i+1)+'. '+c.name)].forEach(label=>first.append(node('th',label)));
  head.append(first);table.append(head);
  const tbody=document.createElement('tbody');
  for(const row of materialComparison(cards)){
   const tr=document.createElement('tr');tr.append(node('th',row.label+(row.unit==='—'?'':' ('+row.unit+')')));
   row.values.forEach((v,i)=>{
    const cell=node('td',fmt(v));
    if(row.deltas[i]!==null)cell.append(node('small',' ('+(row.deltas[i]>=0?'+':'')+row.deltas[i]+'% vs 1)'));
    tr.append(cell);
   });tbody.append(tr);
  }
  table.append(tbody);scroll.append(table);comparison.append(scroll);
  comparison.append(node('p',t('Hücre farkları yalnız geometriktir; kaynak ve dosya SHA-256 değerleri gerçek DFT/ölçüm sonucu veya kaynak kimliği doğrulaması değildir.','Cell differences are geometric only; source IDs and file digests do not verify DFT results, measurements or the identity of an external source.'),'materials-caution'));
 };
 $('materialsAdd').addEventListener('click',async()=>{
  if(busy||cards.length>=4)return;
  busy=true;const structure=host.structure();render();
  try{
   const card=await capturedMaterialCard(structure,{sourceLabel:structure.workspace||'Active workspace',
    sourceReference:$('materialsReference').value.trim(),capturedAt:new Date().toISOString()});
   cards.push(card);
   $('materialsStatus').textContent=t('Yapı kartının SHA-256 özeti oluşturuldu.','Structure SHA-256 digest captured.');
  }catch(error){$('materialsStatus').textContent=t('Malzeme kartı eklenemedi: ','Cannot add material card: ')+error.message;}
  finally{busy=false;render();}
 });
 $('materialsClear').addEventListener('click',()=>{
  if(busy)return;cards.length=0;render();status(t('Kayıtlar sekmeden temizlendi.','Records cleared from this tab.'));
 });
 $('materialsEvidenceChoose').addEventListener('click',()=>{if(cards.length&&!busy)$('materialsEvidenceFile').click();});
 $('materialsEvidenceFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;
  const index=Number($('materialsEvidenceCard').value),original=cards[index];if(!original)return;
  busy=true;render();
  try{
   const updated=await attachEvidenceFile(original,file,{
    kind:$('materialsEvidenceKind').value,sourceId:$('materialsEvidenceSource').value.trim()
   });
   if(cards[index]!==original)throw Error('Card changed while evidence was read.');
   cards[index]=updated;
   status(t('Dosyanın SHA-256 özeti yerel olarak hesaplandı. Bu, kaynağın doğruluğunu kanıtlamaz.','File SHA-256 was computed locally. This does not prove source authenticity.'));
  }catch(error){status(t('Dosya kanıtı eklenemedi: ','Evidence error: ')+error.message);}
  finally{busy=false;render();}
 });
 $('materialsExportJson').addEventListener('click',async()=>{
  if(busy||!cards.length)return;busy=true;render();
  try{
   const report=await verifyEvidenceBundle(cards);
   download('materials-evidence.json',JSON.stringify({schema:'kristalyapi.material-evidence-bundle.v1',
    limitations:'Unsigned. Structure geometry digests verified locally; external source identity and artifact bytes cannot be independently verified from this manifest.',
    cards,localVerification:report},null,2)+'\n','application/json');
   status(t('Geometri özetleri doğrulanarak JSON dosyası oluşturuldu. Harici dosyalar JSON içinde yoktur.','Geometry digests checked and JSON exported. External artifact bytes are not included.'));
  }catch(error){status('Verification failed: '+error.message);}
  finally{busy=false;render();}
 });
 $('materialsVerifyChoose').addEventListener('click',()=>{if(!busy)$('materialsVerifyFile').click();});
 $('materialsVerifyFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;busy=true;render();
  try{
   if(file.size>2_000_000)throw Error('Bundle cannot exceed 2 MB.');
   const bundle=JSON.parse(await file.text());
   if(bundle?.schema!=='kristalyapi.material-evidence-bundle.v1')throw Error('Unknown evidence bundle.');
   const result=await verifyEvidenceBundle(bundle.cards);
   status(t('Geometri özeti eşleşti: ','Geometry digests match: ')+result.length+
    t(' kart. Dosya SHA-256 kayıtları, orijinal dosyalar olmadan yeniden doğrulanamaz.',' cards. Original file bytes are needed to recheck artifact digests.'));
  }catch(error){status('Verification failed: '+error.message);}
  finally{busy=false;render();}
 });
 $('materialsExportCsv').addEventListener('click',()=>{
  if(cards.length)download('materials-comparison.csv','\ufeff'+materialComparisonCsv(cards),'text/csv;charset=utf-8');
 });
 $('materialsBulkPrepare').addEventListener('click',()=>{
  try{
   bulkPlan=bulkStudyPreparation(host.structure(),{
    material:$('materialsBulkType').value,
    kmesh:['materialsBulkKx','materialsBulkKy','materialsBulkKz'].map(id=>Number($(id).value))
   });
   $('materialsBulkResult').textContent=
    bulkPlan.crystal.formula+' · '+bulkPlan.crystal.siteCount+' '+t('atom konumu','atomic sites')+
    ' · 3D k='+bulkPlan.proposedMesh.join('×')+
    '\n'+t('Kompozisyon 1:1 uyumu: ','1:1 composition match: ')+(bulkPlan.checks.stoichiometric?'Yes':'No')+
    '\n'+bulkPlan.warnings.join('\n');
   $('materialsBulkExport').disabled=false;
  }catch(error){bulkPlan=null;$('materialsBulkExport').disabled=true;$('materialsBulkResult').textContent=error.message;}
 });
 $('materialsBulkExport').addEventListener('click',()=>{
  if(bulkPlan)download('bulk-dft-preparation.json',JSON.stringify(bulkPlan,null,2)+'\n','application/json');
 });
 const ml=initMaterialsMl(host,download);
 window.addEventListener('crystal-language-change',render);
 render();
 return {setVisible(visible){ml.setVisible(visible);if(visible)$('materialsStatus').textContent=cards.length?
  t('Karşılaştırılan yapı sayısı: ','Comparing ')+cards.length+t('. Etkin kristaldeki değişiklikler otomatik aktarılmaz.',' captured structures; current workspace edits are not auto-imported.'):
  t('Henüz yapı kartı yok. Etkin kristali ekleyerek başlayın.','No captured structures. Add the active crystal to begin.');}};
}
