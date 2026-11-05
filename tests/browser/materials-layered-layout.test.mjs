/* Layout regression: Materials shares the Powder/Semiconductor shell; the 2D
 * figure preview expands with the viewport instead of inheriting a 1100px cap.
 * Pure DOM/SVG routes; does not need a functioning WebGL renderer.
 */
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
  const type=/\.(?:m?js)$/.test(filename)?'text/javascript':
   filename.endsWith('.css')?'text/css':filename.endsWith('.wasm')?'application/wasm':'text/html';
  res.writeHead(200,{'Content-Type':type}).end(await fs.readFile(filename));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const pageErrors=[];
 page.on('pageerror',err=>pageErrors.push(err.message));
 const base='http://127.0.0.1:'+server.address().port+'/index.html';
 await page.goto(base+'#malzemeler',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#materialsPage')?.hidden===false);
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:850});
  const geometry=await page.evaluate(()=>{
   const materials=document.querySelector('#materialsPage .library-wrap.lesson-wrap');
   const powder=document.querySelector('#powderPage .library-wrap.lesson-wrap');
   const page=document.querySelector('#materialsPage');
   const panels=[...page.querySelectorAll(':scope .lesson-panel')];
   const form=page.querySelector('.materials-bulk-fields');
   const bounds=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom};};
   return {
    width:innerWidth,documentWidth:document.documentElement.scrollWidth,
    pageScrollWidth:page.scrollWidth,pageClientWidth:page.clientWidth,
    page:bounds(page),wrap:bounds(materials),paddingLeft:parseFloat(getComputedStyle(materials).paddingLeft),
    paddingRight:parseFloat(getComputedStyle(materials).paddingRight),
    powderPaddingLeft:parseFloat(getComputedStyle(powder).paddingLeft),
    powderPaddingRight:parseFloat(getComputedStyle(powder).paddingRight),
    panels:panels.map(bounds),bulkColumns:getComputedStyle(form).gridTemplateColumns.split(' ').length,
    formWidth:bounds(form).width,formScroll:form.scrollWidth,
    lastPanel:bounds(panels.at(-1))
   };
  });
  assert.ok(geometry.paddingLeft>=12&&geometry.paddingRight>=12,'Materials needs horizontal gutters: '+JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.paddingLeft-geometry.powderPaddingLeft)<.1&&
   Math.abs(geometry.paddingRight-geometry.powderPaddingRight)<.1,
   'Materials and Powder must use the same shell spacing: '+JSON.stringify(geometry));
  assert.equal(geometry.panels.length,3,'Materials sections must remain intact');
  for(const panel of geometry.panels){
   assert.ok(panel.left>=geometry.wrap.left+geometry.paddingLeft-1&&
    panel.right<=geometry.wrap.right-geometry.paddingRight+1,
    'Materials panels must align inside the shared gutters: '+JSON.stringify(geometry));
  }
  assert.ok(geometry.pageScrollWidth<=geometry.pageClientWidth+2,
   'Materials content must not overflow its own page (independent of the global navbar): '+JSON.stringify(geometry));
  assert.ok(geometry.formScroll<=geometry.formWidth+2,'bulk preparation fields cannot overflow: '+JSON.stringify(geometry));
  assert.equal(geometry.bulkColumns,width<=480?1:width<=850?2:4,
   'bulk form must have balanced responsive columns: '+JSON.stringify(geometry));
  await page.locator('#materialsPage').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const bottom=await page.evaluate(()=>{
   const page=document.getElementById('materialsPage').getBoundingClientRect();
   const last=document.querySelector('#materialsPage .lesson-panel:last-of-type').getBoundingClientRect();
   return {pageBottom:page.bottom,lastBottom:last.bottom};
  });
  assert.ok(bottom.lastBottom<bottom.pageBottom-20,'last Materials panel needs bottom breathing room: '+JSON.stringify(bottom));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:path.join(root,'tests/browser/artifacts/materials-layout-desktop.png'),animations:'disabled'});
 await page.goto(base+'#katmanli-figur',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#layered2dPage')?.hidden===false);
 await page.locator('#layered2dSourceMode').selectOption('ideal');
 await page.waitForFunction(()=>document.querySelector('#layered2dPreview svg')!==null);
 for(const width of [1920,1440,1024,390]){
  await page.setViewportSize({width,height:900});
  const g=await page.evaluate(()=>{
   const wrap=document.querySelector('.layered2d-wrap');
   const panel=document.querySelector('.layered2d-canvas');
   const svg=document.querySelector('#layered2dPreview svg');
   const controls=document.querySelector('.layered2d-controls');
   const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};
   return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
    pageScrollWidth:document.getElementById('layered2dPage').scrollWidth,
    pageClientWidth:document.getElementById('layered2dPage').clientWidth,
    wrap:rect(wrap),panel:rect(panel),svg:rect(svg),controls:rect(controls),
    svgMaxWidth:getComputedStyle(svg).maxWidth};
  });
  assert.ok(g.wrap.width>=width-2,'2D workspace must use full available width: '+JSON.stringify(g));
  assert.equal(g.svgMaxWidth,'none','2D preview must not have a fixed 1100px cap');
  assert.ok(g.pageScrollWidth<=g.pageClientWidth+2,
   '2D content must not overflow its own page (independent of the global navbar): '+JSON.stringify(g));
  assert.ok(g.svg.width>=g.panel.width-45,'2D preview must fill its panel: '+JSON.stringify(g));
  if(width===1920){
   assert.ok(g.svg.width>1350,'wide desktop must show an expanded SVG preview: '+JSON.stringify(g));
   assert.ok(g.panel.left>g.controls.right-1,'wide desktop controls stay beside the expanded figure');
  }
  if(width<=1024)assert.ok(g.panel.top>=g.controls.bottom-2,
   'tablet/portrait should put full-width figure beneath settings: '+JSON.stringify(g));
 }
 await page.setViewportSize({width:1920,height:900});
 await page.screenshot({path:path.join(root,'tests/browser/artifacts/layered2d-full-width.png'),animations:'disabled'});
 assert.deepEqual(pageErrors,[],pageErrors.join('\n'));
 console.log('Materials lesson gutters / responsive bulk form and full-width 2D SVG preview passed.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
