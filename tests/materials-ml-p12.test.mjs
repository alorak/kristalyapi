import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCompositionFormula} from '../materials-ml-core.js';
import {structureDescriptorsP1} from '../materials-ml-p1-core.js';
import {prepareP12Model,predictP12,rankP12,polymorphPairwise} from '../materials-ml-p12-core.js';

const read=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const source=read('../models/p12/learned-knn.json');
const model=prepareP12Model(source);
const cohort=Array.from({length:11},(_,i)=>read('../models/p12/cohort-'+i+'.json').rows).flat();
const external=read('../models/p12/tio2-polymorphs.json').rows;
const keys=['a','b','c','alpha','beta','gamma'];
const structure=(cell,sites)=>({nonPeriodic:false,cell:Object.fromEntries(keys.map((k,i)=>[k,cell[i]])),
 sites:sites.map(([symbol,x,y,z])=>({symbol,x,y,z}))});
const dataOf=row=>structure(row[4],row[5]);
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function signature(formula){return parseCompositionFormula(formula).map(([k,v])=>k+':'+v.toFixed(5)).join(';');}
function fold(r){return hash(signature(r[1]))%10;}
const allFeatures=cohort.map(r=>({id:r[0],formula:r[1],gap:r[2],formation:r[3],
 features:structureDescriptorsP1(dataOf(r)),fold:fold(r)}));
const testRows=allFeatures.filter(x=>x.fold>=8);

test('P1.2 uses 170 real CIFs with formula-grouped deterministic train, validation and test',()=>{
 assert.equal(cohort.length,170);
 assert.equal(new Set(cohort.map(x=>x[0])).size,170);
 assert.equal(allFeatures.filter(x=>x.fold<7).length,118);
 assert.equal(allFeatures.filter(x=>x.fold===7).length,15);
 assert.equal(testRows.length,37);
 assert.equal(model.rows.length,133);
 assert.equal(model.metrics.test,37);
 assert.equal(allFeatures.filter(x=>x.formula==='TiO2').length,0);
 const trainedSignatures=new Set(allFeatures.filter(x=>x.fold<8).map(x=>signature(x.formula)));
 assert.ok(testRows.every(x=>!trainedSignatures.has(signature(x.formula))));
});

test('supervised bond and coordination reference features reproduce periodic CIF geometry',()=>{
 const training=new Map(model.rows.map(r=>[r.id,r]));
 for(const record of allFeatures){
  const row=training.get(record.id);
  if(!row)continue;
  assert.ok(Math.abs(record.features.volumePerAtomA3-row.vpa)<1e-5,record.id+' vpa');
  assert.ok(Math.abs(record.features.meanClosestBondA-row.bond)<1e-5,record.id+' bond');
  assert.ok(Math.abs(record.features.meanCoordination-row.coord)<1e-5,record.id+' coordination');
 }
 assert.ok(model.metrics.gap.weights.every(w=>w>0));
 assert.ok(model.metrics.formation.weights.every(w=>w>0));
});

test('held-out 37 ZEBRA structures reproduce P1.2 versus same-cohort volume-only ablation',()=>{
 for(const target of ['gap','formation']){
  const metric=model.metrics[target];
  let base=0,trained=0;
  for(const record of testRows){
   const y=record[target];
   base+=Math.abs(rankP12(model,record.features,target,{ablation:true}).rawValue-y);
   trained+=Math.abs(rankP12(model,record.features,target).rawValue-y);
  }
  base/=testRows.length;trained/=testRows.length;
  assert.ok(Math.abs(base-metric.testBaselineMae)<2e-5,target+' baseline '+base);
  assert.ok(Math.abs(trained-metric.testP12Mae)<2e-5,target+' P1.2 '+trained);
 }
});

test('changing bond and coordination affects learned inference without changing composition or volume',()=>{
 const r=model.rows[0];
 const features={fractions:parseCompositionFormula(r.formula),volumePerAtomA3:r.vpa,
  meanClosestBondA:r.bond*1.13,meanCoordination:r.coord+1};
 const adjusted=predictP12(model,features);
 const original=predictP12(model,{...features,meanClosestBondA:r.bond,meanCoordination:r.coord});
 assert.notEqual(adjusted.hybridDirectGapEV,original.hybridDirectGapEV);
 assert.notEqual(adjusted.formationEnergyEVPerAtom,original.formationEnergyEVPerAtom);
 const base1=rankP12(model,features,'gap',{ablation:true});
 const base2=rankP12(model,{...features,meanClosestBondA:r.bond,meanCoordination:r.coord},'gap',{ablation:true});
 assert.equal(base1.rawValue,base2.rawValue,'ablation should ignore bond/coordination');
});

test('eight truly external TiO2 polymorphs reproduce both pairwise metrics, INCLUDING failed improvement',()=>{
 assert.equal(external.length,8);
 const trainedIds=new Set(model.rows.map(x=>x.id));
 const records=external.map(row=>{
  assert.equal(row[0].startsWith('mp-'),true);
  assert.equal(trainedIds.has(row[0]),false);
  const features=structureDescriptorsP1(structure(row[3],row[4]));
  return {id:row[0],truth:row[2],
   baseline:rankP12(model,features,'formation',{ablation:true}).rawValue,
   learned:rankP12(model,features,'formation').rawValue};
 });
 const old=polymorphPairwise(records.map(r=>({truth:r.truth,prediction:r.baseline})));
 const trained=polymorphPairwise(records.map(r=>({truth:r.truth,prediction:r.learned})));
 assert.equal(old.pairs,28);assert.equal(trained.pairs,28);
 assert.ok(Math.abs(old.pairwiseMae-model.metrics.externalPolymorph.old.pairwiseMae)<2e-5);
 assert.ok(Math.abs(trained.pairwiseMae-model.metrics.externalPolymorph.new.pairwiseMae)<2e-5);
 assert.ok(trained.pairwiseMae>old.pairwiseMae,'outside source: no improvement may be claimed');
 assert.ok(trained.rankAgreement<=old.rankAgreement,'ranking performance did not improve');
});

test('P1.2 rejects malformed schemas, injected duplicates, incomplete geometry and invalid controls',()=>{
 assert.throws(()=>prepareP12Model({...source,schema:'invalid'}),/şeması/);
 assert.throws(()=>prepareP12Model({...source,rows:source.rows.slice(1)}),/şeması/);
 assert.throws(()=>prepareP12Model({...source,rows:[source.rows[0],source.rows[0],...source.rows.slice(2)]}),/yinelenen/);
 assert.throws(()=>rankP12(model,{fractions:[],volumePerAtomA3:1,meanClosestBondA:0,
  meanCoordination:1},'gap'),/girdi/);
});
