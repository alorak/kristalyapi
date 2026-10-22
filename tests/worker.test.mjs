import test from 'node:test';
import assert from 'node:assert/strict';
import {upstreamUrl,handleRequest,validBody,COD_UPSTREAMS} from '../worker/src/index.mjs';
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

// Upstream policy: COD intermittently answers 52x/500, and while the primary
// server was down its mirrors each served only part of the API (live,
// 2026-10-22: qiserver.ugr.es had CIF + search but OPTIMADE 500; cod.ibt.lt
// had CIF + OPTIMADE but served result.php as raw PHP source with HTTP 200).
const PRIMARY='https://www.crystallography.net/cod';
const QI='https://qiserver.ugr.es/cod';
const IBT='https://cod.ibt.lt/cod';
const fastRetry={upstream:{sleep:async()=>{},delays:[0]}};
const noCache={cache:null,...fastRetry};
const CIF_1502689='data_1502689\n_cell_length_a 4.0339\n';
const byHost=answers=>{
 const calls=[];
 const fetcher=async url=>{
  calls.push(url);
  const base=[PRIMARY,QI,IBT].find(b=>url.startsWith(b+'/'));
  const answer=answers[base];
  if(typeof answer==='function')return answer(url,calls.filter(u=>u.startsWith(base)).length);
  if(answer instanceof Error)throw answer;
  return answer.clone();
 };
 return {fetcher,calls};
};
test('mirrors share the fixed /cod layout and the primary URL stays canonical',()=>{
 assert.deepEqual(COD_UPSTREAMS,[PRIMARY,QI,IBT]);
 const spec=upstreamUrl('/api/cif/1502689','');
 assert.equal(spec.path,'/1502689.cif');
 assert.equal(spec.url,PRIMARY+'/1502689.cif');
 assert.equal(upstreamUrl('/api/search','id=1502689').path,'/result.php?id=1502689&format=json');
});
test('a CIF is served from the first mirror when the primary COD server answers 500',async()=>{
 const {fetcher,calls}=byHost({
  [PRIMARY]:new Response('<!DOCTYPE HTML><title>500 Internal Server Error</title>',{status:500}),
  [QI]:new Response(CIF_1502689),
  [IBT]:new Response('unexpected')
 });
 const r=await handleRequest(req('/api/cif/1502689'),ENV,fetcher,noCache);
 assert.equal(r.status,200);
 assert.equal(await r.text(),CIF_1502689);
 assert.equal(r.headers.get('X-Kristalyapi-Source'),'qiserver.ugr.es');
 assert.deepEqual(calls,[PRIMARY+'/1502689.cif',QI+'/1502689.cif']);
});
test('200 answers that are not the requested format fall through to the next mirror',async()=>{
 const json=[{file:'1502689',formula:'Al'}];
 const search=byHost({
  [PRIMARY]:new Response('',{status:500}),
  [QI]:new Response("<?php include dirname(__FILE__) . 'bootstrap.php';"),
  [IBT]:json&&new Response(JSON.stringify(json))
 });
 const r=await handleRequest(req('/api/search?id=1502689'),ENV,search.fetcher,noCache);
 assert.equal(r.status,200);
 assert.equal((await r.json())[0].file,'1502689');
 assert.equal(r.headers.get('X-Kristalyapi-Source'),'cod.ibt.lt');
 assert.equal(search.calls.length,3,'the PHP-source mirror is not retried');
 const htmlCif=byHost({
  [PRIMARY]:new Response('<html><body>maintenance</body></html>'),
  [QI]:new Response('{"not":"a cif"}'),
  [IBT]:new Response(CIF_1502689)
 });
 const c=await handleRequest(req('/api/cif/1502689'),ENV,htmlCif.fetcher,noCache);
 assert.equal(c.status,200);
 assert.equal(await c.text(),CIF_1502689);
});
test('transient failures are retried in a second round; definitive ones are not',async()=>{
 const {fetcher,calls}=byHost({
  [PRIMARY]:(url,n)=>n===1?new Response('',{status:521}):new Response(CIF_1502689),
  [QI]:new Response('',{status:404}),
  [IBT]:()=>{throw Error('connection reset');}
 });
 const r=await handleRequest(req('/api/cif/1502689'),ENV,fetcher,noCache);
 assert.equal(r.status,200);
 assert.equal(r.headers.get('X-Kristalyapi-Source'),'www.crystallography.net');
 assert.deepEqual(calls,[PRIMARY+'/1502689.cif',QI+'/1502689.cif',IBT+'/1502689.cif',PRIMARY+'/1502689.cif']);
});
test('when every server fails the error names each host without leaking upstream text',async()=>{
 const {fetcher,calls}=byHost({
  [PRIMARY]:new Response('',{status:500}),
  [QI]:new Response('<?php secret_source();'),
  [IBT]:()=>{throw Error('secret backend error');}
 });
 const r=await handleRequest(req('/api/cif/1502689'),ENV,fetcher,noCache);
 assert.equal(r.status,502);
 const {error}=await r.json();
 assert.match(error,/www\.crystallography\.net 500/);
 assert.match(error,/qiserver\.ugr\.es invalid cif body/);
 assert.match(error,/cod\.ibt\.lt timeout or connection failure/);
 assert.doesNotMatch(error,/secret/);
 assert.equal(calls.length,5,'2 rounds; the invalid-body mirror is skipped in round 2');
 const missing=byHost({[PRIMARY]:new Response('',{status:404}),[QI]:new Response('',{status:404}),[IBT]:new Response('',{status:404})});
 const nf=await handleRequest(req('/api/cif/99999999'),ENV,missing.fetcher,noCache);
 assert.equal(nf.status,404);
 assert.equal(missing.calls.length,3,'a 404 is not retried');
 const redirect=byHost({[PRIMARY]:new Response(null,{status:302,headers:{location:'https://evil.example/'}}),
  [QI]:new Response('',{status:403}),[IBT]:new Response('',{status:404})});
 const rr=await handleRequest(req('/api/cif/1502689'),ENV,redirect.fetcher,noCache);
 assert.equal(rr.status,502);
 assert.equal(rr.headers.get('location'),null);
 assert.equal(redirect.calls.length,3);
});
test('oversize bodies are rejected at once and never fall through',async()=>{
 const {fetcher,calls}=byHost({[PRIMARY]:()=>new Response(new Uint8Array(4_000_001)),[QI]:new Response(CIF_1502689),[IBT]:new Response(CIF_1502689)});
 const big=await handleRequest(req('/api/cif/4335507'),ENV,fetcher,noCache);
 assert.equal(big.status,413);
 assert.equal(calls.length,1);
});
test('all upstream attempts share the wall-clock budget and a per-host timeout',async()=>{
 let t=0;const seen=[];
 const r=await handleRequest(req('/api/cif/4335507'),ENV,async(url,options)=>{seen.push(url);t+=9_000;return new Response('',{status:524});},
  {cache:null,upstream:{now:()=>t,sleep:async ms=>{t+=ms;},delays:[800]}});
 assert.equal(seen.length,3,'a fourth attempt would start after the 20 s budget');
 assert.equal(r.status,502);
 const timeouts=[];
 await handleRequest(req('/api/cif/4335507'),ENV,async(url,options)=>{
  timeouts.push(options.signal.aborted);return new Response(CIF_1502689);
 },noCache);
 assert.deepEqual(timeouts,[false]);
});
test('successful upstream bodies are served from the edge cache without stored CORS grants',async()=>{
 const store=new Map();
 const cache={
  async match(key){const v=store.get(key.url);return v?v.clone():undefined;},
  async put(key,response){store.set(key.url,response);}
 };
 const {fetcher,calls}=byHost({[PRIMARY]:new Response('',{status:500}),[QI]:new Response(CIF_1502689),[IBT]:new Response(CIF_1502689)});
 const first=await handleRequest(req('/api/cif/1502689'),ENV,fetcher,{cache,...fastRetry});
 assert.equal(first.headers.get('X-Kristalyapi-Cache'),'MISS');
 assert.equal(await first.text(),CIF_1502689);
 const stored=store.get(PRIMARY+'/1502689.cif');
 assert.ok(stored,'a mirror answer is cached under the canonical COD URL');
 assert.equal(stored.headers.get('Access-Control-Allow-Origin'),null);
 const second=await handleRequest(req('/api/cif/1502689'),ENV,()=>{throw Error('cache hit expected');},{cache,...fastRetry});
 assert.equal(calls.length,2);
 assert.equal(second.status,200);
 assert.equal(second.headers.get('X-Kristalyapi-Cache'),'HIT');
 assert.equal(second.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.match(second.headers.get('content-type'),/chemical\/x-cif/);
 assert.equal(second.headers.get('Cache-Control'),'public, max-age=2592000','CIF bodies are cached for 30 days');
 assert.equal(stored.headers.get('Cache-Control'),'public, max-age=2592000');
 assert.equal(await second.text(),CIF_1502689);
 const missing=byHost({[PRIMARY]:new Response('',{status:404}),[QI]:new Response('',{status:404}),[IBT]:new Response('',{status:404})});
 await handleRequest(req('/api/cif/1502690'),ENV,missing.fetcher,{cache,...fastRetry});
 assert.equal(store.has(PRIMARY+'/1502690.cif'),false,'errors are never cached');
});
test('upstream requests identify the gateway and health reports the mirror list',async()=>{
 let headers=null;
 await handleRequest(req('/api/cif/4335507'),ENV,async(url,options)=>{headers=options.headers;return new Response('data_x\n');},noCache);
 assert.match(headers['User-Agent'],/kristalyapi-cod-worker\/1\.2/);
 const health=await (await handleRequest(req('/health'),ENV)).json();
 assert.equal(health.version,'1.2');
 assert.deepEqual(health.upstreams,['www.crystallography.net','qiserver.ugr.es','cod.ibt.lt']);
});
test('validBody accepts real CIF/JSON and rejects HTML, PHP source and junk',()=>{
 const b=s=>new TextEncoder().encode(s);
 assert.ok(validBody('cif',b('#---\n# header\ndata_1502689\n')));
 assert.ok(validBody('json',b('[{"file":"1502689"}]')));
 assert.ok(validBody('json',b('{"data":{"id":"1502689"}}')));
 for (const [type,body] of [['cif','<!DOCTYPE html><p>500</p>'],['cif','<?php echo 1;'],['cif','no data block'],
  ['json','<?php include "bootstrap.php";'],['json','<html></html>'],['json','"string"'],['json','{broken']])
  assert.equal(validBody(type,b(body)),false,type+': '+body);
});
