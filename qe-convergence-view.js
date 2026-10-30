/* Imported report inspector. File hashes establish consistency of the imported
 * JSON, not independent verification of its underlying QE evidence. */
import {chart} from './qe-electronic-view.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const hex=(x,n)=>typeof x==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(x);
const safeId=x=>typeof x==='string'&&/^[a-z0-9-]{1,80}$/.test(x);
function require(ok,message){if(!ok)throw Error(message);}
const limitByQuantity={common_lowest_path_bands_ev:.01,sampled_nscf_vbm_ev:.01,sampled_nscf_cbm_ev:.01,
 sampled_nscf_gap_ev:.01,dos_relative_l1:.05,'Mo-d_relative_l1':.05,'S-p_relative_l1':.05,
 underlying_nscf_spectrum_integrity_ev:.01,unchanged_explicit_path_integrity_ev:.01};
export function parseConvergenceView(raw){
 require(raw?.schema==='kristalyapi.qe-electronic-convergence-view.v1','Yakınsama görünüm şeması geçersiz.');
 require(typeof raw.plan_json==='string'&&raw.plan_json.length<100000&&
  typeof raw.comparison_json==='string'&&raw.comparison_json.length<300000,'Plan/rapor boyutu geçersiz.');
 require(typeof raw.spectra_json==='string'&&raw.spectra_json.length<7e6,'Eğri dosyası boyutu geçersiz.');
 const spectra=JSON.parse(raw.spectra_json);
 const plan=JSON.parse(raw.plan_json),report=JSON.parse(raw.comparison_json);
 require(plan.schema==='kristalyapi.qe-electronic-convergence-plan.v1'&&
  report.schema==='kristalyapi.qe-electronic-convergence.v1','D4.1 plan/rapor şeması geçersiz.');
 require(['passed','failed'].includes(report.status)&&report.broadening_converged===null,'Genişlik yakınsama kabulü desteklenmez.');
 require(Array.isArray(plan.cases)&&plan.cases.length===6,'Altı sabit vaka gerekli.');
 const cases=new Map();
 for(const c of plan.cases){
  require(safeId(c.id)&&!cases.has(c.id)&&c.id!=='reference-d4'&&Number.isInteger(c.nbnd)&&c.nbnd>=24&&c.nbnd<=128&&
   Number.isInteger(c.nscf_k)&&c.nscf_k>=2&&c.nscf_k<=24&&finite(c.degauss_ry)&&c.degauss_ry>0,'Vaka kimliği/ayarları geçersiz.');
  cases.set(c.id,c);
 }
 cases.set('reference-d4',{id:'reference-d4',nbnd:26,nscf_k:16,degauss_ry:.01});
 require(hex(report.reference?.structure_hash,64)&&hex(report.reference?.source_commit,40)&&
  (report.source_commit===null||hex(report.source_commit,40)),'Kaynak kimliği geçersiz.');
 require(Object.entries(plan.reference).every(([k,v])=>report.reference[k]===v),'Plan ile rapor kaynağı uyuşmuyor.');
 require(plan.decision_pairs?.map(p=>p.axis).join(',')==='nbnd,nscf_k,dos_width'&&
  plan.decision_pairs.every((p,i)=>p.gated===(i<2)),'Karar eksenleri geçersiz.');
 require(report.errors&&typeof report.errors==='object'&&!Array.isArray(report.errors)&&Object.keys(report.errors).length<=20,'Hata kaydı geçersiz.');
 require(report.cases&&typeof report.cases==='object'&&Object.keys(report.cases).length<=7,'Vaka sonuçları geçersiz.');
 for(const [id,c] of Object.entries(report.cases)){
  require(cases.has(id)&&hex(c.job_id,32),'Sonuç vaka kimliği geçersiz.');
  const n=c.sampled_nscf;
  require(n&&['vbm_ev','cbm_ev','gap_ev'].every(k=>finite(n[k]))&&n.cbm_ev>n.vbm_ev&&
   Math.abs(n.cbm_ev-n.vbm_ev-n.gap_ev)<1e-8,'NSCF bant kenarları geçersiz.');
 }
 require(Array.isArray(plan.decision_pairs)&&plan.decision_pairs.length===3&&
  Array.isArray(plan.diagnostic_pairs)&&plan.diagnostic_pairs.length===3&&Array.isArray(report.pairs)&&report.pairs.length<=6,'Karşılaştırma çiftleri geçersiz.');
 const expected=[...plan.decision_pairs,...plan.diagnostic_pairs],seen=new Set();
 for(const p of report.pairs){
  const key=p.from+'>'+p.to;
  const configured=expected.find(x=>x.from===p.from&&x.to===p.to&&x.axis===p.axis);
  require(configured&&!seen.has(key)&&cases.has(p.from)&&cases.has(p.to)&&report.cases[p.from]&&report.cases[p.to],
   'Tekrarlanan veya eksik vaka içeren karşılaştırma.');seen.add(key);
  require(!!configured.gated===!!p.gated&&p.sensitivity_only===(p.axis==='dos_width'),'Karşılaştırma türü değişmiş.');
  require(finite(p.dos_relative_l1)&&p.dos_relative_l1>=0&&['Mo-d','S-p'].every(g=>finite(p.pdos_relative_l1?.[g])&&p.pdos_relative_l1[g]>=0),
   'DOS/PDOS farkı geçersiz.');
  require(Array.isArray(p.checks)&&p.checks.length===(p.sensitivity_only?2:7),'Eksik karar ölçütü.');
  const quantities=new Set();
  for(const g of p.checks){
   require(Object.hasOwn(limitByQuantity,g.quantity)&&!quantities.has(g.quantity)&&finite(g.value)&&g.value>=0&&
    g.limit===limitByQuantity[g.quantity]&&g.passed===(g.value<=g.limit),'Karar eşiği/değeri/tutarlılığı geçersiz.');
   quantities.add(g.quantity);
  }
  const required=p.sensitivity_only?['underlying_nscf_spectrum_integrity_ev','unchanged_explicit_path_integrity_ev']:
   ['common_lowest_path_bands_ev','sampled_nscf_vbm_ev','sampled_nscf_cbm_ev','sampled_nscf_gap_ev','dos_relative_l1','Mo-d_relative_l1','S-p_relative_l1'];
  require(required.every(q=>quantities.has(q)),'Karar ölçütleri değişmiş.');
  const passed=p.checks.every(g=>g.passed);
  require(p.sensitivity_only?p.convergence_passed===null&&p.integrity_passed===passed:
   p.convergence_passed===passed&&p.integrity_passed===true,'Geçer/kalır kararı sayılarla uyuşmuyor.');
 }
 if(report.status==='passed')require(Object.keys(report.errors).length===0&&Object.keys(report.cases).length===7&&report.pairs.length===6&&
  report.pairs.every(p=>p.gated?p.convergence_passed:p.integrity_passed),'Eksik/başarısız kohort geçti olarak gösterilemez.');
 require(raw.proof?.raw_report_recomputed===true&&hex(raw.proof.plan_sha256,64)&&hex(raw.proof.comparison_sha256,64)&&hex(raw.proof.spectra_sha256,64),'Doğrulama kaydı eksik.');
 require(Array.isArray(spectra.curves)&&spectra.curves.length<=7&&Array.isArray(spectra.evidence)&&spectra.evidence.length===spectra.curves.length,'Eğri/kanıt sayısı geçersiz.');
 const curveIds=new Set();
 for(const c of spectra.curves){
  require(cases.has(c.id)&&report.cases[c.id]&&!curveIds.has(c.id),'Eğri vaka kimliği geçersiz.');curveIds.add(c.id);
  const energy=c.energy_ev;
  require(Array.isArray(energy)&&energy.length===(c.id==='reference-d4'?701:1401)&&energy.every(finite)&&
   energy.every((x,i)=>!i||Math.abs(x-energy[i-1]-(c.id==='reference-d4'?.02:.01))<1e-4)&&Math.abs(energy[0]+8)<1e-4&&Math.abs(energy.at(-1)-6)<1e-4,'Ortak enerji gridi geçersiz.');
  for(const k of ['dos','mo_d','s_p'])require(Array.isArray(c[k])&&c[k].length===energy.length&&c[k].every(x=>finite(x)&&x>=0),'DOS/PDOS eğrisi geçersiz.');
 }
 const evidenceIds=new Set();
 for(const e of spectra.evidence){
  require(curveIds.has(e.id)&&!evidenceIds.has(e.id)&&hex(e.result_sha256,64)&&hex(e.nscf_stdout_sha256,64)&&
   typeof e.path==='string'&&e.path.length<=240&&/^[a-zA-Z0-9_./-]+$/.test(e.path)&&!e.path.split('/').includes('..')&&!e.path.startsWith('/'),
   'Ham kanıt yolu/hash bilgisi geçersiz.');evidenceIds.add(e.id);
 }
 require(curveIds.size===Object.keys(report.cases).length,'Tamamlanan vakanın eğrileri eksik.');
 return {plan,report,curves:spectra.curves,evidence:spectra.evidence,proof:raw.proof,
  planText:raw.plan_json,comparisonText:raw.comparison_json,spectraText:raw.spectra_json,cases,fileHashesVerified:false};
}
export async function verifyConvergenceFileHashes(data,subtle=globalThis.crypto?.subtle){
 require(subtle,'Dosya hash kontrolü için güvenli tarayıcı bağlamı gerekli.');
 const digest=async text=>Array.from(new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
 require(await digest(data.planText)===data.proof.plan_sha256&&await digest(data.comparisonText)===data.proof.comparison_sha256&&await digest(data.spectraText)===data.proof.spectra_sha256,
  'Plan/karşılaştırma JSON hash eşleşmiyor.');
 data.fileHashesVerified=true;return true;
}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function number(x){return finite(x)?x.toPrecision(5):'—';}
const label=q=>({common_lowest_path_bands_ev:'Ortak 24 bant farkı (eV)',sampled_nscf_vbm_ev:'NSCF VBM farkı (eV)',
 sampled_nscf_cbm_ev:'NSCF CBM farkı (eV)',sampled_nscf_gap_ev:'NSCF aralık farkı (eV)',dos_relative_l1:'DOS bağıl L1',
 'Mo-d_relative_l1':'Mo-d bağıl L1','S-p_relative_l1':'S-p bağıl L1',underlying_nscf_spectrum_integrity_ev:'NSCF spektrum tutarlılığı (eV)',
 unchanged_explicit_path_integrity_ev:'Bant yolu tutarlılığı (eV)'})[q]||q;
const AXES={nbnd:'Bant sayısı',nscf_k:'NSCF k-örgüsü',dos_width:'DOS genişliği'};
const ROLES={decision:'Karar',diagnostic:'Yardımcı',integrity:'Genişlik tutarlılığı'};
const pairRole=p=>p.sensitivity_only?'integrity':p.gated?'decision':'diagnostic';
// One row per pair: verdict and the check closest to (or furthest past) its limit.
export function convergenceSummary(report){
 const rows=report.pairs.map(p=>{
  const failed=p.checks.filter(g=>!g.passed);
  const critical=[...p.checks].filter(g=>finite(g.value)&&finite(g.limit)&&g.limit>0)
   .sort((a,b)=>Math.abs(b.value)/b.limit-Math.abs(a.value)/a.limit)[0]||null;
  return {from:p.from,to:p.to,axis:p.axis,role:pairRole(p),passed:!failed.length,failed:failed.length,checks:p.checks.length,
   critical:critical&&{quantity:critical.quantity,value:critical.value,limit:critical.limit,ratio:Math.abs(critical.value)/critical.limit}};
 });
 const counts=Object.fromEntries(Object.keys(ROLES).map(role=>{const group=rows.filter(r=>r.role===role);return [role,{total:group.length,passed:group.filter(r=>r.passed).length}];}));
 return {rows,counts};
}
function table(headers,rows,states=[]){
 const wrap=node('div',undefined,'qe-convergence-table'),t=node('table'),head=node('thead'),tr=node('tr');
 for(const h of headers){const th=node('th',h);th.scope='col';tr.append(th);}head.append(tr);t.append(head);
 const body=node('tbody');for(const [i,row] of rows.entries()){const tr=node('tr');if(states[i])tr.setAttribute('data-state',states[i]);
  for(const cell of row)tr.append(node('td',String(cell)));body.append(tr);}t.append(body);wrap.append(t);return wrap;
}
export function convergenceCsv(data){
 const rows=[['from','to','axis','role','quantity','value','limit','passed']];
 for(const p of data.report.pairs)for(const g of p.checks)rows.push([p.from,p.to,p.axis,p.sensitivity_only?'integrity':p.gated?'decision':'diagnostic',g.quantity,g.value,g.limit,g.passed]);
 return rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
}
export function renderConvergenceView(host,data){
 require(data.fileHashesVerified===true,'Önce dosya hash’lerini doğrulayın.');
 host.replaceChildren();const {report,plan}=data;
 host.append(node('strong','Dosyada raporlanan sonlu kabul: '+(report.status==='passed'?'GEÇTİ':'KALDI / EKSİK')),
  node('p','Plan, rapor ve eğri dosya hash’leri eşleşti. Ham QE paketinin yeniden doğrulanması dış araçta yapılır.'),
  node('p','Tamamlanan yeni vaka: '+(Object.keys(report.cases).filter(id=>id!=='reference-d4').length)+'/6 · DOS genişliği: yalnız duyarlılık, yakınsama kararı yok.'));
 const commit=report.source_commit||report.reference.source_commit;
 const link=node('a','Kaynak commit: '+commit.slice(0,12));link.href='https://github.com/alorak/kristalyapi/commit/'+commit;
 link.target='_blank';link.rel='noopener noreferrer';host.append(link);
 const decisions=convergenceSummary(report),overview=node('div',undefined,'qe-convergence-summary');
 overview.append(node('h4','Karar özeti'),node('p',Object.entries(ROLES).filter(([role])=>decisions.counts[role].total)
  .map(([role,name])=>name+': '+decisions.counts[role].passed+'/'+decisions.counts[role].total+' geçti').join(' · ')));
 const verdicts=table(['Karşılaştırma','Eksen','Rol','Sonuç','Eşiğe en yakın ölçüt'],decisions.rows.map(r=>[r.from+' → '+r.to,AXES[r.axis]||r.axis,ROLES[r.role],
  r.passed?'Geçti':r.failed+'/'+r.checks+' ölçüt kaldı',
  r.critical?label(r.critical.quantity)+' · '+number(r.critical.value)+' / '+number(r.critical.limit)+' ('+Math.round(r.critical.ratio*100)+'%)':'—']),
  decisions.rows.map(r=>r.passed?'passed':'failed'));
 overview.append(verdicts);
 if(decisions.rows.some(r=>!r.passed&&r.role!=='decision'))overview.append(node('p','Yardımcı veya tutarlılık çiftlerindeki aşımlar sonlu kabul kararını değiştirmez, ancak ilgili eksende dikkat gerektirir.','note'));
 host.append(overview);
 host.append(table(['Vaka','Bant','NSCF örgüsü','σ (Ry)','VBM (eV)','CBM (eV)','Aralık (eV)','Durum'],
  [...data.cases].map(([id,c])=>{const result=report.cases[id]?.sampled_nscf;return [id,c.nbnd,c.nscf_k+'×'+c.nscf_k,c.degauss_ry,
   number(result?.vbm_ev),number(result?.cbm_ev),number(result?.gap_ev),result?'Raporlandı':'Eksik / başarısız'];})));
 for(const [id,error] of Object.entries(report.errors)){
  const message=/No such file|not found/i.test(String(error))?'Ham kanıt eksik.':String(error).slice(0,300);
  host.append(node('p',id+': '+message,'note'));
 }
 const rows=[];
 for(const p of report.pairs){
  const role=p.sensitivity_only?'Genişlik: tutarlılık':p.gated?'Karar':'Yardımcı';
  for(const g of p.checks)rows.push([p.from+' → '+p.to,role,label(g.quantity),number(g.value),number(g.limit),g.passed?'Geçti':'Kaldı']);
  if(p.sensitivity_only)for(const [quantity,value] of [['DOS',p.dos_relative_l1],['Mo-d',p.pdos_relative_l1['Mo-d']],['S-p',p.pdos_relative_l1['S-p']]])
   rows.push([p.from+' → '+p.to,'Duyarlılık',quantity+' bağıl L1',number(value),'—','Karar verilmez']);
 }
 const all=node('details',undefined,'qe-convergence-all');
 all.append(node('summary','Tüm ölçütler ('+rows.length+' satır)'),table(['Karşılaştırma','Tür','Ölçüt','Değer','Eşik','Sonuç'],rows));
 host.append(all);
 const pairs=node('select');pairs.setAttribute('aria-label','Eğri karşılaştırma çifti');
 const available=[...plan.decision_pairs,...plan.diagnostic_pairs].filter(p=>data.curves.some(c=>c.id===p.from)&&data.curves.some(c=>c.id===p.to));
 if(!available.length){const o=node('option','Karşılaştırma için ikinci vaka bekleniyor');o.value='';pairs.append(o);}
 for(const [i,p] of available.entries()){const o=node('option',p.from+' → '+p.to);o.value=String(i);pairs.append(o);}
 const group=node('select');group.setAttribute('aria-label','DOS veya orbital katkısı');
 for(const [id,name] of [['dos','Toplam DOS'],['mo_d','Mo-d (hücre toplamı)'],['s_p','S-p (iki S toplamı)']]){const o=node('option',name);o.value=id;group.append(o);}
 const plot=node('div'),legend=node('p');
 const update=()=>{
  const p=available[Number(pairs.value)||0],ids=p?[p.from,p.to]:data.curves.slice(0,1).map(c=>c.id),key=group.value||'dos';
  const curves=ids.map(id=>data.curves.find(c=>c.id===id));
  plot.replaceChildren(...(curves.length?[chart('D4.1 '+key+' karşılaştırması','Ham QE enerjisi (eV)','Durum/(eV hücre)',curves.map(c=>({x:c.energy_ev,y:c[key]})))]:[]));
  legend.textContent=ids.map((id,i)=>(i?'Turuncu: ':'Mavi: ')+id).join(' · ')+'. Enerji kaydırması, interpolasyon ve yeniden ölçekleme yok.';
 };
 pairs.disabled=!available.length;pairs.addEventListener('change',update);group.addEventListener('change',update);
 host.append(pairs,group,plot,legend);update();
 const download=node('button','Karşılaştırma tablosunu CSV indir');download.type='button';download.disabled=!report.pairs.length;
 download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([convergenceCsv(data)],{type:'text/csv;charset=utf-8'}));
  const a=node('a');a.href=url;a.download='qe-convergence.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);});host.append(download);
 const details=node('details'),summary=node('summary','Ham kanıt ve dosya özetleri');details.append(summary);
 details.append(node('p','Plan SHA-256: '+data.proof.plan_sha256),node('p','Karşılaştırma SHA-256: '+data.proof.comparison_sha256));
 for(const e of data.evidence)details.append(node('p',e.id+' · '+e.path+' · result SHA-256: '+e.result_sha256+' · NSCF stdout SHA-256: '+e.nscf_stdout_sha256));
 host.append(details,node('p','VBM/CBM örneklenmiş PBE bant kenarlarıdır. Genişlik taraması optik veya sıfır genişlik yakınsaması vermez.'));
}
