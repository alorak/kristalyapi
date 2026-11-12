/* Real MP electronic results from the official mp-api export.
 * Explicitly separate from both browser tight-binding and molecular GANSU DFT.
 * Never infer band/DOS curves from summary metadata. */
import {parseMpElectronic,mpReferenceCurves} from './mp-electronic-core.js';
import {setMpElectronic,currentMpElectronic,onMpElectronicChange} from './mp-electronic-state.js';
import {chart as spectralChart} from './qe-electronic-view.js';
import {mpVisibleEnergyWindow,mpCumulativeDos,mpVisibleDensityMax,mpFermiMarker} from './mp-electronic-visuals.js';
const el=(tag,text='',cls='')=>{
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 if(cls)node.className=cls;
 return node;
};
const isEnglish=()=>window.CrystalI18n?.language==='en';
const tr=(turkish,english)=>isEnglish()?english:turkish;
function referencePlots(host,result,{browser=false}={}){
 const previousWindow=host.querySelector('[data-mp-energy-window]')?.value||'standard';
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
  'Dosyanın MP kaynağı bağımsız doğrulanmaz. Her grafik kendi Fermi enerjisine göre E−EF gösterir. Aynı dikey ölçek enerji seviyelerinin mutlak hizalandığı anlamına gelmez.',
  'MP origin of the file is not independently verified. Each plot uses its own E−EF reference. A shared vertical scale does not imply absolute energy alignment.'),'hint');
 host.append(title,source,link,provenance,warning);
 if(browser)host.append(el('p',tr(
  'Grafen π Tight-Binding yalnız iki bantlı parametrik bir modeldir. MP ile yapısal, k-yolu ve enerji referansı eşitliği doğrulanmadığından grafikler üst üste bindirilmez.',
  'Graphene π Tight-Binding is a two-band parameterized model. Since phase, k-path and energy reference are not matched, the MP reference is not overlaid.'
 ),'hint'));
 const controls=el('div','','mp-spectrum-controls');
 const viewLabel=el('label',tr('Enerji penceresi','Energy window'));
 const windowChoice=el('select');windowChoice.dataset.mpEnergyWindow='1';
 for(const [value,label] of [
  ['near','±3 eV'],['standard','±6 eV'],['wide','±12 eV'],
  ['full',tr('Tüm veri','Full source range')]
 ]){
  const option=el('option',label);option.value=value;windowChoice.append(option);
 }
 windowChoice.value=['near','standard','wide','full'].includes(previousWindow)?previousWindow:'standard';
 viewLabel.append(windowChoice);controls.append(viewLabel);
 controls.append(el('small',tr('Turuncu kesik çizgi: her veri kümesinin kendi E_F = 0 eV düzeyi.',
  'Orange dashed line: each dataset’s own E_F = 0 eV level.'),'hint'));
 host.append(controls);
 windowChoice.addEventListener('change',()=>referencePlots(host,result,{browser}));
 const range=mpVisibleEnergyWindow(result,windowChoice.value);
 const series=mpReferenceCurves(result);
 const layout=el('div','','mp-electronic-plots');
 const spins=[...new Set([...series.band.map(x=>x.spin),...series.dos.map(x=>x.spin)])]
  .sort((a,b)=>a==='up'?-1:b==='up'?1:a.localeCompare(b));
 function plotBox(heading){
  const box=el('section','','mp-electronic-plot qe-linked-chart');
  box.append(el('strong',heading));
  return box;
 }
 for(const spin of spins){
  const pair=el('div','','mp-electronic-spin-row');
  pair.dataset.mpSpin=spin;
  const b=series.band.find(x=>x.spin===spin),d=series.dos.find(x=>x.spin===spin);
  if(b){
   const box=plotBox('MP · '+tr('Elektronik bantlar','Electronic bands')+' · spin '+spin);
   try{
    const svg=spectralChart('Materials Project band structure spin '+spin,
     'k (Å⁻¹)','E − E_F (eV)',b.curves.map(y=>({x:b.x,y})),600,330,
     {bandCurves:true,yDomain:range,...(result.band.labels.length?{kNodes:result.band.labels}:{})});
    box.append(mpFermiMarker(svg,range));
    box.append(el('small',tr('MP bant penceresi: ','MP band window: ')+result.band.firstBand+
     '–'+(result.band.firstBand+b.curves.length-1)+' / '+result.band.totalBands,'hint'));
   }catch(error){box.append(el('p',tr('Bant grafiği oluşturulamadı: ','Band plot failed: ')+error.message,'hint'));}
   pair.append(box);
  }
  if(d){
   const box=plotBox('MP · '+tr('Yoğunluk / projeksiyon','Density / projections')+' · spin '+spin);
   const choice=el('select');choice.dataset.mpDosMode='1';choice.setAttribute('aria-label',
    tr('DOS görselleştirme türü, spin ','DOS visualization mode, spin ')+spin);
   const modes=[
    ['total',tr('Toplam DOS','Total DOS')],
    ['cumulative',tr('Kümülatif DOS ∫D(E)dE','Cumulative DOS ∫D(E)dE')]
   ];
   for(let i=0;i<(result.dos.pdos||[]).length;i++){
    const p=result.dos.pdos[i];
    if(p.spins[spin])modes.push(['p'+i,p.element+' · '+p.orbital+' '+tr('orbitali PDOS','orbital PDOS')]);
   }
   for(const [id,label] of modes){const option=el('option',label);option.value=id;choice.append(option);}
   box.append(choice);
   const graph=el('div','','mp-electronic-dos-graph');box.append(graph);
   const caption=el('small','','hint');box.append(caption);
   const render=()=>{
    graph.replaceChildren();
    const relativeEnergy=d.x;
    let values=d.y,name=tr('Durum/(eV·hücre)','States/(eV·cell)');
    if(choice.value==='cumulative'){
     values=mpCumulativeDos(result.dos.energy,d.y);
     name=tr('Birikimli durum/hücre','Cumulative states/cell');
     caption.textContent=tr('Trapez integrali, yalnız dışa aktarılan enerji aralığından başlar; toplam elektron sayısı değildir.',
      'Trapezoidal integral starts at the exported minimum energy; not a total electron count.');
    }else if(choice.value.startsWith('p')){
     const p=result.dos.pdos[Number(choice.value.slice(1))];
     if(p&&p.spins[spin])values=p.spins[spin];
     caption.textContent=tr('Gerçek MP element/orbital projeksiyonu; mutlak elektronik geçiş olasılığı değildir.',
      'Actual MP element/orbital projection; not an optical transition probability.');
    }else{
     caption.textContent=(result.dos.pdos?.length?
      tr('Element/orbital PDOS için üstte seçim yapın.','Choose an element/orbital PDOS above.'):
      tr('Bu MP dışa aktarımında PDOS bulunmuyor.','No PDOS in this MP export.'));
    }
    try{
     // The DOS energy is vertical as in the adjacent band plot.
     const maximum=mpVisibleDensityMax(relativeEnergy,values,range);
     const svg=spectralChart('Materials Project '+choice.value+' DOS spin '+spin,
      name,'E − E_F (eV)',[{x:values,y:relativeEnergy}],400,330,
      {xDomain:[0,maximum],yDomain:range});
     graph.append(mpFermiMarker(svg,range));
    }catch(error){graph.append(el('p',tr('DOS grafiği oluşturulamadı: ','DOS plot failed: ')+error.message,'hint'));}
   };
   choice.addEventListener('change',render);render();pair.append(box);
  }
  layout.append(pair);
 }
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
