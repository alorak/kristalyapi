/* Materials Project Library integration in Chromium, using ONLY synthetic API fixtures.
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
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
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
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#languageTurkish').click();
 await page.locator('#libraryNav').click();
 await page.locator('#libMpSettingsTab').click();
 assert.equal(await page.locator('#libMpSettingsPane').isVisible(),true);
 await page.locator('#mpApiKey').fill('synthetic-secret-never-save');
 await page.locator('#mpKeySave').click();
 assert.equal(await page.locator('#mpApiKey').inputValue(),'');
 await page.locator('#libMpTab').click();
 await page.locator('#mpQuery').fill('Si');
 await page.locator('#mpSearchSubmit').click();
 await page.waitForFunction(()=>document.querySelectorAll('#mpResults article').length===1);
 assert.match(await page.locator('#mpResults').textContent(),/mp-149/);
 await page.locator('#mpResults input[type=checkbox]').check();
 assert.ok(await page.locator('#mpCompare table tbody tr').count()>=8);
 await page.locator('#mpResults button').nth(1).click();
 await page.waitForFunction(()=>window.location.hash==='#toz-kirinimi',{timeout:30000});
 assert.ok(requests.length>=2,'summary and structure requests required');
 for(const item of requests){
  assert.equal(item.headers['x-api-key'],'synthetic-secret-never-save');
  assert.ok(!item.url.includes('synthetic-secret-never-save'));
 }
 const saved=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
 assert.ok(!saved.includes('synthetic-secret-never-save'),'secret must not persist in browser storage');
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
