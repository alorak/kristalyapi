/* P0 UI smoke: synthetic observed scan derived from an actual model peak.
 * This proves browser wiring, NOT instrument calibration or phase identity. */
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
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1480,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#materialsNav').click();
 await page.waitForFunction(()=>!document.getElementById('materialsPage').hidden);
 await page.locator('#materialsMlP12Run').click();
 await page.waitForFunction(()=>{
  const x=document.getElementById('materialsMlP12Status')?.textContent||'';
  return x.includes('completed')||x.includes('tamamlandı')||x.includes('failed')||x.includes('çalıştırılamadı');
 },null,{timeout:45000});
 assert.match(await page.locator('#materialsMlP12Result').textContent(),/phase|Faz|Polimorf|bond|Bağ|MAE/);
 assert.equal(await page.locator('#materialsMlP12Run').isDisabled(),false);
 assert.equal(await page.locator('#materialsTabCards').getAttribute('aria-selected'),'true');
 await page.locator('#materialsTabCards').focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#materialsTabCompare').getAttribute('aria-selected'),'true',
  'section tabs support keyboard navigation');
 await page.locator('#materialsTabMl').click();
 await page.locator('#materialsMlTabP1').click();
 assert.equal(await page.locator('#materialsMlPaneP0').isHidden(),true);
 await page.locator('#materialsMlP1Run').click();
 await page.waitForFunction(()=>{
  const v=document.getElementById('materialsMlP1Result')?.textContent||'';
  const status=document.getElementById('materialsMlP1Status')?.textContent||'';
  return v.includes('MAE')||status.includes('failed')||status.includes('hatası');
 },null,{timeout:30000});
 assert.match(await page.locator('#materialsMlP1Result').textContent(),/MAE|eV\/atom/);
 assert.equal(await page.locator('#materialsMlP1Run').isDisabled(),false);
 await page.locator('#materialsMlTabP12').click();
 assert.equal(await page.locator('#materialsMlP12Run').isVisible(),true);
 assert.equal(await page.locator('#materialsMlP1Run').isHidden(),true);
 await page.locator('#materialsMlTabP0').click();
 await page.locator('#materialsMlRun').click();
 await page.waitForFunction(()=>document.getElementById('materialsMlResult')?.textContent?.includes('Matbench'),null,{timeout:30000});
 assert.match(await page.locator('#materialsMlResult').textContent(),/MAE|eV/);
 assert.equal(await page.locator('#materialsMlRun').isDisabled(),false);
 await page.locator('#materialsTabCards').click();
 await page.locator('#materialsReference').fill('synthetic browser test');
 await page.locator('#materialsAdd').click();
 await page.waitForFunction(()=>document.querySelectorAll('#materialsCards article').length===1);
 await page.locator('#materialsAdd').click();
 await page.waitForFunction(()=>document.querySelectorAll('#materialsCards article').length===2);
 await page.locator('#materialsTabCompare').click();
 assert.ok(await page.locator('#materialsComparison table tbody tr').count()>=9);
 assert.equal(await page.locator('#materialsComparison').isVisible(),true);
 await page.locator('#materialsTabEvidence').click();
 assert.equal(await page.locator('#materialsEvidenceChoose').isVisible(),true);
 await page.locator('#materialsEvidenceSource').fill('synthetic-qa-1');
 await page.locator('#materialsEvidenceFile').setInputFiles({
  name:'source.cif',mimeType:'text/plain',buffer:Buffer.from('data_test\n')
 });
 await page.waitForFunction(()=>document.getElementById('materialsEvidenceStatus')?.textContent?.includes('SHA-256'));
 assert.match(await page.locator('#materialsCards article').first().textContent(),/SHA-256/);
 await page.locator('#materialsTabCards').click();
 const evidenceDownload=page.waitForEvent('download');
 await page.locator('#materialsExportJson').click();
 assert.equal((await evidenceDownload).suggestedFilename(),'materials-evidence.json');
 await page.locator('#materialsTabBulk').click();
 await page.locator('#materialsBulkPrepare').click();
 assert.match(await page.locator('#materialsBulkResult').textContent(),/non-executable|slab|3B|3D/i);
 await page.locator('#materialsTabCards').click();
 const download=page.waitForEvent('download');
 await page.locator('#materialsExportCsv').click();
 assert.equal((await download).suggestedFilename(),'materials-comparison.csv');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#materialsTabMl').click();
 assert.ok(await page.locator('#materialsTabs').evaluate(n=>n.scrollWidth>n.clientWidth),
  'five section tabs must be scrollable on narrow mobile viewports');
 assert.equal(await page.locator('#materialsMlTabP0').isVisible(),true);
 await page.setViewportSize({width:1480,height:940});
 await page.locator('#homeLink').click();
 await page.locator('[data-right-tool="xrd"]').click();
 await page.locator('#analyzeXrd').click();
 const rows=await page.locator('#xrdResults .bond-rule-row').allTextContents();
 assert.ok(rows.length>0,'XRD model must generate peaks');
 const selected=rows.map(s=>({angle:Number(s.match(/·\s*([\d.]+)°/)?.[1]),
  relative:Number(s.match(/·\s*([\d.]+)%/)?.[1])}))
  .find(p=>Number.isFinite(p.angle)&&p.relative>=10);
 assert.ok(selected,'model should contain a sufficiently strong peak');
 const csv=['2theta_deg,intensity'];
 for(let i=0;i<=1800;i++){
  const angle=i*.05,intensity=3+100*Math.exp(-.5*((angle-selected.angle)/.15)**2);
  csv.push(angle.toFixed(2)+','+intensity.toFixed(7));
 }
 await page.locator('#xrdMeasuredFile').setInputFiles({
  name:'synthetic-p0.csv',mimeType:'text/csv',buffer:Buffer.from(csv.join('\n'))
 });
 await page.waitForFunction(()=>document.getElementById('xrdMeasuredStatus')?.textContent?.includes('synthetic-p0.csv'));
 await page.locator('#xrdMatchConfirmed').check();
 await page.locator('#xrdMatchRun').click();
 assert.match(await page.locator('#xrdMatchStatus').textContent(),/Sample ID|metadata/i);
 await page.locator('#xrdSampleId').fill('test-S01');
 await page.locator('#xrdInstrument').fill('Synthetic instrument');
 await page.locator('#xrdCalibration').selectOption('standard-recorded');
 await page.locator('#xrdCalibrationRef').fill('Synthetic silicon reference');
 await page.locator('#xrdMatchConfirmed').check();
 await page.locator('#xrdMatchTolerance').fill('0.25');
 await page.locator('#xrdMatchRun').click();
 assert.ok(await page.locator('#xrdMatchResults .bond-rule-row').count()>=1,'synthetic model peak should match');
 assert.equal(await page.locator('#xrdMatchExport').isDisabled(),false);
 assert.equal(await page.locator('#xrdMatchEvidenceExport').isDisabled(),false);
 const xrdEvidenceDownload=page.waitForEvent('download');
 await page.locator('#xrdMatchEvidenceExport').click();
 assert.equal((await xrdEvidenceDownload).suggestedFilename(),'xrd_match_evidence.json');
 await page.locator('#xrdLambda').fill('1.6');
 await page.locator('#xrdLambda').dispatchEvent('change');
 assert.equal(await page.locator('#xrdMatchConfirmed').isChecked(),false,'changed wavelength must invalidate user confirmation');
 assert.equal(await page.locator('#xrdMatchExport').isDisabled(),true,'stale screening report must not export');
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
