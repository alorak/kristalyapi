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
 assert.equal(await page.locator('#qeJobWorkflow').inputValue(),'relax-scf');
 assert.equal(await page.locator('#qeCalcType').isVisible(),false,'local-only calculation type stays out of server mode');
 assert.equal(await page.locator('#qeExportPw').isVisible(),false,'local export action is hidden in server mode');
 await page.locator('input[name="dftPreparationMode"][value="file"]').check();
 assert.equal(await page.locator('#qeJobWorkflow').isVisible(),false);
 assert.equal(await page.locator('#qeCalcType').isVisible(),true);
 assert.equal(await page.locator('#qeExportPw').isVisible(),true);
 assert.equal(await page.locator('#qeForceThreshold').isVisible(),true,'local relaxation exposes force tolerance');
 await page.locator('#qeCalcType').selectOption('scf');
 assert.equal(await page.locator('#qeForceThreshold').isVisible(),false,'local SCF hides irrelevant force tolerance');
 await page.locator('#qeOccupation').selectOption('smearing');
 await page.locator('input[name="dftPreparationMode"][value="server"]').check();
 assert.equal(await page.locator('#qeJobWorkflow').isVisible(),true);
 assert.equal(await page.locator('#qeCalcType').isVisible(),false);
 await page.locator('#qeJobWorkflow').selectOption('scf');
 assert.equal(await page.locator('#qeForceThreshold').isVisible(),false,'server SCF hides relaxation controls');
 await page.locator('#qeJobWorkflow').selectOption('relax-scf');
 assert.equal(await page.locator('#qeForceThreshold').isVisible(),true,'server relaxation uses the shared force tolerance');
 await page.locator('#qeEcutwfc').fill('65');
 await page.locator('#qeJobWorkflow').selectOption('electronic');
 assert.equal(await page.locator('#qeElectronicSettings').isVisible(),true);
 // Without a checked server and key, the jobs tab is greyed out and leads to settings.
 const jobsTab=page.locator('[data-dft-section="isler"]');
 assert.equal(await jobsTab.getAttribute('aria-disabled'),'true');
 await jobsTab.click({force:true});
 await page.waitForFunction(()=>!document.getElementById('dft-ayarlar').hidden&&location.hash==='#dft/ayarlar');
 assert.equal(await page.locator('#dft-isler').isHidden(),true);
 assert.equal(await page.locator('#dftSettingsNotice').isVisible(),true);
 assert.equal(await page.locator('[data-dft-section="ayarlar"]').getAttribute('aria-current'),'page');
 await page.locator('#qeJobProfile').fill('retained-profile');
 assert.match(await page.locator('#dftReadiness').textContent(),/Hesap gönderimi/);
 assert.equal(await page.locator('#qeJobPause').isDisabled(),true);
 assert.equal(await page.locator('#qeJobResume').isDisabled(),true);
 await page.screenshot({path:path.join(artifacts,'dft-workspace-settings.png')});
 await page.locator('[data-dft-section="hazirlik"]').click();
 await page.waitForFunction(()=>!document.getElementById('dft-hazirlik').hidden);
 assert.equal(await page.locator('#dftSettingsNotice').isHidden(),true);
 assert.match(await page.locator('#dftJobSettings').textContent(),/65 Ry.*retained-profile/);
 await page.locator('[data-dft-section="sonuclar"]').click();
 await page.locator('#qeElectronicFile').setInputFiles(path.join(root,'validation-results/qe-mos2-d4-20261029-amd64/cases/electronic/pipeline/electronic-results.json'));
 await page.locator('#qeElectronicOpen').click();
 await page.waitForFunction(()=>document.querySelectorAll('#qeElectronicCharts svg').length===3);
 assert.match(await page.locator('#qeElectronicStatus').textContent(),/26.*3677/);
 const fileName=await page.locator('#qeElectronicFile').evaluate(el=>el.files[0].name);
 const spectra=page.locator('#qeElectronicCharts');
 await spectra.getByLabel('En düşük enerji (eV)',{exact:true}).fill('-8');
 await spectra.getByLabel('En yüksek enerji (eV)',{exact:true}).fill('6');
 await spectra.getByRole('button',{name:'Enerji penceresini uygula',exact:true}).click();
 const primary=spectra.locator('.qe-band-dos-layout svg');assert.equal(await primary.count(),2);
 for(let i=0;i<2;i++){assert.equal(await primary.nth(i).getAttribute('data-y-min'),'-8');assert.equal(await primary.nth(i).getAttribute('data-y-max'),'6');}
 for(const [name,extension] of [['DOS / PDOS verisini CSV indir','csv'],['Grafikleri SVG indir','svg'],['Grafikleri PNG indir','png']]){
  const promise=page.waitForEvent('download');await spectra.getByRole('button',{name,exact:true}).click();const download=await promise;
  const filename=path.join(artifacts,'dft-workspace-spectrum.'+extension);await download.saveAs(filename);const bytes=await fs.readFile(filename);
  if(extension==='csv'){const lines=bytes.toString().trim().split('\n');assert.equal(lines.length,3678);assert.ok(Number(lines[1].split(',')[0])< -8,'CSV retains out-of-view raw samples');}
  if(extension==='svg')assert.ok(bytes.toString().includes('"display_energy_window_ev":[-8,6]'));
  if(extension==='png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
 await spectra.screenshot({path:path.join(artifacts,'dft-workspace-spectra.png')});

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

 // Applying evidence-backed protocols creates a separate reference, never an API job.
 await page.locator('#languageTurkish').click();
 await page.locator('#qeProtocolSelect').selectOption('mos2-d41');
 await page.locator('#qeProtocolReference').click();
 await page.waitForFunction(()=>document.getElementById('dftStructureDetail').textContent.startsWith('3 atom'));
 assert.equal(await page.locator('#qeEcutwfc').inputValue(),'120');
 assert.equal(await page.locator('#qeElectronicNbnd').inputValue(),'40');
 assert.equal(await page.locator('#qeElectronicMesh').inputValue(),'24');
 assert.equal(await page.locator('#qeDosExplicit').isChecked(),true);
 assert.match(await page.locator('#qeProtocolState').textContent(),/ön kontrolü bekleniyor/);
 await page.locator('#qeEcutwfc').fill('125');
 assert.match(await page.locator('#qeProtocolState').textContent(),/eşleşmiyor/);
 await page.locator('#qeEcutwfc').fill('120');
 assert.match(await page.locator('#qeProtocolState').textContent(),/ön kontrolü bekleniyor/);
 assert.deepEqual(apiRequests,[],'template inspection/application must not call the compute server');
 // Synthetic read-only server transitions exercise polling without executing QE.
 const result=JSON.parse(await fs.readFile(path.join(root,'validation-results/qe-mos2-d4-20261029-amd64/cases/electronic/result.json'),'utf8'));
 const jid=result.job_id;let serverStatus='running',statusReads=0,wrongProtocolHash=true,degraded=false,executionDisabled=false;
 const {protocolById}=await import('../../qe-protocol-templates.js');const protocol=protocolById('mos2-d41');
 const row=()=>({job_id:jid,status:serverStatus,calculation:'electronic',structure_hash:result.structure_hash,created:'2026-10-29',can_pause:serverStatus==='running',can_resume:false});
 await page.route('http://127.0.0.1:8000/**',async route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, OPTIONS'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(req.method()==='POST'&&pathname==='/api/v1/calculations/validate'){
   const upf=Object.fromEntries(Object.entries(protocol.pseudopotentials).map(([el,p])=>[el,p.sha256]));if(wrongProtocolHash)upf.Mo='0'.repeat(64);
   await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({valid:true,structure_hash:protocol.structure_hash,atoms:3,profile_id:'mos2-pbe',upf_sha256:upf})});return;
  }
  assert.equal(req.method(),'GET','tracking must never submit or mutate jobs');
  let data;
  if(pathname==='/api/health')data={engine:'quantum-espresso',api_version:'1',status:degraded?'degraded':'ready',read_only:false};
  else if(pathname==='/api/capabilities')data={engine:{id:'quantum-espresso',available:!degraded,version:'7.2'},api_version:'1',
   job_submission_enabled:true,binaries:{'pw.x':true},resource_profile:{id:'test-execution-profile',max_atoms:64,max_bands:128,max_nscf_k:24,execution_enabled:!executionDisabled}};
  else if(pathname==='/api/v1/calculations')data={jobs:[row()]};
  else if(pathname.endsWith('/diagnostics'))data={schema:'kristalyapi.qe-job-diagnostics.v1',job_id:jid,availability:'recorded',status:serverStatus,
   reason_code:serverStatus==='completed'?'completed':'in_progress',elapsed_seconds:3,active_stage:'nscf',resources:null,
   stages:['scf','bands','bands_pp'].map(name=>({name,status:'completed',duration_seconds:1}))};
  else if(pathname.endsWith('/results'))data=result;
  else {statusReads++;data=row();}
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.setViewportSize({width:1280,height:900});
 await page.locator('[data-dft-section="ayarlar"]').click();
 await page.locator('#qeApiTest').click();
 await page.waitForFunction(()=>document.getElementById('dftConnectionChip').dataset.state==='token');
 assert.equal(await page.locator('[data-dft-section="isler"]').getAttribute('aria-disabled'),'true','a connection without a key keeps jobs locked');
 await page.locator('#qeApiToken').fill('short');
 assert.equal(await page.locator('[data-dft-section="isler"]').getAttribute('aria-disabled'),'true','short tokens cannot unlock jobs');
 assert.match(await page.locator('#dftReadiness').textContent(),/32–256/);
 await page.locator('#qeApiToken').fill('test-only-token-aaaaaaaaaaaaaaaaaaaaaaaa');
 assert.equal(await page.locator('#dftConnectionChip').getAttribute('data-state'),'ready');
 assert.equal(await page.locator('[data-dft-section="isler"]').getAttribute('aria-disabled'),null);
 await page.locator('[data-dft-section="isler"]').click();
 await page.waitForFunction(()=>!document.getElementById('dft-isler').hidden);
 assert.equal(await page.locator('#dftSettingsNotice').isHidden(),true);
 await page.locator('#qeJobRefresh').click();
 assert.match(await page.locator('#qeJobStatus').textContent(),/Bu sekmede takip edilen bir iş yok/);
 await page.locator('#qeJobValidate').click();
 await page.waitForFunction(()=>document.getElementById('qeProtocolState').textContent.includes('eşleşmiyor'));
 wrongProtocolHash=false;
 await page.locator('#qeJobValidate').click();
 await page.waitForFunction(()=>document.getElementById('qeProtocolState').textContent.includes('ön kontrolüyle eşleşti'));
 assert.equal(await page.locator('#qeJobPreflightState').getAttribute('data-state'),'passed');
 await page.locator('[data-dft-section="hazirlik"]').click();
 await page.locator('input[name="dftPreparationMode"][value="file"]').check();
 await page.locator('#qeOccupation').selectOption('smearing');
 assert.equal(await page.locator('#qeJobPreflightState').getAttribute('data-state'),'passed','local-only occupation changes do not invalidate server preflight');
 await page.locator('input[name="dftPreparationMode"][value="server"]').check();
 await page.locator('#qeEcutwfc').fill('125');
 assert.equal(await page.locator('#qeJobPreflightState').getAttribute('data-state'),'stale','editing validated parameters must invalidate preflight');
 await page.locator('#qeEcutwfc').fill('120');
 await page.locator('[data-dft-section="isler"]').click();
 await page.locator('#qeJobValidate').click();
 await page.waitForFunction(()=>document.getElementById('qeJobPreflightState').dataset.state==='passed');
 await page.locator('[data-dft-section="hazirlik"]').click();
 await page.locator('.qe-protocol-card').screenshot({path:path.join(artifacts,'dft-workspace-protocol.png')});
 await page.locator('[data-dft-section="isler"]').click();
 await page.locator('#qeJobHistoryLoad').click();
 await page.locator('#qeJobHistorySelect').selectOption(jid);
 await page.locator('#qeJobHistoryOpen').click();
 await page.waitForFunction(()=>document.querySelectorAll('#qeJobProgress li[data-state="completed"]').length===3);
 assert.equal(await page.locator('#qeJobProgress li[data-state="running"]').count(),1);
 serverStatus='completed';
 await page.waitForFunction(()=>!document.getElementById('qeJobResultsLink').hidden,null,{timeout:15000});
 assert.equal(await page.locator('#qeJobProgress li[data-state="completed"]').count(),6);
 assert.equal(await page.locator('#qeJobResume').isDisabled(),true);
 const finishedReads=statusReads;
 await page.waitForTimeout(5500);
 assert.equal(statusReads,finishedReads,'terminal jobs stop automatic reads');
 await page.locator('#dft-isler').screenshot({path:path.join(artifacts,'dft-workspace-live-tracking.png')});
 await page.locator('#qeJobResultsLink').click();
 await page.waitForFunction(()=>!document.getElementById('qeApiElectronicResults').hidden);
 assert.equal(await page.locator('#qeApiElectronicResults svg').count(),3);
 // Replay archived real spin spectra locally; no API job is submitted.
 await page.locator('#qeElectronicFile').setInputFiles(path.join(root,'validation-results/qe-spin-si-20261030-arm64/pipeline/electronic-results.json'));
 await page.locator('#qeElectronicOpen').click();
 await page.waitForFunction(()=>document.querySelectorAll('#qeElectronicCharts .qe-spin-channel svg').length===6);
 assert.equal(await page.locator('#qeElectronicCharts .qe-spin-channel').count(),2);
 assert.match(await page.locator('#qeElectronicStatus').textContent(),/Spin.*8.*1401/);
 for(const channel of ['up','down']){
  const section=page.locator('#qeElectronicCharts [data-spin-channel="'+channel+'"]');
  const [download]=await Promise.all([page.waitForEvent('download'),section.getByRole('button',{name:'DOS / PDOS verisini CSV indir',exact:true}).click()]);
  assert.match(download.suggestedFilename(),new RegExp('spin-'+channel+'-dos-pdos\\.csv$'));
  const csv=await fs.readFile(await download.path(),'utf8');assert.ok(csv.includes('spin_channel'));assert.ok(csv.includes(',"'+channel+'",'));
 }
 await page.locator('#qeElectronicCharts .qe-spin-channel h3').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(artifacts,'dft-workspace-spin.png')});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('#dftPage').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.locator('[data-dft-section="hazirlik"]').click();
 await page.locator('#qeElectronicSpin').selectOption('polarized');
 assert.equal(await page.locator('#qeSpinSettings').isVisible(),true);
 await page.locator('#qeSpinSeeds').fill('Mo 0.1\nS 0');
 assert.equal(await page.locator('#qeSpinSeeds').inputValue(),'Mo 0.1\nS 0');
 await page.locator('#qeElectronicSpin').selectOption('unpolarized');
 assert.equal(await page.locator('#qeSpinSettings').isVisible(),false);
 await page.locator('[data-dft-section="ayarlar"]').click();
 executionDisabled=true;
 await page.locator('#qeApiTest').click();
 await page.waitForFunction(()=>document.getElementById('dftConnectionState').textContent.includes('yalnız hazırlık'));
 assert.equal(await page.locator('[data-dft-section="isler"]').getAttribute('aria-disabled'),'true','preparation-only resource profile cannot unlock jobs');
 executionDisabled=false;degraded=true;
 await page.locator('#qeApiTest').click();
 await page.waitForFunction(()=>document.getElementById('dftConnectionState').textContent.includes('hazır değil'));
 assert.equal(await page.locator('[data-dft-section="isler"]').getAttribute('aria-disabled'),'true','degraded QE solver cannot unlock jobs');
 assert.deepEqual(errors,[]);
 console.log('DFT workspace: desktop/mobile routes, form/file persistence, graphics and no automatic server calls passed.');
}catch(error){if(page)await page.screenshot({path:path.join(artifacts,'dft-workspace-failure.png')}).catch(()=>{});throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
