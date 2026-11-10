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
const modules=['layered-2d-figure.js','layered-2d-page.js','layered-2d-cif.js','layered-2d-export.js','dft-ui.js','browser-dft-lab.js','gansu-local-engine.js','gansu-geometry-scan.js','browser-tb-core.js','browser-dft-lab.css','vesta-project-style.js','vesta-project-view.js','vesta-project-scientific.js','vesta-project-export.js','cif2-lex.js','cif2-symmetry.js','cif2-document.js','export-graphics.js','export-glyphs.js','element-data.js','view-settings.js','geometry-table.js','structure-export.js','scene-controls.js','setting-transform.js','phase-alignment.js','volume-analysis.js','sigmaa.js','qe-protocol-templates.js','qe-hpc-export.js','qe-hpc-pipeline.js','qe-truba-pipeline-view.js','qe-truba-summary-view.js','qe-electronic-setup.js','qe-job-tracking.js','dft-workspace.css','semiconductor-p0.js','semiconductor-physics-p0-core.js','semiconductor-p0.css','mos2-defect-study-core.js','qe-electronic-view.js','qe-convergence-view.js','qe-job-diagnostics-view.js','qe-defect-compare-view.js','qe-api-client.js','qe-relax-view.js','material-cards-core.js','material-evidence-core.js','bulk-study-preparation.js','materials-page.js','materials-tabs.js','materials-ml-core.js','materials-ml-page.js','materials-ml-p1-core.js','materials-ml-p1-page.js','materials-ml-p12-core.js','materials-ml-p12-page.js','materials-ml-p12-worker.js','materials-ml-p13-core.js','materials-ml-p13-page.js','materials-ml-p13-worker.js','xrd-acquisition-core.js','xrd-peak-match-core.js'];

test('Materials section and ML sub-tabs preserve all controls and ship offline',()=>{
 const mainIds=['Cards','Compare','Ml','Evidence','Bulk'];
 const mlIds=['P0','P1','P12','P13'];
 for(const id of mainIds){
  const tab='materialsTab'+id,panel='materialsPanel'+id;
  assert.match(html,new RegExp('id="'+tab+'"[^>]*role="tab"[^>]*aria-controls="'+panel+'"'));
  assert.match(html,new RegExp('id="'+panel+'"[^>]*role="tabpanel"[^>]*aria-labelledby="'+tab+'"'));
  assert.equal(html.split('id="'+panel+'"').length-1,1,'panel must be unique');
 }
 for(const id of mlIds){
  const tab='materialsMlTab'+id,panel='materialsMlPane'+id;
  assert.match(html,new RegExp('id="'+tab+'"[^>]*role="tab"[^>]*aria-controls="'+panel+'"'));
  assert.match(html,new RegExp('id="'+panel+'"[^>]*role="tabpanel"[^>]*aria-labelledby="'+tab+'"'));
 }
 for(const control of ['materialsAdd','materialsCards','materialsComparison','materialsMlRun',
  'materialsMlP1Run','materialsMlP12Run','materialsMlP13Run','materialsEvidenceChoose','materialsBulkPrepare'])
  assert.equal(html.split('id="'+control+'"').length-1,1,control+' must remain present');
 assert.match(read('materials-page.js'),/initMaterialsTabs/);
 assert.ok(sw.includes("'./materials-tabs.js'"),'tab controller must be cached offline');
 assert.ok(pages.includes('cp materials-tabs.js public/materials-tabs.js'));
 assert.ok(pages.includes('test -s public/materials-tabs.js'));
});
test('P1.2 independent polymorph source, engine and UI are included in site and offline shell',()=>{
 const model=JSON.parse(read('models/jarvis-polymorph-p12-source.json'));
 assert.equal(model.totalOriginal,184);
 assert.match(model.origin,/CC BY 4.0/);
 for(const file of ['materials-ml-p12-core.js','materials-ml-p12-page.js','materials-ml-p12-worker.js','models/jarvis-polymorph-p12-source.json']){
  assert.ok(pages.includes('cp '+file+' public/'+file),'Pages omits '+file);
  assert.ok(sw.includes("'./"+file+"'"),'offline shell omits '+file);
 }
 assert.match(html,/id="materialsMlP12Run"/);
 assert.match(html,/id="materialsMlP12Result"/);
 assert.match(read('materials-ml-p12-core.js'),/meanClosestBondA/);
 assert.match(read('materials-ml-p12-core.js'),/meanCoordination/);
});
test('P1 ZEBRA structure model is packaged and separated from the P0 experimental target',()=>{
 const model=JSON.parse(read('models/zebra-structural-p1.json'));
 assert.equal(model.schema,'kristalyapi.zebra-structural-knn.v1');
 assert.equal(model.license,'CC-BY-4.0');
 assert.equal(model.meta.train,model.rows.length);
 assert.equal(model.meta.test,443);
 for(const file of ['models/zebra-structural-p1.json','materials-ml-p1-core.js','materials-ml-p1-page.js']){
  assert.ok(sw.includes("'./"+file+"'"),file+' must be available offline');
  assert.ok(pages.includes('cp '+file+' public/'+file),file+' must be shipped');
 }
 for(const id of ['materialsMlP1Run','materialsMlP1Export','materialsMlP1Status','materialsMlP1Result'])
  assert.ok(html.includes('id="'+id+'"'),id+' missing from Materials');
});
test('P0 ML baseline is packaged offline, named and explicitly scoped',()=>{
 const model=JSON.parse(read('models/matbench-expt-gap-knn-p0.json'));
 assert.equal(model.schema,'kristalyapi.materials-ml-knn.v1');
 assert.equal(model.target,'experimental_band_gap_eV');
 assert.equal(model.trainingCount,model.rows.length);
 assert.ok(model.validation.samples>100);
 assert.ok(pages.includes('cp models/matbench-expt-gap-knn-p0.json public/models/matbench-expt-gap-knn-p0.json'));
 assert.ok(sw.includes("'./models/matbench-expt-gap-knn-p0.json'"));
 assert.match(html,/id="materialsMlRun"/);
 assert.match(html,/id="materialsMlStatus"/);
});
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
 const downloaded=new Set(['vendor/moyo_wasm.js','vendor/moyo_wasm_bg.wasm','vendor/gansu-lite/wasm/wasm_eri_bg.wasm','vendor/gansu-lite/wasm/wasm_eri_simd_bg.wasm']);
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
 assert.match(sw,/CACHE_NAME=CACHE_PREFIX\+'2026-11-10-gansu-p04-ml-p13'/);
 assert.match(sw,/await cache\.addAll\(APP_URLS\)/);
 assert.match(sw,/await self\.skipWaiting\?\.\(\)/);
});

test('independent 2D figure route uses a WebGL-free SVG renderer',()=>{
 assert.match(html,/id="layered2dPage"/);
 assert.match(html,/id="layered2dNav" href="#katmanli-figur"/);
 assert.match(editor,/hash==='#katmanli-figur'/);
 assert.match(editor,/\$\('layered2dPage'\)\.hidden=page!=='layered2d'/);
 const figure=read('layered-2d-figure.js');
 assert.ok(!/WebGLRenderer|requestAnimationFrame|document\.createElement/.test(figure));
 assert.match(read('layered-2d-page.js'),/buildLayeredFigure/);
});

test('WebGL failure cannot prevent library and DFT controls from binding',()=>{
 assert.match(html,/id="webglFallback"[^>]*role="alert"/);
 assert.match(html,/id="webglRetry"/);
 assert.match(editor,/bind\(\);syncControls\(\);editorUiBound=true/);
 assert.match(editor,/if\(editorUiBound\)ensureEditorScene\(\)/);
 assert.match(editor,/function resize\(\)\{if\(!renderer\|\|!camera\)return/);
 assert.match(editor,/if\(webglContextLost\|\|document.visibilityState/);
 assert.match(editor,/requireEditorScene\(\)/);
 const browserWorkflow=read('.github/workflows/browser-visual.yml');
 assert.match(browserWorkflow,/node tests\/browser\/webgl-unavailable\.test\.mjs/);
});

test('names imported into crystal-app.js are not declared again at top level',()=>{
 // A duplicate is a module SyntaxError: the browser would not load the editor at all.
 const imported=[...editor.matchAll(/^import\s*\{([^}]*)\}\s*from/gm)]
  .flatMap(m=>m[1].split(',').map(s=>s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
 const declared=new Set([...editor.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]||m[2]));
 assert.deepEqual(imported.filter(name=>declared.has(name)),[]);
});

test('right drawer uses compact action and form controls without resizing steppers',()=>{
 const css=read('styles.css');
 assert.match(css,/#app>\.panel\.right \.right-drawer-pane>\.section button:not\(\[data-repeat-target\]\)/);
 assert.match(css,/#app>\.panel\.right \.right-drawer-pane>\.section \.actionrow button\{flex:0 1 auto\}/);
 assert.match(css,/select\s*\n\)\{height:32px;min-height:32px\}/);
 assert.match(css,/font-size:12px;\s*line-height:1\.35;\s*padding:6px 8px;/);
 const bvs=html.slice(html.indexOf('data-right-section="bvs"'),html.indexOf('data-right-section="plane"'));
 assert.match(bvs,/class="actionrow"[^>]*>[\s\S]*?id="analyzeBvs"[\s\S]*?id="exportBvs"/);
 for(const id of ['analysisCenter','bvsPair','bvsCutoff','analyzeBvs','exportBvs','madelungCharges','madelungCalculate'])
  assert.match(bvs,new RegExp('id="'+id+'"'),'BVS control must remain functional: '+id);
});

test('crystal chat is constrained to the workspace and clip-panel prose is concise',()=>{
 const css=read('styles.css');
 const locale=read('translations.js');
 const dockStart=html.indexOf('<section id="llmChatDock"');
 assert.ok(dockStart>html.indexOf('<main id="viewport">')&&dockStart<html.indexOf('</main>'),
  'chat must be contained by the editor workspace');
 assert.match(css,/\.llm-chat-dock\{[\s\S]*?position:absolute;z-index:9;top:12px;right:12px;/);
 assert.match(css,/#viewport \.llm-chat-dock\{right:66px;width:min\(910px,calc\(100% - 78px\)\)/);
 assert.match(css,/#llmChatDock #llmChatPrompt::placeholder\{color:#9aaaba;opacity:1\}/);
 assert.match(html,/id="llmChatPrompt"[^>]*placeholder="Sormak istediğinizi sorabilirsiniz\."/);
 assert.match(locale,/Sormak istediğinizi sorabilirsiniz\./);
 assert.doesNotMatch(html,/Düzlem h·x \+ k·y \+ l·z = uzaklık/);
 assert.doesNotMatch(editor,/Miller düzlemi yalnız görsel bir katmandır/);
 assert.match(editor,/status\.textContent=active\?active\+'/,'active clipping status must remain');
});

test('Materials Project proxy is opt-in, explicit and never cached by the Worker',()=>{
 const page=read('materials-project-page.js'),core=read('materials-project-core.js');
 const worker=read('worker/src/index.mjs'),doc=read('worker/README.md');
 assert.match(html,/id="mpUseWorker" type="checkbox"/);
 assert.match(html,/id="mpWorkerHelp"/);
 assert.match(page,/transport:useWorker\?'worker':'direct'/);
 assert.match(page,/materials-project-worker-opt-in/);
 assert.match(core,/if\(health\?\.materialsProjectProxy!==true\)/);
 assert.match(core,/endpoint=MP_WORKER\+'\/api\/mp\/summary'\+u\.search/);
 assert.match(worker,/if\(target\.pathname==='\/api\/mp\/summary'\)return relayMaterialsProject/);
 assert.match(worker,/\x27Cache-Control\x27:\x27no-store\x27/);
 assert.match(doc,/Worker v1\.4\+/);
});

test('2026 Materials Project AlphaID is allowed consistently by UI and pinned Worker',()=>{
 const core=read('materials-project-core.js'),worker=read('worker/src/index.mjs');
 const browser=read('tests/browser/materials-project.test.mjs'),unit=read('tests/materials-project.test.mjs');
 assert.match(core,/\^mp-\(\?:\\d\{1,12\}\|\[a-z\]\{1,16\}\)\$/);
 assert.match(worker,/sel==='material_ids'&&\/\^mp-\(\?:\\d\{1,12\}\|\[a-z\]\{1,16\}\)\$\//);
 assert.match(worker,/materialsProjectAlphaIds:true/);
 assert.match(core,/health\?\.materialsProjectAlphaIds!==true/);
 assert.match(browser,/alphaId='mp-aaaaaczy'/);
 assert.match(unit,/post-2026 AlphaIDs/);
 assert.match(html,/Worker v1\.4\+/);
});

test('removed compass dropdown in visual smoke is verified without stale user-facing selector',()=>{
 const browser=read('tests/browser/visual.test.mjs');
 const workflow=read('.github/workflows/browser-visual.yml');
 assert.doesNotMatch(html,/id="axisCompassMode"/,'the dropdown must stay removed');
 assert.doesNotMatch(browser,/locator\('#axisCompassMode'\)\.selectOption\(/,
  'visual test must not wait for the removed dropdown');
 assert.match(browser,/compassMode:mode=>/,'scientific lattice mode stays test-only');
 assert.match(browser,/window\.__visualTest\.compassMode\('lattice'\)/);
 assert.match(browser,/window\.__visualTest\.compassMode\('cartesian'\)/);
 assert.match(workflow,/pull_request:\s*\n\s*types:/,
  'run the visual smoke on unmerged PRs');
 assert.match(workflow,/pull_request_target:\s*\n\s*types:/,
  'keep the post-merge visual smoke');
});
