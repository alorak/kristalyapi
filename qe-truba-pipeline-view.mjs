/* Read-only P1.2 offline stage evidence summary: no HTML interpolation. */
const PLAN=['relax','scf','bands','bands_pp','nscf','dos','projwfc'];
const STATUSES=new Set(['completed','missing','invalid']);
export function parseTrubaPipelineSummary(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    value.schema!=='kristalyapi.truba-qe-pipeline-summary.v1'||
    value.scientific_convergence_verified!==false||
    !['completed','incomplete'].includes(value.status)||
    typeof value.all_upfs_pinned!=='boolean'||
    !Array.isArray(value.stages)||value.stages.length<6||value.stages.length>7)
  throw Error('Geçersiz TRUBA aşamalı sonuç şeması.');
 const names=value.stages.map(s=>s?.stage);
 const expected=names.length===7?PLAN:PLAN.slice(1);
 if(names.some((v,i)=>v!==expected[i]))throw Error('SLURM aşama sırası geçersiz.');
 for(const stage of value.stages){
  if(!STATUSES.has(stage.status)||
     (stage.job_id!==undefined&&stage.job_id!==null&&!/^\d{1,18}$/.test(String(stage.job_id)))||
     (stage.file_count!==undefined&&(!Number.isInteger(stage.file_count)||stage.file_count<0||stage.file_count>30)))
   throw Error('Aşama kanıt alanları geçersiz.');
 }
 if(value.status==='completed'&&value.stages.some(s=>s.status!=='completed'))
  throw Error('Tamamlandı raporunda eksik/bozuk aşama var.');
 return value;
}
function child(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
export function renderTrubaPipelineSummary(container,data){
 const value=parseTrubaPipelineSummary(data);
 container.replaceChildren();
 container.append(child('h4','TRUBA / SLURM · çok aşamalı QE'));
 container.append(child('p','Durum: '+value.status+
  (value.all_upfs_pinned?' · Tüm UPF hashleri sabitlenmiş':' · Hashlenmemiş UPF var; kanıt eksik')));
 const table=document.createElement('table'),tbody=document.createElement('tbody');
 for(const s of value.stages){
  const tr=document.createElement('tr');
  tr.append(child('th',s.stage),child('td',s.status+
   (s.job_id?' · SLURM '+s.job_id:'')+
   (s.file_count===undefined?'':' · '+s.file_count+' eser')));
  tbody.append(tr);
 }
 table.append(tbody);container.append(table);
 container.append(child('p','Aşama tamamlama ve dosya SHA-256 eşleşmesi fiziksel yakınsama, bant aralığı, DOS veya malzeme özelliklerinin bilimsel doğrulaması değildir.'));
}
