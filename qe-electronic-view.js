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
 if(!data||data.schema!=='kristalyapi.qe-electronic.v1')
  throw Error('Beklenen electronic-results.json şeması bulunamadı.');
 if(!data.bands&&!data.dos)throw Error('Bant veya DOS verisi bulunamadı.');
 const output={schema:data.schema,source:String(data.source||'Belirtilmemiş').slice(0,120),
  energyZero:String(data.energy_zero||'Bilinmiyor').slice(0,150),
  bandLabels:Array.isArray(data.band_path_labels)?data.band_path_labels.map(s=>String(s).slice(0,24)).slice(0,32):[],
  inputHash:typeof data.input_sha256==='string'&&/^[a-f0-9]{64}$/i.test(data.input_sha256)?data.input_sha256:null,
  bands:null,dos:null,pdos:null,pdosDetailed:null};
 if(data.bands){
  const d=checkedArray(data.bands.distance,'Bant k uzaklığı',20000);
  if(d.some((v,i)=>i>0&&v<d[i-1]))throw Error('k uzaklığı sıralı olmalı.');
  const curves=data.bands.energies_ev;
  if(!Array.isArray(curves)||!curves.length||curves.length>300)
   throw Error('Bant sayısı 1–300 arasında olmalı.');
  if(curves.length*d.length>120000)throw Error('Görselleştirme için en fazla 120.000 bant noktası desteklenir.');
  output.bands={distance:d,curves:curves.map((v,i)=>{
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
  if(raw.spin_mode!=='collinear-unpolarized')
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
  if(energy.length*atoms.length>200000)
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
function chart(title,xName,yName,curves,width=660,height=260){
 const svg=el('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':title});
 svg.style.cssText='width:100%;height:auto;display:block;max-height:360px';
 const left=57,right=12,top=18,bottom=42;
 const plotW=width-left-right,plotH=height-top-bottom;
 let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
 for(const c of curves){for(const v of c.x){xMin=Math.min(xMin,v);xMax=Math.max(xMax,v);}
  for(const v of c.y){yMin=Math.min(yMin,v);yMax=Math.max(yMax,v);}}
 if(xMin===xMax)xMax=xMin+1;
 if(yMin===yMax){yMin-=.5;yMax+=.5;}
 const xVal=x=>left+(x-xMin)/(xMax-xMin)*plotW;
 const yVal=y=>top+plotH-(y-yMin)/(yMax-yMin)*plotH;
 const axis='currentColor';
 for(let i=0;i<=4;i++){
  const x=left+i*plotW/4,y=top+i*plotH/4;
  svg.append(el('line',{x1:x,y1:top,x2:x,y2:top+plotH,stroke:axis,'stroke-opacity':0.12}));
  svg.append(el('line',{x1:left,y1:y,x2:left+plotW,y2:y,stroke:axis,'stroke-opacity':0.12}));
  svg.append(el('text',{x,y:height-24,'text-anchor':'middle','font-size':11,fill:axis},
   (xMin+(xMax-xMin)*i/4).toFixed(2)));
  svg.append(el('text',{x:left-8,y:y+3,'text-anchor':'end','font-size':11,fill:axis},
   (yMax-(yMax-yMin)*i/4).toFixed(2)));
 }
 svg.append(el('text',{x:width/2,y:height-4,'text-anchor':'middle','font-size':12,fill:axis},xName));
 svg.append(el('text',{x:9,y:height/2,transform:'rotate(-90 9 '+height/2+')',
  'text-anchor':'middle','font-size':12,fill:axis},yName));
 curves.forEach((c,i)=>{
  const d=c.x.map((x,j)=>(j?'L':'M')+xVal(x).toFixed(2)+','+yVal(c.y[j]).toFixed(2)).join(' ');
  const color=i===0?'#2877c6':'#d48922';
  svg.append(el('path',{d,fill:'none',stroke:color,'stroke-width':curves.length>20?'0.7':1.8,
   'vector-effect':'non-scaling-stroke'}));
 });
 return svg;
}
export function renderQeElectronicResults(container,data){
 container.replaceChildren();
 const heading=document.createElement('p');
 heading.textContent='Kaynak: '+data.source+' · Enerji sıfırı: '+data.energyZero;
 container.append(heading);
 const note=document.createElement('p');
 note.textContent='Dosyanın bilimsel doğruluğu uygulama tarafından teyit edilmez. Bu grafikler optik geçiş/PL veya tek foton emisyonu değildir. Açık kristal yapısıyla otomatik eşleştirme yapılmaz.';
 container.append(note);
 if(data.inputHash){
  const hash=document.createElement('small');
  hash.textContent='Hesaplama girdisi SHA-256: '+data.inputHash;
  container.append(hash);
 }
 if(data.bands){
  const heading=document.createElement('strong');
  heading.textContent='Elektronik bantlar · ham QE enerjileri';
  container.append(heading);
  const result=chart('QE elektronik bant yapısı','k-yolu uzaklığı','Enerji (eV)',
   data.bands.curves.map(y=>({x:data.bands.distance,y})));
  container.append(result);
  if(data.bandLabels.length){
   const caption=document.createElement('small');
   caption.textContent='K-yolu etiket sırası: '+data.bandLabels.join(' → ')+'. Uzaklık eksenindeki etiket konumları otomatik çıkarılmaz.';
   container.append(caption);
  }
 }
 if(data.dos){
  const head=document.createElement('strong');head.textContent='DOS / toplam projeksiyon · ham enerji';container.append(head);
  const curves=[{x:data.dos.energy,y:data.dos.values}];
  if(data.pdos)curves.push({x:data.dos.energy,y:data.pdos});
  container.append(chart('QE toplam DOS ve PDOS','Enerji (eV)','Durum/(eV hücre)',curves));
  const leg=document.createElement('small');
  leg.textContent='Mavi: toplam DOS'+(data.pdos?' · Turuncu: atomik orbitallerin toplam PDOS katkısı':'')+'. Enerjiler Fermi seviyesine hizalanmamıştır.';
  container.append(leg);
 }
 if(data.pdosDetailed){
  const heading=document.createElement('strong');
  const localized=text=>window.CrystalI18n?.t(text)||text;
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
  const plot=document.createElement('div');
  const legend=document.createElement('small');
  const update=()=>{
   const c=choices.find(c=>c.key===select.value)||choices[0];
   if(!c)return;
   plot.replaceChildren(chart(localized('Toplam projeksiyon ve')+' '+c.label,
    'Enerji (eV)','Durum/(eV hücre)',[
     {x:data.pdosDetailed.energy,y:data.pdos},
     {x:data.pdosDetailed.energy,y:c.value}
    ]));
   legend.textContent=localized('Mavi: tüm atomların toplam PDOS katkısı')+' · '+
    localized('Turuncu:')+' '+c.label+'. '+
    localized('Bu yansıtma kimyasal bağ veya optik geçiş kanıtı değildir.');
  };
  select.addEventListener('change',update);
  container.append(select,plot,legend);
  update();
 }
}
