/* A deliberately WebGL-disabled Chromium must not break the library, DFT or navigation.
 * This tests graceful degradation only; real WebGL screenshots are tested separately. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{
  const type=/\.(?:m?js)$/.test(filename)?'text/javascript':
   filename.endsWith('.css')?'text/css':filename.endsWith('.wasm')?'application/wasm':'text/html';
  res.writeHead(200,{'Content-Type':type}).end(await fs.readFile(filename));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:840}});
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.addInitScript(()=>{
  window.__webglRequests=0;
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...options){
   if(['webgl2','webgl','experimental-webgl'].includes(String(kind))){
    window.__webglRequests++;
    return null;
   }
   return original.call(this,kind,...options);
  };
 });
 const base='http://127.0.0.1:'+server.address().port+'/index.html';
 // Library and DFT must be available without initializing the editor WebGL.
 await page.goto(base+'#kutuphane',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof document.getElementById('libPresetsTab')?.onclick==='function');
 assert.equal(await page.evaluate(()=>window.__webglRequests),0,
  'library landing must not attempt a WebGL context');
 assert.equal(await page.locator('#libraryPage').isVisible(),true);
 assert.equal(await page.locator('#webglFallback').isVisible(),false);
 await page.locator('#libPresetsTab').click();
 assert.equal(await page.locator('#libPresetsPane').isVisible(),true);
 await page.locator('#libMpSettingsTab').click();
 assert.equal(await page.locator('#libMpSettingsPane').isVisible(),true);
 await page.locator('#dftNav').click();
 await page.waitForFunction(()=>!document.getElementById('dft-hazirlik')?.hidden);
 assert.equal(await page.evaluate(()=>window.__webglRequests),0,
  'DFT landing must not require the editor canvas');
 assert.equal(await page.locator('#app').isVisible(),false);
 // Opening the editor must fail visibly, without crashing hash navigation.
 await page.locator('#homeLink').click();
 await page.waitForFunction(()=>document.getElementById('webglFallback')?.hidden===false);
 assert.ok(await page.evaluate(()=>window.__webglRequests)>0,
  'editor should attempt WebGL on demand');
 assert.equal(await page.locator('#webglFallback').isVisible(),true);
 assert.match(await page.locator('#renderStatus').textContent(),/3B başlatılamadı/);
 assert.equal(await page.locator('#webglRetry').isVisible(),true);
 assert.equal(await page.locator('#stage canvas').count(),0,
  'failed scene must not leave an unusable canvas');
 // Route remains usable and an import is rejected, not partially applied.
 await page.locator('#libraryNav').click();
 await page.locator('#libPresetsTab').click();
 await page.locator('#importPreset').click();
 assert.equal(new URL(page.url()).hash,'#kutuphane');
 assert.equal(await page.locator('#libPresetsPane').isVisible(),true);
 assert.deepEqual(pageErrors,[],pageErrors.join('\n'));
 console.log('WebGL-disabled Chromium: library, DFT, graceful editor error and return navigation passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
