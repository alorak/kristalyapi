import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../qe-api-client.js',import.meta.url),'utf8');
const {normalizeQeApiUrl,inspectQeApi}=await import(
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
