import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preparePolymorphCorpus,splitPolymorphCorpus,trainPolymorphModel,
 inferPolymorphProperties,polymorphPredict,geometricallyDistinctPolymorphs} from '../materials-ml-p12-core.js';

const source=JSON.parse(readFileSync(new URL('../models/jarvis-polymorph-p12-source.json',import.meta.url),'utf8'));
let corpus=null,split=null,trained=null;
const init=()=>{
 if(!trained){corpus=preparePolymorphCorpus(source);split=splitPolymorphCorpus(corpus.rows);
  trained=trainPolymorphModel(source);}
 return trained;
};

test('real public JARVIS source includes distinct same-formula, multiple-SG crystals',()=>{
 const x=init();
 assert.equal(source.totalOriginal,184);
 assert.equal(source.schema,'kristalyapi.jarvis-polymorph-source.p12.v1');
 assert.match(source.origin,/CC BY 4.0/);
 assert.ok(corpus.rows.length>=90);
 assert.equal(corpus.rows.length+corpus.rejected.length,source.records.length);
 assert.ok(x.counts.test>=10);
 assert.ok(x.counts.validation>=10);
 assert.ok(x.counts.formulas.test>=10);
 const groups=new Map();
 for(const r of corpus.rows){
  if(!groups.has(r.formula))groups.set(r.formula,new Set());
  groups.get(r.formula).add(r.sg);
 }
 assert.ok([...groups.values()].filter(set=>set.size>=2).length>=14);
});

test('polymorph holdout is genuinely independent by formula plus space group',()=>{
 init();
 const identities=rows=>new Set(rows.map(r=>r.id));
 const a=identities(split.train),b=identities(split.validation),c=identities(split.test);
 assert.ok(![...b,...c].some(id=>a.has(id)));
 assert.ok(![...c].some(id=>b.has(id)));
 const phase=rows=>new Set(rows.map(r=>r.formula+'|'+r.sg));
 const tr=phase(split.train),val=phase(split.validation),te=phase(split.test);
 assert.ok(![...val,...te].some(g=>tr.has(g)));
 assert.ok(![...val].some(g=>te.has(g)));
 const distinct=geometricallyDistinctPolymorphs(split.test,[...split.train,...split.validation]);
 for(const x of distinct){
  assert.ok(![...split.train,...split.validation].some(y=>y.formula===x.formula&&
    Math.abs(Math.log(x.vpa/y.vpa))<0.02&&
    Math.abs(Math.log(x.bond/y.bond))<0.02&&
    Math.abs(x.coord-y.coord)<0.3));
 }
 assert.ok(distinct.length<=split.test.length);
 for(const x of split.test){
  assert.ok(split.train.some(y=>y.formula===x.formula&&y.sg!==x.sg),
   x.id+' must have training crystal(s) of different space group');
 }
});

test('supervised regression includes bond and coordination descriptors with nonzero trained weights',()=>{
 const model=init();
 for(const target of ['targetGapEV','targetFormationEVPerAtom']){
  const v=model.weights[target];
  assert.ok(v.selected.bond>0&&v.selected.coord>0);
  assert.ok(v.heldout.count>=10);
  assert.ok(Number.isFinite(v.validation.mae)&&Number.isFinite(v.heldout.mae)&&Number.isFinite(v.baseline.mae));
  assert.ok(Number.isFinite(v.heldout.phaseMacroMae));
  const x=model.training[0],q=polymorphPredict(model.training,x,target,v.selected);
  const alter={...x,bond:x.bond*1.35,coord:x.coord+5};
  const diff=polymorphPredict(model.training,alter,target,v.selected);
  assert.notEqual(diff.neighbours[0].distance,q.neighbours[0].distance);
  assert.notEqual(diff.estimate,q.estimate);
 }
});

test('JARVIS model remains distinct from P0 Matbench and P1 ZEBRA targets',()=>{
 const model=init(),sample=source.records[0];
 const structure={name:sample[1],nonPeriodic:false,cell:sample[5],
  sites:sample[6].map(([symbol,x,y,z])=>({symbol,x,y,z}))};
 const p=inferPolymorphProperties(model,structure);
 assert.equal(p.modelId,'jarvis-p12-composition-bond-coordination-knn');
 assert.ok(Number.isFinite(p.features.meanClosestBondA));
 assert.ok(Number.isFinite(p.features.meanCoordination));
 assert.ok(['prediction','out-of-domain'].includes(p.targets.gap.status));
 assert.equal(model.source.archiveSha256,source.archiveSha256);
 assert.ok(p.trainingCount>50);
});

test('report reproducible phase-group holdout and ablation summary',t=>{
 const m=init();
 const summary={counts:m.counts,
  gap:{parameters:m.weights.targetGapEV.selected,
   holdout:m.weights.targetGapEV.heldout.mae,
   baseline:m.weights.targetGapEV.baseline.mae,
   phaseGroupMAE:m.weights.targetGapEV.heldout.phaseMacroMae,
   distinctCount:m.weights.targetGapEV.distinctGeometryHoldout?.count,
   distinctMae:m.weights.targetGapEV.distinctGeometryHoldout?.mae,
   distinctBaseline:m.weights.targetGapEV.distinctGeometryBaseline?.mae,
   n:m.weights.targetGapEV.heldout.count},
  formation:{parameters:m.weights.targetFormationEVPerAtom.selected,
   holdout:m.weights.targetFormationEVPerAtom.heldout.mae,
   baseline:m.weights.targetFormationEVPerAtom.baseline.mae,
   phaseGroupMAE:m.weights.targetFormationEVPerAtom.heldout.phaseMacroMae,
   distinctCount:m.weights.targetFormationEVPerAtom.distinctGeometryHoldout?.count,
   distinctMae:m.weights.targetFormationEVPerAtom.distinctGeometryHoldout?.mae,
   distinctBaseline:m.weights.targetFormationEVPerAtom.distinctGeometryBaseline?.mae,
   n:m.weights.targetFormationEVPerAtom.heldout.count}};
 console.log('P12_POLYMORPH_METRICS_JSON='+JSON.stringify(summary));
 assert.equal(summary.gap.n,summary.formation.n);
 assert.equal(summary.gap.n,summary.counts.test);
});

test('source poison and duplicate JARVIS rows fail closed',()=>{
 assert.throws(()=>preparePolymorphCorpus({...source,schema:'fake'}),/sürümü/);
 assert.throws(()=>preparePolymorphCorpus({...source,records:[source.records[0],...source.records]}),/Yinelenen/);
});
