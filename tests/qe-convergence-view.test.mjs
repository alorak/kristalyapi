/* SYNTHETIC comparisons for schema/UI regression, not electronic results. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const electronic=uri(readFileSync(new URL('../qe-electronic-view.js',import.meta.url),'utf8'));
const source=readFileSync(new URL('../qe-convergence-view.js',import.meta.url),'utf8').replace("'./qe-electronic-view.js'",JSON.stringify(electronic));
const {parseConvergenceView,verifyConvergenceFileHashes,renderConvergenceView,convergenceCsv,convergenceSummary}=await import(uri(source));
const digest=s=>createHash('sha256').update(s).digest('hex');
const plan=JSON.parse(readFileSync(new URL('fixtures/qe/mos2-electronic-convergence.json',import.meta.url)));
function fixture(){
 const cases={},curves=[],evidence=[];
 for(const [i,id] of ['reference-d4',...plan.cases.map(c=>c.id)].entries()){
  cases[id]={job_id:(i+1).toString(16).padStart(32,'0'),sampled_nscf:{vbm_ev:0,cbm_ev:1,gap_ev:1}};
  const size=id==='reference-d4'?701:1401,step=id==='reference-d4'?.02:.01;
  const y=Array(size).fill(1);
  curves.push({id,energy_ev:Array.from({length:size},(_,j)=>Number((-8+j*step).toFixed(5))),dos:y,mo_d:y,s_p:y});
  evidence.push({id,path:'cases/'+id,result_sha256:'a'.repeat(64),nscf_stdout_sha256:'b'.repeat(64)});
 }
 const pairs=[...plan.decision_pairs,...plan.diagnostic_pairs].map(p=>{
  const width=p.axis==='dos_width';
  const quantities=width?['underlying_nscf_spectrum_integrity_ev','unchanged_explicit_path_integrity_ev']:
   ['common_lowest_path_bands_ev','sampled_nscf_vbm_ev','sampled_nscf_cbm_ev','sampled_nscf_gap_ev','dos_relative_l1','Mo-d_relative_l1','S-p_relative_l1'];
  return {...p,sensitivity_only:width,dos_relative_l1:0,pdos_relative_l1:{'Mo-d':0,'S-p':0},
   checks:quantities.map(quantity=>({quantity,value:0,limit:quantity.includes('relative_l1')?.05:.01,passed:true})),
   convergence_passed:width?null:true,integrity_passed:true};
 });
 const report={schema:'kristalyapi.qe-electronic-convergence.v1',scope:'SYNTHETIC TEST DATA',status:'passed',
  broadening_converged:null,reference:plan.reference,source_commit:'a'.repeat(40),cases,errors:{},pairs};
 const raw={schema:'kristalyapi.qe-electronic-convergence-view.v1',plan_json:JSON.stringify(plan),comparison_json:JSON.stringify(report),
  spectra_json:JSON.stringify({curves,evidence}),proof:{raw_report_recomputed:true}};
 for(const [field,name] of [['plan_json','plan_sha256'],['comparison_json','comparison_sha256'],['spectra_json','spectra_sha256']])raw.proof[name]=digest(raw[field]);
 return raw;
}
function edit(raw,field,change){const x=JSON.parse(raw[field]);change(x);raw[field]=JSON.stringify(x);return raw;}
test('complete synthetic cohort validates without claiming broadening convergence',async()=>{
 const parsed=parseConvergenceView(fixture());assert.equal(parsed.fileHashesVerified,false);
 await verifyConvergenceFileHashes(parsed,webcrypto.subtle);
 assert.equal(parsed.fileHashesVerified,true);assert.equal(parsed.report.broadening_converged,null);
 assert.equal(parsed.curves.length,7);
});
test('tampered report or spectrum fails the imported file checksum',async()=>{
 for(const field of ['comparison_json','spectra_json']){
  const raw=fixture();raw[field]+=' ';
  await assert.rejects(verifyConvergenceFileHashes(parseConvergenceView(raw),webcrypto.subtle),/hash/);
 }
});
test('partial evidence cannot retain a passed overall status',()=>{
 const raw=edit(fixture(),'comparison_json',r=>delete r.cases[plan.cases[0].id]);
 assert.throws(()=>parseConvergenceView(raw),/eksik|Eksik/);
});
test('forged thresholds, missing checks and false passed flags are rejected',()=>{
 for(const change of [r=>r.pairs[0].checks[0].limit=1,r=>r.pairs[0].checks.pop(),
  r=>r.pairs[0].checks[0].value=.1,r=>r.pairs[0].convergence_passed=false,
  r=>r.pairs[2].convergence_passed=true,r=>r.broadening_converged=true]){
  assert.throws(()=>parseConvergenceView(edit(fixture(),'comparison_json',change)),/geçersiz|değişmiş|Eksik|kararı|kabulü|uyuşmuyor/);
 }
});
test('duplicate orbital cases, nonfinite curves and grid shifts are rejected',()=>{
 for(const change of [s=>s.curves.push(s.curves[0]),s=>s.curves[0].mo_d[0]=-1,
  s=>s.curves[0].dos[0]=null,s=>s.curves[0].energy_ev[1]+=.005,
  s=>s.evidence[0].path='../escape']){
  assert.throws(()=>parseConvergenceView(edit(fixture(),'spectra_json',change)),/geçersiz/);
 }
});
test('CSV preserves diagnostic vs decision and width integrity roles',()=>{
 const csv=convergenceCsv(parseConvergenceView(fixture()));
 assert.match(csv,/"decision"/);assert.match(csv,/"diagnostic"/);assert.match(csv,/"integrity"/);
 assert.doesNotMatch(csv,/NaN|undefined/);
});
test('renderer requires file hashes, exposes both selectors and keeps width sensitivity visible',async()=>{
 const old=globalThis.document;
 class N{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};this.listeners={};this.value='';this.textContent='';}
  append(...c){this.children.push(...c);if(this.tag==='select'&&!this.value)this.value=this.children[0]?.value;}
  replaceChildren(...c){this.children=c;}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){this.listeners[k]=v;}
 }
 globalThis.document={createElement:t=>new N(t),createElementNS:(ns,t)=>new N(t)};
 try{
  const host=new N('div'),parsed=parseConvergenceView(fixture());
  assert.throws(()=>renderConvergenceView(host,parsed),/hash/);
  await verifyConvergenceFileHashes(parsed,webcrypto.subtle);renderConvergenceView(host,parsed);
  const selects=host.children.filter(n=>n.tag==='select');assert.equal(selects.length,2);
  assert.equal(selects[0].children.length,6);assert.equal(selects[1].children.length,3);
  const text=n=>n.textContent+' '+n.children.map(text).join(' ');
  assert.match(text(host),/yalnız duyarlılık/);assert.match(text(host),/Karar verilmez/);
  assert.match(text(host),/yeniden doğrulanması dış araçta/);
  selects[1].value='s_p';selects[1].listeners.change();
  assert.ok(host.children.some(n=>n.tag==='div'&&n.children.some(c=>c.tag==='svg')));
 }finally{globalThis.document=old;}
});

test('decision summary surfaces each pair verdict and its tightest check on the real D4.1 report',()=>{
 const view=JSON.parse(readFileSync(new URL('../validation-results/qe-mos2-d41-20261030-amd64/convergence-view.json',import.meta.url),'utf8'));
 const report=JSON.parse(view.comparison_json);
 const {rows,counts}=convergenceSummary(report);
 assert.deepEqual(counts,{decision:{total:2,passed:2},diagnostic:{total:2,passed:1},integrity:{total:2,passed:2}});
 const failed=rows.find(r=>!r.passed);
 assert.deepEqual([failed.from,failed.to,failed.role,failed.axis],['nbnd40-k16-s010','nbnd40-k18-s010','diagnostic','nscf_k']);
 assert.ok(failed.critical.ratio>1,'the failing diagnostic check is reported as past its limit');
 for(const r of rows.filter(r=>r.passed&&r.critical))assert.ok(r.critical.ratio<=1);
});
