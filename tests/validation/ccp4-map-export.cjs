#!/usr/bin/env node
/* Export P9.1 native CCP4/MRC coordinates and deterministic voxel probes for
   comparison with independent Gemmi. Input may be a partial crystallographic map. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
 toArray(){return [this.x,this.y,this.z];}
}
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
const index=source.indexOf('// @kristalyapi/browser-bootstrap:');
if(index<0)throw Error('Browser bootstrap marker missing');
const context={THREE:{Vector3},URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(context);
vm.runInContext(source.slice(0,index).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.ccp4Read=readCcp4Map;',context);
const filepath=process.argv[2];
if(!filepath)throw Error('Expected a CCP4/MRC filename');
const bytes=fs.readFileSync(filepath),g=context.ccp4Read(bytes,path.basename(filepath));
const probes=[],seen=new Set();
function add(x,y,z){
 const i=x*g.dims[1]*g.dims[2]+y*g.dims[2]+z;
 if(seen.has(i))return;seen.add(i);
 probes.push({xyz:[x,y,z],value:g.values[i]});
}
for(const x of [0,Math.floor(g.dims[0]/2),g.dims[0]-1])
 for(const y of [0,Math.floor(g.dims[1]/2),g.dims[1]-1])
  for(const z of [0,Math.floor(g.dims[2]/2),g.dims[2]-1])add(x,y,z);
let seed=170917;
for(let n=0;n<128;n++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%g.dims[0];
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%g.dims[1];
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const z=seed%g.dims[2];
 add(x,y,z);
}
const sum=Array.from(g.values).reduce((a,b)=>a+b,0);
console.log(JSON.stringify({dims:g.dims,origin:g.origin,axes:g.axes,
 periodic:g.periodic,meta:g.ccp4,min:g.min,max:g.max,sum,probes}));
