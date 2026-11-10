/* Strict parser for actual Materials Project mp-api electronic exports.
 * A JSON declaration is not independent scientific provenance verification. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const idOkay=s=>typeof s==='string'&&/^mp-(?:[0-9]{1,12}|[a-z]{1,16})$/.test(s);
const error=m=>{throw Error('MP elektronik veri: '+m);};
function numbers(values,label,max=20000,{nonnegative=false,ascending=false}={}){
 if(!Array.isArray(values)||values.length<2||values.length>max||
    values.some((v,i)=>!finite(v)||(nonnegative&&v<0)||(ascending&&i>0&&v<=values[i-1])))
   error(label+' sayısal dizisi geçersiz.');
 return values.slice();
}
function spinArrays(raw,label,n,maxRows,positive=false){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !Object.prototype.hasOwnProperty.call(raw,'up')||
    Object.keys(raw).some(k=>!['up','down'].includes(k)))error(label+' spin kanalı geçersiz.');
 const channels={};
 for(const [spin,rows] of Object.entries(raw)){
  if(label==='DOS'){
   if(!Array.isArray(rows)||rows.length!==n||rows.some(v=>!finite(v)||v<0))
    error('DOS '+spin+' kanalı geçersiz.');
   channels[spin]=rows.slice();
  }else{
   if(!Array.isArray(rows)||rows.length<1||rows.length>maxRows||
       rows.some(r=>!Array.isArray(r)||r.length!==n||r.some(v=>!finite(v))))
    error('Bant '+spin+' kanalı geçersiz.');
   channels[spin]=rows.map(r=>r.slice());
  }
 }
 if(channels.down!==undefined&&label==='Bant'&&channels.down.length!==channels.up.length)
  error('Spin bant sayıları eşleşmiyor.');
 return channels;
}
export function parseMpElectronic(data){
 if(!data||data.schema!=='kristalyapi.mp-electronic.v1'||data.provider!=='Materials Project'||
    !idOkay(data.material_id))error('Şema, sağlayıcı veya MP-ID geçersiz.');
 if(typeof data.retrieved_at!=='string'||!/^20\d{2}-\d\d-\d\dT/.test(data.retrieved_at)||
    !Number.isFinite(Date.parse(data.retrieved_at)))error('Alınma tarihi geçersiz.');
 if(data.band==null&&data.dos==null)error('Bant ve DOS birlikte eksik.');
 const ref='https://materialsproject.org/materials/'+data.material_id;
 const task=x=>x==null?null:typeof x==='string'&&/^(?:mp-)?(?:[a-z]{1,16}|[0-9]{1,12})$/.test(x)?x:error('Görev kimliği geçersiz.');
 const p=data.provenance||{};
 const provenance={source:ref,bandTask:task(p.band_task_id),dosTask:task(p.dos_task_id),
   client:typeof data.mp_api_version==='string'?data.mp_api_version.slice(0,32):'unknown'};
 let band=null,dos=null;
 if(data.band!=null){
  const b=data.band;
  if(!finite(b.efermi_ev)||Math.abs(b.efermi_ev)>10000)error('Bant Fermi referansı geçersiz.');
  const distance=numbers(b.distance_inv_angstrom,'Bant k-mesafesi',2000);
  if(distance.some((v,i)=>v<0||(i>0&&v<distance[i-1])))error('Bant mesafesi azalmamalı.');
  const spins=spinArrays(b.spins,'Bant',distance.length,300);
  if(Object.values(spins).some(rows=>rows.length*distance.length>120000))error('Bant nokta sınırı aşıldı.');
  if(!Number.isInteger(b.first_band)||b.first_band<1||
    !Number.isInteger(b.total_bands)||b.total_bands<1||
    b.first_band+spins.up.length-1>b.total_bands)error('Bant indeksleri uyuşmuyor.');
  const labels=Array.isArray(b.labels)?b.labels:[];
  if(labels.length>32)error('k-yolu etiketi sınırı aşıldı.');
  const nodes=labels.map(x=>{
   if(!x||!Number.isInteger(x.index)||x.index<0||x.index>=distance.length||
      typeof x.label!=='string'||!x.label.trim()||x.label.length>24)
    error('k-yolu işaretleyicisi geçersiz.');
   return {distance:distance[x.index],label:x.label};
  });
  if(nodes.some((x,i)=>i>0&&x.distance<=nodes[i-1].distance))error('k-yolu düğümleri artan olmalı.');
  band={efermi:b.efermi_ev,distance,labels:nodes,spins,
        firstBand:b.first_band,totalBands:b.total_bands};
 }
 if(data.dos!=null){
  const d=data.dos;
  if(!finite(d.efermi_ev)||Math.abs(d.efermi_ev)>10000)error('DOS Fermi referansı geçersiz.');
  const energy=numbers(d.energy_ev,'DOS enerji',20000,{ascending:true});
  const spins=spinArrays(d.spins,'DOS',energy.length,0,true);
  let pdos=[];
  if(d.pdos!==undefined){
   if(!Array.isArray(d.pdos)||d.pdos.length>16)error('PDOS projeksiyon sayısı geçersiz.');
   const seen=new Set();
   pdos=d.pdos.map(entry=>{
    if(!entry||typeof entry.element!=='string'||!/^[A-Z][a-z]?$/.test(entry.element)||
       !['s','p','d','f'].includes(entry.orbital))
     error('PDOS element veya orbital etiketi geçersiz.');
    const key=entry.element+'|'+entry.orbital;
    if(seen.has(key))error('Yinelenen PDOS projeksiyonu.');seen.add(key);
    const channel=spinArrays(entry.spins,'DOS',energy.length,0,true);
    if(Object.keys(channel).sort().join(',')!==Object.keys(spins).sort().join(','))
     error('PDOS spin kanalları toplam DOS ile uyuşmuyor.');
    return {element:entry.element,orbital:entry.orbital,spins:channel};
   });
  }
  dos={efermi:d.efermi_ev,energy,spins,pdos};
 }
 return {materialId:data.material_id,retrievedAt:data.retrieved_at,
   provenance,band,dos,pathType:String(data.path_type||'unknown').slice(0,50),
   warning:'Dosya kullanıcı tarafından sağlandı; MP görev kaynağı bağımsız doğrulanmadı.'};
}
export function mpReferenceCurves(result){
 const output={band:[],dos:[],labels:[],materialId:result.materialId};
 if(result.band){
  output.labels=result.band.labels;
  for(const [spin,rows] of Object.entries(result.band.spins))
   output.band.push({spin,x:result.band.distance,
    curves:rows.map(row=>row.map(v=>v-result.band.efermi))});
 }
 if(result.dos){
  const x=result.dos.energy.map(v=>v-result.dos.efermi);
  for(const [spin,values] of Object.entries(result.dos.spins))
   output.dos.push({spin,x,y:values});
 }
 return output;
}
