import test from 'node:test';
import assert from 'node:assert/strict';
import {materialCard,materialComparison,materialComparisonCsv} from '../material-cards-core.js';

const base={name:'GaN, trial',workspace:'A',symmetry:'P 6_3 m c',nonPeriodic:false,
 cell:{a:3,b:3,c:5,alpha:90,beta:90,gamma:120},
 sites:[{symbol:'Ga',x:0,y:0,z:0},{symbol:'N',x:1/3,y:2/3,z:.5}]};
test('material card derives composition, triclinic metric volume and provenance without mutating input',()=>{
 const before=JSON.stringify(base);
 const c=materialCard(base,{sourceLabel:'Work A',sourceReference:'COD 12345',capturedAt:'2026-11-01T00:00:00Z'});
 assert.equal(c.formula,'GaN');assert.equal(c.siteCount,2);
 assert.ok(Math.abs(c.volumeA3-(3*3*5*Math.sqrt(3)/2))<1e-5);
 assert.equal(c.source.kind,'workspace-snapshot');
 assert.equal(c.source.reference,'COD 12345');assert.equal(c.schema,'kristalyapi.material-card.v1');
 assert.equal(JSON.stringify(base),before);
});
test('comparison preserves units and percent change without asserting same structure',()=>{
 const a=materialCard(base);
 const b=materialCard({...base,name:'Different cell',cell:{...base.cell,a:3.3}});
 const rows=materialComparison([a,b]);
 assert.equal(rows.find(r=>r.key==='a').deltas[1],10);
 assert.equal(rows.find(r=>r.key==='volumeA3').unit,'Å³');
 assert.equal(rows.find(r=>r.key==='formula').deltas[1],null);
 assert.match(materialComparisonCsv([a,b]),/Structure 1:/);
 assert.match(materialComparisonCsv([a,b]),/Source reference/);
});
test('partial occupancy is counted, not rounded to fictitious integral formula',()=>{
 const c=materialCard({...base,sites:[...base.sites,{symbol:'N',x:.1,y:.1,z:.1,occupancy:.5}]});
 assert.equal(c.composition.N,1.5);assert.equal(c.formula,'GaN1.5');assert.equal(c.partialOccupancy,true);
});
test('invalid cells, sites, and impossible comparison sizes fail closed',()=>{
 assert.throws(()=>materialCard({...base,nonPeriodic:true}));
 assert.throws(()=>materialCard({...base,cell:{...base.cell,gamma:180}}));
 assert.throws(()=>materialCard({...base,cell:{...base.cell,alpha:20,beta:20,gamma:150}}));
 assert.throws(()=>materialCard({...base,sites:[{symbol:'Ga',x:NaN,y:0,z:0}]}));
 assert.throws(()=>materialCard({...base,sites:[{symbol:'Ga',x:0,y:0,z:0,occupancy:1.2}]}));
 assert.throws(()=>materialComparison(Array(5).fill(materialCard(base))));
});
