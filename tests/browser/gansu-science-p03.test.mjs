// Real Chrome + same-origin GANSU WASM scientific benchmark evidence.
// For each preregistered molecule, triggers the actual KristalYapı UI and
// saves JSON exported by the app (no injected/mock SCF energies).
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/gansu/p03-molecules.json'),'utf8'));
const files=['vendor/gansu-lite/scf-worker.js','vendor/gansu-lite/basis/sto-3g.gbs',
 'vendor/gansu-lite/wasm/wasm_eri_bg.wasm','vendor/gansu-lite/wasm/wasm_eri_simd_bg.wasm'];
for(const file of files)assert.ok((await fs.stat(path.join(root,file))).size>10000,
 'Missing pinned WASM/GBS asset '+file);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const full=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{
  const bytes=await fs.readFile(full);
  const mime=full.endsWith('.js')?'text/javascript':full.endsWith('.wasm')?'application/wasm':
    full.endsWith('.css')?'text/css':full.endsWith('.svg')?'image/svg+xml':'text/html';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'}).end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const pageErrors=[],outside=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(origin+'/'))outside.push(r.url());});
 await page.goto(origin+'/index.html#dft/tarayici');
 await page.waitForFunction(()=>!document.getElementById('dft-tarayici')?.hidden);

 // The silicon sample must actually be visible and match the validation XYZ.
 await page.locator('#browserDftXyzSource').selectOption('sih4');
 assert.equal(await page.locator('#browserDftXyz').inputValue(),fixture.cases.find(c=>c.id==='sih4-pbe').xyz);
 const runs={};
 for(const c of fixture.cases){
  await page.locator('#browserDftXyzSource').selectOption('custom');
  await page.locator('#browserDftXyz').fill(c.xyz);
  await page.locator('#browserDftFunctional').selectOption(c.functional);
  await page.locator('#browserDftGrid').selectOption(c.grid);
  await page.locator('#browserDftCharge').fill(String(c.charge));
  await page.locator('#browserDftMultiplicity').fill(String(c.multiplicity));
  const t0=Date.now();
  await page.locator('#browserDftRun').click();
  await page.waitForFunction(()=>{
   const el=document.getElementById('browserDftEngineStatus');
   const status=el?.textContent||'';
   return status.includes('WASM doğrulandı')||status.startsWith('Yerel DFT başarısız')||status.startsWith('Hesap reddedildi');
  },null,{timeout:190000});
  const status=await page.locator('#browserDftEngineStatus').textContent();
  assert.match(status,/WASM doğrulandı/,'GANSU did not finish '+c.id+': '+status);
  assert.ok(await page.locator('#browserDftExport').isEnabled());
  const request=page.waitForEvent('download');
  await page.locator('#browserDftExport').click();
  const download=await request;
  const saved=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(saved.schema,'kristalyapi.gansu-run.v1');
  assert.equal(saved.settings.xyz,c.xyz);
  assert.equal(saved.settings.functional,c.functional);
  assert.equal(saved.result.functional,c.functional);
  assert.equal(saved.result.backend,'WASM');
  assert.equal(saved.result.atoms.length,Number(c.xyz.split('\n')[0]));
  assert.ok(Number.isFinite(saved.result.energyHartree)&&saved.result.energyHartree<0);
  assert.ok(saved.result.iterations>0);
  const sumCharges=saved.result.mullikenCharges.reduce((n,x)=>n+x,0);
  assert.ok(Math.abs(sumCharges-c.charge)<0.12,'Mulliken charge sum unexpectedly large: '+sumCharges);
  if(c.id.startsWith('sih4'))assert.ok(saved.result.energyHartree< -200&&saved.result.energyHartree> -400,
   'Silane energy is implausible in Hartree: '+saved.result.energyHartree);
  runs[c.id]=saved.result;
  process.stdout.write(c.id+': GANSU '+saved.result.energyHartree.toFixed(9)+
   ' Ha · '+saved.result.iterations+' iterations · '+((Date.now()-t0)/1000).toFixed(1)+' sec\n');
 }
 assert.deepEqual(outside,[],'no outside-origin requests during molecular calculations');
 assert.deepEqual(pageErrors,[],'no page errors');
 const output={schema:'kristalyapi.gansu-p03-browser-results.v1',
  upstreamCommit:fixture.upstreamGansuCommit,basis:'STO-3G',cases:runs};
 await fs.mkdir(path.join(root,'tests/browser/artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'tests/browser/artifacts/gansu-p03-browser-results.json'),
  JSON.stringify(output,null,2)+'\n','utf8');
 process.stdout.write('P0.3 complete: '+Object.keys(runs).length+' real molecular GANSU WASM SCF cases, verified local-only.\n');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
