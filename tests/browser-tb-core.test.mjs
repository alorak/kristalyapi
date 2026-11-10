import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPHENE_DEMO,grapheneGeometry,grapheneEigenvalues,grapheneBands,grapheneDos} from '../browser-tb-core.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol, a+' != '+b);

test('graphene primitive demo has exactly three equivalent 1.42 Å nearest-neighbour bonds',()=>{
 const g=grapheneGeometry(GRAPHENE_DEMO);
 assert.equal(g.bonds.length,3);
 close(g.bondLength,1.4202816622064798,1e-6);
 for(const b of g.bonds)assert.equal(b.length,2);
});
test('nearest-neighbour pz Hamiltonian has symmetric ±3t gamma bands and a zero-energy Dirac point',()=>{
 const g=grapheneGeometry(GRAPHENE_DEMO);
 const gamma=grapheneEigenvalues(g,[0,0],2.7);
 close(gamma[0],-8.1);close(gamma[1],8.1);
 const bands=grapheneBands(g,{hopping:2.7,steps:30});
 assert.deepEqual(bands.marks.map(x=>x.label),['Γ','M','K','Γ']);
 close(bands.diracGap,0,1e-10);
 const m=grapheneEigenvalues(g,[0.5,0.5],2.7);
 close(Math.abs(m[0]),2.7,1e-10);
 assert.equal(bands.points.length,91);
 assert.ok(bands.points.every((p,i)=>i===0||p.distance>=bands.points[i-1].distance));
});
test('tight-binding DOS integrated over energy carries two spinless pi states per primitive cell',()=>{
 const dos=grapheneDos(grapheneGeometry(GRAPHENE_DEMO),{hopping:2.7,mesh:32,sigma:0.15,bins:201});
 const integral=dos.points.slice(1).reduce((s,p,i)=>s+
   (p.energy-dos.points[i].energy)*(p.density+dos.points[i].density)*0.5,0);
 close(integral,2,0.015);
 assert.ok(dos.points.every(p=>p.density>=0&&Number.isFinite(p.density)));
 assert.ok(dos.points.every((p,i)=>Math.abs(p.density-dos.points[dos.points.length-1-i].density)<1e-8));
});
test('reject unsupported materials, structural strain and non-finite input instead of assigning graphene bands',()=>{
 const different=structuredClone(GRAPHENE_DEMO);different.atoms[1].element='N';
 assert.throws(()=>grapheneGeometry(different),/yalnız iki karbonlu grafen/);
 const distorted=structuredClone(GRAPHENE_DEMO);distorted.atoms[1].fractional=[0.18,0.18,0.5];
 assert.throws(()=>grapheneGeometry(distorted),/grafenin üç eşdeğer/);
 const large=structuredClone(GRAPHENE_DEMO);large.cell[0][0]=3.4;
 assert.throws(()=>grapheneGeometry(large),/yaklaşık 2.46/);
 assert.throws(()=>grapheneEigenvalues(grapheneGeometry(GRAPHENE_DEMO),[NaN,0]),/sonlu/);
 assert.throws(()=>grapheneDos(grapheneGeometry(GRAPHENE_DEMO),{mesh:10000}),/aralık dışında/);
});
