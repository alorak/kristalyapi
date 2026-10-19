/* Focused real-Chromium teaching-lab smoke tests. Unlike visual.test.mjs this
 * avoids multi-thousand-atom benchmarks so lesson regressions fail quickly. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const type=file=>file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':
 file.endsWith('.wasm')?'application/wasm':file.endsWith('.svg')?'image/svg+xml':'text/html';
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':type(file)}).end(bytes);}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1480,height:940}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const {port}=server.address();
 await page.goto(`http://127.0.0.1:${port}/index.html`);
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#powderNav').click();
 await page.waitForFunction(()=>document.querySelectorAll('#pwPeaks button').length>1&&
  document.querySelectorAll('#pwWaveSvg path').length===3);
 const firstIntensity=await page.locator('#pwPhaseReadout .lesson-metric').last().textContent();
 assert.match(firstIntensity,/100[.,]0%/,'at Bragg incidence the two equal waves are in phase');
 const before=await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL());
 await page.locator('#pwTheta').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.notEqual(await page.locator('#pwPhaseReadout .lesson-metric').last().textContent(),firstIntensity);
 assert.notEqual(await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL()),before,
  '3D incident/diffracted directions must respond to theta');
 await page.locator('#pwMatchBragg').click();
 assert.equal(await page.locator('#pwPhaseReadout .lesson-metric').last().textContent(),firstIntensity);
 const waveBefore=await page.locator('#pwWaveSvg path').last().getAttribute('d');
 await page.locator('#pwWavePlay').click();
 await page.waitForTimeout(160);
 assert.notEqual(await page.locator('#pwWaveSvg path').last().getAttribute('d'),waveBefore);
 await page.locator('#pwWavePlay').click();
 assert.equal(await page.locator('#pwWavePlay').getAttribute('aria-pressed'),'false');
 assert.deepEqual(errors,[],'lesson must not throw browser errors');
 console.log('Focused XRD Bragg and WebGL lesson passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
