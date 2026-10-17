#!/usr/bin/env node
/* Package 10.8 scientific convergence gate.
 * Real crystallographic fixtures: only source CCP4 density from Gemmi. Any
 * downsampled cube is a DERIVED map, not a new experimental measurement.
 * Final extraction uses the production volume-iso-worker.js isoTriangles.
 * Analytic sphere is the independent geometric ground truth.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'../..');
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
 toArray(){return [this.x,this.y,this.z];}
}
const src=fs.readFileSync(path.join(ROOT,'crystal-app.js'),'utf8');
const boundary=src.indexOf('// @kristalyapi/browser-bootstrap:');
assert.ok(boundary>0,'missing validated browser bootstrap boundary');
const parseCtx={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},
 URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(parseCtx);
vm.runInContext(src.slice(0,boundary).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.read=readCcp4Map;this.toCube=volumeCubeText;this.fromCube=readCube;'+
 'this.toXsf=volumeXsfText;this.fromXsf=readXsf;this.normalize=interpretVolumeUnits;',parseCtx);
const workerCtx={self:{postMessage(){}},Float32Array,Float64Array,Uint8ClampedArray,Math};
vm.createContext(workerCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'volume-iso-worker.js'),'utf8')+
 '\nthis.mesh=isoTriangles;this.sample=volumeSample;this.at=volumeAtWorld;'+
 'this.coord=volumeCoord;',workerCtx);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const determinant=a=>dot(a[0],cross(a[1],a[2]));
const distance=p=>Math.hypot(...p);
function boundsCheck(grid){
 assert.ok(grid.dims.length===3&&grid.dims.every(n=>Number.isInteger(n)&&n>=2));
 assert.equal(grid.values.length,grid.dims.reduce((a,b)=>a*b,1));
 assert.ok(Math.abs(determinant(grid.axes))>1e-12,'non-degenerate physical coordinate frame');
 assert.ok(grid.values.every(Number.isFinite),'non-finite input field');
}
function meshMetrics(mesh,original,level,analytic=null){
 assert.ok(!mesh.truncated,'scientific result truncated at triangle limit');
 assert.ok(mesh.triangles>0&&mesh.positions.length===mesh.triangles*9,'empty/inconsistent triangle soup');
 let area=0,signedVolume=0,maxRadialError=0;
 const deviations=[];
 for(let i=0;i<mesh.positions.length;i+=9){
  const a=Array.from(mesh.positions.slice(i,i+3));
  const b=Array.from(mesh.positions.slice(i+3,i+6));
  const c=Array.from(mesh.positions.slice(i+6,i+9));
  const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),normal=cross(ab,ac);
  const triangleArea=distance(normal)/2;
  assert.ok(Number.isFinite(triangleArea)&&triangleArea>1e-12,'degenerate triangle in scientific mesh');
  area+=triangleArea;
  for(const p of [a,b,c]){
   if(analytic){
    maxRadialError=Math.max(maxRadialError,Math.abs(distance(p.map((v,j)=>v-analytic.center[j]))-analytic.radius));
   }else{
    const residual=Math.abs(workerCtx.at(original,p)-level);
    assert.ok(Number.isFinite(residual),'source map interpolation invalid');
    deviations.push(residual);
   }
  }
  if(analytic){
   // The original triangle order is not assumed orientable: the sphere's
   // known analytic center independently orients each triangle outward.
   const center=[0,1,2].map(j=>(a[j]+b[j]+c[j])/3-analytic.center[j]);
   const sign=dot(normal,center)>=0?1:-1;
   signedVolume+=sign*dot(a.map((v,j)=>v-analytic.center[j]),
    cross(b.map((v,j)=>v-analytic.center[j]),c.map((v,j)=>v-analytic.center[j]))/6;
  }
 }
 deviations.sort((a,b)=>a-b);
 const p95=deviations.length?deviations[Math.ceil(.95*deviations.length)-1]:null;
 assert.ok(Number.isFinite(area)&&area>0,'invalid physical surface area');
 return {triangles:mesh.triangles,decimation:mesh.decimation,
  surfaceAreaA2:area,analyticEnclosedVolumeA3:analytic?Math.abs(signedVolume):null,
  analyticMaxPositionErrorA:analytic?maxRadialError:null,
  sourceScalarResidualP95:p95,sourceScalarResidualMax:deviations.length?deviations.at(-1):null};
}
function sphereGrid(n,radius){
 const step=2/(n-1),values=new Float32Array(n**3);let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const value=radius-Math.hypot(-1+i*step,-1+j*step,-1+k*step);
  values[(i*n+j)*n+k]=value;min=Math.min(min,value);max=Math.max(max,value);
 }
 return {dims:[n,n,n],origin:[-1,-1,-1],axes:[[step,0,0],[0,step,0],[0,0,step]],
  values,min,max,periodic:false};
}
function analyticSphere(){
 const radius=.63,exactArea=4*Math.PI*radius**2,exactVolume=4*Math.PI*radius**3/3;
 const series=[16,24,32].map(n=>{
  const grid=sphereGrid(n,radius);
  const metrics=meshMetrics(workerCtx.mesh(grid,0,null,'thermal',75000),grid,0,
   {center:[0,0,0],radius});
  return {size:n,...metrics,
   relativeAreaError:Math.abs(metrics.surfaceAreaA2-exactArea)/exactArea,
   relativeVolumeError:Math.abs(metrics.analyticEnclosedVolumeA3-exactVolume)/exactVolume};
 });
 const coarse=series[0],fine=series.at(-1);
 assert.ok(fine.analyticMaxPositionErrorA<.025,
  'analytical sphere fine-grid position error exceeds 0.025 Å');
 assert.ok(fine.relativeAreaError<.08,'analytical sphere area error exceeds 8%');
 assert.ok(fine.relativeVolumeError<.10,'analytical sphere volume error exceeds 10%');
 assert.ok(fine.analyticMaxPositionErrorA<coarse.analyticMaxPositionErrorA,
  'sphere position does not improve with resolution');
 assert.ok(fine.relativeAreaError<coarse.relativeAreaError,
  'sphere area does not converge toward analytic area');
 assert.ok(fine.relativeVolumeError<coarse.relativeVolumeError,
  'sphere volume does not converge toward analytic volume');
 return {radiusA:radius,referenceAreaA2:exactArea,referenceVolumeA3:exactVolume,series};
}
function resample(original,n){
 const periodic=!!original.periodic,sourceExtent=original.dims.map(d=>periodic?d:d-1);
 const steps=sourceExtent.map(d=>d/(periodic?n:n-1));
 const axes=original.axes.map((row,a)=>row.map(v=>v*steps[a]));
 const values=new Float32Array(n**3);let min=Infinity,max=-Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
  const value=workerCtx.sample(original,[i*steps[0],j*steps[1],k*steps[2]]);
  values[(i*n+j)*n+k]=value;min=Math.min(min,value);max=Math.max(max,value);
 }
 return {dims:[n,n,n],axes,origin:[...original.origin],values,min,max,periodic};
}
function occupiedVolume(grid,threshold){
 const [nx,ny,nz]=grid.dims,periodic=!!grid.periodic;
 let sum=0;
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(let k=0;k<nz;k++){
  if(grid.values[(i*ny+j)*nz+k]<threshold)continue;
  // Open bricks: composite 3-D trapezoidal integration.
  const edge=(p,n)=>periodic||p!==0&&p!==n-1?1:.5;
  sum+=edge(i,nx)*edge(j,ny)*edge(k,nz);
 }
 return sum*Math.abs(determinant(grid.axes));
}
function compareGrid(original,reloaded,label){
 boundsCheck(reloaded);
 assert.deepEqual(Array.from(reloaded.dims),Array.from(original.dims),label+' dimensions');
 for(let i=0;i<3;i++){
  assert.ok(Math.abs(original.origin[i]-reloaded.origin[i])<1e-6,label+' origin');
  for(let j=0;j<3;j++)assert.ok(Math.abs(original.axes[i][j]-reloaded.axes[i][j])<1e-6,label+' world vectors');
 }
 let maximum=0;
 for(let i=0;i<original.values.length;i++)
  maximum=Math.max(maximum,Math.abs(original.values[i]-reloaded.values[i]));
 assert.ok(maximum<1e-5,label+' scalar round-trip');
 return maximum;
}
function experimental(pathname){
 const original=parseCtx.read(fs.readFileSync(pathname),path.basename(pathname));
 boundsCheck(original);
 const sorted=Array.from(original.values).sort((a,b)=>a-b);
 const q=Math.floor(sorted.length*.78),level=(sorted[q]+sorted[q+1])/2;
 assert.ok(level>original.min&&level<original.max,'real source isovalue degenerate');
 // Re-encodings of the same REAL CCP4 data. These are NOT independently
 // obtained laboratory CUBE, XSF or CHGCAR datasets.
 const cube=parseCtx.fromCube(parseCtx.toCube(original));
 const xsf=parseCtx.normalize(parseCtx.fromXsf(parseCtx.toXsf(original)),
  'unknown',{periodic:!!original.periodic});
 const interchange={cubeMaxScalarDifference:compareGrid(original,cube,'CUBE'),
  xsfMaxScalarDifference:compareGrid(original,xsf,'XSF')};
 const series=[16,24,32].map(n=>{
  const g=resample(original,n),mesh=workerCtx.mesh(g,level,null,'thermal',75000);
  return {size:n,...meshMetrics(mesh,original,level),
   occupiedGridVolumeA3:occupiedVolume(g,level)};
 });
 const top=series.at(-1),reference=series[0];
 assert.ok(series.every(x=>x.surfaceAreaA2>0&&x.occupiedGridVolumeA3>=0));
 assert.ok(top.sourceScalarResidualP95!==null);
 // No fabricated "true" geometric surface for experimental maps. Report
 // metrics across resolutions, but do not impose a monotonic assumption:
 // oscillatory density and resolution cutoff can cause nonmonotonic changes.
 return {source:path.basename(pathname),nativeDims:original.dims,
  periodic:!!original.periodic,level,units:'source scalar (unknown)',
  interchange,series,
  areaRelativeChange16to32:Math.abs(top.surfaceAreaA2-reference.surfaceAreaA2)/
   Math.max(top.surfaceAreaA2,reference.surfaceAreaA2),
  occupancyRelativeChange16to32:Math.abs(top.occupiedGridVolumeA3-reference.occupiedGridVolumeA3)/
   Math.max(top.occupiedGridVolumeA3,reference.occupiedGridVolumeA3,1e-12)};
}
try{
 const report=process.argv[2]?{kind:'experimental',...experimental(path.resolve(process.argv[2]))}:
  {kind:'analytic',...analyticSphere()};
 process.stdout.write(JSON.stringify(report)+'\n');
}catch(error){console.error('P10.8 scientific convergence failure:',error.stack||error);process.exitCode=1;}
