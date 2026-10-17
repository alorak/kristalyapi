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
