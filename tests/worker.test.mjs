import test from 'node:test';
import assert from 'node:assert/strict';
import {upstreamUrl,handleRequest} from '../worker/src/index.mjs';
const ORIGIN='https://alorak.github.io';
const ENV={CORS_ORIGINS:ORIGIN};
const req=(path,options={})=>new Request('https://kristalyapi-cod-api.example.workers.dev'+path,{
  headers:{Origin:ORIGIN,...options.headers},method:options.method||'GET'
});
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers});

test('only approved COD upstream routes and constrained search parameters are routed',()=>{
 assert.equal(upstreamUrl('/api/cif/4335507','').url,
  'https://www.crystallography.net/cod/4335507.cif');
 assert.equal(upstreamUrl('/api/structures/4335507','').url,
  'https://www.crystallography.net/cod/optimade/v1/structures/4335507');
 assert.equal(upstreamUrl('/api/search','id=4335507').url,
  'https://www.crystallography.net/cod/result.php?id=4335507&format=json');
 const u=upstreamUrl('/api/structures','filter=elements+HAS+ALL+%22Si%22%2C%22O%22&page_limit=100');
 assert.match(u.url,/page_limit=100/);
 for (const [path,query] of [
  ['/api/cif/../../../api/search',''],
  ['/api/cif/garbage',''],
  ['/api/cif/4335507','url=https://example.com'],
  ['/api/structures/4335507','filter=id'],
  ['/api/search','url=https://example.com'],
  ['/api/search','format=xml&id=4335507'],
  ['/api/search',''],
  ['/api/structures','page_limit=999&filter=id%3D%22test%22'],
  ['/api/structures','filter=']
 ]) assert.throws(()=>upstreamUrl(path,query),path+'?'+query);
});
test('health endpoint responds to an allowlisted GitHub Pages origin',async()=>{
 const r=await handleRequest(req('/health'),ENV,()=>{throw Error('no upstream expected');});
 assert.equal(r.status,200);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal((await r.json()).status,'ok');
});
test('cross-origin requests from unapproved origins are rejected',async()=>{
 const r=await handleRequest(req('/api/cif/4335507',{headers:{Origin:'https://attacker.example'}}),ENV,
  ()=>{throw Error('unauthorized fetch');});
 assert.equal(r.status,403);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});
test('OPTIONS is safe and POST cannot proxy to COD',async()=>{
 const options=await handleRequest(req('/api/cif/4335507',{method:'OPTIONS'}),ENV);
 assert.equal(options.status,204);
 assert.equal(options.headers.get('Access-Control-Allow-Methods'),'GET, OPTIONS');
 const post=await handleRequest(req('/api/cif/4335507',{method:'POST'}),ENV);
 assert.equal(post.status,405);
});
test('CIF responses are fetched server-side, bounded and relayed with CORS',async()=>{
 const cif='data_example\n_cell_length_a 5\n';
 let fetched=null;
 const r=await handleRequest(req('/api/cif/4335507'),ENV,async(url,options)=>{
  fetched={url,options};
  return new Response(cif,{status:200,headers:{'content-type':'text/plain'}});
 });
 assert.equal(fetched.url,'https://www.crystallography.net/cod/4335507.cif');
 assert.equal(fetched.options.redirect,'manual');
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/chemical\/x-cif/);
 assert.equal(await r.text(),cif);
});
test('safe search preserves validated filters and forces JSON',async()=>{
 let path='';
 const r=await handleRequest(req('/api/search?el1=Si&strictmin=1'),ENV,async(url)=>{
  path=url;return json([{file:'4335507',formula:'Si'}]);
 });
 assert.match(path,/el1=Si/);
 assert.match(path,/format=json/);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal((await r.json())[0].file,'4335507');
});
test('cross-host redirects and errors cannot be relayed as successful data',async()=>{
 const redirect=await handleRequest(req('/api/cif/4335507'),ENV,async()=>new Response(null,{
  status:302,headers:{location:'https://evil.example/'} }));
 assert.equal(redirect.status,502);
 assert.equal(redirect.headers.get('location'),null);
 const error=await handleRequest(req('/api/cif/4335507'),ENV,async()=>{throw Error('secret backend error');});
 assert.equal(error.status,502);
 assert.doesNotMatch(await error.text(),/secret backend error/);
});
test('upstream response larger than 4 MB is rejected even without Content-Length',async()=>{
 const tooLarge=new Uint8Array(4_000_001);
 const response=await handleRequest(req('/api/cif/4335507'),ENV,async()=>new Response(tooLarge));
 assert.equal(response.status,413);
 const announced=await handleRequest(req('/api/cif/4335507'),ENV,async()=>new Response('ok',{
  headers:{'Content-Length':'5000000'}
 }));
 assert.equal(announced.status,413);
});
test('server-to-server requests without Origin work but do not get wildcard CORS',async()=>{
 const reqNoOrigin=new Request('https://kristalyapi-cod-api.example.workers.dev/health');
 const r=await handleRequest(reqNoOrigin,ENV);
 assert.equal(r.status,200);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});

// Upstream retry policy: COD intermittently returns 52x on a cold request
// (seen live for COD 1502689) and succeeds on an immediate retry.
const fastRetry={upstream:{sleep:async()=>{},delays:[0,0]}};
const noCache={cache:null,...fastRetry};
test('transient COD 52x answers and connection failures are retried before failing',async()=>{
 const cif='data_1502689\n_cell_length_a 4.0339\n';
 let calls=0;
 const r=await handleRequest(req('/api/cif/1502689'),ENV,async()=>{
  calls++;
  if(calls===1)return new Response('origin down',{status:521});
  if(calls===2)throw Error('connection reset');
  return new Response(cif);
 },noCache);
 assert.equal(calls,3);
 assert.equal(r.status,200);
 assert.equal(await r.text(),cif);
 let attempts=0;
 const down=await handleRequest(req('/api/cif/1502689'),ENV,async()=>{attempts++;return new Response('',{status:525});},noCache);
 assert.equal(attempts,3,'retries are bounded');
 assert.equal(down.status,502);
 assert.equal((await down.json()).error,'COD upstream returned 525');
});
test('non-transient upstream answers are not retried',async()=>{
 for(const status of [302,403,404]){
  let calls=0;
  const r=await handleRequest(req('/api/cif/4335507'),ENV,async()=>{calls++;return new Response(null,{status,headers:{location:'https://evil.example/'}});},noCache);
  assert.equal(calls,1,'status '+status);
  assert.equal(r.status,502);
  assert.equal(r.headers.get('location'),null);
 }
 let calls=0;
 const big=await handleRequest(req('/api/cif/4335507'),ENV,async()=>{calls++;return new Response(new Uint8Array(4_000_001));},noCache);
 assert.equal(calls,1);
 assert.equal(big.status,413);
});
test('retries stop at the shared wall-clock budget',async()=>{
 let t=0,calls=0;
 const r=await handleRequest(req('/api/cif/4335507'),ENV,async()=>{calls++;t+=15_000;return new Response('',{status:524});},
  {cache:null,upstream:{now:()=>t,sleep:async ms=>{t+=ms;},delays:[400,1200]}});
 assert.equal(calls,2,'a third attempt would exceed the 20 s budget');
 assert.equal(r.status,502);
});
test('successful upstream bodies are served from the edge cache without stored CORS grants',async()=>{
 const store=new Map();
 const cache={
  async match(key){const v=store.get(key.url);return v?v.clone():undefined;},
  async put(key,response){store.set(key.url,response);}
 };
 let calls=0;
 const upstream=async()=>{calls++;return new Response('data_1502689\n');};
 const first=await handleRequest(req('/api/cif/1502689'),ENV,upstream,{cache,...fastRetry});
 assert.equal(first.headers.get('X-Kristalyapi-Cache'),'MISS');
 assert.equal(await first.text(),'data_1502689\n');
 const stored=store.get('https://www.crystallography.net/cod/1502689.cif');
 assert.ok(stored,'cache is keyed by the fixed COD URL');
 assert.equal(stored.headers.get('Access-Control-Allow-Origin'),null);
 const second=await handleRequest(req('/api/cif/1502689'),ENV,()=>{throw Error('cache hit expected');},{cache,...fastRetry});
 assert.equal(calls,1);
 assert.equal(second.status,200);
 assert.equal(second.headers.get('X-Kristalyapi-Cache'),'HIT');
 assert.equal(second.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.match(second.headers.get('content-type'),/chemical\/x-cif/);
 assert.equal(second.headers.get('Cache-Control'),'public, max-age=2592000','CIF bodies are cached for 30 days');
 assert.equal(stored.headers.get('Cache-Control'),'public, max-age=2592000');
 assert.equal(await second.text(),'data_1502689\n');
 let failed=0;
 await handleRequest(req('/api/cif/1502690'),ENV,async()=>{failed++;return new Response('',{status:404});},{cache,...fastRetry});
 assert.equal(store.has('https://www.crystallography.net/cod/1502690.cif'),false,'errors are never cached');
});
test('upstream requests identify the gateway',async()=>{
 let headers=null;
 await handleRequest(req('/api/cif/4335507'),ENV,async(url,options)=>{headers=options.headers;return new Response('data_x\n');},noCache);
 assert.match(headers['User-Agent'],/kristalyapi-cod-worker/);
});
