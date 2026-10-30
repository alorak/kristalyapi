import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseVesta3View,vesta3CameraPreview} from '../vesta-project-view.js';
import {vesta3SectionTransferReport} from '../vesta-project-style.js';

const make=(matrix=[
 '1 0 0 0','0 1 0 0','0 0 1 0','0 0 0 1'
],{local=null,mode='PROJT 0 0.962'}={})=>[
 '#VESTA_FORMAT_VERSION 3.3.0','CRYSTAL',
 ...(local?['LMATRIX',...local,'0 0 0']:[]),
 'SCENE',...matrix,'0.000 0.000','0.000','1.000',
 ...(mode?[mode]:[]),
 'BKGRC','255 255 255',
 'LIGHT0 1','1 0 0 0','0 1 0 0','0 0 1 0','0 0 0 1'
].join('\n').split('\n');
const IDENTITY=['1 0 0 0','0 1 0 0','0 0 1 0','0 0 0 1'];

test('real published VESTA 3.3 SCENE matrix validates as bounded rigid orientation (not actual GUI)',()=>{
 // Original matrix values were inspected in public WMD-group/Phonons
 // MAPbI3-Cubic.vesta. No VESTA executable or GUI comparison.
 const published=[
 '0.999594 0.022422 -0.017605 0.000000',
 '-0.022480 0.999742 -0.003114 0.000000',
 '0.017530 0.003509 0.999840 0.000000',
 '0.000000 0.000000 0.000000 1.000000'
 ];
 const v=parseVesta3View(make(published,{local:IDENTITY,mode:'PROJT 1 1.290'}));
 assert.equal(v.canPreview,true);
 assert.equal(v.projection.mode,'perspective');
 assert.equal(v.projection.rawFactor,1.29);
 assert.equal(v.background.status,'READ_NOT_APPLIED');
 assert.equal(v.lights[0].enabled,true);
 assert.ok(Math.abs(v.frame.determinant-1)<.0001);
 assert.match(v.provenance,/Unverified/);
 const preview=vesta3CameraPreview(v,{distance:20,target:[1,2,3]});
 assert.ok(Math.abs(preview.position[0]-(1+20*.017530))<.0001);
 assert.equal(preview.perspective,true);
 assert.match(preview.assumption,/NOT validated/);
});

test('VESTA orthographic PROJT mode and roll around view direction preview',()=>{
 const rz90=['0 -1 0 0','1 0 0 0','0 0 1 0','0 0 0 1'];
 const v=parseVesta3View(make(rz90));
 assert.equal(v.canPreview,true);
 assert.equal(v.projection.mode,'orthographic');
 const preview=vesta3CameraPreview(v,{distance:10,target:[1,2,3]});
 assert.deepEqual(preview.position,[1,2,13]);
 assert.deepEqual(preview.up,[1,0,0]);
 assert.deepEqual(preview.right,[0,-1,0]);
 assert.equal(preview.perspective,false);
});

test('SCENE with nonidentity LMATRIX is intentionally rejected rather than double rotated',()=>{
 const nonid=['0 -1 0 0','1 0 0 0','0 0 1 0','0 0 0 1'];
 const result=parseVesta3View(make(IDENTITY,{local:nonid}));
 assert.equal(result.canPreview,false);
 assert.match(result.reason,/Non-identity LMATRIX/);
 assert.throws(()=>vesta3CameraPreview(result,{distance:10,target:[0,0,0]}),/not permitted/);
});

test('unsafe SCENE reflection, nonrigid, translation and malformed row never preview',()=>{
 for(const bad of [
  ['-1 0 0 0',...IDENTITY.slice(1)],
  ['2 0 0 0',...IDENTITY.slice(1)],
  ['1 0 0 0','0 1 0 0','0 0 1 5','0 0 0 1'],
  ['1 0 0','0 1 0 0','0 0 1 0','0 0 0 1'],
  ['NaN 0 0 0',...IDENTITY.slice(1)],
 ]) {
  const x=parseVesta3View(make(bad));
  assert.equal(x.canPreview,false,JSON.stringify(bad));
  assert.equal(x.frame,null);
  assert.match(x.reason,/SCENE/);
 }
});

test('missing SCENE or unsupported PROJT does not invent projection or VESTA GUI result',()=>{
 const missing=parseVesta3View(['PROJT 0 0.962','BKGRC','255 255 255']);
 assert.equal(missing.canPreview,false);
 assert.equal(missing.frame,null);
 const other=parseVesta3View(make(IDENTITY,{mode:'PROJT 4 3.5'}));
 assert.equal(other.canPreview,true);
 assert.equal(other.projection.mode,null);
 assert.equal(other.projection.status,'UNSUPPORTED');
 const malformed=parseVesta3View(make(IDENTITY,{mode:'PROJT 0 NaN'}));
 assert.equal(malformed.projection.status,'INVALID');
 assert.equal(malformed.canPreview,true);
});

test('SCENE metadata does not silently apply zoom, background or light settings',()=>{
 const r=parseVesta3View(make());
 assert.equal(r.raw.sceneTail.length,3);
 assert.ok(r.notes.some(x=>/pan\/zoom/.test(x)));
 assert.ok(r.notes.some(x=>/LIGHT0\.\.LIGHT3/.test(x)));
 assert.ok(r.notes.some(x=>/BKGRC/.test(x)));
 assert.equal(r.projection.rawFactor,.962);
 assert.equal(r.lights[0].status,'NOT_TRANSFERRED');
});

test('camera-distance and target vectors are required to be valid',()=>{
 const view=parseVesta3View(make());
 for(const value of [0,-1,Infinity,NaN])
  assert.throws(()=>vesta3CameraPreview(view,{distance:value,target:[0,0,0]}),/Invalid current/);
 assert.throws(()=>vesta3CameraPreview(view,{distance:5,target:[1,NaN,3]}),/Invalid current/);
});

test('V17.2 section transfer audit correctly marks conditional SCENE/PROJT, not LMATRIX/light',()=>{
 const lines=make(IDENTITY,{local:IDENTITY});
 const report=vesta3SectionTransferReport(lines);
 assert.equal(report.sections.find(s=>s.section==='SCENE')?.status,'conditional');
 assert.ok(!report.skipped.includes('SCENE'));
 for(const name of ['LMATRIX','LIGHT0','BKGRC'])
  assert.ok(report.skipped.includes(name),name);
 assert.equal(report.sections.find(s=>s.section==='PROJT')?.status,'conditional');
});

test('editor only applies experimental camera after operator confirmation; Fit escape remains',()=>{
 const text=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 assert.match(text,/from '\.\/vesta-project-view\.js'/);
 assert.match(text,/window\.confirm\('VESTA SCENE/);
 assert.match(text,/vesta3CameraPreview\(view,\{distance,target\}\)/);
 assert.match(text,/function applyVestaCameraPreview\(view\)/);
 assert.match(text,/fit\(\);\s*if\(vesta\?\.view\?\.canPreview\)/);
 assert.match(text,/vesta\.warnings\.push\('VESTA scene preview declined/);
});
