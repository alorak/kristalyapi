import test from 'node:test';
import assert from 'node:assert/strict';
import {XRD_FACTOR_EXAMPLES,xrdFactorStructure,xrdFactorPerturb,xrdFactorResult,xrdFactorCompare} from '../xrd-factor-core.js';

// An independent point-scatterer analytical reference. The live application
// supplies its full IT92 form-factor + DW engine through the same API.
const f0={Si:14,Fe:26,Na:11,Cl:17};
function referenceFactor(h,k,l,sites,cell){
 const d=cell.a/Math.hypot(h,k,l);
 let real=0,imag=0;
 for(const site of sites){
  const phi=2*Math.PI*(h*site.x+k*site.y+l*site.z);
  const amp=f0[site.symbol]*(site.occupancy??1);
  real+=amp*Math.cos(phi);imag+=amp*Math.sin(phi);
 }
 return {h,k,l,d,real,imag,intensity:real*real+imag*imag};
}
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} ≈ ${b}`);

test('teaching unit cells contain exact conventional fcc-diamond, bcc, rock-salt sites',()=>{
 const [si,fe,nacl]=XRD_FACTOR_EXAMPLES.map(item=>xrdFactorStructure(item.id));
 assert.equal(si.sites.length,8);
 assert.equal(fe.sites.length,2);
 assert.equal(nacl.sites.length,8);
 assert.equal(si.sites.filter(a=>a.studyGroup).length,4);
 assert.equal(fe.sites.filter(a=>a.studyGroup).length,1);
 assert.equal(nacl.sites.filter(a=>a.studyGroup).length,4);
 assert.deepEqual(Object.keys(f0).sort(),[...new Set([...si.sites,...fe.sites,...nacl.sites].map(x=>x.symbol))].sort());
 assert.ok(XRD_FACTOR_EXAMPLES.every(x=>x.a>2));
});

test('Si diamond forbidden (100), (200) but allowed (111), (220)',()=>{
 const si=xrdFactorStructure('si');
 for(const hkl of [[1,0,0],[2,0,0]]){
  const v=xrdFactorResult(referenceFactor,si,hkl);
  assert.equal(v.extinct,true,`${hkl} should cancel`);
  near(v.intensity,0);
 }
 for(const hkl of [[1,1,1],[2,2,0]]){
  const v=xrdFactorResult(referenceFactor,si,hkl);
  assert.equal(v.extinct,false,`${hkl} should be allowed`);
  assert.ok(v.intensity>0);
 }
 const oneEleven=xrdFactorResult(referenceFactor,si,[1,1,1]);
 near(oneEleven.twoTheta,28.44,.03);
});

test('BCC Fe body-centering forbids odd h+k+l, permits even sum',()=>{
 const fe=xrdFactorStructure('fe');
 for(const hkl of [[1,0,0],[1,1,1],[2,1,0]])assert.equal(xrdFactorResult(referenceFactor,fe,hkl).extinct,true);
 for(const hkl of [[1,1,0],[2,0,0],[2,2,0]])assert.equal(xrdFactorResult(referenceFactor,fe,hkl).extinct,false);
});

test('NaCl fcc centering kills mixed parity and Na/Cl basis affects allowed peaks',()=>{
 const nacl=xrdFactorStructure('nacl');
 for(const hkl of [[1,0,0],[2,1,0],[2,2,1]])assert.equal(xrdFactorResult(referenceFactor,nacl,hkl).extinct,true);
 const odd=xrdFactorResult(referenceFactor,nacl,[1,1,1]);
 const even=xrdFactorResult(referenceFactor,nacl,[2,0,0]);
 near(odd.amplitude,4*Math.abs(f0.Cl-f0.Na));
 near(even.amplitude,4*(f0.Cl+f0.Na));
});

test('occupancy and positions change Fc without mutating original source sites',()=>{
 const bcc=xrdFactorStructure('fe');
 const original=JSON.stringify(bcc);
 const normal=xrdFactorResult(referenceFactor,bcc,[1,0,0]);
 assert.equal(normal.extinct,true);
 const half=xrdFactorResult(referenceFactor,bcc,[1,0,0],{occupancy:.5});
 near(half.amplitude,f0.Fe*.5);
 const shift=xrdFactorResult(referenceFactor,bcc,[1,0,0],{shift:.25});
 assert.ok(shift.intensity>0);
 assert.equal(shift.structure.sites[1].x,.75);
 assert.equal(JSON.stringify(bcc),original,'source crystal unchanged');
 const vacancy=xrdFactorPerturb(bcc,{occupancy:0});
 assert.equal(vacancy.sites[1].occupancy,0);
 assert.ok(xrdFactorResult(referenceFactor,bcc,[1,1,0]).relative220>0);
});

test('comparison uses identical hkl and per-material 220 reference, never measured data',()=>{
 const rows=xrdFactorCompare(referenceFactor,[2,2,0]);
 assert.deepEqual(rows.map(row=>row.id),['si','fe','nacl']);
 for(const row of rows)near(row.relative220,100);
 assert.throws(()=>xrdFactorStructure('made-up'));
 assert.throws(()=>xrdFactorResult(referenceFactor,xrdFactorStructure('si'),[0,0,0]));
 assert.throws(()=>xrdFactorPerturb(xrdFactorStructure('si'),{occupancy:1.5}));
 assert.throws(()=>xrdFactorPerturb(xrdFactorStructure('fe'),{shift:.5}));
 const open=xrdFactorStructure('active',{name:'X',cell:{a:3},sites:[{symbol:'Si',x:0,y:0,z:0}]});
 assert.equal(open.sites[0].studyGroup,true);
 assert.throws(()=>xrdFactorStructure('active',{}));
});
