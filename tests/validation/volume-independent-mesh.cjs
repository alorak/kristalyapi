#!/usr/bin/env node
/* P10.8.4 native fixture bridge for INDEPENDENT scikit-image marching cubes.
 * The exact same resampled Float32 voxels, physical Cartesian basis and signed
 * isolevel are exported for both algorithms. No synthetic density is invented.
 * This is CI-only, not a browser bundle or a production rendering change.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parse,ctx,gridLike}=require('./volume-highres-gate.cjs');
const source=process.argv[2],directory=process.argv[3],label=process.argv[4]||'map';
if(!source||!directory)throw Error('Usage: node volume-independent-mesh.cjs map.ccp4 out-directory [label]');
const native=parse.ccp4Read(fs.readFileSync(source),path.basename(source));
const grids=[32,48,64].map(n=>gridLike(native,n));
const sorted=Array.from(native.values);
for(const g of grids)for(const value of g.values)sorted.push(value);
sorted.sort((a,b)=>a-b);
const negative=/DELFWT/i.test(path.basename(source));
const qs=negative?[.005,.01]:[.99,.995];
const levels=qs.map(q=>{
 const pivot=Math.floor((sorted.length-1)*q),radius=Math.max(8,Math.floor(sorted.length*.002));
 let gap=-1,level=NaN;
 for(let i=Math.max(0,pivot-radius);i<Math.min(sorted.length-1,pivot+radius);i++){
  const delta=sorted[i+1]-sorted[i];
  if(delta>gap&&delta>0){gap=delta;level=sorted[i]+delta*.5;}
 }
 assert.ok(Number.isFinite(level)&&level>native.min&&level<native.max,
  'No valid sampled scalar gap near the requested contour percentile');
 return {targetQuantile:q,level,sourceGap:gap};
});
const results=[];
for(const g of grids){
 const n=g.dims[0],prefix=label+'-'+n;
 assert.equal(n**3,g.values.length);
 const gridFile=prefix+'.float32';
 fs.writeFileSync(path.join(directory,gridFile),
  Buffer.from(g.values.buffer,g.values.byteOffset,g.values.byteLength));
 const meshes=[];
 for(let j=0;j<levels.length;j++){
  const iso=levels[j];
  const mesh=ctx.iso(g,iso.level,null,'thermal',75000,1,64);
  assert.ok(mesh.triangles>0&&!mesh.truncated,
   'Real source exceeds 75k native mesh budget at '+prefix+' q='+iso.targetQuantile);
  assert.equal(mesh.decimation,1,'Independent comparison must use full grid');
  assert.equal(mesh.positions.length,mesh.triangles*9);
  const meshFile=prefix+'-q'+j+'.float32';
  fs.writeFileSync(path.join(directory,meshFile),
   Buffer.from(mesh.positions.buffer,mesh.positions.byteOffset,mesh.positions.byteLength));
  meshes.push({...iso,meshFile,triangleCount:mesh.triangles});
 }
 results.push({n,dims:g.dims,periodic:!!g.periodic,origin:g.origin,axes:g.axes,
  gridFile,meshes});
}
const manifest={type:'p10.8.4-matched-input',source:path.basename(source),
 label,sourceDims:native.dims,sourcePeriodic:!!native.periodic,
 scalarUnits:'source map scale (unasserted)',sampleMethod:'worker trilinear voxel interpolation',
 maxTriangles:75000,meshAlgorithm:'production isoTriangles / marching tetrahedra',
 comparisonReference:'independent scikit-image 0.25.2 marching_cubes (Lewiner)',
 results};
fs.writeFileSync(path.join(directory,label+'.json'),JSON.stringify(manifest,null,2));
process.stdout.write(JSON.stringify({manifest:label+'.json',meshes:results.reduce((x,row)=>x+row.meshes.length,0)})+'\n');
