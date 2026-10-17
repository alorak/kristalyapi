const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
const workerSource=fs.readFileSync(path.join(root,'volume-iso-worker.js'),'utf8');
function extract(first,last){
 const a=app.indexOf(first),b=app.indexOf(last,a);
 assert.ok(a>=0&&b>a,'missing pure volume function boundary '+first);
 return app.slice(a,b);
}
const core=extract('function volumeCross(','function readCube(')+
 extract('function colorFromScalar(','/* A Miller slice');
const coreCtx={Float32Array,Math};
vm.createContext(coreCtx);vm.runInContext(core+'\nthis.compute=isoTriangles;',coreCtx);
function calculate(grids,jobs){
 let result=null;
 const self={postMessage(value){result=value;}};
 const context={self,Float32Array,performance:{now:()=>123.5},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 self.onmessage({data:{requestId:42,grids,jobs}});
 assert.equal(result.requestId,42);
 return result;
}
function field(dims,origin=[2,-1,3],axes=[[.34,.03,0],[0,.29,.05],[.07,0,.42]],periodic=false){
 const values=new Float32Array(dims.reduce((a,b)=>a*b,1));let min=Infinity,max=-Infinity;
 for(let i=0;i<dims[0];i++)for(let j=0;j<dims[1];j++)for(let k=0;k<dims[2];k++){
  const f=Math.sin(i*.53)+Math.cos(j*.37)-Math.sin(k*.71)+i*.011;
  values[(i*dims[1]+j)*dims[2]+k]=f;min=Math.min(min,f);max=Math.max(max,f);
 }
 return {dims,origin,axes,values,min,max,periodic};
}
function assertSame(actual,expected,colored){
 assert.equal(actual.error,undefined);
 assert.equal(actual.triangles,expected.triangles);
 assert.equal(actual.decimation,expected.decimation);
 assert.equal(actual.truncated,expected.truncated);
 assert.deepEqual(Array.from(actual.positions),Array.from(expected.positions));
 if(colored)assert.deepEqual(Array.from(actual.colors),Array.from(expected.colors));
 else assert.equal(actual.colors,null);
}
test('P10.2 worker isosurface matches the editor numerically on a skew signed map',()=>{
 const g=field([13,15,11]);
 const jobs=[{grid:0,potential:-1,level:.15,palette:'thermal',maxTriangles:75000},
  {grid:0,potential:-1,level:-.5,palette:'thermal',maxTriangles:75000}];
 const response=calculate([g],jobs);
 assert.equal(response.results.length,2);
 jobs.forEach((job,i)=>assertSame(response.results[i],coreCtx.compute(g,job.level,null,job.palette,job.maxTriangles),false));
});
test('P10.2 Worker preserves trilinear potential coloring, periodic seam and caps',()=>{
 const g=field([8,9,10],[.4,-2,1],[[.7,0,0],[.1,.8,0],[0,.2,.9]],true);
 const potential=field([11,13,14],[.4,-2,1],[[.49,0,0],[.07,.55,0],[0,.14,.62]],true);
 const jobs=[{grid:0,potential:1,level:.2,palette:'viridis',maxTriangles:150},
  {grid:0,potential:-1,level:-.1,palette:'thermal',maxTriangles:200}];
 const response=calculate([g,potential],jobs);
 jobs.forEach((job,i)=>assertSame(response.results[i],coreCtx.compute(g,job.level,job.potential<0?null:potential,job.palette,job.maxTriangles),job.potential>=0));
 assert.ok(response.results[0].truncated);
});
test('P10.2 worker rejects invalid budgets without returning geometry',()=>{
 const g=field([4,4,4]);
 const bad=calculate([g],[{grid:0,potential:-1,level:.5,palette:'thermal',maxTriangles:75001}]);
 assert.match(bad.error,/Invalid isosurface job/);
 const invalid=calculate([{...g,dims:[999,999,999]}],[]);
 assert.match(invalid.error,/Invalid worker voxel grid/);
 assert.match(workerSource,/self\.postMessage\(\{requestId,results,elapsedMs:/);
});

test('P10.3 progressive Worker previews are coarser and final vertices retain exact scientific parity',()=>{
 const g=field([64,64,64]);
 const job={grid:0,potential:-1,level:1.2,palette:'thermal',maxTriangles:75000};
 const events=[],self={postMessage(message){events.push(message);}};
 const context={self,Float32Array,Uint8ClampedArray,performance:{now:()=>12},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 self.onmessage({data:{requestId:8,grids:[g],jobs:[job],progressive:true}});
 assert.equal(events.length,2);
 assert.equal(events[0].previewIndex,0);
 assert.ok(events[0].previewSurface.decimation>events[1].results[0].decimation);
 assert.equal(events[0].previewSurface.positions.length,events[0].previewSurface.triangles*9);
 assertSame(events[1].results[0],coreCtx.compute(g,job.level,null,job.palette,job.maxTriangles),false);
});
test('P10.3 slice Worker matches Cartesian trilinear and skew Miller frame samples',()=>{
 const g=field([9,10,11]);
 const messages=[],self={postMessage(message){messages.push(message);}};
 const context={self,Float32Array,Uint8ClampedArray,performance:{now:()=>12},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 vm.runInContext('this.sample=volumeSample;this.world=volumeWorld;this.at=volumeAtWorld;',coreCtx);
 self.onmessage({data:{requestId:9,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:1,position:45,size:64,palette:'thermal'}}});
 assert.equal(messages.length,1);
 const axial=messages.pop().slice;
 assert.equal(axial.values.length,4096);assert.equal(axial.rgba.length,16384);
 for(const [x,y] of [[0,0],[20,45],[63,63]]){
  const coord=[x*8/63,9*.45,y*10/63];
  assert.ok(Math.abs(axial.values[y*64+x]-coreCtx.sample(g,coord))<1e-5);
  assert.equal(axial.rgba[(y*64+x)*4+3],206);
 }
 const corners=[coreCtx.world(g,1,1,3),coreCtx.world(g,7,1,3),
  coreCtx.world(g,7,8,3),coreCtx.world(g,1,8,3)];
 self.onmessage({data:{requestId:10,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:'hkl',position:50,size:64,palette:'viridis',corners}}});
 const frame=messages.pop().slice;
 const point=corners[0].map((v,k)=>v+(corners[1][k]-v)*17/63+(corners[3][k]-v)*43/63);
 assert.ok(Math.abs(frame.values[43*64+17]-coreCtx.at(g,point))<1e-5);
 assert.equal(frame.rgba[(43*64+17)*4+3],206);
});
test('P10.3 slice Worker rejects invalid sizes and does not draw outside Miller grid',()=>{
 const g=field([5,5,5]);
 const events=[],self={postMessage(message){events.push(message);}};
 const context={self,Float32Array,Uint8ClampedArray,performance:{now:()=>12},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 self.onmessage({data:{requestId:11,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:0,position:50,size:2048,palette:'thermal'}}});
 assert.match(events.pop().error,/Invalid slice export/);
 self.onmessage({data:{requestId:12,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:'hkl',position:50,size:64,palette:'thermal',
  corners:[[500,500,500],[501,500,500],[501,501,500],[500,501,500]]}}});
 const hole=events.pop().slice;
 assert.ok(Number.isNaN(hole.values[0]));assert.equal(hole.rgba[3],0);
});
test('P10.3 polyhedron display LOD only changes outline visibility decisions',()=>{
 const match=app.match(/function polyOutlineVisible\([\s\S]*?\n\}/);
 assert.ok(match,'missing polyhedron LOD');
 const context={};vm.createContext(context);
 vm.runInContext(match[0]+';this.decide=polyOutlineVisible;',context);
 assert.equal(context.decide(800,2,'auto'),false);
 assert.equal(context.decide(800,20,'auto'),true);
 assert.equal(context.decide(800,1,'high'),true);
 assert.equal(context.decide(800,20,'fast'),false);
 assert.equal(context.decide(8,1,'fast'),true);
});

test('P10.4 contour Worker preserves marching-squares levels, saddle choice and holes',()=>{
 const g=field([13,15,11]);
 const events=[],self={postMessage:message=>events.push(message)};
 const context={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>12},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 const contourSource=extract('function sliceContourLevels(','function sliceImage(');
 const contourCtx={Float32Array,Math,Number};
 vm.createContext(contourCtx);
 vm.runInContext(contourSource+';this.levels=sliceContourLevels;this.trace=sliceContourSegments;',contourCtx);
 const spec={count:8,reference:0,mode:'balanced',step:1};
 self.onmessage({data:{requestId:45,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:2,position:50,size:64,palette:'thermal',contours:spec}}});
 const result=events.pop().slice;
 const levels=contourCtx.levels(result.values,spec.count,spec.reference,spec.mode);
 const reference=contourCtx.trace(result.values,64,levels,1);
 assert.deepEqual(Array.from(result.levels),Array.from(levels));
 assert.equal(result.lines.length,reference.segments.length*5);
 for(let i=0;i<reference.segments.length;i++){
  const expected=reference.segments[i],offset=i*5;
  const actual=Array.from(result.lines.slice(offset,offset+4));
  [expected.x1,expected.y1,expected.x2,expected.y2].forEach((v,j)=>
   assert.ok(Math.abs(actual[j]-v)<1e-4,'same world-scaled contour segment'));
  assert.equal(result.lines[offset+4],levels.indexOf(expected.level));
 }
 const bad=[];const second={postMessage:m=>bad.push(m)};
 const ctx2={self:second,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>12},Math};
 vm.createContext(ctx2);vm.runInContext(workerSource,ctx2);
 second.onmessage({data:{requestId:46,type:'slice',grids:[g],slice:{
  grid:0,potential:-1,axis:2,position:50,size:64,palette:'thermal',
  contours:{count:50,reference:0,mode:'uniform',step:1}}}});
 assert.match(bad.pop().error,/Invalid contour settings/);
});
test('P10.4 CSV matrix Worker matches numeric axial/skew interpolation and units stay in editor',()=>{
 const g=field([9,10,11]);
 const results=[],self={postMessage:x=>results.push(x)};
 const context={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>10},Math};
 vm.createContext(context);vm.runInContext(workerSource,context);
 vm.runInContext('this.sample=volumeSample;this.world=volumeWorld;this.at=volumeAtWorld;',coreCtx);
 const at=(i,j,k)=>coreCtx.world(g,i,j,k);
 const corners=[at(2,1,3),at(7,1,3),at(7,8,3),at(2,8,3)];
 self.onmessage({data:{requestId:51,type:'slice-matrix',grids:[g],matrix:{
  grid:0,axis:'hkl',position:50,size:64,corners}}});
 const result=results.pop().matrix;
 assert.equal(result.rows.length,64*64*4);
 assert.equal(result.values.length,64*64);
 const p=23*64+34,x=result.rows[p*4],y=result.rows[p*4+1],z=result.rows[p*4+2];
 assert.ok(Math.abs(result.rows[p*4+3]-coreCtx.at(g,[x,y,z]))<1e-5);
 assert.ok(Math.abs(result.values[p]-result.rows[p*4+3])<1e-5);
 assert.ok(result.min<=result.mean&&result.mean<=result.max);
 assert.ok(result.width>0&&result.height>0);
});
test('P10.4 polyhedron hull templates translate all vertices and leave normals unchanged',()=>{
 const part=app.slice(app.indexOf('function appendPolyhedronTemplate('),
  app.indexOf('function polyhedralDistortionMetrics('));
 const ctx={};vm.createContext(ctx);
 vm.runInContext(part+';this.append=appendPolyhedronTemplate;',ctx);
 const template={positions:new Float32Array([0,1,2,3,4,5]),
  normals:new Float32Array([1,0,0,0,1,0]),
  edges:new Float32Array([0,0,0,1,1,1])};
 const pos=[],norm=[],edge=[];
 ctx.append(template,{x:4,y:-5,z:6},pos,norm,edge);
 assert.deepEqual(pos,[4,-4,8,7,-1,11]);
 assert.deepEqual(norm,[1,0,0,0,1,0]);
 assert.deepEqual(edge,[4,-5,6,5,-4,7]);
});
test('P10.4 preview sampling density responds to candidate isosurface complexity without changing final stride',()=>{
 const ctx={self:{postMessage(){}},Float32Array,Uint8ClampedArray,performance:{now:()=>0},Math};
 vm.createContext(ctx);vm.runInContext(workerSource+';this.choose=isoPreviewStride;',ctx);
 const low=field([64,64,64]);low.values.fill(0);
 const complex=field([64,64,64]);
 for(let i=0;i<complex.values.length;i++)complex.values[i]=(i%2)*2-1;
 const sparse=ctx.choose(low,.5),dense=ctx.choose(complex,0);
 assert.ok(sparse>=dense,'surface-dense preview must not sample more coarsely');
 assert.ok(dense>=4&&sparse<=6);
});

test('P10.5 interactive 192px raster, 128² line profile and 32² statistics share one worker job',()=>{
 const g=field([15,17,13]),events=[],self={postMessage:m=>events.push(m)};
 const ctx={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>7},Math};
 vm.createContext(ctx);vm.runInContext(workerSource,ctx);
 vm.runInContext('this.sample=volumeSample;this.world=volumeWorld;',coreCtx);
 const corners=[coreCtx.world(g,0,0,6),coreCtx.world(g,14,0,6),
  coreCtx.world(g,14,16,6),coreCtx.world(g,0,16,6)];
 self.onmessage({data:{requestId:105,type:'slice-preview',grids:[g],slice:{
  grid:0,potential:-1,axis:2,position:35,size:192,palette:'viridis',corners,
  contours:{count:8,reference:0,mode:'balanced',step:1}}}});
 assert.equal(events.length,1);
 const response=events.pop(),p=response.preview;
 assert.equal(response.error,undefined);
 assert.equal(p.slice.values.length,192**2);
 assert.equal(p.slice.rgba.length,192**2*4);
 assert.equal(p.matrix.values.length,128**2);
 assert.equal(p.stats.values.length,32**2);
 assert.equal(p.matrix.rows,null,'interactive profile transfers values only');
 assert.equal(p.stats.rows,null,'small summary avoids transferring world rows');
 assert.ok(p.slice.lines.length>0,'signed contours traced off main thread');
 for(const size of [192,128,32]){
  const values=size===192?p.slice.values:size===128?p.matrix.values:p.stats.values;
  for(const [x,y] of [[0,0],[Math.floor(size/3),Math.floor(size/2)],[size-1,size-1]]){
   const expected=coreCtx.sample(g,[x*14/(size-1),y*16/(size-1),12*.35]);
   assert.ok(Math.abs(values[y*size+x]-expected)<1e-5,'same trilinear voxel sample');
  }
 }
 const valid=Array.from(p.stats.values).filter(Number.isFinite);
 const min=Math.min(...valid),max=Math.max(...valid),mean=valid.reduce((a,b)=>a+b,0)/valid.length;
 assert.ok(Math.abs(p.stats.min-min)<1e-6);
 assert.ok(Math.abs(p.stats.max-max)<1e-6);
 assert.ok(Math.abs(p.stats.mean-mean)<1e-6);
});
test('P10.5 interactive Worker rejects malformed preview, preserves Miller holes',()=>{
 const g=field([6,6,6]),events=[],self={postMessage:m=>events.push(m)};
 const ctx={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>0},Math};
 vm.createContext(ctx);vm.runInContext(workerSource,ctx);
 self.onmessage({data:{requestId:1,type:'slice-preview',grids:[g],slice:{
  grid:0,potential:-1,axis:0,position:50,size:768,palette:'thermal'}}});
 assert.match(events.pop().error,/Invalid interactive preview/);
 const corners=[[400,400,400],[401,400,400],[401,401,400],[400,401,400]];
 self.onmessage({data:{requestId:2,type:'slice-preview',grids:[g],slice:{
  grid:0,potential:-1,axis:'hkl',position:50,size:192,palette:'thermal',corners}}});
 assert.match(events.pop().error,/Slice outside grid/);
 assert.match(app,/function cancelVolumeSlicePreviewWorker\(\)/);
 assert.match(app,/cancelVolumeSlicePreviewWorker\(\);\s*\+\+volumeRequestSerial/);
});
test('P10.5 scene buffer accounting deduplicates GPU-bound backing arrays and textures',()=>{
 const source=extract('function estimateManagedSceneBytes(','function performanceSnapshot(){');
 const ctx={Float32Array,Math,Number,Object,Set};vm.createContext(ctx);
 vm.runInContext(source+';this.measure=estimateManagedSceneBytes;',ctx);
 const typed=new Float32Array(24),shared={array:typed};
 const material={map:{image:{width:64,height:32}}};
 const geometry={attributes:{position:shared,normal:{array:new Float32Array(12)}}};
 const children=[{geometry,material},{geometry,material}];
 const x=ctx.measure([{children}]);
 assert.equal(x.geometryCount,1);assert.equal(x.textureCount,1);
 assert.equal(x.geometryBytes,typed.byteLength+12*4);
 assert.equal(x.textureBytesEstimate,64*32*4);
 assert.match(app,/managedGeometryBytes:sceneBytes\.geometryBytes/);
 assert.match(app,/volumeVoxelBytes:volumeVoxelBytes\(\)/);
});

test('P10.5 interactive Miller profile samples preserve skew Cartesian positions and invalid holes',()=>{
 const g=field([11,12,13]);
 const events=[],self={postMessage:message=>events.push(message)};
 const ctx={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>0},Math};
 vm.createContext(ctx);vm.runInContext(workerSource,ctx);
 vm.runInContext('this.at=volumeAtWorld;this.world=volumeWorld;',coreCtx);
 const corners=[coreCtx.world(g,1,2,4),coreCtx.world(g,9,2,4),
  coreCtx.world(g,9,10,4),coreCtx.world(g,1,10,4)];
 self.onmessage({data:{requestId:9,type:'slice-preview',grids:[g],slice:{
  grid:0,potential:-1,axis:'hkl',position:40,size:192,palette:'thermal',corners}}});
 const data=events.pop().preview;
 assert.ok(data&&!data.matrix.rows);
 const x=43,y=81,size=128,u=x/(size-1),v=y/(size-1);
 const world=corners[0].map((c,i)=>c+u*(corners[1][i]-c)+v*(corners[3][i]-c));
 assert.ok(Math.abs(data.matrix.values[y*size+x]-coreCtx.at(g,world))<1e-5);
 assert.ok(data.stats.valid>0);
});

test('P10.6 conforming axis mesh exactly reproduces the fixed-grid worker on skew and periodic colored maps',()=>{
 const ctx={self:{postMessage(){}},Float32Array,Float64Array,Uint8ClampedArray,
  performance:{now:()=>0},Math};
 vm.createContext(ctx);
 vm.runInContext(workerSource+';this.regular=isoTriangles;this.conforming=isoConformingAxisTriangles;',ctx);
 const g=field([13,15,11],[-3,1,2],[[.3,.04,0],[.02,.3,.01],[0,.03,.4]],true);
 const potential=field([13,15,11],[-3,1,2],[[.3,.04,0],[.02,.3,.01],[0,.03,.4]],true);
 const shape=g.dims.map(n=>n+1);
 const nodes=shape.map(n=>Array.from({length:n},(_,i)=>i));
 const a=ctx.regular(g,-.28,potential,'viridis',75000);
 const b=ctx.conforming(g,-.28,potential,'viridis',75000,nodes);
 assert.equal(a.triangles,b.triangles);
 assert.equal(a.truncated,b.truncated);
 assert.deepEqual(Array.from(a.positions),Array.from(b.positions),'all periodic world vertices byte-for-byte');
 assert.deepEqual(Array.from(a.colors),Array.from(b.colors),'all potential colors byte-for-byte');
});
test('P10.6 locally refined axis preview is topologically closed for a signed sphere and reports sampled scalar error honestly',()=>{
 const n=64,values=new Float32Array(n**3);let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const x=17.531-Math.hypot(i-31.5,j-31.5,k-31.5);
  values[(i*n+j)*n+k]=x;min=Math.min(min,x);max=Math.max(max,x);
 }
 const g={dims:[n,n,n],origin:[0,0,0],axes:[[.2,0,0],[0,.2,0],[0,0,.2]],
  values,min,max,periodic:false};
 const ctx={self:{postMessage(){}},Float32Array,Float64Array,Uint8ClampedArray,
  performance:{now:()=>0},Math};
 vm.createContext(ctx);
 vm.runInContext(workerSource+';this.plan=isoAdaptiveAxisPlan;this.mesh=isoConformingAxisTriangles;this.stride=isoPreviewStride;',ctx);
 const step=ctx.stride(g,0),plan=ctx.plan(g,0,step);
 assert.equal(plan.stats.kind,'conforming-axis-preview');
 assert.ok(plan.stats.refinedAxisIntervals>0,'sphere curvature must trigger axial refinement');
 assert.ok(plan.stats.axisCells.every(n=>n<32),'bounded plane count avoids a full high-resolution preview');
 assert.ok(plan.stats.sampledCenterErrorMax>=0);
 assert.ok(plan.stats.scalarTolerance>0);
 const surface=ctx.mesh(g,0,null,'thermal',75000,plan.nodes);
 assert.ok(surface.triangles>0&&!surface.truncated);
 assert.equal(surface.decimation,step,'coarse cells remain away from detailed regions');
 const incidence=new Map();
 for(let p=0;p<surface.positions.length;p+=9){
  const points=[0,3,6].map(k=>[surface.positions[p+k],surface.positions[p+k+1],surface.positions[p+k+2]]
   .map(v=>Math.round(v*1e5)).join(','));
  for(const [a,b] of [[0,1],[1,2],[2,0]]){
   const key=[points[a],points[b]].sort().join('|');
   incidence.set(key,(incidence.get(key)||0)+1);
  }
 }
 assert.ok(incidence.size>100);
 for(const count of incidence.values())assert.equal(count,2,'closed surface edge must belong to two triangles');
 const final=ctx.mesh(g,0,null,'thermal',75000,[...Array(3)].map(()=>Array.from({length:64},(_,i)=>i)));
 assert.ok(final.triangles>=surface.triangles);
});
test('P10.6 per-site polyhedron instancing leaves the previous merged renderer the default',()=>{
 assert.match(app,/polyFaceStrategy='merged'/);
 assert.match(app,/new THREE\.InstancedMesh\(geometry,material,group\.instances\.length\)/);
 assert.match(app,/mesh\.setMatrixAt\(index,dummy\.matrix\);mesh\.setColorAt\(index,item\.color\)/);
 assert.match(app,/group\.area\+=template\.hull\.area;group\.volume\+=template\.hull\.volume/);
 assert.match(app,/appendPolyhedronEdges\(template,entry\[i\]\.pos,edgePositions\)/);
});

test('P10.6 unmet sampled residual threshold falls back to the established uniform preview',()=>{
 const g=field([64,64,64]),events=[],self={postMessage:m=>events.push(m)};
 const ctx={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>2},Math};
 vm.createContext(ctx);
 vm.runInContext(workerSource+';this.uniform=isoTriangles;this.stride=isoPreviewStride;',ctx);
 const job={grid:0,potential:-1,level:1.2,palette:'thermal',maxTriangles:75000};
 self.onmessage({data:{requestId:106,grids:[g],jobs:[job],progressive:true}});
 assert.equal(events.length,2);
 const preview=events[0].previewSurface;
 assert.equal(preview.adaptive?.sampledToleranceMet,false,'highly oscillatory map exceeds the sampled proxy');
 assert.equal(preview.adaptive.accepted,false);
 const expected=ctx.uniform(g,job.level,null,job.palette,job.maxTriangles,ctx.stride(g,job.level));
 assert.deepEqual(Array.from(preview.positions),Array.from(expected.positions),'fallback preview remains byte-for-byte legacy');
 assertSame(events[1].results[0],coreCtx.compute(g,job.level,null,job.palette,job.maxTriangles),false);
});


test('P10.7 local 2:1 octree produces a closed, consistently oriented signed-sphere preview with analytic Å displacement audit',()=>{
 const n=64,radius=17.531,step=.2,values=new Float32Array(n**3);
 let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const v=radius-Math.hypot(i-31.5,j-31.5,k-31.5);
  values[(i*n+j)*n+k]=v;min=Math.min(min,v);max=Math.max(max,v);
 }
 const grid={dims:[n,n,n],values,min,max,origin:[0,0,0],
  axes:[[step,0,0],[0,step,0],[0,0,step]],periodic:false};
 const ctx={self:{postMessage(){}},Float32Array,Math};vm.createContext(ctx);
 vm.runInContext(workerSource+
  ';this.plan=isoOctreePlan;this.faces=isoOctreeFaces;this.mesh=isoOctreeTriangles;this.regular=isoTriangles;this.stride=isoPreviewStride;',ctx);
 const plan=ctx.plan(grid,0);
 assert.equal(plan.ok,true,JSON.stringify(plan.stats));
 assert.equal(plan.stats.kind,'octree-2to1-preview');
 assert.ok(plan.stats.leaves<plan.stats.leafBudget);
 assert.ok(plan.stats.transitionFaces>100,'genuine regional coarse/fine interfaces');
 assert.ok(Object.keys(plan.stats.surfaceDepths).length>=2,'surface leaves at multiple depths');
 assert.ok(plan.stats.sampleProbes>0&&plan.stats.sampledToleranceMet);
 for(const group of ctx.faces(plan.leaves).planes.values()){
  const lo=group.filter(x=>x.side===0),hi=group.filter(x=>x.side===1);
  for(const a of lo)for(const b of hi)if(a.loU<b.hiU&&b.loU<a.hiU&&a.loV<b.hiV&&b.loV<a.hiV)
   assert.ok(Math.abs(plan.leaves[a.index].depth-plan.leaves[b.index].depth)<=1,
    'face-neighboring octree leaves stay 2:1 balanced by depth');
 }
 const surface=ctx.mesh(grid,0,null,'thermal',75000,plan);
 assert.ok(surface.triangles>1000&&!surface.truncated);
 assert.ok(surface.metrics.transitionPatches>0&&surface.metrics.faceTriangles>0);
 assert.ok(Number.isFinite(surface.metrics.isoVertexScalarResidualMax));
 assert.ok(Number.isFinite(surface.metrics.isoPositionProxyMaxAngstrom));
 assert.ok(surface.metrics.positionProxySamples>0);
 const incidence=new Map();
 let maxAnalyticErrorAngstrom=0,invalid=0;
 for(let offset=0;offset<surface.positions.length;offset+=9){
  const vertices=[0,3,6].map(q=>Array.from(surface.positions.slice(offset+q,offset+q+3)));
  const keys=vertices.map(p=>p.map(x=>Math.round(x*1e5)).join(','));
  if(new Set(keys).size!==3)invalid++;
  for(let q=0;q<3;q++){
   const p=vertices[q],radial=Math.hypot(p[0]/step-31.5,p[1]/step-31.5,p[2]/step-31.5);
   maxAnalyticErrorAngstrom=Math.max(maxAnalyticErrorAngstrom,Math.abs(radial-radius)*step);
  }
  for(const [i,j] of [[0,1],[1,2],[2,0]]){
   const forward=keys[i]<keys[j],key=[keys[i],keys[j]].sort().join('|');
   const counts=incidence.get(key)||[0,0];counts[forward?0:1]++;
   incidence.set(key,counts);
  }
 }
 assert.equal(invalid,0,'no degenerate surface triangles');
 assert.ok(incidence.size>1000);
 for(const counts of incidence.values())assert.deepEqual(counts,[1,1],
  'each closed edge has exactly two oppositely directed incident triangles');
 const coarse=ctx.regular(grid,0,null,'thermal',75000,ctx.stride(grid,0));
 let coarseError=0;
 for(let p=0;p<coarse.positions.length;p+=3){
  const pos=coarse.positions,radial=Math.hypot(pos[p]/step-31.5,pos[p+1]/step-31.5,pos[p+2]/step-31.5);
  coarseError=Math.max(coarseError,Math.abs(radial-radius)*step);
 }
 assert.ok(maxAnalyticErrorAngstrom<.03,'analytic signed sphere maximum vertex radial error < 0.03 Å');
 assert.ok(maxAnalyticErrorAngstrom<coarseError*.5,'refined preview improves tested spherical vertex position');
});
test('P10.7 skew/periodic octree keeps potential coloring tied to world-coordinate samples',()=>{
 const n=32,values=new Float32Array(n**3),potentialValues=new Float32Array(n**3);
 let min=Infinity,max=-Infinity,pmin=Infinity,pmax=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const index=(i*n+j)*n+k,v=8.531-Math.hypot(i-15.5,j-15.5,k-15.5);
  values[index]=v;min=Math.min(min,v);max=Math.max(max,v);
  const potential=Math.sin(i*.17)+Math.cos(j*.11)+k*.013;
  potentialValues[index]=potential;pmin=Math.min(pmin,potential);pmax=Math.max(pmax,potential);
 }
 const base={dims:[n,n,n],origin:[1,2,-3],axes:[[.2,.02,0],[.01,.25,.02],[.01,0,.3]],periodic:true};
 const grid={...base,values,min,max},potential={...base,values:potentialValues,min:pmin,max:pmax};
 const ctx={self:{postMessage(){}},Float32Array,Math};vm.createContext(ctx);
 vm.runInContext(workerSource+
  ';this.plan=isoOctreePlan;this.mesh=isoOctreeTriangles;this.at=volumeAtWorld;this.color=scalarColor;',ctx);
 const plan=ctx.plan(grid,0);assert.equal(plan.ok,true);
 const mesh=ctx.mesh(grid,0,potential,'viridis',75000,plan);
 assert.ok(mesh.triangles>100&&!mesh.truncated);
 assert.equal(mesh.positions.length,mesh.colors.length);
 for(let i=0;i<mesh.positions.length;i+=Math.max(3,Math.floor(mesh.positions.length/120/3)*3)){
  const p=Array.from(mesh.positions.slice(i,i+3));
  const expected=ctx.color(ctx.at(potential,p),potential,'viridis');
  for(let channel=0;channel<3;channel++)assert.ok(Math.abs(mesh.colors[i+channel]-expected[channel])<1e-5,
   'potential colors remain sampled from the shared Cartesian world coordinate');
 }
});
test('P10.7 noisy maps fall back to the established safe previews without altering the final mesh',()=>{
 const g=field([64,64,64]),events=[],self={postMessage:m=>events.push(m)};
 const ctx={self,Float32Array,Float64Array,Uint8ClampedArray,performance:{now:()=>0},Math};
 vm.createContext(ctx);
 vm.runInContext(workerSource,ctx);
 const job={grid:0,potential:-1,level:1.2,palette:'thermal',maxTriangles:75000};
 self.onmessage({data:{requestId:107,grids:[g],jobs:[job],progressive:true}});
 assert.equal(events.length,2);
 const preview=events[0].previewSurface;
 assert.equal(preview.adaptive.kind,'conforming-axis-preview');
 assert.match(preview.adaptive.octreeFallbackReason,/budget|tolerance/);
 assert.equal(preview.adaptive.accepted,false);
 assert.equal(preview.adaptive.sampledToleranceMet,false);
 assertSame(events[1].results[0],coreCtx.compute(g,job.level,null,job.palette,job.maxTriangles),false);
 assert.match(app,/octree-2to1-preview/);
 assert.match(app,/isoPositionProxyMaxAngstrom/);
 assert.match(app,/benchmarkDevice/);
});
