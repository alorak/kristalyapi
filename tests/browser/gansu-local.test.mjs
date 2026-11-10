// Real Chromium/P0.2 science smoke: executes pinned GANSU SCF+WASM, not a mocked solver.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const required=[
 'vendor/gansu-lite/scf-worker.js',
 'vendor/gansu-lite/basis/sto-3g.gbs',
 'vendor/gansu-lite/wasm/wasm_eri_bg.wasm',
 'vendor/gansu-lite/wasm/wasm_eri_simd_bg.wasm'
];
for(const asset of required)assert.ok((await fs.stat(path.join(root,asset))).size>10000,asset+' must be locally staged before acceptance');
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{
  const bytes=await fs.readFile(file);
  const type=file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[],outsiders=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:'+server.address().port+'/'))outsiders.push(req.url());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html#dft/tarayici');
 await page.waitForFunction(()=>!document.getElementById('dft-tarayici').hidden&&document.querySelector('#browserDftXyz')?.value.startsWith('2\n'));
 assert.equal(await page.locator('#browserDftFunctional').inputValue(),'SVWN');
 assert.equal(await page.locator('#browserDftRun').isEnabled(),true);
 await page.locator('#browserDftRun').click();
 await page.waitForFunction(()=>document.getElementById('browserDftRun')?.disabled===false,{timeout:110000});
 const status=await page.locator('#browserDftEngineStatus').textContent();
 assert.match(status,/WASM doğrulandı.*SCF/,'actual WASM SCF must complete: '+status);
 const energyText=await page.locator('#browserDftResults .browser-dft-energy').textContent();
 const energy=Number(energyText.split(' ')[0]);
 assert.ok(Number.isFinite(energy)&&energy< -0.4&&energy> -2.5,'real H2 total energy must be a plausible negative Hartree value: '+energy);
 const table=await page.locator('#browserDftResults').textContent();
 assert.match(table,/Mulliken/);
 assert.match(table,/HOMO/);
 const dl=page.waitForEvent('download');
 await page.locator('#browserDftExport').click();
 const downloaded=await dl;
 const content=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
 assert.equal(content.schema,'kristalyapi.gansu-run.v1');
 assert.equal(content.result.backend,'WASM');
 assert.equal(content.result.atoms.length,2);
 assert.equal(content.result.functional,'SVWN');
 assert.equal(content.result.energyHartree,energy);
 assert.deepEqual(outsiders,[],'runtime computation must not contact GANSU or any remote origin');
 assert.deepEqual(errors,[],'no unhandled page errors');
 // User-supplied Ni and spin-inconsistent molecules must fail without calculation.
 await page.locator('#browserDftXyzSource').selectOption('custom');
 await page.locator('#browserDftXyz').fill('1\nNi\nNi 0 0 0');
 await page.locator('#browserDftRun').click();
 assert.match(await page.locator('#browserDftEngineStatus').textContent(),/H–Ne/);
 assert.equal(await page.locator('#browserDftExport').isDisabled(),true);
 process.stdout.write('Real GANSU H2 Kohn-Sham WASM SCF: E='+energy.toFixed(9)+' Ha, backend=WASM; offline-local runtime verified.\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
