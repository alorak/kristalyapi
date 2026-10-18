#!/usr/bin/env node
/* Executes the actual production CIF parser and P13 BVS/occupancy functions.
   No Gemmi/ASE algorithms or expected coordinates are implemented here. */
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'bvs_13_sources.json'),'utf8'));

class Vector3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
 toArray(){return [this.x,this.y,this.z];}
 length(){return Math.hypot(this.x,this.y,this.z);}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this;}
}
const script=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
const end=script.indexOf('// @kristalyapi/browser-bootstrap:');
assert.ok(end>0,'Production module bootstrap boundary missing');
const context={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},URLSearchParams,URL,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(context);
vm.runInContext(script.slice(0,end).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.bvs=bondValenceSum;this.centerAlternatives=bvsCenterAlternatives;',context);

const structures=new Map();
for(const entry of manifest.sources){
 const absolute=path.resolve(root,entry.path);
 assert.ok(absolute.startsWith(path.join(root,'tests/validation/fixtures/experimental')+path.sep));
 const original=fs.readFileSync(absolute);
 const sha=crypto.createHash('sha256').update(original).digest('hex');
 assert.equal(sha,entry.sha256,'Experimental CIF source SHA-256 drift: '+entry.id);
 structures.set(entry.id,{...context.structureImportData(original.toString('utf8'),path.basename(entry.path)),sha256:sha});
}
const results=manifest.cases.map(item=>{
 const structure=structures.get(item.source);
 assert.ok(structure,'Unknown experimental CIF source: '+item.source);
 const centerIndex=structure.sites.findIndex(s=>s.symbol===item.element&&
  (s.label===item.centerLabel||s.label.startsWith(item.centerLabel+'_')));
 assert.ok(centerIndex>=0,'Experimental CIF center not found: '+item.id);
 const bvs=context.bvs(structure.sites,centerIndex,structure.cell,item.pair,item.cutoff,true);
 const alternatives=context.centerAlternatives(structure.sites,centerIndex,structure.cell,item.pair,item.cutoff,true);
 return {id:item.id,source:item.source,sha256:structure.sha256,name:structure.name,
  cell:structure.cell,sites:structure.sites.map(s=>({element:s.symbol,label:s.label,
   x:s.x,y:s.y,z:s.z,occupancy:s.occupancy})),sgNumber:structure.sgNumber,
  warning:structure.warning,centerIndex,bvs,centerAlternatives:alternatives};
});
process.stdout.write(JSON.stringify({cases:results})+'\n');
