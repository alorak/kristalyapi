import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {createTrubaPackage} from '../qe-hpc-export.js';
import {parseTrubaSummary,renderTrubaSummary,compareTrubaInputDigest} from '../qe-truba-summary-view.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const sha=data=>createHash('sha256').update(data).digest('hex');
const input="&CONTROL\n calculation = 'scf',\n pseudo_dir = './pseudo',\n outdir = './tmp',\n/\nATOMIC_SPECIES\nSi 28.0855 Si.UPF\nCELL_PARAMETERS angstrom\n";
function verifiedFixture(){
 return {
  schema:'kristalyapi.truba-qe-summary.v1',
  source:'offline-truba-collector',
  calculation:'scf',status:'completed',scientific_convergence_verified:false,
  execution:{job_id:'12345',slurm_exit_code:0,submitted_by_collector:false,slurm_ntasks:'56'},
  integrity:{input_sha256_expected:sha(input),input_sha256_actual:sha(input),input_matches:true,
   all_required_upfs_present:true,all_pinned_upfs_match:true,all_upfs_pinned:true,
   slurm_script_matches:true,
   pseudopotentials:[{element:'Si',file:'Si.UPF',sha256_expected:sha('upf'),
    sha256_actual:sha('upf'),present:true,matches_pinned_hash:true}]},
  qe:{job_done:true,scf_converged:true,geometry_converged:null,energy_ry:-13.1256,
   energy_ev:-178.577,energy_observation_count:1,energy_tail_ry:[-13.1256],
   total_force_ry_bohr:0.0002,max_force_component_ry_bohr:0.0001,output_bytes:1234},
  output_sha256:sha('output'),output_error:null
 };
}
test('current QE source SHA-256 comparison distinguishes exact match from other input',async()=>{
 const expected=sha(input);
 const matched=await compareTrubaInputDigest(input,expected);
 assert.equal(matched.matches,true);
 assert.equal(matched.actual_sha256,expected);
 const changed=await compareTrubaInputDigest(input+'changed',expected);
 assert.equal(changed.matches,false);
 assert.notEqual(changed.actual_sha256,expected);
 await assert.rejects(compareTrubaInputDigest(input,'invalid'),/Invalid TRUBA/);
});
test('strict offline summary schema validates complete provenance',()=>{
 const s=verifiedFixture();
 assert.equal(parseTrubaSummary(s),s);
 const copy=structuredClone(s);copy.status='invalid';assert.equal(parseTrubaSummary(copy).status,'invalid');
});
test('reject fabricated scientific verification and contradictory success',()=>{
 const s=verifiedFixture();
 s.scientific_convergence_verified=true;
 assert.throws(()=>parseTrubaSummary(s),/scientific limitation/);
 s.scientific_convergence_verified=false;
 s.integrity.input_matches=false;
 assert.throws(()=>parseTrubaSummary(s),/Contradictory/);
});
test('reject untrusted paths, hashes, nonfinite energy and invalid format',()=>{
 const s=verifiedFixture();
 s.integrity.pseudopotentials[0].file='../escape.UPF';
 assert.throws(()=>parseTrubaSummary(s),/UPF provenance/);
 s.integrity.pseudopotentials[0].file='Si.UPF';
 s.qe.energy_ry=Infinity;
 assert.throws(()=>parseTrubaSummary(s),/numeric/);
 s.qe.energy_ry=-13.1256;
 s.output_sha256='forged';
 assert.throws(()=>parseTrubaSummary(s),/SHA-256/);
});
test('summary rendering uses textContent and does not mutate active crystal',()=>{
 const s=verifiedFixture();s.status='invalid';
 s.execution.job_id=null;
 let elements=[];
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.className='';elements.push(this);}
  append(...args){this.children.push(...args);}
  replaceChildren(...args){this.children=[...args];}
 }
 const old=globalThis.document;
 try{
  globalThis.document={createElement:tag=>new Element(tag)};
  const host=new Element('section');
  renderTrubaSummary(host,s);
  assert.ok(host.children.length>=4);
  assert.equal(elements.some(e=>e.tag==='script'),false);
  assert.ok(elements.some(e=>e.textContent.includes('bilimsel yakınsamayı kanıtlamaz')));
 }finally{globalThis.document=old;}
});
test('P1 export embeds Python collector and pins script hash',async()=>{
 const script=readFileSync(new URL('../tools/qe_hpc_collect.py',import.meta.url),'utf8');
 const pkg=await createTrubaPackage({inputText:input,account:'research',collectorScript:script});
 const blob=new Uint8Array(await pkg.blob.arrayBuffer()),dv=new DataView(blob.buffer);
 const decoder=new TextDecoder();let offset=0,contents=new Map();
 while(offset+4<blob.length&&dv.getUint32(offset,true)===0x04034b50){
  const nameLength=dv.getUint16(offset+26,true),length=dv.getUint32(offset+18,true);
  const name=decoder.decode(blob.slice(offset+30,offset+30+nameLength));
  const value=blob.slice(offset+30+nameLength,offset+30+nameLength+length);
  contents.set(name,decoder.decode(value));
  offset+=30+nameLength+length;
 }
 assert.ok(contents.has('collect.py'));
 assert.equal(contents.get('collect.py'),script);
 assert.equal(pkg.manifest.collector_included,true);
 assert.equal(pkg.manifest.run_slurm_sha256,sha(contents.get('run.slurm')));
 assert.match(contents.get('run.slurm'),/trap 'status=\$\?/);
 assert.match(contents.get('run.slurm'),/python3 collect\.py --bundle \. --exit-code/);
});
test('DFT HTML and offline PWA stage summary module and collector',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const id of ['qeHpcSummaryFile','qeHpcSummaryOpen','qeHpcSummaryStatus','qeHpcSummaryView'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/qeOpenTrubaSummary/);
 assert.match(app,/qeMatchCurrentInput/);
 assert.match(app,/compareTrubaInputDigest/);
 assert.match(sw,/qe-truba-summary-view\.js/);
 assert.match(sw,/qe_hpc_collect\.py/);
});
