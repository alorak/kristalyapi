/* Focused real-Chromium teaching-lab smoke tests. Unlike visual.test.mjs this
 * avoids multi-thousand-atom benchmarks so lesson regressions fail quickly. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.join(base,'tests/browser/artifacts');
await fs.mkdir(artifacts,{recursive:true});
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
 await page.locator('#semiconductorNav').click();
 await page.waitForFunction(()=>document.querySelectorAll('#scChainChart [data-energy-level]').length===8);
 assert.equal(await page.locator('#scChainChart [data-chain-atom]').count(),8,
  'the atom chain and its spectrum must share the same N');
 await page.locator('#scChainAtoms').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),2,
  'a two-atom chain produces exactly two orbital levels');
 assert.match(await page.locator('#scChainSummary').textContent(),/1[.,]600 eV/,
  'for N=2 the energy splitting must equal 2|t|');
 await page.locator('#scChainAtoms').evaluate(el=>{el.value='64';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),64,
  'N=64 must produce 64 discrete eigenstates');
 await page.locator('#scChainHopping').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.match(await page.locator('#scChainSummary').textContent(),/0[.,]000 eV/,
  'vanishing hopping restores the degenerate atomic levels');
 await page.locator('#scChainHopping').evaluate(el=>{el.value='0.8';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#scChainPlay').click();
 await page.waitForTimeout(790);
 assert.ok(Number(await page.locator('#scChainAtomsOutput').textContent())>=2,
  'the progression must advance beyond the single atom');
 await page.locator('#scChainPlay').click();
 assert.equal(await page.locator('#scChainPlay').getAttribute('aria-pressed'),'false');
 await page.locator('#scChainAtoms').evaluate(el=>{el.value='32';el.dispatchEvent(new Event('input',{bubbles:true}));});
 // Full-page screenshots are optional here: the larger visual regression suite
 // owns WebGL screenshots, while this focused smoke checks SVG + interactions.
 if(process.env.LESSON_SCREENSHOTS==='1'){
  await page.locator('#scChainChart').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifacts,'lesson-05-atom-to-band.png'),timeout:60000});
 }
 await page.waitForFunction(()=>document.querySelectorAll('#scDualChart [data-dual-band]').length===2);
 assert.equal(await page.locator('#scDualChart [data-dual-atom]').count(),12,
  'A/B repeated cells are visible');
 assert.match(await page.locator('#scDualSummary').textContent(),/0[.,]800 eV/,
  'unequal bonds open a 0.8 eV two-orbital gap');
 await page.locator('#scDualMetal').click();
 assert.match(await page.locator('#scDualSummary').textContent(),/0[.,]000 eV/,
  'uniform equal-energy A/B chain has band touching');
 assert.equal(await page.locator('#scDualChart [data-gap-region]').count(),0,
  'the forbidden interval vanishes when the bands touch');
 await page.locator('#scDualIonic').click();
 assert.match(await page.locator('#scDualSummary').textContent(),/1[.,]200 eV/,
  'on-site orbital energy difference opens the expected gap');
 assert.equal(await page.locator('#scDualChart [data-gap-region]').count(),1);
 await page.locator('#scDualDelta').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#scDualMetal').getAttribute('aria-pressed'),'false',
  'manual slider changes must clear the selected preset');
 // The large WebGL page can shift during Playwright's automatic scroll;
 // dispatch the same native button click after two real pointer preset checks.
 await page.locator('#scDualDimer').evaluate(button=>button.click());
 assert.equal(await page.locator('#scDualDimer').getAttribute('aria-pressed'),'true');
 // Capture the actual browser-rendered SVG DOM instead of taking a GPU
 // screenshot: Playwright's scroll-stability check can stall on WebGL pages.
 const renderedSvg=await page.locator('#scDualChart').evaluate(el=>new XMLSerializer().serializeToString(el));
 assert.match(renderedSvg,/data-dual-band="valence"/);
 assert.match(renderedSvg,/data-dual-band="conduction"/);
 await fs.writeFile(path.join(artifacts,'lesson-06-valence-conduction-gap.svg'),renderedSvg);
 assert.deepEqual(errors,[],'lesson must not throw browser errors');
 console.log('Focused XRD Bragg/WebGL, atom-to-band and two-orbital gap labs passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
