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
