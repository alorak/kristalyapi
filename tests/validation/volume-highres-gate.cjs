#!/usr/bin/env node
/* Package 10.8.3 high-resolution and topological scientific gate.
 * Uses the ACTUAL source parser and production marching-tetrahedra Worker.
 * maxAxisIntervals=64 is a research-only override of default 40, NOT a UI
 * change; every mesh retains the production 75,000 triangle safety budget.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const LIMIT=75000;
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;return this;}
 toArray(){return [this.x,this.y,this.z];}
}
const app=fs.readFileSync(path.join(ROOT,'crystal-app.js'),'utf8');
const end=app.indexOf('// @kristalyapi/browser-bootstrap:');
assert.ok(end>0);
const parse={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},
 URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(parse);
vm.runInContext(app.slice(0,end).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.ccp4Read=readCcp4Map;',parse);
const ctx={self:{postMessage(){}},Float32Array,Float64Array,Uint8ClampedArray,Math};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'volume-iso-worker.js'),'utf8')+
 '\nthis.iso=isoTriangles;this.sample=volumeSample;this.at=volumeAtWorld;'+
 'this.toIndex=volumeCoord;',ctx);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const determinant=axes=>dot(axes[0],cross(axes[1],axes[2]));
const relative=(x,y)=>Math.abs(x-y)/Math.max(Math.abs(x),Math.abs(y),1e-12);
function gridLike(original,n){
 const periodic=!!original.periodic,extents=original.dims.map(x=>periodic?x:x-1);
 const factors=extents.map(x=>x/(periodic?n:n-1));
 const values=new Float32Array(n**3);let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const value=ctx.sample(original,[i*factors[0],j*factors[1],k*factors[2]]);
  values[(i*n+j)*n+k]=value;min=Math.min(min,value);max=Math.max(max,value);
 }
 return {dims:[n,n,n],values,min,max,origin:[...original.origin],
  axes:original.axes.map((axis,i)=>axis.map(v=>v*factors[i])),periodic};
}
function occupiedVolume(grid,level){
 const [nx,ny,nz]=grid.dims,periodic=grid.periodic;
 let sum=0;
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(let k=0;k<nz;k++){
  if(grid.values[(i*ny+j)*nz+k]<level)continue;
  const w=(p,n)=>periodic||p>0&&p<n-1?1:.5;
  sum+=w(i,nx)*w(j,ny)*w(k,nz);
 }
 return sum*Math.abs(determinant(grid.axes));
}
/* Every vertex is mapped to fractional VOXEL coordinates before canonical
 * quantization; this works for skew cells and Float32 XYZ roundoff. A periodic
 * face at index n maps to index 0, without assuming cubic lattice vectors.
 * Open partial-map domain faces ARE NOT silently identified with each other. */
function auditTopology(mesh,grid){
 const periodic=!!grid.periodic;
 const span=grid.dims.map(n=>periodic?n:n-1);
 const tolerance=2e-4,faces=new Map();
 let degenerateTriangles=0,quantizedCollapsed=0,area=0,interiorOpenEdges=0,faceOpenEdges=0;
 const anomalies=[];
 const onOuterFace=(a,b)=>{
  for(let axis=0;axis<3;axis++){
   if((Math.abs(a[axis])<tolerance&&Math.abs(b[axis])<tolerance)||
    (Math.abs(a[axis]-span[axis])<tolerance&&Math.abs(b[axis]-span[axis])<tolerance))return true;
  }
  return false;
 };
 const key=voxel=>voxel.map((v,a)=>{
  let value=v;
  if(periodic&&(Math.abs(value)<tolerance||Math.abs(value-span[a])<tolerance))value=0;
  return String(Math.round(value/tolerance));
 }).join(',');
 for(let i=0;i<mesh.positions.length;i+=9){
  const xyz=[0,3,6].map(k=>Array.from(mesh.positions.slice(i+k,i+k+3)));
  const corner=xyz.map(ctx.toIndex.bind(null,grid)),ids=corner.map(key);
  const ux=xyz[1].map((v,k)=>v-xyz[0][k]),vx=xyz[2].map((v,k)=>v-xyz[0][k]);
  const triangleArea=Math.hypot(...cross(ux,vx))/2;
  if(triangleArea<1e-12){
   degenerateTriangles++;
   if(anomalies.length<4)anomalies.push({kind:'physical area',areaA2:triangleArea,xyz});
   continue;
  }
  if(ids.some((q,j)=>ids.indexOf(q)!==j)){
   quantizedCollapsed++;
   if(anomalies.length<4)anomalies.push({kind:'index quantization',areaA2:triangleArea,voxel:corner});
   continue;
  }
  area+=triangleArea;
  for(const [p,q] of [[0,1],[1,2],[2,0]]){
   const first=ids[p],last=ids[q],low=first<last?first:last,high=first<last?last:first;
   const edgeKey=low+'|'+high;
   if(!faces.has(edgeKey))faces.set(edgeKey,{count:0,positive:0,negative:0,outer:false});
   const edge=faces.get(edgeKey);
   edge.count++;edge[first===low?'positive':'negative']++;
   if(!periodic&&onOuterFace(corner[p],corner[q]))edge.outer=true;
  }
 }
 let openEdges=0,nonmanifoldEdges=0,orientationConflicts=0;
 for(const edge of faces.values()){
  if(edge.count===1){
   openEdges++;
   if(edge.outer)faceOpenEdges++;else interiorOpenEdges++;
  }else if(edge.count!==2)nonmanifoldEdges++;
  else if(edge.positive!==1||edge.negative!==1)orientationConflicts++;
 }
 return {triangles:mesh.triangles,areaA2:area,edgeCount:faces.size,
  degenerateTriangles,quantizedCollapsed,anomalies,
  openEdges,faceOpenEdges,interiorOpenEdges,
  nonmanifoldEdges,orientationConflicts,periodicSeamGlued:periodic};
}
function metrics(grid,level,full){
 const surface=ctx.iso(grid,level,null,'thermal',LIMIT,1,full?64:40);
 assert.ok(surface.positions.length>0,'empty surface on high resolution test');
 assert.ok(!surface.truncated,'75k scientific triangle limit exceeded');
 const topology=auditTopology(surface,grid);
 assert.equal(topology.degenerateTriangles,0,'physically degenerate triangles: '+JSON.stringify(topology.anomalies));
 assert.equal(topology.quantizedCollapsed,0,'distinct vertices collapse under index quantization (grid '+grid.dims[0]+'): '+JSON.stringify(topology.anomalies));
 // We record orientation conflicts explicitly; do not silently "fix" triangle
 // winding in measurements or claim an oriented manifold without proof.
 assert.equal(topology.nonmanifoldEdges,0,'non-manifold edge detected');
 assert.equal(topology.interiorOpenEdges,0,'unmatched interior edge: cracked surface');
 const quad=occupiedVolume(grid,level);
 return {size:grid.dims[0],mode:full?'full-grid-research':'current-production',
  gridSpacingA:Math.cbrt(Math.abs(determinant(grid.axes))),
  stride:surface.decimation,triangleLimit:LIMIT,
  occupiedVoxelVolumeA3:quad,...topology};
}
function realMap(filename){
 const native=parse.ccp4Read(fs.readFileSync(filename),path.basename(filename));
 assert.ok(native.dims.every(n=>n>=2)&&native.values.length<=2500000);
 const sorted=Array.from(native.values).sort((a,b)=>a-b);
 const negative=/DELFWT/i.test(path.basename(filename));
 const q=negative?.01:.99;
 const idx=Math.floor(sorted.length*q),level=(sorted[idx]+sorted[idx+1])/2;
 assert.ok(level>native.min&&level<native.max);
 const series=[32,48,64].map(n=>{
  const grid=gridLike(native,n);
  const production=metrics(grid,level,false),full=metrics(grid,level,true);
  assert.ok(full.stride===1,'research full-grid comparison was silently decimated');
  if(n===32)assert.equal(production.stride,full.stride);
  return {size:n,production,full};
 });
 const differences=[];
 for(let i=1;i<series.length;i++){
  const earlier=series[i-1].full,later=series[i].full;
  differences.push({from:earlier.size,to:later.size,
   relativeAreaChange:relative(earlier.areaA2,later.areaA2),
   relativeOccupiedVolumeChange:relative(earlier.occupiedVoxelVolumeA3,later.occupiedVoxelVolumeA3)});
 }
 return {source:path.basename(filename),sourceShape:native.dims,
  periodic:!!native.periodic,quantile:q,isovalue:level,scalarUnits:'unknown',
  series,differences,
  resolutionSensitivityAlert:Math.max(...differences.map(x=>x.relativeAreaChange))>.1,
  note:'Absolute differences are observed resolution sensitivity, not an independent physical truth or global Hausdorff bound.'};
}
function periodicSeamCase(){
 const n=24,values=new Float32Array(n**3),center=[0,12,12],radius=6.2;
 let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const x=Math.min(Math.abs(i),n-Math.abs(i)),y=j-center[1],z=k-center[2];
  const v=radius-Math.hypot(x,y,z);
  values[(i*n+j)*n+k]=v;min=Math.min(min,v);max=Math.max(max,v);
 }
 const grid={dims:[n,n,n],values,min,max,periodic:true,
  origin:[.4,-1,2],axes:[[.3,0,.02],[0,.28,0],[.02,0,.27]]};
 const surface=ctx.iso(grid,0,null,'thermal',LIMIT,1,64);
 assert.ok(!surface.truncated);
 const topology=auditTopology(surface,grid);
 assert.ok(topology.triangles>1000,'expected signed sphere intersecting periodic seam');
 assert.equal(topology.degenerateTriangles,0);
 assert.equal(topology.interiorOpenEdges,0,'periodic face edges must match');
 assert.equal(topology.nonmanifoldEdges,0,'periodic faces must not over-connect');
 assert.equal(topology.openEdges,0,'complete signed periodic ball must close across seam');
 return topology;
}
try{
 const output=process.argv[2]?{type:'real-highres',...realMap(path.resolve(process.argv[2]))}:
  {type:'periodic-synthetic',...periodicSeamCase()};
 process.stdout.write(JSON.stringify(output)+'\n');
}catch(error){
 console.error('P10.8.3 high-resolution/topology gate failed:',error.stack||error);
 process.exitCode=1;
}
