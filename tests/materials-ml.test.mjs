import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCompositionFormula,compositionFromStructure,squaredCompositionDistance,
 prepareGapModel,predictExperimentalGap,MAX_SQUARED_DISTANCE} from '../materials-ml-core.js';

const modelSource=JSON.parse(readFileSync(new URL('../models/matbench-expt-gap-knn-p0.json',import.meta.url),'utf8'));
const model=prepareGapModel(modelSource);
const asMap=xs=>Object.fromEntries(xs);

test('P0 formula parser handles nested groups and fractional stoichiometry',()=>{
 const a=asMap(parseCompositionFormula('Ag(W3Br7)2'));
 assert.ok(Math.abs(a.Ag-1/21)<1e-9);
 assert.ok(Math.abs(a.W-6/21)<1e-9);
 assert.ok(Math.abs(a.Br-14/21)<1e-9);
 const b=asMap(parseCompositionFormula('Al2(SO4)3'));
 assert.equal(b.O,12/17);assert.equal(b.Al,2/17);
 for(const bad of ['','SiO2;console.log(1)','Xx2','Si(OH','2Si','Si0'])
  assert.throws(()=>parseCompositionFormula(bad),undefined,bad);
});

test('CIF P1 composition ignores visualization, rejects partial occupancy and nonperiodicity',()=>{
 const structure={nonPeriodic:false,sites:[{symbol:'Si',x:0,y:0,z:0},{symbol:'Si',x:.25,y:.25,z:.25}]};
 const before=JSON.stringify(structure);
 assert.deepEqual(compositionFromStructure(structure),[['Si',1]]);
 assert.equal(JSON.stringify(structure),before);
 assert.throws(()=>compositionFromStructure({...structure,nonPeriodic:true}),/periyodik/);
 assert.throws(()=>compositionFromStructure({...structure,sites:[{...structure.sites[0],occupancy:.5}]}),/doluluklu/);
 assert.throws(()=>compositionFromStructure({...structure,sites:[{...structure.sites[0],x:NaN}]}),/koordinatları/);
});

test('model has versioned provenance, fixed sample count and finite outputs',()=>{
 assert.equal(model.modelId,'matbench-expt-gap-composition-knn-p0');
 assert.equal(model.rows.length,3696);
 assert.equal(model.validation.samples,905);
 assert.ok(model.validation.maeEV>0&&model.validation.maeEV<1);
 assert.equal(squaredCompositionDistance([['Si',1]],[['Si',1]]),0);
 const silicon=predictExperimentalGap(model,parseCompositionFormula('Si'));
 assert.equal(silicon.status,'prediction');
 assert.ok(silicon.gapEV>0.5&&silicon.gapEV<2);
 const znO=predictExperimentalGap(model,parseCompositionFormula('ZnO'));
 assert.equal(znO.status,'prediction');
 assert.ok(Number.isFinite(znO.gapEV));
 const gan=predictExperimentalGap(model,parseCompositionFormula('GaN'));
 assert.equal(gan.status,'out-of-domain');
 assert.equal(gan.gapEV,null);
 assert.ok(gan.nearest[0].distanceSquared>MAX_SQUARED_DISTANCE);
 const exact=predictExperimentalGap(model,parseCompositionFormula('NiN'));
 assert.equal(exact.status,'training-reference');
 assert.equal(exact.gapEV,0);
});

test('bad model schemas and duplicate chemistry fail closed',()=>{
 assert.throws(()=>prepareGapModel({...modelSource,schema:'unknown'}),/şeması/);
 assert.throws(()=>prepareGapModel({...modelSource,rows:[[1,2],...modelSource.rows.slice(1)]}),/satırı/);
 assert.throws(()=>prepareGapModel({...modelSource,rows:[modelSource.rows[0],modelSource.rows[0],...modelSource.rows.slice(2)]}),/Yinelenen/);
});
