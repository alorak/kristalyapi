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
 await page.locator('#pwF200').click();
 assert.match(await page.locator('#pwPhasorSummary').textContent(),/F ≈ 0/,
  'for diamond Si, the forbidden 200 reflection cancels atom by atom');
 assert.ok(await page.locator('#pwPhasorSvg [data-phasor-arrow]').count()>=4);
 await page.locator('#pwF220').click();
 assert.match(await page.locator('#pwPhasorSummary').textContent(),/F ≠ 0/,
  'for diamond Si, 220 has a nonzero structure factor');
 await page.locator('#pwPeaks button').nth(1).evaluate(button=>button.click());
 // The live WebGL viewer can keep the page scrolling; dispatch the native
 // click directly after the two pointer-driven reflection preset checks.
 await page.locator('#pwUsePeak').evaluate(button=>button.click());
 const selectedPeak=await page.locator('#pwPeaks button.chosen').textContent();
 const selectedHkl=await page.locator('#pwPhasorSummary .lesson-metric').first().textContent();
 const peakHkl=selectedPeak.match(/\([^)]+\)/)?.[0];
 assert.ok(peakHkl&&selectedHkl.includes(peakHkl),'selected powder peak and phasor (hkl) must match');
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
 await page.locator('#scDualK').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.match(await page.locator('#scDualWeights').textContent(),/A 100[.,]0%/,
  'at the BZ edge, pure ionic detuning picks a definite orbital');
 assert.match(await page.locator('#scDualWeights').textContent(),/B 100[.,]0%/);
 assert.equal(await page.locator('#scDualChart [data-selected-band]').count(),2);
 await page.locator('#scDualChart').evaluate(svg=>{
  const p=svg.createSVGPoint();p.x=780;p.y=230;
  const screen=p.matrixTransform(svg.getScreenCTM());
  svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:screen.x,clientY:screen.y}));
 });
 assert.ok(Number(await page.locator('#scDualK').inputValue())>.8,
  'clicking the plot selects the corresponding Bloch wave vector');
 await page.locator('#scDualK').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#scDualMetal').evaluate(button=>button.click());
 assert.match(await page.locator('#scDualWeights').textContent(),/Bant temasında orbital karakteri tekil değildir|Orbital character is not unique at band touching/,
  'orbital labels are undefined at true band touching');
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

 // Guided P0 pathway: predict first, then apply a known physical model.
 await page.locator('#scGuideOne').evaluate(button=>button.click());
 await page.locator('#scGuidePrediction').evaluate(select=>{
  select.value='one';select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#scGuideCheck').evaluate(button=>button.click());
 assert.match(await page.locator('#scGuideFeedback').textContent(),/Doğru!/);
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),1);
 await page.locator('#scGuideNext').evaluate(button=>button.click());
 await page.locator('#scGuidePrediction').evaluate(select=>{
  select.value='sixteen';select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#scGuideCheck').evaluate(button=>button.click());
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),16);
 await page.locator('#scGuideNext').evaluate(button=>button.click());
 await page.locator('#scGuidePrediction').evaluate(select=>{
  select.value='gap';select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#scGuideCheck').evaluate(button=>button.click());
 assert.match(await page.locator('#scDualSummary').textContent(),/0[.,]800 eV/);
 // Manual interband excitation conserves one electron/hole pair at matching k.
 assert.equal(await page.locator('#scCarrierChart [data-carrier-hole]').count(),0);
 await page.locator('#scExcite').evaluate(button=>button.click());
 assert.equal(await page.locator('#scCarrierChart [data-carrier-electron]').count(),1);
 assert.equal(await page.locator('#scCarrierChart [data-carrier-hole]').count(),1);
 assert.match(await page.locator('#scCarrierSummary').textContent(),/0 · çiftler dengeli/);
 await page.locator('#scRecombine').evaluate(button=>button.click());
 assert.equal(await page.locator('#scCarrierChart [data-carrier-hole]').count(),0);
 // Fermi probabilities at the conduction/valence edges rise with T.
 assert.equal(await page.locator('#scThermalChart [data-thermal-curve]').count(),2);
 const roomEdge=await page.locator('#scEdgeSummary .lesson-metric').first().textContent();
 await page.locator('#scTemperature').evaluate(el=>{
  el.value='600';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 const hotEdge=await page.locator('#scEdgeSummary .lesson-metric').first().textContent();
 assert.notEqual(hotEdge,roomEdge,'thermal edge-state occupation must respond to temperature');
 await page.locator('#scFermi').evaluate(el=>{
  el.value='0.3';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 const edgeValues=await page.locator('#scEdgeSummary .lesson-metric strong').allTextContents();
 assert.notEqual(edgeValues[0],edgeValues[1],
  'non-midgap Fermi occupation does not force electron and hole probabilities equal');


 // P1 doping: intrinsic electron/hole equality, donor and acceptor
 // majority switches, mass-action/neutrality state and Fermi movement.
 const carrierBars=page.locator('#scDopingChart [data-doping-carrier]');
 assert.equal(await carrierBars.count(),2);
 const initialBars=await carrierBars.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.log10)));
 assert.ok(Math.abs(initialBars[0]-initialBars[1])<1e-10);
 const fermiY=()=>page.locator('#scDopingChart [data-doping-fermi]').getAttribute('y1');
 const intrinsicFermi=Number(await fermiY());
 await page.locator('#scDopingN').evaluate(button=>button.click());
 assert.equal(await page.locator('#scDopingN').getAttribute('aria-pressed'),'true');
 let nBars=await carrierBars.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.log10)));
 assert.ok(nBars[0]>nBars[1],'donor must create majority electrons');
 assert.ok(Number(await fermiY())<intrinsicFermi,'donor EF must move toward Ec (higher in SVG)');
 assert.match(await page.locator('#scDopingExplanation').textContent(),/Donörler/);
 await page.locator('#scDopingPrediction').selectOption('electrons');
 await page.locator('#scDopingCheck').evaluate(button=>button.click());
 assert.match(await page.locator('#scDopingFeedback').textContent(),/Doğru!/);
 await page.locator('#scDopingP').evaluate(button=>button.click());
 const pBars=await carrierBars.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.log10)));
 assert.ok(pBars[1]>pBars[0],'acceptor must create majority holes');
 assert.ok(Number(await fermiY())>intrinsicFermi,'acceptor EF must move toward Ev (lower in SVG)');
 const beforeDoping=await page.locator('#scDopingSummary').textContent();
 await page.locator('#scDopingExponent').evaluate(el=>{
  el.value='17';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.notEqual(await page.locator('#scDopingSummary').textContent(),beforeDoping);
 await page.locator('#scDopingIntrinsic').evaluate(button=>button.click());
 assert.equal(await page.locator('#scDopingExponent').isDisabled(),true);
 const thermalNi=await page.locator('#scDopingSummary .lesson-metric').nth(2).textContent();
 await page.locator('#scDopingTemp').evaluate(el=>{
  el.value='420';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.notEqual(await page.locator('#scDopingSummary .lesson-metric').nth(2).textContent(),thermalNi);

 // P2 PN depletion: field direction, bias width, asymmetric doping and
 // explicit qualitative (not numeric) pre-contact/diffusion stages.
 assert.equal(await page.locator('#scPnFieldChart [data-pn-field-curve]').count(),1);
 assert.equal(await page.locator('#scPnFieldChart [data-pn-potential-curve]').count(),1);
 assert.ok(await page.locator('#scPnChargeChart [data-pn-ion="acceptor"]').count()>0);
 assert.ok(await page.locator('#scPnChargeChart [data-pn-ion="donor"]').count()>0);
 const pnWidth=async()=>Number((await page.locator('#scPnSummary .lesson-metric')
  .nth(2).locator('strong').textContent()).replace(',','.').split(' ')[0]);
 const pnInitial=await pnWidth();
 await page.locator('#scPnBias').evaluate(input=>{
  input.value='0.3';input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.ok(await pnWidth()<pnInitial,'forward bias must narrow the depletion region');
 await page.locator('#scPnBias').evaluate(input=>{
  input.value='-0.4';input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.ok(await pnWidth()>pnInitial,'reverse bias must widen the depletion region');
 await page.locator('#scPnAcceptors').evaluate(input=>{
  input.value='15';input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#scPnDonors').evaluate(input=>{
  input.value='18';input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 const pSide=Number(await page.locator('#scPnChargeChart [data-pn-depletion="p"]').getAttribute('width'));
 const nSide=Number(await page.locator('#scPnChargeChart [data-pn-depletion="n"]').getAttribute('width'));
 assert.ok(pSide>nSide,'lower p-side doping must widen p-side depletion');
 await page.locator('#scPnSeparate').evaluate(button=>button.click());
 assert.equal(await page.locator('#scPnFieldChart [data-pn-field-curve]').count(),0,
  'two uncontacted pieces do not have a joint depletion profile');
 await page.locator('#scPnDiffuse').evaluate(button=>button.click());
 assert.equal(await page.locator('#scPnChargeChart [data-pn-diffusion]').count(),2);
 assert.equal(await page.locator('#scPnFieldChart [data-pn-field-curve]').count(),0,
  'transient diffusion does not pretend to have a solved electrostatic profile');
 await page.locator('#scPnSteady').evaluate(button=>button.click());
 assert.equal(await page.locator('#scPnFieldChart [data-pn-field-curve]').count(),1);
 await page.locator('#scPnPrediction').selectOption('p-to-n');
 await page.locator('#scPnCheck').evaluate(button=>button.click());
 assert.match(await page.locator('#scPnFeedback').textContent(),/Bir daha düşün/);
 await page.locator('#scPnPrediction').selectOption('n-to-p');
 await page.locator('#scPnCheck').evaluate(button=>button.click());
 assert.match(await page.locator('#scPnFeedback').textContent(),/Doğru!/);
 assert.deepEqual(errors,[],'lesson must not throw browser errors');
 console.log('Focused XRD Bragg/WebGL, atom-to-band and two-orbital gap labs passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
