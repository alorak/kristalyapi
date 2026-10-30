/*
 * Static offline visualization for verified-format QE electronic-results.json.
 * This viewer NEVER executes DFT, infers a Fermi energy, or calculates PL.
 */
const NS='http://www.w3.org/2000/svg';
const finite=n=>typeof n==='number'&&Number.isFinite(n);

function checkedArray(values,label,limit){
 if(!Array.isArray(values)||values.length<2||values.length>limit||values.some(v=>!finite(v)))
  throw Error(label+': geçersiz veya aşırı büyük sayısal dizi.');
 return values;
}
export function parseQeElectronicResult(data){
 if(data?.schema!=='kristalyapi.qe-electronic.v2')return parseSingleChannel(data);
 if(data.spin_mode!=='collinear-polarized'||!data.channels||Object.keys(data.channels).sort().join(',')!=='down,up'||
  !/^[a-f0-9]{64}$/.test(data.input_sha256||'')||typeof data.energy_zero!=='string')throw Error('Spin kanal kimliği veya hesap özeti geçersiz.');
 const channels={};
 for(const channel of ['up','down']){
  const raw=data.channels[channel];
  if(!raw||raw.spin_channel!==channel||raw.spin_mode!=='collinear-polarized')throw Error('Spin kanal kimliği uyuşmuyor.');
  channels[channel]=parseSingleChannel({...raw,source:data.source,energy_zero:data.energy_zero,input_sha256:data.input_sha256,band_path_labels:data.band_path_labels},channel);
  if(!channels[channel].bands||!channels[channel].dos||!channels[channel].pdosDetailed)throw Error('Spin bant/DOS/PDOS kanalı eksik.');
 }
 const {up,down}=channels,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(!same(up.bands.distance,down.bands.distance)||up.bands.curves.length!==down.bands.curves.length||
  up.bands.firstBand!==down.bands.firstBand||up.bands.totalBands!==down.bands.totalBands||!same(up.dos.energy,down.dos.energy)||
  !same(up.pdosDetailed.atoms.map(a=>[a.atomIndex,a.element,Object.keys(a.orbitals)]),down.pdosDetailed.atoms.map(a=>[a.atomIndex,a.element,Object.keys(a.orbitals)])))
  throw Error('Spin kanallarının bant, enerji veya atom kimlikleri farklı.');
 const m=data.magnetization;
 if(!m||!finite(m.total_mu_b_per_cell)||!finite(m.absolute_mu_b_per_cell)||m.absolute_mu_b_per_cell<0||Math.abs(m.total_mu_b_per_cell)>m.absolute_mu_b_per_cell+.011)throw Error('Spin manyetizasyonu geçersiz.');
 const integral=data.integrated_dos_total;
 if(!integral||!same(integral.energy_ev,up.dos.energy)||!Array.isArray(integral.states)||integral.states.length!==up.dos.energy.length||integral.states.some((v,i)=>!finite(v)||v<0||i>0&&v<integral.states[i-1]-1e-5))throw Error('Toplam spin DOS integrali geçersiz.');
 return {schema:data.schema,spinMode:data.spin_mode,channels,magnetization:m,integratedDosTotal:integral};
}
function parseSingleChannel(data,spinChannel=null){
 if(!data||data.schema!==(spinChannel?'kristalyapi.qe-spin-channel.v1':'kristalyapi.qe-electronic.v1'))
  throw Error('Beklenen electronic-results.json şeması bulunamadı.');
 if(!data.bands&&!data.dos)throw Error('Bant veya DOS verisi bulunamadı.');
 const output={schema:data.schema,source:String(data.source||'Belirtilmemiş').slice(0,120),
  energyZero:String(data.energy_zero||'Bilinmiyor').slice(0,150),
  bandLabels:Array.isArray(data.band_path_labels)?data.band_path_labels.map(s=>String(s).slice(0,24)).slice(0,32):[],
  inputHash:typeof data.input_sha256==='string'&&/^[a-f0-9]{64}$/i.test(data.input_sha256)?data.input_sha256:null,
  bands:null,dos:null,pdos:null,pdosDetailed:null,...(spinChannel?{spinChannel}: {})};
 if(data.bands){
  const d=checkedArray(data.bands.distance,'Bant k uzaklığı',20000);
  if(d.some((v,i)=>i>0&&v<d[i-1]))throw Error('k uzaklığı sıralı olmalı.');
  const curves=data.bands.energies_ev;
  if(!Array.isArray(curves)||!curves.length||curves.length>300)
   throw Error('Bant sayısı 1–300 arasında olmalı.');
  if(curves.length*d.length>120000)throw Error('Görselleştirme için en fazla 120.000 bant noktası desteklenir.');
  const first=data.bands.band_index_start??1,total=data.bands.total_bands??curves.length;
  if(!Number.isInteger(first)||!Number.isInteger(total)||first<1||total>2048||first+curves.length-1>total)
   throw Error('Bant penceresi ve özgün bant indeksleri geçersiz.');
  // High-symmetry markers are shown only with explicit sampled k-distances.
  // An ordered label list alone cannot locate markers on the QE distance axis.
  let kNodes=null;
  if(data.bands.k_path_nodes!==undefined){
   const raw=data.bands.k_path_nodes,labels=output.bandLabels;
   if(!Array.isArray(raw)||!raw.length||raw.length>24||raw.length!==labels.length)
    throw Error('k-yolu düğümleri ve etiket sayıları eşleşmiyor.');
   kNodes=raw.map((node,i)=>{
    const value=node?.distance;
    if(!node||node.label!==labels[i]||!finite(value)||
      value<d[0]-1e-5||value>d.at(-1)+1e-5||
      !d.some(x=>Math.abs(x-value)<=1e-5)||
      i>0&&value<=raw[i-1].distance)
      throw Error('k-yolu düğümü örneklenmiş uzaklık/etiketle uyuşmuyor.');
    return {label:labels[i],distance:value};
   });
  }
  output.bands={distance:d,firstBand:first,totalBands:total,kNodes,curves:curves.map((v,i)=>{
   const y=checkedArray(v,'Bant '+(i+1),20000);
   if(y.length!==d.length)throw Error('Bant k noktası sayıları eşleşmiyor.');
   return y;
  })};
 }
 if(data.dos){
  const e=checkedArray(data.dos.energy_ev,'DOS enerjileri',20000);
  if(e.some((v,i)=>i>0&&v<=e[i-1]))throw Error('DOS enerjileri artan sırada olmalı.');
  const y=checkedArray(data.dos.dos_states_per_ev,'DOS yoğunluğu',20000);
  if(e.length!==y.length||y.some(v=>v<0))throw Error('DOS yoğunluğu/enerji ekseni uyumsuz.');
  output.dos={energy:e,values:y};
  if(data.pdos_total){
   const pe=checkedArray(data.pdos_total.energy_ev,'PDOS enerjileri',20000);
   const py=checkedArray(data.pdos_total.sum_projected_states_per_ev,'PDOS yoğunluğu',20000);
   if(pe.length!==e.length||py.length!==e.length||pe.some((v,i)=>Math.abs(v-e[i])>1e-4)||py.some(v=>v<0))
    throw Error('PDOS enerji ekseni DOS ile uyumsuz.');
   output.pdos=py;
  }
 }else if(data.pdos_total){
  throw Error('PDOS toplamı için DOS enerji ekseni gerekli.');
 }
 if(data.pdos_atoms){
  if(!output.dos||!output.pdos)throw Error('Atomik PDOS için toplam DOS ve PDOS gerekli.');
  const raw=data.pdos_atoms, energy=checkedArray(raw.energy_ev,'Atomik PDOS enerjileri',20000);
  if(energy.length!==output.dos.energy.length||
    energy.some((v,i)=>Math.abs(v-output.dos.energy[i])>1e-4))
    throw Error('Atomik PDOS enerji ekseni toplam DOS ile uyuşmuyor.');
  if(raw.spin_mode!==(spinChannel?'collinear-polarized':'collinear-unpolarized')||spinChannel&&raw.spin_channel!==spinChannel)
    throw Error('Yalnız spin-polarize olmayan kollineer PDOS destekleniyor.');
  const validateGroups=(items,kind)=>{
   if(!Array.isArray(items)||!items.length||items.length>(kind==='atoms'?1000:118))
    throw Error('Atomik PDOS grup sayısı sınırı aşıldı.');
   const seen=new Set();
   return items.map(item=>{
    if(!item||typeof item.element!=='string'||!/^[A-Z][a-z]?$/.test(item.element))
     throw Error('Atomik PDOS element bilgisi geçersiz.');
    const key=kind==='atoms'?item.atom_index:item.element;
    if(kind==='atoms'&&(!Number.isInteger(key)||key<1||key>1000))
     throw Error('Atom indeksleri geçersiz.');
    if(seen.has(key))throw Error('Tekrarlanan atom/element PDOS grubu.');
    seen.add(key);
    const total=checkedArray(item.total_dos_states_per_ev,'Atomik PDOS toplamı',20000);
    if(total.length!==energy.length||total.some(v=>v<0))
     throw Error('Atomik PDOS toplam yoğunluğu geçersiz.');
    if(!item.orbitals||typeof item.orbitals!=='object'||Array.isArray(item.orbitals))
     throw Error('Orbital PDOS sözlüğü geçersiz.');
    const orbitals={};
    for(const [name,rawCurve] of Object.entries(item.orbitals)){
     if(!['s','p','d','f'].includes(name))throw Error('Desteklenmeyen PDOS orbital türü.');
     const values=checkedArray(rawCurve,'Orbital PDOS '+name,20000);
     if(values.length!==energy.length||values.some(v=>v<0))
      throw Error('Orbital PDOS yoğunluğu geçersiz.');
     orbitals[name]=values;
    }
    if(!Object.keys(orbitals).length)
     throw Error('Atomik PDOS grubunda orbital bulunamadı.');
    for(let i=0;i<energy.length;i++){
     const sum=Object.values(orbitals).reduce((acc,a)=>acc+a[i],0);
     if(Math.abs(sum-total[i])>1e-3+1e-2*Math.max(sum,total[i]))
      throw Error('Atomik toplam ve orbital PDOS uyumsuz.');
    }
    return {element:item.element,...(kind==='atoms'?{atomIndex:key}:{}),total,orbitals};
   });
  };
  const atoms=validateGroups(raw.atoms,'atoms');
  const elements=validateGroups(raw.elements,'elements');
  if(energy.length*atoms.length>400000)
   throw Error('Atomik PDOS görüntüleme boyut sınırını aşıyor.');
  const atomSum=energy.map((_,i)=>atoms.reduce((sum,a)=>sum+a.total[i],0));
  const elementSum=energy.map((_,i)=>elements.reduce((sum,a)=>sum+a.total[i],0));
  for(let i=0;i<energy.length;i++){
   const reference=output.pdos[i],limit=.01+.02*Math.max(1,reference);
   if(Math.abs(atomSum[i]-reference)>limit||Math.abs(elementSum[i]-reference)>limit)
    throw Error('Atomik/orbital PDOS toplam projeksiyonla uyuşmuyor.');
  }
  output.pdosDetailed={energy,atoms,elements};
 }
 return output;
}
function el(tag,attrs={},text=''){
 const node=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
 if(text)node.textContent=text;
 return node;
}
let chartSerial=0;
export function chart(title,xName,yName,curves,width=660,height=260,domains={}){
 const svg=el('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':title});
 svg.style.cssText='width:100%;height:auto;display:block;max-height:360px';
 const left=57,right=12,top=18,bottom=42;
 const plotW=width-left-right,plotH=height-top-bottom;
 let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
 for(const c of curves){for(const v of c.x){xMin=Math.min(xMin,v);xMax=Math.max(xMax,v);}
  for(const v of c.y){yMin=Math.min(yMin,v);yMax=Math.max(yMax,v);}}
 if(domains.xDomain)[xMin,xMax]=domains.xDomain;
 if(domains.yDomain)[yMin,yMax]=domains.yDomain;
 for(const [a,b] of [[xMin,xMax],[yMin,yMax]])if(!finite(a)||!finite(b)||a>b)throw Error('Grafik ekseni geçersiz.');
 svg.setAttribute('data-x-min',xMin);svg.setAttribute('data-x-max',xMax);
 svg.setAttribute('data-y-min',yMin);svg.setAttribute('data-y-max',yMax);
 if(xMin===xMax)xMax=xMin+1;
 if(yMin===yMax){yMin-=.5;yMax+=.5;}
 const xVal=x=>left+(x-xMin)/(xMax-xMin)*plotW;
 const yVal=y=>top+plotH-(y-yMin)/(yMax-yMin)*plotH;
 const axis='currentColor',kNodes=domains.kNodes||null;
 for(let i=0;i<=4;i++){
  const x=left+i*plotW/4,y=top+i*plotH/4;
  svg.append(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,stroke:axis,'stroke-opacity':0.12}));
  svg.append(el('line',{x1:left,y1:y,x2:left+plotW,y2:y,stroke:axis,'stroke-opacity':0.12}));
  if(!kNodes)svg.append(el('text',{x,y:height-24,'text-anchor':'middle','font-size':11,fill:axis},
   (xMin+(xMax-xMin)*i/4).toFixed(2)));
  svg.append(el('text',{x:left-8,y:y+3,'text-anchor':'end','font-size':11,fill:axis},
   (yMax-(yMax-yMin)*i/4).toFixed(2)));
 }
 if(kNodes){
  svg.setAttribute('data-k-node-count',kNodes.length);
  for(const item of kNodes){
   const x=xVal(item.distance),label=item.label==='Gamma'?'Γ':item.label;
   svg.append(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,stroke:'#64748b','stroke-width':1,'stroke-dasharray':'4 4'}));
   svg.append(el('text',{x,y:height-24,'text-anchor':'middle','font-size':11,fill:axis},label));
  }
 }
 svg.append(el('text',{x:width/2,y:height-4,'text-anchor':'middle','font-size':12,fill:axis},xName));
 svg.append(el('text',{x:9,y:height/2,transform:'rotate(-90 9 '+height/2+')',
  'text-anchor':'middle','font-size':12,fill:axis},yName));
 const clip='qe-chart-clip-'+(++chartSerial);
 const defs=el('defs'),pathClip=el('clipPath',{id:clip});pathClip.append(el('rect',{x:left,y:top,width:plotW,height:plotH}));defs.append(pathClip);svg.append(defs);
 const paths=el('g',{'clip-path':'url(#'+clip+')'});svg.append(paths);
 curves.forEach((c,i)=>{
  const d=c.x.map((x,j)=>(j?'L':'M')+xVal(x).toFixed(2)+','+yVal(c.y[j]).toFixed(2)).join(' ');
  const color=domains.bandCurves?'#286eaa':i===0?'#2877c6':'#d48922';
  paths.append(el('path',{d,fill:'none',stroke:color,'stroke-width':curves.length>20?'0.7':1.8,
   'vector-effect':'non-scaling-stroke'}));
 });
 return svg;
}
function renderElectronicContent(container,data,energyWindow,linked,selection=null){
 container.replaceChildren();
 const heading=document.createElement('div');heading.className='qe-spectrum-source';
 const source=document.createElement('strong');source.textContent='Kaynak: '+data.source;
 const energy=document.createElement('span');energy.textContent='Enerji referansı: '+data.energyZero+' · Fermi/vakum hizalaması yapılmadı';
 heading.append(source,energy);container.append(heading);
 const note=document.createElement('p');
 note.textContent='Dosyanın bilimsel doğruluğu uygulama tarafından teyit edilmez. Bu grafikler optik geçiş/PL veya tek foton emisyonu değildir. Açık kristal yapısıyla otomatik eşleştirme yapılmaz.';
 container.append(note);
 if(data.inputHash){
  const hash=document.createElement('small');
  hash.style.cssText='display:block;overflow-wrap:anywhere;margin:8px 0';
  hash.textContent='Hesaplama girdisi SHA-256: '+data.inputHash;
  container.append(hash);
 }
 const layout=document.createElement('div');
 let bandBox=container,dosBox=container;
 if(linked&&data.bands&&data.dos){
  layout.className='qe-band-dos-layout';bandBox=document.createElement('section');dosBox=document.createElement('section');
  bandBox.className=dosBox.className='qe-linked-chart';layout.append(bandBox,dosBox);container.append(layout);
 }
 if(data.bands){
  const heading=document.createElement('strong');
  heading.style.cssText='display:block;margin:14px 0 6px';
  heading.textContent='Elektronik bantlar · ham QE enerjileri';
  bandBox.append(heading);
  if(data.bands.totalBands!==data.bands.curves.length){const windowNote=document.createElement('p');windowNote.textContent='Görüntülenen bantlar: '+data.bands.firstBand+'–'+(data.bands.firstBand+data.bands.curves.length-1)+' / '+data.bands.totalBands+'. Tam bant verisi ham dosyada korunur.';bandBox.append(windowNote);}
  const result=chart('QE elektronik bant yapısı','k-yolu uzaklığı','Enerji (eV)',
   data.bands.curves.map(y=>({x:data.bands.distance,y})),linked?480:660,linked?360:260,
   {yDomain:energyWindow,bandCurves:true,kNodes:data.bands.kNodes});
  bandBox.append(result);
  const bandLegend=document.createElement('small');bandLegend.className='qe-plot-legend';
  bandLegend.textContent='Mavi eğriler: hesaplanan Kohn–Sham bantları · Enerji: ham QE referansı.';
  bandBox.append(bandLegend);
  if(data.bandLabels.length&&!data.bands.kNodes){
   const caption=document.createElement('small');
   caption.style.cssText='display:block;margin:6px 0';
   caption.textContent='K-yolu sırası: '+data.bandLabels.join(' → ')+'. Yalnız etiketlerden eksen konumları çıkarılamaz; bu nedenle yüksek simetri çizgileri gösterilmiyor.';
   bandBox.append(caption);
  }
 }
 if(data.dos){
  const head=document.createElement('strong');head.style.cssText='display:block;margin:14px 0 6px';head.textContent='DOS / toplam projeksiyon · ham enerji';dosBox.append(head);
  const curves=[{x:data.dos.energy,y:data.dos.values}];
  if(data.pdos)curves.push({x:data.dos.energy,y:data.pdos});
  dosBox.append(chart('QE toplam DOS ve PDOS',linked?'Durum/(eV hücre)':'Enerji (eV)',linked?'Enerji (eV)':'Durum/(eV hücre)',linked?curves.map(c=>({x:c.y,y:c.x})):curves,linked?280:660,linked?360:260,linked?{yDomain:energyWindow}:{xDomain:energyWindow}));
  const leg=document.createElement('small');
  leg.className='qe-plot-legend';
  leg.textContent='Mavi: toplam DOS'+(data.pdos?' · Turuncu: atomik orbitallerin toplam PDOS katkısı':'')+'. Enerjiler Fermi seviyesine hizalanmamıştır.';
  dosBox.append(leg);
 }
 if(data.pdosDetailed){
  const heading=document.createElement('strong');
  heading.style.cssText='display:block;margin:14px 0 6px';
  const localized=text=>typeof window==='undefined'?text:(window.CrystalI18n?.t(text)||text);
  heading.textContent=localized('Atom / element / orbital katkılarını incele');
  container.append(heading);
  const select=document.createElement('select');
  select.setAttribute('aria-label',localized('PDOS atom ve orbital seçimi'));
  select.style.maxWidth='100%';
  select.style.width='100%';
  const choices=[];
  for(const element of data.pdosDetailed.elements){
   for(const [orbital,values] of Object.entries(element.orbitals))
    choices.push({label:element.element+' · '+orbital+' '+localized('orbitali (element toplamı)'),
     value:values,key:'element-'+element.element+'-'+orbital});
  }
  for(const atom of data.pdosDetailed.atoms){
   for(const [orbital,values] of Object.entries(atom.orbitals))
    choices.push({label:atom.atomIndex+'. atom · '+atom.element+' · '+orbital,
     value:values,key:'atom-'+atom.atomIndex+'-'+orbital});
  }
  for(const choice of choices){
   const option=document.createElement('option');
   option.value=choice.key;option.textContent=choice.label;
   select.append(option);
  }
  const defaultIndex=choices.findIndex(c=>c.key==='element-Mo-d');
  if(defaultIndex>=0)select.selectedIndex=defaultIndex;
  if(selection&&choices.some(c=>c.key===selection))select.value=selection;
  const plot=document.createElement('div');
  const legend=document.createElement('small');
  legend.style.cssText='display:block;margin:6px 0';
  const update=()=>{
   const c=choices.find(c=>c.key===select.value)||choices[0];
   if(!c)return;
   plot.replaceChildren(chart(localized('Toplam projeksiyon ve')+' '+c.label,
    'Enerji (eV)','Durum/(eV hücre)',[
     {x:data.pdosDetailed.energy,y:data.pdos},
     {x:data.pdosDetailed.energy,y:c.value}
    ],660,260,{xDomain:energyWindow}));
   legend.textContent=localized('Mavi: tüm atomların toplam PDOS katkısı')+' · '+
    localized('Turuncu:')+' '+c.label+'. '+
    localized('Bu yansıtma kimyasal bağ veya optik geçiş kanıtı değildir.');
  };
  select.addEventListener('change',update);
  container.append(select,plot,legend);
  update();
 }
}

export function electronicEnergyRange(data){
 let lo=Infinity,hi=-Infinity;
 for(const values of [...(data.bands?.curves||[]),...(data.dos?[data.dos.energy]:[])])
  for(const value of values){lo=Math.min(lo,value);hi=Math.max(hi,value);}
 if(!finite(lo)||!finite(hi))throw Error('Enerji aralığı bulunamadı.');
 return lo===hi?[lo-.5,hi+.5]:[lo,hi];
}
export function checkedEnergyWindow(data,min,max){
 if(!finite(min)||!finite(max)||min>=max||Math.max(Math.abs(min),Math.abs(max))>1e6)throw Error('Enerji penceresi sonlu ve artan olmalı.');
 const [lo,hi]=electronicEnergyRange(data);
 if(max<=lo||min>=hi)throw Error('Enerji penceresi veri aralığıyla kesişmiyor.');
 return [min,max];
}
const csvCell=value=>typeof value==='number'?String(value):'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
export function electronicCsv(data,kind){
 if(data.channels)throw Error('CSV için spin kanalını seçin.');
 let header,columns;
 if(kind==='bands'&&data.bands){
  const start=data.bands.firstBand||1;
  header=['k_distance',...data.bands.curves.map((_,i)=>'band_'+(i+start)+'_ev')];columns=[data.bands.distance,...data.bands.curves];
 }else if(kind==='dos'&&data.dos){
  header=['energy_ev','total_dos_states_per_ev'];columns=[data.dos.energy,data.dos.values];
  if(data.pdos){header.push('total_pdos_states_per_ev');columns.push(data.pdos);}
  if(data.pdosDetailed)for(const [kind,groups] of [['element',data.pdosDetailed.elements],['atom',data.pdosDetailed.atoms]])for(const item of groups){
   const prefix=kind==='element'?item.element:'atom_'+item.atomIndex+'_'+item.element;
   header.push(prefix+'_total_states_per_ev');columns.push(item.total);
   for(const [orbital,values] of Object.entries(item.orbitals)){header.push(prefix+'_'+orbital+'_states_per_ev');columns.push(values);}
  }
 }else throw Error('İndirilecek veri bulunamadı.');
 if(data.spinChannel)header.push('spin_channel');
 header.push('energy_zero','input_sha256');const lines=[header.map(csvCell).join(',')];
 for(let i=0;i<columns[0].length;i++)lines.push([...columns.map(c=>c[i]),...(data.spinChannel?[data.spinChannel]:[]),data.energyZero,data.inputHash].map(csvCell).join(','));
 return lines.join('\n')+'\n';
}
export function serializeElectronicPlots(host,data,energyWindow){
 const plots=[...host.querySelectorAll('svg')];if(!plots.length)throw Error('İndirilecek grafik yok.');
 const width=900,row=!!host.querySelector('.qe-band-dos-layout');
 const height=90+(row?400+Math.max(0,plots.length-2)*310:plots.length*310);
 const root=el('svg',{xmlns:NS,width,height,viewBox:`0 0 ${width} ${height}`,color:'#334155'});
 root.append(el('rect',{width,height,fill:'#fff'}));
 root.append(el('style',{},'text{font-family:Arial,sans-serif}'));
 root.append(el('metadata',{},JSON.stringify({schema:'kristalyapi.qe-plot-export.v1',...(data.spinChannel?{spin_channel:data.spinChannel}:{}),source:data.source,energy_zero:data.energyZero,input_sha256:data.inputHash,display_energy_window_ev:energyWindow})));
 for(const [i,text] of ['Quantum ESPRESSO · '+data.source+(data.spinChannel?' · spin '+data.spinChannel:''),'Enerji sıfırı: '+data.energyZero,'SHA-256: '+(data.inputHash||'—')+' · '+energyWindow.join(' … ')+' eV'].entries())
  root.append(el('text',{x:20,y:20+i*20,'font-size':i===0?14:10,fill:'#334155'},text));
 let y=85;
 for(const [i,plot] of plots.entries()){
  const beside=row&&i<2,x=beside&&i===1?600:0,w=beside?(i===0?600:300):width,h=beside?360:275;
  const titleY=beside?85:y;
  root.append(el('text',{x:x+15,y:titleY,'font-size':11,fill:'#334155'},plot.getAttribute('aria-label')||''));
  const copy=plot.cloneNode(true);copy.removeAttribute('style');copy.setAttribute('x',x);copy.setAttribute('y',titleY+10);copy.setAttribute('width',w);copy.setAttribute('height',h);root.append(copy);
  if(beside&&i===1)y=485;else if(!beside)y+=310;
 }
 return {text:new XMLSerializer().serializeToString(root),width,height};
}
function downloadElectronicBlob(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function renderQeElectronicResults(container,data){
 container.replaceChildren();
 if(data.channels){
  const note=document.createElement('p');note.className='note';
  note.textContent='Kollineer spin · toplam manyetizasyon '+data.magnetization.total_mu_b_per_cell+' μB/hücre · mutlak '+data.magnetization.absolute_mu_b_per_cell+' μB/hücre. Başlangıç tohumları manyetik temel durum kanıtı değildir. Kanallar pozitif DOS değerleriyle ayrı gösterilir; Fermi hizalaması yapılmaz.';
  container.append(note);
  for(const [channel,label] of [['up','Yukarı spin ↑'],['down','Aşağı spin ↓']]){
   const section=document.createElement('section');section.className='qe-spin-channel';section.dataset.spinChannel=channel;
   const title=document.createElement('h3');title.textContent=label;const content=document.createElement('div');
   section.append(title,content);container.append(section);renderQeElectronicResults(content,data.channels[channel]);
  }
  return;
 }
 const controls=document.createElement('div');controls.className='qe-spectrum-controls';
 const min=document.createElement('input'),max=document.createElement('input');
 const full=electronicEnergyRange(data);let window=[...full];
 const field=(text,input,value)=>{const label=document.createElement('label');label.className='field';const span=document.createElement('span');span.textContent=text;input.type='number';input.step='any';input.value=String(value);label.append(span,input);return label;};
 controls.append(field('En düşük enerji (eV)',min,full[0]),field('En yüksek enerji (eV)',max,full[1]));
 const linked=document.createElement('input');linked.type='checkbox';linked.checked=!!(data.bands&&data.dos);linked.disabled=!(data.bands&&data.dos);
 const linkedLabel=document.createElement('label');linkedLabel.className='check';const linkedText=document.createElement('span');linkedText.textContent='Bant ve DOS’u yan yana göster';linkedLabel.append(linked,linkedText);
 const message=document.createElement('p');message.className='hint';message.setAttribute('role','status');
 const plots=document.createElement('div');plots.className='qe-electronic-plot-area';
 const apply=document.createElement('button');apply.type='button';apply.textContent='Enerji penceresini uygula';
 const redraw=()=>{const selection=plots.querySelector?.('select')?.value;renderElectronicContent(plots,data,window,linked.checked,selection);};
 apply.onclick=()=>{try{if(!min.value.trim()||!max.value.trim())throw Error('Enerji sınırlarını girin.');window=checkedEnergyWindow(data,Number(min.value),Number(max.value));redraw();message.textContent='Görünüm güncellendi; ham veri korunur.';}catch(error){message.textContent=error.message;}};
 const reset=document.createElement('button');reset.type='button';reset.textContent='Tam enerji aralığı';reset.onclick=()=>{window=[...full];min.value=String(full[0]);max.value=String(full[1]);redraw();message.textContent='';};
 linked.onchange=redraw;controls.append(apply,reset);container.append(controls,linkedLabel);
 const actions=document.createElement('div');actions.className='qe-spectrum-downloads';
 const button=(label,callback)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{try{b.disabled=true;await callback();}catch(error){message.textContent=error.message;}finally{b.disabled=false;}};actions.append(b);};
 const stem='qe-'+(data.inputHash?.slice(0,12)||'electronic')+(data.spinChannel?'-spin-'+data.spinChannel:'');
 if(data.bands)button('Bant verisini CSV indir',()=>downloadElectronicBlob(new Blob([electronicCsv(data,'bands')],{type:'text/csv;charset=utf-8'}),stem+'-bands.csv'));
 if(data.dos)button('DOS / PDOS verisini CSV indir',()=>downloadElectronicBlob(new Blob([electronicCsv(data,'dos')],{type:'text/csv;charset=utf-8'}),stem+'-dos-pdos.csv'));
 button('Grafikleri SVG indir',()=>downloadElectronicBlob(new Blob([serializeElectronicPlots(plots,data,window).text],{type:'image/svg+xml;charset=utf-8'}),stem+'.svg'));
 button('Grafikleri PNG indir',async()=>{
  const snapshot=serializeElectronicPlots(plots,data,window),url=URL.createObjectURL(new Blob([snapshot.text],{type:'image/svg+xml;charset=utf-8'}));
  try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('PNG görüntüsü oluşturulamadı.'));image.src=url;});
   const canvas=document.createElement('canvas');canvas.width=snapshot.width*2;canvas.height=snapshot.height*2;
   if(canvas.width*canvas.height>16e6)throw Error('PNG boyut sınırı aşıldı.');
   canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG oluşturulamadı.');downloadElectronicBlob(blob,stem+'.png');
  }finally{URL.revokeObjectURL(url);}
 });
 const note=document.createElement('p');note.className='hint';note.textContent='Enerji penceresi yalnız görünümü değiştirir. CSV, yüklenen verinin tüm örneklerini ham enerji referansında içerir.';
 container.append(actions,note,message,plots);redraw();
}
