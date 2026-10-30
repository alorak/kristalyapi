import test from 'node:test';
import assert from 'node:assert/strict';
import {crystallographicView,reciprocalBasis,rotateVector,normalizedViewSettings,DEFAULT_VIEW_SETTINGS,lightDirection,
 depthCueFactor,contrastingInk,shannonOptions,displayRadius,schemeColor,normalizedIonicChoices,ELEMENT_DATA_SOURCE} from '../view-settings.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
const closeVec=(a,b,t=1e-9)=>a.forEach((v,i)=>close(v,b[i],t));
const rad=Math.PI/180;
// Same convention as the editor's basis(): a along x, b in the xy plane.
function basis({a,b,c,alpha,beta,gamma}){
 const cx=c*Math.cos(beta*rad),cy=c*(Math.cos(alpha*rad)-Math.cos(beta*rad)*Math.cos(gamma*rad))/Math.sin(gamma*rad);
 return [[a,0,0],[b*Math.cos(gamma*rad),b*Math.sin(gamma*rad),0],[cx,cy,Math.sqrt(c*c-cx*cx-cy*cy)]];
}

test('views along lattice vectors point the named axis at the viewer with a perpendicular up',()=>{
 const cubic=basis({a:4,b:4,c:4,alpha:90,beta:90,gamma:90});
 const c=crystallographicView(cubic,[0,0,1]);
 closeVec(c.direction,[0,0,1]);closeVec(c.up,[0,1,0]);assert.equal(c.upAxis,'b','c along the view: up falls back to b');
 const a=crystallographicView(cubic,[1,0,0]);closeVec(a.direction,[1,0,0]);closeVec(a.up,[0,0,1]);assert.equal(a.upAxis,'c');
 const body=crystallographicView(cubic,[1,1,1]);closeVec(body.direction,[1,1,1].map(v=>v/Math.sqrt(3)));
 close(body.direction.reduce((s,v,i)=>s+v*body.up[i],0),0,1e-12);
});

test('(hkl) normals use the reciprocal lattice: differs from [hkl] in oblique cells',()=>{
 const mono=basis({a:5,b:6,c:7,alpha:90,beta:110,gamma:90});
 const normal=crystallographicView(mono,[0,0,1],'reciprocal').direction,direct=crystallographicView(mono,[0,0,1]).direction;
 closeVec(normal,[0,0,1],1e-12);
 assert.ok(Math.abs(direct[0])>0.3,'[001] leans along a when beta is not 90°');
 const star=reciprocalBasis(mono);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)close(star[i].reduce((s,v,k)=>s+v*mono[j][k],0),i===j?1:0,1e-12);
 assert.throws(()=>crystallographicView(mono,[0,0,0]),/sıfır/);
 assert.throws(()=>crystallographicView(mono,[1,0]),/üç/);
});

test('screen rotations use the right-hand rule',()=>{
 closeVec(rotateVector([1,0,0],[0,0,1],90),[0,1,0],1e-12);
 closeVec(rotateVector([0,1,0],[1,0,0],-90),[0,0,-1],1e-12);
});

test('default appearance reproduces the original scene and saved values are validated',()=>{
 const d=normalizedViewSettings(undefined);
 assert.deepEqual(d,JSON.parse(JSON.stringify(DEFAULT_VIEW_SETTINGS)));
 closeVec(lightDirection(d.light),[8,-13,18].map(v=>v/Math.hypot(8,13,18)),1e-12);
 const v=normalizedViewSettings({background:'#ABCDEF',depthCue:{enabled:true,start:.8,end:.2},light:{ambient:9,key:1,azimuth:400,elevation:10},cell:{color:'red',dashed:true}});
 assert.equal(v.background,'#abcdef');assert.equal(v.depthCue.enabled,true);
 assert.ok(v.depthCue.start<v.depthCue.end,'start stays before end');
 assert.equal(v.light.ambient,d.light.ambient,'out-of-range ambient falls back');assert.equal(v.light.azimuth,d.light.azimuth);
 assert.equal(v.light.key,1);assert.equal(v.cell.color,d.cell.color);assert.equal(v.cell.dashed,true);
});

test('depth cue is linear between start and end of the scene depth; ink contrasts with the background',()=>{
 close(depthCueFactor(10,10,20,{start:0,end:1}),0);close(depthCueFactor(15,10,20,{start:0,end:1}),.5);
 close(depthCueFactor(25,10,20,{start:0,end:1}),1);close(depthCueFactor(12,10,20,{start:.5,end:1}),0);
 assert.equal(contrastingInk('#ffffff'),'#203047');assert.equal(contrastingInk('#000000'),'#f2f6fa');
});

test('radius sets come from the cited tables and never fall back silently',()=>{
 assert.match(ELEMENT_DATA_SOURCE.vdw,/Alvarez/);assert.match(ELEMENT_DATA_SOURCE.ionic,/Shannon/);
 assert.deepEqual(displayRadius('O','vdw',.66),{radius:1.5,fallback:false});
 assert.deepEqual(displayRadius('Si','default',1.11),{radius:1.11,fallback:false});
 const fe={Fe:{charge:2,coordination:'VI',spin:'HS'},O:{charge:-2,coordination:'VI',spin:''}};
 assert.deepEqual(displayRadius('Fe','ionic',1.24,fe),{radius:.78,fallback:false});
 assert.deepEqual(displayRadius('O','ionic',.66,fe),{radius:1.4,fallback:false});
 assert.deepEqual(displayRadius('Na','ionic',1.66,fe),{radius:1.66,fallback:true},'no ionic choice: default radius, flagged');
 assert.deepEqual(displayRadius('Og','vdw',1.1),{radius:1.1,fallback:true});
 assert.throws(()=>displayRadius('O','metallic',1),/Yarıçap/);
 const iron=shannonOptions('Fe');
 assert.ok(iron.some(o=>o.charge===2&&o.coordination==='VI'&&o.spin==='LS'&&o.radius===.61));
 assert.ok(iron.every((o,i)=>i===0||iron[i-1].charge<=o.charge),'sorted by charge');
 assert.deepEqual(normalizedIonicChoices({Fe:{charge:2,coordination:'VI',spin:'HS'},O:{charge:-3,coordination:'VI'},X:1}),{Fe:{charge:2,coordination:'VI',spin:'HS'}});
});

test('colour schemes map elements to Jmol or CPK colours',()=>{
 assert.equal(schemeColor('O','jmol'),'#ff0d0d');assert.equal(schemeColor('O','app'),null);
 assert.match(schemeColor('C','cpk'),/^#[0-9a-f]{6}$/);
 assert.throws(()=>schemeColor('O','vesta'),/Renk/);
});
