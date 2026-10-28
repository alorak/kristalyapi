import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(root,file),'utf8');
const pages=read('.github/workflows/pages.yml');
const sw=read('sw.js');
const html=read('index.html');
const editor=read('crystal-app.js');
const semiconductor=read('semiconductor-p0.js');
const modules=['semiconductor-p0.js','semiconductor-physics-p0-core.js','semiconductor-p0.css','mos2-defect-study-core.js','qe-electronic-view.js'];

test('P0 module graph is staged to Pages and pre-cached for offline use',()=>{
 for(const file of modules){
  assert.ok(existsSync(path.join(root,file)),file+' must exist in the source tree');
  assert.ok(pages.includes('cp '+file+' public/'+file),file+' must be copied to Pages');
  assert.ok(pages.includes('test -s public/'+file),file+' must be checked for a nonempty deploy artifact');
  assert.ok(sw.includes("'./"+file+"'"),file+' must be cached by the offline shell');
 }
 assert.match(editor,/import\('\.\/semiconductor-p0\.js'\)/,'P0 laboratory should load without blocking editor bootstrap');
 assert.match(semiconductor,/from '\.\/semiconductor-physics-p0-core\.js'/);
 assert.match(html,/href="\.\/semiconductor-p0\.css"/);
 assert.match(pages,/needs: validate/,'deployment must still depend on passing validation');
});

test('service-worker cache name changes when offline module graph changes',()=>{
 assert.match(sw,/CACHE_NAME=CACHE_PREFIX\+'2026-10-28-mos2-orbital-pdos-p2'/);
 assert.match(sw,/await cache\.addAll\(APP_URLS\)/);
 assert.match(sw,/await self\.skipWaiting\?\.\(\)/);
});
