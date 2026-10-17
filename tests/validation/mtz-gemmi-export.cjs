'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.join(__dirname,'..','..');
const app=fs.readFileSync(path.join(root,'crystal-app.js'),'utf8');
const core=fs.readFileSync(path.join(root,'tests','core.test.cjs'),'utf8');
// Reuse the exact minimal Vector3 stub already used by native regression.
const vectors=core.slice(core.indexOf('class Vector3'),core.indexOf('const htmlShell'));
const context={URL,URLSearchParams,TextEncoder,document:{getElementById:()=>null}};
vm.createContext(context);
vm.runInContext(vectors+'\nthis.__Vector3=Vector3;',context);
context.THREE={Vector3:context.__Vector3,SphereGeometry:class{},CylinderGeometry:class{}};
const marker=app.indexOf('// @kristalyapi/browser-bootstrap:');
if(marker<0)throw Error('missing bootstrap');
vm.runInContext(app.slice(0,marker).replace(/^import .*?;\s*$/gm,'')+
 '\nthis.__api={readMtz,observedFourierMap,gridIndex};',context);
const gz=fs.readFileSync(path.join(root,'tests','fixtures','gemmi-5wkd_phases.mtz.gz'));
const bytes=zlib.gunzipSync(gz);
const mtz=context.__api.readMtz(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const locations=[[0,0,0],[1,2,3],[5,1,8],[9,4,17],[12,17,31],
 [24,40,63],[63,63,63],[33,10,28],[8,23,49],[18,0,0],[0,16,8],[7,44,19]];
const maps={};
const quality=context.__api.observedFourierMap(mtz.cell,mtz,{kind:'difference',dMin:0.35,size:64,
 minSignalToNoise:2,freeFlagValue:1,fomMode:'multiply'}).experimental;
for(const kind of ['weighted-main','weighted-difference']){
 const result=context.__api.observedFourierMap(mtz.cell,mtz,{kind,dMin:0.35,size:64});
 maps[kind]={used:result.experimental.used,
  samples:locations.map(([i,j,k])=>Number(result.values[context.__api.gridIndex(result,i,j,k)]))};
}
process.stdout.write(JSON.stringify({cell:mtz.cell,spaceGroup:mtz.mtz.spaceGroupNumber,
 nref:mtz.mtz.totalRows,columns:mtz.mtz.optionalColumns,
 reflections:mtz.reflections.map(r=>[r.h,r.k,r.l,r.fo,r.fc,r.phase,r.sigma,r.fom,r.free]),
 sampleLocations:locations,maps,
 quality:{skippedSignal:quality.skippedSignal,skippedFree:quality.skippedFree,
 skippedMissingQuality:quality.skippedMissingQuality}})+'\n');
