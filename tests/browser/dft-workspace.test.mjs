/* Real Chromium regression for mounted DFT forms, navigation and local results.
 * Does not submit jobs or claim scientific acceptance of the displayed file. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.join(root,'tests/browser/artifacts');
await fs.mkdir(artifacts,{recursive:true});
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
let browser,page;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[],apiRequests=[],dialogs=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(/\/api\/v1\/|\/health$/.test(new URL(request.url()).pathname))apiRequests.push(request.url());});
 page.on('dialog',async dialog=>{dialogs.push(dialog.type());await dialog.dismiss();});
 const base=`http://127.0.0.1:${server.address().port}/index.html`;
 await page.goto(base+'#dft');
 await page.waitForFunction(()=>!document.getElementById('dft-hazirlik').hidden&&document.getElementById('dftStructureDetail').textContent.includes('Si'));
 assert.equal(await page.locator('#app').isVisible(),false);
 assert.equal(await page.locator('#dftNav').getAttribute('aria-current'),'page');
 assert.equal(await page.locator('#qeJobSubmit').count(),1);
 await page.locator('#languageTurkish').click();
 await page.locator('#qeEcutwfc').fill('65');
 await page.locator('#qeJobProfile').fill('retained-profile');
 await page.locator('#qeJobWorkflow').selectOption('electronic');
 assert.equal(await page.locator('#qeElectronicSettings').isVisible(),true);
 await page.locator('[data-dft-section="isler"]').click();
 await page.waitForFunction(()=>!document.getElementById('dft-isler').hidden);
 assert.equal(await page.locator('#qeJobPause').isDisabled(),true);
 assert.equal(await page.locator('#qeJobResume').isDisabled(),true);
 assert.match(await page.locator('#dftJobSettings').textContent(),/65 Ry.*retained-profile/);
 await page.locator('#qeJobRefresh').click();
 assert.match(await page.locator('#qeJobStatus').textContent(),/Bu sekmede takip edilen bir iş yok/);
 await page.locator('[data-dft-section="sonuclar"]').click();
 await page.locator('#qeElectronicFile').setInputFiles(path.join(root,'validation-results/qe-mos2-d4-20261029-amd64/cases/electronic/pipeline/electronic-results.json'));
 await page.locator('#qeElectronicOpen').click();
 await page.waitForFunction(()=>document.querySelectorAll('#qeElectronicCharts svg').length===3);
 assert.match(await page.locator('#qeElectronicStatus').textContent(),/26.*3677/);
 const fileName=await page.locator('#qeElectronicFile').evaluate(el=>el.files[0].name);
 await page.locator('[data-dft-section="yakinsama"]').click();
 await page.locator('[data-dft-section="kusurlar"]').click();
 await page.locator('#homeLink').click();
 await page.waitForFunction(()=>!document.getElementById('app').hidden);
 assert.equal(await page.locator('#app').isVisible(),true);
 await page.locator('#dftNav').click();
 await page.waitForFunction(()=>!document.getElementById('dft-hazirlik').hidden);
 assert.equal(await page.locator('#qeEcutwfc').inputValue(),'65');
 assert.equal(await page.locator('#qeJobProfile').inputValue(),'retained-profile');
 assert.equal(await page.locator('#qeJobWorkflow').inputValue(),'electronic');
 await page.locator('[data-dft-section="sonuclar"]').click();
 assert.equal(await page.locator('#qeElectronicCharts svg').count(),3);
 assert.equal(await page.locator('#qeElectronicFile').evaluate(el=>el.files[0].name),fileName);
 await page.goBack();
 await page.waitForFunction(()=>!document.getElementById('dft-hazirlik').hidden);
 await page.locator('#languageEnglish').click();
 assert.equal(await page.locator('#dft-title-hazirlik').textContent(),'Calculation setup');
 await page.screenshot({path:path.join(artifacts,'dft-workspace-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('#dftPage').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'DFT page must not overflow horizontally');
 assert.ok(await page.locator('header').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'navigation must stay within mobile viewport');
 await page.screenshot({path:path.join(artifacts,'dft-workspace-mobile.png')});
 assert.deepEqual(apiRequests,[],'route changes and file viewing must not contact the compute server');
 assert.deepEqual(dialogs,[],'navigation must not request calculation confirmation');
 assert.deepEqual(errors,[]);
 console.log('DFT workspace: desktop/mobile routes, form/file persistence, graphics and no automatic server calls passed.');
}catch(error){if(page)await page.screenshot({path:path.join(artifacts,'dft-workspace-failure.png')}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
