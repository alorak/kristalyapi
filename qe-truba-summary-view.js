/* Strict offline TRUBA collector summary view. No remote requests or HTML injection. */
const SHA=/^[a-f0-9]{64}$/;
const STATUSES=new Set(['completed','unverified','not_converged','invalid','failed','incomplete']);
const VALID_CALCS=new Set(['scf','relax']);
const finiteOrNull=(value,name)=>{
 if(value===null)return null;
 if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid numeric result: '+name);
 return value;
};
function validHash(s,nullable=true){
 if(s===null&&nullable)return true;
 return typeof s==='string'&&SHA.test(s);
}
export function parseTrubaSummary(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    value.schema!=='kristalyapi.truba-qe-summary.v1'||
    value.source!=='offline-truba-collector')throw Error('Unsupported TRUBA summary format.');
 if(!VALID_CALCS.has(value.calculation)||!STATUSES.has(value.status))throw Error('Invalid TRUBA calculation/status.');
 if(value.scientific_convergence_verified!==false)throw Error('Missing scientific limitation marker.');
 const {qe,integrity,execution}=value;
 if(!qe||!integrity||!execution||typeof qe!=='object'||typeof integrity!=='object'||
    typeof execution!=='object'||Array.isArray(qe)||Array.isArray(integrity))throw Error('Missing TRUBA fields.');
 if(!validHash(integrity.input_sha256_expected,false)||
    !validHash(integrity.input_sha256_actual,false)||
    !validHash(value.output_sha256))throw Error('Invalid SHA-256 field.');
 for(const field of ['input_matches','all_required_upfs_present','all_pinned_upfs_match','all_upfs_pinned'])
  if(typeof integrity[field]!=='boolean')throw Error('Invalid provenance flag: '+field);
 if(![null,true,false].includes(integrity.slurm_script_matches))throw Error('Invalid SLURM hash state.');
 if(typeof qe.job_done!=='boolean'||typeof qe.scf_converged!=='boolean'||
    ![null,true,false].includes(qe.geometry_converged))throw Error('Invalid QE convergence status.');
 for(const field of ['energy_ry','energy_ev','total_force_ry_bohr','max_force_component_ry_bohr'])
  finiteOrNull(qe[field],field);
 if(!Number.isInteger(qe.energy_observation_count)||qe.energy_observation_count<0||
    !Array.isArray(qe.energy_tail_ry)||qe.energy_tail_ry.length>128||
    qe.energy_tail_ry.some(v=>typeof v!=='number'||!Number.isFinite(v)))
  throw Error('Invalid QE energy history.');
 if(qe.energy_ry===null&&qe.energy_ev!==null)throw Error('Missing Ry energy.');
 if(!Array.isArray(integrity.pseudopotentials)||integrity.pseudopotentials.length>118)
  throw Error('Invalid UPF manifest.');
 for(const p of integrity.pseudopotentials){
  if(!p||typeof p!=='object'||!(/^[A-Z][a-z]?$/.test(p.element))||
     !(/^[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf$/i.test(p.file))||
     !validHash(p.sha256_expected)||!validHash(p.sha256_actual)||
     typeof p.present!=='boolean'||![null,true,false].includes(p.matches_pinned_hash))
   throw Error('Invalid UPF provenance entry.');
 }
 if(execution.job_id!==null && !/^\d{1,18}$/.test(String(execution.job_id)))
  throw Error('Invalid SLURM job ID.');
 if(execution.slurm_exit_code!==null && (!Number.isInteger(execution.slurm_exit_code)||
    Math.abs(execution.slurm_exit_code)>65535))throw Error('Invalid SLURM exit code.');
 if(typeof execution.submitted_by_collector!=='boolean'||execution.submitted_by_collector)
  throw Error('Invalid collector execution origin.');
 if(value.status==='completed'){
  if(!integrity.input_matches||!integrity.all_required_upfs_present||
     !integrity.all_pinned_upfs_match||!integrity.all_upfs_pinned||
     integrity.slurm_script_matches!==true||!qe.job_done||!qe.scf_converged||
     qe.energy_ry===null||(value.calculation==='relax'&&qe.geometry_converged!==true))
   throw Error('Contradictory completed status.');
 }
 return value;
}
function node(tag,text,className){
 const element=document.createElement(tag);
 if(className)element.className=className;
 element.textContent=text;
 return element;
}
export function renderTrubaSummary(host,summary){
 const s=parseTrubaSummary(summary);
 host.replaceChildren();
 const descriptions={completed:'Çalışma tamamlanmış, kaydedilen dosya hashleri eşleşiyor.',
  unverified:'İş tamamlanmış görünüyor; tüm UPF veya betik hashleri sabitlenmemiş.',
  not_converged:'QE çıktı sonuna ulaşmış ancak gerekli yakınsama işaretleri sağlanmamış.',
  invalid:'Girdi, UPF veya SLURM kaynak bütünlüğü doğrulanamadı.',
  failed:'SLURM/QE işleminden başarısız çıkış kodu dönmüş.',
  incomplete:'QE çıktı dosyası eksik ya da JOB DONE işareti bulunamadı.'};
 host.append(node('h4','TRUBA / SLURM · '+s.calculation.toUpperCase()),
  node('p',descriptions[s.status],'qe-truba-state'),
  node('p','İş ID: '+(s.execution.job_id||'belirtilmemiş')+
   ' · Durum: '+s.status+(s.execution.slurm_exit_code===null?'':' · Çıkış: '+s.execution.slurm_exit_code)));
 const fmt=n=>n===null?'veri yok':Number(n).toPrecision(9);
 const rows=[
  ['Son toplam enerji',fmt(s.qe.energy_ry)+' Ry'],
  ['Son toplam kuvvet',fmt(s.qe.total_force_ry_bohr)+' Ry/Bohr'],
  ['Maks. kuvvet bileşeni',fmt(s.qe.max_force_component_ry_bohr)+' Ry/Bohr'],
  ['Enerji gözlem sayısı',String(s.qe.energy_observation_count)],
  ['QE JOB DONE',s.qe.job_done?'Evet':'Hayır'],
  ['SCF yakınsama işareti',s.qe.scf_converged?'Var':'Yok'],
  ['Geometri yakınsaması',s.qe.geometry_converged===null?'Uygulanmaz':s.qe.geometry_converged?'Var':'Yok'],
  ['Girdi SHA-256',s.integrity.input_matches?'Eşleşiyor':'Uyuşmuyor'],
  ['UPF dosyaları',s.integrity.all_required_upfs_present?'Tam':'Eksik'],
  ['UPF hashleri',s.integrity.all_upfs_pinned&&s.integrity.all_pinned_upfs_match?'Doğrulandı':'Eksik/doğrulanmadı'],
  ['SLURM betik SHA-256',s.integrity.slurm_script_matches===null?'Kayıt yok':s.integrity.slurm_script_matches?'Eşleşiyor':'Uyuşmuyor']
 ];
 const table=document.createElement('table'),body=document.createElement('tbody');
 for(const [label,value] of rows){
  const tr=document.createElement('tr');tr.append(node('th',label),node('td',value));body.append(tr);
 }
 table.append(body);host.append(table);
 host.append(node('p','Bu özet geometriyi otomatik değiştirmez, SCF/relax doğruluğunu veya bilimsel yakınsamayı kanıtlamaz. Ham .out dosyasını ve deneysel/nümerik yakınsama testlerini ayrıca saklayın.','hint'));
}
