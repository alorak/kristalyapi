/* Read-only polling. No submission, retry of mutations, timers or credentials in storage. */
const stageOrder={scf:['scf'],'relax-scf':['relax','scf'],electronic:['scf','bands','bands_pp','nscf','dos','projwfc']};
export function jobProgress(record,diagnostics){
 const order=record?.calculation==='electronic'&&record?.spin==='polarized'?['scf','bands','bands_pp_up','bands_pp_down','nscf','dos','projwfc']:stageOrder[record?.calculation]||[];
 const completed=new Set((diagnostics?.stages||[]).filter(s=>s.status==='completed').map(s=>s.name));
 return order.map(name=>({name,state:record.status==='completed'||completed.has(name)?'completed':
  (diagnostics?.stages||[]).some(s=>s.name===name&&s.status==='failed')?'failed':
  record.status==='running'&&diagnostics?.active_stage===name?'running':'pending'}));
}
export function renderJobProgress(host,record,diagnostics){
 host.replaceChildren();const stages=jobProgress(record,diagnostics);
 const note=document.createElement('p');note.className='hint';
 note.textContent=stages.length?stages.filter(s=>s.state==='completed').length+' / '+stages.length+' aşama tamamlandı. Bu oran kalan süre tahmini değildir.':'Aşama bilgisi henüz yok.';
 host.append(note);if(!stages.length)return;
 const list=document.createElement('ol');list.className='qe-stage-list';
 for(const stage of stages){const item=document.createElement('li');item.dataset.state=stage.state;
  const label={completed:'Tamamlandı',running:'Çalışıyor',failed:'Başarısız',pending:'Bekliyor'}[stage.state];
  item.textContent=stage.name+' · '+label;if(stage.state==='running')item.setAttribute('aria-current','step');list.append(item);
 }host.append(list);
}
export function createJobPoller({current,eligible,refresh,onFailureLimit=()=>{},delay=5000,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,pending=null,key=null,failures=0,disposed=false;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 function sync({reset=false}={}){
  cancel();const job=current();if(job!==key){key=job;failures=0;}if(reset)failures=0;
  if(disposed||failures>=3||!job||!eligible(job)||pending)return;
  timer=setTimer(()=>{timer=null;if(!disposed&&current()===job&&eligible(job))void request();},Math.min(30000,delay*2**failures));
 }
 function request(){
  cancel();const job=current();if(!job||disposed)return Promise.resolve(false);
  if(pending)return pending.promise.then(result=>current()===result.job?result.ok:request());
  // Keep identity in the resolved envelope, never in a URL or persistent store.
  const promise=(async()=>{
   let ok=false;try{ok=await refresh(job)!==false;}catch{ok=false;}
   if(current()===job){failures=ok?0:failures+1;if(failures===3)onFailureLimit();}
   return {job,ok};
  })();
  pending={job,promise};
  return promise.finally(()=>{pending=null;sync();}).then(result=>result.ok);
 }
 return {sync,refresh({fresh=false}={}){failures=0;return fresh&&pending?pending.promise.then(()=>request()):request();},dispose(){disposed=true;cancel();},get failures(){return failures;}};
}


/* Strictly read-only display contract; textContent keeps labels/evidence inert. */
export function renderCalculationSummary(host,summary){
 host.replaceChildren();
 if(summary?.schema!=='kristalyapi.calculation-summary.v1'||
  !/^[a-f0-9]{32}$/.test(summary.job_id||'')||
  !/^[a-f0-9]{64}$/.test(summary.structure_hash||'')||
  !summary.request||typeof summary.request!=='object')
  throw Error('Hesap özeti şeması veya kaynak kimliği geçersiz.');
 const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
 const heading=node('h4','Hesap özeti · '+(summary.name||summary.job_id.slice(0,12)));
 host.append(heading);
 const fields=[
  ['İş kimliği',summary.job_id],['Durum',summary.status],
  ['Kaydedildi',summary.created],['Güncellendi',summary.updated],
  ['Yapı SHA-256',summary.structure_hash],
  ['UPF profili',summary.profile_id],
  ['Kaynak profili SHA-256',summary.resource_profile_sha256||'Kaydedilmemiş'],
  ['Hesap türü',summary.request.calculation],['İşlevsel',summary.request.functional],
  ['Spin',summary.request.spin],['ecutwfc (Ry)',summary.request.ecutwfc_ry],
  ['ecutrho (Ry)',summary.request.ecutrho_ry],
  ['k-örgüsü',Array.isArray(summary.request.kpoints)?summary.request.kpoints.join(' × '):'—'],
  ['Atom sayısı',summary.request.atom_count],
  ['Kanıt durumu',({matched:'Sonuç/kaynak kimliği eşleşti',unavailable:'Henüz sonuç kanıtı yok',mismatch:'Kaynak kimliği/kanıt uyuşmuyor'})[summary.evidence_status]||'Bilinmiyor']
 ];
 const output=summary.result;
 if(output&&summary.evidence_status==='matched'){
  fields.push(
   ['QE sürümü',output.engine_version||'—'],
   ['Toplam enerji (eV)',Number.isFinite(output.energy_ev)?output.energy_ev.toFixed(8):'Hesaplanmamış'],
   ['Toplam kuvvet (Ry/Bohr)',Number.isFinite(output.total_force_ry_bohr)?output.total_force_ry_bohr.toExponential(4):'Hesaplanmamış'],
   ['Girdi SHA-256',output.input_sha256||'—'],['Çıktı SHA-256',output.output_sha256||'—'],
   ['Son yapı SHA-256',output.final_structure_hash||'Uygulanmaz']);
 }
 const dl=node('dl');dl.className='qe-provenance-grid';
 for(const [key,value] of fields){
  dl.append(node('dt',key),node('dd',value??'—'));
 }
 host.append(dl);
 const note=node('p','İşin tamamlanması tek başına fiziksel yakınsama çalışmasının kabul edildiği anlamına gelmez.');
 note.className='hint';host.append(note);
 const details=node('details');details.className='qe-provenance-details';
 details.append(node('summary','Kaydedilmiş hesap girdisi ve kanıt hash’leri'));
 const record={request:summary.request,artifacts:output?.artifact_sha256||{},
  pseudopotentials:output?.pseudopotentials||{},result_schema:output?.schema||null};
 const pre=node('pre',JSON.stringify(record,null,2).slice(0,32000));details.append(pre);host.append(details);
}
