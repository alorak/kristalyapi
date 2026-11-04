/* Materials Project REST adapter. No secrets, storage, third-party proxy, or globals.
 * Data are calculated reference values, not experimental measurements. */
export const MP_API='https://api.materialsproject.org';
export const MP_WORKER='https://kristalyapi-cod-api.aoakkirman.workers.dev';
export const MP_SUMMARY_FIELDS=[
 'material_id','formula_pretty','symmetry','nsites','band_gap','is_gap_direct',
 'formation_energy_per_atom','energy_above_hull','density','has_props','last_updated'
];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mpId=id=>/^mp-\d{1,12}$/.test(String(id||'').trim());
export function mpSearchUrl(raw){
 const query=String(raw||'').trim();
 if(!query||query.length>100)throw Error('Materials Project: formül veya mp- kimliği girin.');
 const params=new URLSearchParams();
 if(mpId(query))params.set('material_ids',query);
 else if(/^(?:[A-Z][a-z]?\d*(?:\.\d+)?){1,8}$/.test(query))params.set('formula',query);
 else if(/^[A-Z][a-z]?(?:-[A-Z][a-z]?){1,7}$/.test(query))params.set('chemsys',query);
 else throw Error('Formül (SrTiO3), kimyasal sistem (Sr-Ti-O) veya mp-149 yazın.');
 params.set('_fields',MP_SUMMARY_FIELDS.join(','));
 params.set('_limit','20');
 return MP_API+'/materials/summary/?'+params;
}
export function mpStructureUrl(id){
 if(!mpId(id))throw Error('Materials Project malzeme kimliği geçersiz.');
 const p=new URLSearchParams({material_ids:id,_fields:'material_id,formula_pretty,structure,last_updated',_limit:'1'});
 return MP_API+'/materials/summary/?'+p;
}
function numeric(x){return finite(x)?x:null;}
export function normalizeMpSummary(raw){
 if(!raw||typeof raw!=='object'||!mpId(raw.material_id))throw Error('Materials Project sonuç kimliği geçersiz.');
 const symmetry=raw.symmetry&&typeof raw.symmetry==='object'?raw.symmetry:{};
 const props=Array.isArray(raw.has_props)?raw.has_props.filter(v=>typeof v==='string').slice(0,60):[];
 return {
  materialId:String(raw.material_id),formula:String(raw.formula_pretty||'').slice(0,80),
  spacegroup:String(symmetry.symbol||'—').slice(0,80),number:Number.isInteger(symmetry.number)?symmetry.number:null,
  sites:Number.isInteger(raw.nsites)?raw.nsites:null,
  bandGap:numeric(raw.band_gap),direct:typeof raw.is_gap_direct==='boolean'?raw.is_gap_direct:null,
  hull:numeric(raw.energy_above_hull),formation:numeric(raw.formation_energy_per_atom),
  density:numeric(raw.density),hasProps:props,
  updated:String(raw.last_updated||'').slice(0,45)
 };
}
export function normalizeMpResponse(json){
 if(!json||!Array.isArray(json.data))throw Error('Materials Project yanıtında data dizisi bulunamadı.');
 if(json.data.length>100)throw Error('Materials Project yanıtı beklenenden büyük.');
 return json.data.map(normalizeMpSummary);
}
export function mpCompareRows(records){
 if(!Array.isArray(records)||records.length<1||records.length>4)throw Error('En fazla 4 MP kaydı karşılaştırılabilir.');
 const cols=[
  ['formula','Formül',''],['spacegroup','Uzay grubu',''],['sites','Atom konumu',''],
  ['bandGap','DFT bant aralığı','eV'],['direct','Doğrudan aralık',''],
  ['formation','Oluşum enerjisi','eV/atom'],['hull','Hull üstü enerji','eV/atom'],
  ['density','Yoğunluk','g/cm³']
 ];
 return cols.map(([key,label,unit])=>({key,label,unit,values:records.map(r=>r[key]??null)}));
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function vector(v){
 if(!Array.isArray(v)||v.length!==3||!v.every(finite))throw Error('MP kristal örgüsü geçersiz.');
 return v;
}
function siteFraction(site){
 const c=site?.abc||site?.frac_coords;
 if(!Array.isArray(c)||c.length!==3||!c.every(finite)||c.some(v=>Math.abs(v)>1e6))
  throw Error('MP kesirli atom koordinatları geçersiz.');
 return c.map(x=>((x%1)+1)%1);
}
function species(site){
 const array=Array.isArray(site?.species)?site.species:null;
 if(!array||array.length!==1)throw Error('Karma/düzensiz atom konumları bu içe aktarmada desteklenmiyor.');
 const s=array[0],symbol=String(s.element||'');
 const occupancy=s.occu??s.occupancy;
 if(!/^[A-Z][a-z]?$/.test(symbol)||!finite(occupancy)||occupancy<=0||occupancy>1)
  throw Error('MP atom türü veya doluluğu geçersiz.');
 return {symbol,occupancy};
}
export function mpStructureToCif(raw,id){
 if(!mpId(id)||raw?.material_id!==id)throw Error('MP yanıtı seçilen malzemeyle uyuşmuyor.');
 const structure=raw.structure;
 const lattice=structure?.lattice?.matrix;
 if(!Array.isArray(lattice)||lattice.length!==3)throw Error('MP örgü vektörleri bulunamadı.');
 const [a,b,c]=lattice.map(vector);
 const lengths=[a,b,c].map(v=>Math.sqrt(dot(v,v)));
 if(lengths.some(x=>x<1e-4||x>1e4))throw Error('MP örgü uzunluğu geçersiz.');
 const angle=(u,v,lu,lv)=>Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(lu*lv))))*180/Math.PI;
 const angles=[angle(b,c,lengths[1],lengths[2]),angle(a,c,lengths[0],lengths[2]),angle(a,b,lengths[0],lengths[1])];
 const determinant=dot(a,[b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]]);
 if(Math.abs(determinant)<1e-8||angles.some(x=>x<=.01||x>=179.99))throw Error('MP örgü metriği dejenere.');
 const sites=structure?.sites;
 if(!Array.isArray(sites)||!sites.length||sites.length>1000)throw Error('MP atom sayısı 1–1000 sınırı dışında.');
 const lines=['data_'+id.replace('-','_'),'# Materials Project '+id+'; DFT-relaxed structure, not an experimental CIF',
  "_symmetry_space_group_name_H-M 'P 1'",'_symmetry_Int_Tables_number 1',
  ...['a','b','c'].map((x,i)=>'_cell_length_'+x+' '+lengths[i].toFixed(9)),
  ...['alpha','beta','gamma'].map((x,i)=>'_cell_angle_'+x+' '+angles[i].toFixed(9)),
  'loop_','_atom_site_label','_atom_site_type_symbol','_atom_site_fract_x',
  '_atom_site_fract_y','_atom_site_fract_z','_atom_site_occupancy'];
 for(const [i,site] of sites.entries()){
  const sp=species(site),xyz=siteFraction(site);
  lines.push(sp.symbol+(i+1)+' '+sp.symbol+' '+xyz.map(v=>v.toFixed(9)).join(' ')+' '+sp.occupancy.toFixed(7));
 }
 return lines.join('\n')+'\n';
}
export async function mpApiGet(url,apiKey,{fetcher=fetch,signal,maxBytes=2500000,transport='direct'}={}){
 const u=new URL(url);
 if(u.origin!==MP_API||u.pathname!=='/materials/summary/'||!apiKey||apiKey.length>512||!['direct','worker'].includes(transport))
  throw Error('Materials Project istek parametreleri geçersiz.');
 const controller=new AbortController();
 const onAbort=()=>controller.abort();
 if(signal){if(signal.aborted)controller.abort();else signal.addEventListener('abort',onAbort,{once:true});}
 const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  let endpoint=u.href;
  if(transport==='worker'){
   // Probe without a key. Never disclose a credential to COD-only Worker v1.2.
   let health;
   try{
    const probe=await fetcher(MP_WORKER+'/health',{
     method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
     referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal
    });
    if(probe.ok)health=await probe.json();
   }catch(error){if(controller.signal.aborted)throw error;}
   if(health?.materialsProjectProxy!==true)
    throw Error('Materials Project Worker etkin değil. Cloudflare Worker sürüm 1.3+ dağıtılmalı.');
   endpoint=MP_WORKER+'/api/mp/summary'+u.search;
  }
  const response=await fetcher(endpoint,{
   method:'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',
   headers:{'X-API-KEY':apiKey,'Accept':'application/json'},signal:controller.signal
  });
  if(!response.ok)throw Error('Materials Project HTTP '+response.status+(response.status===401||response.status===403?' · API anahtarını kontrol edin.':''));
  let body='';
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>maxBytes)throw Error('MP yanıtı boyut sınırını aşıyor.');
  if(response.body?.getReader){
   const reader=response.body.getReader(),decoder=new TextDecoder();let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('MP yanıtı boyut sınırını aşıyor.');}
    body+=decoder.decode(value,{stream:true});
   }
   body+=decoder.decode();
  }else{
   body=await response.text();if(new TextEncoder().encode(body).byteLength>maxBytes)throw Error('MP yanıtı boyut sınırını aşıyor.');
  }
  const json=JSON.parse(body);
  if(!json||!Array.isArray(json.data))throw Error('MP beklenmedik JSON yanıtı verdi.');
  return json;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',onAbort);}
}
