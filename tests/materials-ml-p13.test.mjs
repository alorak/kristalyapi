import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditP13Data,makeP13Folds,runP13Validation} from '../materials-ml-p13-core.js';
const source=JSON.parse(readFileSync(new URL('../models/jarvis-polymorph-p12-source.json',import.meta.url),'utf8'));
let cache;
const compute=()=>cache??(cache=runP13Validation(source));
test('P1.3 uses actual pinned JARVIS structures and reports accepted/rejected rows',()=>{
 const a=auditP13Data(source);
 assert.equal(a.quality.sourceOriginal,184);
 assert.equal(a.quality.sourceRecords,a.quality.accepted+a.quality.rejected);
 assert.ok(a.quality.accepted>=90);
 assert.ok(a.quality.multiSGFormulas>=10);
 assert.ok(a.quality.phaseGroups>a.quality.formulas);
});
test('every rotating fold is group-disjoint and same-formula transfer without JID leakage',()=>{
 const rows=auditP13Data(source).corpus.rows;
 const folds=makeP13Folds(rows,4);
 assert.equal(folds.length,4);
 for(const f of folds){
  const s={train:new Set(f.train.map(x=>x.formula+'|'+x.sg)),
   validation:new Set(f.validation.map(x=>x.formula+'|'+x.sg)),
   test:new Set(f.test.map(x=>x.formula+'|'+x.sg))};
  assert.ok([...s.test].every(x=>!s.train.has(x)&&!s.validation.has(x)));
  assert.ok([...s.validation].every(x=>!s.train.has(x)));
  const train=new Set(f.train.map(x=>x.formula));
  assert.ok(f.test.every(x=>train.has(x.formula)));
  assert.ok(f.validation.length>=5&&f.test.length>=5);
 }
});
test('paired ablation, inner-fold tuning, reproducible formula-cluster bootstrap',()=>{
 const a=compute(),b=runP13Validation(source);
 assert.deepEqual(a,b);
 assert.equal(a.schema,'kristalyapi.materials-ml-validation.p13.v1');
 assert.equal(a.folds.length,4);
 for(const target of ['targetGapEV','targetFormationEVPerAtom']){
  const t=a.targets[target];
  assert.ok(Number.isFinite(t.structuralMAE)&&Number.isFinite(t.baselineMAE));
  assert.ok(t.totalFoldObservations>10);
  assert.equal(t.folds.length,4);
  assert.ok(Number.isFinite(t.clusteredBootstrap95.low));
  assert.ok(t.clusteredBootstrap95.low<=t.clusteredBootstrap95.high);
  for(const fold of t.folds)assert.ok(fold.selected.bond>0&&fold.selected.coord>0);
 }
 assert.match(a.limitations,/No expanded corpus/);
});
test('source tampering and invalid folds fail closed',()=>{
 assert.throws(()=>makeP13Folds([],4));
 assert.throws(()=>makeP13Folds([{id:'a',formula:'Si',sg:1}],4));
 assert.throws(()=>runP13Validation({...source,schema:'fake'}));
});
