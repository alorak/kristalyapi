/* Operational telemetry is separate from scientific acceptance. */
const reasons={resource_policy_rejected:'Kaynak profili işin çalıştırılmasına izin vermedi',paused_at_stage_boundary:'Tamamlanan aşama sınırında duraklatıldı',completed:'Hesap tamamlandı',in_progress:'İş sürüyor',cancelled:'Kullanıcı iptal etti',wall_time_limit:'Süre sınırı aşıldı',
 cgroup_oom_kill:'Bellek sınırında sonlandırıldı (cgroup OOM kanıtı)',worker_interrupted:'Worker yeniden başladı; iş kesildi',
 scf_not_converged:'SCF yakınsaması sağlanmadı',dos_grid_mismatch:'DOS / PDOS enerji gridleri uyuşmuyor',disk_full:'Disk alanı veya kota yetersiz',
 memory_allocation_failed:'Bellek ayırma hatası',process_killed_unconfirmed:'İşlem sinyalle sonlandı; OOM teyit edilmedi',
 solver_unavailable:'QE çalıştırılabilir dosyası bulunamadı',input_evidence_mismatch:'Girdi / UPF kanıtı eşleşmiyor',solver_or_pipeline_failed:'Çözücü veya hesaplama aşaması başarısız'};
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
export function parseJobDiagnostics(data){
 if(data?.schema!=='kristalyapi.qe-job-diagnostics.v1'||!Object.hasOwn(reasons,data.reason_code)||
  !['recorded','unavailable'].includes(data.availability)||!(/^[a-f0-9]{32}$/.test(data.job_id)))throw Error('İş kaynak raporu geçersiz.');
 if(data.elapsed_seconds!==null&&!finite(data.elapsed_seconds))throw Error('İş süresi geçersiz.');
 const resources=data.resources;
 if(resources&&['sampled_worker_memory_max_bytes','memory_limit_bytes','swap_limit_bytes','cgroup_oom_kill_delta','child_cpu_seconds'].some(k=>resources[k]!==null&&!finite(resources[k])))
  throw Error('Kaynak ölçümü geçersiz.');
 if(data.reason_code==='cgroup_oom_kill'&&!(resources?.cgroup_oom_kill_delta>0))throw Error('OOM kanıtı eksik.');
 if(!Array.isArray(data.stages)||data.stages.length>9||data.stages.some(s=>!['relax','scf','bands','bands_pp','bands_pp_up','bands_pp_down','nscf','dos','projwfc'].includes(s.name)||
  s.duration_seconds!==null&&!finite(s.duration_seconds)))throw Error('Aşama süreleri geçersiz.');
 return data;
}
export function renderJobDiagnostics(host,raw){
 const data=parseJobDiagnostics(raw);host.replaceChildren();
 const p=text=>{const n=document.createElement('p');n.textContent=text;return n;};
 host.append(p('İş tanısı: '+reasons[data.reason_code]));
 if(data.availability==='unavailable'){host.append(p('Bu iş için ölçülmüş kaynak kaydı yok.'));return;}
 host.append(p('Geçen süre (bu çalıştırma): '+data.elapsed_seconds.toFixed(1)+' s'+(data.active_stage?' · Aşama: '+data.active_stage:'')));
 if(data.execution_attempt)host.append(p('Çalıştırma denemesi: '+data.execution_attempt));
 const r=data.resources;
 if(r){
  const gib=x=>x===null?'ölçülemedi':(x/1024**3).toFixed(3)+' GiB';
  host.append(p('Örneklenen konteyner belleği: '+gib(r.sampled_worker_memory_max_bytes)+' · RAM sınırı: '+gib(r.memory_limit_bytes)+' · Swap sınırı: '+gib(r.swap_limit_bytes)));
  host.append(p('Bellek değeri worker ve dosya önbelleğini içerir; garantili tepe RAM veya işlem RSS ölçümü değildir.'));
 }
 for(const stage of data.stages)host.append(p(stage.name+' · '+stage.status+' · '+(stage.duration_seconds===null?'süre kaydı yok':stage.duration_seconds.toFixed(3)+' s')));
}
