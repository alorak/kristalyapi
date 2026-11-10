/* Real MP electronic results from the official mp-api export.
 * Explicitly separate from both browser tight-binding and molecular GANSU DFT.
 * Never infer band/DOS curves from summary metadata. */
import {parseMpElectronic,mpReferenceCurves} from './mp-electronic-core.js';
import {setMpElectronic,currentMpElectronic,onMpElectronicChange} from './mp-electronic-state.js';
import {chart as spectralChart} from './qe-electronic-view.js';
const el=(tag,text='',cls='')=>{
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 if(cls)node.className=cls;
 return node;
};
const isEnglish=()=>window.CrystalI18n?.language==='en';
const tr=(turkish,english)=>isEnglish()?english:turkish;
function referencePlots(host,result,{browser=false}={}){
 host.replaceChildren();
 if(!result){
  host.append(el('p',tr('Henüz gerçek MP bant/DOS dosyası yüklenmedi.',
   'No actual MP band/DOS export loaded yet.'),'hint'));
  return;
 }
 const title=el('h4',result.materialId+' · Materials Project');
 const source=el('p',tr('Kaynak: kullanıcı tarafından içe aktarılan mp-api çıktısı · ',
  'Source: user-imported mp-api export · ')+result.retrievedAt,'hint');
 const link=el('a',result.provenance.source);
 link.href=result.provenance.source;link.rel='noopener noreferrer';link.target='_blank';
 const provenance=el('p','BS task: '+(result.provenance.bandTask||'—')+
  ' · DOS task: '+(result.provenance.dosTask||'—')+
  ' · mp-api '+result.provenance.client+' · k-path '+result.pathType,'hint');
 const warning=el('p',tr(
  'Bu dosyanın MP tarafından gerçekten üretildiği uygulamada doğrulanmaz. Bant ve DOS ayrı Fermi enerjilerine göre E−EF gösterilir. QE veya deney ile enerji hizalaması yapılmaz.',
  'This file is not independently authenticated as MP data. Band and DOS use their own E−EF references. No QE or experimental alignment.'),'hint');
 host.append(title,source,link,provenance,warning);
 const series=mpReferenceCurves(result);
 if(browser)host.append(el('p',tr(
  'Yukarıdaki grafen π Tight-Binding hesabı yalnız iki-bandlı bir modeldir. MP k-yolu, yapı, bant sayısı ve enerji referansı farklı olabilir; eğriler üst üste bindirilmez ve sayısal hata hesaplanmaz.',
  'The graphene π tight-binding model above has two bands. MP may differ in phase, k-path, band count and energy reference; no overlay or numerical error is claimed.'
 ),'hint'));
 const layout=el('div','','qe-band-dos-layout mp-electronic-plots');
 const plot=(heading,curves,kind,spin)=>{
  const box=el('section','','qe-linked-chart');
  box.append(el('strong',heading));
  try{
   if(kind==='band'){
    const b=result.band;
    box.append(spectralChart('Materials Project bantları, spin '+spin,
     'k mesafesi (Å⁻¹)','E − E_F (eV)',curves.map(y=>({x:b.distance,y})),480,320,
     {bandCurves:true,...(b.labels.length?{kNodes:b.labels}:{})}));
    box.append(el('small',tr('Gerçek MP hesaplanan Kohn–Sham bantları; pencere ',
      'Actual MP calculated Kohn–Sham bands; window ')+
      b.firstBand+'–'+(b.firstBand+curves.length-1)+' / '+b.totalBands,'hint'));
   }else{
    const d=series.dos.find(s=>s.spin===spin);
    box.append(spectralChart('Materials Project DOS, spin '+spin,
      'E − E_F (eV)','DOS (states/eV/cell)',[{x:d.x,y:d.y}],480,320));
   }
  }catch(error){box.append(el('p',tr('Grafik oluşturulamadı: ','Plot failed: ')+error.message,'hint'));}
  layout.append(box);
 };
 for(const item of series.band)plot('MP · '+tr('Bant yapısı','Band structure')+' · spin '+item.spin,item.curves,'band',item.spin);
 for(const item of series.dos)plot('MP · DOS · spin '+item.spin,null,'dos',item.spin);
 host.append(layout);
 if(!result.band)host.append(el('p',tr('Bu MP kimliği için bant verisi sağlanmadı.','No band data supplied for this MP ID.'),'hint'));
 if(!result.dos)host.append(el('p',tr('Bu MP kimliği için DOS verisi sağlanmadı.','No DOS data supplied for this MP ID.'),'hint'));
}
export function initMpElectronicImport(){
 const pane=document.getElementById('libMpPane');
 if(!pane)return;
 const section=el('section','','mp-comparison mp-electronic-import');
 section.id='mpElectronicImport';
 section.setAttribute('aria-label','Materials Project electronic spectra');
 section.append(el('h3','P1 · Materials Project · '+tr('Gerçek bant yapısı ve DOS','Real band structure and DOS')));
 section.append(el('p',tr(
  'Bant/DOS dizileri özet API yanıtında bulunmaz. Önce resmî mp-api istemcisiyle gerçek elektronik veriyi JSON olarak dışa aktarın; dosyayı burada açın. Dosya tarayıcı belleğinde kalır, sunucuya yüklenmez.',
  'Raw band/DOS arrays are not in the summary API response. Export actual electronic data with the official mp-api client, then open the JSON here. Data remain in browser memory.'
 ),'hint'));
 const guide=el('a',tr('Dışa aktarma kılavuzu','Export instructions'));
 guide.href='https://github.com/alorak/kristalyapi/blob/main/docs/mp-electronic-browser.md';
 guide.target='_blank';guide.rel='noopener noreferrer';section.append(guide);
 const input=el('input');input.id='mpElectronicFile';input.type='file';
 input.accept='.json,application/json';
 input.setAttribute('aria-label',tr('MP bant/DOS JSON seç','Choose MP band/DOS JSON'));
 const actions=el('div','','mp-actions');
 const clear=el('button',tr('Referansı temizle','Clear reference'));clear.type='button';
 const status=el('p',tr('Beklenen dosya: kristalyapi.mp-electronic.v1','Expected file: kristalyapi.mp-electronic.v1'),'mp-status');
 status.id='mpElectronicStatus';status.setAttribute('role','status');
 const preview=el('div');preview.id='mpElectronicPreview';
 actions.append(input,clear);section.append(actions,status,preview);
 const footer=pane.querySelector(':scope > p.hint:last-of-type');
 if(footer)pane.insertBefore(section,footer);else pane.append(section);
 let selectedId=null;
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;
  try{
   if(file.size>8_000_000||file.size<20)throw Error(tr('Dosya 8 MB sınırını aşıyor veya boş.','File exceeds 8 MB or is empty.'));
   const parsed=parseMpElectronic(JSON.parse(await file.text()));
   if(selectedId&&selectedId!==parsed.materialId)
    throw Error(tr('Seçilen kayıt '+selectedId+'; yüklenen dosya '+parsed.materialId+'.',
     'Selected '+selectedId+' but file is '+parsed.materialId+'.'));
   setMpElectronic(parsed);
   status.textContent=tr('Gerçek veri dosyası yüklendi: ','Actual data file loaded: ')+parsed.materialId+
     tr(' · Kaynak bağımsız doğrulanmadı.',' · Source not independently authenticated.');
   selectedId=null;
  }catch(error){status.textContent=tr('İçe aktarma reddedildi: ','Import rejected: ')+error.message;}
  finally{input.value='';}
 });
 clear.addEventListener('click',()=>{selectedId=null;setMpElectronic(null);
  status.textContent=tr('MP elektronik referansı temizlendi.','MP electronic reference cleared.');});
 const render=data=>referencePlots(preview,data);
 render(currentMpElectronic());onMpElectronicChange(render);
 return {requestFor(id){selectedId=id;status.textContent=id+
  tr(' için resmî mp-api JSON dosyasını seçin.',' · choose the official mp-api JSON export.');
  input.click();}};
}
export function initBrowserMpReference(root){
 if(!root)return;
 const section=el('section','','qe-workflow mp-browser-reference');
 section.id='browserMpReference';
 section.append(el('h3',tr('Materials Project referansı · bant / DOS',
  'Materials Project reference · bands / DOS')));
 section.append(el('p',tr(
  'Kütüphane → Materials Project bölümünde resmî mp-api JSON dosyası açıldığında gerçek MP bant ve DOS grafikleri burada görüntülenir. Bu bir tarayıcı hesabı değildir.',
  'Load an official mp-api JSON export in Library → Materials Project to view actual MP band and DOS data here. This is not browser-side computation.'),'hint'));
 const host=el('div');host.id='browserMpReferencePlots';section.append(host);
 root.append(section);
 referencePlots(host,currentMpElectronic(),{browser:true});
 return onMpElectronicChange(data=>referencePlots(host,data,{browser:true}));
}
