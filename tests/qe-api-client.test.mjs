import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../qe-api-client.js',import.meta.url),'utf8');
const {normalizeQeApiUrl,inspectQeApi,validateQeScf,submitQeScf,getQeScfJob,getQeScfResult,cancelQeScfJob,listQeScfJobs}=await import(
 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
);

test('accept only explicit local HTTP or HTTPS origins',()=>{
 assert.equal(normalizeQeApiUrl('http://192.168.1.50:8000/'),'http://192.168.1.50:8000');
 assert.equal(normalizeQeApiUrl('http://127.0.0.1:8000'),'http://127.0.0.1:8000');
 assert.equal(normalizeQeApiUrl('http://172.20.0.5:8000'),'http://172.20.0.5:8000');
 assert.equal(normalizeQeApiUrl('https://qe.my-domain.example'),'https://qe.my-domain.example');
 for(const x of ['192.168.1.50:8000','ftp://localhost:8000',
  'http://public.example:8000','http://192.168.1.50:8000/private',
  'http://user:pass@127.0.0.1:8000','http://127.0.0.1:8000/?token=secret']){
  assert.throws(()=>normalizeQeApiUrl(x));
 }
});

function response(status,json){
 return {status,ok:status>=200&&status<300,headers:{get:()=>'application/json'},json:async()=>json};
}
const caps={api_version:'0.1.0',engine:{id:'quantum-espresso',version:'6.7',available:true},
 binaries:{'pw.x':true,'bands.x':true,'dos.x':true,'projwfc.x':true},
 job_submission_enabled:false};
test('only two GET requests, without cookies or mutation',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  return url.endsWith('/api/health')
   ?response(200,{api_version:'0.1.0',engine:'quantum-espresso',status:'ready',read_only:true})
   :response(200,caps);
 };
 const result=await inspectQeApi('http://192.168.1.50:8000',{fetcher});
 assert.equal(result.ready,true);
 assert.equal(result.version,'6.7');
 assert.equal(calls.length,2);
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/health','/api/capabilities']);
 for(const call of calls){
  assert.equal(call.opts.method,'GET');
  assert.equal(call.opts.credentials,'omit');
  assert.equal(call.opts.cache,'no-store');
 }
});
test('degraded solver is not represented as available',async()=>{
 const fetcher=async(url)=>url.endsWith('/api/health')
  ?response(503,{status:'degraded',api_version:'0.1.0',engine:'quantum-espresso',read_only:true})
  :response(200,{...caps,engine:{...caps.engine,available:false,version:null}});
 const actual=await inspectQeApi('http://127.0.0.1:8000',{fetcher});
 assert.equal(actual.ready,false);
});
test('reject spoofed capabilities or server with job submission',async()=>{
 const fetcher=async(url)=>url.endsWith('/api/health')
  ?response(200,{status:'ready',api_version:'0.1.0',engine:'quantum-espresso',read_only:true})
  :response(200,{...caps,job_submission_enabled:true});
 await assert.rejects(inspectQeApi('http://127.0.0.1:8000',{fetcher}),/salt-okunur/);
});
test('reject mixed API versions and non-JSON responses',async()=>{
 const fetcher=async(url)=>url.endsWith('/api/health')
  ?response(200,{status:'ready',api_version:'0.0.0',engine:'quantum-espresso',read_only:true})
  :response(200,caps);
 await assert.rejects(inspectQeApi('http://127.0.0.1:8000',{fetcher}),/sözleşmesine/);
});


const secret='x'.repeat(48);
const model={schema:'kristalyapi.qe-scf-job.v1',profile_id:'si-pbe',
 structure:{periodic:true,cell_angstrom:[[5,0,0],[0,5,0],[0,0,5]],
 atoms:[{element:'Si',fractional:[0,0,0]}]},
 parameters:{calculation:'scf',functional:'PBE',spin:'unpolarized',ecutwfc_ry:45,
 ecutrho_ry:360,kpoints:[2,2,2]}};
test('D2 only sends structured SCF data with explicit Bearer token over loopback',async()=>{
 const hits=[];
 const fetcher=async(url,options)=>{
  hits.push({url,options});
  return response(url.endsWith('/validate')?200:202,
    {valid:true,job_id:'a'.repeat(32),status:'queued',structure_hash:'b'.repeat(64)});
 };
 const pre=await validateQeScf('http://localhost:8000',secret,model,{fetcher});
 assert.equal(pre.valid,true);
 const created=await submitQeScf('http://localhost:8000',secret,model,{fetcher});
 assert.equal(created.job_id,'a'.repeat(32));
 assert.equal(hits.length,2);
 for(const {options} of hits){
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,'Bearer '+secret);
  assert.equal(options.credentials,'omit');
  assert.deepEqual(JSON.parse(options.body),model);
 }
});
test('D2 never sends a token over HTTP LAN IP or to invalid host',async()=>{
 let invoked=false;
 const fetcher=async()=>{invoked=true;return response(200,{});};
 await assert.rejects(submitQeScf('http://192.168.1.50:8000',secret,model,{fetcher}),/HTTPS/);
 await assert.rejects(submitQeScf('http://localhost:8000','weak',model,{fetcher}),/32/);
 assert.equal(invoked,false);
});
test('D2 result/status/cancel require canonical job ID and reject API error',async()=>{
 const jobId='f'.repeat(32),calls=[];
 const fetcher=async(url,options)=>{
  calls.push([url,options.method]);
  return response(200,{status:'completed',energy_ev:-1,job_id:jobId});
 };
 const job=await getQeScfJob('http://127.0.0.1:8000',secret,jobId,{fetcher});
 assert.equal(job.status,'completed');
 const result=await getQeScfResult('http://127.0.0.1:8000',secret,jobId,{fetcher});
 assert.equal(result.energy_ev,-1);
 await cancelQeScfJob('http://127.0.0.1:8000',secret,jobId,{fetcher});
 assert.deepEqual(calls.map(x=>x[1]),['GET','GET','POST']);
 await assert.rejects(getQeScfJob('http://127.0.0.1:8000',secret,'../invalid',{fetcher}),/iş numarası/);
});
test('D2 capabilities advertise jobs only when explicitly enabled',async()=>{
 const fetcher=async(url)=>url.endsWith('/api/health')
  ?response(200,{status:'ready',api_version:'0.2.0',engine:'quantum-espresso',read_only:false})
  :response(200,{...caps,api_version:'0.2.0',job_submission_enabled:true});
 const actual=await inspectQeApi('http://localhost:8000',{fetcher});
 assert.equal(actual.jobsEnabled,true);
});

test('D2 persisted job history is queried only with the explicit in-memory token',async()=>{
 const fake=async(url,opts)=>{
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers.Authorization,'Bearer '+secret);
  assert.match(url,/\/api\/v1\/calculations$/);
  return response(200,{jobs:[{job_id:'a'.repeat(32),status:'completed'}]});
 };
 const data=await listQeScfJobs('http://localhost:8000',secret,{fetcher:fake});
 assert.equal(data.jobs.length,1);
});
