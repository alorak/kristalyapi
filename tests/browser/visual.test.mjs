// Real Chromium/WebGL smoke and differential screenshot tests (not a
// pixel-perfect VESTA equivalence claim). Render using software WebGL on CI.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.join(base,'tests/browser/artifacts');
await fs.mkdir(artifacts,{recursive:true});
const server=http.createServer(async(request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 const name=url.pathname==='/'?'/index.html':url.pathname;
 const absolute=path.resolve(base,'.'+name);
 if(!absolute.startsWith(base+path.sep)) {response.writeHead(403).end();return;}
 try{
  let content=await fs.readFile(absolute);
  if(name==='/index.html'){
   // The application may use a CDN, but its CI visual oracle must be
   // deterministic and must not depend on a third-party network response.
   let html=content.toString('utf8');
   const cdn='https://cdn.jsdelivr.net/npm/three@0.182.0/';
   assert.ok(html.includes(cdn),'Expected pinned Three.js import map');
   html=html.replaceAll(cdn,'/node_modules/three/');
   // Test-only hooks inserted into the served module; the shipped app stays unchanged.
   const bootstrapMarker='// @kristalyapi/browser-bootstrap:';
   assert.ok(html.includes(bootstrapMarker),'Expected app bootstrap marker');
   html=html.replace(bootstrapMarker,
    'window.__visualTest={select:ids=>{selected=[...ids];drawSelection();},repeat:()=>[...state.rep]};\n'+bootstrapMarker);
   content=Buffer.from(html);
  }
  // Chromium refuses native ES modules served as application/octet-stream.
  // Match GitHub Pages' MIME types for the local WASM module and binary.
  const contentType=name.endsWith('.html')?'text/html; charset=utf-8':
   name.endsWith('.js')?'text/javascript; charset=utf-8':
   name.endsWith('.wasm')?'application/wasm':
   name.endsWith('.cif')?'text/plain; charset=utf-8':'application/octet-stream';
  response.writeHead(200,{'Content-Type':contentType});
  response.end(content);
 }catch(e){response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
async function sample(page){
 return page.locator('#stage canvas').evaluate(canvas=>{
  const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;
  const ctx=out.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);
  const image=ctx.getImageData(0,0,out.width,out.height).data;
  let ink=0,sum=0;
  for(let y=8;y<out.height-8;y+=8)for(let x=8;x<out.width-8;x+=8){
   const p=(y*out.width+x)*4,r=image[p],g=image[p+1],b=image[p+2];
   const difference=255-Math.min(r,g,b);
   if(difference>20)ink++;
   sum+=r*3+g*5+b*7;
  }
  return {ink,sum,canvasWidth:canvas.width,canvasHeight:canvas.height};
 });
}
async function save(page,name,metrics){
 await page.waitForTimeout(200); // allow WebGL animation loop to draw the latest scene
 await page.screenshot({path:path.join(artifacts,name+'.png'),animations:'disabled'});
 metrics[name]=await sample(page);
 assert.ok(metrics[name].ink>20,name+': canvas may be blank '+JSON.stringify(metrics[name]));
}
async function assertHorizontalQuickbar(page,{drawerOpen=false,mobile=false}={}){
 const geometry=await page.locator('#workbenchQuickbar').evaluate(dock=>{
  const [view,miller]=dock.querySelectorAll('.quickbar-group');
  const rect=element=>{
   const bounds=element.getBoundingClientRect();
   return {left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,
    width:bounds.width,height:bounds.height};
  };
  return {
   dock:rect(dock),view:rect(view),miller:rect(miller),
   leftGap:rect(dock.querySelector('.quickbar-ranges')).top-rect(dock.querySelector('.quickbar-topline')).bottom,
   rightGap:rect(dock.querySelector('.quickbar-analysis')).top-rect(dock.querySelector('.quickbar-miller-line')).bottom,
   justifySelf:getComputedStyle(miller).justifySelf,
   scrollWidth:dock.scrollWidth,clientWidth:dock.clientWidth
  };
 });
 assert.ok(geometry.dock.height<=82,'the bottom dock must stay one compact row: '+JSON.stringify(geometry));
 assert.ok(geometry.view.right<=geometry.miller.left+1,'the two control groups must stay side by side: '+JSON.stringify(geometry));
 assert.ok(Math.abs((geometry.view.top+geometry.view.bottom)/2-(geometry.miller.top+geometry.miller.bottom)/2)<12,
  'the control groups must share the same vertical row: '+JSON.stringify(geometry));
 assert.ok(geometry.leftGap>=3&&geometry.rightGap>=3,'both control rows need breathing room: '+JSON.stringify(geometry));
 assert.equal(geometry.justifySelf,drawerOpen?'start':'end','Miller controls should align right normally and left with the drawer open');
 if(!drawerOpen&&!mobile)assert.ok(geometry.dock.right-geometry.miller.right<=20,
  'Miller controls should sit at the right edge of the normal toolbar');
 if(mobile)assert.ok(geometry.scrollWidth>geometry.clientWidth,
  'narrow screens should allow horizontal scrolling instead of vertical stacking');
}
const metrics={};
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1480,height:920},deviceScaleFactor:1});
 const errors=[],consoleErrors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 // English is the default; Turkish remains selectable and persisted.
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.equal(await page.locator('#libraryNav').textContent(),'Library');
 assert.equal(await page.locator('#languageEnglish').getAttribute('aria-pressed'),'true');
 await page.locator('#languageTurkish').click();
 assert.equal(await page.locator('#libraryNav').textContent(),'Kütüphane');
 assert.equal(await page.locator('html').getAttribute('lang'),'tr');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.language.v1')),'tr');
 assert.equal(await page.locator('#leftGeneralPane').getByText('Görünüm',{exact:true}).count(),0);
 assert.equal(await page.locator('#legacyViewControls').isHidden(),true);
 assert.equal(await page.locator('#adpLevel').isDisabled(),true,'ADP probability needs an enabled ellipsoid with Uij/Uiso');
 assert.equal(await page.locator('#polyCut').isDisabled(),true,'neighbor threshold needs a selected coordination center');
 assert.equal(await page.locator('#polyNeighbors').isDisabled(),true,'max neighbors needs a selected coordination center');
 assert.equal(await page.locator('.supercell-stepper button').count(),6,'each repeat axis needs plus/minus buttons');
 const repeatPlus=page.locator('[data-repeat-target="ra"][data-repeat-step="1"]');
 const repeatMinus=page.locator('[data-repeat-target="ra"][data-repeat-step="-1"]');
 await page.locator('#ra').fill('1');
 assert.equal(await repeatMinus.isDisabled(),true,'the decrement button should stop at 1');
 await repeatPlus.click();
 assert.equal(await page.locator('#ra').inputValue(),'2');
 assert.equal(await repeatMinus.isEnabled(),true);
 await page.locator('#applyRepeat').click();
 assert.equal(await page.evaluate(()=>window.__visualTest.repeat()[0]),2,'the stepper value should apply to the crystal');
 await page.locator('#ra').fill('6');
 assert.equal(await repeatPlus.isDisabled(),true,'the increment button should stop at 6');
 await page.locator('#repeatOne').click();
 assert.equal(await page.locator('#ra').inputValue(),'1');
 assert.equal(await repeatMinus.isDisabled(),true,'reset should refresh the stepper controls');
 // Independent structures, per-workspace history and camera, the ten-workspace cap.
 assert.equal(await page.locator('#workspaceCount').textContent(),'1');
 await page.locator('#workspaceToggle').click();
 assert.equal(await page.locator('#workspaceDrawer').getAttribute('aria-hidden'),'false');
 assert.equal(await page.locator('#workspaceList .workspace-entry').count(),1);
 await page.screenshot({path:path.join(artifacts,'18-workspace-switcher.png'),animations:'disabled'});
 await page.locator('#workspaceAdd').click();
 assert.equal(await page.locator('#workspaceCount').textContent(),'2');
 assert.match(await page.locator('#infoName').textContent(),/Yeni kristal/);
 assert.equal(await page.locator('#siteCount').textContent(),'1');
 await page.locator('#a').fill('7.25');await page.locator('#applyCell').click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').first().click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 assert.equal(await page.locator('#a').inputValue(),'5.431');
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'false');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').nth(1).click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.locator('#undoBtn').click();
 assert.equal(await page.locator('#a').inputValue(),'5');
 await page.locator('#redoBtn').click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 // Refresh restores both workspaces and the active selection from local storage.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'));
 assert.equal(await page.locator('#workspaceCount').textContent(),'2');
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').first().click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 await page.locator('#workspaceToggle').click();
 for(let i=2;i<10;i++){
  await page.locator('#workspaceAdd').click();
  if(i<9)await page.locator('#workspaceToggle').click();
 }
 assert.equal(await page.locator('#workspaceCount').textContent(),'10');
 await page.locator('#workspaceToggle').click();
 assert.equal(await page.locator('#workspaceAdd').isDisabled(),true);
 await page.screenshot({path:path.join(artifacts,'19-ten-workspaces.png'),animations:'disabled'});
 page.on('dialog',dialog=>dialog.accept());
 for(let i=0;i<9;i++){
  await page.locator('#workspaceList .workspace-remove:not([disabled])').first().click();
  if(await page.locator('#workspaceDrawer').getAttribute('aria-hidden')==='true')await page.locator('#workspaceToggle').click();
 }
 assert.equal(await page.locator('#workspaceCount').textContent(),'1');
 assert.equal(await page.locator('#workspaceList .workspace-remove').first().isDisabled(),true);
 await page.locator('#workspaceDrawerClose').click();
 // Kütüphane: full-width dual columns, separate Worker tab and persistent preset favorites.
 await page.locator('#libraryNav').click();
 await page.locator('#libraryPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#libraryPage').isVisible(),true);
 const libraryColumns=await page.evaluate(()=>{
  const left=document.getElementById('codSearchForm').getBoundingClientRect();
  const right=document.getElementById('codResultsBox').getBoundingClientRect();
  return {leftRight:left.right,rightLeft:right.left,rightRight:right.right,rightWidth:right.width,leftWidth:left.width,viewportWidth:innerWidth};
 });
 assert.ok(libraryColumns.rightLeft>=libraryColumns.leftRight,'search results must be to the right of filters');
 assert.ok(libraryColumns.rightWidth>libraryColumns.leftWidth,'results should have the wider column');
 assert.ok(libraryColumns.rightRight>libraryColumns.viewportWidth-60,'library should use nearly full viewport width');
 await page.screenshot({path:path.join(artifacts,'12-library-search.png'),animations:'disabled'});
 await page.locator('#libWorkerTab').click();
 assert.equal(await page.locator('#libWorkerPane').isVisible(),true);
 assert.equal(await page.locator('#codSearchForm').isVisible(),false,'Worker settings must not share the search pane');
 assert.equal(await page.locator('#codWorkerUrl').isVisible(),true);
 await page.screenshot({path:path.join(artifacts,'13-library-worker.png'),animations:'disabled'});
 await page.locator('#libPresetsTab').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),7);
 assert.equal(await page.locator('select#preset').count(),0,'example structures must be a list, not a dropdown');
 await page.locator('#presetList .preset-choice').filter({hasText:'Sodyum klorür'}).click();
 assert.match(await page.locator('#presetName').textContent(),/Sodyum klorür/);
 assert.match(await page.locator('#presetSpacegroup').textContent(),/225/);
 await page.locator('#presetFavorite').click();
 assert.equal(await page.locator('#presetFavorite').getAttribute('aria-pressed'),'true');
 assert.match(await page.evaluate(()=>localStorage.getItem('kristalyapi.preset-favorites.v1')),/nacl/);
 await page.locator('#presetFavoritesOnly').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),1);
 await page.locator('#presetFavoritesOnly').click();
 await page.screenshot({path:path.join(artifacts,'14-library-presets.png'),animations:'disabled'});
 await page.locator('#importPreset').click();
 assert.match(await page.locator('#infoName').textContent(),/Sodyum klorür/);
 await page.locator('#libraryNav').click();
 await page.locator('#libPresetsTab').click();
 await page.locator('#presetList .preset-choice').filter({hasText:'Silisyum'}).click();
 await page.locator('#importPreset').click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 await page.waitForTimeout(250);
 const originalView=await sample(page);
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(180);
 const orthoView=await sample(page);
 await page.screenshot({path:path.join(artifacts,'17-orthographic-projection.png'),animations:'disabled'});
 assert.ok(orthoView.ink>originalView.ink*.55&&orthoView.ink<originalView.ink*1.85,
  'orthographic projection must keep roughly the same magnification');
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'false');
 await page.waitForTimeout(180);
 const restoredView=await sample(page);
 assert.ok(Math.abs(restoredView.ink-originalView.ink)<originalView.ink*.22,
  'repeated projection switching must not gradually zoom the structure');
 const tools=page.locator('[data-right-tool]');
 assert.equal(await tools.count(),13,'measurement history and Miller need independent analysis icons');
 assert.equal(await page.locator('[data-right-tool="measurement"]').evaluate(el=>el.nextElementSibling?.dataset.rightTool),'history',
  'measurement and history icons should be immediately adjacent');
 for(const [source,destination] of [
  ['bondRules','bonds'],['matrixPreset','lattice'],['spaceGroup','symmetry']
 ]){
  assert.equal(await page.locator('#leftGeneralPane #'+source).count(),0,source+' must leave the left sidebar');
  assert.equal(await page.locator('#rightDrawerPane-'+destination+' #'+source).count(),1,source+' must move into the right drawer');
 }
 await page.locator('[data-right-tool="info"]').click();
 await page.waitForFunction(()=>document.getElementById('rightPanel').getBoundingClientRect().width>300);
 assert.equal(await page.locator('.right-drawer-pane:visible').count(),1);
 assert.equal(await page.locator('[data-right-tool="info"]').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#rightDrawerPane-info .section h2').isHidden(),true,'the repeated inner panel title should be hidden');
 assert.equal(await page.locator('#rightDrawerPane-info').getByText('Bilimsel kapsam').count(),0);
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 await page.screenshot({path:path.join(artifacts,'21-open-drawer-horizontal-toolbar.png'),animations:'disabled'});
 await page.setViewportSize({width:1100,height:800});
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 await page.setViewportSize({width:1480,height:920});
 await page.locator('[data-right-tool="info"]').click();
 await page.waitForFunction(()=>document.getElementById('rightPanel').getBoundingClientRect().width<60);
 assert.equal(await page.locator('#rightDrawerContent').isHidden(),true,'active icon must close its own drawer');
 await assertHorizontalQuickbar(page);
 assert.ok((await page.locator('#quickAtomScale').boundingBox()).width<=145,'atom size slider must be compact');
 assert.ok((await page.locator('#quickBondCut').boundingBox()).width<=145,'bond cutoff slider must be compact');
 assert.ok((await page.locator('#polyElement').boundingBox()).width<=160,'coordination center selector must be compact');
 await page.screenshot({path:path.join(artifacts,'20-compact-lower-toolbar.png'),animations:'disabled'});
 await page.locator('[data-right-tool="measurement"]').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'0');
 assert.equal(await page.locator('#historyToolCount').textContent(),'0');
 assert.equal(await page.locator('#rightDrawerPane-measurement #measurementHistory').count(),0,
  'the saved history list should be in its own drawer');
 assert.equal(await page.locator('#openMeasurementHistory').isVisible(),true,'the history shortcut should exist even with zero records');
 await page.evaluate(()=>window.__visualTest.select([0,1,2]));
 assert.equal(await page.locator('#measureList .measure-item').count(),3);
 assert.equal(await page.locator('#angleResult').isVisible(),true);
 const palette=await page.evaluate(()=>[
  '#measureList .measure-item','#distanceResult','#angleResult'
 ].map(selector=>getComputedStyle(document.querySelector(selector)).backgroundColor));
 assert.deepEqual(palette,['rgb(237, 244, 254)','rgb(237, 248, 241)','rgb(255, 241, 240)'],
  'atoms, distances and angles should have distinct gentle colors');
 await page.screenshot({path:path.join(artifacts,'22-measurement-pastel-cards.png'),animations:'disabled'});
 await page.locator('#saveMeasurement').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'1');
 assert.equal(await page.locator('#historyToolCount').textContent(),'1');
 await page.locator('#openMeasurementHistory').click();
 assert.equal(await page.locator('#rightDrawerPane-history').isVisible(),true);
 assert.equal(await page.locator('#measurementHistory .bond-rule-row').count(),1);
 await page.screenshot({path:path.join(artifacts,'23-measurement-history-drawer.png'),animations:'disabled'});
 await page.locator('#clearHistory').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'0');
 assert.equal(await page.locator('#historyToolCount').textContent(),'0');
 assert.match(await page.locator('#measurementHistory').textContent(),/Henüz kayıt yok/);
 await page.locator('[data-right-tool="measurement"]').click();
 await page.locator('#clearMeasure').click();
 await page.locator('[data-right-tool="measurement"]').click();
 const dockBounds=await page.locator('#workbenchQuickbar').boundingBox();
 const polyBounds=await page.locator('#polyNeighbors').boundingBox();
 assert.ok(polyBounds.y+polyBounds.height<=dockBounds.y+dockBounds.height-2,
  'coordination settings must not clip beneath the dock: '+JSON.stringify({dockBounds,polyBounds}));
 await save(page,'01-silicon-perspective',metrics);
 await page.getByRole('button',{name:'Üstten görünüm'}).click();
 await page.waitForTimeout(650);
 await save(page,'02-silicon-top',metrics);
 assert.notEqual(metrics['01-silicon-perspective'].sum,metrics['02-silicon-top'].sum,'camera view should change canvas pixels');
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('4335507'),null,{timeout:20000});
 await save(page,'03-cod-4335507',metrics);
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/browser/adp_visual.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('adp visual'),null,{timeout:20000});
 await page.locator('[data-quick-flag="adpVisible"]').click();
 assert.equal(await page.locator('#adpLevel').isEnabled(),true);
 await page.locator('#adpLevel').selectOption('90');
 await save(page,'04-adp-90',metrics);
 await page.locator('[data-right-tool="layers"]').click();
 await page.locator('#layerManager').getByLabel('Termal elipsoitler görünürlük').uncheck();
 await save(page,'05-adp-hidden',metrics);
 assert.notEqual(metrics['04-adp-90'].sum,metrics['05-adp-hidden'].sum,'ADP visibility should change canvas');
 await page.locator('[data-right-tool="miller"]').click();
 await page.locator('#showPlane').check();
 await page.locator('#applyPlane').click();
 await save(page,'06-miller',metrics);
 assert.notEqual(metrics['05-adp-hidden'].sum,metrics['06-miller'].sum,'Miller layer should change canvas');
 await page.locator('#morphPreset').click();
 await save(page,'07-cubic-morphology',metrics);
 assert.notEqual(metrics['06-miller'].sum,metrics['07-cubic-morphology'].sum,'morphology should affect rendering');
 await page.locator('[data-right-tool="comparison"]').click();
 await page.locator('#overlayFile').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#overlaySummary')?.textContent?.includes('1 ek'),null,{timeout:10000});
 await save(page,'08-two-crystals',metrics);
 assert.notEqual(metrics['07-cubic-morphology'].sum,metrics['08-two-crystals'].sum,'second CIF should change rendering');
 // A tiny XSF plane-wave field produces real isosurfaces on a simple Cartesian grid.
 const values=[];for(let k=0;k<4;k++)for(let j=0;j<4;j++)for(let i=0;i<4;i++)
  values.push(Math.exp(-((i-1.5)**2+(j-1.5)**2+(k-1.5)**2)));
 const xsf=['BEGIN_BLOCK_DATAGRID_3D','density','BEGIN_DATAGRID_3D_density',
  '4 4 4','0 0 0','3 0 0','0 3 0','0 0 3',values.join(' '),
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeFile').setInputFiles({name:'density.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf)});
 await page.locator('[data-right-tool="volume"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===1,null,{timeout:10000});
 await page.locator('#volumeIsoAdd').click();
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),2);
 const xsf2=['BEGIN_BLOCK_DATAGRID_3D','density2','BEGIN_DATAGRID_3D_density',
  '2 2 2','0 0 0','3 0 0','0 3 0','0 0 3','0 1 1 0 1 0 0 1',
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeAdditionalFile').setInputFiles({name:'second.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf2)});
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===2,null,{timeout:10000});
 await save(page,'09-two-volume-fields',metrics);
 assert.match(await page.locator('#volumeSliceStats').textContent(),/Å/);
 // Volumetric grids and iso layer controls belong to the current structure.
 await page.locator('#workspaceToggle').click();await page.locator('#workspaceAdd').click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),0);
 await page.locator('#workspaceToggle').click();await page.locator('#workspaceList .workspace-select').first().click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),2);
 await page.locator('#volumeActiveDataset').selectOption('0');
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),2);
 await page.locator('[data-right-tool="lattice"]').click();
 await page.locator('#moyoDetect').click();
 await page.waitForFunction(()=>{
  const result=document.getElementById('moyoResult')?.textContent||'';
  return result.startsWith('SG #')||result.startsWith('SG tayini başarısız:');
 },null,{timeout:30000});
 const moyoMessage=await page.locator('#moyoResult').textContent();
 assert.match(moyoMessage,/^SG #\d+.*Hall \d+/,
  'Moyo integration error: '+moyoMessage+'; browser console: '+consoleErrors.join(' | '));
 assert.equal(await page.locator('#moyoApplyConventional').isEnabled(),true);
 await page.locator('#moyoApplyConventional').click();
 assert.match(await page.locator('#moyoResult').textContent(),/Yeni atomlar P1 olarak saklandı/,
  'Moyo standardization must pass geometry/occupancy/ADP checks');
 await save(page,'10-moyo-space-group',metrics);
 // The dock mirrors the original left controls and updates the same state.
 assert.equal(await page.locator('#workbenchQuickbar').isVisible(),true);
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 for(const id of ['adpLevel','polyElement','polyCut','polyNeighbors']){
  assert.equal(await page.locator('#leftGeneralPane #'+id).count(),0,id+' must leave the left sidebar');
  assert.equal(await page.locator('#workbenchQuickbar #'+id).count(),1,id+' must appear in the dock');
 }
 assert.ok((await page.locator('#adpLevel').boundingBox()).width>=60,'ADP percentage must remain readable');
 assert.ok((await page.locator('#quickH').boundingBox()).width<=50,'Miller index inputs should fit three characters');
 await page.locator('#adpLevel').selectOption('50');
 const polyCenter=await page.locator('#polyElement option').nth(1).getAttribute('value');
 await page.locator('#polyElement').selectOption(polyCenter);
 assert.equal(await page.locator('#polyCut').isEnabled(),true);
 assert.equal(await page.locator('#polyNeighbors').isEnabled(),true);
 await page.locator('#polyCut').fill('3');await page.locator('#polyCut').press('Tab');
 await page.locator('#polyNeighbors').fill('8');await page.locator('#polyNeighbors').press('Tab');
 assert.equal(await page.locator('#polyElement').inputValue(),polyCenter);
 assert.equal(await page.locator('#polyNeighbors').inputValue(),'8');
 await page.locator('#polyElement').selectOption('');
 assert.equal(await page.locator('#polyCut').isDisabled(),true);
 await page.locator('#quickStyle').selectOption('space');
 assert.equal(await page.locator('#style').inputValue(),'space');
 await page.locator('#quickStyle').selectOption('ball');
 await page.locator('[data-quick-flag="labels"]').click();
 assert.equal(await page.locator('#labels').isChecked(),true);
 assert.equal(await page.locator('[data-quick-flag="labels"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-quick-flag="labels"]').click();
 assert.equal(await page.locator('[data-quick-flag="labels"]').getAttribute('aria-pressed'),'false');
 await page.locator('#quickAtomScale').evaluate(el=>{el.value='0.95';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await page.locator('#atomScale').inputValue(),'0.95');
 assert.equal(await page.locator('#quickAtomScaleVal').inputValue(),'0.95');
 await page.locator('#quickK').fill('0');await page.locator('#quickK').press('Tab');
 await page.locator('#quickL').fill('0');await page.locator('#quickL').press('Tab');
 await page.locator('#quickSlabThickness').fill('3');await page.locator('#quickSlabThickness').press('Tab');
 if(await page.locator('#quickShowPlane').getAttribute('aria-pressed')==='true')await page.locator('#quickShowPlane').click();
 await page.locator('#quickShowPlane').click();
 if(await page.locator('#quickRepeatMillerPlanes').getAttribute('aria-pressed')==='false')await page.locator('#quickRepeatMillerPlanes').click();
 await page.locator('#quickRepeatMillerPlanes').click();
 assert.equal(await page.locator('#quickShowPlane').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#quickRepeatMillerPlanes').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#h').inputValue(),'1');
 assert.equal(await page.locator('#k').inputValue(),'0');
 assert.equal(await page.locator('#l').inputValue(),'0');
 assert.equal(await page.locator('#slabThickness').inputValue(),'3');
 assert.equal(await page.locator('#showPlane').isChecked(),true);
 assert.equal(await page.locator('#repeatMillerPlanes').isChecked(),false);
 await page.locator('[data-right-tool="miller"]').click();
 assert.equal(await page.locator('#rightDrawerPane-miller #morphPreset').count(),1);
 assert.equal(await page.locator('#rightDrawerPane-lattice #morphPreset').count(),0);
 await page.locator('[data-right-tool="miller"]').click();
 await page.setViewportSize({width:650,height:760});
 assert.equal(await page.locator('#workbenchQuickbar').isVisible(),true);
 await assertHorizontalQuickbar(page,{mobile:true});
 await page.locator('#workbenchQuickbar').evaluate(dock=>{dock.scrollLeft=dock.scrollWidth;});
 assert.equal(await page.locator('#workbenchQuickbar').evaluate(dock=>{
  const miller=dock.querySelector('.quickbar-group:last-child').getBoundingClientRect();
  const viewport=dock.getBoundingClientRect();
  return miller.left>=viewport.left&&miller.right<=viewport.right;
 }),true,'horizontal scrolling must reveal the Miller controls');
 assert.equal(await page.evaluate(()=>document.getElementById('stage').getBoundingClientRect().bottom<=document.getElementById('workbenchQuickbar').getBoundingClientRect().top+1),true,'mobile dock must not cover WebGL drawing surface');
 await page.locator('[data-right-tool="symmetry"]').click();
 assert.equal(await page.locator('#rightDrawerPane-symmetry').isVisible(),true,'mobile drawer must open');
 await assertHorizontalQuickbar(page,{drawerOpen:true,mobile:true});
 assert.equal(await page.locator('.right-drawer-pane:visible').count(),1);
 await page.locator('[data-right-tool="symmetry"]').press('Escape');
 assert.equal(await page.locator('#rightDrawerContent').isHidden(),true,'Escape closes mobile drawer');
 await page.screenshot({path:path.join(artifacts,'11-mobile-quickbar.png'),animations:'disabled'});
 await page.locator('#libraryNav').click();
 await page.locator('#libSearchTab').click();
 assert.equal(await page.locator('#codSearchForm').isVisible(),true);
 const mobileColumns=await page.evaluate(()=>{
  const left=document.getElementById('codSearchForm').getBoundingClientRect();
  const right=document.getElementById('codResultsBox').getBoundingClientRect();
  return {leftBottom:left.bottom,rightTop:right.top,scrollWidth:document.getElementById('libSearchPane').scrollWidth,viewportWidth:innerWidth};
 });
 assert.ok(mobileColumns.rightTop>=mobileColumns.leftBottom-1,'mobile search results should stack below filters');
 assert.ok(mobileColumns.scrollWidth<=mobileColumns.viewportWidth+1,'mobile library should not overflow horizontally');
 await page.screenshot({path:path.join(artifacts,'15-mobile-library-search.png'),animations:'disabled'});
 await page.locator('#libPresetsTab').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),7);
 await page.screenshot({path:path.join(artifacts,'16-mobile-library-presets.png'),animations:'disabled'});
 // Worker responses can be OPTIMADE-prefixed or classic JSON; both must
 // populate scientific columns and the on-demand COD detail modal.
 await page.locator('#libWorkerTab').click();
 await page.locator('#codWorkerUrl').fill('https://fixture-cod-worker.example');
 await page.locator('#codWorkerSave').click();
 await page.route('https://fixture-cod-worker.example/api/**',route=>{
  const url=new URL(route.request().url());
  const attrs={
   _cod_formula:'- Ge4 In0.94 La4 Mn2 -',_cod_commonname:'lanthanum manganese indium germanide (4/2/1/4)',
   _cod_sg:'C 1 2/m 1',_cod_sgHall:'-C 2y',_cod_sgNumber:'12',
   _cod_a:16.646,_cod_siga:.002,_cod_b:4.419,_cod_sigb:.0006,_cod_c:7.4834,_cod_sigc:.001,
   _cod_alpha:90,_cod_beta:106.893,_cod_gamma:90,_cod_vol:526.72,_cod_sigvol:.12,
   _cod_authors:'Anton O. Oliynyk; Stanislav S. Stoyko; Arthur Mar',
   _cod_title:'Quaternary Germanides RE4Mn2InGe4',_cod_journal:'Inorganic Chemistry',
   _cod_year:'2013',_cod_volume:'52',_cod_firstpage:'8264',_cod_lastpage:'8271',
   _cod_doi:'10.1021/ic401171v',_cod_Rall:.0234,_cod_Robs:.0195,
   _cod_wRobs:.0406,_cod_wRref:.0417,_cod_gofref:1.054,
   _cod_celltemp:173,_cod_sigcelltemp:2,_cod_diffrtemp:173,_cod_sigdiffrtemp:2,
   _cod_wavelength:.71073,_cod_radType:'MoKα',_cod_flags:'has coordinates'
  };
  if(url.pathname==='/api/structures'){
   route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'4335507',attributes:attrs}]})});
  }else if(url.pathname==='/api/search'){
   const original=Object.fromEntries(Object.entries(attrs).filter(([key])=>key.startsWith('_cod_')).map(([key,value])=>[key.slice(5),value]));
   route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{file:'4335507',...original}])});
  }else route.abort();
 });
 await page.locator('#libSearchTab').click();
 await page.locator('#codConnection').selectOption('worker');
 await page.locator('#codId').fill('4335507');
 await page.locator('#codSubmit').click();
 await page.waitForFunction(()=>document.querySelector('#codResults .lib-cod-id')?.textContent==='4335507');
 assert.match(await page.locator('#codResults').textContent(),/C 1 2\/m 1/);
 assert.match(await page.locator('#codResults').textContent(),/526\.72/);
 assert.match(await page.locator('#codResults').textContent(),/Inorganic Chemistry/);
 await page.locator('.lib-cod-id').click();
 assert.equal(await page.locator('#codDetailModal').isVisible(),true);
 await page.waitForFunction(()=>document.getElementById('codDetailStatus').hidden);
 assert.match(await page.locator('#codDetailGroups').textContent(),/16\.646 ± 0\.002 Å/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/0\.71073 Å/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/8264 – 8271/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/Hayır/);
 await page.screenshot({path:path.join(artifacts,'24-cod-detail-worker.png'),animations:'disabled'});
 await page.locator('#codDetailClose').click();
 assert.equal(await page.locator('#codDetailModal').isHidden(),true);
 await page.locator('#languageEnglish').click();
 assert.equal(await page.locator('#libraryNav').textContent(),'Library');
 assert.match(await page.locator('#libSearchTab').textContent(),/Search COD/);
 await page.locator('.lib-cod-id').click();
 assert.match(await page.locator('#codDetailGroups').textContent(),/Structure parameters/);
 await page.locator('#codDetailClose').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('#homeLink').click();
 assert.deepEqual(errors,[],'uncaught browser exceptions');
 await fs.writeFile(path.join(artifacts,'metrics.json'),JSON.stringify(metrics,null,2));
 console.log('Real Chromium/WebGL screenshots and layer transitions passed:',metrics);
} finally {
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
