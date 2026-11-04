/* Sidebar interaction smoke in Chromium (no remote APIs or scientific computation). */
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
 const page=await browser.newPage({viewport:{width:1420,height:940}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#languageTurkish').click();
 await page.locator('#leftAtomsTab').click();
 await page.waitForFunction(()=>document.querySelectorAll('#siteRows .site-entry').length>0);
 assert.equal(await page.locator('#leftAtomsPane').isVisible(),true);
 assert.equal(await page.locator('#leftAtomsPane .site-table').count(),0);
 const first=page.locator('#siteRows .site-entry').first();
 assert.ok((await first.locator('.site-entry-name').textContent()).length>0);
 const controls=first.locator('.site-entry-coordinates input');
 assert.deepEqual(await controls.evaluateAll(nodes=>nodes.map(el=>el.name)),['x','y','z']);
 const top=await first.locator('.site-entry-head').boundingBox();
 const coords=await first.locator('.site-entry-coordinates').boundingBox();
 assert.ok(coords.y>top.y+top.height-2,'fractional coordinates should be directly beneath site heading');
 const square=await first.locator('.site-entry-color-input').boundingBox();
 assert.ok(Math.abs(square.width-square.height)<2,'color control must be square');
 assert.ok(square.width>=26&&square.width<=30,'color swatch must be compact');
 await first.locator('.site-entry-select').click();
 assert.equal(await first.locator('.site-entry-select').getAttribute('aria-pressed'),'true');
 assert.ok(await first.evaluate(el=>el.classList.contains('is-selected')),'row click should highlight the selected atom');
 assert.equal(await page.locator('#siteStyleSite').inputValue(),'0');
 await first.locator('.site-entry-select').click();
 assert.equal(await first.locator('.site-entry-select').getAttribute('aria-pressed'),'false');

 await first.locator('.site-entry-color-input').evaluate(el=>{
  el.value='#39bdf1';el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 assert.equal(await first.locator('.site-entry-color-input').inputValue(),'#39bdf1');
 assert.equal(await page.locator('#siteStyleColor').inputValue(),'#39bdf1');
 const coordinate=first.locator('input[name="x"]');
 await coordinate.fill('0.125');
 await coordinate.dispatchEvent('change');
 assert.equal(await page.locator('#siteRows .site-entry').first().locator('input[name="x"]').inputValue(),'0.1250');
 await page.locator('#languageEnglish').click();
 assert.match(await page.locator('#leftAtomsPane .site-list-summary').textContent(),/Atomic sites/);
 assert.match(await page.locator('#siteRows .site-entry').first().locator('.site-entry-sub').textContent(),/site/);
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
