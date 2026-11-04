import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const scope='https://example.org/kristalyapi/';

function serviceWorkerHarness(){
 const listeners=new Map(),deletes=[],entries=new Map(),network=[];
 const cache={
  async addAll(urls){for(const url of urls)entries.set(url,'cached:'+url);},
  async match(url,{ignoreSearch}={}){
   const lookup=ignoreSearch?url.split('?')[0]:url;
   return entries.get(lookup);
  }
 };
 let claimed=0;
 const self={registration:{scope},location:new URL(scope+'sw.js'),
  addEventListener(type,handler){listeners.set(type,handler);},
  clients:{async claim(){claimed++;}}};
 const caches={async open(name){assert.match(name,/^kristalyapi-shell-/);return cache;},
  async keys(){return ['another-app-cache','kristalyapi-shell-old','kristalyapi-shell-2026-10-16-v1','kristalyapi-shell-2026-10-16-v2','kristalyapi-shell-2026-10-16-v3'];},
  async delete(name){deletes.push(name);return true;}};
 const fetch=async request=>{network.push(request.url);return 'network:'+request.url;};
 runInNewContext(source,{self,caches,fetch,URL});
 const dispatch=async(type,request)=>{
  let pending,response;
  const event={request,waitUntil(value){pending=value;},respondWith(value){response=value;}};
  listeners.get(type)(event);
  if(pending)await pending;
  return response?await response:undefined;
 };
 return {dispatch,entries,deletes,network,get claimed(){return claimed;}};
}

test('offline install pre-caches the complete local renderer, WASM and page shell',async()=>{
 const sw=serviceWorkerHarness();await sw.dispatch('install');
 for(const path of ['index.html','styles.css','crystal-app.js','volume-iso-worker.js','reciprocal-page.js',
  'reciprocal-core.js','vesta-project-style.js','vesta-project-view.js','vesta-project-scientific.js','vesta-project-export.js','cif2-lex.js','cif2-symmetry.js','cif2-document.js','mos2-defect-study-core.js','qe-electronic-view.js','qe-defect-compare-view.js','qe-api-client.js','lesson-pages.js','lesson-core.js','semiconductor-p0.js','semiconductor-physics-p0-core.js',
  'semiconductor-p0.css','material-cards-core.js','material-evidence-core.js','bulk-study-preparation.js','materials-page.js','xrd-acquisition-core.js','xrd-peak-match-core.js','xrd-factor-core.js','powder-planes-view.js','manifest.webmanifest','vendor/moyo_wasm.js',
  'vendor/moyo_wasm_bg.wasm','vendor/three/build/three.core.js',
  'vendor/three/examples/jsm/math/ConvexHull.js',
  'vendor/three/examples/jsm/exporters/STLExporter.js',
  'vendor/three/examples/jsm/exporters/GLTFExporter.js']){
  assert.equal(sw.entries.has(scope+path),true,path+' must be available offline');
 }
 assert.equal(sw.entries.has(scope),true,'the GitHub Pages subpath root must be cached');
});

test('offline fetch only handles declared, same-origin GET assets',async()=>{
 const sw=serviceWorkerHarness();await sw.dispatch('install');
 const request=(url,method='GET')=>({url,method});
 assert.equal(await sw.dispatch('fetch',request(scope+'index.html')),'cached:'+scope+'index.html');
 assert.equal(await sw.dispatch('fetch',request(scope+'?offline=1')),'cached:'+scope);
 assert.equal(await sw.dispatch('fetch',request(scope+'crystal-app.js?v=2')),'cached:'+scope+'crystal-app.js');
 assert.equal(await sw.dispatch('fetch',request('https://www.crystallography.net/cod/result.php')),undefined);
 assert.equal(await sw.dispatch('fetch',request(scope+'api/cif/123')),undefined);
 assert.equal(await sw.dispatch('fetch',request(scope+'index.html','POST')),undefined);
 assert.deepEqual(sw.network,[],'external or arbitrary requests must never reach the worker fetch handler');
});

test('activation removes only old Kristal Yapı shell caches',async()=>{
 const sw=serviceWorkerHarness();await sw.dispatch('activate');
 assert.deepEqual(sw.deletes,['kristalyapi-shell-old','kristalyapi-shell-2026-10-16-v1','kristalyapi-shell-2026-10-16-v2','kristalyapi-shell-2026-10-16-v3']);
 assert.equal(sw.claimed,1);
});

test('Pages deploy only merged main PRs; WebGL smoke safely gates PRs before and after merge',()=>{
 const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const visual=readFileSync(new URL('../.github/workflows/browser-visual.yml',import.meta.url),'utf8');
 assert.match(pages,/^  pull_request_target:\s*\n    types: \[closed\]\s*\n    branches: \[main\]/m);
 assert.doesNotMatch(pages,/^  (?:push|pull_request|workflow_dispatch|schedule):/m);
 assert.match(pages,/^    if: github\.event\.pull_request\.merged == true$/m);
 assert.match(pages,/ref: \$\{\{ github\.event\.pull_request\.merge_commit_sha \}\}/);
 assert.match(pages,/  deploy:\n    needs: validate\n    if: github\.event\.pull_request\.merged == true/);
 assert.match(visual,/^  pull_request:\s*\n    types: \[opened, synchronize, reopened, ready_for_review\]/m);
 assert.match(visual,/^  pull_request_target:\s*\n    types: \[closed\]/m);
 assert.match(visual,/^    if: github\.event_name == 'pull_request' \|\| github\.event\.pull_request\.merged == true$/m);
 assert.match(visual,/ref: \$\{\{ github\.event_name == 'pull_request_target' && github\.event\.pull_request\.merge_commit_sha \|\| github\.sha \}\}/);
 assert.match(visual,/persist-credentials: false/);
 assert.doesNotMatch(visual,/pull_request\.head\.(?:sha|ref)/);
});
