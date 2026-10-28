/* Local MoS2 comparison viewer. No DFT, energy lineup, defect diagnosis or optical calculations. */
const URL_PATTERN=/^[a-f0-9]{64}$/i;
const number=x=>typeof x==='number'&&Number.isFinite(x);
const label=x=>String(x||'').slice(0,110);
const MAX_CASE_POINTS=200000;
const canonical=['pristine','V_S','V_2S','O_S','O2_at_VS'];

function vector(values,field,limit=15000){
 if(!Array.isArray(values)||values.length<2||values.length>limit||values.some(v=>!number(v)))
  throw Error(field+': sayısal eksen geçersiz.');
 return values;
}
export function parseDefectComparisonResult(obj){
 if(!obj||obj.schema!=='kristalyapi.mos2-defect-comparison.v1')
  throw Error('MoS₂ kusur serisi JSON şeması geçersiz.');
 if(!Array.isArray(obj.cases)||obj.cases.length<2||obj.cases.length>5)
  throw Error('2–5 hesaplama kaydı gerekli.');
 const seen=new Set();
 const aligned=obj.alignment_status==='user_supplied_vacuum_alignment_unverified';
 if(!aligned&&obj.alignment_status!=='unaligned')
  throw Error('Bilinmeyen enerji hizalama durumu.');
 if(aligned&&obj.alignment_method!=='vacuum_potential')
  throw Error('Vakum enerjisi referansı dışında hizalama desteklenmez.');
 const cases=obj.cases.map(c=>{
  if(!c||!canonical.includes(c.id)||c.kind!==c.id||seen.has(c.id))
   throw Error('Tekil ve geçerli kusur türleri gerekli.');
  seen.add(c.id);
  if(!c.counts||!Number.isInteger(c.counts.Mo)||c.counts.Mo<=0||
    !Number.isInteger(c.counts.S)||!Number.isInteger(c.counts.O))
    throw Error('Mo/S/O bileşimi geçersiz.');
  const counts=c.counts,expected={pristine:[0,0],V_S:[1,0],V_2S:[2,0],O_S:[1,1],O2_at_VS:[1,2]}[c.id];
  if(2*counts.Mo-counts.S!==expected[0]||counts.O!==expected[1])
   throw Error('Kusur bileşimi ile etiket uyuşmuyor.');
  const raw=vector(c.energy_ev_raw,'Ham QE enerji');
  if(raw.some((e,i)=>i>0&&e<=raw[i-1]))throw Error('Ham enerji ekseni artan sırada olmalı.');
  let x=raw;
  if(aligned){
   const ref=c.reference_energy_ev;
   if(!number(ref)||typeof c.reference_evidence!=='string'||!c.reference_evidence.trim())
    throw Error('Enerji referansı ve kanıt bilgisi eksik.');
   const shifted=vector(c.energy_ev_aligned,'Hizalanmış enerji');
   if(shifted.length!==raw.length||
      shifted.some((v,i)=>Math.abs((raw[i]-ref)-v)>1e-4))
    throw Error('Hizalanmış enerji ekseni verilen referansla tutarsız.');
   x=shifted;
  }else if(c.energy_ev_aligned!==null&&c.energy_ev_aligned!==undefined)
   throw Error('Referans yokken hizalanmış enerji verisi sunulamaz.');
  if(!c.pdos||typeof c.pdos!=='object')throw Error('Yerel PDOS verisi eksik.');
  const groups={};
  for(const region of ['near','far']){
   const g=c.pdos[region];
   if(!g||typeof g!=='object'||Array.isArray(g))throw Error('Kusur yakın/uzak PDOS grubu eksik.');
   const parsed={};
   for(const [element,data] of Object.entries(g)){
    if(!['Mo','S','O'].includes(element)||!Number.isInteger(data?.atom_count)||data.atom_count<1)
     throw Error('PDOS element veya atom sayısı geçersiz.');
    const orbitals={};
    for(const [orbital,values] of Object.entries(data.orbitals_mean_per_atom||{})){
     if(!['s','p','d','f'].includes(orbital))throw Error('Orbital türü desteklenmiyor.');
     const v=vector(values,'PDOS '+element+'-'+orbital);
     if(v.length!==raw.length||v.some(y=>y<0))
      throw Error('PDOS eğrisi enerji ekseniyle uyumsuz.');
     orbitals[orbital]=v;
    }
    if(!Object.keys(orbitals).length)throw Error('PDOS orbital grubu boş.');
    parsed[element]={atomCount:data.atom_count,orbitals};
   }
   groups[region]=parsed;
  }
  const mapping=c.reference_mapping;
  if(!mapping||!Array.isArray(mapping.matches)||!Array.isArray(mapping.unmatched_case_indices))
   throw Error('Pristine atom eşleme kaydı eksik.');
  if(mapping.matches.length>1000)throw Error('Atom eşleme verisi çok büyük.');
  const center=c.center_fractional;
  if(!Array.isArray(center)||center.length!==3||center.some(v=>!number(v)||v<0||v>=1))
   throw Error('Kusur merkez koordinatları geçersiz.');
  if(!Array.isArray(c.near_atom_indices)||!Array.isArray(c.far_atom_indices)||
     c.near_atom_indices.length+c.far_atom_indices.length!==counts.Mo+counts.S+counts.O)
   throw Error('Kusura yakın/uzak atom sayıları uyumsuz.');
  if(!URL_PATTERN.test(c.input_sha256||''))throw Error('DFT girdi SHA-256 kaydı eksik.');
  return {id:c.id,label:label(c.label||c.id),counts,energy:x,raw,groups,
   referenceEv:aligned?c.reference_energy_ev:null,
   evidence:aligned?label(c.reference_evidence):null,
   mappingCount:mapping.matches.length,unmatchedCount:mapping.unmatched_case_indices.length,
   nearCount:c.near_atom_indices.length,farCount:c.far_atom_indices.length,
   center,inputSha:c.input_sha256};
 });
 if(!seen.has('pristine'))throw Error('Kusursuz referans (pristine) gerekli.');
 if(cases.some(c=>c.counts.Mo!==cases[0].counts.Mo))
  throw Error('Farklı Mo süperhücreleri karşılaştırılamaz.');
 const points=cases.reduce((n,c)=>n+c.energy.length*
  Object.values(c.groups).reduce((a,g)=>a+Object.values(g).reduce((b,e)=>b+Object.keys(e.orbitals).length,0),0),0);
 if(points>MAX_CASE_POINTS)throw Error('Karşılaştırma veri boyutu sınırı aşıldı.');
 return {aligned,alignmentStatus:obj.alignment_status,alignmentNote:label(obj.alignment_note),
  cases,nearRadius:number(obj.near_radius_angstrom)?obj.near_radius_angstrom:null};
}

function text(tag,content){
 const n=document.createElement(tag);n.textContent=content;return n;
}
function plot(curves,title,xlabel){
 const w=640,h=270,left=56,right=16,top=22,bottom=48,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 '+w+' '+h);
 svg.setAttribute('role','img');svg.setAttribute('aria-label',title);
 svg.style.cssText='width:100%;height:auto;display:block;max-height:340px';
 let x0=Infinity,x1=-Infinity,y0=0,y1=0;
 for(const c of curves){
  for(const x of c.x){x0=Math.min(x0,x);x1=Math.max(x1,x);}
  for(const y of c.y){y1=Math.max(y1,y);}
 }
 if(x1===x0)x1=x0+1;
 if(y1===0)y1=1;
 const sx=v=>left+(v-x0)/(x1-x0)*(w-left-right),sy=v=>h-bottom-v/y1*(h-top-bottom);
 const ns='http://www.w3.org/2000/svg';
 const node=(name,attributes={},value)=>{
  const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));
  if(value!==undefined)e.textContent=String(value);return e;
 };
 svg.append(node('text',{x:w/2,y:14,fill:'currentColor','text-anchor':'middle','font-size':12},title));
 for(let i=0;i<=4;i++){
  const x=x0+(x1-x0)*i/4,y=y1*i/4;
  svg.append(node('line',{x1:sx(x),y1:top,x2:sx(x),y2:h-bottom,stroke:'currentColor','stroke-opacity':.12}));
  svg.append(node('line',{x1:left,y1:sy(y),x2:w-right,y2:sy(y),stroke:'currentColor','stroke-opacity':.12}));
  svg.append(node('text',{x:sx(x),y:h-27,fill:'currentColor','font-size':10,'text-anchor':'middle'},x.toFixed(2)));
  svg.append(node('text',{x:left-8,y:sy(y)+4,fill:'currentColor','font-size':10,'text-anchor':'end'},y.toFixed(2)));
 }
 svg.append(node('text',{x:w/2,y:h-5,fill:'currentColor','font-size':12,'text-anchor':'middle'},xlabel));
 const colors=['#2877c6','#d48922'];
 for(const [idx,c] of curves.entries()){
  const d=c.x.map((x,i)=>(i?'L':'M')+sx(x).toFixed(2)+','+sy(c.y[i]).toFixed(2)).join(' ');
  svg.append(node('path',{d,fill:'none',stroke:colors[idx%2],'stroke-width':1.6,'vector-effect':'non-scaling-stroke'}));
 }
 return svg;
}

export function renderDefectComparison(container,data){
 container.replaceChildren();
 const head=text('p','MoS₂ kusur serisi · '+data.cases.length+' yapı · '+(data.aligned?
  'Kullanıcı tarafından sağlanan vakum referansı (doğrulanmadı)':'QE ham enerji sıfırları; ortak enerji hizalaması YOK'));
 container.append(head);
 const warn=text('p',data.aligned?
  'Enerji referansı dışarıdan girilmiştir ve doğrulanmamıştır; grafik optik emisyon kanıtı değildir.':
  'Ortak fiziksel enerji referansı yok: farklı yapıların eğrileri üst üste çizilmez. Yalnız ayrı grafiklerde incelenir.');
 container.append(warn);
 const selector=document.createElement('div');selector.className='qe-form-grid';
 const opts=(arr,aria)=>{
  const select=document.createElement('select');select.setAttribute('aria-label',aria);
  select.style.maxWidth='100%';
  for(const [val,name] of arr){const o=document.createElement('option');o.value=val;o.textContent=name;select.append(o);}
  select.value=arr[0][0];return select;
 };
 const pristine=data.cases.find(c=>c.id==='pristine');
 const other=data.cases.filter(c=>c.id!=='pristine');
 const cases=opts(other.map(c=>[c.id,c.label]),'Kusur modelini seç');
 const region=opts([['near','Kusura yakın atomlar'],['far','Kusurdan uzak atomlar']],'PDOS atom grubu');
 const channel=opts([['Mo:d','Mo-d'],['S:p','S-p'],['O:p','O-p'],
  ['Mo:s','Mo-s'],['S:s','S-s'],['S:d','S-d'],['O:s','O-s']],'Element ve orbital');
 selector.append(cases,region,channel);container.append(selector);
 const summary=text('p','');container.append(summary);
 const charts=document.createElement('div');container.append(charts);
 const legend=text('small','');container.append(legend);
 const refresh=()=>{
  charts.replaceChildren();
  const selected=data.cases.find(c=>c.id===cases.value)||other[0];
  const [element,orbital]=channel.value.split(':');
  const r=region.value;
  const ref=pristine.groups[r]?.[element]?.orbitals[orbital]||null;
  const target=selected.groups[r]?.[element]?.orbitals[orbital]||null;
  summary.textContent='Kusur: '+selected.label+' · '+selected.counts.Mo+' Mo / '+selected.counts.S+
   ' S / '+selected.counts.O+' O · Yakın atom: '+selected.nearCount+
   ' · Eşlenen atom: '+selected.mappingCount+' · Eşlenemeyen: '+selected.unmatchedCount+
   ' · Yarıçap: '+(data.nearRadius??'belirsiz')+' Å.';
  if(!target){charts.append(text('p','Bu kusur ve bölgede '+element+'-'+orbital+' PDOS verisi bulunmuyor.'));return;}
  const xlabel=data.aligned?'E − E_vac (eV), dış referans':'Ham QE enerji (eV), hizasız';
  if(data.aligned&&ref){
   charts.append(plot([{x:pristine.energy,y:ref},{x:selected.energy,y:target}],
    'Pristine / '+selected.label+' · '+channel.value,xlabel));
   legend.textContent='Mavi: pristine; turuncu: '+selected.label+
    '. Her eğri kendi element atom sayısına bölünmüştür (durum/eV/atom). Referans kanıtı: '+
    selected.evidence+'.';
  }else{
   if(ref)charts.append(plot([{x:pristine.raw,y:ref}],
     'Pristine '+channel.value+' (ayrı enerji sıfırı)','Ham QE enerji (eV)'));
   charts.append(plot([{x:selected.raw,y:target}],
     selected.label+' '+channel.value+' (ayrı enerji sıfırı)','Ham QE enerji (eV)'));
   legend.textContent='İki bağımsız enerji sıfırı nedeniyle pik konumları doğrudan karşılaştırılamaz. Yükseklikler element başına ortalamadır.';
  }
 };
 for(const sel of [cases,region,channel])sel.addEventListener('change',refresh);
 refresh();
}
