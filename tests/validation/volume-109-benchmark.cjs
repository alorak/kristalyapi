#!/usr/bin/env node
/* CI-only P10.9: true production 40-interval Worker vs research 64-interval
 * Worker. The 75k triangle cap is never raised or bypassed. Durations/RSS
 * are observations, NOT performance pass thresholds or hardware guarantees.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {ctx,gridLike}=require('./volume-highres-gate.cjs');

const [inputDir,outputFile]=process.argv.slice(2);
if(!inputDir||!outputFile)throw Error('Usage: node volume-109-benchmark.cjs INPUT_DIR OUTPUT_JSON');

const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function areaA2(positions){
 let sum=0;
 for(let n=0;n<positions.length;n+=9){
  const a=[0,1,2].map(i=>positions[n+i+3]-positions[n+i]);
  const b=[0,1,2].map(i=>positions[n+i+6]-positions[n+i]);
  sum+=Math.hypot(...cross(a,b))/2;
 }
 return sum;
}

function run(label){
 const metadata=JSON.parse(fs.readFileSync(path.join(inputDir,`${label}-bridge.json`),'utf8'));
 const binary=fs.readFileSync(path.join(inputDir,metadata.gridFile));
 assert.equal(binary.byteLength,metadata.dims.reduce((a,b)=>a*b,1)*4);
 const values=new Float32Array(binary.buffer,binary.byteOffset,binary.byteLength/4);
 const original={dims:metadata.dims,axes:metadata.axes,origin:metadata.origin,
  values,periodic:metadata.periodic};
 const sorted=Array.from(values).sort((a,b)=>a-b),target=Math.floor((sorted.length-1)*.97);
 const lower=sorted[target],upper=sorted.find(v=>v>lower);
 assert.ok(Number.isFinite(lower)&&Number.isFinite(upper)&&upper>lower);
 const level=(lower+upper)/2;
 const samples=[];
 for(const n of [32,48,64]){
  const t0=performance.now(),grid=gridLike(original,n),sampleMillis=performance.now()-t0;
  const modes=[];
  for(const [mode,maxAxisIntervals] of [['production-40',40],['research-64',64]]){
   const before=process.memoryUsage().rss;
   const start=performance.now();
   const surface=ctx.iso(grid,level,null,'thermal',75000,1,maxAxisIntervals);
   const durationMs=performance.now()-start;
   const rssAfter=process.memoryUsage().rss;
   assert.ok(!surface.truncated&&surface.triangles>0,'Empty/truncated scientific mesh: '+label+' '+n+' '+mode);
   assert.ok(surface.positions.every(Number.isFinite),'Nonfinite mesh: '+label+' '+mode);
   const area=areaA2(surface.positions);
   assert.ok(Number.isFinite(area)&&area>0);
   if(maxAxisIntervals===64)assert.equal(surface.decimation,1,'Research 64 silently decimated');
   modes.push({mode,maxAxisIntervals,triangles:surface.triangles,
    decimation:surface.decimation,areaA2:area,
    geometryBytes:surface.positions.byteLength+(surface.colors?.byteLength||0),
    durationMs:Math.round(durationMs*100)/100,
    rssBeforeBytes:before,rssAfterBytes:rssAfter});
  }
  samples.push({n,sourceSamplingMs:Math.round(sampleMillis*100)/100,
   voxelBytes:grid.values.byteLength,modes,
   productionVsFullAreaDifference:Math.abs(modes[0].areaA2-modes[1].areaA2)/modes[1].areaA2});
 }
 const full48=samples[1].modes[1].areaA2,full64=samples[2].modes[1].areaA2;
 const convergence= Math.abs(full64-full48)/Math.max(full64,full48);
 return {label,sourceDimensions:metadata.dims,periodic:metadata.periodic,
  isovalue:level,quantile:.97,samples,full48To64AreaChange:convergence,
  convergenceAlert:convergence>.1,
  qualityModeApproved:false,
  warning:'Timing is runner-dependent, source interpolation is not physical convergence; research-64 is not an enabled UI mode.'};
}

const report={protocol:'p10.9-40vs64-real-field-worker-cost',node:process.version,
 timeBudgetHardGate:false,triangleLimit:75000,
 cases:['chgcar','cube','xsf'].map(run)};
fs.mkdirSync(path.dirname(outputFile),{recursive:true});
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report.cases.map(({label,full48To64AreaChange,convergenceAlert})=>
 ({label,change:full48To64AreaChange,alert:convergenceAlert})))+'\n');
