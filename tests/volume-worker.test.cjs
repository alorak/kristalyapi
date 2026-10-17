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
