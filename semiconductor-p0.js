import {PROFILES,KB,bandParameters,carrierEquilibrium,fermiProbability,materialForStructure,lowFieldHall,nearestNeighbors,angleDegrees} from './semiconductor-physics-p0-core.js';

const $=id=>document.getElementById(id);
const fmt=(x,d=3)=>Number(x).toLocaleString('tr-TR',{maximumFractionDigits:d});
const sci=x=>x===0?'0':Number(x).toExponential(2).replace('e+',' × 10^').replace('e-',' × 10^-');
const svgNS='http://www.w3.org/2000/svg';
function elt(tag,props={},text=null){
 const n=document.createElementNS(svgNS,tag);
 for(const [k,v] of Object.entries(props))n.setAttribute(k,String(v));
 if(text!==null)n.textContent=String(text);
 return n;
}
function mark(svg,tag,props,text=null){const x=elt(tag,props,text);svg.appendChild(x);return x;}
function line(svg,y,color,dashed=false,label=''){
 mark(svg,'line',{x1:48,y1:y,x2:598,y2:y,stroke:color,'stroke-width':2.6,...(dashed?{'stroke-dasharray':'7 5'}:{})});
 if(label)mark(svg,'text',{x:54,y:y-7,fill:color,'font-size':14,'font-weight':600},label);
}
function cards(element,rows){
 element.replaceChildren();
 for(const [label,value] of rows){
  const tile=document.createElement('div');tile.className='lesson-metric';
  const k=document.createElement('span');k.textContent=label;
  const v=document.createElement('strong');v.textContent=value;
  tile.append(k,v);element.appendChild(tile);
 }
}
function fillSelect(select,items,chosen){
 const old=chosen??select.value;
 select.replaceChildren();
 for(const [value,label] of items){const opt=document.createElement('option');opt.value=String(value);opt.textContent=label;select.append(opt);}
 if(items.some(([value])=>String(value)===String(old)))select.value=String(old);
}
const atomMarkup=[
 '<section class="lesson-panel sc-p0-lab">',
 '<div class="lesson-panel-head"><h3>Seçili atom ve kristal bağları</h3><span class="lesson-pill">P0 · atomik düzey</span></div>',
 '<p class="lesson-guide-intro">Kristal editöründe seçilmiş atom kullanılır. Dilersen aşağıdan başka bir atom konumu seçebilirsin. Komşular periyodik sınır koşullarıyla değerlendirilir.</p>',
 '<label class="lesson-field sc-p0-field"><span>İncelenen atom konumu</span><select id="scAtomPicker"></select></label>',
 '<div id="scAtomMetrics" class="lesson-metrics" aria-live="polite"></div>',
 '<div id="scNeighborSummary" class="sc-p0-note" aria-live="polite"></div>',
 '<div id="scNeighborList" class="sc-p0-neighbors"></div>',
 '<p class="lesson-crystal-help">En yakın komşular ve açı değerleri kristalin birim hücre metriğinden hesaplanır. Dört komşunun gerçekten bağ yaptığına karar vermek için kimya, koordinasyon ve mesafe ayrıca değerlendirilmelidir.</p>',
 '</section>',
 '<section class="lesson-panel sc-p0-lab">',
 '<div class="lesson-panel-head"><h3>Si konumunda katkılama deneyi</h3><span class="lesson-pill">P0 · B/P ikamesi</span></div>',
 '<p class="lesson-guide-intro">Seçili Si atomunu P (donör) veya B (akseptör) ile <strong>temsili</strong> olarak değiştir; ardından Malzeme sekmesinde Fermi ve yük dengesi sonucunu incele.</p>',
 '<div class="sc-p0-buttons" role="group" aria-label="Katkı türü"><button type="button" id="scPreviewPure" class="lesson-action">Saf Si</button><button type="button" id="scPreviewP" class="lesson-action">Si → P (n-tipi)</button><button type="button" id="scPreviewB" class="lesson-action">Si → B (p-tipi)</button></div>',
 '<div id="scAtomDopantMessage" class="sc-p0-note" role="status" aria-live="polite"></div>',
 '<p class="lesson-crystal-help"><strong>Önemli:</strong> Bu seçim kristalin CIF atomlarını değiştirmez. Gerçek geometrik kusur oluşturmak için kristal editörünün Kusurlar aracını kullanın. Makroskopik N<sub>D</sub>/N<sub>A</sub> yoğunluğu tek bir atom değiştirmekle eşit tutulmaz; model yoğunlukları ayrı belirlenir. Si dışındaki malzemeler için B/P iyonlaşma modeli varsayılmaz.</p>',
 '</section>'
].join('');
const materialMarkup=[
 '<section class="lesson-panel sc-p0-lab">',
 '<div class="lesson-panel-head"><h3>Malzeme ve taşıyıcı hesapları</h3><span class="lesson-pill">P0 · hacimsel özellikler</span></div>',
 '<p id="scMaterialStatus" class="sc-p0-note" aria-live="polite"></p>',
 '<div class="sc-p0-controls">',
 '<label class="lesson-field"><span>Sıcaklık <output id="scP0TempOut">300 K</output></span><input type="range" id="scP0Temp" min="100" max="600" step="10" value="300"></label>',
 '<label class="lesson-field"><span>Katkılama senaryosu</span><select id="scP0Doping"><option value="intrinsic">Saf · intrinsik</option><option value="n">Si:P · donör</option><option value="p">Si:B · akseptör</option><option value="compensated">Si:P + Si:B · kompanze</option></select></label>',
 '<label class="lesson-field"><span>Donör yoğunluğu log₁₀(ND/cm³) <output id="scP0NdOut">16</output></span><input type="range" id="scP0Nd" min="12" max="18" step="0.5" value="16"></label>',
 '<label class="lesson-field"><span>Akseptör yoğunluğu log₁₀(NA/cm³) <output id="scP0NaOut">15</output></span><input type="range" id="scP0Na" min="12" max="18" step="0.5" value="15"></label>',
 '</div>',
 '<div id="scP0Summary" class="lesson-metrics" aria-live="polite"></div>',
 '<p id="scP0Limit" class="lesson-crystal-help" aria-live="polite"></p>',
 '</section>',
 '<section class="lesson-panel sc-p0-lab"><div class="lesson-panel-head"><h3>Referans enerji bantları</h3><span class="lesson-pill">P0 · Eᶜ, Eᵛ, Eᶠ</span></div>',
 '<svg id="scP0Bands" class="lesson-chart" viewBox="0 0 640 245" role="img" aria-label="Referans iletim, valans, Fermi ve dopant seviyeleri"></svg>',
 '<p class="lesson-crystal-help">Eᵥ = 0 eV referans alınır. Elektron ilgisi χ, vakum seviyesinden Eᶜ bandına ölçülür; yüzeye bağlı yaklaşık literatür değeridir. Bu diagramda konumsal band bending ve elektronik yapı hesaplaması yapılmaz.</p></section>',
 '<section class="lesson-panel sc-p0-lab"><div class="lesson-panel-head"><h3>DOS ve Fermi–Dirac</h3><span class="lesson-pill">P0 · doluluk</span></div>',
 '<svg id="scP0Dos" class="lesson-chart" viewBox="0 0 640 220" role="img" aria-label="Şematik durum yoğunluğu ve elektron-hol doluluğu"></svg>',
 '<div id="scP0Fermi" class="sc-p0-note" aria-live="polite"></div>',
 '<p class="lesson-crystal-help">DOS eğrileri yalnız ideal üç boyutlu parabolik bant kenarlarının <strong>normalize edilmiş şematik gösterimidir</strong>; gerçek Si çok vadili DOS veya ab initio E(k) verisi değildir. Doluluk f(E,T) ve Boltzmann yaklaşımı bağımsız olarak karşılaştırılır.</p></section>',
 '<section class="lesson-panel sc-p0-lab"><div class="lesson-panel-head"><h3>Hall deneyi · çoğunluk taşıyıcısı</h3><span class="lesson-pill">P0 · zayıf alan</span></div>',
 '<div class="sc-p0-controls"><label class="lesson-field"><span>Manyetik alan B <output id="scP0BOut">0,50 T</output></span><input type="range" id="scP0B" min="-2" max="2" step="0.1" value="0.5"></label>',
 '<label class="lesson-field"><span>Akım I <output id="scP0IOut">1 mA</output></span><input type="range" id="scP0I" min="0.1" max="10" step="0.1" value="1"></label></div>',
 '<div id="scP0Hall" class="lesson-metrics" aria-live="polite"></div>',
 '<p class="lesson-crystal-help">İki taşıyıcılı zayıf-alan yaklaşımı; kalınlık 0,50 mm kabul edilir. Mobiliteler 300 K referans sabitleridir, sıcaklık/katkı saçılması burada çözülmez. Hall işareti baskın Hall katkısını gösterir; tek ölçüm iki taşıyıcının varlığını kanıtlamaz.</p></section>'
].join('');

export function initSemiconductorP0(host){
 const paneGeneral=$('scGeneralPane'),paneAtom=$('scAtomPane'),paneMaterial=$('scMaterialPane');
 if(!paneGeneral||!paneAtom||!paneMaterial)return {refresh(){},setVisible(){}};
 paneAtom.innerHTML=atomMarkup;paneMaterial.innerHTML=materialMarkup;
 const panes={general:paneGeneral,atom:paneAtom,material:paneMaterial};
 const buttons=Array.from(document.querySelectorAll('#scLessonTabs [data-sc-tab]'));
 let active='general',visible=false,structure=null,material=null,lastEditorSelection='',selectedIndex=0;
 const picker=$('scAtomPicker');
 function switchTab(name,focus=false){
  if(!Object.hasOwn(panes,name))return;
  active=name;
  for(const [key,pane] of Object.entries(panes)){
   pane.hidden=key!==name;
   const button=buttons.find(button=>button.dataset.scTab===key);
   button.setAttribute('aria-selected',String(key===name));
   button.tabIndex=key===name?0:-1;
   if(focus&&key===name)button.focus();
  }
  if(name==='atom')renderAtom();
  if(name==='material')renderMaterial();
 }
 buttons.forEach((button,i)=>{
  button.addEventListener('click',()=>switchTab(button.dataset.scTab));
  button.addEventListener('keydown',event=>{
   if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   switchTab(buttons[next].dataset.scTab,true);
  });
 });
 function matchingEditorIndex(sites,editor){
  if(!editor)return -1;
  return sites.findIndex(site=>site.symbol===editor.symbol&&['x','y','z'].every(k=>{
   const d=Math.abs(Number(site[k])-Number(editor[k]));
   return Math.min(d,Math.abs(d-1))<.0002;
  }));
 }
 function refresh(){
  structure=host.structure();material=materialForStructure(structure);
  const sites=structure.sites||[];
  const editor=host.selectedAtom?.();
  const signature=editor?String(editor.symbol)+'/'+['x','y','z'].map(k=>Number(editor[k]).toFixed(5)).join('/'):null;
  if(signature&&signature!==lastEditorSelection){
   const match=matchingEditorIndex(sites,editor);
   if(match>=0)selectedIndex=match;
  }
  lastEditorSelection=signature;
  selectedIndex=Math.max(0,Math.min(selectedIndex,sites.length-1));
  fillSelect(picker,sites.slice(0,1000).map((site,i)=>[i,(site.label||site.symbol+' '+(i+1))+' · '+site.symbol]),String(selectedIndex));
  if(active==='atom')renderAtom();
  if(active==='material')renderMaterial();
 }
 picker.addEventListener('change',()=>{selectedIndex=Number(picker.value);renderAtom();});
 function renderAtom(){
  if(!structure)return;
  const site=structure.sites?.[selectedIndex];
  const info=$('scAtomDopantMessage');
  if(!site){
   cards($('scAtomMetrics'),[['Atom seçimi','Yapıda atom bulunmuyor']]);
   $('scNeighborList').replaceChildren();$('scNeighborSummary').textContent='';
   return;
  }
  const neighbors=nearestNeighbors(structure,selectedIndex,8);
  const closest=neighbors[0]?.distance||0;
  const shell=neighbors.filter(n=>n.distance<=closest*.001+closest+.005).slice(0,8);
  const a=shell.length>=2?angleDegrees(shell[0].vector,shell[1].vector):NaN;
  cards($('scAtomMetrics'),[
   ['Atom',(site.label||site.symbol)+' · '+site.symbol],
   ['Kesirli koordinatlar',[site.x,site.y,site.z].map(v=>fmt(v,4)).join(', ')],
   ['En kısa mesafe',closest?fmt(closest,3)+' Å':'—'],
   ['İlk komşu kabuğu',String(shell.length)],
   ['İlk iki komşu arasındaki açı',Number.isFinite(a)?fmt(a,2)+'°':'—']
  ]);
  $('scNeighborSummary').textContent='Yakın komşular: '+(shell.length?shell.map(n=>n.symbol+' '+fmt(n.distance,3)+' Å').join(' · '):'Belirlenemedi');
  const list=$('scNeighborList');list.replaceChildren();
  for(const [i,n] of neighbors.entries()){
   const item=document.createElement('div');item.className='sc-p0-neighbor';
   const label=document.createElement('strong');label.textContent=(i+1)+'. '+n.symbol;
   const distance=document.createElement('span');distance.textContent=fmt(n.distance,3)+' Å';
   item.append(label,distance);list.appendChild(item);
  }
  const allowed=material==='Si'&&site.symbol==='Si';
  $('scPreviewP').disabled=!allowed;
  $('scPreviewB').disabled=!allowed;
  $('scPreviewPure').disabled=material!=='Si';
  info.textContent=allowed?'Dört tetrahedral Si bağının yerine geçecek P veya B katkısını modellemek için bir seçenek seçin.':'B/P ikame deneyinde silisyum kristalindeki bir Si konumu seçilmelidir.';
 }
 function startDoping(mode,message){
  $('scP0Doping').value=mode;
  $('scAtomDopantMessage').textContent=message;
  switchTab('material',true);
 }
 $('scPreviewP').addEventListener('click',()=>startDoping('n',''));
 $('scPreviewB').addEventListener('click',()=>startDoping('p',''));
 $('scPreviewPure').addEventListener('click',()=>startDoping('intrinsic',''));
 const watched=['scP0Temp','scP0Doping','scP0Nd','scP0Na','scP0B','scP0I'];
 for(const id of watched)$(id).addEventListener('input',renderMaterial);
 function drawBands(params,carriers){
  const svg=$('scP0Bands');svg.replaceChildren();
  mark(svg,'rect',{x:22,y:8,width:596,height:223,rx:12,fill:'#f8fbff',stroke:'#dce5f0'});
  line(svg,184,'#de7b40',false,'Eᵥ = 0 eV');
  line(svg,75,'#1674c4',false,'Eᶜ = '+fmt(params.eg,3)+' eV');
  const efY=184-109*(carriers.ef/params.eg);
  line(svg,Math.max(39,Math.min(215,efY)),'#14866a',true,'Eᶠ = '+fmt(carriers.ef,3)+' eV');
  if(carriers.nd>0)line(svg,75+109*.0456/params.eg,'#7756aa',true,'Eᴅ');
  if(carriers.na>0)line(svg,184-109*.045/params.eg,'#ad7480',true,'Eₐ');
  mark(svg,'text',{x:360,y:23,fill:'#566982','font-size':13},'Vakum → Eᶜ: χ ≈ '+fmt(params.affinity,2)+' eV (yüzeye bağlı)');
  mark(svg,'text',{x:400,y:125,fill:'#64748b','font-size':14},'Eɡ = '+fmt(params.eg,3)+' eV');
 }
 function drawDos(params,carriers){
  const svg=$('scP0Dos');svg.replaceChildren();
  const eMin=-.20,eMax=params.eg+.20,x=e=>42+(e-eMin)/(eMax-eMin)*568;
  mark(svg,'rect',{x:25,y:10,width:600,height:190,rx:10,fill:'#f8fbff',stroke:'#e0e9f1'});
  mark(svg,'line',{x1:42,y1:172,x2:613,y2:172,stroke:'#60748c','stroke-width':1.5});
  const coords={all:[],electrons:[],holes:[],fermi:[]};
  for(let i=0;i<=180;i++){
   const e=eMin+(eMax-eMin)*i/180;
   const g=e<0?Math.sqrt(Math.max(0,-e)/.20):e>params.eg?Math.sqrt(Math.max(0,e-params.eg)/.20):0;
   const f=fermiProbability(e,carriers.ef,params.T);
   coords.all.push([x(e),172-90*g]);
   coords.electrons.push([x(e),172-90*(e>=params.eg?g*f:0)]);
   coords.holes.push([x(e),172-90*(e<=0?g*(1-f):0)]);
   coords.fermi.push([x(e),172-118*f]);
  }
  for(const [key,color,width] of [['all','#94a3b8',2],['electrons','#1976c6',3],['holes','#e17835',3],['fermi','#15856d',2]]){
   const path=coords[key].map(([a,b],i)=>(i?'L':'M')+a.toFixed(1)+','+b.toFixed(1)).join(' ');
   mark(svg,'path',{d:path,fill:'none',stroke:color,'stroke-width':width});
  }
  for(const [e,label] of [[0,'Eᵥ'],[params.eg,'Eᶜ']]){
   mark(svg,'line',{x1:x(e),x2:x(e),y1:24,y2:176,stroke:'#bdcbdc','stroke-dasharray':'4 4'});
   mark(svg,'text',{x:x(e),y:192,'text-anchor':'middle',fill:'#536779','font-size':13},label);
  }
  mark(svg,'text',{x:34,y:19,fill:'#64748b','font-size':12},'Şematik DOS ve f(E) · normalize ölçek');
  mark(svg,'text',{x:47,y:215,fill:'#1976c6','font-size':12},'Mavi: elektron');
  mark(svg,'text',{x:204,y:215,fill:'#e17835','font-size':12},'Turuncu: hol');
  mark(svg,'text',{x:372,y:215,fill:'#15856d','font-size':12},'Yeşil: f(E)');
 }
 function renderMaterial(){
  if(!structure)return;
  const status=$('scMaterialStatus'),mode=$('scP0Doping');
  const supported=!!material;
  const dopingAvailable=material==='Si';
  for(const option of mode.options)option.disabled=option.value!=='intrinsic'&&!dopingAvailable;
  if(!dopingAvailable&&mode.value!=='intrinsic')mode.value='intrinsic';
  for(const id of ['scP0Nd','scP0Na'])$(id).disabled=!dopingAvailable;
  $('scP0TempOut').textContent=$('scP0Temp').value+' K';
  $('scP0NdOut').textContent=$('scP0Nd').value;
  $('scP0NaOut').textContent=$('scP0Na').value;
  $('scP0BOut').textContent=fmt($('scP0B').value,2)+' T';
  $('scP0IOut').textContent=fmt($('scP0I').value,1)+' mA';
  for(const id of ['scP0Bands','scP0Dos'])$(id).replaceChildren();
  if(!supported){
   status.textContent='Bu kristal için doğrulanmış hacimsel malzeme profili yok. Desteklenenler: saf Si, saf Ge ve GaAs; Si içine B/P ikamesi tanınır. Bilinmeyen kristale Si parametresi uygulanmaz.';
   cards($('scP0Summary'),[]);cards($('scP0Hall'),[]);
   $('scP0Fermi').textContent='Malzeme seçimi için desteklenen bir kristal açın.';
   $('scP0Limit').textContent='';
   return;
  }
  const T=Number($('scP0Temp').value);
  const variant=mode.value;
  const nd=variant==='n'||variant==='compensated'?10**Number($('scP0Nd').value):0;
  const na=variant==='p'||variant==='compensated'?10**Number($('scP0Na').value):0;
  const p=bandParameters(material,T),c=carrierEquilibrium(material,T,nd,na);
  status.textContent=p.name+' · '+T+' K · deneysel/ampirik referans parametreleri. Ge ve GaAs için B/P donör-akseptör modeli etkin değildir.';
  cards($('scP0Summary'),[
   ['Bant aralığı Eɡ',fmt(c.eg,3)+' eV'],
   ['İntrinsik taşıyıcı nᵢ',sci(c.ni)+' cm⁻³'],
   ['Fermi düzeyi Eᶠ − Eᵥ',fmt(c.ef,4)+' eV'],
   ['Elektron yoğunluğu n',sci(c.n)+' cm⁻³'],
   ['Hol yoğunluğu p',sci(c.holes)+' cm⁻³'],
   ['İyonlaşmış donör Nᴅ⁺',sci(c.positiveDonors)+' cm⁻³'],
   ['İyonlaşmış akseptör Nₐ⁻',sci(c.negativeAcceptors)+' cm⁻³'],
   ['n · p / nᵢ²',fmt(c.n*c.holes/(c.ni*c.ni),3)]
  ]);
  const highDoping=(c.ef>=c.eg-3*c.thermal||c.ef<=3*c.thermal)&&(nd+na)>0;
  $('scP0Limit').textContent='Model: homojen termal denge, parabolik 3B bant kenarı, Maxwell–Boltzmann taşıyıcı istatistiği ve Si:B/P için eksik iyonlaşma. '+(highDoping?'Uyarı: Fermi düzeyi bant kenarına yakın; dejenere olmayan yaklaşım güvenilir olmayabilir.':'')+' Gerçek kristaldeki bir ikame atomunun oranından ND/NA çıkarılmaz.';
  drawBands(p,c);drawDos(p,c);
  const fd=fermiProbability(p.eg,c.ef,T),boltzmann=Math.exp(Math.max(-700,Math.min(70,(c.ef-p.eg)/c.thermal)));
  $('scP0Fermi').textContent='İletim bant kenarı doluluğu f(Eᶜ) = '+sci(fd)+'; Boltzmann yaklaşımı = '+sci(boltzmann)+'. Eᶜ−Eᶠ ≥ 3kBT ise Boltzmann bağıl hatası yaklaşık %5’in altındadır. Eᶠ tek bir elektronun enerjisi değildir.';
  const hall=lowFieldHall(c,p.mun,p.mup,Number($('scP0I').value)*1e-3,Number($('scP0B').value),.5e-3);
  cards($('scP0Hall'),[
   ['Hall katsayısı Rᴴ',sci(hall.coefficientM3C)+' m³/C'],
   ['Hall gerilimi Vᴴ',sci(hall.voltageV)+' V'],
   ['Baskın Hall işareti',hall.coefficientM3C<0?'Negatif · elektron':hall.coefficientM3C>0?'Pozitif · hol':'Sıfıra yakın']
  ]);
 }
 refresh();
 switchTab('general');
 return {refresh,setVisible(value){visible=!!value;if(visible)refresh();},get activeTab(){return active;}};
}
