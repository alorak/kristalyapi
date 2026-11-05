/* Smoke-test the independent SVG figure route with WebGL forcibly unavailable. */
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
  const mime=/\.(?:m?js)$/.test(filename)?'text/javascript':
   filename.endsWith('.css')?'text/css':filename.endsWith('.wasm')?'application/wasm':'text/html';
  res.writeHead(200,{'Content-Type':mime}).end(await fs.readFile(filename));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.__glAttempts=0;
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
   if(['webgl2','webgl','experimental-webgl'].includes(kind)){window.__glAttempts++;return null;}
   return original.call(this,kind,...args);
  };
 });
 const url='http://127.0.0.1:'+server.address().port+'/index.html#katmanli-figur';
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#layered2dPreview g.mx2-panel').length===4);
 // The standalone SVG module can finish before crystal-app's navigation bootstrap.
 await page.waitForFunction(()=>document.getElementById('app')?.hidden===true);
 assert.equal(await page.locator('#layered2dPage').isVisible(),true);
 assert.equal(await page.locator('#app').isVisible(),false);
 assert.equal(await page.locator('#layered2dNav').getAttribute('aria-current'),'page');
 assert.equal(await page.evaluate(()=>window.__glAttempts),0,'figure page must never request WebGL');
 await page.locator('#layered2dMode').selectOption('top');
 assert.equal(await page.locator('#layered2dPreview g.mx2-panel').count(),2);
 await page.locator('#layered2dPhase').selectOption('1T');
 assert.equal(await page.locator('#layered2dPreview g.mx2-panel').count(),1);
 await page.locator('#layered2dNa').fill('3');
 await page.locator('#layered2dNb').fill('4');
 assert.match(await page.locator('#layered2dStatus').textContent(),/36 atom\/faz/);
 await page.locator('#layered2dBonds').uncheck();
 assert.equal(await page.locator('#layered2dPreview line[stroke="#8795a5"]').count(),0);
 const received=page.waitForEvent('download');
 await page.locator('#layered2dSvgDownload').click();
 const download=await received;
 assert.match(download.suggestedFilename(),/\.svg$/i);
 const content=await fs.readFile(await download.path(),'utf8');
 assert.match(content,/data-phase="1T" data-view="top"/);
 assert.ok(content.includes('<circle'));
 assert.ok(!content.includes('<image'));
 await page.locator('#layered2dNa').fill('7');
 assert.equal(await page.locator('#layered2dSvgDownload').isDisabled(),true);
 assert.equal(await page.locator('#layered2dStatus').getAttribute('data-state'),'error');
 assert.equal(await page.evaluate(()=>window.__glAttempts),0);
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log('2D MoS2 figure: WebGL-free route, modes, controls, bounds and SVG export passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
