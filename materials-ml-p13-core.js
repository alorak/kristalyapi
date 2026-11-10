/* P1.3: explicit data-quality and repeated group-held-out validation audit.
 * Reports P1.2 JARVIS target errors only; no new training data, DFT or GNN.
 */
import {preparePolymorphCorpus,polymorphPredict} from './materials-ml-p12-core.js';
const PAIRS=Object.freeze([0.05,0.20,0.80].flatMap(bond=>
 [0.02,0.10,0.40].map(coord=>({bond,coord}))));
const BASE=Object.freeze({bond:0,coord:0});
const TARGETS=Object.freeze(['targetGapEV','targetFormationEVPerAtom']);
const round=n=>Number(n.toFixed(6));
function groupCorpus(rows){
 const byFormula=new Map();
 for(const r of rows){
  if(!byFormula.has(r.formula))byFormula.set(r.formula,new Map());
  const bySG=byFormula.get(r.formula);
  if(!bySG.has(r.sg))bySG.set(r.sg,[]);
  bySG.get(r.sg).push(r);
 }
 return byFormula;
}
function assertPartitions({train,validation,test}){
 const ids=new Set(),seen=new Map();
 for(const [kind,rows]of Object.entries({train,validation,test})){
  for(const r of rows){
   if(ids.has(r.id))throw Error('P1.3: yinelenen JID veya bölünme sızıntısı.');
   ids.add(r.id);
   const k=r.formula+'|'+r.sg;
   if(seen.has(k)&&seen.get(k)!==kind)throw Error('P1.3: formül/SG sızıntısı.');
   seen.set(k,kind);
  }
 }
 const tr=new Set(train.map(r=>r.formula));
 if(test.some(r=>!tr.has(r.formula)))throw Error('P1.3: bağımsız test formülü eğitimde yok.');
}
export function makeP13Folds(rows,foldCount=4){
 if(!Number.isInteger(foldCount)||foldCount<2||foldCount>8)throw Error('P1.3: fold sayısı 2–8 olmalı.');
 const groups=groupCorpus(rows);
 const folds=[];
 for(let fold=0;fold<foldCount;fold++){
  const split={train:[],validation:[],test:[]};
  for(const [formula,sg]of groups){
   const ordered=[...sg.entries()].sort((a,b)=>a[0]-b[0]);
   if(ordered.length===1){split.train.push(...ordered[0][1]);continue;}
   const ti=fold%ordered.length;
   const vi=ordered.length>=3?(fold+1)%ordered.length:-1;
   for(let i=0;i<ordered.length;i++)split[i===ti?'test':i===vi?'validation':'train'].push(...ordered[i][1]);
  }
  assertPartitions(split);
  if(split.test.length<5||split.validation.length<5||split.train.length<20)
   throw Error('P1.3: faz-gruplu fold için yeterli kayıt yok.');
  folds.push({fold:fold+1,...split});
 }
 return folds;
}
function score(rows,train,target,p){
 let sum=0,square=0;
 for(const x of rows){
  const y=polymorphPredict(train,x,target,p).estimate;
  const d=y-x[target];sum+=Math.abs(d);square+=d*d;
 }
 return {mae:sum/rows.length,rmse:Math.sqrt(square/rows.length)};
}
function evaluateRows(test,train,target,p){
 return test.map(r=>({
  id:r.id,formula:r.formula,sg:r.sg,
  actual:r[target],predicted:polymorphPredict(train,r,target,p).estimate
 }));
}
function summarize(rows){
 const abs=rows.map(x=>Math.abs(x.predicted-x.actual));
 return {n:rows.length,mae:round(abs.reduce((a,b)=>a+b,0)/rows.length),
  rmse:round(Math.sqrt(rows.reduce((a,x)=>a+(x.predicted-x.actual)**2,0)/rows.length))};
}
function percentile(sorted,alpha){return sorted[Math.max(0,Math.min(sorted.length-1,Math.floor(alpha*(sorted.length-1))))];}
function bootstrapByFormula(rows,repeats=256){
 // Repeated-fold observations are correlated: formula clusters are sampled as units.
 const groups=new Map();
 for(const row of rows){
  if(!groups.has(row.formula))groups.set(row.formula,[]);
  groups.get(row.formula).push(row);
 }
 const formulas=[...groups.keys()].sort();
 let seed=0x6e13a4b7;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const gains=[];
 for(let b=0;b<repeats;b++){
  let gain=0,count=0;
  for(let k=0;k<formulas.length;k++){
   const group=groups.get(formulas[Math.floor(random()*formulas.length)]);
   for(const p of group){gain+=p.baselineAbs-p.structuralAbs;count++;}
  }
  gains.push(gain/count);
 }
 gains.sort((a,b)=>a-b);
 return {low:round(percentile(gains,0.025)),high:round(percentile(gains,0.975)),
  unit:'MAE improvement; positive favors bond+coord',
  interpretation:'Exploratory formula-cluster bootstrap on repeated correlated folds; not a predictive coverage guarantee.'};
}
export function auditP13Data(source){
 const corpus=preparePolymorphCorpus(source),rows=corpus.rows,groups=groupCorpus(rows);
 const multi=[...groups.values()].filter(x=>x.size>=2).length;
 const phaseGroups=[...groups.values()].reduce((n,x)=>n+x.size,0);
 const closeAcrossSG=[];
 for(const [formula,bySG]of groups){
  const ordered=[...bySG];
  for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
   for(const a of ordered[i][1])for(const b of ordered[j][1]){
    if(Math.abs(Math.log(a.vpa/b.vpa))<0.02&&
       Math.abs(Math.log(a.bond/b.bond))<0.02&&Math.abs(a.coord-b.coord)<0.3)
     closeAcrossSG.push({formula,idA:a.id,idB:b.id,sgA:a.sg,sgB:b.sg});
   }
  }
 }
 return {corpus,quality:{sourceOriginal:source.totalOriginal,
  sourceRecords:source.records.length,accepted:rows.length,rejected:corpus.rejected.length,
  rejectionExamples:corpus.rejected.slice(0,15),
  formulas:groups.size,multiSGFormulas:multi,phaseGroups,
  nearDescriptorMatchesAcrossSG:closeAcrossSG.length,
  examples:closeAcrossSG.slice(0,12),
  disclaimer:'Close V/atom, bond and coordination are a warning only; not a crystallographic StructureMatcher or definitive duplicate.'}};
}
export function runP13Validation(source,{foldCount=4}={}){
 const {corpus,quality}=auditP13Data(source),folds=makeP13Folds(corpus.rows,foldCount);
 const report={schema:'kristalyapi.materials-ml-validation.p13.v1',
  source:'JARVIS OptB88vdW; CC BY 4.0',sourceHashes:corpus.source,quality,
  split:'Per-formula, space-group-held-out rotating folds; inner validation picks parameters independently in each fold.',
  folds:folds.map(f=>({fold:f.fold,train:f.train.length,
   validation:f.validation.length,test:f.test.length,
   trainGroups:new Set(f.train.map(r=>r.formula+'|'+r.sg)).size,
   validationGroups:new Set(f.validation.map(r=>r.formula+'|'+r.sg)).size,
   testGroups:new Set(f.test.map(r=>r.formula+'|'+r.sg)).size})),
  targets:{},
  limitations:'No expanded corpus, no external test, no true structure matching or uncertainty calibration. Rotating test folds reuse materials; bootstrap intervals are exploratory. Test data never tunes a fold model.'};
 for(const target of TARGETS){
  const joined=[];
  const foldReports=[];
  for(const f of folds){
   const tuned=PAIRS.map(p=>({p,err:score(f.validation,f.train,target,p).mae}))
    .sort((a,b)=>a.err-b.err||a.p.bond-b.p.bond||a.p.coord-b.p.coord)[0].p;
   const structural=evaluateRows(f.test,f.train,target,tuned);
   const baseline=evaluateRows(f.test,f.train,target,BASE);
   const shape=summarize(structural),base=summarize(baseline);
   foldReports.push({fold:f.fold,selected:tuned,structural:shape,baseline:base,
    improvement:round(base.mae-shape.mae)});
   for(let i=0;i<structural.length;i++){
    joined.push({formula:structural[i].formula,
     structuralAbs:Math.abs(structural[i].predicted-structural[i].actual),
     baselineAbs:Math.abs(baseline[i].predicted-baseline[i].actual)});
   }
  }
  const total=joined.length;
  const structuralMae=joined.reduce((n,r)=>n+r.structuralAbs,0)/total;
  const baselineMae=joined.reduce((n,r)=>n+r.baselineAbs,0)/total;
  report.targets[target]={totalFoldObservations:total,folds:foldReports,
   structuralMAE:round(structuralMae),baselineMAE:round(baselineMae),
   improvement:round(baselineMae-structuralMae),
   clusteredBootstrap95:bootstrapByFormula(joined)};
 }
 return report;
}
