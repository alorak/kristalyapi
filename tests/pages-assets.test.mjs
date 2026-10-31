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
const modules=['dft-ui.js','vesta-project-style.js','vesta-project-view.js','vesta-project-scientific.js','vesta-project-export.js','export-graphics.js','export-glyphs.js','element-data.js','view-settings.js','geometry-table.js','structure-export.js','qe-protocol-templates.js','qe-hpc-export.js','qe-hpc-pipeline.js','qe-truba-pipeline-view.js','qe-truba-summary-view.js','qe-electronic-setup.js','qe-job-tracking.js','dft-workspace.css','semiconductor-p0.js','semiconductor-physics-p0-core.js','semiconductor-p0.css','mos2-defect-study-core.js','qe-electronic-view.js','qe-convergence-view.js','qe-job-diagnostics-view.js','qe-defect-compare-view.js','qe-api-client.js','qe-relax-view.js'];

test('app modules use .js so every static server sends a JavaScript MIME type',()=>{
 // Static servers without an .mjs mapping send application/octet-stream and the
 // whole module graph fails to load (CI harnesses, some self-hosted mirrors).
 assert.deepEqual(modules.filter(file=>file.endsWith('.mjs')),[]);
 assert.deepEqual([...editor.matchAll(/from '\.\/([^']+\.mjs)'/g)].map(match=>match[1]),[]);
 assert.ok(!/'\.\/[^']+\.mjs'/.test(sw),'offline shell must not cache .mjs modules');
});
test('offline shell entries exist at the same path in the repository',()=>{
 // A missing entry makes cache.addAll reject, so the service worker never installs.
 const listed=[...sw.match(/APP_FILES=\[([\s\S]*?)\]/)[1].matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]);
 const downloaded=new Set(['vendor/moyo_wasm.js','vendor/moyo_wasm_bg.wasm']);
 assert.deepEqual(listed.filter(file=>!downloaded.has(file)&&!existsSync(path.join(root,file))),[]);
});
test('every DFT setup and settings control is either saved or explicitly left unsaved',()=>{
 const ui=read('dft-ui.js');
 const list=name=>[...ui.match(new RegExp('export const '+name+'=\\[([\\s\\S]*?)\\];'))[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
 const saved=new Set(list('DFT_SETTINGS_IDS')),unsaved=new Set(list('DFT_UNSAVED_IDS'));
 const controls=[];
 for(const section of ['dft-ayarlar','dft-hazirlik']){
  const start=html.indexOf('<section id="'+section+'"'),end=html.indexOf('</section>',start);
  for(const match of html.slice(start,end).matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g))controls.push(match[1]);
 }
 assert.ok(controls.length>40);
 assert.deepEqual(controls.filter(id=>!saved.has(id)&&!unsaved.has(id)),[],'new controls must be added to DFT_SETTINGS_IDS or DFT_UNSAVED_IDS');
 assert.deepEqual([...saved].filter(id=>!controls.includes(id)),[],'saved ids must exist in the page');
});
test('P0 module graph is staged to Pages and pre-cached for offline use',()=>{
 for(const file of modules){
  assert.ok(existsSync(path.join(root,file)),file+' must exist in the source tree');
  assert.ok(pages.includes('cp '+file+' public/'+file),file+' must be copied to Pages');
  assert.ok(pages.includes('test -s public/'+file),file+' must be checked for a nonempty deploy artifact');
  assert.ok(sw.includes("'./"+file+"'"),file+' must be cached by the offline shell');
 }
 const trubaApp=readFileSync(path.join(root,'crystal-app.js'),'utf8');
 const trubaPage=readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['qeHpcBandFirst','qeHpcBandLast','qeHpcBandWindowHint']){
  assert.ok(trubaPage.includes('id="'+id+'"'),'Missing P1.4 control '+id);
  assert.ok(trubaApp.includes("$('"+id+"')"),'P1.4 control is not wired '+id);
 }
 assert.ok(existsSync(path.join(root,'tools/qe_hpc_electronic.py')),'P1.3 converter must exist');
 assert.ok(existsSync(path.join(root,'tools/qe_pdos.py')),'P1.3 QE projected DOS parser must exist');
 for(const name of ['qe_hpc_electronic.py','qe_pdos.py']){
  assert.ok(pages.includes('cp tools/'+name+' public/tools/'+name),'P1.3 asset '+name+' must deploy');
  assert.ok(pages.includes('test -s public/tools/'+name),'P1.3 asset '+name+' must be nonempty');
  assert.ok(sw.includes("'./tools/"+name+"'"),'P1.3 asset '+name+' must be offline cached');
 }
 assert.ok(existsSync(path.join(root,'tools/qe_hpc_pipeline.py')),'P1.2 stage driver must exist');
 assert.ok(pages.includes('cp tools/qe_hpc_pipeline.py public/tools/qe_hpc_pipeline.py'),'P1.2 driver must retain its tools/ Pages route');
 assert.ok(pages.includes('test -s public/tools/qe_hpc_pipeline.py'),'P1.2 driver deploy asset must be checked');
 assert.ok(sw.includes("'./tools/qe_hpc_pipeline.py'"),'P1.2 stage driver must be offline cached');
 assert.ok(existsSync(path.join(root,'tools/qe_hpc_collect.py')),'TRUBA collector source must exist');
 assert.ok(pages.includes('cp tools/qe_hpc_collect.py public/tools/qe_hpc_collect.py'),'collector keeps its repository path on Pages, so local and test servers resolve it too');
 assert.ok(pages.includes('test -s public/tools/qe_hpc_collect.py'),'collector deploy asset must be verified');
 assert.ok(sw.includes("'./tools/qe_hpc_collect.py'"),'collector must be available in offline shell');
 assert.match(editor,/import\('\.\/semiconductor-p0\.js'\)/,'P0 laboratory should load without blocking editor bootstrap');
 assert.match(semiconductor,/from '\.\/semiconductor-physics-p0-core\.js'/);
 assert.match(html,/href="\.\/semiconductor-p0\.css"/);
 assert.match(pages,/needs: validate/,'deployment must still depend on passing validation');
});

test('service-worker cache name changes when offline module graph changes',()=>{
 assert.match(sw,/CACHE_NAME=CACHE_PREFIX\+'2026-10-31-v24-bonds-formats'/);
 assert.match(sw,/await cache\.addAll\(APP_URLS\)/);
 assert.match(sw,/await self\.skipWaiting\?\.\(\)/);
});

test('names imported into crystal-app.js are not declared again at top level',()=>{
 // A duplicate is a module SyntaxError: the browser would not load the editor at all.
 const imported=[...editor.matchAll(/^import\s*\{([^}]*)\}\s*from/gm)]
  .flatMap(m=>m[1].split(',').map(s=>s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
 const declared=new Set([...editor.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]||m[2]));
 assert.deepEqual(imported.filter(name=>declared.has(name)),[]);
});
