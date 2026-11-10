/* Materials Project Library integration in Chromium, using ONLY synthetic API fixtures.\n * Verifies the explicitly requested persistent browser credential and erase flow.
 * No real API key, network material data or experimental result is used. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mime=file=>file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':
 file.endsWith('.wasm')?'application/wasm':file.endsWith('.svg')?'image/svg+xml':'text/html';
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=path.resolve(base,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime(file)}).end(await fs.readFile(file));}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1480,height:940}});
 const errors=[],requests=[],consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')consoleErrors.push(msg.text());});
 await page.route('https://api.materialsproject.org/materials/summary/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const allow={'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS',
   'access-control-allow-headers':'X-API-KEY,Accept','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:allow});return;}
  requests.push({url:req.url(),headers:req.headers()});
  const summary={material_id:'mp-149',formula_pretty:'Si',nsites:2,symmetry:{symbol:'Fd-3m',number:227},
   band_gap:.61,is_gap_direct:false,formation_energy_per_atom:0,energy_above_hull:0,density:2.33};
  const structure={lattice:{matrix:[[5.43,0,0],[0,5.43,0],[0,0,5.43]]},
   sites:[{abc:[0,0,0],species:[{element:'Si',occu:1}]},
    {abc:[.25,.25,.25],species:[{element:'Si',occu:1}]}]};
  const data=url.searchParams.get('_fields')?.split(',').includes('structure')?
   [{...summary,structure}]:[summary];
  await route.fulfill({status:200,headers:allow,body:JSON.stringify({data})});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 try{
  await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:15000});
 }catch(error){
  console.error('Editor bootstrap diagnostics',await page.evaluate(()=>({
   hash:location.hash,status:document.querySelector('#renderStatus')?.textContent,
   fallback:!document.querySelector('#webglFallback')?.hidden,
   editorVisible:!document.querySelector('#app')?.hidden,
   libraryBound:typeof document.querySelector('#libPresetsTab')?.onclick==='function',
   canvases:document.querySelectorAll('#stage canvas').length
  })),{consoleErrors,errors});
  throw error;
 }
 await page.locator('#languageTurkish').click();
 await page.locator('#libraryNav').click();
 await page.locator('#libMpSettingsTab').click();
 assert.equal(await page.locator('#libMpSettingsPane').isVisible(),true);
 await page.locator('#mpApiKey').fill('synthetic-secret-local-only');
 await page.locator('#mpKeySave').click();
 assert.equal(await page.locator('#mpApiKey').inputValue(),'');
 const savedKey=await page.evaluate(()=>localStorage.getItem('kristalyapi.materials-project-api-key.v1'));
 assert.equal(savedKey,'synthetic-secret-local-only','key should persist in localStorage');
 await page.reload();
 // The hash remains #kutuphane. The library must initialize independently
 // without starting the 3D editor merely to restore Materials Project settings.
 await page.waitForFunction(()=>location.hash==='#kutuphane'&&
  typeof document.getElementById('libMpSettingsTab')?.onclick==='function');
 assert.equal(await page.locator('#libraryPage').isVisible(),true);
 assert.equal(await page.locator('#stage canvas').count(),0,
  'library reload must not create a hidden WebGL canvas');
 await page.locator('#libraryNav').click();
 await page.locator('#libMpSettingsTab').click();
 assert.equal(await page.locator('#mpApiKey').inputValue(),'','stored key must never appear in password input');
 assert.match(await page.locator('#mpKeyStatus').textContent(),/kalıcı|persistently/i);
 await page.locator('#libMpTab').click();
 await page.locator('#mpQuery').fill('Si');
 await page.locator('#mpSearchSubmit').click();
 await page.waitForFunction(()=>document.querySelectorAll('#mpResults article').length===1);
 assert.match(await page.locator('#mpResults').textContent(),/mp-149/);
 await page.locator('#mpResults input[type=checkbox]').check();
 assert.ok(await page.locator('#mpCompare table tbody tr').count()>=8);
 // Actual MP export format, but SYNTHETIC numerical fixture. Never claim a live MP download.
 const sample={schema:'kristalyapi.mp-electronic.v1',provider:'Materials Project',
  material_id:'mp-149',retrieved_at:'2026-11-10T12:00:00Z',mp_api_version:'test',
  path_type:'setyawan_curtarolo',provenance:{band_task_id:null,dos_task_id:null},
  band:{efermi_ev:5,distance_inv_angstrom:[0,.5,1],labels:[{index:0,label:'Γ'},{index:2,label:'X'}],
   first_band:1,total_bands:2,spins:{up:[[4,4.5,5],[6,6.5,7]]}},
  dos:{efermi_ev:5.1,energy_ev:[4.1,5.1,6.1],spins:{up:[0,1,2]},
   pdos:[{element:'Si',orbital:'p',spins:{up:[0,0.3,0.7]}}]}};
 const [chooser]=await Promise.all([
  page.waitForEvent('filechooser'),page.locator('#mpResults button').nth(2).click()
 ]);
 await chooser.setFiles({name:'mp-149-electronic.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(sample))});
 await page.waitForFunction(()=>document.querySelectorAll('#mpElectronicPreview svg').length===2);
 assert.match(await page.locator('#mpElectronicStatus').textContent(),/mp-149/);
 assert.equal(await page.locator('#mpElectronicPreview svg').count(),2);
 assert.equal(await page.locator('#mpElectronicPreview [data-mp-fermi]').count(),2,
  'both real-data panels should show their own Fermi zero');
 assert.equal(await page.locator('#mpElectronicPreview .mp-electronic-spin-row').count(),1);
 const dosMode=page.locator('#mpElectronicPreview select[data-mp-dos-mode]');
 await dosMode.selectOption('p0');
 assert.match(await page.locator('#mpElectronicPreview').textContent(),/projeksiyon|projection/);
 await dosMode.selectOption('cumulative');
 assert.match(await page.locator('#mpElectronicPreview').textContent(),/Trapez|Trapezoidal/);
 await page.locator('#mpElectronicPreview select[data-mp-energy-window]').selectOption('near');
 assert.equal(await page.locator('#mpElectronicPreview svg').first().getAttribute('data-y-min'),'-3');
 assert.equal(await page.locator('#mpElectronicPreview svg').first().getAttribute('data-y-max'),'3');
 await page.locator('#dftNav').click();
 await page.locator('#dft-tab-tarayici').click();
 await page.waitForFunction(()=>document.querySelectorAll('#browserMpReferencePlots svg').length===2);
 assert.equal(await page.locator('#browserMpReferencePlots svg').count(),2);
 assert.equal(await page.locator('#browserMpReferencePlots [data-mp-fermi]').count(),2);
 assert.match(await page.locator('#browserMpReferencePlots').textContent(),/mp-149/);
 await page.locator('#libraryNav').click();
 await page.locator('#libMpTab').click();
 await page.locator('#mpResults button').nth(1).click();
 await page.waitForFunction(()=>window.location.hash==='#toz-kirinimi',{timeout:30000});
 assert.ok(requests.length>=2,'summary and structure requests required');
 for(const item of requests){
  assert.equal(item.headers['x-api-key'],'synthetic-secret-local-only');
  assert.ok(!item.url.includes('synthetic-secret-local-only'));
 }
 // Opt-in proxy path: exercise 2026 AlphaIDs in search AND crystal import.
 const alphaId='mp-aaaaaczy';
 const alphaStructure={
  lattice:{matrix:[[4,0,0],[0,4,0],[0,0,4]]},
  sites:[{abc:[0,0,0],species:[{element:'Si',occu:1}]},
   {abc:[.25,.25,.25],species:[{element:'Si',occu:1}]}]
 };
 const gatewayCalls=[];
 await page.route('https://kristalyapi-cod-api.aoakkirman.workers.dev/health',route=>
  route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},
   body:JSON.stringify({status:'ok',version:'1.4',materialsProjectProxy:true,materialsProjectAlphaIds:true})}));
 await page.route('https://kristalyapi-cod-api.aoakkirman.workers.dev/api/mp/summary**',async route=>{
  const req=route.request();
  const allow={'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS',
   'access-control-allow-headers':'X-API-KEY,Accept','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:allow});return;}
  gatewayCalls.push({url:req.url(),headers:req.headers()});
  const needsStructure=new URL(req.url()).searchParams.get('_fields')?.split(',').includes('structure');
  await route.fulfill({status:200,headers:allow,body:JSON.stringify({data:[{
   material_id:alphaId,formula_pretty:'Si',nsites:2,band_gap:0.6,
   ...(needsStructure?{structure:alphaStructure}:{})
  }]})});
 });
 await page.locator('#libraryNav').click();
 await page.locator('#libMpSettingsTab').click();
 await page.locator('#mpUseWorker').check();
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.materials-project-worker-opt-in.v1')),'1');
 await page.locator('#libMpTab').click();
 await page.locator('#mpQuery').fill('Si');
 await page.locator('#mpSearchSubmit').click();
 await page.waitForFunction(()=>document.getElementById('mpSearchStatus')?.dataset.state==='ready');
 assert.equal(gatewayCalls.length,1);
 assert.equal(gatewayCalls[0].headers['x-api-key'],'synthetic-secret-local-only');
 assert.ok(!gatewayCalls[0].url.includes('synthetic-secret-local-only'));
 assert.match(await page.locator('#mpResults').textContent(),/mp-aaaaaczy/);
 await page.locator('#mpResults button').first().click();
 await page.waitForFunction(id=>
  document.getElementById('mpSearchStatus')?.textContent.includes(id)&&
  document.getElementById('mpSearchStatus')?.dataset.state==='ready',alphaId);
 assert.equal(gatewayCalls.length,2,'AlphaID structure import must use Worker');
 assert.equal(new URL(gatewayCalls[1].url).searchParams.get('material_ids'),alphaId);
 assert.equal(gatewayCalls[1].headers['x-api-key'],'synthetic-secret-local-only');
 assert.ok(!gatewayCalls[1].url.includes('synthetic-secret-local-only'));
 await page.locator('#libraryNav').click();
 await page.locator('#libMpSettingsTab').click();
 await page.locator('#mpUseWorker').uncheck();
 await page.locator('#mpKeyClear').click();
 const erasedKey=await page.evaluate(()=>localStorage.getItem('kristalyapi.materials-project-api-key.v1'));
 assert.equal(erasedKey,null,'Erase key should remove persistent browser storage');
 assert.match(await page.locator('#mpKeyStatus').textContent(),/girilmedi|configured/i);
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
