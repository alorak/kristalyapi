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
 try{const content=await fs.readFile(filename);
  const type=filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.wasm')?'application/wasm':'text/html';
  res.writeHead(200,{'Content-Type':type}).end(content);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[],externalRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',request=>{if(request.url().includes('GANSU-Lite'))externalRequests.push(request.url());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html#dft/tarayici');
 await page.waitForFunction(()=>!document.querySelector('#dft-tarayici').hidden&&document.querySelectorAll('#browserTbBands polyline').length===2);
 assert.match(await page.locator('#browserTbStatus').textContent(),/Parametreli TB/);
 assert.equal(await page.locator('#browserTbDos polyline').count(),1);
 assert.equal(await page.locator('#browserDftGansuOpen').getAttribute('rel'),'noopener noreferrer');
 assert.equal(await page.locator('#browserDftXyz').inputValue().then(x=>x.split('\n')[0]),'2');
 assert.equal(externalRequests.length,0,'GANSU is never contacted automatically');
 // Active initial Si must be rejected: no invented graphene electronic structure.
 await page.locator('#browserTbSource').selectOption('active');
 await page.locator('#browserTbRun').click();
 assert.match(await page.locator('#browserTbStatus').textContent(),/Hesap başlatılmadı/);
 assert.equal(await page.locator('#browserTbCsvBands').isDisabled(),true);
 await page.locator('#browserTbSource').selectOption('demo');
 await page.locator('#browserTbRun').click();
 assert.equal(await page.locator('#browserTbBands polyline').count(),2);
 assert.equal(await page.locator('#browserTbCsvBands').isEnabled(),true);
 const pending=page.waitForEvent('download');
 await page.locator('#browserTbCsvBands').click();
 const downloaded=await pending;
 const filename=await downloaded.path();
 const content=await fs.readFile(filename,'utf8');
 assert.match(content,/nearest-neighbor pz TB, not DFT/);
 assert.match(content,/k_distance_inv_angstrom/);
 assert.deepEqual(errors,[],'no JS console page errors');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
