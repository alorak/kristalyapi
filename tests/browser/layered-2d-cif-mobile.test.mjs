/* Mobile portrait layout + true CIF-sourced 2D figures with WebGL disabled. */
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
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__webglAttempts=0;
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   if(['webgl2','webgl','experimental-webgl'].includes(type)){window.__webglAttempts++;return null;}
   return original.call(this,type,...args);
  };
 });
 const base='http://127.0.0.1:'+server.address().port+'/index.html';
 await page.goto(base+'#katmanli-figur',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('app')?.hidden);
 assert.equal(await page.locator('#layered2dSourceMode').inputValue(),'cif');
 await page.evaluate(()=>{
  window.KristalLayeredHost={structure:()=>({
   name:'WS2_FromActiveCIF',workspace:'CIF workspace',symmetry:'P1',
   cell:{a:3.18,b:3.18,c:20,alpha:90,beta:90,gamma:120},
   sites:[{symbol:'W',x:0,y:0,z:.5},{symbol:'S',x:.333333,y:.666666,z:.58},{symbol:'S',x:.333333,y:.666666,z:.42}]
  })};
 });
 await page.locator('#layered2dRefresh').click();
 await page.waitForFunction(()=>document.querySelectorAll('#layered2dPreview g.cif-panel').length===2);
 assert.match(await page.locator('#layered2dActiveName').textContent(),/WS2_FromActiveCIF/);
 assert.match(await page.locator('#layered2dStatus').textContent(),/atom/);
 assert.equal(await page.evaluate(()=>window.__webglAttempts),0);
 const png=page.waitForEvent('download');
 await page.locator('#layered2dPngDownload').click();
 const pngFile=await png,bytes=await fs.readFile(await pngFile.path());
 assert.match(pngFile.suggestedFilename(),/\.png$/);
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const pdf=page.waitForEvent('download');
 await page.locator('#layered2dPdfDownload').click();
 const pdfFile=await pdf,data=await fs.readFile(await pdfFile.path());
 assert.match(pdfFile.suggestedFilename(),/\.pdf$/);
 assert.ok(data.toString('utf8',0,8).startsWith('%PDF-1.4'));
 assert.ok(data.toString('latin1').includes('%%EOF'));
 await page.goto(base+'#kristal',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('webglFallback')?.hidden===false);
 assert.equal(await page.locator('#rightPanel').isVisible(),false,'right icon rail should start closed');
 assert.equal(await page.locator('.language-switch').isVisible(),false);
 assert.equal(await page.locator('#openBtn span').isVisible(),false);
 await page.locator('#mobileToolsToggle').click();
 assert.equal(await page.locator('#rightPanel').isVisible(),true);
 assert.equal(await page.locator('#mobileToolsToggle').getAttribute('aria-expanded'),'true');
 await page.locator('#mobileToolsToggle').click();
 assert.equal(await page.locator('#rightPanel').isVisible(),false);
 await page.locator('#mobileNavToggle').click();
 assert.equal(await page.locator('#headerMainNav').isVisible(),true);
 await page.locator('#mobileNavToggle').click();
 assert.equal(await page.locator('#headerMainNav').isVisible(),false);
 const metrics=await page.evaluate(()=>{
  const quick=document.getElementById('workbenchQuickbar'),style=getComputedStyle(quick);
  return {viewportWidth:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
   quickWidth:quick.clientWidth,quickScroll:quick.scrollWidth,quickOverflow:style.overflowX,
   quickGrid:style.gridTemplateColumns,stageWidth:document.getElementById('stage').getBoundingClientRect().width};
 });
 assert.ok(metrics.documentWidth<=metrics.viewportWidth+2,JSON.stringify(metrics));
 assert.ok(metrics.quickScroll<=metrics.quickWidth+2,JSON.stringify(metrics));
 assert.ok(metrics.stageWidth>metrics.viewportWidth-20,JSON.stringify(metrics));
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log('Mobile portrait and live-CIF 2D: toggleable tool rail, no horizontal quickbar, PNG/PDF, no WebGL passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
