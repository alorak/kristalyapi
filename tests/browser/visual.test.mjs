// Real Chromium/WebGL smoke and differential screenshot tests (not a
// pixel-perfect VESTA equivalence claim). Render using software WebGL on CI.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const artifacts=path.join(base,'tests/browser/artifacts');
await fs.mkdir(artifacts,{recursive:true});
const server=http.createServer(async(request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 const name=url.pathname==='/'?'/index.html':url.pathname;
 const absolute=path.resolve(base,'.'+name);
 if(!absolute.startsWith(base+path.sep)) {response.writeHead(403).end();return;}
 try{
  const content=await fs.readFile(absolute);
  response.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.cif')?'text/plain':'application/octet-stream'});
  response.end(content);
 }catch(e){response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
async function sample(page){
 return page.locator('#stage canvas').evaluate(canvas=>{
  const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;
  const ctx=out.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);
  const image=ctx.getImageData(0,0,out.width,out.height).data;
  let ink=0,sum=0;
  for(let y=8;y<out.height-8;y+=8)for(let x=8;x<out.width-8;x+=8){
   const p=(y*out.width+x)*4,r=image[p],g=image[p+1],b=image[p+2];
   const difference=255-Math.min(r,g,b);
   if(difference>20)ink++;
   sum+=r*3+g*5+b*7;
  }
  return {ink,sum,canvasWidth:canvas.width,canvasHeight:canvas.height};
 });
}
async function save(page,name,metrics){
 await page.waitForTimeout(200); // allow WebGL animation loop to draw the latest scene
 await page.screenshot({path:path.join(artifacts,name+'.png'),animations:'disabled'});
 metrics[name]=await sample(page);
 assert.ok(metrics[name].ink>20,name+': canvas may be blank '+JSON.stringify(metrics[name]));
}
const metrics={};
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1480,height:920},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await save(page,'01-silicon-perspective',metrics);
 await page.getByRole('button',{name:'Üstten görünüm'}).click();
 await page.waitForTimeout(650);
 await save(page,'02-silicon-top',metrics);
 assert.notEqual(metrics['01-silicon-perspective'].sum,metrics['02-silicon-top'].sum,'camera view should change canvas pixels');
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('4335507'),null,{timeout:20000});
 await save(page,'03-cod-4335507',metrics);
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/browser/adp_visual.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('adp visual'),null,{timeout:20000});
 await page.locator('#adpVisible').check();
 await page.locator('#adpLevel').selectOption('90');
 await save(page,'04-adp-90',metrics);
 await page.locator('#layerManager').getByLabel('Termal elipsoitler görünürlük').uncheck();
 await save(page,'05-adp-hidden',metrics);
 assert.notEqual(metrics['04-adp-90'].sum,metrics['05-adp-hidden'].sum,'ADP visibility should change canvas');
 await page.locator('#rightMillerTab').click();
 await page.locator('#showPlane').check();
 await page.locator('#applyPlane').click();
 await save(page,'06-miller',metrics);
 assert.notEqual(metrics['05-adp-hidden'].sum,metrics['06-miller'].sum,'Miller layer should change canvas');
 await page.locator('#morphPreset').click();
 await save(page,'07-cubic-morphology',metrics);
 assert.notEqual(metrics['06-miller'].sum,metrics['07-cubic-morphology'].sum,'morphology should affect rendering');
 await page.locator('#rightStructureTab').click();
 await page.locator('#overlayFile').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#overlaySummary')?.textContent?.includes('1 ek'),null,{timeout:10000});
 await save(page,'08-two-crystals',metrics);
 assert.notEqual(metrics['07-cubic-morphology'].sum,metrics['08-two-crystals'].sum,'second CIF should change rendering');
 // A tiny XSF plane-wave field produces real isosurfaces on a simple Cartesian grid.
 const values=[];for(let k=0;k<4;k++)for(let j=0;j<4;j++)for(let i=0;i<4;i++)
  values.push(Math.exp(-((i-1.5)**2+(j-1.5)**2+(k-1.5)**2)));
 const xsf=['BEGIN_BLOCK_DATAGRID_3D','density','BEGIN_DATAGRID_3D_density',
  '4 4 4','0 0 0','3 0 0','0 3 0','0 0 3',values.join(' '),
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeFile').setInputFiles({name:'density.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf)});
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===1,null,{timeout:10000});
 await page.locator('#volumeIsoAdd').click();
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),2);
 const xsf2=['BEGIN_BLOCK_DATAGRID_3D','density2','BEGIN_DATAGRID_3D_density',
  '2 2 2','0 0 0','3 0 0','0 3 0','0 0 3','0 1 1 0 1 0 0 1',
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeAdditionalFile').setInputFiles({name:'second.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf2)});
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===2,null,{timeout:10000});
 await save(page,'09-two-volume-fields',metrics);
 assert.match(await page.locator('#volumeSliceStats').textContent(),/Å/);
 assert.deepEqual(errors,[],'uncaught browser exceptions');
 await fs.writeFile(path.join(artifacts,'metrics.json'),JSON.stringify(metrics,null,2));
 console.log('Real Chromium/WebGL screenshots and layer transitions passed:',metrics);
} finally {
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
