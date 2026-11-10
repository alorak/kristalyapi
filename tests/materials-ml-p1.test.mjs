import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCompositionFormula} from '../materials-ml-core.js';
import {cellVolumeA3,structureDescriptorsP1,prepareStructuralModel,predictStructuralProperties}
 from '../materials-ml-p1-core.js';

const source=JSON.parse(readFileSync(new URL('../models/zebra-structural-p1.json',import.meta.url),'utf8'));
const model=prepareStructuralModel(source);
const fe=a=>({symbol:'Fe',x:a[0],y:a[1],z:a[2]});
const single={name:'periodic Fe cubic',nonPeriodic:false,cell:{a:2.8,b:2.8,c:2.8,alpha:90,beta:90,gamma:90},
 sites:[fe([0,0,0])]};

test('P1 volume and periodic neighbor geometry are numerical, not a CIF label lookup',()=>{
 const triclinic=cellVolumeA3({a:3,b:3,c:5,alpha:90,beta:90,gamma:120});
 assert.ok(Math.abs(triclinic-45*Math.sqrt(3)/2)<1e-7);
 const d=structureDescriptorsP1(single);
 assert.ok(Math.abs(d.volumePerAtomA3-2.8**3)<1e-9);
 assert.ok(Math.abs(d.nearestBondA-2.8)<1e-8);
 assert.ok(Math.abs(d.meanClosestBondA-2.8)<1e-8);
 assert.equal(d.meanCoordination,6);
 assert.ok(d.densityGcm3>0&&d.densityGcm3<10);
});

test('P1 volume/atom and neighbors are invariant under equivalent 2x2x2 cell expansion',()=>{
 const expanded={...single,cell:{a:5.6,b:5.6,c:5.6,alpha:90,beta:90,gamma:90},
  sites:[0,.5].flatMap(x=>[0,.5].flatMap(y=>[0,.5].map(z=>fe([x,y,z]))))};
 const a=structureDescriptorsP1(single),b=structureDescriptorsP1(expanded);
 assert.ok(Math.abs(a.volumePerAtomA3-b.volumePerAtomA3)<1e-7);
 assert.ok(Math.abs(a.meanClosestBondA-b.meanClosestBondA)<1e-7);
 assert.ok(Math.abs(a.meanCoordination-b.meanCoordination)<1e-7);
 assert.deepEqual(a.fractions,b.fractions);
});

test('P1 rejects nonperiodic, partial occupancy, duplicate and invalid cells',()=>{
 assert.throws(()=>structureDescriptorsP1({...single,nonPeriodic:true}),/periyodik/);
 assert.throws(()=>structureDescriptorsP1({...single,sites:[{...single.sites[0],occupancy:0.5}]}),/doluluklu/);
 assert.throws(()=>cellVolumeA3({...single.cell,gamma:180}),/geçersiz/);
 assert.throws(()=>cellVolumeA3({...single.cell,alpha:15,beta:15,gamma:160}),/dejenere/);
 assert.throws(()=>structureDescriptorsP1({...single,sites:Array.from({length:129},()=>single.sites[0])}),/128/);
});

test('P1 model and held-out metrics separate hybrid direct-gap from experimental P0',()=>{
 assert.equal(model.modelId,'zebra-structure-vpa-knn-p1');
 assert.equal(source.rows.length,1759);
 assert.equal(source.meta.test,443);
 assert.equal(source.meta.gap.maeEV,0.843475);
 assert.equal(source.meta.formation.maeEV,0.179675);
 assert.equal(source.meta.acceptance.acceptedCount,425);
 assert.ok(source.meta.gap.chosenWeight>0);
});

test('P1 predictions respond to volume/atom; local neighbor metrics are audit-only',()=>{
 const row=model.rows[0];
 const common={fractions:parseCompositionFormula(row.formula),volumePerAtomA3:row.vpa,
  nearestBondA:1.9,meanCoordination:4};
 const exact=predictStructuralProperties(model,common);
 assert.equal(exact.status,'training-reference');
 assert.equal(exact.hybridDirectGapEV,row.gap);
 assert.equal(exact.formationEnergyEVPerAtom,row.formation);
 const expanded=predictStructuralProperties(model,{...common,volumePerAtomA3:row.vpa*1.15});
 assert.notEqual(expanded.status,'out-of-domain');
 assert.notEqual(expanded.neighbors[0].distance,exact.neighbors[0].distance);
 assert.notEqual(expanded.hybridDirectGapEV,exact.hybridDirectGapEV,
  'same composition but different volume per atom must change the P1 estimate');
 const onlyNeighbors=predictStructuralProperties(model,{...common,nearestBondA:2.2,meanCoordination:8});
 assert.equal(onlyNeighbors.hybridDirectGapEV,exact.hybridDirectGapEV,
  'P1 does not claim to have trained on local neighbor features');
});

test('P1 rejects missing or adulterated training table',()=>{
 assert.throws(()=>prepareStructuralModel({...source,schema:'wrong'}),/geçersiz/);
 assert.throws(()=>prepareStructuralModel({...source,rows:source.rows.slice(1)}),/geçersiz/);
 assert.throws(()=>prepareStructuralModel({...source,rows:[source.rows[0],source.rows[0],...source.rows.slice(2)]}),/yinelenen/);
});
