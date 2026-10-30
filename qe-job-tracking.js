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
