import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findSettingTransform,settingTransformValid,transformOperation,transformStructure,describeSettingTransform,
 asymmetricUnit,cellBasis,det3,inv3} from '../setting-transform.js';
import {symmetryOperations} from '../geometry-table.js';

const app=fs.readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
const SG=JSON.parse(app.match(/^const SPACE_GROUPS=(\{.*\});$/m)[1]);
const pairs=key=>{const [c,o]=SG[key];return o.flatMap(op=>c.map(t=>[op,t]));};
const groups={};for(const key of Object.keys(SG)){const n=key.split('-')[0];(groups[n]=groups[n]||[]).push(key);}
const twoSettings=Object.values(groups).filter(keys=>keys.length===2);
const wrap=v=>v-Math.floor(v);
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);
function expand(sites,key){
 const out=[];
 for(const s of sites)for(const op of symmetryOperations(pairs(key))){
  const f=op.R.map((r,i)=>wrap(r[0]*s.x+r[1]*s.y+r[2]*s.z+op.t[i]+1e-12));
  if(!out.some(o=>o.symbol===s.symbol&&f.every((v,i)=>{const d=Math.abs(v-o.f[i]);return d<1e-6||d>1-1e-6;})))out.push({symbol:s.symbol,f});
 }
 return out;
}
const cellFor=key=>{
 const n=Number(key.split('-')[0]);
 if(key.endsWith('rhombohedral'))return {a:5.2,b:5.2,c:5.2,alpha:55,beta:55,gamma:55};
 if(n>=143&&n<=194)return {a:4.9,b:4.9,c:13.1,alpha:90,beta:90,gamma:120};
 if(n>=195)return {a:7.1,b:7.1,c:7.1,alpha:90,beta:90,gamma:90};
 if(n>=75)return {a:6.3,b:6.3,c:9.7,alpha:90,beta:90,gamma:90};
 if(n>=16)return {a:5.1,b:6.7,c:8.9,alpha:90,beta:90,gamma:90};
 return key.endsWith('-c')?{a:5.1,b:6.7,c:8.9,alpha:90,beta:90,gamma:104.5}:{a:5.1,b:6.7,c:8.9,alpha:90,beta:104.5,gamma:90};
};

test('every two-setting group has a verified transformation in both directions',()=>{
 assert.equal(twoSettings.length,44);
 for(const [a,b] of twoSettings)for(const [from,to] of [[a,b],[b,a]]){
  const t=findSettingTransform(pairs(from),pairs(to));
  assert.ok(t,from+' → '+to);
  assert.ok(settingTransformValid(symmetryOperations(pairs(from)),symmetryOperations(pairs(to)),t.P,t.p));
  // Inverse check: the returned matrix is not singular and keeps handedness.
  assert.ok(det3(t.P)>0);
 }
 // A wrong shift or matrix is rejected.
 const fd1=symmetryOperations(pairs('227-1')),fd2=symmetryOperations(pairs('227-2'));
 assert.equal(settingTransformValid(fd1,fd2,[[1,0,0],[0,1,0],[0,0,1]],[0,0,0]),false);
 assert.equal(settingTransformValid(fd1,fd2,[[1,0,0],[0,1,0],[0,0,1]],[1/8,1/8,1/8]),true);
 assert.equal(findSettingTransform(pairs('2'),pairs('227-1')),null,'different groups never match');
});

test('ITA examples: origin choices, unique axis and obverse rhombohedral axes',()=>{
 assert.equal(describeSettingTransform(findSettingTransform(pairs('227-1'),pairs('227-2'))),"a' = a, b' = b, c' = c · yeni orijin (1/8, 1/8, 1/8)");
 assert.equal(describeSettingTransform(findSettingTransform(pairs('14-b'),pairs('14-c'))),"a' = c, b' = a, c' = b");
 const rh=findSettingTransform(pairs('166-hexagonal'),pairs('166-rhombohedral'));
 close(rh.det,1/3,1e-12);
 // ITA: a_rh = (2a+b+c)/3 in the obverse setting.
 assert.deepEqual(rh.P.map(row=>row[0]),[2/3,1/3,1/3]);
 const back=findSettingTransform(pairs('166-rhombohedral'),pairs('166-hexagonal'));
 close(back.det,3,1e-12);
 const product=rh.P.map((row,i)=>[0,1,2].map(j=>row.reduce((s,v,k)=>s+v*back.P[k][j],0)));
 product.forEach((row,i)=>row.forEach((v,j)=>close(v,i===j?1:0,1e-12)));
});

test('transformed structures are the same crystal: positions, counts and volume',()=>{
 const site={symbol:'Fe',label:'Fe1',x:.1234,y:.2871,z:.4119,occupancy:1};
 for(const [a,b] of twoSettings)for(const [from,to] of [[a,b],[b,a]]){
  const t=findSettingTransform(pairs(from),pairs(to)),cell=cellFor(from);
  const moved=transformStructure(cell,[site],t);
  const before=expand([site],from),after=expand(moved.sites,to);
  assert.equal(after.length,Math.round(before.length*t.det),from+' → '+to+' atom count');
  // Each new atom, mapped back with x = P x' + p, is an old atom (mod lattice).
  for(const atom of after){
   const x=[0,1,2].map(i=>wrap(t.P[i].reduce((s,v,j)=>s+v*atom.f[j],0)+t.p[i]+1e-12));
   assert.ok(before.some(o=>x.every((v,i)=>{const d=Math.abs(v-o.f[i]);return d<1e-6||d>1-1e-6;})),from+' → '+to);
  }
  const volume=c=>Math.abs(det3(cellBasis(c)));
  close(volume(moved.cell),volume(cell)*t.det,1e-6);
 }
});

test('ADP tensors and magnetic moments keep their Cartesian meaning',()=>{
 const cell={a:5.1,b:6.7,c:8.9,alpha:90,beta:104.5,gamma:90};
 const t=findSettingTransform(pairs('14-b'),pairs('14-c'));
 const site={symbol:'Fe',label:'Fe1',x:.1,y:.2,z:.3,adp:[.012,.018,.025,.002,-.004,.003],magneticMoment:[1,2,-.5],
  coordSu:{x:.0001,y:.0002,z:.0003,ref:[.1,.2,.3]}};
 const moved=transformStructure(cell,[site],t),next=moved.sites[0];
 // U_cart = E U Eᵀ with E columns a_i·|a*_i|: compare in the respective standard frames.
 const ucart=(c,u)=>{const A=cellBasis(c),Ai=inv3(A.map((_,i)=>A.map(r=>r[i])));const cols=[0,1,2].map(i=>A[i].map(v=>v*Math.hypot(...Ai[i])));
  const E=[0,1,2].map(k=>cols.map(col=>col[k])),U=[[u[0],u[5],u[4]],[u[5],u[1],u[3]],[u[4],u[3],u[2]]];
  const mul=(x,y)=>x.map(r=>y[0].map((_,j)=>r.reduce((s,v,k)=>s+v*y[k][j],0)));return mul(mul(E,U),E.map((_,i)=>E.map(r=>r[i])));};
 const U0=ucart(cell,site.adp),U1=ucart(moved.cell,next.adp),R=moved.rotation;
 const rotated=R.map(r=>[0,1,2].map(j=>r.reduce((s,v,k)=>s+v*U0[k].reduce((q,w,m)=>q+w*R[j][m],0),0)));
 rotated.forEach((row,i)=>row.forEach((v,j)=>close(v,U1[i][j],1e-9)));
 close(Math.hypot(...next.magneticMoment),Math.hypot(...site.magneticMoment),1e-9);
 // The rotation is proper and orthogonal.
 close(det3(R),1,1e-9);
 // a' = c: the new x s.u. is the old z s.u.
 assert.deepEqual([next.coordSu.x,next.coordSu.y,next.coordSu.z],[.0003,.0001,.0002]);
 const rh=transformStructure({a:4.9,b:4.9,c:13.1,alpha:90,beta:90,gamma:120},[site],findSettingTransform(pairs('166-hexagonal'),pairs('166-rhombohedral')));
 assert.equal(rh.sites[0].coordSu,undefined);assert.match(rh.notes[0],/s\.u\./);
});

test('asymmetric unit: diamond in Fd-3m and refusal of a structure without that symmetry',()=>{
 const cell={a:5.431,b:5.431,c:5.431,alpha:90,beta:90,gamma:90};
 const p1=expand([{symbol:'Si',x:0,y:0,z:0}],'227-1').map((a,i)=>({symbol:'Si',label:'Si'+(i+1),x:a.f[0],y:a.f[1],z:a.f[2],occupancy:1}));
 assert.equal(p1.length,8);
 const reduced=asymmetricUnit(cell,p1,pairs('227-1'));
 assert.equal(reduced.sites.length,1);assert.deepEqual(reduced.multiplicities,[8]);assert.equal(reduced.operations,192);
 // Small displacements within the tolerance are accepted; atoms are not idealised.
 const jittered=p1.map((s,i)=>({...s,x:s.x+(i%2?.0005:-.0005)}));
 assert.equal(asymmetricUnit(cell,jittered,pairs('227-1'),{tolerance:.01}).sites.length,1);
 close(asymmetricUnit(cell,jittered,pairs('227-1'),{tolerance:.01}).sites[0].x,wrap(jittered[0].x),1e-12);
 assert.throws(()=>asymmetricUnit(cell,p1.slice(1),pairs('227-1')),/görüntüsü yapıda yok/);
 assert.throws(()=>asymmetricUnit(cell,p1.map((s,i)=>i?s:{...s,symbol:'Ge'}),pairs('227-1')),/görüntüsü yapıda yok/);
 assert.equal(asymmetricUnit(cell,p1,pairs('1')).sites.length,8,'P1 keeps every atom');
});
