#!/usr/bin/env node
/* P10.8.6: exercise the real browser parsers and production isosurface Worker.
 * This file contains no independent format decoder or reference values.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const vm=require('node:vm');

const [source,format,outDir]=process.argv.slice(2);
if(!source||!['chgcar','cube','xsf'].includes(format)||!outDir)
 throw Error('Usage: node volume-vesta-format-bridge.cjs SOURCE chgcar|cube|xsf OUT_DIR');

class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 toArray(){return [this.x,this.y,this.z];}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
 crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
}

const root=path.resolve(__dirname,'../..');
const browser=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
const end=browser.indexOf('// @kristalyapi/browser-bootstrap:');
assert.ok(end>0,'Browser parser boundary not found');
const context={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},
 URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(context);
require('./cif2-vm.cjs').loadCif2Helpers(context);
vm.runInContext(browser.slice(0,end).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.readers={chgcar:readChgcar,cube:readCube,xsf:readXsf};',context);

const bytes=fs.readFileSync(source);
const content=(source.endsWith('.gz')?zlib.gunzipSync(bytes):bytes).toString('utf8');
const grid=context.readers[format](content);
const size=grid.dims.reduce((a,b)=>a*b,1);
assert.equal(grid.values.length,size);
assert.ok(grid.values.every(Number.isFinite));
assert.ok(grid.axes.flat().every(Number.isFinite));

const file=`${format}-grid.float32`;
const values=Float32Array.from(grid.values);
fs.writeFileSync(path.join(outDir,file),Buffer.from(values.buffer,values.byteOffset,values.byteLength));
// P11: export each source channel independently; the primary gridFile remains
// unchanged for the previously pinned P10.8.6/10.9 reference suites.
const allFields=[{label:grid.fieldLabel||
 (grid.datasetIds?.length?'Orbital '+grid.datasetIds[0]:'primary'),grid},
 ...(grid.volumeComponents||[])];
const fields=allFields.map(({label,grid:component},index)=>{
 assert.deepEqual(component.dims,grid.dims,'channel dimensions differ');
 const filename=index===0?file:`${format}-field-${index}.float32`;
 if(index){
  const channel=Float32Array.from(component.values);
  assert.equal(channel.length,size,'channel voxel count differs');
  fs.writeFileSync(path.join(outDir,filename),Buffer.from(channel.buffer,channel.byteOffset,channel.byteLength));
 }
 return {label,file:filename,voxels:component.values.length};
});

const worker={self:{postMessage(){}},Float32Array,Float64Array,Uint8ClampedArray,Math};
vm.createContext(worker);
vm.runInContext(fs.readFileSync(path.join(root,'volume-iso-worker.js'),'utf8')+
 '\nthis.iso=isoTriangles;',worker);
// Strictly between distinct data values so an exact-equality node cannot
// introduce a degenerate triangle and invalidate a geometry comparison.
const sorted=Array.from(values).sort((a,b)=>a-b);
const idx=Math.min(size-2,Math.floor((size-1)*(format==='xsf'?.5:.85)));
let lower=sorted[idx],upper=sorted.find(v=>v>lower);
if(upper===undefined){lower=sorted.find(v=>v<sorted[size-1]);upper=sorted[size-1];}
assert.ok(Number.isFinite(lower)&&Number.isFinite(upper)&&upper>lower,'No nonconstant source field');
const isovalue=(lower+upper)/2;
const iso=worker.iso(grid,isovalue,null,'thermal',75000,1,64);
assert.ok(!iso.truncated,'Production 75k triangle safety budget hit');
assert.ok(iso.triangles>0,'No production isosurface');
let areaA2=0;
for(let n=0;n<iso.positions.length;n+=9){
 const p=iso.positions;
 const u=[p[n+3]-p[n],p[n+4]-p[n+1],p[n+5]-p[n+2]];
 const v=[p[n+6]-p[n],p[n+7]-p[n+1],p[n+8]-p[n+2]];
 const c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 areaA2+=Math.hypot(...c)/2;
}
assert.ok(Number.isFinite(areaA2)&&areaA2>0);
const manifest={protocol:'p10.8.6-real-format-reader',source:path.basename(source),
 format,kind:grid.kind,units:grid.units,quantity:grid.quantity,
 dims:[...grid.dims],origin:[...grid.origin],axes:grid.axes.map(v=>[...v]),
 periodic:!!grid.periodic,min:grid.min,max:grid.max,gridFile:file,fields,
 datasetIds:grid.datasetIds||null,
 siteCount:grid.crystal?.sites.length??0,
 atoms:grid.atoms?.map(atom=>({atomicNumber:atom.atomicNumber,
  positionA:[...atom.position],nuclearCharge:atom.nuclearCharge}))||null,
 displayStructure:grid.crystal?.nonPeriodic?{
  nonPeriodic:true,originA:[...grid.crystal.nonPeriodicOrigin],
  displayCell:!!grid.crystal.displayCell,
  cellA:[grid.crystal.cell.a,grid.crystal.cell.b,grid.crystal.cell.c],
  atomPositionsA:grid.crystal.sites.map(site=>[site.x,site.y,site.z].map((f,i)=>
   f*[grid.crystal.cell.a,grid.crystal.cell.b,grid.crystal.cell.c][i]+grid.crystal.nonPeriodicOrigin[i]))
 }:null,
 surface:{isovalue,triangles:iso.triangles,areaA2,decimation:iso.decimation,truncated:iso.truncated}};
fs.writeFileSync(path.join(outDir,`${format}-bridge.json`),JSON.stringify(manifest,null,2));
process.stdout.write(JSON.stringify({format,dims:manifest.dims,triangles:iso.triangles})+'\n');
