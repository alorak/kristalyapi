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
  let content=await fs.readFile(absolute);
  if(name==='/index.html'){
   const html=content.toString('utf8');
   assert.match(html,/"three":"\.\/vendor\/three\/build\/three\.module\.js"/);
   assert.doesNotMatch(html,/cdn\.jsdelivr\.net|unpkg\.com/,'the deployed page must resolve Three.js locally');
  }
  if(name==='/crystal-app.js'){
   let source=content.toString('utf8');
   // Test-only hooks inserted into the served module, not the distributed file.
   const bootstrapMarker='// @kristalyapi/browser-bootstrap:';
   assert.ok(source.includes(bootstrapMarker),'Expected app bootstrap marker');
   source=source.replace(bootstrapMarker,`
window.__visualTest={
 select:ids=>{selected=[...ids];drawSelection();},
 repeat:()=>[...state.rep],
 instancing:()=>({atoms:atomData.length,groups:atomMesh.length,instances:atomMesh.reduce((s,m)=>s+m.count,0),bondGroups:root.children.filter(m=>m.userData.layer==='bonds').length}),
 codDisorderScene:()=>{
  const physical=state.symmetryEnabled?expandSites(state.sites,state.sgSetting):state.sites;
  const B=basis(state.cell),network=bondNetwork(physical,state.cell,{periodic:true,cut:2.65,auto:true});
  const pair=e=>[physical[e.i].symbol,physical[e.j].symbol].sort().join('-');
  const rendered=atomMesh.flatMap(mesh=>mesh.userData.instanceAtomIndices.map(index=>({
   element:atomData[index].site.symbol,opacity:mesh.material.opacity,
   transparent:mesh.material.transparent
  })));
  const byElement=element=>physical.filter(site=>site.symbol===element).length;
  return {sites:physical.length,drawn:atomData.length,instances:rendered.length,
   mo:byElement('Mo'),s:byElement('S'),cs:byElement('Cs'),
   weighted:physical.reduce((sum,site)=>sum+Number(site.occupancy??1),0),
   csRender:rendered.filter(atom=>atom.element==='Cs'),
   orderedOpacity:rendered.filter(atom=>atom.element!=='Cs').map(atom=>atom.opacity),
   csCsEdges:network.edges.filter(e=>pair(e)==='Cs-Cs').length,
   moSEdges:network.edges.filter(e=>pair(e)==='Mo-S').length,
   drawnCsLinks:bondPairs.filter(([i,j])=>atomData[i].site.symbol==='Cs'||atomData[j].site.symbol==='Cs').length,
   moShells:physical.flatMap((site,i)=>site.symbol==='Mo'?
    [coordinationNeighbors(physical,i,B,new Map(),2.65,true,24).filter(n=>n.element==='S').length]:[])
  };
 },
 bounds:()=>state.bounds.map(a=>[...a]),
 morphOrbit:()=>morphologyPointOrbit(1,0,0,'123'),
 moleculeBonds:()=>{const water=xyzData('3\\nH2O\\nO 0 0 0\\nH .9584 0 0\\nH -.239 0 .927');
  const graph=bondNetwork(water.sites,water.cell,{periodic:bondIsPeriodic('auto',water.nonPeriodic),cut:1.5,auto:true});
  return {nonPeriodic:water.nonPeriodic,edges:graph.edges.length,components:graph.components.length,cycleRank:graph.cycleRank};},
 ccp4:()=>densityGrid&&({kind:densityGrid.kind,dims:densityGrid.dims,periodic:densityGrid.periodic,
  mapping:densityGrid.ccp4?.mapping,starts:densityGrid.ccp4?.starts,quantity:densityGrid.quantity}),
 cubeAtoms:()=>densityGrid?.kind==='CUBE'?{
  nonPeriodic:state.nonPeriodic,offset:state.nonPeriodicOrigin,cellVisible:state.cellVisible,
  densityOrigin:densityGrid.origin,atomWorld:atomData.map(item=>item.pos.toArray()),
  virtualCellVolumeText:document.getElementById('infoVolume').textContent}:null,
 volumetricFields:()=>({names:volumeDatasets.map(item=>item.name),
  values:volumeDatasets.map(item=>[item.grid.values[0],item.grid.values[1],item.grid.values[63]]),
  active:activeVolumeIndex,kind:densityGrid?.kind,nonPeriodic:state.nonPeriodic,
  worldAtoms:atomData.map(item=>item.pos.toArray())}),
 snapshotStructure:()=>JSON.parse(JSON.stringify(state)),
 restoreStructure:snapshot=>{state=snapshot;syncControls();build();fit();},
 vestaImport:()=>({name:state.name,sites:state.sites.length,cell:state.cell,bounds:state.bounds,
  colors:state.sites.map(site=>site.visualColor),warning:state.warning,attached:!!densityGrid}),
 volumeVisual:()=>({isoCount:activeVolumeDataset()?.layers.length,style:volumeView.surfaceStyle,
  values:activeVolumeDataset()?.layers.map(layer=>layer.value),contourMode:volumeView.contourMode,
  contourStyle:volumeView.contourStyle,
  wires:volumeLayer?.children.filter(x=>x.isMesh&&x.material?.wireframe).length||0,
  fills:volumeLayer?.children.filter(x=>x.isMesh&&!x.material?.wireframe).length||0}),
 polyStats:()=>({center:state.poly,centers:[...(state.polyCenters||[])],meshes:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh).length,
  edges:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isLineSegments).length,
  count:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh).reduce((s,m)=>s+(m.userData.polyhedraCount||0),0),
  area:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh).reduce((s,m)=>s+(m.userData.polyhedraArea||0),0),
  volume:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh).reduce((s,m)=>s+(m.userData.polyhedraVolume||0),0),
  notice:document.getElementById('notice').textContent}),
 tiChemistry:()=>{resetVolume();loadPreset('perovskite');state.rep=[1,1,1];
  state.style='poly';state.cut=2.18;build();
  selected=[atomData.findIndex(atom=>atom.site.symbol==='Ti')];
  renderCoordinationSummary();return document.getElementById('coordinationInfo').textContent;},
 p12Perovskite:()=>{resetVolume();loadPreset('perovskite');refreshStage3Atoms();
  return state.sites.map((site,index)=>({index,symbol:site.symbol}));},
 p12BvsResult:()=>lastBvs&&({pair:lastBvs.pair,count:lastBvs.count,
  weightedCount:lastBvs.weightedCount,sum:lastBvs.sum,periodic:lastBvs.periodic,
  warnings:lastBvs.warnings,reference:lastBvs.parameterSource}),
 p14VestaProjection:()=>lastBvs&&vesta3ManualBvsProjection(lastBvs),
 p13Experimental:()=>({sites:state.sites.map((site,index)=>({index,element:site.symbol,
  label:site.label,occupancy:site.occupancy})),warning:state.warning,
  bvs:lastBvs&&({pair:lastBvs.pair,count:lastBvs.count,sum:lastBvs.sum,
   uncertainty:lastBvs.occupancyDistribution,alternatives:lastBvs.centerAlternatives})}),
 perovskitePolys:()=>{resetVolume();loadPreset('perovskite');state.rep=[5,5,5];state.style='poly';state.poly='';
  state.bounds=[[0,1],[0,1],[0,1]];state.boundary=false;build();fit();return window.__visualTest.polyStats();},
 syncedPolyCenter:()=>{resetVolume();loadPreset('perovskite');state.style='poly';state.poly='';
  syncControls();build();return window.__visualTest.polyStats();},
 polyRendererAB:async()=>{
  const samples=[];
  for(const mode of ['merged','instanced','merged']){
   polyFaceStrategy=mode;document.getElementById('polyFaceStrategy').value=mode;
   if(!build())throw Error('Polyhedron strategy failed: '+mode);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   samples.push({...performanceSnapshot(),centerCount:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh)
    .reduce((n,m)=>n+(m.userData.polyhedraCount||0),0),
    area:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh)
    .reduce((n,m)=>n+(m.userData.polyhedraArea||0),0),
    volume:root.children.filter(m=>m.userData.layer==='polyhedra'&&m.isMesh)
    .reduce((n,m)=>n+(m.userData.polyhedraVolume||0),0)});
  }
  return samples;
 },
 perovskiteWithoutNeighbors:()=>{state.poly='Ba';build();return window.__visualTest.polyStats();},
 stressAtoms:()=>{resetVolume();state.sites=Array.from({length:60},(_,i)=>({symbol:'Si',label:'Si'+i,x:(i%5)/5,y:(Math.floor(i/5)%4)/4,z:Math.floor(i/20)/3,occupancy:1}));
  state.rep=[6,6,6];state.bounds=[[0,1],[0,1],[0,1]];state.boundary=false;state.bonds=false;state.poly='';state.style='ball';
  state.labels=false;state.morphology=[];state.overlays=[];state.plane.visible=false;state.plane.slab=false;state.adpVisible=false;build();
  return {atoms:atomData.length,meshes:atomMesh.length,instances:atomMesh.reduce((n,m)=>n+m.count,0)};},
 performance:()=>performanceSnapshot(),
 stressSeries:()=>{
  const samples=[];
  for(const repeat of [1,3,6]){
   state.rep=[repeat,repeat,repeat];
   const start=performance.now();if(!build())throw Error('Failed to build stress scene');
   updateAtomLod();
   samples.push({...performanceSnapshot(),repeat,elapsedMs:performance.now()-start});
  }
  fit();return samples;
 },
 smallStress:()=>{state.rep=[1,1,1];build();fit();return performanceSnapshot();},
 highQualityExportProof:()=>{
  const before=atomMesh.map(mesh=>mesh.geometry),count=atomMesh.reduce((n,m)=>n+m.count,0);
  renderExportCanvas(1);
  return {restored:atomMesh.every((mesh,i)=>mesh.geometry===before[i]),
   instances:atomMesh.reduce((n,m)=>n+m.count,0),before:count};
 },
 workerFixtureParity:()=>new Promise((resolve,reject)=>{
  const dataset=activeVolumeDataset();if(!dataset)return reject(Error('Missing fixture grid'));
  const g=dataset.grid,pot=volumeView.potential?potentialGrid:null;
  const level=dataset.layers[0].value,limit=12000;
  const expected=isoTriangles(g,level,pot,volumeView.palette,limit);
  const worker=new Worker('./volume-iso-worker.js');
  worker.onmessage=event=>{
   worker.terminate();
   if(event.data.error)return reject(Error(event.data.error));
   const actual=event.data.results[0];
   const same=a=>a.length===actual.positions.length&&a.every((x,i)=>x===actual.positions[i]);
   resolve({matched:same(expected.positions),triangles:actual.triangles,
    origin:g.origin,colorsMatch:!pot||expected.colors.every((x,i)=>x===actual.colors[i])});
  };
  worker.onerror=error=>{worker.terminate();reject(Error(error.message));};
  const grid=serializeVolumeWorkerGrid(g),grids=[grid],jobs=[{grid:0,potential:-1,level,palette:volumeView.palette,maxTriangles:limit}];
  worker.postMessage({requestId:7,grids,jobs},[grid.values.buffer]);
 }),
 heavyVolume:()=>{
  resetVolume();const n=64,values=new Float32Array(n*n*n);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
   const r=Math.hypot(i-31.5,j-31.5,k-31.5);
   values[(i*n+j)*n+k]=14-r;
  }
  const g=volumeGrid([n,n,n],[0,0,0],[[.2,0,0],[0,.2,0],[0,0,.2]],values,'Synthetic CPU benchmark','e/Å³');
  addVolumeDataset(g,'Package 10.2 worker stress');
  volumeView.mode='iso';volumeView.surfaceStyle='smooth';volumeView.potential=false;
  document.getElementById('volumeMode').value='iso';
  activeVolumeDataset().layers[0].value=0;
  drawVolume();
  return performanceSnapshot();
 },
 heavySlicePreview:()=>{
  const before=volumeSlicePreviewCanceled;
  volumeView.axis=2;volumeView.contours=true;volumeView.contourMode='balanced';
  volumeView.position=25;updateVolumeSliceStats();
  volumeView.position=55;updateVolumeSliceStats();
  return {cancelDelta:volumeSlicePreviewCanceled-before,...performanceSnapshot()};
 },
 heavySliceLine:()=>{
  volumeProfileLine=[[.2,.3],[.8,.7]];
  drawVolumeSlicePreview();
  return {samples:volumeProfileResult?.rows.length||0,
   valid:volumeProfileResult?.valid||0,units:volumeProfileResult?.units,
   stats:document.getElementById('volumeSliceStats').textContent};
 },
 heavySignature:sync=>{
  if(sync)drawVolume(true);
  const attr=volumeLayer?.children.find(x=>x.isMesh)?.geometry.getAttribute('position');
  if(!attr)return null;
  const values=attr.array;
  return {count:values.length,head:Array.from(values.slice(0,18)),
   tail:Array.from(values.slice(-18))};
 },
 heavyRestyle:()=>{
  volumeView.surfaceStyle='wire';drawVolume();
  return {...performanceSnapshot(),wires:volumeLayer.children.filter(o=>o.isMesh&&o.material.wireframe).length};
 },
 heavyCancel:()=>{
  const before=volumeCancelledJobs;
  activeVolumeDataset().layers[0].value=.25;drawVolume();
  activeVolumeDataset().layers[0].value=.75;drawVolume();
  return {cancelDelta:volumeCancelledJobs-before,...performanceSnapshot()};
 }
};
`+bootstrapMarker);
   content=Buffer.from(source);
  }
  // Chromium refuses native ES modules served as application/octet-stream.
  // Match GitHub Pages' MIME types for the local WASM module and binary.
  const contentType=name.endsWith('.html')?'text/html; charset=utf-8':
   name.endsWith('.css')?'text/css; charset=utf-8':
   name.endsWith('.js')?'text/javascript; charset=utf-8':
   name.endsWith('.wasm')?'application/wasm':
   name.endsWith('.cif')?'text/plain; charset=utf-8':'application/octet-stream';
  response.writeHead(200,{'Content-Type':contentType});
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
async function canvasInk(page,selector){
 return page.locator(selector).evaluate(canvas=>{
  const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;
  const ctx=out.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);
  const image=ctx.getImageData(0,0,out.width,out.height).data;let ink=0;
  for(let y=4;y<out.height-4;y+=4)for(let x=4;x<out.width-4;x+=4){
   const p=(y*out.width+x)*4;if(255-Math.min(image[p],image[p+1],image[p+2])>40)ink++;
  }
  return ink;
 });
}
async function save(page,name,metrics){
 await page.waitForTimeout(200); // allow WebGL animation loop to draw the latest scene
 await page.screenshot({path:path.join(artifacts,name+'.png'),animations:'disabled'});
 metrics[name]=await sample(page);
 assert.ok(metrics[name].ink>20,name+': canvas may be blank '+JSON.stringify(metrics[name]));
}
async function assertHorizontalQuickbar(page,{drawerOpen=false,mobile=false}={}){
 const geometry=await page.locator('#workbenchQuickbar').evaluate(dock=>{
  const [view,miller]=dock.querySelectorAll('.quickbar-group');
  const rect=element=>{
   const bounds=element.getBoundingClientRect();
   return {left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,
    width:bounds.width,height:bounds.height};
  };
  return {
   dock:rect(dock),view:rect(view),miller:rect(miller),
   leftGap:rect(dock.querySelector('.quickbar-ranges')).top-rect(dock.querySelector('.quickbar-topline')).bottom,
   rightGap:rect(dock.querySelector('.quickbar-analysis')).top-rect(dock.querySelector('.quickbar-miller-line')).bottom,
   justifySelf:getComputedStyle(miller).justifySelf,
   scrollWidth:dock.scrollWidth,clientWidth:dock.clientWidth
  };
 });
 assert.ok(geometry.dock.height>=116&&geometry.dock.height<=120,'the bottom dock must reserve 118px without stacking: '+JSON.stringify(geometry));
 assert.ok(geometry.view.right<=geometry.miller.left+1,'the two control groups must stay side by side: '+JSON.stringify(geometry));
 assert.ok(Math.abs((geometry.view.top+geometry.view.bottom)/2-(geometry.miller.top+geometry.miller.bottom)/2)<12,
  'the control groups must share the same vertical row: '+JSON.stringify(geometry));
 assert.ok(geometry.leftGap>=3&&geometry.rightGap>=3,'both control rows need breathing room: '+JSON.stringify(geometry));
 assert.equal(geometry.justifySelf,drawerOpen?'start':'end','Miller controls should align right normally and left with the drawer open');
 if(!drawerOpen&&!mobile)assert.ok(geometry.dock.right-geometry.miller.right<=20,
  'Miller controls should sit at the right edge of the normal toolbar');
 if(mobile)assert.ok(geometry.scrollWidth>geometry.clientWidth,
  'narrow screens should allow horizontal scrolling instead of vertical stacking');
}
const metrics={};
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1480,height:920},deviceScaleFactor:1});
 const errors=[],consoleErrors=[],cdnRequests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 page.on('request',request=>{if(/cdn\.jsdelivr\.net|unpkg\.com/.test(request.url()))cdnRequests.push(request.url());});
 await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
 try{
  await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 }catch(error){console.error('Browser startup diagnostics:',{errors,consoleErrors,cdnRequests,renderStatus:await page.locator('#renderStatus').textContent()});throw error;}
 // English is the default; Turkish remains selectable and persisted.
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.equal(await page.locator('#libraryNav').textContent(),'Library');
 assert.equal(await page.locator('#languageEnglish').getAttribute('aria-pressed'),'true');
 await page.locator('#openBtn').click();
 assert.equal(await page.locator('[data-open-tab="examples"]').getAttribute('aria-selected'),'true',
  'with no favorites the Open dialog must start on populated sample structures');
 assert.equal(await page.locator('#openList .open-item').count(),7);
 await page.locator('#openModalClose').click();
 await page.locator('#saveBtn').click();
 const [svgDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="svg"]').click()]);
 const svgSource=await fs.readFile(await svgDownload.path(),'utf8');
 assert.match(svgSource,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svgSource,/<circle/,'SVG export must contain real vector atoms');
 assert.match(svgSource,/<path/,'SVG export must contain lattice/bond vector strokes');
 assert.doesNotMatch(svgSource,/<image|data:image|foreignObject/,'SVG must not embed a raster screenshot');
 const water=await page.evaluate(()=>window.__visualTest.moleculeBonds());
 assert.deepEqual(water,{nonPeriodic:true,edges:2,components:1,cycleRank:0},'XYZ water must be a finite two-bond molecule');
 await page.locator('#saveBtn').click();
 const [vectorPdfDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="pdf-vector"]').click()]);
 const vectorPdf=await fs.readFile(await vectorPdfDownload.path());
 assert.equal(vectorPdf.toString('ascii',0,8),'%PDF-1.4');
 assert.ok(vectorPdf.includes(Buffer.from('/ExtGState')));
 assert.ok(vectorPdf.includes(Buffer.from(' c\n')),'PDF must contain Bezier path operators');
 assert.ok(!vectorPdf.includes(Buffer.from('/Subtype /Image')),'vector PDF must contain no raster image');
 await fs.writeFile(path.join(artifacts,'print-export-vector.pdf'),vectorPdf);
 await page.locator('#saveBtn').click();
 const [epsDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="eps"]').click()]);
 const eps=await fs.readFile(await epsDownload.path(),'utf8');
 assert.match(eps,/^%!PS-Adobe-3\.0 EPSF-3\.0/);
 assert.match(eps,/curveto/);
 await fs.writeFile(path.join(artifacts,'print-export-vector.eps'),eps);
 await page.locator('#saveBtn').click();
 const [vrmlDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="vrml"]').click()]);
 const vrml=await fs.readFile(await vrmlDownload.path(),'utf8');
 assert.match(vrml,/^#VRML V2\.0 utf8/);
 assert.match(vrml,/geometry Sphere \{ radius 1 \}/);
 assert.match(vrml,/geometry Cylinder \{ radius 1 height 1 \}/);
 assert.match(vrml,/geometry IndexedLineSet/);
 await fs.writeFile(path.join(artifacts,'scene-export.wrl'),vrml);
 assert.equal(await page.locator('#morphMode').inputValue(),'point');
 assert.equal((await page.evaluate(()=>window.__visualTest.morphOrbit())).length,4,'tetragonal point group must expand {100} to four reciprocal normals');
 await page.locator('#saveBtn').click();
 const [tiffDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="tiff"]').click()]);
 const tiffData=await fs.readFile(await tiffDownload.path());
 assert.equal(tiffData.toString('ascii',0,2),'II');
 assert.equal(tiffData.readUInt16LE(2),42);
 assert.ok(tiffData.readUInt32LE(4)>0,'TIFF must contain an image directory');
 await fs.writeFile(path.join(artifacts,'print-export-sample.tiff'),tiffData);
 await page.locator('#saveBtn').click();
 const [pdfDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="pdf"]').click()]);
 const pdfData=await fs.readFile(await pdfDownload.path());
 assert.equal(pdfData.toString('ascii',0,8),'%PDF-1.4');
 assert.ok(pdfData.includes(Buffer.from('/DCTDecode')),'PDF must embed an actual JPEG');
 assert.ok(pdfData.includes(Buffer.from('/MediaBox [0 0')),'PDF must have a physical A4 page');
 await fs.writeFile(path.join(artifacts,'print-export-sample.pdf'),pdfData);
 await page.locator('#saveBtn').click();
 const [stlDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="stl"]').click()]);
 const stlData=await fs.readFile(await stlDownload.path());
 const stlFaces=stlData.readUInt32LE(80);
 assert.ok(stlFaces>100,'binary STL must expand all instanced atom and bond triangles');
 assert.equal(stlData.length,84+50*stlFaces,'binary STL must contain each declared triangle');
 await page.locator('#saveBtn').click();
 const [glbDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="glb"]').click()]);
 const glbData=await fs.readFile(await glbDownload.path());
 assert.equal(glbData.toString('ascii',0,4),'glTF');
 assert.equal(glbData.readUInt32LE(4),2,'binary glTF must be version 2');
 assert.equal(glbData.readUInt32LE(8),glbData.length);
 assert.equal(glbData.toString('ascii',16,20),'JSON');
 const gltf=JSON.parse(glbData.toString('utf8',20,20+glbData.readUInt32LE(12)));
 assert.ok(gltf.meshes?.length>0&&gltf.nodes?.length>0,'glTF must preserve actual 3D mesh nodes');
 assert.ok(gltf.materials?.length>0,'glTF must contain scene materials');
 await page.locator('#languageTurkish').click();
 assert.equal(await page.locator('#libraryNav').textContent(),'Kütüphane');
 assert.equal(await page.locator('html').getAttribute('lang'),'tr');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.language.v1')),'tr');
 assert.equal(await page.locator('#leftGeneralPane').getByText('Görünüm',{exact:true}).count(),0);
 assert.equal(await page.locator('#legacyViewControls').isHidden(),true);
 assert.equal(await page.locator('#adpLevel').isDisabled(),true,'ADP probability needs an enabled ellipsoid with Uij/Uiso');
 assert.equal(await page.locator('#polyCut').isDisabled(),true,'neighbor threshold needs a selected coordination center');
 assert.equal(await page.locator('#polyNeighbors').isDisabled(),true,'max neighbors needs a selected coordination center');
 assert.equal(await page.locator('.supercell-stepper button').count(),6,'each repeat axis needs plus/minus buttons');
 const repeatPlus=page.locator('[data-repeat-target="ra"][data-repeat-step="1"]');
 const repeatMinus=page.locator('[data-repeat-target="ra"][data-repeat-step="-1"]');
 await page.locator('#ra').fill('1');
 assert.equal(await repeatMinus.isDisabled(),true,'the decrement button should stop at 1');
 await repeatPlus.click();
 assert.equal(await page.locator('#ra').inputValue(),'2');
 assert.equal(await repeatMinus.isEnabled(),true);
 await page.locator('#applyRepeat').click();
 assert.equal(await page.evaluate(()=>window.__visualTest.repeat()[0]),2,'the stepper value should apply to the crystal');
 await page.locator('#ra').fill('6');
 assert.equal(await repeatPlus.isDisabled(),true,'the increment button should stop at 6');
 await page.locator('#repeatOne').click();
 assert.equal(await page.locator('#ra').inputValue(),'1');
 assert.equal(await repeatMinus.isDisabled(),true,'reset should refresh the stepper controls');
 // Independent structures, per-workspace history and camera, the ten-workspace cap.
 assert.equal(await page.locator('#workspaceCount').textContent(),'1');
 await page.locator('#workspaceToggle').click();
 assert.equal(await page.locator('#workspaceDrawer').getAttribute('aria-hidden'),'false');
 assert.equal(await page.locator('#workspaceList .workspace-entry').count(),1);
 await page.screenshot({path:path.join(artifacts,'18-workspace-switcher.png'),animations:'disabled'});
 await page.locator('#workspaceAdd').click();
 assert.equal(await page.locator('#workspaceCount').textContent(),'2');
 assert.match(await page.locator('#infoName').textContent(),/Yeni kristal/);
 assert.equal(await page.locator('#siteCount').textContent(),'1');
 await page.locator('#a').fill('7.25');await page.locator('#applyCell').click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').first().click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 assert.equal(await page.locator('#a').inputValue(),'5.431');
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'false');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').nth(1).click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.locator('#undoBtn').click();
 assert.equal(await page.locator('#a').inputValue(),'5');
 await page.locator('#redoBtn').click();
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 // Refresh restores both workspaces and the active selection from local storage.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'));
 assert.equal(await page.locator('#workspaceCount').textContent(),'2');
 assert.equal(await page.locator('#a').inputValue(),'7.25');
 await page.locator('#workspaceToggle').click();
 await page.locator('#workspaceList .workspace-select').first().click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 await page.locator('#workspaceToggle').click();
 for(let i=2;i<10;i++){
  await page.locator('#workspaceAdd').click();
  if(i<9)await page.locator('#workspaceToggle').click();
 }
 assert.equal(await page.locator('#workspaceCount').textContent(),'10');
 await page.locator('#workspaceToggle').click();
 assert.equal(await page.locator('#workspaceAdd').isDisabled(),true);
 await page.screenshot({path:path.join(artifacts,'19-ten-workspaces.png'),animations:'disabled'});
 page.on('dialog',dialog=>dialog.accept());
 for(let i=0;i<9;i++){
  await page.locator('#workspaceList .workspace-remove:not([disabled])').first().click();
  if(await page.locator('#workspaceDrawer').getAttribute('aria-hidden')==='true')await page.locator('#workspaceToggle').click();
 }
 assert.equal(await page.locator('#workspaceCount').textContent(),'1');
 assert.equal(await page.locator('#workspaceList .workspace-remove').first().isDisabled(),true);
 await page.locator('#workspaceDrawerClose').click();
 // Kütüphane: full-width dual columns, separate Worker tab and persistent preset favorites.
 await page.locator('#libraryNav').click();
 await page.locator('#libraryPage').waitFor({state:'visible'});
 assert.equal(await page.locator('#libraryPage').isVisible(),true);
 const libraryColumns=await page.evaluate(()=>{
  const left=document.getElementById('codSearchForm').getBoundingClientRect();
  const right=document.getElementById('codResultsBox').getBoundingClientRect();
  return {leftRight:left.right,rightLeft:right.left,rightRight:right.right,rightWidth:right.width,leftWidth:left.width,viewportWidth:innerWidth};
 });
 assert.ok(libraryColumns.rightLeft>=libraryColumns.leftRight,'search results must be to the right of filters');
 assert.ok(libraryColumns.rightWidth>libraryColumns.leftWidth,'results should have the wider column');
 assert.ok(libraryColumns.rightRight>libraryColumns.viewportWidth-60,'library should use nearly full viewport width');
 await page.screenshot({path:path.join(artifacts,'12-library-search.png'),animations:'disabled'});
 await page.locator('#libWorkerTab').click();
 assert.equal(await page.locator('#libWorkerPane').isVisible(),true);
 assert.equal(await page.locator('#codSearchForm').isVisible(),false,'Worker settings must not share the search pane');
 assert.equal(await page.locator('#codWorkerUrl').isVisible(),true);
 // With no stored custom endpoint, the built-in COD Worker must be visible
 // and the automatic search must actually route through that Worker.
 const defaultCodWorker='https://kristalyapi-cod-api.aoakkirman.workers.dev';
 assert.equal(await page.locator('#codWorkerUrl').inputValue(),defaultCodWorker);
 assert.match(await page.locator('#codWorkerStatus').textContent(),/Varsayılan/);
 const defaultWorkerCalls=[];
 const defaultWorkerRoute=async route=>{
  defaultWorkerCalls.push(route.request().url());
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({data:[{id:'4335507',
    attributes:{chemical_formula_reduced:'Si',_cod_formula:'- Si -'}}]})});
 };
 await page.route(defaultCodWorker+'/api/**',defaultWorkerRoute);
 await page.locator('#libSearchTab').click();
 await page.locator('#codConnection').selectOption('auto');
 await page.locator('#codId').fill('4335507');
 await page.locator('#codSubmit').click();
 await page.waitForFunction(()=>document.querySelector('#codResults .lib-cod-id')?.textContent==='4335507');
 assert.ok(defaultWorkerCalls.some(url=>url.startsWith(defaultCodWorker+'/api/structures')),
  'default COD Worker must handle automatic searches when no custom URL exists');
 await page.locator('#codReset').click();
 await page.unroute(defaultCodWorker+'/api/**',defaultWorkerRoute);
 await page.locator('#libWorkerTab').click();
 // An explicit override wins; clearing it restores the default instead of
 // accidentally disabling the Worker and bypassing CORS.
 await page.locator('#codWorkerUrl').fill('https://custom-worker.example');
 await page.locator('#codWorkerSave').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.cod.worker-url.v1')),
  'https://custom-worker.example');
 await page.locator('#codWorkerClear').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.cod.worker-url.v1')),null);
 assert.equal(await page.locator('#codWorkerUrl').inputValue(),defaultCodWorker);
 await page.screenshot({path:path.join(artifacts,'13-library-worker.png'),animations:'disabled'});
 await page.locator('#libPresetsTab').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),7);
 assert.equal(await page.locator('select#preset').count(),0,'example structures must be a list, not a dropdown');
 await page.locator('#presetList .preset-choice').filter({hasText:'Sodyum klorür'}).click();
 assert.match(await page.locator('#presetName').textContent(),/Sodyum klorür/);
 assert.match(await page.locator('#presetSpacegroup').textContent(),/225/);
 await page.locator('#presetFavorite').click();
 assert.equal(await page.locator('#presetFavorite').getAttribute('aria-pressed'),'true');
 assert.match(await page.evaluate(()=>localStorage.getItem('kristalyapi.preset-favorites.v1')),/nacl/);
 await page.locator('#presetFavoritesOnly').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),1);
 await page.locator('#presetFavoritesOnly').click();
 await page.screenshot({path:path.join(artifacts,'14-library-presets.png'),animations:'disabled'});
 await page.locator('#importPreset').click();
 assert.match(await page.locator('#infoName').textContent(),/Sodyum klorür/);
 await page.locator('#libraryNav').click();
 await page.locator('#libPresetsTab').click();
 await page.locator('#presetList .preset-choice').filter({hasText:'Silisyum'}).click();
 await page.locator('#importPreset').click();
 assert.match(await page.locator('#infoName').textContent(),/Silisyum/);
 await page.waitForTimeout(250);
 const originalView=await sample(page);
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(180);
 const orthoView=await sample(page);
 await page.screenshot({path:path.join(artifacts,'17-orthographic-projection.png'),animations:'disabled'});
 assert.ok(orthoView.ink>originalView.ink*.55&&orthoView.ink<originalView.ink*1.85,
  'orthographic projection must keep roughly the same magnification');
 await page.locator('#projectionBtn').click();
 assert.equal(await page.locator('#projectionBtn').getAttribute('aria-pressed'),'false');
 await page.waitForTimeout(180);
 const restoredView=await sample(page);
 assert.ok(Math.abs(restoredView.ink-originalView.ink)<originalView.ink*.22,
  'repeated projection switching must not gradually zoom the structure');
 const tools=page.locator('[data-right-tool]');
 assert.equal(await tools.count(),15,'measurement history, Miller, defects and QE must retain independent analysis icons');
  for(const tool of ['measurement','history','miller','defects','qe']){
    assert.equal(await page.locator('[data-right-tool="'+tool+'"]').count(),1,
      tool+' must have exactly one right-toolbar icon');
  }
 assert.equal(await page.locator('[data-right-tool="measurement"]').evaluate(el=>el.nextElementSibling?.dataset.rightTool),'history',
  'measurement and history icons should be immediately adjacent');
 for(const [source,destination] of [
  ['bondRules','bonds'],['matrixPreset','lattice'],['spaceGroup','symmetry']
 ]){
  assert.equal(await page.locator('#leftGeneralPane #'+source).count(),0,source+' must leave the left sidebar');
  assert.equal(await page.locator('#rightDrawerPane-'+destination+' #'+source).count(),1,source+' must move into the right drawer');
 }
 await page.locator('[data-right-tool="info"]').click();
 await page.waitForFunction(()=>document.getElementById('rightPanel').getBoundingClientRect().width>300);
 assert.equal(await page.locator('.right-drawer-pane:visible').count(),1);
 assert.equal(await page.locator('[data-right-tool="info"]').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#rightDrawerPane-info .section h2').isHidden(),true,'the repeated inner panel title should be hidden');
 assert.equal(await page.locator('#rightDrawerPane-info').getByText('Bilimsel kapsam').count(),0);
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 await page.screenshot({path:path.join(artifacts,'21-open-drawer-horizontal-toolbar.png'),animations:'disabled'});
 await page.setViewportSize({width:1100,height:800});
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 await page.setViewportSize({width:1480,height:920});
 await page.locator('[data-right-tool="info"]').click();
 await page.waitForFunction(()=>document.getElementById('rightPanel').getBoundingClientRect().width<60);
 assert.equal(await page.locator('#rightDrawerContent').isHidden(),true,'active icon must close its own drawer');
 await assertHorizontalQuickbar(page);
 assert.ok((await page.locator('#quickAtomScale').boundingBox()).width<=145,'atom size slider must be compact');
 assert.ok((await page.locator('#quickBondCut').boundingBox()).width<=145,'bond cutoff slider must be compact');
 assert.ok((await page.locator('#polyElement').boundingBox()).width<=160,'coordination center selector must be compact');
 await page.screenshot({path:path.join(artifacts,'20-compact-lower-toolbar.png'),animations:'disabled'});
 await page.locator('[data-right-tool="measurement"]').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'0');
 assert.equal(await page.locator('#historyToolCount').textContent(),'0');
 assert.equal(await page.locator('#rightDrawerPane-measurement #measurementHistory').count(),0,
  'the saved history list should be in its own drawer');
 assert.equal(await page.locator('#openMeasurementHistory').isVisible(),true,'the history shortcut should exist even with zero records');
 await page.evaluate(()=>window.__visualTest.select([0,1,2]));
 assert.equal(await page.locator('#measureList .measure-item').count(),3);
 assert.equal(await page.locator('#angleResult').isVisible(),true);
 const palette=await page.evaluate(()=>[
  '#measureList .measure-item','#distanceResult','#angleResult'
 ].map(selector=>getComputedStyle(document.querySelector(selector)).backgroundColor));
 assert.deepEqual(palette,['rgb(237, 244, 254)','rgb(237, 248, 241)','rgb(255, 241, 240)'],
  'atoms, distances and angles should have distinct gentle colors');
 await page.screenshot({path:path.join(artifacts,'22-measurement-pastel-cards.png'),animations:'disabled'});
 await page.locator('#saveMeasurement').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'1');
 assert.equal(await page.locator('#historyToolCount').textContent(),'1');
 await page.locator('#openMeasurementHistory').click();
 assert.equal(await page.locator('#rightDrawerPane-history').isVisible(),true);
 assert.equal(await page.locator('#measurementHistory .bond-rule-row').count(),1);
 await page.screenshot({path:path.join(artifacts,'23-measurement-history-drawer.png'),animations:'disabled'});
 await page.locator('#clearHistory').click();
 assert.equal(await page.locator('#measurementCount').textContent(),'0');
 assert.equal(await page.locator('#historyToolCount').textContent(),'0');
 assert.match(await page.locator('#measurementHistory').textContent(),/Henüz kayıt yok/);
 await page.locator('[data-right-tool="measurement"]').click();
 await page.locator('#clearMeasure').click();
 await page.locator('[data-right-tool="measurement"]').click();
 const dockBounds=await page.locator('#workbenchQuickbar').boundingBox();
 const polyBounds=await page.locator('#polyNeighbors').boundingBox();
 assert.ok(polyBounds.y+polyBounds.height<=dockBounds.y+dockBounds.height-2,
  'coordination settings must not clip beneath the dock: '+JSON.stringify({dockBounds,polyBounds}));
 await save(page,'01-silicon-perspective',metrics);
 await page.getByRole('button',{name:'Üstten görünüm'}).click();
 await page.waitForTimeout(650);
 await save(page,'02-silicon-top',metrics);
 assert.notEqual(metrics['01-silicon-perspective'].sum,metrics['02-silicon-top'].sum,'camera view should change canvas pixels');
 // Real CIF + WebGL regression: ten crystallographic sites do not mean ten fully
 // occupied atoms; alternative Cs coordinates never become spurious Cs bonds.
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/fixtures/COD_1561664_Cs_H2O_MoS2.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('1561664'),null,{timeout:20000});
 const codDisorder=await page.evaluate(()=>window.__visualTest.codDisorderScene());
 assert.deepEqual([codDisorder.sites,codDisorder.mo,codDisorder.s,codDisorder.cs],[10,2,4,4]);
 assert.equal(codDisorder.drawn,10,'3D scene must show the ten resolved positions');
 assert.equal(codDisorder.instances,10,'all ten positions must reach WebGL instancing');
 assert.ok(Math.abs(codDisorder.weighted-6.24)<1e-7,'site occupancies imply 6.24 weighted atoms');
 assert.equal(codDisorder.csRender.length,4);
 assert.ok(codDisorder.csRender.every(atom=>atom.transparent&&atom.opacity<1),
  'partial Cs occupancies must use visible translucent materials');
 assert.ok(codDisorder.orderedOpacity.every(opacity=>opacity===1),
  'Mo and S sites remain opaque');
 assert.equal(codDisorder.csCsEdges,0,'alternative Cs sites must not be bonded');
 assert.equal(codDisorder.drawnCsLinks,0,'rendered bond pairs must not include Cs links');
 assert.equal(codDisorder.moSEdges,12,'Mo centers must keep six Mo-S neighbors');
 assert.deepEqual(codDisorder.moShells,[6,6]);
 await save(page,'03a-cod-1561664-disorder',metrics);
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('4335507'),null,{timeout:20000});
 await save(page,'03-cod-4335507',metrics);
 // P2: VESTA-like occupancy display keeps crystallographic source and unit-cell
 // site count unchanged while selectively changing rendered alternative images.
 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/fixtures/COD_1561664_Cs_H2O_MoS2.cif'));
 await page.waitForFunction(()=>document.getElementById('infoName')?.textContent?.includes('1561664'),null,{timeout:20000});
 assert.equal(await page.locator('#infoSites').textContent(),'10');
 assert.equal(await page.locator('#infoWeighted').textContent(),'6.24');
 assert.equal(await page.locator('#siteRows .site-occupancy.partial').count(),4);
 assert.match(await page.locator('#siteOccupancySummary').textContent(),/H, O/);
 const allBefore=await page.evaluate(()=>window.__visualTest.instancing());
 assert.equal(allBefore.instances,10,'all crystal sites are rendered by default');
 await page.locator('#disorderView').selectOption('dominant');
 assert.equal((await page.evaluate(()=>window.__visualTest.instancing())).instances,8,
  'representative choice displays the higher-occupancy Cs alternative group');
 assert.equal(await page.locator('#infoSites').textContent(),'10','structure count is unchanged by display mode');
 assert.equal(await page.locator('#infoWeighted').textContent(),'6.24','full occupancy sum is unchanged by display mode');
 await save(page,'03b-cod-1561664-representative',metrics);
 await page.locator('#disorderView').selectOption('ordered');
 assert.equal((await page.evaluate(()=>window.__visualTest.instancing())).instances,6,
  'ordered-only view shows two Mo and four S sites');
 await page.locator('#disorderView').selectOption('all');
 assert.equal((await page.evaluate(()=>window.__visualTest.instancing())).instances,10);
 await save(page,'03c-cod-1561664-all-sites',metrics);

 await page.locator('#fileInput').setInputFiles(path.join(base,'tests/browser/adp_visual.cif'));
 await page.waitForFunction(()=>document.querySelector('#infoName')?.textContent?.includes('adp visual'),null,{timeout:20000});
 await page.locator('[data-quick-flag="adpVisible"]').click();
 assert.equal(await page.locator('#adpLevel').isEnabled(),true);
 await page.locator('#adpLevel').selectOption('90');
 await save(page,'04-adp-90',metrics);
 await page.locator('[data-right-tool="layers"]').click();
 await page.locator('#layerManager').getByLabel('Termal elipsoitler görünürlük').uncheck();
 await save(page,'05-adp-hidden',metrics);
 assert.notEqual(metrics['04-adp-90'].sum,metrics['05-adp-hidden'].sum,'ADP visibility should change canvas');
 await page.locator('[data-right-tool="miller"]').click();
 await page.locator('#showPlane').check();
 await page.locator('#applyPlane').click();
 await save(page,'06-miller',metrics);
 assert.notEqual(metrics['05-adp-hidden'].sum,metrics['06-miller'].sum,'Miller layer should change canvas');
 await page.locator('#morphPreset').click();
 await save(page,'07-cubic-morphology',metrics);
 assert.notEqual(metrics['06-miller'].sum,metrics['07-cubic-morphology'].sum,'morphology should affect rendering');
 await page.locator('[data-right-tool="comparison"]').click();
 await page.locator('#overlayFile').setInputFiles(path.join(base,'tests/validation/fixtures/real/COD_4335507.cif'));
 await page.waitForFunction(()=>document.querySelector('#overlaySummary')?.textContent?.includes('1 ek'),null,{timeout:10000});
 await save(page,'08-two-crystals',metrics);
 assert.notEqual(metrics['07-cubic-morphology'].sum,metrics['08-two-crystals'].sum,'second CIF should change rendering');
 // IT92 and neutron scattering modes use distinct physical coefficients.
 await page.locator('[data-right-tool="xrd"]').click();
 await page.locator('#xrdScattering').selectOption('neutron');
 await page.locator('#analyzeXrd').click();
 assert.match(await page.locator('#xrdSummary').textContent(),/nötron b_coh/);
 await page.locator('#xrdScattering').selectOption('xray');
 await page.locator('#analyzeXrd').click();
 assert.match(await page.locator('#xrdSummary').textContent(),/IT92/);
 assert.match(await page.locator('#xrdProfileStatus').textContent(),/Pseudo-Voigt/);
 assert.ok(await page.locator('#xrdChart path').count()>0,'profile needs a continuous curve');
 await page.locator('#xrdMeasuredFile').setInputFiles({name:'measured.csv',mimeType:'text/csv',
  buffer:Buffer.from('2theta_deg,intensity\n20,10\n30,50\n40,30\n')});
 await page.waitForFunction(()=>document.getElementById('xrdMeasuredStatus')?.textContent?.includes('3 ölçüm'));
 assert.match(await page.locator('#xrdMeasuredStatus').textContent(),/3 ölçüm/);
 assert.ok(await page.locator('#xrdChart path').count()>=2,'measured curve overlays the simulated profile');
 const [profileCsvDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#xrdProfileExport').click()]);
 assert.match(await fs.readFile(await profileCsvDownload.path(),'utf8'),/^2theta_deg,simulated_intensity/);
 await page.locator('#xrdMeasuredClear').click();
 await page.locator('#xrdMapAdd').click();
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===1);
 assert.match(await page.locator('#volumeInfo').textContent(),/FOURIER/);
 await page.locator('#clearVolume').click();
 // Read the pinned experimental CCP4 brick through the actual file-input UI.
 await page.locator('#volumeImportUnits').selectOption('unknown');
 await page.locator('#volumeFile').setInputFiles(path.join(base,'tests/fixtures/gemmi-5i55_tiny.ccp4'));
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===1,null,{timeout:10000});
 const ccp4Info=await page.evaluate(()=>window.__visualTest.ccp4());
 assert.deepEqual(ccp4Info.dims,[6,8,10]);
 assert.deepEqual(ccp4Info.mapping,[2,1,3]);
 assert.deepEqual(ccp4Info.starts,[50,-8,40]);
 assert.equal(ccp4Info.periodic,false);
 assert.equal(ccp4Info.quantity,'unknown');
 assert.match(await page.locator('#volumeInfo').textContent(),/CCP4\/MRC/);
 if(!await page.locator('#rightDrawerPane-volume').isVisible())await page.locator('[data-right-tool="volume"]').click();
 await page.locator('#volumeSurfaceStyle').selectOption('hybrid');
 await page.locator('#volumePairThreshold').fill('0.15');
 await page.locator('#volumeIsoPair').click();
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),3);
 await page.locator('#volumeContours').check();
 await page.locator('#volumeContourMode').selectOption('balanced');
 await page.locator('#volumeContourStyle').selectOption('signed');
 const volumeVisual=await page.evaluate(()=>window.__visualTest.volumeVisual());
 assert.equal(volumeVisual.style,'hybrid');
 assert.equal(volumeVisual.isoCount,3);
 assert.ok(volumeVisual.values.some(v=>Math.abs(v-.15)<1e-6));
 assert.ok(volumeVisual.values.some(v=>Math.abs(v+.15)<1e-6));
 assert.equal(volumeVisual.contourMode,'balanced');
 assert.equal(volumeVisual.contourStyle,'signed');
 assert.ok(volumeVisual.wires>0,'hybrid iso style must draw wire meshes');
 assert.ok(volumeVisual.fills>0,'hybrid iso style must draw filled meshes');
 assert.ok(await canvasInk(page,'#volumeSlicePreview')>5,'signed CCP4 contour preview must render');
 const [sliceDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#volumeSlicePng').click()]);
 const slicePng=await fs.readFile(await sliceDownload.path());
 assert.equal(slicePng.readUInt32BE(16),768,'P9.2 PNG export width');
 assert.equal(slicePng.readUInt32BE(20),768,'P9.2 PNG export height');
 const sliceWorkerStats=await page.evaluate(()=>window.__visualTest.performance());
 assert.ok(sliceWorkerStats.sliceExportWorkerMs>=0,'P10.3 PNG raster sampling must run in an offline Worker');
 assert.ok(sliceWorkerStats.contourWorkerSegments>0,'P10.4 signed contour marching-squares must run in Worker');
 const [sliceCsvDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#volumeSliceCsv').click()]);
 const sliceCsv=await fs.readFile(await sliceCsvDownload.path(),'utf8');
 assert.match(sliceCsv,/x_A,y_A,z_A,value_/);
 assert.ok(sliceCsv.trim().split('\n').length>200,'P10.4 CSV Worker should return physical sample coordinates');
 await page.locator('#clearVolume').click();
 await page.locator('#volumeSurfaceStyle').selectOption('smooth');
 await page.locator('#volumeContourMode').selectOption('uniform');
 await page.locator('#volumeContourStyle').selectOption('standard');
 await page.locator('#volumeContours').uncheck();
 const cubePreviousStructure=await page.evaluate(()=>window.__visualTest.snapshotStructure());
 // P10.9: native CUBE Å atom coordinates remain aligned with the density
 // even when its origin lies outside a padded nonperiodic display box.
 const cubeValues=Array.from({length:64},(_,i)=>Math.exp(-((i%4-1.5)**2+(.5-Math.floor(i/4)%4)**2)));
 const cube=['P10.9 molecule density','X outer Y middle Z inner',
  '2 -2 1 0','4 1 0 0','4 0 1 0','4 0 0 1',
  '8 0 -1 0 0','1 0 0 0 0',cubeValues.join(' ')].join('\n');
 await page.locator('#volumeFile').setInputFiles({name:'atoms.cube',mimeType:'text/plain',buffer:Buffer.from(cube)});
 await page.waitForFunction(()=>window.__visualTest.cubeAtoms()?.atomWorld.length===2,null,{timeout:10000});
 const cubeVisual=await page.evaluate(()=>window.__visualTest.cubeAtoms());
 assert.equal(cubeVisual.nonPeriodic,true);
 assert.equal(cubeVisual.cellVisible,false);
 assert.match(cubeVisual.virtualCellVolumeText,/görüntüleme kutusu/);
 assert.ok(Math.abs(cubeVisual.atomWorld[0][0]+.529177210903)<1e-6,'O position remains raw Cartesian Å');
 assert.ok(Math.abs(cubeVisual.atomWorld[1][0])<1e-6,'H position remains raw Cartesian Å');
 const cubeSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kristalyapi.last-structure.v2')));
 assert.equal(cubeSaved.nonPeriodic,true);
 assert.deepEqual(cubeSaved.nonPeriodicOrigin.map(Number),cubeVisual.offset.map(Number));
 await save(page,'29-cube-atoms-density-alignment',metrics);
 await page.locator('#clearVolume').click();
 // The rest of this long smoke test must use its original crystallographic
 // state. Clearing an imported density alone does not replace CUBE's
 // nonperiodic display structure; leaving it active changes later Moyo tests.
 await page.evaluate(snapshot=>window.__visualTest.restoreStructure(snapshot),cubePreviousStructure);
 // P11: interleaved NVAL CUBE becomes two independently selectable layers.
 const twoCube=['P11 two-channel cube','interleaved per voxel',
  '2 -2 1 0 2','4 1 0 0','4 0 1 0','4 0 0 1',
  '8 0 -1 0 0','1 0 0 0 0',
  cubeValues.flatMap(value=>[value,value*.25]).join(' ')].join('\n');
 await page.locator('#volumeFile').setInputFiles({name:'two-fields.cube',mimeType:'text/plain',buffer:Buffer.from(twoCube)});
 await page.waitForFunction(()=>window.__visualTest.volumetricFields().names.length===2,null,{timeout:10000});
 let multiVisual=await page.evaluate(()=>window.__visualTest.volumetricFields());
 assert.ok(multiVisual.names[1].includes('Alan 2'));
 assert.ok(Math.abs(multiVisual.values[0][1]*.25-multiVisual.values[1][1])<1e-6);
 await page.locator('#volumeActiveDataset').selectOption('1');
 multiVisual=await page.evaluate(()=>window.__visualTest.volumetricFields());
 assert.equal(multiVisual.active,1,'second CUBE channel should be selected');
 assert.equal(multiVisual.kind,'CUBE');
 await page.locator('#clearVolume').click();
 await page.evaluate(snapshot=>window.__visualTest.restoreStructure(snapshot),cubePreviousStructure);
 // P11: ATOMS-only molecular XSF, two independently named DATAGRIDs.
 const molecularXsf=['ATOMS','8 -1 0 0','1 0 0 0','BEGIN_BLOCK_DATAGRID_3D',
  'electron_channels','BEGIN_DATAGRID_3D_density','4 4 4','-2 1 0',
  '3 0 0','0 3 0','0 0 3',cubeValues.join(' '),'END_DATAGRID_3D',
  'BEGIN_DATAGRID_3D_delta','4 4 4','-2 1 0','3 0 0','0 3 0','0 0 3',
  cubeValues.map(v=>-.5*v).join(' '),'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeFile').setInputFiles({name:'molecular-two.xsf',mimeType:'text/plain',buffer:Buffer.from(molecularXsf)});
 await page.waitForFunction(()=>window.__visualTest.volumetricFields().names.length===2,null,{timeout:10000});
 multiVisual=await page.evaluate(()=>window.__visualTest.volumetricFields());
 assert.equal(multiVisual.nonPeriodic,true);
 assert.equal(multiVisual.worldAtoms.length,2);
 assert.ok(Math.abs(multiVisual.worldAtoms[0][0]+1)<1e-6,'XSF ATOMS must retain original Cartesian Å');
 assert.ok(multiVisual.names[0].includes('density')&&multiVisual.names[1].includes('delta'));
 assert.ok(Math.abs(multiVisual.values[0][1]*-.5-multiVisual.values[1][1])<1e-6);
 await page.locator('#volumeActiveDataset').selectOption('1');
 assert.equal((await page.evaluate(()=>window.__visualTest.volumetricFields())).active,1);
 await page.locator('#clearVolume').click();
 await page.evaluate(snapshot=>window.__visualTest.restoreStructure(snapshot),cubePreviousStructure);
 // A tiny XSF plane-wave field produces real isosurfaces on a simple Cartesian grid.
 const values=[];for(let k=0;k<4;k++)for(let j=0;j<4;j++)for(let i=0;i<4;i++)
  values.push(Math.exp(-((i-1.5)**2+(j-1.5)**2+(k-1.5)**2)));
 const xsf=['BEGIN_BLOCK_DATAGRID_3D','density','BEGIN_DATAGRID_3D_density',
  '4 4 4','0 0 0','3 0 0','0 3 0','0 0 3',values.join(' '),
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeImportUnits').selectOption('density-angstrom');
 await page.locator('#volumeFile').setInputFiles({name:'density.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf)});
 if(!await page.locator('#rightDrawerPane-volume').isVisible())await page.locator('[data-right-tool="volume"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===1,null,{timeout:10000});
 await page.locator('#volumeContours').check();
 await page.locator('#volumeContourCount').fill('10');await page.locator('#volumeContourCount').dispatchEvent('change');
 assert.equal(await page.locator('#volumeSlicePreview').isVisible(),true,'2D slice preview must be visible');
 assert.ok(await canvasInk(page,'#volumeSlicePreview')>10,'contoured slice preview must have sampled pixels');
 await page.locator('#volumeSlicePreview').scrollIntoViewIfNeeded();
 const previewBounds=await page.locator('#volumeSlicePreview').boundingBox();
 await page.mouse.move(previewBounds.x+previewBounds.width*.2,previewBounds.y+previewBounds.height*.3);
 await page.mouse.down();
 await page.mouse.move(previewBounds.x+previewBounds.width*.8,previewBounds.y+previewBounds.height*.7,{steps:6});
 await page.mouse.up();
 await page.waitForFunction(()=>document.getElementById('volumeLineStats')?.textContent?.includes('geçerli örnek'));
 assert.equal(await page.locator('#volumeLineChart').isVisible(),true);
 assert.match(await page.locator('#volumeLineStats').textContent(),/Å/);
 const [lineDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#volumeLineCsv').click()]);
 const lineCsv=await fs.readFile(await lineDownload.path(),'utf8');
 assert.match(lineCsv,/^distance_A,u,v,x_A,y_A,z_A,value_/);
 assert.equal(lineCsv.trim().split('\n').length,130,'129 sampled values plus CSV header');
 await page.locator('#volumeIsoAdd').click();
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),2);
 const xsf2=['BEGIN_BLOCK_DATAGRID_3D','density2','BEGIN_DATAGRID_3D_density',
  '2 2 2','0 0 0','3 0 0','0 3 0','0 0 3','0 1 1 0 1 0 0 1',
  'END_DATAGRID_3D','END_BLOCK_DATAGRID_3D'].join('\n');
 await page.locator('#volumeAdditionalFile').setInputFiles({name:'second.xsf',mimeType:'text/plain',buffer:Buffer.from(xsf2)});
 await page.waitForFunction(()=>document.querySelectorAll('#volumeDatasets .volume-layer-row').length===2,null,{timeout:10000});
 await save(page,'09-two-volume-fields',metrics);
 await page.locator('#volumeMathA').selectOption('0');
 await page.locator('#volumeMathB').selectOption('1');
 await page.locator('#volumeMathK').fill('-1');
 await page.locator('#volumeMathAdd').click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),3,'derived volume is a separate layer');
 await page.locator('#volumeMathC').selectOption('2');
 assert.equal(await page.locator('#volumeMathK2').isEnabled(),true);
 await page.locator('#volumeMathK2').fill('-1');
 await page.locator('#volumeMathAdd').click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),4,
  'three-source A + k1B + k2C must produce one derived layer');
 await page.locator('#volumeExportFormat').selectOption('xsf');
 const [xsfDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#volumeExport').click()]);
 assert.match(await fs.readFile(await xsfDownload.path(),'utf8'),/BEGIN_DATAGRID_3D_scalar/);
 await page.locator('#volumeExportFormat').selectOption('cube');
 const [cubeDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#volumeExport').click()]);
 assert.match(await fs.readFile(await cubeDownload.path(),'utf8'),/Kristal Yapi \| quantity=/);
 await page.locator('#volumePeakFind').click();
 assert.ok((await page.locator('#volumePeakResults').textContent()).length>15);
 await page.locator('#volumeAxis').selectOption('hkl');
 assert.match(await page.locator('#volumeSliceStats').textContent(),/\(1 1 1\)/);
 await save(page,'25-miller-volumetric-slice',metrics);
 assert.match(await page.locator('#volumeSliceStats').textContent(),/Å/);
 // Volumetric grids and iso layer controls belong to the current structure.
 await page.locator('#workspaceToggle').click();await page.locator('#workspaceAdd').click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),0);
 await page.locator('#workspaceToggle').click();await page.locator('#workspaceList .workspace-select').first().click();
 assert.equal(await page.locator('#volumeDatasets .volume-layer-row').count(),4);
 await page.locator('#volumeActiveDataset').selectOption('0');
 assert.equal(await page.locator('#volumeIsoLayers .volume-layer-row').count(),2);
 await page.locator('[data-right-tool="lattice"]').click();
 await page.locator('#moyoDetect').click();
 await page.waitForFunction(()=>{
  const result=document.getElementById('moyoResult')?.textContent||'';
  return result.startsWith('SG #')||result.startsWith('SG tayini başarısız:');
 },null,{timeout:30000});
 const moyoMessage=await page.locator('#moyoResult').textContent();
 assert.match(moyoMessage,/^SG #\d+.*Hall \d+/,
  'Moyo integration error: '+moyoMessage+'; browser console: '+consoleErrors.join(' | '));
 assert.equal(await page.locator('#moyoApplyConventional').isEnabled(),true);
 await page.locator('#moyoApplyConventional').click();
 assert.match(await page.locator('#moyoResult').textContent(),/Yeni atomlar P1 olarak saklandı/,
  'Moyo standardization must pass geometry/occupancy/ADP checks');
 await save(page,'10-moyo-space-group',metrics);
 // The dock mirrors the original left controls and updates the same state.
 assert.equal(await page.locator('#workbenchQuickbar').isVisible(),true);
 await assertHorizontalQuickbar(page,{drawerOpen:true});
 for(const id of ['adpLevel','polyElement','polyCut','polyNeighbors']){
  assert.equal(await page.locator('#leftGeneralPane #'+id).count(),0,id+' must leave the left sidebar');
  assert.equal(await page.locator('#workbenchQuickbar #'+id).count(),1,id+' must appear in the dock');
 }
 assert.ok((await page.locator('#adpLevel').boundingBox()).width>=60,'ADP percentage must remain readable');
 assert.ok((await page.locator('#quickH').boundingBox()).width<=50,'Miller index inputs should fit three characters');
 await page.locator('#adpLevel').selectOption('50');
 const polyCenter=await page.locator('#polyElement option').nth(1).getAttribute('value');
 await page.locator('#polyElement').selectOption(polyCenter);
 assert.equal(await page.locator('#polyCut').isEnabled(),true);
 assert.equal(await page.locator('#polyNeighbors').isEnabled(),true);
 await page.locator('#polyCut').fill('3');await page.locator('#polyCut').press('Tab');
 await page.locator('#polyNeighbors').fill('8');await page.locator('#polyNeighbors').press('Tab');
 assert.equal(await page.locator('#polyElement').inputValue(),polyCenter);
 assert.equal(await page.locator('#polyNeighbors').inputValue(),'8');
 await page.locator('#polyElement').selectOption('');
 assert.equal(await page.locator('#polyCut').isDisabled(),true);
 await page.locator('#quickStyle').selectOption('space');
 assert.equal(await page.locator('#style').inputValue(),'space');
 await page.locator('#quickStyle').selectOption('ball');
 await page.locator('[data-quick-flag="labels"]').click();
 assert.equal(await page.locator('#labels').isChecked(),true);
 assert.equal(await page.locator('[data-quick-flag="labels"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-quick-flag="labels"]').click();
 assert.equal(await page.locator('[data-quick-flag="labels"]').getAttribute('aria-pressed'),'false');
 await page.locator('#quickAtomScale').evaluate(el=>{el.value='0.95';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await page.locator('#atomScale').inputValue(),'0.95');
 assert.equal(await page.locator('#quickAtomScaleVal').inputValue(),'0.95');
 await page.locator('#quickK').fill('0');await page.locator('#quickK').press('Tab');
 await page.locator('#quickL').fill('0');await page.locator('#quickL').press('Tab');
 await page.locator('#quickSlabThickness').fill('3');await page.locator('#quickSlabThickness').press('Tab');
 if(await page.locator('#quickShowPlane').getAttribute('aria-pressed')==='true')await page.locator('#quickShowPlane').click();
 await page.locator('#quickShowPlane').click();
 if(await page.locator('#quickRepeatMillerPlanes').getAttribute('aria-pressed')==='false')await page.locator('#quickRepeatMillerPlanes').click();
 await page.locator('#quickRepeatMillerPlanes').click();
 assert.equal(await page.locator('#quickShowPlane').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#quickRepeatMillerPlanes').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#h').inputValue(),'1');
 assert.equal(await page.locator('#k').inputValue(),'0');
 assert.equal(await page.locator('#l').inputValue(),'0');
 assert.equal(await page.locator('#slabThickness').inputValue(),'3');
 assert.equal(await page.locator('#showPlane').isChecked(),true);
 assert.equal(await page.locator('#repeatMillerPlanes').isChecked(),false);
 await page.locator('[data-right-tool="miller"]').click();
 assert.equal(await page.locator('#rightDrawerPane-miller #morphPreset').count(),1);
 assert.equal(await page.locator('#rightDrawerPane-lattice #morphPreset').count(),0);
 await page.locator('[data-right-tool="miller"]').click();
 await page.setViewportSize({width:650,height:760});
 assert.equal(await page.locator('#workbenchQuickbar').isVisible(),true);
 await assertHorizontalQuickbar(page,{mobile:true});
 await page.locator('#workbenchQuickbar').evaluate(dock=>{dock.scrollLeft=dock.scrollWidth;});
 assert.equal(await page.locator('#workbenchQuickbar').evaluate(dock=>{
  const miller=dock.querySelector('.quickbar-group:last-child').getBoundingClientRect();
  const viewport=dock.getBoundingClientRect();
  return miller.left>=viewport.left&&miller.right<=viewport.right;
 }),true,'horizontal scrolling must reveal the Miller controls');
 assert.equal(await page.evaluate(()=>document.getElementById('stage').getBoundingClientRect().bottom<=document.getElementById('workbenchQuickbar').getBoundingClientRect().top+1),true,'mobile dock must not cover WebGL drawing surface');
 await page.locator('[data-right-tool="symmetry"]').click();
 assert.equal(await page.locator('#rightDrawerPane-symmetry').isVisible(),true,'mobile drawer must open');
 await assertHorizontalQuickbar(page,{drawerOpen:true,mobile:true});
 assert.equal(await page.locator('.right-drawer-pane:visible').count(),1);
 await page.locator('[data-right-tool="symmetry"]').press('Escape');
 assert.equal(await page.locator('#rightDrawerContent').isHidden(),true,'Escape closes mobile drawer');
 await page.screenshot({path:path.join(artifacts,'11-mobile-quickbar.png'),animations:'disabled'});
 await page.locator('#libraryNav').click();
 await page.locator('#libSearchTab').click();
 assert.equal(await page.locator('#codSearchForm').isVisible(),true);
 const mobileColumns=await page.evaluate(()=>{
  const left=document.getElementById('codSearchForm').getBoundingClientRect();
  const right=document.getElementById('codResultsBox').getBoundingClientRect();
  return {leftBottom:left.bottom,rightTop:right.top,scrollWidth:document.getElementById('libSearchPane').scrollWidth,viewportWidth:innerWidth};
 });
 assert.ok(mobileColumns.rightTop>=mobileColumns.leftBottom-1,'mobile search results should stack below filters');
 assert.ok(mobileColumns.scrollWidth<=mobileColumns.viewportWidth+1,'mobile library should not overflow horizontally');
 await page.screenshot({path:path.join(artifacts,'15-mobile-library-search.png'),animations:'disabled'});
 await page.locator('#libPresetsTab').click();
 assert.equal(await page.locator('#presetList .preset-list-row').count(),7);
 await page.screenshot({path:path.join(artifacts,'16-mobile-library-presets.png'),animations:'disabled'});
 // Worker responses can be OPTIMADE-prefixed or classic JSON; both must
 // populate scientific columns and the on-demand COD detail modal.
 await page.locator('#libWorkerTab').click();
 await page.locator('#codWorkerUrl').fill('https://fixture-cod-worker.example');
 await page.locator('#codWorkerSave').click();
 await page.route('https://fixture-cod-worker.example/api/**',route=>{
  const url=new URL(route.request().url());
  const attrs={
   _cod_formula:'- Ge4 In0.94 La4 Mn2 -',_cod_commonname:'lanthanum manganese indium germanide (4/2/1/4)',
   _cod_sg:'C 1 2/m 1',_cod_sgHall:'-C 2y',_cod_sgNumber:'12',
   _cod_a:16.646,_cod_siga:.002,_cod_b:4.419,_cod_sigb:.0006,_cod_c:7.4834,_cod_sigc:.001,
   _cod_alpha:90,_cod_beta:106.893,_cod_gamma:90,_cod_vol:526.72,_cod_sigvol:.12,
   _cod_authors:'Anton O. Oliynyk; Stanislav S. Stoyko; Arthur Mar',
   _cod_title:'Quaternary Germanides RE4Mn2InGe4',_cod_journal:'Inorganic Chemistry',
   _cod_year:'2013',_cod_volume:'52',_cod_firstpage:'8264',_cod_lastpage:'8271',
   _cod_doi:'10.1021/ic401171v',_cod_Rall:.0234,_cod_Robs:.0195,
   _cod_wRobs:.0406,_cod_wRref:.0417,_cod_gofref:1.054,
   _cod_celltemp:173,_cod_sigcelltemp:2,_cod_diffrtemp:173,_cod_sigdiffrtemp:2,
   _cod_wavelength:.71073,_cod_radType:'MoKα',_cod_flags:'has coordinates'
  };
  if(url.pathname==='/api/structures'){
   route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'4335507',attributes:attrs}]})});
  }else if(url.pathname==='/api/search'){
   const original=Object.fromEntries(Object.entries(attrs).filter(([key])=>key.startsWith('_cod_')).map(([key,value])=>[key.slice(5),value]));
   route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{file:'4335507',...original}])});
  }else route.abort();
 });
 await page.locator('#libSearchTab').click();
 await page.locator('#codConnection').selectOption('worker');
 await page.locator('#codId').fill('4335507');
 await page.locator('#codSubmit').click();
 await page.waitForFunction(()=>document.querySelector('#codResults .lib-cod-id')?.textContent==='4335507');
 assert.match(await page.locator('#codResults').textContent(),/C 1 2\/m 1/);
 assert.match(await page.locator('#codResults').textContent(),/526\.72/);
 assert.match(await page.locator('#codResults').textContent(),/Inorganic Chemistry/);
 await page.locator('.lib-cod-id').click();
 assert.equal(await page.locator('#codDetailModal').isVisible(),true);
 await page.waitForFunction(()=>document.getElementById('codDetailStatus').hidden);
 assert.match(await page.locator('#codDetailGroups').textContent(),/16\.646 ± 0\.002 Å/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/0\.71073 Å/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/8264 – 8271/);
 assert.match(await page.locator('#codDetailGroups').textContent(),/Hayır/);
 await page.screenshot({path:path.join(artifacts,'24-cod-detail-worker.png'),animations:'disabled'});
 await page.locator('#codDetailClose').click();
 assert.equal(await page.locator('#codDetailModal').isHidden(),true);
 await page.locator('#languageEnglish').click();
 assert.equal(await page.locator('#libraryNav').textContent(),'Library');
 assert.match(await page.locator('#libSearchTab').textContent(),/Search COD/);
 await page.locator('.lib-cod-id').click();
 assert.match(await page.locator('#codDetailGroups').textContent(),/Structure parameters/);
 await page.locator('#codDetailClose').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('#homeLink').click();
 // The library retains the workspace launcher and its active destination.
 await page.setViewportSize({width:1480,height:920});
 await page.locator('#libraryNav').click();
 assert.equal(await page.locator('#workspaceToggle').isVisible(),true);
 assert.ok((await page.locator('#workspaceCurrent').textContent()).trim().length>0);
 await page.locator('#workspaceToggle').click();
 assert.equal(await page.locator('#workspaceDrawer').getAttribute('aria-hidden'),'false');
 await page.locator('#workspaceDrawerClose').click();
 await page.locator('#homeLink').click();
 // Open modal has three real sources. Choosing a sample targets the current workspace.
 await page.locator('#openBtn').click();
 assert.equal(await page.locator('#openModal').isVisible(),true);
 assert.equal(await page.locator('[data-open-tab]').count(),3);
 await page.locator('[data-open-tab="examples"]').click();
 assert.equal(await page.locator('#openList .open-item').count(),7);
 await page.screenshot({path:path.join(artifacts,'27-open-modal-examples.png'),animations:'disabled'});
 await page.locator('#openList .open-item').first().click();
 assert.equal(await page.locator('#openModal').isHidden(),true);
 const groups=await page.evaluate(()=>window.__visualTest.instancing());
 assert.ok(groups.atoms>=8&&groups.instances===groups.atoms&&groups.groups<groups.atoms,
  'atoms must be batched as InstancedMesh by element: '+JSON.stringify(groups));
 assert.ok(groups.bondGroups<=1,'bonds should also use a single instanced draw batch');
 await page.locator('#quickStyle').selectOption('poly');
 assert.equal(await page.locator('#polyElement').inputValue(),'Si');
 await page.waitForTimeout(100);
 const polyGroups=await page.locator('#stage').evaluate(()=>window.__visualTest.instancing());
 assert.equal(polyGroups.groups,1);
 await page.locator('#leftAtomsTab').click();
 await page.locator('#siteStyleColor').fill('#dd9944');
 await page.locator('#siteStyleScale').fill('1.6');
 await page.locator('#leftGeneralTab').click();
 const boundsSection=await page.locator('#boundXMin').evaluate(input=>({
  title:input.closest('.section')?.querySelector(':scope > h2')?.textContent?.trim(),
  previous:input.closest('.section')?.previousElementSibling?.querySelector(':scope > h2')?.textContent?.trim()
 }));
 assert.match(boundsSection.title,/Visible fractional bounds|Görünür kesirli sınırlar/);
 assert.match(boundsSection.previous,/Supercell|Süperhücre/);
 const boundsStyle=await page.locator('#boundXMin').evaluate(input=>({
  radius:getComputedStyle(input).borderRadius,
  background:getComputedStyle(input).backgroundImage,
  appearance:getComputedStyle(input).appearance
 }));
 assert.ok(parseFloat(boundsStyle.radius)>=7,'fractional bounds must have rounded modern input frames');
 assert.equal(boundsStyle.appearance,'textfield','legacy number spinners should be hidden');
 assert.equal(await page.locator('#xrdMaxIndex').count(),0,
  'powder diffraction must use the 2theta sphere, not an index cube');
 assert.equal(await page.locator('#volumeImportUnits option').count(),5);
 assert.equal(await page.locator('#xrdMapIndex').count(),0);
 assert.equal(await page.locator('#xrdMapResolution').getAttribute('min'),'0.35');
 assert.equal(await page.locator('#xrdMapSize option').count(),3);
 assert.deepEqual(await page.locator('#fcfMapKind option').evaluateAll(options=>
  options.map(opt=>opt.value)),
  ['difference','observed','twice-observed','weighted-main','weighted-difference']);
 assert.equal(await page.locator('#mtzFreeExclude option').count(),3);
 assert.equal(await page.locator('#mtzFomMode option').count(),2);
 assert.equal(await page.locator('#mtzMinSnr').getAttribute('min'),'0');
 assert.equal(await page.locator('#fcfScaleMode option').count(),2);

 // Real user path: restore the XRD drawer after library/workspace navigation
 // before interacting with its controls. Hidden controls cannot be selected.
 if(!await page.locator('#fcfScaleMode').isVisible())
  await page.locator('[data-right-tool="xrd"]').click();
 await page.locator('#fcfScaleMode').waitFor({state:'visible'});
 // The persistent bottom toolbar must contain its actual input boxes, even
 // when a field label wraps; overflow must not cut the last row off.
 const quickbarClip=await page.locator('#workbenchQuickbar').evaluate(bar=>{
  const bound=bar.getBoundingClientRect();
  return [...bar.querySelectorAll('.quickbar-field input,.quickbar-field select')]
   .filter(el=>getComputedStyle(el).visibility!=='hidden')
   .map(el=>({id:el.id,top:el.getBoundingClientRect().top,
    bottom:el.getBoundingClientRect().bottom}))
   .filter(rect=>rect.top<bound.top+2||rect.bottom>bound.bottom-2);
 });
 assert.deepEqual(quickbarClip,[],'quickbar inputs must stay within dock vertical bounds');
 // Real user path: upload an FCF in Chromium, choose nontrivial Fo/Fc
 // normalization, produce the map and surface the fitted scale diagnostics.
 await page.locator('#fcfScaleMode').selectOption('lsq');
 await page.locator('#fcfFile').setInputFiles({
  name:'two-reflections.fcf',mimeType:'text/plain',
  buffer:Buffer.from([
   'data_browser_FCF','loop_','_refln_index_h','_refln_index_k','_refln_index_l',
   '_refln_F_squared_meas','_refln_F_squared_calc','_refln_phase_calc',
   '1 0 0 100 25 0','0 1 0 49 25 90'
  ].join('\n'))
 });
 await page.waitForFunction(()=>document.querySelector('#fcfStatus')?.textContent.includes('2 yansıma'));
 await page.locator('#fcfMapAdd').click();
 await page.waitForFunction(()=>document.querySelector('#fcfStatus')?.textContent.includes('Fc ölçeği'),null,{timeout:15000});
 const fcfMessage=await page.locator('#fcfStatus').textContent();
 assert.match(fcfMessage,/2 benzersiz yansıma/);
 assert.match(fcfMessage,/Fc ölçeği 1\.70000 \(lsq\)/);
 assert.match(fcfMessage,/P1 ızgara kapsama/);

 assert.equal(await page.locator('#volumePeakRefine').isChecked(),true);
 assert.equal(await page.locator('#volumePeakMerge').isChecked(),false);
 assert.match(await page.locator('#volumeMathIntegral').textContent(),/Volume integral/);
 await page.locator('#boundXMin').fill('-0.1');await page.locator('#boundXMax').fill('1.1');
 await page.locator('#applyBounds').click();
 assert.deepEqual((await page.evaluate(()=>window.__visualTest.bounds()))[0],[-.1,1.1]);
 await page.locator('[data-right-tool="measurement"]').click();
 await page.locator('#languageTurkish').click();
 await page.waitForFunction(()=>document.querySelector('#rightDrawerPane-measurement .right-drawer-heading strong')?.textContent==='Atom seçimi ve ölçüm');
 await page.locator('#languageEnglish').click();
 await page.locator('[data-right-tool="measurement"]').click();
 await page.locator('#saveBtn').click();
 await page.locator('#pngScale').selectOption('2');
 const [pngDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="png"]').click()]);
 assert.match(pngDownload.suggestedFilename(),/\d+x\d+\.png$/);
 const output=await fs.readFile(await pngDownload.path());
 const [,exportWidth,exportHeight]=pngDownload.suggestedFilename().match(/_(\d+)x(\d+)\.png$/)||[];
 assert.equal(output.readUInt32BE(16),Number(exportWidth),'the PNG IHDR width must match requested buffer size');
 assert.equal(output.readUInt32BE(20),Number(exportHeight),'the PNG IHDR height must match requested buffer size');
 await page.setViewportSize({width:1024,height:768});
 await page.locator('#saveBtn').click();
 await page.locator('#pngScale').selectOption('4');
 const rect4=await page.locator('#stage').boundingBox();
 const [png4]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export="png"]').click()]);
 const output4=await fs.readFile(await png4.path());
 assert.equal(output4.readUInt32BE(16),Math.round(rect4.width*4),'4× screenshot width must not be clamped');
 assert.equal(output4.readUInt32BE(20),Math.round(rect4.height*4),'4× screenshot height must not be clamped');
 await page.setViewportSize({width:1480,height:920});
 await save(page,'26-polyhedron-per-site-instanced',metrics);
 // A previous volume suite has filled the five-layer budget (including the
 // earlier FCF layer). Start this independent import with an empty volume set.
 if(!await page.locator('#clearVolume').isVisible())
  await page.locator('[data-right-tool="volume"]').click();
 await page.locator('#clearVolume').click();
 assert.equal(await page.locator('#volumeActiveDataset option').count(),0);
 await page.locator('[data-right-tool="xrd"]').click();
 assert.equal(await page.locator('#fcfMapAdd').isVisible(),true);
 const fcfFixture=['data_smoke','loop_','_refln_index_h','_refln_index_k','_refln_index_l',
  '_refln_F_squared_meas','_refln_F_squared_calc','_refln_phase_calc',
  '1 0 0 100 64 0','0 1 0 25 16 90'].join('\n');
 await page.locator('#fcfFile').setInputFiles({name:'smoke.fcf',mimeType:'text/plain',buffer:Buffer.from(fcfFixture)});
 await page.waitForFunction(()=>document.getElementById('fcfStatus')?.textContent.includes('2 yansıma'));
 await page.locator('#fcfMapAdd').click();
 await page.waitForFunction(()=>document.querySelectorAll('#volumeActiveDataset option').length===1);
 assert.match(await page.locator('#fcfStatus').textContent(),/benzersiz yansıma/);
 const polyhedra=await page.evaluate(()=>window.__visualTest.perovskitePolys());
 assert.deepEqual({center:polyhedra.center,count:polyhedra.count,meshes:polyhedra.meshes,edges:polyhedra.edges},
  {center:'Ti',count:125,meshes:1,edges:1},'5×5×5 BaTiO3 should render all 125 Ti octahedra in two draw objects');
 // Independent geometric reference: ideal cubic BaTiO3 a=4 Å; each TiO6
 // octahedron has 6 vertices at ±a/2 on Cartesian axes.
 assert.ok(Math.abs(polyhedra.volume-125*Math.pow(4,3)/6)<1e-4,
  '125 ideal TiO6 octahedra must have total reference volume 125*a^3/6');
 assert.ok(Math.abs(polyhedra.area-125*Math.sqrt(3)*4*4)<1e-4,
  '125 ideal TiO6 octahedra must have surface 125*sqrt(3)*a^2');
 const hullCache=await page.evaluate(()=>window.__visualTest.performance().polyTemplates);
 assert.equal(hullCache.templates,1,'one unique TiO6 convex hull should be computed');
 assert.equal(hullCache.reuses,124,'other 124 TiO6 polyhedra should reuse local hull and translate vertices');
 assert.ok(hullCache.templateBytes>0);
 const polyAB=await page.evaluate(()=>window.__visualTest.polyRendererAB());
 assert.deepEqual(polyAB.map(x=>x.polyFaceStrategy),['merged','instanced','merged']);
 assert.deepEqual(polyAB.map(x=>x.centerCount),[125,125,125]);
 assert.ok(polyAB.every(x=>Math.abs(x.volume-125*Math.pow(4,3)/6)<1e-4));
 assert.ok(polyAB.every(x=>Math.abs(x.area-125*Math.sqrt(3)*16)<1e-4));
 assert.equal(polyAB[1].polyFaceDrawGroups,1,'one Ti template -> one InstancedMesh draw group');
 assert.ok(polyAB[1].managedGeometryBytes<polyAB[0].managedGeometryBytes,
  'P10.6 reusable instance matrices consume fewer managed geometry bytes than 125 copied hulls');
 assert.ok(polyAB.every(x=>Number.isFinite(x.buildPhases.polyhedraMs)),'benchmark observed on actual Chromium');
 await fs.writeFile(path.join(artifacts,'package-10-6-poly-ab.json'),JSON.stringify(polyAB,null,2));
 await page.waitForFunction(()=>document.querySelector('#polyElement option:checked')?.textContent.includes('centered polyhedron'));
 await page.locator('#polyMore').click();
 assert.equal(await page.locator('#polyCenterMenu').isVisible(),true,'extra center selector must open above dock');
 await page.locator('#polyCenterChoices input[value="O"]').check();
 const combined=await page.evaluate(()=>window.__visualTest.polyStats());
 assert.deepEqual(combined.centers,['Ti','O'],'two center elements must be active together');
 assert.ok(combined.count>=125,'additional centers must retain the original Ti octahedra');
 await page.locator('#polyCenterDone').click();
 assert.equal(await page.locator('#polyMore').textContent(),'+1');
 await page.evaluate(()=>window.__visualTest.select([0]));
 await page.waitForFunction(()=>document.querySelector('#measureList .measure-item .muted')?.textContent.includes('Fractional:'));
 assert.match(await page.locator('#measureList .measure-item .muted').textContent(),/occupancy:/);
 await save(page,'28-perovskite-125-polyhedra',metrics);
 const emptyPoly=await page.evaluate(()=>window.__visualTest.perovskiteWithoutNeighbors());
 assert.equal(emptyPoly.count,0);
 await page.waitForFunction(()=>document.getElementById('notice')?.textContent.includes('has no polyhedron'));
 assert.match(await page.locator('#notice').textContent(),/Ba has no polyhedron/);
 const restoredPoly=await page.evaluate(()=>window.__visualTest.syncedPolyCenter());
 assert.equal(restoredPoly.center,'Ti','syncControls must keep an empty polyhedron center for smart Ti selection');
 assert.ok(restoredPoly.count>0,'the synced perovskite should show nonempty Ti polyhedra');
 const chemistry=await page.evaluate(()=>window.__visualTest.tiChemistry());
 assert.match(chemistry,/Baur D: 0\.00000/,'ideal TiO6 has zero bond-length distortion');
 assert.match(chemistry,/Hoppe ECoN: 6\.0000/,'ideal TiO6 has effective CN 6');
 assert.match(chemistry,/Quadratic elongation: 1\.00000/,'regular octahedron has lambda 1');
 assert.match(chemistry,/Bağ açısı varyansı: 0\.000/,'regular octahedron has zero angle variance');
 const stress=await page.evaluate(()=>window.__visualTest.stressAtoms());
 assert.deepEqual(stress,{atoms:12960,meshes:1,instances:12960},
  'thousands of displayed atoms should occupy one instanced draw group');
 // Package 10.1: reproducible scene sizes; timing is reported, never CI-gated.
 const benchSeries=await page.evaluate(()=>window.__visualTest.stressSeries());
 assert.deepEqual(benchSeries.map(item=>item.visibleAtoms),[60,1620,12960]);
 assert.ok(benchSeries.every(item=>item.atomLod.length===1&&item.drawCalls>=1));
 assert.equal(benchSeries[2].atomLod[0].tier,'low','large scenes must use display-only LOD');
 assert.ok(benchSeries.every(item=>Number.isFinite(item.elapsedMs)&&item.elapsedMs>=0));
 await page.locator('#performanceBtn').click();
 assert.equal(await page.locator('#performancePanel').isVisible(),true);
 assert.equal(await page.locator('#performanceBtn').getAttribute('aria-expanded'),'true');
 // Software WebGL rendering varies widely on shared CI runners; keep the sample-count check, not a fixed FPS gate.
 await page.waitForFunction(()=>window.__visualTest.performance().samples>=8,null,{timeout:90000});
 const largeMetrics=await page.evaluate(()=>window.__visualTest.performance());
 assert.equal(largeMetrics.visibleAtoms,12960);
 assert.ok(largeMetrics.gpuTriangles>0&&largeMetrics.drawCalls>=1);
 assert.match(await page.locator('#performanceMetrics').textContent(),/WebGL/);
 const smallMetrics=await page.evaluate(()=>window.__visualTest.smallStress());
 assert.equal(smallMetrics.visibleAtoms,60);
 await page.locator('#atomQuality').selectOption('fast');
 await page.waitForTimeout(120);
 const fastMetrics=await page.evaluate(()=>window.__visualTest.performance());
 assert.equal(fastMetrics.atomLod[0].tier,'low');
 const exportProof=await page.evaluate(()=>window.__visualTest.highQualityExportProof());
 assert.deepEqual(exportProof,{restored:true,instances:60,before:60},
  'PNG must temporarily use full geometry and restore the interactive LOD');
 await page.locator('#atomQuality').selectOption('high');
 await page.waitForTimeout(120);
 const qualityMetrics=await page.evaluate(()=>window.__visualTest.performance());
 assert.equal(qualityMetrics.atomLod[0].tier,'high');
 assert.ok(qualityMetrics.atomLod[0].trianglesPerSphere>fastMetrics.atomLod[0].trianglesPerSphere,
  'quality override must increase sphere tessellation without changing atom instances');
 assert.equal(qualityMetrics.visibleAtoms,fastMetrics.visibleAtoms);
 await page.locator('#atomQuality').selectOption('auto');
 await page.locator('#performanceClose').click();
 assert.equal(await page.locator('#performancePanel').isVisible(),false);
 const perfReport={cases:benchSeries,largeMetrics,fastMetrics,qualityMetrics,exportProof};
 await fs.writeFile(path.join(artifacts,'package-10-1-benchmarks.json'),JSON.stringify(perfReport,null,2));
 metrics.package101=perfReport;

 // Reciprocal-space concept page on a known structure (silicon, a = 5.431 Å).
 const consoleBefore=consoleErrors.length;
 await page.locator('#openBtn').click();
 await page.locator('[data-open-tab="examples"]').click();
 await page.locator('#openList .open-item').first().click();
 await page.waitForFunction(()=>document.getElementById('openModal').hidden);
 // Both new course MVPs must be reachable through the top navigation and
 // calculate from the active crystal without fetching remote resources.
 await page.locator('#powderNav').click();
 await page.waitForFunction(()=>!document.getElementById('powderPage').hidden&&
  document.querySelectorAll('#pwPeaks button').length>2);
 assert.equal(await page.locator('#app').evaluate(el=>getComputedStyle(el).display),'none',
  'editor must not occupy space behind the powder lesson');
 assert.match(await page.locator('#pwSourceDetail').textContent(),/8 atom/);
 assert.match(await page.locator('#pwPeaks').textContent(),/28[.,]44°/,'Si {111} family may be indexed with negative signs');
 assert.ok(await page.locator('#pwChart path').count()>=1,'calculated powder profile must be drawn');
 await page.waitForFunction(()=>document.querySelector('#pwCrystal3d canvas')&&
  /hücre-içi düzlem|clipped planes/.test(document.querySelector('#pwPlaneStats').textContent));
 assert.ok(await canvasInk(page,'#pwCrystal3d canvas')>70,
  'Miller 3D viewer must render unit cell, atoms, and highlighted planes');
 assert.equal(await page.locator('#pwPlaneHkl').textContent(),
  '('+(await page.locator('#pwPeaks button').first().textContent()).split(')')[0].slice(1)+')');
 const initialHkl=await page.locator('#pwPlaneHkl').textContent();
 const initialImage=await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL());
 await page.locator('#pwChart .lesson-peak-hit').nth(1).click();
 assert.notEqual(await page.locator('#pwPlaneHkl').textContent(),initialHkl,
  'clicking a peak on the XRD graph selects its Miller planes');
 const secondImage=await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL());
 assert.notEqual(secondImage,initialImage,'a different (hkl) must change the rendered 3D planes');
 assert.equal(await page.locator('#pwPeaks button').nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('#pwPeaks button').first().click();
 assert.equal(await page.locator('#pwPlaneHkl').textContent(),initialHkl,
  'choosing from the reflection list must restore the selected plane');
 const powderBefore=await page.locator('#pwSummary').textContent();
 await page.locator('#pwLambda').evaluate(el=>{el.value='1.8';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.notEqual(await page.locator('#pwSummary').textContent(),powderBefore,'wavelength slider recalculates Bragg peaks');
 await page.locator('#pwPeaks button').first().click();
 assert.match(await page.locator('#pwBragg').textContent(),/Bragg/);
 await page.waitForFunction(()=>document.querySelectorAll('#pwWaveSvg path').length===3);
 const constructive=await page.locator('#pwPhaseReadout .lesson-metric').last().textContent();
 assert.match(constructive,/100[.,]0%/,'two coherent waves must constructively interfere at Bragg angle');
 const raysAtBragg=await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL());
 await page.locator('#pwTheta').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const offBragg=await page.locator('#pwPhaseReadout .lesson-metric').last().textContent();
 assert.notEqual(offBragg,constructive,'glancing angle must change the ideal interference');
 assert.notEqual(await page.locator('#pwCrystal3d canvas').evaluate(canvas=>canvas.toDataURL()),raysAtBragg,
  'incident and outgoing 3D beam arrows must follow glancing angle');
 await page.locator('#pwMatchBragg').click();
 assert.equal(await page.locator('#pwPhaseReadout .lesson-metric').last().textContent(),constructive,
  'Bragg reset returns to the constructive maximum');
 const waveBefore=await page.locator('#pwWaveSvg path').last().getAttribute('d');
 await page.locator('#pwWavePlay').click();
 await page.waitForTimeout(180);
 assert.notEqual(await page.locator('#pwWaveSvg path').last().getAttribute('d'),waveBefore,
  'animation must visibly advance wave phase');
 await page.locator('#pwWavePlay').click();
 assert.equal(await page.locator('#pwWavePlay').getAttribute('aria-pressed'),'false');
 await page.screenshot({path:path.join(artifacts,'lesson-01-powder-mvp.png')});
 await page.screenshot({path:path.join(artifacts,'lesson-03-powder-miller-3d.png')});
 await page.locator('#pwWaveSvg').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(artifacts,'lesson-04-bragg-interference.png')});

 await page.locator('#semiconductorNav').click();
 await page.waitForFunction(()=>!document.getElementById('semiconductorPage').hidden&&
  document.querySelectorAll('#scBandChart path').length>=2&&
  document.querySelectorAll('#scChainChart [data-energy-level]').length===8);
 assert.equal(await page.locator('#app').evaluate(el=>getComputedStyle(el).display),'none',
  'editor must not occupy space behind the semiconductor lesson');
 assert.match(await page.locator('#scSourceDetail').textContent(),/8 atom/);
 assert.equal(await page.locator('#scChainChart [data-chain-atom]').count(),8);
 await page.locator('#scChainAtoms').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),2,
  'two atoms must split one atomic energy into two levels');
 await page.locator('#scChainAtoms').evaluate(el=>{el.value='32';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#scChainChart [data-energy-level]').count(),32,
  'N atoms must create exactly N levels in the finite tight-binding chain');
 assert.equal(await page.locator('#scDualChart [data-dual-band]').count(),2,
  'two-orbital model must render distinct valence and conduction Bloch bands');
 assert.match(await page.locator('#scDualSummary').textContent(),/0[.,]800 eV/,
  'bond dimerization must open the expected two-orbital gap');
 await page.locator('#scDualMetal').click();
 assert.equal(await page.locator('#scDualChart [data-gap-region]').count(),0,
  'when both hoppings and orbital energies agree, the bands touch');
 await page.locator('#scDualDimer').click();
 const gapBefore=await page.locator('#scBandSummary').textContent();
 await page.locator('#scPotential').evaluate(el=>{el.value='0.9';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.notEqual(await page.locator('#scBandSummary').textContent(),gapBefore,'potential changes band splitting');
 assert.match(await page.locator('#scFermiSummary').textContent(),/0[.,]500/,'f(EF)=1/2');
 await page.screenshot({path:path.join(artifacts,'lesson-02-semiconductor-mvp.png'),timeout:60000});

 await page.locator('#reciprocalNav').click();
 await page.waitForFunction(()=>!document.getElementById('reciprocalPage').hidden&&document.getElementById('app').hidden);
 const reciprocalPalette=await page.evaluate(()=>{
  const color=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor;
  return {page:color('#reciprocalPage'),controls:color('#rsPaneLattice .rs-controls'),
   viewerCard:color('#rsPaneLattice .rs-figure'),viewer:color('#rsRealView'),
   concept:color('#rsPaneLattice .rs-concept'),readout:color('#rsLatticeReadout')};
 });
 assert.notEqual(reciprocalPalette.page,reciprocalPalette.viewerCard,'viewers must be distinct cards on the page');
 assert.notEqual(reciprocalPalette.concept,reciprocalPalette.readout,'concept and numeric panels need different surfaces');
 await page.waitForFunction(()=>document.querySelectorAll('#rsLatticeReadout dd').length>5);
 assert.equal(await page.locator('#reciprocalNav').getAttribute('aria-current'),'page');
 assert.match(await page.locator('#rsLatticeReadout').textContent(),/3\.13559 Å/,'d(111) of silicon');
 assert.match(await page.locator('#rsSourceDetail').textContent(),/8 atom/);
 await page.waitForTimeout(250);
 assert.ok(await canvasInk(page,'#rsRealView canvas')>40,'real-space view must draw the cell and planes');
 assert.ok(await canvasInk(page,'#rsRecipView canvas')>40,'reciprocal view must draw lattice points');
 assert.ok(await page.locator('#rsPhasor line').count()>=8,'one phasor arrow per atom');
 await page.screenshot({path:path.join(artifacts,'rs-01-lattice.png')});
 for(const [id,value] of [['#rsH','2'],['#rsK','0'],['#rsL','0']]){await page.locator(id).fill(value);await page.locator(id).dispatchEvent('change');}
 await page.waitForFunction(()=>/Systematic absence/.test(document.getElementById('rsLatticeReadout').textContent));
 assert.match(await page.locator('#rsPhasor').textContent(),/Closed polygon/);
 await page.locator('#rsTabEwald').click();
 await page.waitForFunction(()=>document.querySelectorAll('#rsEwaldSvg circle').length>20);
 // First visit auto-rotates to a Bragg position; the button steps to the next one.
 assert.ok(await page.locator('#rsEwaldList tbody tr').count()>=1,'a reflection should touch the Ewald sphere');
 const omegaBefore=Number(await page.locator('#rsOmega').inputValue());
 await page.locator('#rsNextBragg').click();
 await page.waitForFunction(o=>Number(document.getElementById('rsOmega').value)!==o,omegaBefore);
 assert.match(await page.locator('#rsEwaldStatus').textContent(),/reflections on the sphere/);
 await page.locator('#rsEwaldMode').selectOption('powder');
 // Si with Cu Kα1 below 2θ = 70°: (111), (220), (311), (400) rings + the beam stop.
 await page.waitForFunction(()=>document.querySelectorAll('#rsRingsSvg circle').length===5);
 assert.ok(await page.locator('#rsStickSvg line').count()>10,'powder stick pattern');
 assert.match(await page.locator('#rsEwaldList').textContent(),/\(1 1 1\)/);
 await page.screenshot({path:path.join(artifacts,'rs-02-ewald-powder.png')});
 await page.locator('#rsTabZone').click();
 await page.waitForFunction(()=>document.querySelectorAll('#rsZoneSvg circle').length>20);
 assert.match(await page.locator('#rsZoneReadout').textContent(),/0\.02508 Å/,'relativistic λ at 200 kV');
 assert.ok(await page.locator('#rsZoneSvg circle[stroke-dasharray]').count()>0,'Si [110] has kinematically forbidden positions');
 await page.screenshot({path:path.join(artifacts,'rs-03-saed.png')});
 await page.locator('#rsTabBz').click();
 await page.waitForFunction(()=>/Face-centred cubic/.test(document.getElementById('rsBzReadout').textContent));
 assert.match(await page.locator('#rsBzReadout').textContent(),/14 · 24/,'truncated octahedron');
 assert.equal(await page.locator('#rsBandSvg path').count(),10,'one polyline per band');
 await page.waitForTimeout(250);
 assert.ok(await canvasInk(page,'#rsBzView canvas')>40,'Brillouin-zone view must draw the zone');
 await page.screenshot({path:path.join(artifacts,'rs-04-brillouin.png')});
 await page.locator('#languageTurkish').click();
 assert.equal(await page.locator('#reciprocalPage h2').textContent(),'Karşı Uzay ve Kırınım');
 assert.match(await page.locator('#rsBzReadout').textContent(),/Yüzey merkezli kübik/);
 await page.locator('#languageEnglish').click();
 assert.equal(await page.locator('#reciprocalPage h2').textContent(),'Reciprocal Space and Diffraction');
 await page.locator('#homeLink').click();
 await page.waitForFunction(()=>document.getElementById('reciprocalPage').hidden&&!document.getElementById('app').hidden);
 assert.deepEqual(consoleErrors.slice(consoleBefore),[],'reciprocal page console errors');
 // Fresh browser context, real Service Worker install and an actual offline
 // reload: the complete editor and reciprocal laboratory must survive.
 const offlineContext=await browser.newContext({viewport:{width:1280,height:800}});
 try{
  const offlinePage=await offlineContext.newPage();
  await offlinePage.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'load'});
  await offlinePage.waitForFunction(()=>navigator.serviceWorker?.controller!==null,null,{timeout:45000});
  const savedFiles=await offlinePage.evaluate(async()=>{
   const cacheNames=await caches.keys();
   const shell=cacheNames.find(name=>name.startsWith('kristalyapi-shell-'));
   return shell?(await (await caches.open(shell)).keys()).length:0;
  });
  assert.ok(savedFiles>=16,'Service Worker must cache all app modules including Moyo WASM');
  await offlineContext.setOffline(true);
  await offlinePage.reload({waitUntil:'domcontentloaded'});
  await offlinePage.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'));
  await offlinePage.locator('#reciprocalNav').click();
  await offlinePage.waitForFunction(()=>document.querySelectorAll('#rsLatticeReadout dd').length>5);
  assert.ok(await canvasInk(offlinePage,'#rsRealView canvas')>20,'offline reciprocal-space view must render');
  const offlineWorker=await offlinePage.evaluate(()=>new Promise((resolve,reject)=>{
   const w=new Worker('./volume-iso-worker.js');
   w.onmessage=e=>{w.terminate();resolve({error:e.data.error||null,triangles:e.data.results?.[0]?.triangles||0});};
   w.onerror=e=>{w.terminate();reject(Error('offline Worker: '+e.message));};
   const grid={dims:[2,2,2],origin:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]],
    values:new Float32Array([1,0,0,0,0,0,0,0]),min:0,max:1,periodic:false};
   w.postMessage({requestId:9,grids:[grid],jobs:[{grid:0,potential:-1,level:.5,palette:'thermal',maxTriangles:100}]},
    [grid.values.buffer]);
  }));
  assert.equal(offlineWorker.error,null,'cached isosurface Worker should load with network disabled');
  assert.ok(offlineWorker.triangles>0);
  await offlinePage.screenshot({path:path.join(artifacts,'rs-05-offline.png')});
 }finally{await offlineContext.close();}
 // Package 12: actual right-drawer interaction exercises cation-only IUCr
 // pairs, periodic ligand image counting, and visible science provenance.
 const p12Sites=await page.evaluate(()=>window.__visualTest.p12Perovskite());
 const ti=p12Sites.find(site=>site.symbol==='Ti'),ba=p12Sites.find(site=>site.symbol==='Ba');
 assert.ok(ti&&ba,'BaTiO3 preset must contain both cation centers');
 await page.locator('[data-right-tool="bvs"]').click();
 await page.locator('#analysisCenter').selectOption(String(ti.index));
 const tiPairs=await page.locator('#bvsPair option').evaluateAll(items=>items.map(el=>el.value));
 assert.deepEqual(tiPairs,['Ti3-O','Ti4-O'],'Ti center must offer Ti oxidation pairs only');
 await page.locator('#bvsPair').selectOption('Ti4-O');
 await page.locator('#bvsCutoff').fill('3.1');
 await page.locator('#analyzeBvs').click();
 let p12Result=await page.evaluate(()=>window.__visualTest.p12BvsResult());
 assert.equal(p12Result.pair,'Ti4-O');
 assert.equal(p12Result.count,6,'Ti-O octahedral shell must retain six periodic images');
 assert.equal(p12Result.weightedCount,6);
 assert.ok(Number.isFinite(p12Result.sum)&&p12Result.sum>0);
 assert.equal(p12Result.reference,'IUCr bvparm2020.cif');
 assert.match(await page.locator('#bvsResult').textContent(),/Geometrik ligand CN=6.*BVS=.*IUCr 2020/s);
 const p14Projection=await page.evaluate(()=>window.__visualTest.p14VestaProjection());
 assert.equal(p14Projection.guiExecuted,false,'manual formula must never masquerade as real VESTA GUI data');
 assert.equal(p14Projection.actualVestaSum,null);
 assert.equal(p14Projection.modelB,.37);
 assert.ok(Math.abs(p14Projection.deltaParameter)<1e-10,'Ti4-O has identical B values');
 assert.match(await page.locator('#bvsResult').textContent(),/VESTA 3 kılavuz denklemi.*GUI ölçümü DEĞİL/s);
 await page.locator('#analysisCenter').selectOption(String(ba.index));
 assert.deepEqual(await page.locator('#bvsPair option').evaluateAll(items=>items.map(el=>el.value)),['Ba2-O']);
 await page.locator('#analyzeBvs').click();
 p12Result=await page.evaluate(()=>window.__visualTest.p12BvsResult());
 assert.equal(p12Result.count,12,'Ba-O cubic shell must have twelve geometric neighbors');
 assert.equal(p12Result.weightedCount,12);
 await page.screenshot({path:path.join(artifacts,'p12-bvs-coordination.png')});
 // Exercise the real file picker handler, state assignment and WebGL rebuild
 // for all three newly supported crystallographic structure formats.
 const importContext=await browser.newContext({viewport:{width:1280,height:800}});
 try{
  const importPage=await importContext.newPage();
  await importPage.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
  await importPage.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'));
  const imports=[
   {name:'sample.res',title:'SHELX browser test',sites:2,a:5,text:'TITL SHELX browser test\nCELL .71073 5 5 5 90 90 90\nLATT 1\nSFAC C\nC1 1 .2 .3 .4 11 .05\nEND'},
   {name:'sample.in',title:'Quantum ESPRESSO kristali',sites:1,a:6,text:'&SYSTEM ibrav=0, nat=1 /\nCELL_PARAMETERS angstrom\n6 0 0\n0 6 0\n0 0 6\nATOMIC_POSITIONS crystal\nSi 0 0 0'},
   {name:'sample.cell',title:'CASTEP kristali',sites:1,a:7,text:'%BLOCK LATTICE_CART\n7 0 0\n0 7 0\n0 0 7\n%ENDBLOCK LATTICE_CART\n%BLOCK POSITIONS_FRAC\nSi .2 .3 .4\n%ENDBLOCK POSITIONS_FRAC'}
  ];
  for(const item of imports){
   await importPage.locator('#fileInput').setInputFiles({name:item.name,mimeType:'text/plain',buffer:Buffer.from(item.text)});
   await importPage.waitForFunction(title=>document.getElementById('infoName')?.textContent?.includes(title),item.title);
   assert.equal(Number(await importPage.locator('#siteCount').textContent()),item.sites);
   assert.ok(Math.abs(Number(await importPage.locator('#a').inputValue())-item.a)<1e-3);
   assert.ok((await sample(importPage)).ink>20,'imported '+item.name+' must render atoms');
  }

  // P13: import the unmodified IUCr supplemental CIF with data_global + data_I,
  // then exercise the real center-selector/BVS drawer on a 72.2% K / 27.8% Na site.
  await importPage.locator('#fileInput').setInputFiles(path.join(base,
   'tests/validation/fixtures/experimental/IUCr_wm5651_KNaCaSiO.cif'));
  await importPage.waitForFunction(()=>window.__visualTest?.p13Experimental().sites.length===40);
  const realCif=await importPage.evaluate(()=>window.__visualTest.p13Experimental());
  assert.equal(realCif.sites.length,40,'IUCr P-1 crystal must expand to 40 atoms');
  assert.match(realCif.warning,/data_global/,
   'source .cif must not be misclassified as SHELX because it embeds a SHELX listing');
  const k1=realCif.sites.find(site=>site.label==='K1_1');
  assert.ok(k1,'K1 must survive symmetry expansion and source-label propagation');
  assert.equal(k1.occupancy,.722);
  await importPage.locator('[data-right-tool="bvs"]').click();
  await importPage.locator('#analysisCenter').selectOption(String(k1.index));
  await importPage.locator('#bvsPair').selectOption('K1-O');
  await importPage.locator('#bvsCutoff').fill('3.2');
  await importPage.locator('#analyzeBvs').click();
  const realBvs=(await importPage.evaluate(()=>window.__visualTest.p13Experimental())).bvs;
  assert.equal(realBvs.count,7);
  assert.ok(Math.abs(realBvs.sum-1.2848484568444043)<1e-6);
  assert.ok(realBvs.alternatives?.complete);
  assert.deepEqual(realBvs.alternatives.scenarios.map(site=>[site.element,site.occupancy]),
   [['K',.722],['Na',.278]]);
  assert.ok(realBvs.alternatives.conditionalStandardDeviation>.3);
  assert.match(await importPage.locator('#bvsResult').textContent(),
   /Alternatif merkez.*K 72\.2%.*Na 27\.8%.*Türlere göre koşullu ortalama=.*model σ=/s);
  await importPage.screenshot({path:path.join(artifacts,'p13-experimental-kna-bvs.png')});
  assert.match(await importPage.locator('#bvsResult').textContent(),
   /VESTA 3 kılavuz denklemi.*Gerçek VESTA sonucu/s);
  await importPage.screenshot({path:path.join(artifacts,'p14-vesta-manual-projection.png')});

  // Package 9.3: the user selects the real project and its referenced Gemmi
  // CCP4 map in ONE local picker; no browser path or network fetching.
  const projectFile=path.join(base,'tests/fixtures/package9-3-signed.vesta');
  const gridFile=path.join(base,'tests/fixtures/gemmi-5i55_tiny.ccp4');
  await importPage.locator('#fileInput').setInputFiles([projectFile,gridFile]);
  await importPage.waitForFunction(()=>window.__visualTest?.vestaImport().name==='P9.3 signed CCP4 preview'&&
   window.__visualTest?.vestaImport().attached);
  const vestaState=await importPage.evaluate(()=>window.__visualTest.vestaImport());
  assert.equal(vestaState.sites,2);
  assert.equal(vestaState.cell.a,29.45);
  assert.deepEqual(vestaState.colors,['#c85028','#28b4dc']);
  assert.deepEqual(vestaState.bounds,[[-.1,1.1],[0,1],[0,1]]);
  await importPage.waitForFunction(()=>window.__visualTest.volumeVisual().isoCount===2);
  const vestaVolume=await importPage.evaluate(()=>window.__visualTest.volumeVisual());
  assert.deepEqual(vestaVolume.values,[.15,-.15]);
  assert.ok(vestaVolume.fills>=1,'real signed CCP4 ISURF triangles should reach WebGL');
  const volumeBenchmark=await importPage.evaluate(()=>window.__visualTest.performance());
  assert.ok(volumeBenchmark.volumeTriangles>0,'real Gemmi CCP4 must generate reportable isosurface triangles');
  assert.ok(volumeBenchmark.volumeBuildMs>=0&&volumeBenchmark.volumeStride>=1);
  await fs.writeFile(path.join(artifacts,'package-10-1-volume.json'),JSON.stringify(volumeBenchmark,null,2));
  const workerParity=await importPage.evaluate(()=>window.__visualTest.workerFixtureParity());
  assert.equal(workerParity.matched,true,'offline-isolated worker must exactly match the main-thread Gemmi CCP4 isosurface');
  assert.equal(workerParity.colorsMatch,true);
  assert.ok(workerParity.triangles>0);
  await importPage.screenshot({path:path.join(artifacts,'package-9-3-vesta-import.png')});
  // A project by itself must show atoms, but surface voxels must remain absent.
  await importPage.locator('#fileInput').setInputFiles(projectFile);
  await importPage.waitForFunction(()=>window.__visualTest?.vestaImport().name==='P9.3 signed CCP4 preview'&&
   !window.__visualTest?.vestaImport().attached);
  assert.match((await importPage.evaluate(()=>window.__visualTest.vestaImport())).warning,
   /matching .cube\/.xsf\/CHGCAR\/CCP4\/MRC/);
  assert.equal(await importPage.evaluate(()=>window.__visualTest.volumeVisual().isoCount),undefined);
  // P10.2: a >75k-voxel map must triangulate in a cancellable Worker.
  const firstHeavy=await importPage.evaluate(()=>window.__visualTest.heavyVolume());
  assert.equal(firstHeavy.volumePending,true);
  await importPage.waitForFunction(()=>{const p=window.__visualTest.performance();return !p.volumePending&&p.volumeTriangles>0;},null,{timeout:30000});
  const workerHeavy=await importPage.evaluate(()=>window.__visualTest.performance());
  assert.ok(workerHeavy.volumeWorkerMs>=0&&workerHeavy.volumeTriangles>0);
  assert.ok(workerHeavy.volumePreviews>=1,'P10.3 large grid should have a progressive low-resolution preview');
  assert.equal(workerHeavy.volumeAdaptivePreview?.kind,'octree-2to1-preview');
  assert.equal(workerHeavy.volumeAdaptivePreview.accepted,true);
  assert.ok(workerHeavy.volumeAdaptivePreview.leaves>100&&workerHeavy.volumeAdaptivePreview.leaves<4500,
   'P10.7 true local octree remains below its fixed leaf budget');
  assert.ok(workerHeavy.volumeAdaptivePreview.transitionFaces>0,
   'P10.7 preview actually transitions between regional refinement levels');
  assert.ok(Number.isFinite(workerHeavy.volumeAdaptivePreview.sampledCenterErrorMax));
  assert.ok(Number.isFinite(workerHeavy.volumeAdaptivePreview.isoVertexScalarResidualMax));
  assert.ok(Number.isFinite(workerHeavy.volumeAdaptivePreview.isoPositionProxyMaxAngstrom));
  assert.ok(workerHeavy.benchmarkDevice?.webglVersion?.includes('WebGL'),
   'P10.7 benchmark capture names the actual browser GPU API');
  assert.ok(workerHeavy.benchmarkDevice.maxTextureSize>=1024);
  assert.ok(typeof workerHeavy.benchmarkDevice.browser==='string');
  assert.ok(workerHeavy.managedGeometryBytes>0,'P10.5 GPU-bound vertex attribute backing arrays are measurable');
  assert.ok(workerHeavy.volumeVoxelBytes>=64**3*4,'P10.5 source voxel storage reported separately');
  assert.equal(typeof workerHeavy.managedTextureBytesEstimate,'number');
  assert.equal(typeof workerHeavy.gpuTimerSupported,'boolean');
  if(workerHeavy.gpuRenderMs!==null)assert.ok(workerHeavy.gpuRenderMs>=0);

  const liveStart=await importPage.evaluate(()=>window.__visualTest.heavySlicePreview());
  assert.ok(liveStart.cancelDelta>=1,'P10.5 superseded interactive 2D Worker must terminate');
  await importPage.waitForFunction(()=>{
   const x=window.__visualTest.performance();
   return x.slicePreviewWorkerMs!==null&&
    !document.getElementById('volumeSliceStats').textContent.includes('Worker üzerinde');
  },null,{timeout:30000});
  const liveSlice=await importPage.evaluate(()=>window.__visualTest.performance());
  assert.ok(liveSlice.slicePreviewWorkerMs>=0,'P10.5 live 2D raster and matrix computed offline');
  assert.ok(liveSlice.contourWorkerSegments>0,'P10.5 interactive marching-squares must trace contours');
  const line=await importPage.evaluate(()=>window.__visualTest.heavySliceLine());
  assert.equal(line.samples,129,'P10.5 real interactive Worker values feed line interpolation');
  assert.ok(line.valid>100&&/Å/.test(line.stats),'P10.5 physical line and 32px panel statistics');
  const asyncGeometry=await importPage.evaluate(()=>window.__visualTest.heavySignature(false));
  const syncGeometry=await importPage.evaluate(()=>window.__visualTest.heavySignature(true));
  assert.deepEqual(asyncGeometry,syncGeometry,'Worker and synchronous paths must produce equal world-coordinate surface vertices');
  const cached=await importPage.evaluate(()=>window.__visualTest.heavyRestyle());
  assert.equal(cached.volumePending,false,'surface style changes should reuse geometry');
  assert.ok(cached.volumeCacheHits>=1&&cached.wires>0);
  const cancel=await importPage.evaluate(()=>window.__visualTest.heavyCancel());
  assert.ok(cancel.cancelDelta>=1,'superseded Worker should be terminated');
  await importPage.waitForFunction(()=>{const p=window.__visualTest.performance();return !p.volumePending&&p.volumeTriangles>0;},null,{timeout:30000});
  const finished=await importPage.evaluate(()=>window.__visualTest.performance());
  assert.equal(finished.volumePending,false);
  await fs.writeFile(path.join(artifacts,'package-10-2-volume-worker.json'),
   JSON.stringify({workerParity,firstHeavy,workerHeavy,liveStart,liveSlice,line,cached,cancel,finished,sliceWorkerStats},null,2));

 }finally{await importContext.close();}
 assert.deepEqual(errors,[],'uncaught browser exceptions');
 assert.deepEqual(cdnRequests,[],'all Three.js files should load without external CDN requests');
 await fs.writeFile(path.join(artifacts,'metrics.json'),JSON.stringify(metrics,null,2));
 console.log('Real Chromium/WebGL screenshots and layer transitions passed:',metrics);
} finally {
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
