#!/usr/bin/env node
/* Package 12: execute the real production bondValenceSum function.
 * ASE owns all independent lattice-neighbor enumeration and reference sums.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const filename=process.argv[2];
if(!filename)throw Error('Usage: node bvs-p12-bridge.cjs CASES.json');
const input=JSON.parse(fs.readFileSync(filename,'utf8'));
assert.ok(Array.isArray(input.cases)&&input.cases.length<=50);

class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 toArray(){return [this.x,this.y,this.z];}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
 length(){return Math.hypot(this.x,this.y,this.z);}
 multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
 addScaledVector(v,n){this.x+=v.x*n;this.y+=v.y*n;this.z+=v.z*n;return this;}
 crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
}
const code=fs.readFileSync(path.join(__dirname,'../../crystal-app.js'),'utf8');
const end=code.indexOf('// @kristalyapi/browser-bootstrap:');
assert.ok(end>0,'Production source boundary not found');
const ctx={THREE:{Vector3,SphereGeometry:class{},CylinderGeometry:class{}},
 URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(ctx);
vm.runInContext(code.slice(0,end).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.productionBvs=bondValenceSum;this.parameterList=BVS_PARAMETERS;',ctx);
const reports=input.cases.map(c=>{
 const output=ctx.productionBvs(c.sites,c.centerIndex,c.cell,c.pair,c.cutoff,c.periodic);
 assert.ok(Number.isFinite(output.sum)&&Number.isFinite(output.weightedCount));
 return {label:c.label,...output};
});
process.stdout.write(JSON.stringify({parameters:ctx.parameterList,cases:reports})+'\n');
