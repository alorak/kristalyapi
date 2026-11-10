#!/usr/bin/env node
/* Deterministic, offline P1.2 retraining from frozen source CIF cohorts.
 * Defaults to verification; --write rewrites only the learned model (never fetched online).
 * External TiO2 labels are evaluated only AFTER hyperparameters are selected. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseCompositionFormula,squaredCompositionDistance} from '../materials-ml-core.js';
import {structureDescriptorsP1} from '../materials-ml-p1-core.js';
import {prepareP12Model,rankP12,polymorphPairwise} from '../materials-ml-p12-core.js';

const url=(s)=>new URL('../models/p12/'+s,import.meta.url);
const read=name=>JSON.parse(readFileSync(url(name),'utf8'));
const source=read('learned-knn.json');
const cohorts=Array.from({length:11},(_,i)=>read('cohort-'+i+'.json').rows).flat();
const keys=['a','b','c','alpha','beta','gamma'];
const structure=(cell,sites)=>({nonPeriodic:false,cell:Object.fromEntries(keys.map((k,i)=>[k,cell[i]])),
 sites:sites.map(([symbol,x,y,z])=>({symbol,x,y,z}))});
function fnv(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
const signature=f=>f.map(([k,v])=>k+':'+v.toFixed(5)).join(';');
const records=cohorts.map(([id,formula,gap,formation,cell,sites])=>{
 const f=structureDescriptorsP1(structure(cell,sites)),fractions=parseCompositionFormula(formula);
 return {id,formula,gap,formation,fractions,fold:fnv(signature(fractions))%10,
  vpa:Number(f.volumePerAtomA3.toFixed(7)),
  bond:Number(f.meanClosestBondA.toFixed(7)),
  coord:Number(f.meanCoordination.toFixed(7))};
});
const split={train:records.filter(x=>x.fold<7),val:records.filter(x=>x.fold===7),
 test:records.filter(x=>x.fold>=8),full:records.filter(x=>x.fold<8)};
if(records.length!==170||split.train.length!==118||split.val.length!==15||split.test.length!==37)
 throw Error('Source CIF cohort or split changed unexpectedly.');
function predict(row,sourceRows,target,weights){
 const best=[];
 for(const ref of sourceRows){
  const d=squaredCompositionDistance(row.fractions,ref.fractions)+
   .03*Math.log(row.vpa/ref.vpa)**2+
   weights[0]*Math.log(row.bond/ref.bond)**2+
   weights[1]*((row.coord-ref.coord)/6)**2;
  let i=0;while(i<best.length&&best[i].distance<d)i++;
  if(i<7)best.splice(i,0,{distance:d,ref});
  if(best.length>7)best.pop();
 }
 let num=0,den=0;for(const item of best){let w=1/(item.distance+.01)**2;
  num+=w*item.ref[target];den+=w;}
 return num/den;
}
const mae=(data,ref,target,weights)=>data.reduce((sum,r)=>
 sum+Math.abs(predict(r,ref,target,weights)-r[target]),0)/data.length;
const grid=[.005,.02,.08,.25].flatMap(a=>[.005,.02,.08,.25].map(b=>[a,b]));
const summary={};
for(const target of ['gap','formation']){
 const sorted=grid.map(weights=>({weights,mae:mae(split.val,split.train,target,weights)}))
  .sort((a,b)=>a.mae-b.mae);
 const choice=sorted[0].weights;
 summary[target]={weights:choice,
  validationBaselineMae:mae(split.val,split.train,target,[0,0]),
  validationBestMae:sorted[0].mae,
  testBaselineMae:mae(split.test,split.full,target,[0,0]),
  testP12Mae:mae(split.test,split.full,target,choice)};
}
const nearly=(a,b,field)=>{if(Math.abs(a-b)>2e-5)throw Error('Model drift: '+field+' '+a+' vs '+b);};
for(const target of ['gap','formation']){
 const actual=source.metrics[target],derived=summary[target];
 if(JSON.stringify(actual.weights)!==JSON.stringify(derived.weights))throw Error('Tuned weights changed for '+target);
 for(const key of ['validationBaselineMae','validationBestMae','testBaselineMae','testP12Mae'])
  nearly(actual[key],derived[key],target+'.'+key);
}
const rows=split.full.map(x=>[x.id,x.formula,x.vpa,x.bond,x.coord,
 Number(x.gap.toFixed(7)),Number(x.formation.toFixed(7))]);
if(JSON.stringify(rows)!==JSON.stringify(source.rows))
 throw Error('Trained CIF descriptors diverged from source-frozen model.');
// Only external evaluation AFTER all weights and sources have been independently checked.
const trained=prepareP12Model(source);
const poly=read('tio2-polymorphs.json').rows.map(([id,name,truth,cell,sites])=>{
 const features=structureDescriptorsP1(structure(cell,sites));
 return {id,name,truth,
  ablated:rankP12(trained,features,'formation',{ablation:true}).rawValue,
  learned:rankP12(trained,features,'formation').rawValue};
});
const external=source.metrics.externalPolymorph;
for(const [name,key] of [['old','ablated'],['new','learned']]){
 const metric=polymorphPairwise(poly.map(x=>({truth:x.truth,prediction:x[key]})));
 nearly(metric.pairwiseMae,external[name].pairwiseMae,name+'.pairwiseMae');
 nearly(metric.rankAgreement,external[name].rankAgree,name+'.rankAgree');
}
const out={schema:source.schema,modelId:source.modelId,license:source.license,
 source:source.source,featureSpec:source.featureSpec,neighborCount:7,
 sourceSelection:source.sourceSelection,featureExtraction:source.featureExtraction,
 metrics:source.metrics,rows};
if(process.argv.includes('--write'))writeFileSync(url('learned-knn.json'),JSON.stringify(out)+'\n');
else if(!process.argv.includes('--check'))console.log(JSON.stringify({matched:true,summary,externalSamples:poly.length},null,2));
console.log('P1.2 source-fixed CIF training and external polymorph check: PASS');
