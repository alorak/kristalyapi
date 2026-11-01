/* P0 session-only, read-only material comparison. No network calls and no
 * automatic linking of a DFT result, experiment or COD record to a structure. */
import {materialCard,materialComparison,materialComparisonCsv} from './material-cards-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const node=(tag,text='',className='')=>{
 const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;
};
const fmt=v=>typeof v==='number'?String(Number(v.toFixed(5))):String(v);
export function initMaterialsPage(host,download){
 const cards=[];
 const render=()=>{
  const grid=$('materialsCards'),comparison=$('materialsComparison');
  grid.replaceChildren();comparison.replaceChildren();
  $('materialsExportJson').disabled=cards.length===0;
  $('materialsExportCsv').disabled=cards.length===0;
  $('materialsClear').disabled=cards.length===0;
  $('materialsAdd').disabled=cards.length>=4;
  $('materialsCount').textContent=cards.length+'/4 · '+t('Kartlar yalnız bu sekmede tutulur; çıkmadan önce dışa aktarın.','Snapshots are local to this tab; export before leaving.');
  cards.forEach((card,index)=>{
   const article=node('article','','materials-card');
   article.append(node('h3',(index+1)+'. '+card.name));
   article.append(node('p',card.formula+' · '+card.symmetry+' · '+card.siteCount+' '+t('P1 atom konumu','P1 atom sites')));
   article.append(node('p',t('Kaynak: ','Source: ')+card.source.label+(card.source.reference?' · '+card.source.reference:t(' (kaynak kimliği belirtilmedi)',' (reference not supplied)'))));
   article.append(node('p','V = '+fmt(card.volumeA3)+' Å³'+(card.partialOccupancy?t(' · kısmi doluluk',' · partial occupancies'):''),
    'materials-card-meta'));
   const remove=node('button',t('Kaldır','Remove'));remove.type='button';
   remove.addEventListener('click',()=>{cards.splice(index,1);render();});
   article.append(remove);grid.append(article);
  });
  if(!cards.length){comparison.append(node('p',t('Etkin kristali ekleyin, çalışma alanını değiştirip ikinci bir yapı ekleyin.','Add the active crystal, change workspace, and add another structure for comparison.')));return;}
  const scroll=node('div','','materials-table-scroll'),table=document.createElement('table');
  const head=document.createElement('thead'),first=document.createElement('tr');
  [t('Özellik','Property'),...cards.map((c,i)=>(i+1)+'. '+c.name)].forEach(label=>{const th=node('th',label);first.append(th);});
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
  comparison.append(node('p',t('Hücre farkları yalnız geometriktir. Farklı bileşim, uzay grubu ayarı veya süperhücreleri karşılaştırmak faz dönüşümünü veya malzeme üstünlüğünü kanıtlamaz.','Cell differences are geometric only; comparing distinct compositions, settings or supercells does not establish a phase change or material superiority.'),'materials-caution'));
 };
 $('materialsAdd').addEventListener('click',()=>{
  try{
   const card=materialCard(host.structure(),{
    sourceLabel:host.structure().workspace||'Active workspace',
    sourceReference:$('materialsReference').value.trim(),
    capturedAt:new Date().toISOString()
   });
   cards.push(card);render();
   $('materialsStatus').textContent=t('Anlık kopya eklendi. Kristal düzenlemeleri kartları otomatik değiştirmez.','Snapshot captured. Crystal edits do not silently modify saved comparison cards.');
  }catch(error){$('materialsStatus').textContent=t('Malzeme kartı eklenemedi: ','Cannot add material card: ')+error.message;}
 });
 $('materialsClear').addEventListener('click',()=>{cards.length=0;render();$('materialsStatus').textContent=t('Sekmedeki kartlar temizlendi.','Session cards cleared.');});
 $('materialsExportJson').addEventListener('click',()=>{
  if(!cards.length)return;
  download('materials-comparison.json',JSON.stringify({schema:'kristalyapi.material-comparison.v1',
   scientificScope:'Structural snapshot only; source identity is user entered and not independently verified.',
   cards},null,2)+'\n','application/json');
 });
 $('materialsExportCsv').addEventListener('click',()=>{
  if(cards.length)download('materials-comparison.csv','\ufeff'+materialComparisonCsv(cards),'text/csv;charset=utf-8');
 });
 window.addEventListener('crystal-language-change',render);
 render();
 return {setVisible(visible){if(visible)$('materialsStatus').textContent=cards.length?
   t('Karşılaştırılan yapı sayısı: ','Comparing ')+cards.length+t('. Etkin kristaldeki değişiklikler otomatik aktarılmaz.',' captured structures; current workspace edits are not auto-imported.'):
   t('Henüz yapı kartı yok. Etkin kristali ekleyerek başlayın.','No captured structures. Add the active crystal to begin.');}};
}
